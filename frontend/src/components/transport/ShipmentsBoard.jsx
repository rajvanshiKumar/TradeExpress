import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Search, Truck } from 'lucide-react';
import Button from '../common/Button';
import Drawer from '../common/Drawer';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import { TableSkeleton } from '../common/Skeleton';
import { connectSocket } from '../../services/socketService';
import { transportApi } from '../../api/transportApi';
import ShipmentDetail from './ShipmentDetail';
import { ShipmentStatus, STATUS_LABELS, humanize, inr, num, when } from './transportUi';

export const STATUS_FILTERS = [
  { id: '', label: 'All' },
  { id: 'AWAITING_TRANSPORT', label: 'Awaiting transport' },
  { id: 'TRANSPORT_REQUESTED', label: 'Requested' },
  { id: 'TRANSPORT_ASSIGNED,PICKUP_SCHEDULED', label: 'Truck assigned' },
  { id: 'LOADING_IN_PROGRESS,LOADED', label: 'Loading' },
  { id: 'PICKED_UP,IN_TRANSIT,OUT_FOR_DELIVERY,DELIVERED_PENDING_CONFIRMATION', label: 'In transit' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'DELIVERY_FAILED,RETURN_IN_TRANSIT,RETURNED', label: 'Failed / returns' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

const REFRESH_MS = 30000;

/** Shared hook: re-run `reload` when a shipment changes (socket) and every 30 s as a fallback. */
export function useShipmentRefresh(reload) {
  const ref = useRef(reload);
  useEffect(() => { ref.current = reload; }, [reload]);
  useEffect(() => {
    const socket = connectSocket();
    let timer = null;
    const onUpdate = () => { clearTimeout(timer); timer = setTimeout(() => ref.current?.(true), 600); };
    socket?.on('shipment:updated', onUpdate);
    const poll = setInterval(() => { if (document.visibilityState === 'visible') ref.current?.(true); }, REFRESH_MS);
    return () => { socket?.off('shipment:updated', onUpdate); clearInterval(poll); clearTimeout(timer); };
  }, []);
}

/**
 * Searchable shipment list with a details drawer. `role` is the backend role; `filters` presets server filters
 * (e.g. { delayed: 'true' }); `openNumber` opens a shipment on load (from a notification link).
 */
export default function ShipmentsBoard({ role, filters = {}, showSupplier = false, freightColumns = false, openNumber = '', emptyText, onChanged, statusTabs = true }) {
  const [status, setStatus] = useState(filters.status || '');
  const [search, setSearch] = useState(openNumber || '');
  const [data, setData] = useState({ shipments: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const filterKey = JSON.stringify(filters);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const result = await transportApi.shipments({ ...JSON.parse(filterKey), status: status || JSON.parse(filterKey).status, search, page, limit: 20 });
      setData(result);
    } catch (err) {
      if (!silent) setError(err.message || 'Could not load shipments.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filterKey, status, search, page]);

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      setDetail(await transportApi.shipment(id));
    } catch (err) {
      setError(err.message || 'Could not open the shipment.');
      setOpenId(null);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    if (openNumber && data.shipments.length === 1 && data.shipments[0].shipmentNumber === openNumber && !openId) setOpenId(data.shipments[0].id);
  }, [openNumber, data.shipments, openId]);

  useEffect(() => {
    setDetail(null);
    loadDetail(openId);
  }, [openId, loadDetail]);

  useShipmentRefresh(useCallback((silent) => {
    load(silent);
    if (openId) loadDetail(openId);
  }, [load, loadDetail, openId]));

  const afterChange = (updated) => {
    if (updated) setDetail(updated);
    else loadDetail(openId);
    load(true);
    onChanged?.();
  };

  return (
    <div className="space-y-4">
      {statusTabs ? (
        <div className="ts-slim-scrollbar flex gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((f) => (
            <button key={f.id || 'all'} type="button" onClick={() => { setStatus(f.id); setPage(1); }} className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${status === f.id ? 'bg-emerald-800 text-white' : 'bg-white text-slate-700 ring-1 ring-line hover:bg-surface'}`}>
              {f.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input className="ts-input pl-9" aria-label="Search shipments" placeholder="Shipment, order, booking or truck number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => load()} disabled={loading}>Refresh</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        {loading ? <TableSkeleton rows={5} /> : error ? <ErrorState title="Shipments unavailable" text={error} onRetry={() => load()} /> : !data.shipments.length ? (
          <EmptyState icon={Truck} title="No shipments here" text={emptyText || 'Shipments appear here once they are created from confirmed orders.'} />
        ) : (
          <div className="ts-slim-scrollbar overflow-x-auto">
            <table className="ts-table [&_td]:px-3 [&_th]:px-3">
              <thead><tr><th>Shipment</th>{showSupplier ? <th>Supplier</th> : null}<th>Goods</th><th>Truck</th><th>Status</th>{freightColumns ? <><th className="text-right">Freight</th><th>Payer / payment</th></> : <><th>Expected</th><th>Last update</th></>}</tr></thead>
              <tbody>
                {data.shipments.map((s) => (
                  <tr key={s.id} className="cursor-pointer hover:bg-surface" onClick={() => setOpenId(s.id)}>
                    <td>
                      <button type="button" className="font-mono text-[13px] font-bold text-navy-800 hover:underline" onClick={(e) => { e.stopPropagation(); setOpenId(s.id); }}>{s.shipmentNumber}</button>
                      <p className="text-[11px] text-muted">Order #{s.order?.orderNumber}{s.order?.buyer ? ` · ${s.order.buyer}` : ''}</p>
                    </td>
                    {showSupplier ? <td className="max-w-[10rem] truncate text-[13px]">{s.supplier?.name}</td> : null}
                    <td className="max-w-[14rem] text-[13px]"><p className="truncate">{s.items.map((i) => i.productName).join(', ')}</p><p className="text-[11px] text-muted">{num(s.totalQuantity)} units{s.totalWeightKg ? ` · ${num(s.totalWeightKg)} kg` : ''}</p></td>
                    <td className="whitespace-nowrap text-[13px]">{s.vehicle?.vehicleNumber || <span className="text-muted">—</span>}{s.transportMethod === 'TRADEEXPRESS_MANAGED' ? <p className="text-[11px] text-muted">TradeExpress</p> : null}</td>
                    <td><ShipmentStatus status={s.status} delayed={s.delayed} />{s.openIssues ? <p className="mt-0.5 text-[11px] font-semibold text-rose-700">{s.openIssues} open issue{s.openIssues > 1 ? 's' : ''}</p> : null}</td>
                    {freightColumns ? (
                      <>
                        <td className="whitespace-nowrap text-right font-mono text-[13px] font-bold">{inr(s.freight?.charges)}</td>
                        <td className="whitespace-nowrap text-[12px]">{humanize(s.freight?.payer)} pays<p className={s.freight?.paymentStatus === 'PENDING' ? 'font-semibold text-amber-800' : 'text-muted'}>{humanize(s.freight?.paymentStatus)}</p></td>
                      </>
                    ) : (
                      <>
                        <td className="whitespace-nowrap text-[12px]">{when(s.estimatedDeliveryAt)}</td>
                        <td className="max-w-[12rem] text-[12px]"><p className="truncate">{s.lastReportedLocation || STATUS_LABELS[s.status]}</p><p className="text-muted">{when(s.updatedAt)}</p></td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-muted">
            <span>Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} shipments</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        ) : null}
      </div>

      <Drawer open={Boolean(openId)} onClose={() => { setOpenId(null); setDetail(null); }} title={detail ? `Shipment ${detail.shipmentNumber}` : 'Shipment'} width="max-w-3xl">
        <div className="p-4">{detail ? <ShipmentDetail shipment={detail} role={role} onChange={afterChange} /> : <TableSkeleton rows={6} />}</div>
      </Drawer>
    </div>
  );
}
