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

  useEffect(() => {
    if (!token) return;
    if (hasPermission('users.manage')) {
      api.get<RegistrationRequest[]>('/registration-requests?status=NEW', token).then((rows) => setPendingCount(rows.length));
      api.get<UserRow[]>('/users', token).then((rows) => setActiveUsers(rows.filter((r) => r.status === 'ACTIVE').length));
      api.get<RoleRow[]>('/roles', token).then((rows) => setRolesCount(rows.length));
    }
    if (hasPermission('stats.view')) {
      api.get<SalesStats>('/stats/sales', token).then(setSales);
      api.get<MarginStats>('/stats/margin', token).then(setMargin);
      api.get<CreditsStats>('/stats/credits', token).then(setCredits);
      api.get<TopProduct[]>('/stats/top-products?limit=5', token).then(setTopProducts);
      api.get<Overview>('/stats/overview', token).then(setOverview);
    }
  }, [token, hasPermission]);

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Chiffre d'affaires (30j)" value={`${sales.revenue.toLocaleString()} DA`} />
          <StatCard label="Marge (30j)" value={`${margin.totalMargin.toLocaleString()} DA (${margin.marginPercent}%)`} />
          <StatCard label="Panier moyen" value={`${sales.averageBasket.toLocaleString()} DA`} />
          <StatCard label="Bons confirmés (30j)" value={sales.voucherCount} />
          <StatCard label="Crédit clients" value={`${credits.totalCustomerDebt.toLocaleString()} DA`} accent />
          <StatCard label="Dette fabricants" value={`${credits.totalSupplierDebt.toLocaleString()} DA`} accent />
          {overview && <StatCard label="Stock faible" value={overview.lowStockCount} accent={overview.lowStockCount > 0} />}
          {overview && <StatCard label="Demandes en attente" value={overview.pendingProductRequests + overview.pendingNegotiations + overview.pendingReturns} />}
        </div>
      )}

      {hasPermission('users.manage') && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label={t('pendingRequests')} value={pendingCount ?? '—'} />
          <StatCard label={t('activeUsers')} value={activeUsers ?? '—'} />
          <StatCard label={t('rolesConfigured')} value={rolesCount ?? '—'} />
        </div>
      )}

      {hasPermission('stats.view') && topProducts.length > 0 && (
        <div className="rounded-lg border border-line bg-panel p-4">
          <h3 className="mb-2 text-sm font-semibold text-ink">Produits les plus vendus (30 derniers jours)</h3>
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
      )}

      {!hasPermission('stats.view') && (
        <div className="rounded-lg border border-dashed border-line bg-panel p-6 text-sm text-muted">
          {t('placeholder')}
        </div>
      )}
    </div>
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
