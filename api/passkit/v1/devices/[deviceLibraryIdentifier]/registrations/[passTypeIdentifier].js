// api/passkit/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier].js
// Vercel Serverless Function для получения списка измененных карт

const { createClient } = require("@supabase/supabase-js");

// =============== ENV =================
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_KEY;

// Guards
if (!SUPABASE_URL) throw new Error("SUPABASE_URL missing");
if (!SERVICE_KEY) throw new Error("Service key missing (SUPABASE_SERVICE_ROLE/KEY)");

// =============== UTILS ===============
const parseAuthHeader = (authHeader) => {
  if (!authHeader || !authHeader.startsWith("ApplePass ")) {
    return null;
  }
  return authHeader.substring(10); // Remove "ApplePass " prefix
};

// =============== HANDLER ===============
module.exports = async (req, res) => {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier } = req.query;
    
    if (!deviceLibraryIdentifier || !passTypeIdentifier) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Проверяем авторизацию
    const authToken = parseAuthHeader(req.headers.authorization);
    if (!authToken) {
      return res.status(401).json({ error: "Invalid authorization header" });
    }

    // Получаем список зарегистрированных карт для данного устройства
    const { data: devices, error: devicesError } = await supa
      .from("pass_devices")
      .select("serial_number")
      .eq("device_library_identifier", deviceLibraryIdentifier)
      .eq("pass_type_identifier", passTypeIdentifier);

    if (devicesError) {
      console.error("Failed to get registered devices:", devicesError);
      return res.status(500).json({ error: "Failed to get registered devices" });
    }

    // Проверяем какие из карт имеют валидный auth_token
    const validSerials = [];
    if (devices && devices.length > 0) {
      for (const device of devices) {
        const { data: card, error: cardError } = await supa
          .from("issued_cards")
          .select("uuid, auth_token")
          .eq("uuid", device.serial_number)
          .eq("auth_token", authToken)
          .single();

        if (!cardError && card) {
          validSerials.push(device.serial_number);
        }
      }
    }

    // Возвращаем список измененных карт (пока пустой, так как push-обновления происходят автоматически)
    return res.status(200).json({ 
      serialNumbers: validSerials,
      lastUpdated: new Date().toISOString()
    });

  } catch (err) {
    console.error("passkit device registrations error:", err);
    return res.status(500).json({ error: "Internal server error", detail: String(err?.message || err) });
  }
};
