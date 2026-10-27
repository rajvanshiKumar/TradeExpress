/** Short, readable, unique-enough ID for records created in the browser, e.g. "TS-O-M3K9X2A7". */
export default function makeId(prefix) {
  const time = Date.now().toString(36).slice(-6);
  const random = Math.random().toString(36).slice(2, 4);
  return `${prefix}-${(time + random).toUpperCase()}`;
}
