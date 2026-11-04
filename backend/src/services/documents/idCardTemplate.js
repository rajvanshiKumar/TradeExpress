import {
  escapeXml, fitSize, fontFaceCss, formatShortDate, icon, imageDataUrl, qrSvg, statusStyle, text, textWidth, wrapText,
} from './docAssets.js';

// Supplier ID card, front and back. Drawn on a 682 x 1081 canvas, the proportions of a standard CR80 card (54 x 85.6 mm).
export const CARD_SIZE = { width: 682, height: 1081 };

const DARK = '#0a3322';
const GREEN = '#0f5c36';
const BRIGHT = '#4fc463';
const SOFT = '#e8f3ec';
const INK = '#14251b';
const MUTED = '#5e6b63';
const WIDTH = CARD_SIZE.width;
const HEIGHT = CARD_SIZE.height;

const FONTS_USED = ['Pop400', 'Pop500', 'Pop600', 'Pop700'];
const DISCLAIMER = 'This card is not a government-issued identity document or a guarantee of product quality, payment or transaction performance.';

const shell = (body, preview) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
  ${preview ? `<style>${fontFaceCss(FONTS_USED)}</style>` : ''}
  <defs>
    <clipPath id="card"><rect width="${WIDTH}" height="${HEIGHT}" rx="44"/></clipPath>
    <linearGradient id="banner" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0c3d27"/><stop offset="1" stop-color="#0f6038"/></linearGradient>
  </defs>
  <g clip-path="url(#card)">${body}</g>
</svg>`;

const slot = (fill) => `<rect x="${WIDTH / 2 - 70}" y="28" width="140" height="25" rx="12.500" fill="${fill}" stroke="#b9bfbb" stroke-width="1.200"/>`;

const websiteRow = (website, y) => {
  const size = 27;
  const spacing = 2;
  const width = textWidth(website, 'Pop500', size, spacing);
  const start = (WIDTH - width - 44) / 2;
  return `${icon('globe', start, y - 26, 30, '#ffffff', 1.800)}${text(start + 44, y, website, { font: 'Pop500', size, fill: '#ffffff', spacing })}`;
};

function infoRow(y, iconName, label, lines, size) {
  const valueY = y + 60;
  return `<rect x="334" y="${y + 8}" width="52" height="52" rx="13" fill="${SOFT}"/>
    ${icon(iconName, 346, y + 20, 28, GREEN, 2.200)}
    ${text(402, y + 26, label, { font: 'Pop600', size: 15, fill: '#1f8a4c', spacing: 1.400 })}
    ${lines.map((line, i) => text(402, valueY + i * (size + 5), line, { font: 'Pop600', size, fill: INK })).join('')}`;
}

function photoFrame(photo) {
  const clip = '<clipPath id="photo"><rect x="39" y="373" width="233" height="328" rx="20"/></clipPath>';
  const image = photo
    ? `<defs>${clip}</defs><g clip-path="url(#photo)"><rect x="39" y="373" width="233" height="328" fill="#e4e8e5"/><image x="39" y="373" width="233" height="328" preserveAspectRatio="xMidYMid slice" href="${photo}"/></g>`
    : `<rect x="39" y="373" width="233" height="328" rx="20" fill="#eef1ef"/>${icon('user', 113, 470, 84, '#9aa59e', 1.600)}${text(155, 600, 'Photo required', { font: 'Pop500', size: 18, fill: MUTED, anchor: 'middle' })}`;
  return `<rect x="33" y="367" width="245" height="340" rx="26" fill="#ffffff" stroke="#14893f" stroke-width="6"/>${image}`;
}

function statusBadge(style) {
  const width = Math.max(150, textWidth(style.label, 'Pop600', 16, 2.400) + 66);
  const x = 155 - width / 2;
  return `<rect x="${x}" y="682" width="${width}" height="42" rx="21" fill="${style.solid}" stroke="#ffffff" stroke-width="4"/>
    ${icon(style.icon, x + 16, 693, 20, '#ffffff', 2.800)}
    ${text(x + 44, 709, style.label, { font: 'Pop600', size: 16, fill: '#ffffff', spacing: 2.400 })}`;
}

const TRUST_LINES = {
  VERIFIED: ['TRUSTED', 'B2B SELLER'],
  PENDING: ['VERIFICATION', 'PENDING'],
  REJECTED: ['VERIFICATION', 'REJECTED'],
  SUSPENDED: ['ACCOUNT', 'SUSPENDED'],
  EXPIRED: ['VALIDITY', 'EXPIRED'],
};

function dashedRing(cx, cy, r, stroke) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroke}" stroke-width="2.600" stroke-dasharray="3 6" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="${r - 10}" fill="none" stroke="${stroke}" stroke-width="2.600"/>`;
}

export function idCardFrontSvg(data, { preview = false } = {}) {
  const style = statusStyle(data.status);
  const trustColor = data.status === 'VERIFIED' ? GREEN : style.solid;
  const trust = TRUST_LINES[data.status] || TRUST_LINES.PENDING;

  const nameSize = fitSize(data.supplierName, 'Pop600', 28, 240, 19);
  const nameLines = wrapText(data.supplierName, 'Pop600', nameSize, 240, 2);
  const businessSize = fitSize(data.businessName, 'Pop600', 26, 480, 19);
  const businessLines = wrapText(data.businessName, 'Pop600', businessSize, 244, 2);
  const idSize = fitSize(data.supplierId, 'Pop600', 25, 244, 16);

  const signature = data.signatory?.signatureDataUrl
    ? `<image x="430" y="792" width="190" height="66" preserveAspectRatio="xMidYMax meet" href="${data.signatory.signatureDataUrl}"/>`
    : '';
  const designation = data.signatory?.title || 'Authorised Signatory';

  return shell(`
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>
    <path d="M0 0H150L0 118Z" fill="${DARK}"/>
    <path d="M${WIDTH} 0H${WIDTH - 90}L${WIDTH} 70Z" fill="${BRIGHT}"/>
    ${slot('#dfe3e0')}

    <image x="${WIDTH / 2 - 188}" y="78" width="376" height="77.300" href="${imageDataUrl('tradeexpress-logo.png')}"/>

    <rect x="12" y="214" width="14" height="60" rx="3" fill="${BRIGHT}"/>
    <rect x="${WIDTH - 26}" y="214" width="14" height="60" rx="3" fill="${BRIGHT}"/>
    <rect x="33" y="191" width="${WIDTH - 66}" height="108" rx="22" fill="url(#banner)"/>
    ${text(WIDTH / 2, 247, 'TRADEEXPRESS', { font: 'Pop700', size: 44, fill: '#ffffff', anchor: 'middle', spacing: 3.200 })}
    ${text(WIDTH / 2, 281, 'SUPPLIER ID CARD', { font: 'Pop500', size: 19, fill: '#ffffff', anchor: 'middle', spacing: 5.400 })}
    <path d="M${WIDTH / 2 - 186} 274H${WIDTH / 2 - 146}M${WIDTH / 2 + 146} 274H${WIDTH / 2 + 186}" stroke="${BRIGHT}" stroke-width="3"/>

    ${photoFrame(data.photo)}
    ${statusBadge(style)}

    <rect x="306" y="367" width="343" height="338" rx="20" fill="#fafbfa" stroke="#dfe6e1" stroke-width="1.500"/>
    <path d="M326 367C313 367 306 374 306 387V685C306 698 313 705 326 705" fill="none" stroke="#14893f" stroke-width="7"/>
    ${infoRow(378, 'user', 'SUPPLIER NAME', nameLines, nameSize)}
    <path d="M334 482H636" stroke="#e3e9e5" stroke-width="1.500"/>
    ${infoRow(486, 'store', 'BUSINESS NAME', businessLines, businessSize)}
    <path d="M334 598H636" stroke="#e3e9e5" stroke-width="1.500"/>
    ${infoRow(602, 'idCard', 'SUPPLIER ID', [data.supplierId], idSize)}

    <rect x="33" y="774" width="${WIDTH - 66}" height="161" rx="22" fill="${SOFT}"/>
    ${dashedRing(103, 854, 46, trustColor)}
    ${icon(data.status === 'VERIFIED' ? 'check' : style.icon, 79, 830, 48, trustColor, 2.600)}
    ${text(166, 850, trust[0], { font: 'Pop600', size: 17, fill: DARK, spacing: 1.400 })}
    ${text(166, 878, trust[1], { font: 'Pop600', size: 17, fill: DARK, spacing: 1.400 })}
    ${signature}
    <path d="M385 862H640" stroke="#3b4a41" stroke-width="1"/>
    ${data.signatory?.name ? text(512, 892, data.signatory.name, { font: 'Pop600', size: fitSize(data.signatory.name, 'Pop600', 22, 250, 14), fill: INK, anchor: 'middle' }) : ''}
    ${text(512, data.signatory?.name ? 920 : 892, designation, { font: 'Pop400', size: 17, fill: MUTED, anchor: 'middle' })}

    ${data.status === 'VERIFIED' ? '' : `<text x="${WIDTH / 2}" y="600" text-anchor="middle" font-family="Pop700" font-size="86" fill="${style.solid}" opacity=".11" transform="rotate(-32 ${WIDTH / 2} 540)">${escapeXml(style.label)}</text>`}

    <path d="M0 985H200L232 1003H0Z" fill="${BRIGHT}"/>
    <path d="M${WIDTH} 985H${WIDTH - 200}L${WIDTH - 232} 1003H${WIDTH}Z" fill="${BRIGHT}"/>
    <rect x="0" y="1003" width="${WIDTH}" height="78" fill="${DARK}"/>
    ${websiteRow(data.website, 1052)}
  `, preview);
}

function footerColumn(index, iconName, line1, line2) {
  const columnWidth = WIDTH / 4;
  const cx = columnWidth * index + columnWidth / 2;
  return `${icon(iconName, cx - 17, 966, 34, '#ffffff', 1.700)}
    ${text(cx, 1022, line1, { font: 'Pop400', size: 15.500, fill: '#ffffff', anchor: 'middle' })}
    ${text(cx, 1042, line2, { font: 'Pop400', size: 15.500, fill: '#ffffff', anchor: 'middle' })}
    ${index ? `<path d="M${columnWidth * index} 956V1056" stroke="#ffffff" stroke-opacity=".28" stroke-width="1"/>` : ''}`;
}

export function idCardBackSvg(data, { preview = false } = {}) {
  const style = statusStyle(data.status);
  const qrX = WIDTH / 2 - 113;
  const qrY = 450;
  const qrFrame = 226;

  const validUntil = data.idCardValidUntil ? formatShortDate(data.idCardValidUntil) : 'Once verified';
  const statusNote = data.status === 'VERIFIED'
    ? ''
    : text(WIDTH / 2, 694, `Status: ${style.label}. This card is not proof of verification.`, { font: 'Pop600', size: 15, fill: style.solid, anchor: 'middle' });

  // The first line starts after the red "Disclaimer:" label
  const prefix = 'Disclaimer:';
  const prefixWidth = textWidth(`${prefix} `, 'Pop600', 17.500);
  const words = DISCLAIMER.split(' ');
  let firstWords = '';
  while (words.length && textWidth(`${firstWords} ${words[0]}`.trim(), 'Pop400', 17.500) <= 530 - prefixWidth) {
    firstWords = `${firstWords} ${words.shift()}`.trim();
  }
  const restLines = wrapText(words.join(' '), 'Pop400', 17.500, 530, 2);

  return shell(`
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>
    <path d="M0 0H${WIDTH}V219C520 196 160 196 50 219H0Z" fill="${DARK}"/>
    ${slot('#dfe3e0')}
    <image x="${WIDTH / 2 - 198}" y="82" width="396" height="81.400" href="${imageDataUrl('tradeexpress-logo-on-dark.png')}"/>

    <rect x="33" y="240" width="${WIDTH - 66}" height="88" rx="18" fill="${SOFT}"/>
    <circle cx="86" cy="284" r="32" fill="${GREEN}"/>
    ${icon('mail', 70, 268, 32, '#ffffff', 2)}
    ${text(136, 274, 'Customer Support', { font: 'Pop600', size: 23, fill: INK })}
    ${text(136, 306, data.supportEmail, { font: 'Pop400', size: fitSize(data.supportEmail, 'Pop400', 19, 500, 13), fill: INK })}

    ${text(WIDTH / 2, 386, 'Supplier Verification', { font: 'Pop600', size: 28, fill: INK, anchor: 'middle' })}
    <path d="M${WIDTH / 2 - 190} 377H${WIDTH / 2 - 164}M${WIDTH / 2 + 164} 377H${WIDTH / 2 + 190}" stroke="${INK}" stroke-width="2"/>
    ${text(WIDTH / 2, 424, 'Scan the QR code to verify this supplier’s registration details', { font: 'Pop400', size: 17, fill: MUTED, anchor: 'middle' })}

    <rect x="${qrX}" y="${qrY - 12}" width="${qrFrame}" height="${qrFrame}" rx="20" fill="#ffffff" stroke="#14893f" stroke-width="5"/>
    ${qrSvg(data.publicProfileUrl, qrX + 15, qrY + 3, qrFrame - 30)}
    <rect x="${WIDTH / 2 - 27}" y="${qrY + 74}" width="54" height="54" rx="10" fill="#ffffff"/>
    <image x="${WIDTH / 2 - 23}" y="${qrY + 85}" width="46" height="32.400" href="${imageDataUrl('tradeexpress-mark.png')}"/>
    ${statusNote}

    <rect x="33" y="714" width="302" height="88" rx="16" fill="${SOFT}"/>
    <circle cx="78" cy="758" r="27" fill="${GREEN}"/>
    ${icon('calendar', 63, 743, 30, '#ffffff', 1.900)}
    ${text(116, 748, 'Issue Date', { font: 'Pop400', size: 17, fill: MUTED })}
    ${text(116, 778, formatShortDate(data.issueDate), { font: 'Pop600', size: 22, fill: INK })}

    <rect x="347" y="714" width="302" height="88" rx="16" fill="${DARK}"/>
    <circle cx="392" cy="758" r="27" fill="#3fb45a"/>
    ${icon('calendar', 377, 743, 30, '#ffffff', 1.900)}
    ${text(430, 748, 'Valid Till', { font: 'Pop400', size: 17, fill: '#c9d8cf' })}
    ${text(430, 778, validUntil, { font: 'Pop600', size: 22, fill: '#ffffff' })}

    <rect x="33" y="818" width="${WIDTH - 66}" height="106" rx="16" fill="#fdecea"/>
    <circle cx="74" cy="871" r="22" fill="#d9362f"/>
    ${icon('alert', 58, 855, 32, '#ffffff', 3.400)}
    ${text(106, 856, prefix, { font: 'Pop600', size: 17.500, fill: '#c62d27' })}
    ${text(106 + prefixWidth, 856, firstWords, { font: 'Pop400', size: 17.500, fill: INK })}
    ${restLines.map((line, i) => text(106, 882 + i * 26, line, { font: 'Pop400', size: 17.500, fill: INK })).join('')}

    <rect x="0" y="946" width="${WIDTH}" height="135" fill="${DARK}"/>
    ${footerColumn(0, 'shield', 'Verified', 'Sellers')}
    ${footerColumn(1, 'box', 'Wide Product', 'Range')}
    ${footerColumn(2, 'users', 'Trusted B2B', 'Platform')}
    ${footerColumn(3, 'globe', 'Grow', 'Globally')}
    ${text(WIDTH / 2, 1070, data.website, { font: 'Pop500', size: 15, fill: '#ffffff', anchor: 'middle', spacing: 1.600 })}
  `, preview);
}
