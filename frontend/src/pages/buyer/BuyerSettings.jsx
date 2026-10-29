import { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Globe,
  KeyRound,
  Lock,
  MapPin,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import BuyerAddresses from './BuyerAddresses';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { apiPost } from '../../services/apiClient';

export default function BuyerSettings() {
  const { user, updateProfile } = useAuth();
  const { showToast } = useNotifications();
  useDocumentTitle('Settings & Security — Buyer Workspace');

  const [activeTab, setActiveTab] = useState('SECURITY');

  // Change Password form state
  const [passValues, setPassValues] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passErrors, setPassErrors] = useState({});
  const [passSaving, setPassSaving] = useState(false);

  // Notification prefs state
  const [prefs, setPrefs] = useState({
    orders: user?.notificationPrefs?.orders ?? true,
    quotes: user?.notificationPrefs?.quotes ?? true,
    messages: user?.notificationPrefs?.messages ?? true,
    disputes: user?.notificationPrefs?.disputes ?? true,
  });

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!passValues.currentPassword) {
      errors.currentPassword = 'Current password is required.';
    }
    if (!passValues.newPassword || passValues.newPassword.length < 8) {
      errors.newPassword = 'New password must be at least 8 characters.';
    } else if (!/[A-Za-z]/.test(passValues.newPassword) || !/[0-9]/.test(passValues.newPassword)) {
      errors.newPassword = 'Password must contain at least one letter and one number.';
    }
    if (passValues.newPassword !== passValues.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setPassErrors(errors);
      return;
    }

    setPassSaving(true);
    setPassErrors({});

    try {
      const res = await apiPost('auth/change-password', {
        currentPassword: passValues.currentPassword,
        newPassword: passValues.newPassword,
      });

      if (res && (res.success || res.message)) {
        showToast('Password changed successfully.');
        setPassValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPassErrors({ currentPassword: res?.message || 'Failed to update password.' });
      }
    } catch (err) {
      setPassErrors({ currentPassword: err.message || 'Error updating password.' });
    } finally {
      setPassSaving(false);
    }
  };

  const handleSavePrefs = () => {
    updateProfile({ notificationPrefs: prefs });
    showToast('Notification preferences updated.');
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Settings & Security"
        description="Manage your buyer account security, delivery address book, and notifications."
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        {[
          { id: 'SECURITY', label: 'Password & Security', icon: Lock },
          { id: 'ADDRESSES', label: 'Delivery Address Book', icon: MapPin },
          { id: 'NOTIFICATIONS', label: 'Notification Preferences', icon: Bell },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors shrink-0 ${
                activeTab === t.id
                  ? 'bg-emerald-800 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              <Icon className="size-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'SECURITY' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <KeyRound className="size-4 text-emerald-700" />
              Change Account Password
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Ensure your account uses a secure password with letters and numbers.
            </p>

            <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4 max-w-md text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={passValues.currentPassword}
                  onChange={(e) => setPassValues({ ...passValues, currentPassword: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                />
                {passErrors.currentPassword && (
                  <p className="mt-1 text-[11px] text-rose-600">{passErrors.currentPassword}</p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min. 8 characters with letter & number"
                  value={passValues.newPassword}
                  onChange={(e) => setPassValues({ ...passValues, newPassword: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                />
                {passErrors.newPassword && (
                  <p className="mt-1 text-[11px] text-rose-600">{passErrors.newPassword}</p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={passValues.confirmPassword}
                  onChange={(e) => setPassValues({ ...passValues, confirmPassword: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                />
                {passErrors.confirmPassword && (
                  <p className="mt-1 text-[11px] text-rose-600">{passErrors.confirmPassword}</p>
                )}
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" size="sm" disabled={passSaving}>
                  {passSaving ? 'Saving...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-700" />
                Account Security Status
              </h4>
              <ul className="mt-3 space-y-2.5 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>Verified Business Email</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>Encrypted JWT Sessions</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>Escrow-Protected Account</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ADDRESSES' && (
        <BuyerAddresses />
      )}

      {activeTab === 'NOTIFICATIONS' && (
        <div className="max-w-2xl rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-5">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Notification Channels & Alerts</h3>
            <p className="mt-1 text-xs text-slate-500">
              Choose which operational updates appear in your alerts center.
            </p>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <label className="flex items-start justify-between py-3.5 cursor-pointer">
              <div>
                <span className="font-bold text-slate-900">Purchase Order Updates</span>
                <p className="text-[11px] text-slate-500">Fulfillment, dispatch, tracking, and delivery notifications.</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.orders}
                onChange={(e) => setPrefs({ ...prefs, orders: e.target.checked })}
                className="size-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
            </label>

            <label className="flex items-start justify-between py-3.5 cursor-pointer">
              <div>
                <span className="font-bold text-slate-900">Quotation & RFQ Alerts</span>
                <p className="text-[11px] text-slate-500">When suppliers submit commercial offers or negotiate terms.</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.quotes}
                onChange={(e) => setPrefs({ ...prefs, quotes: e.target.checked })}
                className="size-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
            </label>

            <label className="flex items-start justify-between py-3.5 cursor-pointer">
              <div>
                <span className="font-bold text-slate-900">Supplier Messages</span>
                <p className="text-[11px] text-slate-500">Direct inquiries, product specifications, and quote clarifications.</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.messages}
                onChange={(e) => setPrefs({ ...prefs, messages: e.target.checked })}
                className="size-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
            </label>

            <label className="flex items-start justify-between py-3.5 cursor-pointer">
              <div>
                <span className="font-bold text-slate-900">Trade Protection & Disputes</span>
                <p className="text-[11px] text-slate-500">Escrow milestone releases, inspection updates, and mediation notices.</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.disputes}
                onChange={(e) => setPrefs({ ...prefs, disputes: e.target.checked })}
                className="size-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <Button variant="primary" size="sm" icon={Save} onClick={handleSavePrefs}>
              Save Preferences
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

