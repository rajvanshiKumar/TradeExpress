import { useId, useRef, useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { HELP_FAQ_TABS } from '../../data/help/helpContent';

/** FAQ tabs (ARIA tabs pattern) with one accordion of questions per tab. */
export default function HelpFaqTabs({ onOpenArticle }) {
  const baseId = useId();
  const [activeTab, setActiveTab] = useState(HELP_FAQ_TABS[0].id);
  const [openQuestion, setOpenQuestion] = useState(0);
  const tabRefs = useRef([]);
  const tab = HELP_FAQ_TABS.find((item) => item.id === activeTab) || HELP_FAQ_TABS[0];

  const selectTab = (index, focus = false) => {
    setActiveTab(HELP_FAQ_TABS[index].id);
    setOpenQuestion(0);
    if (focus) tabRefs.current[index]?.focus();
  };

  const handleTabKey = (event, index) => {
    const last = HELP_FAQ_TABS.length - 1;
    const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectTab(next, true);
  };

  return (
    <div>
      <div role="tablist" aria-label="Frequently asked question topics" className="ts-no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {HELP_FAQ_TABS.map((item, index) => {
          const selected = item.id === tab.id;
          return (
            <button
              key={item.id}
              ref={(node) => { tabRefs.current[index] = node; }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(index)}
              onKeyDown={(event) => handleTabKey(event, index)}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success ${
                selected ? 'bg-navy-900 text-white' : 'border border-line bg-white text-navy-800 hover:border-success/40 hover:text-success'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${tab.id}`}
        tabIndex={0}
        className="mt-5 overflow-hidden rounded-2xl border border-line bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
      >
        <ul className="divide-y divide-line">
          {tab.items.map((item, index) => {
            const isOpen = openQuestion === index;
            const answerId = `${baseId}-${tab.id}-answer-${index}`;
            return (
              <li key={item.q}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                    onClick={() => setOpenQuestion(isOpen ? -1 : index)}
                    className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-3.5 text-left text-[0.9375rem] font-semibold text-navy-900 transition-colors hover:bg-surface/60 focus-visible:bg-surface/60 focus-visible:outline-none"
                  >
                    {item.q}
                    <ChevronDown className={`size-4 shrink-0 text-muted motion-safe:transition-transform ${isOpen ? 'rotate-180 text-success' : ''}`} aria-hidden="true" />
                  </button>
                </h3>
                <div id={answerId} hidden={!isOpen} className="px-5 pb-5 text-sm leading-relaxed text-ink">
                  <p>{item.a}</p>
                  {item.article ? (
                    <button
                      type="button"
                      onClick={() => onOpenArticle(item.article)}
                      className="mt-2.5 inline-flex items-center gap-1 text-sm font-semibold text-success hover:underline"
                    >
                      Read the full answer <ArrowRight className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
