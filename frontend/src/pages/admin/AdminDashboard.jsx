import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Boxes, Building2, CircleDollarSign, FileText, Package, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import ChartCard from '../../components/common/ChartCard';
import { StatusBadge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';
import useAuth from '../../hooks/useAuth';
import useProducts from '../../hooks/useProducts';
import useOrders from '../../hooks/useOrders';
import useInquiries from '../../hooks/useInquiries';
import useCurrency from '../../hooks/useCurrency';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { CHART_COLORS, countBy } from '../../utils/analytics';
import { ORDER_STATUSES } from '../../utils/constants';
import { formatDate } from '../../utils/formatDate';

export default function AdminDashboard() {
  const { accounts } = useAuth();
  const { products, companies, categories, loading } = useProducts();
  const { orders, loading: ordersLoading } = useOrders();
  const { inquiries } = useInquiries();
  const { money } = useCurrency();
  useDocumentTitle('Admin dashboard');

  const buyers = accounts.filter((account) => account.role === 'buyer');
  const suppliers = accounts.filter((account) => account.role === 'supplier');
  const orderValue = orders.filter((order) => order.status !== 'Cancelled').reduce((sum, order) => sum + order.totals.total, 0);
  const byStatus = countBy(orders, (order) => order.status, ORDER_STATUSES);
  const byCategory = categories.map((category) => ({ name: category.name.split(' ')[0], full: category.name, products: products.filter((product) => product.category === category.slug).length })).filter((item) => item.products);

  return (
    <div className="space-y-8">
      <SectionHeading title="Marketplace overview" description="Marketplace activity at a glance." />

      <p className="flex gap-2.5 rounded-xl border border-amber-200 bg-warning-50 p-4 text-sm text-warning">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Prototype admin area: data and role checks live in this browser, with no server-side access control. Do not rely on it to protect real business data.
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Boxes} label="Products" value={loading ? '…' : products.length} hint={`${products.filter((product) => product.status === 'Active').length} active`} to="/admin/products" />
        <StatCard icon={Building2} tone="brand" label="Companies" value={loading ? '…' : companies.length} hint={`${companies.filter((company) => company.status === 'Suspended').length} suspended`} to="/admin/companies" />
        <StatCard icon={Users} tone="success" label="Users" value={buyers.length + suppliers.length} hint={`${buyers.length} buyers · ${suppliers.length} suppliers`} to="/admin/users" />
        <StatCard icon={Package} label="Orders" value={ordersLoading ? '…' : orders.length} hint={`${orders.filter((order) => order.status === 'Pending').length} pending`} to="/admin/reports" />
        <StatCard icon={CircleDollarSign} tone="success" label="Order value" value={money(orderValue)} hint="Excludes cancelled orders" to="/admin/reports" />
        <StatCard icon={ShieldCheck} tone="brand" label="Verification pending" value={companies.filter((company) => company.verification?.status === 'under-review').length} hint="Supplier document reviews" to="/admin/verification" />
        <StatCard icon={FileText} tone="warning" label="Quote requests" value={inquiries.length} hint={`${inquiries.filter((inquiry) => !inquiry.quote).length} without a quote`} to="/admin/reports" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Products by category" description="Listings in the catalogue" isEmpty={!byCategory.length} summary={`Products by category: ${byCategory.map((item) => `${item.full} ${item.products}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCategory} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} interval={0} angle={-25} textAnchor="end" height={54} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip cursor={{ fill: '#F0F4FA' }} labelFormatter={(label, payload) => payload?.[0]?.payload?.full ?? label} />
              <Bar dataKey="products" name="Products" fill="#102A56" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Orders by status" description="All orders" isEmpty={!byStatus.length} summary={`Orders by status: ${byStatus.map((item) => `${item.name} ${item.value}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="78%" paddingAngle={3}>
                {byStatus.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="ts-card overflow-hidden" aria-labelledby="admin-latest-orders">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 id="admin-latest-orders" className="text-base font-bold">Latest orders</h2>
          <Link to="/admin/reports" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Open reports</Link>
        </div>
        {ordersLoading ? <TableSkeleton rows={4} /> : (
          <div className="overflow-x-auto">
            <table className="ts-table">
              <thead><tr><th scope="col">Order</th><th scope="col">Buyer</th><th scope="col">Date</th><th scope="col">Total</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {orders.slice(0, 5).map((order) => (
                  <tr key={order.id}>
                    <td className="whitespace-nowrap font-semibold text-navy-900">{order.id}</td>
                    <td className="min-w-36">{order.buyerName}</td>
                    <td className="whitespace-nowrap text-muted">{formatDate(order.createdAt)}</td>
                    <td className="whitespace-nowrap font-semibold">{money(order.totals.total)}</td>
                    <td><StatusBadge status={order.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
