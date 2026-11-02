import { Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from '../common/ErrorBoundary';

/**
 * The routed page area of a layout. If the page throws while rendering, only this area shows the
 * recovery screen; the layout's header, sidebar and navigation stay usable. Changing route clears it.
 */
export default function PageOutlet() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary variant="page" resetKey={pathname}>
      <Outlet />
    </ErrorBoundary>
  );
}
