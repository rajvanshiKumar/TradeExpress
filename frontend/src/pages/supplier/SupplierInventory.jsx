import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  Boxes,
  ChartColumn,
  ChevronLeft,
  Download,
  ChevronRight,
  Package,
  Pencil,
  Plus,
  Radio,
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
import { quantityLabel } from '../../utils/units';
import { inventoryCsv, pageWindow, updatedLabel } from '../../utils/inventoryView';
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

const SUMMARY_TONES = {
  green: { card: 'border-emerald-100 bg-gradient-to-br from-[#ECFDF5] to-white', icon: 'bg-emerald-100/80 text-[#047857]', ring: 'ring-emerald-600/40' },
  blue: { card: 'border-blue-100 bg-gradient-to-br from-blue-50 to-white', icon: 'bg-blue-100/80 text-blue-700', ring: 'ring-blue-600/40' },
  amber: { card: 'border-amber-100 bg-gradient-to-br from-amber-50 to-white', icon: 'bg-amber-100/80 text-amber-700', ring: 'ring-amber-500/50' },
  red: { card: 'border-rose-100 bg-gradient-to-br from-rose-50 to-white', icon: 'bg-rose-100/80 text-rose-600', ring: 'ring-rose-500/40' },
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Stock Status' },
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
];

const SORT_OPTIONS = [
  { value: 'updatedAt', label: 'Sort: Recently Updated' },
  { value: 'availableStock', label: 'Sort: Available' },
  { value: 'stock', label: 'Sort: On Hand' },
  { value: 'reservedStock', label: 'Sort: Reserved' },
  { value: 'committedStock', label: 'Sort: Committed' },
  { value: 'name', label: 'Sort: Product Name' },
  { value: 'sku', label: 'Sort: SKU Code' },
];

const photoUrl = (photo) => (photo.startsWith('http') || photo.startsWith('/') ? photo : `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=96&q=80`);

function ProductThumb({ item, small = false }) {
  const size = small ? 'size-10' : 'size-12';
  return item.photo ? (
    <img src={photoUrl(item.photo)} alt="" loading="lazy" className={`${size} shrink-0 rounded-xl border border-[#E2E8E5] bg-white object-cover`} />
  ) : (
    <span className={`${size} inline-flex shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-[#ECFDF5] text-[#047857]`}>
      <Package className="size-5" aria-hidden="true" />
    </span>
  );
}

/** On-hand units, plus what buyers can still order when open orders hold some. */
function StockCell({ item }) {
  const held = (item.reservedStock || 0) + (item.committedStock || 0);
  return (
    <span className="block whitespace-nowrap">
      <span className="font-bold text-[#142D24]">{quantityLabel(item.stock, item.unit || 'unit')}</span>
      {held > 0 ? <span className="block text-xs text-[#64748B]">{num(item.availableStock)} available · {num(held)} held</span> : null}
    </span>
  );
}

function StatusPill({ item }) {
  const map = {
    OUT_OF_STOCK: ['bg-rose-50 text-rose-700 ring-rose-600/15', 'bg-rose-500', 'Out of Stock'],
    LOW_STOCK: ['bg-amber-50 text-amber-800 ring-amber-600/20', 'bg-amber-400', 'Low Stock'],
    IN_STOCK: ['bg-emerald-50 text-emerald-800 ring-emerald-600/15', 'bg-emerald-500', 'In Stock'],
  };
  const [cls, dot, label] = map[item.stockStatus] || map.IN_STOCK;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`}
      title={item.stockStatus === 'LOW_STOCK' ? `At or below the alert level of ${item.lowStockThreshold}` : undefined}>
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function RowActions({ item, onAdjust, onDetails, onSettings }) {
  const btn = 'inline-flex size-9 items-center justify-center rounded-lg border border-[#E2E8E5] bg-white text-[#142D24] transition-colors hover:border-[#047857]/50 hover:bg-[#ECFDF5] hover:text-[#047857]';
  return (
    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button type="button" className={btn} onClick={() => onAdjust(item)} aria-label={`Update stock for ${item.sku}`} title="Update stock"><Pencil className="size-4" aria-hidden="true" /></button>
      <button type="button" className={btn} onClick={() => onDetails(item)} aria-label={`Stock details and movement history for ${item.sku}`} title="Details & movement history"><ChartColumn className="size-4" aria-hidden="true" /></button>
      <button type="button" className={btn} onClick={() => onSettings(item)} aria-label={`Alert level and location for ${item.sku}`} title="Low-stock alert level & location"><SlidersHorizontal className="size-4" aria-hidden="true" /></button>
    </div>
  );
}

function PageButton({ children, label, active = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex size-10 items-center justify-center rounded-xl text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'bg-[#064E3B] text-white shadow-[0_6px_14px_-8px_rgba(6,78,59,0.8)]' : 'border border-[#E2E8E5] bg-white text-[#142D24] hover:bg-[#ECFDF5]'
      }`}
    >
      {children}
    </button>
  );
}

function downloadCsv(filename, rows, withSupplier) {
  const blob = new Blob([`﻿${inventoryCsv(rows, withSupplier)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Real-time inventory for a supplier's own catalogue. Super Admins get the same screen across all suppliers,
 * plus a check that stored figures match open orders.
 */
export default function SupplierInventory() {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  useDocumentTitle(isAdmin ? 'Platform Inventory — Super Admin' : 'Inventory Management — Supplier Portal');

  const [loading, setLoading] = useState(true); // first load only (skeleton)
  const [refreshing, setRefreshing] = useState(false); // later loads keep the current rows on screen
  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);
  const [data, setData] = useState({ metrics: EMPTY_METRICS, products: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 1 } });

  // Filters & sorting
  const [search, setSearch] = useState(''); // applied search (sent to the server)
  const [searchInput, setSearchInput] = useState(''); // what is typed; applied after a short pause
  const [stockStatus, setStockStatus] = useState('all');
  const [category, setCategory] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(null);
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
    const requestId = ++requestIdRef.current;
    if (!silent) (hasLoadedRef.current ? setRefreshing : setLoading)(true);
    try {
      const result = await fetchSupplierInventory({ search, category, stockStatus, sortBy, sortOrder, page, limit: 20 });
      if (requestId !== requestIdRef.current) return; // a newer search/filter request replaced this one
      if (result) {
        hasLoadedRef.current = true;
        setData({ ...result, metrics: { ...EMPTY_METRICS, ...result.metrics } });
        setLastRefreshed(new Date());
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
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
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [search, category, stockStatus, sortBy, sortOrder, page, showToast]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Search runs once typing pauses (not on every keystroke)
  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return undefined;
    const timer = setTimeout(() => { setSearch(next); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

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
  const { page: curPage, limit: perPage, total: totalRows, totalPages } = data.pagination;
  const rangeStart = totalRows ? (curPage - 1) * perPage + 1 : 0;
  const rangeEnd = Math.min(curPage * perPage, totalRows);

  // "Update Stock": pick one of this supplier's products, then the existing adjustment form opens
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerResults, setPickerResults] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  useEffect(() => {
    if (!pickerOpen) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setPickerLoading(true);
      try {
        const result = await fetchSupplierInventory({ search: pickerSearch.trim(), sortBy: 'name', sortOrder: 'asc', page: 1, limit: 8 });
        if (!cancelled) setPickerResults(result?.products || []);
      } catch (err) {
        if (!cancelled) { setPickerResults([]); showToast(err.message || 'Could not load products.', 'error'); }
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pickerOpen, pickerSearch, showToast]);

  // Export: every product matching the current filters, read page by page from the same authorised API
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const rows = [];
      for (let p = 1, pages = 1; p <= pages && p <= 50; p += 1) {
        const result = await fetchSupplierInventory({ search, category, stockStatus, sortBy, sortOrder, page: p, limit: 100 });
        rows.push(...(result?.products || []));
        pages = result?.pagination?.totalPages || 1;
      }
      if (!rows.length) { showToast('There are no products to export for these filters.', 'error'); return; }
      downloadCsv(`tradeexpress-inventory-${new Date().toISOString().slice(0, 10)}.csv`, rows, isAdmin);
      showToast(`Exported ${rows.length} product${rows.length === 1 ? '' : 's'}.`, 'success');
    } catch (err) {
      showToast(err.message || 'Export failed. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const filterSelectClass = 'w-full';
  const categoryOptions = [{ value: '', label: 'All Categories' }, ...(data.categories || []).map((c) => ({ value: c.slug, label: c.name }))];

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div className="space-y-3">
        <nav aria-label="Breadcrumb" className="text-[0.8125rem]">
          <ol className="flex flex-wrap items-center gap-1.5 text-[#64748B]">
            <li><Link to={isAdmin ? '/admin' : '/supplier'} className="font-medium text-[#047857] hover:underline">{isAdmin ? 'Admin Console' : 'Supplier Dashboard'}</Link></li>
            <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
            <li aria-current="page" className="font-semibold text-[#142D24]">{isAdmin ? 'Platform Inventory' : 'Real-Time Inventory'}</li>
          </ol>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857] ring-1 ring-emerald-600/10">
              <Radio className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] text-[#142D24] sm:text-[2rem]">
                {isAdmin ? 'Platform Inventory' : 'Real-Time Inventory'}
              </h1>
              <p className="mt-0.5 text-sm text-[#64748B]">
                {isAdmin ? 'Live stock status across every supplier' : 'Live stock status across all your products'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live updates arrive over the existing socket (no polling); shows the real connection state */}
            <span
              className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border border-[#E2E8E5] bg-white px-4 text-[0.8125rem] text-[#142D24] shadow-[0_4px_14px_-10px_rgba(20,45,36,0.35)]"
              title={lastRefreshed ? `Last refreshed ${lastRefreshed.toLocaleTimeString()}` : undefined}
              role="status"
            >
              <span className={`size-2.5 rounded-full ${socketConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
              Live Updates: <strong className={socketConnected ? 'text-[#047857]' : 'text-amber-700'}>{socketConnected ? 'On' : 'Connecting…'}</strong>
              {lastRefreshed ? <span className="hidden text-[#64748B] sm:inline">· {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : null}
            </span>
            <button
              type="button"
              onClick={() => { loadInventory(); loadReconciliation(); }}
              disabled={loading || refreshing}
              className="inline-flex size-10 items-center justify-center rounded-full border border-[#E2E8E5] bg-white text-[#142D24] transition-colors hover:border-[#047857]/50 hover:text-[#047857] disabled:opacity-50"
              aria-label="Refresh inventory"
              title="Refresh inventory"
            >
              <RefreshCw className={`size-4 ${loading || refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
            {!isAdmin ? (
              <button
                type="button"
                onClick={() => { setPickerSearch(''); setPickerOpen(true); }}
                className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-gradient-to-b from-[#047857] to-[#064E3B] px-5 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(6,78,59,0.75)] transition-colors hover:from-[#065F46]"
              >
                <Plus className="size-[1.125rem]" aria-hidden="true" />
                Update Stock
              </button>
            ) : null}
          </div>
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

      {/* Summary cards (click to filter by status) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          { id: 'all', label: 'Total Products', value: metrics.totalProducts, icon: Package, tone: SUMMARY_TONES.green },
          { id: 'in_stock', label: 'In Stock', value: healthyCount, icon: Boxes, tone: SUMMARY_TONES.blue },
          { id: 'low_stock', label: 'Low Stock', value: metrics.lowStockCount, icon: AlertTriangle, tone: SUMMARY_TONES.amber },
          { id: 'out_of_stock', label: 'Out of Stock', value: metrics.outOfStockCount, icon: Ban, tone: SUMMARY_TONES.red },
        ].map((card) => (
          <button
            key={card.id}
            type="button"
            aria-pressed={stockStatus === card.id}
            onClick={() => { setStockStatus(card.id); setPage(1); }}
            className={`flex items-center gap-3 rounded-[1.25rem] border p-4 text-left shadow-[0_1px_2px_rgba(20,45,36,0.04),0_10px_24px_-18px_rgba(6,78,59,0.25)] transition-[box-shadow,border-color] sm:gap-4 sm:p-5 ${card.tone.card} ${stockStatus === card.id ? `ring-2 ${card.tone.ring}` : ''}`}
          >
            <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-2xl sm:size-12 ${card.tone.icon}`}>
              <card.icon className="size-6" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[0.8125rem] font-semibold text-[#142D24] sm:text-sm">{card.label}</span>
              <span className="block font-display text-[1.6rem] font-extrabold leading-tight tracking-[-0.02em] text-[#142D24] sm:text-[1.75rem]">{num(card.value)}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Unit totals across the same products (existing reservation rules: on hand = reserved + committed + available) */}
      <p className="-mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-[#64748B]">
        <span>On hand <strong className="text-[#142D24]">{num(metrics.totalPhysicalStock)}</strong></span>
        <span>Reserved (unpaid orders) <strong className="text-sky-700">{num(metrics.totalReservedStock)}</strong></span>
        <span>Committed (paid, not shipped) <strong className="text-violet-700">{num(metrics.totalCommittedStock)}</strong></span>
        <span>Available to buyers <strong className="text-[#047857]">{num(metrics.totalAvailableStock)}</strong></span>
      </p>

      {/* Search, filters, sort, export */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by product name, SKU or ID…"
            aria-label="Search inventory by product name, SKU or product ID"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-11 w-full rounded-xl border border-[#E2E8E5] bg-white pl-10 pr-3 text-sm text-[#142D24] placeholder:text-slate-400 focus:border-[#047857] focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
        </div>
        <div className={filterSelectClass}>
          <CustomSelect value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} options={categoryOptions} />
        </div>
        <div className={filterSelectClass}>
          <CustomSelect value={stockStatus} onChange={(e) => { setStockStatus(e.target.value); setPage(1); }} searchable={false} options={STATUS_OPTIONS} />
        </div>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <CustomSelect value={sortBy} onChange={(e) => setSortBy(e.target.value)} searchable={false} options={SORT_OPTIONS} />
          </div>
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="inline-flex h-11 shrink-0 items-center rounded-xl border border-[#E2E8E5] bg-white px-3 text-xs font-bold text-[#142D24] hover:bg-slate-50"
            aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting || loading}
          className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#047857]/40 bg-white px-4 text-sm font-semibold text-[#064E3B] transition-colors hover:bg-[#ECFDF5] disabled:opacity-60"
        >
          <Download className="size-4" aria-hidden="true" />
          {exporting ? 'Exporting…' : 'Export'}
        </button>
      </div>

      {/* Inventory list */}
      <div
        aria-busy={refreshing || undefined}
        className={`relative overflow-hidden rounded-[1.25rem] border border-[#E2E8E5] bg-white shadow-[0_1px_2px_rgba(20,45,36,0.04),0_10px_28px_-18px_rgba(6,78,59,0.22)] transition-opacity ${refreshing ? 'opacity-60' : ''}`}
      >
        {refreshing ? <span className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-[#047857]" role="status" aria-label="Updating results" /> : null}
        {loading ? (
          <TableSkeleton rows={6} />
        ) : data.products.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="No inventory records found"
            text={search || category || stockStatus !== 'all' ? 'No products match these filters. Try another search, category or stock status.' : isAdmin ? 'No products are listed on the platform yet.' : 'No inventory items listed under this supplier account yet.'}
            action={!isAdmin && !search && !category ? <Button to="/supplier/products/new" variant="primary" size="sm" icon={Plus}>List Your First Product</Button> : null}
          />
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div className="ts-slim-scrollbar hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8FAF8] text-[0.8125rem] font-semibold text-[#142D24]">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">Product</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">SKU / Product ID</th>
                    <th scope="col" className="px-4 py-3.5">{isAdmin ? 'Category / Supplier' : 'Category'}</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Current Stock</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Stock Status</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Last Updated</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8E5]">
                  {data.products.map((item) => (
                    <tr key={item.id} className="cursor-pointer transition-colors hover:bg-[#F8FAF8]" onClick={() => setDetailProduct(item)}>
                      <td className="px-5 py-3">
                        <div className="flex min-w-[14rem] items-center gap-3">
                          <ProductThumb item={item} />
                          <div className="min-w-0">
                            <button type="button" className="text-left font-semibold leading-snug text-[#142D24] hover:text-[#047857]" onClick={(e) => { e.stopPropagation(); setDetailProduct(item); }}>
                              {item.name}
                            </button>
                            {item.warehouseLocation ? <span className="block text-xs text-[#64748B]">{item.warehouseLocation}</span> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block whitespace-nowrap font-mono text-[0.8125rem] font-semibold text-[#142D24]">{item.sku}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex whitespace-nowrap rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-semibold text-[#047857]">{item.categoryName}</span>
                        {isAdmin ? <span className="mt-1 block text-xs text-[#64748B]">{item.supplierName || 'Unassigned supplier'}</span> : null}
                      </td>
                      <td className="px-4 py-3"><StockCell item={item} /></td>
                      <td className="px-4 py-3"><StatusPill item={item} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-[0.8125rem] text-[#142D24]">{updatedLabel(item.updatedAt)}</td>
                      <td className="px-5 py-3">
                        <RowActions item={item} onAdjust={openAdjustModal} onDetails={setDetailProduct} onSettings={openSettingsModal} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-[#E2E8E5] md:hidden">
              {data.products.map((item) => (
                <li key={item.id} className="space-y-3 p-4">
                  <button type="button" onClick={() => setDetailProduct(item)} className="flex w-full items-start gap-3 text-left">
                    <ProductThumb item={item} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-snug text-[#142D24]">{item.name}</span>
                      <span className="mt-0.5 block font-mono text-xs text-[#64748B]">{item.sku}</span>
                    </span>
                    <StatusPill item={item} />
                  </button>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                      <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 font-semibold text-[#047857]">{item.categoryName}</span>
                      <span>{updatedLabel(item.updatedAt)}</span>
                    </div>
                    <StockCell item={item} />
                  </div>
                  <RowActions item={item} onAdjust={openAdjustModal} onDetails={setDetailProduct} onSettings={openSettingsModal} />
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Pagination */}
        {!loading && totalRows > 0 ? (
          <div className="flex flex-col gap-3 border-t border-[#E2E8E5] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[0.8125rem] text-[#64748B]">Showing {rangeStart}–{rangeEnd} of {num(totalRows)} product{totalRows === 1 ? '' : 's'}</span>
            {totalPages > 1 ? (
              <nav aria-label="Inventory pages" className="flex flex-wrap items-center gap-1.5">
                <PageButton label="Previous page" disabled={curPage <= 1} onClick={() => setPage(Math.max(1, curPage - 1))}><ChevronLeft className="size-4" /></PageButton>
                {pageWindow(curPage, totalPages).map((p, i) => (p === '…'
                  ? <span key={`gap-${i}`} className="px-1 text-sm text-[#64748B]">…</span>
                  : <PageButton key={p} label={`Page ${p}`} active={p === curPage} onClick={() => setPage(p)}>{p}</PageButton>))}
                <PageButton label="Next page" disabled={curPage >= totalPages} onClick={() => setPage(Math.min(totalPages, curPage + 1))}><ChevronRight className="size-4" /></PageButton>
              </nav>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Update Stock: choose a product, then the existing adjustment form opens */}
      {pickerOpen ? (
        <Modal open onClose={() => setPickerOpen(false)} title="Update stock" description="Choose one of your products to adjust its stock." size="md">
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                autoFocus
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search by product name, SKU or ID…"
                aria-label="Find a product"
                className="h-11 w-full rounded-xl border border-[#E2E8E5] bg-white pl-9 pr-3 text-sm focus:border-[#047857] focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
            {pickerLoading ? (
              <p className="py-6 text-center text-sm text-[#64748B]" role="status">Loading products…</p>
            ) : pickerResults.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#64748B]">No products found.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-[#E2E8E5] overflow-y-auto rounded-xl border border-[#E2E8E5]">
                {pickerResults.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => { setPickerOpen(false); openAdjustModal(item); }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[#F8FAF8]"
                    >
                      <ProductThumb item={item} small />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-[#142D24]">{item.name}</span>
                        <span className="block font-mono text-xs text-[#64748B]">{item.sku}</span>
                      </span>
                      <StatusPill item={item} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      ) : null}

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
