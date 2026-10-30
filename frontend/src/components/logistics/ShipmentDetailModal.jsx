import { useState } from 'react';
import {
  X,
  Truck,
  User,
  Building2,
  Calendar,
  Package,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Upload,
  CheckCircle2,
  MapPin,
  ExternalLink,
  Phone,
  Radio,
  Clock,
  KeyRound,
} from 'lucide-react';
import GpsRouteMap from './GpsRouteMap';
import ShipmentTimeline from './ShipmentTimeline';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import {
  updateShipmentStatus,
  uploadShipmentDocument,
  recordDeliveryProof,
  raiseDeliveryDispute,
  resolveDeliveryDispute,
  sendGpsTelemetry,
  verifyShipment,
} from '../../api/logisticsApi';

export default function ShipmentDetailModal({
  shipment,
  isOpen,
  onClose,
  currentUser,
  onRefresh,
  showToast,
}) {
  if (!shipment) return null;

  const [activeTab, setActiveTab] = useState('overview'); // overview, timeline, documents, pod, dispute
  const [busy, setBusy] = useState(false);

  // Status Update state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusLocation, setStatusLocation] = useState('');

  // GPS Telemetry input modal
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [telemetryLat, setTelemetryLat] = useState('19.0760');
  const [telemetryLng, setTelemetryLng] = useState('72.8777');
  const [telemetrySpeed, setTelemetrySpeed] = useState('65');
  const [telemetryAddress, setTelemetryAddress] = useState('');

  // Document Upload state
  const [showDocModal, setShowDocModal] = useState(false);
  const [docType, setDocType] = useState('LR_BILTY');
  const [docTitle, setDocTitle] = useState('');
  const [docUrl, setDocUrl] = useState('');

  // Delivery POD state
  const [showPodModal, setShowPodModal] = useState(false);
  const [podRecipient, setPodRecipient] = useState(shipment.deliveryAddress?.name || '');
  const [podPhone, setPodPhone] = useState(shipment.deliveryAddress?.phone || '');
  const [podOtp, setPodOtp] = useState('');
  const [podCondition, setPodCondition] = useState('GOOD');
  const [podPhotoUrl, setPodPhotoUrl] = useState('');
  const [podNotes, setPodNotes] = useState('');

  // Dispute state
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('Damaged Cargo');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputePhoto, setDisputePhoto] = useState('');

  // Admin Resolve Dispute state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionText, setResolutionText] = useState('');
  const [refundFreight, setRefundFreight] = useState('0');

  // Super Admin Verification state (Step 4)
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const userRole = (currentUser?.role || '').toUpperCase();
  const isSupplier = shipment.supplierId === currentUser?.id;
  const isBuyer = shipment.buyerId === currentUser?.id;
  const isTransporter = shipment.transporter?.ownerId === currentUser?.id || userRole === 'TRANSPORT_PARTNER';
  const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  const handleUpdateStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStatus) return;
    setBusy(true);
    try {
      await updateShipmentStatus(shipment.id, {
        newStatus: selectedStatus,
        notes: statusNotes,
        location: statusLocation,
      });
      showToast?.(`Shipment status updated to ${selectedStatus.replace(/_/g, ' ')}.`);
      setShowStatusModal(false);
      onRefresh?.();
    } catch (err) {
      showToast?.(err.message || 'Failed to update status.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSendGpsSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await sendGpsTelemetry(shipment.id, {
        latitude: parseFloat(telemetryLat),
        longitude: parseFloat(telemetryLng),
        speed: parseFloat(telemetrySpeed),
        address: telemetryAddress || 'Highway Corridor Checkpoint',
      });
      showToast?.('GPS telemetry recorded successfully.');
      setShowGpsModal(false);
      onRefresh?.();
    } catch (err) {
      showToast?.(err.message || 'Failed to record telemetry.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleUploadDocSubmit = async (e) => {
    e.preventDefault();
    if (!docUrl || !docTitle) return;
    setBusy(true);
    try {
      await uploadShipmentDocument(shipment.id, {
        docType,
        title: docTitle,
        fileUrl: docUrl,
        fileName: `${docType.toLowerCase()}_${Date.now()}.pdf`,
      });
      showToast?.('Transport document uploaded successfully.');
      setShowDocModal(false);
      setDocUrl('');
      setDocTitle('');
      onRefresh?.();
    } catch (err) {
      showToast?.(err.message || 'Failed to upload document.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handlePodSubmit = async (e) => {
    e.preventDefault();
    if (!podRecipient) return;
    setBusy(true);
    try {
      await recordDeliveryProof(shipment.id, {
        recipientName: podRecipient,
        recipientPhone: podPhone,
        deliveryOtp: podOtp,
        condition: podCondition,
        photoProofUrls: podPhotoUrl ? [podPhotoUrl] : [],
        receiverNotes: podNotes,
      });
      showToast?.('Proof of delivery verified! Shipment delivered.');
      setShowPodModal(false);
      onRefresh?.();
    } catch (err) {
      showToast?.(err.message || 'Delivery confirmation failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!disputeDesc) return;
    setBusy(true);
    try {
      await raiseDeliveryDispute(shipment.id, {
        reason: disputeReason,
        description: disputeDesc,
        photoProofUrl: disputePhoto || null,
      });
      showToast?.('Delivery dispute reported. Super Admin team alerted.', 'warning');
      setShowDisputeModal(false);
      onRefresh?.();
    } catch (err) {
      showToast?.(err.message || 'Failed to raise dispute.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleResolveDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!resolutionText) return;
    setBusy(true);
    try {
      await resolveDeliveryDispute(shipment.id, {
        resolution: resolutionText,
        refundAmount: parseFloat(refundFreight) || 0,
        closeStatus: 'DELIVERED',
      });
      showToast?.('Dispute successfully resolved.');
      setShowResolveModal(false);
      onRefresh?.();
    } catch (err) {
      showToast?.(err.message || 'Failed to resolve dispute.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleApproveShipment = async () => {
    if (!window.confirm(`Approve shipment ${shipment.shipmentNumber || shipment.trackingNumber} for dispatch? This marks vehicle and documents verified.`)) {
      return;
    }
    setBusy(true);
    try {
      await verifyShipment(shipment.id, { isApproved: true });
      showToast?.('Shipment verified and approved for dispatch (Ready for Pickup)!');
      onRefresh?.();
      onClose();
    } catch (err) {
      showToast?.(err.message || 'Verification failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRejectShipment = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      showToast?.('Please specify a rejection reason.', 'warning');
      return;
    }
    setBusy(true);
    try {
      await verifyShipment(shipment.id, { isApproved: false, reason: rejectionReason.trim() });
      showToast?.('Shipment verification rejected and supplier notified.', 'warning');
      setShowRejectModal(false);
      setRejectionReason('');
      onRefresh?.();
      onClose();
    } catch (err) {
      showToast?.(err.message || 'Rejection failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="xl" title={null}>
        <div className="space-y-6">
          {/* Modal Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-navy-950">{shipment.shipmentNumber}</h2>
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                  AWB: {shipment.trackingNumber}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                    shipment.status === 'DELIVERED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : shipment.status === 'DELIVERY_DISPUTED'
                      ? 'bg-rose-100 text-rose-800'
                      : shipment.status === 'CANCELLED'
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {shipment.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Method:{' '}
                <strong className="text-navy-900">
                  {shipment.transportMethod === 'SUPPLIER_MANAGED'
                    ? 'Supplier-Managed Direct Transport'
                    : 'TradeExpress Verified Transport Partner'}
                </strong>{' '}
                · Created: {new Date(shipment.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2">
              {isAdmin && shipment.status === 'DOCUMENTS_PENDING' && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-700 border-rose-300 hover:bg-rose-50"
                    onClick={() => setShowRejectModal(true)}
                    disabled={busy}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={ShieldCheck}
                    onClick={handleApproveShipment}
                    disabled={busy}
                  >
                    {busy ? 'Approving...' : 'Approve (Step 4)'}
                  </Button>
                </div>
              )}

              {(isTransporter || isSupplier || isAdmin) &&
                shipment.status !== 'DELIVERED' &&
                shipment.status !== 'CANCELLED' && (
                  <Button size="sm" variant="outline" onClick={() => setShowStatusModal(true)}>
                    Update Status
                  </Button>
                )}

              {(isTransporter || isAdmin) &&
                shipment.status !== 'DELIVERED' &&
                shipment.status !== 'CANCELLED' && (
                  <Button size="sm" variant="outline" icon={Radio} onClick={() => setShowGpsModal(true)}>
                    Send GPS Ping
                  </Button>
                )}

              {(isTransporter || isBuyer || isAdmin) &&
                ['OUT_FOR_DELIVERY', 'IN_TRANSIT', 'READY_FOR_PICKUP'].includes(shipment.status) && (
                  <Button size="sm" variant="primary" icon={CheckCircle2} onClick={() => setShowPodModal(true)}>
                    {isBuyer ? 'Confirm Delivery (OTP)' : 'Submit POD & Complete'}
                  </Button>
                )}

              {isBuyer && shipment.status !== 'CANCELLED' && shipment.status !== 'DELIVERY_DISPUTED' && (
                <Button size="sm" variant="ghost" className="text-rose-700" onClick={() => setShowDisputeModal(true)}>
                  Report Issue
                </Button>
              )}

              {isAdmin && shipment.status === 'DELIVERY_DISPUTED' && (
                <Button size="sm" variant="primary" onClick={() => setShowResolveModal(true)}>
                  Resolve Dispute
                </Button>
              )}
            </div>
          </div>

          {/* Step 4 Verification Notice Banner */}
          {shipment.status === 'DOCUMENTS_PENDING' && (
            <div className={`rounded-xl border p-3.5 flex items-start gap-3 ${
              isAdmin ? 'bg-amber-50/90 border-amber-300 text-amber-950' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <ShieldCheck className="size-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs">
                <h4 className="font-bold">
                  {isAdmin ? 'Super Admin Action Required: Step 4 Verification' : 'Step 4: Super Admin Verification Pending'}
                </h4>
                <p className="text-[11px] mt-0.5 text-slate-600">
                  {isAdmin
                    ? `Review vehicle (${shipment.vehicleNumber || 'Unassigned'}), driver (${shipment.driverName || 'Unassigned'}), and attached transport documents. Verification must be approved before dispatch.`
                    : 'Consignment truck details and regulatory documents have been submitted and are under review by Super Admin. Consignment can be dispatched once verified.'}
                </p>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 text-xs font-semibold">
            {[
              { id: 'overview', label: 'Route & Vehicle' },
              { id: 'timeline', label: `Milestones (${shipment.events?.length || 0})` },
              { id: 'documents', label: `Documents (${shipment.documents?.length || 0})` },
              { id: 'pod', label: 'Proof of Delivery (POD)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-emerald-600 text-emerald-800 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: Route, Map & Vehicle Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Vector Real GPS Telemetry Map */}
              <GpsRouteMap
                pickupAddress={shipment.pickupAddress}
                deliveryAddress={shipment.deliveryAddress}
                currentLocation={shipment.currentLocation}
                locations={shipment.locations}
                status={shipment.status}
                vehicleNumber={shipment.vehicleNumber}
                driverName={shipment.driverName}
              />

              {/* Delivery OTP Notice for Buyer */}
              {isBuyer && shipment.deliveryOtp && shipment.status !== 'DELIVERED' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
                      <KeyRound className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-950">Secure Delivery Confirmation PIN (OTP)</h4>
                      <p className="text-[11px] text-amber-800">
                        Share this 6-digit code with the delivery driver only after physical inspection of goods.
                      </p>
                    </div>
                  </div>
                  <div className="text-xl font-mono font-black tracking-widest text-amber-950 bg-white px-3 py-1 rounded-lg border border-amber-300">
                    {shipment.deliveryOtp}
                  </div>
                </div>
              )}

              {/* Route & Carrier Information Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Vehicle & Driver Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                  <h4 className="text-xs font-bold text-navy-950 flex items-center gap-1.5">
                    <Truck className="size-4 text-emerald-700" />
                    Fleet & Driver Assigned
                  </h4>
                  <div className="text-xs space-y-1">
                    <p>
                      <span className="text-slate-500">Vehicle: </span>
                      <strong className="text-slate-900">{shipment.vehicleNumber || 'Unassigned'}</strong>
                    </p>
                    <p>
                      <span className="text-slate-500">Driver: </span>
                      <span className="text-slate-800">{shipment.driverName || 'Assigned Driver'}</span>
                    </p>
                    {shipment.driverPhone && (
                      <p className="flex items-center gap-1 text-slate-700">
                        <Phone className="size-3 text-emerald-600" />
                        <span>{shipment.driverPhone}</span>
                      </p>
                    )}
                    {shipment.lrNumber && (
                      <p>
                        <span className="text-slate-500">LR / Bilty: </span>
                        <span className="font-mono text-slate-800 font-bold">{shipment.lrNumber}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Transporter Company Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                  <h4 className="text-xs font-bold text-navy-950 flex items-center gap-1.5">
                    <Building2 className="size-4 text-emerald-700" />
                    Transporter Details
                  </h4>
                  <div className="text-xs space-y-1">
                    <p>
                      <span className="text-slate-500">Company: </span>
                      <strong className="text-slate-900">
                        {shipment.transporter?.name || (shipment.transportMethod === 'SUPPLIER_MANAGED' ? 'Supplier Fleet' : 'TradeExpress Partner')}
                      </strong>
                    </p>
                    {shipment.transporter?.phone && (
                      <p>
                        <span className="text-slate-500">Phone: </span>
                        <span>{shipment.transporter.phone}</span>
                      </p>
                    )}
                    {shipment.transporter?.ibaApproved && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                        <ShieldCheck className="size-3 text-emerald-700" />
                        IBA Approved Transporter
                      </span>
                    )}
                    <p className="text-[11px] text-slate-500 mt-1">
                      Freight: ₹{Number(shipment.freightCharges || 0).toLocaleString()} ({shipment.freightPayer} paid)
                    </p>
                  </div>
                </div>

                {/* Cargo & Dates Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                  <h4 className="text-xs font-bold text-navy-950 flex items-center gap-1.5">
                    <Package className="size-4 text-emerald-700" />
                    Consignment Manifest
                  </h4>
                  <div className="text-xs space-y-1">
                    <p>
                      <span className="text-slate-500">Total Weight: </span>
                      <strong className="text-slate-900">{shipment.totalWeightKg || 1000} Kg</strong>
                    </p>
                    <p>
                      <span className="text-slate-500">Packages: </span>
                      <span>{shipment.totalPackages || 1} units</span>
                    </p>
                    {shipment.ewayBillNumber && (
                      <p>
                        <span className="text-slate-500">e-Way Bill: </span>
                        <span className="font-mono text-slate-800 font-bold">{shipment.ewayBillNumber}</span>
                      </p>
                    )}
                    <p className="flex items-center gap-1 text-slate-600 text-[11px] mt-1">
                      <Calendar className="size-3 text-slate-400" />
                      <span>Est. Delivery: {shipment.estimatedDeliveryAt ? new Date(shipment.estimatedDeliveryAt).toLocaleDateString() : '3–5 days'}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Milestones & Audit Timeline */}
          {activeTab === 'timeline' && (
            <div className="py-2">
              <ShipmentTimeline events={shipment.events} status={shipment.status} />
            </div>
          )}

          {/* TAB 3: Documents */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900">Regulatory & Consignment Documents</h4>
                <Button size="sm" variant="outline" icon={Upload} onClick={() => setShowDocModal(true)}>
                  Upload Document
                </Button>
              </div>

              {shipment.documents && shipment.documents.length > 0 ? (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden text-xs">
                  {shipment.documents.map((doc) => (
                    <div key={doc.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                          <FileText className="size-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{doc.title}</p>
                          <p className="text-[11px] text-slate-500">
                            Type: <strong className="text-slate-700">{doc.docType.replace(/_/g, ' ')}</strong> · Uploaded by {doc.uploadedByRole}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {doc.isVerified ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                            <ShieldCheck className="size-3 text-emerald-600" />
                            Verified
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            Pending Review
                          </span>
                        )}
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold text-xs"
                        >
                          <span>View</span>
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                  <FileText className="size-6 mx-auto mb-2 text-slate-400" />
                  <p>No documents uploaded yet. Upload LR / Bilty, e-Way Bill, or RC below.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Proof of Delivery (POD) */}
          {activeTab === 'pod' && (
            <div className="space-y-4">
              {shipment.deliveryProof ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-emerald-700" />
                      Proof of Delivery (POD) Record Verified
                    </h4>
                    <span className="text-xs text-emerald-800 font-mono">
                      Received: {new Date(shipment.deliveryProof.receivedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">Recipient Name:</span>
                      <p className="font-bold text-slate-900">{shipment.deliveryProof.recipientName}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Recipient Phone:</span>
                      <p className="font-bold text-slate-900">{shipment.deliveryProof.recipientPhone || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Consignment Condition:</span>
                      <p className="font-bold text-slate-900">{shipment.deliveryProof.condition}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">OTP Verified:</span>
                      <p className="font-bold text-emerald-700">
                        {shipment.deliveryProof.otpVerified ? 'YES (Verified by Buyer PIN)' : 'Direct Confirmation'}
                      </p>
                    </div>
                  </div>

                  {shipment.deliveryProof.photoProofUrls && shipment.deliveryProof.photoProofUrls.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-slate-700 mb-2 block">Unloading / Consignee Photos:</span>
                      <div className="flex flex-wrap gap-2">
                        {shipment.deliveryProof.photoProofUrls.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="POD Proof" className="size-20 rounded-lg object-cover border border-slate-200 shadow-xs hover:scale-105 transition-transform" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 space-y-2">
                  <Clock className="size-7 mx-auto text-slate-400" />
                  <p className="font-bold text-slate-700">Proof of Delivery Pending</p>
                  <p>When goods arrive, the recipient or driver will complete delivery with the 6-digit confirmation PIN.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* SUB-MODAL 1: Update Shipment Status */}
      {showStatusModal && (
        <Modal isOpen={showStatusModal} onClose={() => setShowStatusModal(false)} size="md" title="Update Shipment Status">
          <form onSubmit={handleUpdateStatusSubmit} className="space-y-4">
            {shipment.status === 'DOCUMENTS_PENDING' && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <strong>Step 4 Notice:</strong> Consignment is in DOCUMENTS PENDING status. Super Admin verification must be approved before dispatching (Picked Up or In Transit).
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Select Next Status</label>
              <select
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                required
              >
                <option value="">-- Choose Status --</option>
                <option value="READY_FOR_PICKUP">READY FOR PICKUP</option>
                <option value="PICKUP_SCHEDULED">PICKUP SCHEDULED</option>
                <option value="PICKED_UP" disabled={shipment.status === 'DOCUMENTS_PENDING'}>
                  PICKED UP (Cargo Loaded) {shipment.status === 'DOCUMENTS_PENDING' ? '(Locked: Needs Admin Approval)' : ''}
                </option>
                <option value="IN_TRANSIT" disabled={shipment.status === 'DOCUMENTS_PENDING'}>
                  IN TRANSIT (On Highway) {shipment.status === 'DOCUMENTS_PENDING' ? '(Locked: Needs Admin Approval)' : ''}
                </option>
                <option value="OUT_FOR_DELIVERY" disabled={shipment.status === 'DOCUMENTS_PENDING'}>
                  OUT FOR DELIVERY {shipment.status === 'DOCUMENTS_PENDING' ? '(Locked: Needs Admin Approval)' : ''}
                </option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <Input
              label="Checkpoint / Current Location"
              placeholder="e.g. Pune Highway Checkpost / Bhiwandi Hub"
              value={statusLocation}
              onChange={(e) => setStatusLocation(e.target.value)}
            />

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Status Notes / Dispatch Remarks</label>
              <textarea
                rows={3}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                placeholder="Details about vehicle movement, toll clearance, or inspection..."
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowStatusModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={busy}>
                {busy ? 'Updating...' : 'Save Status'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* SUB-MODAL 2: Record Real GPS Telemetry */}
      {showGpsModal && (
        <Modal isOpen={showGpsModal} onClose={() => setShowGpsModal(false)} size="md" title="Broadcast Real GPS Telemetry">
          <form onSubmit={handleSendGpsSubmit} className="space-y-4">
            <p className="text-xs text-slate-600">
              Submit actual vehicle telematics coordinates. These coordinates will update the live map and notify all tracking parties over Socket.IO.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Latitude (°N)"
                value={telemetryLat}
                onChange={(e) => setTelemetryLat(e.target.value)}
                required
              />
              <Input
                label="Longitude (°E)"
                value={telemetryLng}
                onChange={(e) => setTelemetryLng(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Speed (km/h)"
                value={telemetrySpeed}
                onChange={(e) => setTelemetrySpeed(e.target.value)}
              />
              <Input
                label="Waypoint Address"
                placeholder="e.g. NH-48 Express Corridor, Toll Plaza"
                value={telemetryAddress}
                onChange={(e) => setTelemetryAddress(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowGpsModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={busy}>
                {busy ? 'Broadcasting...' : 'Broadcast GPS Ping'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* SUB-MODAL 3: Upload Document */}
      {showDocModal && (
        <Modal isOpen={showDocModal} onClose={() => setShowDocModal(false)} size="md" title="Upload Transport Document">
          <form onSubmit={handleUploadDocSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Document Type</label>
              <select
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                <option value="LR_BILTY">LR / Bilty (Lorry Receipt)</option>
                <option value="EWAY_BILL">GST e-Way Bill</option>
                <option value="COMMERCIAL_INVOICE">Commercial Invoice</option>
                <option value="PACKING_LIST">Cargo Packing List</option>
                <option value="VEHICLE_RC">Vehicle Registration Certificate (RC)</option>
                <option value="DRIVER_DL">Commercial Driver License (DL)</option>
                <option value="WEIGHT_SLIP">Dharamsatta Weighbridge Slip</option>
                <option value="POD">Signed Proof of Delivery (POD)</option>
              </select>
            </div>

            <Input
              label="Document Title"
              placeholder="e.g. Consignment LR No. TS-98214"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              required
            />

            <Input
              label="Document File URL"
              placeholder="https://... or uploaded document path"
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              required
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowDocModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={busy}>
                {busy ? 'Uploading...' : 'Save Document'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* SUB-MODAL 4: Proof of Delivery (POD) */}
      {showPodModal && (
        <Modal isOpen={showPodModal} onClose={() => setShowPodModal(false)} size="md" title="Confirm Delivery & Submit POD">
          <form onSubmit={handlePodSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Recipient Full Name"
                value={podRecipient}
                onChange={(e) => setPodRecipient(e.target.value)}
                required
              />
              <Input
                label="Recipient Contact Phone"
                value={podPhone}
                onChange={(e) => setPodPhone(e.target.value)}
              />
            </div>

            <Input
              label="6-Digit Delivery PIN / OTP (Given by Buyer)"
              placeholder="Enter 6-digit confirmation PIN"
              value={podOtp}
              onChange={(e) => setPodOtp(e.target.value)}
              required
            />

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Cargo Condition Upon Arrival</label>
              <select
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                value={podCondition}
                onChange={(e) => setPodCondition(e.target.value)}
              >
                <option value="GOOD">Good Condition (Seals Intact, No Damage)</option>
                <option value="PARTIAL">Partial Delivery (Split Consignment)</option>
                <option value="DAMAGED">Damaged Outer Packing</option>
              </select>
            </div>

            <Input
              label="Unloading / Proof Photo URL (Optional)"
              placeholder="https://... photo proof of consignment delivered"
              value={podPhotoUrl}
              onChange={(e) => setPodPhotoUrl(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowPodModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={busy}>
                {busy ? 'Verifying...' : 'Confirm Delivery'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* SUB-MODAL 5: Raise Delivery Dispute */}
      {showDisputeModal && (
        <Modal isOpen={showDisputeModal} onClose={() => setShowDisputeModal(false)} size="md" title="Report Delivery Dispute / Consignment Issue">
          <form onSubmit={handleDisputeSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Dispute Reason</label>
              <select
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
              >
                <option value="Damaged Cargo">Damaged Cargo / Broken Packaging</option>
                <option value="Shortage in Units">Shortage in Units / Missing Boxes</option>
                <option value="Delivery Delay Violation">Critical Delivery Delay Violation</option>
                <option value="Wrong Consignment Delivered">Wrong Consignment Delivered</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Detailed Description</label>
              <textarea
                rows={3}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                placeholder="Explain the damage, missing quantity, or issue observed..."
                value={disputeDesc}
                onChange={(e) => setDisputeDesc(e.target.value)}
                required
              />
            </div>

            <Input
              label="Damage Photo URL"
              placeholder="https://... photo proof of damaged goods"
              value={disputePhoto}
              onChange={(e) => setDisputePhoto(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowDisputeModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" size="sm" disabled={busy}>
                {busy ? 'Submitting...' : 'Report Issue'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* SUB-MODAL 6: Super Admin Resolve Dispute */}
      {showResolveModal && (
        <Modal isOpen={showResolveModal} onClose={() => setShowResolveModal(false)} size="md" title="Super Admin Dispute Resolution">
          <form onSubmit={handleResolveDisputeSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Resolution Summary</label>
              <textarea
                rows={3}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                placeholder="Official findings, transporter liability, and insurance/refund decision..."
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                required
              />
            </div>

            <Input
              label="Freight Refund Amount (₹, if applicable)"
              type="number"
              value={refundFreight}
              onChange={(e) => setRefundFreight(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowResolveModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={busy}>
                {busy ? 'Resolving...' : 'Confirm Resolution'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {/* SUB-MODAL 7: Super Admin Reject Shipment Verification */}
      {showRejectModal && (
        <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} size="md" title="Reject Shipment Verification">
          <form onSubmit={handleRejectShipment} className="space-y-4">
            <p className="text-xs text-slate-600">
              Specify the reason for rejecting vehicle details, driver credentials, or documents for consignment <strong>{shipment.shipmentNumber}</strong>. The supplier will be notified to rectify the submission.
            </p>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Rejection Reason <span className="text-rose-600">*</span>
              </label>
              <textarea
                required
                rows={3}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-rose-600 focus:outline-none"
                placeholder="e.g. Expired vehicle insurance document / driver license number does not match RC..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" size="sm" disabled={busy}>
                {busy ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

