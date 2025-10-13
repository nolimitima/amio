// src/pages/join/JoinSuccess.jsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import QRCode from "react-qr-code";
import BrandLayout from "../../components/BrandLayout";

export default function JoinSuccess() {
  const [sp] = useSearchParams();
  const uuid = sp.get("uuid");
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    if (!uuid) return;
    (async () => {
      const r = await fetch(`/api/public/branding?uuid=${encodeURIComponent(uuid)}`);
      const j = await r.json();
      setBranding(r.ok ? j : {});
    })();
  }, [uuid]);

  const passUrl = useMemo(() => (uuid ? `/api/passes/${uuid}` : "#"), [uuid]);
  const fullUrl = useMemo(() => (uuid ? `${window.location.origin}${passUrl}` : ""), [uuid, passUrl]);

  // авто-редирект на iOS
  useEffect(() => {
    if (!uuid) return;
    const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isiOS) window.location.href = passUrl;
  }, [uuid, passUrl]);

  return (
    <BrandLayout branding={branding}>
      <div className="mx-auto max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold">Карта готова</h1>
          <p className="text-neutral-600 mt-2">Добавьте её в Apple Wallet.</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-5">
          <a href={passUrl}
             className="w-full inline-flex justify-center items-center h-12 rounded-xl bg-black text-white font-medium hover:opacity-90 active:opacity-80">
            Add to Apple Wallet
          </a>

          {uuid && (
            <>
              <div className="text-sm text-neutral-600 text-center">
                Откройте ссылку на iPhone (Safari) или отсканируйте QR-код.
              </div>
              <div className="bg-white p-4 rounded-xl border flex items-center justify-center">
                <QRCode value={fullUrl} size={190} />
              </div>
              <div className="flex gap-2 justify-center">
                <button className="text-xs px-3 py-1.5 rounded-lg border hover:bg-neutral-50"
                        onClick={() => navigator.clipboard.writeText(fullUrl)}>
                  Скопировать ссылку
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </BrandLayout>
  );
}
