import Breadcrumbs from './Breadcrumbs';

/** Title block used at the top of marketplace pages. */
export default function PageHeader({ breadcrumbs, title, description, actions, children }) {
  return (
    <div className="relative overflow-hidden border-b border-navy-900/[0.06] bg-white">
      <div className="pointer-events-none absolute -right-32 -top-40 size-[26rem] rounded-full bg-brand-100/60 blur-3xl" aria-hidden="true" />
      <div className="ts-container relative py-8 sm:py-12">
        {breadcrumbs ? <Breadcrumbs items={breadcrumbs} className="mb-3" /> : null}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <h1 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-[2.6rem]">{title}</h1>
            {description ? <p className="mt-3 max-w-2xl text-[1.0625rem] leading-relaxed text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Heading used inside dashboard pages. */
export function SectionHeading({ title, description, actions, as: Tag = 'h1' }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <Tag className="text-2xl font-extrabold tracking-[-0.025em] sm:text-[1.85rem]">{title}</Tag>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
