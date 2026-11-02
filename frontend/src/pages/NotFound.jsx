import { Compass } from 'lucide-react';
import Button from '../components/common/Button';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="ts-container flex flex-col items-center py-20 text-center">
      <span className="inline-flex size-20 items-center justify-center rounded-full bg-navy-50 text-navy-700"><Compass className="size-9" aria-hidden="true" /></span>
      <p className="mt-6 font-display text-6xl font-extrabold text-navy-900">404</p>
      <h1 className="mt-2 text-2xl font-extrabold">We could not find that page</h1>
      <p className="mt-2 max-w-md text-muted">The link may be out of date, or the page may have moved. Try one of these instead.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button to="/">Back to home</Button>
        <Button to="/products" variant="outline">Browse products</Button>
        <Button to="/suppliers" variant="outline">Find suppliers</Button>
      </div>
    </div>
  );
}
