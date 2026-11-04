import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Clock, History, Minus, RefreshCw, Settings, SlidersHorizontal } from 'lucide-react';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import ErrorState from '../common/ErrorState';
import { TableSkeleton } from '../common/Skeleton';
import { formatDate } from '../../utils/formatDate';
import { fetchProductInventoryDetail, fetchProductInventoryHistory } from '../../api/supplierInventoryApi';

// Plain-language labels for movement reasons
export const MOVEMENT_LABELS = {
  ORDER_RESERVED: 'Reserved for order',
  ORDER_COMMITTED: 'Committed to order',
  PAYMENT_CONFIRMED: 'Payment confirmed',
  ORDER_CANCELLED: 'Order cancelled',
  ORDER_REFUNDED: 'Refunded before dispatch',
  RESERVATION_EXPIRED: 'Reservation expired',
  ORDER_FULFILLED: 'Shipped',
  RETURN_RESTOCKED: 'Return restocked',
  RESTOCK: 'Restock received',
  MANUAL_ADJUSTMENT: 'Manual adjustment',
  CYCLE_COUNT_CORRECTION: 'Cycle count',
  DAMAGE_WRITE_OFF: 'Damage write-off',
  WAREHOUSE_TRANSFER: 'Warehouse transfer',
  RETURN_RESTORED: 'Return restored',
  AUDIT_CORRECTION: 'Audit correction',
  OTHER: 'Other adjustment',
};

const HOLD_STYLES = {
  RESERVED: 'bg-sky-50 text-sky-800 ring-sky-200',
  COMMITTED: 'bg-violet-50 text-violet-800 ring-violet-200',
};

function Figure({ label, value, unit, hint, tone }) {
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 font-display text-xl font-black">{Number(value || 0).toLocaleString('en-IN')} <span className="text-xs font-semibold opacity-70">{unit}</span></p>
      <p className="mt-0.5 text-[11px] opacity-70">{hint}</p>
    </div>
  );
}

/** Signed change for one bucket, or null when it did not move. */
function delta(previous, next) {
  const change = (next ?? 0) - (previous ?? 0);
  return change === 0 ? null : change;
}

function Change({ value, label }) {
  if (value === null) return null;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono text-[11px] font-bold ${value > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
      <Icon className="size-3" />{value > 0 ? `+${value}` : value} {label}
    </span>
  );
}

/**
 * Side panel for one product: live figures, the open orders holding its stock, and its movement history.
 */
export default function InventoryDetailDrawer({ product, open, onClose, onAdjust, onSettings, refreshKey = 0, showSupplier = false }) {
  const [detail, setDetail] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const productId = product?.id;
  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError('');
    try {
      const [detailData, historyData] = await Promise.all([
        fetchProductInventoryDetail(productId),
        fetchProductInventoryHistory(productId, { limit: 50 }),
      ]);
      setDetail(detailData);
      setLogs(historyData?.logs || []);
    } catch (err) {
      setError(err.message || 'Could not load this product\'s inventory.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  // Reload when opened, and again when a live update for this product arrives
  useEffect(() => {
    if (open) load();
  }, [open, load, refreshKey]);

  const figures = detail?.product || product;
  const unit = figures?.unit || product?.unit || 'units';

  return (
    <Drawer open={open} onClose={onClose} title={product ? product.name : 'Product inventory'} width="max-w-2xl"
      footer={product ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" icon={Settings} onClick={() => onSettings(figures)}>Alert level & location</Button>
          <Button variant="primary" size="sm" icon={SlidersHorizontal} onClick={() => onAdjust(figures)}>Adjust stock</Button>
        </div>
      ) : null}
    >
      {!product ? null : error ? (
        <div className="p-4"><ErrorState title="Inventory unavailable" text={error} onRetry={load} /></div>
      ) : (
        <div className="space-y-5 p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="font-mono font-semibold text-ink">{product.sku}</span>
            {showSupplier && product.supplierName ? <span>Supplier: <span className="font-semibold text-ink">{product.supplierName}</span></span> : null}
            <span>Warehouse: <span className="font-semibold text-ink">{figures?.warehouseLocation || 'Not set'}</span></span>
            <span>Alert at: <span className="font-semibold text-ink">{figures?.lowStockThreshold ?? 10} {unit}</span></span>
            <button type="button" onClick={load} className="ml-auto inline-flex items-center gap-1 font-semibold text-navy-700 hover:underline">
              <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {/* On hand = reserved + committed + available */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Figure label="On hand" value={figures?.stock} unit={unit} hint="In the warehouse" tone="border-slate-200 bg-white text-slate-900" />
            <Figure label="Reserved" value={figures?.reservedStock} unit={unit} hint="Awaiting payment" tone="border-sky-200 bg-sky-50/60 text-sky-900" />
            <Figure label="Committed" value={figures?.committedStock} unit={unit} hint="Paid, not shipped" tone="border-violet-200 bg-violet-50/60 text-violet-900" />
            <Figure label="Available" value={figures?.availableStock} unit={unit} hint="Buyers can order" tone="border-emerald-200 bg-emerald-50/60 text-emerald-900" />
          </div>

          {/* Orders holding stock */}
          <section>
            <h3 className="mb-2 text-sm font-bold text-ink">Orders holding this stock</h3>
            {loading && !detail ? <TableSkeleton rows={2} /> : !detail?.holds?.length ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-xs text-muted">No open orders are holding units of this product.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {detail.holds.map((hold) => (
                  <li key={hold.orderId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-xs">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${HOLD_STYLES[hold.state] || ''}`}>{hold.state === 'RESERVED' ? 'Reserved' : 'Committed'}</span>
                    <Link to={showSupplier ? `/super-admin/orders?order=${hold.orderNumber}` : `/supplier/orders?order=${hold.orderNumber}`} className="font-mono font-semibold text-navy-700 hover:underline">#{hold.orderNumber}</Link>
                    <span className="text-muted">{hold.buyer}</span>
                    <span className="ml-auto font-mono font-bold text-ink">{hold.quantity.toLocaleString('en-IN')} {unit}</span>
                    {hold.state === 'RESERVED' && hold.reservationExpiresAt ? (
                      <span className="flex w-full items-center gap-1 text-[11px] text-amber-700"><Clock className="size-3" /> Released at {formatDate(hold.reservationExpiresAt)} if unpaid</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Movement history */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink"><History className="size-4" /> Movement history</h3>
            {loading && !logs.length ? <TableSkeleton rows={4} /> : !logs.length ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-xs text-muted">No stock movements recorded yet.</p>
            ) : (
              <ol className="space-y-2">
                {logs.map((log) => {
                  const changes = [
                    [delta(log.previousStock, log.newStock), 'on hand'],
                    [delta(log.previousReserved, log.newReserved), 'reserved'],
                    [delta(log.previousCommitted, log.newCommitted), 'committed'],
                  ].filter(([value]) => value !== null);
                  return (
                    <li key={log.id} className="rounded-xl border border-line px-3 py-2.5 text-xs">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-ink">{MOVEMENT_LABELS[log.reason] || log.reason}</span>
                        {log.orderId ? <span className="font-mono text-[11px] text-muted">#{log.orderId}</span> : null}
                        <span className="ml-auto font-mono text-[11px] text-muted">{formatDate(log.createdAt)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {changes.length ? changes.map(([value, label]) => <Change key={label} value={value} label={label} />) : (
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-muted"><Minus className="size-3" /> No quantity change</span>
                        )}
                      </div>
                      {log.notes ? <p className="mt-1 text-[11px] text-muted">{log.notes}</p> : null}
                      <p className="mt-0.5 text-[11px] text-muted">By {log.actorName || 'System'}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {figures && figures.availableStock <= (figures.lowStockThreshold ?? 10) ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {figures.availableStock <= 0 ? 'Buyers cannot order this product until you restock.' : `Only ${figures.availableStock} ${unit} left to sell, at or below your alert level.`}
            </p>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}
