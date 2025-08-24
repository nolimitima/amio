// api/passes/[uuid].js
const { createClient } = require("@supabase/supabase-js");
const passkit = require("passkit-generator");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const PASS_P12_BASE64 = process.env.PASS_P12_BASE64;
const PASS_P12_PASSWORD = process.env.PASS_P12_PASSWORD || "";
const PASS_TYPE_IDENTIFIER = process.env.PASS_TYPE_IDENTIFIER;
const TEAM_IDENTIFIER = process.env.TEAM_IDENTIFIER;
const ORG_NAME = process.env.ORG_NAME || "Amian";

const hex2rgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return undefined;
  return `rgb(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)})`;
};

const p12Buffer = () => {
  if (!PASS_P12_BASE64) throw new Error("PASS_P12_BASE64 missing");
  return Buffer.from(PASS_P12_BASE64, "base64");
};

// Node 18+/20+ имеет global fetch
async function fetchBuffer(url) {
  if (!url) return null;
  const r = await fetch(url);
  if (!r.ok) return null;
  return Buffer.from(await r.arrayBuffer());
}

module.exports = async (req, res) => {
  try {
    const uuid = req.query?.uuid;
    if (!uuid) return res.status(400).json({ error: "Missing uuid" });

    // 1) читаем issued_cards
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: issued, error: e1 } = await supabase
      .from("issued_cards")
      .select("uuid, guest_name, email, phone, balance, qr_value, card_template_id")
      .eq("uuid", uuid)
      .single();
    if (e1 || !issued) return res.status(404).json({ error: "Card not found" });

    // 2) читаем шаблон
    const { data: tpl, error: e2 } = await supabase
      .from("card_templates")
      .select("user_facing_name, logo_url, cover_url, bg_color, label_color, value_color, description, contact_email, contact_phone, website_url")
      .eq("id", issued.card_template_id)
      .single();
    if (e2 || !tpl) return res.status(404).json({ error: "Template not found" });

    // 3) pass.json (storeCard)
    const passDef = {
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
        headerFields: [{ key: "title", label: "Карта", value: tpl.user_facing_name || "Amian" }],
        primaryFields: [{ key: "holder", label: "Гость", value: issued.guest_name || "Клиент" }],
        secondaryFields: [
          { key: "balance", label: "Баланс", value: String(issued.balance ?? 0) },
          { key: "email", label: "Email", value: issued.email || "-" }
        ],
        auxiliaryFields: [{ key: "phone", label: "Телефон", value: issued.phone || "-" }],
        backFields: [
          ...(tpl.description ? [{ key: "desc", label: "Описание", value: tpl.description }] : []),
          ...(tpl.website_url ? [{ key: "site", label: "Сайт", value: tpl.website_url }] : []),
          ...(tpl.contact_email ? [{ key: "support", label: "Поддержка", value: tpl.contact_email }] : []),
        ],
        barcode: {
          message: issued.qr_value || uuid, // payload (а не URL)
          format: "PKBarcodeFormatQR",
          messageEncoding: "iso-8859-1",
          altText: uuid
        }
      }
    };

    const model = passkit.Pass.from(passDef);

    // 4) ассеты: обязательные icon* из репо
    const assetsDir = path.join(process.cwd(), "backend", "pass-assets");
    for (const name of ["icon.png", "icon@2x.png"]) {
      const p = path.join(assetsDir, name);
      if (!fs.existsSync(p)) {
        return res.status(500).json({ error: `Missing asset ${name} (backend/pass-assets)` });
      }
      model.addBuffer(name, fs.readFileSync(p));
    }

    // 4.1) логотип из шаблона → logo.png
    const logoBuf = await fetchBuffer(tpl.logo_url);
    if (logoBuf) model.addBuffer("logo.png", logoBuf);

    // 4.2) обложка → background.png
    const coverBuf = await fetchBuffer(tpl.cover_url);
    if (coverBuf) model.addBuffer("background.png", coverBuf);

    // 5) сертификаты и генерация
    const cert = {
      wwdr: passkit.WWDR,
      signerCert: p12Buffer(),
      signerKey: p12Buffer(),
      signerKeyPassphrase: PASS_P12_PASSWORD
    };
    const stream = await model.generate(cert);
    const chunks = [];
    await new Promise((resolve, reject) => {
      stream.on("data", c => chunks.push(c));
      stream.on("end", resolve);
      stream.on("error", reject);
    });
    const pkpass = Buffer.concat(chunks);

    // 6) отдаём файл
    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", "attachment; filename=card.pkpass");
    res.status(200).send(pkpass);
  } catch (err) {
    console.error("PKPASS error:", err);
    res.status(500).json({ error: "Failed to generate pass", detail: String(err?.message || err) });
  }
};
