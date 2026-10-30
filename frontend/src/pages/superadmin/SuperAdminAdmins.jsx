import { useState, useEffect } from 'react';
import {
  UserCheck,
  Shield,
  Plus,
  KeyRound,
  Trash2,
  RefreshCw,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';
import CustomSelect from '../../components/common/CustomSelect';

const PRESET_ROLES = [
  {
    key: 'USER_ADMIN',
    label: 'User Administrator',
    perms: ['users.read', 'users.write', 'users.suspend'],
  },
  {
    key: 'PRODUCT_ADMIN',
    label: 'Product & Catalog Admin',
    perms: ['products.moderate', 'categories.manage', 'products.featured'],
  },
  {
    key: 'VERIFICATION_ADMIN',
    label: 'KYC & Verification Admin',
    perms: ['kyc.verify', 'kyc.reject', 'suppliers.read'],
  },
  {
    key: 'FINANCE_ADMIN',
    label: 'Finance & Escrow Admin',
    perms: ['payments.manage', 'commission.manage', 'refunds.manage'],
  },
  {
    key: 'SUPPORT_ADMIN',
    label: 'Support & Help Desk Admin',
    perms: ['tickets.manage', 'disputes.read'],
  },
  {
    key: 'CUSTOM',
    label: 'Custom Granular Permissions',
    perms: [],
  },
];

const ALL_PERMISSION_KEYS = [
  { key: 'users.read', label: 'View User Directory' },
  { key: 'users.write', label: 'Edit User Accounts' },
  { key: 'users.suspend', label: 'Suspend / Activate Accounts' },
  { key: 'kyc.verify', label: 'Approve Supplier KYC' },
  { key: 'kyc.reject', label: 'Reject / Request KYC Resubmission' },
  { key: 'products.moderate', label: 'Moderate & Vet Products' },
  { key: 'products.featured', label: 'Spotlight Products (Featured/Trending)' },
  { key: 'categories.manage', label: 'Taxonomy & Category Editor' },
  { key: 'orders.manage', label: 'Orders & Tracking Overrides' },
  { key: 'payments.manage', label: 'Payments & Escrow Inspection' },
  { key: 'commission.manage', label: 'Update Commission Take-rates' },
  { key: 'refunds.manage', label: 'Authorize Buyer Refunds' },
  { key: 'disputes.resolve', label: 'Resolve B2B Disputes' },
  { key: 'tickets.manage', label: 'Reply Support Tickets' },
  { key: 'settings.manage', label: 'Platform Settings & Banners' },
];

export default function SuperAdminAdmins() {
  const { showToast } = useNotifications();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create Sub-Admin Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    adminRole: 'USER_ADMIN',
    adminPermissions: ['users.read', 'users.write', 'users.suspend'],
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const data = await superAdminApi.getAdminUsers();
      setAdmins(data);
    } catch (err) {
      showToast(err.message || 'Failed to fetch admin accounts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handlePresetChange = (presetKey) => {
    const preset = PRESET_ROLES.find((r) => r.key === presetKey);
    setFormData({
      ...formData,
      adminRole: presetKey,
      adminPermissions: preset?.perms || [],
    });
  };

  const handleTogglePermission = (permKey) => {
    const exists = formData.adminPermissions.includes(permKey);
    const updated = exists
      ? formData.adminPermissions.filter((p) => p !== permKey)
      : [...formData.adminPermissions, permKey];

    setFormData({
      ...formData,
      adminRole: 'CUSTOM',
      adminPermissions: updated,
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      showToast('Please fill all required fields.', 'error');
      return;
    }
    if (formData.password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await superAdminApi.createSubAdmin(formData);
      showToast('New sub-admin staff created successfully.', 'success');
      setModalOpen(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        adminRole: 'USER_ADMIN',
        adminPermissions: ['users.read', 'users.write', 'users.suspend'],
      });
      fetchAdmins();
    } catch (err) {
      showToast(err.message || 'Failed to create sub-admin.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (admin) => {
    if (admin.role === 'SUPER_ADMIN' || admin.email === 'krajvanshi244@gmail.com') {
      showToast('Super Admin privileges cannot be deactivated.', 'error');
      return;
    }

    const newActive = !admin.isActive;
    try {
      await superAdminApi.updateSubAdmin(admin.id, {
        isActive: newActive,
        status: newActive ? 'ACTIVE' : 'DEACTIVATED',
      });
      showToast(`Admin account ${newActive ? 'activated' : 'deactivated'}.`, 'success');
      fetchAdmins();
    } catch (err) {
      showToast(err.message || 'Failed to update admin account.', 'error');
    }
  };

  const handleDeleteAdminClick = (admin) => {
    if (admin.role === 'SUPER_ADMIN' || admin.email === 'krajvanshi244@gmail.com') {
      showToast('Super Admin account cannot be deleted.', 'error');
      return;
    }
    setDeleteTarget(admin);
  };

  const handleConfirmDeleteAdmin = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await superAdminApi.deleteSubAdmin(deleteTarget.id);
      showToast('Admin staff removed successfully.', 'success');
      setDeleteTarget(null);
      fetchAdmins();
    } catch (err) {
      showToast(err.message || 'Failed to delete admin.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Staff & Delegation Governance</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Provision restricted administrative accounts, assign role presets, and audit delegated access.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0b2716] hover:bg-emerald-950 text-white text-xs font-bold transition-colors shadow-xs"
          >
            <Plus className="size-4" />
            <span>Create Staff Admin</span>
          </button>

          <button
            type="button"
            onClick={fetchAdmins}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
            title="Refresh Staff"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Staff Admins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {admins.map((a) => {
          const isSuper = a.role === 'SUPER_ADMIN' || a.email === 'krajvanshi244@gmail.com';
          const perms = Array.isArray(a.adminPermissions) ? a.adminPermissions : [];

          return (
            <div
              key={a.id}
              className={`bg-white rounded-2xl border p-5 flex flex-col justify-between shadow-xs transition-all ${
                isSuper ? 'border-emerald-600/60 ring-2 ring-emerald-500/20' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isSuper ? 'bg-[#0b2716] text-emerald-400' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {a.name?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                        {a.name}
                        {isSuper && (
                          <span className="bg-emerald-700 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                            TIER 1
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-mono">{a.email}</p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                      a.isActive !== false
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {a.isActive !== false ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                    {a.isActive !== false ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>

                <div className="mt-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Assigned Role:</span>
                    <span className="font-bold text-slate-800 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                      {isSuper ? 'SUPER_ADMIN' : a.adminRole || 'ADMIN'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-slate-400 block font-semibold mb-1.5">Granted Capabilities:</span>
                    {isSuper ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 block text-center">
                        ★ Platform-wide Universal Access (All Resources)
                      </span>
                    ) : perms.length === 0 ? (
                      <span className="text-[10px] text-slate-400">Standard general admin</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {perms.map((p, i) => (
                          <span
                            key={i}
                            className="text-[9px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {!isSuper ? (
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(a)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  >
                    {a.isActive !== false ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAdminClick(a)}
                    className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                    title="Remove Staff"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="mt-5 pt-3 border-t border-slate-100 text-[10px] text-emerald-800 font-bold text-center">
                  Protected System Root Account
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete Admin Confirmation Modal - Asks "Do you want to delete?" */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <AlertTriangle className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Do you want to delete?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm administrator revocation.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5">
              <p>
                Are you sure you want to remove administrator <strong className="text-slate-900">{deleteTarget.name}</strong>?
              </p>
              <p className="text-slate-500 text-[11px]">
                Email: <span className="font-mono text-slate-700">{deleteTarget.email}</span>
              </p>
              <p className="text-slate-500 text-[11px]">
                Role: <span className="font-bold text-emerald-800">{deleteTarget.adminRole || 'ADMIN'}</span>
              </p>
              <p className="text-rose-600 font-medium text-[11px]">
                Their system access and delegated management privileges will be revoked immediately.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAdmin}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs"
              >
                {deleting ? 'Deleting...' : 'Do you want to delete? Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provision Staff Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <UserCheck className="size-5" />
                </span>
                <h3 className="text-base font-bold text-slate-900">Provision Sub-Admin Staff</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Staff Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Ramesh Sharma"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Official Work Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="staff@tradeexpress.com"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Temporary Initial Password *</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="At least 6 characters"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Administrative Role Template</label>
                <CustomSelect
                  value={formData.adminRole}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  options={PRESET_ROLES.map((r) => ({ value: r.key, label: r.label }))}
                />
              </div>

              {/* Granular Checkboxes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Granular Platform Entitlements</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  {ALL_PERMISSION_KEYS.map((perm) => {
                    const checked = formData.adminPermissions.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className="flex items-center gap-2 p-1 rounded hover:bg-slate-100 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleTogglePermission(perm.key)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 size-3.5"
                        />
                        <span className="text-[11px] text-slate-700 font-medium leading-tight">{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#0b2716] hover:bg-emerald-950 text-white font-bold transition-colors"
                >
                  {submitting ? 'Creating...' : 'Grant Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
