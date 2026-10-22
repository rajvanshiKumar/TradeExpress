import { useState, useEffect } from 'react';
import {
  Sliders,
  Bell,
  FileText,
  Server,
  Save,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Shield,
  Key,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';

export default function SuperAdminSettings() {
  const { showToast } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState([]);
  const [integrations, setIntegrations] = useState(null);

  // Form states
  const [bannerText, setBannerText] = useState('');
  const [bannerActive, setBannerActive] = useState('true');
  const [maintenanceMode, setMaintenanceMode] = useState('false');
  const [escrowHoldDays, setEscrowHoldDays] = useState('7');
  const [savingKey, setSavingKey] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [settingsRes, integRes] = await Promise.all([
        superAdminApi.getPlatformSettings(),
        superAdminApi.getSystemIntegrations(),
      ]);

      setSettings(settingsRes.settings || []);
      setIntegrations(integRes);

      const map = {};
      (settingsRes.settings || []).forEach((s) => {
        map[s.key] = s.value;
      });

      if (map.announcement_banner !== undefined) setBannerText(String(map.announcement_banner));
      if (map.announcement_active !== undefined) setBannerActive(String(map.announcement_active));
      if (map.maintenance_mode !== undefined) setMaintenanceMode(String(map.maintenance_mode));
      if (map.escrow_hold_days !== undefined) setEscrowHoldDays(String(map.escrow_hold_days));
    } catch (err) {
      showToast(err.message || 'Failed to load platform settings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSetting = async (key, value, category) => {
    try {
      setSavingKey(key);
      await superAdminApi.updatePlatformSetting({
        key,
        value,
        category,
      });
      showToast(`Setting "${key}" updated successfully.`, 'success');
      loadData();
    } catch (err) {
      showToast(err.message || `Failed to update ${key}.`, 'error');
    } finally {
      setSavingKey('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Enterprise Platform Configuration</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage global header announcements, operational rules, and audit gateway connectivity.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 self-start sm:self-auto"
          title="Refresh Settings"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* Cloud Integrations Status Grid */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Live Integration Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Razorpay */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">Razorpay Gateway</span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  integrations?.razorpay?.status === 'CONNECTED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {integrations?.razorpay?.status === 'CONNECTED' ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                {integrations?.razorpay?.status || 'UNKNOWN'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Key: {integrations?.razorpay?.keyIdPreview || 'Not configured'}
            </p>
            <p className="text-[10px] text-slate-400">Cards, UPI, Netbanking, Escrow</p>
          </div>

          {/* MSG91 */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">MSG91 OTP SMS</span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  integrations?.msg91?.status === 'CONNECTED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {integrations?.msg91?.status === 'CONNECTED' ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                {integrations?.msg91?.status || 'UNKNOWN'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Sender ID: {integrations?.msg91?.senderId || 'TRDEXP'}
            </p>
            <p className="text-[10px] text-slate-400">DLT Verified SMS Gateway</p>
          </div>

          {/* Shiprocket */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">Shiprocket Logistics</span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  integrations?.shiprocket?.status === 'CONNECTED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {integrations?.shiprocket?.status || 'DISABLED'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Automated AWB & Tracking</p>
            <p className="text-[10px] text-slate-400">Pan-India Freight Logistics</p>
          </div>

          {/* MySQL Aiven */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">MySQL Cloud DB</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="size-3" />
                SSL LIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">Aiven Cloud MySQL</p>
            <p className="text-[10px] text-slate-400">Prisma Client ORM Engine</p>
          </div>
        </div>
      </div>

      {/* Main Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Global Announcement Banner */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
              <Bell className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Storefront Announcement Banner</h3>
              <p className="text-xs text-slate-500">Alert displayed at top of marketplace header</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Banner Announcement Text</label>
              <textarea
                rows="2"
                value={bannerText}
                onChange={(e) => setBannerText(e.target.value)}
                placeholder="e.g. GST Compliance Update: Verify your GSTIN before placing bulk orders."
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Display Alert Banner to Visitors</span>
              <select
                value={bannerActive}
                onChange={(e) => setBannerActive(e.target.value)}
                className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-bold text-slate-800"
              >
                <option value="true">Enabled (Visible)</option>
                <option value="false">Disabled (Hidden)</option>
              </select>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={savingKey === 'announcement_banner'}
                onClick={async () => {
                  await handleSaveSetting('announcement_banner', bannerText, 'announcements');
                  await handleSaveSetting('announcement_active', bannerActive, 'announcements');
                }}
                className="px-4 py-2 rounded-xl bg-[#0b2716] hover:bg-emerald-950 text-white font-bold transition-colors inline-flex items-center gap-1.5"
              >
                <Save className="size-3.5" />
                <span>{savingKey === 'announcement_banner' ? 'Saving...' : 'Save Banner'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Operational Governance */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-800">
              <Sliders className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Operational & Financial Rules</h3>
              <p className="text-xs text-slate-500">Escrow holding periods and marketplace switches</p>
            </div>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Platform Maintenance Mode</p>
                <p className="text-[11px] text-slate-500">Temporarily restrict order placement for upgrades</p>
              </div>
              <select
                value={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.value)}
                className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-bold text-slate-800"
              >
                <option value="false">Live (Normal Operation)</option>
                <option value="true">Active (Maintenance Mode)</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Escrow Holding Period (Days)</p>
                <p className="text-[11px] text-slate-500">Days to hold payment before supplier payout release</p>
              </div>
              <input
                type="number"
                min="1"
                max="60"
                value={escrowHoldDays}
                onChange={(e) => setEscrowHoldDays(e.target.value)}
                className="w-20 p-1.5 rounded-lg border border-slate-200 text-center font-bold"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={savingKey === 'escrow_hold_days'}
                onClick={async () => {
                  await handleSaveSetting('maintenance_mode', maintenanceMode, 'general');
                  await handleSaveSetting('escrow_hold_days', escrowHoldDays, 'finance');
                }}
                className="px-4 py-2 rounded-xl bg-[#0b2716] hover:bg-emerald-950 text-white font-bold transition-colors inline-flex items-center gap-1.5"
              >
                <Save className="size-3.5" />
                <span>{savingKey === 'escrow_hold_days' ? 'Saving...' : 'Save Rules'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
