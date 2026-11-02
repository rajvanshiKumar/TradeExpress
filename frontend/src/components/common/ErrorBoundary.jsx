import React from 'react';
import { AlertTriangle, ArrowLeft, Home, RefreshCw } from 'lucide-react';

/**
 * Catches rendering errors so one broken component shows a recovery screen instead of a blank app.
 *
 * - variant="app" (default): full-screen fallback, used once around the whole app in main.jsx.
 * - variant="page": in-page fallback used around the routed content, so the header, providers and
 *   toasts keep working when a single page fails.
 * - resetKey: when it changes (e.g. the route), the boundary clears its error and renders children again.
 *
 * Errors are always logged to the console. Technical details are shown on screen only in development.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[TradeExpress] ${this.props.variant === 'page' ? 'Page' : 'Application'} error caught by ErrorBoundary:`, error, errorInfo?.componentStack);
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  retry = () => this.setState({ error: null });

  goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign('/');
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isPage = this.props.variant === 'page';
    const showDetails = Boolean(import.meta.env?.DEV);

    return (
      <div role="alert" className={isPage ? 'flex justify-center px-4 py-16' : 'flex min-h-screen items-center justify-center bg-[#f7faf6] p-4 font-sans text-navy-950'}>
        <div className="w-full max-w-lg space-y-5 rounded-3xl border border-navy-900/10 bg-white p-6 text-center shadow-xl sm:p-8">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
            <AlertTriangle className="size-8" aria-hidden="true" />
          </div>

          <div>
            <h1 className="text-xl font-black tracking-tight text-navy-900 sm:text-2xl">Something went wrong</h1>
            <p className="mt-2 text-sm text-navy-700">
              {isPage
                ? 'This page could not be displayed. Your account, cart and saved data are safe. Try again, or go back to the previous page.'
                : 'TradeExpress could not display this screen. Your account, cart and saved data are safe. Please try again.'}
            </p>
          </div>

          {showDetails ? (
            <details className="rounded-xl border border-navy-800 bg-navy-950 p-3.5 text-left font-mono text-xs text-emerald-400">
              <summary className="cursor-pointer font-bold text-red-400">{String(error.message || error)}</summary>
              {error.stack ? <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[10px] text-slate-400">{error.stack}</pre> : null}
              <p className="mt-2 text-[10px] text-slate-500">Shown in development only.</p>
            </details>
          ) : null}

          <div className="flex flex-col gap-2.5 pt-2 sm:flex-row">
            <button type="button" onClick={this.retry} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-navy-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/50">
              <RefreshCw className="size-4" aria-hidden="true" />Try again
            </button>
            <button type="button" onClick={this.goBack} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-navy-900/15 bg-white px-5 py-2.5 text-sm font-bold text-navy-900 transition-colors hover:border-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/50">
              <ArrowLeft className="size-4" aria-hidden="true" />Go back
            </button>
          </div>

          <div className="border-t border-navy-900/10 pt-3">
            <a href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-900">
              <Home className="size-3.5" aria-hidden="true" />Return to homepage
            </a>
          </div>
        </div>
      </div>
    );
  }
}
