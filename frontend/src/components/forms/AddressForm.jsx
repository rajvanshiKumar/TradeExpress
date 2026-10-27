import { useState } from 'react';
import Input, { Checkbox } from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import { COUNTRIES } from '../../utils/constants';
import { focusFirstError, hasErrors, mobileExample, parseMobile, rules, validate } from '../../utils/validators';

const schema = {
  label: [rules.required('Address label'), rules.maxLength('Address label', 30)],
  name: [rules.required('Contact name')],
  phone: [rules.required('Mobile number'), rules.mobile('country')],
  line1: [rules.required('Address line 1')],
  city: [rules.required('City')],
  postalCode: [rules.required('Postal code'), rules.minLength('Postal code', 3)],
  country: [rules.required('Country')],
};

export const EMPTY_ADDRESS = { label: '', name: '', company: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'India', isDefault: false };

export function AddressBlock({ address, className = '' }) {
  if (!address) return null;
  return (
    <address className={`text-sm not-italic text-ink ${className}`}>
      <span className="font-semibold">{address.name}</span>{address.company ? `, ${address.company}` : ''}<br />
      {address.line1}{address.line2 ? `, ${address.line2}` : ''}<br />
      {address.city}{address.state ? `, ${address.state}` : ''} {address.postalCode}<br />
      {address.country}<br />
      <span className="text-muted">{address.phone}</span>
    </address>
  );
}

export default function AddressForm({ initial = EMPTY_ADDRESS, onSubmit, onCancel, submitLabel = 'Save address', idPrefix = 'address-', showDefault = true }) {
  const [values, setValues] = useState({ ...EMPTY_ADDRESS, ...initial });
  const [errors, setErrors] = useState({});

  const set = (field) => (event) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: '' }));
  };

  const submit = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const found = validate(schema, values);
    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found, idPrefix);
    const clean = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
    return onSubmit({ ...clean, phone: parseMobile(clean.phone, clean.country).international });
  };

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input id={`${idPrefix}label`} label="Address label" required placeholder="e.g. Head office" value={values.label} onChange={set('label')} error={errors.label} />
      <Input id={`${idPrefix}name`} label="Contact name" required autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} />
      <Input id={`${idPrefix}company`} label="Company" autoComplete="organization" value={values.company} onChange={set('company')} />
      <Input id={`${idPrefix}phone`} label="Mobile number" required type="tel" autoComplete="tel" value={values.phone} onChange={set('phone')} error={errors.phone} hint={`e.g. ${mobileExample(values.country)}`} />
      <Input id={`${idPrefix}line1`} label="Address line 1" required autoComplete="address-line1" value={values.line1} onChange={set('line1')} error={errors.line1} wrapperClassName="sm:col-span-2" />
      <Input id={`${idPrefix}line2`} label="Address line 2" autoComplete="address-line2" value={values.line2} onChange={set('line2')} wrapperClassName="sm:col-span-2" />
      <Input id={`${idPrefix}city`} label="City" required autoComplete="address-level2" value={values.city} onChange={set('city')} error={errors.city} />
      <Input id={`${idPrefix}state`} label="State / region" autoComplete="address-level1" value={values.state} onChange={set('state')} />
      <Input id={`${idPrefix}postalCode`} label="Postal code" required autoComplete="postal-code" value={values.postalCode} onChange={set('postalCode')} error={errors.postalCode} />
      <Select id={`${idPrefix}country`} label="Country" required options={COUNTRIES} value={values.country} onChange={set('country')} error={errors.country} />
      {showDefault ? <Checkbox id={`${idPrefix}isDefault`} label="Use as my default delivery address" checked={Boolean(values.isDefault)} onChange={(checked) => setValues((previous) => ({ ...previous, isDefault: checked }))} className="sm:col-span-2" /> : null}
      <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
        {onCancel ? <Button variant="outline" onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" variant="navy">{submitLabel}</Button>
      </div>
    </form>
  );
}
