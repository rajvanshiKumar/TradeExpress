import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Eye, FileText, Percent, RefreshCw, Save, Search } from 'lucide-react';
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

  useEffect(() => {
    if (tab === 'commission') {
      fetchCommissions();
    }
  }, [tab]);

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
            { id: 'commission', label: 'Platform Commission' },
          ]}
          active={tab}
          onChange={switchTab}
          idPrefix="reports"
        />
        <TabPanel id={tab} idPrefix="reports" className="pt-5">
          {tab === 'commission' ? (
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
    </div>
  );
}
