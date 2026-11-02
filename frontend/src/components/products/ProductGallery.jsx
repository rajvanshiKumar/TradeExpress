import { useEffect, useMemo, useState } from 'react';
import { Play, Film, Image as ImageIcon } from 'lucide-react';
import Image from '../common/Image';

const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const base = (import.meta.env.VITE_PUBLIC_API_BASE_URL || '').replace(/\/api\/?$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

/**
 * Enterprise B2B Product Gallery.
 * Supports up to 8 high-resolution product photographs plus product promotional video.
 */
export default function ProductGallery({ product }) {
  const views = useMemo(() => {
    const list = [];

    // 1. Gather all product images
    const rawImages = Array.isArray(product?.images)
      ? product.images.map((item) => (typeof item === 'string' ? item : item.url)).filter(Boolean)
      : [];

    if (rawImages.length > 0) {
      rawImages.forEach((url, idx) => {
        list.push({
          key: `img-${idx}`,
          type: 'image',
          label: idx === 0 ? 'Primary view' : `View ${idx + 1}`,
          photo: url,
          crop: '',
          width: 900,
          height: 900,
        });
      });
    } else if (product.photo) {
      list.push({
        key: 'main',
        type: 'image',
        label: 'Main view',
        photo: product.photo,
        crop: '',
        width: 900,
        height: 900,
      });
      list.push({
        key: 'detail',
        type: 'image',
        label: 'Close-up',
        photo: product.photo,
        crop: 'entropy',
        width: 620,
        height: 620,
      });
    }

    // 2. Add video if present
    const video = product.videoUrl || product.video;
    if (video) {
      list.push({
        key: 'video',
        type: 'video',
        label: 'Product Video',
        videoUrl: video,
        width: 900,
        height: 900,
      });
    }

    // 3. Fallback illustration if list is empty
    if (list.length === 0) {
      list.push({
        key: 'illustration',
        type: 'image',
        label: 'Illustration',
        photo: null,
        crop: '',
        width: 900,
        height: 900,
      });
    }

    return list;
  }, [product.photo, product.images, product.videoUrl, product.video]);

  const [active, setActive] = useState(views[0]?.key || 'main');

  useEffect(() => {
    if (views.length > 0) {
      setActive(views[0].key);
    }
  }, [product.id, views]);

  const current = views.find((view) => view.key === active) ?? views[0];

  return (
    <div>
      {/* Main Display Stage */}
      <div className="ts-photo-stage relative aspect-square overflow-hidden rounded-[2rem] p-2.5 shadow-card ring-1 ring-navy-900/[0.05] sm:p-3 bg-white">
        {current.type === 'video' ? (
          <div className="relative size-full overflow-hidden rounded-[1.5rem] bg-black flex items-center justify-center">
            <video
              key={current.videoUrl}
              src={resolveMediaUrl(current.videoUrl)}
              controls
              autoPlay
              className="size-full object-contain"
            >
              Your browser does not support HTML5 video.
            </video>
          </div>
        ) : (
          <Image
            key={current.key}
            photo={current.photo}
            illustration={product.illustration}
            width={current.width}
            height={current.height}
            crop={current.crop}
            eager
            alt={`${product.name} — ${current.label.toLowerCase()}`}
            className="ts-fade-in aspect-square w-full rounded-[1.5rem] object-cover"
          />
        )}

        {(product.stock <= 0 || product.status !== 'Active') && (
          <span className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-rose-600 text-white px-3.5 py-1.5 text-xs font-bold shadow-xl ring-2 ring-white">
            Product is not available
          </span>
        )}
      </div>

      {/* Thumbnails Row */}
      {views.length > 1 ? (
        <ul className="mt-3 flex gap-2.5 overflow-x-auto py-1 ts-no-scrollbar" aria-label="Product media gallery">
          {views.map((view) => {
            const isActive = view.key === active;

            return (
              <li key={view.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActive(view.key)}
                  aria-label={`Show ${view.label.toLowerCase()}`}
                  aria-pressed={isActive}
                  className={`relative block size-16 overflow-hidden rounded-2xl border-2 p-0.5 transition-all sm:size-20 ${
                    isActive
                      ? 'border-emerald-600 ring-2 ring-emerald-500/20 shadow-card bg-emerald-50/40'
                      : 'border-slate-200 opacity-80 hover:border-slate-300 hover:opacity-100 bg-slate-50'
                  }`}
                >
                  {view.type === 'video' ? (
                    <div className="flex size-full flex-col items-center justify-center rounded-[0.8rem] bg-navy-950 text-white">
                      <Play className="size-5 fill-amber-300 text-amber-300 ml-0.5" />
                      <span className="text-[9px] font-bold mt-0.5 text-slate-200">Video</span>
                    </div>
                  ) : (
                    <Image
                      photo={view.photo}
                      illustration={product.illustration}
                      width={160}
                      height={160}
                      crop={view.crop}
                      alt=""
                      className="size-full rounded-[0.8rem] object-cover"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
