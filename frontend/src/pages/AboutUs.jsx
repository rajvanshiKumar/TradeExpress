import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Building2,
  Target,
  Eye,
  ShoppingBag,
  Boxes,
  FileQuestion,
  Scale,
  TrendingUp,
  SlidersHorizontal,
  ShieldCheck,
  Search,
  Users,
  Cpu,
  Handshake,
  HeartHandshake,
  Lightbulb,
  Award,
  Sparkles,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import Breadcrumbs from '../components/common/Breadcrumbs';

export default function AboutUs() {
  useDocumentTitle('About Us – TradeExpress');
  const location = useLocation();

  // Scroll to hash on mount or hash change
  useEffect(() => {
    if (location.hash) {
      const element = document.querySelector(location.hash);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Breadcrumb Bar */}
      <div className="border-b border-slate-200/80 bg-white">
        <div className="ts-container py-3">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'About Us' }]} />
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50/50 to-emerald-50/20 py-12 sm:py-16 lg:py-20">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 size-80 rounded-full bg-teal-500/10 blur-3xl" />

        <div className="ts-container relative max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-3.5 py-1 text-xs font-bold text-emerald-800 shadow-2xs mb-4">
            <Sparkles className="size-3.5 text-emerald-600" />
            <span>Modern B2B Wholesale Marketplace</span>
          </div>

          <h1 className="font-display text-3xl font-black tracking-tight text-navy-950 sm:text-4xl lg:text-5xl">
            About Us – TradeExpress
          </h1>

          <p className="mt-3 text-lg font-bold text-emerald-700 sm:text-xl">
            Connecting Businesses. Creating Opportunities. Powering Growth.
          </p>

          <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-700 sm:text-lg">
            <p>
              <strong className="text-navy-950 font-bold">
                TradeExpress is a modern B2B marketplace designed to simplify wholesale trading and create meaningful business connections.
              </strong>{' '}
              We bring manufacturers, wholesalers, distributors, suppliers, and business buyers together on one digital platform, making business sourcing and trading more accessible, efficient, and transparent.
            </p>

            <p>
              Our platform helps businesses discover products, connect with potential trading partners, explore competitive wholesale pricing, request quotations, and manage their purchasing and selling activities with greater convenience.
            </p>

            <p className="font-medium text-slate-800 border-l-4 border-emerald-600 pl-4 py-1 italic bg-white/70 rounded-r-lg">
              At TradeExpress, we believe business growth begins with the right connections, reliable information, and better trading opportunities.
            </p>
          </div>

          {/* Quick jump anchor navigation */}
          <div className="mt-8 flex flex-wrap gap-2 pt-4 border-t border-slate-200/80 text-xs font-semibold">
            <a href="#who-we-are" className="rounded-lg bg-white px-3 py-1.5 text-slate-700 shadow-2xs ring-1 ring-slate-200 hover:text-emerald-700 hover:ring-emerald-400 transition-all">
              Who We Are
            </a>
            <a href="#mission-vision" className="rounded-lg bg-white px-3 py-1.5 text-slate-700 shadow-2xs ring-1 ring-slate-200 hover:text-emerald-700 hover:ring-emerald-400 transition-all">
              Our Mission & Vision
            </a>
            <a href="#how-it-works" className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-900 shadow-2xs ring-1 ring-emerald-300 font-bold hover:bg-emerald-100 transition-all">
              What We Offer (How It Works)
            </a>
            <a href="#why-choose-us" className="rounded-lg bg-white px-3 py-1.5 text-slate-700 shadow-2xs ring-1 ring-slate-200 hover:text-emerald-700 hover:ring-emerald-400 transition-all">
              Why Choose TradeExpress?
            </a>
            <a href="#core-values" className="rounded-lg bg-white px-3 py-1.5 text-slate-700 shadow-2xs ring-1 ring-slate-200 hover:text-emerald-700 hover:ring-emerald-400 transition-all">
              Core Values
            </a>
            <a href="#our-commitment" className="rounded-lg bg-white px-3 py-1.5 text-slate-700 shadow-2xs ring-1 ring-slate-200 hover:text-emerald-700 hover:ring-emerald-400 transition-all">
              Our Commitment
            </a>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="ts-container max-w-4xl space-y-12 py-10 sm:py-12">
        {/* Section: Who We Are */}
        <section id="who-we-are" className="scroll-mt-28 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
              <Building2 className="size-5" />
            </div>
            <h2 className="font-display text-2xl font-black text-navy-950 sm:text-3xl">
              Who We Are
            </h2>
          </div>

          <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-700">
            <p>
              TradeExpress is a business-focused digital marketplace created to support the evolving needs of wholesale and commercial trade.
            </p>
            <p>
              We aim to reduce the complexity of traditional B2B transactions by providing a centralized platform where buyers can explore multiple suppliers and sellers can showcase their products to a wider business audience.
            </p>
            <p>
              Whether you are a manufacturer looking to expand your distribution network, a wholesaler seeking new customers, or a business owner sourcing products in bulk, TradeExpress is designed to make the process simpler and more organized.
            </p>
            <p className="font-semibold text-navy-900">
              Our focus is on building a professional trading environment that encourages transparency, fair competition, and long-term business relationships.
            </p>
          </div>
        </section>

        {/* Section: Our Mission & Vision */}
        <section id="mission-vision" className="scroll-mt-28 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mission Card */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-6 sm:p-8 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 text-emerald-800 mb-3">
                <Target className="size-5" />
                <h2 className="font-display text-xl font-black uppercase tracking-wider text-emerald-900">
                  Our Mission
                </h2>
              </div>
              <p className="font-bold text-navy-950 text-base sm:text-lg mb-3">
                To make B2B trading simpler, smarter, and more accessible for every business.
              </p>
              <p className="text-sm sm:text-base leading-relaxed text-slate-700 mb-3">
                Our mission is to empower buyers and sellers through digital technology, efficient product discovery, transparent business information, and practical tools that support better purchasing and selling decisions.
              </p>
            </div>
            <p className="text-sm font-medium text-emerald-900 pt-3 border-t border-emerald-100">
              We strive to create opportunities for businesses of different sizes to connect, compete, and grow in an increasingly digital marketplace.
            </p>
          </div>

          {/* Vision Card */}
          <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50/60 to-white p-6 sm:p-8 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 text-teal-800 mb-3">
                <Eye className="size-5" />
                <h2 className="font-display text-xl font-black uppercase tracking-wider text-teal-900">
                  Our Vision
                </h2>
              </div>
              <p className="font-bold text-navy-950 text-base sm:text-lg mb-3">
                To become a trusted and preferred digital marketplace for B2B trade.
              </p>
              <p className="text-sm sm:text-base leading-relaxed text-slate-700 mb-3">
                We envision a connected business ecosystem where geographical boundaries and traditional sourcing challenges are reduced through technology.
              </p>
            </div>
            <p className="text-sm font-medium text-teal-900 pt-3 border-t border-teal-100">
              Our long-term vision is to help businesses expand their market reach, discover new trading opportunities, and establish sustainable commercial relationships.
            </p>
          </div>
        </section>

        {/* Section: What We Offer (How It Works) */}
        <section id="how-it-works" className="scroll-mt-28 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-6 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Platform Capabilities</span>
              <h2 className="font-display text-2xl font-black text-navy-950 sm:text-3xl mt-0.5">
                What We Offer
              </h2>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
              How TradeExpress Works
            </span>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Offer 1 */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-5 hover:border-emerald-500 hover:bg-white hover:shadow-md transition-all">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-black text-sm mb-3">
                1
              </div>
              <h3 className="font-display text-base font-bold text-navy-950 mb-2">
                A Comprehensive B2B Marketplace
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Explore products across diverse business categories, compare available options, and discover suppliers based on your sourcing requirements.
              </p>
            </div>

            {/* Offer 2 */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-5 hover:border-emerald-500 hover:bg-white hover:shadow-md transition-all">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-black text-sm mb-3">
                2
              </div>
              <h3 className="font-display text-base font-bold text-navy-950 mb-2">
                Wholesale & Bulk Purchasing
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Discover products with minimum order quantities (MOQ), available wholesale pricing, and quantity-based discounts offered by sellers.
              </p>
            </div>

            {/* Offer 3 */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-5 hover:border-emerald-500 hover:bg-white hover:shadow-md transition-all">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-black text-sm mb-3">
                3
              </div>
              <h3 className="font-display text-base font-bold text-navy-950 mb-2">
                Request for Quotation (RFQ)
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Submit product-specific or general sourcing requirements and receive quotations from relevant suppliers, helping you evaluate suitable purchasing options.
              </p>
            </div>

            {/* Offer 4 */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-5 hover:border-emerald-500 hover:bg-white hover:shadow-md transition-all">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-black text-sm mb-3">
                4
              </div>
              <h3 className="font-display text-base font-bold text-navy-950 mb-2">
                Product Comparison
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Compare product specifications, pricing, minimum order quantities, and other relevant details to make more informed procurement decisions.
              </p>
            </div>

            {/* Offer 5 */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-5 hover:border-emerald-500 hover:bg-white hover:shadow-md transition-all">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-black text-sm mb-3">
                5
              </div>
              <h3 className="font-display text-base font-bold text-navy-950 mb-2">
                Business Growth Opportunities
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Manufacturers, suppliers, and wholesalers can showcase their offerings, reach prospective business buyers, and explore opportunities beyond their existing customer networks.
              </p>
            </div>

            {/* Offer 6 */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-5 hover:border-emerald-500 hover:bg-white hover:shadow-md transition-all">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-black text-sm mb-3">
                6
              </div>
              <h3 className="font-display text-base font-bold text-navy-950 mb-2">
                Streamlined Trading Experience
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Access tools for managing product listings, inquiries, quotations, orders, and other marketplace activities through an organized digital experience.
              </p>
            </div>
          </div>
        </section>

        {/* Section: Why Choose TradeExpress? */}
        <section id="why-choose-us" className="scroll-mt-28 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-navy-900 text-white shrink-0">
              <Award className="size-5" />
            </div>
            <h2 className="font-display text-2xl font-black text-navy-950 sm:text-3xl">
              Why Choose TradeExpress?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200/80 p-5 bg-white space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-800">
                <Boxes className="size-4 shrink-0" />
                <h3 className="font-bold text-navy-950 text-base">Built for Business</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                TradeExpress focuses on the specific requirements of B2B commerce, including bulk purchases, wholesale pricing, supplier discovery, and business procurement.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 p-5 bg-white space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-800">
                <ShieldCheck className="size-4 shrink-0" />
                <h3 className="font-bold text-navy-950 text-base">Transparency in Trading</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                We aim to provide clear product information, pricing details, supplier profiles, and marketplace policies to support informed business decisions.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 p-5 bg-white space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-800">
                <TrendingUp className="size-4 shrink-0" />
                <h3 className="font-bold text-navy-950 text-base">Opportunities for Every Business</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                From emerging enterprises to established manufacturers and distributors, TradeExpress is designed to support businesses at different stages of growth.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 p-5 bg-white space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-800">
                <Cpu className="size-4 shrink-0" />
                <h3 className="font-bold text-navy-950 text-base">Technology-Driven Convenience</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Our platform brings important trading activities into one digital environment, helping businesses reduce manual processes and improve efficiency.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 p-5 bg-white space-y-1.5 md:col-span-2">
              <div className="flex items-center gap-2 text-emerald-800">
                <Handshake className="size-4 shrink-0" />
                <h3 className="font-bold text-navy-950 text-base">Long-Term Business Relationships</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                We believe successful B2B commerce is not only about completing transactions but also about building dependable and sustainable commercial connections.
              </p>
            </div>
          </div>
        </section>

        {/* Section: Our Core Values */}
        <section id="core-values" className="scroll-mt-28 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shrink-0">
              <HeartHandshake className="size-5" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Principles & Ethics</span>
              <h2 className="font-display text-2xl font-black text-navy-950 sm:text-3xl mt-0.5">
                Our Core Values
              </h2>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="rounded-xl border border-slate-200/70 p-4 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-1.5 font-bold text-navy-950 text-sm sm:w-48 shrink-0">
                <ShieldCheck className="size-4 text-emerald-600" />
                Trust & Integrity:
              </span>
              <span className="text-sm text-slate-700 leading-relaxed">
                Encouraging responsible business practices, honest communication, and transparent marketplace interactions.
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/70 p-4 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-1.5 font-bold text-navy-950 text-sm sm:w-48 shrink-0">
                <Users className="size-4 text-emerald-600" />
                Customer Focus:
              </span>
              <span className="text-sm text-slate-700 leading-relaxed">
                Understanding the practical needs of buyers and sellers and continuously improving the platform experience.
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/70 p-4 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-1.5 font-bold text-navy-950 text-sm sm:w-48 shrink-0">
                <Lightbulb className="size-4 text-emerald-600" />
                Innovation:
              </span>
              <span className="text-sm text-slate-700 leading-relaxed">
                Using technology to simplify traditional trading processes and create better business opportunities.
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/70 p-4 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-1.5 font-bold text-navy-950 text-sm sm:w-48 shrink-0">
                <Scale className="size-4 text-emerald-600" />
                Fairness:
              </span>
              <span className="text-sm text-slate-700 leading-relaxed">
                Promoting a marketplace environment where businesses can compete based on their products, pricing, service, and capabilities.
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/70 p-4 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-1.5 font-bold text-navy-950 text-sm sm:w-48 shrink-0">
                <TrendingUp className="size-4 text-emerald-600" />
                Growth & Collaboration:
              </span>
              <span className="text-sm text-slate-700 leading-relaxed">
                Supporting meaningful partnerships that contribute to long-term business success.
              </span>
            </div>
          </div>
        </section>

        {/* Section: Our Commitment */}
        <section id="our-commitment" className="scroll-mt-28 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-teal-100 text-teal-800 shrink-0">
              <Handshake className="size-5" />
            </div>
            <h2 className="font-display text-2xl font-black text-navy-950 sm:text-3xl">
              Our Commitment
            </h2>
          </div>

          <div className="space-y-4 text-base leading-relaxed text-slate-700">
            <p>
              At TradeExpress, our commitment goes beyond providing an online product marketplace.
            </p>
            <p>
              We are focused on developing a dependable digital trading ecosystem that supports business discovery, efficient communication, informed procurement, and transparent marketplace processes.
            </p>
            <p>
              We recognize that trust plays an essential role in B2B transactions. Therefore, we aim to continuously strengthen our platform through clear policies, improved user experiences, responsible marketplace practices, and effective customer support.
            </p>
            <p className="font-semibold text-navy-900 border-l-3 border-teal-600 pl-3">
              Our goal is to make TradeExpress a valuable business partner in the digital trading journey of buyers and sellers.
            </p>
          </div>
        </section>

        {/* Section: Grow Your Business with TradeExpress */}
        <section id="grow-your-business" className="scroll-mt-28 rounded-3xl bg-gradient-to-br from-navy-950 via-navy-900 to-emerald-950 p-8 sm:p-10 lg:p-12 text-white shadow-xl relative overflow-hidden">
          <div className="pointer-events-none absolute -right-20 -bottom-20 size-80 rounded-full bg-emerald-500/20 blur-3xl" />

          <div className="relative">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300 border border-emerald-400/30">
              Next Step
            </span>

            <h2 className="font-display text-2xl font-black sm:text-3xl lg:text-4xl mt-3">
              Grow Your Business with TradeExpress
            </h2>

            <p className="text-base sm:text-lg font-bold text-emerald-400 mt-2">
              Discover More. Connect Better. Trade Smarter.
            </p>

            <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              Whether you are looking to source products in bulk, expand your customer base, connect with new suppliers, or explore wholesale business opportunities, TradeExpress brings essential trading tools and business connections together.
            </p>

            <p className="mt-4 font-bold text-white text-base">
              Join TradeExpress and take the next step toward smarter, more connected B2B commerce.
            </p>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-white/10">
              {/* For Buyers */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xs">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 block mb-3">
                  For Buyers
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to="/products"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors"
                  >
                    <span>Explore Products</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                  <Link
                    to="/products"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-white/20 transition-colors"
                  >
                    <span>Request a Quote</span>
                  </Link>
                </div>
              </div>

              {/* For Sellers */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xs">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 block mb-3">
                  For Sellers
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to="/register?role=supplier"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs sm:text-sm font-bold text-navy-950 shadow-sm hover:bg-slate-100 transition-colors"
                  >
                    <span>Become a Seller</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                  <Link
                    to="/supplier/dashboard"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-white/20 transition-colors"
                  >
                    <span>Start Selling</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Disclaimer Footer Note */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 text-xs text-slate-500 leading-relaxed italic">
          TradeExpress operates as a digital B2B marketplace connecting independent buyers and sellers. Product availability, prices, supplier representations, and transaction terms may vary. Purchases and other marketplace activities are subject to applicable platform policies and terms and conditions.
        </div>
      </div>
    </div>
  );
}

