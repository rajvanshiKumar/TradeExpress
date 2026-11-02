import { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Package,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  Car,
  User,
  Search,
  Navigation,
  ExternalLink,
  Receipt,
  Building2,
  Clock,
  RotateCcw,
} from 'lucide-react';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import useNotifications from '../../hooks/useNotifications';
import useAuth from '../../hooks/useAuth';
import useCurrency from '../../hooks/useCurrency';
import {
  getShipments,
  getTransportRequests,
  getTransportCompanies,
  verifyTransportCompany,
  getVehicles,
  verifyVehicle,
  getDrivers,
  verifyDriver,
  getFreightPayments,
  releaseFreightPayment,
  resolveDeliveryDispute,
  verifyShipment,
} from '../../api/logisticsApi';
import { formatDate } from '../../utils/formatDate';
import ShipmentDetailModal from '../../components/logistics/ShipmentDetailModal';

const TABS = [
  { id: 'shipments', label: 'All Shipments Ledger' },
  { id: 'verification', label: 'Pending Verification (Step 4)' },
  { id: 'requests', label: 'Transport Requests & Bids' },
  { id: 'partners', label: 'Transport Partners & KYC' },
  { id: 'fleet', label: 'Vehicles & Drivers' },
  { id: 'disputes', label: 'Delivery Disputes' },
  { id: 'escrow', label: 'Freight Escrow Disbursals' },
];

export default function SuperAdminLogistics() {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const { money } = useCurrency();

  const [activeTab, setActiveTab] = useState('shipments');
  const [loading, setLoading] = useState(true);

  // Data states
  const [shipments, setShipments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [freightPayments, setFreightPayments] = useState([]);

  // Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Shipment detail modal
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Escrow Release Modal
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [releaseReason, setReleaseReason] = useState('Proof of delivery verified without dispute.');
  const [submittingRelease, setSubmittingRelease] = useState(false);

  // Resolve Dispute Modal
  const [disputeShipment, setDisputeShipment] = useState(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeResolution, setDisputeResolution] = useState('');
  const [disputeRefund, setDisputeRefund] = useState('0');
  const [disputeCloseStatus, setDisputeCloseStatus] = useState('DELIVERED');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // Transporter Verification Modal
  const [verifyCompanyTarget, setVerifyCompanyTarget] = useState(null);
  const [showRejectCompanyModal, setShowRejectCompanyModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingVerify, setSubmittingVerify] = useState(false);

  // Shipment Verification Modal state (Mandatory Workflow Step 4)
  const [verifyShipmentTarget, setVerifyShipmentTarget] = useState(null);
  const [showVerifyShipmentModal, setShowVerifyShipmentModal] = useState(false);
  const [verifyShipmentReason, setVerifyShipmentReason] = useState('Approved by Super Admin');
  const [verifyActionType, setVerifyActionType] = useState('APPROVE'); // 'APPROVE' | 'REJECT' | 'CORRECTION'
  const [submittingShipmentVerify, setSubmittingShipmentVerify] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [shipRes, reqRes, compRes, vehRes, drvRes, payRes] = await Promise.allSettled([
        getShipments({ limit: 200 }),
        getTransportRequests(),
        getTransportCompanies(),
        getVehicles(),
        getDrivers(),
        getFreightPayments(),
      ]);

      if (shipRes.status === 'fulfilled') {
        setShipments(shipRes.value?.shipments || shipRes.value || []);
      }
      if (reqRes.status === 'fulfilled') {
        setRequests(Array.isArray(reqRes.value) ? reqRes.value : reqRes.value?.requests || []);
      }
      if (compRes.status === 'fulfilled') {
        setCompanies(Array.isArray(compRes.value) ? compRes.value : compRes.value?.companies || []);
      }
      if (vehRes.status === 'fulfilled') {
        setVehicles(Array.isArray(vehRes.value) ? vehRes.value : vehRes.value?.vehicles || []);
      }
      if (drvRes.status === 'fulfilled') {
        setDrivers(Array.isArray(drvRes.value) ? drvRes.value : drvRes.value?.drivers || []);
      }
      if (payRes.status === 'fulfilled') {
        setFreightPayments(Array.isArray(payRes.value) ? payRes.value : payRes.value?.payments || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load enterprise logistics data', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Filtered shipments
  const filteredShipments = useMemo(() => {
    return (shipments || []).filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.trackingNumber?.toLowerCase().includes(q) ||
        s.order?.orderNumber?.toLowerCase().includes(q) ||
        s.carrierName?.toLowerCase().includes(q) ||
        s.vehicleNumber?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [shipments, searchQuery, statusFilter]);

  // Disputes list
  const disputedShipments = useMemo(() => {
    return (shipments || []).filter((s) => s.status === 'DELIVERY_DISPUTED');
  }, [shipments]);

  // Pending Super Admin Verification list (Step 4)
  const pendingVerificationShipments = useMemo(() => {
    return (shipments || []).filter((s) => s.status === 'DOCUMENTS_PENDING');
  }, [shipments]);

  // Handler: Execute Shipment Action (Step 4: APPROVE, REJECT, or CORRECTION)
  async function handleExecuteShipmentAction(shipmentId, action, reason) {
    if ((action === 'REJECT' || action === 'CORRECTION') && (!reason || !reason.trim())) {
      showToast(action === 'REJECT' ? 'Please provide an official rejection reason.' : 'Please specify the exact correction instructions.', 'warning');
      return;
    }
    setSubmittingShipmentVerify(true);
    try {
      await verifyShipment(shipmentId, {
        isApproved: action === 'APPROVE',
        action,
        reason: reason?.trim() || (action === 'APPROVE' ? 'Approved by Super Admin. Compliant with transport specifications.' : ''),
      });
      if (action === 'APPROVE') {
        showToast('Shipment verified and approved for dispatch!', 'success');
      } else if (action === 'CORRECTION') {
        showToast('Correction requested. Supplier notified to rectify submission.', 'info');
      } else {
        showToast('Shipment verification rejected with reason recorded.', 'info');
      }
      setShowVerifyShipmentModal(false);
      setVerifyShipmentTarget(null);
      loadAllData();
    } catch (err) {
      showToast(err.message || 'Verification update failed', 'error');
    } finally {
      setSubmittingShipmentVerify(false);
    }
  }

  // Handler: Approve Transporter
  async function handleApproveCompany(companyId) {
    try {
      await verifyTransportCompany(companyId, { verificationStatus: 'VERIFIED' });
      showToast('Transporter approved and verified on the platform!', 'success');
      loadAllData();
    } catch (err) {
      showToast(err.message || 'Verification update failed', 'error');
    }
  }

  // Handler: Reject Transporter
  async function handleRejectCompany(e) {
    e.preventDefault();
    if (!verifyCompanyTarget) return;

    setSubmittingVerify(true);
    try {
      await verifyTransportCompany(verifyCompanyTarget.id, {
        verificationStatus: 'REJECTED',
        rejectionReason: rejectionReason.trim() || undefined,
      });
      showToast('Transporter status set to REJECTED.', 'info');
      setShowRejectCompanyModal(false);
      setVerifyCompanyTarget(null);
      setRejectionReason('');
      loadAllData();
    } catch (err) {
      showToast(err.message || 'Rejection failed', 'error');
    } finally {
      setSubmittingVerify(false);
    }
  }

  // Handler: Toggle Vehicle Verification
  async function handleToggleVehicleVerify(veh) {
    try {
      await verifyVehicle(veh.id, {
        isVerified: !veh.isVerified,
        verificationNotes: veh.isVerified ? 'Verification revoked by Super Admin' : 'Documents & RC verified by Super Admin',
      });
      showToast(`Vehicle ${veh.vehicleNumber} verification updated!`, 'success');
      loadAllData();
    } catch (err) {
      showToast(err.message || 'Vehicle verification failed', 'error');
    }
  }

  // Handler: Toggle Driver Verification
  async function handleToggleDriverVerify(drv) {
    try {
      await verifyDriver(drv.id, {
        isVerified: !drv.isVerified,
        verificationNotes: drv.isVerified ? 'Verification revoked by Super Admin' : 'Commercial DL verified by Super Admin',
      });
      showToast(`Driver ${drv.name} verification updated!`, 'success');
      loadAllData();
    } catch (err) {
      showToast(err.message || 'Driver verification failed', 'error');
    }
  }

  // Handler: Release Escrow Payment
  async function handleReleaseEscrowSubmit(e) {
    e.preventDefault();
    if (!selectedPayment) return;

    setSubmittingRelease(true);
    try {
      await releaseFreightPayment(selectedPayment.id, releaseReason.trim());
      showToast('Escrow freight released to transport partner!', 'success');
      setShowReleaseModal(false);
      setSelectedPayment(null);
      loadAllData();
    } catch (err) {
      showToast(err.message || 'Escrow release failed', 'error');
    } finally {
      setSubmittingRelease(false);
    }
  }

  // Handler: Resolve Delivery Dispute
  async function handleResolveDisputeSubmit(e) {
    e.preventDefault();
    if (!disputeShipment) return;

    setSubmittingDispute(true);
    try {
      await resolveDeliveryDispute(disputeShipment.id, {
        resolution: disputeResolution.trim() || 'Super Admin mediated resolution.',
        refundAmount: Number(disputeRefund) || 0,
        closeStatus: disputeCloseStatus,
      });
      showToast(`Dispute resolved and consignment closed as ${disputeCloseStatus}!`, 'success');
      setShowDisputeModal(false);
      setDisputeShipment(null);
      loadAllData();
    } catch (err) {
      showToast(err.message || 'Failed to resolve dispute', 'error');
    } finally {
      setSubmittingDispute(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Console Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="size-6 text-emerald-800" />
            Enterprise Logistics & Transportation Management
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Cross-marketplace freight governance: track consignments, moderate transport quotes, audit vehicles & drivers, release freight escrow, and resolve delivery disputes.
          </p>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Shipments</span>
          <p className="text-xl font-black text-slate-900 mt-1">{shipments.length}</p>
          <span className="text-[10px] text-muted">All-time marketplace</span>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200 p-3.5 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Pending Verification</span>
          <p className="text-xl font-black text-amber-950 mt-1">{pendingVerificationShipments.length}</p>
          <span className="text-[10px] text-amber-800 font-semibold">Step 4 review required</span>
        </div>

        <div className="bg-white rounded-2xl border border-blue-200 p-3.5 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Active In Transit</span>
          <p className="text-xl font-black text-blue-950 mt-1">
            {shipments.filter((s) => ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP'].includes(s.status)).length}
          </p>
          <span className="text-[10px] text-blue-800">On road right now</span>
        </div>

        <div className="bg-white rounded-2xl border border-rose-200 p-3.5 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">Disputed Shipments</span>
          <p className="text-xl font-black text-rose-950 mt-1">{disputedShipments.length}</p>
          <span className="text-[10px] text-rose-800 font-semibold">Requires mediation</span>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200 p-3.5 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Transport Partners</span>
          <p className="text-xl font-black text-emerald-950 mt-1">
            {companies.filter((c) => c.verificationStatus === 'VERIFIED').length} / {companies.length}
          </p>
          <span className="text-[10px] text-emerald-800">Verified agencies</span>
        </div>

        <div className="bg-white rounded-2xl border border-purple-200 p-3.5 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">Escrow Freight</span>
          <p className="text-xl font-black text-purple-950 mt-1 font-mono">
            {money(
              freightPayments
                .filter((p) => p.status === 'HELD_IN_ESCROW')
                .reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0)
            )}
          </p>
          <span className="text-[10px] text-purple-800">Secured in escrow</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            let count = null;
            if (tab.id === 'shipments') count = shipments.length;
            if (tab.id === 'verification') count = pendingVerificationShipments.length;
            if (tab.id === 'requests') count = requests.length;
            if (tab.id === 'partners') count = companies.length;
            if (tab.id === 'disputes') count = disputedShipments.length;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{tab.label}</span>
                {count !== null && (
                  <span
                    className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === 'shipments' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search tracking #, order #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-emerald-700 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="DOCUMENTS_PENDING">Pending Verification</option>
              <option value="READY_FOR_PICKUP">Ready for Pickup</option>
              <option value="PICKED_UP">Picked Up</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
              <option value="DELIVERED">Delivered</option>
              <option value="DELIVERY_DISPUTED">Delivery Disputed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: ALL SHIPMENTS LEDGER */}
      {activeTab === 'shipments' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Tracking Number / AWB</th>
                  <th className="px-4 py-3.5">Order Number</th>
                  <th className="px-4 py-3.5">Corridor Route</th>
                  <th className="px-4 py-3.5">Method & Transporter</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-900">
                {filteredShipments.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <span className="font-mono font-bold text-emerald-800 text-xs block">
                        {s.trackingNumber}
                      </span>
                      {s.lrBiltyNumber && (
                        <span className="text-[10px] text-slate-500 font-mono">LR: {s.lrBiltyNumber}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold text-slate-900 block">{s.order?.orderNumber || '—'}</span>
                      <span className="text-[10px] text-muted">Placed: {formatDate(s.createdAt)}</span>
                    </td>
                    <td className="px-4 py-4 max-w-xs">
                      <span className="text-[11px] block truncate text-slate-600">
                        {s.pickupAddress || 'Supplier Warehouse'}
                      </span>
                      <span className="text-[11px] block truncate font-medium text-slate-900">
                        &rarr; {s.deliveryAddress?.city || 'Buyer Destination'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2 py-0.2 text-[10px] font-bold uppercase ${
                          s.transportMethod === 'SUPPLIER_MANAGED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {s.transportMethod === 'SUPPLIER_MANAGED' ? 'Supplier' : 'TradeExpress'}
                      </span>
                      <span className="text-[11px] text-slate-600 block mt-0.5 font-medium">
                        {s.carrierName || 'Commercial Carrier'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${
                          s.status === 'DELIVERED'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : s.status === 'DELIVERY_DISPUTED'
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : s.status === 'DOCUMENTS_PENDING'
                            ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                            : ['IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s.status)
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : 'bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        {s.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right space-x-1.5 whitespace-nowrap">
                      {s.status === 'DOCUMENTS_PENDING' && (
                        <Button
                          size="sm"
                          variant="primary"
                          icon={ShieldCheck}
                          onClick={() => {
                            setVerifyShipmentTarget(s);
                            setVerifyShipmentReason('Approved by Super Admin');
                            setShowVerifyShipmentModal(true);
                          }}
                          className="text-xs bg-amber-600 hover:bg-amber-700"
                        >
                          Verify & Approve
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        icon={Navigation}
                        onClick={() => {
                          setSelectedShipment(s);
                          setShowDetailModal(true);
                        }}
                        className="text-xs"
                      >
                        Inspect & Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PENDING SUPER ADMIN VERIFICATION (MANDATORY WORKFLOW STEP 4) */}
      {activeTab === 'verification' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-700" />
                Step 4: Super Admin Truck & Shipment Verification Console
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Mandatory verification of commercial vehicle RC, driver commercial license, carrier details, and transit documents before consignments are permitted to dispatch.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-700">Total Pending:</span>
              <span className="rounded-full bg-amber-100 text-amber-900 font-extrabold px-2.5 py-0.5 border border-amber-300">
                {pendingVerificationShipments.length}
              </span>
            </div>
          </div>

          {pendingVerificationShipments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <EmptyState
                icon={CheckCircle2}
                title="No consignments pending verification"
                text="All commercial consignments have been reviewed and approved. No pending truck or driver verifications."
              />
            </div>
          ) : (
            <div className="space-y-4">
              {pendingVerificationShipments.map((s) => (
                <div key={s.id} className="bg-white rounded-2xl border border-amber-300 p-5 shadow-xs transition-shadow hover:shadow-md">
                  {/* Top Bar: IDs, Workflow Type, Status Badge */}
                  <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-slate-900 text-sm">
                          Consignment #{s.trackingNumber}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          Shipment ID: {s.id.slice(0, 8)}...
                        </span>
                        <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2.5 py-0.5 uppercase tracking-wide">
                          Awaiting Step 4 Approval
                        </span>
                        {s.transportMethod === 'SUPPLIER_MANAGED' ? (
                          <span className="rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold px-2 py-0.5">
                            Supplier-Managed
                          </span>
                        ) : (
                          <span className="rounded-full bg-blue-100 text-blue-900 border border-blue-300 text-[10px] font-bold px-2 py-0.5">
                            TradeExpress-Managed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-1">
                        Order #{s.order?.orderNumber || s.orderId} · Placed by {s.buyer?.name || 'Buyer'} ({s.buyer?.company || 'Direct'})
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-muted block text-[10px] uppercase font-bold">Scheduled Pickup</span>
                      <strong className="text-slate-800">{s.pickupScheduledAt ? formatDate(s.pickupScheduledAt) : 'Immediate'}</strong>
                    </div>
                  </div>

                  {/* Prior Correction Banner if requested */}
                  {s.notes && s.notes.includes('[Correction Requested]') && (
                    <div className="my-3 p-3 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="size-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Correction Requested from Supplier:</strong>
                        <span>{s.notes.replace('[Correction Requested]', '').trim()}</span>
                      </div>
                    </div>
                  )}

                  {/* Grid 1: Supplier, Vehicle, Driver, Carrier */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 py-3 text-xs bg-slate-50/80 rounded-xl px-4 my-3 border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Supplier Dossier</span>
                      <strong className="text-slate-900 block truncate">{s.supplier?.company || s.supplier?.name || 'Supplier'}</strong>
                      <span className="text-slate-600 block">{s.supplier?.name}</span>
                      <span className="font-mono text-slate-500 block text-[11px]">{s.supplier?.phone || s.supplier?.email || '—'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Vehicle Details</span>
                      <strong className="text-slate-900 font-mono text-xs block">{s.vehicleNumber || s.vehicle?.vehicleNumber || 'Unassigned'}</strong>
                      <span className="text-slate-600 block">{s.vehicle?.vehicleType || s.vehicleType || 'Commercial Freight'}</span>
                      <span className="text-slate-500 block text-[11px]">
                        Cap: {s.vehicle?.capacityTons ? `${s.vehicle.capacityTons} MT` : `${((s.totalWeightKg || 1000) / 1000).toFixed(1)} MT`}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Driver Credentials</span>
                      <strong className="text-slate-900 block">{s.driverName || s.driver?.name || 'Assigned Driver'}</strong>
                      <span className="font-mono text-slate-600 block">{s.driverPhone || s.driver?.phone || '—'}</span>
                      <span className="font-mono text-emerald-800 font-semibold block text-[11px]">
                        DL: {s.driver?.licenseNumber || 'Verified on Record'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Transport Carrier</span>
                      <strong className="text-slate-900 block truncate">{s.transporter?.name || s.carrierName || 'Supplier Own Fleet'}</strong>
                      <span className="text-slate-600 block font-mono text-[11px]">
                        LR: {s.lrNumber || 'Direct Bilty'}
                      </span>
                      {s.ewayBillNumber && (
                        <span className="text-slate-500 block font-mono text-[10px]">
                          E-Way: {s.ewayBillNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Grid 2: Corridor, Schedule & ETA, Freight */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-2.5 text-xs bg-slate-50/50 rounded-xl px-4 my-2 border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Corridor (Pickup &rarr; Delivery)</span>
                      <p className="text-slate-800 font-medium truncate" title={s.pickupAddress?.street ? `${s.pickupAddress.street}, ${s.pickupAddress.city}` : s.pickupAddress?.city}>
                        📍 <strong>Origin:</strong> {s.pickupAddress?.city || 'Origin'}, {s.pickupAddress?.state || ''}
                      </p>
                      <p className="text-slate-800 font-medium truncate" title={s.deliveryAddress?.street ? `${s.deliveryAddress.street}, ${s.deliveryAddress.city}` : s.deliveryAddress?.city}>
                        🏁 <strong>Destination:</strong> {s.deliveryAddress?.city || 'Destination'}, {s.deliveryAddress?.state || ''}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Timeline & ETA</span>
                      <span className="text-slate-700 block">
                        Pickup: <strong>{s.pickupScheduledAt ? formatDate(s.pickupScheduledAt) : 'Immediate'}</strong>
                      </span>
                      <span className="text-slate-700 block">
                        Estimated Delivery: <strong>{s.estimatedDeliveryAt ? formatDate(s.estimatedDeliveryAt) : 'Calculated upon dispatch'}</strong>
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Freight & Charges</span>
                      <strong className="text-slate-900 text-sm block">
                        ₹{Number(s.freightCharges || 0).toLocaleString('en-IN')}
                      </strong>
                      <span className="text-slate-500 text-[11px] block">
                        Payer: <span className="font-semibold text-slate-700">{s.freightPayer || 'SUPPLIER'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Compliance Documents Section (RC, Insurance, Permit, Driver DL, LR/Bilty) */}
                  <div className="my-3 p-3 bg-white rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FileText className="size-3.5 text-emerald-700" />
                        Compliance & Transit Documents ({s.documents?.length || 0})
                      </span>
                      <span className="text-[11px] text-slate-400">RC, Insurance, Commercial DL, Permit, LR/Bilty</span>
                    </div>

                    {s.documents && s.documents.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {s.documents.map((doc) => (
                          <a
                            key={doc.id || doc.fileUrl}
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-xs text-slate-800 transition-colors group"
                            title={`Click to view/download ${doc.title || doc.docType}`}
                          >
                            <FileText className="size-3 text-slate-500 group-hover:text-emerald-700" />
                            <span className="font-semibold text-[11px]">{doc.title || doc.docType}</span>
                            {doc.isVerified ? (
                              <span className="size-2 rounded-full bg-emerald-500" title="Verified" />
                            ) : (
                              <span className="size-2 rounded-full bg-amber-500" title="Pending Verification" />
                            )}
                            <ExternalLink className="size-3 text-slate-400 group-hover:text-emerald-700" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
                          Vehicle registration and driver license details recorded. Attached document scans pending upload.
                        </span>
                        <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">Awaiting Scan Upload</span>
                      </div>
                    )}
                  </div>

                  {/* Actions: Full Dossier, Request Correction, Reject with Reason, Approve for Dispatch */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      icon={Navigation}
                      onClick={() => {
                        setSelectedShipment(s);
                        setShowDetailModal(true);
                      }}
                      className="text-xs"
                    >
                      Inspect Full Dossier
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      icon={AlertTriangle}
                      onClick={() => {
                        setVerifyShipmentTarget(s);
                        setVerifyActionType('CORRECTION');
                        setVerifyShipmentReason('');
                        setShowVerifyShipmentModal(true);
                      }}
                      className="text-xs text-amber-800 border-amber-300 hover:bg-amber-50"
                    >
                      Request Correction
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      icon={XCircle}
                      onClick={() => {
                        setVerifyShipmentTarget(s);
                        setVerifyActionType('REJECT');
                        setVerifyShipmentReason('');
                        setShowVerifyShipmentModal(true);
                      }}
                      className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
                    >
                      Reject with Reason
                    </Button>

                    <Button
                      size="sm"
                      variant="primary"
                      icon={CheckCircle2}
                      onClick={() => {
                        setVerifyShipmentTarget(s);
                        setVerifyActionType('APPROVE');
                        setVerifyShipmentReason('Approved by Super Admin. Compliant with transport specifications.');
                        setShowVerifyShipmentModal(true);
                      }}
                      disabled={submittingShipmentVerify}
                      className="text-xs"
                    >
                      Approve for Dispatch
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TRANSPORT REQUESTS & QUOTES */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {requests.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between border-b pb-3 gap-2">
                <div>
                  <span className="font-mono font-bold text-slate-900 text-sm">Request #{r.requestNumber}</span>
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase">
                    {r.status.replace(/_/g, ' ')}
                  </span>
                  <p className="text-xs text-muted mt-0.5">
                    Order #{r.order?.orderNumber} · Vehicle: {r.vehicleTypeRequired} · Weight: {r.cargoWeightKg} kg
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  Expected: {r.expectedPickupDate ? formatDate(r.expectedPickupDate) : 'Immediate'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl my-3 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><strong>Origin:</strong> {r.pickupAddress}</div>
                <div><strong>Destination:</strong> {r.deliveryAddress}</div>
              </div>

              {/* Quotes */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Quotations Submitted ({r.quotes?.length || 0})
                </span>
                {(r.quotes || []).map((q) => (
                  <div key={q.id} className="flex items-center justify-between p-2.5 bg-white rounded-xl border text-xs">
                    <div>
                      <strong className="text-slate-900">{q.partnerCompany?.name || 'Verified Partner'}</strong>
                      <span className="text-slate-500 block text-[11px]">
                        Base: {money(q.baseFreight)} | GST (5% GTA): {money(q.gstAmount)} | Transit: {q.estimatedTransitHours} hrs
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-emerald-900 font-mono block">
                        {money(q.totalAmount)}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-500">{q.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: TRANSPORT PARTNERS & KYC */}
      {activeTab === 'partners' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Company Name</th>
                  <th className="px-4 py-3.5">Tax Identifiers</th>
                  <th className="px-4 py-3.5">Contact Details</th>
                  <th className="px-4 py-3.5">KYC Status</th>
                  <th className="px-4 py-3.5 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <strong className="text-slate-900 text-xs block">{c.name}</strong>
                      <span className="text-[11px] text-slate-500">{c.address || 'Address on file'}</span>
                    </td>
                    <td className="px-4 py-4 font-mono text-[11px]">
                      <div>GSTIN: {c.gstin || 'Pending'}</div>
                      <div>PAN: {c.panNumber || 'Pending'}</div>
                    </td>
                    <td className="px-4 py-4 text-[11px]">
                      <div>{c.email || '—'}</div>
                      <div>{c.phone || '—'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          c.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.verificationStatus === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.verificationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right space-x-2">
                      {c.verificationStatus !== 'VERIFIED' && (
                        <Button
                          size="sm"
                          variant="primary"
                          icon={CheckCircle2}
                          onClick={() => handleApproveCompany(c.id)}
                          className="text-xs"
                        >
                          Approve KYC
                        </Button>
                      )}
                      {c.verificationStatus !== 'REJECTED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          icon={XCircle}
                          onClick={() => {
                            setVerifyCompanyTarget(c);
                            setShowRejectCompanyModal(true);
                          }}
                          className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
                        >
                          Reject
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: VEHICLES & DRIVERS */}
      {activeTab === 'fleet' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Commercial Vehicles</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Vehicle #</th>
                    <th className="px-4 py-2.5">Type & Capacity</th>
                    <th className="px-4 py-2.5">Permit & RC</th>
                    <th className="px-4 py-2.5">Insurance Policy</th>
                    <th className="px-4 py-2.5 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicles.map((v) => (
                    <tr key={v.id}>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{v.vehicleNumber}</td>
                      <td className="px-4 py-3">{v.vehicleType} ({v.capacityMetricTons} MT)</td>
                      <td className="px-4 py-3 font-mono">{v.permitType} | {v.rcNumber || 'RC-OK'}</td>
                      <td className="px-4 py-3 font-mono">{v.insurancePolicyNumber || 'POL-ACTIVE'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={v.isVerified ? 'outline' : 'primary'}
                          onClick={() => handleToggleVehicleVerify(v)}
                          className="text-[11px]"
                        >
                          {v.isVerified ? 'Verified (Revoke)' : 'Verify Vehicle'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Commercial Drivers</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Driver Name</th>
                    <th className="px-4 py-2.5">Phone Number</th>
                    <th className="px-4 py-2.5">Driving License #</th>
                    <th className="px-4 py-2.5">DL Expiry</th>
                    <th className="px-4 py-2.5 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {drivers.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-3 font-bold text-slate-900">{d.name}</td>
                      <td className="px-4 py-3 font-mono">{d.phone}</td>
                      <td className="px-4 py-3 font-mono">{d.licenseNumber}</td>
                      <td className="px-4 py-3">{d.licenseExpiry ? formatDate(d.licenseExpiry) : 'Valid'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={d.isVerified ? 'outline' : 'primary'}
                          onClick={() => handleToggleDriverVerify(d)}
                          className="text-[11px]"
                        >
                          {d.isVerified ? 'Verified (Revoke)' : 'Verify Driver'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: DELIVERY DISPUTES */}
      {activeTab === 'disputes' && (
        <div className="space-y-4">
          {disputedShipments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <EmptyState
                icon={CheckCircle2}
                title="No active delivery disputes"
                text="All marketplace freight deliveries are operating normally without open buyer disputes."
              />
            </div>
          ) : (
            disputedShipments.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-rose-200 p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-rose-100 pb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-5 text-rose-600" />
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      Dispute on AWB #{s.trackingNumber}
                    </span>
                    <span className="rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 uppercase">
                      Action Required
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">Order #{s.order?.orderNumber}</span>
                </div>

                <div className="py-3 text-xs space-y-1 text-slate-800">
                  <p><strong>Carrier:</strong> {s.carrierName} ({s.vehicleNumber})</p>
                  <p><strong>Driver:</strong> {s.driverName} ({s.driverPhone || '—'})</p>
                  <p><strong>Buyer City:</strong> {s.deliveryAddress?.city}</p>
                </div>

                <div className="pt-3 border-t flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={Navigation}
                    onClick={() => {
                      setSelectedShipment(s);
                      setShowDetailModal(true);
                    }}
                    className="text-xs"
                  >
                    View Full Evidence & Timeline
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={ShieldAlert}
                    onClick={() => {
                      setDisputeShipment(s);
                      setDisputeResolution('');
                      setDisputeRefund('0');
                      setShowDisputeModal(true);
                    }}
                    className="text-xs bg-rose-700 hover:bg-rose-800"
                  >
                    Resolve Dispute
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 7: FREIGHT ESCROW DISBURSALS */}
      {activeTab === 'escrow' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Freight Escrow Release Ledger</h3>
            <p className="text-xs text-muted">
              Release secured freight funds to verified transport partners upon Proof of Delivery. 1% TDS automatically deducted under Section 194C.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Consignment</th>
                  <th className="px-4 py-3">Transporter</th>
                  <th className="px-4 py-3">Base</th>
                  <th className="px-4 py-3">GTA GST (5%)</th>
                  <th className="px-4 py-3">TDS (1% 194C)</th>
                  <th className="px-4 py-3">Net Disbursal</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Escrow Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {freightPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-800">
                      {p.shipment?.trackingNumber || 'Consignment'}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {p.partnerCompany?.name || 'Transport Partner'}
                    </td>
                    <td className="px-4 py-3">{money(p.baseFreight)}</td>
                    <td className="px-4 py-3 text-emerald-800 font-semibold">{money(p.gstAmount)}</td>
                    <td className="px-4 py-3 text-rose-700 font-mono">-{money(p.tdsAmount || 0)}</td>
                    <td className="px-4 py-3 font-black text-slate-900 font-mono">
                      {money(p.totalAmount - (p.tdsAmount || 0))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          p.status === 'RELEASED_TO_PARTNER'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.status === 'HELD_IN_ESCROW' && (
                        <Button
                          size="sm"
                          variant="primary"
                          icon={DollarSign}
                          onClick={() => {
                            setSelectedPayment(p);
                            setShowReleaseModal(true);
                          }}
                          className="text-xs"
                        >
                          Release Escrow
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ESCROW RELEASE */}
      {selectedPayment && (
        <Modal
          open={showReleaseModal}
          onClose={() => setShowReleaseModal(false)}
          title={`Release Escrow Freight — ${money(selectedPayment.totalAmount - (selectedPayment.tdsAmount || 0))}`}
          className="max-w-md"
        >
          <form onSubmit={handleReleaseEscrowSubmit} className="space-y-4 text-xs text-slate-900">
            <p className="text-[11px] text-slate-500">
              Confirm payment disbursal to <strong>{selectedPayment.partnerCompany?.name}</strong>. Goods have been verified delivered.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Total Freight + GST:</span>
                <span className="font-mono">{money(selectedPayment.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>TDS Deduction (1% Sec 194C):</span>
                <span className="font-mono">-{money(selectedPayment.tdsAmount || 0)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t text-emerald-900">
                <span>Net Bank Payout:</span>
                <span className="font-mono">{money(selectedPayment.totalAmount - (selectedPayment.tdsAmount || 0))}</span>
              </div>
            </div>

            <div>
              <label className="font-bold block mb-1">Release Authorization Reason *</label>
              <textarea
                required
                rows={2}
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowReleaseModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" icon={DollarSign} disabled={submittingRelease}>
                {submittingRelease ? 'Disbursing...' : 'Confirm Disbursal'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: RESOLVE DISPUTE */}
      {disputeShipment && (
        <Modal
          open={showDisputeModal}
          onClose={() => setShowDisputeModal(false)}
          title={`Resolve Delivery Dispute — AWB #${disputeShipment.trackingNumber}`}
          className="max-w-md"
        >
          <form onSubmit={handleResolveDisputeSubmit} className="space-y-4 text-xs text-slate-900">
            <div>
              <label className="font-bold block mb-1">Dispute Resolution Verdict *</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Carrier replaced damaged units; goods redelivered and inspected."
                value={disputeResolution}
                onChange={(e) => setDisputeResolution(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold block mb-1">Buyer Refund Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={disputeRefund}
                  onChange={(e) => setDisputeRefund(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 font-mono text-xs focus:border-emerald-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Final Consignment State</label>
                <select
                  value={disputeCloseStatus}
                  onChange={(e) => setDisputeCloseStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-emerald-700 focus:outline-none"
                >
                  <option value="DELIVERED">DELIVERED (Accepted by Buyer)</option>
                  <option value="RETURNED">RETURNED (Goods Returned to Supplier)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowDisputeModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={submittingDispute}>
                {submittingDispute ? 'Resolving...' : 'Close & Resolve Dispute'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: REJECT TRANSPORTER */}
      {verifyCompanyTarget && (
        <Modal
          open={showRejectCompanyModal}
          onClose={() => setShowRejectCompanyModal(false)}
          title={`Reject Transporter KYC — ${verifyCompanyTarget.name}`}
          className="max-w-md"
        >
          <form onSubmit={handleRejectCompany} className="space-y-4 text-xs text-slate-900">
            <div>
              <label className="font-bold block mb-1">Reason for Rejection *</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Invalid GSTIN certificate or expired transport trade permit."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowRejectCompanyModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={submittingVerify} className="bg-rose-700 hover:bg-rose-800">
                {submittingVerify ? 'Saving...' : 'Confirm Rejection'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: VERIFY / REJECT / CORRECT SHIPMENT (STEP 4) */}
      {showVerifyShipmentModal && verifyShipmentTarget && (
        <Modal
          open={showVerifyShipmentModal}
          onClose={() => {
            setShowVerifyShipmentModal(false);
            setVerifyShipmentTarget(null);
          }}
          title={
            verifyActionType === 'APPROVE'
              ? `Approve Consignment for Dispatch — #${verifyShipmentTarget.trackingNumber}`
              : verifyActionType === 'CORRECTION'
              ? `Request Correction from Supplier — #${verifyShipmentTarget.trackingNumber}`
              : `Reject Consignment Verification — #${verifyShipmentTarget.trackingNumber}`
          }
          className="max-w-md"
        >
          <div className="space-y-3.5 text-xs text-slate-900">
            {/* Context Summary */}
            <div className={`p-3 rounded-xl border text-[11px] space-y-1.5 ${
              verifyActionType === 'APPROVE'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : verifyActionType === 'CORRECTION'
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}>
              <div className="flex items-center justify-between font-bold">
                <span>Vehicle: {verifyShipmentTarget.vehicleNumber || 'Unassigned'}</span>
                <span className="uppercase text-[10px]">{verifyShipmentTarget.transportMethod}</span>
              </div>
              <p><strong>Driver:</strong> {verifyShipmentTarget.driverName || 'Driver'} ({verifyShipmentTarget.driverPhone || '—'})</p>
              <p><strong>Carrier:</strong> {verifyShipmentTarget.transporter?.name || verifyShipmentTarget.carrierName || 'Commercial Fleet'}</p>
              <p><strong>Corridor:</strong> {verifyShipmentTarget.pickupAddress?.city || 'Origin'} &rarr; {verifyShipmentTarget.deliveryAddress?.city || 'Destination'}</p>
              <p><strong>Documents:</strong> {verifyShipmentTarget.documents?.length || 0} document(s) uploaded</p>
            </div>

            {/* Explanatory Banner */}
            {verifyActionType === 'APPROVE' ? (
              <p className="text-slate-600 leading-relaxed">
                Approving this shipment marks all transit documents and vehicle credentials verified. The status will transition to <strong>READY_FOR_PICKUP</strong>, permitting dispatch and generating the secure delivery verification OTP.
              </p>
            ) : verifyActionType === 'CORRECTION' ? (
              <p className="text-amber-800 leading-relaxed font-medium">
                Specify what details or documents need rectification. The consignment remains locked in <strong>DOCUMENTS_PENDING</strong> and the supplier receives an urgent notification to update the submission.
              </p>
            ) : (
              <p className="text-rose-800 leading-relaxed font-medium">
                Rejecting this consignment cancels dispatch authorization and frees vehicle/driver assignments. Provide an official reason for the supplier audit record.
              </p>
            )}

            {/* Note / Reason Field */}
            <div>
              <label className="font-bold block mb-1">
                {verifyActionType === 'APPROVE'
                  ? 'Verification Approval Note (Optional)'
                  : verifyActionType === 'CORRECTION'
                  ? 'Required Correction Instructions *'
                  : 'Official Rejection Reason *'}
              </label>
              <textarea
                rows={3}
                placeholder={
                  verifyActionType === 'APPROVE'
                    ? 'Enter approval notes...'
                    : verifyActionType === 'CORRECTION'
                    ? 'e.g. Please re-upload clearer copy of Vehicle RC / Commercial driver license expired, please assign an active licensed driver...'
                    : 'e.g. Invalid vehicle registration / Non-compliant carrier credentials...'
                }
                value={verifyShipmentReason}
                onChange={(e) => setVerifyShipmentReason(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowVerifyShipmentModal(false);
                  setVerifyShipmentTarget(null);
                }}
                disabled={submittingShipmentVerify}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant={verifyActionType === 'APPROVE' ? 'primary' : 'outline'}
                size="sm"
                icon={verifyActionType === 'APPROVE' ? CheckCircle2 : verifyActionType === 'CORRECTION' ? AlertTriangle : XCircle}
                onClick={() => handleExecuteShipmentAction(verifyShipmentTarget.id, verifyActionType, verifyShipmentReason)}
                disabled={submittingShipmentVerify}
                className={
                  verifyActionType === 'CORRECTION'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                    : verifyActionType === 'REJECT'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600'
                    : ''
                }
              >
                {submittingShipmentVerify
                  ? 'Processing...'
                  : verifyActionType === 'APPROVE'
                  ? 'Approve for Dispatch'
                  : verifyActionType === 'CORRECTION'
                  ? 'Send Correction Request'
                  : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: SHIPMENT DETAIL */}
      {selectedShipment && (
        <ShipmentDetailModal
          shipment={selectedShipment}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedShipment(null);
          }}
          currentUser={user}
          onRefresh={loadAllData}
          showToast={showToast}
        />
      )}
    </div>
  );
}
