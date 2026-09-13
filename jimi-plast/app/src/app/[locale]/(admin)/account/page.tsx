'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface LedgerEntry {
  id: string;
  type: string;
  amount: string;
  note: string | null;
  createdAt: string;
}
interface MyAccount {
  businessName: string | null;
  wilaya: string | null;
  balance: number;
  entries: LedgerEntry[];
}

export default function MyAccountPage() {
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const [account, setAccount] = useState<MyAccount | null | undefined>(undefined);

  useEffect(() => {
    if (token) api.get<MyAccount | null>('/customers/me', token).then(setAccount);
  }, [token]);

  if (account === undefined) return <p className="text-muted">{tCommon('loading')}</p>;
  if (account === null) return <p className="text-muted">{tCommon('empty')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">{t('myAccount.title')}</h1>
      <p className="text-sm text-muted">
        {t('myAccount.business')}: {account.businessName ?? '—'} — {account.wilaya}
      </p>

      <div className="w-fit rounded-lg border border-line bg-panel p-5">
        <p className="text-xs uppercase tracking-wide text-muted">{t('detail.balance')}</p>
        <p className={`mt-1 font-mono text-3xl font-semibold tabular ${account.balance > 0 ? 'text-accent' : 'text-teal'}`}>
          {account.balance.toLocaleString()} DA
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">{t('detail.history')}</h3>
        {account.entries.length === 0 ? (
          <p className="text-sm text-muted">{t('myAccount.noHistory')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-panel">
            <table className="w-full text-sm">
              <tbody>
                {account.entries.map((e) => (
                  <tr key={e.id} className="border-t border-line first:border-t-0">
                    <td className="px-4 py-2 font-mono text-xs text-muted">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-xs">{e.type}</td>
                    <td className="px-4 py-2 text-xs text-muted">{e.note}</td>
                    <td
                      className={`px-4 py-2 text-end font-mono tabular ${Number(e.amount) > 0 ? 'text-accent' : 'text-teal'}`}
                    >
                      {Number(e.amount) > 0 ? '+' : ''}
                      {Number(e.amount).toLocaleString()} DA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
