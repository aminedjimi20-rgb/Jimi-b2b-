'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { openOrSharePdf, supportsPdfShare } from '@/lib/pdf-share';

interface PendingDeletion {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  requestedBy: { fullName: string } | null;
}
interface LedgerEntry {
  id: string;
  type: 'SALE_VOUCHER' | 'PAYMENT' | 'RETURN_CREDIT' | 'ADJUSTMENT';
  amount: string;
  note: string | null;
  reference: string | null;
  createdAt: string;
  voidedAt: string | null;
  pendingDeletions: PendingDeletion[];
}
interface Remark {
  id: string;
  text: string;
  createdAt: string;
  voidedAt: string | null;
}
interface CustomerDetail {
  id: string;
  businessName: string | null;
  address: string | null;
  wilaya: string | null;
  creditLimit: number;
  balance: number;
  user: { fullName: string; email: string; phone: string | null; role: { name: string } };
  entries: LedgerEntry[];
  remarks: Remark[];
}

export default function CustomerDetailPage() {
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [statementFrom, setStatementFrom] = useState('');
  const [statementTo, setStatementTo] = useState('');
  const [printingStatement, setPrintingStatement] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [periodSummary, setPeriodSummary] = useState<{ totalBusiness: number; totalPaid: number } | null>(null);
  const [remarkDraft, setRemarkDraft] = useState('');

  function reload() {
    api.get<CustomerDetail>(`/customers/${id}`, token).then(setCustomer);
  }

  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  async function addRemark() {
    if (!remarkDraft.trim()) return;
    await api.post(`/customers/${id}/remarks`, { text: remarkDraft }, token);
    setRemarkDraft('');
    reload();
  }

  async function toggleRemarkVoided(remark: Remark) {
    await api.put(`/customers/remarks/${remark.id}/void`, { voided: !remark.voidedAt }, token);
    reload();
  }

  // Chiffres "sur la période" (chiffre d'affaires + payé), recalculés à
  // chaque changement des dates Du/Au partagées avec l'impression de situation.
  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams();
    if (statementFrom) params.set('from', statementFrom);
    if (statementTo) params.set('to', statementTo);
    const qs = params.toString();
    api
      .get<{ totalBusiness: number; totalPaid: number }>(`/customers/${id}/period-summary${qs ? `?${qs}` : ''}`, token)
      .then(setPeriodSummary)
      .catch(() => setPeriodSummary(null));
  }, [token, id, statementFrom, statementTo]);

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/customers/${id}/payments`, { amount: Number(paymentAmount), note: paymentNote }, token);
    setPaymentAmount('');
    setPaymentNote('');
    reload();
  }

  async function submitAdjustment(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/customers/${id}/adjustments`, { amount: Number(adjustAmount), reason: adjustReason }, token);
    setAdjustAmount('');
    setAdjustReason('');
    reload();
  }

  // La suppression ne s'applique jamais tout de suite : elle attend
  // l'approbation du client, et la ligne reste affichée (barrée) pour de bon.
  async function requestEntryDeletion(entryId: string) {
    const reason = window.prompt(t('detail.deleteReasonPrompt'));
    if (!reason) return;
    await api.post(`/customers/entries/${entryId}/request-deletion`, { reason }, token);
    reload();
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
        () => api.getBlob(`/customers/${id}/statement/pdf${qs ? `?${qs}` : ''}`, token),
        `situation-${customer?.businessName ?? customer?.user.fullName ?? id}.pdf`,
        win,
      );
    } catch {
      win?.close();
    } finally {
      setPrintingStatement(false);
    }
  }

  // Entrées triées du plus récent au plus ancien (ordre serveur) : on
  // repart du solde actuel et on le "défait" mouvement par mouvement pour
  // afficher le solde tel qu'il était juste après chaque écriture.
  const entriesWithBalance = useMemo(() => {
    if (!customer) return [];
    let running = customer.balance;
    return customer.entries.map((e) => {
      const balanceAfter = running;
      if (!e.voidedAt) running -= Number(e.amount);
      return { ...e, balanceAfter };
    });
  }, [customer]);

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

  if (!customer) return <p className="text-muted">{tCommon('loading')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <button onClick={() => router.push(`/${locale}/customers`)} className="w-fit text-sm text-accent hover:underline">
        ← {t('detail.back')}
      </button>

      <div>
        <h1 className="text-2xl font-bold text-ink">{customer.user.fullName}</h1>
        <p className="text-sm text-muted">
          {customer.businessName} — {customer.user.role.name} — {customer.wilaya}
        </p>
        <p className="text-xs text-muted">
          {customer.user.email} · {customer.user.phone}
        </p>
      </div>

      <div className="rounded-lg border border-line bg-panel p-4">
        <p className="mb-2 text-sm font-semibold text-ink">{t('detail.generalNote')}</p>
        <div className="flex flex-col gap-2">
          <textarea
            value={remarkDraft}
            onChange={(e) => setRemarkDraft(e.target.value)}
            placeholder={t('detail.generalNotePlaceholder')}
            rows={2}
            className="rounded border border-line bg-paper px-3 py-2 text-sm"
          />
          <button onClick={addRemark} disabled={!remarkDraft.trim()} className="w-fit rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            OK
          </button>
        </div>
        {customer.remarks.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
            {customer.remarks.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 text-sm">
                <span className={r.voidedAt ? 'text-muted line-through' : 'text-ink'}>
                  <span className="font-mono text-xs text-muted">{new Date(r.createdAt).toLocaleString()}</span> — {r.text}
                </span>
                <button onClick={() => toggleRemarkVoided(r)} className="shrink-0 text-xs text-accent hover:underline">
                  {r.voidedAt ? t('detail.restoreRemark') : t('detail.strikeRemark')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel p-5">
          <p className="text-xs uppercase tracking-wide text-muted">{t('detail.balance')}</p>
          <p className={`mt-1 font-mono text-3xl font-semibold tabular ${customer.balance > 0 ? 'text-accent' : 'text-teal'}`}>
            {customer.balance.toLocaleString()} DA
          </p>
        </div>
        <div className="rounded-lg border border-line bg-panel p-5">
          <p className="text-xs uppercase tracking-wide text-muted">{t('detail.creditLimit')}</p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular text-ink">
            {customer.creditLimit.toLocaleString()} DA
          </p>
        </div>
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
            <input
              placeholder={t('detail.note')}
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
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
                const isPending = latest?.status === 'PENDING';
                const struckThrough = isVoided || isPending;
                const canRequestDelete = e.type !== 'SALE_VOUCHER' && !isVoided && !isPending;
                return (
                  <tr key={e.id} className={`border-t border-line first:border-t-0 ${isPending ? 'bg-amber-500/10' : ''}`}>
                    <td className="px-4 py-2 font-mono text-xs text-muted">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className={`px-4 py-2 text-xs ${struckThrough ? 'line-through text-muted' : ''}`}>
                      {t(`entryTypes.${e.type}`)}
                    </td>
                    <td className={`px-4 py-2 text-xs text-muted ${struckThrough ? 'line-through' : ''}`}>
                      {e.reference && <span className="font-mono text-ink">{e.reference}</span>}
                      {e.reference && e.note && ' — '}
                      {e.note}
                      {latest && (isVoided || isPending) && (
                        <p className={`mt-0.5 text-[11px] ${isVoided ? 'text-red-600' : 'text-amber-600'}`}>
                          {isVoided ? t('detail.deleted') : t('detail.pendingDeletion')} : {latest.reason}
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
