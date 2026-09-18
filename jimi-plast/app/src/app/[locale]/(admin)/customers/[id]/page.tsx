'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

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
  createdAt: string;
  voidedAt: string | null;
  pendingDeletions: PendingDeletion[];
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

  function reload() {
    api.get<CustomerDetail>(`/customers/${id}`, token).then(setCustomer);
  }

  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

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

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">{t('detail.history')}</h3>
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full text-sm">
            <tbody>
              {customer.entries.map((e) => {
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
