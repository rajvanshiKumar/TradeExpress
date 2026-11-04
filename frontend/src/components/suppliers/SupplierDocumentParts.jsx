import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Ban, CheckCircle2, Clock, LoaderCircle, ShieldCheck, UploadCloud, UserRound, XCircle } from 'lucide-react';
import { MAX_PHOTO_FILE_MB, PHOTO_ACCEPT, prepareProfilePhoto } from '../../utils/profilePhoto';

const STATUS = {
  VERIFIED: { label: 'Verified', icon: ShieldCheck, className: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  PENDING: { label: 'Pending', icon: Clock, className: 'bg-amber-100 text-amber-800 ring-amber-200' },
  REJECTED: { label: 'Rejected', icon: XCircle, className: 'bg-rose-100 text-rose-800 ring-rose-200' },
  SUSPENDED: { label: 'Suspended', icon: Ban, className: 'bg-slate-200 text-slate-800 ring-slate-300' },
  EXPIRED: { label: 'Expired', icon: Clock, className: 'bg-orange-100 text-orange-800 ring-orange-200' },
};

export function VerificationBadge({ status, className = '' }) {
  const style = STATUS[status] || STATUS.PENDING;
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${style.className} ${className}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {style.label}
    </span>
  );
}

/** Shows a document preview that needs a signed-in request. `load` resolves to an image Blob. */
export function DocumentImage({ load, loadKey, alt, className = '' }) {
  const [state, setState] = useState({ url: '', loading: true, error: '' });
  const latestLoad = useRef(load);
  latestLoad.current = load;

  useEffect(() => {
    let active = true;
    let created = '';
    setState({ url: '', loading: true, error: '' });
    latestLoad.current()
      .then((blob) => {
        if (!active) return;
        created = URL.createObjectURL(blob);
        setState({ url: created, loading: false, error: '' });
      })
      .catch((error) => {
        if (active) setState({ url: '', loading: false, error: error.message || 'The preview could not be loaded.' });
      });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [loadKey]);

  if (state.loading) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 text-slate-400 ${className}`} role="status" aria-label="Loading preview">
        <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
      </div>
    );
  }
  if (state.error) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-slate-50 p-4 text-center text-xs text-slate-500 ${className}`}>
        <AlertCircle className="size-5 text-slate-400" aria-hidden="true" />
        {state.error}
      </div>
    );
  }
  return <img src={state.url} alt={alt} className={`h-auto w-full ${className}`} />;
}

/**
 * The supplier's photograph: choose, check, preview. `value` is what is shown; `onSelect` receives the prepared image.
 * Set `saving` while the parent stores it.
 */
export function ProfilePhotoField({ id = 'supplier-profile-photo', value, onSelect, error, saving = false, required = false, hint, disabled = false, buttonLabel, showPreview = true }) {
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState('');
  // The newest problem, from the file just chosen, comes first
  const shown = localError || error;
  const busy = preparing || saving;

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    // Lets the same file be chosen again after an error
    event.target.value = '';
    if (!file) return;
    setPreparing(true);
    setLocalError('');
    try {
      onSelect(await prepareProfilePhoto(file));
    } catch (problem) {
      setLocalError(problem.message);
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div id={`${id}-field`}>
      {showPreview ? (
        <p className="mb-1 block text-xs font-semibold text-slate-700">
          Profile Photograph {required ? <span className="text-red-500">*</span> : null}
        </p>
      ) : null}
      <div className="flex items-start gap-4">
        {showPreview ? (
          <div className={`flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 bg-slate-50 ${shown ? 'border-red-400' : value ? 'border-emerald-600' : 'border-dashed border-slate-300'}`}>
            {value
              ? <img src={value} alt="Your profile preview" className="h-full w-full object-cover" />
              : <UserRound className="size-9 text-slate-300" aria-hidden="true" />}
          </div>
        ) : null}
        <div className="min-w-0">
          <label htmlFor={id} className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 ${busy || disabled ? 'pointer-events-none opacity-60' : ''}`}>
            {busy ? <LoaderCircle className="size-4 animate-spin text-emerald-700" aria-hidden="true" /> : <UploadCloud className="size-4 text-emerald-700" aria-hidden="true" />}
            <span>{buttonLabel || (value ? 'Replace Photograph' : 'Upload Photograph')}</span>
          </label>
          <input id={id} type="file" accept={PHOTO_ACCEPT} className="sr-only" onChange={handleFile} disabled={busy || disabled} />
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {hint || `Your own clear photograph, face visible. It appears on your Supplier ID Card. JPG, PNG or WebP, up to ${MAX_PHOTO_FILE_MB} MB.`}
          </p>
          {value && !shown ? (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 className="size-3.5" aria-hidden="true" /> Preview of how it will be cropped
            </p>
          ) : null}
          {shown ? (
            <p role="alert" className="mt-1 flex items-start gap-1 text-xs font-medium text-red-600">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {shown}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
