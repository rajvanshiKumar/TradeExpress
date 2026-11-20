import { useState } from 'react';
import { ExternalLink, ImageOff, MapPin, Store } from 'lucide-react';
import { backendFileUrl } from '../../config/api.js';

/** "18 Nov 2026, 5:40 pm" */
const formatTime = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * Buyer shop verification captured at signup (Step 4): the live shop photo, the address resolved from the live
 * location at capture time, the coordinates (with a map link), the shop name and the buyer's social links.
 */
export default function ShopProfileCard({ shop }) {
  const [photoMissing, setPhotoMissing] = useState(false);
  if (!shop) return null;
  const links = Array.isArray(shop.socialLinks) ? shop.socialLinks : [];
  const mapUrl = `https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`;

  return (
    <div className="pt-2">
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Shop verification (live)</h4>
      <div className="space-y-3 rounded-xl border border-slate-200 p-3">
        {photoMissing ? (
          <div className="flex h-40 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">
            <ImageOff className="h-5 w-5" />
            Photo not available on this server
          </div>
        ) : (
          <a href={backendFileUrl(shop.photoUrl)} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={backendFileUrl(shop.photoUrl)}
              alt={`Live photo of ${shop.shopName || 'the buyer’s shop'}`}
              className="max-h-64 w-full rounded-lg border border-slate-200 object-cover"
              loading="lazy"
              onError={() => setPhotoMissing(true)}
            />
          </a>
        )}

        <div className="space-y-1.5 text-xs text-slate-700">
          <p className="flex items-center gap-1.5 font-bold text-slate-900">
            <Store className="h-3.5 w-3.5 text-emerald-700" />
            {shop.shopName || 'Shop name not provided'}
          </p>
          <p className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
            <span>{shop.address || 'Address could not be resolved (coordinates below).'}</span>
          </p>
          <p className="pl-5 text-[11px] text-slate-500">
            {Number(shop.latitude).toFixed(6)}, {Number(shop.longitude).toFixed(6)}
            {shop.accuracyMeters != null ? ` · ±${Math.round(shop.accuracyMeters)} m` : ''} · captured {formatTime(shop.capturedAt)}
          </p>
          <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 pl-5 text-[11px] font-semibold text-emerald-800 hover:underline">
            Open location in Google Maps <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Social media</p>
          {links.length ? (
            <ul className="space-y-1">
              {links.map((link) => (
                <li key={link.url} className="flex items-center gap-2 text-xs">
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">{link.platform}</span>
                  <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 truncate text-emerald-800 hover:underline">{link.url}</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">None added</p>
          )}
        </div>
      </div>
    </div>
  );
}
