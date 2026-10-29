import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  Store,
  Award,
  CreditCard,
  Headset,
  FileText,
  Lock,
  ShieldAlert,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Phone,
  Mail,
  MessageSquare,
  ExternalLink,
  X,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useNotifications from '../hooks/useNotifications';
import Breadcrumbs from '../components/common/Breadcrumbs';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import CustomSelect from '../components/common/CustomSelect';
import SupportTicketsSection from '../components/support/SupportTicketsSection';

export const HELP_CATEGORIES = [
  {
    id: 'buying',
    title: 'Buying on TradeExpress',
    description: 'Find and purchase wholesale products from verified suppliers.',
    icon: ShoppingCart,
    color: 'from-blue-500/15 to-blue-600/5 text-blue-700 border-blue-200/60',
    iconColor: 'bg-blue-100 text-blue-700',
    articles: [
      {
        title: 'How to search and find verified suppliers',
        content: `TradeExpress gives buyers multiple ways to discover authentic suppliers:
• Use the top search bar to filter by product keywords or company names.
• Filter suppliers by "Verified Exporters", "Manufacturers", or "Trading Companies".
• Look for the TrustSEAL™ badge and DGFT IEC certification on company profiles.
• Check supplier response times, buyer ratings, and factory audit certificates.`,
        actionLink: '/suppliers',
        actionLabel: 'Find Verified Suppliers',
      },
      {
        title: 'How to send a Request for Quotation (RFQ)',
        content: `Posting an RFQ lets multiple verified suppliers compete for your order:
1. Navigate to the RFQ Portal from the header menu.
2. Enter your required product name, estimated quantity, and unit of measurement.
3. Specify your destination country, delivery port, and preferred Incoterms (FOB, CIF, EXW).
4. Attach any technical specifications or drawings.
5. Within 2 to 4 hours, verified manufacturers will send quotes to your dashboard.`,
        actionLink: '/rfq',
        actionLabel: 'Post an RFQ',
      },
      {
        title: 'Understanding Minimum Order Quantity (MOQ) and tiered wholesale prices',
        content: `Every TradeExpress product listing clearly states its Minimum Order Quantity (MOQ):
• The MOQ is the minimum volume a factory requires to produce or pack an order.
• Volume Price Tiers: As order quantity increases, unit prices decrease systematically.
• To purchase quantities below the factory MOQ, request a custom sample through direct supplier inquiry.`,
        actionLink: '/products',
        actionLabel: 'Explore Products',
      },
      {
        title: 'Requesting product samples before bulk production',
        content: `Ordering pre-production samples is strongly recommended before committing to container loads:
• On any product details page, click "Inquire Now" and select "Request Sample".
• Agree on sample fee and courier charges (sample costs are often credited back upon placing the full order).
• Inspect material finish, packaging, and dimensional tolerances before approving bulk production.`,
      },
      {
        title: 'Placing orders with TradeExpress Buy Now & Cart',
        content: `For ready-to-ship wholesale stock:
• Select your quantity (at or above MOQ) and click "Buy Now" or "Add to Cart".
• Enter your business shipping address and review billing details.
• Your order is generated with full buyer protection and escrow tracking.`,
        actionLink: '/cart',
        actionLabel: 'View Cart',
      },
    ],
  },
  {
    id: 'selling',
    title: 'Selling on TradeExpress',
    description: 'List products and connect with domestic and global buyers.',
    icon: Store,
    color: 'from-amber-500/15 to-amber-600/5 text-amber-800 border-amber-200/60',
    iconColor: 'bg-amber-100 text-amber-700',
    articles: [
      {
        title: 'Creating and setting up your supplier company profile',
        content: `A verified profile builds immediate trust with international buyers:
1. Register with role "Supplier" using your official business email and phone number.
2. Complete your company profile: company name, factory location, year established, and annual turnover.
3. Upload factory photos, SMT lines, warehouse facilities, and testing equipment.
4. Specify your core product capabilities and export corridors served.`,
        actionLink: '/supplier',
        actionLabel: 'Supplier Dashboard',
      },
      {
        title: 'Listing wholesale products with volume pricing',
        content: `Showcase your catalogue effectively:
• Add high-resolution product photos showcasing angles, packaging, and scale.
• Define clear Minimum Order Quantities (MOQ).
• Add tiered wholesale pricing (e.g. 100-499 units, 500-1999 units, 2000+ units).
• Detail technical specifications, HS codes, and lead times.`,
        actionLink: '/supplier/products/new',
        actionLabel: 'Add New Product',
      },
      {
        title: 'Responding to buyer inquiries and quotation requests',
        content: `Speed matters in B2B trade:
• Inquiries appear in real time in your Supplier Messages and Inquiries tab.
• Respond with clear quotation breakdowns (Ex-Factory vs FOB port prices).
• Fast responders (within 2-4 hours) receive boosted visibility in supplier rankings.`,
        actionLink: '/messages',
        actionLabel: 'Check Messages',
      },
      {
        title: 'Verifying your business with GSTIN, PAN, and IEC',
        content: `Unlock verified supplier status:
• Submit your active GSTIN number for domestic Indian trade verification.
• For export capabilities, provide your 10-digit DGFT Import Export Code (IEC).
• Verification is completed by TradeExpress's compliance team within 24 business hours.`,
        actionLink: '/supplier/verification',
        actionLabel: 'Verification Center',
      },
    ],
  },
  {
    id: 'paid-services',
    title: 'Paid Services & Memberships',
    description: 'Explore premium service packages for added advantage.',
    icon: Award,
    color: 'from-purple-500/15 to-purple-600/5 text-purple-800 border-purple-200/60',
    iconColor: 'bg-purple-100 text-purple-700',
    articles: [
      {
        title: 'TradeExpress TrustSEAL™ physical factory verification',
        content: `TrustSEAL™ is India's gold standard for B2B supplier credibility:
• An independent inspection specialist visits your manufacturing premises.
• Verifies machinery capacity, staff count, quality control processes, and legal ownership.
• Once certified, your company badge displays TrustSEAL™ with official audit reports available to prospective buyers.`,
        actionLink: '/supplier/verification',
        actionLabel: 'Get TrustSEAL Verified',
      },
      {
        title: 'Priority placement in verified supplier search results',
        content: `Premium suppliers receive top-tier ranking in buyer searches:
• Prominent banner placement on relevant industry category pages.
• Inclusion in the weekly "TradeExpress Verified Exporters" digest sent to 50,000+ overseas procurement officers.`,
      },
      {
        title: 'Global Exporters Showcase membership',
        content: `Specifically designed for export-oriented manufacturers:
• Showcased in the dedicated Exporters Portal (/exporters).
• Pre-qualified international RFQ matching based on destination country and commodity HS codes.
• Multilingual catalog support and foreign trade documentation assistance.`,
        actionLink: '/exporters',
        actionLabel: 'Visit Exporters Portal',
      },
      {
        title: 'Dedicated trade manager and buyer lead match alerts',
        content: `Enterprise membership includes a dedicated relationship manager:
• Directly screens inbound RFQs for serious intent before sending them to your sales desk.
• Coordinates factory sample logistics and escrow contract structuring.`,
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payment Related',
    description: 'Handle transactions, understand escrow milestones and resolve payment issues.',
    icon: CreditCard,
    color: 'from-emerald-500/15 to-emerald-600/5 text-emerald-800 border-emerald-200/60',
    iconColor: 'bg-emerald-100 text-emerald-700',
    articles: [
      {
        title: 'How TradeExpress Escrow protects buyers and suppliers',
        content: `TradeExpress Escrow eliminates payment risk in cross-border trade:
1. Buyer deposits payment into a secure multi-sign escrow account.
2. The supplier is notified that funds are secured and starts production.
3. Pre-shipment inspection is performed at the factory.
4. Once Bill of Lading (B/L) is uploaded and verified, funds are released to the supplier.
5. If goods do not meet agreed contract terms, funds remain safely protected.`,
        actionLink: '/info/buyer-protection',
        actionLabel: 'Buyer Protection Guide',
      },
      {
        title: 'Supported payment methods: UPI, Bank Wire, NEFT/RTGS, Letter of Credit (LC)',
        content: `TradeExpress supports multiple trusted business payment gateways:
• Domestic Indian transactions: UPI, Net Banking, Corporate NEFT/RTGS.
• Cross-border trade: International SWIFT wire transfers and irrevocable documentary Letters of Credit (LC).
• All domestic transactions provide GST tax invoices with input tax credit eligibility.`,
      },
      {
        title: 'Milestone releases upon Bill of Lading (B/L) verification',
        content: `Customizable milestone contracts for large production orders:
• 30% advance upon contract signing for raw material procurement.
• 40% milestone upon pre-shipment quality inspection approval.
• 30% final balance upon seaport Bill of Lading (B/L) or Air Waybill (AWB) generation.`,
      },
      {
        title: 'Invoicing, GST tax input credits, and currency conversion',
        content: `Transparent taxation and accounting:
• Automatic GST-compliant proforma and tax invoices generated with every transaction.
• Export orders eligible for Zero-Rated GST under Letter of Undertaking (LUT).
• Multi-currency support: INR, USD, EUR, GBP, AED, and AUD.`,
      },
      {
        title: 'Refund processing timelines and cancellation policies',
        content: `Clear cancellation rules:
• Orders cancelled prior to supplier production confirmation receive 100% immediate escrow refund.
• In dispute cases, refunds are credited back to the original funding source within 3 to 5 business days after council determination.`,
      },
    ],
  },
  {
    id: 'communication',
    title: 'Communication and Support',
    description: 'Resolve queries and connect with customers and support teams.',
    icon: Headset,
    color: 'from-cyan-500/15 to-cyan-600/5 text-cyan-800 border-cyan-200/60',
    iconColor: 'bg-cyan-100 text-cyan-700',
    articles: [
      {
        title: 'Using the TradeExpress real-time messaging center',
        content: `All business communications stay organized in one place:
• Direct encrypted chat between registered buyers and suppliers.
• Share PDF spec sheets, CAD drawings, lab test reports, and purchase orders.
• Keep records of all agreements in writing to ensure contract protection.`,
        actionLink: '/messages',
        actionLabel: 'Open Messages',
      },
      {
        title: 'Best practices for negotiating export specifications',
        content: `To ensure smooth manufacturing:
• Always specify precise dimensions, material grades (e.g. SS 304 vs SS 316), and packaging tolerances.
• Agree upon sampling approval before commencement of bulk production.
• Confirm Incoterms (FOB Port vs CIF Destination Port) in writing within the inquiry thread.`,
      },
      {
        title: 'Reporting unresponsive buyers or suppliers',
        content: `If a party is unresponsive after placing an order or quote:
• Suppliers have a mandatory 48-hour response window for pending orders.
• If unanswered, click "Report Unresponsive" in your order details to have a TradeExpress trade officer intervene.`,
      },
      {
        title: 'Contacting TradeExpress 24/7 dedicated trade support',
        content: `Our customer support team is available across channels:
• Toll-Free Helpline: 1800-TRADE-SPHERE (1800-872-3377) available 9 AM - 8 PM IST.
• Email Support: support@tradeexpress.com with guaranteed 4-hour response turnaround.
• Dedicated Priority Account Managers for Enterprise and TrustSEAL™ members.`,
        actionLink: '/info/contact',
        actionLabel: 'Contact Page',
      },
    ],
  },
  {
    id: 'policies',
    title: 'Policies and Guidelines',
    description: 'Understand platform rules, compliance standards and user conduct.',
    icon: FileText,
    color: 'from-slate-500/15 to-slate-600/5 text-slate-800 border-slate-200/60',
    iconColor: 'bg-slate-100 text-slate-700',
    articles: [
      {
        title: 'TradeExpress Buyer & Supplier Protection Policy',
        content: `A fair, balanced marketplace environment:
• Buyers are protected against non-delivery, counterfeit goods, and material quality variance.
• Suppliers are protected against payment defaults and arbitrary order rejections once specifications match approval samples.`,
        actionLink: '/info/buyer-protection',
        actionLabel: 'Read Protection Guide',
      },
      {
        title: 'Prohibited, hazardous, and restricted products list',
        content: `Strictly forbidden on the marketplace:
• Counterfeit brand replicas and unauthorized trademark use.
• Narcotics, illegal drugs, and controlled chemical precursors.
• Weapons, munitions, explosive pyrotechnics, and hazardous radioactive materials.
• Any items prohibited under DGFT Indian Export-Import regulations.`,
        actionLink: '/info/terms',
        actionLabel: 'Terms of Use',
      },
      {
        title: 'DGFT cross-border export compliance guidelines',
        content: `Compliance rules for international shipments:
• All exporters must hold a valid 10-digit Import Export Code (IEC) issued by DGFT.
• Appropriate HS Codes must be applied to all commercial invoices and packing lists.
• Shipments must comply with international phytosanitary, fumigation, and ISPM-15 wooden pallet standards.`,
      },
      {
        title: 'Intellectual property (IP) and brand trademark rules',
        content: `Respecting intellectual property:
• Trademark owners can file an instant Notice of Infringement with our compliance team.
• Listings infringing on patents or copyrighted product designs are taken down within 24 hours.`,
      },
    ],
  },
  {
    id: 'account',
    title: 'Account and Privacy',
    description: 'Manage account details, security credentials and data security.',
    icon: Lock,
    color: 'from-rose-500/15 to-rose-600/5 text-rose-800 border-rose-200/60',
    iconColor: 'bg-rose-100 text-rose-700',
    articles: [
      {
        title: 'Securing your account with Two-Factor OTP authentication',
        content: `Enhanced security for high-value wholesale accounts:
• TradeExpress supports real-time mobile OTP verification for logins and sensitive transactions.
• Ensures that only authorized procurement officers can authorize purchase orders or quote approvals.`,
      },
      {
        title: 'Updating company name, registered address, and tax credentials',
        content: `Keeping business records up to date:
• Navigate to your Dashboard -> Profile & Settings.
• Update trade name, warehouse dispatch addresses, and contact phone numbers.
• For GST/IEC updates, submit updated registration certificates for verification.`,
        actionLink: '/buyer/profile',
        actionLabel: 'Account Settings',
      },
      {
        title: 'Password reset and account recovery steps',
        content: `If you have lost access to your account:
• Click "Forgot Password" on the sign-in screen.
• Enter your registered email address or mobile number to receive a secure password reset link or OTP.`,
        actionLink: '/forgot-password',
        actionLabel: 'Reset Password',
      },
      {
        title: 'Privacy settings and data storage management',
        content: `How TradeExpress handles your commercial data:
• Passwords and credentials are never stored in readable plain text.
• Inquiries and quotes are visible only to the contracting parties.
• You can manage local storage or clear session history using the Reset tool in the footer.`,
        actionLink: '/info/privacy',
        actionLabel: 'Privacy Policy',
      },
    ],
  },
  {
    id: 'complaints',
    title: 'Complaints & Dispute Resolution',
    description: 'Report issues, raise order disputes or share user experiences.',
    icon: ShieldAlert,
    color: 'from-red-500/15 to-red-600/5 text-red-800 border-red-200/60',
    iconColor: 'bg-red-100 text-red-700',
    articles: [
      {
        title: 'How to file an official dispute against an order',
        content: `Step-by-step dispute resolution:
1. Go to your Orders tab and select the order in question.
2. Click "Raise Dispute / Claim".
3. Select dispute reason: "Quality Mismatch", "Delayed Delivery", "Missing Items", or "Specification Variance".
4. Upload photographic evidence, inspection reports, or third-party lab tests.
5. TradeExpress Dispute Council will freeze escrow disbursement and arbitrate fairly.`,
        actionLink: '/buyer/orders',
        actionLabel: 'View Orders',
      },
      {
        title: 'Pre-shipment inspection discrepancy claims',
        content: `Resolve quality differences before cargo leaves port:
• If an independent inspector notes non-compliance with the purchase contract, you have the right to request supplier rework or full order cancellation.
• Escrow balance will not be transferred until re-inspection certificate is approved.`,
      },
      {
        title: 'Damaged in transit or quantity mismatch resolution',
        content: `For freight damage:
• Photograph damaged cartons before signing the carrier delivery receipt.
• Request carrier notation of outer packaging condition on the Delivery Order.
• Submit claim documentation within 7 calendar days of port/doorstep delivery.`,
      },
      {
        title: 'Escalating to TradeExpress Dispute Mediation Council',
        content: `Unbiased professional trade arbitration:
• Our council consists of experienced international trade attorneys, logistics specialists, and industry engineers.
• Reviews all written communication, sample approvals, and inspection findings to issue a binding determination within 7 to 10 business days.`,
      },
      {
        title: 'Submitting feedback and rating your trade experience',
        content: `Help maintain high marketplace standards:
• After completing an order, leave verified reviews on supplier responsiveness, delivery punctuality, and product accuracy.
• Verified reviews help honest, high-quality manufacturers stand out.`,
      },
    ],
  },
];

const POPULAR_QUESTIONS = [
  'How to Register as a Verified Supplier on TradeExpress?',
  'Does TradeExpress Provide Shipping & Escrow Services?',
  'How to Sell Items & Respond to Buyer RFQs?',
  'How to Verify Indian Exporter Credentials & DGFT IEC?',
  'What is Minimum Order Quantity (MOQ) & Price Tiers?',
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
];

export default function Help() {
  useDocumentTitle('Help Center — FAQs, Sourcing Support & Dispute Center | TradeExpress');
  const { showToast } = useNotifications();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [feedbackGiven, setFeedbackGiven] = useState({});

  // Dynamic search filtering
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();
    const matches = [];

    HELP_CATEGORIES.forEach((cat) => {
      cat.articles.forEach((art) => {
        if (
          art.title.toLowerCase().includes(q) ||
          art.content.toLowerCase().includes(q) ||
          cat.title.toLowerCase().includes(q)
        ) {
          matches.push({ ...art, categoryTitle: cat.title, categoryId: cat.id });
        }
      });
    });

    return matches;
  }, [searchQuery]);

  // Tab filtering
  const displayedCategories = useMemo(() => {
    if (activeCategoryTab === 'all') return HELP_CATEGORIES;
    return HELP_CATEGORIES.filter((c) => c.id === activeCategoryTab);
  }, [activeCategoryTab]);

  const handleFeedback = (artTitle, isHelpful) => {
    setFeedbackGiven((prev) => ({ ...prev, [artTitle]: isHelpful }));
    showToast(
      isHelpful
        ? 'Thank you! Your feedback helps us improve support articles.'
        : 'Thank you for your feedback. We will update this article soon.',
      'info'
    );
  };

  const handlePopularClick = (question) => {
    setSearchQuery(question);
    // Find closest article
    for (const cat of HELP_CATEGORIES) {
      for (const art of cat.articles) {
        if (
          art.title.toLowerCase().includes(question.toLowerCase().slice(0, 15)) ||
          question.toLowerCase().includes(art.title.toLowerCase().slice(0, 15))
        ) {
          setSelectedArticle({ ...art, categoryTitle: cat.title });
          return;
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-surface/40 pb-16">
      {/* Top Breadcrumb row */}
      <div className="border-b bg-white">
        <div className="ts-container py-2.5 flex items-center justify-between text-xs">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Help Center' }]} />
          <div className="hidden sm:flex items-center gap-3 text-muted">
            <span className="flex items-center gap-1 font-medium text-navy-800">
              <Phone className="size-3 text-brand-600" /> Helpline: 1800-872-3377
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-medium text-navy-800">
              <Mail className="size-3 text-brand-600" /> support@tradeexpress.com
            </span>
          </div>
        </div>
      </div>

      {/* Hero Section (Matching top of the provided screenshot) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/70 via-indigo-50/30 to-white py-12 lg:py-16 border-b border-navy-900/[0.06]">
        {/* Subtle background glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-full max-w-6xl h-full opacity-60">
          <div className="absolute top-0 left-1/4 size-72 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute top-10 right-1/4 size-80 rounded-full bg-brand-500/10 blur-3xl" />
        </div>

        <div className="ts-container relative z-10 text-center max-w-3xl mx-auto">
          {/* Main Title matching user screenshot */}
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-navy-950">
            &ldquo;Hello, how can we assist you today?&rdquo;
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted max-w-xl mx-auto">
            Search our comprehensive knowledge base, browse buyer and supplier guides, or submit a dispute ticket.
          </p>

          {/* Search Box matching screenshot */}
          <div className="mt-8 max-w-2xl mx-auto">
            <div className="relative flex items-center shadow-lift rounded-2xl bg-white border border-navy-900/15 p-1.5 transition-all focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
              <Search className="size-5 text-muted ml-3 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search using Keywords (e.g. payment, RFQ, verified supplier, refund)..."
                className="w-full h-11 px-3 text-sm sm:text-base text-navy-950 placeholder:text-muted/70 bg-transparent focus:outline-none"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-muted hover:text-navy-950 transition-colors mr-1"
                  title="Clear search"
                >
                  <X className="size-4" />
                </button>
              ) : null}
              <Button
                variant="navy"
                size="md"
                onClick={() => {
                  if (searchResults && searchResults.length > 0) {
                    setSelectedArticle(searchResults[0]);
                  }
                }}
                className="!h-10 px-5 sm:px-7 font-bold shrink-0 rounded-xl"
              >
                Search
              </Button>
            </div>
          </div>

          {/* Explore support articles (Matching screenshot chips) */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="font-semibold text-navy-800 mr-1">Explore support articles:</span>
            {POPULAR_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => handlePopularClick(question)}
                className="rounded-full bg-white/90 hover:bg-navy-900 hover:text-white px-3 py-1 text-navy-800 border border-navy-900/10 shadow-2xs transition-all font-medium text-[11.5px]"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="ts-container py-10 lg:py-14">
        {/* If user searched with live results */}
        {searchResults !== null ? (
          <div className="mb-10">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="font-display text-xl font-bold text-navy-950 flex items-center gap-2">
                <Search className="size-5 text-brand-600" /> Search Results for &ldquo;{searchQuery}&rdquo;
                <span className="text-xs font-normal text-muted">({searchResults.length} articles found)</span>
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
            </div>

            {searchResults.length === 0 ? (
              <div className="ts-card p-10 text-center">
                <HelpCircle className="size-10 text-muted mx-auto mb-2" />
                <p className="font-bold text-navy-900">No matching help articles found</p>
                <p className="text-sm text-muted mt-1">Try another keyword or browse the 8 core help categories below.</p>
                <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="mt-4">
                  Browse Categories
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {searchResults.map((art) => (
                  <button
                    key={art.title}
                    type="button"
                    onClick={() => setSelectedArticle(art)}
                    className="ts-card p-4 text-left transition-all hover:border-brand-500/60 hover:shadow-card flex items-start justify-between gap-3 group"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full mb-1.5 inline-block">
                        {art.categoryTitle}
                      </span>
                      <h3 className="font-display text-sm font-bold text-navy-950 group-hover:text-brand-700 transition-colors">
                        {art.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted line-clamp-2">{art.content.replace(/•/g, '')}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted group-hover:text-brand-700 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Category Navigation Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-8 no-scrollbar text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveCategoryTab('all')}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 transition-all ${
              activeCategoryTab === 'all'
                ? 'bg-navy-900 text-white font-bold shadow-xs'
                : 'bg-white text-navy-800 border border-navy-900/10 hover:bg-navy-50'
            }`}
          >
            All Categories ({HELP_CATEGORIES.length})
          </button>
          {HELP_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategoryTab(cat.id)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 transition-all ${
                activeCategoryTab === cat.id
                  ? 'bg-navy-900 text-white font-bold shadow-xs'
                  : 'bg-white text-navy-800 border border-navy-900/10 hover:bg-navy-50'
              }`}
            >
              {cat.title}
            </button>
          ))}
        </div>

        {/* The 8 Main Help Categories (Matching the exact 3x3 grid from the user's screenshot) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {displayedCategories.map((category) => {
            const Icon = category.icon;
            return (
              <div
                key={category.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-navy-900/10 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-brand-500/60 hover:shadow-card"
              >
                <div>
                  {/* Category Header with Icon */}
                  <div className="flex items-start gap-4 mb-3.5">
                    <div
                      className={`size-12 shrink-0 rounded-xl flex items-center justify-center ${category.iconColor} shadow-2xs transition-transform group-hover:scale-105`}
                    >
                      <Icon className="size-6" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-bold text-navy-950 group-hover:text-brand-700 transition-colors">
                        {category.title}
                      </h2>
                      <p className="mt-1 text-xs text-muted leading-relaxed">
                        {category.description}
                      </p>
                    </div>
                  </div>

                  {/* List of Articles for this Category */}
                  <div className="mt-4 pt-3 border-t border-navy-900/[0.06] space-y-1.5">
                    {category.articles.map((art) => (
                      <button
                        key={art.title}
                        type="button"
                        onClick={() => setSelectedArticle({ ...art, categoryTitle: category.title })}
                        className="w-full text-left p-2 rounded-lg hover:bg-surface/80 transition-colors flex items-center justify-between gap-2 text-xs font-medium text-navy-800 hover:text-navy-950 group/art"
                      >
                        <span className="truncate flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-navy-300 group-hover/art:bg-brand-500 shrink-0" />
                          <span className="truncate">{art.title}</span>
                        </span>
                        <ChevronRight className="size-3.5 text-muted group-hover/art:text-navy-950 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card Bottom Action */}
                <div className="mt-5 pt-3 border-t border-navy-900/[0.06] flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedArticle({ ...category.articles[0], categoryTitle: category.title })}
                    className="font-bold text-brand-700 hover:text-brand-800 transition-colors inline-flex items-center gap-1"
                  >
                    Explore all {category.articles.length} topics <ArrowRight className="size-3.5" />
                  </button>
                  {category.id === 'complaints' ? (
                    <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                      Dispute Council
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Support Ticket System Section (for Account & Complaints tab) */}
        <div className="mt-14 pt-10 border-t border-navy-900/[0.08]">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full">
                  <ShieldAlert className="size-3" /> Grievance & Ticket Desk
                </span>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-navy-950 mt-1">
                  Have an Active Order Issue or Need Personal Help?
                </h2>
                <p className="text-xs sm:text-sm text-muted">
                  Log a ticket directly with our 24/7 trade compliance and dispute arbitration desk.
                </p>
              </div>
            </div>

            {/* Embedded Live Ticket System */}
            <div className="ts-card p-5 sm:p-7 shadow-xs">
              <SupportTicketsSection />
            </div>
          </div>
        </div>

        {/* Language Selection & Assistance Footer (Matching bottom of user's screenshot) */}
        <div className="mt-14 text-center border-t border-navy-900/[0.08] pt-8">
          <div className="inline-flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs mb-4">
            <Globe className="size-4 text-emerald-700 shrink-0" />
            <span className="text-xs font-semibold text-navy-900 shrink-0">Select Language:</span>
            <div className="min-w-[10rem]">
              <CustomSelect
                value={selectedLanguage}
                onChange={(e) => {
                  setSelectedLanguage(e.target.value);
                  showToast(`Language set to ${LANGUAGES.find((l) => l.code === e.target.value)?.label}`, 'info');
                }}
                options={LANGUAGES.map((lang) => ({ value: lang.code, label: lang.label }))}
                compact
                searchable={false}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted">
            Powered by TradeExpress Multi-Language International Trade Assistant
          </p>
        </div>
      </div>

      {/* Article Detail Modal */}
      <Modal
        open={Boolean(selectedArticle)}
        onClose={() => setSelectedArticle(null)}
        title={selectedArticle?.title || 'Help Article'}
        description={selectedArticle ? `Category: ${selectedArticle.categoryTitle || 'Help Center'}` : ''}
        size="lg"
      >
        {selectedArticle ? (
          <div className="space-y-5">
            {/* Formatted Article Body */}
            <div className="prose prose-sm max-w-none text-navy-900 text-sm leading-relaxed whitespace-pre-line bg-surface/40 p-4.5 rounded-xl border">
              {selectedArticle.content}
            </div>

            {/* Direct Action Link if available */}
            {selectedArticle.actionLink ? (
              <div className="rounded-xl bg-navy-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-navy-100">
                <div>
                  <p className="text-xs font-bold text-navy-900">Take Action Directly</p>
                  <p className="text-xs text-muted">Jump straight to the corresponding TradeExpress workspace.</p>
                </div>
                <Button
                  to={selectedArticle.actionLink}
                  variant="navy"
                  size="sm"
                  onClick={() => setSelectedArticle(null)}
                  className="font-bold text-xs shrink-0"
                >
                  {selectedArticle.actionLabel || 'Proceed →'}
                </Button>
              </div>
            ) : null}

            {/* Feedback: Was this helpful? */}
            <div className="flex items-center justify-between pt-3 border-t text-xs text-muted">
              <span>Was this article helpful?</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleFeedback(selectedArticle.title, true)}
                  disabled={feedbackGiven[selectedArticle.title] !== undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold transition-colors ${
                    feedbackGiven[selectedArticle.title] === true
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'hover:bg-surface text-navy-800'
                  }`}
                >
                  <ThumbsUp className="size-3.5" /> Yes
                </button>
                <button
                  type="button"
                  onClick={() => handleFeedback(selectedArticle.title, false)}
                  disabled={feedbackGiven[selectedArticle.title] !== undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold transition-colors ${
                    feedbackGiven[selectedArticle.title] === false
                      ? 'bg-rose-50 text-rose-700 border-rose-300'
                      : 'hover:bg-surface text-navy-800'
                  }`}
                >
                  <ThumbsDown className="size-3.5" /> No
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
