import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';

// Simple XSS sanitizer - escapes HTML entities
function sanitizeText(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const DashboardNotifications = () => {
    const { currentUser } = useAuth();

    // Form state
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [targetAudience, setTargetAudience] = useState('all');
    const [showOnCard, setShowOnCard] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    // History state
    const [campaigns, setCampaigns] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);

    // Textarea ref for auto-resize
    const textareaRef = useRef(null);

    // Fetch campaigns history
    const fetchCampaigns = async () => {
        setHistoryLoading(true);
        const { data, error } = await supabase
            .from('marketing_campaigns')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Error fetching campaigns:', error);
        } else {
            setCampaigns(data || []);
        }
        setHistoryLoading(false);
    };

    useEffect(() => {
        fetchCampaigns();
    }, []);

    // Auto-resize textarea
    const handleBodyChange = (e) => {
        setBody(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        // Client-side validation
        const trimmedTitle = title.trim();
        const trimmedBody = body.trim();

        if (!trimmedTitle) {
            setError('Заголовок обязателен');
            setLoading(false);
            return;
        }

        if (!trimmedBody) {
            setError('Текст сообщения обязателен');
            setLoading(false);
            return;
        }

        try {
            // Get current session for auth token
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                setError('Ошибка авторизации. Пожалуйста, войдите заново.');
                setLoading(false);
                return;
            }

            const response = await fetch('/api/notifications/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    title: trimmedTitle,
                    body: trimmedBody,
                    target_audience: targetAudience,
                    show_on_card: showOnCard
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Ошибка отправки');
            }

            // Success
            setMessage('Рассылка успешно отправлена!');
            setTitle('');
            setBody('');
            setTargetAudience('all');
            setShowOnCard(false);

            // Refresh history
            await fetchCampaigns();

        } catch (err) {
            console.error('Send error:', err);
            setError(err.message || 'Произошла ошибка');
        } finally {
            setLoading(false);
        }
    };

    // Handle removing promo from cards
    const handleRemovePromo = async (campaignId) => {
        if (!confirm('Удалить рассылку с карт клиентов?')) return;

        setDeletingId(campaignId);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                setError('Ошибка авторизации');
                return;
            }

            const response = await fetch('/api/notifications/remove', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ campaign_id: campaignId })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Ошибка удаления');
            }

            // Refresh history
            await fetchCampaigns();
            setMessage('Рассылка удалена с карт');

        } catch (err) {
            console.error('Remove error:', err);
            setError(err.message || 'Не удалось удалить');
        } finally {
            setDeletingId(null);
        }
    };

    // Format date for display
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="font-[Inter]">
            <h2 className="text-2xl font-extralight text-gray-900 mb-6">
                Рассылки
            </h2>

            {/* Main layout: Split on desktop, stacked on mobile */}
            <div className="flex flex-col lg:flex-row gap-8">

                {/* Left: Send Form */}
                <div className="flex-1 min-w-0">
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                            Новая рассылка
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Title Input */}
                            <div>
                                <label
                                    htmlFor="campaign-title"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    Заголовок
                                </label>
                                <input
                                    id="campaign-title"
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Введите заголовок уведомления"
                                    maxLength={100}
                                    className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl 
                             focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                             placeholder-gray-400 text-base transition-all"
                                />
                            </div>

                            {/* Message Body */}
                            <div>
                                <label
                                    htmlFor="campaign-body"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    Текст сообщения
                                </label>
                                <textarea
                                    id="campaign-body"
                                    ref={textareaRef}
                                    value={body}
                                    onChange={handleBodyChange}
                                    placeholder="Введите текст уведомления..."
                                    maxLength={500}
                                    rows={4}
                                    className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl 
                             focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                             placeholder-gray-400 text-base resize-none transition-all"
                                    style={{ minHeight: '120px' }}
                                />
                                <div className="text-xs text-gray-500 mt-1 text-right">
                                    {body.length}/500
                                </div>
                            </div>

                            {/* Target Selector */}
                            <div>
                                <label
                                    htmlFor="campaign-target"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    Получатели
                                </label>
                                <select
                                    id="campaign-target"
                                    value={targetAudience}
                                    onChange={(e) => setTargetAudience(e.target.value)}
                                    className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl 
                             focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                             text-base cursor-pointer transition-all appearance-none
                             bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')]
                             bg-no-repeat bg-[right_1rem_center] bg-[length:1.25rem]"
                                >
                                    <option value="all">Все клиенты</option>
                                    <option value="test">Тестовая группа</option>
                                </select>
                            </div>

                            {/* Show on Card Toggle */}
                            <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl">
                                <div className="flex-1 min-w-0 mr-4">
                                    <div className="text-sm font-medium text-gray-900">
                                        Показать на карте
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                        Добавить акцию в бонусную карту клиента
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowOnCard(!showOnCard)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full 
                              border-2 border-transparent transition-colors duration-200 ease-in-out 
                              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                              ${showOnCard ? 'bg-blue-600' : 'bg-gray-200'}`}
                                    role="switch"
                                    aria-checked={showOnCard}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full 
                                bg-white shadow ring-0 transition duration-200 ease-in-out
                                ${showOnCard ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>

                            {/* Error/Success Messages */}
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                    {error}
                                </div>
                            )}
                            {message && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                                    {message}
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-medium 
                           rounded-xl transition-all duration-200 flex items-center justify-center gap-3
                           disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30"
                            >
                                {loading ? (
                                    <span>Отправка...</span>
                                ) : (
                                    <>
                                        {/* Paper Plane Icon */}
                                        <svg
                                            className="w-5 h-5"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                            />
                                        </svg>
                                        <span>Отправить рассылку</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right: History List */}
                <div className="flex-1 min-w-0">
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                            История рассылок
                        </h3>

                        {historyLoading ? (
                            <div className="text-center py-8 text-gray-500">
                                Загрузка...
                            </div>
                        ) : campaigns.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-4xl mb-3">📬</div>
                                <p className="text-gray-500">
                                    Вы ещё не отправляли рассылок
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                {campaigns.map((campaign) => (
                                    <div
                                        key={campaign.id}
                                        className="bg-white rounded-xl p-4 border border-gray-200 
                               hover:border-gray-300 transition-all"
                                    >
                                        {/* Date */}
                                        <div className="text-xs text-gray-500 mb-1">
                                            {formatDate(campaign.created_at)}
                                        </div>

                                        {/* Title */}
                                        <div className="font-medium text-gray-900 mb-2">
                                            {sanitizeText(campaign.title)}
                                        </div>

                                        {/* Body preview */}
                                        <div className="text-sm text-gray-600 line-clamp-2 mb-3">
                                            {sanitizeText(campaign.body)}
                                        </div>

                                        {/* Footer: Status + Target + Actions */}
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                            <div className="flex items-center gap-2">
                                                {/* Status Badge */}
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${campaign.status === 'sent'
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-gray-100 text-gray-600'
                                                        }`}
                                                >
                                                    {campaign.status === 'sent' ? 'Отправлено' : 'Черновик'}
                                                </span>

                                                {/* Target Badge */}
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                    {campaign.target_audience === 'all' ? 'Все' : 'Тест'}
                                                </span>

                                                {/* On Card Badge */}
                                                {campaign.show_on_card && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                                                        На карте
                                                    </span>
                                                )}
                                            </div>

                                            {/* Remove from Card Button */}
                                            {campaign.show_on_card && (
                                                <button
                                                    onClick={() => handleRemovePromo(campaign.id)}
                                                    disabled={deletingId === campaign.id}
                                                    className="text-xs text-red-600 hover:text-red-800 font-medium 
                                     disabled:opacity-50 disabled:cursor-not-allowed
                                     flex items-center gap-1 transition-colors"
                                                >
                                                    {deletingId === campaign.id ? (
                                                        'Удаление...'
                                                    ) : (
                                                        <>
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                            Убрать с карт
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardNotifications;
