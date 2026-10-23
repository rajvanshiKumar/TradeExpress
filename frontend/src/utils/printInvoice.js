/**
 * Formats and triggers the browser print dialog for an official TradeExpress B2B GST Tax Invoice & Purchase Order.
 */
export function printInvoice(order) {
  if (!order) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const buyer = order.deliveryAddress || order.address || {};
  const orderNumber = order.orderNumber || order.id || 'TS-ORD';
  const invoiceNum = order.invoiceNumber || order.supplierInvoiceNumber || `TS-INV-${orderNumber}`;
  const invoiceDate = new Date(order.createdAt || order.orderDate || Date.now()).toLocaleDateString('en-IN');
  const items = order.items || [];
  const isInter = order.isInterState;

  const subtotal = Number(order.totals?.subtotal || order.subtotal || 0);
  const shipping = Number(order.totals?.shipping || order.totals?.shippingFee || order.shippingFee || 0);
  const tax = Number(order.totals?.tax || order.tax || 0);
  const total = Number(order.totals?.total || order.total || 0);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>GST Tax Invoice & Purchase Order - ${orderNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; font-size: 13px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 25px; }
          .logo { font-size: 24px; font-weight: 800; color: #047857; letter-spacing: -0.5px; }
          .subtitle { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 25px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
          .box h4 { margin: 0 0 10px 0; font-size: 12px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 12px; border: 1px solid #cbd5e1; }
          td { padding: 10px; border: 1px solid #e2e8f0; }
          .totals { margin-left: auto; width: 340px; }
          .totals-row { display: flex; justify-content: space-between; padding: 5px 0; }
          .totals-row.grand { font-size: 16px; font-weight: bold; border-top: 2px solid #0f172a; margin-top: 5px; padding-top: 10px; color: #047857; }
          .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #64748b; text-align: center; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <img src="/logos/tradeexpress-logo.png" alt="TradeExpress" style="height: 36px; width: auto; max-width: 220px; object-fit: contain; margin-bottom: 4px; display: block;" onerror="this.style.display='none'" />
            <div class="subtitle">B2B Wholesale Marketplace & Fulfillment</div>
            <p style="margin: 5px 0 0 0; font-size: 11px; color: #475569;">TradeExpress B2B Private Limited · GSTIN: 27AABCT9999F1Z0</p>
          </div>
          <div style="text-align: right;">
            <h2 style="margin: 0; color: #0f172a; font-size: 18px;">GST TAX INVOICE & PO</h2>
            <p style="margin: 3px 0; font-weight: 600;">Invoice No: ${invoiceNum}</p>
            <p style="margin: 3px 0; font-size: 12px; color: #64748b;">Order Ref: ${orderNumber}</p>
            <p style="margin: 3px 0; font-size: 12px; color: #64748b;">Date: ${invoiceDate}</p>
          </div>
        </div>

        <div class="grid">
          <div class="box">
            <h4>Supplier / Consignor</h4>
            <p style="margin: 0; font-weight: 700;">${order.supplierName || 'TradeExpress Verified Wholesale Supplier'}</p>
            <p style="margin: 2px 0;">GSTIN: ${order.supplierGstin || '27AABCT1234F1Z1'}</p>
            <p style="margin: 2px 0;">State of Origin: ${order.supplierState || 'Maharashtra (State Code: 27)'}</p>
          </div>
          <div class="box">
            <h4>Buyer / Consignee & Bill-To</h4>
            <p style="margin: 0; font-weight: 700;">${order.contact?.name || buyer.name || order.buyerName || 'Purchasing Manager'}</p>
            <p style="margin: 2px 0;">${order.contact?.company || buyer.company || order.buyerCompany || ''}</p>
            <p style="margin: 2px 0;">GSTIN: ${order.buyerGstin || buyer.gstin || 'URP (Unregistered Person)'}</p>
            <p style="margin: 2px 0;">${buyer.street || ''}, ${buyer.city || ''}, ${buyer.state || ''} - ${buyer.postalCode || ''}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Description of Goods</th>
              <th>HSN / SAC</th>
              <th>Qty</th>
              <th>Rate (₹)</th>
              <th>Taxable Val (₹)</th>
              <th>GST Rate</th>
              <th>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => {
              const uPrice = Number(item.unitPrice || 0);
              const qty = Number(item.quantity || 1);
              const lTotal = uPrice * qty;
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${item.name || item.productName}</strong><br/><span style="font-size: 11px; color: #64748b;">SKU: ${item.sku || item.productSku || 'TS-SKU'}</span></td>
                  <td>${item.hsnCode || '84713010'}</td>
                  <td>${qty} ${item.unit || 'pcs'}</td>
                  <td>₹${uPrice.toLocaleString('en-IN')}</td>
                  <td>₹${lTotal.toLocaleString('en-IN')}</td>
                  <td>18%</td>
                  <td>₹${(lTotal * 1.18).toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row"><span>Taxable Subtotal:</span><span>₹${subtotal.toLocaleString('en-IN')}</span></div>
          <div class="totals-row"><span>Logistics & Freight:</span><span>₹${shipping.toLocaleString('en-IN')}</span></div>
          ${isInter ? `
            <div class="totals-row"><span>IGST (18%):</span><span>₹${tax.toLocaleString('en-IN')}</span></div>
          ` : `
            <div class="totals-row"><span>CGST (9%):</span><span>₹${(tax / 2).toLocaleString('en-IN')}</span></div>
            <div class="totals-row"><span>SGST (9%):</span><span>₹${(tax / 2).toLocaleString('en-IN')}</span></div>
          `}
          <div class="totals-row grand"><span>Total Invoice Value:</span><span>₹${total.toLocaleString('en-IN')}</span></div>
          ${order.isPartialPayment ? `
            <div class="totals-row" style="color: #b45309; font-weight: bold; margin-top: 5px;"><span>Advance Paid (20%):</span><span>₹${Number(order.advanceAmount || 0).toLocaleString('en-IN')}</span></div>
            <div class="totals-row" style="color: #64748b;"><span>Balance Due on Delivery:</span><span>₹${Number(order.balanceDue || 0).toLocaleString('en-IN')}</span></div>
          ` : ''}
        </div>

        <div class="footer">
          <p>This is a computer generated invoice and does not require physical signature. E.&O.E.</p>
          <p>Subject to Mumbai, Maharashtra jurisdiction. Verified B2B TradeExpress Escrow Transaction.</p>
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
