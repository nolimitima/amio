import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegistrationLinks() {
  const { currentUser } = useAuth();
  const [rows, setRows] = useState([]);
  const [tpls, setTpls] = useState([]);
  const [slug, setSlug] = useState('');
  const [tplId, setTplId] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('registration_links')
      .select('id, slug, is_active, card_template_id, created_at')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    setRows(data || []);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('card_templates')
        .select('id, user_facing_name, internal_name')
        .eq('user_id', currentUser.id);
      setTpls(data || []);
      await load();
    })();
  }, [currentUser?.id]);

  const createLink = async () => {
    setLoading(true);
    try {
      const s = slug || Math.random().toString(36).slice(2, 8);
      const { error } = await supabase.from('registration_links').insert({
        slug: s, user_id: currentUser.id, card_template_id: Number(tplId), title
      });
      if (error) throw error;
      setSlug(''); setTplId(''); setTitle('');
      await load();
    } finally { setLoading(false); }
  };

  const toggle = async (id, cur) => {
    await supabase.from('registration_links').update({ is_active: !cur }).eq('id', id);
    await load();
  };

  return (
    <div>
      <h2 className="text-2xl font-extralight mb-4">Ссылки регистрации</h2>
      <div className="flex gap-2 mb-4">
        <input className="border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white placeholder-gray-400" placeholder="Короткая ссылка (необ.)" value={slug} onChange={e => setSlug(e.target.value)} />
        <select className="border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white" value={tplId} onChange={e => setTplId(e.target.value)}>
          <option value="">Шаблон</option>
          {tpls.map(t => <option key={t.id} value={t.id}>{t.user_facing_name || t.internal_name}</option>)}
        </select>
        <input className="border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white placeholder-gray-400" placeholder="Название (необ.)" value={title} onChange={e => setTitle(e.target.value)} />
        <button className="bg-[#D1E889] rounded px-3 py-1" disabled={!tplId || loading} onClick={createLink}>Создать</button>
      </div>

      <div className="overflow-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead><tr><th className="px-3 py-2">Slug</th><th className="px-3 py-2">Шаблон</th><th className="px-3 py-2">Статус</th><th></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 font-mono">{r.slug}</td>
                <td className="px-3 py-2">{r.card_template_id}</td>
                <td className="px-3 py-2">{r.is_active ? 'active' : 'inactive'}</td>
                <td className="px-3 py-2">
                  <button className="border rounded px-2 py-1 mr-2" onClick={() => toggle(r.id, r.is_active)}>{r.is_active ? 'Выключить' : 'Включить'}</button>
                  <button className="border rounded px-2 py-1"
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join/${r.slug}`)}>Копировать ссылку</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="px-3 py-4 text-gray-500" colSpan={4}>Пока нет ссылок</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
