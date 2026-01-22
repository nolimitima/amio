import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Privacy() {
    const navigate = useNavigate();

    // Функция для возврата назад
    const handleBack = () => {
        // Если есть история браузера, возвращаемся назад
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            // Иначе идём на главную
            navigate('/');
        }
    };

    return (
        <div className="font-[Inter] bg-[#F1EFED] min-h-screen w-full">
            {/* Header */}
            <header className="w-full bg-white/80 sticky top-0 z-30 rounded-xl max-w-screen-xl mx-auto px-3 md:px-4 py-3 flex justify-between items-center mt-4 md:mt-6 mb-6 md:mb-8 shadow-sm">
                <div
                    className="flex items-center gap-2 md:gap-3 select-none cursor-pointer"
                    onClick={() => navigate('/')}
                >
                    <img src="/logo-white.png" alt="Amio logo" className="h-10 md:h-12 w-10 md:w-12 object-contain" />
                    <span className="text-[#121E1D] text-lg md:text-xl font-light font-[Inter]">Amio</span>
                </div>
                <button
                    className="px-4 md:px-6 py-2 rounded-lg font-light text-[#121E1D] bg-[#D1E889] hover:bg-[#e6f7a1] transition-all duration-200 border border-transparent shadow-sm text-sm md:text-base whitespace-nowrap"
                    onClick={() => navigate('/')}
                >
                    На главную
                </button>
            </header>

            {/* Content */}
            <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
                <h1 className="text-2xl md:text-3xl font-light text-[#121E1D] mb-8 text-center">
                    Политика конфиденциальности
                </h1>

                <div className="bg-white rounded-2xl shadow-sm p-6 md:p-10 space-y-6 text-[#232823]">
                    <p className="text-lg font-medium text-[#121E1D]">
                        Политика конфиденциальности сервиса Amio (amio.kz)
                    </p>

                    <section>
                        <h2 className="text-base font-medium text-[#121E1D] mb-2">1. Общие положения</h2>
                        <p className="text-sm font-light leading-relaxed">
                            Сервис Amio (amio.kz) является платформой для управления цифровыми картами лояльности. Используя сервис, вы соглашаетесь с данной Политикой.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-medium text-[#121E1D] mb-2">2. Сбор данных</h2>
                        <p className="text-sm font-light leading-relaxed">
                            Мы собираем только те данные, которые необходимы для работы карты: Имя, Номер телефона, а также технические ID Apple Wallet.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-medium text-[#121E1D] mb-2">3. Цели</h2>
                        <p className="text-sm font-light leading-relaxed">
                            Данные нужны для выпуска карты, обновления баланса и отправки бесплатных Push-уведомлений о статусе ваших бонусов.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-medium text-[#121E1D] mb-2">4. Безопасность</h2>
                        <p className="text-sm font-light leading-relaxed">
                            Мы принимаем технические меры для защиты ваших данных. Мы не передаем данные третьим лицам, кроме сервисов Apple (APNs) для доставки уведомлений.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-medium text-[#121E1D] mb-2">5. Контакты</h2>
                        <p className="text-sm font-light leading-relaxed">
                            По всем вопросам удаления или изменения данных:{' '}
                            <a href="mailto:support@amio.kz" className="text-[#121E1D] underline hover:opacity-70">
                                support@amio.kz
                            </a>
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-medium text-[#121E1D] mb-2">6. Законодательство</h2>
                        <p className="text-sm font-light leading-relaxed">
                            Политика соответствует Закону РК «О персональных данных и их защите».
                        </p>
                    </section>
                </div>

                {/* Back button */}
                <div className="mt-8 text-center">
                    <button
                        onClick={handleBack}
                        className="px-6 py-3 rounded-full font-light text-[#121E1D] bg-[#D1E889] hover:bg-[#e6f7a1] transition-all duration-200 shadow-md shadow-[#D1E889]/20"
                    >
                        ← Назад
                    </button>
                </div>
            </main>
        </div>
    );
}
