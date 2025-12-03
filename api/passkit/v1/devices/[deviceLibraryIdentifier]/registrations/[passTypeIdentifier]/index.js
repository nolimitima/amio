// /api/passkit/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/index.js
// Vercel Serverless Function для получения списка обновлений PassKit
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HYBRID AUTHENTICATION APPROACH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// This endpoint uses device registration as authentication instead of tokens.
//
// WHY: iOS sporadically refuses to send Authorization headers despite valid
// authenticationToken in pass.json. POST registration works fine with tokens,
// but GET requests often arrive without the header.
//
// SECURITY MODEL:
// - POST registration requires valid authenticationToken (enforced in POST endpoint)
// - GET requests only require device to be registered (no token validation)
// - Device must successfully register via POST before receiving updates
// - Prevents unauthorized devices from getting updates
//
// TRADE-OFF: Slightly less secure than full token auth, but the only reliable
// approach given iOS PassKit behavior.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const PASS_TYPE_IDENTIFIER = process.env.PASS_TYPE_IDENTIFIER;

// =============== BRUTE-FORCE TOKEN FINDER ===============
function bruteForceFindAuthToken(req) {
  if (!req.headers || typeof req.headers !== 'object') {
    return null;
  }

  const headerKeys = Object.keys(req.headers);

  // Ищем ключ "authorization" case-insensitive
  for (const key of headerKeys) {
    if (key.toLowerCase() === 'authorization') {
      const value = req.headers[key];
      if (value && typeof value === 'string') {
        // Убираем префикс "ApplePass " case-insensitive
        const token = value.replace(/^ApplePass\s+/i, '').trim();
        if (token) {
          return token;
        }
      }
    }
  }

  return null;
}

// =============== HANDLER ===============
module.exports = async (req, res) => {
  try {
    // ========== DEBUG LOGGING (Priority 1) ==========
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 PassKit GET Registrations Request');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`METHOD: ${req.method}`);
    console.log(`URL: ${req.url}`);
    console.log(`QUERY: ${JSON.stringify(req.query, null, 2)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('HEADERS:');
    console.log(JSON.stringify(req.headers, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const { deviceLibraryIdentifier, passTypeIdentifier } = req.query;

    if (!deviceLibraryIdentifier || !passTypeIdentifier) {
      console.log('❌ Missing required query parameters');
      return res.status(400).end();
    }

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end();
    }

    // ========== BRUTE-FORCE TOKEN FINDER ==========
    console.log('🔍 Starting brute-force token search...');

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
      console.log('   This means Apple did not send the token, OR');
      console.log('   the pass was installed without authenticationToken in pass.json');
    }

    const authToken = bruteForceFindAuthToken(req);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HYBRID AUTHENTICATION APPROACH
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // POST registration requires valid authenticationToken (enforced in POST endpoint)
    // GET requests only require device to be registered (no token validation)
    // 
    // This approach provides reasonable security:
    // - Device must successfully register via POST first (with valid token)
    // - Once registered, device can check for updates without sending token
    // - Prevents unauthorized devices from getting updates
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    if (authToken) {
      console.log(`ℹ️  Authorization token received: ${authToken.substring(0, 10)}...`);
      console.log('   (Token not validated for GET requests - using device registration instead)');
    } else {
      console.log('ℹ️  No authorization token - checking device registration');
    }

    // Шаг 1: Найти все passes для этого устройства
    console.log(`🔍 Looking for passes registered to device ${deviceLibraryIdentifier}...`);

    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: devices, error: dbErr } = await supa
      .from('pass_devices')
      .select('serial_number')
      .eq('device_library_identifier', deviceLibraryIdentifier)
      .eq('pass_type_identifier', passTypeIdentifier);

    if (dbErr) {
      console.error('❌ DB Error (pass_devices):', dbErr);
      return res.status(500).end();
    }

    if (!devices || devices.length === 0) {
      console.log('📋 No passes found for this device. Returning 204 (no updates)');
      return res.status(204).end();
    }

    const allSerials = devices.map(d => d.serial_number).filter(Boolean);
    console.log(`📋 Found ${allSerials.length} pass(es) on device:`, allSerials);

    if (allSerials.length === 0) {
      console.log('📋 No valid serial numbers. Returning 204 (no updates)');
      return res.status(204).end();
    }

    // Шаг 2: Return all passes registered to this device
    console.log('🔐 Returning all passes for registered device (no token validation)');

    // Get all cards (no token filtering)
    const { data: authorizedCards, error: authErr } = await supa
      .from('issued_cards')
      .select('uuid, auth_token, updated_at')
      .in('uuid', allSerials);

    if (authErr) {
      console.error('❌ DB Error (issued_cards):', authErr);
      return res.status(500).end();
    }

    if (!authorizedCards || authorizedCards.length === 0) {
      console.log('📋 No cards found in issued_cards table');
      return res.status(204).end();
    }

    console.log(`✅ Device is registered - returning ${authorizedCards.length} pass(es)`);
    const authorizedSerials = authorizedCards.map(c => c.uuid);
    console.log(`✅ Authorized serials: ${JSON.stringify(authorizedSerials)}`);

    // Шаг 3: Проверить обновления (Apple PassKit spec)
    const sinceParam = req.query.passesUpdatedSince;
    const since = sinceParam ? new Date(Number(sinceParam) * 1000) : new Date(0);

    console.log(`🕐 Step 3: Checking for updates since: ${since.toISOString()}`);

    const { data: updated, error: updErr } = await supa
      .from('issued_cards')
      .select('uuid, updated_at')
      .in('uuid', authorizedSerials)
      .gt('updated_at', since.toISOString());

    if (updErr) {
      console.error('❌ DB Error (updated check):', updErr);
      return res.status(500).end();
    }

    if (!updated || updated.length === 0) {
      console.log(`ℹ️ No updates since ${since.toISOString()}`);
      return res.status(204).end();
    }

    const updatedSerials = updated.map(r => r.uuid);
    const lastUpdated = Math.floor(Date.now() / 1000).toString();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ SUCCESS: Returning ${updatedSerials.length} update(s)`);
    console.log(`   Serial numbers: ${JSON.stringify(updatedSerials)}`);
    console.log(`   Last updated: ${lastUpdated}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return res.status(200).json({
      serialNumbers: updatedSerials,
      lastUpdated
    });

  } catch (err) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('💥 EXCEPTION:', err);
    console.error('Stack:', err.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return res.status(500).end();
  }
};
