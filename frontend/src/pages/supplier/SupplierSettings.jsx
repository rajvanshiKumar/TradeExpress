import { useState } from 'react';
import { Save } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Input, { Textarea } from '../../components/common/Input';
import Select from '../../components/common/Select';
import Button from '../../components/common/Button';
import CompanyLogo from '../../components/common/CompanyLogo';
import SupplierGuard from './SupplierGuard';
import useProducts from '../../hooks/useProducts';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { BUSINESS_TYPES, COUNTRIES } from '../../utils/constants';
import { focusFirstError, hasErrors, rules, validate } from '../../utils/validators';

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
  const [values, setValues] = useState({
    name: company.name, city: company.city ?? '', country: company.country ?? '', industry: company.industry ?? '', businessType: company.businessType,
    established: String(company.established ?? ''), employees: company.employees ?? '1–10', responseTime: company.responseTime ?? 'Within 24 hours', color: company.color ?? '#123F25',
    description: company.description ?? '', mainProducts: (company.mainProducts ?? []).join(', '), moqInfo: company.moqInfo ?? '',
    contactPerson: company.contact?.person ?? '', contactEmail: company.contact?.email ?? '', contactPhone: company.contact?.phone ?? '', contactAddress: company.contact?.address ?? '',
  });
  const [errors, setErrors] = useState({});

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

  return (
    <div>
      <SectionHeading title="Company settings" description="Edit the public profile buyers see in the supplier directory." actions={<Button to={`/suppliers/${company.slug}`} variant="outline" size="sm">View public profile</Button>} />
      <form onSubmit={submit} noValidate className="space-y-6">
        <fieldset className="ts-card p-5 sm:p-6">
          <legend className="float-left mb-4 w-full font-display text-base font-bold text-navy-900">Company profile</legend>
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
          <legend className="float-left mb-4 w-full font-display text-base font-bold text-navy-900">Logo colour</legend>
          <div className="flex clear-both flex-wrap items-center gap-4">
            <CompanyLogo company={{ ...company, color: values.color, initials: values.name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() }} size="lg" />
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Logo colour">
              {COLOURS.map((colour) => (
                <button key={colour} type="button" role="radio" aria-checked={values.color === colour} aria-label={`Colour ${colour}`} onClick={() => setValues((previous) => ({ ...previous, color: colour }))} style={{ backgroundColor: colour }} className={`size-9 rounded-full ring-offset-2 ${values.color === colour ? 'ring-2 ring-brand-500' : ''}`} />
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="ts-card p-5 sm:p-6">
          <legend className="float-left mb-4 w-full font-display text-base font-bold text-navy-900">Contact details</legend>
          <div className="grid grid-cols-1 clear-both gap-4 sm:grid-cols-2">
            <Input id="company-contactPerson" label="Contact person" value={values.contactPerson} onChange={set('contactPerson')} />
            <Input id="company-contactEmail" label="Contact email" type="email" value={values.contactEmail} onChange={set('contactEmail')} error={errors.contactEmail} />
            <Input id="company-contactPhone" label="Contact phone" type="tel" value={values.contactPhone} onChange={set('contactPhone')} error={errors.contactPhone} />
            <Input id="company-contactAddress" label="Address" value={values.contactAddress} onChange={set('contactAddress')} />
          </div>
          <p className="mt-3 text-xs text-muted">Shown on your public company profile.</p>
        </fieldset>

        <div className="flex justify-end"><Button type="submit" size="lg" icon={Save}>Save company profile</Button></div>
      </form>
    </div>
  );
}

export default function SupplierSettings() {
  useDocumentTitle('Company settings');
  return <SupplierGuard>{(company) => <Settings key={company.id} company={company} />}</SupplierGuard>;
}
