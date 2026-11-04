import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

// Fonts, logos and drawing helpers shared by the certificate and ID card templates.
const ASSET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../assets/documents');

// Each weight is its own family name, so the SVG preview and the PDF pick exactly the same font file
export const FONTS = {
  Cond400: 'roboto-condensed-latin-400-normal.woff',
  Cond500: 'roboto-condensed-latin-500-normal.woff',
  Cond700: 'roboto-condensed-latin-700-normal.woff',
  Cond800: 'roboto-condensed-latin-800-normal.woff',
  Pop400: 'poppins-latin-400-normal.woff',
  Pop500: 'poppins-latin-500-normal.woff',
  Pop600: 'poppins-latin-600-normal.woff',
  Pop700: 'poppins-latin-700-normal.woff',
};

const fontPath = (name) => path.join(ASSET_DIR, 'fonts', FONTS[name]);
const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

export const imageDataUrl = (file) => once(`img:${file}`, () => `data:image/png;base64,${fs.readFileSync(path.join(ASSET_DIR, file)).toString('base64')}`);

/** Registers every document font on a PDF. */
export function registerFonts(doc) {
  Object.keys(FONTS).forEach((name) => doc.registerFont(name, fontPath(name)));
}

/** @font-face rules, so a preview image shows the same fonts as the PDF. */
export function fontFaceCss(names) {
  return names
    .map((name) => once(`css:${name}`, () => `@font-face{font-family:'${name}';src:url(data:font/woff;base64,${fs.readFileSync(fontPath(name)).toString('base64')}) format('woff');}`))
    .join('');
}

const measurer = once('measurer', () => {
  const doc = new PDFDocument({ autoFirstPage: false });
  registerFonts(doc);
  return doc;
});

export const textWidth = (text, font, size, letterSpacing = 0) => {
  const value = String(text ?? '');
  return measurer.font(font).fontSize(size).widthOfString(value) + letterSpacing * value.length;
};

export const escapeXml = (value) => String(value ?? '')
  // Characters XML cannot hold would make the whole document fail to render
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** One line of text. */
export function text(x, y, value, { font = 'Cond400', size = 20, fill = '#10203f', anchor = 'start', spacing = 0, opacity } = {}) {
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" fill="${fill}"${anchor === 'start' ? '' : ` text-anchor="${anchor}"`}${spacing ? ` letter-spacing="${spacing}"` : ''}${opacity ? ` opacity="${opacity}"` : ''}>${escapeXml(value)}</text>`;
}

/** The largest size, from `size` down to `min`, at which the text fits the width. */
export function fitSize(value, font, size, maxWidth, min = 10, spacing = 0) {
  let current = size;
  while (current > min && textWidth(value, font, current, spacing) > maxWidth) current -= 1;
  return current;
}

/** Wraps text to at most `maxLines`; anything further is shortened with an ellipsis. */
export function wrapText(value, font, size, maxWidth, maxLines = 2) {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i += 1) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (textWidth(next, font, size) <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = `${kept[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`;
  while (last.length > 1 && textWidth(`${last}…`, font, size) > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

/** Centres a line made of differently styled parts. */
export function centeredRuns(cx, y, runs, size) {
  const widths = runs.map((r) => textWidth(r.value, r.font, size));
  let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
  return runs.map((r, i) => {
    // Spaces at the edges of an SVG text are dropped, so they are kept as an offset instead
    const lead = r.value.length - r.value.trimStart().length;
    const out = text(Number((x + textWidth(' '.repeat(lead), r.font, size)).toFixed(2)), y, r.value.trim(), { font: r.font, size, fill: r.fill });
    x += widths[i];
    return out;
  }).join('');
}

/** A sharp QR code drawn as one vector path. High error correction leaves room for a logo in the middle. */
export function qrPath(url) {
  return once(`qr:${url}`, () => {
    const { modules } = QRCode.create(url, { errorCorrectionLevel: 'H' });
    const parts = [];
    for (let row = 0; row < modules.size; row += 1) {
      for (let col = 0; col < modules.size; col += 1) {
        if (modules.get(row, col)) parts.push(`M${col} ${row}h1v1h-1z`);
      }
    }
    return { d: parts.join(''), size: modules.size };
  });
}

export function qrSvg(url, x, y, size, fill = '#000000') {
  const { d, size: modules } = qrPath(url);
  const scale = size / modules;
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="${d}" fill="${fill}"/></g>`;
}

/** The QR image kept with each supplier's record, for admin screens. */
export const qrPngDataUrl = (url) => QRCode.toDataURL(url, { errorCorrectionLevel: 'H', margin: 2, width: 480 });

// Simple line icons on a 24 x 24 grid
export const ICONS = {
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6M9 9h2"/>',
  user: '<circle cx="12" cy="8" r="4.2"/><path d="M4.5 21c.8-4.2 3.8-6.5 7.5-6.5s6.7 2.3 7.5 6.5"/>',
  pin: '<path d="M12 21.5s7-6.6 7-12a7 7 0 1 0-14 0c0 5.4 7 12 7 12z"/><circle cx="12" cy="9.5" r="2.5"/>',
  shield: '<path d="M12 2.8l7.5 2.8v5.6c0 4.8-3.1 8.2-7.5 10-4.4-1.8-7.5-5.2-7.5-10V5.6z"/><path d="M8.6 11.8l2.4 2.4 4.4-4.6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 2.8V7M16 2.8V7"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01M16 17.5h.01"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5L12 13l8.5-6.5"/>',
  store: '<path d="M4 4h16l1 5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 12v8h14v-8M10 20v-5h4v5"/>',
  idCard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.5-1.5 1.6-2.2 3-2.2s2.5.7 3 2.2M14.5 10H18M14.5 14H18"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 3.8 5.7 3.8 9s-1.2 6.3-3.8 9c-2.6-2.7-3.8-5.7-3.8-9S9.400 5.700 12 3z"/>',
  check: '<path d="M5 12.5l4.5 4.500L19 7.500"/>',
  box: '<path d="M12 2.800l8 4.400v9.600l-8 4.400-8-4.400V7.200z"/><path d="M4.400 7.400L12 11.800l7.600-4.400M12 11.800V21"/>',
  users: '<circle cx="12" cy="8" r="3.200"/><path d="M6 20c.5-3.400 3-5.200 6-5.200s5.500 1.800 6 5.200"/><circle cx="4.800" cy="9.500" r="2"/><circle cx="19.200" cy="9.500" r="2"/><path d="M1.500 17c.3-2 1.500-3.200 3.200-3.500M22.500 17c-.3-2-1.500-3.200-3.200-3.500"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.300l3.300 2"/>',
  cross: '<path d="M6.500 6.500l11 11M17.500 6.500l-11 11"/>',
  alert: '<path d="M12 6.500v7.500M12 17.500h.01"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.700 5.700l12.600 12.600"/>',
};

export function icon(name, x, y, size, stroke, width = 2) {
  const scale = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</g>`;
}

const STATUS_STYLES = {
  VERIFIED: { label: 'VERIFIED', from: '#1f9a4b', to: '#0d6b34', solid: '#157a3d', soft: '#e7f4ec', icon: 'check' },
  PENDING: { label: 'PENDING', from: '#e0a11b', to: '#b97b06', solid: '#a86f05', soft: '#fdf3dc', icon: 'clock' },
  REJECTED: { label: 'REJECTED', from: '#d0403a', to: '#a11f1b', solid: '#a11f1b', soft: '#fbe6e5', icon: 'cross' },
  SUSPENDED: { label: 'SUSPENDED', from: '#5b6472', to: '#343b47', solid: '#343b47', soft: '#eceef1', icon: 'ban' },
  EXPIRED: { label: 'EXPIRED', from: '#c0612b', to: '#8f4215', solid: '#8f4215', soft: '#fbeee5', icon: 'clock' },
};

export const statusStyle = (status) => STATUS_STYLES[status] || STATUS_STYLES.PENDING;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const formatLongDate = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
};
export const formatShortDate = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}` : '';
};
