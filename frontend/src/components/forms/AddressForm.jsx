import { useRef, useState } from 'react';
import { CircleAlert, Lock, Search } from 'lucide-react';
import Input, { Checkbox, Field } from '../common/Input';
import CustomSelect from '../common/CustomSelect';
import Button from '../common/Button';
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_PHONE_RULES } from '../../utils/constants';
import { focusFirstError, hasErrors, parseMobile, rules, validate } from '../../utils/validators';

const schema = {
  country: [rules.required('Country / region')],
  firstName: [rules.required('First name'), rules.maxLength('First name', 60)],
  lastName: [rules.required('Last name'), rules.maxLength('Last name', 60)],
  phone: [rules.required('Phone number'), rules.mobile('country')],
  street: [rules.required('Street address or P.O. box'), rules.maxLength('Street address', 180)],
  apartment: [rules.maxLength('Apartment, suite, unit', 120)],
  city: [rules.required('City'), rules.maxLength('City', 80)],
  state: [rules.required('State / province'), rules.maxLength('State / province', 80)],
  postalCode: [rules.pinCode('country')],
};

export const EMPTY_ADDRESS = {
  country: 'India', firstName: '', lastName: '', phone: '', street: '', apartment: '', city: '', state: '', postalCode: '', isDefault: false,
};

const COUNTRY_OPTIONS = COUNTRIES.map((country) => ({ value: country, label: `${COUNTRY_FLAGS[country] ?? ''} ${country}`.trim() }));

/** Read-only address card. Accepts saved addresses and the address snapshot stored on older orders. */
export function AddressBlock({ address, className = '' }) {
  if (!address) return null;
  const name = address.name || [address.firstName, address.lastName].filter(Boolean).join(' ');
  const line1 = address.line1 || address.street;
  const line2 = address.line2 || address.apartment;
  return (
    <address className={`text-sm not-italic text-ink ${className}`}>
      <span className="font-semibold">{name}</span>{address.company ? `, ${address.company}` : ''}<br />
      {line1}{line2 ? `, ${line2}` : ''}<br />
      {address.city}{address.state ? `, ${address.state}` : ''} {address.postalCode}<br />
      {address.country}<br />
      <span className="text-muted">{address.phone}</span>
    </address>
  );
}

/** Keeps only the national digits of a saved number so the calling code is shown separately. */
const nationalPart = (phone, country) => {
  const parsed = parseMobile(phone, country);
  return parsed.national ?? String(phone ?? '');
};

/**
 * Add / edit address form. `onSubmit(values)` may be async: while it runs the form is locked,
 * and if it throws, the error message (and any per-field errors) are shown in the form.
 */
export default function AddressForm({
  initial = EMPTY_ADDRESS, onSubmit, onCancel, submitLabel = 'Submit', idPrefix = 'address-', showDefault = true, lockDefault = false,
}) {
  const start = { ...EMPTY_ADDRESS, ...initial };
  const [values, setValues] = useState({ ...start, phone: start.phone ? nationalPart(start.phone, start.country) : '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [lookup, setLookup] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false); // blocks a second submit before React re-renders the disabled button

  const dial = COUNTRY_PHONE_RULES[values.country]?.dial;
  const example = COUNTRY_PHONE_RULES[values.country]?.example ?? '';

  const update = (field, value) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: '' }));
    setFormError('');
  };
  const set = (field) => (event) => update(field, event.target.value);

  const changeCountry = (event) => {
    update('country', event.target.value);
    // Phone and postal rules depend on the country, so re-check them on the next submit
    setErrors((previous) => ({ ...previous, phone: '', postalCode: '' }));
  };

  // No geocoding service is connected, so this field never invents a location. Typing (or a browser
  // autofill suggestion) here is copied into an empty Street address field.
  const applyLookup = () => {
    const text = lookup.trim();
    if (text && !values.street.trim()) update('street', text);
  };

  const submit = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (inFlight.current) return;

    const trimmed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
    const found = validate(schema, trimmed);
    setErrors(found);
    if (hasErrors(found)) {
      focusFirstError(found, idPrefix);
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setFormError('');
    try {
      await onSubmit({ ...trimmed, phone: parseMobile(trimmed.phone, trimmed.country).international });
    } catch (error) {
      if (error?.fieldErrors && Object.keys(error.fieldErrors).length) setErrors((previous) => ({ ...previous, ...error.fieldErrors }));
      setFormError(error?.message || 'The address could not be saved. Please try again.');
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate aria-busy={submitting || undefined}>
      <p className="mb-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[0.8125rem] font-medium text-emerald-900">
        <Lock className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
        Your information is encrypted and secure
      </p>

      {formError ? (
        <p role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[0.8125rem] font-medium text-red-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {formError}
        </p>
      ) : null}

      <fieldset disabled={submitting} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={`${idPrefix}country`} label="Country / region" required error={errors.country} className="sm:col-span-2">
          <CustomSelect id={`${idPrefix}country`} value={values.country} onChange={changeCountry} options={COUNTRY_OPTIONS} required />
        </Field>

        <Input id={`${idPrefix}firstName`} label="First name" required autoComplete="given-name" value={values.firstName} onChange={set('firstName')} error={errors.firstName} />
        <Input id={`${idPrefix}lastName`} label="Last name" required autoComplete="family-name" value={values.lastName} onChange={set('lastName')} error={errors.lastName} />

        <Field id={`${idPrefix}phone`} label="Phone number" required error={errors.phone} hint={example ? `e.g. ${example}` : undefined} className="sm:col-span-2">
          <div className="flex">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-l-xl border border-r-0 border-navy-200 bg-surface px-3 text-sm font-semibold text-navy-900" aria-hidden="true">
              <span>{COUNTRY_FLAGS[values.country] ?? ''}</span>+{dial}
            </span>
            <input
              id={`${idPrefix}phone`} type="tel" inputMode="tel" autoComplete="tel-national" required aria-required="true"
              aria-label={`Phone number, calling code +${dial}`}
              aria-invalid={errors.phone ? 'true' : undefined} aria-describedby={errors.phone ? `${idPrefix}phone-error` : `${idPrefix}phone-hint`}
              value={values.phone} onChange={(event) => update('phone', event.target.value.replace(/[^\d\s-]/g, ''))}
              className="ts-input min-w-0 flex-1 rounded-l-none"
            />
          </div>
        </Field>

        <Input
          id={`${idPrefix}lookup`} label="Find your address" icon={Search} autoComplete="street-address" wrapperClassName="sm:col-span-2"
          value={lookup} onChange={(event) => setLookup(event.target.value)} onBlur={applyLookup}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyLookup(); } }}
          hint="Start typing or pick an address your browser has saved. Map search isn't available yet, so please check the fields below."
        />

        <Input id={`${idPrefix}street`} label="Street address or P.O. box" required autoComplete="address-line1" value={values.street} onChange={set('street')} error={errors.street} wrapperClassName="sm:col-span-2" />
        <Input id={`${idPrefix}apartment`} label="Apartment, suite, unit, building, floor" autoComplete="address-line2" value={values.apartment} onChange={set('apartment')} error={errors.apartment} wrapperClassName="sm:col-span-2" />
        <Input id={`${idPrefix}city`} label="City" required autoComplete="address-level2" value={values.city} onChange={set('city')} error={errors.city} />
        <Input id={`${idPrefix}state`} label="State / province" required autoComplete="address-level1" value={values.state} onChange={set('state')} error={errors.state} />
        <Input id={`${idPrefix}postalCode`} label="Postal code" required autoComplete="postal-code" inputMode={values.country === 'India' ? 'numeric' : 'text'} value={values.postalCode} onChange={set('postalCode')} error={errors.postalCode} />

        {showDefault ? (
          <Checkbox
            id={`${idPrefix}isDefault`} className="sm:col-span-2"
            label="Set as default shipping address"
            description={lockDefault ? 'This is your default shipping address. Choose another address as default to change it.' : undefined}
            checked={Boolean(values.isDefault)}
            onChange={(checked) => { if (!lockDefault) update('isDefault', checked); }}
          />
        ) : null}
      </fieldset>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        {onCancel ? <Button variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button> : null}
        <Button type="submit" variant="navy" loading={submitting}>{submitting ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  );
}
