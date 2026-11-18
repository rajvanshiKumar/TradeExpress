import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, Boxes, ChartColumn, ChevronRight, CircleDollarSign, FileText, Package, Percent, RefreshCw, TrendingDown, TrendingUp, Warehouse } from 'lucide-react';
import SupplierGuard from './SupplierGuard';
import { DASH_CARD } from '../../components/supplier/SupplierInsights';
import useOrders from '../../hooks/useOrders';
import useInquiries from '../../hooks/useInquiries';
import useCurrency from '../../hooks/useCurrency';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { companyOrderValue, countBy, ordersByMonth } from '../../utils/analytics';
import { INQUIRY_STATUSES } from '../../utils/constants';
import { compactInr, percentages } from '../../utils/supplierInsights';
import { quantityLabel } from '../../utils/units';

// Inquiry statuses shown in the donut: the standard list plus the outcomes the RFQ flow records
const STATUS_ORDER = [...INQUIRY_STATUSES, 'Accepted', 'Declined'];
// One fixed colour per status (validated: lightness, chroma, colour-blind separation, contrast)
const STATUS_COLORS = { Submitted: '#047857', Viewed: '#3B82F6', Quoted: '#D97706', Negotiating: '#7C3AED', Closed: '#0891B2', Accepted: '#DB2777', Declined: '#65A30D' };
const RANGES = [{ value: 3, label: 'Last 3 Months' }, { value: 6, label: 'Last 6 Months' }, { value: 12, label: 'Last 12 Months' }];
const GREEN = '#047857';
const tick = { fill: '#64748B', fontSize: 12 };

function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function Delta({ value, months }) {
  if (value === null) return <span className="text-[#64748B]">No orders in the previous {months} months</span>;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? 'text-[#047857]' : 'text-rose-600'}`}>
        <Icon className="size-3.5" aria-hidden="true" />{up ? '+' : ''}{value}%
      </span>
      <span className="text-[#64748B]">vs previous {months} months</span>
    </span>
  );
}

/** Tiny trend line / bars inside a KPI card (decorative; the value is the card's number). */
function Spark({ values, kind = 'line', color }) {
  const max = Math.max(...values, 0);
  if (!max) return null;
  const w = 72;
  const h = 32;
  if (kind === 'bars') {
    const bw = w / values.length;
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
        {values.map((v, i) => {
          const bh = Math.max(2, (v / max) * h);
          return <rect key={i} x={i * bw + 1} y={h - bh} width={bw - 3} height={bh} rx="1.5" fill={color} opacity={0.35 + (0.65 * (i + 1)) / values.length} />;
        })}
      </svg>
    );
  }
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - 3 - (v / max) * (h - 6)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Ring({ percent, color }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" className="shrink-0 -rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#EDE9FE" strokeWidth="4" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(percent / 100) * c} ${c}`} />
    </svg>
  );
}

const KPI_TONES = {
  green: 'border-emerald-100 bg-gradient-to-br from-[#ECFDF5] to-white',
  blue: 'border-blue-100 bg-gradient-to-br from-blue-50 to-white',
  amber: 'border-amber-100 bg-gradient-to-br from-amber-50 to-white',
  violet: 'border-violet-100 bg-gradient-to-br from-violet-50 to-white',
};
const ICON_TONES = { green: 'bg-emerald-100/80 text-[#047857]', blue: 'bg-blue-100/80 text-blue-700', amber: 'bg-amber-100/80 text-amber-700', violet: 'bg-violet-100/80 text-violet-700' };

function Kpi({ tone, icon: Icon, label, value, visual, footer }) {
  return (
    <div className={`flex h-full flex-col rounded-[1.25rem] border p-4 shadow-[0_1px_2px_rgba(20,45,36,0.04),0_10px_24px_-18px_rgba(6,78,59,0.25)] sm:p-5 ${KPI_TONES[tone]}`}>
      <div className="flex items-start gap-3">
        <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-2xl ${ICON_TONES[tone]}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.8125rem] font-semibold text-[#142D24]">{label}</p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="break-words font-display text-[1.6rem] font-extrabold leading-tight tracking-[-0.02em] text-[#142D24] sm:text-[1.75rem]">{value}</p>
            {visual}
          </div>
        </div>
      </div>
      <p className="mt-auto pt-2 text-xs">{footer}</p>
    </div>
  );
}

function Panel({ icon: Icon, title, description, action, children, id }) {
  return (
    <section className={`${DASH_CARD} flex min-w-0 flex-col p-5 sm:p-6`} aria-labelledby={id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className="mt-0.5 size-5 shrink-0 text-[#047857]" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id={id} className="text-base font-bold text-[#142D24]">{title}</h2>
            {description ? <p className="mt-0.5 text-[0.8125rem] text-[#64748B]">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

function Empty({ children }) {
  return (
    <div className="flex h-full min-h-[11rem] items-center justify-center rounded-xl border border-dashed border-[#E2E8E5] bg-[#F8FAF8] px-4 text-center text-sm text-[#64748B]">
      {children}
    </div>
  );
}

function ChartTip({ active, payload, format }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl bg-[#064E3B] px-3 py-2 text-xs text-white shadow-lg">
      <p className="text-emerald-100">{p.payload.month}</p>
      <p className="mt-0.5 text-sm font-bold">{format(p.value)}</p>
    </div>
  );
}

/** Horizontal bars as plain HTML (full product names, direct value labels, no overflow). */
function BarList({ rows, max, color, valueLabel, empty }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(8rem,14rem)_minmax(0,1fr)_auto]">
          <span className="min-w-0 text-sm text-[#142D24]" title={row.name}>
            <span className="line-clamp-2 font-medium">{row.name}</span>
            {row.sub ? <span className="block font-mono text-xs text-[#64748B]">{row.sub}</span> : null}
          </span>
          <span className="order-3 col-span-2 h-3 overflow-hidden rounded-full bg-[#EEF2EF] sm:order-none sm:col-span-1" role="img" aria-label={`${row.name}: ${valueLabel(row)}`}>
            <span className="block h-full rounded-full" style={{ width: `${max ? Math.max(row.value > 0 ? 2 : 0, (row.value / max) * 100) : 0}%`, backgroundColor: row.color || color }} />
          </span>
          <span className={`whitespace-nowrap text-right text-sm font-semibold ${row.value <= 0 ? 'text-rose-600' : 'text-[#142D24]'}`}>{valueLabel(row)}</span>
        </li>
      ))}
    </ul>
  );
}

function Analytics({ company, products }) {
  const { orders, reload: reloadOrders, loading: ordersLoading } = useOrders();
  const { inquiries, reload: reloadInquiries, loading: inquiriesLoading } = useInquiries();
  const { money } = useCurrency();
  const [months, setMonths] = useState(6);

  const myOrders = useMemo(() => orders.filter((order) => order.items.some((item) => item.companyId === company.id)), [orders, company.id]);
  const amount = (order) => companyOrderValue(order, company.id);
  // Existing monthly logic (cancelled orders excluded); the earlier half gives the "previous period" comparison
  const both = ordersByMonth(myOrders, { months: months * 2, amount });
  const monthly = both.slice(months);
  const previous = both.slice(0, months);
  const revenue = monthly.reduce((sum, item) => sum + item.revenue, 0);
  const orderCount = monthly.reduce((sum, item) => sum + item.orders, 0);
  const prevRevenue = previous.reduce((sum, item) => sum + item.revenue, 0);
  const prevOrders = previous.reduce((sum, item) => sum + item.orders, 0);

  const myInquiries = inquiries.filter((inquiry) => inquiry.companyId === company.id);
  const inquiryStatus = countBy(myInquiries, (inquiry) => inquiry.status, STATUS_ORDER);
  const statusTotal = inquiryStatus.reduce((s, x) => s + x.value, 0);
  const statusPct = percentages(inquiryStatus.map((x) => x.value));
  const quoted = myInquiries.filter((inquiry) => inquiry.quote).length;
  const quoteRate = myInquiries.length ? Math.round((quoted / myInquiries.length) * 100) : null;

  // Units ordered per product, taken from the orders (cancelled excluded)
  const unitsByProduct = new Map();
  myOrders.filter((order) => order.status !== 'Cancelled').forEach((order) => order.items.filter((item) => item.companyId === company.id).forEach((item) => {
    const row = unitsByProduct.get(item.name) || { units: 0, unit: item.unit };
    row.units += item.quantity;
    unitsByProduct.set(item.name, row);
  }));
  const topProducts = [...unitsByProduct.entries()].map(([name, r]) => ({ key: name, name, value: r.units, unit: r.unit })).sort((a, b) => b.value - a.value).slice(0, 6);
  // Stock on hand: the eight lowest-stocked products (existing selection)
  const stock = products.map((p) => ({ key: p.id, name: p.name, sub: p.sku, value: Number(p.stock) || 0, unit: p.unit })).sort((a, b) => a.value - b.value).slice(0, 8);

  const refreshing = ordersLoading || inquiriesLoading;
  const rangeLabel = `Last ${months} Months`;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div className="space-y-3">
        <nav aria-label="Breadcrumb" className="text-[0.8125rem]">
          <ol className="flex flex-wrap items-center gap-1.5 text-[#64748B]">
            <li><Link to="/supplier" className="font-medium text-[#047857] hover:underline">Supplier Dashboard</Link></li>
            <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
            <li aria-current="page" className="font-semibold text-[#142D24]">Performance Analytics</li>
          </ol>
        </nav>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857] ring-1 ring-emerald-600/10">
              <ChartColumn className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] text-[#142D24] sm:text-[2rem]">Performance Analytics</h1>
              <p className="mt-0.5 text-sm text-[#64748B]">Track your products, orders, sales and buyer enquiries.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Date range"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="h-11 rounded-full border border-[#E2E8E5] bg-white px-4 text-sm font-semibold text-[#142D24] shadow-[0_4px_14px_-10px_rgba(20,45,36,0.35)] focus:border-[#047857] focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            >
              {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button
              type="button"
              onClick={() => { reloadOrders?.(); reloadInquiries?.(); }}
              disabled={refreshing}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[#E2E8E5] bg-white px-5 text-sm font-semibold text-[#142D24] shadow-[0_4px_14px_-10px_rgba(20,45,36,0.35)] transition-colors hover:border-[#047857]/50 hover:text-[#047857] disabled:opacity-60"
            >
              <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Row 1: KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi tone="green" icon={CircleDollarSign} label={`Order Value – ${rangeLabel}`} value={money(revenue)}
          visual={<Spark values={monthly.map((m) => m.revenue)} color={GREEN} />}
          footer={<Delta value={percentChange(revenue, prevRevenue)} months={months} />} />
        <Kpi tone="blue" icon={Boxes} label={`Orders – ${rangeLabel}`} value={orderCount}
          visual={<Spark values={monthly.map((m) => m.orders)} kind="bars" color="#3B82F6" />}
          footer={<Delta value={percentChange(orderCount, prevOrders)} months={months} />} />
        <Kpi tone="amber" icon={FileText} label="Inquiries Received" value={myInquiries.length}
          footer={<span className="text-[#64748B]"><strong className="text-[#142D24]">{quoted}</strong> quoted · all time</span>} />
        <Kpi tone="violet" icon={Percent} label="Quote Rate" value={quoteRate === null ? '—' : `${quoteRate}%`}
          visual={quoteRate === null ? null : <Ring percent={quoteRate} color="#7C3AED" />}
          footer={<span className="text-[#64748B]">Inquiries with a quote</span>} />
      </div>

      {/* Row 2: sales */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel id="order-value" icon={CircleDollarSign} title="Order Value by Month" description={`Total order value (INR), ${rangeLabel.toLowerCase()}`}>
          {!revenue ? <Empty>No order data available for this period.</Empty> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="orderValueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GREEN} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#EEF2EF" />
                  <XAxis dataKey="month" tick={tick} tickLine={false} axisLine={false} />
                  <YAxis tick={tick} tickLine={false} axisLine={false} width={58} tickFormatter={compactInr} />
                  <Tooltip content={<ChartTip format={money} />} cursor={{ stroke: '#A7F3D0' }} />
                  <Area type="monotone" dataKey="revenue" stroke={GREEN} strokeWidth={2} fill="url(#orderValueFill)"
                    dot={{ r: 4, fill: '#fff', stroke: GREEN, strokeWidth: 2 }} activeDot={{ r: 6, fill: GREEN, stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel id="orders-month" icon={Package} title="Orders by Month" description={`Number of orders, ${rangeLabel.toLowerCase()}`}>
          {!orderCount ? <Empty>No orders for this period yet.</Empty> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid vertical={false} stroke="#EEF2EF" />
                  <XAxis dataKey="month" tick={tick} tickLine={false} axisLine={false} />
                  <YAxis tick={tick} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                  <Tooltip content={<ChartTip format={(v) => `${v} order${v === 1 ? '' : 's'}`} />} cursor={{ fill: '#ECFDF5' }} />
                  <Bar dataKey="orders" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      {/* Row 3: buyers & products */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel id="inquiry-status" icon={FileText} title="Inquiries by Status" description="All quote requests for your products">
          {!statusTotal ? <Empty>No inquiries yet. Quote requests for your products appear here.</Empty> : (
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <div className="relative size-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={inquiryStatus} dataKey="value" nameKey="name" innerRadius="72%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                      {inquiryStatus.map((s) => <Cell key={s.name} fill={STATUS_COLORS[s.name] || '#64748B'} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} inquir${v === 1 ? 'y' : 'ies'}`, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-3xl font-extrabold leading-none text-[#142D24]">{statusTotal}</span>
                  <span className="mt-1 text-xs text-[#64748B]">Total Inquiries</span>
                </div>
              </div>
              <ul className="w-full flex-1 space-y-2.5 text-sm">
                {inquiryStatus.map((s, i) => (
                  <li key={s.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[#142D24]">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.name] || '#64748B' }} aria-hidden="true" />
                      {s.name}
                    </span>
                    <span className="whitespace-nowrap"><strong className="text-[#142D24]">{s.value}</strong> <span className="text-[#64748B]">({statusPct[i]}%)</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel id="units-product" icon={Boxes} title="Units Ordered by Product" description="Total units ordered from orders (top 6)">
          <BarList rows={topProducts} max={topProducts[0]?.value || 0} color={GREEN}
            valueLabel={(r) => quantityLabel(r.value, r.unit || 'unit')}
            empty="No units ordered yet. Product order quantities appear here." />
        </Panel>
      </div>

      {/* Row 4: inventory */}
      <Panel id="stock-hand" icon={Warehouse} title="Stock on Hand" description="Your eight lowest-stocked products"
        action={<Link to="/supplier/inventory" className="inline-flex items-center gap-1 whitespace-nowrap text-[0.8125rem] font-semibold text-[#047857] hover:text-[#064E3B]">View Real-Time Inventory<ArrowRight className="size-3.5" aria-hidden="true" /></Link>}>
        <BarList rows={stock} max={Math.max(...stock.map((s) => s.value), 0)} color="#10B981"
          valueLabel={(r) => (r.value <= 0 ? 'Out of stock' : quantityLabel(r.value, r.unit || 'unit'))}
          empty="No products listed yet." />
      </Panel>
    </div>
  );
}

export default function SupplierAnalytics() {
  useDocumentTitle('Performance Analytics');
  return <SupplierGuard>{(company, products) => <Analytics company={company} products={products} />}</SupplierGuard>;
}
