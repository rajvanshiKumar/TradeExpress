import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Lightbulb } from 'lucide-react';
import Button from '../common/Button';
import { HELP_AUDIENCES, getHelpArticle, getHelpCategory, helpArticlePath } from '../../data/help/helpContent';
import { formatDate } from '../../utils/formatDate';

const audienceLabel = (id) => HELP_AUDIENCES.find((audience) => audience.id === id)?.label || 'Everyone';

/** Renders one help article (paragraphs, steps, lists, notes), its action and related articles. */
export default function HelpArticleView({ article }) {
  const related = (article.related || []).map(getHelpArticle).filter(Boolean);

  return (
    <article className="space-y-5 text-[0.9375rem] leading-relaxed text-ink">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-success-50 px-2.5 py-0.5 font-semibold text-success">{getHelpCategory(article.category)?.title}</span>
        <span className="rounded-full border border-line px-2.5 py-0.5 font-medium text-muted">For {audienceLabel(article.audience).toLowerCase()}</span>
        {article.updatedAt ? (
          <span className="inline-flex items-center gap-1 text-muted">
            <CalendarDays className="size-3.5" aria-hidden="true" /> Updated {formatDate(article.updatedAt)}
          </span>
        ) : null}
      </div>

      <p className="text-muted">{article.summary}</p>

      {article.body.map((block, index) => {
        if (typeof block === 'string') return <p key={index}>{block}</p>;
        if (block.steps) {
          return (
            <ol key={index} className="space-y-2.5">
              {block.steps.map((step, stepIndex) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white" aria-hidden="true">{stepIndex + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          );
        }
        if (block.list) {
          return (
            <ul key={index} className="list-disc space-y-1.5 pl-5 marker:text-success">
              {block.list.map((item) => <li key={item}>{item}</li>)}
            </ul>
          );
        }
        if (block.note) {
          return (
            <p key={index} className="flex gap-2.5 rounded-xl border border-success/15 bg-success-50 p-3.5 text-sm text-navy-900">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              <span>{block.note}</span>
            </p>
          );
        }
        return null;
      })}

      {article.action ? (
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-navy-900">Ready to continue?</p>
          <Button to={article.action.to} variant="navy" size="sm" iconRight={ArrowRight}>
            {article.action.label}
          </Button>
        </div>
      ) : null}

      {related.length ? (
        <section aria-labelledby={`related-${article.slug}`} className="border-t border-line pt-4">
          <h3 id={`related-${article.slug}`} className="text-sm font-bold text-navy-900">Related questions</h3>
          <ul className="mt-2 space-y-1">
            {related.map((item) => (
              <li key={item.slug}>
                <Link
                  to={helpArticlePath(item.slug)}
                  className="group flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm text-navy-800 transition-colors hover:bg-success-50 hover:text-success"
                >
                  <span>{item.title}</span>
                  <ArrowRight className="size-4 shrink-0 text-muted group-hover:text-success" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
