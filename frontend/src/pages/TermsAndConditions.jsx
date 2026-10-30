import { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Search,
  Printer,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Headphones,
  Mail,
  Phone,
  Clock,
  MapPin,
  ChevronRight,
  HelpCircle,
  ArrowUp,
  SlidersHorizontal,
  ShieldCheck,
  Building2,
  Truck,
  RotateCcw,
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useNotifications from '../hooks/useNotifications';
import Breadcrumbs from '../components/common/Breadcrumbs';
import Button from '../components/common/Button';
import { TERMS_SECTIONS, TERMS_METADATA } from '../data/termsData';

export default function TermsAndConditions() {
  useDocumentTitle('Terms and Conditions of Use | TradeExpress');
  const { showToast } = useNotifications();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('section-1');
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return TERMS_SECTIONS;
    const q = searchQuery.toLowerCase();
    return TERMS_SECTIONS.filter((sec) => {
      const titleMatch = sec.title.toLowerCase().includes(q);
      const numberMatch = sec.number.includes(q);
      const badgeMatch = sec.badge.toLowerCase().includes(q);
      const summaryMatch = sec.summary?.toLowerCase().includes(q);
      const paragraphsMatch = sec.paragraphs?.some((p) => p.toLowerCase().includes(q));
      const clausesMatch = sec.clauses?.some((c) => c.text.toLowerCase().includes(q));
      return titleMatch || numberMatch || badgeMatch || summaryMatch || paragraphsMatch || clausesMatch;
    });
  }, [searchQuery]);

  // Back to top scroll listener
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast?.('Terms & Conditions page URL copied to clipboard!', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16">
      {/* Top Breadcrumb Bar */}
      <div className="border-b border-slate-200 bg-white">
        <div className="ts-container py-3">
          <Breadcrumbs
            items={[
              { label: 'Home', to: '/' },
              { label: 'Legal Policies', to: '/help' },
              { label: 'Terms & Conditions' },
            ]}
          />
        </div>
      </div>

      {/* Hero Header Banner */}
      <section className="border-b border-emerald-900/10 bg-gradient-to-r from-emerald-900 via-emerald-850 to-navy-950 text-white py-10 sm:py-12 relative overflow-hidden">
        {/* Subtle geometric background watermark */}
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="terms-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M0 32 L32 0 M0 0 L32 32" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#terms-grid)" />
          </svg>
        </div>

        <div className="ts-container relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3.5 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30 mb-4">
              <Scale className="size-3.5" />
              <span>Official Legal Agreement & Terms of Service</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white font-display">
              {TERMS_METADATA.title}
            </h1>

            <p className="mt-3 text-sm text-emerald-100/90 leading-relaxed">
              These Terms and Conditions govern access to and commercial transactions on the TradeExpress B2B wholesale marketplace, establishing rights, obligations, inspection standards, escrow settlement, and dispute mechanisms for Buyers, Sellers, and Logistics Partners under Indian law.
            </p>

            {/* Metadata Pills */}
            <div className="mt-6 flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
              <span className="rounded-lg bg-white/10 px-3 py-1.5 font-medium text-emerald-100 border border-white/10">
                Effective Date: <strong className="text-white">{TERMS_METADATA.effectiveDate}</strong>
              </span>
              <span className="rounded-lg bg-white/10 px-3 py-1.5 font-medium text-emerald-100 border border-white/10">
                Last Updated: <strong className="text-white">{TERMS_METADATA.lastUpdated}</strong>
              </span>
              <span className="rounded-lg bg-white/10 px-3 py-1.5 font-medium text-emerald-100 border border-white/10">
                Jurisdiction: <strong className="text-white">{TERMS_METADATA.jurisdiction}</strong>
              </span>
              <span className="rounded-lg bg-white/10 px-3 py-1.5 font-medium text-emerald-100 border border-white/10">
                Governing Law: <strong className="text-white">{TERMS_METADATA.governingLaw}</strong>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="ts-container py-8">
        {/* Controls Toolbar: Search, Print, Copy */}
        <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search 26 clauses (e.g. escrow, return, 7 days, open-box)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-xs focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Copy}
              onClick={handleCopyLink}
              className="text-xs"
            >
              Share Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Printer}
              onClick={handlePrint}
              className="text-xs"
            >
              Print / Save PDF
            </Button>
          </div>
        </div>

        {/* Quick Topic Chips */}
        <div className="mb-6 overflow-x-auto pb-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] whitespace-nowrap mr-1 flex items-center gap-1">
              <SlidersHorizontal className="size-3" /> Quick Jump:
            </span>
            {[
              { label: 'Role of Platform', id: 'section-2' },
              { label: 'Seller Listings', id: 'section-4' },
              { label: 'Buyer Obligations', id: 'section-5' },
              { label: 'Pricing & Taxes', id: 'section-7' },
              { label: 'Payments & Escrow', id: 'section-8' },
              { label: 'Open-Box Inspection (9.5)', id: 'section-9' },
              { label: 'Cancellation Policy', id: 'section-11' },
              { label: '7-Day Return Policy', id: 'section-12' },
              { label: 'Grievance Officer', id: 'section-22' },
              { label: 'Governing Law', id: 'section-23' },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => scrollToSection(chip.id)}
                className="rounded-full border border-emerald-700/20 bg-emerald-50 px-3 py-1 text-emerald-900 font-semibold hover:bg-emerald-100 hover:border-emerald-400 whitespace-nowrap transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2-Column Content Layout: Left Sticky Navigation + Right Detailed Clauses */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Sticky Table of Contents (4 cols on lg) */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-24 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs max-h-[calc(100vh-130px)] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3 mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <FileText className="size-4 text-emerald-700" />
                  Table of Contents ({filteredSections.length})
                </h3>
              </div>

              <nav className="space-y-1 text-xs">
                {filteredSections.map((sec) => {
                  const active = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => scrollToSection(sec.id)}
                      className={`w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-lg transition-colors ${
                        active
                          ? 'bg-emerald-100/70 text-emerald-950 font-bold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <span className="truncate pr-2">
                        <span className="font-mono text-[11px] text-emerald-800 font-bold mr-1.5">
                          {sec.number}.
                        </span>
                        {sec.title}
                      </span>
                      <ChevronRight className={`size-3 text-slate-400 shrink-0 ${active ? 'text-emerald-800 font-bold' : ''}`} />
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Quick Contact & Redressal Widget */}
            <div className="rounded-2xl border border-slate-200 bg-emerald-50/50 p-4 text-xs space-y-2">
              <h4 className="font-bold text-emerald-950 flex items-center gap-1.5">
                <HelpCircle className="size-4 text-emerald-700" />
                Need Legal or Policy Assistance?
              </h4>
              <p className="text-slate-600 text-[11px]">
                Have questions regarding orders, escrow, cancellations, or returns under these Terms?
              </p>
              <div className="pt-1 space-y-1">
                <a
                  href={`mailto:${TERMS_METADATA.supportEmail}`}
                  className="font-bold text-emerald-850 hover:underline flex items-center gap-1.5"
                >
                  <Mail className="size-3.5" /> {TERMS_METADATA.supportEmail}
                </a>
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Phone className="size-3.5 text-emerald-700" /> {TERMS_METADATA.supportPhone} ({TERMS_METADATA.workingHours})
                </p>
              </div>
            </div>
          </aside>

          {/* Right Column: Full Clause Content (8 cols on lg) */}
          <main className="lg:col-span-8 space-y-6">
            {filteredSections.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                <p>No clauses match your search query &ldquo;{searchQuery}&rdquo;.</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-3 text-emerald-800 font-bold hover:underline"
                >
                  Clear search query
                </button>
              </div>
            ) : (
              filteredSections.map((sec) => (
                <article
                  key={sec.id}
                  id={sec.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs scroll-mt-24 transition-shadow hover:shadow-xs"
                >
                  {/* Section Title Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-700 font-mono text-xs font-bold text-white shadow-2xs">
                        {sec.number}
                      </span>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 font-display">
                        {sec.title}
                      </h2>
                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {sec.badge}
                    </span>
                  </div>

                  {/* Section Body */}
                  <div className="text-xs leading-relaxed text-slate-800 space-y-3">
                    {/* Summary badge */}
                    {sec.summary && (
                      <p className="text-[11px] text-slate-500 font-medium italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        Summary: {sec.summary}
                      </p>
                    )}

                    {/* Section 1 Special Elements */}
                    {sec.number === '1' && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950 my-2">
                        <strong className="block font-bold mb-1 flex items-center gap-1.5 text-amber-900">
                          <AlertTriangle className="size-4 text-amber-700 shrink-0" />
                          Age Requirement & Corporate Capacity
                        </strong>
                        By accessing or using the TradeExpress Platform, you confirm that you are at least 18 years of age,
                        legally competent to enter into a binding agreement under applicable Indian law, and authorised to act on
                        behalf of your business, where applicable. Individuals below 18 years of age are not permitted to
                        independently register for or use the Platform. By registering for or using the Platform, you agree to
                        comply with these Terms & Conditions and all applicable laws.
                      </div>
                    )}

                    {/* Paragraphs */}
                    {sec.paragraphs?.map((p, idx) => (
                      <p key={idx} className={idx === 0 && sec.number === '1' ? 'font-semibold text-slate-900' : ''}>
                        {p}
                      </p>
                    ))}

                    {/* Definitions for Section 1 */}
                    {sec.definitions && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Key Definitions:</h4>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {sec.definitions.map((d) => (
                            <div key={d.term} className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                              <dt className="font-bold text-slate-900">&ldquo;{d.term}&rdquo;</dt>
                              <dd className="text-slate-600 mt-0.5">{d.definition}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}

                    {/* Highlight Box if present */}
                    {sec.highlight && (
                      <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3.5 text-emerald-950 font-medium my-2 flex items-start gap-2">
                        <ShieldCheck className="size-4 text-emerald-700 shrink-0 mt-0.5" />
                        <div>{sec.highlight}</div>
                      </div>
                    )}

                    {/* Clauses */}
                    {sec.clauses && (
                      <div className="space-y-2.5 pt-1">
                        {sec.clauses.map((c) => (
                          <div key={c.id} className="space-y-1">
                            <p>
                              <strong className="text-slate-900 mr-1.5">{c.id}.</strong>
                              <span>{c.text}</span>
                            </p>
                            {c.subItems && (
                              <ul className="list-none pl-4 space-y-1 text-slate-700 mt-1">
                                {c.subItems.map((sub, sIdx) => (
                                  <li key={sIdx} className="pl-2 border-l-2 border-slate-200">
                                    {sub}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* SubItems without individual clause IDs (e.g. Section 14) */}
                    {sec.subItems && (
                      <div className="space-y-1.5">
                        {sec.subItemsHeader && <p className="font-bold text-slate-900">{sec.subItemsHeader}</p>}
                        <ul className="list-none pl-4 space-y-1 text-slate-700">
                          {sec.subItems.map((sub, sIdx) => (
                            <li key={sIdx} className="pl-2 border-l-2 border-slate-200">
                              {sub}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Special Grievance Card (Section 22) */}
                    {sec.grievanceCard && (
                      <div className="rounded-2xl border-2 border-emerald-600 bg-emerald-50/60 p-4.5 text-xs space-y-2 shadow-xs mt-3">
                        <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                          <Headphones className="size-4.5 text-emerald-700" />
                          <span>{sec.grievanceCard.title}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-slate-800">
                          <div className="flex items-start gap-2">
                            <Mail className="size-4 text-emerald-800 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[11px] text-slate-500 font-semibold uppercase block">Official Email</span>
                              <a href={`mailto:${sec.grievanceCard.email}`} className="font-bold text-emerald-950 hover:underline">
                                {sec.grievanceCard.email}
                              </a>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Phone className="size-4 text-emerald-800 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[11px] text-slate-500 font-semibold uppercase block">Direct Helpline</span>
                              <span className="font-bold text-slate-900">{sec.grievanceCard.contact}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Clock className="size-4 text-emerald-800 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[11px] text-slate-500 font-semibold uppercase block">Working Schedule</span>
                              <span className="font-medium text-slate-800">{sec.grievanceCard.workingHours}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Scale className="size-4 text-emerald-800 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[11px] text-slate-500 font-semibold uppercase block">Statutory Redressal Window</span>
                              <span className="font-medium text-slate-800">{sec.grievanceCard.sla}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Special Contact Card (Section 26) */}
                    {sec.contactCard && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 shadow-2xs mt-3">
                        <p className="font-bold text-slate-900 text-sm">{sec.contactCard.name}</p>
                        <p className="text-slate-600 flex items-start gap-2">
                          <MapPin className="size-4 text-emerald-700 shrink-0 mt-0.5" />
                          <span>
                            <strong>Registered Office:</strong> {sec.contactCard.address}
                          </span>
                        </p>
                        <p className="text-slate-600 flex items-center gap-2">
                          <Mail className="size-4 text-emerald-700 shrink-0" />
                          <span>Customer Support Email: <a href={`mailto:${sec.contactCard.email}`} className="font-semibold text-emerald-900 hover:underline">{sec.contactCard.email}</a></span>
                        </p>
                        <p className="text-slate-600 flex items-center gap-2">
                          <Phone className="size-4 text-emerald-700 shrink-0" />
                          <span>Contact Number: <strong className="text-slate-900">{sec.contactCard.phone}</strong></span>
                        </p>
                      </div>
                    )}

                    {/* Closing Paragraphs */}
                    {sec.closingParagraphs?.map((cp, cIdx) => (
                      <p key={cIdx} className={cIdx === 1 ? 'font-semibold text-rose-800' : 'text-slate-600'}>
                        {cp}
                      </p>
                    ))}
                  </div>
                </article>
              ))
            )}
          </main>
        </div>
      </div>

      {/* Floating Back-to-Top Button */}
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 flex size-10 items-center justify-center rounded-full bg-emerald-800 text-white shadow-lg hover:bg-emerald-700 transition-all hover:scale-105"
          title="Back to Top"
        >
          <ArrowUp className="size-5" />
        </button>
      )}
    </div>
  );
}
