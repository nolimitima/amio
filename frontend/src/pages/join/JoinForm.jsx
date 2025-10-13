import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BrandLayout from "../../components/BrandLayout";

export default function JoinForm() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    marketing_opt_in: true,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };
  const onPhoneChange = (e) =>
    setForm((f) => ({ ...f, phone: e.target.value.replace(/[^\d+\-\s()]/g, "") }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.phone.trim()) return setError("Введите номер телефона.");

    setLoading(true);
    try {
      const r = await fetch("/api/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...form }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Ошибка");
      navigate(`/join/success?uuid=${j.uuid}`);
    } catch (err) {
      setError(err.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <BrandLayout branding={{}}>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-semibold mb-2 text-white">
          Подключить карту лояльности
        </h1>
        <p className="text-white/60">Заполните данные — и добавьте карту в Apple Wallet.</p>
      </div>

      <form
        onSubmit={submit}
        noValidate
        className="bg-white/95 p-8 rounded-2xl shadow-xl space-y-5 max-w-md mx-auto backdrop-blur-sm"
      >
        <input
          type="text"
          name="full_name"
          placeholder="Например: Тимур"
          className="w-full h-12 px-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-black/10 outline-none"
          value={form.full_name}
          onChange={onChange}
        />
        <input
          type="tel"
          name="phone"
          placeholder="+7 7xx xxx-xx-xx или 8XXXXXXXXXX"
          className="w-full h-12 px-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-black/10 outline-none"
          value={form.phone}
          onChange={onPhoneChange}
        />
        <input
          type="email"
          name="email"
          placeholder="name@example.com"
          className="w-full h-12 px-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-black/10 outline-none"
          value={form.email}
          onChange={onChange}
        />

        <label className="flex items-center gap-3 text-sm text-neutral-700">
          <input
            type="checkbox"
            name="marketing_opt_in"
            checked={form.marketing_opt_in}
            onChange={onChange}
            className="accent-black h-4 w-4"
          />
          Хочу получать бонусы и акции
        </label>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-black text-white font-medium hover:opacity-90 active:opacity-80 disabled:opacity-60 transition"
        >
          {loading ? "Создаём…" : "Получить карту"}
        </button>
      </form>
    </BrandLayout>
  );
}
