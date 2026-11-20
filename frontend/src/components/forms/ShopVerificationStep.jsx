import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, Link2, LocateFixed, MapPin, Plus, RefreshCw, RotateCcw, Store, X } from 'lucide-react';
import { locationPermissionState, watchLiveLocation } from '../../utils/liveLocation.js';
import { lookupAddress, uploadShopPhoto } from '../../services/shopVerificationApi.js';
import { MAX_SOCIAL_LINKS, parseSocialLink } from '../../utils/socialLinks.js';

// Smaller photos upload much faster on mobile data and are still sharp enough to see the shop
const MAX_PHOTO_WIDTH = 1280;
const JPEG_QUALITY = 0.8;
// A new address is looked up only when the live position moves this far
const ADDRESS_REFRESH_METERS = 30;

/** "18 Nov 2026, 5:40 pm" */
const formatTime = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Distance in metres between two positions. */
function distanceMeters(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/**
 * Writes the address and time on the bottom of the photo. The coordinates are saved with the photo but never shown
 * to the buyer: only the Super Admin sees them.
 */
function stampPhoto(canvas, { address, capturedAt }) {
  const ctx = canvas.getContext('2d');
  const scale = canvas.width / 1000;
  const pad = Math.round(18 * scale);
  const lines = [
    address || 'Address not found',
    `${formatTime(capturedAt)} · TradeExpress live shop photo`,
  ];
  const fontSize = Math.max(12, Math.round(22 * scale));
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  const lineHeight = Math.round(fontSize * 1.35);
  const height = pad * 2 + lineHeight * lines.length;
  ctx.fillStyle = 'rgba(6, 46, 34, 0.78)';
  ctx.fillRect(0, canvas.height - height, canvas.width, height);
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, i) => {
    let text = line;
    while (ctx.measureText(text).width > canvas.width - pad * 2 && text.length > 10) text = `${text.slice(0, -2)}…`;
    ctx.fillText(text, pad, canvas.height - height + pad + lineHeight * (i + 0.8));
  });
}

/**
 * Buyer signup Step 4: a live camera photo of the shop (no gallery upload), an optional shop name and any number of
 * social media links.
 *
 * Speed: the live location starts together with the camera (a continuous live GPS watch, never a cached fix) and
 * the address is looked up while the camera is open, so Capture is instant. The photo shows straight away; the
 * address stamp and the upload finish in the background.
 *
 * Props: capture ({ photoUrl, previewUrl, latitude, longitude, accuracy, capturedAt, address } | null), onCapture,
 *        shopName, onShopNameChange, socialLinks ([{ url, platform }]), onSocialLinksChange, error
 */
export default function ShopVerificationStep({ capture, onCapture, shopName, onShopNameChange, socialLinks, onSocialLinksChange, error }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const stopWatchRef = useRef(null);
  const addressRef = useRef(null); // { coords, text } of the last address found
  const lookupRef = useRef(null); // { coords, promise } of the address being looked up
  const [cameraOpen, setCameraOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [fix, setFix] = useState(null); // latest live position while the camera is open
  const [locError, setLocError] = useState('');
  const [pending, setPending] = useState(null); // the photo just taken, while it is being saved
  const [problem, setProblem] = useState('');
  const [permission, setPermission] = useState('unknown');
  const [linkInput, setLinkInput] = useState('');
  const [linkError, setLinkError] = useState('');

  const stopLocation = () => {
    stopWatchRef.current?.();
    stopWatchRef.current = null;
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopLocation();
    setCameraOpen(false);
  };

  useEffect(() => {
    locationPermissionState().then(setPermission);
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      stopWatchRef.current?.();
    };
  }, []);

  // Attach the camera stream once the video element is on screen
  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [cameraOpen]);

  /** Looks the address up ahead of the photo, unless one was already found near this position. */
  const prefetchAddress = (position) => {
    const near = (entry) => entry && distanceMeters(entry.coords, position) < ADDRESS_REFRESH_METERS;
    if (near(addressRef.current) || near(lookupRef.current)) return;
    const coords = { latitude: position.latitude, longitude: position.longitude };
    const promise = lookupAddress(coords.latitude, coords.longitude).then((text) => {
      addressRef.current = { coords, text };
      return text;
    });
    lookupRef.current = { coords, promise };
  };

  /** The address for a position: found already, being found, or looked up now. */
  const addressFor = async (position) => {
    const near = (entry) => entry && distanceMeters(entry.coords, position) < ADDRESS_REFRESH_METERS;
    if (near(addressRef.current)) return addressRef.current.text;
    if (near(lookupRef.current)) return lookupRef.current.promise;
    return lookupAddress(position.latitude, position.longitude);
  };

  const startLocation = () => {
    stopLocation();
    setFix(null);
    setLocError('');
    stopWatchRef.current = watchLiveLocation(
      (position) => {
        setFix(position);
        setLocError('');
        setPermission('granted');
        prefetchAddress(position);
      },
      (message) => {
        setLocError(message);
        locationPermissionState().then(setPermission);
      },
    );
  };

  const openCamera = async () => {
    setProblem('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem('This browser cannot open the camera. Please use a recent version of Chrome, Edge or Safari over https.');
      return;
    }
    // Live location starts together with the camera, so it is ready by the time the photo is taken
    startLocation();
    setOpening(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      stopLocation();
      setProblem(err?.name === 'NotAllowedError'
        ? 'Camera access is blocked. Allow the camera for this site in your browser settings, then try again.'
        : 'The camera could not be opened. Close other apps using the camera and try again.');
    } finally {
      setOpening(false);
    }
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !fix) return;
    setProblem('');
    const location = fix; // the live position at the moment of the photo

    // Freeze this exact frame and show it at once
    const width = Math.min(video.videoWidth, MAX_PHOTO_WIDTH);
    const height = Math.round((video.videoHeight / video.videoWidth) * width);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(video, 0, 0, width, height);
    stopCamera();
    const known = addressRef.current && distanceMeters(addressRef.current.coords, location) < ADDRESS_REFRESH_METERS ? addressRef.current.text : null;
    setPending({ previewUrl: canvas.toDataURL('image/jpeg', 0.6), ...location, address: known });

    // Address stamp + upload in the background
    try {
      const address = known || await addressFor(location);
      setPending((prev) => (prev ? { ...prev, address } : prev));
      stampPhoto(canvas, { ...location, address });
      const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('capture'))), 'image/jpeg', JPEG_QUALITY));
      const uploaded = await uploadShopPhoto(blob);
      if (capture?.previewUrl) URL.revokeObjectURL(capture.previewUrl);
      onCapture({ photoUrl: uploaded.fileUrl, previewUrl: URL.createObjectURL(blob), ...location, address });
    } catch (err) {
      setProblem(err.message === 'capture' ? 'The photo could not be captured. Please try again.' : err.message);
    } finally {
      setPending(null);
    }
  };

  const retake = () => {
    if (capture?.previewUrl) URL.revokeObjectURL(capture.previewUrl);
    onCapture(null);
    openCamera();
  };

  const addLink = () => {
    const parsed = parseSocialLink(linkInput);
    if (!parsed) {
      setLinkError('Enter a valid link, e.g. instagram.com/yourshop');
      return;
    }
    if (socialLinks.some((l) => l.url.toLowerCase() === parsed.url.toLowerCase())) {
      setLinkError('This link is already added.');
      return;
    }
    if (socialLinks.length >= MAX_SOCIAL_LINKS) {
      setLinkError(`You can add up to ${MAX_SOCIAL_LINKS} links.`);
      return;
    }
    onSocialLinksChange([...socialLinks, parsed]);
    setLinkInput('');
    setLinkError('');
  };

  const shown = capture || pending;

  return (
    <div className="space-y-5">
      {/* 1. Live shop photo with live location */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">Live shop photo <span className="text-red-500">*</span></p>
            <p className="text-[11px] text-slate-500">Take a photo of your shop with the camera. Your live location is captured with it.</p>
          </div>
          <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${capture ? 'bg-emerald-100 text-emerald-800' : pending ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
            {capture ? 'Captured' : pending ? 'Saving…' : 'Required'}
          </span>
        </div>

        {shown ? (
          <div className="space-y-3">
            <div className="relative">
              <img src={shown.previewUrl} alt="Live photo of the shop" className="w-full rounded-xl border border-slate-200 object-cover" />
              {pending ? (
                <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Saving photo…
                </span>
              ) : null}
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
              <p className="flex items-start gap-2 text-sm font-semibold text-emerald-950">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <span className="min-w-0">{shown.address || (pending ? 'Finding the shop address…' : 'Address not found for this location.')}</span>
              </p>
              <p className="mt-1.5 pl-6 text-[11px] text-emerald-800">
                Captured {formatTime(shown.capturedAt)}
              </p>
            </div>
            {capture ? (
              <button
                type="button"
                onClick={retake}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                Retake photo
              </button>
            ) : null}
          </div>
        ) : cameraOpen ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl bg-slate-900">
              <video ref={videoRef} playsInline muted autoPlay className="aspect-[4/3] w-full object-cover" />
              <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> LIVE
              </span>
              <span className={`absolute bottom-2.5 left-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white ${fix ? 'bg-emerald-800/80' : 'bg-black/60'}`}>
                {fix ? <LocateFixed className="h-3.5 w-3.5 shrink-0" /> : <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />}
                <span className="truncate">
                  {fix ? 'Live location ready' : 'Getting your live location…'}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <button
                type="button"
                onClick={takePhoto}
                disabled={!fix}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-40"
              >
                {fix ? <Camera className="h-4 w-4" /> : <RefreshCw className="h-4 w-4 animate-spin" />}
                {fix ? 'Capture photo' : 'Waiting for location…'}
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={openCamera}
            disabled={opening}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 px-4 py-8 text-emerald-900 transition hover:bg-emerald-50 disabled:opacity-60"
          >
            {opening ? <RefreshCw className="h-7 w-7 animate-spin text-emerald-700" /> : <Camera className="h-7 w-7 text-emerald-700" />}
            <span className="text-sm font-bold">{opening ? 'Opening camera…' : 'Open camera'}</span>
            <span className="text-[11px] text-emerald-800/80">Camera and location access are needed.</span>
          </button>
        )}

        {!shown && !cameraOpen && (
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <MapPin className="h-3.5 w-3.5" />
            Location: {permission === 'granted' ? 'allowed (your live location is taken when the camera opens)' : permission === 'denied' ? 'blocked, allow it in your browser settings' : 'you will be asked when the camera opens'}
          </p>
        )}

        {(locError || problem || error) && (
          <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-rose-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0">{problem || locError || error}</span>
          </p>
        )}
      </div>

      {/* 2. Shop name (optional) */}
      <div>
        <label htmlFor="buyer-signup-shop-name" className="mb-1.5 block text-xs font-bold text-slate-800">
          Shop name <span className="font-normal text-slate-400">(Optional)</span>
        </label>
        <div className="relative">
          <Store className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="buyer-signup-shop-name"
            type="text"
            maxLength={120}
            placeholder="e.g. Sharma General Store"
            value={shopName}
            onChange={(e) => onShopNameChange(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3.5 text-sm transition focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
          />
        </div>
      </div>

      {/* 3. Social media links (optional, many) */}
      <div>
        <label htmlFor="buyer-signup-social-link" className="mb-1.5 block text-xs font-bold text-slate-800">
          Social media links <span className="font-normal text-slate-400">(Optional)</span>
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="buyer-signup-social-link"
              type="url"
              inputMode="url"
              placeholder="instagram.com/yourshop"
              value={linkInput}
              onChange={(e) => { setLinkInput(e.target.value); setLinkError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
              className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3.5 text-sm transition focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
            />
          </div>
          <button
            type="button"
            onClick={addLink}
            disabled={!linkInput.trim() || socialLinks.length >= MAX_SOCIAL_LINKS}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        {linkError ? (
          <p className="mt-1.5 text-xs font-medium text-red-600">{linkError}</p>
        ) : (
          <p className="mt-1.5 text-[11px] text-slate-500">Instagram, Facebook, YouTube, WhatsApp, website... add as many as you like (up to {MAX_SOCIAL_LINKS}).</p>
        )}
        {socialLinks.length > 0 && (
          <ul className="mt-3 space-y-2">
            {socialLinks.map((link) => (
              <li key={link.url} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">{link.platform}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{link.url}</span>
                <button
                  type="button"
                  onClick={() => onSocialLinksChange(socialLinks.filter((l) => l.url !== link.url))}
                  aria-label={`Remove ${link.url}`}
                  className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-rose-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
