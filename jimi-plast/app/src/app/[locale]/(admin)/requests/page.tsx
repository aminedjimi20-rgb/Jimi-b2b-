'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface RegistrationRequest {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  requestedRoleKey: string | null;
  status: 'NEW' | 'INFO_REQUESTED' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

interface Role {
  key: string;
  name: string;
}

export default function RequestsPage() {
  const t = useTranslations('requests');
  const { token } = useAuth();
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [acceptTarget, setAcceptTarget] = useState<RegistrationRequest | null>(null);
  const [roleKey, setRoleKey] = useState('wholesaler');
  const [initialPassword, setInitialPassword] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    if (!token) return;
    api.get<RegistrationRequest[]>('/registration-requests', token).then(setRequests);
  }

  useEffect(() => {
    if (!token) return;
    reload();
    api.get<Role[]>('/roles', token).then(setRoles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function reject(id: string) {
    if (!token) return;
    const note = window.prompt(t('note')) ?? '';
    setBusyId(id);
    await api.post(`/registration-requests/${id}/reject`, { reviewNote: note }, token);
    setBusyId(null);
    reload();
  }

  async function requestInfo(id: string) {
    if (!token) return;
    const note = window.prompt(t('note')) ?? '';
    setBusyId(id);
    await api.post(`/registration-requests/${id}/request-info`, { reviewNote: note }, token);
    setBusyId(null);
    reload();
  }

  async function confirmAccept() {
    if (!token || !acceptTarget) return;
    setBusyId(acceptTarget.id);
    await api.post(
      `/registration-requests/${acceptTarget.id}/accept`,
      { roleKey, initialPassword },
      token,
    );
    setBusyId(null);
    setAcceptTarget(null);
    setInitialPassword('');
    reload();
  }

  const pending = requests.filter((r) => r.status === 'NEW' || r.status === 'INFO_REQUESTED');

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('columns.name')}</th>
              <th className="px-4 py-2 text-start">{t('columns.phone')}</th>
              <th className="px-4 py-2 text-start">{t('columns.type')}</th>
              <th className="px-4 py-2 text-start">{t('columns.date')}</th>
              <th className="px-4 py-2 text-start">{t('columns.status')}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  {t('empty')}
                </td>
              </tr>
            )}
            {pending.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-2">
                  <div className="font-medium text-ink">{r.fullName}</div>
                  <div className="text-xs text-muted">{r.email}</div>
                </td>
                <td className="px-4 py-2 font-mono">{r.phone}</td>
                <td className="px-4 py-2">{r.requestedRoleKey ?? '—'}</td>
                <td className="px-4 py-2 font-mono text-xs">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-line/40 px-2 py-0.5 text-xs">
                    {t(`status.${r.status}`)}
                  </span>
                </td>
                <td className="flex gap-2 px-4 py-2">
                  <button
                    disabled={busyId === r.id}
                    onClick={() => {
                      setAcceptTarget(r);
                      setRoleKey(r.requestedRoleKey ?? 'wholesaler');
                    }}
                    className="rounded bg-teal px-2 py-1 text-xs font-medium text-white hover:opacity-90"
                  >
                    {t('accept')}
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => requestInfo(r.id)}
                    className="rounded border border-line px-2 py-1 text-xs text-ink hover:bg-line/30"
                  >
                    {t('requestInfo')}
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => reject(r.id)}
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    {t('reject')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {acceptTarget && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-line bg-panel p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-ink">{t('acceptTitle')}</h2>
            <p className="mt-1 text-sm text-muted">{acceptTarget.fullName}</p>

            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="text-muted">{t('selectRole')}</span>
              <select
                value={roleKey}
                onChange={(e) => setRoleKey(e.target.value)}
                className="rounded border border-line bg-paper px-3 py-2"
              >
                {roles
                  .filter((r) => r.key !== 'admin')
                  .map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="mt-3 flex flex-col gap-1 text-sm">
              <span className="text-muted">{t('initialPassword')}</span>
              <input
                type="text"
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                minLength={8}
                required
                className="rounded border border-line bg-paper px-3 py-2 font-mono"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setAcceptTarget(null)}
                className="rounded border border-line px-3 py-1.5 text-sm text-ink hover:bg-line/30"
              >
                {t('cancel')}
              </button>
              <button
                onClick={confirmAccept}
                disabled={initialPassword.length < 8}
                className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
