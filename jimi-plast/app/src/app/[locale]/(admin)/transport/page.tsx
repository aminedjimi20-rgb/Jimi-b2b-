'use client';

import { Fragment, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ImageUploadButton } from '@/components/image-upload-button';

interface DeliveryRow {
  id: string;
  voucherId: string;
  driverName: string | null;
  driverPhotoUrl: string | null;
  vehicle: string | null;
  driverPhone: string | null;
  address: string | null;
  wilaya: string | null;
  status: string;
  cost: string;
  billedToCustomer: string | null;
  notes: string | null;
  voucher: { number: string | null; customer: { user: { fullName: string } } };
}

interface VoucherOption {
  id: string;
  number: string | null;
  customer: { user: { fullName: string } };
}

const STATUSES = ['TO_PREPARE', 'PREPARED', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED', 'PROBLEM'];

const emptyForm = {
  driverName: '',
  driverPhotoUrl: '',
  vehicle: '',
  driverPhone: '',
  address: '',
  wilaya: '',
  status: 'TO_PREPARE',
  cost: '',
  billedToCustomer: '',
  notes: '',
};

export default function TransportPage() {
  const t = useTranslations('transport');
  const tc = useTranslations('common');
  const { token } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [confirmedVouchers, setConfirmedVouchers] = useState<VoucherOption[]>([]);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [creatingFor, setCreatingFor] = useState('');

  function reload() {
    api.get<DeliveryRow[]>('/deliveries', token).then(setDeliveries);
    api.get<VoucherOption[]>('/vouchers?status=CONFIRMED', token).then(setConfirmedVouchers);
  }
  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const availableVouchers = confirmedVouchers.filter(
    (v) => !deliveries.some((d) => d.voucherId === v.id),
  );

  function openEdit(d: DeliveryRow) {
    setEditingVoucherId(d.voucherId);
    setCreatingFor('');
    setForm({
      driverName: d.driverName ?? '',
      driverPhotoUrl: d.driverPhotoUrl ?? '',
      vehicle: d.vehicle ?? '',
      driverPhone: d.driverPhone ?? '',
      address: d.address ?? '',
      wilaya: d.wilaya ?? '',
      status: d.status,
      cost: d.cost ?? '',
      billedToCustomer: d.billedToCustomer ?? '',
      notes: d.notes ?? '',
    });
  }

  function openCreate() {
    setEditingVoucherId(null);
    setCreatingFor('');
    setForm(emptyForm);
  }

  function closeForm() {
    setEditingVoucherId(null);
    setCreatingFor('');
  }

  async function submitForm(voucherId: string) {
    await api.put(
      `/deliveries/voucher/${voucherId}`,
      {
        ...form,
        cost: form.cost === '' ? undefined : Number(form.cost),
        billedToCustomer: form.billedToCustomer === '' ? undefined : Number(form.billedToCustomer),
      },
      token,
    );
    closeForm();
    reload();
  }

  async function updateStatus(voucherId: string, status: string) {
    await api.put(`/deliveries/voucher/${voucherId}`, { status }, token);
    reload();
  }

  function renderForm(voucherId: string) {
    return (
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-accent/40 bg-accent/5 p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{t('driverName')}</span>
          <input
            value={form.driverName}
            onChange={(e) => setForm((f) => ({ ...f, driverName: e.target.value }))}
            className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{t('driverPhoto')}</span>
          <div className="flex items-center gap-3">
            {form.driverPhotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.driverPhotoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            )}
            <ImageUploadButton
              folder="drivers"
              label={tc('uploadPhoto')}
              onUploaded={(url) => setForm((f) => ({ ...f, driverPhotoUrl: url }))}
            />
          </div>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{t('vehicle')}</span>
          <input
            value={form.vehicle}
            onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value }))}
            className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{t('driverPhone')}</span>
          <input
            value={form.driverPhone}
            onChange={(e) => setForm((f) => ({ ...f, driverPhone: e.target.value }))}
            className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{t('wilaya')}</span>
          <input
            value={form.wilaya}
            onChange={(e) => setForm((f) => ({ ...f, wilaya: e.target.value }))}
            className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted">{t('address')}</span>
          <input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{t('cost')}</span>
          <input
            type="number"
            value={form.cost}
            onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
            className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{t('billedToCustomer')}</span>
          <input
            type="number"
            value={form.billedToCustomer}
            onChange={(e) => setForm((f) => ({ ...f, billedToCustomer: e.target.value }))}
            className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{t('columns.status')}</span>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}` as never)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted">{t('notes')}</span>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button
            onClick={() => submitForm(voucherId)}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {t('save')}
          </button>
          <button onClick={closeForm} className="rounded border border-line px-4 py-2 text-sm text-ink hover:bg-line/30">
            {t('cancel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        {creatingFor === '' && editingVoucherId === null && (
          <button
            onClick={() => {
              openCreate();
              setCreatingFor(availableVouchers[0]?.id ?? '__none__');
            }}
            disabled={availableVouchers.length === 0}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            + {t('newDelivery')}
          </button>
        )}
      </div>

      {creatingFor !== '' && creatingFor !== '__none__' && editingVoucherId === null && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{t('selectVoucher')}</span>
            <select
              value={creatingFor}
              onChange={(e) => setCreatingFor(e.target.value)}
              className="max-w-sm rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
            >
              {availableVouchers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.number} — {v.customer.user.fullName}
                </option>
              ))}
            </select>
          </label>
          {renderForm(creatingFor)}
        </div>
      )}

      {availableVouchers.length === 0 && creatingFor === '' && (
        <p className="text-sm text-muted">{t('noVoucher')}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('columns.voucher')}</th>
              <th className="px-4 py-2 text-start">{t('columns.customer')}</th>
              <th className="px-4 py-2 text-start">{t('columns.driver')}</th>
              <th className="px-4 py-2 text-start">{t('columns.cost')}</th>
              <th className="px-4 py-2 text-start">{t('columns.status')}</th>
              <th className="px-4 py-2 text-start">{tc('edit')}</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <Fragment key={d.id}>
                <tr className="border-t border-line">
                  <td className="px-4 py-2 font-mono text-xs">{d.voucher.number}</td>
                  <td className="px-4 py-2 text-ink">{d.voucher.customer.user.fullName}</td>
                  <td className="px-4 py-2 text-muted">
                    <div className="flex items-center gap-2">
                      {d.driverPhotoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.driverPhotoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                      )}
                      {d.driverName ?? '—'}
                    </div>
                  </td>
                  <td className="px-4 py-2 tabular">{Number(d.cost).toLocaleString()} DA</td>
                  <td className="px-4 py-2">
                    <select
                      value={d.status}
                      onChange={(e) => updateStatus(d.voucherId, e.target.value)}
                      className="rounded border border-line bg-paper px-2 py-1 text-xs"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`status.${s}` as never)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => openEdit(d)} className="text-xs text-accent hover:underline">
                      {tc('edit')}
                    </button>
                  </td>
                </tr>
                {editingVoucherId === d.voucherId && (
                  <tr>
                    <td colSpan={6} className="px-4 py-3">
                      {renderForm(d.voucherId)}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
