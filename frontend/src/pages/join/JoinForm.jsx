// src/pages/join/JoinForm.jsx

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function JoinForm(){
  const { slug } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name:'', phone:'', email:'', marketing_opt_in:true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await fetch('/api/public/register', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ slug, ...form })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Ошибка');
      nav(`/join/success?uuid=${j.uuid}`);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Подключить карту лояльности</h1>
      <form onSubmit={submit} className="space-y-3">
        <input 
          className="border rounded px-3 py-2 w-full" 
          placeholder="Имя" 
          value={form.full_name} 
          onChange={e=>setForm(f=>({...f, full_name:e.target.value}))}
        />
        {/* ✅ ИЗМЕНЕНИЕ 1: Добавлен type="tel" для телефона */}
        <input 
          type="tel" 
          className="border rounded px-3 py-2 w-full" 
          placeholder="+7 7xx xxx-xx-xx" 
          required 
          value={form.phone} 
          onChange={e=>setForm(f=>({...f, phone:e.target.value}))}
        />
        {/* ✅ ИЗМЕНЕНИЕ 2: Добавлен type="email" для почты */}
        <input 
          type="email" 
          className="border rounded px-3 py-2 w-full" 
          placeholder="Email (необязательно)" 
          value={form.email} 
          onChange={e=>setForm(f=>({...f, email:e.target.value}))}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.marketing_opt_in} onChange={e=>setForm(f=>({...f, marketing_opt_in:e.target.checked}))}/>
          Получать акции и бонусы
        </label>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button disabled={loading} className="bg-black text-white w-full py-2 rounded">{loading?'Создаём…':'Получить карту'}</button>
      </form>
    </div>
  );
}