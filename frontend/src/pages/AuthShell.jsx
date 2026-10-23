import Logo from '../components/common/Logo';
import buyerBanner from '../assets/buyer-auth-banner.jpg';
import supplierBanner from '../assets/supplier-auth-banner.jpg';

/** Split-screen frame shared by the sign-in, register and password pages. */
export default function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
  above = null,
  role = 'buyer',
}) {
  const isSupplier = role === 'supplier';
  const bannerImage = isSupplier ? supplierBanner : buyerBanner;
  const bannerAlt = isSupplier
    ? 'TradeExpress Supplier - Smarter Selling, Global Reach'
    : 'TradeExpress Buyer - Smarter Buying, Bigger Opportunities';

  return (
    <div className="bg-ivory min-h-screen">
      <div className="ts-container py-8 sm:py-14">
        <div
          className={`mx-auto grid grid-cols-1 overflow-hidden rounded-[2rem] bg-white shadow-lift ring-1 ring-navy-900/[0.06] lg:grid-cols-[1fr_1.15fr] ${
            wide ? 'max-w-6xl' : 'max-w-5xl'
          }`}
        >
          {/* Left Side: Dynamic Buyer & Supplier HD Visual Banners (Full Background Width) */}
          <aside className="relative hidden overflow-hidden bg-[#021d12] lg:flex w-full h-full min-h-[600px]">
            <img
              key={bannerImage}
              src={bannerImage}
              alt={bannerAlt}
              className="w-full h-full object-cover object-center select-none pointer-events-none transition-all duration-300"
            />
          </aside>

          {/* Right Side: Authentication Forms */}
          <div className="p-6 sm:p-10 lg:p-12">
            <div className="mb-6 lg:hidden">
              <Logo />
            </div>
            {above}
            <h1 className="text-[1.9rem] font-extrabold tracking-[-0.03em] sm:text-[2.2rem]">
              {title}
            </h1>
            {subtitle ? <p className="mb-7 mt-2 text-muted">{subtitle}</p> : <div className="mb-7" />}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
