import { useState, useMemo } from 'react';
import {
  FileText,
  Printer,
  Download,
  X,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { generateTaxInvoiceHtml, printTaxInvoice } from '../../utils/taxInvoiceGenerator.js';

export default function TaxInvoiceModal({ order, isOpen, onClose, defaultRole = 'buyer' }) {
  const [role, setRole] = useState(defaultRole);

  const invoiceHtml = useMemo(() => {
    if (!order) return '';
    return generateTaxInvoiceHtml(order, { role });
  }, [order, role]);

  if (!isOpen || !order) return null;

  const invoiceNo = order.supplierInvoiceNumber || order.invoiceNumber || `INV-${order.orderNumber || order.id}`;

  const handlePrint = () => {
    printTaxInvoice(order, { role });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <FileText className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black tracking-tight text-white">GST Tax Invoice & Consignment Order</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  GST Compliant
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Invoice No: <span className="font-mono text-slate-200">{invoiceNo}</span> | Order: <span className="font-mono text-slate-200">{order.orderNumber || order.id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Copy Selector */}
            <div className="hidden sm:flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setRole('buyer')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  role === 'buyer' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Buyer Copy
              </button>
              <button
                type="button"
                onClick={() => setRole('supplier')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  role === 'supplier' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Supplier Copy
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs transition-colors shadow-xs"
            >
              <Printer className="size-4" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
              title="Close modal"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Interactive A4 Preview */}
        <div className="flex-1 bg-slate-100 p-3 sm:p-5 overflow-y-auto flex justify-center">
          <div className="bg-white rounded-lg shadow-md border border-slate-300 w-full max-w-[850px] overflow-hidden">
            <iframe
              title="Tax Invoice Preview"
              srcDoc={invoiceHtml}
              className="w-full h-[1400px] border-0"
            />
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-600" />
            <span>Digital statutory invoice pursuant to Section 31 of CGST Act, 2017 & IT Act, 2000.</span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#0b2716] hover:bg-emerald-950 text-white font-bold transition-colors shadow-xs"
            >
              <Download className="size-4" />
              <span>Save / Print PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

