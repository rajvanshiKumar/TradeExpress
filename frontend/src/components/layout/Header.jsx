import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BadgePercent,
  ChevronDown,
  FileSpreadsheet,
  Heart,
  Menu,
  MessageSquare,
  Scale,
  Search,
  ShieldCheck,
  ShoppingCart,
  X,
} from "lucide-react";
import Logo from "../common/Logo";
import { IconButton } from "../common/Button";
import SearchForm from "../forms/SearchForm";
import MegaMenu from "./MegaMenu";
import MobileMenu from "./MobileMenu";
import AboutMenu from "./AboutMenu";
import LocationSelector from "./LocationSelector";
import NotificationsMenu, { CountDot } from "./NotificationsMenu";
import UserMenu from "./UserMenu";
import SupportMenu from "./SupportMenu";
import useAuth from "../../hooks/useAuth";
import useCart from "../../hooks/useCart";
import useWishlist from "../../hooks/useWishlist";
import useMessages from "../../hooks/useMessages";
import useDisclosure from "../../hooks/useDisclosure";
import useScrolled from "../../hooks/useScrolled";
import { useTranslation } from "../../i18n/LanguageContext";
import { mainNav } from "../../data/navigation";

function IconLink({ to, icon: Icon, label, count, className = "" }) {
  const displayClass = className.includes("hidden") ? "" : "inline-flex ";
  return (
    <Link
      to={to}
      aria-label={`${label}${count ? `, ${count}` : ""}`}
      title={label}
      className={`relative ${displayClass}size-8 sm:size-8.5 shrink-0 items-center justify-center rounded-full text-navy-800 transition-colors hover:bg-navy-900/5 hover:text-navy-950 ${className}`}
    >
      <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
      <CountDot count={count} />
    </Link>
  );
}

/** True when a navigation link points at the page being viewed. */
function isActive(to, location) {
  const [path] = to.split("?");
  if (to.includes("role=supplier")) return false;
  // Deals is /products?deal=1: highlight Deals there, and Products only on the plain products page
  if (to.includes("deal=1")) {
    return location.pathname === "/products" && location.search.includes("deal=1");
  }
  if (to === "/products") {
    return location.pathname === "/products" && !location.search.includes("deal=1");
  }
  if (to === "/rfq") {
    return location.pathname === "/rfq";
  }
  if (to === "/info/about" || to === "/about") {
    return location.pathname === "/info/about" || location.pathname === "/about";
  }
  return (
    path === location.pathname ||
    (path !== "/" && location.pathname.startsWith(`${path}/`))
  );
}

export default function Header() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/forgot-password';
  const { user } = useAuth();
  const { t } = useTranslation();
  const { count: cartCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { unreadCount: unreadMessages } = useMessages();
  const mobileMenu = useDisclosure();
  const scrolled = useScrolled();
  const [megaOpen, setMegaOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const megaRef = useRef(null);
  const closeTimer = useRef(null);
  const openedAt = useRef(0);

  // Close menus whenever the page changes.
  useEffect(() => {
    setMegaOpen(false);
    setSearchOpen(false);
    mobileMenu.onClose();
  }, [location.pathname, location.search, mobileMenu.onClose]);

  useEffect(() => {
    if (!megaOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setMegaOpen(false);
    };
    const onPointer = (event) => {
      if (!megaRef.current?.contains(event.target)) setMegaOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [megaOpen]);

  const openMega = () => {
    window.clearTimeout(closeTimer.current);
    setMegaOpen((value) => {
      if (!value) openedAt.current = Date.now();
      return true;
    });
  };
  // Hovering opens the menu just before a click lands, so a click right after opening keeps it open.
  const toggleMega = () =>
    setMegaOpen((value) =>
      value && Date.now() - openedAt.current > 400 ? false : true,
    );
  const scheduleClose = () => {
    closeTimer.current = window.setTimeout(() => setMegaOpen(false), 160);
  };

  return (
    <>
      <header
        className={`sticky top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-300 ${scrolled ? "border-transparent bg-white/90 shadow-[0_12px_32px_-18px_rgb(16_24_39/0.35)] backdrop-blur-xl" : "border-navy-900/[0.07] bg-white"}`}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to main content
        </a>

        <div
          className="w-full max-w-[102rem] mx-auto px-3 sm:px-4 lg:px-4 xl:px-6 flex items-center justify-between gap-2 sm:gap-3 lg:gap-4 xl:gap-6 h-14 sm:h-16 lg:h-[66px]"
        >
          {/* Left: Mobile menu button & Brand Logo */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <IconButton
              icon={Menu}
              label="Open menu"
              size="sm"
              onClick={mobileMenu.onOpen}
              className="lg:hidden shrink-0 !size-8 sm:!size-8.5 rounded-xl hover:bg-navy-900/5 text-navy-800"
              aria-expanded={mobileMenu.open}
            />
            <Logo size="sm" />
          </div>

          {/* Navigation: Balanced, equal gaps between components & optical centering */}
          <nav
            aria-label="Main"
            ref={megaRef}
            onMouseLeave={scheduleClose}
            // "safe center": if the links ever need more room than they have, they never spill over the logo
            className="relative hidden lg:flex items-center [justify-content:safe_center] gap-0.5 xl:gap-1 2xl:gap-2.5 mx-auto px-1 sm:px-2 min-w-0"
          >
            {[
              { label: "Products", to: "/products" },
              { label: "Categories", to: "/categories", megaMenu: true },
              { label: "Suppliers", to: "/suppliers" },
              ...(!isAuthPage
                ? [{ label: "Compare Products", to: "/compare-products" }]
                : []),
              // Laptop widths (1024–1279px) have no room for Deals next to About Us; it returns from 1280px
              { label: "Deals", to: "/products?deal=1", wideOnly: true },
            ].map((item) => {
              const active = isActive(item.to, location);
              const pillClass = `relative ${item.wideOnly ? "hidden xl:inline-flex" : "inline-flex"} h-8.5 xl:h-9 items-center whitespace-nowrap rounded-full px-1.5 xl:px-2.5 2xl:px-3 text-xs xl:text-[13px] font-semibold transition-all ${
                active
                  ? "bg-navy-900/[0.08] text-navy-950 font-bold ring-1 ring-navy-900/10 shadow-2xs"
                  : "text-navy-700 hover:bg-navy-900/[0.04] hover:text-navy-950"
              }`;

              const renderLabel = (label) => {
                if (label === "Compare Products") {
                  return (
                    <span className="inline-flex items-center gap-1 xl:gap-1.5">
                      <Scale className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
                      <span>{t('nav.compareProducts', {}, 'Compare Products')}</span>
                    </span>
                  );
                }
                if (label === "Deals") {
                  return (
                    <span className="inline-flex items-center gap-1 xl:gap-1.5">
                      <BadgePercent className="hidden 2xl:block size-3.5 shrink-0 opacity-75" aria-hidden="true" />
                      <span>{t('nav.deals', {}, 'Deals')}</span>
                    </span>
                  );
                }
                if (label === "Request a Quote") {
                  return (
                    <span className="inline-flex items-center gap-1 xl:gap-1.5">
                      <FileSpreadsheet className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
                      <span className="hidden xl:inline">{t('nav.rfqLong', {}, 'Request a Quote')}</span>
                      <span className="xl:hidden">{t('nav.rfq', {}, 'RFQ')}</span>
                    </span>
                  );
                }
                if (label === "Find Suppliers" || label === "Suppliers") {
                  return t('nav.suppliers', {}, t('nav.findSuppliers', {}, 'Suppliers'));
                }
                if (label === "Explore Products" || label === "Products") {
                  return t('nav.products', {}, t('nav.exploreProducts', {}, 'Products'));
                }
                if (label === "Categories") {
                  return t('nav.categories', {}, 'Categories');
                }
                return label;
              };

              if (item.megaMenu) {
                return (
                  <div
                    key={item.label}
                    className="relative inline-flex items-center"
                    onMouseEnter={openMega}
                  >
                    <Link
                      to={item.to}
                      className={`relative inline-flex h-8.5 xl:h-9 items-center gap-1 whitespace-nowrap rounded-full px-1.5 xl:px-2.5 2xl:px-3 text-xs xl:text-[13px] font-semibold transition-all ${
                        active || megaOpen
                          ? "bg-navy-900/[0.08] text-navy-950 font-bold ring-1 ring-navy-900/10 shadow-2xs"
                          : "text-navy-700 hover:bg-navy-900/[0.04] hover:text-navy-950"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      <span>{renderLabel(item.label)}</span>
                      <ChevronDown
                        onClick={(e) => {
                          e.preventDefault();
                          toggleMega();
                        }}
                        className={`size-3 transition-transform duration-200 ${
                          megaOpen ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                );
              }

              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onMouseEnter={scheduleClose}
                  aria-current={active ? "page" : undefined}
                  className={pillClass}
                >
                  {renderLabel(item.label)}
                </Link>
              );
            })}

            {/* Dedicated About Section Dropdown Menu */}
            <AboutMenu active={isActive("/info/about", location)} />
            {megaOpen ? (
              <div onMouseEnter={openMega}>
                <MegaMenu
                  id="mega-menu"
                  onNavigate={() => setMegaOpen(false)}
                />
              </div>
            ) : null}
          </nav>

          {/* Right Action Icons & User Account */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 xl:gap-2.5 2xl:gap-3">
            <IconButton
              icon={searchOpen ? X : Search}
              label={searchOpen ? "Close search" : "Search"}
              onClick={() => setSearchOpen((value) => !value)}
              aria-expanded={searchOpen}
              aria-controls="header-search"
              size="sm"
              className="!size-8 sm:!size-8.5 shrink-0 max-lg:hidden"
            />
            {/* Phones under 500px choose region and language from the menu ("Region, language & currency") so Sign up fits */}
            <LocationSelector className="max-[499px]:hidden" />
            {user && user.role !== "super_admin" && (
              <NotificationsMenu className="hidden sm:inline-flex" />
            )}
            {user && user.role !== "super_admin" && (
              <IconLink
                to="/messages"
                icon={MessageSquare}
                label="Messages"
                count={unreadMessages}
                className="hidden sm:inline-flex"
              />
            )}
            <IconLink
              to={user?.role === "buyer" ? "/buyer/wishlist" : "/wishlist"}
              icon={Heart}
              label="Wishlist"
              count={wishlistCount}
              // The smallest phones (under 360px) open saved products from the menu, so Sign up always fits
              className="inline-flex max-[359px]:hidden"
            />
            <IconLink
              to="/cart"
              icon={ShoppingCart}
              label="Cart"
              count={cartCount}
            />
            {/* Help & support menu, right after the cart (phones reach Help from the menu). Guests get it in
                place of the notifications bell, which for them only says "Login to view". */}
            {user?.role !== "super_admin" && <SupportMenu className="hidden sm:block" />}

            {/* Direct Super Admin / Admin quick pill if logged in */}
            {user?.role === "super_admin" ? (
              <Link
                to="/super-admin"
                className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full bg-[#0b2716] px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/50 hover:bg-[#123f25] hover:text-white transition-all shadow-xs"
                title="Open Super Admin Enterprise Portal"
              >
                <ShieldCheck className="size-3.5 text-emerald-400" aria-hidden="true" />
                <span>👑 Super Admin</span>
              </Link>
            ) : user?.role === "admin" ? (
              <Link
                to="/admin"
                className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full bg-navy-900 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold text-brand-300 ring-1 ring-brand-500/50 hover:bg-navy-800 hover:text-white transition-all shadow-xs"
                title="Open Admin Portal"
              >
                <ShieldCheck className="size-3.5 text-brand-400" aria-hidden="true" />
                <span>Admin</span>
              </Link>
            ) : null}

            {/* Subtle Divider between utility icons and user account CTA */}
            <div className="hidden sm:block h-4 w-px bg-slate-200 mx-0.5 xl:mx-1 shrink-0" aria-hidden="true" />

            <div className="shrink-0">
              <UserMenu />
            </div>
          </div>
        </div>

        {/* Desktop search drawer, and a permanent search row on smaller screens. It never hides on scroll: changing the
            sticky header's height moves the page under the reader and makes the header tremble near the top. */}
        <div
          id="header-search"
          className={`border-t border-navy-900/[0.06] bg-white/98 backdrop-blur-md ${searchOpen ? "block" : "lg:hidden"}`}
        >
          <div className="w-full max-w-[102rem] mx-auto px-3 sm:px-4 lg:px-4 xl:px-6 py-2">
            <SearchForm
              idPrefix={searchOpen ? "header-search" : "mobile-search"}
              autoFocus={searchOpen}
            />
          </div>
        </div>
      </header>
      <MobileMenu open={mobileMenu.open} onClose={mobileMenu.onClose} />
    </>
  );
}
