import { useEffect, useMemo, useState } from 'react';
import Image from '../common/Image';

/**
 * Product gallery. Listings have one photograph per product, so the gallery
 * shows that photo in two framings plus the category illustration.
 */
export default function ProductGallery({ product }) {
  const views = useMemo(() => {
    const list = [];
    if (product.photo) {
      list.push({ key: 'main', label: 'Main view', photo: product.photo, crop: '', width: 900, height: 900 });
      list.push({ key: 'detail', label: 'Close-up', photo: product.photo, crop: 'entropy', width: 620, height: 620 });
    }
    list.push({ key: 'illustration', label: 'Illustration', photo: null, crop: '', width: 900, height: 900 });
    return list;
  }, [product.photo]);

  const [active, setActive] = useState(views[0].key);
  useEffect(() => setActive(views[0].key), [product.id, views]);
  const current = views.find((view) => view.key === active) ?? views[0];

  return (
    <div>
      <div className="ts-photo-stage overflow-hidden rounded-[2rem] p-2.5 shadow-card ring-1 ring-navy-900/[0.05] sm:p-3">
        <Image
          key={current.key} photo={current.photo} illustration={product.illustration} width={current.width} height={current.height} crop={current.crop} eager
          alt={`${product.name} — ${current.label.toLowerCase()}`} className="ts-fade-in aspect-square w-full rounded-[1.5rem] object-cover"
        />
      </div>
      {views.length > 1 ? (
        <ul className="mt-3 flex gap-3" aria-label="Product images">
          {views.map((view) => (
            <li key={view.key}>
              <button
                type="button" onClick={() => setActive(view.key)} aria-label={`Show ${view.label.toLowerCase()}`} aria-pressed={view.key === active}
                className={`block size-16 overflow-hidden rounded-2xl border-2 bg-sage-soft p-0.5 transition-all sm:size-20 ${view.key === active ? 'border-navy-900 shadow-card' : 'border-transparent opacity-80 hover:border-navy-200 hover:opacity-100'}`}
              >
                <Image photo={view.photo} illustration={product.illustration} width={160} height={160} crop={view.crop} alt="" className="size-full rounded-[0.8rem] object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
