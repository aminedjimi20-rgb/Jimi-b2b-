'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'REJECTED';
  lastLoginAt: string | null;
  role: { key: string; name: string };
}

interface Permission {
  key: string;
  label: string;
  group: string;
}

interface Role {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissionKeys: string[];
}

export default function UsersPage() {
  const t = useTranslations('users');
  const { token } = useAuth();
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reloadUsers() {
    if (!token) return;
    api.get<UserRow[]>('/users', token).then(setUsers);
  }

  function reloadRoles() {
    if (!token) return;
    api.get<Role[]>('/roles', token).then((rows) => {
      setRoles(rows);
      if (!selectedRoleId && rows.length) {
        const firstEditable = rows.find((r) => !r.isSystem || r.key !== 'admin');
        setSelectedRoleId(firstEditable?.id ?? rows[0].id);
      }
    });
  }

  useEffect(() => {
    if (!token) return;
    reloadUsers();
    reloadRoles();
    api.get<Permission[]>('/permissions', token).then(setPermissions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function toggleStatus(user: UserRow) {
    if (!token) return;
    const next = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await api.put(`/users/${user.id}/status`, { status: next }, token);
    reloadUsers();
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const groups = Array.from(new Set(permissions.map((p) => p.group)));

  async function togglePermission(permissionKey: string) {
    if (!token || !selectedRole) return;
    const has = selectedRole.permissionKeys.includes(permissionKey);
    const nextKeys = has
      ? selectedRole.permissionKeys.filter((k) => k !== permissionKey)
      : [...selectedRole.permissionKeys, permissionKey];

    setSaving(true);
    await api.put(`/roles/${selectedRole.id}/permissions`, { permissionKeys: nextKeys }, token);
    setSaving(false);
    reloadRoles();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>

      <div className="flex gap-1 border-b border-line">
        <TabButton active={tab === 'users'} onClick={() => setTab('users')}>
          {t('tabUsers')}
        </TabButton>
        <TabButton active={tab === 'roles'} onClick={() => setTab('roles')}>
          {t('tabRoles')}
        </TabButton>
      </div>

      {tab === 'users' && (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-line/30 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 text-start">{t('columns.name')}</th>
                <th className="px-4 py-2 text-start">{t('columns.email')}</th>
                <th className="px-4 py-2 text-start">{t('columns.role')}</th>
                <th className="px-4 py-2 text-start">{t('columns.status')}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-4 py-2 font-medium text-ink">{u.fullName}</td>
                  <td className="px-4 py-2 font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-2">{u.role.name}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        u.status === 'ACTIVE' ? 'bg-teal/15 text-teal' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-end">
                    {u.role.key !== 'admin' && (
                      <button
                        onClick={() => toggleStatus(u)}
                        className="rounded border border-line px-2 py-1 text-xs text-ink hover:bg-line/30"
                      >
                        {u.status === 'ACTIVE' ? t('suspend') : t('activate')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'roles' && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex w-full flex-col gap-1 sm:w-48">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className={`rounded px-3 py-2 text-start text-sm ${
                  role.id === selectedRoleId ? 'bg-accent/10 font-medium text-accent' : 'hover:bg-line/30'
                }`}
              >
                {role.name}
                {role.key === 'admin' && <span className="ms-1 text-xs text-muted">(tout)</span>}
              </button>
            ))}
          </div>

          <div className="flex-1 rounded-lg border border-line bg-panel p-4">
            {selectedRole?.key === 'admin' ? (
              <p className="text-sm text-muted">
                Le rôle ADMIN a toujours toutes les permissions — non modifiable.
              </p>
            ) : (
              <div className="flex flex-col gap-5">
                {groups.map((group) => (
                  <div key={group}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      {t(`permissionGroups.${group}` as Parameters<typeof t>[0])}
                    </h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {permissions
                        .filter((p) => p.group === group)
                        .map((p) => (
                          <label key={p.key} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              disabled={saving}
                              checked={selectedRole?.permissionKeys.includes(p.key) ?? false}
                              onChange={() => togglePermission(p.key)}
                              className="h-4 w-4 accent-accent"
                            />
                            {p.label}
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        active ? 'border-accent font-medium text-accent' : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
