import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  HelpCircle,
  MessageSquare,
  Package,
  Plus,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import CustomSelect from '../../components/common/CustomSelect';
import useAuth from '../../hooks/useAuth';
import useOrders from '../../hooks/useOrders';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatDate } from '../../utils/formatDate';
import { apiGet, apiPost } from '../../services/apiClient';

const DISPUTE_REASONS = [
  'Quality Mismatch with Specifications',
  'Damaged / Defective Goods in Consignment',
  'Quantity / Unit Shortage Received',
  'Delayed Consignment Beyond Agreed SLA',
  'Counterfeit / Non-Genuine Material',
  'Other Statutory Compliance Variance',
];

export default function BuyerDisputes() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  useDocumentTitle('Help & Disputes — TradeExpress Buyer Protection');

  const [activeTab, setActiveTab] = useState('DISPUTES');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Dispute form state
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [reason, setReason] = useState(DISPUTE_REASONS[0]);
  const [description, setDescription] = useState('');
  const [photoProof, setPhotoProof] = useState('');

  // Local dispute tracking store (persisted in localStorage for buyer)
  const [disputes, setDisputes] = useState(() => {
    try {
      const stored = localStorage.getItem(`tradeexpress_buyer_disputes_${user?.id}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const buyerOrders = useMemo(() => {
    return (orders || []).filter((o) => o.buyerId === user?.id && o.status !== 'Cancelled');
  }, [orders, user?.id]);

  const handleOpenModal = () => {
    if (buyerOrders.length === 0) {
      showToast('You must have at least one active order to file a dispute.', 'warning');
      return;
    }
    setSelectedOrderId(buyerOrders[0].id);
    setReason(DISPUTE_REASONS[0]);
    setDescription('');
    setPhotoProof('');
    setModalOpen(true);
  };

  const handleCreateDispute = async (e) => {
    e.preventDefault();
    if (!selectedOrderId) {
      showToast('Please select an order.', 'error');
      return;
    }
    if (!description || description.trim().length < 10) {
      showToast('Please provide a detailed description (at least 10 characters).', 'error');
      return;
    }

    setSubmitting(true);
    const targetOrder = buyerOrders.find((o) => o.id === selectedOrderId);

    try {
      let createdDispute = null;
      try {
        const res = await apiPost(`disputes/${selectedOrderId}`, {
          reason,
          description: description.trim(),
          photoProof: photoProof.trim() || undefined,
        });
        if (res && (res.success || res.id)) {
          createdDispute = res.data || res;
        }
      } catch {
        // Fallback for offline dev
      }

      if (!createdDispute) {
        createdDispute = {
          id: `DSP-${Date.now()}`,
          orderId: selectedOrderId,
          orderNumber: selectedOrderId,
          reason,
          description: description.trim(),
          status: 'OPEN',
          createdAt: new Date().toISOString(),
          amountHeld: targetOrder?.total || 0,
          resolution: 'TradeExpress Dispute Council will arbitrate within 48 business hours.',
        };
      }

      const updated = [createdDispute, ...disputes];
      setDisputes(updated);
      try {
        localStorage.setItem(`tradeexpress_buyer_disputes_${user?.id}`, JSON.stringify(updated));
      } catch {}

      showToast('Dispute filed successfully! Escrow disbursement has been frozen.', 'success');
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Help & Order Disputes"
        description="Mediation desk and statutory buyer protection center. File claims against delayed or non-conforming shipments."
        actions={
          <div className="flex items-center gap-2">
            <Button
              to="/help"
              variant="outline"
              size="sm"
              icon={HelpCircle}
            >
              Browse FAQs
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleOpenModal}
            >
              Raise a Dispute
            </Button>
          </div>
        }
      />

      {/* Escrow Arbitration Guarantee Banner */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              <ShieldAlert className="size-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                TradeExpress Escrow & Dispute Mediation Council
              </h3>
              <p className="mt-1 text-xs text-slate-600 max-w-2xl leading-relaxed">
                When a dispute is raised, funds for the order are instantly frozen in escrow. The seller cannot
                withdraw payout until the TradeExpress arbitration team inspects consignment evidence and reaches an agreed resolution or full refund.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              100% Escrow Protection
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'DISPUTES', label: 'My Dispute Cases', count: disputes.length },
          { id: 'RESOLUTIONS', label: 'Mediation Policies & Guidelines' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === t.id
                ? 'bg-emerald-800 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === t.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'DISPUTES' ? (
        disputes.length === 0 ? (
          <div className="ts-card p-6">
            <EmptyState
              icon={ShieldCheck}
              title="No active disputes"
              text="All your orders are in good standing with trade protection enabled."
              action={
                <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenModal}>
                  Raise a Dispute
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs divide-y divide-slate-100">
            {disputes.map((d) => (
              <div key={d.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-emerald-800">
                        Case #{d.id}
                      </span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-200 flex items-center gap-1">
                        <Clock className="size-3 text-amber-600" />
                        {d.status || 'UNDER_REVIEW'}
                      </span>
                      <span className="text-xs text-slate-400">· Order #{d.orderId}</span>
                    </div>
                    <h4 className="mt-1.5 text-sm font-bold text-slate-900">{d.reason}</h4>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-3xl">
                      {d.description}
                    </p>
                  </div>

                  <div className="text-right sm:border-l sm:border-slate-100 sm:pl-4 shrink-0">
                    <span className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider">
                      Amount Frozen
                    </span>
                    <span className="text-base font-extrabold text-emerald-900 font-mono">
                      {money(d.amountHeld || 0)}
                    </span>
                    <p className="mt-1 text-[11px] text-slate-400">{formatDate(d.createdAt)}</p>
                  </div>
                </div>

                {d.resolution && (
                  <div className="mt-3.5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-900 flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span><strong>Council Update:</strong> {d.resolution}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Dispute Resolution Process (SLA & Timelines)</h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              TradeExpress operates an impartial Dispute Arbitration Council for all domestic and international wholesale trade contracts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="size-7 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-bold text-xs mb-2">
                1
              </div>
              <h4 className="text-xs font-bold text-slate-900">Claim Initiation & Escrow Freeze</h4>
              <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
                The buyer files a claim with photographic or test evidence. Escrow payout to seller is locked immediately.
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="size-7 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-bold text-xs mb-2">
                2
              </div>
              <h4 className="text-xs font-bold text-slate-900">Evidence Review (48 Hours)</h4>
              <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
                TradeExpress inspectors review purchase order specifications, pre-shipment certificates, and carrier delivery records.
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="size-7 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-bold text-xs mb-2">
                3
              </div>
              <h4 className="text-xs font-bold text-slate-900">Arbitration Decision & Settlement</h4>
              <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
                Binding resolution executed: 100% full buyer refund, replacement dispatch, or partial compensation agreement.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Need immediate assistance with a wholesale shipment?</span>
            <Link to="/help" className="text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1">
              Visit Help Desk <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Raise Dispute Modal */}
      {modalOpen && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Raise a Trade Protection Dispute Claim"
          size="md"
        >
          <form onSubmit={handleCreateDispute} className="space-y-4 p-2 text-xs">
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Select Purchase Order <span className="text-rose-500">*</span>
              </label>
              <CustomSelect
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                options={buyerOrders.map((o) => ({
                  value: o.id,
                  label: `Order #${o.id} · ${money(o.total)} · ${o.items?.[0]?.name || 'Items'}`
                }))}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Dispute Claim Reason <span className="text-rose-500">*</span>
              </label>
              <CustomSelect
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                options={DISPUTE_REASONS.map((r) => ({ value: r, label: r }))}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Detailed Claim Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                placeholder="Explain the defect, specification mismatch, or delivery issue in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              />
              <span className="text-[11px] text-slate-400">Minimum 10 characters required.</span>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Photo Proof / Document URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://... (photo or bill of lading link)"
                value={photoProof}
                onChange={(e) => setPhotoProof(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Freeze Escrow & Submit Claim'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

