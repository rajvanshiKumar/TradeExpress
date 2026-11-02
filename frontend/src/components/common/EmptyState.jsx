import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title, text, action, className = '', headingLevel = 3 }) {
  const Heading = `h${headingLevel}`;
  return (
    <div className={`flex flex-col items-center px-6 py-14 text-center ${className}`}>
      <span className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-navy-50 text-navy-700">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <Heading className="text-lg font-bold">{title}</Heading>
      {text ? <p className="mt-1.5 max-w-md text-sm text-muted">{text}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}
