import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function JoinForm() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    marketing_opt_in: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    if (!slug) return setError("Ссылка регистрации недействительна.");
    if (!form.phone.trim()) return setError("Введите номер телефона.");
    if (form.email && !/.+@.+\..+/.test(form.email)) {
      return setError("Неверный формат email.");
    }

    setLoading(true);
    try {
      const r = await fetch("/api/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          full_name: form.full_name?.trim(),
          phone: form.phone?.trim(),
          email: form.email?.trim() || undefined,
          marketing_opt_in: !!form.marketing_opt_in,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Ошибка создания карты");
      navigate(`/join/success?uuid=${j.uuid}`);
    } catch (err) {
      setError(err.message || "Ошибка. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Подключить карту лояльности</h1>

      {/* noValidate отключает HTML5-валидацию формы */}
      <form onSubmit={submit} noValidate className="space-y-3">
        <input
          type="text"
          name="full_name"
          autoComplete="name"
          className="border rounded px-3 py-2 w-full"
          placeholder="Имя"
          value={form.full_name}
          onChange={onChange}
          // на всякий случай снимаем любые унаследованные паттерны
          pattern=".*"
        />

        <input
          type="tel"
          name="phone"
          inputMode="tel"
          autoComplete="tel"
          className="border rounded px-3 py-2 w-full"
          placeholder="+7 7xx xxx-xx-xx или 8XXXXXXXXXX"
          required
          value={form.phone}
          onChange={onPhoneChange}
          // критично: перекрываем любой внешне подмешанный pattern
          pattern=".*"
          onInvalid={(e) => e.preventDefault()} // не показывать нативное сообщение
        />

        <input
          type="email"
          name="email"
          autoComplete="email"
          className="border rounded px-3 py-2 w-full"
          placeholder="Email (необязательно)"
          value={form.email}
          onChange={onChange}
          pattern=".*" // чтобы точно не сработал сторонний pattern
          onInvalid={(e) => e.preventDefault()}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="marketing_opt_in"
            checked={form.marketing_opt_in}
            onChange={onChange}
          />
          Получать акции и бонусы
        </label>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        {/* formNoValidate — запасной выключатель даже если noValidate где-то потеряется */}
        <button
          type="submit"
          formNoValidate
          disabled={loading}
          className="bg-black text-white w-full py-2 rounded disabled:opacity-60"
        >
          {loading ? "Создаём…" : "Получить карту"}
        </button>

        <p className="text-xs text-gray-500">
          Откройте ссылку на iPhone (Safari), чтобы добавить карту в Wallet.
        </p>
      </form>
    </div>
  );
}
