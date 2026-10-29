import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  History,
  Lock,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Warehouse,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import CustomSelect from '../../components/common/CustomSelect';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import useAuth from '../../hooks/useAuth';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatDate } from '../../utils/formatDate';
import { connectSocket, getSocket } from '../../services/socketService';
import {
  fetchSupplierInventory,
  adjustSupplierStock,
  fetchProductInventoryHistory,
  updateSupplierInventorySettings,
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

export default function SupplierInventory() {
  const { user } = useAuth();
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  useDocumentTitle('Inventory Management — Supplier Portal');

  // Loading & Data State
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    metrics: {
      totalProducts: 0,
      totalPhysicalStock: 0,
      totalReservedStock: 0,
      totalAvailableStock: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    },
    products: [],
    pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
  });

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [stockStatus, setStockStatus] = useState('all'); // all, in_stock, low_stock, out_of_stock
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);

  // Real-time socket connection state
  const [socketConnected, setSocketConnected] = useState(false);

  // Modals
  const [adjustModalProduct, setAdjustModalProduct] = useState(null);
  const [historyModalProduct, setHistoryModalProduct] = useState(null);
  const [settingsModalProduct, setSettingsModalProduct] = useState(null);

  // Adjustment form state
  const [adjustType, setAdjustType] = useState('ADD');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('RESTOCK');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // History modal state
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Settings modal state
  const [thresholdInput, setThresholdInput] = useState(10);
  const [locationInput, setLocationInput] = useState('');
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);

  // Load Inventory from Backend API
  const loadInventory = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await fetchSupplierInventory({
        search,
        stockStatus,
        sortBy,
        sortOrder,
        page,
        limit: 20,
      });
      if (result) {
        setData(result);
      }
    } catch (err) {
      if (!silent) {
        showToast(err.message || 'Failed to load inventory from server.', 'error');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, stockStatus, sortBy, sortOrder, page, showToast]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Real-time Socket.IO Integration
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);

    if (socket.connected) {
      setSocketConnected(true);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Listen for live inventory updates
    const handleInventoryUpdate = (payload) => {
      // 1. Immediately patch products table
      setData((prev) => {
        let matched = false;
        const updatedProducts = prev.products.map((p) => {
          if (p.id === payload.productId) {
            matched = true;
            const physical = payload.stock !== undefined ? payload.stock : p.stock;
            const reserved = payload.reservedStock !== undefined ? payload.reservedStock : p.reservedStock;
            const available = payload.availableStock !== undefined ? payload.availableStock : Math.max(0, physical - reserved);
            const threshold = payload.lowStockThreshold !== undefined ? payload.lowStockThreshold : p.lowStockThreshold;

            let status = 'IN_STOCK';
            if (available <= 0) status = 'OUT_OF_STOCK';
            else if (available <= threshold) status = 'LOW_STOCK';

            return {
              ...p,
              stock: physical,
              reservedStock: reserved,
              availableStock: available,
              lowStockThreshold: threshold,
              warehouseLocation: payload.warehouseLocation !== undefined ? payload.warehouseLocation : p.warehouseLocation,
              stockStatus: status,
              updatedAt: payload.timestamp || new Date().toISOString(),
            };
          }
          return p;
        });

        // 2. Recompute metrics dynamically
        let totalPhysical = 0;
        let totalReserved = 0;
        let totalAvailable = 0;
        let lowCount = 0;
        let outCount = 0;

        updatedProducts.forEach((item) => {
          totalPhysical += item.stock;
          totalReserved += item.reservedStock;
          totalAvailable += item.availableStock;
          if (item.availableStock <= 0) outCount++;
          else if (item.availableStock <= item.lowStockThreshold) lowCount++;
        });

        return {
          ...prev,
          products: updatedProducts,
          metrics: matched
            ? {
                ...prev.metrics,
                totalPhysicalStock: totalPhysical,
                totalReservedStock: totalReserved,
                totalAvailableStock: totalAvailable,
                lowStockCount: lowCount,
                outOfStockCount: outCount,
              }
            : prev.metrics,
        };
      });

      showToast(`Real-time inventory update: ${payload.sku || 'Item'} stock changed`, 'info');
    };

    socket.on('inventory:updated', handleInventoryUpdate);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('inventory:updated', handleInventoryUpdate);
    };
  }, [showToast]);

  // Open Adjust Modal
  const openAdjustModal = (product) => {
    setAdjustModalProduct(product);
    setAdjustType('ADD');
    setAdjustQty('');
    setAdjustReason('RESTOCK');
    setAdjustNotes('');
  };

  // Open History Modal
  const openHistoryModal = async (product) => {
    setHistoryModalProduct(product);
    setHistoryLoading(true);
    try {
      const historyData = await fetchProductInventoryHistory(product.id, { limit: 50 });
      setHistoryLogs(historyData?.logs || []);
    } catch (err) {
      showToast(err.message || 'Failed to fetch inventory history.', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Open Settings Modal
  const openSettingsModal = (product) => {
    setSettingsModalProduct(product);
    setThresholdInput(product.lowStockThreshold || 10);
    setLocationInput(product.warehouseLocation || '');
  };

  // Handle Stock Adjustment Submit
  const handleStockAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (!adjustModalProduct) return;

    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty < 0 || (adjustType !== 'SET' && qty === 0)) {
      showToast('Please enter a valid quantity greater than zero.', 'error');
      return;
    }

    if (!adjustReason) {
      showToast('Adjustment reason is mandatory.', 'error');
      return;
    }

    setAdjustSubmitting(true);
    try {
      await adjustSupplierStock(adjustModalProduct.id, {
        adjustmentType: adjustType,
        quantity: qty,
        reason: adjustReason,
        notes: adjustNotes,
      });

      showToast(`Inventory updated for SKU ${adjustModalProduct.sku}.`, 'success');
      setAdjustModalProduct(null);
      loadInventory(true);
    } catch (err) {
      showToast(err.message || 'Failed to adjust stock.', 'error');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Handle Settings Submit
  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    if (!settingsModalProduct) return;

    setSettingsSubmitting(true);
    try {
      await updateSupplierInventorySettings(settingsModalProduct.id, {
        lowStockThreshold: parseInt(thresholdInput, 10) || 10,
        warehouseLocation: locationInput,
      });

      showToast(`Settings saved for SKU ${settingsModalProduct.sku}.`, 'success');
      setSettingsModalProduct(null);
      loadInventory(true);
    } catch (err) {
      showToast(err.message || 'Failed to update settings.', 'error');
    } finally {
      setSettingsSubmitting(false);
    }
  };

  // Computed preview for adjustment modal
  const adjustmentPreview = useMemo(() => {
    if (!adjustModalProduct) return null;
    const current = adjustModalProduct.stock;
    const reserved = adjustModalProduct.reservedStock;
    const qty = parseInt(adjustQty, 10) || 0;

    let nextPhysical = current;
    if (adjustType === 'ADD') nextPhysical = current + qty;
    else if (adjustType === 'SUBTRACT') nextPhysical = Math.max(0, current - qty);
    else if (adjustType === 'SET') nextPhysical = qty;

    const nextAvailable = Math.max(0, nextPhysical - reserved);
    const isValid = nextPhysical >= reserved && nextPhysical >= 0;

    return {
      current,
      reserved,
      nextPhysical,
      nextAvailable,
      delta: nextPhysical - current,
      isValid,
    };
  }, [adjustModalProduct, adjustType, adjustQty]);

  return (
    <div className="space-y-6">
      {/* Header with Title and Connection Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-display">
              Inventory Management
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border transition-colors ${
                socketConnected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
              title={socketConnected ? 'Real-time WebSocket connected' : 'WebSocket connecting or recovering'}
            >
              {socketConnected ? (
                <>
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync Active
                </>
              ) : (
                <>
                  <span className="size-2 rounded-full bg-amber-500" />
                  Connecting Live...
                </>
              )}
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Real-time stock ledger, physical-to-available reservations, low-stock thresholds, and audit history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={() => loadInventory()}
            className={loading ? 'opacity-50' : ''}
          >
            Refresh Data
          </Button>
          <Button
            to="/supplier/products/new"
            variant="primary"
            size="sm"
            icon={Plus}
          >
            Add New Product
          </Button>
        </div>
      </div>

      {/* 6 Real Database-Backed Metrics Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
        {/* Total Products */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Listed</span>
            <Boxes className="size-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 font-display">
            {data.metrics.totalProducts}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">Products in catalogue</p>
        </div>

        {/* Physical Stock */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Physical Stock</span>
            <Warehouse className="size-4 text-emerald-700" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-900 font-display">
            {data.metrics.totalPhysicalStock.toLocaleString('en-IN')}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">On-hand warehouse units</p>
        </div>

        {/* Available Stock */}
        <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/40 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-900 text-xs font-semibold">
            <span>Available for Sale</span>
            <CheckCircle2 className="size-4 text-emerald-700" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-950 font-display">
            {data.metrics.totalAvailableStock.toLocaleString('en-IN')}
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-700/80">Unreserved buyable units</p>
        </div>

        {/* Reserved Stock */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Reserved Orders</span>
            <Lock className="size-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-blue-900 font-display">
            {data.metrics.totalReservedStock.toLocaleString('en-IN')}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">Allocated to pending orders</p>
        </div>

        {/* Low Stock Alerts */}
        <div className="rounded-2xl border border-amber-200/90 bg-amber-50/40 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-amber-900 text-xs font-semibold">
            <span>Low Stock</span>
            <AlertTriangle className="size-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-900 font-display">
            {data.metrics.lowStockCount}
          </p>
          <p className="mt-0.5 text-[10px] text-amber-700/80">At or below threshold</p>
        </div>

        {/* Out of Stock */}
        <div className="rounded-2xl border border-rose-200/90 bg-rose-50/40 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-rose-900 text-xs font-semibold">
            <span>Out of Stock</span>
            <Package className="size-4 text-rose-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-rose-900 font-display">
            {data.metrics.outOfStockCount}
          </p>
          <p className="mt-0.5 text-[10px] text-rose-700/80">0 available units</p>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 overflow-x-auto ts-slim-scrollbar">
          {[
            { id: 'all', label: 'All Inventory', count: data.metrics.totalProducts },
            { id: 'in_stock', label: 'Healthy Stock', count: data.metrics.totalProducts - data.metrics.lowStockCount - data.metrics.outOfStockCount },
            { id: 'low_stock', label: 'Low Stock Alerts', count: data.metrics.lowStockCount, alert: true },
            { id: 'out_of_stock', label: 'Out of Stock', count: data.metrics.outOfStockCount, danger: true },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStockStatus(tab.id);
                setPage(1);
              }}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                stockStatus === tab.id
                  ? 'bg-emerald-800 text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                  stockStatus === tab.id
                    ? 'bg-white/20 text-white'
                    : tab.danger
                    ? 'bg-rose-100 text-rose-800'
                    : tab.alert
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search, Sort, and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by SKU, product title, or keyword..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <SlidersHorizontal className="size-3.5 text-slate-400" />
              <span>Sort:</span>
              <div className="w-44">
                <CustomSelect
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  options={[
                    { value: 'updatedAt', label: 'Recently Updated' },
                    { value: 'availableStock', label: 'Available Stock' },
                    { value: 'stock', label: 'Physical Stock' },
                    { value: 'reservedStock', label: 'Reserved Stock' },
                    { value: 'name', label: 'Product Name' },
                    { value: 'sku', label: 'SKU Code' }
                  ]}
                />
              </div>
              <button
                type="button"
                onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Products Table */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-card overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} />
        ) : data.products.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="No inventory records found"
            text={
              search
                ? `No products matching "${search}". Try adjusting your search term or status filter.`
                : 'No inventory items listed under this supplier account yet.'
            }
            action={
              <Button to="/supplier/products/new" variant="primary" size="sm" icon={Plus}>
                List Your First Product
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto ts-slim-scrollbar scroll-smooth">
            <table className="ts-table">
              <thead>
                <tr>
                  <th scope="col">Product & SKU</th>
                  <th scope="col">Category</th>
                  <th scope="col">Physical (On-Hand)</th>
                  <th scope="col">Reserved</th>
                  <th scope="col">Available</th>
                  <th scope="col">Warehouse</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((item) => {
                  const isLow = item.stockStatus === 'LOW_STOCK';
                  const isOut = item.stockStatus === 'OUT_OF_STOCK';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Product & SKU */}
                      <td>
                        <div className="flex items-center gap-3 max-w-xs sm:max-w-sm">
                          {item.photo ? (
                            <img
                              src={item.photo.startsWith('http') ? item.photo : `https://images.unsplash.com/${item.photo}?auto=format&fit=crop&w=80&q=80`}
                              alt={item.name}
                              className="size-10 rounded-lg object-cover border border-slate-100 shrink-0"
                            />
                          ) : (
                            <div className="size-10 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-100">
                              <Package className="size-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-900 hover:text-emerald-800">
                              {item.name}
                            </p>
                            <span className="font-mono text-[11px] font-semibold text-slate-400">
                              {item.sku}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {item.categoryName}
                        </span>
                      </td>

                      {/* Physical Stock */}
                      <td>
                        <div className="font-mono text-xs font-bold text-slate-900">
                          {item.stock.toLocaleString('en-IN')}{' '}
                          <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                        </div>
                      </td>

                      {/* Reserved Stock */}
                      <td>
                        <div className="flex items-center gap-1 font-mono text-xs font-semibold text-blue-700">
                          <Lock className="size-3 text-blue-500" />
                          <span>{item.reservedStock.toLocaleString('en-IN')}</span>
                        </div>
                      </td>

                      {/* Available Stock */}
                      <td>
                        <div
                          className={`inline-flex items-center gap-1 font-mono text-xs font-black px-2 py-0.5 rounded-lg ${
                            isOut
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : isLow
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          <span>{item.availableStock.toLocaleString('en-IN')}</span>
                          <span className="text-[10px] font-medium">{item.unit}</span>
                        </div>
                      </td>

                      {/* Warehouse Location */}
                      <td>
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <Building2 className="size-3 text-slate-400" />
                          {item.warehouseLocation || 'Supplier Central WH'}
                        </span>
                      </td>

                      {/* Stock Status Pill */}
                      <td>
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-700 border border-rose-200 uppercase">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-800 border border-amber-200 uppercase">
                            <AlertTriangle className="size-2.5" />
                            Low Stock (≤{item.lowStockThreshold})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 border border-emerald-200 uppercase">
                            <Check className="size-2.5" />
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => openAdjustModal(item)}
                            className="!px-2.5 !py-1 text-xs whitespace-nowrap"
                            title="Adjust physical stock with audit trail"
                          >
                            Adjust Stock
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={History}
                            onClick={() => openHistoryModal(item)}
                            className="!px-2 !py-1"
                            title="View audit logs and history"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            icon={Settings}
                            onClick={() => openSettingsModal(item)}
                            className="!px-2 !py-1"
                            title="Configure threshold & warehouse location"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Showing page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total items)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={data.pagination.page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.pagination.page >= data.pagination.totalPages}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Stock Adjustment Dialog */}
      {adjustModalProduct && (
        <Modal
          open={Boolean(adjustModalProduct)}
          onClose={() => setAdjustModalProduct(null)}
          title={`Adjust Inventory Stock — ${adjustModalProduct.sku}`}
          size="md"
        >
          <form onSubmit={handleStockAdjustmentSubmit} className="space-y-4 text-xs">
            {/* Product Summary Header */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3">
              <p className="font-bold text-slate-900 text-sm">{adjustModalProduct.name}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white p-2 border border-slate-200/80">
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">Physical Stock</span>
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {adjustModalProduct.stock} {adjustModalProduct.unit}
                  </span>
                </div>
                <div className="rounded-lg bg-white p-2 border border-slate-200/80">
                  <span className="block text-[10px] text-blue-500 font-semibold uppercase">Reserved</span>
                  <span className="font-mono text-sm font-bold text-blue-700">
                    {adjustModalProduct.reservedStock} {adjustModalProduct.unit}
                  </span>
                </div>
                <div className="rounded-lg bg-white p-2 border border-slate-200/80">
                  <span className="block text-[10px] text-emerald-600 font-semibold uppercase">Available</span>
                  <span className="font-mono text-sm font-bold text-emerald-800">
                    {adjustModalProduct.availableStock} {adjustModalProduct.unit}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Type Tabs */}
            <div>
              <label className="block font-bold text-slate-800 mb-1.5">Select Adjustment Action</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'ADD', label: '+ Add Stock (Restock)', icon: ArrowUpRight, desc: 'Increases physical inventory' },
                  { id: 'SUBTRACT', label: '- Remove Stock (Write-off)', icon: ArrowDownRight, desc: 'Deducts damaged/lost units' },
                  { id: 'SET', label: '= Set Exact Count', icon: RefreshCw, desc: 'Cycle count physical audit' },
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setAdjustType(act.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      adjustType === act.id
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-600/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <act.icon className="size-3.5" />
                      <span>{act.label}</span>
                    </div>
                    <span className="block text-[10px] text-slate-400 mt-0.5">{act.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity Input with Presets */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-800">
                  {adjustType === 'SET' ? 'New Exact Quantity' : 'Quantity Units'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                {adjustType !== 'SET' && (
                  <div className="flex items-center gap-1">
                    {[10, 50, 100, 500].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAdjustQty(String(preset))}
                        className="rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 text-[10px] font-bold"
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="number"
                min={adjustType === 'SET' ? adjustModalProduct.reservedStock : 1}
                required
                placeholder="Enter quantity..."
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              />
            </div>

            {/* Mandatory Reason Selector */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Audit Reason <span className="text-rose-500">* (Mandatory for ledger integrity)</span>
              </label>
              <CustomSelect
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                options={REASON_OPTIONS}
              />
            </div>

            {/* Notes Field */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Reference / Notes <span className="text-slate-400 font-normal">(PO, Batch ID, or inspector note)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Optional explanation or reference number..."
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              />
            </div>

            {/* Live Adjustment Result Preview */}
            {adjustmentPreview && adjustQty && (
              <div
                className={`rounded-xl p-3 border ${
                  adjustmentPreview.isValid
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">Resulting Physical Stock:</span>
                  <span className="font-mono font-black">{adjustmentPreview.nextPhysical} units</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="font-semibold">New Available for Buyers:</span>
                  <span className="font-mono font-black">{adjustmentPreview.nextAvailable} units</span>
                </div>
                {!adjustmentPreview.isValid && (
                  <p className="mt-1.5 text-[11px] font-bold text-rose-700 flex items-center gap-1">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    Cannot reduce physical stock below {adjustmentPreview.reserved} reserved units!
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAdjustModalProduct(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={adjustSubmitting || (adjustmentPreview && !adjustmentPreview.isValid)}
              >
                {adjustSubmitting ? 'Updating Database...' : 'Confirm & Save Stock'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal 2: Product Inventory Audit Trail & History */}
      {historyModalProduct && (
        <Modal
          open={Boolean(historyModalProduct)}
          onClose={() => setHistoryModalProduct(null)}
          title={`Inventory Audit Trail — ${historyModalProduct.sku}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{historyModalProduct.name}</h3>
                <p className="text-xs text-slate-500">
                  SKU: {historyModalProduct.sku} · Physical: {historyModalProduct.stock} · Reserved:{' '}
                  {historyModalProduct.reservedStock}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {historyLogs.length} Records
              </span>
            </div>

            {historyLoading ? (
              <TableSkeleton rows={4} />
            ) : historyLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <History className="size-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No inventory adjustment records found for this product.</p>
              </div>
            ) : (
              <div className="overflow-x-auto ts-slim-scrollbar max-h-96">
                <table className="ts-table">
                  <thead>
                    <tr>
                      <th scope="col">Date & Time</th>
                      <th scope="col">Action / Reason</th>
                      <th scope="col">Change</th>
                      <th scope="col">Physical Stock</th>
                      <th scope="col">Reserved Stock</th>
                      <th scope="col">Performed By</th>
                      <th scope="col">Reference / Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLogs.map((log) => {
                      const isPositive = log.changeAmount > 0;
                      const isNegative = log.changeAmount < 0;

                      return (
                        <tr key={log.id} className="text-xs hover:bg-slate-50/50">
                          <td className="whitespace-nowrap text-slate-500 font-mono text-[11px]">
                            {formatDate(log.createdAt)}
                          </td>
                          <td>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                              {log.reason}
                            </span>
                            {log.notes && (
                              <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{log.notes}</p>
                            )}
                          </td>
                          <td>
                            <span
                              className={`font-mono font-bold ${
                                isPositive
                                  ? 'text-emerald-700'
                                  : isNegative
                                  ? 'text-rose-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              {isPositive ? `+${log.changeAmount}` : log.changeAmount}
                            </span>
                          </td>
                          <td className="font-mono text-slate-700 font-semibold">
                            {log.previousStock} → <span className="font-bold text-slate-900">{log.newStock}</span>
                          </td>
                          <td className="font-mono text-blue-700">
                            {log.previousReserved || 0} → {log.newReserved || 0}
                          </td>
                          <td className="text-slate-600">
                            <span className="font-medium">{log.actorName || 'System'}</span>
                          </td>
                          <td className="font-mono text-[11px] text-slate-500">
                            {log.orderId ? `#${log.orderId}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setHistoryModalProduct(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 3: Settings (Threshold & Warehouse Location) */}
      {settingsModalProduct && (
        <Modal
          open={Boolean(settingsModalProduct)}
          onClose={() => setSettingsModalProduct(null)}
          title={`Inventory Configuration — ${settingsModalProduct.sku}`}
          size="sm"
        >
          <form onSubmit={handleSettingsSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Low-Stock Alert Threshold</label>
              <p className="text-[11px] text-slate-400 mb-2">
                Trigger an urgent dashboard warning and notification when available stock drops to or below this unit count.
              </p>
              <input
                type="number"
                min="0"
                required
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Warehouse / Bin Location</label>
              <p className="text-[11px] text-slate-400 mb-2">
                Specify storage facility or bin rack identifier (e.g. "Bhiwandi Central WH - Bay 4").
              </p>
              <input
                type="text"
                placeholder="e.g. WH-A-Rack-12"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSettingsModalProduct(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={settingsSubmitting}>
                {settingsSubmitting ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
