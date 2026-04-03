import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { OWNER_PHONE_NUMBER } from '../config.js';

/**
 * PricingGate Component
 * Shown to users with 'pending' or 'expired' subscription status
 * Premium minimalist design
 */
const PricingGate = ({ isExpired = false }) => {
    const { currentUser } = useAuth();
    const userEmail = currentUser?.email || '';

    const getWhatsAppUrl = () => {
        const message = encodeURIComponent(`Здравствуйте! Мой email: ${userEmail}. Прошу активировать тариф.`);
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
            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1
                        className="text-3xl md:text-4xl font-bold tracking-tight mb-3"
                        style={{ color: '#1D1D1F' }}
                    >
                        Начните работу с платформой
                    </h1>
                    <p
                        className="text-lg font-normal max-w-md mx-auto"
                        style={{ color: '#86868B' }}
                    >
                        Протестируйте все инструменты для удержания клиентов.
                    </p>
                </div>

                {/* Unified Pricing Card */}
                <div
                    className="bg-white rounded-[2rem] p-8 md:p-10 transition-all duration-300 mx-auto relative overflow-hidden flex flex-col items-center text-center"
                    style={{
                        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04)',
                        border: '1px solid rgba(0, 0, 0, 0.04)',
                    }}
                >
                    {/* Badge */}
                    <span
                        className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold mb-6 uppercase tracking-wider"
                        style={{
                            background: '#1D1D1F',
                            color: '#FFFFFF',
                        }}
                    >
                        Единый тариф
                    </span>
                    
                    <h2
                        className="text-2xl font-bold mb-6"
                        style={{ color: '#1D1D1F' }}
                    >
                        Полный доступ
                    </h2>

                    <div className="mb-10 flex flex-col items-center">
                        <div className="flex items-baseline gap-2 mb-2">
                            <span
                                className="text-4xl md:text-5xl font-bold tracking-tight"
                                style={{ color: '#1D1D1F' }}
                            >
                                13 990 ₸
                            </span>
                            <span
                                className="text-lg font-normal"
                                style={{ color: '#86868B' }}
                            >
                                / мес
                            </span>
                        </div>
                        <span
                            className="text-sm font-medium"
                            style={{ color: '#86868B' }}
                        >
                            (Первые 14 дней — бесплатно)
                        </span>
                    </div>

                    <ul className="space-y-4 mb-10 w-full max-w-[280px] text-left mx-auto">
                        {[
                            'Создание электронных карт',
                            'Система сканирования',
                            'Аналитика клиентов',
                            'Маркетинговая рассылка',
                            'Техническая поддержка',
                        ].map((feature, index) => (
                            <li
                                key={index}
                                className="flex items-center gap-3 text-base font-medium"
                                style={{ color: '#1D1D1F' }}
                            >
                                <svg
                                    className="w-6 h-6 flex-shrink-0"
                                    fill="none"
                                    stroke="#8FD14F"
                                    strokeWidth={2.5}
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
                        href={getWhatsAppUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-4 px-6 rounded-xl text-center font-bold text-lg transition-all duration-200 hover:opacity-90"
                        style={{
                            background: '#D1E889',
                            color: '#1D1D1F',
                        }}
                    >
                        Попробовать 14 дней бесплатно
                    </a>
                </div>

                {/* Footer note */}
                <p
                    className="text-center text-sm md:text-base mt-8 font-normal"
                    style={{ color: '#86868B' }}
                >
                    Менеджер свяжется с вами в WhatsApp для активации
                </p>
            </div>
        </div>
    );
};

export default PricingGate;
