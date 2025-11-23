// api/passkit/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/[serialNumber].js
// Vercel Serverless Function для регистрации/удаления устройств Apple Wallet

const { createClient } = require('@supabase/supabase-js');

// =============== ENV =================
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_KEY;

// Guards
if (!SUPABASE_URL) throw new Error('SUPABASE_URL missing');
if (!SERVICE_KEY) throw new Error('Service key missing (SUPABASE_SERVICE_ROLE/KEY)');

// =============== UTILS ===============
const parseAuthHeader = (authHeader) => {
  if (!authHeader || typeof authHeader !== 'string') return null;
  
  // Case-insensitive проверка префикса "ApplePass "
  const match = authHeader.match(/^ApplePass\s+(.+)$/i);
  if (!match) return null;
  
  return match[1].trim();
};

// =============== HANDLER ===============
module.exports = async (req, res) => {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.query;

    // Проверяем наличие всех параметров
    if (!deviceLibraryIdentifier || !passTypeIdentifier || !serialNumber) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Проверяем токен авторизации
    // КРИТИЧНО: В Vercel заголовки могут быть в lowercase
    const authHeader = req.headers.authorization 
      || req.headers['authorization'] 
      || req.headers.Authorization 
      || req.headers['Authorization']
      || '';
    
    const authToken = parseAuthHeader(authHeader);
    if (!authToken) {
      console.error('[PassKit] ❌ POST registration: No auth token');
      console.error('   Raw header:', authHeader || '(empty)');
      return res.status(401).json({ error: 'Invalid authorization header' });
    }

    // Проверяем, что для указанного serialNumber существует карта с таким auth_token
    const { data: card, error: cardError } = await supa
      .from('issued_cards')
      .select('uuid, auth_token')
      .eq('uuid', serialNumber)
      .eq('auth_token', authToken)
      .single();

    if (cardError || !card) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    // Обработка запроса регистрации
    if (req.method === 'POST' || req.method === 'PUT') {
      // Apple по спецификации использует POST; PUT оставлен для обратной совместимости
      const pushToken = req.body?.pushToken;
      if (!pushToken) {
        return res.status(400).json({ error: 'Missing pushToken in body' });
      }

      // Сохраняем/обновляем устройство в базе
      const { error: insertError } = await supa
        .from('pass_devices')
        .upsert(
          {
            device_library_identifier: deviceLibraryIdentifier,
            push_token: pushToken,
            pass_type_identifier: passTypeIdentifier,
            serial_number: serialNumber,
          },
          {
            // onConflict для уникальной пары device+passType+serial, чтобы не дублировать
            onConflict: 'device_library_identifier,pass_type_identifier,serial_number',
          },
        );

      if (insertError) {
        console.error('Failed to register device:', insertError);
        return res.status(500).json({ error: 'Failed to register device' });
      }

      // Для POST возвращаем 201 (создано), для PUT — 200 (обновлено)
      const status = req.method === 'POST' ? 201 : 200;
      return res.status(status).json({ success: true });
    }

    // Обработка запроса удаления регистрации
    if (req.method === 'DELETE') {
      const { error: deleteError } = await supa
        .from('pass_devices')
        .delete()
        .eq('device_library_identifier', deviceLibraryIdentifier)
        .eq('pass_type_identifier', passTypeIdentifier)
        .eq('serial_number', serialNumber);

      if (deleteError) {
        console.error('Failed to unregister device:', deleteError);
        return res.status(500).json({ error: 'Failed to unregister device' });
      }

      return res.status(200).json({ success: true });
    }

    // Не поддерживаемые методы
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('passkit device registration error:', err);
    return res
      .status(500)
      .json({ error: 'Internal server error', detail: String(err?.message || err) });
  }
};
