import { useEffect, useMemo, useState } from 'react';
import { PackagePlus } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import CustomSelect from '../common/CustomSelect';
import EmptyState from '../common/EmptyState';
import { TableSkeleton } from '../common/Skeleton';
import { transportApi } from '../../api/transportApi';
import { FormError, FormField, addressLine, num } from './transportUi';

/**
 * Creates a shipment from a confirmed, paid order. Entering less than the remaining quantity leaves the rest for
 * further trucks (partial shipments); the backend refuses anything above what is left.
 */
export default function CreateShipmentModal({ open, onClose, onCreated, initialOrder = '' }) {
  const [orders, setOrders] = useState(null);
  const [orderId, setOrderId] = useState('');
  const [quantities, setQuantities] = useState({});
  const [form, setForm] = useState({ totalPackages: '', totalWeightKg: '', handlingRequirements: '', deliveryRequiredBy: '', line1: '', city: '', postalCode: '', contactPhone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOrders(null);
    setError('');
    transportApi.shippableOrders().then((list) => {
      setOrders(list || []);
      const preset = (list || []).find((o) => o.id === initialOrder || o.orderNumber === initialOrder);
      setOrderId(preset ? preset.id : '');
    }).catch((err) => { setOrders([]); setError(err.message || 'Could not load orders.'); });
  }, [open, initialOrder]);

  const order = useMemo(() => orders?.find((o) => o.id === orderId) || null, [orders, orderId]);

  useEffect(() => {
    if (!order) return;
    setQuantities(Object.fromEntries(order.items.filter((i) => i.remainingQuantity > 0).map((i) => [i.orderItemId, i.remainingQuantity])));
  }, [order]);

  const estimatedWeight = order ? order.items.reduce((sum, i) => sum + (i.unitWeightKg ? i.unitWeightKg * Number(quantities[i.orderItemId] || 0) : 0), 0) : 0;
  const set = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (busy || !order) return;
    const items = Object.entries(quantities).filter(([, q]) => Number(q) > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity: Number(quantity) }));
    if (!items.length) { setError('Enter a quantity for at least one product.'); return; }
    setBusy(true);
    setError('');
    try {
      const pickupAddress = form.line1 || form.city || form.postalCode || form.contactPhone ? { line1: form.line1, city: form.city, postalCode: form.postalCode, contactPhone: form.contactPhone } : undefined;
      const created = await transportApi.createShipment({
        orderId: order.id,
        items,
        totalPackages: form.totalPackages || undefined,
        totalWeightKg: form.totalWeightKg || (estimatedWeight ? Math.round(estimatedWeight) : undefined),
        handlingRequirements: form.handlingRequirements,
        deliveryRequiredBy: form.deliveryRequiredBy ? new Date(form.deliveryRequiredBy).toISOString() : undefined,
        pickupAddress,
      });
      onCreated?.(created);
    } catch (err) {
      setError(err.message || 'The shipment could not be created.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="Create shipment" description="Choose a confirmed order and the quantities for this truck. Ship the rest later in further shipments." size="lg">
      {orders === null ? <TableSkeleton rows={3} /> : !orders.length ? (
        <EmptyState icon={PackagePlus} title="No orders ready to ship" text="Orders appear here once they are confirmed and paid (or Cash on Delivery) and still have units left to ship." />
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormField id="cs-order" label="Order" required>
            <CustomSelect id="cs-order" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Choose an order" options={orders.map((o) => ({ value: o.id, label: `#${o.orderNumber} · ${o.buyer}`, description: `${num(o.remainingQuantity)} units left to ship · ${o.paymentStatus.toLowerCase()}` }))} />
          </FormField>

          {order ? (
            <>
              <p className="rounded-xl bg-surface px-3 py-2 text-[13px] text-muted">Deliver to: {addressLine(order.deliveryAddress)}</p>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.orderItemId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1"><span className="font-semibold">{item.productName}</span><span className="block text-[12px] text-muted">Ordered {num(item.quantity)} · already on shipments {num(item.allocatedQuantity)} · left {num(item.remainingQuantity)} {item.unit}</span></span>
                    <label className="flex items-center gap-2 text-[12px] text-muted">This truck
                      <input type="number" min={0} max={item.remainingQuantity} disabled={!item.remainingQuantity} aria-label={`Quantity of ${item.productName} for this shipment`} className="ts-input w-28 text-right" value={quantities[item.orderItemId] ?? 0} onChange={(e) => setQuantities((q) => ({ ...q, [item.orderItemId]: Math.min(item.remainingQuantity, Math.max(0, Number(e.target.value))) }))} />
                    </label>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField id="cs-packages" label="Number of packages"><input id="cs-packages" type="number" min={1} className="ts-input" value={form.totalPackages} onChange={(e) => set('totalPackages', e.target.value)} /></FormField>
                <FormField id="cs-weight" label="Cargo weight (kg)" hint={estimatedWeight ? `Estimated from product weights: ${num(Math.round(estimatedWeight))} kg` : 'Used to check truck capacity.'}><input id="cs-weight" type="number" min={1} className="ts-input" value={form.totalWeightKg} placeholder={estimatedWeight ? String(Math.round(estimatedWeight)) : ''} onChange={(e) => set('totalWeightKg', e.target.value)} /></FormField>
                <FormField id="cs-due" label="Deliver by"><input id="cs-due" type="date" className="ts-input" value={form.deliveryRequiredBy} onChange={(e) => set('deliveryRequiredBy', e.target.value)} /></FormField>
                <FormField id="cs-handling" label="Handling requirements"><input id="cs-handling" className="ts-input" placeholder="e.g. Fragile, keep dry" value={form.handlingRequirements} onChange={(e) => set('handlingRequirements', e.target.value)} /></FormField>
              </div>
              <details className="rounded-xl border border-line px-3 py-2 text-sm">
                <summary className="cursor-pointer font-semibold">Pickup address (defaults to your warehouse address)</summary>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input className="ts-input sm:col-span-2" aria-label="Pickup street address" placeholder="Street / warehouse" value={form.line1} onChange={(e) => set('line1', e.target.value)} />
                  <input className="ts-input" aria-label="Pickup city" placeholder="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
                  <input className="ts-input" aria-label="Pickup PIN code" placeholder="PIN code" inputMode="numeric" maxLength={6} value={form.postalCode} onChange={(e) => set('postalCode', e.target.value.replace(/\D/g, ''))} />
                  <input className="ts-input" aria-label="Pickup contact phone" placeholder="Pickup contact phone" inputMode="numeric" maxLength={10} value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value.replace(/\D/g, ''))} />
                </div>
              </details>
            </>
          ) : null}
          <FormError message={error} />
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" loading={busy} disabled={busy || !order}>Create shipment</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
