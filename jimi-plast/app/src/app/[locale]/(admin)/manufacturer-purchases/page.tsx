'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { openOrSharePdf, supportsPdfShare } from '@/lib/pdf-share';

interface PurchaseRow {
  id: string;
  number: string | null;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  discount: string;
  transportCost: string;
  items: { lineTotal: string }[];
}

const total = (p: PurchaseRow) => p.items.reduce((s, i) => s + Number(i.lineTotal), 0) - Number(p.discount) + Number(p.transportCost);

/** Lecture seule : le fabricant voit ses bons d'achat, jamais n'en crée ou n'en modifie. */
export default function ManufacturerPurchasesPage() {
  const t = useTranslations('purchases');
  const tVoucher = useTranslations('vouchers');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseRow[] | null>(null);
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);

  useEffect(() => {
    if (token) api.get<PurchaseRow[]>('/purchase-vouchers/mine', token).then(setPurchases);
  }, [token]);

  async function viewPdf(p: PurchaseRow) {
    const win = supportsPdfShare() ? null : window.open('', '_blank');
    setLoadingPdfId(p.id);
    try {
      await openOrSharePdf(() => api.getBlob(`/purchase-vouchers/mine/${p.id}/pdf`, token), `${p.number ?? 'achat'}.pdf`, win);
    } catch {
      win?.close();
    } finally {
      setLoadingPdfId(null);
    }
  }

  if (!purchases) return <p className="text-muted">{tCommon('loading')}</p>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('columns.number')}</th>
              <th className="px-4 py-2 text-start">{t('columns.date')}</th>
              <th className="px-4 py-2 text-start">{t('columns.total')}</th>
              <th className="px-4 py-2 text-start">{t('columns.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-sm text-muted">
                  {tCommon('empty')}
                </td>
              </tr>
            )}
            {purchases.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-4 py-2 font-mono text-xs">{p.number ?? '(brouillon)'}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 tabular">{total(p).toLocaleString()} DA</td>
                <td className="px-4 py-2 text-xs text-ink">{tVoucher(`status.${p.status}` as never)}</td>
                <td className="px-4 py-2 text-end">
                  <button
                    onClick={() => viewPdf(p)}
                    disabled={loadingPdfId === p.id}
                    className="rounded border border-line px-2 py-1 text-xs text-ink hover:bg-line/30 disabled:opacity-50"
                  >
                    {loadingPdfId === p.id ? tCommon('loading') : tVoucher('viewPdf')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
