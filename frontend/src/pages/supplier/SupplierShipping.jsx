import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Truck,
  Package,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  MapPin,
  Send,
  ShieldCheck,
  FileText,
  Plus,
  Car,
  User,
  Building2,
  DollarSign,
  Navigation,
  FileCheck2,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import useNotifications from '../../hooks/useNotifications';
import useCurrency from '../../hooks/useCurrency';
import useAuth from '../../hooks/useAuth';
import {
  getShipments,
  getTransportRequests,
  createTransportRequest,
  acceptFreightQuote,
  createSupplierShipment,
  updateShipmentStatus,
  getVehicles,
  addVehicle,
  getDrivers,
  addDriver,
  getTransportCompanies,
  createTransportCompany,
} from '../../api/logisticsApi';
import { fetchSupplierShipping, submitOrderDispatch } from '../../services/supplierDashboardApi';
import { formatDate } from '../../utils/formatDate';
import ShipmentDetailModal from '../../components/logistics/ShipmentDetailModal';

const TABS = [
  { id: 'shipments', label: 'All Consignments' },
  { id: 'requests', label: 'Transport Requests & Quotes' },
  { id: 'fleet', label: 'Fleet & Drivers' },
  { id: 'awaiting', label: 'Ready for Dispatch' },
];

export default function SupplierShipping() {
  const [searchParams] = useSearchParams();
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('shipments');
  const [loading, setLoading] = useState(true);

  // Data states
  const [shipmentsData, setShipmentsData] = useState([]);
  const [requestsData, setRequestsData] = useState([]);
  const [vehiclesData, setVehiclesData] = useState([]);
  const [driversData, setDriversData] = useState([]);
  const [companiesData, setCompaniesData] = useState([]);
  const [legacyOrders, setLegacyOrders] = useState({ awaitingDispatch: [], inTransit: [], delivered: [] });

  // Filtering & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Shipment detail modal
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [showShipmentModal, setShowShipmentModal] = useState(false);

  // Modals for actions
  const [showSupplierManagedModal, setShowSupplierManagedModal] = useState(false);
  const [showTradeExpressReqModal, setShowTradeExpressReqModal] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Form states for Supplier-Managed Consignment
  const [smOrderId, setSmOrderId] = useState('');
  const [smVehicleNumber, setSmVehicleNumber] = useState('');
  const [smDriverName, setSmDriverName] = useState('');
  const [smDriverPhone, setSmDriverPhone] = useState('');
  const [smTransportCompany, setSmTransportCompany] = useState('');
  const [smLrNumber, setSmLrNumber] = useState('');
  const [smEwayBill, setSmEwayBill] = useState('');
  const [smFreightCharge, setSmFreightCharge] = useState('');
  const [smEstDelivery, setSmEstDelivery] = useState('');

  // Form states for TradeExpress-Managed Transport Request
  const [reqOrderId, setReqOrderId] = useState('');
  const [reqVehicleType, setReqVehicleType] = useState('TATA_ACE');
  const [reqCargoWeight, setReqCargoWeight] = useState('500');
  const [reqCargoVolume, setReqCargoVolume] = useState('10');
  const [reqCargoType, setReqCargoType] = useState('STANDARD');
  const [reqPickupDate, setReqPickupDate] = useState('');
  const [reqPickupAddress, setReqPickupAddress] = useState('');
  const [reqDeliveryAddress, setReqDeliveryAddress] = useState('');
  const [reqSpecialNotes, setReqSpecialNotes] = useState('');

  // Form states for Add Vehicle
  const [vehNumber, setVehNumber] = useState('');
  const [vehType, setVehType] = useState('TATA_ACE');
  const [vehCapacity, setVehCapacity] = useState('1.5');
  const [vehRcNumber, setVehRcNumber] = useState('');
  const [vehPermitType, setVehPermitType] = useState('NATIONAL');
  const [vehInsurancePolicy, setVehInsurancePolicy] = useState('');

  // Form states for Add Driver
  const [drvName, setDrvName] = useState('');
  const [drvPhone, setDrvPhone] = useState('');
  const [drvLicense, setDrvLicense] = useState('');
  const [drvExpiry, setDrvExpiry] = useState('');
  const [drvEmergency, setDrvEmergency] = useState('');

  // Form states for Add Transport Company
  const [compName, setCompName] = useState('');
  const [compGstin, setCompGstin] = useState('');
  const [compPan, setCompPan] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compAddress, setCompAddress] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    const orderIdParam = searchParams.get('orderId');
    if (orderIdParam) {
      setSmOrderId(orderIdParam);
      setReqOrderId(orderIdParam);
      setShowSupplierManagedModal(true);
    }
  }, [searchParams]);

  async function loadAllData() {
    setLoading(true);
    try {
      const [shipmentsRes, reqsRes, vehRes, drvRes, compRes, legRes] = await Promise.allSettled([
        getShipments({ limit: 100 }),
        getTransportRequests(),
        getVehicles(),
        getDrivers(),
        getTransportCompanies(),
        fetchSupplierShipping(),
      ]);

      if (shipmentsRes.status === 'fulfilled') {
        setShipmentsData(shipmentsRes.value?.shipments || shipmentsRes.value || []);
      }
      if (reqsRes.status === 'fulfilled') {
        setRequestsData(Array.isArray(reqsRes.value) ? reqsRes.value : reqsRes.value?.requests || []);
      }
      if (vehRes.status === 'fulfilled') {
        setVehiclesData(Array.isArray(vehRes.value) ? vehRes.value : vehRes.value?.vehicles || []);
      }
      if (drvRes.status === 'fulfilled') {
        setDriversData(Array.isArray(drvRes.value) ? drvRes.value : drvRes.value?.drivers || []);
      }
      if (compRes.status === 'fulfilled') {
        setCompaniesData(Array.isArray(compRes.value) ? compRes.value : compRes.value?.companies || []);
      }
      if (legRes.status === 'fulfilled') {
        setLegacyOrders(legRes.value?.data || { awaitingDispatch: [], inTransit: [], delivered: [] });
      }
    } catch (err) {
      showToast(err.message || 'Error loading logistics data', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Combined eligible orders for dispatch / transport request
  const eligibleOrders = useMemo(() => {
    return legacyOrders.awaitingDispatch || [];
  }, [legacyOrders]);

  // Filtered shipments
  const filteredShipments = useMemo(() => {
    return (shipmentsData || []).filter((s) => {
      const matchesSearch =
        !searchQuery ||
        s.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.order?.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.carrierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.lrBiltyNumber?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [shipmentsData, searchQuery, statusFilter]);

  // Handler: Create Supplier-Managed Consignment
  async function handleCreateSupplierManaged(e) {
    e.preventDefault();
    if (!smOrderId) {
      showToast('Please select a confirmed order to dispatch.', 'warning');
      return;
    }
    if (!smVehicleNumber.trim() || !smDriverName.trim()) {
      showToast('Please enter both vehicle number and driver details.', 'warning');
      return;
    }

    setSubmittingAction(true);
    try {
      await createSupplierShipment({
        orderId: smOrderId,
        transportMethod: 'SUPPLIER_MANAGED',
        vehicleNumber: smVehicleNumber.trim().toUpperCase(),
        driverName: smDriverName.trim(),
        driverPhone: smDriverPhone.trim() || undefined,
        carrierName: smTransportCompany.trim() || 'Own Commercial Fleet',
        lrBiltyNumber: smLrNumber.trim() || undefined,
        ewayBillNumber: smEwayBill.trim() || undefined,
        freightCharge: smFreightCharge ? Number(smFreightCharge) : 0,
        estimatedDeliveryDate: smEstDelivery || undefined,
      });

      showToast('Truck details & documents submitted! Awaiting Super Admin verification (Step 4) before dispatch.', 'success');
      setShowSupplierManagedModal(false);
      resetSmForm();
      loadAllData();
    } catch (err) {
      showToast(err.message || 'Failed to submit shipment details', 'error');
    } finally {
      setSubmittingAction(false);
    }
  }

  // Handler: Supplier Dispatch Consignment after Super Admin Verification (Step 5)
  async function handleSupplierDispatch(shipment) {
    if (!window.confirm(`Confirm dispatch of consignment ${shipment.trackingNumber || shipment.shipmentNumber}? This will mark the linked order as Shipped.`)) {
      return;
    }
    setSubmittingAction(true);
    try {
      await updateShipmentStatus(shipment.id, {
        newStatus: 'PICKED_UP',
        notes: 'Dispatched by supplier from facility after Super Admin verification',
      });
      showToast(`Consignment ${shipment.trackingNumber || ''} dispatched successfully! Order marked Shipped.`, 'success');
      loadAllData();
    } catch (err) {
      showToast(err.message || 'Failed to dispatch consignment', 'error');
    } finally {
      setSubmittingAction(false);
    }
  }

  function resetSmForm() {
    setSmOrderId('');
    setSmVehicleNumber('');
    setSmDriverName('');
    setSmDriverPhone('');
    setSmTransportCompany('');
    setSmLrNumber('');
    setSmEwayBill('');
    setSmFreightCharge('');
    setSmEstDelivery('');
  }

  // Handler: Create TradeExpress-Managed Transport Request
  async function handleCreateTradeExpressRequest(e) {
    e.preventDefault();
    if (!reqOrderId) {
      showToast('Please select an order for transport request.', 'warning');
      return;
    }
    if (!reqPickupAddress.trim() || !reqDeliveryAddress.trim()) {
      showToast('Please specify pickup and delivery addresses.', 'warning');
      return;
    }

    setSubmittingAction(true);
    try {
      await createTransportRequest({
        orderId: reqOrderId,
        vehicleTypeRequired: reqVehicleType,
        cargoWeightKg: Number(reqCargoWeight) || 500,
        cargoVolumeCbm: Number(reqCargoVolume) || 5,
        cargoType: reqCargoType,
        expectedPickupDate: reqPickupDate || undefined,
        pickupAddress: reqPickupAddress.trim(),
        deliveryAddress: reqDeliveryAddress.trim(),
        specialInstructions: reqSpecialNotes.trim() || undefined,
      });

      showToast('TradeExpress transport request broadcasted! Verified partners will submit quotations.', 'success');
      setShowTradeExpressReqModal(false);
      resetReqForm();
      loadAllData();
      setActiveTab('requests');
    } catch (err) {
      showToast(err.message || 'Failed to submit transport request', 'error');
    } finally {
      setSubmittingAction(false);
    }
  }

  function resetReqForm() {
    setReqOrderId('');
    setReqVehicleType('TATA_ACE');
    setReqCargoWeight('500');
    setReqCargoVolume('10');
    setReqCargoType('STANDARD');
    setReqPickupDate('');
    setReqPickupAddress('');
    setReqDeliveryAddress('');
    setReqSpecialNotes('');
  }

  // Handler: Accept Quote for TradeExpress Request
  async function handleAcceptQuote(quoteId) {
    if (!window.confirm('Accept this freight quotation and assign carrier? Escrow payment will be initiated.')) {
      return;
    }

    setSubmittingAction(true);
    try {
      await acceptFreightQuote(quoteId);
      showToast('Quotation accepted! Carrier assigned and shipment created in escrow.', 'success');
      loadAllData();
      setActiveTab('shipments');
    } catch (err) {
      showToast(err.message || 'Failed to accept quote', 'error');
    } finally {
      setSubmittingAction(false);
    }
  }

  // Handler: Add Vehicle
  async function handleAddVehicleSubmit(e) {
    e.preventDefault();
    if (!vehNumber.trim()) {
      showToast('Vehicle registration number is required.', 'warning');
      return;
    }

    setSubmittingAction(true);
    try {
      await addVehicle({
        vehicleNumber: vehNumber.trim().toUpperCase(),
        vehicleType: vehType,
        capacityMetricTons: Number(vehCapacity) || 1.5,
        rcNumber: vehRcNumber.trim() || undefined,
        permitType: vehPermitType,
        insurancePolicyNumber: vehInsurancePolicy.trim() || undefined,
      });

      showToast(`Vehicle ${vehNumber.trim().toUpperCase()} registered successfully!`, 'success');
      setShowAddVehicleModal(false);
      setVehNumber('');
      setVehRcNumber('');
      setVehInsurancePolicy('');
      loadAllData();
    } catch (err) {
      showToast(err.message || 'Failed to register vehicle', 'error');
    } finally {
      setSubmittingAction(false);
    }
  }

  // Handler: Add Driver
  async function handleAddDriverSubmit(e) {
    e.preventDefault();
    if (!drvName.trim() || !drvPhone.trim() || !drvLicense.trim()) {
      showToast('Driver name, phone and driving license are required.', 'warning');
      return;
    }

    setSubmittingAction(true);
    try {
      await addDriver({
        name: drvName.trim(),
        phone: drvPhone.trim(),
        licenseNumber: drvLicense.trim().toUpperCase(),
        licenseExpiry: drvExpiry || undefined,
        emergencyContact: drvEmergency.trim() || undefined,
      });

      showToast(`Driver ${drvName.trim()} added to fleet successfully!`, 'success');
      setShowAddDriverModal(false);
      setDrvName('');
      setDrvPhone('');
      setDrvLicense('');
      setDrvEmergency('');
      loadAllData();
    } catch (err) {
      showToast(err.message || 'Failed to add driver', 'error');
    } finally {
      setSubmittingAction(false);
    }
  }

  // Handler: Add Transport Company
  async function handleAddCompanySubmit(e) {
    e.preventDefault();
    if (!compName.trim()) {
      showToast('Company legal name is required.', 'warning');
      return;
    }

    setSubmittingAction(true);
    try {
      await createTransportCompany({
        name: compName.trim(),
        gstin: compGstin.trim() || undefined,
        panNumber: compPan.trim() || undefined,
        email: compEmail.trim() || undefined,
        phone: compPhone.trim() || undefined,
        address: compAddress.trim() || undefined,
      });

      showToast(`Transport company "${compName.trim()}" registered!`, 'success');
      setShowAddCompanyModal(false);
      setCompName('');
      setCompGstin('');
      setCompPan('');
      setCompEmail('');
      setCompPhone('');
      setCompAddress('');
      loadAllData();
    } catch (err) {
      showToast(err.message || 'Failed to add transport company', 'error');
    } finally {
      setSubmittingAction(false);
    }
  }

  // Helper status color badge
  function getStatusBadge(status) {
    const s = String(status || '').toUpperCase();
    if (['DELIVERED'].includes(s)) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP'].includes(s)) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (['DOCUMENTS_PENDING'].includes(s)) {
      return 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
    }
    if (['READY_FOR_PICKUP', 'DOCUMENTS_VERIFIED', 'PICKUP_SCHEDULED', 'TRANSPORT_ASSIGNED', 'QUOTATION_RECEIVED'].includes(s)) {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
    if (['DELIVERY_DISPUTED', 'CANCELLED'].includes(s)) {
      return 'bg-rose-100 text-rose-800 border-rose-200';
    }
    return 'bg-slate-100 text-slate-800 border-slate-200';
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <SectionHeading
        title="Transportation & Logistics Command Center"
        description="End-to-end B2B freight fulfillment. Support for Supplier-Managed fleets or TradeExpress-Managed verified logistics network."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Plus}
              onClick={() => setShowTradeExpressReqModal(true)}
              className="border-emerald-700/30 text-emerald-900 hover:bg-emerald-50"
            >
              Request TradeExpress Transport
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Truck}
              onClick={() => setShowSupplierManagedModal(true)}
            >
              Arrange Delivery (Supplier-Managed)
            </Button>
          </div>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-600">Active Shipments</span>
            <Truck className="size-4 text-emerald-700" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {(shipmentsData || []).filter((s) => !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(s.status)).length}
          </p>
          <span className="text-[11px] text-emerald-800 font-medium">Consignments on road / assigned</span>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-600">Delivered</span>
            <CheckCircle2 className="size-4 text-blue-700" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {(shipmentsData || []).filter((s) => s.status === 'DELIVERED').length}
          </p>
          <span className="text-[11px] text-blue-800 font-medium">Proof of Delivery verified</span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-600">Transport Requests</span>
            <FileText className="size-4 text-amber-700" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {(requestsData || []).length}
          </p>
          <span className="text-[11px] text-amber-800 font-medium">TradeExpress quotations received</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-600">Fleet & Drivers</span>
            <Car className="size-4 text-slate-700" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {(vehiclesData || []).length} / {(driversData || []).length}
          </p>
          <span className="text-[11px] text-slate-600 font-medium">Vehicles / Drivers registered</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            let count = null;
            if (tab.id === 'shipments') count = shipmentsData.length;
            if (tab.id === 'requests') count = requestsData.length;
            if (tab.id === 'fleet') count = (vehiclesData.length + driversData.length);
            if (tab.id === 'awaiting') count = legacyOrders.awaitingDispatch.length;

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
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search AWB, Order, LR #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-emerald-700 focus:outline-none font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="READY_FOR_PICKUP">Ready for Pickup</option>
              <option value="PICKED_UP">Picked Up</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
              <option value="DELIVERED">Delivered</option>
              <option value="DELIVERY_DISPUTED">Disputed</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: ALL CONSIGNMENTS / SHIPMENTS */}
      {activeTab === 'shipments' && (
        <div>
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <TableSkeleton />
            </div>
          ) : filteredShipments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <EmptyState
                icon={Truck}
                title="No active consignments found"
                text={
                  searchQuery || statusFilter !== 'ALL'
                    ? 'No consignments match your current filters.'
                    : 'Dispatch your first shipment using "Arrange Delivery" or request TradeExpress Transport.'
                }
                action={
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={Truck}
                      onClick={() => setShowSupplierManagedModal(true)}
                    >
                      Arrange Delivery
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={Plus}
                      onClick={() => setShowTradeExpressReqModal(true)}
                    >
                      Request Transport
                    </Button>
                  </div>
                }
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Consignment / AWB</th>
                      <th className="px-4 py-3.5">Order & Destination</th>
                      <th className="px-4 py-3.5">Transport Method</th>
                      <th className="px-4 py-3.5">Vehicle & Driver</th>
                      <th className="px-4 py-3.5">Live Status</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-900">
                    {filteredShipments.map((s) => {
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-4">
                            <span className="font-mono font-bold text-emerald-800 text-xs block">
                              {s.trackingNumber}
                            </span>
                            {s.lrBiltyNumber && (
                              <span className="text-[11px] text-slate-500 block font-mono">
                                LR: {s.lrBiltyNumber}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">
                              Dispatched: {formatDate(s.createdAt)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="font-semibold block text-slate-900">
                              {s.order?.orderNumber || 'B2B Order'}
                            </span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="size-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[200px]">
                                {s.deliveryAddress?.city || s.order?.deliveryAddress?.city || 'India'}, {s.deliveryAddress?.state || s.order?.deliveryAddress?.state || ''}
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                                s.transportMethod === 'SUPPLIER_MANAGED'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              {s.transportMethod === 'SUPPLIER_MANAGED' ? 'Supplier Fleet' : 'TradeExpress'}
                            </span>
                            <span className="text-[11px] text-slate-500 block mt-1">
                              {s.carrierName || 'Commercial Carrier'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="font-bold font-mono text-slate-900 block text-xs">
                              {s.vehicleNumber || s.vehicle?.vehicleNumber || 'Unassigned'}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {s.driverName || s.driver?.name || 'Driver on Duty'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(
                                s.status
                              )}`}
                            >
                              {s.status.replace(/_/g, ' ')}
                            </span>
                            {s.estimatedDeliveryDate && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                ETA: {formatDate(s.estimatedDeliveryDate)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right space-x-2">
                            {(s.status === 'READY_FOR_PICKUP' || s.status === 'DOCUMENTS_VERIFIED') && (
                              <Button
                                variant="primary"
                                size="sm"
                                icon={Truck}
                                onClick={() => handleSupplierDispatch(s)}
                                className="text-xs"
                                disabled={submittingAction}
                              >
                                Dispatch (Step 5)
                              </Button>
                            )}
                            {s.status === 'DOCUMENTS_PENDING' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                                <Clock className="size-3 text-amber-600" />
                                Awaiting Verification
                              </span>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              icon={Navigation}
                              onClick={() => {
                                setSelectedShipment(s);
                                setShowShipmentModal(true);
                              }}
                              className="text-xs border-emerald-700/30 text-emerald-900 hover:bg-emerald-50"
                            >
                              Details & GPS
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TRADEEXPRESS TRANSPORT REQUESTS & QUOTES */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">TradeExpress Verified Logistics Bidding</h3>
              <p className="text-xs text-muted">
                Post freight requirements. Verified transport partners submit competitive quotes with 5% GTA GST breakdown.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowTradeExpressReqModal(true)}
            >
              New Transport Request
            </Button>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <TableSkeleton />
            </div>
          ) : requestsData.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <EmptyState
                icon={FileText}
                title="No active transport requests"
                text="Create a TradeExpress transport request to receive quotations from verified transport agencies."
                action={
                  <Button
                    size="sm"
                    variant="primary"
                    icon={Plus}
                    onClick={() => setShowTradeExpressReqModal(true)}
                    className="mt-4"
                  >
                    Request Transport
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="space-y-4">
              {requestsData.map((req) => {
                const quotes = req.quotes || [];
                return (
                  <div
                    key={req.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition-colors"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            Request #{req.requestNumber}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${
                              req.status === 'TRANSPORT_ASSIGNED'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : req.status === 'QUOTATION_RECEIVED'
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}
                          >
                            {req.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-1">
                          Order: <strong className="text-slate-800">{req.order?.orderNumber}</strong> · Vehicle Required:{' '}
                          <span className="font-semibold text-emerald-800">{req.vehicleTypeRequired}</span> · Weight:{' '}
                          {req.cargoWeightKg} kg
                        </p>
                      </div>

                      <div className="text-right text-xs">
                        <span className="text-muted block">Expected Pickup:</span>
                        <strong className="text-slate-800">
                          {req.expectedPickupDate ? formatDate(req.expectedPickupDate) : 'Immediate'}
                        </strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-3 text-xs bg-slate-50/60 rounded-xl px-4 mt-3">
                      <div>
                        <span className="text-muted block text-[11px]">Pickup Location:</span>
                        <span className="font-medium text-slate-800">{req.pickupAddress}</span>
                      </div>
                      <div>
                        <span className="text-muted block text-[11px]">Delivery Destination:</span>
                        <span className="font-medium text-slate-800">{req.deliveryAddress}</span>
                      </div>
                    </div>

                    {/* Quotations List */}
                    <div className="mt-4">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>Submitted Partner Quotations ({quotes.length})</span>
                      </h4>

                      {quotes.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-2">
                          Awaiting quotations from verified logistics partners in your corridor...
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {quotes.map((q) => (
                            <div
                              key={q.id}
                              className={`flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl border text-xs ${
                                q.status === 'ACCEPTED'
                                  ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-500'
                                  : 'bg-white border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <strong className="text-slate-900 text-xs">
                                    {q.partnerCompany?.name || 'Verified Partner'}
                                  </strong>
                                  {q.partnerCompany?.isVerified && (
                                    <ShieldCheck className="size-3.5 text-emerald-700" />
                                  )}
                                  <span className="text-[11px] text-slate-500">
                                    Vehicle: {q.vehicleProposed || 'Commercial Carrier'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                                  <span>Base: {money(q.baseFreight)}</span>
                                  <span>Loading: {money(q.loadingCharges)}</span>
                                  <span>Fuel: {money(q.fuelSurcharge)}</span>
                                  <span>Tolls: {money(q.tollCharges)}</span>
                                  <span className="text-emerald-800 font-semibold">
                                    GST (5% GTA): {money(q.gstAmount)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <span className="text-[10px] text-muted block uppercase font-bold">Total Freight</span>
                                  <span className="text-sm font-black text-emerald-900 font-mono">
                                    {money(q.totalAmount)}
                                  </span>
                                </div>

                                {q.status === 'ACCEPTED' ? (
                                  <span className="rounded-full bg-emerald-600 text-white font-bold px-3 py-1 text-[11px] flex items-center gap-1">
                                    <CheckCircle2 className="size-3" /> Booked
                                  </span>
                                ) : req.status === 'QUOTATION_RECEIVED' ? (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => handleAcceptQuote(q.id)}
                                    disabled={submittingAction}
                                    className="text-xs"
                                  >
                                    Accept Quote
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FLEET & DRIVERS */}
      {activeTab === 'fleet' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Fleet & Commercial Transporter Registry</h3>
              <p className="text-xs text-muted">
                Manage your registered vehicles, verified commercial drivers, and third-party logistics partners.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={Building2}
                onClick={() => setShowAddCompanyModal(true)}
              >
                Add Transporter
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={User}
                onClick={() => setShowAddDriverModal(true)}
              >
                Add Driver
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => setShowAddVehicleModal(true)}
              >
                Add Vehicle
              </Button>
            </div>
          </div>

          {/* Vehicles Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Registered Commercial Vehicles ({vehiclesData.length})
            </h4>
            {vehiclesData.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-500 border">
                No vehicles registered. Click "Add Vehicle" to register commercial trucks.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {vehiclesData.map((veh) => (
                  <div key={veh.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {veh.vehicleNumber}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          veh.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {veh.isAvailable ? 'Available' : 'On Trip'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-2 space-y-1">
                      <p>Type: <strong className="text-slate-800">{veh.vehicleType}</strong></p>
                      <p>Capacity: <strong className="text-slate-800">{veh.capacityMetricTons} MT</strong></p>
                      <p>RC No: <span className="font-mono text-slate-700">{veh.rcNumber || 'On Record'}</span></p>
                      <p>Permit: <span className="text-slate-700">{veh.permitType} Permit</span></p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drivers Grid */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Commercial Fleet Drivers ({driversData.length})
            </h4>
            {driversData.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-500 border">
                No drivers registered. Click "Add Driver" to register certified commercial drivers.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {driversData.map((drv) => (
                  <div key={drv.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">
                        {drv.name}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          drv.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {drv.isAvailable ? 'Available' : 'Assigned'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-2 space-y-1">
                      <p>Phone: <span className="font-mono text-slate-800">{drv.phone}</span></p>
                      <p>License: <span className="font-mono text-slate-800">{drv.licenseNumber}</span></p>
                      {drv.emergencyContact && (
                        <p className="text-[11px] text-slate-400">Emerg: {drv.emergencyContact}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: READY FOR DISPATCH (LEGACY ORDERS) */}
      {activeTab === 'awaiting' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Orders Ready for Fulfillment</h3>
              <p className="text-xs text-muted">Confirmed buyer orders ready for dispatch assignment.</p>
            </div>
          </div>

          {legacyOrders.awaitingDispatch.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No pending orders awaiting dispatch"
              text="All confirmed orders have already been dispatched or fulfilled."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Order #</th>
                    <th className="px-4 py-3">Buyer & City</th>
                    <th className="px-4 py-3">Package Items</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {legacyOrders.awaitingDispatch.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-emerald-800">{o.orderNumber}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900 block">{o.buyerCompany || o.buyerName}</span>
                        <span className="text-[11px] text-muted">{o.deliveryAddress?.city}, {o.deliveryAddress?.state}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {o.items?.[0]?.productName || 'Wholesale Order'} ({o.items?.length || 1} items)
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button
                          size="sm"
                          variant="primary"
                          icon={Truck}
                          onClick={() => {
                            setSmOrderId(o.id);
                            setShowSupplierManagedModal(true);
                          }}
                        >
                          Dispatch (Own Fleet)
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          icon={Plus}
                          onClick={() => {
                            setReqOrderId(o.id);
                            if (o.deliveryAddress) {
                              setReqDeliveryAddress(
                                `${o.deliveryAddress.street || ''}, ${o.deliveryAddress.city || ''}, ${o.deliveryAddress.state || ''} - ${o.deliveryAddress.postalCode || ''}`
                              );
                            }
                            setShowTradeExpressReqModal(true);
                          }}
                        >
                          TradeExpress Transport
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: SUPPLIER-MANAGED CONSIGNMENT */}
      <Modal
        open={showSupplierManagedModal}
        onClose={() => setShowSupplierManagedModal(false)}
        title="Arrange Delivery — Step 3: Add Truck Details & Consignment"
        className="max-w-xl"
      >
        <form onSubmit={handleCreateSupplierManaged} className="space-y-4 text-xs text-slate-900">
          <p className="text-[11px] text-slate-500">
            Method A: Record commercial truck and driver details, transporter name, LR/Bilty, and e-Way bill. Submitted consignment will await Super Admin Verification (Step 4) before dispatch.
          </p>

          <div>
            <label className="font-bold block mb-1">
              Select Confirmed Order <span className="text-rose-600">*</span>
            </label>
            <select
              required
              value={smOrderId}
              onChange={(e) => setSmOrderId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
            >
              <option value="">-- Choose an eligible order --</option>
              {eligibleOrders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.orderNumber} — {ord.buyerCompany || ord.buyerName} ({ord.deliveryAddress?.city || 'India'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold block mb-1">
                Vehicle Registration # <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. MH-12-AB-1234"
                value={smVehicleNumber}
                onChange={(e) => setSmVehicleNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs uppercase focus:border-emerald-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">
                Transporter / Carrier Company
              </label>
              <input
                type="text"
                placeholder="e.g. Own Fleet / VRL Logistics"
                value={smTransportCompany}
                onChange={(e) => setSmTransportCompany(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold block mb-1">
                Driver Full Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Kumar"
                value={smDriverName}
                onChange={(e) => setSmDriverName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">Driver Phone Number</label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={smDriverPhone}
                onChange={(e) => setSmDriverPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold block mb-1">LR / Bilty Number</label>
              <input
                type="text"
                placeholder="e.g. LR-99882"
                value={smLrNumber}
                onChange={(e) => setSmLrNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">e-Way Bill Number</label>
              <input
                type="text"
                placeholder="12-digit number"
                value={smEwayBill}
                onChange={(e) => setSmEwayBill(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">Freight Charge (₹)</label>
              <input
                type="number"
                min="0"
                step="50"
                placeholder="0"
                value={smFreightCharge}
                onChange={(e) => setSmFreightCharge(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="font-bold block mb-1">Estimated Delivery Date</label>
            <input
              type="date"
              value={smEstDelivery}
              onChange={(e) => setSmEstDelivery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSupplierManagedModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={Truck}
              disabled={submittingAction}
            >
              {submittingAction ? 'Submitting Details...' : 'Submit Truck Details (Step 3)'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: TRADEEXPRESS-MANAGED TRANSPORT REQUEST */}
      <Modal
        open={showTradeExpressReqModal}
        onClose={() => setShowTradeExpressReqModal(false)}
        title="Request TradeExpress-Managed Transport"
        className="max-w-xl"
      >
        <form onSubmit={handleCreateTradeExpressRequest} className="space-y-4 text-xs text-slate-900">
          <p className="text-[11px] text-slate-500">
            Method B: TradeExpress verified transport partners will bid on this corridor with compliant 5% GTA GST breakdown. Escrow protection included.
          </p>

          <div>
            <label className="font-bold block mb-1">
              Select Confirmed Order <span className="text-rose-600">*</span>
            </label>
            <select
              required
              value={reqOrderId}
              onChange={(e) => {
                const oid = e.target.value;
                setReqOrderId(oid);
                const match = eligibleOrders.find((o) => o.id === oid);
                if (match?.deliveryAddress) {
                  setReqDeliveryAddress(
                    `${match.deliveryAddress.street || ''}, ${match.deliveryAddress.city || ''}, ${match.deliveryAddress.state || ''} - ${match.deliveryAddress.postalCode || ''}`
                  );
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
            >
              <option value="">-- Choose an eligible order --</option>
              {eligibleOrders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.orderNumber} — {ord.buyerCompany || ord.buyerName} ({ord.deliveryAddress?.city || 'India'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold block mb-1">Vehicle Type Needed</label>
              <select
                value={reqVehicleType}
                onChange={(e) => setReqVehicleType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none font-medium"
              >
                <option value="TATA_ACE">Tata Ace (1.5 MT)</option>
                <option value="PICKUP_TRUCK">Pickup 8ft (2.5 MT)</option>
                <option value="EICHER_14FT">Eicher 14ft (4 MT)</option>
                <option value="EICHER_19FT">Eicher 19ft (7 MT)</option>
                <option value="TAURUS_16T">Taurus 10-Tyre (16 MT)</option>
                <option value="CONTAINER_32FT">32ft Multi-Axle Container</option>
                <option value="FLATBED_TRAILER">Flatbed Heavy Trailer</option>
              </select>
            </div>
            <div>
              <label className="font-bold block mb-1">Cargo Weight (kg)</label>
              <input
                type="number"
                min="10"
                value={reqCargoWeight}
                onChange={(e) => setReqCargoWeight(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">Volume (CBM)</label>
              <input
                type="number"
                min="1"
                value={reqCargoVolume}
                onChange={(e) => setReqCargoVolume(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="font-bold block mb-1">
              Pickup Warehouse / Factory Address <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Unit 4B, MIDC Industrial Area, Andheri East, Mumbai, Maharashtra"
              value={reqPickupAddress}
              onChange={(e) => setReqPickupAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold block mb-1">
              Destination Delivery Address <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Buyer destination warehouse address"
              value={reqDeliveryAddress}
              onChange={(e) => setReqDeliveryAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold block mb-1">Expected Pickup Date</label>
              <input
                type="date"
                value={reqPickupDate}
                onChange={(e) => setReqPickupDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">Handling Requirements</label>
              <select
                value={reqCargoType}
                onChange={(e) => setReqCargoType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none font-medium"
              >
                <option value="STANDARD">Standard Dry Freight</option>
                <option value="FRAGILE">Fragile / Sensitive Goods</option>
                <option value="HAZARDOUS">Hazardous Material (HAZMAT)</option>
                <option value="REFRIGERATED">Refrigerated / Cold Chain</option>
                <option value="HEAVY_MACHINERY">Industrial Heavy Machinery</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold block mb-1">Special Handling Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Forklift required at pickup; palletized goods; tarp-covered truck required."
              value={reqSpecialNotes}
              onChange={(e) => setReqSpecialNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTradeExpressReqModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={Send}
              disabled={submittingAction}
            >
              {submittingAction ? 'Submitting...' : 'Broadcast Transport Request'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: ADD VEHICLE */}
      <Modal
        open={showAddVehicleModal}
        onClose={() => setShowAddVehicleModal(false)}
        title="Register Commercial Fleet Vehicle"
        className="max-w-md"
      >
        <form onSubmit={handleAddVehicleSubmit} className="space-y-4 text-xs text-slate-900">
          <div>
            <label className="font-bold block mb-1">
              Vehicle Registration Number <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. DL-01-AX-4433"
              value={vehNumber}
              onChange={(e) => setVehNumber(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono uppercase text-xs focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold block mb-1">Vehicle Classification</label>
              <select
                value={vehType}
                onChange={(e) => setVehType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
              >
                <option value="TATA_ACE">Tata Ace</option>
                <option value="PICKUP_TRUCK">Pickup 8ft</option>
                <option value="EICHER_14FT">Eicher 14ft</option>
                <option value="EICHER_19FT">Eicher 19ft</option>
                <option value="TAURUS_16T">Taurus 16T</option>
                <option value="CONTAINER_32FT">32ft Container</option>
                <option value="FLATBED_TRAILER">Flatbed Trailer</option>
              </select>
            </div>
            <div>
              <label className="font-bold block mb-1">Capacity (Metric Tons)</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={vehCapacity}
                onChange={(e) => setVehCapacity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold block mb-1">RC Certificate Number</label>
              <input
                type="text"
                placeholder="RC-IND-99442"
                value={vehRcNumber}
                onChange={(e) => setVehRcNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">Permit Type</label>
              <select
                value={vehPermitType}
                onChange={(e) => setVehPermitType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
              >
                <option value="NATIONAL">National All-India Permit</option>
                <option value="STATE">State Commercial Permit</option>
                <option value="REGIONAL">Local / City Permit</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold block mb-1">Insurance Policy Number</label>
            <input
              type="text"
              placeholder="e.g. POL-BAJAJ-88471"
              value={vehInsurancePolicy}
              onChange={(e) => setVehInsurancePolicy(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddVehicleModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={Plus}
              disabled={submittingAction}
            >
              {submittingAction ? 'Saving...' : 'Add Vehicle'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: ADD DRIVER */}
      <Modal
        open={showAddDriverModal}
        onClose={() => setShowAddDriverModal(false)}
        title="Register Commercial Driver"
        className="max-w-md"
      >
        <form onSubmit={handleAddDriverSubmit} className="space-y-4 text-xs text-slate-900">
          <div>
            <label className="font-bold block mb-1">
              Driver Full Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Santosh Sharma"
              value={drvName}
              onChange={(e) => setDrvName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold block mb-1">
                Phone Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="9876543210"
                value={drvPhone}
                onChange={(e) => setDrvPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">
                Commercial DL # <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="MH0120200001234"
                value={drvLicense}
                onChange={(e) => setDrvLicense(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono uppercase text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold block mb-1">License Expiry Date</label>
              <input
                type="date"
                value={drvExpiry}
                onChange={(e) => setDrvExpiry(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">Emergency Contact</label>
              <input
                type="tel"
                placeholder="9123456780"
                value={drvEmergency}
                onChange={(e) => setDrvEmergency(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddDriverModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={User}
              disabled={submittingAction}
            >
              {submittingAction ? 'Saving...' : 'Add Driver'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: ADD TRANSPORT COMPANY */}
      <Modal
        open={showAddCompanyModal}
        onClose={() => setShowAddCompanyModal(false)}
        title="Add Commercial Transporter Partner"
        className="max-w-md"
      >
        <form onSubmit={handleAddCompanySubmit} className="space-y-4 text-xs text-slate-900">
          <div>
            <label className="font-bold block mb-1">
              Transporter Legal Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Premier Roadways Private Limited"
              value={compName}
              onChange={(e) => setCompName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold block mb-1">GSTIN Number</label>
              <input
                type="text"
                placeholder="27ABCDE1234F1Z5"
                value={compGstin}
                onChange={(e) => setCompGstin(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono uppercase text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">PAN Number</label>
              <input
                type="text"
                placeholder="ABCDE1234F"
                value={compPan}
                onChange={(e) => setCompPan(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono uppercase text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold block mb-1">Contact Email</label>
              <input
                type="email"
                placeholder="logistics@transporter.com"
                value={compEmail}
                onChange={(e) => setCompEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="9820012345"
                value={compPhone}
                onChange={(e) => setCompPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="font-bold block mb-1">Head Office Address</label>
            <input
              type="text"
              placeholder="e.g. Transport Nagar, Pune, Maharashtra"
              value={compAddress}
              onChange={(e) => setCompAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddCompanyModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={Building2}
              disabled={submittingAction}
            >
              {submittingAction ? 'Saving...' : 'Add Transporter'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* SHIPMENT DETAIL & GPS MODAL */}
      {selectedShipment && (
        <ShipmentDetailModal
          shipment={selectedShipment}
          isOpen={showShipmentModal}
          onClose={() => {
            setShowShipmentModal(false);
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
