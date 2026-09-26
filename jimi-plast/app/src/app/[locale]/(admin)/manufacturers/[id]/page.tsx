'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { openOrSharePdf, supportsPdfShare } from '@/lib/pdf-share';

interface PendingDeletion {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  requestedBy: { fullName: string } | null;
}
interface LedgerEntry {
  id: string;
  type: 'PURCHASE_VOUCHER' | 'PAYMENT' | 'ADJUSTMENT';
  amount: string;
  note: string | null;
  reference: string | null;
  createdAt: string;
  voidedAt: string | null;
  pendingDeletions: PendingDeletion[];
}
interface ManufacturerDetail {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  wilaya: string | null;
  contactName: string | null;
  paymentTerms: string | null;
  notes: string | null;
  notesHidden: boolean;
  balance: number;
  userId: string | null;
  canViewCatalog: boolean;
  user: { id: string; email: string | null; phone: string | null } | null;
  entries: LedgerEntry[];
  pendingDeletions: PendingDeletion[];
}

const FIELDS = ['name', 'company', 'phone', 'whatsapp', 'email', 'address', 'wilaya', 'contactName', 'paymentTerms', 'notes'] as const;

export default function ManufacturerDetailPage() {
  const t = useTranslations('manufacturers');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();

  const [manufacturer, setManufacturer] = useState<ManufacturerDetail | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [canViewCatalog, setCanViewCatalog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [statementFrom, setStatementFrom] = useState('');
  const [statementTo, setStatementTo] = useState('');
  const [printingStatement, setPrintingStatement] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [periodSummary, setPeriodSummary] = useState<{ totalBusiness: number; totalPaid: number } | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  function reload() {
    api.get<ManufacturerDetail>(`/manufacturers/${id}`, token).then((m) => {
      setManufacturer(m);
      setNoteDraft(m.notes ?? '');
    });
  }

  async function saveNote() {
    await api.put(`/manufacturers/${id}/note`, { note: noteDraft }, token);
    reload();
  }

  async function toggleNoteHidden() {
    if (!manufacturer) return;
    await api.put(`/manufacturers/${id}/note`, { hidden: !manufacturer.notesHidden }, token);
    reload();
  }

  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  // Chiffres "sur la période" (achats + payé), recalculés à chaque
  // changement des dates Du/Au partagées avec l'impression de situation.
  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams();
    if (statementFrom) params.set('from', statementFrom);
    if (statementTo) params.set('to', statementTo);
    const qs = params.toString();
    api
      .get<{ totalBusiness: number; totalPaid: number }>(`/manufacturers/${id}/period-summary${qs ? `?${qs}` : ''}`, token)
      .then(setPeriodSummary)
      .catch(() => setPeriodSummary(null));
  }, [token, id, statementFrom, statementTo]);

  function startEdit() {
    if (!manufacturer) return;
    setForm({
      name: manufacturer.name ?? '',
      company: manufacturer.company ?? '',
      phone: manufacturer.phone ?? '',
      whatsapp: manufacturer.whatsapp ?? '',
      email: manufacturer.email ?? '',
      address: manufacturer.address ?? '',
      wilaya: manufacturer.wilaya ?? '',
      contactName: manufacturer.contactName ?? '',
      paymentTerms: manufacturer.paymentTerms ?? '',
      notes: manufacturer.notes ?? '',
    });
    setCanViewCatalog(manufacturer.canViewCatalog);
    setEditMode(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.put(`/manufacturers/${id}`, { ...form, canViewCatalog }, token);
      setEditMode(false);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon('error'));
    }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/manufacturers/${id}/payments`, { amount: Number(paymentAmount) }, token);
    setPaymentAmount('');
    reload();
  }

  async function submitAdjustment(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/manufacturers/${id}/adjustments`, { amount: Number(adjustAmount), reason: adjustReason }, token);
    setAdjustAmount('');
    setAdjustReason('');
    reload();
  }

  // Comme pour les clients : la suppression n'efface jamais rien tout de
  // suite — elle attend l'approbation de l'autre partie (le fabricant, si
  // son compte existe), et la ligne visée reste affichée (barrée) pour de bon.
  async function requestEntryDeletion(entryId: string) {
    const reason = window.prompt(t('deleteReasonPrompt'));
    if (!reason) return;
    try {
      await api.post(`/manufacturers/entries/${entryId}/request-deletion`, { reason }, token);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon('error'));
    }
  }

  async function requestManufacturerDeletion() {
    if (!manufacturer) return;
    const reason = window.prompt(t('deleteReasonPrompt'));
    if (!reason) return;
    try {
      await api.post(`/manufacturers/${id}/request-deletion`, { reason }, token);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon('error'));
    }
  }

  async function printStatement() {
    // Sur mobile (partage de fichier supporté), pas d'onglet — la feuille de
    // partage native s'occupe de tout, PDF réel en pièce jointe. Sur
    // desktop, onglet vide synchrone dans le gestionnaire de clic (sinon
    // les bloqueurs de popups l'empêchent une fois passé le premier await).
    const win = supportsPdfShare() ? null : window.open('', '_blank');
    setPrintingStatement(true);
    try {
      const params = new URLSearchParams();
      if (statementFrom) params.set('from', statementFrom);
      if (statementTo) params.set('to', statementTo);
      const qs = params.toString();
      await openOrSharePdf(
        () => api.getBlob(`/manufacturers/${id}/statement/pdf${qs ? `?${qs}` : ''}`, token),
        `situation-${manufacturer?.name ?? id}.pdf`,
        win,
      );
    } catch {
      win?.close();
    } finally {
      setPrintingStatement(false);
    }
  }

  // Même logique que côté client : on repart du solde actuel et on le
  // "défait" mouvement par mouvement pour afficher le solde après chacun.
  const entriesWithBalance = useMemo(() => {
    if (!manufacturer) return [];
    let running = manufacturer.balance;
    return manufacturer.entries.map((e) => {
      const balanceAfter = running;
      if (!e.voidedAt) running -= Number(e.amount);
      return { ...e, balanceAfter };
    });
  }, [manufacturer]);

  const filteredEntries = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return entriesWithBalance;
    return entriesWithBalance.filter((e) => {
      const haystack = [t(`entryTypes.${e.type}`), e.note ?? '', e.reference ?? '', new Date(e.createdAt).toLocaleString(), String(e.amount)]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [entriesWithBalance, historySearch, t]);

  if (!manufacturer) return <p className="text-muted">{tCommon('loading')}</p>;

  const deletion = manufacturer.pendingDeletions[0];
  const isPending = deletion?.status === 'PENDING';

  return (
    <div className="flex flex-col gap-6">
      <button onClick={() => router.push(`/${locale}/manufacturers`)} className="w-fit text-sm text-accent hover:underline">
        ← {t('detail.back')}
      </button>

      {isPending && (
        <p className="rounded border border-amber-300 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
          {t('pendingDeletion')} : {deletion.reason}
        </p>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{manufacturer.name}</h1>
          <p className="text-sm text-muted">
            {manufacturer.company} — {manufacturer.wilaya}
          </p>
          <p className="text-xs text-muted">
            {manufacturer.phone} · {manufacturer.email}
          </p>
          {manufacturer.userId ? (
            <p className="mt-1 text-xs text-teal">
              {t('hasAccount')} ({manufacturer.user?.email ?? manufacturer.user?.phone})
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">{t('noAccount')}</p>
          )}
          {manufacturer.userId && (
            <p className={`mt-0.5 text-xs ${manufacturer.canViewCatalog ? 'text-teal' : 'text-muted'}`}>
              {manufacturer.canViewCatalog ? t('canViewCatalogOn') : t('canViewCatalogOff')}
            </p>
          )}
        </div>
        {!editMode && !isPending && (
          <div className="flex gap-2">
            <button onClick={startEdit} className="rounded border border-line px-3 py-1.5 text-sm text-accent hover:underline">
              {tCommon('edit')}
            </button>
            <button onClick={requestManufacturerDeletion} className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
              {tCommon('delete')}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {editMode && (
        <form onSubmit={saveEdit} className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-panel p-4 sm:grid-cols-3">
          {FIELDS.map((f) => (
            <label key={f} className={`flex flex-col gap-1 text-sm ${f === 'notes' ? 'sm:col-span-3' : ''}`}>
              <span className="text-muted">{t(`form.${f}`)}</span>
              {f === 'notes' ? (
                <textarea
                  value={form[f] ?? ''}
                  onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                  rows={3}
                  className="rounded border border-line bg-paper px-3 py-2"
                />
              ) : (
                <input
                  value={form[f] ?? ''}
                  onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                  className="rounded border border-line bg-paper px-3 py-2"
                />
              )}
            </label>
          ))}
          {manufacturer.userId && (
            <label className="flex items-center gap-2 text-sm sm:col-span-3">
              <input type="checkbox" checked={canViewCatalog} onChange={(e) => setCanViewCatalog(e.target.checked)} />
              <span className="text-ink">{t('form.canViewCatalog')}</span>
            </label>
          )}
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" className="flex-1 rounded bg-accent px-3 py-2 text-sm font-medium text-white">
              {tCommon('save')}
            </button>
            <button type="button" onClick={() => setEditMode(false)} className="rounded border border-line px-3 py-2 text-sm">
              {tCommon('cancel')}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-line bg-panel p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">{t('detail.generalNote')}</p>
          <button onClick={toggleNoteHidden} className="text-xs text-accent hover:underline">
            {manufacturer.notesHidden ? t('detail.showNote') : t('detail.hideNote')}
          </button>
        </div>
        {!manufacturer.notesHidden && (
          <div className="flex flex-col gap-2">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder={t('detail.generalNotePlaceholder')}
              rows={2}
              className="rounded border border-line bg-paper px-3 py-2 text-sm"
            />
            <button onClick={saveNote} className="w-fit rounded bg-accent px-3 py-1.5 text-sm font-medium text-white">
              OK
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-line bg-panel p-5 w-fit">
        <p className="text-xs uppercase tracking-wide text-muted">{t('detail.balance')}</p>
        <p className={`mt-1 font-mono text-3xl font-semibold tabular ${manufacturer.balance > 0 ? 'text-accent' : 'text-teal'}`}>
          {manufacturer.balance.toLocaleString()} DA
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form onSubmit={submitPayment} className="rounded-lg border border-line bg-panel p-4">
          <h3 className="text-sm font-semibold text-ink">{t('detail.addPayment')}</h3>
          <div className="mt-3 flex flex-col gap-2">
            <input
              type="number"
              required
              placeholder={t('detail.amount')}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="rounded border border-line bg-paper px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded bg-teal px-3 py-2 text-sm font-medium text-white">
              {tCommon('save')}
            </button>
          </div>
        </form>

        <form onSubmit={submitAdjustment} className="rounded-lg border border-line bg-panel p-4">
          <h3 className="text-sm font-semibold text-ink">{t('detail.addAdjustment')}</h3>
          <div className="mt-3 flex flex-col gap-2">
            <input
              type="number"
              required
              placeholder={t('detail.amount')}
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              className="rounded border border-line bg-paper px-3 py-2 text-sm"
            />
            <input
              required
              placeholder={t('detail.reason')}
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              className="rounded border border-line bg-paper px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded bg-accent px-3 py-2 text-sm font-medium text-white">
              {tCommon('save')}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-line bg-panel p-4">
        <h3 className="text-sm font-semibold text-ink">{t('detail.statementTitle')}</h3>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t('detail.statementFrom')}
            <input
              type="date"
              value={statementFrom}
              onChange={(e) => setStatementFrom(e.target.value)}
              className="rounded border border-line bg-paper px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t('detail.statementTo')}
            <input
              type="date"
              value={statementTo}
              onChange={(e) => setStatementTo(e.target.value)}
              className="rounded border border-line bg-paper px-3 py-2 text-sm"
            />
          </label>
          <button
            onClick={printStatement}
            disabled={printingStatement}
            className="rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {t('detail.print')}
          </button>
        </div>
        {periodSummary && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded border border-line bg-paper p-3">
              <p className="text-xs uppercase tracking-wide text-muted">{t('detail.periodBusiness')}</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular text-ink">{periodSummary.totalBusiness.toLocaleString()} DA</p>
            </div>
            <div className="rounded border border-line bg-paper p-3">
              <p className="text-xs uppercase tracking-wide text-muted">{t('detail.periodPaid')}</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular text-teal">{periodSummary.totalPaid.toLocaleString()} DA</p>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">{t('detail.history')}</h3>
          <input
            type="search"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder={tCommon('search')}
            className="w-full max-w-xs rounded border border-line bg-panel px-3 py-1.5 text-sm"
          />
        </div>
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="px-4 py-2 text-start font-medium">{t('detail.date')}</th>
                <th className="px-4 py-2 text-start font-medium"></th>
                <th className="px-4 py-2 text-start font-medium"></th>
                <th className="px-4 py-2 text-end font-medium">{t('detail.amount')}</th>
                <th className="px-4 py-2 text-end font-medium">{t('detail.runningBalance')}</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-sm text-muted">
                    {tCommon('empty')}
                  </td>
                </tr>
              )}
              {filteredEntries.map((e) => {
                const latest = e.pendingDeletions[0];
                const isVoided = !!e.voidedAt;
                const isEntryPending = latest?.status === 'PENDING';
                const struckThrough = isVoided || isEntryPending;
                const canRequestDelete = e.type !== 'PURCHASE_VOUCHER' && !isVoided && !isEntryPending;
                return (
                  <tr key={e.id} className={`border-t border-line first:border-t-0 ${isEntryPending ? 'bg-amber-500/10' : ''}`}>
                    <td className="px-4 py-2 font-mono text-xs text-muted">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className={`px-4 py-2 text-xs ${struckThrough ? 'line-through text-muted' : ''}`}>
                      {t(`entryTypes.${e.type}`)}
                    </td>
                    <td className={`px-4 py-2 text-xs text-muted ${struckThrough ? 'line-through' : ''}`}>
                      {e.reference && <span className="font-mono text-ink">{e.reference}</span>}
                      {e.reference && e.note && ' — '}
                      {e.note}
                      {latest && (isVoided || isEntryPending) && (
                        <p className={`mt-0.5 text-[11px] ${isVoided ? 'text-red-600' : 'text-amber-600'}`}>
                          {isVoided ? t('detail.deleted') : t('pendingDeletion')} : {latest.reason}
                        </p>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2 text-end font-mono tabular ${struckThrough ? 'line-through text-muted' : Number(e.amount) > 0 ? 'text-accent' : 'text-teal'}`}
                    >
                      {Number(e.amount) > 0 ? '+' : ''}
                      {Number(e.amount).toLocaleString()} DA
                    </td>
                    <td
                      className={`px-4 py-2 text-end font-mono tabular text-xs ${struckThrough ? 'line-through text-muted' : 'text-ink'}`}
                    >
                      {e.balanceAfter.toLocaleString()} DA
                    </td>
                    <td className="px-2 py-2 text-end">
                      {canRequestDelete && (
                        <button onClick={() => requestEntryDeletion(e.id)} className="text-xs text-red-600 hover:underline">
                          {tCommon('delete')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
