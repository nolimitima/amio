// api/passes/[uuid].js — Vercel Node.js, CommonJS, passkit-generator v3
const { createClient } = require("@supabase/supabase-js");
const { PKPass } = require("passkit-generator");
const fs = require("fs");
const path = require("path");

// ===== ENV =====
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
const WWDR_CERT_BASE64 = process.env.WWDR_CERT_BASE64;         // PEM в base64

// ===== Guards =====
if (!SUPABASE_URL) throw new Error("SUPABASE_URL missing");
if (!SERVICE_KEY) throw new Error("Service key missing (SUPABASE_SERVICE_ROLE/KEY)");
if (!PASS_P12_BASE64) throw new Error("PASS_P12_BASE64 missing");
if (!PASS_TYPE_IDENTIFIER) throw new Error("PASS_TYPE_IDENTIFIER missing");
if (!TEAM_IDENTIFIER) throw new Error("TEAM_IDENTIFIER missing");
if (!WWDR_CERT_BASE64) throw new Error("WWDR_CERT_BASE64 missing");

// ===== Utils =====
const hex2rgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  return m ? `rgb(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)})` : undefined;
};

const getWWDR = () => Buffer.from(WWDR_CERT_BASE64, "base64");
const getP12  = () => Buffer.from(PASS_P12_BASE64, "base64");

// Node 18/20: global fetch available
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

module.exports = async (req, res) => {
  try {
    const uuid = req.query?.uuid;
    if (!uuid) return res.status(400).json({ error: "Missing uuid" });

    // ---- DEBUG: /api/passes/:uuid?debug=1 ----
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

    // 1) Supabase через service role (обходит RLS)
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: issued, error: e1 } = await supabase
      .from("issued_cards")
      .select("uuid, guest_name, email, phone, balance, qr_value, card_template_id")
      .eq("uuid", uuid)
      .single();

    if (e1 || !issued) {
      return res.status(404).json({ error: "Card not found" });
    }

    const { data: tpl, error: e2 } = await supabase
      .from("card_templates")
      .select("user_facing_name, logo_url, cover_url, bg_color, label_color, value_color, description, contact_email, contact_phone, website_url")
      .eq("id", issued.card_template_id)
      .single();

    if (e2 || !tpl) {
      return res.status(404).json({ error: "Template not found" });
    }

    // 2) props для v3 (ОБЯЗАТЕЛЬНО: type)
    const props = {
      type: "storeCard",
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

    // 3) создаём PKPass (v3)
    const pass = new PKPass(
      {}, // buffers (добавим ниже)
      {
        wwdr: getWWDR(),
        signerCert: getP12(),            // p12 контейнер
        signerKey: getP12(),             // p12 контейнер
        signerKeyPassphrase: PASS_P12_PASSWORD,
      },
      props
    );

    // 4) ассеты: ОБЯЗАТЕЛЬНО icon.png и icon@2x.png
    const assetsDir = path.join(process.cwd(), "backend", "pass-assets");
    for (const name of ["icon.png", "icon@2x.png"]) {
      const p = path.join(assetsDir, name);
      if (!fs.existsSync(p)) {
        return res.status(500).json({ error: `Missing asset ${name} (backend/pass-assets)` });
      }
      pass.addBuffer(name, fs.readFileSync(p));
    }

    // 4.1) дополнительные ассеты из шаблона
    const logoBuf = await fetchBuffer(tpl.logo_url);
    if (logoBuf) pass.addBuffer("logo.png", logoBuf);

    const coverBuf = await fetchBuffer(tpl.cover_url);
    if (coverBuf) pass.addBuffer("background.png", coverBuf);

    // 5) штрихкод/QR (v3: через setBarcodes)
    const payload = issued.qr_value || uuid;
    pass.setBarcodes({
      message: payload,
      format: "PKBarcodeFormatQR",
      altText: uuid,
    });

    // 6) собираем и отдаём
    const pkpass = pass.getAsBuffer(); // можно и stream, но буфер проще для serverless

    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", "attachment; filename=card.pkpass");
    res.status(200).send(pkpass);
  } catch (err) {
    console.error("PKPASS error:", err);
    res.status(500).json({ error: "Failed to generate pass", detail: String(err?.message || err) });
  }
};

