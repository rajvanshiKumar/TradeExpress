import { numberToIndianWords } from './numberToIndianWords.js';
import { TERMS_METADATA } from '../data/termsData.js';

/**
 * GST invoice in the standard Tally layout:
 * page 1 = seller / buyer / reference grid, particulars with tax ledger lines, HSN/SAC summary,
 * amounts in words, remarks and signatory; page 2 = basic terms drawn from the TradeExpress
 * Terms and Conditions. Only data present on the order is printed; unknown cells stay blank.
 */

const STATE_CODES = {
  'JAMMU AND KASHMIR': '01', 'HIMACHAL PRADESH': '02', PUNJAB: '03', CHANDIGARH: '04', UTTARAKHAND: '05', HARYANA: '06',
  DELHI: '07', RAJASTHAN: '08', 'UTTAR PRADESH': '09', BIHAR: '10', SIKKIM: '11', 'ARUNACHAL PRADESH': '12', NAGALAND: '13',
  MANIPUR: '14', MIZORAM: '15', TRIPURA: '16', MEGHALAYA: '17', ASSAM: '18', 'WEST BENGAL': '19', JHARKHAND: '20', ODISHA: '21',
  CHHATTISGARH: '22', 'MADHYA PRADESH': '23', GUJARAT: '24', 'DADRA AND NAGAR HAVELI AND DAMAN AND DIU': '26', MAHARASHTRA: '27',
  KARNATAKA: '29', GOA: '30', LAKSHADWEEP: '31', KERALA: '32', 'TAMIL NADU': '33', PUDUCHERRY: '34',
  'ANDAMAN AND NICOBAR ISLANDS': '35', TELANGANA: '36', 'ANDHRA PRADESH': '37', LADAKH: '38',
};

const stateCode = (state) => STATE_CODES[String(state || '').trim().toUpperCase()] || '';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const formatINR = (value) => num(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatRate = (value) => String(round2(value)).replace(/\.0+$/, '');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "29 Oct 26", as printed on Tally invoices. */
function formatDate(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

const PAYMENT_LABELS = { online: 'Online', upi: 'UPI', card: 'Card', netbanking: 'Net Banking', wallet: 'Wallet', cod: 'Cash on Delivery' };
const PAYMENT_STATUS = { PAID: 'Paid', PARTIALLY_PAID: 'Partially paid', PENDING: 'Payment pending', COD: 'Pay on delivery', FAILED: 'Payment failed', REFUNDED: 'Refunded' };

/** Splits `total` across `weights`, rounding to paise and giving the remainder to the last share. */
function allocate(total, weights) {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (!sum) return weights.map(() => 0);
  let used = 0;
  return weights.map((w, index) => {
    if (index === weights.length - 1) return round2(total - used);
    const share = round2((total * w) / sum);
    used += share;
    return share;
  });
}

/** Normalises backend orders, browser-formatted orders and tracking records into one shape. */
function normalizeOrder(order = {}) {
  const supplier = order.supplier || {};
  const addr = (order.deliveryAddress && typeof order.deliveryAddress === 'object' ? order.deliveryAddress : null)
    || (order.address && typeof order.address === 'object' ? order.address : {});
  const contact = order.contact || {};
  const totals = order.totals || {};

  const seller = {
    name: supplier.company || order.supplierCompany || supplier.name || '',
    address: supplier.address || supplier.businessAddress || '',
    city: supplier.city || '',
    state: supplier.state || '',
    country: supplier.country || '',
    pincode: supplier.pincode || supplier.postalCode || '',
    gstin: order.supplierGstin || supplier.gstin || '',
  };

  const buyer = {
    name: order.buyerCompany || contact.company || order.buyerName || contact.name || addr.name || '',
    lines: [addr.street || addr.line1 || addr.addressLine1, addr.apartment || addr.line2].filter(Boolean),
    city: addr.city || '',
    state: addr.state || '',
    pincode: addr.postalCode || addr.pincode || addr.pin || '',
    gstin: order.buyerGstin || contact.gstin || '',
  };

  const items = (Array.isArray(order.items) ? order.items : []).map((item) => {
    const qty = num(item.quantity) || 1;
    const amount = item.lineTotal !== undefined && item.lineTotal !== null ? num(item.lineTotal) : num(item.unitPrice) * qty;
    return {
      name: item.productName || item.name || item.product?.name || 'Item',
      hsn: item.hsnCode || item.hsn || '',
      qty,
      unit: item.unit || '',
      rate: item.unitPrice !== undefined && item.unitPrice !== null ? num(item.unitPrice) : amount / qty,
      amount: round2(amount),
      gstRate: item.gstRate !== undefined && item.gstRate !== null && item.gstRate !== '' ? num(item.gstRate) : null,
    };
  });

  return {
    invoiceNo: order.supplierInvoiceNumber || order.invoiceNumber || '',
    orderNo: order.orderNumber || order.id || '',
    date: order.invoiceDate || order.createdAt,
    seller,
    buyer,
    items,
    cgst: num(order.cgst), sgst: num(order.sgst), igst: num(order.igst),
    tax: num(order.tax ?? totals.tax),
    shipping: num(order.shippingFee ?? totals.shipping),
    discount: num(order.discount),
    total: order.total ?? totals.total,
    isInterState: typeof order.isInterState === 'boolean' ? order.isInterState : null,
    paymentMethod: String(order.paymentMethod || '').toLowerCase(),
    paymentStatus: String(order.paymentStatus || '').toUpperCase(),
    isPartialPayment: Boolean(order.isPartialPayment),
    advanceAmount: num(order.advanceAmount),
    balanceDue: num(order.balanceDue),
    trackingNumber: order.trackingNumber || order.lrNumber || '',
    carrier: order.carrierName || '',
  };
}

/** Works out taxable value, GST ledger lines, the HSN/SAC summary and the invoice total. */
function computeTaxes(o) {
  const taxable = round2(o.items.reduce((sum, it) => sum + it.amount, 0));

  // Charged tax comes from the order; item GST rates are only used when the order carries no tax figures.
  const itemTax = round2(o.items.reduce((sum, it) => sum + (it.amount * (it.gstRate ?? 0)) / 100, 0));
  const chargedTax = round2(o.cgst + o.sgst + o.igst) || o.tax || itemTax;

  let inter = o.isInterState;
  if (inter === null) {
    if (o.igst > 0) inter = true;
    else if (o.cgst > 0 || o.sgst > 0) inter = false;
    else if (stateCode(o.seller.state) && stateCode(o.buyer.state)) inter = stateCode(o.seller.state) !== stateCode(o.buyer.state);
    else inter = false;
  }

  // Items without a stored GST rate use the order's effective rate.
  const effectiveRate = taxable > 0 ? round2((chargedTax / taxable) * 100) : 0;
  const groups = [];
  for (const it of o.items) {
    const rate = it.gstRate ?? effectiveRate;
    const key = `${it.hsn}|${rate}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, hsn: it.hsn, rate, taxable: 0 };
      groups.push(group);
    }
    group.taxable = round2(group.taxable + it.amount);
  }

  const weights = groups.map((g) => g.taxable * g.rate);
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  if (inter) {
    igstTotal = round2(o.igst || chargedTax);
    allocate(igstTotal, weights).forEach((amount, i) => { groups[i].igst = amount; groups[i].tax = amount; });
  } else {
    cgstTotal = round2(o.cgst || chargedTax / 2);
    sgstTotal = round2(o.sgst || chargedTax - cgstTotal);
    const cg = allocate(cgstTotal, weights);
    const sg = allocate(sgstTotal, weights);
    groups.forEach((g, i) => { g.cgst = cg[i]; g.sgst = sg[i]; g.tax = round2(cg[i] + sg[i]); });
  }
  const totalTax = round2(cgstTotal + sgstTotal + igstTotal);

  const rates = [...new Set(groups.map((g) => g.rate))];
  const uniformRate = rates.length === 1 ? rates[0] : null;

  const computedTotal = round2(taxable + totalTax + o.shipping - o.discount);
  const grandTotal = o.total !== undefined && o.total !== null && o.total !== '' ? round2(num(o.total)) : computedTotal;
  const roundOff = round2(grandTotal - computedTotal);

  return { taxable, inter, groups, cgstTotal, sgstTotal, igstTotal, totalTax, uniformRate, grandTotal, roundOff };
}

function paymentTerms(o) {
  if (o.isPartialPayment && o.balanceDue > 0) return `${PAYMENT_LABELS[o.paymentMethod] || 'Advance'} advance, balance on delivery`;
  const method = PAYMENT_LABELS[o.paymentMethod] || '';
  const status = PAYMENT_STATUS[o.paymentStatus] || '';
  if (o.paymentMethod === 'cod') return method;
  return [method, status].filter(Boolean).join(' - ');
}

/** Basic terms summarised from the published TradeExpress Terms and Conditions (clause numbers cited). */
const BASIC_TERMS = [
  ['Tax Invoice & GST', 'This invoice is issued by the Seller named above, who is responsible for its GST registration, tax invoices and statutory returns for this sale. TradeExpress issues invoices only for its own services (Clauses 7.7, 7.8).'],
  ['Prices & Charges', 'Amounts are in Indian Rupees. The amount payable includes the product price, applicable GST, delivery charges and any other charges disclosed before order confirmation (Clauses 7.1, 7.3).'],
  ['Payment & Settlement', 'Payment is made through the payment arrangements designated by TradeExpress. The Seller is paid from cleared funds after the agreed commission, applicable taxes and approved refunds are deducted (Clauses 8.1, 8.3).'],
  ['Delivery', 'Delivery is arranged through TradeExpress\'s designated Logistics Partners. Delivery estimates are indicative unless a specific date has been guaranteed in writing (Clauses 9.1, 9.15).'],
  ['Inspection at Pickup', 'Goods may be open-box inspected at pickup. This inspection is not a guarantee against latent defects or faults that cannot reasonably be detected (Clauses 9.5, 9.8).'],
  ['Proof of Delivery', 'Delivery is complete when the goods reach the Buyer or an authorised recipient and proof of delivery is recorded. A delivery receipt does not waive claims for concealed damage, latent defects or shortages (Clauses 9.18, 9.19).'],
  ['Cancellation', 'The Buyer may request cancellation on the Platform before dispatch. Cancellation after dispatch may be restricted where the shipment cannot reasonably be intercepted (Clauses 11.1, 11.2).'],
  ['Returns & Refunds', 'Report damage, shortage, defects or incorrect goods within 7 days of delivery with the order number and available evidence. Approved refunds are initiated within 5 business days to the original payment method (Clauses 12.3, 12.7, 12.8).'],
  ['Product Conformity', 'The Seller is responsible for the goods conforming to their description, agreed specifications, accepted samples and the confirmed order (Clause 10.1).'],
  ['Disputed Amounts', 'TradeExpress may temporarily hold a disputed amount while a complaint, return or payment reversal is investigated, in proportion to the matter under review (Clause 8.7).'],
  ['Force Majeure', 'A party is not in breach where performance is prevented by events beyond its reasonable control. This does not excuse payment of amounts already due (Clauses 20.1, 20.3).'],
  ['Governing Law & Jurisdiction', `These terms are governed by the ${TERMS_METADATA.governingLaw}. Disputes are first addressed in good faith through the Platform's grievance mechanism and, subject to applicable law, by the competent courts of ${TERMS_METADATA.jurisdiction} (Clauses 23.1, 23.2, 23.4).`],
  ['Grievances', `Complaints may be raised at ${TERMS_METADATA.supportEmail} or ${TERMS_METADATA.supportPhone} (${TERMS_METADATA.workingHours}). Statutory consumer and other legal remedies are not affected (Clauses 22.1, 22.5).`],
];

/**
 * Builds the two-page invoice HTML.
 * options.role: 'buyer' (Original for Recipient) | 'supplier' (Triplicate for Supplier)
 * options.toolbar: show the Close / Print buttons (default true; the in-app preview hides them)
 * options.siteUrl: base URL printed in the terms footer (defaults to the current site)
 */
export function generateTaxInvoiceHtml(order, options = {}) {
  const o = normalizeOrder(order || {});
  const t = computeTaxes(o);
  const e = escapeHtml;

  const isTaxInvoice = Boolean(o.invoiceNo);
  const title = isTaxInvoice ? 'Tax Invoice' : 'Proforma Invoice';
  const invoiceNo = o.invoiceNo || o.orderNo;
  const date = formatDate(o.date);
  const copyType = options.role === 'supplier' ? 'Triplicate for Supplier' : 'Original for Recipient';
  const siteUrl = options.siteUrl ?? (typeof window !== 'undefined' && window.location ? window.location.origin : '');
  const destination = [o.buyer.city, o.buyer.state].filter(Boolean).join(', ');

  const sellerCode = stateCode(o.seller.state);
  const sellerPlace = [o.seller.city, o.seller.state, o.seller.country].filter(Boolean).join(', ') + (o.seller.pincode ? ` - ${o.seller.pincode}` : '');
  const buyerAddress = [...o.buyer.lines, o.buyer.city, o.buyer.state, o.buyer.pincode].filter(Boolean).join(', ');

  const cell = (label, value) => `<div class="lbl">${label}</div><div class="val">${e(value)}</div>`;

  // Particulars: goods, then tax ledgers and other charges right-aligned, as in Tally.
  const itemRows = o.items.map((it, index) => `
        <tr>
          <td class="c b">${index + 1}</td>
          <td class="b">${e(it.name)}</td>
          <td class="c">${e(it.hsn)}</td>
          <td class="r b">${e(`${it.qty}${it.unit ? ` ${it.unit}` : ''}`)}</td>
          <td class="r">${formatINR(it.rate)}</td>
          <td class="c">${e(it.unit)}</td>
          <td class="r b">${formatINR(it.amount)}</td>
        </tr>`).join('');

  const ledgerRow = (label, rate, amount) => `
        <tr>
          <td></td>
          <td class="r b">${label}</td>
          <td></td><td></td>
          <td class="r b">${rate === null ? '' : formatRate(rate)}</td>
          <td class="c">${rate === null ? '' : '%'}</td>
          <td class="r b">${formatINR(amount)}</td>
        </tr>`;

  const half = t.uniformRate === null ? null : t.uniformRate / 2;
  const taxRows = t.inter
    ? (t.igstTotal ? ledgerRow('OUTPUT IGST', t.uniformRate, t.igstTotal) : '')
    : `${t.cgstTotal ? ledgerRow('OUTPUT CGST', half, t.cgstTotal) : ''}${t.sgstTotal ? ledgerRow('Output- SGST', half, t.sgstTotal) : ''}`;
  const chargeRows = [
    o.shipping ? ledgerRow('Freight / Shipping Charges', null, o.shipping) : '',
    o.discount ? ledgerRow('Less: Discount', null, -o.discount) : '',
    t.roundOff ? ledgerRow('Round Off', null, t.roundOff) : '',
  ].join('');

  const hsnRows = t.groups.map((g) => `
        <tr>
          <td>${e(g.hsn)}</td>
          <td class="r">${formatINR(g.taxable)}</td>
          ${t.inter
            ? `<td class="c">${formatRate(g.rate)}%</td><td class="r">${formatINR(g.igst)}</td>`
            : `<td class="c">${formatRate(g.rate / 2)}%</td><td class="r">${formatINR(g.cgst)}</td><td class="c">${formatRate(g.rate / 2)}%</td><td class="r">${formatINR(g.sgst)}</td>`}
          <td class="r">${formatINR(g.tax)}</td>
        </tr>`).join('');

  const remarks = [
    o.orderNo ? `TradeExpress order ${o.orderNo}${date ? ` dated ${date}` : ''}.` : '',
    o.isPartialPayment && o.balanceDue > 0 ? `Advance received Rs ${formatINR(o.advanceAmount)}; balance Rs ${formatINR(o.balanceDue)} payable on delivery.` : '',
    isTaxInvoice ? '' : 'Proforma invoice: the tax invoice is issued by the seller once the order is accepted.',
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title} - ${e(invoiceNo)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #000; font: 11px/1.35 Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { max-width: 800px; margin: 0 auto; padding: 14px 4px; }
  .page { break-after: page; page-break-after: always; }
  .page:last-child { break-after: auto; page-break-after: auto; }
  .b { font-weight: bold; } .r { text-align: right; } .c { text-align: center; }
  h1 { margin: 0 0 10px; font-size: 18px; text-align: center; }
  .copy { margin-bottom: 2px; text-align: right; font-size: 9px; font-style: italic; color: #333; }
  table { width: 100%; border-collapse: collapse; }
  .head td { border: 1px solid #000; vertical-align: top; padding: 4px 6px; }
  .head .lbl { font-size: 9.5px; color: #222; } .head .val { min-height: 13px; font-weight: bold; }
  .party .name { font-size: 12.5px; font-weight: bold; }
  .party .lbl { font-size: 9.5px; }
  .items { border: 1px solid #000; border-top: 0; }
  .items th { border: 1px solid #000; border-top: 0; padding: 5px 4px; font-size: 10.5px; }
  .items td { border-left: 1px solid #000; border-right: 1px solid #000; padding: 3px 6px; vertical-align: top; }
  .items .filler td { height: 150px; }
  .items .total td { border-top: 1px solid #000; padding: 6px; font-weight: bold; font-size: 12px; }
  .words { display: flex; justify-content: space-between; gap: 12px; margin: 5px 0 14px; }
  .words .amt { font-size: 12px; font-weight: bold; margin-top: 2px; }
  .hsn th, .hsn td { border: 1px solid #000; padding: 3px 5px; font-size: 10px; }
  .hsn th { font-weight: bold; } .hsn .sub th { font-weight: normal; }
  .hsn .total td { font-weight: bold; }
  .taxwords { margin: 6px 0 16px; } .taxwords b { margin-left: 18px; font-size: 12px; }
  .foot { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .remarks { flex: 1; } .remarks i { display: block; }
  .sign { width: 300px; border: 1px solid #000; padding: 8px 10px; text-align: right; }
  .sign .space { height: 44px; }
  .computer { margin-top: 26px; text-align: center; font-size: 10px; }
  .terms h2 { margin: 6px 0 18px; padding: 8px 0; border-top: 1.5px solid #1f2a44; border-bottom: 1.5px solid #1f2a44; color: #1f2a44; text-align: center; font-size: 14px; }
  .terms ol { margin: 0; padding-left: 22px; font-size: 11px; line-height: 1.55; }
  .terms li { margin-bottom: 11px; padding-left: 4px; }
  .terms .more { margin-top: 26px; text-align: center; font-size: 10px; color: #555; }
  .toolbar { display: flex; justify-content: flex-end; gap: 8px; max-width: 800px; margin: 0 auto; padding: 10px 4px 0; }
  .toolbar button { padding: 7px 14px; border: 0; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer; }
  .toolbar .primary { background: #0b2716; color: #fff; } .toolbar .secondary { background: #e2e8f0; color: #1e293b; }
  @media print { .toolbar { display: none !important; } .sheet { padding: 0; } }
</style>
</head>
<body>
${options.toolbar === false ? '' : `<div class="toolbar"><button class="secondary" onclick="window.close()">Close</button><button class="primary" onclick="window.print()">Download / Print PDF</button></div>`}
<div class="sheet">
  <section class="page">
    <div class="copy">${copyType}</div>
    <h1>${title}</h1>

    <table class="head">
      <colgroup><col style="width:50%"><col style="width:25%"><col style="width:25%"></colgroup>
      <tr>
        <td rowspan="4" class="party">
          <div class="name">${e(o.seller.name || 'Seller details not available')}</div>
          ${o.seller.address ? `<div>${e(o.seller.address)}</div>` : ''}
          ${sellerPlace.trim() ? `<div>${e(sellerPlace)}</div>` : ''}
          ${o.seller.state ? `<div>State Name : ${e(o.seller.state)}${sellerCode ? `, Code : ${sellerCode}` : ''}</div>` : ''}
          ${o.seller.gstin ? `<div>GSTIN/UIN : <b>${e(o.seller.gstin)}</b></div>` : ''}
        </td>
        <td>${cell(isTaxInvoice ? 'Invoice No.' : 'Proforma Invoice No.', invoiceNo)}</td>
        <td>${cell('Dated', date)}</td>
      </tr>
      <tr><td>${cell('Delivery Note', '')}</td><td>${cell('Mode/Terms of Payment', paymentTerms(o))}</td></tr>
      <tr><td>${cell('Reference No. &amp; Date.', '')}</td><td>${cell('Other References', '')}</td></tr>
      <tr><td>${cell('Buyer\'s Order No.', o.orderNo)}</td><td>${cell('Dated', date)}</td></tr>
      <tr>
        <td rowspan="3" class="party">
          <div class="lbl">Buyer (Bill to)</div>
          <div class="name">${e(o.buyer.name)}</div>
          ${buyerAddress ? `<div>${e(buyerAddress)}</div>` : ''}
          ${o.buyer.state ? `<div>State Name : ${e(o.buyer.state)}</div>` : ''}
          ${o.buyer.gstin ? `<div>GSTIN/UIN : <b>${e(o.buyer.gstin)}</b></div>` : ''}
        </td>
        <td>${cell('Dispatch Doc No.', o.trackingNumber)}</td>
        <td>${cell('Delivery Note Date', '')}</td>
      </tr>
      <tr><td>${cell('Dispatched through', o.carrier)}</td><td>${cell('Destination', destination)}</td></tr>
      <tr><td colspan="2">${cell('Terms of Delivery', '')}</td></tr>
    </table>

    <table class="items">
      <colgroup><col style="width:5%"><col style="width:39%"><col style="width:10%"><col style="width:12%"><col style="width:10%"><col style="width:6%"><col style="width:18%"></colgroup>
      <thead><tr><th>Sl<br>No.</th><th>Particulars</th><th>HSN/SAC</th><th>Quantity</th><th>Rate</th><th>per</th><th>Amount</th></tr></thead>
      <tbody>
        ${itemRows}
        ${taxRows}
        ${chargeRows}
        <tr class="filler"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr class="total"><td></td><td></td><td></td><td class="r">Total</td><td></td><td></td><td class="r">Rs ${formatINR(t.grandTotal)}</td></tr>
      </tbody>
    </table>

    <div class="words">
      <div>Amount Chargeable (in words)<div class="amt">${e(numberToIndianWords(t.grandTotal))}</div></div>
      <i>E. &amp; O.E</i>
    </div>

    <table class="hsn">
      <thead>
        <tr>
          <th rowspan="2">HSN/SAC</th><th rowspan="2">Taxable<br>Value</th>
          ${t.inter ? '<th colspan="2">IGST</th>' : '<th colspan="2">CGST</th><th colspan="2">SGST/UTGST</th>'}
          <th rowspan="2">Total<br>Tax Amount</th>
        </tr>
        <tr class="sub">${t.inter ? '<th>Rate</th><th>Amount</th>' : '<th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th>'}</tr>
      </thead>
      <tbody>
        ${hsnRows}
        <tr class="total">
          <td class="r">Total</td><td class="r">${formatINR(t.taxable)}</td>
          ${t.inter ? `<td></td><td class="r">${formatINR(t.igstTotal)}</td>` : `<td></td><td class="r">${formatINR(t.cgstTotal)}</td><td></td><td class="r">${formatINR(t.sgstTotal)}</td>`}
          <td class="r">${formatINR(t.totalTax)}</td>
        </tr>
      </tbody>
    </table>

    <div class="taxwords">Tax Amount (in words) : <b>${e(numberToIndianWords(t.totalTax))}</b></div>

    <div class="foot">
      <div class="remarks"><i>Remarks:</i>${remarks.map((line) => `<div>${e(line)}</div>`).join('')}</div>
      <div class="sign">
        <div class="b">for ${e(o.seller.name || 'the Seller')}</div>
        <div class="space"></div>
        <div>Authorised Signatory</div>
      </div>
    </div>

    <div class="computer">This is a Computer Generated Invoice</div>
  </section>

  <section class="page terms">
    <h2>BASIC TERMS &amp; CONDITIONS (TRADEEXPRESS B2B MARKETPLACE)</h2>
    <ol>
      ${BASIC_TERMS.map(([heading, text]) => `<li><b>${e(heading)}:</b> ${e(text)}</li>`).join('\n      ')}
    </ol>
    <div class="more">For more details, see the TradeExpress Terms and Conditions${siteUrl ? ` at ${e(siteUrl)}/terms` : ''}.</div>
  </section>
</div>
</body>
</html>`;
}

/** Opens the invoice in a new window and starts printing (Save as PDF). */
export function printTaxInvoice(order, options = {}) {
  const html = generateTaxInvoiceHtml(order, options);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download and print the invoice.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

export default {
  generateTaxInvoiceHtml,
  printTaxInvoice,
};
