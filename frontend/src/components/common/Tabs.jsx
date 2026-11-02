import { useRef } from 'react';

/**
 * Accessible tab list (arrow keys move between tabs).
 * tabs: [{ id, label, count }] — render the active panel yourself with <TabPanel>.
 */
export default function Tabs({ tabs, active, onChange, idPrefix = 'tab', className = '', variant = 'underline' }) {
  const refs = useRef({});

  const onKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.id === active);
    let next = null;
    if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
    if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
    if (event.key === 'Home') next = tabs[0];
    if (event.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    event.preventDefault();
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  const pill = variant === 'pill';
  return (
    <div role="tablist" aria-orientation="horizontal" onKeyDown={onKeyDown} className={`ts-no-scrollbar flex gap-1 overflow-x-auto ${pill ? '' : 'border-b'} ${className}`}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        const styles = pill
          ? `rounded-full px-4 py-2 ${selected ? 'bg-navy-900 text-white' : 'bg-white text-navy-900 border hover:bg-navy-50'}`
          : `-mb-px border-b-2 px-4 py-3 ${selected ? 'border-brand-500 text-navy-900' : 'border-transparent text-muted hover:text-navy-900'}`;
        return (
          <button
            key={tab.id} ref={(node) => { refs.current[tab.id] = node; }} type="button" role="tab" id={`${idPrefix}-${tab.id}`}
            aria-selected={selected} aria-controls={`${idPrefix}-panel-${tab.id}`} tabIndex={selected ? 0 : -1} onClick={() => onChange(tab.id)}
            className={`shrink-0 whitespace-nowrap text-sm font-semibold transition-colors ${styles}`}
          >
            {tab.label}
            {tab.count !== undefined ? <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[0.6875rem] ${selected && pill ? 'bg-white/20' : 'bg-navy-50 text-navy-800'}`}>{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, idPrefix = 'tab', className = '', children }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-${id}`} tabIndex={0} className={`ts-fade-in focus-visible:outline-none ${className}`}>
      {children}
    </div>
  );
}
