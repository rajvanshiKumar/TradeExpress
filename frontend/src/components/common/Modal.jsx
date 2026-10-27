import { useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useOverlay from './useOverlay';
import { IconButton } from './Button';

const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

export default function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const panelRef = useOverlay(open, onClose);
  const titleId = useId();
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <div className="ts-fade-in absolute inset-0 bg-navy-950/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`ts-slide-up relative flex max-h-[92dvh] w-full ${widths[size] ?? widths.md} flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl`}
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
          <IconButton icon={X} label="Close dialog" size="sm" tone="muted" onClick={onClose} className="-mr-2 -mt-1" />
        </header>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <footer className="flex flex-wrap justify-end gap-3 border-t bg-surface/60 px-5 py-4 sm:rounded-b-2xl">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
