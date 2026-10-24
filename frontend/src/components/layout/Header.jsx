import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BadgePercent,
  ChevronDown,
  Heart,
  HelpCircle,
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
import PreferencesMenu from "./PreferencesMenu";
import NotificationsMenu, { CountDot } from "./NotificationsMenu";
import UserMenu from "./UserMenu";
import useAuth from "../../hooks/useAuth";
import useCart from "../../hooks/useCart";
import useWishlist from "../../hooks/useWishlist";
import useMessages from "../../hooks/useMessages";
import useDisclosure from "../../hooks/useDisclosure";
import useScrolled from "../../hooks/useScrolled";
import { mainNav } from "../../data/navigation";

function IconLink({ to, icon: Icon, label, count, className = "" }) {
  const displayClass = className.includes("hidden") ? "" : "inline-flex ";
  return (
    <Link
      to={to}
      aria-label={`${label}${count ? `, ${count}` : ""}`}
      title={label}
      className={`relative ${displayClass}size-7.5 sm:size-8 xl:size-8.5 shrink-0 items-center justify-center rounded-full text-navy-800 transition-colors hover:bg-navy-900/5 hover:text-navy-950 ${className}`}
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
  if (to === "/help" && (location.pathname === "/help" || location.pathname === "/info/help")) return true;
  if (to.includes("deal=1")) {
    return location.pathname === "/products" && location.search.includes("deal=1");
  }
  if (path === "/products" && to === "/products") {
    return location.pathname === "/products" && !location.search.includes("deal=1");
  }
  return (
    path === location.pathname ||
    (path !== "/" && location.pathname.startsWith(`${path}/`))
  );
}

export default function Header() {
  const location = useLocation();
  const { user } = useAuth();
  const { count: cartCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { unreadCount } = useMessages();
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
  const messageCount =
    user?.notificationPrefs?.messages === false ? 0 : unreadCount;

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
          className={`w-full max-w-[105rem] mx-auto px-3 sm:px-4 lg:px-5 xl:px-6 flex items-center justify-between gap-3 lg:gap-4 transition-[padding] duration-300 ${scrolled ? "py-1.5 sm:py-2" : "py-2 sm:py-2.5"}`}
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

          {/* Center Navigation: Clean, streamlined B2B wholesale links */}
          <nav
            aria-label="Main"
            ref={megaRef}
            onMouseLeave={scheduleClose}
            className="relative hidden items-center gap-0.5 xl:gap-1 lg:flex shrink-0"
          >
            {[
              { label: "Products", to: "/products" },
              { label: "Categories", to: "/categories", megaMenu: true },
              { label: "Suppliers", to: "/suppliers" },
              { label: "Exporters", to: "/exporters" },
              { label: "Post RFQ", to: "/rfq" },
              { label: "Compare Products", to: "/compare-products" },
              { label: "Wishlist", to: "/wishlist" },
              ...(user && user.role !== "super_admin"
                ? [
                    { label: "Deals", to: "/products?deal=1" },
                    { label: "Help Center", to: "/help" },
                  ]
                : []),
              { label: "About Us", to: "/info/about" },
            ].map((item) => {
              const active = isActive(item.to, location);
              const isAbout = item.to === "/info/about";
              const isExporters = item.to === "/exporters";
              const isWishlist = item.to === "/wishlist";
              const isDeals = item.to.includes("deal=1");
              const isHelp = item.to === "/help";

              // Responsive tiering:
              // - Categories, Products, Suppliers, Post RFQ, Compare Products: visible on lg+ (1024px+)
              // - Deals: visible on lg+ (1024px+)
              // - Wishlist (with Heart symbol): visible on min-[1180px]+
              // - Help Center: visible on xl+ (1280px+)
              // - Exporters: visible on xl+ (1280px+)
              // - About Us: visible on min-[1420px]+ when logged in, or min-[1360px]+ when guest
              const hideClass = isAbout
                ? user
                  ? "hidden min-[1420px]:inline-flex "
                  : "hidden min-[1360px]:inline-flex "
                : isExporters
                  ? "hidden xl:inline-flex "
                  : isHelp
                    ? "hidden xl:inline-flex "
                    : isWishlist
                      ? "hidden min-[1180px]:inline-flex "
                      : "";

              const displayClass = hideClass ? hideClass : "inline-flex ";

                const pillClass = `relative ${displayClass}h-8 xl:h-8.5 items-center whitespace-nowrap rounded-full px-2 xl:px-2.5 text-xs xl:text-[13px] font-medium transition-all ${active
                    ? "bg-navy-900/[0.08] text-navy-950 font-bold ring-1 ring-navy-900/10"
                    : "text-navy-700 hover:bg-navy-900/[0.04] hover:text-navy-950"
                  }`;

                const renderLabel = (label) => {
                  if (label === "Request For Quotation" || label === "RFQ") {
                    return "Post RFQ";
                  }
                  if (label === "Compare Products") {
                    return (
                      <span className="inline-flex items-center gap-1.5">
                        <Scale className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
                        <span>Compare Products</span>
                      </span>
                    );
                  }
                  if (label === "Compare Quotes" || label === "Smart Quote Comparison") {
                    return (
                      <span className="inline-flex items-center gap-1.5">
                        <Scale className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
                        <span>Compare Quotes</span>
                      </span>
                    );
                  }
                  if (label === "Wishlist" || label === "Saved") {
                    return (
                      <span className="inline-flex items-center gap-1.5">
                        <Heart className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
                        <span>Wishlist</span>
                        {wishlistCount > 0 ? (
                          <span className="ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-navy-900/10 px-1 text-[10px] font-bold text-navy-950">
                            {wishlistCount}
                          </span>
                        ) : null}
                      </span>
                    );
                  }
                  if (label === "Deals" || label === "Wholesale Deals") {
                    return (
                      <span className="inline-flex items-center gap-1.5">
                        <BadgePercent className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
                        <span>Deals</span>
                      </span>
                    );
                  }
                  if (label === "Help Center" || label === "Help") {
                    return (
                      <span className="inline-flex items-center gap-1.5">
                        <HelpCircle className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
                        <span>Help Center</span>
                      </span>
                    );
                  }
                  if (label === "Find Suppliers") {
                    return "Suppliers";
                  }
                  if (label === "Explore Products") {
                    return "Products";
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
                        className={`relative inline-flex h-8 xl:h-8.5 items-center gap-1 whitespace-nowrap rounded-full px-2 xl:px-2.5 text-xs xl:text-[13px] font-medium transition-all ${active || megaOpen
                            ? "bg-navy-900/[0.08] text-navy-950 font-bold ring-1 ring-navy-900/10"
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
                          className={`size-3 transition-transform duration-200 ${megaOpen ? "rotate-180" : ""
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
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 lg:gap-1.5 xl:gap-2 pr-1 sm:pr-2">
            <IconButton
              icon={searchOpen ? X : Search}
              label={searchOpen ? "Close search" : "Search"}
              onClick={() => setSearchOpen((value) => !value)}
              aria-expanded={searchOpen}
              aria-controls="header-search"
              size="sm"
              className={`!size-7.5 sm:!size-8 xl:!size-8.5 shrink-0 ${scrolled ? "" : "max-lg:hidden"}`}
            />
            <div className="hidden md:block">
              <PreferencesMenu />
            </div>
            <IconLink
              to="/messages"
              icon={MessageSquare}
              label="Messages"
              count={messageCount}
              className="hidden min-[1680px]:inline-flex"
            />
            {user?.role !== "super_admin" && (
              <NotificationsMenu className="hidden sm:inline-flex" />
            )}
            <IconLink
              to="/cart"
              icon={ShoppingCart}
              label="Cart"
              count={cartCount}
            />

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
            <div className="hidden sm:block h-5 w-px bg-navy-900/10 mx-0.5 sm:mx-1" aria-hidden="true" />

            <div className="shrink-0">
              <UserMenu />
            </div>
          </div>
        </div>

        {/* Desktop search drawer, and a permanent search row on smaller screens */}
        <div
          id="header-search"
          className={`border-t border-navy-900/[0.06] ${searchOpen ? "block" : scrolled ? "hidden" : "lg:hidden"}`}
        >
          <div className="w-full max-w-[98rem] mx-auto px-2 sm:px-3 lg:px-4 xl:px-6 py-2">
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
