// api/scanner/scan.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { qr_value, action, amount, operator_id, location } = req.body || {};
    if (!qr_value) return res.status(400).json({ error: 'qr_value (uuid) is required' });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // 1) находим карту
    const { data: card, error } = await supabase
      .from('issued_cards')
      .select('uuid, guest_name, balance, email, phone, card_template_id')
      .eq('uuid', qr_value)
      .single();

    if (error || !card) return res.status(404).json({ error: 'Card not found' });

    // 2) экшены (опционально)
    let resultCard = card;
    if (action === 'redeem' && Number(amount) > 0) {
      const newBalance = Math.max(0, Number(card.balance) - Number(amount));
      const { data: updated, error: updErr } = await supabase
        .from('issued_cards')
        .update({ balance: newBalance })
        .eq('uuid', qr_value)
        .select()
        .single();
      if (updErr) throw updErr;
      resultCard = updated;
    }
    if (action === 'add_bonus' && Number(amount) > 0) {
      const newBalance = Number(card.balance) + Number(amount);
      const { data: updated, error: updErr } = await supabase
        .from('issued_cards')
        .update({ balance: newBalance })
        .eq('uuid', qr_value)
        .select()
        .single();
      if (updErr) throw updErr;
      resultCard = updated;
    }

    // 3) лог в scan_logs
    await supabase.from('scan_logs').insert([{
      card_uuid: qr_value,
      action: action || 'scan',
      amount: amount || null,
      location: location || req.headers['x-forwarded-for'] || 'unknown',
      operator_id: operator_id || null,
      result: resultCard
    }]);

    return res.status(200).json({ status: 'ok', card: resultCard });
  } catch (err) {
    console.error('Scan error:', err);
    return res.status(500).json({ error: 'Internal Server Error', detail: err.message });
  }
};
