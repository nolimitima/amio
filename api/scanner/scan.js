// api/scanner/scan.js
// Vercel Serverless Function (Node.js 20+)

const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE; // service role key
const PASSKIT_APNS_P12_BASE64 = process.env.PASSKIT_APNS_P12_BASE64;
const PASSKIT_APNS_P12_PASSWORD = process.env.PASSKIT_APNS_P12_PASSWORD;
const PASS_TYPE_IDENTIFIER = process.env.PASS_TYPE_IDENTIFIER;

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

// ✅ ИСПРАВЛЕННАЯ ФУНКЦИЯ
// Хелпер для отправки push-уведомлений в Apple Wallet
async function sendPasskitPush(serialNumber) {
  try {
    if (!PASSKIT_APNS_P12_BASE64 || !PASSKIT_APNS_P12_PASSWORD || !PASS_TYPE_IDENTIFIER) {
      console.log('PassKit push notifications not configured, skipping...');
      return;
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    
    // ИСПРАВЛЕНО: Ищем токен в таблице 'issued_cards', а не 'pass_devices'
    const { data: card, error: cardError } = await supa
      .from("issued_cards")
      .select("push_token")
      .eq("uuid", serialNumber) // serialNumber - это и есть uuid карты
      .single();

    // ИСПРАВЛЕНО: Проверяем, что токен существует на найденной карте
    if (cardError || !card?.push_token) {
      console.log(`No registered device found for card ${serialNumber}`);
      return;
    }

    const pushToken = card.push_token;

    const p12 = Buffer.from(PASSKIT_APNS_P12_BASE64, "base64");
    const agent = new https.Agent({ 
      pfx: p12, 
      passphrase: PASSKIT_APNS_P12_PASSWORD 
    });

    // ИСПРАВЛЕНО: Убран цикл, так как у карты только один push_token
    const req = https.request({
      method: "POST",
      host: "api.push.apple.com", // Для продакшена. Для тестов - api.sandbox.push.apple.com
      port: 443,
      path: `/3/device/${pushToken}`,
      headers: { 
        "apns-topic": PASS_TYPE_IDENTIFIER,
        "apns-priority": "10",
        "apns-expiration": "0"
      },
      agent
    });

    req.on('error', (err) => {
      console.error(`Push notification error for device ${pushToken}:`, err);
    });

    req.write(JSON.stringify({ aps: {} })); // Apple требует непустое тело запроса
    req.end();

    console.log(`Sent push notification to device ${pushToken} for card ${serialNumber}`);
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

    // 4) отправляем push-уведомление если баланс изменился
    if (balanceChanged) {
      sendPasskitPush(qr_value).catch(err => {
        console.error('Failed to send push notification:', err);
      });
    }

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