// /api/passkit/v1/passes/[passTypeIdentifier]/[serialNumber].js
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") return res.status(405).end();

    const { serialNumber /* uuid */, passTypeIdentifier } = req.query;

    // 1) Проверка Pass Type ID (на всякий случай)
    const PTI = process.env.PASS_TYPE_IDENTIFIER;
    if (passTypeIdentifier !== PTI) {
      return res.status(404).end(); // по спецификации лучше 404
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HYBRID AUTHENTICATION (same as POST registration)
    // iOS PassKit sometimes doesn't send Authorization header even for GET
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const auth = req.headers.authorization || req.headers.Authorization || "";
    const token = auth.replace(/^ApplePass\s+/i, "").trim();

    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Find the card
    const { data: card, error: e1 } = await supa
      .from("issued_cards")
      .select("uuid, auth_token")
      .eq("uuid", serialNumber)
      .maybeSingle();

    if (e1) {
      console.error("pass GET issued_cards error:", e1);
      return res.status(500).end();
    }
    if (!card) {
      console.log(`[PassKit] ❌ Card not found: ${serialNumber}`);
      return res.status(404).end();
    }

    // HYBRID AUTH: Validate token if provided, otherwise allow if card exists
    if (token) {
      // Token provided - validate it
      if (!card.auth_token || card.auth_token !== token) {
        console.error(`[PassKit] ❌ Auth token mismatch for ${serialNumber}`);
        return res.status(401).end();
      }
      console.log(`[PassKit] ✅ Auth token validated for pass download: ${serialNumber}`);
    } else {
      // No token (iOS bug) - allow based on card existence
      console.warn(`[PassKit] ⚠️ No auth token for pass download (iOS bug), allowing based on card existence: ${serialNumber}`);
    }

    // 4) Проксируем генерацию .pkpass (без редиректа), пробрасывая If-Modified-Since
    const ims = req.headers["if-modified-since"];
    const url = `${process.env.PUBLIC_BASE_URL}/api/passes/${encodeURIComponent(serialNumber)}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: ims ? { "If-Modified-Since": ims } : undefined,
    });

    // 5) Если исходник вернул 304 — отдадим 304
    if (resp.status === 304) {
      res.statusCode = 304;
      return res.end();
    }

    if (!resp.ok) {
      // Если внутренний генератор не отдал .pkpass
      const txt = await resp.text().catch(() => "");
      console.error("proxy pkpass failed:", resp.status, txt);
      return res.status(resp.status).end();
    }

    // 6) Пробросим важные заголовки и сам файл
    // Content-Type, Content-Disposition, Last-Modified
    const ct = resp.headers.get("content-type") || "application/vnd.apple.pkpass";
    const cd = resp.headers.get("content-disposition") || `attachment; filename="${serialNumber}.pkpass"`;
    const lm = resp.headers.get("last-modified");

    res.setHeader("Content-Type", ct);
    res.setHeader("Content-Disposition", cd);
    if (lm) res.setHeader("Last-Modified", lm);

    const buf = Buffer.from(await resp.arrayBuffer());
    res.statusCode = 200;
    return res.end(buf);
  } catch (err) {
    console.error("WS pass GET error:", err);
    return res.status(500).end();
  }
};
