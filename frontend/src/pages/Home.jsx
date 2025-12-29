import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import headerLogo from '../assets/logo-white.png';

const faqData = [
  { q: 'Что нужно, чтобы начать?', a: 'Просто зарегистрируйтесь и создайте первую карту — это займёт пару минут.' },
  { q: 'Поддерживаются ли разные типы карт?', a: 'Да, Amian поддерживает купоны, абонементы, бонусные и скидочные карты.' },
  { q: 'Как мои клиенты будут получать обновления по картам?', a: 'Все изменения на карте автоматически обновляются у клиента в Wallet — без приложений и SMS.' },
  { q: 'Есть ли пробный период?', a: 'Да, вы можете начать бесплатно и протестировать все возможности сервиса.' }
];

const features = [
  {
    icon: '⚡',
    title: 'Настройка за 5 минут',
    desc: 'Выберите шаблон, введите данные — карта готова.'
  },
  {
    icon: '📱',
    title: 'Поддержка Apple, Google Wallet',
    desc: 'Ваши карты автоматически появляются в мобильных кошельках клиентов.'
  },
  {
    icon: '🔄',
    title: 'Автоматическое обновление',
    desc: 'Все изменения на вашей стороне сразу отображаются у клиентов.'
  }
];

const steps = [
  'Зарегистрируйтесь',
  'Создайте карту за пару минут',
  'Поделитесь ссылкой'
];

const Home = () => {
  const [open, setOpen] = useState(null);
  const navigate = useNavigate();
  const typeText = 'Apple и Google Wallet';
  const [typed, setTyped] = useState('');
  useEffect(() => {
    let i = 0;
    let forward = true;
    let timeout;
    function typeLoop() {
      if (forward) {
        if (i <= typeText.length) {
          setTyped(typeText.slice(0, i));
          i++;
          timeout = setTimeout(typeLoop, 55);
        } else {
          forward = false;
          timeout = setTimeout(typeLoop, 1900); // pause 
        }
      } else {
        setTyped('');
        i = 0;
        forward = true;
        timeout = setTimeout(typeLoop, 400);
      }
    }
    typeLoop();
    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
      {/* HEADER */}
      <header className="w-full bg-white/80 sticky top-0 z-30 rounded-xl max-w-screen-xl mx-auto px-3 md:px-4 py-3 flex justify-between items-center mt-4 md:mt-6 mb-6 md:mb-8 shadow-sm">
        {/* Left: Logo and name */}
        <div className="flex items-center gap-2 md:gap-3 select-none cursor-pointer" onClick={() => navigate('/')}>
          <img src={headerLogo} alt="Amian logo" className="h-10 md:h-12 w-10 md:w-12 object-contain" />
          <span className="text-[#121E1D] text-lg md:text-xl font-light font-[Inter]">Amian</span>
        </div>
        {/* Center: Navigation - hidden on mobile, visible on md+ */}
        <nav className="hidden md:flex gap-6 lg:gap-8 text-sm lg:text-base font-light">
          <a href="#how" className="text-[#121E1D] transition-colors duration-200 hover:text-[#D1E889]">Как начать</a>
          <a href="#pricing" className="text-[#121E1D] transition-colors duration-200 hover:text-[#D1E889]">Стоимость</a>
          <a href="#faq" className="text-[#121E1D] transition-colors duration-200 hover:text-[#D1E889]">FAQ</a>
        </nav>
        {/* Right: Login button */}
        <button
          className="px-4 md:px-6 py-2 rounded-lg font-light text-[#121E1D] bg-[#D1E889] hover:bg-[#e6f7a1] transition-all duration-200 border border-transparent shadow-sm text-sm md:text-base whitespace-nowrap"
          onClick={() => navigate('/login')}
        >
          Войти
        </button>
      </header>
      {/* MAIN CONTENT */}
      <div className="font-[Inter] bg-[#F1EFED] min-h-screen w-full relative overflow-x-hidden">
        {/* HERO */}
        <section className="w-full flex flex-col items-center justify-center pt-12 md:pt-24 pb-10 px-4 max-w-3xl mx-auto relative z-10">
          <h1 className="text-[#232823] text-3xl md:text-4xl lg:text-5xl font-extralight leading-tight mb-4 text-center tracking-tight" style={{ letterSpacing: '-0.01em' }}>
            <span>Цифровые карты лояльности для</span>
            <br />
            <span style={{ color: '#888', fontWeight: 300, fontFamily: 'inherit' }}>
              {typed}
              <span className="inline-block animate-pulse" style={{ width: '1ch' }}>|</span>
            </span>
          </h1>
          <p className="text-[#232823] text-sm md:text-base lg:text-lg font-light mb-6 mt-4 text-center max-w-2xl mx-auto px-2">
            Купоны, абонементы и накопительные баллы — без приложений и сложной интеграции.
          </p>
          <button
            className="bg-[#D1E889] hover:bg-[#e6f7a1] text-[#121E1D] text-base md:text-lg font-light rounded-full px-6 md:px-8 py-3 transition-all duration-200 mb-6 mt-0 mx-auto block shadow-md shadow-[#D1E889]/20"
            onClick={() => navigate('/signup')}
          >
            Создать свою карту
          </button>
          <img src="/phone-mock.png" alt="Превью карты Amian" className="w-[280px] sm:w-[330px] md:w-[410px] mx-auto z-10" style={{ marginBottom: '-60px', position: 'relative' }} />
        </section>

        {/* WHY AMIAN */}
        <section className="w-full bg-[#121E1D] pt-32 pb-20 px-4 md:px-0 relative z-10">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-extralight text-[#F1EFED] mb-6">
                <span className="text-[#D1E889]">Amian</span> сервис для создания мобильных карт лояльности без кода.
              </h2>
              <p className="text-[#F1EFED] text-lg font-light mb-8">
                Мы объединяем всё в одном месте: от генерации карт до автоматического обновления, без необходимости писать код или делать интеграции.
              </p>
              <button
                className="bg-[#D1E889] hover:bg-[#e6f7a1] text-[#121E1D] text-base font-light rounded-full px-7 py-3 transition-all duration-200 shadow-md shadow-[#D1E889]/20"
                onClick={() => navigate('/signup')}
              >
                Попробовать бесплатно
              </button>
            </div>
            <div className="flex flex-col gap-6">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-4 bg-[#F1EFED] rounded-2xl p-5 border border-[#D1E889]/30 shadow-sm relative overflow-hidden">
                  <div className="text-2xl md:text-3xl select-none text-[#D1E889] font-light z-10 relative">
                    {f.icon}
                  </div>
                  <div className="z-10 relative">
                    <div className="text-lg font-light text-[#121E1D] mb-1">{f.title}</div>
                    <div className="text-[#232823] text-base font-extralight">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="w-full bg-[#121E1D] flex justify-center py-20 px-2 md:px-0">
          <div className="bg-[#F1EFED] rounded-3xl max-w-6xl w-full p-8 md:p-16 flex flex-col items-center gap-10 border border-[#121E1D]/10">
            <h2 className="text-2xl md:text-3xl font-extralight text-[#121E1D] text-center mb-6">Как это работает — всего 3 шага.</h2>
            <div className="flex flex-col md:flex-row gap-8 w-full justify-center items-center">
              {steps.map((s, i) => (
                <div key={i} className="flex-1 bg-white rounded-[32px] p-10 text-center text-[#121E1D] font-medium text-2xl min-w-[240px] max-w-[340px] flex items-center justify-center h-44 shadow-sm">
                  {s}
                </div>
              ))}
            </div>
            <button className="bg-[#D1E889] hover:bg-[#e6f7a1] text-[#121E1D] text-base font-light rounded-full px-8 py-4 transition-all duration-200 shadow-md mt-2 shadow-[#D1E889]/20" onClick={() => navigate('/signup')}>
              Зарегистрироваться
            </button>
          </div>
        </section>

        {/* STORY */}
        <section className="w-full flex flex-col items-center justify-center py-12 px-4 md:px-0 max-w-5xl mx-auto relative z-10">
          <div className="bg-[#f1efed] rounded-2xl shadow-lg p-8 md:p-12 w-full flex flex-col gap-6 border border-[#121E1D]/10">
            <h3 className="text-xl md:text-2xl font-light text-[#121E1D] text-center mb-2 flex items-center gap-2 justify-center">
              Как Amian помогает бизнесу и клиентам: история Алии <span className="text-2xl">☕️</span>
            </h3>
            <div className="border border-[#121E1D] rounded-xl p-5 bg-white text-[#232823] font-extralight text-base leading-relaxed">
              Алия — владелица уютной кофейни в центре города. Она всегда хотела дать своим постоянным клиентам удобные бонусные карты, но пластиковые терялись, а приложения устанавливать никто не хотел.<br />
              С Amian всё изменилось: Алия всего за пару минут заполнила простую форму и получила цифровую карту лояльности, которую клиенты добавляют прямо в Apple Wallet и Google Pay — без скачивания и лишних действий.<br />
              Теперь Алия видит, как клиенты чаще возвращаются и с радостью копят бонусы. А ей не нужно тратить время на сложные интеграции и поддержание приложений.
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="w-full py-10 px-4 md:px-0 max-w-3xl mx-auto relative z-10">
          <h2 className="text-2xl md:text-3xl font-extralight text-[#121E1D] text-center mb-10">Часто задаваемые вопросы</h2>
          <div className="flex flex-col gap-2 divide-y divide-[#121E1D]/20">
            {faqData.map((item, idx) => (
              <div key={idx} className="bg-transparent">
                <button
                  className="w-full flex justify-between items-center py-5 text-left focus:outline-none group"
                  onClick={() => setOpen(open === idx ? null : idx)}
                >
                  <span className="text-lg font-light text-[#121E1D]">{item.q}</span>
                  <span className="text-[#121E1D] text-2xl ml-4 group-hover:text-[#232823] transition-colors duration-200">{open === idx ? '−' : '+'}</span>
                </button>
                <div
                  className={`transition-all duration-300 overflow-hidden ${open === idx ? 'max-h-40 py-2' : 'max-h-0 py-0'}`}
                  style={{ color: '#232823', fontWeight: 200 }}
                >
                  {open === idx && <div className="text-base px-1">{item.a}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <div className="w-full bg-[#F1EFED]" style={{ paddingTop: '79px', marginTop: '79px' }}>
          <footer className="max-w-[calc(100%-8px)] mx-auto bg-[#121E1D] text-[#F1EFED] rounded-t-3xl relative overflow-hidden border-t border-[#232823]/30 flex flex-col items-center" style={{ paddingTop: '47px', paddingBottom: '23px' }}>
            {/* Верхняя часть футера */}
            <div className="flex flex-col items-center gap-6 w-full">
              <img src="/src/assets/logo.png" alt="Amian logo" style={{ height: '49px', width: '49px' }} className="object-contain mb-2" />
              <h2 className="text-3xl md:text-4xl font-light text-center">Создайте свою карту</h2>
              <div className="text-[#F1EFED]/80 text-base md:text-lg font-light text-center max-w-xl">Купоны, абонементы и накопительные баллы — без приложений и сложной интеграции. Повышайте продажи и укрепляйте доверие клиентов за счёт быстрых цифровых карт.</div>
              <button
                className="bg-[#D1E889] hover:bg-[#e6f7a1] text-[#121E1D] px-8 py-3 rounded-full font-light transition-all duration-200 shadow-md text-lg mt-2 shadow-[#D1E889]/20"
                onClick={() => navigate('/signup')}
              >
                Создать
              </button>
            </div>
            {/* Разделитель */}
            <div className="w-full h-px bg-[#F1EFED]/10" style={{ margin: '31px 0' }} />
            {/* Нижняя часть футера */}
            <div className="w-full px-4 md:px-12 lg:px-20 flex flex-col md:flex-row justify-between items-center gap-8 md:gap-0 max-w-7xl mx-auto">
              <div className="flex flex-col items-center md:items-start gap-2 max-w-md">
                <div className="text-lg font-light">Делаем технологии простыми</div>
                <div className="text-[#F1EFED]/70 text-sm font-light leading-relaxed text-center md:text-left">
                  Наша миссия — упростить технологии, чтобы каждый предприниматель мог самостоятельно автоматизировать свой бизнес.
                </div>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="flex gap-4 mt-0 md:mt-4">
                  {/* Instagram */}
                  <a href="#" className="hover:text-[#F1EFED]" aria-label="Instagram">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6"><rect width="18" height="18" x="3" y="3" rx="5" strokeWidth="1.5" /><circle cx="12" cy="12" r="4" strokeWidth="1.5" /><circle cx="17" cy="7" r="1.2" fill="currentColor" /></svg>
                  </a>
                  {/* LinkedIn */}
                  <a href="#" className="hover:text-[#F1EFED]" aria-label="LinkedIn">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6"><rect width="18" height="18" x="3" y="3" rx="4" strokeWidth="1.5" /><path strokeWidth="1.5" d="M8.5 10.5v5M12 13v2.5m0-2.5V13a2 2 0 1 1 4 0v2.5" /><circle cx="8.5" cy="8.5" r="1" fill="currentColor" /></svg>
                  </a>
                  {/* Telegram */}
                  <a href="https://t.me/amianapp" target="_blank" rel="noopener noreferrer" className="hover:text-[#F1EFED]" aria-label="Telegram">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6"><path strokeWidth="1.5" d="M21 4L10 13.5" /><path strokeWidth="1.5" d="M21 4l-4.5 17a1 1 0 0 1-1.6.6l-4.2-3.2-2.1-1.5a1 1 0 0 1 .2-1.7l1.7-.7 8.7-7.2a.5.5 0 0 0-.6-.8l-13 5.2a1 1 0 0 0 .1 1.9l3.2.7" /></svg>
                  </a>
                </div>
              </div>
            </div>
            {/* Копирайт */}
            <div className="w-full text-center text-xs text-[#F1EFED]/60 font-extralight flex justify-center items-center" style={{ marginTop: '23px' }}>
              <span style={{ transform: 'translateY(-1px)' }}>
                © {new Date().getFullYear()} Amian. Все права защищены.
              </span>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
};

export default Home;
