import { RefreshCw, TriangleAlert } from 'lucide-react';
import Button from './Button';

export default function ErrorState({ title = 'Something went wrong', text = 'The data could not be loaded. Please try again.', onRetry, className = '' }) {
  return (
    <div role="alert" className={`flex flex-col items-center px-6 py-14 text-center ${className}`}>
      <span className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-danger-50 text-danger">
        <TriangleAlert className="size-7" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted">{text}</p>
      {onRetry ? <Button variant="outline" icon={RefreshCw} onClick={onRetry} className="mt-5">Try again</Button> : null}
    </div>
  );
}
