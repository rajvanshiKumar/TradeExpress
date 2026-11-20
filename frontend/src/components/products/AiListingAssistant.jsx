import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ImagePlus, RefreshCw, Sparkles, X } from 'lucide-react';
import { apiGet, apiPost } from '../../services/apiClient';

const POLL_MS = 4000;
const MAX_WAIT_MS = 8 * 60 * 1000;
const STAGE_LABELS = {
  ingest: 'Reading your photos',
  ocr: 'Reading text on the product',
  classify: 'Finding the category',
  attributes: 'Identifying specifications',
  content: 'Writing the title and description',
  quality: 'Checking the listing',
  complete: 'Finishing',
};

/**
 * Supplier product form: suggests the listing details (name, summary, description, specifications, colours,
 * category) from the product photos already uploaded in the form, using the Product Listing AI.
 * Nothing is saved: the supplier reviews the suggestions, applies them to the form, adds price / MOQ / stock and
 * saves the product as usual. Hidden when the AI service is not configured.
 *
 * Props: images (uploaded photo URLs in the form), onApply(suggestions), disabled
 */
export default function AiListingAssistant({ images = [], onApply, disabled = false }) {
  const [available, setAvailable] = useState(false);
  const [state, setState] = useState({ phase: 'idle' }); // idle | starting | processing | ready | failed
  const pollRef = useRef(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    apiGet('supplier/products/ai-listing/status')
      .then((res) => { if (!cancelled) setAvailable(Boolean(res?.data?.available)); })
      .catch(() => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; clearTimeout(pollRef.current); };
  }, []);

  if (!available) return null;

  const photos = images.filter((url) => typeof url === 'string' && !url.startsWith('data:')).slice(0, 5);
  const busy = state.phase === 'starting' || state.phase === 'processing';

  const poll = (jobToken) => {
    pollRef.current = setTimeout(async () => {
      try {
        const res = await apiGet(`supplier/products/ai-listing/${encodeURIComponent(jobToken)}`, { timeoutMs: 40000 });
        const data = res?.data || {};
        if (data.status === 'ready') return setState({ phase: 'ready', suggestions: data.suggestions });
        if (data.status === 'failed') return setState({ phase: 'failed', message: data.message });
        if (Date.now() - startedAtRef.current > MAX_WAIT_MS) {
          return setState({ phase: 'failed', message: 'The AI is taking too long. Please try again later or fill in the details yourself.' });
        }
        setState({ phase: 'processing', progress: data.progress || 0, stage: data.stage });
        return poll(jobToken);
      } catch (err) {
        return setState({ phase: 'failed', message: err?.message || 'The AI listing assistant is not available right now.' });
      }
    }, POLL_MS);
  };

  const start = async () => {
    if (!photos.length || busy) return;
    setState({ phase: 'starting' });
    startedAtRef.current = Date.now();
    try {
      const res = await apiPost('supplier/products/ai-listing', { photos }, { timeoutMs: 90000 });
      setState({ phase: 'processing', progress: 0 });
      poll(res?.data?.jobToken);
    } catch (err) {
      setState({ phase: 'failed', message: err?.message || 'The AI listing assistant is not available right now.' });
    }
  };

  const apply = () => {
    onApply(state.suggestions);
    setState({ phase: 'applied' });
  };

  const s = state.suggestions;

  return (
    <section className="ts-card overflow-hidden border-emerald-200/80 p-0" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3 bg-gradient-to-r from-emerald-50 to-amber-50/60 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-800 text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-navy-900">Fill details from photos with AI</p>
            <p className="text-[0.8125rem] text-muted">
              AI suggests the name, description, specifications and category from your photos. You review everything, then add price, MOQ and stock yourself.
            </p>
          </div>
        </div>
        {!busy && state.phase !== 'ready' ? (
          <button
            type="button"
            onClick={start}
            disabled={disabled || !photos.length}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles className="h-4 w-4" />
            {state.phase === 'applied' || state.phase === 'failed' ? 'Generate again' : 'Generate with AI'}
          </button>
        ) : null}
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {!photos.length ? (
          <p className="flex items-center gap-2 text-[0.8125rem] text-slate-600">
            <ImagePlus className="h-4 w-4 shrink-0 text-emerald-700" />
            Upload product photos in “Product Visuals” below first (up to 5 are used).
          </p>
        ) : state.phase === 'idle' ? (
          <p className="text-[0.8125rem] text-slate-600">
            {photos.length} photo{photos.length > 1 ? 's' : ''} will be used. It usually takes 2–3 minutes; you can keep filling the form meanwhile.
          </p>
        ) : null}

        {busy ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {state.phase === 'starting' ? 'Sending your photos to the AI…' : `${STAGE_LABELS[state.stage] || 'AI is creating your listing'}…`}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-emerald-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.progress || 0}>
              <div className="h-full rounded-full bg-emerald-700 transition-all duration-700" style={{ width: `${Math.max(5, state.progress || 0)}%` }} />
            </div>
            <p className="text-xs text-muted">This usually takes 2–3 minutes. You can keep filling the rest of the form.</p>
          </div>
        ) : null}

        {state.phase === 'failed' ? (
          <p role="alert" className="flex items-start gap-2 text-sm font-medium text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.message}</span>
          </p>
        ) : null}

        {state.phase === 'applied' ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            AI details added to the form. Please review them, then fill in price, MOQ, stock and tax details.
          </p>
        ) : null}

        {state.phase === 'ready' && s ? (
          <div className="space-y-3">
            <dl className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
              {[
                ['Product name', s.name],
                ['Short summary', s.summary],
                ['Category', s.category ? [s.aiCategory?.name && `${s.aiCategory.name} →`, s.categoryName || s.category, s.subcategory && `› ${s.subcategory}`].filter(Boolean).join(' ') : `${s.aiCategory?.name || 'Not found'} (please choose a category yourself)`],
                ['Colours', s.colours],
                ['Specifications', s.specifications ? s.specifications.split('\n').join(' · ') : ''],
              ].filter(([, value]) => value).map(([label, value]) => (
                <div key={label} className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)]">
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="min-w-0 break-words text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
            {s.toConfirm?.length ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Please double-check: {s.toConfirm.join(', ')}.</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={apply} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Apply to form
              </button>
              <button type="button" onClick={() => setState({ phase: 'idle' })} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <X className="h-4 w-4" /> Discard
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
