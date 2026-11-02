import React from 'react';
import { Check, X, CheckCircle2, XCircle } from 'lucide-react';
import { evaluatePassword } from '../../utils/passwordRules.js';

/**
 * Enterprise Password Validation Indicator for TradeExpress
 * Renders real-time criteria checkmarks and confirm password matching status.
 */
export default function PasswordValidationIndicator({
  password = '',
  confirmPassword = null,
  showConfirmMatch = false,
  className = '',
}) {
  const { results, allPassed, hasStarted, confirmMatch, confirmMessage } = evaluatePassword(
    password,
    confirmPassword
  );

  return (
    <div className={`mt-2.5 space-y-2 select-none ${className}`}>
      {/* Criteria Checklist Grid */}
      <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
          Password Requirements:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
          {results.map((criterion) => {
            const isPassed = criterion.passed;
            return (
              <div
                key={criterion.id}
                className="flex items-center gap-1.5 transition-colors duration-150"
              >
                {isPassed ? (
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Check className="size-2.5 stroke-[3]" />
                  </span>
                ) : hasStarted ? (
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                    <X className="size-2.5 stroke-[3]" />
                  </span>
                ) : (
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-400">
                    <span className="size-1 rounded-full bg-slate-400" />
                  </span>
                )}
                <span
                  className={`${
                    isPassed
                      ? 'font-medium text-emerald-800'
                      : hasStarted
                      ? 'text-rose-700 font-medium'
                      : 'text-slate-500'
                  } text-[11px] leading-tight`}
                >
                  {criterion.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-time Confirm Password Match Status */}
      {showConfirmMatch && confirmPassword !== null && confirmPassword !== undefined && confirmPassword.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${
            confirmMatch
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {confirmMatch ? (
            <>
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              <span>Passwords match</span>
            </>
          ) : (
            <>
              <XCircle className="size-4 text-rose-600 shrink-0" />
              <span>Passwords do not match</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

