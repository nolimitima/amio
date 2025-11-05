// /api/passkit/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/index.js
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const PASS_TYPE_IDENTIFIER = process.env.PASS_TYPE_IDENTIFIER;

function parseAuthHeader(h) {
  if (!h || !h.startsWith('ApplePass ')) return null;
  return h.substring('ApplePass '.length).trim();
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

    const authToken = parseAuthHeader(req.headers.authorization || '');
    if (!authToken) {
      return res.status(401).end();
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Список всех серий, зарегистрированных на устройстве
    const { data: devices, error: devErr } = await supa
      .from('pass_devices')
      .select('serial_number')
      .eq('device_library_identifier', deviceLibraryIdentifier)
      .eq('pass_type_identifier', passTypeIdentifier);
    
    if (devErr) {
      console.error('list registrations error:', devErr);
      return res.status(500).end();
    }
    
    if (!devices || devices.length === 0) {
      return res.status(204).end();
    }

    const serialNumbers = devices.map(d => d.serial_number).filter(Boolean);
    if (serialNumbers.length === 0) {
      return res.status(204).end();
    }

    // Проверяем, что authToken принадлежит хотя бы одной из карт на этом устройстве
    const { data: validCards, error: authErr } = await supa
      .from('issued_cards')
      .select('uuid')
      .in('uuid', serialNumbers)
      .eq('auth_token', authToken);
    
    if (authErr) {
      console.error('Auth token validation error:', authErr);
      return res.status(500).end();
    }
    
    if (!validCards || validCards.length === 0) {
      return res.status(401).end();
    }

    // Разбор passesUpdatedSince (секунды Unix)
    const sinceParam = req.query.passesUpdatedSince;
    const since = sinceParam ? new Date(Number(sinceParam) * 1000) : new Date(0);

    // Фильтруем по updated_at в issued_cards для наших uuid
    const { data: updated, error: updErr } = await supa
      .from('issued_cards')
      .select('uuid, updated_at')
      .in('uuid', serialNumbers)
      .gt('updated_at', since.toISOString());
    if (updErr) {
      console.error('issued_cards updated check error:', updErr);
      return res.status(500).end();
    }

    if (!updated || updated.length === 0) {
      return res.status(204).end();
    }

    const updatedSerials = updated.map(r => r.uuid);
    const lastUpdated = Math.floor(Date.now() / 1000).toString();
    return res.status(200).json({ serialNumbers: updatedSerials, lastUpdated });
  } catch (err) {
    console.error('registrations GET error:', err);
    return res.status(500).end();
  }
};

