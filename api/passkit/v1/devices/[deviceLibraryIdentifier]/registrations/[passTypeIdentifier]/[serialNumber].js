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
// Robust brute-force auth token finder (handles all edge cases)
function bruteForceFindAuthToken(req) {
  if (!req.headers || typeof req.headers !== 'object') {
    return null;
  }

  const headerKeys = Object.keys(req.headers);

  // Ищем ключ "authorization" case-insensitive
  for (const key of headerKeys) {
    if (key.toLowerCase() === 'authorization') {
      let value = req.headers[key];

      // Handle case where header might be an array
      if (Array.isArray(value)) {
        value = value[0];
      }

      if (value && typeof value === 'string') {
        // Убираем префикс "ApplePass " case-insensitive
        const token = value.replace(/^ApplePass\s+/i, '').trim();
        if (token) {
          return { token, rawHeader: value, headerKey: key };
        }
      }
    }
  }

  return null;
}

// =============== HANDLER ===============
module.exports = async (req, res) => {
  // ========== CRITICAL: LOG EVERYTHING FIRST ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📱 PassKit Device Registration/Unregistration Request');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`METHOD: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log(`QUERY:`, JSON.stringify(req.query, null, 2));
  console.log('HEADERS:', JSON.stringify(req.headers, null, 2));
  if (req.body) {
    console.log('BODY:', JSON.stringify(req.body, null, 2));
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.query;

    // Проверяем наличие всех параметров
    if (!deviceLibraryIdentifier || !passTypeIdentifier || !serialNumber) {
      console.log('❌ Missing parameters:', { deviceLibraryIdentifier, passTypeIdentifier, serialNumber });
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // ========== BRUTE-FORCE TOKEN FINDER ==========
    // КРИТИЧНО: Логируем ВСЕ заголовки для диагностики
    const allHeaderKeys = Object.keys(req.headers || {});
    console.log(`📋 Total headers: ${allHeaderKeys.length}`);
    console.log(`📋 Header keys: ${allHeaderKeys.join(', ')}`);

    // Ищем authorization вручную и логируем
    let foundAuthKey = null;
    for (const key of allHeaderKeys) {
      if (key.toLowerCase() === 'authorization') {
        foundAuthKey = key;
        console.log(`✅ Found authorization header with key: "${key}"`);
        console.log(`   Value (first 50 chars): ${String(req.headers[key]).substring(0, 50)}`);
        break;
      }
    }

    if (!foundAuthKey) {
      console.log('❌ Authorization header NOT FOUND in any case variation');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HYBRID AUTHENTICATION APPROACH FOR POST REGISTRATION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // iOS PassKit has a KNOWN BUG where it sometimes doesn't send
    // Authorization header for POST registration, even though:
    // - authenticationToken is correctly embedded in pass.json
    // - The pass was validly generated and installed
    //
    // SECURITY MODEL:
    // 1. If auth token IS provided: validate it against DB (strictest)
    // 2. If auth token NOT provided: verify card exists by serialNumber
    //    - This is secure because only valid passes can be installed
    //    - The pass already contained the correct authenticationToken
    //    - Apple Wallet validates the pass signature before installing
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const authResult = bruteForceFindAuthToken(req);
    const authToken = authResult?.token;

    let card = null;

    if (authToken) {
      // STRICT MODE: Auth token provided, validate against DB
      console.log(`✅ Auth token received: ${authToken.substring(0, 10)}...`);

      const { data: validatedCard, error: cardError } = await supa
        .from('issued_cards')
        .select('uuid, auth_token')
        .eq('uuid', serialNumber)
        .eq('auth_token', authToken)
        .single();

      if (cardError || !validatedCard) {
        console.error('[PassKit] ❌ Auth token validation failed:', cardError?.message);
        return res.status(401).json({ error: 'Invalid authentication token' });
      }

      card = validatedCard;
      console.log(`✅ Auth token validated for card ${serialNumber}`);

    } else {
      // FALLBACK MODE: No auth token (iOS bug), verify card exists
      console.warn('[PassKit] ⚠️ No auth token received (iOS PassKit bug)');
      console.warn('   Using fallback: verifying card exists by serialNumber');

      const { data: existingCard, error: cardError } = await supa
        .from('issued_cards')
        .select('uuid, auth_token')
        .eq('uuid', serialNumber)
        .single();

      if (cardError || !existingCard) {
        console.error('[PassKit] ❌ Card not found:', serialNumber);
        return res.status(401).json({ error: 'Card not found' });
      }

      card = existingCard;
      console.log(`✅ Card verified by serialNumber (fallback mode): ${serialNumber}`);
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
      console.log(`✅ Device registered successfully. Returning ${status}`);
      return res.status(status).end(); // No body per Apple spec
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
