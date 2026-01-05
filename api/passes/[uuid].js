// api/passes/[uuid].js
// Vercel Serverless Function (Node 20, CommonJS)
// Supabase + passkit-generator v3
// CRITICAL: This endpoint MUST generate authenticationToken for PassKit web service

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
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;           // Base URL for webServiceURL

// Guards
if (!SUPABASE_URL) throw new Error("SUPABASE_URL missing");
if (!SERVICE_KEY) throw new Error("Service key missing (SUPABASE_SERVICE_ROLE/KEY)");
if (!PASS_P12_BASE64) throw new Error("PASS_P12_BASE64 missing");
if (!PASS_TYPE_IDENTIFIER) throw new Error("PASS_TYPE_IDENTIFIER missing");
if (!TEAM_IDENTIFIER) throw new Error("TEAM_IDENTIFIER missing");
if (!WWDR_CERT_BASE64) throw new Error("WWDR_CERT_BASE64 missing");
if (!PUBLIC_BASE_URL) throw new Error("PUBLIC_BASE_URL missing");

// =============== UTILS ===============
const hex2rgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  return m ? `rgb(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)})` : undefined;
};

const generateAuthToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

function derToPemCertString(derBuf) {
  const derB64 = derBuf.toString("base64");
  const lines = derB64.match(/.{1,64}/g) || [derB64];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----\n`;
}

function getWwdrPemString() {
  const raw = WWDR_CERT_BASE64 || "";
  if (raw.includes("-----BEGIN CERTIFICATE-----")) {
    let s = raw.replace(/\r\n/g, "\n").trim() + "\n";
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    const begin = s.indexOf("-----BEGIN CERTIFICATE-----");
    const end = s.lastIndexOf("-----END CERTIFICATE-----");
    if (begin >= 0 && end >= 0) {
      s = s.slice(begin, end + "-----END CERTIFICATE-----".length) + "\n";
    }
    return s;
  }
  let decoded;
  try {
    decoded = Buffer.from(raw, "base64");
  } catch {
    throw new Error("WWDR_CERT_BASE64: invalid base64");
  }
  if (!decoded || !decoded.length) throw new Error("WWDR_CERT_BASE64 decoded empty");
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
  return derToPemCertString(decoded);
}

function basicPemSanityCheckString(pemString) {
  if (
    !pemString.includes("-----BEGIN CERTIFICATE-----") ||
    !pemString.includes("-----END CERTIFICATE-----")
  ) {
    throw new Error("WWDR PEM markers not found");
  }
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

function parseP12ToPem(p12Buf, passphrase) {
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

    // ---------- DB READ ----------
    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: issued, error: e1 } = await supa
      .from("issued_cards")
      .select("uuid, guest_name, email, phone, balance, qr_value, card_template_id, auth_token, promo_message")
      .eq("uuid", uuid)
      .single();
    if (e1 || !issued) return res.status(404).json({ error: "Card not found" });

    // КРИТИЧНО: Генерируем и сохраняем auth_token если его нет
    // Токен ДОЛЖЕН существовать в БД перед генерацией pass.json
    let authToken = issued.auth_token;
    if (!authToken) {
      authToken = generateAuthToken();
      console.log(`[PassKit] Generating new auth_token for ${uuid}: ${authToken.substring(0, 8)}...`);

      const { data: updated, error: updateError } = await supa
        .from("issued_cards")
        .update({ auth_token: authToken })
        .eq("uuid", uuid)
        .select("auth_token")
        .single();

      if (updateError || !updated || updated.auth_token !== authToken) {
        console.error("[PassKit] ❌ CRITICAL: Failed to save auth_token to DB:", updateError);
        return res.status(500).json({
          error: "Failed to save authentication token",
          detail: "Cannot generate pass without valid auth_token in database"
        });
      }

      console.log(`[PassKit] ✅ Auth token saved successfully for ${uuid}`);
    } else {
      console.log(`[PassKit] Using existing auth_token for ${uuid}: ${authToken.substring(0, 8)}...`);
    }

    const serial = issued.uuid;

    const { data: tpl, error: e2 } = await supa
      .from("card_templates")
      .select("user_facing_name, logo_url, cover_url, bg_color, label_color, value_color, description, contact_email, contact_phone, website_url, bonus_percent_field")
      .eq("id", issued.card_template_id)
      .single();
    if (e2 || !tpl) return res.status(404).json({ error: "Template not found" });

    // ---------- Barcode payload ----------
    const payload = issued.qr_value || uuid;

    // КРИТИЧНО: Финальная проверка что токен существует
    if (!authToken || authToken.trim().length === 0) {
      console.error(`[PassKit] ❌ CRITICAL: authToken is empty for ${uuid}`);
      return res.status(500).json({
        error: "Authentication token is missing",
        detail: "Cannot generate pass without authenticationToken"
      });
    }

    // ---------- pass.json ----------
    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: PASS_TYPE_IDENTIFIER,
      teamIdentifier: TEAM_IDENTIFIER,
      organizationName: ORG_NAME,
      description: tpl.user_facing_name || "Digital Card",
      serialNumber: uuid,

      // Web service для push-обновлений
      webServiceURL: `${PUBLIC_BASE_URL}/api/passkit`,
      authenticationToken: authToken, // КРИТИЧНО: этот токен должен совпадать с auth_token в БД

      // Название рядом с логотипом
      logoText: tpl.user_facing_name || ORG_NAME,

      // Цвета
      foregroundColor: hex2rgb(tpl.value_color || "#232323"),
      backgroundColor: hex2rgb(tpl.bg_color || "#10182B"),
      labelColor: hex2rgb(tpl.label_color || "#F1EFED"),

      storeCard: {
        // Header — только баланс
        headerFields: [
          { key: "balance", label: "Баланс", value: `${issued.balance ?? 0} B` }
        ],

        // primaryFields ПУСТЫЕ (не хотим больших заголовков поверх cover)
        primaryFields: [],

        // secondary — только «Гость»
        secondaryFields: [
          { key: "holder", label: "Гость", value: issued.guest_name || "Клиент" }
        ],

        // auxiliary — Бонус + Promo message (with changeMessage for notifications)
        auxiliaryFields: [
          { key: "bonus", label: "Бонус", value: `${Number(tpl.bonus_percent_field || 0)}%` },
          // Promo field with changeMessage - triggers notification banner when updated
          ...(issued.promo_message ? [{
            key: "promo",
            label: "Акция",
            value: issued.promo_message,
            changeMessage: "📢 %@"  // %@ will be replaced with the new value
          }] : [])
        ],

        // Оборотка — бизнес-инфа
        backFields: [
          ...(tpl.description ? [{ key: "desc", label: "Описание", value: tpl.description }] : []),
          ...(tpl.website_url ? [{ key: "site", label: "Сайт", value: tpl.website_url }] : []),
          ...(tpl.contact_email ? [{ key: "email", label: "Email", value: tpl.contact_email }] : []),
          ...(tpl.contact_phone ? [{ key: "phone", label: "Телефон", value: tpl.contact_phone }] : []),
        ],
      },

      // QR codes (both fields for compatibility)
      barcodes: [
        {
          format: "PKBarcodeFormatQR",
          message: serial,
          messageEncoding: "iso-8859-1"
        }
      ],
      barcode: {
        format: "PKBarcodeFormatQR",
        message: serial,
        messageEncoding: "iso-8859-1"
      },
    };

    // ---------- CERTS ----------
    const wwdrPem = getWwdrPemString();
    basicPemSanityCheckString(wwdrPem);
    const p12Buf = getP12Buffer();
    const { privateKeyPem, certificatePem } = parseP12ToPem(p12Buf, PASS_P12_PASSWORD);

    // ---------- PKPass (Buffer Model) ----------
    const pass = new PKPass(
      { "pass.json": Buffer.from(JSON.stringify(passJson)) },
      {
        wwdr: wwdrPem,
        signerCert: certificatePem,
        signerKey: privateKeyPem,
        signerKeyPassphrase: PASS_P12_PASSWORD,
      },
      {}
    );

    // ---------- Assets (required icon) ----------
    const assetsDir = path.join(process.cwd(), "backend", "pass-assets");
    for (const name of ["icon.png", "icon@2x.png"]) {
      const p = path.join(assetsDir, name);
      if (fs.existsSync(p)) pass.addBuffer(name, fs.readFileSync(p));
    }

    // Optional assets from template
    const logoBuf = await fetchBuffer(tpl.logo_url);
    if (logoBuf) pass.addBuffer("logo.png", logoBuf);

    // Cover → как фон, без текста поверх
    const coverBuf = await fetchBuffer(tpl.cover_url);
    if (coverBuf) pass.addBuffer("strip.png", coverBuf);

    // ---------- Barcode / QR ----------
    // Already embedded into pass.json above as QR (both barcodes[] and barcode)

    // ---------- Build & Send ----------
    // Финальная проверка что authenticationToken встроен в pass.json
    if (!passJson.authenticationToken) {
      console.error(`[PassKit] ❌ CRITICAL: authenticationToken missing from pass.json for ${uuid}`);
      return res.status(500).json({
        error: "Authentication token not embedded in pass",
        detail: "pass.json is missing authenticationToken field"
      });
    }

    console.log(`[PassKit] ✅ Generating pass for ${uuid} with auth_token: ${passJson.authenticationToken.substring(0, 8)}...`);
    const pkpass = pass.getAsBuffer();
    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", `attachment; filename=${uuid}.pkpass`);
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.status(200).send(pkpass);

  } catch (err) {
    console.error("passes/[uuid] error:", err);
    return res.status(500).json({ error: "Failed to generate pass", detail: String(err?.message || err) });
  }
};
