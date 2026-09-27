'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ImageUploadButton } from '@/components/image-upload-button';
import { ImageLightbox } from '@/components/image-lightbox';
import { DayGroupRow, DayGroupToggleAll } from '@/components/day-group-row';
import { dayGroupLabel, groupByDay, useExpandedGroups } from '@/lib/date-groups';

interface Remark {
  id: string;
  text: string;
  createdAt: string;
  voidedAt: string | null;
}
interface RequestRow {
  id: string;
  productName: string;
  description: string | null;
  photoUrl: string | null;
  quantityWanted: number | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  requestedBy: {
    id: string;
    fullName: string;
    phone: string | null;
    role: { key: string; name: string };
    customer: { id: string; businessName: string | null } | null;
  };
  remarks: Remark[];
}

const STATUSES = ['NEW', 'SEARCHING', 'FOUND', 'ORDERED', 'AVAILABLE', 'REFUSED'];
const EMPTY_FORM = { productName: '', description: '', quantityWanted: '', photoUrl: '' };

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-line/40 text-muted',
  SEARCHING: 'bg-accent/15 text-accent',
  FOUND: 'bg-teal/15 text-teal',
  ORDERED: 'bg-teal/15 text-teal',
  AVAILABLE: 'bg-teal/20 text-teal',
  REFUSED: 'bg-red-100 text-red-600',
};

export default function ProductRequestsPage() {
  const { hasPermission } = useAuth();
  return hasPermission('requests.manage') ? <AdminProductRequestsView /> : <CustomerProductRequestsView />;
}

function AdminProductRequestsView() {
  const t = useTranslations('productRequests');
  const tc = useTranslations('common');
  const { token } = useAuth();
  const { locale } = useParams<{ locale: string }>();

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [remarkDraft, setRemarkDraft] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  function reload() {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const qs = params.toString();
    api.get<RequestRow[]>(`/product-requests${qs ? `?${qs}` : ''}`, token).then(setRequests);
  }
  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) => {
      const clientName = r.requestedBy.customer?.businessName || r.requestedBy.fullName;
      return `${r.productName} ${r.description ?? ''} ${clientName}`.toLowerCase().includes(q);
    });
  }, [requests, search]);

  const dayGroups = useMemo(() => groupByDay(filtered, (r) => r.createdAt), [filtered]);
  const { isExpanded, toggle, allExpanded, expandAll, collapseAll } = useExpandedGroups(dayGroups);

  async function updateStatus(id: string, status: string) {
    await api.put(`/product-requests/${id}/status`, { status }, token);
    reload();
  }

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }
  function openEdit(r: RequestRow) {
    setEditingId(r.id);
    setForm({
      productName: r.productName,
      description: r.description ?? '',
      quantityWanted: r.quantityWanted ? String(r.quantityWanted) : '',
      photoUrl: r.photoUrl ?? '',
    });
    setShowForm(true);
  }
  async function submitForm() {
    if (!form.productName.trim()) return;
    const payload = {
      productName: form.productName.trim(),
      description: form.description.trim() || undefined,
      photoUrl: form.photoUrl || undefined,
      quantityWanted: form.quantityWanted ? Number(form.quantityWanted) : undefined,
    };
    if (editingId) await api.put(`/product-requests/${editingId}`, payload, token);
    else await api.post('/product-requests', payload, token);
    setShowForm(false);
    reload();
  }

  // Comme pour les autres entités sans impact stock/compte (produits,
  // fabricants…) : suppression douce via la corbeille, jamais un DELETE SQL
  // direct — restaurable depuis la page Corbeille.
  async function removeRequest(id: string) {
    const reason = window.prompt(t('deleteReasonPrompt'));
    if (reason === null) return;
    await api.delete(`/product-requests/${id}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, token);
    reload();
  }

  function toggleExpand(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
    setRemarkDraft('');
  }

  async function addRemark(id: string) {
    if (!remarkDraft.trim()) return;
    await api.post(`/product-requests/${id}/remarks`, { text: remarkDraft }, token);
    setRemarkDraft('');
    reload();
  }
  async function toggleRemarkVoided(remark: Remark) {
    await api.put(`/product-requests/remarks/${remark.id}/void`, { voided: !remark.voidedAt }, token);
    reload();
  }

  function renderRow(r: RequestRow) {
    const clientName = r.requestedBy.customer?.businessName || r.requestedBy.fullName;
    const isStaffOnly = !r.requestedBy.customer;
    return (
      <Fragment key={r.id}>
        <tr className="cursor-pointer border-t border-line hover:bg-line/10" onClick={() => toggleExpand(r.id)}>
          <td className="px-4 py-2 font-mono text-xs text-muted">{new Date(r.createdAt).toLocaleDateString(locale)}</td>
          <td className="px-4 py-2 font-medium text-ink">{r.productName}</td>
          <td className="px-4 py-2 text-muted">
            {clientName}
            <span className={`ms-2 rounded-full px-2 py-0.5 text-[10px] ${isStaffOnly ? 'bg-line/40 text-ink' : 'bg-accent/10 text-accent'}`}>
              {isStaffOnly ? t('employeeBadge') : r.requestedBy.role.name}
            </span>
          </td>
          <td className="px-4 py-2 tabular">{r.quantityWanted ?? '—'}</td>
          <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
            <select
              value={r.status}
              onChange={(e) => updateStatus(r.id, e.target.value)}
              className="rounded border border-line bg-paper px-2 py-1 text-xs"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}` as never)}
                </option>
              ))}
            </select>
          </td>
          <td className="px-2 py-2 text-end" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end gap-2 text-xs">
              <button onClick={() => openEdit(r)} className="text-accent hover:underline">
                {t('edit')}
              </button>
              <button onClick={() => removeRequest(r.id)} className="text-red-600 hover:underline">
                {t('delete')}
              </button>
            </div>
          </td>
        </tr>
        {expandedId === r.id && (
          <tr>
            <td colSpan={6} className="border-t border-line bg-line/10 px-4 py-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                <div className="flex-1">
                  {r.description && <p className="mb-2 text-sm text-ink">{r.description}</p>}
                  {r.photoUrl && (
                    <button onClick={() => setLightboxUrl(r.photoUrl)} className="mb-2 block">
                      <img src={r.photoUrl} alt={r.productName} className="h-20 w-20 rounded border border-line object-cover" />
                    </button>
                  )}
                  <p className="text-xs text-muted">{r.requestedBy.phone}</p>
                </div>
                <div className="flex-1">
                  <p className="mb-2 text-sm font-semibold text-ink">{t('generalNote')}</p>
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={remarkDraft}
                      onChange={(e) => setRemarkDraft(e.target.value)}
                      placeholder={t('generalNotePlaceholder')}
                      rows={2}
                      className="rounded border border-line bg-paper px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => addRemark(r.id)}
                      disabled={!remarkDraft.trim()}
                      className="w-fit rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      OK
                    </button>
                  </div>
                  {r.remarks.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
                      {r.remarks.map((rem) => (
                        <li key={rem.id} className="flex items-start justify-between gap-2 text-sm">
                          <span className={rem.voidedAt ? 'text-muted line-through' : 'text-ink'}>
                            <span className="font-mono text-xs text-muted">{new Date(rem.createdAt).toLocaleString(locale)}</span> —{' '}
                            {rem.text}
                          </span>
                          <button onClick={() => toggleRemarkVoided(rem)} className="shrink-0 text-xs text-accent hover:underline">
                            {rem.voidedAt ? t('restoreRemark') : t('strikeRemark')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <button onClick={openNew} className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          {t('new')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          className="max-w-xs rounded border border-line bg-panel px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-line bg-panel px-3 py-2 text-sm"
        >
          <option value="">{t('filterStatus')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}` as never)}
            </option>
          ))}
        </select>
        {dayGroups.length > 0 && (
          <DayGroupToggleAll
            allExpanded={allExpanded}
            onExpandAll={expandAll}
            onCollapseAll={collapseAll}
            expandLabel={tc('expandAll')}
            collapseLabel={tc('collapseAll')}
          />
        )}
      </div>

      {showForm && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-accent/40 bg-accent/5 p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{t('form.productName')}</span>
            <input
              value={form.productName}
              onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
              className="rounded border border-line bg-paper px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{t('form.quantityWanted')}</span>
            <input
              type="number"
              min="1"
              value={form.quantityWanted}
              onChange={(e) => setForm((f) => ({ ...f, quantityWanted: e.target.value }))}
              className="rounded border border-line bg-paper px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted">{t('form.description')}</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="rounded border border-line bg-paper px-3 py-2 text-ink"
            />
          </label>
          <div className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted">{t('form.photoUrl')}</span>
            <div className="flex items-center gap-3">
              {form.photoUrl && <img src={form.photoUrl} alt="" className="h-12 w-12 rounded border border-line object-cover" />}
              <ImageUploadButton folder="product-requests" label={t('form.photoUrl')} onUploaded={(url) => setForm((f) => ({ ...f, photoUrl: url }))} />
            </div>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button onClick={submitForm} className="rounded bg-accent px-4 py-2 text-sm font-medium text-white">
              {t('save')}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded border border-line px-4 py-2 text-sm text-ink">
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('columns.date')}</th>
              <th className="px-4 py-2 text-start">{t('columns.product')}</th>
              <th className="px-4 py-2 text-start">{t('columns.customer')}</th>
              <th className="px-4 py-2 text-start">{t('columns.quantity')}</th>
              <th className="px-4 py-2 text-start">{t('columns.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-sm text-muted">
                  {tc('empty')}
                </td>
              </tr>
            )}
            {dayGroups.map((group, idx) => (
              <Fragment key={group.key}>
                <DayGroupRow
                  label={dayGroupLabel(group.date, locale, tc('today'), tc('yesterday'))}
                  count={group.rows.length}
                  colSpan={6}
                  expanded={isExpanded(idx)}
                  onToggle={() => toggle(idx)}
                />
                {isExpanded(idx) && group.rows.map((r) => renderRow(r))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {lightboxUrl && <ImageLightbox images={[{ url: lightboxUrl }]} onClose={() => setLightboxUrl(null)} />}
    </div>
  );
}

interface MineRow {
  id: string;
  productName: string;
  description: string | null;
  photoUrl: string | null;
  quantityWanted: number | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

// Vue client : pas de gestion (pas de statut modifiable, pas de suppression,
// pas de journal de remarques internes — réservé au personnel) — juste
// déposer une nouvelle demande et suivre l'avancement des siennes.
function CustomerProductRequestsView() {
  const t = useTranslations('productRequests');
  const tc = useTranslations('common');
  const { token } = useAuth();
  const { locale } = useParams<{ locale: string }>();

  const [requests, setRequests] = useState<MineRow[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);

  function reload() {
    api.get<MineRow[]>('/product-requests/mine', token).then(setRequests);
  }
  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.productName.trim()) return;
    setSending(true);
    try {
      await api.post(
        '/product-requests',
        {
          productName: form.productName.trim(),
          description: form.description.trim() || undefined,
          photoUrl: form.photoUrl || undefined,
          quantityWanted: form.quantityWanted ? Number(form.quantityWanted) : undefined,
        },
        token,
      );
      setForm(EMPTY_FORM);
      reload();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <p className="text-sm text-muted">{t('customerSubtitle')}</p>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-panel p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{t('form.productName')}</span>
          <input
            required
            value={form.productName}
            onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
            className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{t('form.quantityWanted')}</span>
          <input
            type="number"
            min="1"
            value={form.quantityWanted}
            onChange={(e) => setForm((f) => ({ ...f, quantityWanted: e.target.value }))}
            className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted">{t('form.description')}</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted">{t('form.photoUrl')}</span>
          <div className="flex items-center gap-3">
            {form.photoUrl && <img src={form.photoUrl} alt="" className="h-12 w-12 rounded border border-line object-cover" />}
            <ImageUploadButton folder="product-requests" label={t('form.photoUrl')} onUploaded={(url) => setForm((f) => ({ ...f, photoUrl: url }))} />
          </div>
        </div>
        <button
          type="submit"
          disabled={sending || !form.productName.trim()}
          className="self-start rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:col-span-2"
        >
          {t('send')}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">{t('mine')}</h2>
        {requests.length === 0 && <p className="text-sm text-muted">{tc('empty')}</p>}
        {requests.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">
                {r.productName}
                {r.quantityWanted ? ` × ${r.quantityWanted}` : ''}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString(locale)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[r.status] ?? ''}`}>
                  {t(`status.${r.status}` as never)}
                </span>
              </div>
            </div>
            {r.description && <p className="text-sm text-ink">{r.description}</p>}
            {r.photoUrl && <img src={r.photoUrl} alt={r.productName} className="h-16 w-16 rounded border border-line object-cover" />}
            {r.adminNote && <div className="rounded border-s-2 border-accent bg-accent/5 px-3 py-2 text-sm text-ink">{r.adminNote}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
