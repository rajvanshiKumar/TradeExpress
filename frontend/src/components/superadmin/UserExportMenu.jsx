import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, FileType2, LoaderCircle } from 'lucide-react';

const OPTIONS = [
  { format: 'csv', label: 'CSV', hint: 'Comma-separated (.csv)', icon: FileText },
  { format: 'xlsx', label: 'Excel', hint: 'Spreadsheet (.xlsx)', icon: FileSpreadsheet },
  { format: 'pdf', label: 'PDF', hint: 'Printable report (.pdf)', icon: FileType2 },
];

/**
 * Export button for the User Directory: opens a menu with CSV, Excel and PDF; picking one downloads that file
 * with the current filters. onExport(format) must return a promise.
 */
export default function UserExportMenu({ onExport }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = async (format) => {
    if (busy) return;
    setBusy(format);
    setOpen(false);
    try {
      await onExport(format);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={Boolean(busy)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
        <span>{busy ? `Exporting ${OPTIONS.find((o) => o.format === busy)?.label}…` : 'Export'}</span>
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div role="menu" className="absolute right-0 z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {OPTIONS.map(({ format, label, hint, icon: Icon }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              onClick={() => choose(format)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none"
            >
              <span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-800"><Icon className="size-4" /></span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-slate-900">{label}</span>
                <span className="block text-[11px] text-slate-500">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
