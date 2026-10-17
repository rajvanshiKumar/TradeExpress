import { CURRENCY } from './constants.js';

const whole = new Intl.NumberFormat(CURRENCY.locale, { style: 'currency', currency: CURRENCY.code, maximumFractionDigits: 0 });
const paise = new Intl.NumberFormat(CURRENCY.locale, { style: 'currency', currency: CURRENCY.code, minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Formats a rupee amount with Indian digit grouping: ₹45,000 and ₹1,25,000.
 * Amounts under ₹100 that are not whole rupees keep their paise (e.g. ₹14.50).
 */
export default function formatCurrency(amount) {
  const value = Number(amount) || 0;
  return Math.abs(value) < 100 && !Number.isInteger(value) ? paise.format(value) : whole.format(Math.round(value));
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value) || 0);
}

/** 125000 -> "1.3L" style compact figures for chart axes. */
export function formatCompact(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) >= 10000000) return `${Math.round(number / 1000000) / 10}Cr`;
  if (Math.abs(number) >= 100000) return `${Math.round(number / 10000) / 10}L`;
  if (Math.abs(number) >= 1000) return `${Math.round(number / 100) / 10}K`;
  return String(Math.round(number));
}

/** Axis label for charts: ₹1.3L */
export const formatAxisRupees = (value) => `₹${formatCompact(value)}`;
