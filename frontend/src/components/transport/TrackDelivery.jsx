import { useCallback, useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { TableSkeleton } from '../common/Skeleton';
import { transportApi } from '../../api/transportApi';
import ShipmentDetail from './ShipmentDetail';
import { useShipmentRefresh } from './ShipmentsBoard';
import { ShipmentStatus, num } from './transportUi';

/**
 * Buyer: My Orders → Order Details → Track Delivery. Every shipment of the order is shown separately (an order
 * can travel on several trucks or come from several suppliers). Read-only except confirming delivery and
 * reporting issues. Refreshes on live updates and every 30 seconds.
 */
export default function TrackDelivery({ orderRef, highlight = '' }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    if (!orderRef) return;
    try {
      const result = await transportApi.orderShipments(orderRef);
      setData(result);
      setError('');
      setOpenId((current) => current || result.shipments.find((s) => s.shipmentNumber === highlight)?.id || (result.shipments.length === 1 ? result.shipments[0].id : null));
    } catch (err) {
      setError(err.status === 404 ? '' : err.message || 'Tracking is unavailable right now.');
      setData({ shipments: [], order: null });
    }
  }, [orderRef, highlight]);

  useEffect(() => { load(); }, [load]);
  useShipmentRefresh(load);

  if (!data) return <section className="rounded-xl border bg-white p-4"><h3 className="mb-3 text-sm font-bold">Track delivery</h3><TableSkeleton rows={2} /></section>;

  const items = data.order?.items || [];
  const shipped = items.reduce((s, i) => s + i.shippedQuantity, 0);
  const ordered = items.reduce((s, i) => s + i.quantity, 0);
  const delivered = items.reduce((s, i) => s + i.deliveredQuantity, 0);

  return (
    <section className="rounded-xl border bg-white p-4" aria-labelledby="track-delivery-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id="track-delivery-title" className="flex items-center gap-1.5 text-sm font-bold"><Truck className="size-4" />Track delivery</h3>
        {ordered ? <p className="text-[12px] text-muted">{num(shipped)} of {num(ordered)} units dispatched · {num(delivered)} delivered</p> : null}
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : !data.shipments.length ? (
        <p className="text-sm text-muted">The supplier has not dispatched this order yet. Shipments and tracking appear here as soon as a truck is arranged.</p>
      ) : (
        <div className="space-y-3">
          {data.shipments.length > 1 ? <p className="text-[12px] text-muted">This order is travelling in {data.shipments.length} shipments.</p> : null}
          {data.shipments.map((s, index) => (
            <div key={s.id} className="rounded-xl border border-line">
              <button type="button" onClick={() => setOpenId(openId === s.id ? null : s.id)} aria-expanded={openId === s.id} className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left">
                <span className="text-sm"><span className="font-semibold">Shipment {index + 1}</span> <span className="font-mono text-[12px] text-muted">{s.shipmentNumber}</span><span className="block text-[12px] text-muted">{s.supplier?.name} · {num(s.totalQuantity)} units{s.vehicle?.vehicleNumber ? ` · ${s.vehicle.vehicleNumber}` : ''}</span></span>
                <ShipmentStatus status={s.status} delayed={s.delayed} />
              </button>
              {openId === s.id ? <div className="border-t border-line p-3"><ShipmentDetail shipment={s} role="BUYER" compact onChange={load} /></div> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
