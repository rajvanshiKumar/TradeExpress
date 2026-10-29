import { useState, useEffect } from 'react';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Upload,
  CheckCircle2,
  Save,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import useNotifications from '../../hooks/useNotifications';
import useAuth from '../../hooks/useAuth';
import { fetchSupplierProfile, updateSupplierProfile } from '../../services/supplierDashboardApi';

export default function SupplierProfile() {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    country: 'India',
    postalCode: '',
    businessType: 'Manufacturer',
    companyDescription: '',
    businessAddress: '',
    factoryAddress: '',
    yearEstablished: new Date().getFullYear(),
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await fetchSupplierProfile();
      const p = res?.data || res || {};
      setForm({
        name: p.name || '',
        company: p.company || '',
        email: p.email || '',
        phone: p.phone || '',
        city: p.city || '',
        state: p.state || '',
        country: p.country || 'India',
        postalCode: p.postalCode || '',
        businessType: p.businessType || 'Manufacturer',
        companyDescription: p.companyDescription || '',
        businessAddress: p.businessAddress || '',
        factoryAddress: p.factoryAddress || '',
        yearEstablished: p.yearEstablished || new Date().getFullYear(),
      });
    } catch (err) {
      showToast(err.message || 'Failed to load supplier profile', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Calculate Profile Completion Percentage
  const fieldsToCheck = [
    form.name,
    form.company,
    form.email,
    form.phone,
    form.city,
    form.state,
    form.postalCode,
    form.businessType,
    form.companyDescription,
    form.businessAddress,
  ];
  const filledCount = fieldsToCheck.filter((f) => String(f || '').trim().length > 0).length;
  const completionPercent = Math.round((filledCount / fieldsToCheck.length) * 100);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSupplierProfile(form);
      showToast('Supplier business profile updated successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Business Profile & Commercial Presence"
        description="Public merchant details displayed to verified B2B buyers across the TradeExpress wholesale network."
      />

      {/* Profile Completion Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-navy-950 flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-700" />
              Profile Completion Strength
            </span>
            <p className="text-xs text-muted mt-0.5">
              Complete supplier profiles receive higher discovery rank and priority buyer RFQ routing.
            </p>
          </div>
          <span className="text-base font-black text-emerald-800 font-mono">
            {completionPercent}%
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5 mt-3 overflow-hidden">
          <div
            className="bg-emerald-700 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="ts-card p-6 space-y-6 text-xs text-navy-950">
        <h3 className="text-sm font-bold border-b pb-2 text-navy-950">1. Commercial Entity Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-navy-900 block mb-1">Company / Entity Legal Name</label>
            <input
              type="text"
              required
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-navy-900 block mb-1">Authorized Contact Representative</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-navy-900 block mb-1">Business Email (Login & Notifications)</label>
            <input
              type="email"
              disabled
              value={form.email}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="font-bold text-navy-900 block mb-1">Verified Contact Mobile</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-navy-900 block mb-1">Business Classification / Type</label>
            <select
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
            >
              <option value="Manufacturer">Manufacturer / OEM</option>
              <option value="Wholesaler">Wholesaler & Stockist</option>
              <option value="Distributor">Authorized Distributor</option>
              <option value="Exporter">Direct Exporter</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-navy-900 block mb-1">Year Established</label>
            <input
              type="number"
              value={form.yearEstablished}
              onChange={(e) => setForm({ ...form, yearEstablished: parseInt(e.target.value, 10) || 2026 })}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="font-bold text-navy-900 block mb-1">Company Profile & Capabilities Summary</label>
          <textarea
            rows={3}
            value={form.companyDescription}
            onChange={(e) => setForm({ ...form, companyDescription: e.target.value })}
            placeholder="Brief overview of factory infrastructure, monthly manufacturing capacity, and export capabilities..."
            className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
          />
        </div>

        <h3 className="text-sm font-bold border-b pb-2 text-navy-950 pt-2">2. Operating Locations & Registered Address</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="font-bold text-navy-900 block mb-1">City</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-navy-900 block mb-1">State / Province</label>
            <input
              type="text"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-navy-900 block mb-1">Postal / PIN Code</label>
            <input
              type="text"
              value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="font-bold text-navy-900 block mb-1">Registered Business Address</label>
          <input
            type="text"
            value={form.businessAddress}
            onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
            placeholder="Plot / Street / Industrial Area / Landmark"
            className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
          />
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={Save}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Profile Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
