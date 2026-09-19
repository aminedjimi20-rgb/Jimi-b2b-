'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { openOrSharePdf, supportsPdfShare } from '@/lib/pdf-share';

interface Driver {
  id: string;
  fullName: string;
  phone: string | null;
  vehicle: string | null;
  photoUrl: string | null;
  notes: string | null;
  deletedAt: string | null;
}
interface DeliveryRow {
  id: string;
  status: string;
  cost: string;
  address: string | null;
  createdAt: string;
  salesVoucher?: { number: string | null; customer?: { user: { fullName: string } } } | null;
  purchaseVoucher?: { number: string | null; manufacturer?: { name: string } } | null;
}
interface Situation {
  totalDeliveries: number;
  totalCost: number;
}

export default function DriverDetailPage() {
  const t = useTranslations('transport');
  const tc = useTranslations('common');
  const { token } = useAuth();
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();

  const [driver, setDriver] = useState<Driver | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [situation, setSituation] = useState<Situation>({ totalDeliveries: 0, totalCost: 0 });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [printing, setPrinting] = useState(false);

  function reload() {
    api.get<Driver>(`/drivers/${id}`, token).then(setDriver);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    api.get<DeliveryRow[]>(`/drivers/${id}/deliveries${qs ? `?${qs}` : ''}`, token).then(setDeliveries);
    api.get<Situation>(`/drivers/${id}/situation${qs ? `?${qs}` : ''}`, token).then(setSituation);
  }

  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id, from, to]);

  async function printSituation() {
    // Comme pour les fabricants : onglet vide synchrone hors partage natif,
    // sinon les bloqueurs de popups coupent l'appel après le premier await.
    const win = supportsPdfShare() ? null : window.open('', '_blank');
    setPrinting(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString();
      await openOrSharePdf(
        () => api.getBlob(`/drivers/${id}/situation/pdf${qs ? `?${qs}` : ''}`, token),
        `situation-${driver?.fullName ?? id}.pdf`,
        win,
      );
    } catch {
      win?.close();
    } finally {
      setPrinting(false);
    }
  }

  const partyOf = (d: DeliveryRow) => d.salesVoucher?.customer?.user.fullName ?? d.purchaseVoucher?.manufacturer?.name ?? null;
  const voucherOf = (d: DeliveryRow) => d.salesVoucher?.number ?? d.purchaseVoucher?.number ?? t('driverDetail.standalone');

  if (!driver) return <p className="text-sm text-muted">{tc('loading')}</p>;

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => router.push(`/${locale}/transport`)} className="w-fit text-sm text-accent hover:underline">
        ← {t('driverDetail.back')}
      </button>

      <div className="flex items-center gap-3">
        {driver.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={driver.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {driver.fullName}
            {driver.deletedAt && <span className="ms-2 text-sm font-normal text-muted">({t('inactive')})</span>}
          </h1>
          <p className="text-sm text-muted">
            {driver.phone} {driver.vehicle && `— ${driver.vehicle}`}
          </p>
          {driver.notes && <p className="text-xs text-muted">{driver.notes}</p>}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-panel p-4">
        <h3 className="text-sm font-semibold text-ink">{t('driverDetail.situationTitle')}</h3>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t('driverDetail.from')}
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded border border-line bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t('driverDetail.to')}
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded border border-line bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>
          <button
            onClick={printSituation}
            disabled={printing}
            className="rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {printing ? tc('loading') : t('driverDetail.print')}
          </button>
        </div>
        <div className="mt-4 flex gap-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t('driverDetail.totalDeliveries')}</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-ink">{situation.totalDeliveries}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t('driverDetail.totalOwed')}</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-accent">{situation.totalCost.toLocaleString()} DA</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">{t('driverDetail.historyTitle')}</h3>
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-line/30 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 text-start">{t('columns.voucher')}</th>
                <th className="px-4 py-2 text-start">{t('party')}</th>
                <th className="px-4 py-2 text-start">{t('driverDetail.date')}</th>
                <th className="px-4 py-2 text-start">{t('cost')}</th>
                <th className="px-4 py-2 text-start">{t('columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-sm text-muted">
                    {tc('empty')}
                  </td>
                </tr>
              )}
              {deliveries.map((d) => (
                <tr key={d.id} className={`border-t border-line ${d.status === 'CANCELLED' ? 'line-through opacity-50' : ''}`}>
                  <td className="px-4 py-2 font-mono text-xs">{voucherOf(d)}</td>
                  <td className="px-4 py-2 text-ink">{partyOf(d) ?? d.address ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted">{new Date(d.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 tabular">{Number(d.cost).toLocaleString()} DA</td>
                  <td className="px-4 py-2 text-xs text-ink">{t(`status.${d.status}` as never)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
