import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import QRCode from 'react-qr-code';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function RegistrationLinks() {
  const { currentUser } = useAuth();
  const [rows, setRows] = useState([]);
  const [tpls, setTpls] = useState([]);
  const [slug, setSlug] = useState('');
  const [tplId, setTplId] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  // Flyer state for PDF generation
  const [flyerData, setFlyerData] = useState(null);
  const flyerRef = useRef(null);

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

  // Get business name from template
  const getBusinessName = (templateId) => {
    const tpl = tpls.find(t => t.id === templateId);
    return tpl?.user_facing_name || tpl?.internal_name || 'Бонусная карта';
  };

  // Handle PDF download
  const handleDownloadPDF = async (row) => {
    const linkUrl = `${window.location.origin}/join/${row.slug}`;
    const businessName = getBusinessName(row.card_template_id);

    // Set flyer data to trigger render
    setFlyerData({ linkUrl, businessName });

    // Wait for render
    await new Promise(resolve => requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    }));

    // Small additional delay to ensure QR code renders
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!flyerRef.current) return;

    try {
      // Capture the flyer
      const canvas = await html2canvas(flyerRef.current, {
        scale: 2, // Higher quality
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      // Create PDF (A5 dimensions: 148mm x 210mm)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 148;
      const pdfHeight = 210;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`promo-flyer-${row.slug}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Ошибка при создании PDF');
    } finally {
      // Clear flyer data after generation
      setFlyerData(null);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-extralight text-neutral-900 mb-4">Ссылки регистрации</h2>
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
        <table className="min-w-full text-sm text-neutral-900">
          <thead className="bg-gray-50 font-medium"><tr><th className="px-3 py-2">Короткая ссылка</th><th className="px-3 py-2">Шаблон</th><th className="px-3 py-2">Статус</th><th></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t text-neutral-900">
                <td className="px-3 py-2 font-mono">{r.slug}</td>
                <td className="px-3 py-2">{r.card_template_id}</td>
                <td className="px-3 py-2">{r.is_active ? 'Активна' : 'Неактивна'}</td>
                <td className="px-3 py-2">
                  <button className="border rounded px-2 py-1 mr-2 text-neutral-900" onClick={() => toggle(r.id, r.is_active)}>{r.is_active ? 'Выключить' : 'Включить'}</button>
                  <button className="border rounded px-2 py-1 mr-2 text-neutral-900"
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join/${r.slug}`)}>Копировать ссылку</button>
                  <button
                    className="border rounded px-2 py-1 text-neutral-900 bg-neutral-100 hover:bg-neutral-200"
                    onClick={() => handleDownloadPDF(r)}
                  >
                    📥 Скачать QR
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="px-3 py-4 text-neutral-700" colSpan={4}>Пока нет ссылок</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Hidden Flyer for PDF Generation - A5 dimensions (148mm x 210mm -> ~444px x 630px at 3x) */}
      {flyerData && (
        <div
          ref={flyerRef}
          style={{
            position: 'absolute',
            left: '-9999px',
            top: 0,
            width: '444px',
            height: '630px',
            backgroundColor: '#ffffff',
            color: '#000000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            boxSizing: 'border-box',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          {/* Business Name */}
          <div style={{
            fontSize: '28px',
            fontWeight: '700',
            textAlign: 'center',
            marginBottom: '16px',
            color: '#000000'
          }}>
            {flyerData.businessName}
          </div>

          {/* Header */}
          <div style={{
            fontSize: '20px',
            fontWeight: '600',
            textAlign: 'center',
            marginBottom: '32px',
            color: '#000000'
          }}>
            Получи бонусную карту
          </div>

          {/* QR Code Container */}
          <div style={{
            backgroundColor: '#ffffff',
            padding: '16px',
            border: '2px solid #000000',
            borderRadius: '8px',
            marginBottom: '32px'
          }}>
            <QRCode
              value={flyerData.linkUrl}
              size={220}
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>

          {/* Call to Action */}
          <div style={{
            fontSize: '16px',
            fontWeight: '500',
            textAlign: 'center',
            marginBottom: '40px',
            color: '#000000'
          }}>
            Наведи камеру, чтобы получить
          </div>

          {/* Apple Wallet Badge */}
          <div style={{
            backgroundColor: '#000000',
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <rect x="3" y="6" width="18" height="12" rx="2" stroke="white" strokeWidth="2" />
              <path d="M3 10H21" stroke="white" strokeWidth="2" />
            </svg>
            Add to Apple Wallet
          </div>
        </div>
      )}
    </div>
  );
}
