import QRCode from "react-qr-code";
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function JoinSuccess(){
  const [sp] = useSearchParams();
  const uuid = sp.get('uuid');
  const passUrl = useMemo(()=> (uuid ? `/api/passes/${uuid}` : "#"), [uuid]);
  const fullUrl = useMemo(()=> (uuid ? `${window.location.origin}${passUrl}` : ""), [passUrl]);

  return (
    <div className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-2xl font-semibold">Карта готова</h1>
      <a className="bg-black text-white w-full py-2 rounded block text-center" href={passUrl}>
        Add to Apple Wallet
      </a>
      <p className="text-sm text-gray-600">Открой с iPhone (Safari), чтобы добавить в Wallet.</p>
      {uuid && (
        <div className="bg-white p-4 rounded border inline-flex">
          <QRCode value={fullUrl} size={180} />
        </div>
      )}
    </div>
  );
}
