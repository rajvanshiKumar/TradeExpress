import { useState } from 'react';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import AddressForm, { AddressBlock } from '../../components/forms/AddressForm';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';

export default function BuyerAddresses() {
  const { user, addresses, saveAddress, deleteAddress } = useAuth();
  const { showToast } = useNotifications();
  const [editing, setEditing] = useState(null); // null = closed, {} = new, address = edit
  const [deleting, setDeleting] = useState(null);
  useDocumentTitle('Address book');

  const save = (values) => {
    saveAddress({ ...editing, ...values });
    showToast(editing?.id ? 'Address updated.' : 'Address added.');
    setEditing(null);
  };

  return (
    <div>
      <SectionHeading title="Address book" description="Delivery addresses used at checkout. Saved in this browser only." actions={<Button size="sm" icon={Plus} onClick={() => setEditing({})}>Add address</Button>} />

      {addresses.length === 0 ? (
        <div className="ts-card"><EmptyState icon={MapPin} title="No saved addresses" text="Add a delivery address to speed up checkout." action={<Button variant="navy" icon={Plus} onClick={() => setEditing({})}>Add address</Button>} /></div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="ts-card flex flex-col p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold">{address.label}</h2>
                {address.isDefault ? <Badge tone="success" icon={Star}>Default</Badge> : null}
              </div>
              <AddressBlock address={address} className="mt-2" />
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Button variant="outline" size="sm" icon={Pencil} onClick={() => setEditing(address)} aria-label={`Edit address ${address.label}`}>Edit</Button>
                {!address.isDefault ? <Button variant="ghost" size="sm" onClick={() => { saveAddress({ ...address, isDefault: true }); showToast('Default address updated.'); }} aria-label={`Make ${address.label} the default address`}>Set as default</Button> : null}
                <Button variant="dangerOutline" size="sm" icon={Trash2} onClick={() => setDeleting(address)} aria-label={`Delete address ${address.label}`} className="ml-auto">Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit address' : 'Add address'} size="lg">
        {editing ? <AddressForm key={editing.id ?? 'new'} initial={editing.id ? editing : { name: user.name, company: user.company ?? '', isDefault: addresses.length === 0 }} onSubmit={save} onCancel={() => setEditing(null)} /> : null}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)} onCancel={() => setDeleting(null)} title="Delete this address?" text={deleting ? `“${deleting.label}” will be removed from your address book.` : ''} confirmLabel="Delete address"
        onConfirm={() => { deleteAddress(deleting.id); showToast('Address deleted.', 'info'); setDeleting(null); }}
      />
    </div>
  );
}
