import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Truck,
  Package,
  Search,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Navigation,
  FileText,
  KeyRound,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import useNotifications from '../../hooks/useNotifications';
import useAuth from '../../hooks/useAuth';
import useCurrency from '../../hooks/useCurrency';
import { getShipments } from '../../api/logisticsApi';
import { formatDate } from '../../utils/formatDate';
import ShipmentDetailModal from '../../components/logistics/ShipmentDetailModal';

const TABS = [
  { id: 'ALL', label: 'All Shipments' },
  { id: 'ACTIVE', label: 'In Transit' },
  { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'DISPUTED', label: 'Disputes & Claims' },
];

export default function BuyerShipments() {
  const [searchParams] = useSearchParams();
  const initialOrder = searchParams.get('orderNumber') || '';

  const { showToast } = useNotifications();
  const { user } = useAuth();
  const { money } = useCurrency();

  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState(initialOrder);
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);

  // Detail Modal
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadShipments();
  }, []);

  async function loadShipments() {
    setLoading(true);
    try {
      const res = await getShipments({ limit: 100 });
      const list = res?.shipments || (Array.isArray(res) ? res : []);
      setShipments(list);

      // Auto-open if query order matches
      if (initialOrder && list.length > 0) {
        const found = list.find(
          (s) => s.order?.orderNumber?.toLowerCase() === initialOrder.toLowerCase() ||
            s.trackingNumber?.toLowerCase() === initialOrder.toLowerCase()
        );
        if (found) {
          setSelectedShipment(found);
          setShowDetailModal(true);
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to load shipments', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Filtered list
  const filteredList = useMemo(() => {
    return (shipments || []).filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.trackingNumber?.toLowerCase().includes(q) ||
        s.order?.orderNumber?.toLowerCase().includes(q) ||
        s.carrierName?.toLowerCase().includes(q) ||
        s.driverName?.toLowerCase().includes(q);

      let matchesTab = true;
      if (activeTab === 'ACTIVE') {
        matchesTab = ['PICKED_UP', 'IN_TRANSIT', 'READY_FOR_PICKUP'].includes(s.status);
      } else if (activeTab === 'OUT_FOR_DELIVERY') {
        matchesTab = s.status === 'OUT_FOR_DELIVERY';
      } else if (activeTab === 'DELIVERED') {
        matchesTab = s.status === 'DELIVERED';
      } else if (activeTab === 'DISPUTED') {
        matchesTab = s.status === 'DELIVERY_DISPUTED';
      }

      return matchesSearch && matchesTab;
    });
  }, [shipments, searchQuery, activeTab]);

  const activeCount = useMemo(() => {
    return (shipments || []).filter((s) =>
      ['PICKED_UP', 'IN_TRANSIT', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(s.status)
    ).length;
  }, [shipments]);

  const outForDeliveryCount = useMemo(() => {
    return (shipments || []).filter((s) => s.status === 'OUT_FOR_DELIVERY').length;
  }, [shipments]);

  const deliveredCount = useMemo(() => {
    return (shipments || []).filter((s) => s.status === 'DELIVERED').length;
  }, [shipments]);

  function getStatusBadge(status) {
    const s = String(status || '').toUpperCase();
    if (s === 'DELIVERED') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (s === 'OUT_FOR_DELIVERY') return 'bg-purple-100 text-purple-800 border-purple-200 animate-pulse';
    if (['IN_TRANSIT', 'PICKED_UP'].includes(s)) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (s === 'DELIVERY_DISPUTED') return 'bg-rose-100 text-rose-800 border-rose-200';
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeading
        title="My Shipments & Freight Tracking"
        description="Monitor consignments in transit, inspect live GPS telemetry, review transport documents, verify delivery via OTP, or report shipment issues."
        actions={
          <Button to="/buyer/orders" variant="outline" size="sm" icon={Package}>
            All My Orders
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-600">Active In Transit</span>
            <Truck className="size-4 text-blue-700" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{activeCount}</p>
          <span className="text-[11px] text-blue-800 font-medium">Consignments moving towards your destination</span>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-600">Out for Delivery</span>
            <Navigation className="size-4 text-purple-700" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{outForDeliveryCount}</p>
          <span className="text-[11px] text-purple-800 font-medium">Arriving today · Keep 6-digit OTP ready</span>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-600">Delivered</span>
            <CheckCircle2 className="size-4 text-emerald-700" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{deliveredCount}</p>
          <span className="text-[11px] text-emerald-800 font-medium">Consignments received with Proof of Delivery</span>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            let count = null;
            if (tab.id === 'ALL') count = shipments.length;
            if (tab.id === 'ACTIVE') count = activeCount;
            if (tab.id === 'OUT_FOR_DELIVERY') count = outForDeliveryCount;
            if (tab.id === 'DELIVERED') count = deliveredCount;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${active
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                  }`}
              >
                <span>{tab.label}</span>
                {count !== null && (
                  <span
                    className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search AWB or Order #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs focus:border-emerald-700 focus:outline-none"
          />
        </div>
      </div>

      {/* Consignments List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <TableSkeleton />
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          <EmptyState
            icon={Truck}
            title="No shipments found"
            text={
              searchQuery
                ? 'No shipments match your search criteria.'
                : 'You have no consignments in this category.'
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredList.map((shipment) => {
            const hasGps = Boolean(
              shipment.locations?.length > 0 ||
              (shipment.currentLatitude && shipment.currentLongitude)
            );

            return (
              <div
                key={shipment.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        AWB #{shipment.trackingNumber}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${getStatusBadge(
                          shipment.status
                        )}`}
                      >
                        {shipment.status.replace(/_/g, ' ')}
                      </span>
                      {hasGps && (
                        <span className="rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 ring-1 ring-emerald-500/30">
                          LIVE GPS ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-1">
                      Order: <strong className="text-slate-800">{shipment.order?.orderNumber}</strong> · Placed:{' '}
                      {formatDate(shipment.order?.createdAt || shipment.createdAt)}
                    </p>
                  </div>

                  <div className="text-right text-xs">
                    <span className="text-muted block">Estimated Delivery:</span>
                    <strong className="text-slate-900 font-semibold">
                      {shipment.estimatedDeliveryDate ? formatDate(shipment.estimatedDeliveryDate) : 'In Progress'}
                    </strong>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-bold">Transporter</span>
                    <strong className="text-slate-800">{shipment.carrierName || 'Commercial Fleet'}</strong>
                    <span className="text-[11px] text-slate-500 block">
                      Method: {shipment.transportMethod === 'SUPPLIER_MANAGED' ? 'Supplier Fleet' : 'TradeExpress Verified'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-bold">Vehicle & Driver</span>
                    <strong className="text-slate-800 font-mono block">
                      {shipment.vehicleNumber || shipment.vehicle?.vehicleNumber || 'Assigned Commercial Truck'}
                    </strong>
                    <span className="text-[11px] text-slate-500 block">
                      Driver: {shipment.driverName || shipment.driver?.name || 'On Duty'}
                      {shipment.driverPhone && ` (${shipment.driverPhone})`}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-bold">Delivery Address</span>
                    <span className="text-slate-800 line-clamp-2">
                      {shipment.deliveryAddress?.street || shipment.order?.deliveryAddress?.street || ''},{' '}
                      {shipment.deliveryAddress?.city || shipment.order?.deliveryAddress?.city || 'India'}
                    </span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {shipment.deliveryProof ? (
                      <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
                        <CheckCircle2 className="size-3.5" /> POD Verified ({shipment.deliveryProof.recipientName})
                      </span>
                    ) : shipment.status === 'OUT_FOR_DELIVERY' ? (
                      <span className="inline-flex items-center gap-1 text-purple-800 font-semibold">
                        <KeyRound className="size-3.5" /> Provide 6-digit OTP upon physical delivery
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Clock className="size-3.5" /> Updated: {formatDate(shipment.updatedAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Navigation}
                      onClick={() => {
                        setSelectedShipment(shipment);
                        setShowDetailModal(true);
                      }}
                      className="text-xs"
                    >
                      Track Live Map & Milestones
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Shipment Detail Modal */}
      {selectedShipment && (
        <ShipmentDetailModal
          shipment={selectedShipment}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedShipment(null);
          }}
          currentUser={user}
          onRefresh={loadShipments}
          showToast={showToast}
        />
      )}
    </div>
  );
}
