// api/public/register.js
// Создаёт карту self-service по slug и данным клиента
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE; // service role key
const PUBLIC_BASE  = process.env.PUBLIC_BASE_URL || '';

function normPhone(p=''){ return p.replace(/[^\d+]/g,''); }
function validEmail(e){ return !e || /.+@.+\..+/.test(e); }

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { slug, full_name, phone, email, marketing_opt_in } = req.body || {};
    if (!slug)  return res.status(400).json({ error: 'slug required' });
    if (!phone) return res.status(400).json({ error: 'phone required' });
    if (!validEmail(email)) return res.status(400).json({ error: 'invalid email' });

    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // 1) ищем активную ссылку
    const { data: link, error: e1 } = await supa
      .from('registration_links')
      .select('id, user_id, card_template_id, is_active')
      .eq('slug', slug)
      .single();
    if (e1 || !link) return res.status(404).json({ error: 'link not found' });
    if (!link.is_active) return res.status(403).json({ error: 'link inactive' });

    const phoneNorm = normPhone(phone);

    // 2) idempotent: если у этого владельца и этого шаблона уже есть карта на этот телефон — вернём её
    const { data: existing } = await supa
      .from('issued_cards')
      .select('uuid')
      .eq('user_id', link.user_id)
      .eq('card_template_id', link.card_template_id)
      .eq('phone', phoneNorm)
      .maybeSingle();

    if (existing?.uuid) {
      return res.status(200).json({
        uuid: existing.uuid,
        passUrl: `${PUBLIC_BASE}/api/passes/${existing.uuid}`,
        reused: true
      });
    }

    // 3) возьмём max_uses из шаблона (если надо)
    const { data: tpl } = await supa
      .from('card_templates')
      .select('max_uses')
      .eq('id', link.card_template_id)
      .single();

    // 4) создаём карту
    const uuid = crypto.randomUUID();
    const { data: card, error: e2 } = await supa
      .from('issued_cards')
      .insert({
        user_id: link.user_id,
        card_template_id: link.card_template_id,
        guest_name: full_name || 'Гость',
        email: email || null,
        phone: phoneNorm,
        balance: 0,
        max_uses: tpl?.max_uses || null,
        qr_value: uuid,
        uuid,
        source: 'self_service',
        status: 'active',
        marketing_opt_in: !!marketing_opt_in // если колонку добавишь — сохранится
      })
      .select('uuid')
      .single();
    if (e2) throw e2;

    return res.status(200).json({
      uuid: card.uuid,
      passUrl: `${PUBLIC_BASE}/api/passes/${card.uuid}`
    });
  } catch (err) {
    const msg = err?.message || String(err);
    const code = /too many/i.test(msg) ? 429 : 500;
    return res.status(code).json({ error: msg });
  }
};
