import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import QRCode from "react-qr-code";
import BrandLayout from "../../components/BrandLayout";

export default function JoinSuccess() {
  const [sp] = useSearchParams();
  const uuid = sp.get("uuid");
  const [branding, setBranding] = useState(null);

  const passUrl = useMemo(() => (uuid ? `/api/passes/${uuid}` : "#"), [uuid]);
  const fullUrl = useMemo(() => (uuid ? `${window.location.origin}${passUrl}` : ""), [uuid, passUrl]);

  // Загружаем брендинг по uuid
  useEffect(() => {
    if (!uuid) return;
    (async () => {
      try {
        const r = await fetch(`/api/public/branding?uuid=${encodeURIComponent(uuid)}`);
        const j = await r.json();
        setBranding(r.ok ? j : null);
      } catch (err) {
        console.error("branding fetch error:", err);
      }
    })();
  }, [uuid]);

  // Автоматическое открытие на iPhone
  useEffect(() => {
    if (!uuid) return;
    const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isiOS) window.location.href = passUrl;
  }, [uuid, passUrl]);

  return (
    <BrandLayout branding={branding}>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-medium mb-2 text-white">Карта готова</h1>
        <p className="text-white/60">Добавьте её в Apple Wallet.</p>
      </div>

      <div className="bg-white/95 p-8 rounded-2xl shadow-xl space-y-5 max-w-md mx-auto backdrop-blur-sm">
        <a
          href={passUrl}
          className="w-full inline-flex justify-center items-center h-12 rounded-xl bg-black text-white font-medium hover:opacity-90 active:opacity-80 transition"
        >
          Добавить в Apple Wallet
        </a>

        {uuid && (
          <>
            <p className="text-sm text-neutral-600 text-center">
              Откройте ссылку на iPhone (Safari) или отсканируйте QR-код.
            </p>

            <div className="bg-white p-4 rounded-xl border flex items-center justify-center">
              <QRCode value={fullUrl} size={190} />
            </div>

            <button
              onClick={() => navigator.clipboard.writeText(fullUrl)}
              className="text-xs px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50 mx-auto block"
            >
              Скопировать ссылку
            </button>
          </>
        )}
      </div>
    </BrandLayout>
  );
}
