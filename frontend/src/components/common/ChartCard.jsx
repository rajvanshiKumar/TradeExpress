import { ChartColumn } from 'lucide-react';

/** Card wrapper for a chart. Shows an empty state instead of a blank chart when there is no data. */
export default function ChartCard({ title, description, isEmpty = false, height = 'h-72', children, summary }) {
  return (
    <section className="ts-card min-w-0 p-5" aria-label={title}>
      <h2 className="text-base font-bold">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      {isEmpty ? (
        <div className={`mt-4 flex ${height} flex-col items-center justify-center rounded-xl bg-surface text-center text-sm text-muted`}>
          <ChartColumn className="mb-2 size-6" aria-hidden="true" />
          No data to chart yet.
        </div>
      ) : (
        <div className={`mt-4 ${height} w-full min-w-0 overflow-hidden`} role="img" aria-label={summary ?? title}>{children}</div>
      )}
    </section>
  );
}
