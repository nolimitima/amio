// /api/public/branding.js
const { createClient } = require("@supabase/supabase-js");

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

module.exports = async (req, res) => {
  try {
    const { slug, uuid } = req.query || {};
    if (!slug && !uuid) return res.status(400).json({ error: "slug or uuid required" });

    let tpl;
    if (slug) {
      // join registration_links -> card_templates
      const { data, error } = await supa
        .from("registration_links")
        .select("is_active, card_templates:card_template_id ( user_facing_name, logo_url, bg_color, label_color, value_color, cover_url )")
        .eq("slug", slug)
        .single();
      if (error || !data) return res.status(404).json({ error: "not found" });
      if (!data.is_active) return res.status(403).json({ error: "link inactive" });
      tpl = data.card_templates;
    } else {
      // join issued_cards -> card_templates
      const { data, error } = await supa
        .from("issued_cards")
        .select("card_templates:card_template_id ( user_facing_name, logo_url, bg_color, label_color, value_color, cover_url )")
        .eq("uuid", uuid)
        .single();
      if (error || !data) return res.status(404).json({ error: "not found" });
      tpl = data.card_templates;
    }

    // Нормализуем ответ
    const brand = {
      name: tpl?.user_facing_name || "Card",
      logoUrl: tpl?.logo_url || "/logo-amian.svg",
      primary: tpl?.label_color || "#D1E889",  // возьмём label_color как акцент
      bg: tpl?.bg_color || "#F6F5F3",
      valueColor: tpl?.value_color || "#111111",
      coverUrl: tpl?.cover_url || null,
    };
    return res.status(200).json(brand);
  } catch (e) {
    return res.status(500).json({ error: e.message || "internal" });
  }
};
