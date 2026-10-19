import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  Heart,
  Menu,
  MessageSquare,
  Search,
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
  return (
    <Link
      to={to}
      aria-label={`${label}${count ? `, ${count}` : ""}`}
      title={label}
      className={`relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-navy-900 transition-colors hover:bg-navy-900/5 ${className}`}
    >
      <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
      <CountDot count={count} />
    </Link>
  );
}

/** True when a navigation link points at the page being viewed. */
function isActive(to, location) {
  const [path] = to.split("?");
  if (to.includes("role=supplier")) return false;
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
          className={`ts-container flex items-center justify-between gap-3 transition-[padding] duration-300 sm:gap-4 lg:gap-6 ${scrolled ? "py-2" : "py-3 lg:py-4"}`}
        >
          {/* Left: Mobile menu button & Brand Logo */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3.5 mr-2 sm:mr-4 lg:mr-8">
            <IconButton
              icon={Menu}
              label="Open menu"
              onClick={mobileMenu.onOpen}
              className="lg:hidden shrink-0"
              aria-expanded={mobileMenu.open}
            />
            <Logo />
          </div>

          {/* Center Navigation: Clean, spacious, completely separated from Logo */}
          <nav
            aria-label="Main"
            ref={megaRef}
            onMouseLeave={scheduleClose}
            className="relative hidden shrink-0 items-center gap-1.5 lg:flex xl:gap-2.5"
          >
            {mainNav
              .filter((item) => !item.highlight)
              .map((item) => {
                const active = isActive(item.to, location);
                const pillClass = `relative inline-flex h-10 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-navy-900/[0.08] text-navy-900 font-semibold ring-1 ring-navy-900/10"
                    : "text-navy-700 hover:bg-navy-900/[0.04] hover:text-navy-900"
                }`;

                if (item.megaMenu) {
                  return (
                    <div
                      key={item.label}
                      className="relative inline-flex items-center"
                      onMouseEnter={openMega}
                    >
                      <Link
                        to={item.to}
                        className={`relative inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-all ${
                          active || megaOpen
                            ? "bg-navy-900/[0.08] text-navy-900 font-semibold ring-1 ring-navy-900/10"
                            : "text-navy-700 hover:bg-navy-900/[0.04] hover:text-navy-900"
                        }`}
                        aria-current={active ? "page" : undefined}
                      >
                        <span>{item.label}</span>
                        <ChevronDown
                          onClick={(e) => {
                            e.preventDefault();
                            toggleMega();
                          }}
                          className={`size-3.5 transition-transform duration-200 ${
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
                    {item.label}
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
          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            <IconButton
              icon={searchOpen ? X : Search}
              label={searchOpen ? "Close search" : "Search"}
              onClick={() => setSearchOpen((value) => !value)}
              aria-expanded={searchOpen}
              aria-controls="header-search"
              className={scrolled ? "" : "max-lg:hidden"}
            />
            <div className="hidden lg:block">
              <PreferencesMenu />
            </div>
            <IconLink
              to="/messages"
              icon={MessageSquare}
              label="Messages"
              count={messageCount}
              className="hidden 2xl:inline-flex"
            />
            <NotificationsMenu />
            <IconLink
              to="/wishlist"
              icon={Heart}
              label="Saved items"
              count={wishlistCount}
              className="hidden sm:inline-flex"
            />
            <IconLink
              to="/cart"
              icon={ShoppingCart}
              label="Cart"
              count={cartCount}
            />
            <div className="ml-1 shrink-0 sm:ml-2">
              <UserMenu />
            </div>
          </div>
        </div>

        {/* Desktop search drawer, and a permanent search row on smaller screens */}
        <div
          id="header-search"
          className={`border-t border-navy-900/[0.06] ${searchOpen ? "block" : scrolled ? "hidden" : "lg:hidden"}`}
        >
          <div className="ts-container py-2.5">
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
