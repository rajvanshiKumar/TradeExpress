import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SectionHeading } from '../../components/common/PageHeader';
import ChartCard from '../../components/common/ChartCard';
import StatCard from '../../components/common/StatCard';
import SupplierGuard from './SupplierGuard';
import useOrders from '../../hooks/useOrders';
import useInquiries from '../../hooks/useInquiries';
import useCurrency from '../../hooks/useCurrency';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import formatCurrency, { formatAxisRupees } from '../../utils/formatCurrency';
import { CHART_COLORS, companyOrderValue, countBy, ordersByMonth } from '../../utils/analytics';
import { INQUIRY_STATUSES } from '../../utils/constants';

const shorten = (text, length = 18) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

function Analytics({ company, products }) {
  const { orders } = useOrders();
  const { inquiries } = useInquiries();
  const { money } = useCurrency();

  const myOrders = orders.filter((order) => order.items.some((item) => item.companyId === company.id));
  const monthly = ordersByMonth(myOrders, { amount: (order) => companyOrderValue(order, company.id) });
  const myInquiries = inquiries.filter((inquiry) => inquiry.companyId === company.id);
  const inquiryStatus = countBy(myInquiries, (inquiry) => inquiry.status, INQUIRY_STATUSES);
  const quoted = myInquiries.filter((inquiry) => inquiry.quote).length;

  // Units ordered per product, taken from the orders.
  const unitsByProduct = new Map();
  myOrders.filter((order) => order.status !== 'Cancelled').forEach((order) => order.items.filter((item) => item.companyId === company.id).forEach((item) => unitsByProduct.set(item.name, (unitsByProduct.get(item.name) ?? 0) + item.quantity)));
  const topProducts = [...unitsByProduct.entries()].map(([name, units]) => ({ name: shorten(name), units })).sort((a, b) => b.units - a.units).slice(0, 6);
  const stock = products.map((product) => ({ name: shorten(product.name), stock: product.stock })).sort((a, b) => a.stock - b.stock).slice(0, 8);
  const revenue = monthly.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div className="space-y-6">
      <SectionHeading title="Analytics" description="Charts built from your orders and inquiries." />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Order value, last 6 months" value={money(revenue)} hint="Excludes cancelled orders" />
        <StatCard label="Orders, last 6 months" value={monthly.reduce((sum, item) => sum + item.orders, 0)} hint="Excludes cancelled" />
        <StatCard label="Inquiries received" value={myInquiries.length} hint={`${quoted} quoted`} />
        <StatCard label="Quote rate" value={myInquiries.length ? `${Math.round((quoted / myInquiries.length) * 100)}%` : '—'} hint="Inquiries with a quote" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Order value by month" description="INR" isEmpty={!revenue} summary={`Order value by month: ${monthly.map((item) => `${item.month} ${formatCurrency(item.revenue)}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={formatAxisRupees} />
              <Tooltip formatter={(value) => [formatCurrency(value), 'Order value']} cursor={{ fill: '#F0F4FA' }} />
              <Bar dataKey="revenue" name="Order value" fill="#102A56" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Orders by month" description="Number of orders" isEmpty={!monthly.some((item) => item.orders)} summary={`Orders by month: ${monthly.map((item) => `${item.month} ${item.orders}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="orders" name="Orders" stroke="#F97316" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Inquiries by status" description="All quote requests for your products" isEmpty={!inquiryStatus.length} summary={`Inquiries by status: ${inquiryStatus.map((item) => `${item.name} ${item.value}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={inquiryStatus} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="78%" paddingAngle={3}>
                {inquiryStatus.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Units ordered by product" description="From orders" isEmpty={!topProducts.length} summary={`Units ordered: ${topProducts.map((item) => `${item.name} ${item.units}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProducts} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
              <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip cursor={{ fill: '#F0F4FA' }} />
              <Bar dataKey="units" name="Units" fill="#F97316" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Stock on hand" description="Your eight lowest-stocked products" isEmpty={!stock.length} summary={`Stock on hand: ${stock.map((item) => `${item.name} ${item.stock}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stock} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} interval={0} angle={-18} textAnchor="end" height={56} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip cursor={{ fill: '#F0F4FA' }} />
            <Bar dataKey="stock" name="Units in stock" fill="#214A8C" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export default function SupplierAnalytics() {
  useDocumentTitle('Supplier analytics');
  return <SupplierGuard>{(company, products) => <Analytics company={company} products={products} />}</SupplierGuard>;
}
