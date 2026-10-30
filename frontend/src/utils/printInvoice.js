/**
 * Formats and triggers the browser print / PDF export dialog for an official TradeExpress B2B GST Tax Invoice.
 * Adheres to standard Indian GST structure (Page 1: Tax Invoice Master, Page 2: Basic Terms & Conditions).
 */
import { printTaxInvoice, generateTaxInvoiceHtml } from './taxInvoiceGenerator.js';

export function printInvoice(order, options = {}) {
  return printTaxInvoice(order, options);
}

export { printTaxInvoice, generateTaxInvoiceHtml };
export default printInvoice;
