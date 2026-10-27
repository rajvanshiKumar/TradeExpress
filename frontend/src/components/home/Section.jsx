import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Reveal from '../common/Reveal';

const TONES = { plain: 'bg-ivory', white: 'bg-white', navy: 'ts-navy-texture text-white', charcoal: 'ts-charcoal text-white' };

/** Section heading used across the homepage: eyebrow, title (with an optional serif accent), link. */
export function SectionHeading({ id, eyebrow, title, accent, description, linkTo, linkLabel = 'View all', dark = false, align = 'left' }) {
  return (
    <div className={`mb-10 flex flex-wrap items-end gap-x-8 gap-y-4 ${align === 'center' ? 'flex-col items-center text-center' : 'justify-between'}`}>
      <div className={`max-w-2xl ${align === 'center' ? 'mx-auto' : ''}`}>
        {eyebrow ? <p className={`ts-eyebrow ${dark ? '!text-brand-500' : ''}`}>{eyebrow}</p> : null}
        <h2 id={id ? `${id}-title` : undefined} className={`ts-section-title mt-3 ${dark ? '!text-white' : ''}`}>
          {title}{accent ? <> <span className={`ts-serif ${dark ? 'text-brand-500' : 'text-brand-600'}`}>{accent}</span></> : null}
        </h2>
        {description ? <p className={`mt-4 text-[1.0625rem] leading-relaxed ${dark ? 'text-white/70' : 'text-muted'}`}>{description}</p> : null}
      </div>
      {linkTo ? (
        <Link to={linkTo} className={`group inline-flex items-center gap-2 text-sm font-semibold ${dark ? 'text-white hover:text-brand-500' : 'text-navy-900 hover:text-brand-600'}`}>
          {linkLabel}
          <span className={`inline-flex size-8 items-center justify-center rounded-full ring-1 transition-colors ${dark ? 'ring-white/25 group-hover:bg-brand-500 group-hover:text-navy-900' : 'ring-navy-900/15 group-hover:bg-navy-900 group-hover:text-white'}`}><ArrowRight className="size-4" aria-hidden="true" /></span>
        </Link>
      ) : null}
    </div>
  );
}

/** Standard homepage section with generous spacing, a heading and a gentle entry animation. */
export default function Section({ id, tone = 'plain', className = '', children, ...heading }) {
  const dark = tone === 'navy' || tone === 'charcoal';
  return (
    <section aria-labelledby={`${id}-title`} className={`relative py-16 sm:py-24 ${TONES[tone]} ${className}`}>
      <div className="ts-container">
        <Reveal><SectionHeading id={id} dark={dark} {...heading} /></Reveal>
        <Reveal delay={80}>{children}</Reveal>
      </div>
    </section>
  );
}
