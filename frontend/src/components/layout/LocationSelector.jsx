import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import Button from '../common/Button';
import Modal from '../common/Modal';
import CountryFlag from '../common/CountryFlag';
import useLocationPreference from '../../hooks/useLocationPreference';
import { COUNTRY_CODES, countryName, hasPostalFormat, postalHint, postalLabel, validatePostalCode } from '../../utils/countryData';
import { locationLabel } from '../../utils/locationStore';

// All 249 countries and territories, alphabetical by English name
const COUNTRIES = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name, 'en'));

/** A searchable country list with flags. */
function CountryPicker({ id, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const listId = useId();

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return COUNTRIES;
    // Name matches first, then a match on the two-letter code
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(term) || c.code.toLowerCase() === term)
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(term)) - Number(!b.name.toLowerCase().startsWith(term)));
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    // The list always opens at the top, with its scrollbar at the start
    setActive(0);
    window.requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = 0;
      searchRef.current?.focus();
    });
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (code) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(i + 1, matches.length - 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    if (event.key === 'Enter' && matches[active]) { event.preventDefault(); choose(matches[active].code); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); }
  };

  const selected = COUNTRIES.find((c) => c.code === value);
  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-11 w-full items-center gap-2.5 rounded-xl border bg-white px-3.5 text-left text-sm font-medium text-ink transition-colors ${open ? 'border-navy-800 ring-2 ring-brand-500/40' : 'border-line hover:border-navy-600'}`}
      >
        <CountryFlag code={value} />
        <span className="min-w-0 flex-1 truncate">{selected?.name || 'Choose a country'}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open ? (
        <div className="ts-dropdown-anim-left absolute inset-x-0 top-[calc(100%+0.375rem)] z-10 overflow-hidden rounded-xl border border-line bg-white shadow-pop">
          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute left-4.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
              placeholder="Search country"
              aria-label="Search country"
              aria-controls={listId}
              aria-activedescendant={matches[active] ? `${listId}-${matches[active].code}` : undefined}
              className="ts-input !pl-9"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label="Countries" className="ts-slim-scrollbar max-h-64 overflow-y-auto p-1.5">
            {matches.map((c, index) => (
              <li
                key={c.code}
                id={`${listId}-${c.code}`}
                data-index={index}
                role="option"
                aria-selected={c.code === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(c.code)}
                onMouseMove={() => setActive(index)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${index === active ? 'bg-navy-50' : ''} ${c.code === value ? 'font-semibold text-navy-900' : 'text-ink'}`}
              >
                <CountryFlag code={c.code} />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {c.code === value ? <Check className="size-4 shrink-0 text-navy-800" aria-hidden="true" /> : null}
              </li>
            ))}
            {!matches.length ? <li className="px-2.5 py-3 text-sm text-muted">No country matches “{query}”.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Country and postal code, with Save. Used in the header popup, the mobile menu and Account Settings. */
export function LocationForm({ idPrefix = 'location', onSaved }) {
  const { location, saveLocation } = useLocationPreference();
  const [countryCode, setCountryCode] = useState(location.countryCode);
  const [postal, setPostal] = useState(location.postalCode);
  const [error, setError] = useState('');
  const [accountError, setAccountError] = useState('');
  const [saving, setSaving] = useState(false);

  const hint = postalHint(countryCode);

  const changeCountry = (code) => {
    setCountryCode(code);
    setError('');
    // A postal code entered for another country is kept only if it fits the new country's own format
    if (postal && (!hasPostalFormat(code) || !validatePostalCode(code, postal).ok)) setPostal('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const check = validatePostalCode(countryCode, postal);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setSaving(true);
    setAccountError('');
    // A new country brings its own currency; the same country keeps a currency picked by hand
    const sameCountry = countryCode === location.countryCode;
    const result = await saveLocation({
      countryCode,
      postalCode: check.value,
      displayCurrency: sameCountry ? location.displayCurrency : undefined,
      currencyManual: sameCountry && location.currencyManual,
    });
    setSaving(false);
    setPostal(check.value);
    if (!result.ok) {
      setAccountError(result.message);
      return;
    }
    onSaved?.(result.location);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor={`${idPrefix}-country`} className="ts-label">Country / region</label>
        <CountryPicker id={`${idPrefix}-country`} value={countryCode} onChange={changeCountry} />
      </div>
      <div>
        <input
          id={`${idPrefix}-postal`}
          type="text"
          autoComplete="postal-code"
          maxLength={12}
          placeholder="Enter ZIP or postal code"
          value={postal}
          onChange={(event) => { setPostal(event.target.value.toUpperCase()); setError(''); }}
          aria-invalid={error ? 'true' : undefined}
          aria-label={postalLabel(countryCode)}
          aria-describedby={error ? `${idPrefix}-postal-error` : `${idPrefix}-postal-hint`}
          className="ts-input h-11 uppercase"
        />
        {error
          ? <p id={`${idPrefix}-postal-error`} role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">{error}</p>
          : <p id={`${idPrefix}-postal-hint`} className="mt-1.5 text-[0.8125rem] text-muted">{hint}</p>}
      </div>
      {accountError ? <p role="alert" className="text-[0.8125rem] font-medium text-danger">{accountError}</p> : null}
      <Button type="submit" variant="navy" full loading={saving} disabled={saving}>Save</Button>
    </form>
  );
}

/** Header button showing the saved flag and postal code; opens the selector. */
export default function LocationSelector({ className = '' }) {
  const { location } = useLocationPreference();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delivery location: ${location.countryName}${location.postalCode ? ` ${location.postalCode}` : ''}. Change`}
        className={`inline-flex h-8 items-center gap-1 rounded-full border border-slate-200/90 bg-white/95 px-2 text-xs font-bold text-slate-900 shadow-2xs transition-colors hover:border-emerald-600/50 sm:h-8.5 sm:gap-1.5 sm:px-3 xl:h-9 ${className}`}
      >
        <CountryFlag code={location.countryCode} className="!h-2.5 !w-3.5 !rounded-[2px]" />
        {/* Smaller screens show only the country code, so a long postcode never pushes Sign up out of view */}
        <span className="whitespace-nowrap tabular-nums min-[1440px]:hidden">{location.countryCode}</span>
        <span className="hidden whitespace-nowrap tabular-nums min-[1440px]:inline">{locationLabel(location)}</span>
        <ChevronDown className="size-2.5 text-slate-400" aria-hidden="true" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Your location" size="sm">
        <div className="px-5 pb-5 pt-1 sm:px-6 sm:pb-6">
          <LocationForm idPrefix="header-location" onSaved={() => setOpen(false)} />
        </div>
      </Modal>
    </>
  );
}
