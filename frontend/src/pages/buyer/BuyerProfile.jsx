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
import { focusFirstError, hasErrors, mobileExample, parseMobile, rules, validate } from '../../utils/validators';

const schema = {
  name: [rules.required('Full name'), rules.minLength('Full name', 2)],
  company: [rules.required('Company name')],
  country: [rules.required('Country')],
  city: [rules.required('City')],
  phone: [rules.required('Mobile number'), rules.mobile('country')],
};

const NOTIFICATION_OPTIONS = [
  { key: 'orders', label: 'Order updates', description: 'When an order is placed or its status changes.' },
  { key: 'quotes', label: 'Quote updates', description: 'When a supplier adds a quote to your request.' },
  { key: 'messages', label: 'Messages', description: 'Show the unread badge for new messages.' },
];

export default function BuyerProfile() {
  const { user, updateProfile } = useAuth();
  const { showToast } = useNotifications();
  const [values, setValues] = useState({ name: user.name, company: user.company ?? '', phone: user.phone ?? '', country: user.country ?? 'India', city: user.city ?? '' });
  const [errors, setErrors] = useState({});
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...user.notificationPrefs };
  useDocumentTitle('Profile & settings');

  const set = (field) => (event) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: '' }));
  };

  const submit = (event) => {
    event.preventDefault();
    const found = validate(schema, values);
    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found, 'profile-');
    updateProfile({ name: values.name.trim(), company: values.company.trim(), phone: parseMobile(values.phone, values.country).international, country: values.country, city: values.city.trim() });
    return showToast('Profile saved.');
  };

  const togglePref = (key, checked) => {
    updateProfile({ notificationPrefs: { ...prefs, [key]: checked } });
    showToast('Notification preference updated.');
  };

  return (
    <div className="space-y-6">
      <SectionHeading title="Profile & settings" description="Saved in this browser only." />

      <form onSubmit={submit} noValidate className="ts-card p-5 sm:p-6">
        <h2 className="mb-4 text-base font-bold">Profile</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="profile-name" label="Full name" required autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} />
          <Input id="profile-email" label="Email" value={user.email} disabled readOnly hint="Your sign-in email cannot be changed." />
          <Input id="profile-company" label="Company name" required autoComplete="organization" value={values.company} onChange={set('company')} error={errors.company} />
          <Select id="profile-country" label="Country" required options={COUNTRIES} value={values.country} onChange={set('country')} error={errors.country} />
          <Input id="profile-city" label="City" required autoComplete="address-level2" value={values.city} onChange={set('city')} error={errors.city} />
          <Input id="profile-phone" label="Mobile number" required type="tel" autoComplete="tel" value={values.phone} onChange={set('phone')} error={errors.phone} hint={`e.g. ${mobileExample(values.country)}`} />
        </div>
        <div className="mt-5 flex justify-end"><Button type="submit" variant="navy" icon={Save}>Save profile</Button></div>
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
