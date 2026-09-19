'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ImageUploadButton } from '@/components/image-upload-button';

interface Driver {
  id: string;
  fullName: string;
  phone: string | null;
  vehicle: string | null;
  photoUrl: string | null;
  notes: string | null;
  isActive: boolean;
  deletedAt: string | null;
}
interface DeliveryRow {
  id: string;
  salesVoucherId: string | null;
  purchaseVoucherId: string | null;
  driverId: string | null;
  driverName: string | null;
  driverPhotoUrl: string | null;
  vehicle: string | null;
  driverPhone: string | null;
  address: string | null;
  wilaya: string | null;
  status: string;
  cost: string;
  billedToCustomer: string | null;
  billedToManufacturer: string | null;
  cancelReason: string | null;
  notes: string | null;
  driver: Driver | null;
  salesVoucher: { number: string | null; customer: { user: { fullName: string } } } | null;
  purchaseVoucher: { number: string | null; manufacturer: { name: string } } | null;
}
interface VoucherOption {
  id: string;
  number: string | null;
  customer: { user: { fullName: string } };
}
interface PurchaseVoucherOption {
  id: string;
  number: string | null;
  manufacturer: { name: string };
}
interface ExpenseCategory {
  id: string;
  name: string;
}

const STATUSES = ['TO_PREPARE', 'PREPARED', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED', 'PROBLEM'];

const emptyForm = {
  driverId: '',
  address: '',
  wilaya: '',
  status: 'TO_PREPARE',
  cost: '',
  billedToCustomer: '',
  billedToManufacturer: '',
  notes: '',
  categoryId: '',
};
const emptyDriverForm = { fullName: '', phone: '', vehicle: '', photoUrl: '', notes: '' };

export default function TransportPage() {
  const t = useTranslations('transport');
  const tc = useTranslations('common');
  const { token } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [confirmedSalesVouchers, setConfirmedSalesVouchers] = useState<VoucherOption[]>([]);
  const [confirmedPurchaseVouchers, setConfirmedPurchaseVouchers] = useState<PurchaseVoucherOption[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [search, setSearch] = useState('');

  const [newType, setNewType] = useState<'sales' | 'purchase' | 'standalone' | ''>('');
  const [creatingFor, setCreatingFor] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [showDriverPanel, setShowDriverPanel] = useState(false);
  const [driverSearch, setDriverSearch] = useState('');
  const [driverForm, setDriverForm] = useState(emptyDriverForm);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [showDriverForm, setShowDriverForm] = useState(false);

  function reload() {
    api.get<DeliveryRow[]>('/deliveries', token).then(setDeliveries);
    api.get<Driver[]>('/drivers', token).then(setDrivers);
    api.get<VoucherOption[]>('/vouchers?status=CONFIRMED', token).then(setConfirmedSalesVouchers);
    api.get<PurchaseVoucherOption[]>('/purchase-vouchers?status=CONFIRMED', token).then(setConfirmedPurchaseVouchers);
    api.get<ExpenseCategory[]>('/expenses/categories', token).then(setCategories);
  }
  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const activeDrivers = drivers.filter((d) => !d.deletedAt);
  const linkedSalesIds = new Set(deliveries.filter((d) => d.status !== 'CANCELLED').map((d) => d.salesVoucherId).filter(Boolean));
  const linkedPurchaseIds = new Set(deliveries.filter((d) => d.status !== 'CANCELLED').map((d) => d.purchaseVoucherId).filter(Boolean));
  const availableSalesVouchers = confirmedSalesVouchers.filter((v) => !linkedSalesIds.has(v.id));
  const availablePurchaseVouchers = confirmedPurchaseVouchers.filter((v) => !linkedPurchaseIds.has(v.id));

  function partyName(d: DeliveryRow) {
    if (d.salesVoucher) return d.salesVoucher.customer.user.fullName;
    if (d.purchaseVoucher) return d.purchaseVoucher.manufacturer.name;
    return d.address || '—';
  }
  function voucherLabel(d: DeliveryRow) {
    if (d.salesVoucher) return d.salesVoucher.number ?? '—';
    if (d.purchaseVoucher) return d.purchaseVoucher.number ?? '—';
    return t('typeStandalone');
  }

  const filteredDeliveries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deliveries;
    return deliveries.filter((d) => {
      const haystack = [voucherLabel(d), partyName(d), d.driverName ?? '', d.wilaya ?? '', d.notes ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveries, search]);

  const filteredDrivers = useMemo(() => {
    const q = driverSearch.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) => `${d.fullName} ${d.phone ?? ''} ${d.vehicle ?? ''}`.toLowerCase().includes(q));
  }, [drivers, driverSearch]);

  function openEdit(d: DeliveryRow) {
    setEditingId(d.id);
    setNewType('');
    setCreatingFor('');
    setForm({
      driverId: d.driverId ?? '',
      address: d.address ?? '',
      wilaya: d.wilaya ?? '',
      status: d.status,
      cost: d.cost ?? '',
      billedToCustomer: d.billedToCustomer ?? '',
      billedToManufacturer: d.billedToManufacturer ?? '',
      notes: d.notes ?? '',
      categoryId: '',
    });
  }
  function closeForm() {
    setEditingId(null);
    setNewType('');
    setCreatingFor('');
    setForm(emptyForm);
  }

  async function submitVoucherForm(type: 'sales' | 'purchase', voucherId: string) {
    const path = type === 'sales' ? `/deliveries/voucher/${voucherId}` : `/deliveries/purchase-voucher/${voucherId}`;
    await api.put(path, {
      driverId: form.driverId || undefined,
      address: form.address,
      wilaya: form.wilaya,
      status: form.status,
      cost: form.cost === '' ? undefined : Number(form.cost),
      billedToCustomer: form.billedToCustomer === '' ? undefined : Number(form.billedToCustomer),
      billedToManufacturer: form.billedToManufacturer === '' ? undefined : Number(form.billedToManufacturer),
      notes: form.notes,
    }, token);
    closeForm();
    reload();
  }

  async function submitStandalone() {
    await api.post('/deliveries', {
      driverId: form.driverId || undefined,
      address: form.address,
      wilaya: form.wilaya,
      status: form.status,
      cost: form.cost === '' ? undefined : Number(form.cost),
      notes: form.notes,
      categoryId: form.categoryId || undefined,
    }, token);
    closeForm();
    reload();
  }

  async function submitEdit(d: DeliveryRow) {
    if (d.salesVoucherId) return submitVoucherForm('sales', d.salesVoucherId);
    if (d.purchaseVoucherId) return submitVoucherForm('purchase', d.purchaseVoucherId);
    await api.put(`/deliveries/${d.id}`, {
      driverId: form.driverId || undefined,
      address: form.address,
      wilaya: form.wilaya,
      status: form.status,
      cost: form.cost === '' ? undefined : Number(form.cost),
      notes: form.notes,
    }, token);
    closeForm();
    reload();
  }

  async function cancelDelivery(id: string) {
    if (!window.confirm(t('deleteConfirm'))) return;
    await api.post(`/deliveries/${id}/cancel`, {}, token);
    reload();
  }

  async function submitDriver() {
    if (!driverForm.fullName.trim()) return;
    if (editingDriverId) {
      await api.put(`/drivers/${editingDriverId}`, driverForm, token);
    } else {
      await api.post('/drivers', driverForm, token);
    }
    setDriverForm(emptyDriverForm);
    setEditingDriverId(null);
    setShowDriverForm(false);
    reload();
  }
  function editDriver(d: Driver) {
    setEditingDriverId(d.id);
    setDriverForm({ fullName: d.fullName, phone: d.phone ?? '', vehicle: d.vehicle ?? '', photoUrl: d.photoUrl ?? '', notes: d.notes ?? '' });
    setShowDriverForm(true);
  }
  async function removeDriver(id: string) {
    if (!window.confirm(t('deleteDriverConfirm'))) return;
    await api.delete(`/drivers/${id}`, token);
    reload();
  }

  function renderForm(onSubmit: () => void, linkType: 'sales' | 'purchase' | 'standalone') {
    return (
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-accent/40 bg-accent/5 p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{t('pickDriver')}</span>
          <select
            value={form.driverId}
            onChange={(e) => setForm((f) => ({ ...f, driverId: e.target.value }))}
            className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
          >
            <option value="">{t('noDriver')}</option>
            {activeDrivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName} {d.phone ? `— ${d.phone}` : ''}
              </option>
            ))}
          </select>
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
        {linkType === 'standalone' && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{t('category')}</span>
            <select
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
            >
              <option value="">{tc('empty')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
        {linkType === 'sales' && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{t('billedToCustomer')}</span>
            <input
              type="number"
              value={form.billedToCustomer}
              onChange={(e) => setForm((f) => ({ ...f, billedToCustomer: e.target.value }))}
              className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </label>
        )}
        {linkType === 'purchase' && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{t('billedToManufacturer')}</span>
            <input
              type="number"
              value={form.billedToManufacturer}
              onChange={(e) => setForm((f) => ({ ...f, billedToManufacturer: e.target.value }))}
              className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </label>
        )}
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
          <button onClick={onSubmit} className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDriverPanel((v) => !v)}
            className="rounded border border-line px-4 py-2 text-sm text-ink hover:bg-line/30"
          >
            {t('drivers')}
          </button>
          {newType === '' && editingId === null && (
            <button
              onClick={() => setNewType('sales')}
              className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              + {t('newDelivery')}
            </button>
          )}
        </div>
      </div>

      {showDriverPanel && (
        <div className="rounded-lg border border-line bg-panel p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <input
              type="search"
              value={driverSearch}
              onChange={(e) => setDriverSearch(e.target.value)}
              placeholder={t('search')}
              className="max-w-xs rounded border border-line bg-paper px-3 py-1.5 text-sm"
            />
            <button
              onClick={() => { setShowDriverForm((v) => !v); setEditingDriverId(null); setDriverForm(emptyDriverForm); }}
              className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white"
            >
              {t('newDriver')}
            </button>
          </div>

          {showDriverForm && (
            <div className="mb-3 grid grid-cols-1 gap-2 rounded border border-line bg-paper p-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('driverFullName')}</span>
                <input value={driverForm.fullName} onChange={(e) => setDriverForm((f) => ({ ...f, fullName: e.target.value }))} className="rounded border border-line bg-panel px-3 py-2 text-ink" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('driverPhone')}</span>
                <input value={driverForm.phone} onChange={(e) => setDriverForm((f) => ({ ...f, phone: e.target.value }))} className="rounded border border-line bg-panel px-3 py-2 text-ink" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('vehicle')}</span>
                <input value={driverForm.vehicle} onChange={(e) => setDriverForm((f) => ({ ...f, vehicle: e.target.value }))} className="rounded border border-line bg-panel px-3 py-2 text-ink" />
              </label>
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('driverPhoto')}</span>
                <div className="flex items-center gap-3">
                  {driverForm.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={driverForm.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                  )}
                  <ImageUploadButton folder="drivers" label={tc('uploadPhoto')} onUploaded={(url) => setDriverForm((f) => ({ ...f, photoUrl: url }))} />
                </div>
              </div>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-muted">{t('notes')}</span>
                <input value={driverForm.notes} onChange={(e) => setDriverForm((f) => ({ ...f, notes: e.target.value }))} className="rounded border border-line bg-panel px-3 py-2 text-ink" />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button onClick={submitDriver} className="rounded bg-accent px-3 py-2 text-sm font-medium text-white">{t('save')}</button>
                <button onClick={() => { setShowDriverForm(false); setEditingDriverId(null); }} className="rounded border border-line px-3 py-2 text-sm text-ink">{t('cancel')}</button>
              </div>
            </div>
          )}

          <ul className="flex flex-col gap-1.5 text-sm">
            {filteredDrivers.map((d) => (
              <li key={d.id} className={`flex items-center justify-between gap-2 rounded border border-line bg-paper px-3 py-1.5 ${d.deletedAt ? 'line-through opacity-50' : ''}`}>
                <span className="flex items-center gap-2 text-ink">
                  {d.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.photoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                  )}
                  {d.fullName} {d.phone && `— ${d.phone}`} {d.vehicle && `— ${d.vehicle}`}
                  {d.deletedAt && <span className="text-xs text-muted"> ({t('inactive')})</span>}
                </span>
                {!d.deletedAt && (
                  <span className="flex shrink-0 gap-2 text-xs">
                    <button onClick={() => editDriver(d)} className="text-accent hover:underline">{tc('edit')}</button>
                    <button onClick={() => removeDriver(d.id)} className="text-red-600 hover:underline">{t('delete')}</button>
                  </span>
                )}
              </li>
            ))}
            {filteredDrivers.length === 0 && <p className="py-2 text-center text-xs text-muted">{tc('empty')}</p>}
          </ul>
        </div>
      )}

      {newType !== '' && editingId === null && (
        <div className="flex flex-col gap-3">
          <div className="flex overflow-hidden rounded border border-line text-sm">
            {(['sales', 'purchase', 'standalone'] as const).map((ty) => (
              <button
                key={ty}
                onClick={() => { setNewType(ty); setCreatingFor(''); setForm(emptyForm); }}
                className={`px-3 py-1.5 ${newType === ty ? 'bg-accent text-white' : 'bg-panel text-ink hover:bg-line/30'}`}
              >
                {ty === 'sales' ? t('typeSales') : ty === 'purchase' ? t('typePurchase') : t('typeStandalone')}
              </button>
            ))}
          </div>

          {newType === 'sales' && (
            availableSalesVouchers.length === 0 ? (
              <p className="text-sm text-muted">{t('noVoucher')}</p>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">{t('selectVoucher')}</span>
                  <select
                    value={creatingFor || availableSalesVouchers[0]?.id}
                    onChange={(e) => setCreatingFor(e.target.value)}
                    className="max-w-sm rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
                  >
                    {availableSalesVouchers.map((v) => (
                      <option key={v.id} value={v.id}>{v.number} — {v.customer.user.fullName}</option>
                    ))}
                  </select>
                </label>
                {renderForm(() => submitVoucherForm('sales', creatingFor || availableSalesVouchers[0]?.id), 'sales')}
              </>
            )
          )}

          {newType === 'purchase' && (
            availablePurchaseVouchers.length === 0 ? (
              <p className="text-sm text-muted">{t('noPurchaseVoucher')}</p>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">{t('selectPurchaseVoucher')}</span>
                  <select
                    value={creatingFor || availablePurchaseVouchers[0]?.id}
                    onChange={(e) => setCreatingFor(e.target.value)}
                    className="max-w-sm rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
                  >
                    {availablePurchaseVouchers.map((v) => (
                      <option key={v.id} value={v.id}>{v.number} — {v.manufacturer.name}</option>
                    ))}
                  </select>
                </label>
                {renderForm(() => submitVoucherForm('purchase', creatingFor || availablePurchaseVouchers[0]?.id), 'purchase')}
              </>
            )
          )}

          {newType === 'standalone' && renderForm(submitStandalone, 'standalone')}
        </div>
      )}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('search')}
        className="w-full max-w-xs rounded border border-line bg-panel px-3 py-1.5 text-sm"
      />

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('columns.voucher')}</th>
              <th className="px-4 py-2 text-start">{t('party')}</th>
              <th className="px-4 py-2 text-start">{t('columns.driver')}</th>
              <th className="px-4 py-2 text-start">{t('columns.cost')}</th>
              <th className="px-4 py-2 text-start">{t('columns.status')}</th>
              <th className="px-4 py-2 text-start">{tc('edit')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeliveries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-sm text-muted">{tc('empty')}</td>
              </tr>
            )}
            {filteredDeliveries.map((d) => {
              const cancelled = d.status === 'CANCELLED';
              return (
                <Fragment key={d.id}>
                  <tr className={`border-t border-line ${cancelled ? 'line-through opacity-50' : ''}`}>
                    <td className="px-4 py-2 font-mono text-xs">{voucherLabel(d)}</td>
                    <td className="px-4 py-2 text-ink">{partyName(d)}</td>
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
                      {cancelled ? (
                        <span className="text-xs text-muted">{t('cancelled')}</span>
                      ) : (
                        <select
                          value={d.status}
                          onChange={(e) => {
                            const path = d.salesVoucherId
                              ? `/deliveries/voucher/${d.salesVoucherId}`
                              : d.purchaseVoucherId
                                ? `/deliveries/purchase-voucher/${d.purchaseVoucherId}`
                                : null;
                            if (path) api.put(path, { status: e.target.value }, token).then(reload);
                          }}
                          className="rounded border border-line bg-paper text-ink px-2 py-1 text-xs"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{t(`status.${s}` as never)}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {!cancelled && (
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(d)} className="text-xs text-accent hover:underline">{tc('edit')}</button>
                          <button onClick={() => cancelDelivery(d.id)} className="text-xs text-red-600 hover:underline">{t('delete')}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {editingId === d.id && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3">
                        {renderForm(() => submitEdit(d), d.salesVoucherId ? 'sales' : d.purchaseVoucherId ? 'purchase' : 'standalone')}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
