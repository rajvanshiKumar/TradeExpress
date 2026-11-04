import {
  centeredRuns, escapeXml, fitSize, fontFaceCss, formatLongDate, icon, imageDataUrl, qrSvg, statusStyle, text, textWidth, wrapText,
} from './docAssets.js';

// Seller Registration Certificate. Drawn on a 1491 x 1055 canvas, the proportions of A4 landscape.
export const CERTIFICATE_SIZE = { width: 1491, height: 1055 };

const NAVY = '#0d1f3f';
const INK = '#1a2740';
const GOLD = '#b98a24';
const GOLD_LIGHT = '#ecd292';

const FONTS_USED = ['Cond400', 'Cond500', 'Cond700', 'Cond800'];

const WORDING = {
  VERIFIED: {
    lines: [
      [['is registered as a seller on ', 0], ['TradeExpress,', 1], [' India’s Largest Online B2B Marketplace,', 0]],
      [['and is authorized to list, promote and sell products on the platform,', 0]],
      [['subject to the applicable terms and conditions.', 0]],
    ],
    caption: 'Documents Reviewed & Verified by TradeExpress',
  },
  PENDING: {
    lines: [
      [['has applied for seller registration on ', 0], ['TradeExpress,', 1], [' India’s Largest Online B2B Marketplace.', 0]],
      [['The submitted documents are awaiting review by TradeExpress.', 0]],
      [['This certificate is not proof of verification until TradeExpress approves it.', 1]],
    ],
    caption: 'Not yet verified. Review by TradeExpress is pending.',
  },
  REJECTED: {
    lines: [
      [['applied for seller registration on ', 0], ['TradeExpress,', 1], [' India’s Largest Online B2B Marketplace.', 0]],
      [['TradeExpress did not approve this registration after reviewing the documents.', 0]],
      [['This certificate is not valid.', 1]],
    ],
    caption: 'Verification was rejected by TradeExpress.',
  },
  SUSPENDED: {
    lines: [
      [['holds a seller registration on ', 0], ['TradeExpress,', 1], [' India’s Largest Online B2B Marketplace,', 0]],
      [['which is currently suspended.', 0]],
      [['This certificate is not valid while the suspension is in effect.', 1]],
    ],
    caption: 'This account is suspended by TradeExpress.',
  },
  EXPIRED: {
    lines: [
      [['was registered as a seller on ', 0], ['TradeExpress,', 1], [' India’s Largest Online B2B Marketplace.', 0]],
      [['The validity period of this certificate has ended.', 0]],
      [['Please contact TradeExpress to renew it.', 1]],
    ],
    caption: 'The validity period of this certificate has ended.',
  },
};

const defs = () => `<defs>
  <linearGradient id="navy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1a38"/><stop offset="1" stop-color="#183463"/></linearGradient>
  <linearGradient id="ribbon" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#a97b1c"/><stop offset=".45" stop-color="#f6e2a6"/><stop offset="1" stop-color="#b98a24"/></linearGradient>
  <linearGradient id="goldText" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a93a"/><stop offset="1" stop-color="#a97a18"/></linearGradient>
  <radialGradient id="tile" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#fff0c8"/><stop offset="1" stop-color="#f1cf80"/></radialGradient>
  <radialGradient id="sealOuter" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#f8e29c"/><stop offset=".6" stop-color="#d7a635"/><stop offset="1" stop-color="#94690f"/></radialGradient>
  <radialGradient id="sealInner" cx=".4" cy=".35" r=".85"><stop offset="0" stop-color="#f5d98a"/><stop offset="1" stop-color="#c08f24"/></radialGradient>
</defs>`;

// A faint dotted world map behind the header, as on the reference
const CONTINENTS = [[110, 45, 62, 30], [150, 118, 26, 40], [270, 40, 34, 17], [282, 105, 34, 44], [395, 58, 92, 36], [450, 134, 28, 17]];
function worldMap(x, y) {
  let dots = '';
  for (let py = 8; py < 170; py += 7) {
    for (let px = 40; px < 510; px += 7) {
      if (CONTINENTS.some(([cx, cy, rx, ry]) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1)) dots += `M${px} ${py}h2.600v2.600h-2.600z`;
    }
  }
  return `<g transform="translate(${x} ${y}) scale(.62)"><path d="${dots}" fill="#0d1f3f" opacity=".1"/></g>`;
}

function background() {
  const waves = [0, 1, 2, 3, 4].map((i) => `<path d="M0 ${560 + i * 26} C 360 ${470 + i * 26}, 720 ${660 + i * 26}, 1491 ${500 + i * 26}" fill="none" stroke="${GOLD}" stroke-width=".8" opacity=".14"/>`).join('');
  return `<rect width="1491" height="1055" fill="#fbf8ef"/>${waves}`;
}

function borders() {
  return `<rect x="15" y="15" width="1461" height="1025" fill="none" stroke="${GOLD}" stroke-width="3.500"/>
  <rect x="23" y="23" width="1445" height="1009" fill="none" stroke="${GOLD}" stroke-width="1"/>`;
}

// The navy and gold sweep in one corner; the opposite corner is the same shape turned around
function sweep() {
  return `<path d="M0 0H325C190 22 70 105 0 300Z" fill="url(#navy)"/>
  <path d="M0 322C52 148 178 34 362 0H322C168 24 44 118 0 276Z" fill="url(#ribbon)"/>
  <path d="M0 356C60 180 186 58 392 0H378C200 50 62 166 0 334Z" fill="url(#ribbon)" opacity=".55"/>`;
}

function bottomSweep() {
  return `<g transform="rotate(180 745.500 527.500)">
    <path d="M0 0H285C170 24 60 110 0 250Z" fill="url(#navy)"/>
    <path d="M0 272C48 126 160 32 320 0H284C150 26 42 112 0 232Z" fill="url(#ribbon)"/>
    <path d="M0 304C56 156 170 54 350 0H336C180 46 58 148 0 284Z" fill="url(#ribbon)" opacity=".55"/>
  </g>`;
}

// A small gold flourish tucked into a corner of the border
function cornerOrnament(x, y, turn) {
  return `<g transform="translate(${x} ${y}) rotate(${turn})" fill="none" stroke="${GOLD}" stroke-width="2.400" stroke-linecap="round">
    <path d="M-4 4C-20 4 -34 6 -44 16C-53 25 -44 38 -33 31C-27 27 -31 18 -38 22"/>
    <path d="M-4 4C-4 20 -6 34 -16 44C-25 53 -38 44 -31 33C-27 27 -18 31 -22 38"/>
    <path d="M-44 16C-56 9 -70 12 -84 5"/>
    <path d="M-16 44C-9 56 -12 70 -5 84"/>
    <path d="M-24 24C-34 34 -44 42 -56 44C-54 54 -46 58 -36 54C-30 50 -30 44 -33 40" stroke-width="1.800"/>
    <circle cx="-14" cy="14" r="3.600" fill="${GOLD}"/>
  </g>`;
}

// Gold rule with a small diamond or scroll in the middle
function divider(cx, y, half, big) {
  const scroll = big
    ? `<path d="M${cx} ${y - 34}l14 20-14 20-14-20z" fill="none" stroke="${GOLD}" stroke-width="2.400"/><path d="M${cx} ${y - 24}l7 10-7 10-7-10z" fill="${GOLD}"/>
       <path d="M${cx - 18} ${y - 8}C${cx - 34} ${y - 30} ${cx - 62} ${y - 16} ${cx - 48} ${y - 2}C${cx - 42} ${y + 3} ${cx - 34} ${y - 2} ${cx - 38} ${y - 8}" fill="none" stroke="${GOLD}" stroke-width="2.400" stroke-linecap="round"/>
       <path d="M${cx + 18} ${y - 8}C${cx + 34} ${y - 30} ${cx + 62} ${y - 16} ${cx + 48} ${y - 2}C${cx + 42} ${y + 3} ${cx + 34} ${y - 2} ${cx + 38} ${y - 8}" fill="none" stroke="${GOLD}" stroke-width="2.400" stroke-linecap="round"/>`
    : `<path d="M${cx} ${y - 9}l13 9-13 9-13-9z" fill="none" stroke="${GOLD}" stroke-width="2"/><path d="M${cx} ${y - 4}l6 4-6 4-6-4z" fill="${GOLD}"/>
       <path d="M${cx - 18} ${y}h-14M${cx + 18} ${y}h14" stroke="${GOLD}" stroke-width="2"/>`;
  const gap = big ? 66 : 36;
  return `<path d="M${cx - half} ${y}H${cx - gap}M${cx + gap} ${y}H${cx + half}" stroke="${GOLD}" stroke-width="1.600"/>${scroll}`;
}

const tile = (cx, cy, r, name) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#tile)" stroke="${GOLD_LIGHT}" stroke-width="1.500"/>${icon(name, cx - r * 0.55, cy - r * 0.55, r * 1.1, NAVY, 2.100)}`;

function idBox(x, y, width, label, value, iconName) {
  const size = fitSize(value, 'Cond700', 30, width - 112, 18);
  return `<rect x="${x}" y="${y}" width="${width}" height="78" rx="12" fill="#fffdf6" stroke="${GOLD}" stroke-width="1.400"/>
    ${tile(x + 44, y + 39, 31, iconName)}
    ${text(x + 100, y + 30, label, { font: 'Cond400', size: 21, fill: INK })}
    ${text(x + 100, y + 62, value, { font: 'Cond700', size, fill: NAVY })}`;
}

function seal(cx, cy) {
  const R = 88;
  let scallop = '';
  const bumps = 44;
  for (let i = 0; i <= bumps; i += 1) {
    const a = (i / bumps) * Math.PI * 2;
    const r = i % 2 ? R : R - 5;
    scallop += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  }
  let leaves = '';
  for (let i = 0; i < 26; i += 1) {
    // Laurel on both sides, leaving the top open
    const angle = (i < 13 ? 112 + i * 9.500 : 68 - (i - 13) * 9.500) * (Math.PI / 180);
    const lx = cx + 60 * Math.cos(angle);
    const ly = cy + 60 * Math.sin(angle);
    const deg = (angle * 180) / Math.PI + (i < 13 ? 62 : -62);
    leaves += `<ellipse cx="${lx.toFixed(2)}" cy="${ly.toFixed(2)}" rx="8.500" ry="3.200" fill="#3a2a08" transform="rotate(${deg.toFixed(1)} ${lx.toFixed(2)} ${ly.toFixed(2)})"/>`;
  }
  const star = (sx, sy, r) => {
    let pts = '';
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      pts += `${i ? 'L' : 'M'}${(sx + rr * Math.cos(a)).toFixed(2)} ${(sy + rr * Math.sin(a)).toFixed(2)}`;
    }
    return `<path d="${pts}Z" fill="#3a2a08"/>`;
  };
  return `<ellipse cx="${cx + 3}" cy="${cy + 8}" rx="${R}" ry="${R}" fill="#6b4a08" opacity=".22"/>
    <path d="${scallop}Z" fill="url(#sealOuter)" stroke="#8d6410" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="${R - 12}" fill="none" stroke="#7d5808" stroke-width="1.400"/>
    <circle cx="${cx}" cy="${cy}" r="${R - 17}" fill="url(#sealInner)" stroke="#7d5808" stroke-width="1"/>
    ${leaves}
    <image x="${cx - 38}" y="${cy - 40}" width="76" height="53.600" href="${imageDataUrl('tradeexpress-mark.png')}"/>
    ${star(cx - 20, cy + 32, 7)}${star(cx, cy + 34, 8)}${star(cx + 20, cy + 32, 7)}`;
}

function statusPill(x, y, style) {
  const label = style.label;
  const width = Math.max(178, textWidth(label, 'Cond700', 26, 1) + 90);
  return `<rect x="${x}" y="${y}" width="${width}" height="44" rx="22" fill="${style.solid}"/>
    <circle cx="${x + 28}" cy="${y + 22}" r="15" fill="#ffffff"/>
    ${icon(style.icon, x + 18, y + 12, 20, style.solid, 3)}
    ${text(x + 56, y + 31, label, { font: 'Cond700', size: 26, fill: '#ffffff', spacing: 1 })}`;
}

export function certificateSvg(data, { preview = false } = {}) {
  const style = statusStyle(data.status);
  const wording = WORDING[data.status] || WORDING.PENDING;
  const nameSize = fitSize(String(data.businessName || '').toUpperCase(), 'Cond700', 50, 860, 26);
  const addressLines = wrapText(data.businessAddress, 'Cond400', 22, 530, 2);
  const ownerSize = fitSize(data.ownerName, 'Cond700', 25, 530, 16);
  const typeValue = data.businessType || 'Not provided';
  const regValue = data.registrationNumber || 'Not applicable';
  const gstValue = data.gstin || 'Not applicable';

  const watermark = data.status === 'VERIFIED'
    ? ''
    : `<text x="745" y="710" text-anchor="middle" font-family="Cond800" font-size="170" fill="${style.solid}" opacity=".085" transform="rotate(-24 745 660)">${escapeXml(style.label)}</text>`;

  const signature = data.signatory?.signatureDataUrl
    ? `<image x="925" y="848" width="220" height="76" preserveAspectRatio="xMidYMax meet" href="${data.signatory.signatureDataUrl}"/>`
    : '';

  const paragraph = wording.lines.map((runs, i) => centeredRuns(745, 486 + i * 29, runs.map(([value, bold]) => ({ value, font: bold ? 'Cond700' : 'Cond400', fill: INK })), 23.500)).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1491 1055" width="1491" height="1055">
  ${preview ? `<style>${fontFaceCss(FONTS_USED)}</style>` : ''}
  ${defs()}
  ${background()}
  ${worldMap(655, 34)}
  ${borders()}
  ${sweep()}
  ${bottomSweep()}
  ${cornerOrnament(1466, 25, 0)}
  ${cornerOrnament(25, 1030, 180)}

  <image x="163" y="62" width="500" height="102.800" href="${imageDataUrl('tradeexpress-logo.png')}"/>
  <path d="M958 78V148" stroke="${NAVY}" stroke-width="1.600"/>
  ${text(978, 102, 'India’s Largest Online B2B Marketplace', { font: 'Cond700', size: 26, fill: NAVY })}
  <path d="M978 113H1366" stroke="${GOLD}" stroke-width="1.600"/>
  ${text(978, 142, 'Connecting Buyers, Sellers & Verified Manufacturers', { font: 'Cond400', size: 21, fill: INK })}

  ${divider(745, 205, 430, true)}

  ${centeredRuns(745, 288, [
    { value: 'SELLER REGISTRATION ', font: 'Cond800', fill: NAVY },
    { value: 'CERTIFICATE', font: 'Cond800', fill: GOLD },
  ], 72)}

  ${divider(745, 317, 370, false)}

  ${idBox(62, 322, 320, 'Certificate No.', data.certificateNumber, 'file')}
  ${idBox(1153, 322, 294, 'Seller ID', data.supplierId, 'user')}

  ${text(745, 372, 'This is to certify that', { font: 'Cond400', size: 25, fill: INK, anchor: 'middle' })}
  ${text(745, 437, String(data.businessName || '').toUpperCase(), { font: 'Cond700', size: nameSize, fill: NAVY, anchor: 'middle' })}
  ${divider(745, 455, 72, false)}
  ${paragraph}

  ${watermark}

  ${tile(158, 590, 32, 'user')}
  ${text(216, 582, 'Business Owner / Authorised Representative', { font: 'Cond700', size: 21, fill: NAVY })}
  ${text(216, 612, data.ownerName, { font: 'Cond700', size: ownerSize, fill: NAVY })}
  <path d="M216 628H744" stroke="${GOLD_LIGHT}" stroke-width="1.400"/>

  ${tile(158, 668, 32, 'pin')}
  ${text(216, 654, 'Business Address', { font: 'Cond700', size: 21, fill: NAVY })}
  ${addressLines.map((line, i) => text(216, 682 + i * 26, line, { font: 'Cond400', size: 22, fill: INK })).join('')}
  <path d="M216 724H744" stroke="${GOLD_LIGHT}" stroke-width="1.400"/>

  ${tile(158, 757, 32, 'file')}
  ${text(216, 750, 'Business Type', { font: 'Cond700', size: 21, fill: NAVY })}
  ${text(216, 778, typeValue, { font: 'Cond400', size: 22, fill: INK })}
  <path d="M216 798H744" stroke="${GOLD_LIGHT}" stroke-width="1.400"/>

  ${tile(158, 838, 32, 'file')}
  ${text(216, 824, 'Registration Details', { font: 'Cond700', size: 21, fill: NAVY })}
  ${text(216, 851, 'Registration Number', { font: 'Cond400', size: 22, fill: INK })}
  ${text(420, 851, ':', { font: 'Cond400', size: 22, fill: INK })}
  ${text(452, 851, regValue, { font: 'Cond400', size: fitSize(regValue, 'Cond400', 22, 310, 14), fill: INK })}
  ${text(216, 878, 'GSTIN (if applicable)', { font: 'Cond400', size: 22, fill: INK })}
  ${text(420, 878, ':', { font: 'Cond400', size: 22, fill: INK })}
  ${text(452, 878, gstValue, { font: 'Cond400', size: 22, fill: INK })}

  <rect x="133" y="895" width="112" height="112" fill="#ffffff" stroke="${GOLD}" stroke-width="2"/>
  ${qrSvg(data.publicProfileUrl, 139, 901, 100)}
  ${text(264, 930, 'Scan QR Code', { font: 'Cond700', size: 21, fill: NAVY })}
  ${text(264, 956, 'to verify the authenticity', { font: 'Cond400', size: 20, fill: INK })}
  ${text(264, 980, 'of this certificate online.', { font: 'Cond400', size: 20, fill: INK })}
  ${text(264, 1006, data.website, { font: 'Cond500', size: 19, fill: GOLD })}

  <path d="M787 574V708M787 742V884" stroke="${GOLD}" stroke-width="1.400"/>
  <path d="M787 704l10 21-10 21-10-21z" fill="none" stroke="${GOLD}" stroke-width="2"/>

  ${tile(868, 590, 32, 'shield')}
  ${text(936, 582, 'Verification Status', { font: 'Cond700', size: 21, fill: NAVY })}
  ${statusPill(935, 590, style)}
  ${text(936, 658, wording.caption, { font: 'Cond400', size: 20, fill: data.status === 'VERIFIED' ? INK : style.solid })}
  <path d="M840 671H1394" stroke="${GOLD_LIGHT}" stroke-width="1.400"/>

  ${tile(868, 714, 32, 'calendar')}
  ${text(938, 706, 'Issue Date', { font: 'Cond700', size: 21, fill: NAVY })}
  ${text(938, 735, formatLongDate(data.issueDate), { font: 'Cond400', size: 23, fill: INK })}
  <path d="M840 754H1394" stroke="${GOLD_LIGHT}" stroke-width="1.400"/>

  ${tile(868, 796, 32, 'calendar')}
  ${text(938, 789, 'Valid Until', { font: 'Cond700', size: 21, fill: NAVY })}
  ${text(938, 818, data.validUntil ? formatLongDate(data.validUntil) : 'Set once verified', { font: 'Cond400', size: 23, fill: INK })}

  ${signature}
  <path d="M905 926H1166" stroke="${GOLD}" stroke-width="1.600"/>
  ${data.signatory?.name ? text(1035, 952, data.signatory.name, { font: 'Cond700', size: 22, fill: NAVY, anchor: 'middle' }) : ''}
  ${text(1035, data.signatory?.name ? 977 : 953, data.signatory?.title || 'Authorised Signatory', { font: 'Cond400', size: 20, fill: INK, anchor: 'middle' })}
  ${text(1035, data.signatory?.name ? 1001 : 978, 'TradeExpress', { font: 'Cond400', size: 20, fill: INK, anchor: 'middle' })}

  ${seal(1277, 905)}
</svg>`;
}
