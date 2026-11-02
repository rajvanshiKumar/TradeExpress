import { useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useOverlay from './useOverlay';
import { IconButton } from './Button';

export default function Drawer({ open, onClose, title, side = 'right', children, footer, width = 'max-w-sm' }) {
  const panelRef = useOverlay(open, onClose);
  const titleId = useId();
  if (!open) return null;
  const isLeft = side === 'left';

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <div className="ts-fade-in absolute inset-0 bg-navy-950/60" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        style={{ animation: `${isLeft ? 'ts-drawer-left' : 'ts-drawer-right'} 0.25s ease both` }}
        className={`absolute inset-y-0 ${isLeft ? 'left-0' : 'right-0'} flex w-[88vw] ${width} flex-col bg-white shadow-pop`}
      >
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 id={titleId} className="text-base font-bold">{title}</h2>
          <IconButton icon={X} label="Close panel" size="sm" tone="muted" onClick={onClose} />
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer ? <footer className="border-t p-4">{footer}</footer> : null}
      </aside>
    </div>,
    document.body,
  );
}
