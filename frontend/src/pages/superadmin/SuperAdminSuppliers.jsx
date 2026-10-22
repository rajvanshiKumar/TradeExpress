import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  FileText,
  Building2,
  MapPin,
  Landmark,
  Eye,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';

export default function SuperAdminSuppliers() {
  const { showToast } = useNotifications();
  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');

  // Review modal
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [actionType, setActionType] = useState('VERIFIED');
  const [reasonNotes, setReasonNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSuppliers = async (page = 1) => {
    try {
      setLoading(true);
      const res = await superAdminApi.getSuppliersKyc({
        page,
        limit: pagination.limit,
        status,
        search,
      });
      setSuppliers(res.suppliers);
      setPagination(res.pagination);
    } catch (err) {
      showToast(err.message || 'Failed to fetch suppliers from database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers(1);
  }, [status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSuppliers(1);
  };

  const openReviewModal = (s, action) => {
    setSelectedSupplier(s);
    setActionType(action);
    setReasonNotes('');
    setReviewModalOpen(true);
  };

  const handleReviewSubmit = async () => {
    if ((actionType === 'REJECTED' || actionType === 'RESUBMISSION_REQUESTED') && !reasonNotes.trim()) {
      showToast('Please provide a reason or corrective instructions for the supplier.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await superAdminApi.reviewSupplierKyc(selectedSupplier.id, {
        status: actionType,
        rejectionReason: reasonNotes,
        notes: reasonNotes,
      });
      showToast(`Supplier verification updated to ${actionType}.`, 'success');
      setReviewModalOpen(false);
      fetchSuppliers(pagination.page);
    } catch (err) {
      showToast(err.message || 'Failed to submit KYC review.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Supplier KYC & Compliance Console</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit B2B vendor profiles, GSTIN/PAN registrations, and authorize verified trade badges.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchSuppliers(pagination.page)}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 self-start sm:self-auto"
          title="Refresh Queue"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company name, email, GSTIN, PAN..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </form>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-slate-500 font-semibold">Verification Queue:</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Suppliers</option>
            <option value="PENDING">Pending Review</option>
            <option value="VERIFIED">Verified Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="RESUBMISSION_REQUESTED">Resubmission Requested</option>
          </select>
        </div>
      </div>

      {/* Suppliers Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {suppliers.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
            No suppliers found in this verification queue.
          </div>
        ) : (
          suppliers.map((s) => {
            const isVerified = s.isVerified || s.kycStatus === 'VERIFIED';
            const isPending = s.kycStatus === 'PENDING';
            const isRejected = s.kycStatus === 'REJECTED';

            return (
              <div
                key={s.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:border-emerald-500/40 transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-slate-900 text-emerald-400 font-black flex items-center justify-center text-sm shadow-xs">
                        <Building2 className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight group-hover:text-emerald-800 transition-colors">
                          {s.company || s.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 font-mono truncate max-w-[180px]">{s.email}</p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        isVerified
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isPending
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                          : isRejected
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isVerified ? <CheckCircle2 className="size-3" /> : isRejected ? <XCircle className="size-3" /> : <AlertCircle className="size-3" />}
                      {s.kycStatus || 'NOT_SUBMITTED'}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="mt-3.5 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">GSTIN:</span>
                      <span className="font-mono font-bold text-slate-800">{s.gstin || 'Not provided'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">PAN:</span>
                      <span className="font-mono font-bold text-slate-800">{s.pan || 'Not provided'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Bank IFSC:</span>
                      <span className="font-mono text-slate-800">{s.bankIfsc || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Warehouse:</span>
                      <span className="text-slate-800 font-medium truncate max-w-[160px]">
                        {s.warehouseState ? `${s.warehouseState} (${s.warehousePincode || ''})` : s.city || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-400">Documents Uploaded:</span>
                      <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                        {s.kycDocuments?.length || 0} files
                      </span>
                    </div>
                  </div>

                  {s.kycRejectionReason && (
                    <div className="mt-3 p-2 rounded-lg bg-rose-50 border border-rose-100 text-[11px] text-rose-800">
                      <span className="font-bold">Prior Note:</span> {s.kycRejectionReason}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSupplier(s);
                      setActionType('VIEW');
                      setReviewModalOpen(true);
                    }}
                    className="flex-1 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  >
                    View KYC Dossier
                  </button>

                  {!isVerified ? (
                    <button
                      type="button"
                      onClick={() => openReviewModal(s, 'VERIFIED')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                    >
                      Verify
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openReviewModal(s, 'REJECTED')}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Review & KYC Dossier Modal */}
      {reviewModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="size-6" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Supplier Verification: {selectedSupplier.company || selectedSupplier.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedSupplier.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Dossier Info Tabs */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block font-semibold">Legal GSTIN</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{selectedSupplier.gstin || 'Not provided'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block font-semibold">Income Tax PAN</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{selectedSupplier.pan || 'Not provided'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block font-semibold">Bank Account</span>
                <span className="font-mono text-slate-900">{selectedSupplier.bankAccountNumber || 'Not provided'} ({selectedSupplier.bankName || 'Bank'})</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block font-semibold">IFSC Code</span>
                <span className="font-mono text-slate-900">{selectedSupplier.bankIfsc || 'Not provided'}</span>
              </div>
              <div className="col-span-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block font-semibold">Warehouse / Dispatch Facility</span>
                <span className="text-slate-900">
                  {selectedSupplier.warehouseAddress
                    ? `${selectedSupplier.warehouseAddress}, ${selectedSupplier.warehouseState} - ${selectedSupplier.warehousePincode}`
                    : 'Address not recorded.'}
                </span>
              </div>
            </div>

            {/* Uploaded Documents */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Uploaded Verification Files</h4>
              {selectedSupplier.kycDocuments?.length === 0 ? (
                <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  No digital documents uploaded by this supplier.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedSupplier.kycDocuments?.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex items-center gap-2.5">
                        <FileText className="size-4 text-emerald-700" />
                        <div>
                          <p className="font-bold text-slate-800">{doc.docType}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{doc.fileName}</p>
                        </div>
                      </div>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 rounded-lg bg-white border border-slate-200 font-bold text-emerald-800 hover:bg-emerald-50"
                      >
                        Inspect File
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Decision Controls */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <label className="block text-xs font-bold text-slate-700">Audit Review Decision</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActionType('VERIFIED')}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                    actionType === 'VERIFIED'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Approve (Verify)
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('RESUBMISSION_REQUESTED')}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                    actionType === 'RESUBMISSION_REQUESTED'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Request Resubmit
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('REJECTED')}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                    actionType === 'REJECTED'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Reject & Flag
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Compliance Notes / Rejection Reasons
                </label>
                <textarea
                  value={reasonNotes}
                  onChange={(e) => setReasonNotes(e.target.value)}
                  placeholder="Enter comments for audit record and supplier notification..."
                  rows="3"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleReviewSubmit}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0b2716] text-white hover:bg-emerald-950 transition-colors"
                >
                  {submitting ? 'Recording...' : 'Commit Compliance Decision'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
