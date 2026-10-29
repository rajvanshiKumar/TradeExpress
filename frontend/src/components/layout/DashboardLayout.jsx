import { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { PageSkeleton } from '../common/Skeleton';
import { Boxes, Building2, ChartColumn, FileText, Heart, Info, LayoutDashboard, LayoutGrid, MapPin, MessageSquare, Package, Scale, Settings, ShieldCheck, Users, Truck, CircleDollarSign, Bell, User, ClipboardList, Warehouse } from 'lucide-react';
import AnnouncementBar from './AnnouncementBar';
import Header from './Header';
import Footer from './Footer';
import BuyerSidebar from './BuyerSidebar';
import SupplierSidebar from './SupplierSidebar';
import ResetDataButton from '../common/ResetDataButton';
import CompanyLogo from '../common/CompanyLogo';
import VerificationBadge from '../common/VerificationBadge';
import useAuth from '../../hooks/useAuth';
import useProducts from '../../hooks/useProducts';
import { dashboardNav } from '../../data/navigation';

const ICONS = { LayoutDashboard, Package, FileText, Scale, MessageSquare, Heart, MapPin, Settings, Boxes, ChartColumn, Building2, Users, LayoutGrid, ShieldCheck, Truck, CircleDollarSign, Bell, User, ClipboardList, Warehouse };

const TITLES = { buyer: 'Buyer Workspace', supplier: 'Supplier Enterprise Portal', admin: 'Admin Console' };
const NOTES = {
  buyer: 'Your orders, quotes and saved items are securely tracked in TradeExpress.',
  supplier: 'Catalogue changes go live in the marketplace immediately, in this browser.',
  admin: 'Prototype admin area: data and role checks live in this browser and are not a secure administration system.',
};

/** Shell for the buyer, supplier and admin areas: site header, side navigation and content. */
export default function DashboardLayout({ role }) {
  const location = useLocation();
  const { user } = useAuth();
  const { getCompany } = useProducts();
  const items = dashboardNav[role] ?? [];
  const company = role === 'supplier' && user?.companyId ? getCompany(user.companyId) : null;
  const isActive = (to) => (to === `/${role}` ? location.pathname === to : location.pathname === to || location.pathname.startsWith(`${to}/`));

  // Dedicated Buyer Workspace Layout with Premium Collapsible Sidebar & Mobile Drawer
  if (role === 'buyer') {
    return (
      <div className="flex min-h-dvh flex-col bg-ivory scroll-smooth">
        <AnnouncementBar />
        <Header />
        <div className="ts-container flex-1 py-6 lg:py-8">
          <div className="lg:flex lg:gap-8 items-start">
            <BuyerSidebar />
            <main id="main" tabIndex={-1} className="flex-1 min-w-0 focus:outline-none scroll-smooth">
              <div key={location.pathname} className="ts-page-enter">
                <Suspense fallback={<PageSkeleton />}>
                  <Outlet />
                </Suspense>
              </div>
              <div className="mt-8 rounded-[1.25rem] bg-white p-4 text-xs text-muted ring-1 ring-navy-900/[0.06] lg:hidden">
                <p className="flex gap-2">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                  {NOTES.buyer}
                </p>
                <ResetDataButton className="mt-3" />
              </div>
            </main>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Dedicated Supplier Enterprise Portal Layout with Consistent Collapsible Sidebar & Drawer
  if (role === 'supplier') {
    return (
      <div className="flex min-h-dvh flex-col bg-ivory scroll-smooth">
        <AnnouncementBar />
        <Header />
        <div className="ts-container flex-1 py-6 lg:py-8">
          <div className="lg:flex lg:gap-8 items-start">
            <SupplierSidebar />
            <main id="main" tabIndex={-1} className="flex-1 min-w-0 focus:outline-none scroll-smooth">
              <div key={location.pathname} className="ts-page-enter">
                <Suspense fallback={<PageSkeleton />}>
                  <Outlet />
                </Suspense>
              </div>
            </main>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Supplier & Admin Dashboard Layout
  return (
    <div className="flex min-h-dvh flex-col bg-ivory">
      <AnnouncementBar />
      <Header />
      <div className="ts-container flex-1 py-6 lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-8 lg:py-10">
        <aside className="mb-6 lg:mb-0">
          <div className="lg:sticky lg:top-28">
            <div className="hidden overflow-hidden rounded-[1.5rem] bg-navy-900 text-white shadow-lift lg:block">
              <div className="relative p-5">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_100%_0%,rgb(201_166_107/0.22),transparent_60%)]" aria-hidden="true" />
                <p className="relative text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-500">{TITLES[role]}</p>
                <div className="relative mt-3 flex items-center gap-3">
                  {company ? <CompanyLogo company={company} size="md" /> : <span className="inline-flex size-12 items-center justify-center rounded-xl bg-white/10 font-display font-extrabold text-brand-400">{user?.name?.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>}
                  <div className="min-w-0">
                    <p className="truncate font-display font-bold">{company?.name ?? user?.name}</p>
                    <p className="truncate text-xs text-white/55">{user?.email}</p>
                  </div>
                </div>
                {company ? <div className="relative mt-3"><VerificationBadge company={company} className="bg-white/95" /></div> : null}
              </div>
              <nav aria-label={TITLES[role]} className="border-t border-white/10 p-2">
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = ICONS[item.icon] ?? LayoutDashboard;
                    const active = isActive(item.to);
                    return (
                      <li key={item.to}>
                        <Link to={item.to} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${active ? 'bg-white text-navy-900' : 'text-white/70 hover:bg-white/[0.07] hover:text-white'}`}>
                          <Icon className={`size-4 shrink-0 ${active ? 'text-brand-600' : ''}`} aria-hidden="true" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>

            {/* Mobile and tablet: horizontally scrolling tabs */}
            <nav aria-label={`${TITLES[role]} (compact)`} className="ts-no-scrollbar -mx-4 overflow-x-auto px-4 lg:hidden">
              <ul className="flex gap-2">
                {items.map((item) => {
                  const Icon = ICONS[item.icon] ?? LayoutDashboard;
                  const active = isActive(item.to);
                  return (
                    <li key={item.to} className="shrink-0">
                      <Link to={item.to} aria-current={active ? 'page' : undefined} className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold ring-1 transition-colors ${active ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-navy-900 ring-navy-900/10 hover:ring-navy-900/30'}`}>
                        <Icon className="size-4 shrink-0" aria-hidden="true" />{item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="mt-4 hidden rounded-[1.25rem] bg-white p-4 text-xs text-muted ring-1 ring-navy-900/[0.06] lg:block">
              <p className="flex gap-2"><Info className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden="true" />{NOTES[role]}</p>
              <ResetDataButton className="mt-3 w-full" />
            </div>
          </div>
        </aside>
        <main id="main" tabIndex={-1} className="min-w-0 focus:outline-none">
          <div key={location.pathname} className="ts-page-enter"><Suspense fallback={<PageSkeleton />}><Outlet /></Suspense></div>
          <div className="mt-8 rounded-[1.25rem] bg-white p-4 text-xs text-muted ring-1 ring-navy-900/[0.06] lg:hidden">
            <p className="flex gap-2"><Info className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden="true" />{NOTES[role]}</p>
            <ResetDataButton className="mt-3" />
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
