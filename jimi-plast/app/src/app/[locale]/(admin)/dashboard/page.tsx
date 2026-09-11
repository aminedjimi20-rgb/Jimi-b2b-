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

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { user, token, hasPermission } = useAuth();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);
  const [rolesCount, setRolesCount] = useState<number | null>(null);

  useEffect(() => {
    if (!token || !hasPermission('users.manage')) return;
    api
      .get<RegistrationRequest[]>('/registration-requests?status=NEW', token)
      .then((rows) => setPendingCount(rows.length))
      .catch(() => setPendingCount(null));
    api
      .get<UserRow[]>('/users', token)
      .then((rows) => setActiveUsers(rows.filter((r) => r.status === 'ACTIVE').length))
      .catch(() => setActiveUsers(null));
    api
      .get<RoleRow[]>('/roles', token)
      .then((rows) => setRolesCount(rows.length))
      .catch(() => setRolesCount(null));
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

      {hasPermission('users.manage') && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label={t('pendingRequests')} value={pendingCount} />
          <StatCard label={t('activeUsers')} value={activeUsers} />
          <StatCard label={t('rolesConfigured')} value={rolesCount} />
        </div>
      )}

      <div className="rounded-lg border border-dashed border-line bg-panel p-6 text-sm text-muted">
        {t('placeholder')}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-3xl font-semibold tabular text-ink">{value ?? '—'}</p>
    </div>
  );
}
