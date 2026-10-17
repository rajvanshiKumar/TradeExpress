import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Eye, FileText, Search } from 'lucide-react';
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

const SORTS = {
  newest: { label: 'Newest first', compare: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  oldest: { label: 'Oldest first', compare: (a, b) => new Date(a.createdAt) - new Date(b.createdAt) },
  quantity: { label: 'Largest quantity', compare: (a, b) => b.quantity - a.quantity },
};

export default function AdminReports() {
  const { orders, loading: ordersLoading, error: ordersError, reload: reloadOrders, updateOrderStatus } = useOrders();
  const { inquiries, loading: inquiriesLoading, error: inquiriesError, reload: reloadInquiries, setInquiryStatus } = useInquiries();
  const { getCompany } = useProducts();
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  const [tab, setTab] = useState('inquiries');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [openOrder, setOpenOrder] = useState(null);
  useDocumentTitle('Admin: reports');

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
        <Tabs tabs={[{ id: 'inquiries', label: 'Inquiry monitoring', count: inquiries.length }, { id: 'orders', label: 'Orders', count: orders.length }]} active={tab} onChange={switchTab} idPrefix="reports" />
        <TabPanel id={tab} idPrefix="reports" className="pt-5">
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
        </TabPanel>
      </div>

      <Modal open={Boolean(selectedOrder)} onClose={() => setOpenOrder(null)} title="Order details" size="lg">
        {selectedOrder ? <OrderDetails order={selectedOrder} /> : null}
      </Modal>
    </div>
  );
}
