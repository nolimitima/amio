// api/scanner/scan.js
// Vercel Serverless Function (Node.js 20+)

const { createClient } = require('@supabase/supabase-js');
const apnProvider = require('../../lib/apn');
const apn = require('node-apn');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE; // service role key
const PASS_TYPE_IDENTIFIER = process.env.PASS_TYPE_IDENTIFIER;

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

// Хелпер: отправить пустой PassKit push всем токенам для serialNumber
async function sendPasskitPush(serialNumber) {
  try {
    if (!PASS_TYPE_IDENTIFIER) {
      console.log('PassKit topic not configured, skipping...');
      return;
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: devices, error: devicesError } = await supa
      .from('pass_devices')
      .select('push_token')
      .eq('serial_number', serialNumber);

    if (devicesError || !devices || devices.length === 0) {
      console.log(`No registered devices found for card ${serialNumber}`);
      return;
    }

    const tokens = devices.map(d => d.push_token).filter(Boolean);
    if (tokens.length === 0) return;

    const notification = new apn.Notification();
    notification.topic = PASS_TYPE_IDENTIFIER;
    notification.payload = {}; // пустой payload

    const response = await apnProvider.send(notification, tokens);
    if (response?.failed?.length) {
      console.error('APN Push Failed:', response.failed);
    }
    if (response?.sent?.length) {
      console.log(`APN Push Sent to ${response.sent.length} device(s) for card ${serialNumber}`);
    }
  } catch (err) {
    console.error('sendPasskitPush error:', err);
  }
}

module.exports = async (req, res) => {
  // Весь остальной код остается без изменений, так как он написан правильно
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing SUPABASE env vars' });
  }

  try {
    const { qr_value, action, amount, operator_id, location } = req.body || {};

    if (!qr_value || typeof qr_value !== 'string') {
      return res.status(400).json({ error: 'qr_value (uuid) is required' });
    }

    const normalizedAction = (action || 'scan').toLowerCase();
    const amt = Number(amount) || 0;

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // 1) находим карту
    const { data: card, error: findErr } = await supabase
      .from('issued_cards')
      .select('uuid, guest_name, balance, email, phone, card_template_id')
      .eq('uuid', qr_value)
      .single();

    if (findErr || !card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // 2) применяем действие (если есть)
    let resultCard = card;
    let balanceChanged = false;
    
    if (normalizedAction === 'redeem' && amt > 0) {
      const newBalance = Math.max(0, Number(card.balance) - amt);
      const { data: updated, error: updErr } = await supabase
        .from('issued_cards')
        .update({ balance: newBalance })
        .eq('uuid', qr_value)
        .select()
        .single();
      if (updErr) throw updErr;
      resultCard = updated;
      balanceChanged = true;
    } else if (normalizedAction === 'add_bonus' && amt > 0) {
      const newBalance = Number(card.balance) + amt;
      const { data: updated, error: updErr } = await supabase
        .from('issued_cards')
        .update({ balance: newBalance })
        .eq('uuid', qr_value)
        .select()
        .single();
      if (updErr) throw updErr;
      resultCard = updated;
      balanceChanged = true;
    }

    // 3) пишем лог
    const clientIp = location || getClientIp(req);
    const { data: logRows, error: logErr } = await supabase
      .from('scan_logs')
      .insert([{
        card_uuid: qr_value,
        action: normalizedAction,
        amount: amt || null,
        location: clientIp,
        operator_id: operator_id || null,
        result: resultCard
      }])
      .select('id')
      .limit(1);

    if (logErr) {
      console.error('scan_logs insert error:', logErr);
    }

    const log_id = Array.isArray(logRows) && logRows[0]?.id ? logRows[0].id : null;

    // 4) отправляем push-уведомление
    // !!!!!!!!!!!!!
    // ВРЕМЕННО ВЫКЛЮЧАЕМ ДЛЯ ФИНАЛЬНОГО ТЕСТА
    // !!!!!!!!!!!!!
    // if (balanceChanged) {
    sendPasskitPush(qr_value).catch(err => {
      console.error('Failed to send push notification:', err);
    });
    // }

    // 5) ответ
    return res.status(200).json({
      status: 'ok',
      card: resultCard,
      log_id
    });

  } catch (err) {
    console.error('Scan error:', err);
    return res.status(500).json({ error: 'Internal Server Error', detail: String(err.message || err) });
  }
};