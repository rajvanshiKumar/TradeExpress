import { numberToIndianWords } from './numberToIndianWords.js';

/**
 * State code mapping for standard Indian GST states.
 */
const STATE_CODES = {
  'JAMMU AND KASHMIR': '01',
  'HIMACHAL PRADESH': '02',
  'PUNJAB': '03',
  'CHANDIGARH': '04',
  'UTTARAKHAND': '05',
  'HARYANA': '06',
  'DELHI': '07',
  'RAJASTHAN': '08',
  'UTTAR PRADESH': '09',
  'BIHAR': '10',
  'SIKKIM': '11',
  'ARUNACHAL PRADESH': '12',
  'NAGALAND': '13',
  'MANIPUR': '14',
  'MIZORAM': '15',
  'TRIPURA': '16',
  'MEGHALAYA': '17',
  'ASSAM': '18',
  'WEST BENGAL': '19',
  'JHARKHAND': '20',
  'ODISHA': '21',
  'CHHATTISGARH': '22',
  'MADHYA PRADESH': '23',
  'GUJARAT': '24',
  'DAMAN AND DIU': '25',
  'DADRA AND NAGAR HAVELI': '26',
  'MAHARASHTRA': '27',
  'ANDHRA PRADESH (BEFORE DIVISION)': '28',
  'KARNATAKA': '29',
  'GOA': '30',
  'LAKSHADWEEP': '31',
  'KERALA': '32',
  'TAMIL NADU': '33',
  'PUDUCHERRY': '34',
  'ANDAMAN AND NICOBAR ISLANDS': '35',
  'TELANGANA': '36',
  'ANDHRA PRADESH': '37',
  'LADAKH': '38',
};

function getStateCode(stateName) {
  if (!stateName) return '09';
  const clean = stateName.toUpperCase().trim();
  return STATE_CODES[clean] || '09';
}

function formatINR(val) {
  const num = Number(val || 0);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateVal) {
  if (!dateVal) return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

/**
 * Builds the complete 2-page GST Tax Invoice HTML string adhering to standard Tally/B2B structure.
 */
export function generateTaxInvoiceHtml(order, options = {}) {
  const isSupplierCopy = options.role === 'supplier';
  const copyType = isSupplierCopy ? 'Supplier / Transporter Copy' : 'Original for Recipient';

  // Seller Details
  const sellerCompany = order.supplier?.company || order.supplierCompany || 'TRADEEXPRESS ENTERPRISES INDIA PVT. LTD.';
  const sellerAddress = order.supplier?.address || 'Commercial Tower B, Sector 62, Noida';
  const sellerCity = order.supplier?.city || 'Gautam Buddha Nagar';
  const sellerState = order.supplier?.state || 'Uttar Pradesh';
  const sellerPincode = order.supplier?.pincode || '201301';
  const sellerGstin = order.supplierGstin || order.supplier?.gstin || '09AABCT1234F1Z8';
  const sellerStateCode = getStateCode(sellerState);

  // Buyer Details
  const buyerName = order.buyerCompany || order.buyerName || order.user?.company || order.user?.name || 'Authorized Buyer';
  const addr = typeof order.deliveryAddress === 'object' && order.deliveryAddress !== null
    ? order.deliveryAddress
    : order.address || {};
  const buyerStreet = addr.street || addr.addressLine1 || addr.address || 'Industrial Area';
  const buyerCity = addr.city || 'Lucknow';
  const buyerState = addr.state || 'Uttar Pradesh';
  const buyerPincode = addr.pincode || addr.pin || addr.postalCode || '277304';
  const buyerStateCode = getStateCode(buyerState);
  const buyerGstin = order.buyerGstin || order.user?.gstin || 'Unregistered / Consumer';

  // Invoice Metadata
  const invoiceNo = order.supplierInvoiceNumber || order.invoiceNumber || `INV-${new Date(order.createdAt || Date.now()).getFullYear()}-${String(order.orderNumber || order.id || '0101').replace(/[^0-9]/g, '').slice(-4) || '0101'}`;
  const invoiceDate = formatDate(order.createdAt);
  const orderRef = order.orderNumber || order.id || 'N/A';
  const paymentTerms = order.paymentMethod ? `${order.paymentMethod.toUpperCase()} (${order.paymentStatus || 'CONFIRMED'})` : 'Immediate / Escrow';
  const dispatchDocNo = order.trackingNumber || `LR-${String(orderRef).replace(/[^a-zA-Z0-9]/g, '').slice(-6)}`;
  const carrier = order.carrierName || (order.shippingMethod === 'supplier' ? 'Supplier Fleet' : 'TradeExpress Logistics');
  const destination = `${buyerCity}, ${buyerState}`;

  // Line items
  const rawItems = Array.isArray(order.items) && order.items.length > 0
    ? order.items
    : [
        {
          productName: order.productName || 'Industrial B2B Materials',
          hsnCode: '8471',
          quantity: order.quantity || 1,
          unit: 'NOS',
          unitPrice: order.subtotal || order.total || 450000,
          lineTotal: order.subtotal || order.total || 450000,
          gstRate: 18,
        },
      ];

  const items = rawItems.map((item, idx) => ({
    sl: idx + 1,
    name: item.productName || item.product?.title || 'B2B Consignment',
    hsn: item.hsnCode || '8471',
    qty: item.quantity || 1,
    unit: (item.unit || 'NOS').toUpperCase(),
    rate: Number(item.unitPrice || (Number(item.lineTotal || 0) / (item.quantity || 1))),
    amount: Number(item.lineTotal || (Number(item.unitPrice || 0) * (item.quantity || 1))),
    gstRate: Number(item.gstRate || 18),
  }));

  const taxableSubtotal = items.reduce((sum, it) => sum + it.amount, 0);

  // Taxes
  const isInterState = order.isInterState !== undefined
    ? order.isInterState
    : sellerStateCode !== buyerStateCode;

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstAmount = Number(order.igst || (taxableSubtotal * 0.18));
  } else {
    cgstAmount = Number(order.cgst || (taxableSubtotal * 0.09));
    sgstAmount = Number(order.sgst || (taxableSubtotal * 0.09));
  }

  const totalTax = isInterState ? igstAmount : (cgstAmount + sgstAmount);
  const grandTotal = Number(order.total || (taxableSubtotal + totalTax));

  const totalAmountWords = numberToIndianWords(grandTotal);
  const totalTaxWords = numberToIndianWords(totalTax);

  // Group by HSN/SAC
  const hsnGroups = {};
  items.forEach((it) => {
    if (!hsnGroups[it.hsn]) {
      hsnGroups[it.hsn] = {
        hsn: it.hsn,
        taxable: 0,
        rate: it.gstRate,
      };
    }
    hsnGroups[it.hsn].taxable += it.amount;
  });

  const hsnRows = Object.values(hsnGroups).map((g) => {
    const cgstRate = g.rate / 2;
    const cgstAmt = isInterState ? 0 : (g.taxable * (cgstRate / 100));
    const sgstAmt = isInterState ? 0 : (g.taxable * (cgstRate / 100));
    const igstAmt = isInterState ? (g.taxable * (g.rate / 100)) : 0;
    const taxAmt = isInterState ? igstAmt : (cgstAmt + sgstAmt);

    return {
      hsn: g.hsn,
      taxable: g.taxable,
      rate: g.rate,
      cgstRate,
      cgstAmt,
      sgstAmt,
      igstAmt,
      taxAmt,
    };
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoiceNo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000;
      background: #fff;
      font-size: 11px;
      line-height: 1.35;
      margin: 0;
      padding: 0;
    }
    .invoice-wrapper {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
    }
    .page {
      page-break-after: always;
      break-after: page;
      position: relative;
      min-height: 1050px;
      padding-bottom: 20px;
    }
    .page:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .uppercase { text-transform: uppercase; }

    /* Top Heading */
    .doc-title {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin: 0 0 4px 0;
      text-align: center;
    }
    .copy-tag {
      font-size: 9px;
      text-align: right;
      font-weight: 600;
      color: #444;
      margin-bottom: 2px;
    }

    /* Primary Grid Box */
    .main-box {
      border: 1.5px solid #000;
      width: 100%;
      border-collapse: collapse;
    }
    .main-box td, .main-box th {
      border: 1px solid #000;
      vertical-align: top;
      padding: 4px 6px;
    }

    /* Sub Tables */
    .sub-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0;
    }
    .sub-table td {
      border: none;
      padding: 2px 4px;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      border-left: 1.5px solid #000;
      border-right: 1.5px solid #000;
      border-bottom: 1px solid #000;
    }
    .items-table th {
      border: 1px solid #000;
      padding: 4px;
      background: #fdfdfd;
      font-size: 10.5px;
      font-weight: bold;
    }
    .items-table td {
      border-left: 1px solid #000;
      border-right: 1px solid #000;
      padding: 3px 6px;
      font-size: 10.5px;
    }
    .items-table .item-row td {
      border-top: none;
      border-bottom: none;
    }
    .items-table .tax-sub-row td {
      font-size: 10px;
      color: #111;
      border-top: none;
      border-bottom: none;
    }
    .items-table .total-row td {
      border-top: 1px solid #000;
      border-bottom: 1.5px solid #000;
      font-weight: bold;
      padding: 5px 6px;
    }

    /* GST Table */
    .gst-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      margin-top: -1px;
    }
    .gst-table th, .gst-table td {
      border: 1px solid #000;
      padding: 3px 5px;
      font-size: 10px;
    }
    .gst-table th {
      background: #fafafa;
      font-weight: bold;
    }

    /* Signatory & Remarks Box */
    .bottom-box {
      border: 1.5px solid #000;
      border-top: none;
      width: 100%;
      border-collapse: collapse;
    }
    .bottom-box td {
      border: 1px solid #000;
      padding: 6px 8px;
      vertical-align: top;
    }

    .signatory-container {
      height: 75px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: right;
    }

    .computer-gen {
      margin-top: 8px;
      font-size: 9.5px;
      text-align: center;
      color: #333;
    }

    /* Page 2 Terms */
    .terms-heading {
      font-size: 13px;
      font-weight: 800;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding-bottom: 6px;
      border-bottom: 1.5px solid #000;
      margin-bottom: 14px;
    }
    .terms-list {
      list-style-type: decimal;
      padding-left: 20px;
      margin: 0;
      font-size: 10.5px;
      line-height: 1.55;
    }
    .terms-list li {
      margin-bottom: 10px;
      text-align: justify;
    }
    .terms-list strong {
      color: #000;
    }
    .terms-footer {
      position: absolute;
      bottom: 25px;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 9.5px;
      color: #444;
      border-top: 1px solid #ccc;
      padding-top: 8px;
    }

    /* Print Controls */
    @media print {
      .no-print { display: none !important; }
      body { margin: 0; padding: 0; }
    }
    .print-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-bottom: 15px;
      padding: 10px;
      background: #f1f5f9;
      border-radius: 8px;
    }
    .btn {
      padding: 7px 14px;
      font-size: 12px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
      border: none;
    }
    .btn-primary { background: #0b2716; color: #fff; }
    .btn-secondary { background: #e2e8f0; color: #1e293b; }
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    <div class="no-print print-actions">
      <button class="btn btn-secondary" onclick="window.close()">Close Window</button>
      <button class="btn btn-primary" onclick="window.print()">Download / Print PDF</button>
    </div>

    <!-- ========================================== -->
    <!-- PAGE 1: TAX INVOICE MASTER STRUCTURE      -->
    <!-- ========================================== -->
    <div class="page">
      <div class="copy-tag">${copyType}</div>
      <div class="doc-title">Tax Invoice</div>

      <!-- Top Master Grid Box -->
      <table class="main-box">
        <tr>
          <!-- Top Left: Seller Info -->
          <td style="width: 50%; height: 110px;">
            <div class="font-bold" style="font-size: 12px; margin-bottom: 2px;">${sellerCompany}</div>
            <div>${sellerAddress}</div>
            <div>${sellerCity}, ${sellerState}, India - ${sellerPincode}</div>
            <div><span class="font-bold">State Name :</span> ${sellerState}, <span class="font-bold">Code :</span> ${sellerStateCode}</div>
            <div><span class="font-bold">GSTIN/UIN :</span> ${sellerGstin}</div>
          </td>

          <!-- Top Right: Invoice Metadata Grid -->
          <td style="width: 50%; padding: 0;">
            <table class="sub-table" style="height: 100%;">
              <tr style="border-bottom: 1px solid #000;">
                <td style="width: 50%; border-right: 1px solid #000; padding: 3px 5px;">
                  <span style="font-size: 9px; color: #444;">Invoice No.</span><br>
                  <span class="font-bold" style="font-size: 11px;">${invoiceNo}</span>
                </td>
                <td style="width: 50%; padding: 3px 5px;">
                  <span style="font-size: 9px; color: #444;">Dated</span><br>
                  <span class="font-bold">${invoiceDate}</span>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #000;">
                <td style="border-right: 1px solid #000; padding: 3px 5px;">
                  <span style="font-size: 9px; color: #444;">Delivery Note</span><br>
                  <span>${order.shippingEta || 'Immediate Dispatch'}</span>
                </td>
                <td style="padding: 3px 5px;">
                  <span style="font-size: 9px; color: #444;">Mode/Terms of Payment</span><br>
                  <span class="font-bold">${paymentTerms}</span>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #000;">
                <td style="border-right: 1px solid #000; padding: 3px 5px;">
                  <span style="font-size: 9px; color: #444;">Reference No. & Date.</span><br>
                  <span>${orderRef}</span>
                </td>
                <td style="padding: 3px 5px;">
                  <span style="font-size: 9px; color: #444;">Other References</span><br>
                  <span>TradeExpress Escrow</span>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #000;">
                <td style="border-right: 1px solid #000; padding: 3px 5px;">
                  <span style="font-size: 9px; color: #444;">Buyer's Order No.</span><br>
                  <span>${orderRef}</span>
                </td>
                <td style="padding: 3px 5px;">
                  <span style="font-size: 9px; color: #444;">Dated</span><br>
                  <span>${invoiceDate}</span>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #000;">
                <td style="border-right: 1px solid #000; padding: 3px 5px;">
                  <span style="font-size: 9px; color: #444;">Dispatch Doc No.</span><br>
                  <span class="font-bold">${dispatchDocNo}</span>
                </td>
                <td style="padding: 3px 5px;">
                  <span style="font-size: 9px; color: #444;">Delivery Note Date</span><br>
                  <span>${invoiceDate}</span>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #000;">
                <td style="border-right: 1px solid #000; padding: 3px 5px;">
                  <span style="font-size: 9px; color: #444;">Dispatched through</span><br>
                  <span>${carrier}</span>
                </td>
                <td style="padding: 3px 5px;">
                  <span style="font-size: 9px; color: #444;">Destination</span><br>
                  <span>${destination}</span>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding: 3px 5px;">
                  <span style="font-size: 9px; color: #444;">Terms of Delivery</span><br>
                  <span>Doorstep / Freight Paid, Verified Delivery Confirmation OTP required</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Buyer Info Row -->
        <tr>
          <td colspan="2" style="padding: 5px 6px;">
            <div style="font-size: 9.5px; color: #444;">Buyer (Bill to)</div>
            <div class="font-bold" style="font-size: 12px;">${buyerName}</div>
            <div>${buyerStreet}, ${buyerCity}, ${buyerState}, ${buyerPincode}</div>
            <div><span class="font-bold">State Name :</span> ${buyerState}, <span class="font-bold">Code :</span> ${buyerStateCode}</div>
            <div><span class="font-bold">GSTIN/UIN :</span> ${buyerGstin}</div>
          </td>
        </tr>
      </table>

      <!-- Line Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 5%;">Sl<br>No.</th>
            <th style="width: 45%;">Particulars</th>
            <th style="width: 10%;">HSN/SAC</th>
            <th style="width: 8%;">Quantity</th>
            <th style="width: 12%;">Rate</th>
            <th style="width: 6%;">per</th>
            <th style="width: 14%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it) => `
            <tr class="item-row">
              <td class="text-center font-bold">${it.sl}</td>
              <td>
                <div class="font-bold">${it.name}</div>
              </td>
              <td class="text-center font-bold">${it.hsn}</td>
              <td class="text-right font-bold">${it.qty}</td>
              <td class="text-right">${formatINR(it.rate)}</td>
              <td class="text-center">${it.unit}</td>
              <td class="text-right font-bold">${formatINR(it.amount)}</td>
            </tr>
          `).join('')}

          <!-- Tax breakdown sub-rows matching exact structure -->
          ${!isInterState ? `
            <tr class="tax-sub-row">
              <td></td>
              <td style="padding-left: 20px;" class="font-bold">OUTPUT CGST</td>
              <td></td>
              <td></td>
              <td class="text-right">9 %</td>
              <td></td>
              <td class="text-right font-bold">${formatINR(cgstAmount)}</td>
            </tr>
            <tr class="tax-sub-row">
              <td></td>
              <td style="padding-left: 20px;" class="font-bold">Output- SGST</td>
              <td></td>
              <td></td>
              <td class="text-right">9 %</td>
              <td></td>
              <td class="text-right font-bold">${formatINR(sgstAmount)}</td>
            </tr>
          ` : `
            <tr class="tax-sub-row">
              <td></td>
              <td style="padding-left: 20px;" class="font-bold">OUTPUT IGST</td>
              <td></td>
              <td></td>
              <td class="text-right">18 %</td>
              <td></td>
              <td class="text-right font-bold">${formatINR(igstAmount)}</td>
            </tr>
          `}

          <!-- Spacer rows to give authentic tall layout -->
          <tr style="height: 120px;">
            <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
          </tr>

          <!-- Total Row -->
          <tr class="total-row">
            <td colspan="6" class="text-right">Total</td>
            <td class="text-right font-bold">Rs ${formatINR(grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Amount Chargeable in words -->
      <table style="width: 100%; border: 1.5px solid #000; border-top: none; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 6px; font-size: 10px;">
            <span style="font-size: 9px; color: #444;">Amount Chargeable (in words)</span><br>
            <span class="font-bold" style="font-size: 11px;">${totalAmountWords}</span>
          </td>
          <td style="text-align: right; padding: 4px 6px; font-size: 10px; font-style: italic; width: 80px;">
            E. & O.E
          </td>
        </tr>
      </table>

      <!-- HSN/SAC Tax Summary Table -->
      <table class="gst-table">
        <thead>
          <tr>
            <th rowspan="2" style="width: 15%;">HSN/SAC</th>
            <th rowspan="2" style="width: 20%;">Taxable<br>Value</th>
            ${!isInterState ? `
              <th colspan="2" style="width: 25%;">CGST</th>
              <th colspan="2" style="width: 25%;">SGST/UTGST</th>
            ` : `
              <th colspan="2" style="width: 50%;">IGST</th>
            `}
            <th rowspan="2" style="width: 15%;">Total<br>Tax Amount</th>
          </tr>
          <tr>
            ${!isInterState ? `
              <th style="width: 8%;">Rate</th>
              <th style="width: 17%;">Amount</th>
              <th style="width: 8%;">Rate</th>
              <th style="width: 17%;">Amount</th>
            ` : `
              <th style="width: 15%;">Rate</th>
              <th style="width: 35%;">Amount</th>
            `}
          </tr>
        </thead>
        <tbody>
          ${hsnRows.map((r) => `
            <tr>
              <td class="text-center font-bold">${r.hsn}</td>
              <td class="text-right">${formatINR(r.taxable)}</td>
              ${!isInterState ? `
                <td class="text-center">${r.cgstRate}%</td>
                <td class="text-right">${formatINR(r.cgstAmt)}</td>
                <td class="text-center">${r.cgstRate}%</td>
                <td class="text-right">${formatINR(r.sgstAmt)}</td>
              ` : `
                <td class="text-center">${r.rate}%</td>
                <td class="text-right">${formatINR(r.igstAmt)}</td>
              `}
              <td class="text-right font-bold">${formatINR(r.taxAmt)}</td>
            </tr>
          `).join('')}

          <tr style="font-weight: bold; background: #fafafa;">
            <td class="text-right">Total</td>
            <td class="text-right">${formatINR(taxableSubtotal)}</td>
            ${!isInterState ? `
              <td></td>
              <td class="text-right">${formatINR(cgstAmount)}</td>
              <td></td>
              <td class="text-right">${formatINR(sgstAmount)}</td>
            ` : `
              <td></td>
              <td class="text-right">${formatINR(igstAmount)}</td>
            `}
            <td class="text-right">${formatINR(totalTax)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Tax in Words -->
      <table style="width: 100%; border: 1.5px solid #000; border-top: none; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 6px; font-size: 10px;">
            <span class="font-bold">Tax Amount (in words) :</span> ${totalTaxWords}
          </td>
        </tr>
      </table>

      <!-- Remarks & Signature Box -->
      <table class="bottom-box">
        <tr>
          <td style="width: 55%;">
            <div class="font-bold" style="font-size: 9.5px; text-decoration: underline;">Remarks:</div>
            <div style="font-size: 10px; margin-top: 2px;">
              This amount is strictly non refundable as per TradeExpress terms.
            </div>
            <div style="font-size: 9px; color: #555; margin-top: 6px;">
              Subject to exclusive jurisdiction of courts in Noida, Gautam Buddha Nagar, Uttar Pradesh.
            </div>
          </td>
          <td style="width: 45%;">
            <div class="signatory-container">
              <div class="font-bold" style="font-size: 10.5px;">for ${sellerCompany}</div>
              <div>
                <div style="font-style: italic; font-size: 13px; font-family: 'Times New Roman', serif;">Manish Kumar</div>
                <div class="font-bold" style="font-size: 10px;">Authorised Signatory</div>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <div class="computer-gen">This is a Computer Generated Invoice</div>
    </div>

    <!-- ========================================== -->
    <!-- PAGE 2: BASIC TERMS & CONDITIONS           -->
    <!-- ========================================== -->
    <div class="page">
      <div class="terms-heading">BASIC TERMS & CONDITIONS (TRADEEXPRESS B2B MARKETPLACE)</div>

      <ol class="terms-list">
        <li>
          <strong>Non-Refundable & Open-Box Inspection:</strong> This payment and commercial order are non-refundable once dispatched, except as strictly provided under Section 9 and Section 12 of the TradeExpress B2B Marketplace Terms. Buyers are entitled and required to conduct an open-box inspection at the point of delivery in the presence of the authorized transporter.
        </li>
        <li>
          <strong>Contract Duration & Order Acceptance:</strong> The duration of this commercial agreement shall be as specified in the applicable purchase order, proforma invoice, or logistics consignment note. Unless otherwise determined by the parties, this contract remains valid until full delivery confirmation and escrow fund settlement.
        </li>
        <li>
          <strong>Payment Mandate & Escrow Settlement:</strong> Payments are processed securely via Escrow custody. Funds shall be held in escrow until successful delivery confirmation OTP is completed by the authorized consignee. TradeExpress is authorized to deduct applicable marketplace platform commissions, GTA GST, and statutory TDS prior to net supplier disbursal.
        </li>
        <li>
          <strong>Transportation & Consignment Dispatch:</strong> Shipments are executed through verified TradeExpress Logistics Partners or authorized Supplier-Managed fleets. Consignees must verify physical seals, vehicle registration, and Lorry Receipt (LR/Bilty) before signing physical Proof of Delivery (POD).
        </li>
        <li>
          <strong>Notice of Defects & Claims:</strong> In case of damage, shortage, or non-conformance observed during open-box delivery, a dispute must be logged on the TradeExpress Dispute Console within 7 (seven) calendar days of delivery. No latent defect claims will be entertained beyond this statutory period.
        </li>
        <li>
          <strong>Right to Terminate & Cancel:</strong> TradeExpress reserves the right to suspend or cancel any transaction or dispatch order at its sole discretion in cases of detected fraud, KYC non-compliance, regulatory embargo, or breach of statutory trade guidelines.
        </li>
        <li>
          <strong>Warranties & Specifications:</strong> The Supplier warrants that all products delivered under this invoice strictly conform to standard industrial specifications, Bureau of Indian Standards (BIS) norms, and batch quality parameters furnished on the TradeExpress catalog.
        </li>
        <li>
          <strong>Statutory GST Compliance:</strong> This Tax Invoice is issued pursuant to Section 31 of the Central Goods and Services Tax (CGST) Act, 2017. Input Tax Credit (ITC) eligibility is contingent upon valid supplier GSTR-1 return filing and tax remittance.
        </li>
        <li>
          <strong>Dispute Resolution & Arbitration:</strong> Any disputes, differences, or claims arising out of or in connection with this invoice or transaction shall be settled by binding arbitration in accordance with the provisions of the Indian Arbitration & Conciliation Act, 1996. The seat and venue of arbitration shall be Gautam Buddha Nagar / Noida, Uttar Pradesh, India.
        </li>
        <li>
          <strong>Consent for Transactional Communication:</strong> The Buyer and Supplier expressly consent to receive operational and transactional SMS, WhatsApp, voice OTP, and email notifications regarding delivery schedules, dispatch updates, and billing statements.
        </li>
        <li>
          <strong>Privacy & Statutory Retention:</strong> All business records, GSTIN data, and delivery logs collected are archived securely in compliance with the Information Technology Act, 2000 and TradeExpress Data Privacy Policies for a mandatory audit period of 8 years.
        </li>
        <li>
          <strong>Amendments:</strong> TradeExpress reserves the right to modify these operational terms in response to statutory tax amendments or regulatory directives. Continued use of the platform represents acceptance of current terms.
        </li>
        <li>
          <strong>Force Majeure:</strong> Neither party shall be held liable for non-performance or transit delays resulting from Acts of God (including earthquake, flood, storm, pandemic), war, civil commotion, strikes, state border blockades, or regional internet outages.
        </li>
      </ol>

      <div class="terms-footer">
        For more details, visit <strong>tradeexpress.in</strong> &nbsp;|&nbsp; Customer Support: <strong>support@tradeexpress.com</strong> &nbsp;|&nbsp; Helpline: <strong>+91 9600012345</strong>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Triggers direct browser printing or saving as PDF with pristine A4 formatting.
 */
export function printTaxInvoice(order, options = {}) {
  const html = generateTaxInvoiceHtml(order, options);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download and print the Tax Invoice.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for resources to render, then open print dialog
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

export default {
  generateTaxInvoiceHtml,
  printTaxInvoice,
};
