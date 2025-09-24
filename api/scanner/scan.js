// api/scanner/scan.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { qr_value, action, amount } = req.body;
    if (!qr_value) {
      return res.status(400).json({ error: 'qr_value (uuid) is required' });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Найти карту
    const { data: card, error } = await supabase
      .from('issued_cards')
      .select('uuid, guest_name, balance, email, phone')
      .eq('uuid', qr_value)
      .single();

    if (error || !card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    let resultCard = card;

    // Если action = redeem → списываем бонусы
    if (action === 'redeem' && amount > 0) {
      const newBalance = Math.max(0, card.balance - amount);
      const { data: updated, error: updError } = await supabase
        .from('issued_cards')
        .update({ balance: newBalance })
        .eq('uuid', qr_value)
        .select()
        .single();

      if (updError) throw updError;
      resultCard = updated;
    }

    // Логирование
    await supabase.from('scan_logs').insert([{
      card_uuid: qr_value,
      scanned_at: new Date().toISOString(),
      location: req.headers['x-forwarded-for'] || 'unknown',
      action: action || 'scan',
      amount: amount || null
    }]);

    return res.status(200).json({ status: 'ok', card: resultCard });
  } catch (err) {
    console.error('Internal Server Error:', err);
    return res.status(500).json({ error: 'Internal Server Error', detail: err.message });
  }
};
