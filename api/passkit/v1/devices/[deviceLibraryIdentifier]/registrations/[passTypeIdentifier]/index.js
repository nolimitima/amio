// /api/passkit/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/index.js
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const PASS_TYPE_IDENTIFIER = process.env.PASS_TYPE_IDENTIFIER;

function parseAuthHeader(h) {
  if (!h || typeof h !== 'string') return null;
  
  // Case-insensitive проверка префикса "ApplePass "
  // Используем regex для надежности (как в passes endpoint)
  const match = h.match(/^ApplePass\s+(.+)$/i);
  if (!match) return null;
  
  return match[1].trim();
}

module.exports = async (req, res) => {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier } = req.query;

    if (!deviceLibraryIdentifier || !passTypeIdentifier) {
      return res.status(400).end();
    }

    // Не отдаем 404 по PTI: аутентификация по токену дальше надёжно ограничит доступ.
    // Это также устраняет ложные 404 из-за несогласованности PTI между средами.

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end();
    }

    // КРИТИЧНО: В Vercel заголовки могут быть в lowercase
    // Проверяем все возможные варианты имени заголовка
    const authHeader = req.headers.authorization 
      || req.headers['authorization'] 
      || req.headers.Authorization 
      || req.headers['Authorization']
      || '';
    
    // 🔍 ЛОГ 0: Диагностика заголовков
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 Apple Request (GET registrations):');
    console.log('Device:', deviceLibraryIdentifier);
    console.log('Pass Type:', passTypeIdentifier);
    console.log('Raw auth header:', authHeader);
    console.log('All headers keys:', Object.keys(req.headers || {}));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const authToken = parseAuthHeader(authHeader);
    
    // 🔍 ЛОГ 1: Результат парсинга
    console.log('🔐 Parsed token:', authToken ? `${authToken.substring(0, 8)}...` : 'null');
    
    if (!authToken) {
      console.log('❌ No auth token');
      console.log('   Raw header value:', authHeader || '(empty)');
      console.log('   Header length:', authHeader ? authHeader.length : 0);
      if (authHeader) {
        console.log('   First 20 chars:', authHeader.substring(0, 20));
      }
      return res.status(401).end();
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Список всех карт на устройстве
    const { data: devices, error: devErr } = await supa
      .from('pass_devices')
      .select('serial_number')
      .eq('device_library_identifier', deviceLibraryIdentifier)
      .eq('pass_type_identifier', passTypeIdentifier);
    
    // 🔍 ЛОГ 2: Что нашли в pass_devices
    console.log('📋 Devices table:', devices);
    
    if (devErr) {
      console.error('list registrations error:', devErr);
      return res.status(500).end();
    }
    
    if (!devices || devices.length === 0) {
      console.log('❌ No devices found');
      return res.status(204).end();
    }

    const allSerials = devices.map(d => d.serial_number).filter(Boolean);
    console.log('🎫 Serial numbers on device:', allSerials);
    
    if (allSerials.length === 0) {
      return res.status(204).end();
    }

    // Проверяем токен
    const { data: authorizedCards, error: authErr } = await supa
      .from('issued_cards')
      .select('uuid, auth_token')  // ← ВАЖНО: добавь auth_token
      .in('uuid', allSerials)
      .eq('auth_token', authToken);
    
    // 🔍 ЛОГ 3: Что нашли в issued_cards
    console.log('🔐 Auth check result:');
    console.log('  Looking for token:', authToken);
    console.log('  In cards:', allSerials);
    console.log('  Found cards:', authorizedCards);
    
    if (authErr) {
      console.error('❌ Auth error:', authErr);
      return res.status(500).end();
    }
    
    if (!authorizedCards || authorizedCards.length === 0) {
      console.log('❌ 401: Token not found for any card');
      
      // 🔍 ЛОГ 4: Дополнительная диагностика
      const { data: allCards } = await supa
        .from('issued_cards')
        .select('uuid, auth_token')
        .in('uuid', allSerials);
      
      console.log('🔍 All cards with tokens:', allCards);
      
      return res.status(401).end();
    }

    const authorizedSerials = authorizedCards.map(c => c.uuid);
    console.log('✅ Authorized serials:', authorizedSerials);

    // Проверяем обновления
    const sinceParam = req.query.passesUpdatedSince;
    const since = sinceParam ? new Date(Number(sinceParam) * 1000) : new Date(0);

    const { data: updated, error: updErr } = await supa
      .from('issued_cards')
      .select('uuid, updated_at')
      .in('uuid', authorizedSerials)
      .gt('updated_at', since.toISOString());
      
    if (updErr) {
      console.error('issued_cards updated check error:', updErr);
      return res.status(500).end();
    }

    if (!updated || updated.length === 0) {
      console.log('ℹ️ No updates since', since);
      return res.status(204).end();
    }

    const updatedSerials = updated.map(r => r.uuid);
    const lastUpdated = Math.floor(Date.now() / 1000).toString();
    
    console.log('✅ Returning updates:', updatedSerials);
    return res.status(200).json({ serialNumbers: updatedSerials, lastUpdated });
    
  } catch (err) {
    console.error('💥 Exception:', err);
    return res.status(500).end();
  }
};

