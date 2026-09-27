'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';

interface UserRow {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
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

const NEW_FORM = { fullName: '', email: '', phone: '', initialPassword: '', roleKey: '' };

export default function UsersPage() {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(NEW_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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

  // Rôles proposés à la création d'un employé : pas grossiste/détaillant/
  // fabricant — ceux-là ont leur propre formulaire (Clients/Fabricants) avec
  // un profil dédié (businessName, wilaya…) qu'un simple compte n'a pas.
  const employeeRoles = useMemo(() => roles.filter((r) => !['wholesaler', 'retailer', 'manufacturer'].includes(r.key)), [roles]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.fullName} ${u.email ?? ''} ${u.phone ?? ''} ${u.role.name}`.toLowerCase().includes(q),
    );
  }, [users, search]);

  async function toggleStatus(user: UserRow) {
    if (!token) return;
    const next = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await api.put(`/users/${user.id}/status`, { status: next }, token);
    reloadUsers();
  }

  async function submitCreate() {
    setFormError(null);
    if (!form.fullName.trim() || !form.initialPassword.trim() || !form.roleKey) return;
    setCreating(true);
    try {
      await api.post(
        '/users',
        {
          fullName: form.fullName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          initialPassword: form.initialPassword,
          roleKey: form.roleKey,
        },
        token,
      );
      setForm(NEW_FORM);
      setShowForm(false);
      reloadUsers();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : tCommon('error'));
    } finally {
      setCreating(false);
    }
  }

  async function removeUser(u: UserRow, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(t('deleteConfirm'))) return;
    const reason = window.prompt(t('deleteReasonPrompt')) ?? undefined;
    try {
      await api.delete(`/users/${u.id}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, token);
      reloadUsers();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : tCommon('error'));
    }
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
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search')}
              className="max-w-xs rounded border border-line bg-panel px-3 py-2 text-sm"
            />
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              + {t('newEmployee')}
            </button>
          </div>

          {showForm && (
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-accent/40 bg-accent/5 p-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('form.fullName')}</span>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="rounded border border-line bg-paper px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('form.role')}</span>
                <select
                  value={form.roleKey}
                  onChange={(e) => setForm((f) => ({ ...f, roleKey: e.target.value }))}
                  className="rounded border border-line bg-paper px-3 py-2 text-ink"
                >
                  <option value="">—</option>
                  {employeeRoles.map((r) => (
                    <option key={r.id} value={r.key}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('form.email')}</span>
                <input
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="rounded border border-line bg-paper px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('form.phone')}</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="rounded border border-line bg-paper px-3 py-2 text-ink"
                />
              </label>
              <p className="text-xs text-muted sm:col-span-2">{t('form.loginHint')}</p>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('form.initialPassword')}</span>
                <input
                  type="text"
                  value={form.initialPassword}
                  onChange={(e) => setForm((f) => ({ ...f, initialPassword: e.target.value }))}
                  className="rounded border border-line bg-paper px-3 py-2 text-ink"
                />
              </label>
              {formError && <p className="text-sm text-red-600 sm:col-span-2">{formError}</p>}
              <div className="flex gap-2 sm:col-span-2">
                <button
                  onClick={submitCreate}
                  disabled={creating}
                  className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {t('save')}
                </button>
                <button onClick={() => setShowForm(false)} className="rounded border border-line px-4 py-2 text-sm text-ink">
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-line bg-panel">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-line/30 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2 text-start">{t('columns.name')}</th>
                  <th className="px-4 py-2 text-start">{t('columns.email')}</th>
                  <th className="px-4 py-2 text-start">{t('columns.phone')}</th>
                  <th className="px-4 py-2 text-start">{t('columns.role')}</th>
                  <th className="px-4 py-2 text-start">{t('columns.status')}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-sm text-muted">
                      {tCommon('empty')}
                    </td>
                  </tr>
                )}
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => router.push(`/${locale}/users/${u.id}`)}
                    className="cursor-pointer border-t border-line hover:bg-line/20"
                  >
                    <td className="px-4 py-2 font-medium text-ink">
                      <div className="flex items-center gap-2">
                        {u.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                            {u.fullName.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span>{u.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{u.email ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{u.phone ?? '—'}</td>
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
                    <td className="px-4 py-2 text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        {u.role.key !== 'admin' && (
                          <button
                            onClick={() => toggleStatus(u)}
                            className="rounded border border-line px-2 py-1 text-xs text-ink hover:bg-line/30"
                          >
                            {u.status === 'ACTIVE' ? t('suspend') : t('activate')}
                          </button>
                        )}
                        {u.role.key !== 'admin' && (
                          <button
                            onClick={(e) => removeUser(u, e)}
                            className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            {t('delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
