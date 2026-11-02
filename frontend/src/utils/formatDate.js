const dateOnly = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTime = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
const timeOnly = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

const toDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "9 Oct 2026" */
export function formatDate(value) {
  const date = toDate(value);
  return date ? dateOnly.format(date) : '—';
}

/** "9 Oct 2026, 3:04 pm" */
export function formatDateTime(value) {
  const date = toDate(value);
  return date ? dateTime.format(date) : '—';
}

/** "3:04 pm" for today, otherwise "9 Oct 2026" */
export function formatMessageTime(value) {
  const date = toDate(value);
  if (!date) return '';
  return date.toDateString() === new Date().toDateString() ? timeOnly.format(date) : dateOnly.format(date);
}

/** ISO timestamp `days` days before now (used to keep seeded sample data looking recent). */
export function daysAgo(days, hours = 0) {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString();
}
