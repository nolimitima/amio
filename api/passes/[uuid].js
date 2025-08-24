// api/passes/[uuid].js
const { createClient } = require("@supabase/supabase-js");
const passkit = require("passkit-generator");
const fs = require("fs");
const path = require("path");

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  PASS_P12_BASE64,
  PASS_P12_PASSWORD = "",
  PASS_TYPE_IDENTIFIER,        // напр. "pass.com.amian"
  TEAM_IDENTIFIER,             // напр. "ABCDE12345"
  ORG_NAME = "Amian",
} = process.env;

function p12Buffer() {
  if (!PASS_P12_BASE64) throw new Error("PASS_P12_BASE64 missing");
  return Buffer.from(PASS_P12_BASE64, "base64");
}

module.exports = async (req, res) => {
  try {
    const uuid = req.query?.uuid;
    if (!uuid) return res.status(400).json({ error: "Missing uuid" });

    // 1) Берём данные карты из Supabase
    // ВАЖНО: у тебя в Dashboard insert идёт в колонку "uuid", а не "id" → ищем по uuid
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: card, error } = await supabase
      .from("issued_cards")
      .select("uuid, guest_name, balance, email, phone")
      .eq("uuid", uuid)
      .single();

    if (error || !card) {
      return res.status(404).json({ error: "Card not found" });
    }

    // 2) Минимальный pass.json (storeCard)
    const passDef = {
      formatVersion: 1,
      passTypeIdentifier: PASS_TYPE_IDENTIFIER,
      teamIdentifier: TEAM_IDENTIFIER,
      organizationName: ORG_NAME,
      description: "Amian Loyalty",
      serialNumber: uuid,
      foregroundColor: "rgb(255,255,255)",
      backgroundColor: "rgb(16,24,43)", // твой дефолт
      labelColor: "rgb(241,239,237)",
      storeCard: {
        primaryFields: [
          { key: "holder", label: "Гость", value: card.guest_name || "Клиент" }
        ],
        secondaryFields: [
          { key: "balance", label: "Баланс", value: String(card.balance ?? 0) },
          { key: "email",   label: "Email",   value: card.email || "-" }
        ],
        auxiliaryFields: [
          { key: "phone",   label: "Телефон", value: card.phone || "-" }
        ],
        barcode: {
          message: uuid,
          format: "PKBarcodeFormatQR",
          messageEncoding: "iso-8859-1",
          altText: uuid
        }
      }
    };

    const model = passkit.Pass.from(passDef);

    // 3) Добавляем ОБЯЗАТЕЛЬНЫЕ ассеты: icon.png и icon@2x.png
    // Положи их в репозиторий: backend/pass-assets/{icon.png, icon@2x.png}
    const assetsDir = path.join(process.cwd(), "backend", "pass-assets");
    const required = ["icon.png", "icon@2x.png"];
    for (const name of required) {
      const p = path.join(assetsDir, name);
      if (!fs.existsSync(p)) {
        return res.status(500).json({ error: `Missing asset ${name}` });
      }
      model.addBuffer(name, fs.readFileSync(p));
    }
    // (необязательно) logo.png/logo@2x.png — если будут, тоже добавь:
    for (const name of ["logo.png", "logo@2x.png"]) {
      const p = path.join(assetsDir, name);
      if (fs.existsSync(p)) model.addBuffer(name, fs.readFileSync(p));
    }

    // 4) Сертификаты
    const cert = {
      wwdr: passkit.WWDR,
      signerCert: p12Buffer(),
      signerKey: p12Buffer(),
      signerKeyPassphrase: PASS_P12_PASSWORD
    };

    // 5) Генерируем .pkpass → Buffer
    const stream = await model.generate(cert);
    const chunks = [];
    await new Promise((resolve, reject) => {
      stream.on("data", (c) => chunks.push(c));
      stream.on("end", resolve);
      stream.on("error", reject);
    });
    const pkpass = Buffer.concat(chunks);

    // 6) Отдаём файл
    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", "attachment; filename=card.pkpass");
    res.status(200).send(pkpass);
  } catch (e) {
    console.error("PKPASS error:", e);
    res.status(500).json({ error: "Failed to generate pass", detail: String(e?.message || e) });
  }
};
