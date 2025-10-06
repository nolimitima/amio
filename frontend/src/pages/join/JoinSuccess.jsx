import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function JoinSuccess(){
  const [sp] = useSearchParams();
  const uuid = sp.get('uuid');
  const passUrl = useMemo(()=> `/api/passes/${uuid}`, [uuid]);

  return (
    <div className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-2xl font-semibold">Карта готова</h1>
      <a className="bg-black text-white w-full py-2 rounded block text-center" href={passUrl}>
        Add to Apple Wallet
      </a>
      <p className="text-sm text-gray-600">Открой с iPhone (Safari), чтобы добавить в Wallet.</p>
      <div className="p-3 border rounded text-sm">
        Если открыл с компьютера — наведи камерой iPhone на этот URL:<br/>
        <code>{window.location.origin}/api/passes/{uuid}</code>
      </div>
    </div>
  );
}
