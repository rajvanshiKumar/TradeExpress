/**
 * Splits `text` into segments, marking every case-insensitive occurrence of `query`.
 * Returns [{ text, match }]; render matches with <mark>. Produces no HTML, so it is safe to render.
 */
export function matchSegments(text, query) {
  const source = String(text ?? '');
  const needle = String(query ?? '').trim().toLowerCase();
  if (!source || !needle) return [{ text: source, match: false }];

  const haystack = source.toLowerCase();
  const segments = [];
  let from = 0;
  let index = haystack.indexOf(needle, from);
  while (index !== -1) {
    if (index > from) segments.push({ text: source.slice(from, index), match: false });
    segments.push({ text: source.slice(index, index + needle.length), match: true });
    from = index + needle.length;
    index = haystack.indexOf(needle, from);
  }
  if (from < source.length) segments.push({ text: source.slice(from), match: false });
  return segments;
}
