import { useState } from 'react';
import { CircleAlert, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ErrorState from '../../components/common/ErrorState';
import AddressForm from '../../components/forms/AddressForm';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';

/** Delivery van and location pin drawn in the TradeExpress emerald and champagne-gold palette. */
function EmptyAddressIllustration() {
  return (
    <svg viewBox="0 0 200 140" className="h-32 w-auto sm:h-36" role="img" aria-label="Delivery van with a location pin">
      <ellipse cx="100" cy="122" rx="78" ry="8" fill="#e7efe9" />
      <path d="M30 104h86V58a6 6 0 0 0-6-6H36a6 6 0 0 0-6 6z" fill="#0f5132" />
      <path d="M116 70h26l18 20v14h-44z" fill="#14724a" />
      <path d="M124 76h16l11 12h-27z" fill="#d9f2e5" />
      <rect x="38" y="62" width="40" height="6" rx="3" fill="#c8a96a" />
      <rect x="38" y="74" width="26" height="5" rx="2.5" fill="#c8a96a" opacity=".6" />
      <circle cx="58" cy="106" r="11" fill="#1f2937" /><circle cx="58" cy="106" r="4.5" fill="#e5e7eb" />
      <circle cx="138" cy="106" r="11" fill="#1f2937" /><circle cx="138" cy="106" r="4.5" fill="#e5e7eb" />
      <path d="M166 12c-11 0-19 8-19 18 0 14 19 32 19 32s19-18 19-32c0-10-8-18-19-18z" fill="#c8a96a" />
      <circle cx="166" cy="30" r="7" fill="#fff" />
    </svg>
  );
}

function AddressCardSkeleton() {
  return (
    <li className="ts-card animate-pulse p-5" aria-hidden="true">
      <div className="h-4 w-40 rounded bg-navy-100" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-3/4 rounded bg-navy-50" /><div className="h-3 w-1/2 rounded bg-navy-50" /><div className="h-3 w-2/3 rounded bg-navy-50" />
      </div>
      <div className="mt-5 h-9 w-full rounded-full bg-navy-50" />
    </li>
  );
}

export default function BuyerAddresses() {
  const { user, addresses, addressesLoading, addressesError, reloadAddresses, saveAddress, deleteAddress, setDefaultAddress } = useAuth();
  const { showToast } = useNotifications();
  const [editing, setEditing] = useState(null); // null = closed, {} = new, address = edit
  const [deleting, setDeleting] = useState(null);
  const [busyId, setBusyId] = useState(null); // address with a delete / default request in flight
  const [actionError, setActionError] = useState('');
  useDocumentTitle('Address book');

  const firstLoad = addressesLoading && addresses.length === 0;
  const openNew = () => {
    const [firstName = '', ...rest] = String(user?.name ?? '').trim().split(/\s+/);
    setActionError('');
    setEditing({ firstName, lastName: rest.join(' '), isDefault: addresses.length === 0 });
  };

  // Errors are thrown back to AddressForm, which shows them; success only after the server confirms
  const save = async (values) => {
    const isEdit = Boolean(editing?.id);
    await saveAddress(isEdit ? { ...values, id: editing.id } : values);
    setEditing(null);
    showToast(isEdit ? 'Address updated.' : 'Address saved.');
  };

  const makeDefault = async (address) => {
    if (busyId) return;
    setBusyId(address.id);
    setActionError('');
    try {
      await setDefaultAddress(address.id);
      showToast('Default shipping address updated.');
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || busyId) return;
    setBusyId(deleting.id);
    setActionError('');
    try {
      await deleteAddress(deleting.id);
      setDeleting(null);
      showToast('Address deleted.', 'info');
    } catch (error) {
      setDeleting(null);
      setActionError(error.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">Address book</h1>
        {addresses.length > 0 ? <Button size="sm" variant="navy" icon={Plus} onClick={openNew}>Add an address</Button> : null}
      </div>

      {actionError ? (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{actionError}
        </p>
      ) : null}

      {firstLoad ? (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading addresses">
          <AddressCardSkeleton /><AddressCardSkeleton />
        </ul>
      ) : addressesError && addresses.length === 0 ? (
        <div className="ts-card"><ErrorState title="We couldn't load your addresses" text={addressesError} onRetry={reloadAddresses} /></div>
      ) : addresses.length === 0 ? (
        <section className="ts-card flex flex-col items-center px-6 py-14 text-center" aria-labelledby="no-addresses-title">
          <EmptyAddressIllustration />
          <h2 id="no-addresses-title" className="mt-6 text-lg font-bold text-navy-900">No addresses saved yet.</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted">Once you&apos;ve added an address, it will be saved here.</p>
          <Button variant="navy" icon={Plus} className="mt-6" onClick={openNew}>Add an address</Button>
        </section>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {addresses.map((address) => {
            const fullName = [address.firstName, address.lastName].filter(Boolean).join(' ') || address.name;
            const busy = busyId === address.id;
            return (
              <li key={address.id} className={`ts-card flex flex-col p-5 ${address.isDefault ? 'ring-2 ring-emerald-600/70' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-base font-bold text-navy-900">{fullName}</p>
                  {address.isDefault ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      <Star className="size-3.5 fill-current text-[#c8a96a]" aria-hidden="true" />Default shipping address
                    </span>
                  ) : null}
                </div>
                <address className="mb-5 mt-3 space-y-0.5 text-sm not-italic text-ink">
                  <p>{address.street}{address.apartment ? `, ${address.apartment}` : ''}</p>
                  <p>{address.city}, {address.state} {address.postalCode}</p>
                  <p>{address.country}</p>
                  <p className="pt-1 text-muted">{address.phone}</p>
                </address>
                <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-4">
                  <Button variant="outline" size="sm" icon={Pencil} disabled={busy} onClick={() => { setActionError(''); setEditing(address); }} aria-label={`Edit address for ${fullName}`}>Edit</Button>
                  {!address.isDefault ? (
                    <Button variant="ghost" size="sm" loading={busy && !deleting} disabled={Boolean(busyId)} onClick={() => makeDefault(address)} aria-label={`Set ${address.street} as default shipping address`}>Set as default</Button>
                  ) : null}
                  <Button variant="dangerOutline" size="sm" icon={Trash2} disabled={Boolean(busyId)} onClick={() => setDeleting(address)} aria-label={`Delete address ${address.street}`} className="ml-auto">Delete</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit address' : 'Add address'} size="lg">
        {editing ? (
          <AddressForm
            key={editing.id ?? 'new'}
            initial={editing}
            lockDefault={Boolean(editing.id && editing.isDefault)}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)} loading={Boolean(deleting) && busyId === deleting?.id}
        onCancel={() => setDeleting(null)} onConfirm={confirmDelete}
        title="Delete this address?" confirmLabel="Delete address"
        text={deleting ? `${deleting.street}, ${deleting.city} will be removed from your address book.${deleting.isDefault && addresses.length > 1 ? ' Your most recent other address will become the default.' : ''}` : ''}
      />
    </div>
  );
}
