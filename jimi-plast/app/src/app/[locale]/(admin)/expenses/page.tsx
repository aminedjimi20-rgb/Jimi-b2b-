'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { openOrSharePdf, supportsPdfShare } from '@/lib/pdf-share';
import { SortSelect, type SortMode } from '@/components/sort-select';

interface ExpenseCategory {
  id: string;
  name: string;
}
interface HistoryEntry {
  id: string;
  action: string;
  field: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
  actor: { fullName: string } | null;
}
interface Expense {
  id: string;
  categoryId: string;
  category: ExpenseCategory;
  amount: string;
  date: string;
  notes: string | null;
  delivery: { driver: { fullName: string } | null } | null;
}
interface Situation {
  from: string;
  to: string;
  salesRevenue: number;
  salesCOGS: number;
  grossMargin: number;
  purchaseSpend: number;
  totalExpenses: number;
  expensesByCategory: { name: string; amount: number }[];
  totalDeliveryPayouts: number;
  netProfit: number;
  customerDebt: number;
  supplierDebt: number;
  customerCredit: number;
  supplierCredit: number;
  customerPaymentsReceived: number;
  manufacturerPaymentsPaid: number;
  remainingStockUnits: number;
  remainingStockValue: number;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function yearStartISO() {
  return new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
}

export default function ExpensesPage() {
  const t = useTranslations('expenses');
  const tc = useTranslations('common');
  const { token } = useAuth();

  const [tab, setTab] = useState<'frais' | 'situation'>('frais');

  // --- Frais ---
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ categoryId: '', amount: '', date: todayISO(), notes: '' });
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingPdf, setLoadingPdf] = useState(false);

  function reloadExpenses() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api.get<Expense[]>(`/expenses?${params.toString()}`, token).then(setExpenses);
    api.get<ExpenseCategory[]>('/expenses/categories', token).then(setCategories);
  }
  useEffect(() => {
    if (token) reloadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, from, to]);

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter((e) => `${e.category.name} ${e.notes ?? ''}`.toLowerCase().includes(q));
  }, [expenses, search]);

  const sortedExpenses = useMemo(() => {
    const arr = [...filteredExpenses];
    switch (sortMode) {
      case 'oldest':
        arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case 'price_desc':
        arr.sort((a, b) => Number(b.amount) - Number(a.amount));
        break;
      case 'price_asc':
        arr.sort((a, b) => Number(a.amount) - Number(b.amount));
        break;
      case 'name_asc':
        arr.sort((a, b) => a.category.name.localeCompare(b.category.name));
        break;
      case 'newest':
      default:
        arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return arr;
  }, [filteredExpenses, sortMode]);

  const totalShown = sortedExpenses.reduce((s, e) => s + Number(e.amount), 0);

  function openNew() {
    setEditingId(null);
    setForm({ categoryId: categories[0]?.id ?? '', amount: '', date: todayISO(), notes: '' });
    setShowForm(true);
  }
  function openEdit(e: Expense) {
    setEditingId(e.id);
    setForm({ categoryId: e.categoryId, amount: e.amount, date: e.date.slice(0, 10), notes: e.notes ?? '' });
    setShowForm(true);
  }
  async function submitExpense() {
    if (!form.categoryId || !form.amount) return;
    const payload = { categoryId: form.categoryId, amount: Number(form.amount), date: form.date, notes: form.notes || undefined };
    if (editingId) await api.put(`/expenses/${editingId}`, payload, token);
    else await api.post('/expenses', payload, token);
    setShowForm(false);
    reloadExpenses();
  }
  async function removeExpense(id: string) {
    if (!window.confirm(t('deleteConfirm'))) return;
    await api.delete(`/expenses/${id}`, token);
    reloadExpenses();
  }
  async function toggleHistory(id: string) {
    if (historyFor === id) {
      setHistoryFor(null);
      return;
    }
    setHistoryFor(id);
    const h = await api.get<HistoryEntry[]>(`/expenses/${id}/history`, token).catch(() => []);
    setHistory(h);
  }
  async function addCategory() {
    if (!newCategoryName.trim()) return;
    await api.post('/expenses/categories', { name: newCategoryName.trim() }, token);
    setNewCategoryName('');
    setShowCategoryForm(false);
    reloadExpenses();
  }
  async function removeCategory(id: string) {
    if (!window.confirm(t('deleteCategoryConfirm'))) return;
    await api.delete(`/expenses/categories/${id}`, token);
    reloadExpenses();
  }

  async function printExpenses() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const win = supportsPdfShare() ? null : window.open('', '_blank');
    setLoadingPdf(true);
    try {
      await openOrSharePdf(() => api.getBlob(`/expenses/pdf?${params.toString()}`, token), 'frais.pdf', win);
    } catch {
      win?.close();
    } finally {
      setLoadingPdf(false);
    }
  }

  // --- Situation ---
  const [sitFrom, setSitFrom] = useState(monthStartISO());
  const [sitTo, setSitTo] = useState(todayISO());
  const [situation, setSituation] = useState<Situation | null>(null);
  const [loadingSitPdf, setLoadingSitPdf] = useState(false);

  useEffect(() => {
    if (tab === 'situation' && token) {
      api.get<Situation>(`/stats/situation?from=${sitFrom}&to=${sitTo}`, token).then(setSituation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, token, sitFrom, sitTo]);

  async function printSituation() {
    const win = supportsPdfShare() ? null : window.open('', '_blank');
    setLoadingSitPdf(true);
    try {
      await openOrSharePdf(() => api.getBlob(`/stats/situation/pdf?from=${sitFrom}&to=${sitTo}`, token), 'situation.pdf', win);
    } catch {
      win?.close();
    } finally {
      setLoadingSitPdf(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <div className="flex overflow-hidden rounded border border-line text-sm">
          <button onClick={() => setTab('frais')} className={`px-3 py-1.5 ${tab === 'frais' ? 'bg-accent text-white' : 'bg-panel text-ink hover:bg-line/30'}`}>
            {t('tabFrais')}
          </button>
          <button onClick={() => setTab('situation')} className={`px-3 py-1.5 ${tab === 'situation' ? 'bg-accent text-white' : 'bg-panel text-ink hover:bg-line/30'}`}>
            {t('tabSituation')}
          </button>
        </div>
      </div>

      {tab === 'frais' && (
        <>
          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{t('categories')}</p>
              <button onClick={() => setShowCategoryForm((v) => !v)} className="rounded border border-line px-3 py-1 text-xs text-ink hover:bg-line/30">
                {t('newCategory')}
              </button>
            </div>
            {showCategoryForm && (
              <div className="mb-2 flex gap-2">
                <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder={t('categoryName')} className="rounded border border-line bg-paper px-3 py-1.5 text-sm text-ink" />
                <button onClick={addCategory} className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white">{t('save')}</button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <span key={c.id} className="flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-1 text-xs text-ink">
                  {c.name}
                  <button onClick={() => removeCategory(c.id)} className="text-red-500 hover:text-red-700">✕</button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={openNew} className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              {t('newExpense')}
            </button>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} className="max-w-xs rounded border border-line bg-panel px-3 py-2 text-sm" />
            <label className="flex items-center gap-1 text-xs text-muted">
              {t('from')}
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border border-line bg-panel px-2 py-1.5 text-sm text-ink" />
            </label>
            <label className="flex items-center gap-1 text-xs text-muted">
              {t('to')}
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border border-line bg-panel px-2 py-1.5 text-sm text-ink" />
            </label>
            <SortSelect value={sortMode} onChange={setSortMode} options={['newest', 'oldest', 'price_desc', 'price_asc', 'name_asc']} />
            <button onClick={printExpenses} disabled={loadingPdf} className="rounded border border-line px-3 py-2 text-sm text-ink hover:bg-line/30 disabled:opacity-50">
              {loadingPdf ? tc('loading') : t('print')}
            </button>
          </div>

          {showForm && (
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-accent/40 bg-accent/5 p-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('category')}</span>
                <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} className="rounded border border-line bg-paper px-3 py-2 text-ink">
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('amount')}</span>
                <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="rounded border border-line bg-paper px-3 py-2 text-ink" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('date')}</span>
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="rounded border border-line bg-paper px-3 py-2 text-ink" />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-muted">{t('notes')}</span>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="rounded border border-line bg-paper px-3 py-2 text-ink" />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button onClick={submitExpense} className="rounded bg-accent px-4 py-2 text-sm font-medium text-white">{t('save')}</button>
                <button onClick={() => setShowForm(false)} className="rounded border border-line px-4 py-2 text-sm text-ink">{t('cancel')}</button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-line bg-panel">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-line/30 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2 text-start">{t('columns.date')}</th>
                  <th className="px-4 py-2 text-start">{t('columns.category')}</th>
                  <th className="px-4 py-2 text-start">{t('columns.notes')}</th>
                  <th className="px-4 py-2 text-end">{t('columns.amount')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-sm text-muted">{tc('empty')}</td>
                  </tr>
                )}
                {sortedExpenses.map((e) => (
                  <Fragment key={e.id}>
                    <tr className="border-t border-line">
                      <td className="px-4 py-2 font-mono text-xs text-muted">{new Date(e.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-ink">{e.category.name}</td>
                      <td className="px-4 py-2 text-xs text-muted">{e.notes ?? '—'}</td>
                      <td className="px-4 py-2 text-end tabular text-ink">{Number(e.amount).toLocaleString()} DA</td>
                      <td className="px-4 py-2 text-end">
                        <div className="flex justify-end gap-2 text-xs">
                          <button onClick={() => toggleHistory(e.id)} className="text-muted hover:underline">{t('history')}</button>
                          <button onClick={() => openEdit(e)} className="text-accent hover:underline">{t('edit')}</button>
                          <button onClick={() => removeExpense(e.id)} className="text-red-600 hover:underline">{t('delete')}</button>
                        </div>
                      </td>
                    </tr>
                    {historyFor === e.id && (
                      <tr>
                        <td colSpan={5} className="bg-line/10 px-4 py-2">
                          <ul className="flex flex-col gap-1 text-xs">
                            {history.map((h) => (
                              <li key={h.id}>
                                <span className="text-muted">{new Date(h.createdAt).toLocaleString('fr-FR')}</span>{' — '}
                                <span className="font-medium text-ink">{h.actor?.fullName ?? t('system')}</span>{' : '}
                                <span className="text-ink">{h.reason ?? `${h.field ?? h.action} → ${h.newValue ?? ''}`}</span>
                              </li>
                            ))}
                            {history.length === 0 && <li className="text-muted">{tc('empty')}</li>}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              {sortedExpenses.length > 0 && (
                <tfoot>
                  <tr className="border-t border-line font-semibold">
                    <td colSpan={3} className="px-4 py-2 text-end text-ink">{t('total')}</td>
                    <td className="px-4 py-2 text-end tabular text-ink">{totalShown.toLocaleString()} DA</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {tab === 'situation' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => { setSitFrom(monthStartISO()); setSitTo(todayISO()); }} className="rounded border border-line px-3 py-1.5 text-sm text-ink hover:bg-line/30">
              {t('situation.thisMonth')}
            </button>
            <button onClick={() => { setSitFrom(yearStartISO()); setSitTo(todayISO()); }} className="rounded border border-line px-3 py-1.5 text-sm text-ink hover:bg-line/30">
              {t('situation.thisYear')}
            </button>
            <label className="flex items-center gap-1 text-xs text-muted">
              {t('from')}
              <input type="date" value={sitFrom} onChange={(e) => setSitFrom(e.target.value)} className="rounded border border-line bg-panel px-2 py-1.5 text-sm text-ink" />
            </label>
            <label className="flex items-center gap-1 text-xs text-muted">
              {t('to')}
              <input type="date" value={sitTo} onChange={(e) => setSitTo(e.target.value)} className="rounded border border-line bg-panel px-2 py-1.5 text-sm text-ink" />
            </label>
            <button onClick={printSituation} disabled={loadingSitPdf} className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {loadingSitPdf ? tc('loading') : t('situation.print')}
            </button>
          </div>

          {situation && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-panel p-4">
                <p className="mb-2 text-sm font-semibold text-accent">{t('situation.salesRevenue')}</p>
                <Row label={t('situation.salesRevenue')} value={situation.salesRevenue} />
                <Row label={t('situation.salesCOGS')} value={-situation.salesCOGS} />
                <Row label={t('situation.grossMargin')} value={situation.grossMargin} bold />
              </div>
              <div className="rounded-lg border border-line bg-panel p-4">
                <p className="mb-2 text-sm font-semibold text-accent">{t('situation.purchaseSpend')}</p>
                <Row label={t('situation.purchaseSpend')} value={situation.purchaseSpend} />
              </div>
              <div className="rounded-lg border border-line bg-panel p-4 sm:col-span-2">
                <p className="mb-2 text-sm font-semibold text-accent">{t('situation.expensesByCategory')}</p>
                {situation.expensesByCategory.map((c) => (
                  <Row key={c.name} label={c.name} value={c.amount} />
                ))}
                <Row label={t('situation.totalExpenses')} value={situation.totalExpenses} bold />
              </div>
              <div className="rounded-lg border border-line bg-panel p-4 sm:col-span-2">
                <p className="mb-2 text-sm font-semibold text-accent">{t('situation.deliveryPayouts')}</p>
                <Row label={t('situation.deliveryPayouts')} value={situation.totalDeliveryPayouts} bold />
                <p className="mt-1 text-[11px] text-muted">{t('situation.deliveryPayoutsHint')}</p>
              </div>
              <div className="rounded-lg border-2 border-accent bg-panel p-4 sm:col-span-2">
                <Row
                  label={t('situation.netProfit')}
                  value={situation.netProfit}
                  bold
                  colorClass={situation.netProfit >= 0 ? 'text-teal' : 'text-accent'}
                />
                <p className="mt-1 text-[11px] text-muted">{t('situation.netProfitHint')}</p>
              </div>
              <div className="rounded-lg border border-line bg-panel p-4 sm:col-span-2">
                <p className="mb-2 text-sm font-semibold text-accent">{t('situation.accounts')}</p>
                <Row label={t('situation.customerDebt')} value={situation.customerDebt} />
                <Row label={t('situation.supplierDebt')} value={situation.supplierDebt} />
                {situation.customerCredit > 0 && (
                  <Row label={t('situation.customerCredit')} value={-situation.customerCredit} colorClass="text-teal" />
                )}
                {situation.supplierCredit > 0 && (
                  <Row label={t('situation.supplierCredit')} value={-situation.supplierCredit} colorClass="text-teal" />
                )}
                <p className="mt-1 text-[11px] text-muted">{t('situation.accountsHint')}</p>
                <Row label={t('situation.customerPaymentsReceived')} value={situation.customerPaymentsReceived} />
                <Row label={t('situation.manufacturerPaymentsPaid')} value={situation.manufacturerPaymentsPaid} />
              </div>
              <div className="rounded-lg border border-line bg-panel p-4 sm:col-span-2">
                <p className="mb-2 text-sm font-semibold text-accent">{t('situation.remainingStock')}</p>
                <Row label={t('situation.remainingStockUnits')} value={situation.remainingStockUnits} unit={t('situation.pieces')} />
                <Row label={t('situation.remainingStockValue')} value={situation.remainingStockValue} />
                <p className="mt-1 text-[11px] text-muted">{t('situation.remainingStockHint')}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  colorClass,
  unit = 'DA',
}: {
  label: string;
  value: number;
  bold?: boolean;
  colorClass?: string;
  unit?: string;
}) {
  return (
    <div className={`flex justify-between py-1 ${bold ? 'font-semibold' : ''} ${colorClass ?? (bold ? 'text-ink' : 'text-muted')}`}>
      <span>{label}</span>
      <span className="tabular">
        {value.toLocaleString()} {unit}
      </span>
    </div>
  );
}
