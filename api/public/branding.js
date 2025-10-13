// /api/public/branding.js
const { createClient } = require("@supabase/supabase-js");

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

function normalizeLogoUrl(logo_url) {
  if (!logo_url) return null;
  // уже абсолютный URL
  if (/^https?:\/\//i.test(logo_url)) return logo_url;
  // если это путь из Supabase Storage вида `bucket/path/to/file.png`
  const url = process.env.SUPABASE_URL;
  const base = url.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${logo_url.replace(/^\/+/, "")}`;
}

function pickTextColor(bgHex = "#0E1411") {
  // простая контрастность: >186 -> тёмный текст, иначе светлый
  const hex = bgHex.replace("#", "");
  const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
  const yiq = (r*299 + g*587 + b*114) / 1000;
  return yiq >= 186 ? "#111111" : "#F8FAF9";
}

module.exports = async (req, res) => {
  try {
    const { slug, uuid } = req.query || {};
    if (!slug && !uuid) return res.status(400).json({ error: "slug or uuid required" });

    let tpl;
    if (slug) {
      const { data, error } = await supa
        .from("registration_links")
        .select(`
          is_active,
          card_templates:card_template_id (
            user_facing_name, internal_name,
            logo_url, cover_url,
            bg_color, label_color, value_color
          )
        `)
        .eq("slug", slug)
        .single();
      if (error || !data) return res.status(404).json({ error: "not found" });
      if (!data.is_active) return res.status(403).json({ error: "link inactive" });
      tpl = data.card_templates;
    } else {
      const { data, error } = await supa
        .from("issued_cards")
        .select(`
          card_templates:card_template_id (
            user_facing_name, internal_name,
            logo_url, cover_url,
            bg_color, label_color, value_color
          )
        `)
        .eq("uuid", uuid)
        .single();
      if (error || !data) return res.status(404).json({ error: "not found" });
      tpl = data.card_templates;
    }

    const name = tpl?.user_facing_name || tpl?.internal_name || "Card";
    const bg = tpl?.bg_color || "#0E1411";           // фон страницы/хедера/футера
    const primary = tpl?.label_color || "#D1E889";   // акцент (пилюля в хедере, ховер и т.п.)
    const text = pickTextColor(bg);
    const logoUrl = normalizeLogoUrl(tpl?.logo_url) || "/logo-amian.svg";

    return res.status(200).json({ name, logoUrl, primary, bg, text });
  } catch (e) {
    return res.status(500).json({ error: e.message || "internal" });
  }
};
