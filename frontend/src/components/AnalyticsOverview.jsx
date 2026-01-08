// src/components/AnalyticsOverview.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnalyticsOverview() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchStats() {
            try {
                setLoading(true);
                setError(null);

                // Get current session token
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) {
                    throw new Error('Не авторизован');
                }

                const response = await fetch('/api/analytics/stats', {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Ошибка загрузки');
                }

                const data = await response.json();
                setStats(data);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, []);

    // Format date for chart (e.g., "02 янв")
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const day = date.getDate().toString().padStart(2, '0');
        const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
        return `${day} ${months[date.getMonth()]}`;
    };

    // Format large numbers (e.g., 1500 -> "1.5K")
    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return num.toString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="text-neutral-500 text-lg font-light">Загрузка аналитики...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <div className="text-red-600 font-medium mb-2">Ошибка загрузки</div>
                <div className="text-red-500 text-sm">{error}</div>
            </div>
        );
    }

    const chartData = stats?.recentActivity?.map(item => ({
        ...item,
        dateFormatted: formatDate(item.date)
    })) || [];

    return (
        <div>
            <h2 className="text-2xl font-extralight text-neutral-900 mb-6">Обзор</h2>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Total Users */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-100">
                    <div className="text-3xl font-light text-neutral-900 mb-1">
                        {formatNumber(stats?.totalUsers || 0)}
                    </div>
                    <div className="text-sm text-neutral-500 font-light">Клиентов</div>
                </div>

                {/* Total Scans */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-100">
                    <div className="text-3xl font-light text-neutral-900 mb-1">
                        {formatNumber(stats?.totalScans || 0)}
                    </div>
                    <div className="text-sm text-neutral-500 font-light">Сканирований</div>
                </div>

                {/* Points Liability */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-100">
                    <div className="text-3xl font-light text-neutral-900 mb-1">
                        {formatNumber(stats?.pointsLiability || 0)}
                    </div>
                    <div className="text-sm text-neutral-500 font-light">Баллов выдано</div>
                </div>

                {/* Total Redeemed */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-100">
                    <div className="text-3xl font-light text-neutral-900 mb-1">
                        {formatNumber(stats?.totalRedeemed || 0)}
                    </div>
                    <div className="text-sm text-neutral-500 font-light">Списано баллов</div>
                </div>
            </div>

            {/* Activity Chart */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-100">
                <h3 className="text-lg font-light text-neutral-900 mb-4">Активность за 7 дней</h3>

                {chartData.length > 0 ? (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#D1E889" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#D1E889" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="dateFormatted"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#737373', fontSize: 12 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#737373', fontSize: 12 }}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        border: '1px solid #e5e5e5',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                    }}
                                    labelStyle={{ color: '#171717', fontWeight: 500 }}
                                    formatter={(value) => [value, 'Транзакций']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#A8C84A"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorCount)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-64 flex items-center justify-center text-neutral-400">
                        Нет данных за последние 7 дней
                    </div>
                )}
            </div>
        </div>
    );
}
