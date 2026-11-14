import { useState } from 'react';
import { Save } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Input, { Checkbox } from '../../components/common/Input';
import Select from '../../components/common/Select';
import Button from '../../components/common/Button';
import { PreferenceFields } from '../../components/layout/PreferencesMenu';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { DEFAULT_NOTIFICATION_PREFS } from '../../data/users';
import { COUNTRIES } from '../../utils/constants';
import { apiPut } from '../../services/apiClient';
import { focusFirstError, hasErrors, rules, validate } from '../../utils/validators';

// Mobile number is not edited here: changing it needs OTP verification in Account Settings.
const schema = {
  name: [rules.required('Full name'), rules.minLength('Full name', 2)],
  company: [rules.required('Company name')],
  country: [rules.required('Country')],
  city: [rules.required('City')],
};

const NOTIFICATION_OPTIONS = [
  { key: 'orders', label: 'Order updates', description: 'When an order is placed or its status changes.' },
  { key: 'quotes', label: 'Quote updates', description: 'When a supplier adds a quote to your request.' },
  { key: 'messages', label: 'Messages', description: 'Show the unread badge for new messages.' },
];

export default function BuyerProfile() {
  const { user, updateProfile } = useAuth();
  const { showToast } = useNotifications();
  const [values, setValues] = useState({ name: user.name, company: user.company ?? '', country: user.country ?? 'India', city: user.city ?? '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...user.notificationPrefs };
  useDocumentTitle('Profile & settings');

  const set = (field) => (event) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: '' }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const found = validate(schema, values);
    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found, 'profile-');

    const payload = {
      name: values.name.trim(),
      company: values.company.trim(),
      country: values.country,
      city: values.city.trim(),
    };

    setSaving(true);
    try {
      // Saved to the TradeExpress account on the server, then mirrored into this session.
      const res = await apiPut('auth/profile', payload);
      const saved = res?.data || {};
      const next = {
        name: saved.name ?? payload.name,
        company: saved.company ?? payload.company,
        country: saved.country ?? payload.country,
        city: saved.city ?? payload.city,
      };
      updateProfile(next);
      setValues(next);
      showToast('Profile saved.');
    } catch (error) {
      const fieldErrors = Array.isArray(error?.data?.errors) ? error.data.errors : [];
      if (fieldErrors.length) {
        const mapped = Object.fromEntries(fieldErrors.filter((item) => item?.field).map((item) => [item.field, item.message]));
        setErrors(mapped);
        focusFirstError(mapped, 'profile-');
      }
      showToast(error?.message && error.message !== 'Validation failed' ? error.message : 'Could not save your profile. Please check the details and try again.', 'error');
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  const togglePref = (key, checked) => {
    updateProfile({ notificationPrefs: { ...prefs, [key]: checked } });
    showToast('Notification preference updated.');
  };

  return (
    <div className="space-y-6">
      <SectionHeading title="Profile & settings" description="Your business details on TradeExpress." />

      <form onSubmit={submit} noValidate className="ts-card p-5 sm:p-6">
        <h2 className="mb-4 text-base font-bold">Profile</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="profile-name" label="Full name" required autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} />
          <Input id="profile-email" label="Email" value={user.email} disabled readOnly hint="Your sign-in email cannot be changed." />
          <Input id="profile-company" label="Company name" required autoComplete="organization" value={values.company} onChange={set('company')} error={errors.company} />
          <Select id="profile-country" label="Country" required options={COUNTRIES} value={values.country} onChange={set('country')} error={errors.country} />
          <Input id="profile-city" label="City" required autoComplete="address-level2" value={values.city} onChange={set('city')} error={errors.city} />
          <Input id="profile-phone" label="Mobile number" type="tel" value={user.phone ?? ''} disabled readOnly hint="To change your mobile number, go to Account Settings (OTP verification)." />
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" variant="navy" icon={Save} loading={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </form>

      <section className="ts-card p-5 sm:p-6" aria-labelledby="notification-prefs-title">
        <h2 id="notification-prefs-title" className="text-base font-bold">Notification preferences</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Choose which in-app notifications appear under the bell icon. No emails are ever sent.</p>
        <div className="space-y-3.5">
          {NOTIFICATION_OPTIONS.map((option) => (
            <Checkbox key={option.key} id={`notify-${option.key}`} label={option.label} description={option.description} checked={Boolean(prefs[option.key])} onChange={(checked) => togglePref(option.key, checked)} />
          ))}
        </div>
      </section>

      <section className="ts-card p-5 sm:p-6" aria-labelledby="region-prefs-title">
        <h2 id="region-prefs-title" className="mb-4 text-base font-bold">Region, language and currency</h2>
        <div className="max-w-sm"><PreferenceFields idPrefix="profile-pref" /></div>
      </section>
    </div>
  );
}
