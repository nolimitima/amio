import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { OWNER_PHONE_NUMBER, PRICING } from '../config.js';

/**
 * PricingGate Component
 * Shown to users with 'pending' or 'expired' subscription status
 * Premium Apple/Fintech inspired design
 */
const PricingGate = ({ isExpired = false }) => {
    const { currentUser } = useAuth();
    const userEmail = currentUser?.email || '';

    const getWhatsAppUrl = (messageType) => {
        const messages = {
            trial: `Здравствуйте! Мой email: ${userEmail}. Прошу активировать пробный период.`,
            full: `Здравствуйте! Мой email: ${userEmail}. Прошу активировать тариф.`,
        };
        const message = encodeURIComponent(messages[messageType]);
        return `https://wa.me/${OWNER_PHONE_NUMBER}?text=${message}`;
    };

    return (
        <div
            className="min-h-screen w-full flex items-center justify-center px-4 py-12"
            style={{
                background: '#F1EFED',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
        >
            <div className="w-full max-w-4xl">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1
                        className="text-3xl md:text-4xl font-light tracking-tight mb-4"
                        style={{ color: '#1D1D1F' }}
                    >
                        {isExpired ? 'Ваш пробный период истёк' : 'Активация Аккаунта'}
                    </h1>
                    <p
                        className="text-lg font-light max-w-xl mx-auto"
                        style={{ color: '#86868B' }}
                    >
                        {isExpired
                            ? 'Для продолжения работы с платформой выберите тариф и напишите менеджеру.'
                            : 'Для доступа к платформе выберите тариф и напишите менеджеру для активации.'}
                    </p>
                </div>

                {/* Pricing Cards Grid */}
                <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                    {/* Trial Card */}
                    <div
                        className="bg-white rounded-3xl p-8 transition-all duration-300 hover:scale-[1.02]"
                        style={{
                            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
                            border: '1px solid rgba(0, 0, 0, 0.04)',
                        }}
                    >
                        <div className="mb-6">
                            <span
                                className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4"
                                style={{
                                    background: 'linear-gradient(135deg, #D1E889 0%, #C5DC7A 100%)',
                                    color: '#1D1D1F',
                                }}
                            >
                                START
                            </span>
                            <h2
                                className="text-2xl font-medium mb-2"
                                style={{ color: '#1D1D1F' }}
                            >
                                7 дней бесплатно
                            </h2>
                            <p
                                className="text-sm font-light"
                                style={{ color: '#86868B' }}
                            >
                                Попробуйте все возможности
                            </p>
                        </div>

                        <ul className="space-y-3 mb-8">
                            {[
                                'Создание карт',
                                'Система сканирования',
                                'Аналитика',
                                'Маркетинговая рассылка',
                                'Поддержка',
                            ].map((feature, index) => (
                                <li
                                    key={index}
                                    className="flex items-center gap-3 text-sm"
                                    style={{ color: '#1D1D1F' }}
                                >
                                    <svg
                                        className="w-5 h-5 flex-shrink-0"
                                        fill="none"
                                        stroke="#34C759"
                                        strokeWidth={2}
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <a
                            href={getWhatsAppUrl('trial')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full py-4 px-6 rounded-xl text-center font-medium transition-all duration-200 hover:opacity-90"
                            style={{
                                background: '#D1E889',
                                color: '#1D1D1F',
                            }}
                        >
                            Попробовать бесплатно
                        </a>
                    </div>

                    {/* Full Plan Card */}
                    <div
                        className="bg-white rounded-3xl p-8 transition-all duration-300 hover:scale-[1.02] relative overflow-hidden"
                        style={{
                            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
                            border: '1px solid rgba(0, 0, 0, 0.04)',
                        }}
                    >
                        {/* Subtle gradient accent */}
                        <div
                            className="absolute top-0 right-0 w-32 h-32 opacity-30"
                            style={{
                                background: 'radial-gradient(circle at top right, #D1E889 0%, transparent 70%)',
                            }}
                        />

                        <div className="mb-6 relative">
                            <span
                                className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4"
                                style={{
                                    background: '#1D1D1F',
                                    color: '#FFFFFF',
                                }}
                            >
                                ПОЛНЫЙ ДОСТУП
                            </span>
                            <h2
                                className="text-2xl font-medium mb-2"
                                style={{ color: '#1D1D1F' }}
                            >
                                После пробного периода
                            </h2>
                            <div className="flex items-baseline gap-1">
                                <span
                                    className="text-3xl font-semibold"
                                    style={{ color: '#1D1D1F' }}
                                >
                                    {PRICING.MONTHLY_PRICE}
                                </span>
                                <span
                                    className="text-sm font-light"
                                    style={{ color: '#86868B' }}
                                >
                                    / мес
                                </span>
                            </div>
                        </div>

                        <ul className="space-y-3 mb-8">
                            {[
                                'Создание карт',
                                'Система сканирования',
                                'Аналитика',
                                'Маркетинговая рассылка',
                                'Поддержка',
                            ].map((feature, index) => (
                                <li
                                    key={index}
                                    className="flex items-center gap-3 text-sm"
                                    style={{ color: '#1D1D1F' }}
                                >
                                    <svg
                                        className="w-5 h-5 flex-shrink-0"
                                        fill="none"
                                        stroke="#34C759"
                                        strokeWidth={2}
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <a
                            href={getWhatsAppUrl('full')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full py-4 px-6 rounded-xl text-center font-medium transition-all duration-200 hover:opacity-90"
                            style={{
                                background: '#D1E889',
                                color: '#1D1D1F',
                            }}
                        >
                            Подключить
                        </a>
                    </div>
                </div>

                {/* Footer note */}
                <p
                    className="text-center text-sm mt-8 font-light"
                    style={{ color: '#86868B' }}
                >
                    Менеджер свяжется с вами в WhatsApp для активации
                </p>
            </div>
        </div>
    );
};

export default PricingGate;
