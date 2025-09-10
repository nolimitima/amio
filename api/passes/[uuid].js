// api/passes/[uuid].js
// Vercel Serverless Function (Node 20, CommonJS)
// Supabase + passkit-generator v3
// Надёжная работа с сертификатами: WWDR (строка PEM) + извлечение cert/key из .p12

const { createClient } = require("@supabase/supabase-js");
const { PKPass } = require("passkit-generator");
const fs = require("fs");
const path = require("path");
const forge = require("node-forge");

// =============== ENV =================
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_KEY;

const PASS_P12_BASE64 = process.env.PASS_P12_BASE64;
const PASS_P12_PASSWORD = process.env.PASS_P12_PASSWORD || "";
const PASS_TYPE_IDENTIFIER = process.env.PASS_TYPE_IDENTIFIER; // напр. "pass.com.amian"
const TEAM_IDENTIFIER = process.env.TEAM_IDENTIFIER;           // Apple Team ID
const ORG_NAME = process.env.ORG_NAME || "Amian";
const WWDR_CERT_BASE64 = process.env.WWDR_CERT_BASE64;         // (строка PEM ИЛИ base64(PEM/DER))

// Guards
if (!SUPABASE_URL) throw new Error("SUPABASE_URL missing");
if (!SERVICE_KEY) throw new Error("Service key missing (SUPABASE_SERVICE_ROLE/KEY)");
if (!PASS_P12_BASE64) throw new Error("PASS_P12_BASE64 missing");
if (!PASS_TYPE_IDENTIFIER) throw new Error("PASS_TYPE_IDENTIFIER missing");
if (!TEAM_IDENTIFIER) throw new Error("TEAM_IDENTIFIER missing");
if (!WWDR_CERT_BASE64) throw new Error("WWDR_CERT_BASE64 missing");

// =============== UTILS ===============
const hex2rgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  return m ? `rgb(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)})` : undefined;
};

// DER -> PEM
function derToPemCertString(derBuf) {
  const derB64 = derBuf.toString("base64");
  const lines = derB64.match(/.{1,64}/g) || [derB64];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----\n`;
}

// Возвращает **СТРОКУ PEM** WWDR (не Buffer!)
function getWwdrPemString() {
  const raw = WWDR_CERT_BASE64 || "";

  // Case A: ENV уже содержит сырой PEM (с маркерами)
  if (raw.includes("-----BEGIN CERTIFICATE-----")) {
    // Удаляем BOM/CRLF, лишнее по краям, гарантируем финальный \n
    let s = raw.replace(/\r\n/g, "\n").trim() + "\n";
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    // Вычищаем возможный шум до BEGIN (на некоторых экспортах)
    const begin = s.indexOf("-----BEGIN CERTIFICATE-----");
    const end = s.lastIndexOf("-----END CERTIFICATE-----");
    if (begin >= 0 && end >= 0) {
      s = s.slice(begin, end + "-----END CERTIFICATE-----".length) + "\n";
    }
    return s;
  }

  // Case B: ENV — base64(...)
  let decoded;
  try {
    decoded = Buffer.from(raw, "base64");
  } catch {
    throw new Error("WWDR_CERT_BASE64: invalid base64");
  }
  if (!decoded || !decoded.length) throw new Error("WWDR_CERT_BASE64 decoded empty");

  // Если это base64 от PEM-текста
  const asText = decoded.toString("utf8");
  if (asText.includes("-----BEGIN CERTIFICATE-----")) {
    let s = asText.replace(/\r\n/g, "\n").trim() + "\n";
    const begin = s.indexOf("-----BEGIN CERTIFICATE-----");
    const end = s.lastIndexOf("-----END CERTIFICATE-----");
    if (begin >= 0 && end >= 0) {
      s = s.slice(begin, end + "-----END CERTIFICATE-----".length) + "\n";
    }
    return s;
  }

  // Иначе это DER -> оборачиваем в PEM-строку
  return derToPemCertString(decoded);
}

function basicPemSanityCheckString(pemString) {
  if (
    !pemString.includes("-----BEGIN CERTIFICATE-----") ||
    !pemString.includes("-----END CERTIFICATE-----")
  ) {
    throw new Error("WWDR PEM markers not found");
  }
  // Верифицируем base64 внутри блоков
  const chunks = pemString
    .split("-----BEGIN CERTIFICATE-----")
    .slice(1)
    .map((chunk) => chunk.split("-----END CERTIFICATE-----")[0] || "");
  if (!chunks.length) throw new Error("No WWDR cert blocks detected");
  for (const body of chunks) {
    const cleaned = body.replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) {
      throw new Error("WWDR PEM contains non-base64 characters");
    }
  }
}

function getP12Buffer() {
  const buf = Buffer.from(PASS_P12_BASE64, "base64");
  if (!buf.length) throw new Error("PASS_P12_BASE64 not valid base64");
  return buf;
}

// Извлекаем privateKey/certificate из PKCS#12 (.p12) и возвращаем PEM-строки
function parseP12ToPem(p12Buf, passphrase) {
  // forge требует "binary string" для fromDer
  const derBinary = p12Buf.toString("binary");
  const asn1 = forge.asn1.fromDer(derBinary);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, passphrase);

  let keyObj = null;
  let certObj = null;

  for (const safeContent of p12.safeContents) {
    for (const safeBag of safeContent.safeBags) {
      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag && safeBag.key) {
        keyObj = safeBag.key;
      } else if (safeBag.type === forge.pki.oids.keyBag && safeBag.key) {
        keyObj = safeBag.key;
      } else if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
        certObj = safeBag.cert;
      }
    }
  }

  if (!keyObj || !certObj) {
    throw new Error("Could not extract key/cert from p12");
  }

  const privateKeyPem = forge.pki.privateKeyToPem(keyObj);
  const certificatePem = forge.pki.certificateToPem(certObj);

  return { privateKeyPem, certificatePem };
}

// Fetch helper (Node18/20 has global fetch)
async function fetchBuffer(url) {
  try {
    if (!url) return null;
    const r = await fetch(url);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

// =============== HANDLER ===============
module.exports = async (req, res) => {
  try {
    const uuid = req.query?.uuid;
    if (!uuid) return res.status(400).json({ error: "Missing uuid" });

    // ---------- CERT DIAGNOSTICS ----------
    if (req.query.certdiag === "1") {
      try {
        const wwdrPem = getWwdrPemString();
        basicPemSanityCheckString(wwdrPem);
        const p12 = getP12Buffer();
        return res.status(200).json({
          ok: true,
          wwdrBytes: Buffer.byteLength(wwdrPem, "utf8"),
          p12Bytes: p12.length,
          passTypeId: PASS_TYPE_IDENTIFIER,
          teamId: TEAM_IDENTIFIER,
          tip: "WWDR/P12 look sane. Try /api/passes/<uuid>."
        });
      } catch (e) {
        return res.status(400).json({ ok: false, error: String(e?.message || e) });
      }
    }

    if (req.query.p12diag === "1") {
      try {
        const p12Buf = getP12Buffer();
        const { privateKeyPem, certificatePem } = parseP12ToPem(p12Buf, PASS_P12_PASSWORD);
        return res.status(200).json({
          ok: true,
          privateKeyBytes: Buffer.byteLength(privateKeyPem, "utf8"),
          certificateBytes: Buffer.byteLength(certificatePem, "utf8"),
          previewKey: privateKeyPem.slice(0, 32) + "...",
          previewCert: certificatePem.slice(0, 32) + "..."
        });
      } catch (e) {
        return res.status(400).json({ ok: false, error: String(e?.message || e) });
      }
    }

    // ---------- DEBUG DB ----------
    if (req.query.debug === "1") {
      const supabaseDbg = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
      const { data: raw, error: rawErr } = await supabaseDbg
        .from("issued_cards")
        .select("*")
        .eq("uuid", uuid);
      const mask = (s) => (s ? `${String(s).slice(0,6)}…${String(s).slice(-4)}` : null);
      return res.status(200).json({
        ok: true,
        uuid,
        supabaseUrl: SUPABASE_URL,
        hasServiceKey: !!SERVICE_KEY,
        serviceKeyMask: mask(SERVICE_KEY),
        rows: raw?.length || 0,
        error: rawErr || null,
        sample: raw?.[0] || null,
      });
    }

    // ---------- DB READ ----------
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: issued, error: e1 } = await supabase
      .from("issued_cards")
      .select("uuid, guest_name, email, phone, balance, qr_value, card_template_id")
      .eq("uuid", uuid)
      .single();
    if (e1 || !issued) return res.status(404).json({ error: "Card not found" });

    const { data: tpl, error: e2 } = await supabase
      .from("card_templates")
      .select("user_facing_name, logo_url, cover_url, bg_color, label_color, value_color, description, contact_email, contact_phone, website_url")
      .eq("id", issued.card_template_id)
      .single();
    if (e2 || !tpl) return res.status(404).json({ error: "Template not found" });

    // ---------- pass.json ----------
    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: PASS_TYPE_IDENTIFIER,
      teamIdentifier: TEAM_IDENTIFIER,
      organizationName: ORG_NAME,
      description: tpl.user_facing_name || "Digital Card",
      serialNumber: uuid,
      foregroundColor: hex2rgb(tpl.value_color),
      backgroundColor: hex2rgb(tpl.bg_color),
      labelColor: hex2rgb(tpl.label_color),
      storeCard: {
        headerFields: [
          { key: "title", label: "Карта", value: tpl.user_facing_name || "Amian" },
        ],
        primaryFields: [
          { key: "holder", label: "Гость", value: issued.guest_name || "Клиент" },
        ],
        secondaryFields: [
          { key: "balance", label: "Баланс", value: String(issued.balance ?? 0) },
          { key: "email", label: "Email", value: issued.email || "-" },
        ],
        auxiliaryFields: [
          { key: "phone", label: "Телефон", value: issued.phone || "-" },
        ],
        backFields: [
          ...(tpl.description ? [{ key: "desc", label: "Описание", value: tpl.description }] : []),
          ...(tpl.website_url ? [{ key: "site", label: "Сайт", value: tpl.website_url }] : []),
          ...(tpl.contact_email ? [{ key: "support", label: "Поддержка", value: tpl.contact_email }] : []),
        ],
      },
    };

    // ---------- CERTS ----------
    const wwdrPem = getWwdrPemString();               // строка PEM
    basicPemSanityCheckString(wwdrPem);

    const p12Buf = getP12Buffer();
    const { privateKeyPem, certificatePem } = parseP12ToPem(p12Buf, PASS_P12_PASSWORD);

    // ---------- PKPass (Buffer Model) ----------
    const pass = new PKPass(
      { "pass.json": Buffer.from(JSON.stringify(passJson)) },
      {
        wwdr: wwdrPem,                 // строка PEM
        signerCert: certificatePem,    // строка PEM
        signerKey: privateKeyPem,      // строка PEM
        signerKeyPassphrase: PASS_P12_PASSWORD,
      },
      {}
    );

    // ---------- Assets (required icon) ----------
    const assetsDir = path.join(process.cwd(), "backend", "pass-assets");
    for (const name of ["icon.png", "icon@2x.png"]) {
      const p = path.join(assetsDir, name);
      if (!fs.existsSync(p)) {
        return res.status(500).json({ error: `Missing asset ${name} (backend/pass-assets)` });
      }
      pass.addBuffer(name, fs.readFileSync(p));
    }

    // Optional assets from template
    const logoBuf = await fetchBuffer(tpl.logo_url);
    if (logoBuf) pass.addBuffer("logo.png", logoBuf);
    const coverBuf = await fetchBuffer(tpl.cover_url);
    if (coverBuf) pass.addBuffer("background.png", coverBuf);

    // ---------- Barcode / QR ----------
    const payload = issued.qr_value || uuid;
    pass.setBarcodes({
      message: payload,
      format: "PKBarcodeFormatQR",
      altText: uuid,
    });

    // ---------- Build & Send ----------
    const pkpass = pass.getAsBuffer();
    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", `attachment; filename=${uuid}.pkpass`);
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.status(200).send(pkpass);

  } catch (err) {
    console.error("PKPASS error:", err);
    return res.status(500).json({ error: "Failed to generate pass", detail: String(err?.message || err) });
  }
};
