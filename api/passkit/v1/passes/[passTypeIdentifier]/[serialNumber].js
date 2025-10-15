// api/passkit/v1/passes/[passTypeIdentifier]/[serialNumber].js
// Vercel Serverless Function для получения обновленной карты

// =============== HANDLER ===============
module.exports = async (req, res) => {
  try {
    const { passTypeIdentifier, serialNumber } = req.query;
    
    if (!passTypeIdentifier || !serialNumber) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Проверяем авторизацию
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("ApplePass ")) {
      return res.status(401).json({ error: "Invalid authorization header" });
    }

    // Делаем 302 redirect на основной endpoint для генерации карты
    const redirectUrl = `/api/passes/${serialNumber}`;
    return res.redirect(302, redirectUrl);

  } catch (err) {
    console.error("passkit pass error:", err);
    return res.status(500).json({ error: "Internal server error", detail: String(err?.message || err) });
  }
};
