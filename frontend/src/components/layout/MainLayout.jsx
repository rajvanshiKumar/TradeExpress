import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PageSkeleton } from '../common/Skeleton';
import AnnouncementBar from './AnnouncementBar';
import Header from './Header';
import Footer from './Footer';

export default function MainLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    const updateHeaderHeight = () => {
      const ann = document.getElementById('announcement-bar');
      const header = document.querySelector('header');
      const annHeight = ann ? ann.offsetHeight : 0;
      const headerHeight = header ? header.offsetHeight : 72;
      document.documentElement.style.setProperty(
        '--app-header-height',
        `${annHeight + headerHeight}px`
      );
    };

    updateHeaderHeight();

    const resizeObserver = new ResizeObserver(updateHeaderHeight);
    const header = document.querySelector('header');
    const ann = document.getElementById('announcement-bar');
    if (header) resizeObserver.observe(header);
    if (ann) resizeObserver.observe(ann);

    window.addEventListener('resize', updateHeaderHeight);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <AnnouncementBar />
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {/* Re-keyed per page so each page fades in gently */}
        <div key={pathname} className="ts-page-enter"><Suspense fallback={<PageSkeleton />}><Outlet /></Suspense></div>
      </main>
      <Footer />
    </div>
  );
}
