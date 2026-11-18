import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, Boxes, ChartColumn, Award, FileText, Package } from 'lucide-react';
import { compactInr, percentages, rfqStatusSummary, trendForRange } from '../../utils/supplierInsights';
import { quantityLabel } from '../../utils/units';

// Shared card look for the Supplier Dashboard (soft border + shadow, TradeExpress greens)
export const DASH_CARD = 'rounded-[1.25rem] border border-[#E2E8E5] bg-white shadow-[0_1px_2px_rgba(20,45,36,0.04),0_10px_28px_-18px_rgba(6,78,59,0.22)]';

const GREEN = '#047857';
// RFQ status hues (validated: lightness band, chroma, colour-blind separation, contrast on white)
const RFQ_COLORS = { open: '#047857', responded: '#3B82F6', closed: '#D97706' };
const RANGES = [{ value: 7, label: 'Last 7 Days' }, { value: 30, label: 'Last 30 Days' }, { value: 90, label: 'Last 90 Days' }];

function CardHeader({ icon: Icon, title, id, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2.5 text-base font-bold text-[#142D24]">
        <Icon className="size-5 text-[#047857]" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function ViewLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 whitespace-nowrap text-[0.8125rem] font-semibold text-[#047857] hover:text-[#064E3B]">
      {children}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  );
}

function TrendTooltip({ active, payload, metric, money }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const range = p.endDate && p.endDate !== p.date ? `Week of ${p.label}` : p.label;
  return (
    <div className="rounded-xl border border-[#E2E8E5] bg-white px-3 py-2 text-xs shadow-[0_10px_24px_-12px_rgba(20,45,36,0.35)]">
      <p className="font-semibold text-[#142D24]">{range}</p>
      <p className="mt-0.5 text-[#64748B]">
        {metric === 'sales' ? <>Confirmed sales <strong className="text-[#142D24]">{money(p.sales)}</strong></> : <>Orders <strong className="text-[#142D24]">{p.orders}</strong></>}
      </p>
    </div>
  );
}

/** Sales or orders over time — one measure at a time on a single axis (no dual-axis chart). */
function SalesTrendCard({ daily, money }) {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState('sales');
  const points = useMemo(() => trendForRange(daily, days), [daily, days]);
  const totalSales = points.reduce((s, p) => s + p.sales, 0);
  const totalOrders = points.reduce((s, p) => s + p.orders, 0);
  const empty = totalOrders === 0 && totalSales === 0;
  const tick = { fill: '#64748B', fontSize: 11 };

  return (
    <section className={`${DASH_CARD} flex flex-col p-5 sm:p-6`} aria-labelledby="sales-trends">
      <CardHeader icon={Boxes} title="Sales & Order Trends" id="sales-trends">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Measure" className="inline-flex rounded-full border border-[#E2E8E5] bg-[#F8FAF8] p-0.5">
            {[['sales', 'Sales (₹)'], ['orders', 'Orders']].map(([id, label]) => (
              <button key={id} type="button" aria-pressed={metric === id} onClick={() => setMetric(id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${metric === id ? 'bg-[#064E3B] text-white' : 'text-[#142D24] hover:text-[#047857]'}`}>
                {label}
              </button>
            ))}
          </div>
          <select
            aria-label="Date range"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-8 rounded-lg border border-[#E2E8E5] bg-white px-2.5 text-xs font-semibold text-[#142D24] focus:border-[#047857] focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          >
            {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </CardHeader>

      <p className="mt-3 text-[0.8125rem] text-[#64748B]">
        <strong className="text-[#142D24]">{money(totalSales)}</strong> confirmed sales · <strong className="text-[#142D24]">{totalOrders}</strong> order{totalOrders === 1 ? '' : 's'} in this period
      </p>

      <div className="relative mt-3 h-56 sm:h-60">
        {empty ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[#E2E8E5] bg-[#F8FAF8] px-4 text-center text-sm text-[#64748B]">
            No orders in this period yet. Sales and orders appear here as buyers purchase your products.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {metric === 'sales' ? (
              <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GREEN} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#EEF2EF" />
                <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} minTickGap={18} />
                <YAxis tick={tick} tickLine={false} axisLine={false} width={56} tickFormatter={compactInr} allowDecimals={false} />
                <Tooltip content={<TrendTooltip metric="sales" money={money} />} cursor={{ stroke: '#A7F3D0', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="sales" stroke={GREEN} strokeWidth={2} fill="url(#salesFill)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: GREEN }} />
              </AreaChart>
            ) : (
              <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="#EEF2EF" />
                <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} minTickGap={18} />
                <YAxis tick={tick} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                <Tooltip content={<TrendTooltip metric="orders" money={money} />} cursor={{ fill: '#ECFDF5' }} />
                <Bar dataKey="orders" fill="#34D399" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function RfqStatusCard({ inquiries }) {
  const s = rfqStatusSummary(inquiries);
  const rows = [
    { key: 'open', label: 'Open', value: s.open },
    { key: 'responded', label: 'Responded', value: s.responded },
    { key: 'closed', label: 'Closed', value: s.closed },
  ];
  const pct = percentages(rows.map((r) => r.value));
  const pieData = s.total ? rows.filter((r) => r.value > 0) : [{ key: 'none', label: 'None', value: 1 }];

  return (
    <section className={`${DASH_CARD} flex flex-col p-5 sm:p-6`} aria-labelledby="rfq-status">
      <CardHeader icon={FileText} title="RFQ Status Overview" id="rfq-status">
        <ViewLink to="/supplier/inquiries">View RFQs</ViewLink>
      </CardHeader>
      <div className="mt-4 flex flex-1 flex-col items-center gap-5 sm:flex-row sm:justify-center xl:flex-col 2xl:flex-row">
        <div className="relative size-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="label" innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270}
                stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                {pieData.map((d) => <Cell key={d.key} fill={RFQ_COLORS[d.key] || '#E2E8E5'} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-extrabold leading-none text-[#142D24]">{s.total}</span>
            <span className="mt-1 text-xs text-[#64748B]">Total RFQs</span>
          </div>
        </div>
        <ul className="w-full max-w-[15rem] space-y-3 text-sm">
          {rows.map((r, i) => (
            <li key={r.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[#142D24]">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: RFQ_COLORS[r.key] }} aria-hidden="true" />
                {r.label}
              </span>
              <span className="whitespace-nowrap text-[#142D24]"><strong>{r.value}</strong> <span className="text-[#64748B]">({pct[i]}%)</span></span>
            </li>
          ))}
        </ul>
      </div>
      {!s.total ? <p className="mt-3 text-center text-xs text-[#64748B]">No buyer RFQs yet.</p> : null}
    </section>
  );
}

function TopProductsCard({ products, inquiries, money }) {
  const rfqsByProduct = useMemo(() => {
    const m = new Map();
    for (const i of inquiries) if (i.productId) m.set(i.productId, (m.get(i.productId) || 0) + 1);
    return m;
  }, [inquiries]);

  return (
    <section className={`${DASH_CARD} flex flex-col p-5 sm:p-6`} aria-labelledby="top-products">
      <CardHeader icon={Award} title="Top Performing Products" id="top-products">
        <ViewLink to="/supplier/products">View All</ViewLink>
      </CardHeader>
      {products.length === 0 ? (
        <div className="mt-4 flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#E2E8E5] bg-[#F8FAF8] px-4 py-8 text-center text-sm text-[#64748B]">
          No product sales yet. Your best-selling products will be listed here.
        </div>
      ) : (
        <div className="ts-slim-scrollbar -mx-5 mt-4 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <thead className="bg-[#F8FAF8] text-xs font-semibold text-[#142D24]">
              <tr>
                <th scope="col" className="px-5 py-2.5 sm:px-6">Product</th>
                <th scope="col" className="px-3 py-2.5 text-center">RFQs</th>
                <th scope="col" className="px-3 py-2.5 text-center">Orders</th>
                <th scope="col" className="px-5 py-2.5 text-right sm:px-6">Sales (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8E5]">
              {products.map((p) => (
                <tr key={p.productId}>
                  <td className="px-5 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                      {p.photo ? (
                        <img src={p.photo.startsWith('http') || p.photo.startsWith('/') ? p.photo : `https://images.unsplash.com/${p.photo}?auto=format&fit=crop&w=80&q=80`} alt="" loading="lazy" className="size-10 shrink-0 rounded-lg border border-[#E2E8E5] object-cover" />
                      ) : (
                        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#047857]"><Package className="size-5" aria-hidden="true" /></span>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold leading-snug text-[#142D24]">{p.name}</p>
                        <p className="text-xs text-[#64748B]">{p.sku ? <span className="font-mono">{p.sku}</span> : null}{p.sku ? ' · ' : ''}{quantityLabel(p.units, p.unit || 'unit')} sold</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center font-semibold text-[#047857]">{rfqsByProduct.get(p.productId) || 0}</td>
                  <td className="px-3 py-3 text-center font-semibold text-[#142D24]">{p.orders}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right font-bold text-[#142D24] sm:px-6">{money(p.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function InventoryHealthCard({ health }) {
  const rows = [
    { key: 'in', label: 'In Stock', value: health?.inStock ?? 0, bar: 'bg-emerald-600', dot: 'bg-emerald-600' },
    { key: 'low', label: 'Low Stock', value: health?.lowStock ?? 0, bar: 'bg-amber-400', dot: 'bg-amber-400' },
    { key: 'out', label: 'Out of Stock', value: health?.outOfStock ?? 0, bar: 'bg-rose-500', dot: 'bg-rose-500' },
  ];
  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <section className={`${DASH_CARD} flex flex-col p-5 sm:p-6`} aria-labelledby="inventory-health">
      <CardHeader icon={ChartColumn} title="Inventory Health" id="inventory-health">
        <ViewLink to="/supplier/inventory">View Inventory</ViewLink>
      </CardHeader>
      {health === null ? (
        <p className="mt-5 text-sm text-[#64748B]" role="status">Loading stock levels…</p>
      ) : (
        <>
          <div className="mt-5 flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-[#EEF2EF]" role="img"
            aria-label={rows.map((r) => `${r.label}: ${r.value}`).join(', ')}>
            {total ? rows.filter((r) => r.value > 0).map((r) => (
              <span key={r.key} className={`h-full ${r.bar}`} style={{ width: `${(r.value / total) * 100}%` }} />
            )) : null}
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
            {rows.map((r) => (
              <li key={r.key} className="flex items-start gap-2">
                <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${r.dot}`} aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold text-[#142D24]">{r.label}</span>
                  <span className="block text-xs text-[#64748B]">{r.value} Product{r.value === 1 ? '' : 's'}</span>
                </span>
              </li>
            ))}
          </ul>
          {!total ? <p className="mt-3 text-xs text-[#64748B]">No products listed yet.</p> : null}
        </>
      )}
    </section>
  );
}

/** Lower dashboard panels: trends, RFQ status, top products and inventory health (all from real data). */
export default function SupplierInsights({ dailyTrend, topProducts, inquiries, inventoryHealth, money }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <SalesTrendCard daily={dailyTrend} money={money} />
        <RfqStatusCard inquiries={inquiries} />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <TopProductsCard products={topProducts} inquiries={inquiries} money={money} />
        <InventoryHealthCard health={inventoryHealth} />
      </div>
    </div>
  );
}
