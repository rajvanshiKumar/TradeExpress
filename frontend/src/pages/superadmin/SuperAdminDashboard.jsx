import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, Boxes, Building2, CheckCircle2, CircleDollarSign, Database, Download, FileText,
  Gauge, Landmark, Layers, PackageCheck, RefreshCw, ShieldCheck, ShoppingBag, Truck, UserX, Users, Wallet, Zap,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import DatePicker from '../../components/common/DatePicker';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatDateTime } from '../../utils/formatDate';
import { compactInr } from '../../utils/supplierInsights';

/* Every figure comes from GET /api/super-admin/dashboard (database). Definitions match adminDashboardService. */

const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const num = (v) => Number(v || 0).toLocaleString('en-IN');
const CARD = 'rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-18px_rgba(6,78,59,0.25)]';
const RANGES = [['7d', '7D'], ['30d', '30D'], ['90d', '90D'], ['custom', 'Custom']];
// Order stages: one fixed colour each (validated palette: lightness, chroma, colour-blind separation, contrast)
const STAGES = [
  ['awaitingFulfilment', 'Awaiting fulfilment', '#047857'], ['processing', 'Processing', '#3B82F6'], ['shipped', 'Shipped', '#D97706'],
  ['delivered', 'Delivered', '#7C3AED'], ['cancelled', 'Cancelled', '#0891B2'], ['refunded', 'Refunded', '#DB2777'],
];

function Change({ value, invert = false }) {
  if (value === null || value === undefined) return <span className="text-[11px] text-slate-400">No earlier data to compare</span>;
  const up = value >= 0;
  const good = invert ? !up : up;
  return <span className={`text-[11px] font-semibold ${good ? 'text-emerald-600' : 'text-rose-600'}`}>{up ? '▲' : '▼'} {Math.abs(value)}% <span className="font-normal text-slate-400">vs previous period</span></span>;
}


function Kpi({ to, icon: Icon, title, value, sub, change, featured = false }) {
  return (
    <Link to={to} className={`group relative flex h-full flex-col overflow-hidden rounded-2xl p-5 transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
      featured ? 'bg-gradient-to-br from-[#0F4D2E] via-[#0B3D24] to-[#072A19] text-white shadow-[0_14px_30px_-16px_rgba(6,78,59,0.7)]' : `${CARD} hover:shadow-lift`}`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex size-10 items-center justify-center rounded-xl ${featured ? 'bg-white/10 text-emerald-200' : 'bg-emerald-50 text-emerald-700'}`}><Icon className="size-5" aria-hidden="true" /></span>
        <ArrowRight className={`size-4 transition-transform group-hover:translate-x-0.5 ${featured ? 'text-emerald-200' : 'text-slate-300'}`} aria-hidden="true" />
      </div>
      <p className={`mt-3 flex items-center gap-1.5 text-[13px] font-semibold ${featured ? 'text-emerald-100' : 'text-slate-600'}`}>{title}</p>
      <p className="mt-1 font-display text-[1.65rem] font-extrabold leading-tight tracking-tight">{value}</p>
      <p className={`mt-1 text-xs ${featured ? 'text-emerald-100/80' : 'text-slate-500'}`}>{sub}</p>
      {change !== undefined ? <div className={`mt-auto pt-2 ${featured ? '[&_span]:!text-emerald-100' : ''}`}><Change value={change} /></div> : null}
    </Link>
  );
}

function Stat({ to, icon: Icon, title, value, sub, tone = 'emerald' }) {
  const tones = { emerald: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-600', violet: 'bg-violet-50 text-violet-700', slate: 'bg-slate-100 text-slate-700' };
  return (
    <Link to={to} className={`${CARD} flex h-full min-w-0 flex-col p-4 transition-shadow hover:shadow-lift`}>
      {/* Icon and title on one line, then the number, then the details: readable even in narrow columns */}
      <span className="flex min-w-0 items-center gap-2">
        <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="size-4" aria-hidden="true" /></span>
        <span className="truncate text-xs font-semibold text-slate-600">{title}</span>
      </span>
      <span className="mt-2.5 block font-display text-2xl font-extrabold leading-none text-slate-900">{value}</span>
      <span className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-slate-500">{sub}</span>
    </Link>
  );
}

function Panel({ icon: Icon, title, subtitle, action, children, className = '' }) {
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <Icon className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <div className="min-w-0"><h2 className="text-[15px] font-bold text-slate-900">{title}</h2>{subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}</div>
        </div>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

const ViewLink = ({ to, children }) => <Link to={to} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-emerald-700 hover:text-emerald-900">{children}<ArrowRight className="size-3.5" aria-hidden="true" /></Link>;
const Row = ({ label, value, strong }) => <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-[13px] last:border-0"><span className="text-slate-600">{label}</span><span className={`font-semibold ${strong ? 'text-slate-900' : 'text-slate-800'}`}>{value}</span></div>;

function Skeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className={`${CARD} h-40 animate-pulse bg-slate-50`} />)}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">{[...Array(6)].map((_, i) => <div key={i} className={`${CARD} h-24 animate-pulse bg-slate-50`} />)}</div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3"><div className={`${CARD} h-80 animate-pulse bg-slate-50 xl:col-span-2`} /><div className={`${CARD} h-80 animate-pulse bg-slate-50`} /></div>
    </div>
  );
}

function exportCsv(d) {
  const rows = [
    ['Metric', 'Value'],
    ['Period', `${d.range.start.slice(0, 10)} to ${new Date(new Date(d.range.end).getTime() - 1).toISOString().slice(0, 10)}`],
    ['Paid order value (orders placed in period)', d.finance.paidOrderValue], ['Commission earned (released in period)', d.finance.commissionEarned],
    ['Funds released to suppliers (period)', d.finance.fundsReleased], ['Escrow held now', d.finance.escrowHeld], ['Pending payouts', d.finance.pendingPayouts],
    ['Orders placed (period)', d.period.current.orders], ['Completed', d.period.current.completed], ['Cancelled', d.period.current.cancelled], ['Refunded', d.period.current.refunded],
    ['Registered users', d.users.total], ['Buyers', d.users.buyers], ['Suppliers', d.users.suppliers], ['Verified suppliers', d.users.verifiedSuppliers],
    ['Products listed', d.products.total], ['Active products', d.products.active], ['Pending moderation', d.products.pendingModeration], ['Archived (deleted)', d.products.archived],
    ['Generated at', d.generatedAt],
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `tradeexpress-command-center-${d.generatedAt.slice(0, 10)}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function SuperAdminDashboard() {
  useDocumentTitle('Platform Command Center');
  const [range, setRange] = useState('30d');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastOk, setLastOk] = useState(null);
  const [metric, setMetric] = useState('paidOrderValue');
  const request = useRef(0);

  const params = useMemo(() => (range === 'custom' ? (custom.from && custom.to ? { range, from: custom.from, to: custom.to } : null) : { range }), [range, custom]);

  const load = useCallback(async () => {
    if (!params) return;
    const id = ++request.current;
    setLoading(true);
    setError('');
    try {
      const res = await superAdminApi.getDashboard(params);
      if (id !== request.current) return; // a newer request replaced this one
      setData(res);
      setLastOk(new Date());
    } catch (err) {
      if (id !== request.current) return;
      setError(err.message || 'The dashboard could not be loaded.');
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [params]);
  useEffect(() => { load(); }, [load]);

  const d = data;
  const live = Boolean(lastOk) && !error;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-800 text-white shadow-sm"><Gauge className="size-5" aria-hidden="true" /></span>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">Platform Command Center</h1>
            <p className="text-sm text-slate-500">Marketplace performance, money in escrow and the work waiting for you.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs ${live ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`} role="status">
            <Database className="size-3.5" aria-hidden="true" />
            <span className={`size-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
            {live ? 'Database connected' : error ? 'Data unavailable' : 'Connecting…'}
            {lastOk ? <span className="text-slate-500">· {formatDateTime(lastOk)}</span> : null}
          </span>
          <div role="group" aria-label="Date range" className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 shadow-2xs">
            {RANGES.map(([v, l]) => (
              <button key={v} type="button" aria-pressed={range === v} onClick={() => setRange(v)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${range === v ? 'bg-emerald-800 text-white' : 'text-slate-600 hover:text-slate-900'}`}>{l}</button>
            ))}
          </div>
          <button type="button" onClick={load} disabled={loading || !params} aria-label="Refresh dashboard"
            className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-2xs hover:text-emerald-700 disabled:opacity-60">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => d && exportCsv(d)} disabled={!d}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-800 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-900 disabled:opacity-50">
            <Download className="size-3.5" aria-hidden="true" /> Export report
          </button>
        </div>
      </div>

      {range === 'custom' ? (
        <div className={`${CARD} flex flex-wrap items-end gap-3 p-3`}>
          <div className="w-44"><span className="mb-1 block text-xs font-semibold text-slate-600">From</span><DatePicker id="cc-from" value={custom.from} max={custom.to || undefined} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} /></div>
          <div className="w-44"><span className="mb-1 block text-xs font-semibold text-slate-600">To</span><DatePicker id="cc-to" value={custom.to} min={custom.from || undefined} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} /></div>
          {!params ? <p className="pb-2 text-xs text-slate-500">Choose both dates to load the period.</p> : null}
        </div>
      ) : null}

      {error && !d ? (
        <div className={`${CARD} flex flex-col items-center gap-3 p-10 text-center`} role="alert">
          <AlertTriangle className="size-8 text-amber-600" aria-hidden="true" />
          <p className="font-semibold text-slate-900">The dashboard could not be loaded</p>
          <p className="text-sm text-slate-500">{error}</p>
          <button type="button" onClick={load} className="rounded-full bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">Try again</button>
        </div>
      ) : !d ? <Skeleton /> : (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-70' : ''}`}>
          {error ? <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800" role="alert">Refresh failed: {error}. Showing the last loaded figures.</p> : null}

          {/* Financial KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi featured to="/super-admin/payments" icon={CircleDollarSign} title="Paid order value" value={inr(d.finance.paidOrderValue)}
              sub={`Orders placed and paid in the last ${d.range.days} days`} change={d.period.change.paidOrderValue} />
            <Kpi to="/super-admin/payments" icon={ShieldCheck} title="Escrow balance held" value={inr(d.finance.escrowHeld)}
              sub={`${num(d.finance.escrowHeldCount)} escrow entries held right now`} />
            <Kpi to="/super-admin/reports" icon={Layers} title="Commission earned" value={inr(d.finance.commissionEarned)}
              sub={`Released in period · ${inr(d.finance.commissionAllTime)} all time`} change={d.period.change.commissionEarned} />
            <Kpi to="/super-admin/orders" icon={ShoppingBag} title="B2B orders" value={num(d.period.current.orders)}
              sub={`${num(d.orders.active)} in fulfilment now · ${num(d.orders.total)} all time`} change={d.period.change.orders} />
          </div>

          {/* Marketplace statistics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
            <Stat to="/super-admin/users" icon={Users} title="Registered users" value={num(d.users.total)} sub={`${num(d.users.buyers)} buyers · ${num(d.users.suppliers)} suppliers`} />
            <Stat to="/super-admin/suppliers" icon={ShieldCheck} title="Verified suppliers" value={num(d.users.verifiedSuppliers)} sub={`of ${num(d.users.suppliers)} suppliers · ${num(d.users.pendingKyc)} KYC pending`} tone="blue" />
            <Stat to="/super-admin/products" icon={Boxes} title="Products listed" value={num(d.products.total)} sub={`${num(d.products.active)} active · ${num(d.products.pendingModeration)} pending · ${num(d.products.archived)} archived`} tone="violet" />
            <Stat to="/super-admin/categories" icon={Layers} title="Categories" value={num(d.categories)} sub="Product categories" tone="slate" />
            <Stat to="/super-admin/rfqs" icon={FileText} title="RFQs & quotations" value={num(d.rfqs.total)} sub={`${num(d.rfqs.open)} open RFQs · ${num(d.rfqs.quotations)} quotations`} tone="amber" />
            <Stat to="/super-admin/transport" icon={Truck} title="Transport approvals" value={num(d.logistics.unverifiedVehicles + d.logistics.pendingTransporters)} sub={`${num(d.logistics.unverifiedVehicles)} vehicles · ${num(d.logistics.pendingTransporters)} transporters`} tone={d.logistics.unverifiedVehicles + d.logistics.pendingTransporters ? 'amber' : 'emerald'} />
          </div>

          {/* Trends + action center */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Panel className="xl:col-span-2" icon={BarChart3} title="Revenue & order trends" subtitle={`Daily, last ${d.range.days} days (India time)`}
              action={(
                <div role="group" aria-label="Measure" className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5">
                  {[['paidOrderValue', 'Paid value'], ['orders', 'Orders'], ['commissionEarned', 'Commission']].map(([v, l]) => (
                    <button key={v} type="button" aria-pressed={metric === v} onClick={() => setMetric(v)} className={`rounded-full px-3 py-1 text-xs font-semibold ${metric === v ? 'bg-emerald-800 text-white' : 'text-slate-600'}`}>{l}</button>
                  ))}
                </div>
              )}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_12rem]">
                <div className="h-64">
                  {d.trend.every((t) => !t[metric]) ? (
                    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">No {metric === 'orders' ? 'orders' : metric === 'commissionEarned' ? 'released commission' : 'paid orders'} in this period.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      {metric === 'orders' ? (
                        <BarChart data={d.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="#EEF2EF" />
                          <XAxis dataKey="date" tickFormatter={(v) => v.slice(5).split('-').reverse().join('/')} tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} minTickGap={16} />
                          <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                          <Tooltip formatter={(v) => [num(v), 'Orders']} labelFormatter={(l) => l} cursor={{ fill: '#ECFDF5' }} />
                          <Bar dataKey="orders" fill="#047857" radius={[4, 4, 0, 0]} maxBarSize={18} />
                        </BarChart>
                      ) : (
                        <AreaChart data={d.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <defs><linearGradient id="ccFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#047857" stopOpacity={0.2} /><stop offset="100%" stopColor="#047857" stopOpacity={0} /></linearGradient></defs>
                          <CartesianGrid vertical={false} stroke="#EEF2EF" />
                          <XAxis dataKey="date" tickFormatter={(v) => v.slice(5).split('-').reverse().join('/')} tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} minTickGap={16} />
                          <YAxis width={56} tickFormatter={compactInr} tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                          <Tooltip formatter={(v) => [inr(v), metric === 'commissionEarned' ? 'Commission' : 'Paid value']} labelFormatter={(l) => l} />
                          <Area type="monotone" dataKey={metric} stroke="#047857" strokeWidth={2} fill="url(#ccFill)" />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl bg-emerald-50/70 p-3"><p className="text-xs text-slate-600">Paid order value</p><p className="text-lg font-extrabold text-slate-900">{inr(d.period.current.paidOrderValue)}</p><Change value={d.period.change.paidOrderValue} /></div>
                  <div className="rounded-xl bg-emerald-50/70 p-3"><p className="text-xs text-slate-600">Orders placed</p><p className="text-lg font-extrabold text-slate-900">{num(d.period.current.orders)}</p><Change value={d.period.change.orders} /></div>
                  <div className="rounded-xl bg-emerald-50/70 p-3"><p className="text-xs text-slate-600">Commission earned</p><p className="text-lg font-extrabold text-slate-900">{inr(d.period.current.commissionEarned)}</p><Change value={d.period.change.commissionEarned} /></div>
                </div>
              </div>
            </Panel>

            <Panel icon={Zap} title="Action center" subtitle="Work waiting for an administrator">
              <ul className="space-y-1.5">
                {[
                  ['Supplier KYC approvals', d.actions.pendingKyc, '/super-admin/suppliers', ShieldCheck, 'amber'],
                  ['Product moderation', d.actions.pendingProductModeration, '/super-admin/products', PackageCheck, 'amber'],
                  ['Account deletion requests', d.actions.deletionRequests, '/super-admin/deletion-requests', UserX, 'amber'],
                  ['Transport approvals', d.actions.unverifiedVehicles + d.actions.pendingTransporters, '/super-admin/transport', Truck, 'amber'],
                  ['Delayed shipments', d.actions.delayedShipments, '/super-admin/transport', AlertTriangle, 'red'],
                ].map(([label, count, to, Icon, tone]) => (
                  <li key={label}>
                    <Link to={to} className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-slate-50">
                      <Icon className={`size-4 ${count ? (tone === 'red' ? 'text-rose-600' : 'text-amber-600') : 'text-slate-400'}`} aria-hidden="true" />
                      <span className="flex-1 text-[13px] text-slate-800">{label}</span>
                      <span className={`min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-bold ${count ? (tone === 'red' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800') : 'bg-slate-100 text-slate-500'}`}>{num(count)}</span>
                      <ArrowRight className="size-3.5 text-slate-300" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              {!Object.values(d.actions).some(Boolean) ? <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 className="size-4" aria-hidden="true" /> Nothing waiting right now.</p> : null}
            </Panel>
          </div>

          {/* Orders & logistics + finance + performance */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <Panel icon={Truck} title="Orders & logistics" subtitle="All orders by stage, today" action={<ViewLink to="/super-admin/orders">View orders</ViewLink>}>
              {d.orders.total === 0 ? <p className="py-8 text-center text-sm text-slate-500">No orders yet.</p> : (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="relative size-36 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={STAGES.map(([k, l]) => ({ name: l, value: d.orders[k] })).filter((x) => x.value)} dataKey="value" innerRadius="70%" outerRadius="100%" stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                          {STAGES.filter(([k]) => d.orders[k]).map(([k, , c]) => <Cell key={k} fill={c} />)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [num(v), n]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-extrabold text-slate-900">{num(d.orders.total)}</span><span className="text-[11px] text-slate-500">orders</span></div>
                  </div>
                  <ul className="w-full space-y-1 text-[13px]">
                    {STAGES.map(([k, l, c]) => <li key={k} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-slate-700"><span className="size-2.5 rounded-full" style={{ backgroundColor: c }} aria-hidden="true" />{l}</span><span className="font-semibold text-slate-900">{num(d.orders[k])}</span></li>)}
                  </ul>
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[12px]">
                <span className="text-slate-600">Active shipments <b className="text-slate-900">{num(d.logistics.activeShipments)}</b></span>
                <span className="text-slate-600">Delayed <b className={d.logistics.delayedShipments ? 'text-rose-600' : 'text-slate-900'}>{num(d.logistics.delayedShipments)}</b></span>
                <span className="text-slate-600">Driver assigned <b className="text-slate-900">{num(d.logistics.withDriver)}</b></span>
                <span className="text-slate-600">Live GPS <b className="text-slate-900">{num(d.logistics.liveTracked)}</b></span>
              </div>
            </Panel>

            <Panel icon={Landmark} title="Escrow & settlement" subtitle="Money held, released and owed" action={<ViewLink to="/super-admin/payments">View payments</ViewLink>}>
              <Row label="Held in escrow now" value={inr(d.finance.escrowHeld)} strong />
              <Row label={`Released to suppliers (${d.range.days}d)`} value={inr(d.finance.fundsReleased)} />
              <Row label="Released, all time" value={inr(d.finance.releasedAllTime)} />
              <Row label="Pending supplier payouts" value={`${inr(d.finance.pendingPayouts)} (${num(d.finance.pendingPayoutCount)})`} />
              <Row label="Refunded to buyers, all time" value={`${inr(d.finance.refundedAllTime)} (${num(d.finance.refundedCount)})`} />
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[12px] text-slate-600">
                <p className="font-semibold text-slate-800">Orders placed in period</p>
                <p className="mt-1">{num(d.period.current.orders)} placed · {num(d.period.current.completed)} delivered · {num(d.period.current.cancelled)} cancelled · {num(d.period.current.refunded)} refunded</p>
              </div>
            </Panel>

            <Panel className="lg:col-span-2 xl:col-span-1" icon={Activity} title="Marketplace growth" subtitle={`New in the last ${d.range.days} days`} action={<ViewLink to="/super-admin/reports">Reports</ViewLink>}>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  ['New buyers', d.period.current.newBuyers, d.period.change.newBuyers, Users],
                  ['New suppliers', d.period.current.newSuppliers, d.period.change.newSuppliers, Building2],
                  ['New products', d.period.current.newProducts, d.period.change.newProducts, Boxes],
                  ['New RFQs', d.period.current.newRfqs, d.period.change.newRfqs, FileText],
                  ['Quotations sent', d.period.current.newQuotations, d.period.change.newQuotations, Wallet],
                  ['Buyers who ordered', d.period.current.orderingBuyers, d.period.change.orderingBuyers, ShoppingBag],
                ].map(([label, value, change, Icon]) => (
                  <div key={label} className="rounded-xl border border-slate-100 p-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><Icon className="size-3.5 text-emerald-700" aria-hidden="true" />{label}</p>
                    <p className="text-lg font-extrabold text-slate-900">{num(value)}</p>
                    <Change value={change} />
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* Recent activity */}
          <Panel icon={Activity} title="Recent platform activity" subtitle="From the audit log (no personal details shown)" action={<ViewLink to="/super-admin/audit">View audit log</ViewLink>}>
            {d.activity.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No recorded activity yet.</p> : (
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left text-[13px]">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr><th className="px-5 py-2">When</th><th className="px-3 py-2">Activity</th><th className="px-3 py-2">By</th><th className="px-3 py-2">Result</th><th className="px-5 py-2 text-right">Details</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {d.activity.map((a) => (
                      <tr key={a.id}>
                        <td className="whitespace-nowrap px-5 py-2.5 text-slate-500">{formatDateTime(a.at)}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-900">{a.label}</td>
                        <td className="px-3 py-2.5 text-slate-600">{String(a.actorRole || 'System').replace(/_/g, ' ').toLowerCase()}</td>
                        <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.result === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{a.result === 'SUCCESS' ? 'Done' : 'Failed'}</span></td>
                        <td className="px-5 py-2.5 text-right"><Link to={a.link} className="text-xs font-semibold text-emerald-700 hover:underline">View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
