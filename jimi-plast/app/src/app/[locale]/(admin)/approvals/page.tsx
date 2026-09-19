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
  createdAt: string;
  respondedAt: string | null;
  customer?: { businessName: string | null; user: { fullName: string } };
  manufacturer?: { id: string; name: string } | null;
  ledgerEntry: { id: string; type: string; amount: string; note: string | null } | null;
  salesVoucher: { id: string; number: string | null } | null;
  purchaseVoucher: { id: string; number: string | null } | null;
  supplierLedgerEntry: { id: string; type: string; amount: string; note: string | null } | null;
  requestedBy: { fullName: string } | null;
  respondedBy: { fullName: string } | null;
}

export default function ApprovalsPage() {
  const t = useTranslations('approvals');
  const tCommon = useTranslations('common');
  const { token, hasPermission } = useAuth();
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const isStaff = hasPermission('customers.manage');

  const [items, setItems] = useState<PendingDeletion[]>([]);
  const [search, setSearch] = useState('');

  function reload() {
    api.get<PendingDeletion[]>(isStaff ? '/pending-deletions' : '/pending-deletions/mine', token).then(setItems);
  }

  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function respond(id: string, decision: 'APPROVED' | 'REJECTED') {
    if (decision === 'APPROVED' && !window.confirm(t('confirmApprove'))) return;
    await api.post(`/pending-deletions/${id}/respond`, { decision }, token);
    reload();
  }

  function matchesSearch(item: PendingDeletion): boolean {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      item.reason,
      item.requestedBy?.fullName,
      item.respondedBy?.fullName,
      item.customer?.user.fullName,
      item.customer?.businessName,
      item.manufacturer?.name,
      item.salesVoucher?.number,
      item.purchaseVoucher?.number,
      item.ledgerEntry?.type,
      item.ledgerEntry?.note,
      item.supplierLedgerEntry?.type,
      item.supplierLedgerEntry?.note,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  }

  const filteredItems = items.filter(matchesSearch);
  const pending = filteredItems.filter((i) => i.status === 'PENDING');
  const resolved = filteredItems.filter((i) => i.status !== 'PENDING');

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="sticky top-0 z-10 flex flex-col gap-3 bg-paper pb-3">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tCommon('search')}
          className="w-full max-w-xs rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      {pending.length === 0 && <p className="text-sm text-muted">{search ? tCommon('empty') : t('noPending')}</p>}

      <div className="flex flex-col gap-3">
        {pending.map((item) => (
          <div key={item.id} className="rounded-lg border border-amber-400 bg-amber-500/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">
                {item.ledgerEntry
                  ? t('ledgerEntry', { type: item.ledgerEntry.type })
                  : item.supplierLedgerEntry
                    ? t('supplierLedgerEntry', { type: item.supplierLedgerEntry.type })
                    : item.salesVoucher
                      ? t('voucher', { number: item.salesVoucher.number ?? '' })
                      : item.purchaseVoucher
                        ? t('purchaseVoucher', { number: item.purchaseVoucher.number ?? '' })
                        : t('manufacturer', { name: item.manufacturer?.name ?? '' })}
              </p>
              {isStaff && item.customer && <p className="text-xs text-muted">{item.customer.user.fullName}</p>}
              {isStaff && item.manufacturer && <p className="text-xs text-muted">{item.manufacturer.name}</p>}
            </div>
            <p className="mt-1 text-xs text-muted">
              {t('requestedBy')} : {item.requestedBy?.fullName ?? tCommon('loading')} — {new Date(item.createdAt).toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-ink">{item.reason}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => respond(item.id, 'APPROVED')} className="rounded bg-teal px-3 py-1.5 text-sm font-medium text-white">
                {t('approve')}
              </button>
              <button onClick={() => respond(item.id, 'REJECTED')} className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
                {t('reject')}
              </button>
              {item.salesVoucher && (
                <button
                  onClick={() => router.push(`/${locale}/vouchers/${item.salesVoucher!.id}`)}
                  className="ms-auto text-sm text-accent hover:underline"
                >
                  {t('viewVoucher')}
                </button>
              )}
              {isStaff && item.purchaseVoucher && (
                <button
                  onClick={() => router.push(`/${locale}/purchases/${item.purchaseVoucher!.id}`)}
                  className="ms-auto text-sm text-accent hover:underline"
                >
                  {t('viewPurchaseVoucher')}
                </button>
              )}
              {isStaff && item.manufacturer && !item.purchaseVoucher && (
                <button
                  onClick={() => router.push(`/${locale}/manufacturers/${item.manufacturer!.id}`)}
                  className="ms-auto text-sm text-accent hover:underline"
                >
                  {t('viewManufacturer')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {resolved.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink">{t('resolved')}</h2>
          <ul className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto rounded-lg border border-line bg-panel p-3 text-xs">
            {resolved.map((item) => (
              <li key={item.id} className="border-b border-line/50 pb-1.5 last:border-0 last:pb-0">
                <span className={item.status === 'APPROVED' ? 'text-teal' : 'text-red-600'}>
                  {item.status === 'APPROVED' ? t('approved') : t('rejected')}
                </span>
                {' — '}
                <span className="text-ink">{item.reason}</span>
                {' — '}
                <span className="text-muted">{item.respondedBy?.fullName} · {item.respondedAt ? new Date(item.respondedAt).toLocaleString() : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
