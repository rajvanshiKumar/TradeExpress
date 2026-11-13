// Countries, their default currencies and postal code formats.
// The same file exists in the backend (backend/src/utils/countryData.js); a test keeps the two identical.

/** All 249 ISO 3166-1 alpha-2 country and territory codes. */
export const COUNTRY_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE',
  'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD',
  'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM',
  'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU',
  'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN',
  'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME',
  'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM',
  'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI',
  'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK',
  'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
];

/** Each country's default display currency (ISO 4217). Places without their own currency use the one in common use there. */
export const COUNTRY_CURRENCY = {
  AD: 'EUR', AE: 'AED', AF: 'AFN', AG: 'XCD', AI: 'XCD', AL: 'ALL', AM: 'AMD', AO: 'AOA', AQ: 'USD', AR: 'ARS', AS: 'USD', AT: 'EUR',
  AU: 'AUD', AW: 'AWG', AX: 'EUR', AZ: 'AZN', BA: 'BAM', BB: 'BBD', BD: 'BDT', BE: 'EUR', BF: 'XOF', BG: 'EUR', BH: 'BHD', BI: 'BIF',
  BJ: 'XOF', BL: 'EUR', BM: 'BMD', BN: 'BND', BO: 'BOB', BQ: 'USD', BR: 'BRL', BS: 'BSD', BT: 'BTN', BV: 'NOK', BW: 'BWP', BY: 'BYN',
  BZ: 'BZD', CA: 'CAD', CC: 'AUD', CD: 'CDF', CF: 'XAF', CG: 'XAF', CH: 'CHF', CI: 'XOF', CK: 'NZD', CL: 'CLP', CM: 'XAF', CN: 'CNY',
  CO: 'COP', CR: 'CRC', CU: 'CUP', CV: 'CVE', CW: 'XCG', CX: 'AUD', CY: 'EUR', CZ: 'CZK', DE: 'EUR', DJ: 'DJF', DK: 'DKK', DM: 'XCD',
  DO: 'DOP', DZ: 'DZD', EC: 'USD', EE: 'EUR', EG: 'EGP', EH: 'MAD', ER: 'ERN', ES: 'EUR', ET: 'ETB', FI: 'EUR', FJ: 'FJD', FK: 'FKP',
  FM: 'USD', FO: 'DKK', FR: 'EUR', GA: 'XAF', GB: 'GBP', GD: 'XCD', GE: 'GEL', GF: 'EUR', GG: 'GBP', GH: 'GHS', GI: 'GIP', GL: 'DKK',
  GM: 'GMD', GN: 'GNF', GP: 'EUR', GQ: 'XAF', GR: 'EUR', GS: 'GBP', GT: 'GTQ', GU: 'USD', GW: 'XOF', GY: 'GYD', HK: 'HKD', HM: 'AUD',
  HN: 'HNL', HR: 'EUR', HT: 'HTG', HU: 'HUF', ID: 'IDR', IE: 'EUR', IL: 'ILS', IM: 'GBP', IN: 'INR', IO: 'USD', IQ: 'IQD', IR: 'IRR',
  IS: 'ISK', IT: 'EUR', JE: 'GBP', JM: 'JMD', JO: 'JOD', JP: 'JPY', KE: 'KES', KG: 'KGS', KH: 'KHR', KI: 'AUD', KM: 'KMF', KN: 'XCD',
  KP: 'KPW', KR: 'KRW', KW: 'KWD', KY: 'KYD', KZ: 'KZT', LA: 'LAK', LB: 'LBP', LC: 'XCD', LI: 'CHF', LK: 'LKR', LR: 'LRD', LS: 'LSL',
  LT: 'EUR', LU: 'EUR', LV: 'EUR', LY: 'LYD', MA: 'MAD', MC: 'EUR', MD: 'MDL', ME: 'EUR', MF: 'EUR', MG: 'MGA', MH: 'USD', MK: 'MKD',
  ML: 'XOF', MM: 'MMK', MN: 'MNT', MO: 'MOP', MP: 'USD', MQ: 'EUR', MR: 'MRU', MS: 'XCD', MT: 'EUR', MU: 'MUR', MV: 'MVR', MW: 'MWK',
  MX: 'MXN', MY: 'MYR', MZ: 'MZN', NA: 'NAD', NC: 'XPF', NE: 'XOF', NF: 'AUD', NG: 'NGN', NI: 'NIO', NL: 'EUR', NO: 'NOK', NP: 'NPR',
  NR: 'AUD', NU: 'NZD', NZ: 'NZD', OM: 'OMR', PA: 'PAB', PE: 'PEN', PF: 'XPF', PG: 'PGK', PH: 'PHP', PK: 'PKR', PL: 'PLN', PM: 'EUR',
  PN: 'NZD', PR: 'USD', PS: 'ILS', PT: 'EUR', PW: 'USD', PY: 'PYG', QA: 'QAR', RE: 'EUR', RO: 'RON', RS: 'RSD', RU: 'RUB', RW: 'RWF',
  SA: 'SAR', SB: 'SBD', SC: 'SCR', SD: 'SDG', SE: 'SEK', SG: 'SGD', SH: 'SHP', SI: 'EUR', SJ: 'NOK', SK: 'EUR', SL: 'SLE', SM: 'EUR',
  SN: 'XOF', SO: 'SOS', SR: 'SRD', SS: 'SSP', ST: 'STN', SV: 'USD', SX: 'XCG', SY: 'SYP', SZ: 'SZL', TC: 'USD', TD: 'XAF', TF: 'EUR',
  TG: 'XOF', TH: 'THB', TJ: 'TJS', TK: 'NZD', TL: 'USD', TM: 'TMT', TN: 'TND', TO: 'TOP', TR: 'TRY', TT: 'TTD', TV: 'AUD', TW: 'TWD',
  TZ: 'TZS', UA: 'UAH', UG: 'UGX', UM: 'USD', US: 'USD', UY: 'UYU', UZ: 'UZS', VA: 'EUR', VC: 'XCD', VE: 'VES', VG: 'USD', VI: 'USD',
  VN: 'VND', VU: 'VUV', WF: 'XPF', WS: 'WST', YE: 'YER', YT: 'EUR', ZA: 'ZAR', ZM: 'ZMW', ZW: 'ZWG',
};

/** Places that do not use postal codes: the postal field is not asked for. */
export const NO_POSTAL_CODE = [
  'AE', 'AG', 'AO', 'AQ', 'AW', 'BF', 'BI', 'BJ', 'BO', 'BQ', 'BS', 'BV', 'BW', 'BZ', 'CD', 'CF', 'CG', 'CI', 'CK', 'CM',
  'CW', 'DJ', 'DM', 'ER', 'FJ', 'GA', 'GD', 'GH', 'GM', 'GQ', 'GY', 'HK', 'HM', 'KI', 'KM', 'KN', 'KP', 'LY', 'ML', 'MO', 'MR',
  'MS', 'MW', 'NR', 'NU', 'QA', 'RW', 'SB', 'SC', 'SL', 'SO', 'SR', 'SS', 'ST', 'SX', 'SY', 'TD', 'TF', 'TG', 'TK', 'TL', 'TO',
  'TT', 'TV', 'UG', 'UM', 'VU', 'YE', 'ZW',
];

/**
 * Postal code formats for countries with a fixed format. Values are checked after trimming and upper-casing.
 * `example` is shown in validation messages. Countries not listed accept 2–10 letters, digits, spaces or hyphens.
 */
export const POSTAL_RULES = {
  IN: { label: 'PIN code', pattern: '^[1-9]\\d{5}$', example: '110001' },
  US: { label: 'ZIP code', pattern: '^\\d{5}(-\\d{4})?$', example: '10001' },
  PR: { label: 'ZIP code', pattern: '^\\d{5}(-\\d{4})?$', example: '00901' },
  GB: { label: 'Postcode', pattern: '^(GIR 0AA|[A-PR-UWYZ][A-HK-Y]?\\d[A-Z\\d]? \\d[ABD-HJLNP-UW-Z]{2})$', example: 'SW1A 1AA', spaceBeforeLast: 3 },
  GG: { label: 'Postcode', pattern: '^GY\\d[\\dA-Z]? \\d[ABD-HJLNP-UW-Z]{2}$', example: 'GY1 1AA', spaceBeforeLast: 3 },
  JE: { label: 'Postcode', pattern: '^JE\\d[\\dA-Z]? \\d[ABD-HJLNP-UW-Z]{2}$', example: 'JE2 3AB', spaceBeforeLast: 3 },
  IM: { label: 'Postcode', pattern: '^IM\\d[\\dA-Z]? \\d[ABD-HJLNP-UW-Z]{2}$', example: 'IM1 1AA', spaceBeforeLast: 3 },
  CA: { label: 'Postal code', pattern: '^[ABCEGHJ-NPRSTVXY]\\d[ABCEGHJ-NPRSTV-Z] \\d[ABCEGHJ-NPRSTV-Z]\\d$', example: 'K1A 0B1', spaceBeforeLast: 3 },
  IE: { label: 'Eircode', pattern: '^([AC-FHKNPRTV-Y]\\d{2}|D6W) [0-9AC-FHKNPRTV-Y]{4}$', example: 'D02 X285', spaceBeforeLast: 4, optional: true },
  NL: { label: 'Postcode', pattern: '^\\d{4} [A-Z]{2}$', example: '1012 AB', spaceBeforeLast: 2 },
  DE: { pattern: '^\\d{5}$', example: '10115' },
  FR: { pattern: '^\\d{5}$', example: '75001' },
  IT: { label: 'CAP', pattern: '^\\d{5}$', example: '00118' },
  ES: { pattern: '^\\d{5}$', example: '28001' },
  PT: { pattern: '^\\d{4}-\\d{3}$', example: '1000-001' },
  BE: { pattern: '^\\d{4}$', example: '1000' },
  LU: { pattern: '^\\d{4}$', example: '1009' },
  AT: { pattern: '^\\d{4}$', example: '1010' },
  CH: { pattern: '^\\d{4}$', example: '8001' },
  LI: { pattern: '^\\d{4}$', example: '9490' },
  DK: { pattern: '^\\d{4}$', example: '1050' },
  NO: { pattern: '^\\d{4}$', example: '0150' },
  SE: { pattern: '^\\d{3} \\d{2}$', example: '111 22', spaceBeforeLast: 2 },
  FI: { pattern: '^\\d{5}$', example: '00100' },
  IS: { pattern: '^\\d{3}$', example: '101' },
  PL: { pattern: '^\\d{2}-\\d{3}$', example: '00-001' },
  CZ: { pattern: '^\\d{3} \\d{2}$', example: '110 00', spaceBeforeLast: 2 },
  SK: { pattern: '^\\d{3} \\d{2}$', example: '811 01', spaceBeforeLast: 2 },
  GR: { pattern: '^\\d{3} \\d{2}$', example: '105 57', spaceBeforeLast: 2 },
  HU: { pattern: '^\\d{4}$', example: '1051' },
  RO: { pattern: '^\\d{6}$', example: '010011' },
  BG: { pattern: '^\\d{4}$', example: '1000' },
  HR: { pattern: '^\\d{5}$', example: '10000' },
  SI: { pattern: '^\\d{4}$', example: '1000' },
  RS: { pattern: '^\\d{5}$', example: '11000' },
  EE: { pattern: '^\\d{5}$', example: '10111' },
  LV: { pattern: '^LV-\\d{4}$', example: 'LV-1050' },
  LT: { pattern: '^(LT-)?\\d{5}$', example: '01100' },
  UA: { pattern: '^\\d{5}$', example: '01001' },
  RU: { pattern: '^\\d{6}$', example: '101000' },
  TR: { pattern: '^\\d{5}$', example: '34000' },
  CY: { pattern: '^\\d{4}$', example: '1010' },
  MT: { pattern: '^[A-Z]{3} \\d{4}$', example: 'VLT 1117', spaceBeforeLast: 4 },
  IL: { pattern: '^\\d{5}(\\d{2})?$', example: '6100000' },
  SA: { pattern: '^\\d{5}(-\\d{4})?$', example: '11564' },
  KW: { pattern: '^\\d{5}$', example: '13001' },
  OM: { pattern: '^\\d{3}$', example: '100' },
  BH: { pattern: '^\\d{3,4}$', example: '317' },
  JO: { pattern: '^\\d{5}$', example: '11118' },
  EG: { pattern: '^\\d{5}$', example: '11511' },
  MA: { pattern: '^\\d{5}$', example: '10000' },
  ZA: { pattern: '^\\d{4}$', example: '0001' },
  NG: { pattern: '^\\d{6}$', example: '100001' },
  KE: { pattern: '^\\d{5}$', example: '00100' },
  CN: { pattern: '^\\d{6}$', example: '100000' },
  JP: { pattern: '^\\d{3}-\\d{4}$', example: '100-0001', hyphenBeforeLast: 4 },
  KR: { pattern: '^\\d{5}$', example: '03187' },
  TW: { pattern: '^\\d{3}(\\d{2,3})?$', example: '100' },
  SG: { pattern: '^\\d{6}$', example: '018956' },
  MY: { pattern: '^\\d{5}$', example: '50000' },
  TH: { pattern: '^\\d{5}$', example: '10100' },
  ID: { pattern: '^\\d{5}$', example: '10110' },
  PH: { pattern: '^\\d{4}$', example: '1000' },
  VN: { pattern: '^\\d{6}$', example: '100000' },
  BD: { pattern: '^\\d{4}$', example: '1000' },
  PK: { pattern: '^\\d{5}$', example: '44000' },
  LK: { pattern: '^\\d{5}$', example: '00100' },
  NP: { pattern: '^\\d{5}$', example: '44600' },
  AU: { label: 'Postcode', pattern: '^\\d{4}$', example: '2000' },
  NZ: { pattern: '^\\d{4}$', example: '6011' },
  BR: { label: 'CEP', pattern: '^\\d{5}-\\d{3}$', example: '01000-000', hyphenBeforeLast: 3 },
  MX: { pattern: '^\\d{5}$', example: '01000' },
  AR: { pattern: '^([A-HJ-NP-Z]\\d{4}[A-Z]{3}|\\d{4})$', example: 'C1002AAA' },
  CL: { pattern: '^\\d{7}$', example: '8320000' },
  CO: { pattern: '^\\d{6}$', example: '110111' },
  PE: { pattern: '^\\d{5}$', example: '15001' },
};

/** Trims and upper-cases a postal code, and puts the space or hyphen where the country's format has one. */
export function normalizePostalCode(countryCode, value) {
  let clean = String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  const rule = POSTAL_RULES[countryCode];
  if (rule?.spaceBeforeLast) {
    const compact = clean.replace(/\s/g, '');
    if (compact.length > rule.spaceBeforeLast) clean = `${compact.slice(0, -rule.spaceBeforeLast)} ${compact.slice(-rule.spaceBeforeLast)}`;
  } else if (rule?.hyphenBeforeLast) {
    const compact = clean.replace(/[\s-]/g, '');
    if (compact.length > rule.hyphenBeforeLast) clean = `${compact.slice(0, -rule.hyphenBeforeLast)}-${compact.slice(-rule.hyphenBeforeLast)}`;
  }
  return clean;
}

/** How a country handles postal codes: 'none', 'optional' or 'required'. */
export function postalRequirement(countryCode) {
  if (NO_POSTAL_CODE.includes(countryCode)) return 'none';
  const rule = POSTAL_RULES[countryCode];
  return rule && !rule.optional ? 'required' : 'optional';
}

export const postalLabel = (countryCode) => POSTAL_RULES[countryCode]?.label || 'Postal code';

/** Whether a country has a known postal code format to check against. */
export const hasPostalFormat = (countryCode) => Boolean(POSTAL_RULES[countryCode]);

/** A short hint shown under the ZIP / postal code box, describing the selected country's format. */
export function postalHint(countryCode) {
  const name = countryName(countryCode);
  if (postalRequirement(countryCode) === 'none') return `${name} doesn’t use postal codes, so this is optional.`;
  const rule = POSTAL_RULES[countryCode];
  if (!rule) return `${name}: postal code (optional), 2–10 letters or digits.`;
  return `${name} uses a ${rule.label || 'postal code'}${rule.optional ? ' (optional)' : ''}, for example ${rule.example}.`;
}

/**
 * Checks a postal code against the selected country's own format.
 * Returns { ok, value, message }: `value` is the normalized code ('' for countries without postal codes).
 */
export function validatePostalCode(countryCode, raw) {
  const requirement = postalRequirement(countryCode);
  // Countries without postal codes still accept an optional ZIP or postal code, such as a local area code
  const value = normalizePostalCode(countryCode, raw);
  const label = postalLabel(countryCode);
  if (!value) {
    return requirement === 'required'
      ? { ok: false, value, message: `Enter your ${label}.` }
      : { ok: true, value: '', message: '' };
  }
  const rule = POSTAL_RULES[countryCode];
  const valid = rule ? new RegExp(rule.pattern).test(value) : /^[A-Z0-9][A-Z0-9 -]{1,9}$/.test(value);
  if (!valid) {
    return { ok: false, value, message: rule ? `Enter a valid ${label}, for example ${rule.example}.` : `Enter a valid ${label} (2–10 letters or digits).` };
  }
  return { ok: true, value, message: '' };
}

export const isCountryCode = (code) => COUNTRY_CODES.includes(code);
export const isCurrencyCode = (code) => typeof code === 'string' && /^[A-Z]{3}$/.test(code);
export const defaultCurrencyFor = (countryCode) => COUNTRY_CURRENCY[countryCode] || 'USD';

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

/** The English name of a country or territory. */
export function countryName(code) {
  try {
    return regionNames?.of(code) || code;
  } catch {
    return code;
  }
}
