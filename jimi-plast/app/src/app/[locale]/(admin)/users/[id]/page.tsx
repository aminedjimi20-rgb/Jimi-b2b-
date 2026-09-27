'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { DayGroupRow, DayGroupToggleAll } from '@/components/day-group-row';
import { dayGroupLabel, groupByDay, useExpandedGroups } from '@/lib/date-groups';
import { AttendanceCalendar, type AttendanceEntry } from '@/components/attendance-calendar';

interface UserDetail {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'REJECTED';
  lastLoginAt: string | null;
  createdAt: string;
  role: { key: string; name: string };
}
interface Role {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
}
type ActivityItem =
  | { type: 'note'; id: string; text: string; createdAt: string; voidedAt: string | null }
  | { type: 'sale_voucher'; id: string; number: string | null; status: string; createdAt: string }
  | { type: 'purchase_voucher'; id: string; number: string | null; status: string; createdAt: string };

const NON_EMPLOYEE_ROLE_KEYS = ['wholesaler', 'retailer', 'manufacturer'];

export default function UserDetailPage() {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', roleKey: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [noteDraft, setNoteDraft] = useState('');

  function reload() {
    if (!token) return;
    api
      .get<UserDetail>(`/users/${id}`, token)
      .then((u) => {
        setUser(u);
        setForm({ fullName: u.fullName, email: u.email ?? '', phone: u.phone ?? '', roleKey: u.role.key });
      })
      .catch(() => setUser(null));
    api.get<AttendanceEntry[]>(`/users/${id}/attendance`, token).then(setAttendance);
    api.get<ActivityItem[]>(`/users/${id}/activity`, token).then(setActivity);
  }
  useEffect(() => {
    if (!token) return;
    reload();
    api.get<Role[]>('/roles', token).then(setRoles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const employeeRoles = useMemo(() => roles.filter((r) => !NON_EMPLOYEE_ROLE_KEYS.includes(r.key)), [roles]);
  const canChangeRole = user ? !NON_EMPLOYEE_ROLE_KEYS.includes(user.role.key) : false;

  async function submitEdit() {
    if (!user) return;
    setSaveError(null);
    setSaving(true);
    try {
      await api.put(
        `/users/${id}`,
        {
          fullName: form.fullName.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          ...(canChangeRole ? { roleKey: form.roleKey } : {}),
        },
        token,
      );
      reload();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : tCommon('error'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (!user) return;
    const next = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await api.put(`/users/${id}/status`, { status: next }, token);
    reload();
  }

  async function removeUser() {
    if (!window.confirm(t('deleteConfirm'))) return;
    const reason = window.prompt(t('deleteReasonPrompt')) ?? undefined;
    try {
      await api.delete(`/users/${id}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, token);
      router.push(`/${locale}/users`);
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : tCommon('error'));
    }
  }

  async function addNote() {
    if (!noteDraft.trim()) return;
    await api.post(`/users/${id}/notes`, { text: noteDraft }, token);
    setNoteDraft('');
    reload();
  }

  async function toggleNoteVoided(item: Extract<ActivityItem, { type: 'note' }>) {
    await api.put(`/users/notes/${item.id}/void`, { voided: !item.voidedAt }, token);
    reload();
  }

  async function confirmAttendance(date: string) {
    await api.post(`/users/${id}/attendance/${date}/confirm`, undefined, token);
    reload();
  }
  async function unconfirmAttendance(date: string) {
    await api.post(`/users/${id}/attendance/${date}/unconfirm`, undefined, token);
    reload();
  }
  async function toggleAttendanceHidden(attendanceId: string, hidden: boolean) {
    await api.put(`/users/${id}/attendance/${attendanceId}/hidden`, { hidden }, token);
    reload();
  }

  const dayGroups = useMemo(() => groupByDay(activity, (a) => a.createdAt), [activity]);
  const { isExpanded, toggle, allExpanded, expandAll, collapseAll } = useExpandedGroups(dayGroups);

  if (!user) return <p className="text-muted">{tCommon('loading')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <button onClick={() => router.push(`/${locale}/users`)} className="w-fit text-sm text-accent hover:underline">
        ← {t('back')}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-ink">{user.fullName}</h1>
          <p className="text-sm text-muted">
            {user.role.name}
            <span
              className={`ms-2 rounded-full px-2 py-0.5 text-xs ${
                user.status === 'ACTIVE' ? 'bg-teal/15 text-teal' : 'bg-red-100 text-red-700'
              }`}
            >
              {user.status}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          {user.role.key !== 'admin' && (
            <>
              <button onClick={toggleStatus} className="rounded border border-line px-3 py-1.5 text-sm text-ink hover:bg-line/30">
                {user.status === 'ACTIVE' ? t('suspend') : t('activate')}
              </button>
              <button onClick={removeUser} className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
                {t('delete')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-panel p-4">
        <p className="mb-3 text-sm font-semibold text-ink">{t('detail.profile')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            {canChangeRole ? (
              <select
                value={form.roleKey}
                onChange={(e) => setForm((f) => ({ ...f, roleKey: e.target.value }))}
                className="rounded border border-line bg-paper px-3 py-2 text-ink"
              >
                {employeeRoles.map((r) => (
                  <option key={r.id} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </select>
            ) : (
              <input disabled value={user.role.name} className="rounded border border-line bg-line/10 px-3 py-2 text-muted" />
            )}
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
        </div>
        {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
        <button
          onClick={submitEdit}
          disabled={saving}
          className="mt-3 rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {t('save')}
        </button>
      </div>

      <div className="rounded-lg border border-line bg-panel p-4">
        <p className="mb-3 text-sm font-semibold text-ink">{t('detail.attendanceHistory')}</p>
        <AttendanceCalendar
          entries={attendance}
          mode="admin"
          locale={locale}
          onConfirm={confirmAttendance}
          onUnconfirm={unconfirmAttendance}
          onToggleHidden={toggleAttendanceHidden}
        />
      </div>

      <div className="rounded-lg border border-line bg-panel p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">{t('detail.activity')}</p>
            <p className="text-xs text-muted">{t('detail.activityHint')}</p>
          </div>
          {dayGroups.length > 0 && (
            <DayGroupToggleAll
              allExpanded={allExpanded}
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
              expandLabel={tCommon('expandAll')}
              collapseLabel={tCommon('collapseAll')}
            />
          )}
        </div>

        <div className="mb-3 flex flex-col gap-2">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder={t('detail.notePlaceholder')}
            rows={2}
            className="rounded border border-line bg-paper px-3 py-2 text-sm"
          />
          <button
            onClick={addNote}
            disabled={!noteDraft.trim()}
            className="w-fit rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {t('detail.addNote')}
          </button>
        </div>

        {activity.length === 0 ? (
          <p className="text-sm text-muted">{t('detail.noActivity')}</p>
        ) : (
          <div className="flex flex-col">
            {dayGroups.map((group, idx) => (
              <Fragment key={group.key}>
                <button
                  onClick={() => toggle(idx)}
                  className="flex items-center gap-2 border-t border-line py-2 text-start text-xs font-semibold text-ink first:border-t-0"
                >
                  <span className={`inline-block transition-transform ${isExpanded(idx) ? 'rotate-90' : ''}`}>▶</span>
                  <span>{dayGroupLabel(group.date, locale, tCommon('today'), tCommon('yesterday'))}</span>
                  <span className="text-muted">({group.rows.length})</span>
                </button>
                {isExpanded(idx) && (
                  <ul className="flex flex-col gap-1.5 pb-2 ps-6">
                    {group.rows.map((item) => (
                      <li key={`${item.type}-${item.id}`} className="flex items-start justify-between gap-2 text-sm">
                        {item.type === 'note' ? (
                          <>
                            <span className={item.voidedAt ? 'text-muted line-through' : 'text-ink'}>
                              <span className="font-mono text-xs text-muted">{new Date(item.createdAt).toLocaleTimeString(locale)}</span>{' '}
                              — {item.text}
                            </span>
                            <button onClick={() => toggleNoteVoided(item)} className="shrink-0 text-xs text-accent hover:underline">
                              {item.voidedAt ? t('detail.restoreNote') : t('detail.strikeNote')}
                            </button>
                          </>
                        ) : (
                          <span className="text-ink">
                            <span className="font-mono text-xs text-muted">{new Date(item.createdAt).toLocaleTimeString(locale)}</span>{' '}
                            — {item.type === 'sale_voucher' ? t('detail.saleVoucher') : t('detail.purchaseVoucher')}
                            {item.number ? ` (${item.number})` : ''}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
