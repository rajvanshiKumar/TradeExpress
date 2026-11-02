import { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Package,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  FileText,
  Navigation,
  Car,
  User,
  ShieldCheck,
  Plus,
  Send,
  Radio,
  Clock,
  KeyRound,
  Building2,
  ExternalLink,
  Receipt,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import useNotifications from '../../hooks/useNotifications';
import useAuth from '../../hooks/useAuth';
import useCurrency from '../../hooks/useCurrency';
import {
  getOpenTransportRequests,
  submitFreightQuote,
  getShipments,
  updateShipmentStatus,
  recordDeliveryProof,
  sendGpsTelemetry,
  getVehicles,
  addVehicle,
  getDrivers,
  addDriver,
  getTransportCompanies,
  createTransportCompany,
  getFreightPayments,
} from '../../api/logisticsApi';
import { formatDate } from '../../utils/formatDate';
import ShipmentDetailModal from '../../components/logistics/ShipmentDetailModal';

const TABS = [
  { id: 'assigned', label: 'Assigned Consignments' },
  { id: 'bidding', label: 'Open Freight Bidding' },
  { id: 'fleet', label: 'Vehicles & Drivers' },
  { id: 'payments', label: 'Freight Escrow & Payments' },
  { id: 'profile', label: 'Transporter Registration' },
];

export default function TransporterDashboard() {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const { money } = useCurrency();

  const [activeTab, setActiveTab] = useState('assigned');
  const [loading, setLoading] = useState(true);

  // Data states
  const [shipments, setShipments] = useState([]);
  const [openRequests, setOpenRequests] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [freightPayments, setFreightPayments] = useState([]);

  // Detail Modal
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Quote Submission Modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteBase, setQuoteBase] = useState('12000');
  const [quoteLoading, setQuoteLoading] = useState('1500');
  const [quoteUnloading, setQuoteUnloading] = useState('1500');
  const [quoteFuel, setQuoteFuel] = useState('2000');
  const [quoteTolls, setQuoteTolls] = useState('1000');
  const [quoteTransitHours, setQuoteTransitHours] = useState('36');
  const [quoteVehicleProposed, setQuoteVehicleProposed] = useState('Eicher 19ft Container');
  const [submittingQuote, setSubmittingQuote] = useState(false);

  // Quick GPS Ping Modal
  const [pingShipment, setPingShipment] = useState(null);
  const [showPingModal, setShowPingModal] = useState(false);
  const [pingLat, setPingLat] = useState('19.0760');
  const [pingLng, setPingLng] = useState('72.8777');
  const [pingSpeed, setPingSpeed] = useState('55');
  const [pingAddress, setPingAddress] = useState('Mumbai-Pune Expressway Toll Plaza');
  const [sendingPing, setSendingPing] = useState(false);

  // Quick POD Modal
  const [podShipment, setPodShipment] = useState(null);
  const [showPodModal, setShowPodModal] = useState(false);
  const [podRecipient, setPodRecipient] = useState('');
  const [podOtp, setPodOtp] = useState('');
  const [podNotes, setPodNotes] = useState('');
  const [submittingPod, setSubmittingPod] = useState(false);

  // Add Vehicle & Driver Modals
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vehNumber, setVehNumber] = useState('');
  const [vehType, setVehType] = useState('EICHER_19FT');
  const [vehCapacity, setVehCapacity] = useState('7');
  const [vehRc, setVehRc] = useState('');

  const [showDriverModal, setShowDriverModal] = useState(false);
  const [drvName, setDrvName] = useState('');
  const [drvPhone, setDrvPhone] = useState('');
  const [drvLicense, setDrvLicense] = useState('');

  // Register Company Modal
  const [compName, setCompName] = useState('');
  const [compGstin, setCompGstin] = useState('');
  const [compPan, setCompPan] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compAddress, setCompAddress] = useState('');
  const [submittingCompany, setSubmittingCompany] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const [shipRes, reqRes, vehRes, drvRes, compRes, payRes] = await Promise.allSettled([
        getShipments({ limit: 100 }),
        getOpenTransportRequests(),
        getVehicles(),
        getDrivers(),
        getTransportCompanies(),
        getFreightPayments(),
      ]);

      if (shipRes.status === 'fulfilled') {
        setShipments(shipRes.value?.shipments || shipRes.value || []);
      }
      if (reqRes.status === 'fulfilled') {
        setOpenRequests(Array.isArray(reqRes.value) ? reqRes.value : reqRes.value?.requests || []);
      }
      if (vehRes.status === 'fulfilled') {
        setVehicles(Array.isArray(vehRes.value) ? vehRes.value : vehRes.value?.vehicles || []);
      }
      if (drvRes.status === 'fulfilled') {
        setDrivers(Array.isArray(drvRes.value) ? drvRes.value : drvRes.value?.drivers || []);
      }
      if (compRes.status === 'fulfilled') {
        setCompanies(Array.isArray(compRes.value) ? compRes.value : compRes.value?.companies || []);
      }
      if (payRes.status === 'fulfilled') {
        setFreightPayments(Array.isArray(payRes.value) ? payRes.value : payRes.value?.payments || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load transporter data', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Current transporter company record
  const currentCompany = useMemo(() => {
    return companies[0] || null;
  }, [companies]);

  // Quotation calculations with GTA GST 5%
  const quoteSubtotal = useMemo(() => {
    const base = Number(quoteBase) || 0;
    const l = Number(quoteLoading) || 0;
    const u = Number(quoteUnloading) || 0;
    const f = Number(quoteFuel) || 0;
    const t = Number(quoteTolls) || 0;
    return base + l + u + f + t;
  }, [quoteBase, quoteLoading, quoteUnloading, quoteFuel, quoteTolls]);

  const quoteGst = useMemo(() => Math.round(quoteSubtotal * 0.05), [quoteSubtotal]);
  const quoteTotal = useMemo(() => quoteSubtotal + quoteGst, [quoteSubtotal, quoteGst]);

  // Handler: Submit Quotation
  async function handleSubmitQuote(e) {
    e.preventDefault();
    if (!selectedRequest) return;

    setSubmittingQuote(true);
    try {
      await submitFreightQuote(selectedRequest.id, {
        baseFreight: Number(quoteBase) || 0,
        loadingCharges: Number(quoteLoading) || 0,
        unloadingCharges: Number(quoteUnloading) || 0,
        fuelSurcharge: Number(quoteFuel) || 0,
        tollCharges: Number(quoteTolls) || 0,
        estimatedTransitHours: Number(quoteTransitHours) || 24,
        vehicleProposed: quoteVehicleProposed.trim() || 'Commercial Truck',
      });

      showToast('Freight quotation submitted successfully with 5% GTA GST breakdown!', 'success');
      setShowQuoteModal(false);
      setSelectedRequest(null);
      loadDashboardData();
    } catch (err) {
      showToast(err.message || 'Failed to submit quote', 'error');
    } finally {
      setSubmittingQuote(false);
    }
  }

  // Handler: Transmit GPS Ping
  async function handleSendGps(e) {
    e.preventDefault();
    if (!pingShipment) return;

    setSendingPing(true);
    try {
      await sendGpsTelemetry(pingShipment.id, {
        latitude: Number(pingLat),
        longitude: Number(pingLng),
        speed: Number(pingSpeed) || 0,
        address: pingAddress.trim() || undefined,
      });

      showToast('Live GPS coordinates broadcasted successfully!', 'success');
      setShowPingModal(false);
      setPingShipment(null);
      loadDashboardData();
    } catch (err) {
      showToast(err.message || 'Failed to broadcast GPS ping', 'error');
    } finally {
      setSendingPing(false);
    }
  }

  // Handler: Submit Proof of Delivery (POD)
  async function handleDeliverPod(e) {
    e.preventDefault();
    if (!podShipment) return;
    if (!podRecipient.trim() || !podOtp.trim()) {
      showToast('Recipient name and 6-digit buyer verification OTP are required.', 'warning');
      return;
    }

    setSubmittingPod(true);
    try {
      await recordDeliveryProof(podShipment.id, {
        recipientName: podRecipient.trim(),
        recipientPhone: podShipment.driverPhone || undefined,
        otpCode: podOtp.trim(),
        remarks: podNotes.trim() || undefined,
      });

      showToast('Proof of Delivery verified! Consignment completed & escrow eligible for payout.', 'success');
      setShowPodModal(false);
      setPodShipment(null);
      loadDashboardData();
    } catch (err) {
      showToast(err.message || 'Failed to verify delivery proof', 'error');
    } finally {
      setSubmittingPod(false);
    }
  }

  // Handler: Quick Status Advance
  async function handleAdvanceStatus(shipment, nextStatus) {
    try {
      await updateShipmentStatus(shipment.id, {
        newStatus: nextStatus,
        notes: `Advanced by transport driver/partner to ${nextStatus}`,
      });
      showToast(`Shipment status updated to ${nextStatus}!`, 'success');
      loadDashboardData();
    } catch (err) {
      showToast(err.message || 'Status update failed', 'error');
    }
  }

  // Handler: Register Transporter Company
  async function handleRegisterCompany(e) {
    e.preventDefault();
    if (!compName.trim()) {
      showToast('Legal company name is required.', 'warning');
      return;
    }

    setSubmittingCompany(true);
    try {
      await createTransportCompany({
        name: compName.trim(),
        gstin: compGstin.trim() || undefined,
        panNumber: compPan.trim() || undefined,
        phone: compPhone.trim() || undefined,
        address: compAddress.trim() || undefined,
      });

      showToast('Transport company registered! Documents sent for verification.', 'success');
      loadDashboardData();
      setActiveTab('assigned');
    } catch (err) {
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      setSubmittingCompany(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <SectionHeading
        title="Transport Partner Freight Portal"
        description="Verified B2B logistics partner console. Bid on freight requests, manage assigned consignments, broadcast live GPS telemetry, and submit Proof of Delivery."
        actions={
          <div className="flex items-center gap-2">
            {currentCompany?.verificationStatus === 'VERIFIED' ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 ring-1 ring-emerald-300">
                <ShieldCheck className="size-4 text-emerald-700" />
                Verified Transport Agency
              </span>
            ) : currentCompany ? (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 ring-1 ring-amber-300">
                <Clock className="size-4 text-amber-700" />
                KYC Pending Review
              </span>
            ) : (
              <Button
                variant="primary"
                size="sm"
                icon={Building2}
                onClick={() => setActiveTab('profile')}
              >
                Complete Registration
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-600">Active Consignments</span>
            <Truck className="size-4 text-emerald-700" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {(shipments || []).filter((s) => !['DELIVERED', 'CANCELLED'].includes(s.status)).length}
          </p>
          <span className="text-[11px] text-emerald-800 font-medium">On-road & scheduled</span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-600">Open Bids Available</span>
            <FileText className="size-4 text-amber-700" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{openRequests.length}</p>
          <span className="text-[11px] text-amber-800 font-medium">Verified shippers requesting quotes</span>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-600">Registered Fleet</span>
            <Car className="size-4 text-blue-700" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {vehicles.length} Trucks / {drivers.length} Drivers
          </p>
          <span className="text-[11px] text-blue-800 font-medium">Commercial capacity</span>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-600">Escrow Freight</span>
            <DollarSign className="size-4 text-purple-700" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {money(
              freightPayments
                .filter((p) => p.status === 'HELD_IN_ESCROW')
                .reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0)
            )}
          </p>
          <span className="text-[11px] text-purple-800 font-medium">Secured in escrow</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          let count = null;
          if (tab.id === 'assigned') count = shipments.length;
          if (tab.id === 'bidding') count = openRequests.length;
          if (tab.id === 'fleet') count = vehicles.length;

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

      {/* TAB 1: ASSIGNED CONSIGNMENTS */}
      {activeTab === 'assigned' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <TableSkeleton />
            </div>
          ) : shipments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <EmptyState
                icon={Truck}
                title="No consignments assigned yet"
                text="Submit quotations on open freight requests to get booked for shipments."
                action={
                  <Button
                    size="sm"
                    variant="primary"
                    icon={FileText}
                    onClick={() => setActiveTab('bidding')}
                    className="mt-4"
                  >
                    Browse Open Freight Requests
                  </Button>
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
                      <th className="px-4 py-3.5">Corridor (Pickup &rarr; Delivery)</th>
                      <th className="px-4 py-3.5">Assigned Vehicle & Driver</th>
                      <th className="px-4 py-3.5">Live Status</th>
                      <th className="px-4 py-3.5 text-right">Driver Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-900">
                    {shipments.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <span className="font-mono font-bold text-emerald-800 text-xs block">
                            {s.trackingNumber}
                          </span>
                          <span className="text-[11px] text-slate-500">Order #{s.order?.orderNumber}</span>
                        </td>
                        <td className="px-4 py-4 max-w-xs">
                          <span className="text-[11px] text-slate-600 block truncate">
                            <strong>From:</strong> {s.pickupAddress || 'Supplier Warehouse'}
                          </span>
                          <span className="text-[11px] text-slate-600 block truncate">
                            <strong>To:</strong> {s.deliveryAddress?.city || s.deliveryAddress?.street || 'Buyer Site'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-mono font-bold text-slate-900 block text-xs">
                            {s.vehicleNumber || s.vehicle?.vehicleNumber || 'Pending'}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {s.driverName || s.driver?.name || 'Driver'} ({s.driverPhone || '—'})
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${
                              s.status === 'DELIVERED'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : ['IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s.status)
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : s.status === 'DOCUMENTS_PENDING'
                                ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}
                          >
                            {s.status === 'DOCUMENTS_PENDING' ? 'DOCS PENDING VERIFICATION' : s.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right space-x-1.5 whitespace-nowrap">
                          {/* Status Progression buttons */}
                          {s.status === 'DOCUMENTS_PENDING' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                              <Clock className="size-3 text-amber-600" />
                              Awaiting Super Admin Verification (Step 4)
                            </span>
                          )}
                          {['TRANSPORT_ASSIGNED', 'READY_FOR_PICKUP'].includes(s.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAdvanceStatus(s, 'PICKED_UP')}
                              className="text-[11px]"
                            >
                              Mark Picked Up
                            </Button>
                          )}
                          {s.status === 'PICKED_UP' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAdvanceStatus(s, 'IN_TRANSIT')}
                              className="text-[11px]"
                            >
                              Depart (In Transit)
                            </Button>
                          )}
                          {s.status === 'IN_TRANSIT' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAdvanceStatus(s, 'OUT_FOR_DELIVERY')}
                              className="text-[11px]"
                            >
                              Out for Delivery
                            </Button>
                          )}

                          {/* Broadcast GPS Ping */}
                          {!['DELIVERED', 'CANCELLED'].includes(s.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              icon={Radio}
                              onClick={() => {
                                setPingShipment(s);
                                setShowPingModal(true);
                              }}
                              className="text-[11px] text-emerald-800 border-emerald-300"
                            >
                              Send GPS
                            </Button>
                          )}

                          {/* Submit POD */}
                          {['IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s.status) && (
                            <Button
                              size="sm"
                              variant="primary"
                              icon={KeyRound}
                              onClick={() => {
                                setPodShipment(s);
                                setPodRecipient(s.deliveryAddress?.contactPerson || 'Authorized Consignee');
                                setPodOtp('');
                                setShowPodModal(true);
                              }}
                              className="text-[11px]"
                            >
                              Submit POD
                            </Button>
                          )}

                          {/* Details & Map */}
                          <Button
                            size="sm"
                            variant="outline"
                            icon={Navigation}
                            onClick={() => {
                              setSelectedShipment(s);
                              setShowDetailModal(true);
                            }}
                            className="text-[11px]"
                          >
                            Map
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OPEN FREIGHT BIDDING */}
      {activeTab === 'bidding' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">TradeExpress Verified Corridors & RFQ Bidding</h3>
              <p className="text-xs text-muted">
                Review freight requirements from verified Indian manufacturers and submit competitive quotations.
              </p>
            </div>
          </div>

          {openRequests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <EmptyState
                icon={FileText}
                title="No open transport requests right now"
                text="Check back shortly as new B2B freight requests are posted by suppliers."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {openRequests.map((req) => (
                <div key={req.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                  <div className="flex items-center justify-between border-b pb-3">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      Req #{req.requestNumber}
                    </span>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 uppercase">
                      Open for Quotation
                    </span>
                  </div>

                  <div className="text-xs space-y-2 py-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Vehicle Type:</span>
                      <strong className="text-slate-900 font-semibold">{req.vehicleTypeRequired}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cargo Weight & Vol:</span>
                      <span className="text-slate-800">{req.cargoWeightKg} kg · {req.cargoVolumeCbm || 5} CBM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cargo Type:</span>
                      <span className="text-slate-800 font-medium">{req.cargoType}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] space-y-1">
                      <p><strong>Pickup:</strong> {req.pickupAddress}</p>
                      <p><strong>Destination:</strong> {req.deliveryAddress}</p>
                    </div>
                    {req.specialInstructions && (
                      <p className="text-[11px] text-slate-500 italic">Notes: {req.specialInstructions}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t flex justify-end">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={Send}
                      onClick={() => {
                        setSelectedRequest(req);
                        setQuoteVehicleProposed(req.vehicleTypeRequired);
                        setShowQuoteModal(true);
                      }}
                      className="text-xs"
                    >
                      Submit Freight Quotation
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FLEET & DRIVERS */}
      {activeTab === 'fleet' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Commercial Fleet & Drivers</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={User}
                onClick={() => setShowDriverModal(true)}
              >
                Add Driver
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => setShowVehicleModal(true)}
              >
                Add Vehicle
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((v) => (
              <div key={v.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                <span className="font-mono font-bold text-slate-900 text-sm">{v.vehicleNumber}</span>
                <p className="text-xs text-slate-500 mt-1">Type: {v.vehicleType} ({v.capacityMetricTons} MT)</p>
                <p className="text-xs text-slate-500">RC: {v.rcNumber || 'Verified'}</p>
                <span className="inline-block mt-2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                  Commercial Fleet
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: FREIGHT ESCROW & PAYMENTS */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Freight Escrow Ledger & Disbursals</h3>
            <p className="text-xs text-muted">
              Escrow funds are secured at booking and released upon verified Proof of Delivery with 1% TDS deducted under Section 194C.
            </p>
          </div>

          {freightPayments.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No freight payments on record"
              text="Payments will appear here when your quotations are accepted and fulfilled."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Consignment</th>
                    <th className="px-4 py-3">Base Freight</th>
                    <th className="px-4 py-3">GTA GST (5%)</th>
                    <th className="px-4 py-3">TDS (1% Sec 194C)</th>
                    <th className="px-4 py-3">Net Payable</th>
                    <th className="px-4 py-3 text-right">Escrow Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {freightPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-800">
                        {p.shipment?.trackingNumber || 'Consignment'}
                      </td>
                      <td className="px-4 py-3">{money(p.baseFreight)}</td>
                      <td className="px-4 py-3 text-emerald-800 font-semibold">{money(p.gstAmount)}</td>
                      <td className="px-4 py-3 text-rose-700 font-mono">-{money(p.tdsAmount || 0)}</td>
                      <td className="px-4 py-3 font-black text-slate-900 font-mono">
                        {money(p.totalAmount - (p.tdsAmount || 0))}
                      </td>
                      <td className="px-4 py-3 text-right">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: TRANSPORTER REGISTRATION */}
      {activeTab === 'profile' && (
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Commercial Transporter Registration</h3>
          <p className="text-xs text-muted mb-4">
            Register your transport enterprise on TradeExpress to bid on high-volume corridor freight contracts.
          </p>

          <form onSubmit={handleRegisterCompany} className="space-y-4 text-xs">
            <div>
              <label className="font-bold block mb-1">Company / Enterprise Legal Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. South Express Logistics Private Limited"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
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
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono uppercase text-xs focus:border-emerald-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">PAN Number</label>
                <input
                  type="text"
                  placeholder="ABCDE1234F"
                  value={compPan}
                  onChange={(e) => setCompPan(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono uppercase text-xs focus:border-emerald-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold block mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={compPhone}
                  onChange={(e) => setCompPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs focus:border-emerald-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Operating Head Office</label>
                <input
                  type="text"
                  placeholder="e.g. Transport Nagar, Delhi"
                  value={compAddress}
                  onChange={(e) => setCompAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-emerald-700 focus:outline-none"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={Building2}
              disabled={submittingCompany}
              className="w-full mt-4"
            >
              {submittingCompany ? 'Registering...' : 'Submit Transporter Profile for Verification'}
            </Button>
          </form>
        </div>
      )}

      {/* MODAL: SUBMIT FREIGHT QUOTE */}
      {selectedRequest && (
        <Modal
          open={showQuoteModal}
          onClose={() => setShowQuoteModal(false)}
          title={`Freight Quotation — Req #${selectedRequest.requestNumber}`}
          className="max-w-md"
        >
          <form onSubmit={handleSubmitQuote} className="space-y-3 text-xs text-slate-900">
            <div className="p-3 bg-slate-50 rounded-xl border text-[11px]">
              <p><strong>Route:</strong> {selectedRequest.pickupAddress} &rarr; {selectedRequest.deliveryAddress}</p>
              <p className="mt-1"><strong>Weight:</strong> {selectedRequest.cargoWeightKg} kg ({selectedRequest.vehicleTypeRequired})</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold block mb-1">Base Freight (₹) *</label>
                <input
                  type="number"
                  required
                  min="500"
                  value={quoteBase}
                  onChange={(e) => setQuoteBase(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 font-mono text-xs focus:border-emerald-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Fuel Surcharge (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={quoteFuel}
                  onChange={(e) => setQuoteFuel(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 font-mono text-xs focus:border-emerald-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold block mb-1">Loading Charges (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={quoteLoading}
                  onChange={(e) => setQuoteLoading(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 font-mono text-xs focus:border-emerald-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Unloading Charges (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={quoteUnloading}
                  onChange={(e) => setQuoteUnloading(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 font-mono text-xs focus:border-emerald-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold block mb-1">Toll Charges (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={quoteTolls}
                  onChange={(e) => setQuoteTolls(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 font-mono text-xs focus:border-emerald-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Transit Time (Hours)</label>
                <input
                  type="number"
                  min="1"
                  value={quoteTransitHours}
                  onChange={(e) => setQuoteTransitHours(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 font-mono text-xs focus:border-emerald-700 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-bold block mb-1">Proposed Vehicle & Fleet Details</label>
              <input
                type="text"
                placeholder="e.g. Eicher Pro 19ft Container / MH-12-PQ-9988"
                value={quoteVehicleProposed}
                onChange={(e) => setQuoteVehicleProposed(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>

            {/* Statutory GTA GST breakdown */}
            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Freight Subtotal:</span>
                <span className="font-mono">{money(quoteSubtotal)}</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-semibold">
                <span>GTA GST (Statutory 5%):</span>
                <span className="font-mono">+{money(quoteGst)}</span>
              </div>
              <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-emerald-200">
                <span>Total Quote Amount:</span>
                <span className="font-mono text-sm">{money(quoteTotal)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowQuoteModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" icon={Send} disabled={submittingQuote}>
                {submittingQuote ? 'Submitting...' : 'Send Quotation'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: BROADCAST GPS TELEMETRY */}
      {pingShipment && (
        <Modal
          open={showPingModal}
          onClose={() => setShowPingModal(false)}
          title={`Broadcast Live GPS — AWB #${pingShipment.trackingNumber}`}
          className="max-w-md"
        >
          <form onSubmit={handleSendGps} className="space-y-3 text-xs text-slate-900">
            <p className="text-[11px] text-slate-500">
              Transmit authentic latitude and longitude from your vehicle's telematics or driver mobile GPS.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold block mb-1">Latitude (°N)</label>
                <input
                  type="text"
                  required
                  value={pingLat}
                  onChange={(e) => setPingLat(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 font-mono text-xs focus:border-emerald-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Longitude (°E)</label>
                <input
                  type="text"
                  required
                  value={pingLng}
                  onChange={(e) => setPingLng(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 font-mono text-xs focus:border-emerald-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold block mb-1">Speed (km/h)</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={pingSpeed}
                  onChange={(e) => setPingSpeed(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 font-mono text-xs focus:border-emerald-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Highway / Location Note</label>
                <input
                  type="text"
                  placeholder="e.g. NH-48 Km Stone 142"
                  value={pingAddress}
                  onChange={(e) => setPingAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-emerald-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowPingModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" icon={Radio} disabled={sendingPing}>
                {sendingPing ? 'Broadcasting...' : 'Broadcast GPS Ping'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: SUBMIT PROOF OF DELIVERY (POD) */}
      {podShipment && (
        <Modal
          open={showPodModal}
          onClose={() => setShowPodModal(false)}
          title={`Submit Proof of Delivery — AWB #${podShipment.trackingNumber}`}
          className="max-w-md"
        >
          <form onSubmit={handleDeliverPod} className="space-y-3 text-xs text-slate-900">
            <p className="text-[11px] text-slate-500">
              Verify recipient identity and enter the 6-digit confirmation OTP generated on the buyer's shipment dashboard.
            </p>

            <div>
              <label className="font-bold block mb-1">Consignee Recipient Name *</label>
              <input
                type="text"
                required
                placeholder="Person receiving the physical goods"
                value={podRecipient}
                onChange={(e) => setPodRecipient(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold block mb-1">Buyer Verification OTP (6 Digits) *</label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="6-digit PIN"
                value={podOtp}
                onChange={(e) => setPodOtp(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2 font-mono text-center tracking-widest text-lg font-bold focus:border-emerald-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold block mb-1">Delivery Remarks</label>
              <textarea
                rows={2}
                placeholder="e.g. All cartons intact, seal verified, delivered to warehouse bay 3."
                value={podNotes}
                onChange={(e) => setPodNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-emerald-700 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowPodModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" icon={CheckCircle2} disabled={submittingPod}>
                {submittingPod ? 'Verifying...' : 'Confirm Delivery'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* DETAIL MODAL */}
      {selectedShipment && (
        <ShipmentDetailModal
          shipment={selectedShipment}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedShipment(null);
          }}
          currentUser={user}
          onRefresh={loadDashboardData}
          showToast={showToast}
        />
      )}
    </div>
  );
}

