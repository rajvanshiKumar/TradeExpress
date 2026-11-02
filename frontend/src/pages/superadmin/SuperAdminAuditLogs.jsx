import { useState, useEffect } from 'react';
import {
  FileCheck2,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Shield,
  Clock,
  Terminal,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';
import CustomSelect from '../../components/common/CustomSelect';

export default function SuperAdminAuditLogs() {
  const { showToast } = useNotifications();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [resource, setResource] = useState('ALL');
  const [action, setAction] = useState('ALL');

  // Payload modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchLogs = async (page = 1) => {
    try {
      setLoading(true);
      const res = await superAdminApi.getAuditLogs({
        page,
        limit: pagination.limit,
        resource,
        action,
        search,
      });
      setLogs(res.logs);
      setPagination(res.pagination);
    } catch (err) {
      showToast(err.message || 'Failed to load audit logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [resource, action]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const openLogPayload = (log) => {
    setSelectedLog(log);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Immutable Security Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cryptographically logged administrative operations, authorization events, and platform state alterations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchLogs(pagination.page)}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 self-start sm:self-auto"
          title="Refresh Audit Trail"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by actor email, action, resource, target ID..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>Resource:</span>
            <div className="w-36">
              <CustomSelect
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Resources' },
                  { value: 'USERS', label: 'Users' },
                  { value: 'SUPPLIERS', label: 'Suppliers' },
                  { value: 'PRODUCTS', label: 'Products' },
                  { value: 'CATEGORIES', label: 'Categories' },
                  { value: 'ORDERS', label: 'Orders' },
                  { value: 'PAYMENTS', label: 'Payments' },
                  { value: 'DISPUTES', label: 'Disputes' },
                  { value: 'ADMINS', label: 'Admins' },
                  { value: 'SETTINGS', label: 'Settings' },
                  { value: 'SYSTEM', label: 'System' }
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>Action:</span>
            <div className="w-48">
              <CustomSelect
                value={action}
                onChange={(e) => setAction(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Actions' },
                  { value: 'USER_STATUS_CHANGE', label: 'User Status Change' },
                  { value: 'KYC_REVIEW', label: 'KYC Review' },
                  { value: 'PRODUCT_MODERATE', label: 'Product Moderate' },
                  { value: 'ORDER_ADMIN_OVERRIDE', label: 'Order Override' },
                  { value: 'COMMISSION_UPDATE', label: 'Commission Update' },
                  { value: 'REFUND_PROCESSED', label: 'Refund Processed' },
                  { value: 'DISPUTE_RESOLVED', label: 'Dispute Resolved' },
                  { value: 'ADMIN_CREATE', label: 'Admin Create' },
                  { value: 'SETTING_UPDATE', label: 'Setting Update' }
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-table-scrollbar">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Resource</th>
                <th className="py-3 px-4">Operator (Actor)</th>
                <th className="py-3 px-4">Target ID</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No audit records match current filters.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                        {l.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {l.resource}
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900 text-[11px]">{l.actorEmail}</p>
                      <p className="text-[10px] text-emerald-800 font-semibold">{l.actorRole}</p>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px] truncate max-w-[120px]">
                      {l.targetId || '—'}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {l.ipAddress || '127.0.0.1'}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          l.result === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {l.result}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openLogPayload(l)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        title="View Raw Event Data"
                      >
                        <Eye className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          <p>
            Showing <span className="font-bold text-slate-900">{logs.length}</span> of{' '}
            <span className="font-bold text-slate-900">{pagination.total}</span> audit records
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => fetchLogs(pagination.page - 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100"
            >
              Previous
            </button>
            <span className="font-bold text-slate-700">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchLogs(pagination.page + 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Raw Event Modal */}
      {modalOpen && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Terminal className="size-4 text-emerald-800" />
                <h3 className="text-sm font-bold text-slate-900">
                  Audit Event: {selectedLog.action}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Actor Email</span>
                <span className="font-bold text-slate-900">{selectedLog.actorEmail} ({selectedLog.actorRole})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Resource</span>
                <span className="font-bold text-slate-900">{selectedLog.resource}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Target ID</span>
                <span className="font-mono text-slate-900">{selectedLog.targetId || 'None'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Client IP</span>
                <span className="font-mono text-slate-900">{selectedLog.ipAddress}</span>
              </div>
              <div className="py-1">
                <span className="text-slate-400 block mb-1">User Agent</span>
                <p className="text-[11px] text-slate-600 font-mono break-all">{selectedLog.userAgent}</p>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-700 block mb-1">Details Payload</span>
              <pre className="p-3 rounded-xl bg-slate-900 text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-48">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
