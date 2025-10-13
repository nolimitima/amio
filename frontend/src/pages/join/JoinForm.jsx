// src/pages/join/JoinForm.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BrandLayout from "../../components/BrandLayout";

export default function JoinForm() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [branding, setBranding] = useState(null);

  const [form, setForm] = useState({ full_name:"", phone:"", email:"", marketing_opt_in:true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/public/branding?slug=${encodeURIComponent(slug)}`);
      const j = await r.json();
      if (r.ok) setBranding(j);
      else setBranding({}); // фолбек
    })();
  }, [slug]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };
  const onPhoneChange = (e) => {
    const v = e.target.value.replace(/[^\d+\-\s()]/g, "");
    setForm((f) => ({ ...f, phone: v }));
  };

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.phone.trim()) return setError("Введите номер телефона.");
    setLoading(true);
    try {
      const r = await fetch("/api/public/register", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ slug, ...form }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Ошибка");
      navigate(`/join/success?uuid=${j.uuid}`);
    } catch (err) { setError(err.message || "Ошибка"); } finally { setLoading(false); }
  }

  return (
    <BrandLayout branding={branding}>
      <div className="mx-auto max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold">Подключить карту лояльности</h1>
          <p className="text-neutral-600 mt-2">Заполните данные — и добавьте карту в Apple Wallet.</p>
        </div>

        <form onSubmit={submit} noValidate className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
          <div className="space-y-1">
            <label className="text-sm text-neutral-600">Имя</label>
            <input type="text" name="full_name" className="w-full h-11 px-3 rounded-xl border"
              placeholder="Например: Тимур" value={form.full_name} onChange={onChange} pattern=".*"/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-neutral-600">Телефон</label>
            <input type="tel" name="phone" inputMode="tel" autoComplete="tel"
              className="w-full h-11 px-3 rounded-xl border" placeholder="+7 7xx xxx-xx-xx или 8XXXXXXXXXX"
              required value={form.phone} onChange={onPhoneChange} pattern=".*" onInvalid={(e)=>e.preventDefault()}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-neutral-600">Email (необязательно)</label>
            <input type="email" name="email" className="w-full h-11 px-3 rounded-xl border"
              placeholder="name@example.com" value={form.email} onChange={onChange} pattern=".*" onInvalid={(e)=>e.preventDefault()}/>
          </div>
          <label className="flex items-start gap-3 text-sm text-neutral-700">
            <input type="checkbox" name="marketing_opt_in" checked={form.marketing_opt_in} onChange={onChange}
              className="mt-1 h-4 w-4 rounded border"/>
            Хочу получать бонусы и акции
          </label>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button type="submit" formNoValidate disabled={loading}
            className="w-full h-12 rounded-xl bg-black text-white font-medium hover:opacity-90 active:opacity-80 disabled:opacity-60">
            {loading ? "Создаём…" : "Получить карту"}
          </button>
        </form>
      </div>
    </BrandLayout>
  );
}
