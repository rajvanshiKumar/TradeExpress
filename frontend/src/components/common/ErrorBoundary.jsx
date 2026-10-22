import React from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled Application Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignore storage errors
    }
    window.location.href = '/';
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f7faf6] flex items-center justify-center p-4 font-sans text-navy-950">
          <div className="w-full max-w-lg rounded-3xl border border-navy-900/10 bg-white p-6 sm:p-8 shadow-xl text-center space-y-5">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
              <AlertTriangle className="size-8" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-black text-navy-900 tracking-tight">
                Something went wrong
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-navy-700">
                A client-side error occurred while rendering the page. You can reload or reset stored local browser data to recover.
              </p>
            </div>

            {this.state.error ? (
              <div className="text-left rounded-xl bg-navy-950 text-emerald-400 p-3.5 font-mono text-xs overflow-x-auto max-h-40 border border-navy-800">
                <p className="font-bold text-red-400">{String(this.state.error.message || this.state.error)}</p>
                {this.state.error.stack ? (
                  <pre className="mt-2 text-[10px] text-slate-400 whitespace-pre-wrap">{this.state.error.stack}</pre>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-navy-900 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-navy-800 transition-all"
              >
                <RefreshCw className="size-4" />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-red-300 bg-red-50/60 px-5 py-2.5 text-xs sm:text-sm font-bold text-red-700 hover:bg-red-100 transition-all"
              >
                <Trash2 className="size-4" />
                <span>Reset Local Cache</span>
              </button>
            </div>

            <div className="pt-2 border-t border-navy-900/10">
              <a
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900"
              >
                <Home className="size-3.5" />
                <span>Return to Homepage</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
