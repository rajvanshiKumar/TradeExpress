import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../common/Breadcrumbs';
import HelpSearchBox from './HelpSearchBox';
import { helpArticlePath } from '../../data/help/helpContent';

/** Frame for Help Center sub-pages: breadcrumbs, a title band with search, and the page body. */
export default function HelpSubpageLayout({ breadcrumbs, eyebrow, title, description, icon: Icon, audience = 'all', children }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  return (
    <div className="bg-surface pb-16">
      <div className="border-b border-line bg-white">
        <div className="ts-container py-2.5 text-xs">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      </div>

      <section className="border-b border-line bg-gradient-to-b from-white to-surface">
        <div className="ts-container flex flex-col gap-6 py-8 sm:py-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-2xl items-start gap-4">
            {Icon ? (
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-success-50 text-success">
                <Icon className="size-6" aria-hidden="true" />
              </span>
            ) : null}
            <div className="min-w-0">
              {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.14em] text-success">{eyebrow}</p> : null}
              <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">{title}</h1>
              {description ? <p className="mt-2 text-[0.9375rem] text-muted">{description}</p> : null}
            </div>
          </div>
          <div className="w-full lg:max-w-md">
            <HelpSearchBox
              value={query}
              onChange={setQuery}
              audience={audience}
              onSearch={(value) => navigate(value.trim() ? `/help?q=${encodeURIComponent(value.trim())}` : '/help')}
              onOpenArticle={(slug) => navigate(helpArticlePath(slug))}
            />
          </div>
        </div>
      </section>

      <div className="ts-container pt-8 sm:pt-10">{children}</div>
    </div>
  );
}
