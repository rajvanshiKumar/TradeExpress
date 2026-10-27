import { useEffect, useId, useRef, useState } from 'react';

/**
 * Premium custom dropdown panel anchored to a trigger.
 * Closes on outside click, Escape, or when an item inside calls `close`.
 *
 * @param {({ open, toggle, close, props }) => React.ReactNode} trigger
 * @param {({ close, open }) => React.ReactNode} children
 * @param {'right' | 'left' | 'center'} align - Alignment relative to trigger
 * @param {string} panelClassName - Custom panel size or styles
 * @param {string} className - Outer wrapper styles
 * @param {boolean} showGlow - Subtle emerald top border glow
 */
export default function Dropdown({
  trigger,
  children,
  align = 'right',
  panelClassName = 'w-64',
  className = '',
  showGlow = true,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();

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

  const alignClasses = {
    left: 'left-0 ts-dropdown-anim-left',
    right: 'right-0 ts-dropdown-anim',
    center: 'left-1/2 -translate-x-1/2 ts-dropdown-anim-center',
  }[align] || 'right-0 ts-dropdown-anim';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {trigger({
        open,
        toggle,
        close,
        props: {
          ref: triggerRef,
          'aria-expanded': open,
          'aria-haspopup': 'true',
          'aria-controls': menuId,
          onClick: toggle,
        },
      })}

      {open ? (
        <div
          id={menuId}
          role="menu"
          className={`absolute top-full z-50 mt-2 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200/90 bg-white/98 backdrop-blur-2xl shadow-[0_22px_54px_-12px_rgba(11,39,22,0.18),0_0_0_1px_rgba(0,0,0,0.05),0_4px_12px_rgba(0,0,0,0.04)] overflow-hidden ${alignClasses} ${panelClassName}`}
        >
          {showGlow && (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-600/50 to-transparent"
              aria-hidden="true"
            />
          )}
          {children({ close, open })}
        </div>
      ) : null}
    </div>
  );
}

