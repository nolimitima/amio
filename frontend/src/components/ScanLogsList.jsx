// src/components/ScanLogsList.jsx
import React from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';

const PAGE_SIZE = 20;

// Russian labels for action types
// Note: transactions table uses 'accrue' and 'redeem'
const ACTION_LABELS = {
  accrue: 'Начисление',
  redeem: 'Списание',
  // Legacy mappings for scan_logs table (if used)
  scan: 'Сканирование',
  add_bonus: 'Начисление',
};

export default function ScanLogsList() {
  const { currentUser } = useAuth();
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [page, setPage] = React.useState(1);
  const [exporting, setExporting] = React.useState(false);

  // фильтры
  const [actionFilter, setActionFilter] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  const load = React.useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from('scan_logs_business')
        .select(
          'id, scanned_at, action, amount, location, card_uuid, guest_name, template_name, owner_id'
        )
        .eq('owner_id', currentUser.id)  // SECURITY: Only show user's own scan logs
        .order('scanned_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (actionFilter) q = q.eq('action', actionFilter);
      if (dateFrom) q = q.gte('scanned_at', dateFrom);
      if (dateTo) q = q.lte('scanned_at', dateTo);
      if (search)
        q = q.or(
          `guest_name.ilike.%${search}%,card_uuid.ilike.%${search}%,template_name.ilike.%${search}%`
        );

      const { data, error } = await q;
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      setError(e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [currentUser, page, actionFilter, search, dateFrom, dateTo]);

  // CSV export — fetches ALL matching records (ignoring pagination)
  const handleExportCSV = React.useCallback(async () => {
    if (!currentUser) return;
    setExporting(true);
    try {
      let q = supabase
        .from('scan_logs_business')
        .select('scanned_at, guest_name, action, amount, card_uuid')
        .eq('owner_id', currentUser.id)
        .order('scanned_at', { ascending: false });

      if (actionFilter) q = q.eq('action', actionFilter);
      if (dateFrom) q = q.gte('scanned_at', dateFrom);
      if (dateTo) q = q.lte('scanned_at', dateTo);
      if (search)
        q = q.or(
          `guest_name.ilike.%${search}%,card_uuid.ilike.%${search}%,template_name.ilike.%${search}%`
        );

      const { data, error } = await q;
      if (error) throw error;

      const csvHeader = 'Дата,Гость,Действие,Сумма,UUID';
      const csvRows = (data || []).map((r) => {
        const date = new Date(r.scanned_at).toLocaleString();
        const guest = (r.guest_name || '').replace(/[,"]/g, ' ');
        const action = ACTION_LABELS[r.action] || r.action;
        const amount = r.amount ?? '';
        const uuid = r.card_uuid || '';
        return `"${date}","${guest}","${action}","${amount}","${uuid}"`;
      });

      // BOM for Excel to recognize UTF-8
      const bom = '\uFEFF';
      const csv = bom + csvHeader + '\n' + csvRows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scans_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || 'Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  }, [currentUser, actionFilter, search, dateFrom, dateTo]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-extralight text-neutral-900 mb-6">Сканы</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="bg-neutral-800 hover:bg-neutral-900 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-light transition-all duration-200 shadow-md flex items-center gap-2 text-sm"
          >
            {exporting ? '⏳ Экспорт…' : '📥 Скачать таблицу'}
          </button>
          <a href="/scanner" className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-light transition-all duration-200 shadow-md flex items-center gap-2">
            📷 Открыть Сканер
          </a>
        </div>
      </div>

      {/* Фильтры */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4">
        <input
          className="border border-gray-300 rounded px-2 py-1 text-sm md:col-span-2 text-gray-900 bg-white placeholder-gray-400"
          placeholder="Поиск: гость, UUID, карта"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">Все действия</option>
          <option value="accrue">Начисление</option>
          <option value="redeem">Списание</option>
        </select>
        <input
          type="date"
          className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <input
          type="date"
          className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
        <button
          className="border rounded px-3 py-1 text-sm text-neutral-900 hover:bg-gray-50"
          onClick={() => {
            setPage(1);
            load();
          }}
        >
          Применить
        </button>
        <button
          className="border rounded px-3 py-1 text-sm text-neutral-900 hover:bg-gray-50"
          onClick={() => {
            setActionFilter('');
            setSearch('');
            setDateFrom('');
            setDateTo('');
            setPage(1);
            load();
          }}
        >
          Сбросить
        </button>
      </div>

      <div className="overflow-auto rounded-xl border border-[#121E1D]/10">
        <table className="min-w-full text-sm bg-white">
          <thead className="text-left bg-gray-50 text-neutral-900 font-medium">
            <tr>
              <th className="py-2 px-3">Время</th>
              <th className="py-2 px-3">Карта</th>
              <th className="py-2 px-3">Гость</th>
              <th className="py-2 px-3">Действие</th>
              <th className="py-2 px-3">Сумма</th>
              <th className="py-2 px-3">Локация</th>
              <th className="py-2 px-3">UUID</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="py-4 px-3 text-neutral-700" colSpan={7}>
                  Загрузка…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="py-4 px-3 text-neutral-700" colSpan={7}>
                  Записей нет
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 text-neutral-900">
                  <td className="py-2 px-3 whitespace-nowrap">
                    {new Date(r.scanned_at).toLocaleString()}
                  </td>
                  <td className="py-2 px-3">{r.template_name}</td>
                  <td className="py-2 px-3">{r.guest_name}</td>
                  <td className="py-2 px-3">{ACTION_LABELS[r.action] || r.action}</td>
                  <td className="py-2 px-3">{r.amount ?? '-'}</td>
                  <td className="py-2 px-3">{r.location || '-'}</td>
                  <td className="py-2 px-3 font-mono text-xs">{r.card_uuid}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Пагинация */}
      <div className="flex justify-end items-center gap-2 mt-4">
        <button
          className="px-3 py-1 rounded bg-gray-100 disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Назад
        </button>
        <div className="text-sm text-neutral-700">Стр. {page}</div>
        <button
          className="px-3 py-1 rounded bg-gray-100"
          onClick={() => setPage((p) => p + 1)}
        >
          Вперёд
        </button>
      </div>

      {error && <div className="text-red-600 mt-3">{error}</div>}
    </div>
  );
}
