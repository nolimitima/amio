// /api/passkit/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/index.js
// Vercel Serverless Function для получения списка обновлений PassKit
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
    
    if (!authToken) {
      // ДИАГНОСТИКА: Проверяем БД ДО возврата 401, чтобы понять ситуацию
      const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
      
      const { data: devicesCheck } = await supa
        .from('pass_devices')
        .select('serial_number')
        .eq('device_library_identifier', deviceLibraryIdentifier)
        .eq('pass_type_identifier', passTypeIdentifier);
      
      if (devicesCheck && devicesCheck.length > 0) {
        const serials = devicesCheck.map(d => d.serial_number).filter(Boolean);
        const { data: cardsCheck } = await supa
          .from('issued_cards')
          .select('uuid, auth_token')
          .in('uuid', serials);
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('❌ CRITICAL: AUTH HEADER MISSING');
        console.log('   Searched all header keys:', allHeaderKeys);
        console.log('   No "authorization" header found (case-insensitive)');
        console.log(`   📋 Found ${serials.length} pass(es) on device in DB`);
        console.log(`   🔐 Cards in DB:`, cardsCheck?.map(c => ({
          uuid: c.uuid,
          has_token: !!c.auth_token,
          token_preview: c.auth_token ? `${c.auth_token.substring(0, 8)}...` : 'MISSING'
        })) || []);
        console.log('   ⚠️  ROOT CAUSE: Pass was installed WITHOUT authenticationToken in pass.json');
        console.log('   ⚠️  Apple does NOT send Authorization header if pass has no token');
        console.log('   ⚠️  SOLUTION: Regenerate pass via /api/passes/[uuid] and reinstall in Wallet');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } else {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('❌ CRITICAL: AUTH HEADER MISSING');
        console.log('   Searched all header keys:', allHeaderKeys);
        console.log('   No "authorization" header found (case-insensitive)');
        console.log('   ⚠️  No passes found on device in DB');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
      
      return res.status(401).end();
    }

    console.log(`✅ Token found: ${authToken.substring(0, 8)}... (length: ${authToken.length})`);

    // ========== DB VERIFICATION ==========
    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Шаг 1: Найти все passes на этом устройстве
    console.log('📋 Step 1: Finding passes on device...');
    const { data: devices, error: devErr } = await supa
      .from('pass_devices')
      .select('serial_number')
      .eq('device_library_identifier', deviceLibraryIdentifier)
      .eq('pass_type_identifier', passTypeIdentifier);

    if (devErr) {
      console.error('❌ DB Error (pass_devices):', devErr);
      return res.status(500).end();
    }

    console.log(`📋 Found ${devices?.length || 0} device(s) in pass_devices`);

    if (!devices || devices.length === 0) {
      console.log('ℹ️ No passes registered on this device');
      return res.status(204).end();
    }

    const allSerials = devices.map(d => d.serial_number).filter(Boolean);
    console.log(`🎫 Serial numbers on device: ${JSON.stringify(allSerials)}`);

    if (allSerials.length === 0) {
      console.log('ℹ️ No valid serial numbers found');
      return res.status(204).end();
    }

    // Шаг 2: Проверить токен для этих passes
    console.log('🔐 Step 2: Verifying auth_token in issued_cards...');
    const { data: authorizedCards, error: authErr } = await supa
      .from('issued_cards')
      .select('uuid, auth_token')
      .in('uuid', allSerials)
      .eq('auth_token', authToken);

    if (authErr) {
      console.error('❌ DB Error (issued_cards):', authErr);
      return res.status(500).end();
    }

    console.log(`🔐 Auth check: Looking for token "${authToken.substring(0, 8)}..." in ${allSerials.length} card(s)`);
    console.log(`🔐 Found ${authorizedCards?.length || 0} authorized card(s):`, 
      authorizedCards?.map(c => c.uuid) || []);

    if (!authorizedCards || authorizedCards.length === 0) {
      console.log('❌ 401: Token not found for any card on this device');
      
      // Дополнительная диагностика
      const { data: allCards } = await supa
        .from('issued_cards')
        .select('uuid, auth_token')
        .in('uuid', allSerials);
      
      console.log('🔍 All cards on device (for debugging):', 
        allCards?.map(c => ({ uuid: c.uuid, token: c.auth_token ? `${c.auth_token.substring(0, 8)}...` : 'null' })) || []);
      
      console.log(`🔍 Searching for token: "${authToken.substring(0, 8)}..."`);
      console.log(`🔍 Cards on device: ${JSON.stringify(allSerials)}`);
      console.log('⚠️  POSSIBLE CAUSE: Token mismatch between pass.json and database');
      console.log('⚠️  SOLUTION: Regenerate pass to sync auth_token');
      
      return res.status(401).end();
    }

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
