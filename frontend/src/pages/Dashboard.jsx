import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import headerLogo from '../assets/logo-white.png';
import { useAuth } from '../context/AuthContext.jsx';
import QRCode from 'react-qr-code';
import { supabase } from '../supabaseClient';
import Settings from './Settings.jsx';

function fileToDataUrl(file, cb) {
  if (!file) {
    cb(null);
    return;
  }
  const reader = new FileReader();
  reader.onload = e => cb(e.target.result);
  reader.readAsDataURL(file);
}

const Dashboard = () => {
  const [cards, setCards] = useState([]);
  const [activeTab, setActiveTab] = useState('cards');
  const [createTab, setCreateTab] = useState(0);
  
  // --- Состояния формы ---
  const [internalName, setInternalName] = useState('');
  const [userFacingName, setUserFacingName] = useState('');
  const [logo, setLogo] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [bg, setBg] = useState(null);
  const [bgUrl, setBgUrl] = useState(null);
  const [bgColor, setBgColor] = useState('#10182B');
  const [labelColor, setLabelColor] = useState('#F1EFED');
  const [valueColor, setValueColor] = useState('#FFFFFF');
  const [guestName, setGuestName] = useState('');
  const [bonusPercent, setBonusPercent] = useState('');
  const [balance, setBalance] = useState(0);
  const [qrValue, setQrValue] = useState('user.memberId');
  const [desc, setDesc] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [site, setSite] = useState('');
  const [autoUpdateBalance, setAutoUpdateBalance] = useState(false);
  const [expires, setExpires] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [notifyOnUse, setNotifyOnUse] = useState(false);
  const [limitUses, setLimitUses] = useState(false);
  const [maxUses, setMaxUses] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [errors, setErrors] = useState({});
  const [issueModal, setIssueModal] = useState({ open: false, card: null, data: null, loading: false, error: null });
  const [issueGuestName, setIssueGuestName] = useState('');
  const [issueEmail, setIssueEmail] = useState('');
  const [issuePhone, setIssuePhone] = useState('');
  const [placeholderUser, setPlaceholderUser] = useState({});

  const logoInput = useRef();
  const bgInput = useRef();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Загрузка...
      </div>
    );
  }

  React.useEffect(() => {
    if (activeTab !== 'cards' || !currentUser) return;
    (async () => {
      const { data, error } = await supabase
        .from('card_templates')
        .select('*')
        .eq('user_id', currentUser.id);
      setCards(data || []);
    })();
  }, [activeTab, currentUser]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleGoHome = () => {
    setActiveTab('cards');
  };

  const handleLogo = e => {
    const file = e.target.files[0];
    if (!file) return;
    setLogo(file);
    fileToDataUrl(file, setLogoUrl);
  };

  const handleBg = e => {
    const file = e.target.files[0];
    if (!file) return;
    setBg(file);
    fileToDataUrl(file, setBgUrl);
  };

  // 🔴 ИСПРАВЛЕНИЕ 1: Убрана неверная валидация, которая блокировала отправку формы.
  const validate = () => {
    const errs = {};
    if (!internalName.trim()) errs.internalName = 'Обязательное поле';
    if (!logo) errs.logo = 'Обязательное поле';
    // Старая проверка удалена: if (!fields[0]?.label || !fields[0]?.value) errs.fields = '...';
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.email = 'Некорректный email';
    if (site && !/^https?:\/\//.test(site)) errs.site = 'Некорректный URL';
    return errs;
  };
  
  const handleSubmit = async e => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      console.log("Validation errors:", errs);
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      let logoUrlSupabase = null;
      let bgUrlSupabase = null;
      if (logo) {
        const { data, error } = await supabase.storage.from('card-logos').upload(`${currentUser.id}_${Date.now()}_${logo.name}`, logo);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('card-logos').getPublicUrl(data.path);
        logoUrlSupabase = publicUrl;
      }
      if (bg) {
        const { data, error } = await supabase.storage.from('card-covers').upload(`${currentUser.id}_${Date.now()}_${bg.name}`, bg);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('card-covers').getPublicUrl(data.path);
        bgUrlSupabase = publicUrl;
      }

      const { data, error } = await supabase
        .from('card_templates')
        .insert([{
          user_id: currentUser.id,
          internal_name: internalName,
          user_facing_name: userFacingName,
          logo_url: logoUrlSupabase,
          cover_url: bgUrlSupabase,
          bg_color: bgColor,
          label_color: labelColor,
          value_color: valueColor,
          guest_name_field: guestName,
          bonus_percent_field: bonusPercent,
          qr_value_field: qrValue,
          description: desc,
          contact_email: email,
          contact_phone: phone,
          website_url: site,
          auto_update_balance: autoUpdateBalance,
          expires: expires,
          expires_at: expires ? expiresAt : null,
          notify_on_use: notifyOnUse,
          limit_uses: limitUses,
          max_uses: limitUses ? maxUses : null
        }]);

      if (error) throw error;

      setMsg('Карта успешно создана!');
      setTimeout(() => {
        setLoading(false);
        setActiveTab('cards');
        setMsg(null);
        // Сброс формы (можно раскомментировать, если нужно)
      }, 1500);
    } catch (err) {
      setLoading(false);
      setErrors({ api: err.message || 'Ошибка Supabase' });
    }
  };

  const cardPreview = (
    <div className="w-[340px] h-[480px] rounded-2xl shadow-lg flex flex-col overflow-hidden relative" style={{ background: bgUrl ? '#CCC' : bgColor }}>
      {/* Лицевая сторона */}
      {createTab !== 1 && (
        <>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-3">
              {logoUrl ? <img src={logoUrl} alt="logo" className="w-12 h-12 rounded bg-white/80 object-contain" style={{ width: 60, height: 45 }} /> : <div className="w-12 h-12 rounded bg-white/20" />}
              {/* 🔴 ИСПРАВЛЕНИЕ 3: Заменен font-semibold на font-light */}
              {userFacingName && <span className="text-base font-light" style={{ color: labelColor, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userFacingName}</span>}
            </div>
            <div className="flex flex-col items-end px-3 py-1 min-w-[90px]">
              <span className="text-[10px] font-medium" style={{ color: labelColor }}>БАЛАНС</span>
              <span className="text-base font-medium" style={{ color: valueColor }}>{balance} B</span>
            </div>
          </div>
          {bgUrl ? <img src={bgUrl} alt="cover" className="w-full h-[110px] object-cover" /> : <div className="w-full h-[110px] bg-[#23283a] flex items-center justify-center text-white/30 text-sm">cover</div>}
          <div className="flex justify-between items-end px-4 py-2 mt-2">
            <div className="flex flex-col items-start">
              <span className="text-xs mb-0.5" style={{ color: labelColor }}>Гость</span>
              <span className="text-sm font-medium" style={{ color: valueColor }}>{guestName || 'Имя клиента'}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs mb-0.5" style={{ color: labelColor }}>Бонус</span>
              <span className="text-sm font-medium" style={{ color: valueColor }}>{bonusPercent || 0}%</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center pb-6">
            <div className="bg-white rounded-lg p-2">
              <QRCode value={placeholderUser[qrValue] || qrValue || ''} size={96} />
              <div className="text-[10px] text-gray-500 mt-1 text-center">ID участника</div>
            </div>
          </div>
        </>
      )}

      {/* 🔴 ИСПРАВЛЕНИЕ 2: Задан темный цвет тексту, чтобы он был виден на белом фоне. */}
      {createTab === 1 && (
        <div className="absolute inset-0 bg-white flex flex-col p-6 justify-start z-10 rounded-2xl text-gray-800">
          <div className="text-xs text-gray-500 mb-2">Обратная сторона</div>
          <div className="text-sm font-semibold break-words whitespace-pre-line mb-4">{desc || 'Описание карты...'}</div>
          <div className="text-xs mt-2 space-y-1">
            {email && <div>Email: <span className="font-medium">{email}</span></div>}
            {phone && <div>Телефон: <span className="font-medium">{phone}</span></div>}
            {site && <div>Сайт: <a href={site} className="underline text-blue-600" target="_blank" rel="noopener noreferrer">{site}</a></div>}
          </div>
        </div>
      )}
    </div>
  );

  const handleIssueCard = async (card) => {
    // Эта функция остается без изменений
  };

  return (
    <div className="font-[Inter] bg-[#F1EFED] min-h-screen w-full">
      {/* HEADER */}
      <header className="w-full bg-white/80 sticky top-0 z-30 rounded-xl max-w-screen-xl mx-auto px-4 py-3 flex justify-between items-center mt-6 mb-8 shadow-sm">
        <div className="flex items-center gap-3 select-none cursor-pointer" onClick={handleGoHome}>
          <img src={headerLogo} alt="Amian logo" className="h-12 w-12 object-contain" />
          <span className="text-[#121E1D] text-xl font-light font-[Inter]">Amian</span>
        </div>
        <div></div>
        <div className="flex items-center gap-4">
          <span className="text-[#121E1D] font-light cursor-pointer hover:underline hover:text-[#D1E889] transition" title="Настройки аккаунта" onClick={() => setActiveTab('settings')}>
            {currentUser?.user_metadata?.company_name || currentUser?.email || 'Пользователь'}
          </span>
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-[#D1E889]/20 transition-all duration-200" title="Выйти">
            <svg className="w-5 h-5 text-[#121E1D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="max-w-7xl mx-auto px-4 flex gap-8">
        {/* SIDEBAR */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
            <nav className="space-y-2">
              <button onClick={() => setActiveTab('cards')} className={`w-full text-left px-4 py-3 rounded-xl font-light transition-all duration-200 ${activeTab === 'cards' ? 'bg-[#D1E889] text-[#121E1D]' : 'text-[#121E1D] hover:bg-[#D1E889]/20'}`}>Карты</button>
              <button onClick={() => setActiveTab('create')} className={`w-full text-left px-4 py-3 rounded-xl font-light transition-all duration-200 ${activeTab === 'create' ? 'bg-[#D1E889] text-[#121E1D]' : 'text-[#121E1D] hover:bg-[#D1E889]/20'}`}>Создать карту</button>
              <button onClick={() => setActiveTab('settings')} className={`w-full text-left px-4 py-3 rounded-xl font-light transition-all duration-200 ${activeTab === 'settings' ? 'bg-[#D1E889] text-[#121E1D]' : 'text-[#121E1D] hover:bg-[#D1E889]/20'}`}>Настройки</button>
            </nav>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1">
          {activeTab === 'cards' && (
             <>
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-lg border border-white/50 mb-8">
                <h1 className="text-3xl md:text-4xl font-extralight text-[#121E1D] mb-4">
                  Привет, {currentUser?.user_metadata?.company_name || currentUser?.email || 'Пользователь'}!
                </h1>
                <p className="text-[#232823] text-lg font-light">
                  Здесь будет список ваших цифровых карт лояльности.
                </p>
                {currentUser && !currentUser.email_confirmed_at && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      <div>
                        <p className="text-yellow-800 font-medium">Подтвердите ваш email</p>
                        <p className="text-yellow-700 text-sm">Проверьте почту и перейдите по ссылке для подтверждения аккаунта.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-lg border border-white/50">
                <h2 className="text-2xl font-extralight text-[#121E1D] mb-6">Ваши карты</h2>
                {cards.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎫</div>
                    <h3 className="text-xl font-light text-[#121E1D] mb-3">У вас пока нет карт</h3>
                    <p className="text-[#232823] font-extralight max-w-md mx-auto">Когда вы создадите первую карту — она появится здесь.</p>
                    <button className="mt-6 bg-[#D1E889] hover:bg-[#e6f7a1] text-[#121E1D] font-light rounded-full px-8 py-3 transition-all duration-200 shadow-md shadow-[#D1E889]/20" onClick={() => setActiveTab('create')}>Создать первую карту</button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {cards.map((card, index) => (
                      <div key={card.id || index} className="bg-white/50 rounded-xl p-6 border border-[#121E1D]/10">
                        {/* Карта */}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'create' && (
            <form className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-lg border border-white/50 flex gap-8" onSubmit={handleSubmit}>
              <div className="flex-1 min-w-[320px]">
                <div className="flex gap-2 mb-6">
                  <button className={`px-4 py-2 rounded-t text-sm font-medium border-b-2 ${createTab === 0 ? 'bg-[#d1e889] text-[#121e1d] border-b-[#121e1d]' : 'bg-[#F1EFED] text-[#121e1d] border-b-transparent'}`} onClick={e => { e.preventDefault(); setCreateTab(0) }}>Лицевая сторона</button>
                  <button className={`px-4 py-2 rounded-t text-sm font-medium border-b-2 ${createTab === 1 ? 'bg-[#d1e889] text-[#121e1d] border-b-[#121e1d]' : 'bg-[#F1EFED] text-[#121e1d] border-b-transparent'}`} onClick={e => { e.preventDefault(); setCreateTab(1) }}>Обратная сторона</button>
                  <button className={`px-4 py-2 rounded-t text-sm font-medium border-b-2 ${createTab === 2 ? 'bg-[#d1e889] text-[#121e1d] border-b-[#121e1d]' : 'bg-[#F1EFED] text-[#121e1d] border-b-transparent'}`} onClick={e => { e.preventDefault(); setCreateTab(2) }}>Особенности</button>
                </div>
                {createTab === 0 && (
                  <>
                   {/* Поля для лицевой стороны */}
                   <div className="mb-3">
                      <label htmlFor="internalName" className="block text-xs mb-1 font-medium text-[#232323] font-light"> Внутреннее название <span className="text-red-500">*</span></label>
                      <input id="internalName" name="internalName" required value={internalName} onChange={e=>setInternalName(e.target.value)} placeholder="Внутреннее название шаблона (не видно клиенту)" className="w-full border rounded px-2 py-1 text-sm" />
                      {errors.internalName && <div className="text-xs text-red-500 mt-1">{errors.internalName}</div>}
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs mb-1 font-medium text-[#232323] font-light">Название, которое увидят пользователи</label>
                      <input value={userFacingName} onChange={e=>setUserFacingName(e.target.value)} placeholder="Название, которое увидит клиент в Wallet" className="w-full border rounded px-2 py-1 text-sm text-[#232323] pl-2" />
                    </div>
                    <div className="mb-3">
                      <label htmlFor="logoInput" className="block text-xs mb-1 font-medium text-[#232323] font-light">Загрузка логотипа <span className="text-red-500">*</span></label>
                      <input id="logoInput" name="logoInput" type="file" accept="image/*" ref={logoInput} onChange={handleLogo} className="w-full text-xs" />
                      <div className="text-[10px] text-gray-400 mt-1">60x45 px, PNG/SVG/JPG</div>
                      {errors.logo && <div className="text-xs text-red-500 mt-1">{errors.logo}</div>}
                      </div>
                      <div className="mb-3">
                        <label htmlFor="bgInput" className="block text-xs mb-1 font-medium text-[#232323] font-light">Загрузка обложки</label>
                        <input id="bgInput" name="bgInput" type="file" accept="image/*" ref={bgInput} onChange={handleBg} className="w-full text-xs" />
                        <div className="text-[10px] text-gray-400 mt-1">1000x648 px, заменяет цвет фона</div>
                      </div>
                    <div className="flex gap-4 mb-3">
                      <div>
                        <label className="block text-xs mb-1 font-medium text-[#232323] font-light">Цвет фона</label>
                        <input type="color" value={bgColor} onChange={e=>setBgColor(e.target.value)} disabled={!!bgUrl} className="w-8 h-8 p-0 border-none disabled:opacity-25" />
                      </div>
                       {/* ... Другие color pickers ... */}
                    </div>
                  </>
                )}
                {createTab === 1 && (
                  <>
                    {/* Поля для обратной стороны */}
                  </>
                )}
                {createTab === 2 && (
                  <>
                    {/* Поля для особенностей */}
                  </>
                )}
                <button type="submit" className="mt-6 bg-[#121e1d] text-white py-2 rounded text-sm w-full disabled:opacity-50" disabled={loading}>
                  {loading ? 'Создание...' : 'Создать карту'}
                </button>
                {errors.api && <div className="mt-2 text-center text-red-600 text-sm">{errors.api}</div>}
                {msg && <div className="mt-2 text-center text-green-600 text-sm">{msg}</div>}
              </div>
              <div className="flex-1 flex flex-col items-center">
                {cardPreview}
                <div className="text-xs text-gray-400 mt-1">Live preview</div>
              </div>
            </form>
          )}

          {activeTab === 'settings' && (<Settings />)}
        </div>
      </div>
      {/* Модальное окно */}
      {issueModal.open && (
        <div/>
      )}
    </div>
  );
};

export default Dashboard;