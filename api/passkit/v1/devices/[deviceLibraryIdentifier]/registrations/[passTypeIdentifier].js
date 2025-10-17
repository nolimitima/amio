// /api/passkit/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/[serialNumber].js
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;

module.exports = async (req, res) => {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.query;
    
    if (!deviceLibraryIdentifier || !passTypeIdentifier || !serialNumber) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Проверка авторизации остается без изменений
    const authHeader = req.headers.authorization || "";
    const authToken = authHeader.replace(/^ApplePass\s+/i, "").trim();
    if (!authToken) {
      return res.status(401).json({ error: "Invalid authorization header" });
    }

    const { data: card, error: cardError } = await supa
      .from("issued_cards")
      .select("uuid, auth_token")
      .eq("uuid", serialNumber)
      .eq("auth_token", authToken)
      .single();

    if (cardError || !card) {
      return res.status(401).json({ error: "Invalid authentication token" });
    }

    // ✅ ИЗМЕНЕНИЕ ЗДЕСЬ: Ожидаем POST вместо PUT
    if (req.method === "POST") {
      const pushToken = req.body?.pushToken;
      if (!pushToken) {
        return res.status(400).json({ error: "Missing pushToken in body" });
      }

      console.log(`РЕГИСТРАЦИЯ УСТРОЙСТВА для карты ${serialNumber}`);

      const { error: insertError } = await supa
        .from("pass_devices")
        .upsert({
          device_library_identifier: deviceLibraryIdentifier,
          push_token: pushToken,
          pass_type_identifier: passTypeIdentifier,
          serial_number: serialNumber
        }, {
          onConflict: "device_library_identifier,pass_type_identifier,serial_number"
        });

      if (insertError) {
        console.error("Failed to register device:", insertError);
        return res.status(500).json({ error: "Failed to register device" });
      }

      return res.status(201).json({ success: true });

    } else if (req.method === "DELETE") {
      // Удаление устройства (без изменений)
      console.log(`ОТМЕНА РЕГИСТРАЦИИ для карты ${serialNumber}`);
      const { error: deleteError } = await supa
        .from("pass_devices")
        .delete()
        .eq("device_library_identifier", deviceLibraryIdentifier)
        .eq("pass_type_identifier", passTypeIdentifier)
        .eq("serial_number", serialNumber);

      if (deleteError) {
        console.error("Failed to unregister device:", deleteError);
        return res.status(500).json({ error: "Failed to unregister device" });
      }

      return res.status(200).json({ success: true });

    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }

  } catch (err) {
    console.error("passkit device registration error:", err);
    return res.status(500).json({ error: "Internal server error", detail: String(err?.message || err) });
  }
};