import { useState } from 'react';
import { Save, Lock, ShieldCheck, KeyRound, LogOut, Eye, EyeOff } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Input, { Textarea } from '../../components/common/Input';
import Select from '../../components/common/Select';
import Button from '../../components/common/Button';
import CompanyLogo from '../../components/common/CompanyLogo';
import SupplierGuard from './SupplierGuard';
import PasswordValidationIndicator from '../../components/common/PasswordValidationIndicator';
import useProducts from '../../hooks/useProducts';
import useNotifications from '../../hooks/useNotifications';
import useAuth from '../../hooks/useAuth';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { BUSINESS_TYPES, COUNTRIES } from '../../utils/constants';
import { focusFirstError, hasErrors, rules, validate } from '../../utils/validators';
import { validatePassword } from '../../utils/passwordRules';
import { apiPost } from '../../services/apiClient';

const RESPONSE_TIMES = ['Within 6 hours', 'Within 12 hours', 'Within 24 hours', 'Within 48 hours'];
const EMPLOYEES = ['1–10', '11–50', '51–200', '201–500', '501–1,000', '1,000+'];
const COLOURS = ['#123F25', '#1D4ED8', '#0F766E', '#15803D', '#B45309', '#BE185D', '#7C2D12', '#4338CA', '#334155'];

const schema = {
  name: [rules.required('Company name'), rules.minLength('Company name', 3)],
  country: [rules.required('Country')],
  industry: [rules.required('Industry')],
  description: [rules.required('Company description'), rules.minLength('Company description', 30), rules.maxLength('Company description', 800)],
  established: [rules.required('Year established'), rules.number('Year established', { min: 1800, max: new Date().getFullYear(), integer: true })],
  contactEmail: [rules.email()],
  contactPhone: [rules.phone()],
};

function Settings({ company }) {
  const { updateCompany } = useProducts();
  const { showToast } = useNotifications();
  const { logout, user } = useAuth();

  const [values, setValues] = useState({
    name: company.name, city: company.city ?? '', country: company.country ?? '', industry: company.industry ?? '', businessType: company.businessType,
    established: String(company.established ?? ''), employees: company.employees ?? '1–10', responseTime: company.responseTime ?? 'Within 24 hours', color: company.color ?? '#123F25',
    description: company.description ?? '', mainProducts: (company.mainProducts ?? []).join(', '), moqInfo: company.moqInfo ?? '',
    contactPerson: company.contact?.person ?? '', contactEmail: company.contact?.email ?? '', contactPhone: company.contact?.phone ?? '', contactAddress: company.contact?.address ?? '',
  });
  const [errors, setErrors] = useState({});

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const set = (field) => (event) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: '' }));
  };

  const submit = (event) => {
    event.preventDefault();
    const found = validate(schema, values);
    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found, 'company-');
    const name = values.name.trim();
    updateCompany(company.id, {
      name, city: values.city.trim(), country: values.country, industry: values.industry.trim(), businessType: values.businessType, established: Number(values.established),
      employees: values.employees, responseTime: values.responseTime, color: values.color, description: values.description.trim(), moqInfo: values.moqInfo.trim(),
      mainProducts: values.mainProducts.split(',').map((item) => item.trim()).filter(Boolean),
      initials: name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(),
      contact: { person: values.contactPerson.trim(), email: values.contactEmail.trim(), phone: values.contactPhone.trim(), address: values.contactAddress.trim() },
    });
    return showToast('Company profile saved. Your public profile is updated.');
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      showToast('Please enter your current password.', 'error');
      return;
    }
    const passEval = validatePassword(newPassword);
    if (!passEval.isValid) {
      showToast(passEval.message, 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }

    setChangingPassword(true);
    try {
      await apiPost('auth/change-password', {
        currentPassword,
        newPassword,
      });
      showToast('Password changed successfully! Keep your credentials secure.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showToast(err.message || 'Failed to update password. Verify current password.', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Settings & Account Security"
        description="Manage company details, access credentials, and security controls."
        actions={
          <Button to={`/suppliers/${company.slug || company.id}`} variant="outline" size="sm">
            View public profile
          </Button>
        }
      />

      <form onSubmit={submit} noValidate className="space-y-6">
        <fieldset className="ts-card p-5 sm:p-6">
          <legend className="float-left mb-4 w-full font-display text-base font-bold text-navy-900">
            Company Profile & Industry
          </legend>
          <div className="grid grid-cols-1 clear-both gap-4 sm:grid-cols-2">
            <Input id="company-name" label="Company name" required value={values.name} onChange={set('name')} error={errors.name} />
            <Input id="company-industry" label="Industry" required value={values.industry} onChange={set('industry')} error={errors.industry} />
            <Input id="company-city" label="City" value={values.city} onChange={set('city')} />
            <Select id="company-country" label="Country" required options={COUNTRIES.includes(values.country) || !values.country ? COUNTRIES : [values.country, ...COUNTRIES]} value={values.country} onChange={set('country')} error={errors.country} />
            <Select id="company-businessType" label="Business type" options={BUSINESS_TYPES} value={values.businessType} onChange={set('businessType')} />
            <Input id="company-established" label="Year established" required type="number" inputMode="numeric" value={values.established} onChange={set('established')} error={errors.established} />
            <Select id="company-employees" label="Employees" options={EMPLOYEES.includes(values.employees) ? EMPLOYEES : [values.employees, ...EMPLOYEES]} value={values.employees} onChange={set('employees')} />
            <Select id="company-responseTime" label="Typical response time" options={RESPONSE_TIMES.includes(values.responseTime) ? RESPONSE_TIMES : [values.responseTime, ...RESPONSE_TIMES]} value={values.responseTime} onChange={set('responseTime')} />
            <Textarea id="company-description" label="Company description" required rows={4} value={values.description} onChange={set('description')} error={errors.description} hint={`${values.description.length}/800 characters`} wrapperClassName="sm:col-span-2" />
            <Input id="company-mainProducts" label="Main products" value={values.mainProducts} onChange={set('mainProducts')} hint="Separate with commas." wrapperClassName="sm:col-span-2" />
            <Input id="company-moqInfo" label="Minimum order information" value={values.moqInfo} onChange={set('moqInfo')} wrapperClassName="sm:col-span-2" />
          </div>
        </fieldset>

        <fieldset className="ts-card p-5 sm:p-6">
          <legend className="float-left mb-4 w-full font-display text-base font-bold text-navy-900">
            Logo & Brand Theme
          </legend>
          <div className="flex clear-both flex-wrap items-center gap-4">
            <CompanyLogo company={{ ...company, color: values.color, initials: values.name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() }} size="lg" />
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Logo colour">
              {COLOURS.map((colour) => (
                <button
                  key={colour}
                  type="button"
                  role="radio"
                  aria-checked={values.color === colour}
                  aria-label={`Colour ${colour}`}
                  onClick={() => setValues((previous) => ({ ...previous, color: colour }))}
                  style={{ backgroundColor: colour }}
                  className={`size-9 rounded-full ring-offset-2 ${values.color === colour ? 'ring-2 ring-brand-500' : ''}`}
                />
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="ts-card p-5 sm:p-6">
          <legend className="float-left mb-4 w-full font-display text-base font-bold text-navy-900">
            Commercial Contact Details
          </legend>
          <div className="grid grid-cols-1 clear-both gap-4 sm:grid-cols-2">
            <Input id="company-contactPerson" label="Contact person" value={values.contactPerson} onChange={set('contactPerson')} />
            <Input id="company-contactEmail" label="Contact email" type="email" value={values.contactEmail} onChange={set('contactEmail')} error={errors.contactEmail} />
            <Input id="company-contactPhone" label="Contact phone" type="tel" value={values.contactPhone} onChange={set('contactPhone')} error={errors.contactPhone} />
            <Input id="company-contactAddress" label="Address" value={values.contactAddress} onChange={set('contactAddress')} />
          </div>
        </fieldset>

        <div className="flex justify-end">
          <Button type="submit" size="md" icon={Save}>
            Save Company Profile
          </Button>
        </div>
      </form>

      {/* Security & Authentication Credentials Card */}
      <div className="ts-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <KeyRound className="size-5 text-emerald-800" />
          <div>
            <h3 className="font-bold text-sm text-navy-950">Account Security & Credentials</h3>
            <p className="text-xs text-muted">Update your portal password and manage active authentication sessions.</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="font-bold text-xs text-navy-900 block mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 pr-10 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="font-bold text-xs text-navy-900 block mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 pr-10 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="font-bold text-xs text-navy-900 block mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 pr-10 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Real-time Password Requirements Checklist & Confirm Match Status */}
          <div className="sm:col-span-3">
            <PasswordValidationIndicator
              password={newPassword}
              confirmPassword={confirmPassword}
              showConfirmMatch={true}
            />
          </div>

          <div className="sm:col-span-3 flex justify-end">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              icon={Lock}
              disabled={changingPassword}
            >
              {changingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>

        <div className="border-t pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-navy-900 block">Session Management</span>
            <span className="text-muted text-[11px]">Signed in as: {user?.email} ({user?.role?.toUpperCase()})</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={LogOut}
            onClick={logout}
            className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
          >
            Sign out of all sessions
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SupplierSettings() {
  useDocumentTitle('Settings & Security · TradeExpress');
  return <SupplierGuard>{(company) => <Settings key={company.id} company={company} />}</SupplierGuard>;
}
