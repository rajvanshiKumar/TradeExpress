import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  Package,
  ShoppingBag,
  Truck,
  IndianRupee,
  Layers,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  TrendingUp,
  Clock,
  CheckCircle,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';

export default function SuperAdminDashboard() {
  const { showToast } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [range, setRange] = useState('30d');

  const loadData = async (selectedRange = range) => {
    try {
      setLoading(true);
      const res = await superAdminApi.getDashboard({ range: selectedRange });
      setData(res);
    } catch (err) {
      showToast(err.message || 'Failed to fetch dashboard metrics from MySQL.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(range);
  }, [range]);

  const kpis = data?.kpis || {};
  const recentOrders = data?.recentOrders || [];
  const recentAuditLogs = data?.recentAuditLogs || [];
  const topCategories = data?.topCategories || [];

  return (
    <div className="space-y-6">
      {/* Top Welcome & Range Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Super Admin Platform Command</h1>
            <span className="flex size-2 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time aggregate data queried from MySQL production database.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            {['7d', '30d', '90d'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  range === r ? 'bg-[#0b2716] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last {r.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadData(range)}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
            title="Refresh database metrics"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Platform Revenue */}
        <div className="bg-gradient-to-br from-[#0b2716] to-[#144728] text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Gross Platform Revenue</span>
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <IndianRupee className="size-4.5" />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-black tracking-tight">
              ₹{(kpis.totalRevenue || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-[11px] text-emerald-200/80 mt-1 flex items-center gap-1">
              <TrendingUp className="size-3.5 text-emerald-400" />
              <span>Real paid orders in MySQL</span>
            </p>
          </div>
        </div>

        {/* Card 2: Escrow Balance Held */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Escrow Balance Held</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              <ShieldCheck className="size-4.5" />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              ₹{(kpis.totalEscrowHeld || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Securing active B2B orders
            </p>
          </div>
        </div>

        {/* Card 3: Commission Earned */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Platform Commission</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <IndianRupee className="size-4.5" />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-black text-emerald-800 tracking-tight">
              ₹{(kpis.totalCommissionEarned || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">
              Marketplace net take-rate
            </p>
          </div>
        </div>

        {/* Card 4: Total Orders */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total B2B Orders</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
              <ShoppingBag className="size-4.5" />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {kpis.totalOrders || 0}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {kpis.pendingOrders || 0} active in fulfillment
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link to="/super-admin/users" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-500 transition-colors shadow-xs group">
          <div className="flex items-center justify-between text-slate-400 group-hover:text-emerald-700">
            <Users className="size-4" />
            <ArrowUpRight className="size-3.5" />
          </div>
          <p className="text-lg font-black text-slate-900 mt-2">{kpis.totalUsers || 0}</p>
          <p className="text-[11px] text-slate-500">Registered Users</p>
        </Link>

        <Link to="/super-admin/suppliers" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-500 transition-colors shadow-xs group">
          <div className="flex items-center justify-between text-slate-400 group-hover:text-emerald-700">
            <ShieldCheck className="size-4" />
            <ArrowUpRight className="size-3.5" />
          </div>
          <p className="text-lg font-black text-slate-900 mt-2">{kpis.totalSuppliers || 0}</p>
          <p className="text-[11px] text-slate-500">{kpis.verifiedSuppliers || 0} Verified</p>
        </Link>

        <Link to="/super-admin/products" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-500 transition-colors shadow-xs group">
          <div className="flex items-center justify-between text-slate-400 group-hover:text-emerald-700">
            <Package className="size-4" />
            <ArrowUpRight className="size-3.5" />
          </div>
          <p className="text-lg font-black text-slate-900 mt-2">{kpis.totalProducts || 0}</p>
          <p className="text-[11px] text-slate-500">{kpis.pendingProducts || 0} Pending Moderation</p>
        </Link>

        <Link to="/super-admin/categories" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-500 transition-colors shadow-xs group">
          <div className="flex items-center justify-between text-slate-400 group-hover:text-emerald-700">
            <Layers className="size-4" />
            <ArrowUpRight className="size-3.5" />
          </div>
          <p className="text-lg font-black text-slate-900 mt-2">{kpis.totalCategories || 0}</p>
          <p className="text-[11px] text-slate-500">Taxonomy Categories</p>
        </Link>

        <Link to="/super-admin/rfqs" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-500 transition-colors shadow-xs group">
          <div className="flex items-center justify-between text-slate-400 group-hover:text-emerald-700">
            <FileText className="size-4" />
            <ArrowUpRight className="size-3.5" />
          </div>
          <p className="text-lg font-black text-slate-900 mt-2">{kpis.totalRfqs || 0}</p>
          <p className="text-[11px] text-slate-500">{kpis.totalQuotes || 0} Quotes Received</p>
        </Link>

                <Link to="/super-admin/logistics" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-500 transition-colors shadow-xs group">
          <div className="flex items-center justify-between text-slate-400 group-hover:text-emerald-700">
            <Truck className="size-4" />
            <ArrowUpRight className="size-3.5" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-lg font-black text-slate-900">{kpis.pendingTruckApprovals || 0}</p>
            {kpis.pendingTruckApprovals > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 animate-pulse">
                Action Required
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500">Trucks Awaiting Approval</p>
        </Link>

        <Link to="/super-admin/disputes" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-rose-500 transition-colors shadow-xs group">
          <div className="flex items-center justify-between text-slate-400 group-hover:text-rose-600">
            <AlertTriangle className="size-4" />
            <ArrowUpRight className="size-3.5" />
          </div>
          <p className="text-lg font-black text-rose-600 mt-2">{kpis.openDisputes || 0}</p>
          <p className="text-[11px] text-slate-500">Open Disputes</p>
        </Link>
      </div>

      {/* Main Grid: Recent Orders & Recent Audit Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders in MySQL */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Live Orders Pipeline</h2>
              <p className="text-xs text-slate-500">Directly from MySQL `orders` table</p>
            </div>
            <Link
              to="/super-admin/orders"
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 font-semibold border-b border-slate-100">
                  <th className="py-2.5">Order ID</th>
                  <th className="py-2.5">Buyer</th>
                  <th className="py-2.5">Total</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-slate-400">
                      No orders found in database.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 font-mono font-bold text-slate-900">
                        <Link to={`/super-admin/orders?search=${o.orderNumber}`} className="hover:underline">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="py-3">
                        <p className="font-semibold text-slate-800">{o.buyerName}</p>
                        <p className="text-[10px] text-slate-400">{o.buyerCompany || 'Direct'}</p>
                      </td>
                      <td className="py-3 font-bold text-slate-900">
                        ₹{Number(o.total || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {o.orderStatus}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            o.paymentStatus === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {o.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Log Stream */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Security Audit Stream</h2>
              <p className="text-xs text-slate-500">Immutable administrative actions</p>
            </div>
            <Link
              to="/super-admin/audit"
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
            >
              <span>Full Log</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="mt-3 space-y-3 flex-1 overflow-y-auto">
            {recentAuditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No audit activities logged yet.</p>
            ) : (
              recentAuditLogs.map((log) => (
                <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 tracking-tight">{log.action}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate">
                    By <span className="font-medium text-emerald-800">{log.actorEmail}</span> on <span className="font-mono">{log.resource}</span>
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Quick Top Categories */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Top Categories</p>
            <div className="space-y-1.5">
              {topCategories.map((c) => (
                <div key={c.slug} className="flex items-center justify-between text-xs text-slate-600">
                  <span className="truncate">{c.name}</span>
                  <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full text-[10px]">
                    {c.productCount} items
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
