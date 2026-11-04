import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Hourglass,
  Lock,
  Package,
  Plus,
  RefreshCw,
  Scale,
  Search,
  SlidersHorizontal,
  Warehouse,
} from 'lucide-react';
import CustomSelect from '../../components/common/CustomSelect';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import InventoryDetailDrawer from '../../components/inventory/InventoryDetailDrawer';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { connectSocket } from '../../services/socketService';
import {
  fetchSupplierInventory,
  adjustSupplierStock,
  updateSupplierInventorySettings,
  fetchInventoryReconciliation,
} from '../../api/supplierInventoryApi';

const REASON_OPTIONS = [
  { value: 'RESTOCK', label: 'Restock shipment received from manufacturing / factory' },
  { value: 'MANUAL_ADJUSTMENT', label: 'Manual inventory count adjustment' },
  { value: 'CYCLE_COUNT_CORRECTION', label: 'Routine cycle count verification' },
  { value: 'DAMAGE_WRITE_OFF', label: 'Damaged, expired or defective units write-off' },
  { value: 'WAREHOUSE_TRANSFER', label: 'Warehouse / bin location transfer' },
  { value: 'RETURN_RESTORED', label: 'Buyer return inspected & restored to stock' },
  { value: 'AUDIT_CORRECTION', label: 'Statutory or internal audit correction' },
  { value: 'OTHER', label: 'Other operational adjustment (specify in notes)' },
];

const EMPTY_METRICS = {
  totalProducts: 0,
  totalPhysicalStock: 0,
  totalReservedStock: 0,
  totalCommittedStock: 0,
  totalAvailableStock: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
};

const num = (value) => Number(value || 0).toLocaleString('en-IN');

function stockStatusOf(available, threshold) {
  if (available <= 0) return 'OUT_OF_STOCK';
  if (available <= threshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

function MetricCard({ label, value, hint, icon: Icon, tone }) {
  return (
    <div className={`rounded-2xl border p-3.5 shadow-2xs ${tone.card}`}>
      <div className={`flex items-center justify-between text-xs font-semibold ${tone.label}`}>
        <span>{label}</span>
        <Icon className={`size-4 ${tone.icon}`} />
      </div>
      <p className={`mt-2 font-display text-2xl font-black ${tone.value}`}>{value}</p>
      <p className={`mt-0.5 text-[10px] ${tone.hint}`}>{hint}</p>
    </div>
  );
}

const TONES = {
  neutral: { card: 'border-slate-200/90 bg-white', label: 'text-slate-500', icon: 'text-slate-400', value: 'text-slate-900', hint: 'text-slate-400' },
  onHand: { card: 'border-slate-200/90 bg-white', label: 'text-slate-500', icon: 'text-emerald-700', value: 'text-emerald-900', hint: 'text-slate-400' },
  reserved: { card: 'border-sky-200/90 bg-sky-50/40', label: 'text-sky-900', icon: 'text-sky-600', value: 'text-sky-900', hint: 'text-sky-700/80' },
  committed: { card: 'border-violet-200/90 bg-violet-50/40', label: 'text-violet-900', icon: 'text-violet-600', value: 'text-violet-900', hint: 'text-violet-700/80' },
  available: { card: 'border-emerald-200/90 bg-emerald-50/40', label: 'text-emerald-900', icon: 'text-emerald-700', value: 'text-emerald-950', hint: 'text-emerald-700/80' },
  low: { card: 'border-amber-200/90 bg-amber-50/40', label: 'text-amber-900', icon: 'text-amber-600', value: 'text-amber-900', hint: 'text-amber-700/80' },
  out: { card: 'border-rose-200/90 bg-rose-50/40', label: 'text-rose-900', icon: 'text-rose-600', value: 'text-rose-900', hint: 'text-rose-700/80' },
};

/**
 * Real-time inventory for a supplier's own catalogue. Super Admins get the same screen across all suppliers,
 * plus a check that stored figures match open orders.
 */
export default function SupplierInventory() {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  useDocumentTitle(isAdmin ? 'Platform Inventory — Super Admin' : 'Inventory Management — Supplier Portal');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ metrics: EMPTY_METRICS, products: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 1 } });

  // Filters & sorting
  const [search, setSearch] = useState('');
  const [stockStatus, setStockStatus] = useState('all');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);

  const [socketConnected, setSocketConnected] = useState(false);
  const [lastLiveUpdate, setLastLiveUpdate] = useState(null);

  // Detail panel and forms
  const [detailProduct, setDetailProduct] = useState(null);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const [adjustModalProduct, setAdjustModalProduct] = useState(null);
  const [settingsModalProduct, setSettingsModalProduct] = useState(null);

  const [adjustType, setAdjustType] = useState('ADD');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('RESTOCK');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const [thresholdInput, setThresholdInput] = useState(10);
  const [locationInput, setLocationInput] = useState('');
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);

  // Super Admin: stored figures vs open orders
  const [reconciliation, setReconciliation] = useState(null);

  const loadInventory = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await fetchSupplierInventory({ search, stockStatus, sortBy, sortOrder, page, limit: 20 });
      if (result) setData({ ...result, metrics: { ...EMPTY_METRICS, ...result.metrics } });
    } catch (err) {
      if (!silent) {
        // 401/403 mean the stored sign-in is not this supplier's (expired, or another account signed in elsewhere)
        const accountProblem = err.status === 401 || (err.status === 403 && err.data?.code === 'ROLE_NOT_ALLOWED');
        showToast(
          accountProblem
            ? 'Your sign-in has changed or expired. Please sign in again with your supplier account to manage inventory.'
            : err.message || 'Failed to load inventory from server.',
          'error',
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, stockStatus, sortBy, sortOrder, page, showToast]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const loadReconciliation = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setReconciliation(await fetchInventoryReconciliation());
    } catch {
      setReconciliation(null);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadReconciliation();
  }, [loadReconciliation]);

  // Live updates patch the row at once; totals are refreshed from the server shortly after (one request per burst)
  const loadRef = useRef(loadInventory);
  const detailIdRef = useRef(null);
  useEffect(() => {
    loadRef.current = loadInventory;
    detailIdRef.current = detailProduct?.id || null;
  }, [loadInventory, detailProduct]);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return undefined;
    let refreshTimer = null;

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);
    if (socket.connected) setSocketConnected(true);

    const handleInventoryUpdate = (payload) => {
      setData((prev) => ({
        ...prev,
        products: prev.products.map((p) => {
          if (p.id !== payload.productId) return p;
          const stock = payload.stock ?? p.stock;
          const reservedStock = payload.reservedStock ?? p.reservedStock;
          const committedStock = payload.committedStock ?? p.committedStock;
          const availableStock = payload.availableStock ?? Math.max(0, stock - reservedStock - committedStock);
          const lowStockThreshold = payload.lowStockThreshold ?? p.lowStockThreshold;
          return {
            ...p,
            stock,
            reservedStock,
            committedStock,
            availableStock,
            lowStockThreshold,
            warehouseLocation: payload.warehouseLocation ?? p.warehouseLocation,
            stockStatus: stockStatusOf(availableStock, lowStockThreshold),
            updatedAt: payload.timestamp || new Date().toISOString(),
          };
        }),
      }));
      setLastLiveUpdate(new Date());
      if (payload.productId === detailIdRef.current) setDetailRefreshKey((key) => key + 1);
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => loadRef.current(true), 1500);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('inventory:updated', handleInventoryUpdate);
    return () => {
      clearTimeout(refreshTimer);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('inventory:updated', handleInventoryUpdate);
    };
  }, []);

  const openAdjustModal = (product) => {
    setAdjustModalProduct(product);
    setAdjustType('ADD');
    setAdjustQty('');
    setAdjustReason('RESTOCK');
    setAdjustNotes('');
  };

  const openSettingsModal = (product) => {
    setSettingsModalProduct(product);
    setThresholdInput(product.lowStockThreshold ?? 10);
    setLocationInput(product.warehouseLocation || '');
  };

  const handleStockAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (!adjustModalProduct || adjustSubmitting) return;

    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty < 0 || (adjustType !== 'SET' && qty === 0)) {
      showToast('Please enter a valid quantity greater than zero.', 'error');
      return;
    }

    setAdjustSubmitting(true);
    try {
      await adjustSupplierStock(adjustModalProduct.id, { adjustmentType: adjustType, quantity: qty, reason: adjustReason, notes: adjustNotes });
      showToast(`Inventory updated for SKU ${adjustModalProduct.sku}.`, 'success');
      setAdjustModalProduct(null);
      setDetailRefreshKey((key) => key + 1);
      loadInventory(true);
    } catch (err) {
      showToast(err.message || 'Failed to adjust stock.', 'error');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    if (!settingsModalProduct || settingsSubmitting) return;

    setSettingsSubmitting(true);
    try {
      await updateSupplierInventorySettings(settingsModalProduct.id, {
        lowStockThreshold: parseInt(thresholdInput, 10) || 0,
        warehouseLocation: locationInput,
      });
      showToast(`Settings saved for SKU ${settingsModalProduct.sku}.`, 'success');
      setSettingsModalProduct(null);
      setDetailRefreshKey((key) => key + 1);
      loadInventory(true);
    } catch (err) {
      showToast(err.message || 'Failed to update settings.', 'error');
    } finally {
      setSettingsSubmitting(false);
    }
  };

  // Preview of an adjustment: on hand can never drop below what open orders hold
  const adjustmentPreview = useMemo(() => {
    if (!adjustModalProduct) return null;
    const current = adjustModalProduct.stock;
    const held = (adjustModalProduct.reservedStock || 0) + (adjustModalProduct.committedStock || 0);
    const qty = parseInt(adjustQty, 10) || 0;

    let nextPhysical = current;
    if (adjustType === 'ADD') nextPhysical = current + qty;
    else if (adjustType === 'SUBTRACT') nextPhysical = current - qty;
    else if (adjustType === 'SET') nextPhysical = qty;

    return {
      held,
      nextPhysical,
      nextAvailable: Math.max(0, nextPhysical - held),
      isValid: nextPhysical >= held && nextPhysical >= 0,
    };
  }, [adjustModalProduct, adjustType, adjustQty]);

  const { metrics } = data;
  const healthyCount = Math.max(0, metrics.totalProducts - metrics.lowStockCount - metrics.outOfStockCount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              {isAdmin ? 'Platform Inventory' : 'Inventory Management'}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                socketConnected ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-900'
              }`}
              title={lastLiveUpdate ? `Last live change ${lastLiveUpdate.toLocaleTimeString()}` : undefined}
            >
              <span className={`size-2 rounded-full ${socketConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {socketConnected ? 'Live updates on' : 'Connecting live updates…'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            {isAdmin
              ? 'Stock across every supplier: on hand, reserved for unpaid orders, committed to paid orders, and available to buyers.'
              : 'On hand, reserved for unpaid orders, committed to paid orders, and what buyers can order right now.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => { loadInventory(); loadReconciliation(); }} disabled={loading}>
            Refresh
          </Button>
          {!isAdmin ? (
            <Button to="/supplier/products/new" variant="primary" size="sm" icon={Plus}>Add New Product</Button>
          ) : null}
        </div>
      </div>

      {/* Super Admin: do stored figures match open orders? */}
      {isAdmin && reconciliation ? (
        reconciliation.mismatches.length === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-900">
            <Scale className="size-4 shrink-0" />
            Stock figures reconcile: reserved and committed units match the {reconciliation.openOrders} open order{reconciliation.openOrders === 1 ? '' : 's'} holding stock.
          </p>
        ) : (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950">
            <p className="flex items-center gap-2 font-bold"><AlertTriangle className="size-4 shrink-0" /> {reconciliation.mismatches.length} product{reconciliation.mismatches.length === 1 ? '' : 's'} need review: stored figures differ from open orders.</p>
            <ul className="mt-2 space-y-1">
              {reconciliation.mismatches.slice(0, 5).map((m) => (
                <li key={m.productId} className="font-mono text-[11px]">
                  {m.sku}: reserved {m.storedReserved} (orders {m.expectedReserved}), committed {m.storedCommitted} (orders {m.expectedCommitted})
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}

      {/* Figures: on hand = reserved + committed + available */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-7">
        <MetricCard label={isAdmin ? 'Products' : 'Total Listed'} value={num(metrics.totalProducts)} hint="In catalogue" icon={Boxes} tone={TONES.neutral} />
        <MetricCard label="On Hand" value={num(metrics.totalPhysicalStock)} hint="Units in warehouses" icon={Warehouse} tone={TONES.onHand} />
        <MetricCard label="Reserved" value={num(metrics.totalReservedStock)} hint="Held for unpaid orders" icon={Hourglass} tone={TONES.reserved} />
        <MetricCard label="Committed" value={num(metrics.totalCommittedStock)} hint="Paid, not yet shipped" icon={Lock} tone={TONES.committed} />
        <MetricCard label="Available" value={num(metrics.totalAvailableStock)} hint="Buyers can order" icon={CheckCircle2} tone={TONES.available} />
        <MetricCard label="Low Stock" value={num(metrics.lowStockCount)} hint="At or below alert level" icon={AlertTriangle} tone={TONES.low} />
        <MetricCard label="Out of Stock" value={num(metrics.outOfStockCount)} hint="Nothing left to sell" icon={Package} tone={TONES.out} />
      </div>

      {/* Filters */}
      <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
        <div className="ts-slim-scrollbar flex items-center gap-2 overflow-x-auto border-b border-slate-100 pb-3">
          {[
            { id: 'all', label: 'All Inventory', count: metrics.totalProducts },
            { id: 'in_stock', label: 'Healthy Stock', count: healthyCount },
            { id: 'low_stock', label: 'Low Stock Alerts', count: metrics.lowStockCount, alert: true },
            { id: 'out_of_stock', label: 'Out of Stock', count: metrics.outOfStockCount, danger: true },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setStockStatus(tab.id); setPage(1); }}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                stockStatus === tab.id ? 'bg-emerald-800 text-white shadow-2xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 text-[10px] font-black ${
                stockStatus === tab.id ? 'bg-white/20 text-white' : tab.danger ? 'bg-rose-100 text-rose-800' : tab.alert ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by SKU or product name…"
              aria-label="Search inventory"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <SlidersHorizontal className="size-3.5 text-slate-400" />
            <span>Sort:</span>
            <div className="w-44">
              <CustomSelect
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                options={[
                  { value: 'updatedAt', label: 'Recently Updated' },
                  { value: 'availableStock', label: 'Available' },
                  { value: 'stock', label: 'On Hand' },
                  { value: 'reservedStock', label: 'Reserved' },
                  { value: 'committedStock', label: 'Committed' },
                  { value: 'name', label: 'Product Name' },
                  { value: 'sku', label: 'SKU Code' },
                ]}
              />
            </div>
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-card">
        {loading ? (
          <TableSkeleton rows={6} />
        ) : data.products.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="No inventory records found"
            text={search ? `No products matching "${search}". Try another search term or status filter.` : isAdmin ? 'No products are listed on the platform yet.' : 'No inventory items listed under this supplier account yet.'}
            action={!isAdmin && !search ? <Button to="/supplier/products/new" variant="primary" size="sm" icon={Plus}>List Your First Product</Button> : null}
          />
        ) : (
          <div className="ts-slim-scrollbar overflow-x-auto">
            <table className="ts-table [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  <th scope="col">Product & SKU</th>
                  <th scope="col" className="text-right">On Hand</th>
                  <th scope="col" className="text-right">Reserved</th>
                  <th scope="col" className="text-right">Committed</th>
                  <th scope="col" className="text-right">Available</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((item) => {
                  const isLow = item.stockStatus === 'LOW_STOCK';
                  const isOut = item.stockStatus === 'OUT_OF_STOCK';
                  return (
                    <tr key={item.id} className="cursor-pointer transition-colors hover:bg-slate-50/70" onClick={() => setDetailProduct(item)}>
                      <td>
                        <div className="flex max-w-[18rem] items-center gap-3 xl:max-w-sm">
                          {item.photo ? (
                            <img
                              src={item.photo.startsWith('http') ? item.photo : `https://images.unsplash.com/${item.photo}?auto=format&fit=crop&w=80&q=80`}
                              alt=""
                              className="size-10 shrink-0 rounded-lg border border-slate-100 object-cover"
                            />
                          ) : (
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-800">
                              <Package className="size-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <button type="button" className="block max-w-full truncate text-left text-xs font-bold text-slate-900 hover:text-emerald-800" onClick={(e) => { e.stopPropagation(); setDetailProduct(item); }}>
                              {item.name}
                            </button>
                            <span className="block truncate text-[11px] text-slate-400">
                              <span className="font-mono font-semibold">{item.sku}</span>
                              <span aria-hidden="true"> · </span>
                              {isAdmin ? item.supplierName || 'Unassigned supplier' : item.categoryName}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-right font-mono text-xs font-bold text-slate-900">
                        {num(item.stock)} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                      </td>
                      <td className="text-right font-mono text-xs font-semibold text-sky-700">{num(item.reservedStock)}</td>
                      <td className="text-right font-mono text-xs font-semibold text-violet-700">{num(item.committedStock)}</td>
                      <td className="text-right">
                        <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 font-mono text-xs font-black ${
                          isOut ? 'border-rose-200 bg-rose-100 text-rose-800' : isLow ? 'border-amber-200 bg-amber-100 text-amber-800' : 'border-emerald-200 bg-emerald-100 text-emerald-800'
                        }`}>
                          {num(item.availableStock)}
                        </span>
                      </td>
                      <td>
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-rose-700">Out of Stock</span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-800">
                            <AlertTriangle className="size-2.5" /> Low (≤{item.lowStockThreshold})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-emerald-800">
                            <Check className="size-2.5" /> In Stock
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-nowrap items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button variant="primary" size="sm" onClick={() => openAdjustModal(item)} className="!px-2.5 !py-1 whitespace-nowrap text-xs">
                            Adjust
                          </Button>
                          <Button variant="outline" size="sm" icon={ChevronRight} onClick={() => setDetailProduct(item)} className="!px-2 !py-1" title="Details & movement history" aria-label={`Details for ${item.sku}`} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-3">
            <span className="text-xs text-slate-500">
              Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} items)
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={data.pagination.page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => setPage((prev) => prev + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <InventoryDetailDrawer
        product={detailProduct}
        open={Boolean(detailProduct)}
        onClose={() => setDetailProduct(null)}
        onAdjust={(product) => openAdjustModal({ ...detailProduct, ...product })}
        onSettings={(product) => openSettingsModal({ ...detailProduct, ...product })}
        refreshKey={detailRefreshKey}
        showSupplier={isAdmin}
      />

      {/* Stock adjustment */}
      {adjustModalProduct && (
        <Modal open onClose={() => setAdjustModalProduct(null)} title={`Adjust Stock — ${adjustModalProduct.sku}`} size="md">
          <form onSubmit={handleStockAdjustmentSubmit} className="space-y-4 text-xs">
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3">
              <p className="text-sm font-bold text-slate-900">{adjustModalProduct.name}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                {[
                  ['On hand', adjustModalProduct.stock, 'text-slate-900'],
                  ['Reserved', adjustModalProduct.reservedStock, 'text-sky-700'],
                  ['Committed', adjustModalProduct.committedStock, 'text-violet-700'],
                  ['Available', adjustModalProduct.availableStock, 'text-emerald-800'],
                ].map(([label, value, tone]) => (
                  <div key={label} className="rounded-lg border border-slate-200/80 bg-white p-2">
                    <span className="block text-[10px] font-semibold uppercase text-slate-400">{label}</span>
                    <span className={`font-mono text-sm font-bold ${tone}`}>{num(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 font-bold text-slate-800">Adjustment</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  { id: 'ADD', label: 'Add stock', icon: ArrowUpRight, desc: 'Restock or found units' },
                  { id: 'SUBTRACT', label: 'Remove stock', icon: ArrowDownRight, desc: 'Damaged or lost units' },
                  { id: 'SET', label: 'Set exact count', icon: RefreshCw, desc: 'After a physical count' },
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    aria-pressed={adjustType === act.id}
                    onClick={() => setAdjustType(act.id)}
                    className={`rounded-xl border p-2.5 text-left transition-colors ${
                      adjustType === act.id ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-600/20' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-bold"><act.icon className="size-3.5" />{act.label}</span>
                    <span className="mt-0.5 block text-[10px] text-slate-400">{act.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="adjust-qty" className="font-bold text-slate-800">
                  {adjustType === 'SET' ? 'New on-hand count' : 'Quantity'} <span className="text-rose-500">*</span>
                </label>
                {adjustType !== 'SET' && (
                  <div className="flex items-center gap-1">
                    {[10, 50, 100, 500].map((preset) => (
                      <button key={preset} type="button" onClick={() => setAdjustQty(String(preset))} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200">
                        {preset}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                id="adjust-qty"
                type="number"
                min={adjustType === 'SET' ? adjustmentPreview?.held || 0 : 1}
                required
                placeholder="Enter quantity"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              />
            </div>

            <div>
              <p className="mb-1 font-bold text-slate-800">Reason <span className="font-normal text-rose-500">* recorded in movement history</span></p>
              <CustomSelect value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} options={REASON_OPTIONS} />
            </div>

            <div>
              <label htmlFor="adjust-notes" className="mb-1 block font-bold text-slate-800">
                Reference / notes <span className="font-normal text-slate-400">(PO, batch, inspector note)</span>
              </label>
              <textarea
                id="adjust-notes"
                rows={2}
                placeholder="Optional"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              />
            </div>

            {adjustmentPreview && adjustQty && (
              <div className={`rounded-xl border p-3 ${adjustmentPreview.isValid ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">On hand after this change</span>
                  <span className="font-mono font-black">{num(adjustmentPreview.nextPhysical)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-semibold">Available to buyers</span>
                  <span className="font-mono font-black">{num(adjustmentPreview.nextAvailable)}</span>
                </div>
                {!adjustmentPreview.isValid && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-rose-700">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    On hand cannot go below the {num(adjustmentPreview.held)} units open orders already hold.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setAdjustModalProduct(null)}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" loading={adjustSubmitting} disabled={adjustSubmitting || (adjustmentPreview && !adjustmentPreview.isValid)}>
                Save stock
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Alert level & warehouse location */}
      {settingsModalProduct && (
        <Modal open onClose={() => setSettingsModalProduct(null)} title={`Inventory Settings — ${settingsModalProduct.sku}`} size="sm">
          <form onSubmit={handleSettingsSubmit} className="space-y-4 text-xs">
            <div>
              <label htmlFor="threshold" className="mb-1 block font-bold text-slate-800">Low-stock alert level</label>
              <p className="mb-2 text-[11px] text-slate-400">You get a notification when available units drop to or below this number.</p>
              <input
                id="threshold"
                type="number"
                min="0"
                required
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              />
            </div>

            <div>
              <label htmlFor="location" className="mb-1 block font-bold text-slate-800">Warehouse / bin location</label>
              <p className="mb-2 text-[11px] text-slate-400">For example "Bhiwandi Central WH – Bay 4".</p>
              <input
                id="location"
                type="text"
                placeholder="e.g. WH-A-Rack-12"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setSettingsModalProduct(null)}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" loading={settingsSubmitting} disabled={settingsSubmitting}>Save settings</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
