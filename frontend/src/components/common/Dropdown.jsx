import { useEffect, useRef, useState } from 'react';

/**
 * Click-to-open panel anchored to a trigger. Closes on outside click, Escape, or when
 * an item inside calls `close`.
 * trigger: ({ open, toggle, props }) => element   children: ({ close }) => content
 */
export default function Dropdown({ trigger, children, align = 'right', panelClassName = 'w-64', className = '' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  const toggle = () => setOpen((value) => !value);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {trigger({ open, toggle, props: { ref: triggerRef, 'aria-expanded': open, 'aria-haspopup': 'true', onClick: toggle } })}
      {open ? (
        <div className={`ts-slide-up absolute top-full z-50 mt-2 max-w-[calc(100vw-2rem)] rounded-xl border bg-white shadow-pop ${align === 'left' ? 'left-0' : 'right-0'} ${panelClassName}`}>
          {children({ close })}
        </div>
      ) : null}
    </div>
  );
}
