import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  Percent,
  RefreshCw,
  Save,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { StatusBadge } from '../../components/common/Badge';
import ChartCard from '../../components/common/ChartCard';
import Modal from '../../components/common/Modal';
import Tabs, { TabPanel } from '../../components/common/Tabs';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { TableSkeleton } from '../../components/common/Skeleton';
import OrderDetails from '../../components/forms/OrderDetails';
import useOrders from '../../hooks/useOrders';
import useInquiries from '../../hooks/useInquiries';
import useProducts from '../../hooks/useProducts';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import formatCurrency, { formatAxisRupees } from '../../utils/formatCurrency';
import { countBy, ordersByMonth } from '../../utils/analytics';
import { INQUIRY_STATUSES, ORDER_STATUSES } from '../../utils/constants';
import { formatDate } from '../../utils/formatDate';
import { apiGet, apiPost } from '../../services/apiClient';
import AdminSupportDesk from '../../components/admin/AdminSupportDesk';

const SORTS = {
  newest: { label: 'Newest first', compare: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  oldest: { label: 'Oldest first', compare: (a, b) => new Date(a.createdAt) - new Date(b.createdAt) },
  quantity: { label: 'Largest quantity', compare: (a, b) => b.quantity - a.quantity },
};

export default function AdminReports() {
  const { orders, loading: ordersLoading, error: ordersError, reload: reloadOrders, updateOrderStatus } = useOrders();
  const { inquiries, loading: inquiriesLoading, error: inquiriesError, reload: reloadInquiries, setInquiryStatus } = useInquiries();
  const { categories, getCompany } = useProducts();
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  const [tab, setTab] = useState('inquiries');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [openOrder, setOpenOrder] = useState(null);
  useDocumentTitle('Admin: reports');

  // Commission state
  const [commissionSettings, setCommissionSettings] = useState([]);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [globalRate, setGlobalRate] = useState(5.0);
  const [newCatId, setNewCatId] = useState('');
  const [newCatRate, setNewCatRate] = useState('');
  const [savingCommission, setSavingCommission] = useState(false);

  // Escrow state
  const [escrowLedgers, setEscrowLedgers] = useState([]);
  const [escrowSummary, setEscrowSummary] = useState(null);
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [releasingPayout, setReleasingPayout] = useState('');

  // Disputes state
  const [disputes, setDisputes] = useState([]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [resolvingDispute, setResolvingDispute] = useState(false);
  const [mediationAction, setMediationAction] = useState('APPROVE_FULL_REFUND');
  const [mediationNote, setMediationNote] = useState('');
  const [partialRefundAmt, setPartialRefundAmt] = useState('');

  const fetchCommissions = async () => {
    try {
      setCommissionLoading(true);
      const res = await apiGet('admin/commission');
      if (res && res.data) {
        setCommissionSettings(res.data);
        const global = res.data.find((s) => s.type === 'GLOBAL');
        if (global) setGlobalRate(global.percentage);
      }
    } catch (err) {
      console.warn('Failed to fetch commission settings:', err);
    } finally {
      setCommissionLoading(false);
    }
  };

  const fetchEscrow = async () => {
    try {
      setEscrowLoading(true);
      const [sumRes, ledgRes] = await Promise.all([
        apiGet('escrow/summary').catch(() => null),
        apiGet('escrow/ledgers').catch(() => null),
      ]);
      if (sumRes?.data) setEscrowSummary(sumRes.data);
      if (ledgRes?.data) setEscrowLedgers(ledgRes.data);
    } catch (err) {
      console.warn('Failed to fetch escrow data:', err);
    } finally {
      setEscrowLoading(false);
    }
  };

  const fetchDisputes = async () => {
    try {
      setDisputesLoading(true);
      const res = await apiGet('disputes');
      if (res?.data) setDisputes(res.data);
    } catch (err) {
      console.warn('Failed to fetch disputes:', err);
    } finally {
      setDisputesLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'commission') fetchCommissions();
    if (tab === 'escrow') fetchEscrow();
    if (tab === 'disputes') fetchDisputes();
  }, [tab]);

  const handleReleasePayout = async (orderId) => {
    setReleasingPayout(orderId);
    try {
      await apiPost(`escrow/${orderId}/release`, {});
      showToast('Escrow payout released to supplier successfully!', 'success');
      await fetchEscrow();
    } catch (err) {
      showToast(err.message || 'Failed to release payout', 'error');
    } finally {
      setReleasingPayout('');
    }
  };

  const handleResolveDispute = async (e) => {
    e.preventDefault();
    if (!selectedDispute) return;
    setResolvingDispute(true);
    try {
      await apiPost(`disputes/${selectedDispute.id}/resolve`, {
        action: mediationAction,
        resolutionNote: mediationNote,
        refundAmount: Number(partialRefundAmt) || 0,
      });
      showToast('Dispute resolved successfully!', 'success');
      setSelectedDispute(null);
      setMediationNote('');
      setPartialRefundAmt('');
      await fetchDisputes();
    } catch (err) {
      showToast(err.message || 'Failed to resolve dispute', 'error');
    } finally {
      setResolvingDispute(false);
    }
  };

  const handleSaveGlobalRate = async () => {
    try {
      setSavingCommission(true);
      await apiPost('admin/commission', { type: 'GLOBAL', percentage: parseFloat(globalRate) });
      showToast('Default platform commission updated successfully!', 'success');
      await fetchCommissions();
    } catch (err) {
      showToast(err.message || 'Failed to update global commission', 'error');
    } finally {
      setSavingCommission(false);
    }
  };

  const handleAddCategoryOverride = async (e) => {
    e.preventDefault();
    if (!newCatId || newCatRate === '') {
      showToast('Please select a category and enter percentage.', 'warning');
      return;
    }
    try {
      setSavingCommission(true);
      await apiPost('admin/commission', {
        type: 'CATEGORY',
        targetId: newCatId,
        percentage: parseFloat(newCatRate),
      });
      showToast('Category commission override saved!', 'success');
      setNewCatId('');
      setNewCatRate('');
      await fetchCommissions();
    } catch (err) {
      showToast(err.message || 'Failed to set category commission', 'error');
    } finally {
      setSavingCommission(false);
    }
  };

  const monthly = useMemo(() => ordersByMonth(orders), [orders]);
  const inquiryStatus = useMemo(() => countBy(inquiries, (inquiry) => inquiry.status, INQUIRY_STATUSES), [inquiries]);

  const q = search.trim().toLowerCase();
  const inquiryRows = inquiries
    .filter((inquiry) => (!q || `${inquiry.id} ${inquiry.productName} ${inquiry.buyerName} ${getCompany(inquiry.companyId)?.name ?? ''}`.toLowerCase().includes(q)) && (!status || inquiry.status === status))
    .sort(SORTS[sort].compare);
  const orderRows = orders
    .filter((order) => (!q || `${order.id} ${order.buyerName} ${order.buyerCompany}`.toLowerCase().includes(q)) && (!status || order.status === status))
    .sort((SORTS[sort] === SORTS.quantity ? SORTS.newest : SORTS[sort]).compare);
  const selectedOrder = orders.find((order) => order.id === openOrder) ?? null;
  const switchTab = (next) => { setTab(next); setStatus(''); setSearch(''); };
  const statuses = tab === 'inquiries' ? INQUIRY_STATUSES : ORDER_STATUSES;

  return (
    <div className="space-y-6">
      <SectionHeading title="Reports" description="Analytics, quote-request monitoring and order oversight." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Order value by month" description="INR, all orders except cancelled" isEmpty={!monthly.some((item) => item.revenue)} summary={`Order value by month: ${monthly.map((item) => `${item.month} ${formatCurrency(item.revenue)}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <defs><linearGradient id="reportArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F97316" stopOpacity={0.35} /><stop offset="95%" stopColor="#F97316" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={formatAxisRupees} />
              <Tooltip formatter={(value) => [formatCurrency(value), 'Order value']} />
              <Area type="monotone" dataKey="revenue" name="Order value" stroke="#F97316" strokeWidth={3} fill="url(#reportArea)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Quote requests by status" description="All quote requests" isEmpty={!inquiryStatus.length} summary={`Quote requests by status: ${inquiryStatus.map((item) => `${item.name} ${item.value}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={inquiryStatus} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip cursor={{ fill: '#F0F4FA' }} />
              <Bar dataKey="value" name="Requests" fill="#102A56" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div>
        <Tabs
          tabs={[
            { id: 'inquiries', label: 'Inquiry monitoring', count: inquiries.length },
            { id: 'orders', label: 'Orders', count: orders.length },
            { id: 'escrow', label: 'Escrow & Payouts', count: escrowLedgers.length },
            { id: 'disputes', label: 'Buyer Disputes', count: disputes.filter((d) => d.status === 'OPEN').length },
            { id: 'tickets', label: 'Support Desk' },
            { id: 'commission', label: 'Platform Commission' },
          ]}
          active={tab}
          onChange={switchTab}
          idPrefix="reports"
        />
        <TabPanel id={tab} idPrefix="reports" className="pt-5">
          {tab === 'tickets' ? <AdminSupportDesk /> : null}
          {tab === 'escrow' ? (
            <div className="space-y-6">
              {/* Escrow Summary Stats */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="ts-card p-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">Total Held in Escrow</span>
                  <p className="mt-2 text-2xl font-black text-blue-700">{money(escrowSummary?.totalHeld || 0)}</p>
                  <p className="mt-1 text-xs text-muted">Protected during inspection window</p>
                </div>
                <div className="ts-card p-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">Payouts Settled</span>
                  <p className="mt-2 text-2xl font-black text-emerald-700">{money(escrowSummary?.totalReleased || 0)}</p>
                  <p className="mt-1 text-xs text-muted">Released to suppliers post-delivery</p>
                </div>
                <div className="ts-card p-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">Platform Commission</span>
                  <p className="mt-2 text-2xl font-black text-brand-600">{money(escrowSummary?.totalCommission || 0)}</p>
                  <p className="mt-1 text-xs text-muted">Retained platform wholesale fee</p>
                </div>
                <div className="ts-card p-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">Total Refunded</span>
                  <p className="mt-2 text-2xl font-black text-amber-700">{money(escrowSummary?.totalRefunded || 0)}</p>
                  <p className="mt-1 text-xs text-muted">Refunded from approved disputes</p>
                </div>
              </div>

              {/* Escrow Ledgers Table */}
              <div className="ts-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <h4 className="font-semibold text-navy-900">Wholesale Order Escrow Ledgers</h4>
                  <Button variant="ghost" size="sm" icon={RefreshCw} onClick={fetchEscrow} loading={escrowLoading}>
                    Refresh
                  </Button>
                </div>

                {escrowLoading ? (
                  <TableSkeleton />
                ) : escrowLedgers.length === 0 ? (
                  <EmptyState icon={ShieldCheck} title="No escrow records found" text="Escrow ledgers will appear automatically as orders are placed and paid." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="ts-table">
                      <thead>
                        <tr>
                          <th scope="col">Order Ref</th>
                          <th scope="col">Buyer</th>
                          <th scope="col">Supplier</th>
                          <th scope="col">Amount Held</th>
                          <th scope="col">Commission Fee</th>
                          <th scope="col">Net Payout</th>
                          <th scope="col">Escrow Status</th>
                          <th scope="col">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {escrowLedgers.map((l) => (
                          <tr key={l.id || l.orderId}>
                            <td>
                              <span className="font-mono font-bold text-navy-900">{l.order?.orderNumber || l.orderId}</span>
                              <span className="block text-xs text-muted">{formatDate(l.createdAt)}</span>
                            </td>
                            <td>
                              <span className="block font-medium text-navy-900">{l.order?.buyerName}</span>
                              <span className="text-xs text-muted">{l.order?.buyerCompany || l.order?.buyerEmail}</span>
                            </td>
                            <td>
                              <span className="font-medium text-navy-900">{l.order?.supplier?.company || l.order?.supplier?.name || 'Verified Supplier'}</span>
                            </td>
                            <td>
                              <span className="font-bold text-navy-900">{money(l.amountHeld)}</span>
                            </td>
                            <td>
                              <span className="text-xs font-semibold text-brand-700">
                                {money(l.commissionFee)} ({l.commissionRate}%)
                              </span>
                            </td>
                            <td>
                              <span className="font-bold text-emerald-700">{money(l.payoutAmount)}</span>
                            </td>
                            <td>
                              <span className={`inline-flex rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                                l.status === 'RELEASED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : l.status === 'FROZEN_DISPUTED'
                                  ? 'bg-red-100 text-red-800'
                                  : l.status === 'REFUNDED'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {l.status}
                              </span>
                            </td>
                            <td>
                              {l.status === 'HELD' ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  icon={CheckCircle2}
                                  loading={releasingPayout === l.orderId}
                                  onClick={() => handleReleasePayout(l.orderId)}
                                >
                                  Release Payout
                                </Button>
                              ) : l.status === 'FROZEN_DISPUTED' ? (
                                <span className="text-xs font-semibold text-red-700">Dispute Active</span>
                              ) : l.status === 'RELEASED' ? (
                                <span className="text-xs font-semibold text-emerald-700">✓ Settled</span>
                              ) : (
                                <span className="text-xs text-muted">Refunded</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : tab === 'disputes' ? (
            <div className="space-y-6">
              <div className="ts-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <div>
                    <h4 className="font-semibold text-navy-900">Buyer Inspection Claims & Disputes</h4>
                    <p className="text-xs text-muted">Mediate unboxing issues, damaged shipments, and quality discrepancies.</p>
                  </div>
                  <Button variant="ghost" size="sm" icon={RefreshCw} onClick={fetchDisputes} loading={disputesLoading}>
                    Refresh
                  </Button>
                </div>

                {disputesLoading ? (
                  <TableSkeleton />
                ) : disputes.length === 0 ? (
                  <EmptyState icon={ShieldAlert} title="No disputes filed" text="No buyer inspection disputes have been raised." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="ts-table">
                      <thead>
                        <tr>
                          <th scope="col">Dispute Ref</th>
                          <th scope="col">Order Ref</th>
                          <th scope="col">Buyer</th>
                          <th scope="col">Claim Reason</th>
                          <th scope="col">Status</th>
                          <th scope="col">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {disputes.map((d) => (
                          <tr key={d.id}>
                            <td>
                              <span className="font-mono text-xs font-bold text-navy-900">{d.id.slice(0, 8)}...</span>
                              <span className="block text-xs text-muted">{formatDate(d.createdAt)}</span>
                            </td>
                            <td>
                              <span className="font-mono font-semibold text-navy-900">{d.order?.orderNumber}</span>
                              <span className="block text-xs text-muted">{money(d.order?.total || 0)}</span>
                            </td>
                            <td>
                              <span className="font-medium text-navy-900">{d.order?.buyerName || d.buyerId}</span>
                              <span className="block text-xs text-muted">{d.order?.buyerCompany}</span>
                            </td>
                            <td>
                              <span className="font-semibold text-slate-800">{d.reason.replace(/_/g, ' ')}</span>
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted">{d.description}</p>
                            </td>
                            <td>
                              <span className={`inline-flex rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                                d.status === 'OPEN'
                                  ? 'bg-amber-100 text-amber-800'
                                  : d.status === 'RESOLVED_REFUND'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}>
                                {d.status}
                              </span>
                            </td>
                            <td>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={Scale}
                                onClick={() => {
                                  setSelectedDispute(d);
                                  setMediationAction('APPROVE_FULL_REFUND');
                                  setMediationNote('');
                                  setPartialRefundAmt(String(d.order?.total || ''));
                                }}
                              >
                                {d.status === 'OPEN' ? 'Mediate Claim' : 'View Decision'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : tab === 'commission' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Global Default Commission Card */}
                <div className="ts-card p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                      <Percent className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-navy-900">Platform Default Commission</h3>
                      <p className="text-xs text-muted">Applied globally to all orders unless overridden by category.</p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label htmlFor="globalRateInput" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                        Commission Rate (%)
                      </label>
                      <div className="relative mt-1">
                        <input
                          id="globalRateInput"
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={globalRate}
                          onChange={(e) => setGlobalRate(e.target.value)}
                          className="ts-input pr-8 text-lg font-bold text-navy-900"
                          placeholder="5.0"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-semibold text-muted">%</span>
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      icon={Save}
                      loading={savingCommission}
                      onClick={handleSaveGlobalRate}
                      className="whitespace-nowrap"
                    >
                      Save Default Rate
                    </Button>
                  </div>
                </div>

                {/* Category Override Card */}
                <div className="ts-card p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-navy-100 text-navy-800">
                      <Percent className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-navy-900">Set Category Override</h3>
                      <p className="text-xs text-muted">Define custom commission percentage for a specific product category.</p>
                    </div>
                  </div>

                  <form onSubmit={handleAddCategoryOverride} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label htmlFor="catSelect" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                        Category
                      </label>
                      <select
                        id="catSelect"
                        value={newCatId}
                        onChange={(e) => setNewCatId(e.target.value)}
                        className="ts-input mt-1"
                      >
                        <option value="">Select category...</option>
                        {categories.map((c) => (
                          <option key={c.id || c.slug} value={c.slug || c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-full sm:w-28">
                      <label htmlFor="catRateInput" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                        Rate (%)
                      </label>
                      <div className="relative mt-1">
                        <input
                          id="catRateInput"
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={newCatRate}
                          onChange={(e) => setNewCatRate(e.target.value)}
                          className="ts-input pr-7 font-bold text-navy-900"
                          placeholder="3.5"
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-semibold text-muted">%</span>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      variant="secondary"
                      loading={savingCommission}
                      className="whitespace-nowrap"
                    >
                      Save Override
                    </Button>
                  </form>
                </div>
              </div>

              {/* Commission Table */}
              <div className="ts-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <h4 className="font-semibold text-navy-900">Active Commission Rules</h4>
                  <Button variant="ghost" size="sm" icon={RefreshCw} onClick={fetchCommissions} loading={commissionLoading}>
                    Refresh
                  </Button>
                </div>

                {commissionLoading ? (
                  <TableSkeleton />
                ) : commissionSettings.length === 0 ? (
                  <EmptyState icon={Percent} title="No commission settings" text="Default platform commission will be created automatically." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="ts-table">
                      <thead>
                        <tr>
                          <th scope="col">Scope</th>
                          <th scope="col">Category / Target</th>
                          <th scope="col">Commission Rate</th>
                          <th scope="col">Status</th>
                          <th scope="col">Last Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissionSettings.map((s) => (
                          <tr key={s.id || `${s.type}-${s.targetId}`}>
                            <td>
                              <span className={`inline-flex rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                                s.type === 'GLOBAL' ? 'bg-orange-100 text-orange-800' : 'bg-navy-100 text-navy-800'
                              }`}>
                                {s.type}
                              </span>
                            </td>
                            <td className="font-medium text-navy-900">
                              {s.type === 'GLOBAL'
                                ? 'All Categories (Platform Default)'
                                : categories.find((c) => c.slug === s.targetId || c.id === s.targetId)?.name || s.targetId}
                            </td>
                            <td>
                              <span className="font-bold text-navy-900">{s.percentage}%</span>
                            </td>
                            <td>
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            </td>
                            <td className="text-xs text-muted">
                              {s.updatedAt ? formatDate(s.updatedAt) : 'Default'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1.6fr_1fr_1fr]">
                <div className="relative">
                  <label htmlFor="ar-search" className="sr-only">Search</label>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                  <input id="ar-search" type="search" className="ts-input pl-9" placeholder={tab === 'inquiries' ? 'Search by ID, product, buyer or supplier' : 'Search by order ID or buyer'} value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <select aria-label="Filter by status" className="ts-input" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">All statuses</option>
                  {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select aria-label="Sort" className="ts-input" value={sort} onChange={(event) => setSort(event.target.value)}>
                  {Object.entries(SORTS).filter(([value]) => tab === 'inquiries' || value !== 'quantity').map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
                </select>
              </div>

              <div className="ts-card overflow-hidden">
                {tab === 'inquiries' ? (
                  inquiriesError ? <ErrorState text={inquiriesError} onRetry={reloadInquiries} /> : inquiriesLoading ? <TableSkeleton /> : inquiryRows.length === 0 ? (
                    <EmptyState icon={FileText} title="No matching quote requests" text="Try a different search or status." action={search || status ? <Button variant="outline" onClick={() => { setSearch(''); setStatus(''); }}>Clear filters</Button> : null} />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="ts-table">
                        <caption className="sr-only">Quote requests</caption>
                        <thead><tr><th scope="col">Request</th><th scope="col">Product</th><th scope="col">Buyer</th><th scope="col">Supplier</th><th scope="col">Quantity</th><th scope="col">Quote</th><th scope="col">Status</th></tr></thead>
                        <tbody>
                          {inquiryRows.map((inquiry) => (
                            <tr key={inquiry.id}>
                              <td><span className="block whitespace-nowrap font-semibold text-navy-900">{inquiry.id}</span><span className="text-xs text-muted">{formatDate(inquiry.createdAt)}</span></td>
                              <td className="min-w-48">{inquiry.productName}</td>
                              <td className="min-w-32">{inquiry.buyerName}</td>
                              <td className="min-w-40">{getCompany(inquiry.companyId)?.name ?? <span className="text-muted">Open request</span>}</td>
                              <td className="whitespace-nowrap">{inquiry.quantity.toLocaleString('en-IN')}</td>
                              <td className="whitespace-nowrap">{inquiry.quote ? money(inquiry.quote.unitPrice) : <span className="text-muted">None</span>}</td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={inquiry.status} />
                                  <select value={inquiry.status} onChange={(event) => { setInquiryStatus(inquiry.id, event.target.value); showToast(`${inquiry.id} marked as ${event.target.value}.`, 'info'); }} aria-label={`Change status of ${inquiry.id}`} className="ts-input !min-h-9 w-36 !py-1 text-sm">
                                    {INQUIRY_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                                  </select>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : ordersError ? <ErrorState text={ordersError} onRetry={reloadOrders} /> : ordersLoading ? <TableSkeleton /> : orderRows.length === 0 ? (
                  <EmptyState icon={FileText} title="No matching orders" text="Try a different search or status." action={search || status ? <Button variant="outline" onClick={() => { setSearch(''); setStatus(''); }}>Clear filters</Button> : null} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="ts-table">
                      <caption className="sr-only">Orders</caption>
                      <thead><tr><th scope="col">Order</th><th scope="col">Buyer</th><th scope="col">Date</th><th scope="col">Total</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                      <tbody>
                        {orderRows.map((order) => (
                          <tr key={order.id}>
                            <td className="whitespace-nowrap font-semibold text-navy-900">{order.id}</td>
                            <td><span className="block min-w-32 font-medium">{order.buyerName}</span><span className="text-xs text-muted">{order.buyerCompany}</span></td>
                            <td className="whitespace-nowrap text-muted">{formatDate(order.createdAt)}</td>
                            <td className="whitespace-nowrap font-semibold">{money(order.totals.total)}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <StatusBadge status={order.status} />
                                <select value={order.status} onChange={(event) => { updateOrderStatus(order.id, event.target.value); showToast(`${order.id} marked as ${event.target.value}.`, 'info'); }} aria-label={`Change status of ${order.id}`} className="ts-input !min-h-9 w-40 !py-1 text-sm">
                                  {ORDER_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                                </select>
                              </div>
                            </td>
                            <td><Button variant="outline" size="sm" icon={Eye} onClick={() => setOpenOrder(order.id)} aria-label={`View order ${order.id}`}>View</Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </TabPanel>
      </div>

      <Modal open={Boolean(selectedOrder)} onClose={() => setOpenOrder(null)} title="Order details" size="lg">
        {selectedOrder ? <OrderDetails order={selectedOrder} /> : null}
      </Modal>

      {/* Dispute Mediation Modal */}
      <Modal
        open={Boolean(selectedDispute)}
        onClose={() => setSelectedDispute(null)}
        title="Mediate Buyer Inspection Dispute"
        description={`Order #${selectedDispute?.order?.orderNumber} · Claim: ${selectedDispute?.reason?.replace(/_/g, ' ')}`}
        size="lg"
      >
        {selectedDispute && (
          <form onSubmit={handleResolveDispute} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-4">
              <div>
                <span className="text-muted block">Order Total</span>
                <strong className="text-navy-900 text-sm">{money(selectedDispute.order?.total || 0)}</strong>
              </div>
              <div>
                <span className="text-muted block">Buyer</span>
                <strong className="text-navy-900 text-sm">{selectedDispute.order?.buyerName || selectedDispute.buyerId}</strong>
              </div>
              <div>
                <span className="text-muted block">Supplier</span>
                <strong className="text-navy-900 text-sm">{selectedDispute.order?.supplier?.company || selectedDispute.order?.supplier?.name || 'Verified Supplier'}</strong>
              </div>
              <div>
                <span className="text-muted block">Current Status</span>
                <strong className="text-navy-900 text-sm uppercase">{selectedDispute.status}</strong>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 text-xs">
              <h5 className="font-bold text-navy-900 uppercase tracking-wider mb-1">Buyer Inspection Claim</h5>
              <p className="text-slate-700 leading-relaxed">{selectedDispute.description}</p>
              {selectedDispute.photoProof && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="font-semibold text-navy-900">Photo Proof:</span>
                  <a
                    href={selectedDispute.photoProof}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-brand-700 underline hover:text-brand-800"
                  >
                    Open Full Image Evidence <ExternalLink className="size-3" />
                  </a>
                </div>
              )}
            </div>

            {selectedDispute.status === 'OPEN' ? (
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                    Mediation Determination
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className={`cursor-pointer rounded-xl border p-3 text-xs transition-colors ${
                      mediationAction === 'APPROVE_FULL_REFUND' ? 'border-brand-600 bg-brand-50/50 font-bold text-brand-900' : 'border-slate-200'
                    }`}>
                      <input
                        type="radio"
                        name="medAction"
                        value="APPROVE_FULL_REFUND"
                        checked={mediationAction === 'APPROVE_FULL_REFUND'}
                        onChange={(e) => setMediationAction(e.target.value)}
                        className="sr-only"
                      />
                      Approve Full Refund
                      <span className="block text-[0.6875rem] font-normal text-muted mt-0.5">Refund 100% escrow to buyer</span>
                    </label>

                    <label className={`cursor-pointer rounded-xl border p-3 text-xs transition-colors ${
                      mediationAction === 'APPROVE_PARTIAL_REFUND' ? 'border-brand-600 bg-brand-50/50 font-bold text-brand-900' : 'border-slate-200'
                    }`}>
                      <input
                        type="radio"
                        name="medAction"
                        value="APPROVE_PARTIAL_REFUND"
                        checked={mediationAction === 'APPROVE_PARTIAL_REFUND'}
                        onChange={(e) => setMediationAction(e.target.value)}
                        className="sr-only"
                      />
                      Approve Partial Refund
                      <span className="block text-[0.6875rem] font-normal text-muted mt-0.5">Custom refund amount, remainder to supplier</span>
                    </label>

                    <label className={`cursor-pointer rounded-xl border p-3 text-xs transition-colors ${
                      mediationAction === 'REJECT' ? 'border-red-600 bg-red-50/50 font-bold text-red-900' : 'border-slate-200'
                    }`}>
                      <input
                        type="radio"
                        name="medAction"
                        value="REJECT"
                        checked={mediationAction === 'REJECT'}
                        onChange={(e) => setMediationAction(e.target.value)}
                        className="sr-only"
                      />
                      Reject Dispute
                      <span className="block text-[0.6875rem] font-normal text-muted mt-0.5">Deny claim, release escrow to supplier</span>
                    </label>
                  </div>
                </div>

                {mediationAction === 'APPROVE_PARTIAL_REFUND' && (
                  <div>
                    <label htmlFor="partialAmt" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                      Refund Amount to Buyer (₹)
                    </label>
                    <input
                      id="partialAmt"
                      type="number"
                      min="1"
                      max={selectedDispute.order?.total || 1000000}
                      value={partialRefundAmt}
                      onChange={(e) => setPartialRefundAmt(e.target.value)}
                      className="ts-input mt-1"
                      required
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="medNote" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                    Mediation Ruling & Explanation
                  </label>
                  <textarea
                    id="medNote"
                    rows={3}
                    required
                    placeholder="Enter ruling rationale for buyer and supplier records..."
                    value={mediationNote}
                    onChange={(e) => setMediationNote(e.target.value)}
                    className="ts-input mt-1 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <Button type="button" variant="outline" onClick={() => setSelectedDispute(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" loading={resolvingDispute}>
                    Record Ruling & Update Escrow
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-800">
                <span className="font-bold">Ruling Recorded: </span>
                {selectedDispute.resolution}
                {selectedDispute.refundAmount > 0 && (
                  <p className="mt-1 font-bold text-emerald-700">Refund Amount: {money(selectedDispute.refundAmount)}</p>
                )}
              </div>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
