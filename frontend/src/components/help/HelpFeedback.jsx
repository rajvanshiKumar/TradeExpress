import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

const STORAGE_KEY = 'tradeexpress:help-feedback';

// Feedback is remembered in this browser only (so the answer persists for the reader). Collecting it for
// the TradeExpress team needs the Help Center database planned for a later phase.
function readFeedback() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveFeedback(slug, answer) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readFeedback(), [slug]: answer }));
  } catch {
    // Storage unavailable (private mode, blocked): the answer still shows for this visit
  }
}

/** "Was this article helpful?" with Yes / No. */
export default function HelpFeedback({ slug }) {
  const [answer, setAnswer] = useState(() => readFeedback()[slug] || null);

  const choose = (value) => {
    setAnswer(value);
    saveFeedback(slug, value);
  };

  if (answer) {
    return (
      <div className="rounded-xl border border-line bg-surface/70 px-4 py-3 text-sm text-navy-900" role="status">
        {answer === 'yes' ? (
          'Thanks for letting us know.'
        ) : (
          <>
            Sorry this didn’t help.{' '}
            <Link to="/help#support" className="font-semibold text-success hover:underline">Contact support</Link>
            {' '}and we’ll help you directly.
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/70 px-4 py-3">
      <p className="text-sm font-medium text-navy-900">Was this article helpful?</p>
      <div className="flex gap-2">
        {[
          { value: 'yes', label: 'Yes', icon: ThumbsUp },
          { value: 'no', label: 'No', icon: ThumbsDown },
        ].map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-sm font-semibold text-navy-800 transition-colors hover:border-success/40 hover:text-success"
          >
            <Icon className="size-4" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}
