'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface RegistrationRequest {
  status: string;
}
interface UserRow {
  status: string;
}
interface RoleRow {
  id: string;
}
interface SalesStats {
  revenue: number;
  voucherCount: number;
  averageBasket: number;
}
interface MarginStats {
  totalMargin: number;
  marginPercent: number;
}
interface CreditsStats {
  totalCustomerDebt: number;
  totalSupplierDebt: number;
}
interface TopProduct {
  nameFr: string;
  unitsSold: number;
  revenue: number;
}
interface Overview {
  lowStockCount: number;
  pendingReturns: number;
  pendingNegotiations: number;
  pendingProductRequests: number;
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { user, token, hasPermission } = useAuth();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);
  const [rolesCount, setRolesCount] = useState<number | null>(null);
  const [sales, setSales] = useState<SalesStats | null>(null);
  const [margin, setMargin] = useState<MarginStats | null>(null);
  const [credits, setCredits] = useState<CreditsStats | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [from, setFrom] = useState(() => toInputDate(daysAgo(30)));
  const [to, setTo] = useState(() => toInputDate(new Date()));

  useEffect(() => {
    if (!token) return;
    if (hasPermission('users.manage')) {
      api.get<RegistrationRequest[]>('/registration-requests?status=NEW', token).then((rows) => setPendingCount(rows.length));
      api.get<UserRow[]>('/users', token).then((rows) => setActiveUsers(rows.filter((r) => r.status === 'ACTIVE').length));
      api.get<RoleRow[]>('/roles', token).then((rows) => setRolesCount(rows.length));
    }
    if (hasPermission('stats.view')) {
      api.get<CreditsStats>('/stats/credits', token).then(setCredits);
      api.get<Overview>('/stats/overview', token).then(setOverview);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hasPermission]);

  useEffect(() => {
    if (!token || !hasPermission('stats.view')) return;
    const qs = `from=${from}&to=${to}`;
    api.get<SalesStats>(`/stats/sales?${qs}`, token).then(setSales);
    api.get<MarginStats>(`/stats/margin?${qs}`, token).then(setMargin);
    api.get<TopProduct[]>(`/stats/top-products?${qs}&limit=5`, token).then(setTopProducts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hasPermission, from, to]);

  function applyPreset(days: number | 'year' | 'all') {
    if (days === 'all') {
      setFrom(toInputDate(new Date(2020, 0, 1)));
      setTo(toInputDate(new Date()));
    } else if (days === 'year') {
      setFrom(toInputDate(new Date(new Date().getFullYear(), 0, 1)));
      setTo(toInputDate(new Date()));
    } else {
      setFrom(toInputDate(daysAgo(days)));
      setTo(toInputDate(new Date()));
    }
  }

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t('welcome', { name: user.fullName })}</h1>
        <p className="text-sm text-muted">
          {t('roleLabel')}: <span className="font-medium text-ink">{user.role.name}</span>
        </p>
      </div>

      {hasPermission('stats.view') && sales && margin && credits && (
        <CollapsibleSection id="stats" title={t('statsTitle')}>
          <div className="mb-1 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-panel p-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted">{t('dateFrom')}</span>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded border border-line bg-paper px-2 py-1 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted">{t('dateTo')}</span>
              <input
                type="date"
                value={to}
                min={from}
                max={toInputDate(new Date())}
                onChange={(e) => setTo(e.target.value)}
                className="rounded border border-line bg-paper px-2 py-1 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-1">
              <PresetButton onClick={() => applyPreset(7)}>{t('preset7d')}</PresetButton>
              <PresetButton onClick={() => applyPreset(30)}>{t('preset30d')}</PresetButton>
              <PresetButton onClick={() => applyPreset(90)}>{t('preset90d')}</PresetButton>
              <PresetButton onClick={() => applyPreset('year')}>{t('presetYear')}</PresetButton>
              <PresetButton onClick={() => applyPreset('all')}>{t('presetAll')}</PresetButton>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t('revenue')} value={`${sales.revenue.toLocaleString()} DA`} />
            <StatCard label={t('margin')} value={`${margin.totalMargin.toLocaleString()} DA (${margin.marginPercent}%)`} />
            <StatCard label={t('averageBasket')} value={`${sales.averageBasket.toLocaleString()} DA`} />
            <StatCard label={t('confirmedVouchers')} value={sales.voucherCount} />
            <StatCard label={t('customerCredit')} value={`${credits.totalCustomerDebt.toLocaleString()} DA`} accent />
            <StatCard label={t('supplierDebt')} value={`${credits.totalSupplierDebt.toLocaleString()} DA`} accent />
            {overview && <StatCard label={t('lowStock')} value={overview.lowStockCount} accent={overview.lowStockCount > 0} />}
            {overview && <StatCard label={t('pendingTotal')} value={overview.pendingProductRequests + overview.pendingNegotiations + overview.pendingReturns} />}
          </div>
        </CollapsibleSection>
      )}

      {hasPermission('users.manage') && (
        <CollapsibleSection id="admin" title="Administration">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label={t('pendingRequests')} value={pendingCount ?? '—'} />
            <StatCard label={t('activeUsers')} value={activeUsers ?? '—'} />
            <StatCard label={t('rolesConfigured')} value={rolesCount ?? '—'} />
          </div>
        </CollapsibleSection>
      )}

      {hasPermission('stats.view') && topProducts.length > 0 && (
        <CollapsibleSection id="top-products" title={t('topProductsTitle')}>
          <div className="rounded-lg border border-line bg-panel p-4">
            <ul className="flex flex-col gap-1 text-sm">
              {topProducts.map((p) => (
                <li key={p.nameFr} className="flex justify-between border-t border-line py-1.5 first:border-t-0">
                  <span className="text-ink">{p.nameFr}</span>
                  <span className="tabular text-muted">
                    {p.unitsSold} pièces — {p.revenue.toLocaleString()} DA
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleSection>
      )}

      {!hasPermission('stats.view') && (
        <div className="rounded-lg border border-dashed border-line bg-panel p-6 text-sm text-muted">
          {t('placeholder')}
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const storageKey = `jimiplast_dash_${id}`;
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(localStorage.getItem(storageKey) !== 'closed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      localStorage.setItem(storageKey, next ? 'open' : 'closed');
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <button onClick={toggle} className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className={`inline-block text-xs text-muted transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        {title}
      </button>
      {open && children}
    </div>
  );
}

function PresetButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-line bg-paper px-2 py-1 text-xs text-ink hover:bg-line/30"
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold tabular ${accent ? 'text-accent' : 'text-ink'}`}>{value}</p>
    </div>
  );
}
