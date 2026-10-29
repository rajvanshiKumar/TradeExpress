import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  MoreVertical,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  KeyRound,
  Eye,
  RefreshCw,
  Lock,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';
import CustomSelect from '../../components/common/CustomSelect';

export default function SuperAdminUsers() {
  const { showToast } = useNotifications();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [status, setStatus] = useState('ALL');

  // Modals state
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusAction, setStatusAction] = useState('SUSPENDED');
  const [statusReason, setStatusReason] = useState('');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      const res = await superAdminApi.getUsers({
        page,
        limit: pagination.limit,
        search,
        role,
        status,
      });
      setUsers(res.users);
      setPagination(res.pagination);
    } catch (err) {
      showToast(err.message || 'Failed to fetch users from database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  }, [role, status]);

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

  const handlePasswordSubmit = async () => {
    if (!newPassword || newPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    try {
      await superAdminApi.resetUserPassword(selectedUser.id, newPassword);
      showToast('Password updated successfully.', 'success');
      setPasswordModalOpen(false);
      setNewPassword('');
    } catch (err) {
      showToast(err.message || 'Failed to reset password.', 'error');
    }
  };

  const viewDetails = async (u) => {
    try {
      const data = await superAdminApi.getUserDetails(u.id);
      setSelectedUser(data.user);
      setDetailModalOpen(true);
    } catch (err) {
      showToast(err.message || 'Failed to load user details.', 'error');
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
          <a
            href={superAdminApi.getExportUsersCsvUrl({ role, status, search })}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors"
          >
            <Download className="size-4" />
            <span>Export CSV</span>
          </a>

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
            placeholder="Search by name, email, company, phone, or city..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
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

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
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
                            isSuspended
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isSuspended ? <XCircle className="size-3" /> : <CheckCircle2 className="size-3" />}
                          {u.status || 'ACTIVE'}
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
                        {u.role === 'SUPPLIER' ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              u.isVerified
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            <ShieldCheck className="size-3" />
                            {u.isVerified ? 'VERIFIED' : u.kycStatus || 'PENDING'}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right sticky right-0 bg-white group-hover:bg-[#f8faf7] transition-colors z-10 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => viewDetails(u)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            title="Inspect Profile"
                          >
                            <Eye className="size-4" />
                          </button>

                          {!isSuper && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setPasswordModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50"
                                title="Reset Password"
                              >
                                <KeyRound className="size-4" />
                              </button>

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

      {/* Password Reset Modal */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-amber-100 text-amber-700">
                <KeyRound className="size-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Admin Password Override</h3>
                <p className="text-xs text-slate-500 truncate max-w-[200px]">{selectedUser?.email}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePasswordSubmit}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0b2716] text-white hover:bg-emerald-900"
              >
                Save Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed User Modal */}
      {detailModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-sm">
                  {selectedUser.name?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedUser.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-semibold block">Role & Status</span>
                <span className="font-bold text-slate-800">{selectedUser.role} / {selectedUser.status}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-semibold block">Company</span>
                <span className="font-bold text-slate-800">{selectedUser.company || 'Not provided'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-semibold block">Phone</span>
                <span className="font-bold text-slate-800">{selectedUser.phone || 'Not provided'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-semibold block">Location</span>
                <span className="font-bold text-slate-800">{selectedUser.city ? `${selectedUser.city}, ${selectedUser.country}` : 'Not provided'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-semibold block">GSTIN</span>
                <span className="font-bold text-slate-800 font-mono">{selectedUser.gstin || 'Not registered'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-semibold block">PAN</span>
                <span className="font-bold text-slate-800 font-mono">{selectedUser.pan || 'Not registered'}</span>
              </div>
            </div>

            {selectedUser.addresses?.length > 0 && (
              <div className="pt-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Saved Addresses</h4>
                <div className="space-y-2">
                  {selectedUser.addresses.map((addr) => (
                    <div key={addr.id} className="p-2.5 rounded-xl border border-slate-200 text-xs text-slate-700">
                      <p className="font-bold">{addr.name} ({addr.label})</p>
                      <p>{addr.street}, {addr.city}, {addr.state} - {addr.postalCode}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
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
