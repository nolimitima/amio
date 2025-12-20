import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import headerLogo from '../assets/logo-white.png';
import { useAuth } from '../context/AuthContext.jsx';
import QRCode from 'react-qr-code';
import { supabase } from '../supabaseClient';
import Settings from './Settings.jsx';
import ScanLogsList from '../components/ScanLogsList.jsx';
import RegistrationLinks from './RegistrationLinks.jsx';

const tabs = [
  'Лицевая сторона',
  'Обратная сторона',
  'Особенности',
];

function fileToDataUrl(file, cb) {
  const reader = new FileReader();
  reader.onload = e => cb(e.target.result);
  reader.readAsDataURL(file);
}

const DEFAULT_LABELS = [];

const Dashboard = () => {
  const [cards, setCards] = useState([]);
  const [activeTab, setActiveTab] = useState('cards');
  const [createTab, setCreateTab] = useState(0);
  // --- Новый стейт для создания карты ---
  // Front
  const [internalName, setInternalName] = useState('');
  const [userFacingName, setUserFacingName] = useState('');
  const [logo, setLogo] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [bg, setBg] = useState(null);
  const [bgUrl, setBgUrl] = useState(null);
  const [bgColor, setBgColor] = useState('#10182B');
  const [labelColor, setLabelColor] = useState('#F1EFED'); // контрастный
  const [valueColor, setValueColor] = useState('#232323'); // контрастный
  const [fields, setFields] = useState(DEFAULT_LABELS);
  // --- Динамические поля ---
  const [guestName, setGuestName] = useState('');
  const [bonusPercent, setBonusPercent] = useState('');
  const [balance, setBalance] = useState(0);
  // QR
  const [qrType] = useState('qr');
  const [qrValue, setQrValue] = useState('user.memberId');
  // Back
  const [desc, setDesc] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [site, setSite] = useState('');
  // Features
  const [autoUpdateBalance, setAutoUpdateBalance] = useState(false);
  const [expires, setExpires] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [notifyOnUse, setNotifyOnUse] = useState(false);
  const [limitUses, setLimitUses] = useState(false);
  const [maxUses, setMaxUses] = useState('');
  // Misc
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [errors, setErrors] = useState({});
  const [showBack, setShowBack] = useState(false);
  const [issueModal, setIssueModal] = useState({ open: false, card: null, data: null, loading: false, error: null });
  // --- Переменные для выдачи карты ---
  const [issueGuestName, setIssueGuestName] = useState('');
  const [issueEmail, setIssueEmail] = useState('');
  const [issuePhone, setIssuePhone] = useState('');

  // --- Placeholder user data ---
  const [placeholderUser, setPlaceholderUser] = useState({});

  const logoInput = useRef();
  const bgInput = useRef();

  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  console.log('Dashboard render, activeTab:', activeTab);

  // Отладочная информация

  // Protection against null - show loading until user is ready
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Загрузка...
      </div>
    );
  }

  // --- Автообновление баланса ---
  React.useEffect(() => {
    if (!autoUpdateBalance) return;
    const interval = setInterval(() => {
      // Баланс будет обновляться через backend, здесь ничего не делаем
    }, 2000);
    return () => clearInterval(interval);
  }, [autoUpdateBalance]);

  // --- Автоустановка guestName при загрузке currentUser ---
  React.useEffect(() => {
    if (currentUser?.name) setGuestName(currentUser.name);
  }, [currentUser]);

  // --- Загрузка списка карт с backend ---
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
    navigate('/');
  };

  // Handlers для файлов
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

  // Динамические поля
  const handleFieldChange = (idx, key, value) => {
    setFields(fields => fields.map((f, i) => i === idx ? { ...f, [key]: value } : f));
  };
  const addField = () => {
    if (fields.length < 3) setFields([...fields, { label: '', value: '' }]);
  };
  const removeField = idx => {
    if (fields.length > 1) setFields(fields.filter((_, i) => i !== idx));
  };

  // Валидация
  const validate = () => {
    const errs = {};
    if (!internalName.trim()) errs.internalName = 'Обязательное поле';
    // логотип не блокируем на этапе создания
    // динамические поля пока не обязательны
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.email = 'Некорректный email';
    if (site && !/^https?:\/\//.test(site)) errs.site = 'Некорректный URL';
    return errs;
  };

  // --- Функция обновления баланса (тестовая, для UI) ---
  const handleAddBonus = (amount) => {
    setBalance(b => b + amount);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    setMsg(null);
    try {
      let logoUrlSupabase = null;
      let bgUrlSupabase = null;
      // Загрузка логотипа
      if (logo) {
        const { data, error } = await supabase.storage
          .from('card-logos')
          .upload(`${currentUser.id}_${Date.now()}_${logo.name}`, logo);
        if (error) throw error;
        const { data: publicUrl } = supabase.storage.from('card-logos').getPublicUrl(data.path);
        logoUrlSupabase = publicUrl.publicUrl;
      }
      // Загрузка обложки
      if (bg) {
        const { data, error } = await supabase.storage
          .from('card-covers')
          .upload(`${currentUser.id}_${Date.now()}_${bg.name}`, bg);
        if (error) throw error;
        const { data: publicUrl } = supabase.storage.from('card-covers').getPublicUrl(data.path);
        bgUrlSupabase = publicUrl.publicUrl;
      }
      // Проверка currentUser
      console.log('currentUser:', currentUser);
      // Запись в таблицу card_templates
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
      console.log('INSERT result', { data, error });

      if (error) {
        setErrors({ api: error.message });
        setLoading(false);
        return;
      }
      setMsg('Карта успешно создана!');
      setTimeout(() => {
        setLoading(false);
        setActiveTab('cards');
        setMsg(null);
        // Сброс формы
        setInternalName('');
        setUserFacingName('');
        setLogo(null);
        setLogoUrl(null);
        setBg(null);
        setBgUrl(null);
        setBgColor('#10182B');
        setLabelColor('#F1EFED');
        setValueColor('#232323');
        setGuestName('');
        setBonusPercent('');
        setBalance(0);
        setQrValue('user.memberId');
        setDesc('');
        setEmail('');
        setPhone('');
        setSite('');
        setAutoUpdateBalance(false);
        setExpires(false);
        setExpiresAt('');
        setNotifyOnUse(false);
        setLimitUses(false);
        setMaxUses('');
        setErrors({});
        // Обновить список карт
        (async () => {
          const { data, error } = await supabase
            .from('card_templates')
            .select('*')
            .eq('user_id', currentUser.id);
          setCards(data || []);
        })();
      }, 1000);
    } catch (err) {
      setLoading(false);
      setErrors({ api: err.message || 'Ошибка Supabase' });
    }
  };

  // И ЗАМЕНИТЕ ЕГО НА ЭТОТ
  const cardPreview = (
    <div className="w-[340px] h-[480px] rounded-2xl shadow-lg flex flex-col overflow-hidden relative" style={{ background: bgColor }}>
      {/* Верхняя панель: логотип слева, баланс справа */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="w-12 h-12 rounded bg-white/80 object-contain" style={{ width: 60, height: 45 }} />
          ) : (
            <div className="w-12 h-12 rounded bg-white/20" />
          )}
          {userFacingName && (
            <span className="text-base font-normal" style={{ color: labelColor, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userFacingName}</span>
          )}
        </div>
        <div className="flex flex-col items-end px-3 py-1 min-w-[90px]" style={{ background: 'transparent' }}>
          <span className="text-[10px] font-medium" style={{ color: labelColor }}>БАЛАНС</span>
          <span className="text-base font-medium" style={{ color: valueColor }}>{balance} B</span>
        </div>
      </div>
      {/* Cover image */}
      {bgUrl ? (
        <img src={bgUrl} alt="cover" className="w-full h-[110px] object-cover" />
      ) : (
        <div className="w-full h-[110px] bg-[#23283a] flex items-center justify-center text-white/30 text-sm">cover</div>
      )}
      {/* --- Имя клиента и бонус только на лицевой стороне --- */}
      {createTab === 0 && (
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
      )}

      {/* 👇 ЭТОТ БЛОК БЫЛ ВОССТАНОВЛЕН */}
      <div className="flex flex-col items-center px-6 pb-4 mt-auto">
        <div className="bg-white p-3 rounded border inline-flex">
          <QRCode value={(placeholderUser[qrValue] || qrValue) ? `${window.location.origin}/api/passes/${placeholderUser[qrValue] || qrValue}` : ''} size={120} />
        </div>
        <div className="mt-1 text-xs text-center break-all" style={{ color: valueColor }}>
          {placeholderUser[qrValue] || qrValue || ''}
        </div>
      </div>

    </div>
  );

  // Функция для выдачи карты
  const handleIssueCard = async (card) => {
    setIssueModal({ open: true, card, data: null, loading: true, error: null });
    try {
      // Генерируем uuid для карты
      const uuid = crypto.randomUUID();

      const { data, error } = await supabase
        .from('issued_cards')
        .insert([
          {
            user_id: currentUser.id,
            card_template_id: card.id,
            guest_name: issueGuestName || 'Имя клиента',
            email: issueEmail || 'client@example.com',
            phone: issuePhone || '+77001234567',
            balance: 0,
            max_uses: card.max_uses,
            // В qr_value кладём payload, а не ссылку
            qr_value: uuid,
            uuid: uuid,
          },
        ])
        .select()
        .single();

      if (error) throw new Error(error.message);

      const origin = window.location.origin;
      const previewUrl = `${origin}/card/${uuid}`;
      const pkpassUrl = `${origin}/api/passes/${uuid}`;

      setIssueModal({
        open: true,
        card,
        data: {
          pkpassUrl,
          qrUrl: previewUrl, // QR ведёт на страницу предпросмотра
        },
        loading: false,
        error: null,
      });
    } catch (e) {
      setIssueModal({ open: true, card: null, data: null, loading: false, error: e.message });
    }
  };

  return (
    <div className="font-[Inter] bg-[#F1EFED] min-h-screen w-full">
      {/* HEADER */}
      <header className="w-full bg-white/80 sticky top-0 z-30 rounded-xl max-w-screen-xl mx-auto px-4 py-3 flex justify-between items-center mt-6 mb-8 shadow-sm">
        {/* Left: Logo and name */}
        <div className="flex items-center gap-3 select-none cursor-pointer" onClick={handleGoHome}>
          <img src={headerLogo} alt="Amian logo" className="h-12 w-12 object-contain" />
          <span className="text-[#121E1D] text-xl font-light font-[Inter]">Amian</span>
        </div>

        {/* Center: Empty */}
        <div></div>

        {/* Right: User name and logout */}
        <div className="flex items-center gap-4">
          <span
            className="text-[#121E1D] font-light cursor-pointer hover:underline hover:text-[#D1E889] transition"
            title="Настройки аккаунта"
            onClick={() => setActiveTab('settings')}
          >
            {currentUser?.user_metadata?.company_name || currentUser?.email || 'Пользователь'}
          </span>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-[#D1E889]/20 transition-all duration-200"
            title="Выйти"
          >
            <svg className="w-5 h-5 text-[#121E1D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="max-w-7xl mx-auto px-4 flex gap-8 pb-20 md:pb-0">
        {/* SIDEBAR - Desktop Only */}
        <div className="w-64 flex-shrink-0 hidden md:flex">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
            <nav className="space-y-2">
              <button
                onClick={() => setActiveTab('cards')}
                className={`w-full text-left px-4 py-3 rounded-xl font-light transition-all duration-200 ${activeTab === 'cards'
                  ? 'bg-[#D1E889] text-[#121E1D]'
                  : 'text-[#121E1D] hover:bg-[#D1E889]/20'
                  }`}
              >
                Карты
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`w-full text-left px-4 py-3 rounded-xl font-light transition-all duration-200 ${activeTab === 'create'
                  ? 'bg-[#D1E889] text-[#121E1D]'
                  : 'text-[#121E1D] hover:bg-[#D1E889]/20'
                  }`}
              >
                Создать карту
              </button>
              <button
                onClick={() => setActiveTab('scans')}
                className={`w-full text-left px-4 py-3 rounded-xl font-light transition-all duration-200 ${activeTab === 'scans'
                  ? 'bg-[#D1E889] text-[#121E1D]'
                  : 'text-[#121E1D] hover:bg-[#D1E889]/20'
                  }`}
              >
                Сканы
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full text-left px-4 py-3 rounded-xl font-light transition-all duration-200 ${activeTab === 'settings'
                  ? 'bg-[#D1E889] text-[#121E1D]'
                  : 'text-[#121E1D] hover:bg-[#D1E889]/20'
                  }`}
              >
                Настройки
              </button>
              <button
                onClick={() => setActiveTab('registration')}
                className={`w-full text-left px-4 py-3 rounded-xl font-light transition-all duration-200 ${activeTab === 'registration'
                  ? 'bg-[#D1E889] text-[#121E1D]'
                  : 'text-[#121E1D] hover:bg-[#D1E889]/20'
                  }`}
              >
                Регистрация
              </button>
            </nav>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1">
          {activeTab === 'cards' && (
            <>
              {/* Welcome Section */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-lg border border-white/50 mb-8">
                <h1 className="text-3xl md:text-4xl font-extralight text-[#121E1D] mb-4">
                  Привет, {currentUser?.user_metadata?.company_name || currentUser?.email || 'Пользователь'}!
                </h1>
                <p className="text-[#232823] text-lg font-light">
                  Здесь будет список ваших цифровых карт лояльности.
                </p>

                {/* Уведомление о неподтвержденном email */}
                {currentUser && !currentUser.email_confirmed_at && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-yellow-800 font-medium">Подтвердите ваш email</p>
                        <p className="text-yellow-700 text-sm">Проверьте почту и перейдите по ссылке для подтверждения аккаунта.</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="mb-4"></div>
              </div>

              {/* Cards Section */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-lg border border-white/50">
                <h2 className="text-2xl font-extralight text-[#121E1D] mb-6">
                  Ваши карты
                </h2>

                {cards.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎫</div>
                    <h3 className="text-xl font-light text-[#121E1D] mb-3">
                      У вас пока нет карт
                    </h3>
                    <p className="text-[#232823] font-extralight max-w-md mx-auto">
                      Когда вы создадите первую карту — она появится здесь.
                    </p>
                    <button
                      className="mt-6 bg-[#D1E889] hover:bg-[#e6f7a1] text-[#121E1D] font-light rounded-full px-8 py-3 transition-all duration-200 shadow-md shadow-[#D1E889]/20"
                      onClick={() => setActiveTab('create')}
                    >
                      Создать первую карту
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {cards.map((card, index) => (
                      <div key={card.id || index} className="bg-white/50 rounded-xl p-6 border border-[#121E1D]/10">
                        <div className="flex items-center gap-4 mb-2">
                          {card.logo_url && <img src={card.logo_url} alt="logo" className="w-12 h-12 rounded bg-white/80 object-contain" />}
                          <div>
                            <h3 className="text-lg font-light text-[#121E1D] mb-1">{card.user_facing_name || card.internal_name}</h3>
                            <div className="text-xs text-gray-500">ID: {card.id}</div>
                          </div>
                        </div>
                        <div className="text-[#232823] font-extralight mb-2">{card.description}</div>
                        <div className="flex gap-4 text-xs text-gray-600 mb-2">
                          {card.contact_email && <div>Email: {card.contact_email}</div>}
                          {card.contact_phone && <div>Телефон: {card.contact_phone}</div>}
                          {card.website_url && <div>Сайт: <a href={card.website_url} className="underline" target="_blank" rel="noopener noreferrer">{card.website_url}</a></div>}
                        </div>
                        <button className="mt-2 bg-[#D1E889] hover:bg-[#e6f7a1] text-[#121E1D] font-light rounded-full px-6 py-2 transition-all duration-200 shadow-md shadow-[#D1E889]/20" onClick={() => handleIssueCard(card)}>
                          Выдать карту
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          {activeTab === 'scans' && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-lg border border-white/50">
              <ScanLogsList />
            </div>
          )}
          {activeTab === 'registration' && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-lg border border-white/50">
              <RegistrationLinks />
            </div>
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
                    <div className="mb-3">
                      <label htmlFor="internalName" className="block text-xs mb-1 font-medium text-[#232323] font-light"> Внутреннее название <span className="text-red-500">*</span></label>
                      <input id="internalName" name="internalName" required value={internalName} onChange={e => setInternalName(e.target.value)} placeholder="Внутреннее название шаблона (не видно клиенту)" className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder-gray-400" />
                      {errors.internalName && <div className="text-xs text-red-500 mt-1">{errors.internalName}</div>}
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs mb-1 font-medium text-[#232323] font-light">Название, которое увидят пользователи</label>
                      <input value={userFacingName} onChange={e => setUserFacingName(e.target.value)} placeholder="Название, которое увидит клиент в Wallet" className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder-gray-400" />
                    </div>
                    <div className="mb-3">
                      <label htmlFor="logoInput" className="block text-xs mb-1 font-medium text-[#232323] font-light">Загрузка логотипа</label>
                      <input id="logoInput" name="logoInput" type="file" accept="image/*" ref={logoInput} onChange={handleLogo} className="w-full text-xs" />
                      <div className="text-[10px] text-gray-400 mt-1">60x45 px, PNG/SVG/JPG, отображается в левом верхнем углу</div>
                      {logo && <div className="text-[10px] text-gray-600 mt-1">Выбран файл: {logo.name}</div>}
                      {errors.logo && <div className="text-xs text-red-500 mt-1">{errors.logo}</div>}
                    </div>
                    <div className="mb-3">
                      <label htmlFor="bgInput" className="block text-xs mb-1 font-medium text-[#232323] font-light">Загрузка обложки</label>
                      <input id="bgInput" name="bgInput" type="file" accept="image/*" ref={bgInput} onChange={handleBg} className="w-full text-xs" />
                      <div className="text-[10px] text-gray-400 mt-1">1000x648 px, заменяет цвет фона</div>
                      {bg && <div className="text-[10px] text-gray-600 mt-1">Выбран файл: {bg.name}</div>}
                    </div>
                    <div className="flex gap-4 mb-3">
                      <div>
                        <label className="block text-xs mb-1 font-medium text-[#232323] font-light">Цвет фона</label>
                        <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-8 h-8 p-0 border-none" />
                      </div>
                      <div>
                        <label className="block text-xs mb-1 font-medium text-[#232323] font-light">Цвет заголовков</label>
                        <input type="color" value={labelColor} onChange={e => setLabelColor(e.target.value)} className="w-8 h-8 p-0 border-none" />
                      </div>
                      <div>
                        <label className="block text-xs mb-1 font-medium text-[#232323] font-light">Цвет значений</label>
                        <input type="color" value={valueColor} onChange={e => setValueColor(e.target.value)} className="w-8 h-8 p-0 border-none" />
                      </div>
                    </div>
                    {/* Динамические поля временно убраны */}
                    <div className="mb-3">
                      <label className="block text-xs mb-1 font-medium text-[#232323] font-light">Штрихкод / QR-код</label>
                      <div className="flex gap-2 items-center">
                        <select value={qrType} disabled className="border rounded px-2 py-1 text-xs">
                          <option value="qr">QR Code</option>
                        </select>
                        <input value={qrValue} onChange={e => setQrValue(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs w-40 text-gray-900 bg-white placeholder-gray-400" />
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">По умолчанию: user.memberId</div>
                    </div>
                  </>
                )}
                {createTab === 1 && (
                  <>
                    <div className="mb-3">
                      <label className="block text-xs mb-1 font-medium text-[#232323] font-light">Описание</label>
                      <textarea maxLength={500} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Описание, правила, условия..." className="w-full border border-gray-300 rounded px-2 py-1 text-sm min-h-[60px] resize-vertical text-gray-900 bg-white placeholder-gray-400" />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs mb-1 font-medium text-[#232323] font-light">Контактный email</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="mail@company.com" className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder-gray-400" />
                      {errors.email && <div className="text-xs text-red-500 mt-1">{errors.email}</div>}
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs mb-1 font-medium text-[#232323] font-light">Телефон</label>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 999 888-77-66" className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder-gray-400" />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs mb-1 font-medium text-[#232323] font-light">Сайт</label>
                      <input type="url" value={site} onChange={e => setSite(e.target.value)} placeholder="https://site.com" className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder-gray-400" />
                      {errors.site && <div className="text-xs text-red-500 mt-1">{errors.site}</div>}
                    </div>
                  </>
                )}
                {createTab === 2 && (
                  <>
                    <button type="button" className="mb-2 bg-[#D1E889] text-[#121E1D] rounded px-3 py-1 text-xs" onClick={() => handleAddBonus(10)}>+10 к балансу (тест)</button>
                    <label className="flex items-center gap-2 text-sm mb-2 text-[#232323]">
                      <input type="checkbox" checked={autoUpdateBalance} onChange={e => setAutoUpdateBalance(e.target.checked)} />
                      Автоматическое обновление баланса
                    </label>
                    <label className="flex items-center gap-2 text-sm mb-2 text-[#232323]">
                      <input type="checkbox" checked={expires} onChange={e => setExpires(e.target.checked)} />
                      Срок действия карты
                    </label>
                    {expires && (
                      <div className="pl-6 mb-2">
                        <label className="block text-xs mb-1 font-medium text-[#232323] font-light">Срок действия до:</label>
                        <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white" />
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm mb-2 text-[#232323]">
                      <input type="checkbox" checked={notifyOnUse} onChange={e => setNotifyOnUse(e.target.checked)} />
                      Оповещение при использовании
                    </label>
                    <label className="flex items-center gap-2 text-sm mb-2 text-[#232323]">
                      <input type="checkbox" checked={limitUses} onChange={e => setLimitUses(e.target.checked)} />
                      Ограничить количество использований
                    </label>
                    {limitUses && (
                      <div className="pl-6 mb-2">
                        <label className="block text-xs mb-1 font-medium text-[#232323] font-light">Максимум использований:</label>
                        <input type="number" min={1} value={maxUses} onChange={e => setMaxUses(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm w-24 text-gray-900 bg-white" />
                      </div>
                    )}
                  </>
                )}
                {/* --- Новый блок: Конструктор динамических полей (только для лицевой стороны) --- */}
                {createTab === 0 && (
                  <div className="mb-6 mt-4">
                    <h2 className="text-base font-light text-black mb-2">Динамические поля</h2>
                    <div className="mb-4">
                      <label className="block text-[10px] font-medium text-[#232323] mb-1 flex items-center gap-2">
                        <span role="img" aria-label="user">👤</span> Имя клиента
                      </label>
                      <input
                        className="border border-gray-300 rounded px-2 py-1 w-full text-gray-900 bg-white placeholder-gray-400 text-sm"
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        placeholder="Например, Илон Маск"
                      />
                      <div className="text-[10px] text-gray-400 mt-1">Это значение будет автоматически подставлено для каждого пользователя (user.fullName)</div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-[10px] font-medium text-[#232323] mb-1 flex items-center gap-2">
                        <span role="img" aria-label="bonus">🎁</span> Бонус (%)
                      </label>
                      <input
                        className="border border-gray-300 rounded px-2 py-1 w-full text-gray-900 bg-white placeholder-gray-400 text-sm"
                        type="number"
                        min={0}
                        max={100}
                        value={bonusPercent}
                        onChange={e => setBonusPercent(e.target.value)}
                        placeholder="Например, 5"
                      />
                      <div className="text-[10px] text-gray-400 mt-1">Это значение будет автоматически подставлено для каждого пользователя (user.bonusPercentage)</div>
                    </div>
                  </div>
                )}
                {/* --- конец блока конструктора --- */}
                <button
                  type="submit"
                  className="mt-6 bg-[#121e1d] text-white py-2 rounded text-sm w-full disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Создание...' : 'Создать карту'}
                </button>
                {errors.api && <div className="mt-2 text-center text-red-600 text-sm">{errors.api}</div>}
                {msg && <div className="mt-2 text-center text-green-600 text-sm">{msg}</div>}
              </div>
              {/* Preview */}
              <div className="flex-1 flex flex-col items-center">
                <div className="flex flex-col gap-2 items-center">
                  {cardPreview}
                  <div className="text-xs text-gray-400 mt-1">Live preview</div>
                </div>
              </div>
            </form>
          )}
          {activeTab === 'settings' && (
            <Settings />
          )}
        </div>
      </div>

      {/* BOTTOM NAVIGATION - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50">
        <div className="flex justify-around items-center py-3">
          <button
            onClick={() => navigate('/scanner')}
            className="flex flex-col items-center gap-1 px-4 py-2 text-gray-600 hover:text-[#121E1D] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span className="text-xs">Scanner</span>
          </button>
          <button
            onClick={() => setActiveTab('cards')}
            className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${activeTab === 'cards' ? 'text-[#121E1D]' : 'text-gray-600 hover:text-[#121E1D]'
              }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="text-xs">Cards</span>
          </button>
          <button
            onClick={() => setActiveTab('scans')}
            className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${activeTab === 'scans' ? 'text-[#121E1D]' : 'text-gray-600 hover:text-[#121E1D]'
              }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span className="text-xs">Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${activeTab === 'settings' ? 'text-[#121E1D]' : 'text-gray-600 hover:text-[#121E1D]'
              }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </nav>

      {/* Модальное окно для выдачи карты */}
      {issueModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 shadow-xl min-w-[320px] max-w-[90vw] relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-black text-2xl" onClick={() => setIssueModal({ open: false, card: null, data: null, loading: false, error: null })}>&times;</button>
            <h2 className="text-xl font-light mb-4">Выдача карты</h2>
            {!issueModal.data && !issueModal.loading && (
              <form onSubmit={async (e) => { e.preventDefault(); await handleIssueCard(issueModal.card); }} className="flex flex-col gap-4 mb-4">
                <input
                  className="border border-gray-300 rounded px-2 py-1 w-full text-gray-900 bg-white placeholder-gray-400 text-sm"
                  value={issueGuestName}
                  onChange={e => setIssueGuestName(e.target.value)}
                  placeholder="Имя клиента"
                  required
                />
                <input
                  className="border border-gray-300 rounded px-2 py-1 w-full text-gray-900 bg-white placeholder-gray-400 text-sm"
                  value={issueEmail}
                  onChange={e => setIssueEmail(e.target.value)}
                  placeholder="Email клиента"
                  type="email"
                  required
                />
                <input
                  className="border border-gray-300 rounded px-2 py-1 w-full text-gray-900 bg-white placeholder-gray-400 text-sm"
                  value={issuePhone}
                  onChange={e => setIssuePhone(e.target.value)}
                  placeholder="Телефон клиента"
                  required
                />
                <button type="submit" className="bg-[#D1E889] text-[#121E1D] rounded px-4 py-2 font-light">Выдать</button>
              </form>
            )}
            {issueModal.loading && <div>Загрузка...</div>}
            {issueModal.error && <div className="text-red-500">{issueModal.error}</div>}
            {issueModal.data && (
              <div className="flex flex-col items-center gap-4">
                <a href={issueModal.data.pkpassUrl} target="_blank" rel="noopener noreferrer" className="bg-[#D1E889] text-[#121E1D] rounded px-4 py-2 font-light mb-2">Скачать карту (.pkpass)</a>
                <div>
                  <div className="text-xs text-gray-500 mb-1">QR-код для добавления</div>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(issueModal.data.qrUrl)}`} alt="QR code" className="w-40 h-40" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
