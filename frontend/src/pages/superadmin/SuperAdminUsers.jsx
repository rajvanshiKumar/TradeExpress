import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  MoreVertical,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  Lock,
  Trash2,
  X,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';
import CustomSelect from '../../components/common/CustomSelect';
import AdminDeleteUserModal from '../../components/superadmin/AdminDeleteUserModal';
import UserDetailPanel from '../../components/superadmin/UserDetailPanel';
import UserExportMenu from '../../components/superadmin/UserExportMenu';

export default function SuperAdminUsers() {
  const { showToast } = useNotifications();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  // ?search= opens the directory already filtered (e.g. View Supplier Profile from a deletion request)
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [role, setRole] = useState('ALL');
  // Active accounts are shown first by default
  const [status, setStatus] = useState('ACTIVE');

  // Modals state
  const [selectedUser, setSelectedUser] = useState(null);
  // Full details of the user opened from the directory ({ user, recentOrders, auditTrail })
  const [details, setDetails] = useState(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusAction, setStatusAction] = useState('SUSPENDED');
  const [statusReason, setStatusReason] = useState('');
  const [userToDelete, setUserToDelete] = useState(null);

  // Only the newest request may update the table (typing fast must not show an older, slower answer)
  const requestSeqRef = useRef(0);
  const fetchUsers = async (page = 1, term = search) => {
    const seq = ++requestSeqRef.current;
    try {
      setLoading(true);
      const res = await superAdminApi.getUsers({
        page,
        limit: pagination.limit,
        search: term.trim(),
        role,
        status,
      });
      if (seq !== requestSeqRef.current) return;
      setUsers(res.users);
      setPagination(res.pagination);
    } catch (err) {
      if (seq === requestSeqRef.current) showToast(err.message || 'Failed to fetch users from database.', 'error');
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  };

  // Filters apply at once; the search applies while typing, shortly after the last key press
  const firstSearchRef = useRef(true);
  useEffect(() => {
    fetchUsers(1);
  }, [role, status]);
  useEffect(() => {
    if (firstSearchRef.current) { firstSearchRef.current = false; return undefined; }
    const timer = setTimeout(() => fetchUsers(1, search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const openStatusModal = (user, action) => {
    if (user.role === 'SUPER_ADMIN' || user.email === 'krajvanshi244@gmail.com') {
      showToast('Super Admin accounts cannot be suspended or demoted.', 'error');
      return;
    }
    setSelectedUser(user);
    setStatusAction(action);
    setStatusReason('');
    setStatusModalOpen(true);
  };

  const handleStatusSubmit = async () => {
    if (statusAction === 'SUSPENDED' && !statusReason.trim()) {
      showToast('Please provide a reason for suspending this user.', 'error');
      return;
    }
    try {
      await superAdminApi.updateUserStatus(selectedUser.id, {
        status: statusAction,
        isActive: statusAction === 'ACTIVE',
        reason: statusReason,
      });
      showToast(`User status updated to ${statusAction}.`, 'success');
      setStatusModalOpen(false);
      fetchUsers(pagination.page);
    } catch (err) {
      showToast(err.message || 'Failed to update user status.', 'error');
    }
  };

  /**
   * Opens the panel at once with the row's data, then loads the full details of that one user only
   * (never ahead of a click, so no other user's data is requested). Always fresh, so status changes show.
   */
  const viewDetails = async (u) => {
    setDetails({ user: u, recentOrders: [], auditTrail: [], loading: true });
    try {
      const full = await superAdminApi.getUserDetails(u.id);
      setDetails((current) => (current?.user?.id === u.id ? full : current));
    } catch (err) {
      setDetails((current) => (current?.user?.id === u.id ? { ...current, loading: false, error: err.message || 'Failed to load user details.' } : current));
    }
  };

  const handleVerifyUser = async (u) => {
    try {
      await superAdminApi.verifyUser(u.id);
      showToast(`${u.name || u.email} verified successfully. Official ID & Certificate issued.`, 'success');
      fetchUsers(pagination.page);
    } catch (err) {
      showToast(err.message || 'Failed to verify user.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Platform User Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage buyers, verified suppliers, and staff accounts with live audit logging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <UserExportMenu
            onExport={async (format) => {
              try {
                const { rows } = await superAdminApi.downloadUsersExport(format, { role, status, search: search.trim() });
                showToast(`Export ready${rows !== null ? `: ${rows} user${rows === 1 ? '' : 's'}` : ''}.`, 'success');
              } catch (err) {
                showToast(err.message || 'The export could not be created.', 'error');
              }
            }}
          />

          <button
            type="button"
            onClick={() => fetchUsers(pagination.page)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
            title="Refresh Users"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, company, phone, city, GSTIN, PAN or supplier code..."
            aria-label="Search users"
            className="w-full pl-10 pr-9 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter className="size-3.5" />
            <span>Role:</span>
            <div className="w-36">
              <CustomSelect
                value={role}
                onChange={(e) => setRole(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Roles' },
                  { value: 'BUYER', label: 'Buyer' },
                  { value: 'SUPPLIER', label: 'Supplier' },
                  { value: 'ADMIN', label: 'Admin' },
                  { value: 'SUPER_ADMIN', label: 'Super Admin' }
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>Status:</span>
            <div className="w-36">
              <CustomSelect
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'SUSPENDED', label: 'Suspended' },
                  { value: 'DEACTIVATED', label: 'Deactivated' }
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-table-scrollbar">
          <table className="w-full min-w-[1150px] text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap">
              <tr>
                <th className="py-3 px-4 min-w-[200px]">User</th>
                <th className="py-3 px-4 min-w-[100px]">Role</th>
                <th className="py-3 px-4 min-w-[110px]">Status</th>
                <th className="py-3 px-4 min-w-[140px]">Company</th>
                <th className="py-3 px-4 min-w-[150px]">Phone / City</th>
                <th className="py-3 px-4 min-w-[140px]">KYC / Verification</th>
                <th className="py-3 px-4 min-w-[100px]">Joined</th>
                <th className="py-3 px-4 min-w-[160px] text-right sticky right-0 bg-slate-50 z-10 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No users match current filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSuper = u.role === 'SUPER_ADMIN' || u.email === 'krajvanshi244@gmail.com';
                  const isSuspended = u.status === 'SUSPENDED';
                  const isDeleted = u.status === 'DEACTIVATED';

                  return (
                    <tr
                      key={u.id}
                      onClick={() => viewDetails(u)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); viewDetails(u); } }}
                      tabIndex={0}
                      aria-label={`Open full details of ${u.name || u.email}`}
                      className="cursor-pointer hover:bg-slate-50/80 focus:bg-emerald-50/60 focus:outline-none transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`size-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                              isSuper
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {(u.name || u.email || 'U').charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                              {u.name}
                              {isSuper && (
                                <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                                  SUPER
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.role === 'SUPER_ADMIN'
                              ? 'bg-emerald-900 text-emerald-200 border border-emerald-700'
                              : u.role === 'ADMIN'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : u.role === 'SUPPLIER'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isDeleted
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : isSuspended
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isSuspended || isDeleted ? <XCircle className="size-3" /> : <CheckCircle2 className="size-3" />}
                          {isDeleted ? 'DELETED' : (u.status || 'ACTIVE')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-medium truncate max-w-[150px]">
                        {u.company || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500">
                        <p>{u.phone || '—'}</p>
                        <p className="text-[10px] text-slate-400">{u.city ? `${u.city}, ${u.country || 'India'}` : '—'}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        {u.role === 'SUPPLIER' || u.role === 'BUYER' ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              u.kycStatus === 'VERIFIED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : u.kycStatus === 'REJECTED'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            <ShieldCheck className="size-3" />
                            {u.kycStatus === 'VERIFIED' ? 'VERIFIED' : (u.kycStatus || 'PENDING')}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>

                      <td
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="py-3.5 px-4 text-right sticky right-0 bg-white group-hover:bg-[#f8faf7] transition-colors z-10 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]"
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {(u.role === 'BUYER' || u.role === 'SUPPLIER') && u.kycStatus !== 'VERIFIED' && !isDeleted && !isSuspended && (
                            <button
                              type="button"
                              onClick={() => handleVerifyUser(u)}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-2xs transition-colors flex items-center gap-1"
                              title={`Verify ${u.role === 'BUYER' ? 'Buyer' : 'Supplier'} Account & Issue Official Documents`}
                            >
                              <ShieldCheck className="size-3" />
                              Verify
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => viewDetails(u)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            title="Inspect Profile"
                          >
                            <Eye className="size-4" />
                          </button>

                          {!isSuper && !isDeleted && (
                            <>
                              {isSuspended ? (
                                <button
                                  type="button"
                                  onClick={() => openStatusModal(u, 'ACTIVE')}
                                  className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[10px] border border-emerald-200"
                                >
                                  Activate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openStatusModal(u, 'SUSPENDED')}
                                  className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[10px] border border-rose-200"
                                >
                                  Suspend
                                </button>
                              )}

                              {(u.role === 'BUYER' || u.role === 'SUPPLIER') && (
                                <button
                                  type="button"
                                  onClick={() => setUserToDelete(u)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                                  title="Delete Account"
                                  aria-label={`Delete account of ${u.name}`}
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          <p>
            Showing <span className="font-bold text-slate-900">{users.length}</span> of{' '}
            <span className="font-bold text-slate-900">{pagination.total}</span> users
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => fetchUsers(pagination.page - 1)}
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
              onClick={() => fetchUsers(pagination.page + 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Suspend / Activate Modal */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <span className={`p-2.5 rounded-xl ${statusAction === 'SUSPENDED' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                <ShieldAlert className="size-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {statusAction === 'SUSPENDED' ? 'Suspend Account' : 'Reactivate Account'}
                </h3>
                <p className="text-xs text-slate-500">{selectedUser?.email}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              {statusAction === 'SUSPENDED'
                ? 'Suspending this user will immediately revoke their API tokens and block them from logging into TradeExpress.'
                : 'Reactivating will restore full marketplace access for this account.'}
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Audit Reason {statusAction === 'SUSPENDED' && <span className="text-rose-500">*</span>}
              </label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Enter justification for audit log (e.g., suspicious activity, non-fulfillment)..."
                rows="3"
                className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusSubmit}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors ${
                  statusAction === 'SUSPENDED' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                Confirm {statusAction === 'SUSPENDED' ? 'Suspension' : 'Activation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {userToDelete && (
        <AdminDeleteUserModal
          user={userToDelete}
          onClose={() => setUserToDelete(null)}
          onDeleted={() => {
            showToast(`${userToDelete.name}’s account has been deleted.`, 'success');
            setUserToDelete(null);
            fetchUsers(pagination.page);
          }}
        />
      )}

      {/* Full user details (opens from any row) */}
      {details && (
        <UserDetailPanel
          details={details}
          onClose={() => setDetails(null)}
          onVerify={async (user) => {
            await handleVerifyUser(user);
            try { setDetails(await superAdminApi.getUserDetails(user.id)); } catch { setDetails(null); }
          }}
        />
      )}
    </div>
  );
}
