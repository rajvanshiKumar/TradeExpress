import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  ShieldCheck,
  Award,
  FileCheck2,
  Globe,
  Building2,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Ship,
  PackageCheck,
  Coins,
  Star,
  Check,
  X,
  ChevronRight,
  Phone,
  Mail,
  Send,
  SlidersHorizontal,
  ExternalLink,
} from 'lucide-react';
import useProducts from '../hooks/useProducts';
import useNotifications from '../hooks/useNotifications';
import useDocumentTitle from '../hooks/useDocumentTitle';
import Breadcrumbs from '../components/common/Breadcrumbs';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { photoUrl } from '../utils/images';

export const EXPORT_CATEGORIES = [
  {
    id: 'machinery-plants',
    title: 'Industrial Plants & Machinery',
    photo: 'photo-1566930665082-4ae9dbbb5b6b',
    industry: 'Industrial Machinery and Tools',
    subcategories: [
      'Industrial Boilers',
      'RO Water Treatment Plants',
      'CNC Lathe Machines',
      'Hydraulic Presses',
      'Stone Crushers',
    ],
  },
  {
    id: 'gems-jewelry',
    title: 'Gems, Jewelry & Astrology',
    photo: 'photo-1515562141207-7a88fb7ce338',
    industry: 'Gems and Jewelry',
    subcategories: [
      'Natural Gemstones',
      'Gold & Diamond Jewelry',
      '925 Sterling Silver Ornaments',
      'Certified Rudraksha',
      'Kundan & Polki Sets',
    ],
  },
  {
    id: 'apparel-garments',
    title: 'Apparel & Garments',
    photo: 'photo-1567401893414-76b7b1e5a7a5',
    industry: 'Fashion and Textiles',
    subcategories: [
      'Mens Cotton Shirts',
      'Knitted T-Shirts',
      'Pure Silk Sarees',
      'Activewear & Sportswear',
      'Denim Jackets & Jeans',
    ],
  },
  {
    id: 'building-construction',
    title: 'Building & Construction',
    photo: 'photo-1504307651254-35680f356dfd',
    industry: 'Building and Construction',
    subcategories: [
      'Vitrified Porcelain Tiles',
      'Construction Scaffolding',
      'TMT Steel Rebars',
      'Architectural Glass',
      'Decorative Wall Panels',
    ],
  },
  {
    id: 'cosmetics-personal-care',
    title: 'Cosmetics & Personal Care',
    photo: 'photo-1522335789203-aabd1fc54bc9',
    industry: 'Beauty and Personal Care',
    subcategories: [
      'Herbal Skincare Serums',
      'Organic Face Creams',
      'Natural Essential Oils',
      'Ayurvedic Cold-Pressed Soaps',
      'Henna & Herbal Hair Dyes',
    ],
  },
  {
    id: 'lab-instruments',
    title: 'Lab Instruments & Supplies',
    photo: 'photo-1582719478250-c89cae4dc85b',
    industry: 'Medical and Laboratory',
    subcategories: [
      'Borosilicate Glassware',
      'Precision Electronic Balances',
      'Laboratory Centrifuges',
      'Binocular Microscopes',
      'Steam Autoclaves',
    ],
  },
  {
    id: 'drugs-pharma',
    title: 'Drugs & Pharmaceuticals',
    photo: 'photo-1584308666744-24d5c474f2ae',
    industry: 'Pharmaceuticals',
    subcategories: [
      'Antibiotic Tablets & Capsules',
      'Generic Pharma Formulations',
      'Standardized Herbal Extracts',
      'Active Pharma Ingredients (APIs)',
      'Injectables & IV Fluids',
    ],
  },
  {
    id: 'mechanical-parts',
    title: 'Mechanical Parts & Spares',
    photo: 'photo-1613206485381-b028e578e791',
    industry: 'Industrial Machinery and Tools',
    subcategories: [
      'Stainless Steel Fasteners',
      'Industrial Gearboxes',
      'Hydraulic Cylinders & Valves',
      'Brass Pipe Fittings',
      'Machined Flanges & Bushings',
    ],
  },
  {
    id: 'packaging-machines',
    title: 'Packaging Machines & Goods',
    photo: 'photo-1534452203293-494d7ddbf7e0',
    industry: 'Packaging and Supplies',
    subcategories: [
      'Corrugated Export Cartons',
      'Automatic Pouch Sealing Machines',
      'Multi-Layer Shrink Film',
      'Biodegradable Standup Pouches',
      'Industrial Strapping Machines',
    ],
  },
  {
    id: 'chemicals-dyes',
    title: 'Chemicals, Dyes & Solvents',
    photo: 'photo-1607613009820-a29f7bb81c04',
    industry: 'Chemicals and Materials',
    subcategories: [
      'Reactive Textile Dyes',
      'Organic Pigments & Inks',
      'Industrial Solvents',
      'Water Treatment Chemicals',
      'Agricultural Bio-Fertilizers',
    ],
  },
  {
    id: 'electrical-equipment',
    title: 'Electrical Equipment',
    photo: 'photo-1509391365360-2e959784a276',
    industry: 'Electrical and Energy',
    subcategories: [
      'Step-Down Transformers',
      'Solar Inverters & Panels',
      'Submersible Water Pumps',
      'Low Voltage Switchgears',
      'Armoured Copper Cables',
    ],
  },
  {
    id: 'metals-alloys',
    title: 'Metals, Alloys & Minerals',
    photo: 'photo-1504917599217-d4dc5ebe6122',
    industry: 'Metals and Minerals',
    subcategories: [
      'Stainless Steel Coils & Sheets',
      'Electrolytic Copper Rods',
      'Aluminum Extrusion Profiles',
      'Quartz & Feldspar Minerals',
      'Zinc & Brass Ingots',
    ],
  },
  {
    id: 'agriculture-farming',
    title: 'Agriculture & Farming',
    photo: 'photo-1527847263472-aa5338d178b8',
    industry: 'Agriculture and Food',
    subcategories: [
      'Traditional 1121 Basmati Rice',
      'Whole Indian Spices (Cumin, Pepper, Cardamom)',
      'Fresh Red Onions & Garlic',
      'Organic Pulses & Lentils',
      'Oilseeds (Sesame, Mustard)',
    ],
  },
  {
    id: 'handicrafts-decoratives',
    title: 'Handicrafts & Decoratives',
    photo: 'photo-1597696929736-6d13bed8e6a8',
    industry: 'Home Decor and Handicrafts',
    subcategories: [
      'Hand-Cast Brass Artifacts',
      'Carved Wooden Statues',
      'Hand-Painted Marble Crafts',
      'Embroidered Zari Tapestries',
      'Bone Inlay Furniture Pieces',
    ],
  },
  {
    id: 'security-safety',
    title: 'Security, Safety Systems & Devices',
    photo: 'photo-1557597774-9d273605dfa9',
    industry: 'Safety and Security',
    subcategories: [
      'High-Definition CCTV Cameras',
      'Industrial Fire Hydrants',
      'Industrial Safety Helmets & Harnesses',
      'Biometric Access Control',
      'Road Traffic Safety Equipment',
    ],
  },
  {
    id: 'home-textiles',
    title: 'Furniture & Home Textiles',
    photo: 'photo-1628744876497-eb30460be9f6',
    industry: 'Home and Kitchen',
    subcategories: [
      'Solid Teak & Sheesham Furniture',
      'Hand-Knotted Woollen Rugs',
      'Organic Cotton Bed Sheets',
      'Jacquard Window Curtains',
      'Embroidered Cushion Covers',
    ],
  },
  {
    id: 'bags-belts-wallets',
    title: 'Bags, Belts & Leather Goods',
    photo: 'photo-1553062407-98eeb64c6a62',
    industry: 'Leather and Accessories',
    subcategories: [
      'Full-Grain Leather Laptop Bags',
      'Polycarbonate Travel Trolleys',
      'Eco-Friendly Jute Tote Bags',
      'Handmade Leather Wallets',
      'Export Quality Men’s Belts',
    ],
  },
  {
    id: 'paper-paper-products',
    title: 'Paper & Paper Products',
    photo: 'photo-1586075010923-2dd4570fb338',
    industry: 'Paper and Printing',
    subcategories: [
      'Kraft Paper Rolls (120–250 GSM)',
      'POS Thermal Paper Rolls',
      'A4 75/80 GSM Copier Paper',
      'Duplex Packaging Boards',
      'Twisted Handle Paper Shopping Bags',
    ],
  },
  {
    id: 'marble-granite-stones',
    title: 'Marble, Granite & Natural Stones',
    photo: 'photo-1600585154340-be6161a56a0c',
    industry: 'Stone and Building Materials',
    subcategories: [
      'Black Galaxy Granite Slabs',
      'Pure White Makrana Marble',
      'Kandla Grey Sandstone Pavers',
      'Natural Slate Wall Cladding',
      'Engineered Quartz Countertops',
    ],
  },
  {
    id: 'food-beverages',
    title: 'Food & Beverages',
    photo: 'photo-1506377247377-2a5b3b417ebb',
    industry: 'Food and Beverages',
    subcategories: [
      'Darjeeling Orthodox Black Tea',
      'Monsooned Malabar Coffee Beans',
      'Dehydrated Onion & Garlic Flakes',
      'Alphonso Mango Canned Pulp',
      'Natural Cane Jaggery & Sugar',
    ],
  },
  {
    id: 'kitchen-utensils',
    title: 'Kitchen Utensils & Appliances',
    photo: 'photo-1556911220-e15b29be8c8f',
    industry: 'Home and Kitchen',
    subcategories: [
      'Tri-Ply Stainless Steel Cookware',
      'Heavy Duty Commercial Blenders',
      'Pre-Seasoned Cast Iron Skillets',
      'Commercial Induction Hobs',
      'Aluminum Pressure Cookers',
    ],
  },
  {
    id: 'textiles-yarn-fabrics',
    title: 'Textiles, Yarn & Fabrics',
    photo: 'photo-1606760227091-3dd870d97f1d',
    industry: 'Fashion and Textiles',
    subcategories: [
      '100% Combed Cotton Ring-Spun Yarn',
      'Woven Grey Cotton Fabric',
      'Printed Rayon & Viscose Fabric',
      'Raw Mulberry Silk Hanks',
      'Heavyweight Indigo Denim Fabric',
    ],
  },
  {
    id: 'industrial-supplies',
    title: 'Industrial Supplies & Hardware',
    photo: 'photo-1581092921461-eab62e97a780',
    industry: 'Industrial Machinery and Tools',
    subcategories: [
      'Rubber Conveyor Belting',
      'Industrial Heavy Caster Wheels',
      'Abrasive Cut-Off Discs',
      'Polyurethane Sealants & Silicones',
      'Alloy Steel Lifting Chain Slings',
    ],
  },
  {
    id: 'medical-healthcare',
    title: 'Medical, Healthcare & Diagnostics',
    photo: 'photo-1584515979956-d9f6e5d09982',
    industry: 'Medical and Laboratory',
    subcategories: [
      'Disposable Nitrile Examination Gloves',
      'Motorized ICU Hospital Beds',
      'Digital Ultrasound Scanners',
      'Titanium Orthopedic Bone Plates',
      'Sterile Hypodermic Syringes',
    ],
  },
];

const TRUST_PILLARS = [
  {
    id: 'iec-verified',
    badge: 'Verified Exporters Only',
    title: 'Verified IEC & Global Trade Track Record',
    icon: ShieldCheck,
    description:
      'Every seller is vetted with active DGFT Import Export Code (IEC), confirmed export customs filing history, and international packaging/palletization compliance.',
    color: 'emerald',
  },
  {
    id: 'authenticity',
    badge: 'Authenticity Assurance',
    title: 'TrustSEAL™ On-Site Physical Factory Audits',
    icon: Award,
    description:
      'Rigorous independent physical audits verifying machinery capacity, workforce, ISO 9001/14001 compliance, and export-grade quality control facilities.',
    color: 'amber',
  },
  {
    id: 'legal-compliance',
    badge: 'Legal Compliance',
    title: 'GST & Corporate Entity Authentication',
    icon: FileCheck2,
    description:
      '100% verified active GSTIN, official Registrar of Companies (ROC) incorporation records, MSME Udyam status, and PAN matching.',
    color: 'blue',
  },
  {
    id: 'export-escrow',
    badge: 'Export Authorization',
    title: 'TradeSphere Escrow & Container Protection',
    icon: Globe,
    description:
      'Protected cross-border payments with milestone escrow release upon bill of lading (B/L) verification, pre-shipment inspections, and global container tracking.',
    color: 'teal',
  },
];

const EXPORT_STATS = [
  { number: '500,000+', label: 'Verified Indian Exporters', icon: Building2 },
  { number: '100,000+', label: 'Export Categories & Catalogs', icon: PackageCheck },
  { number: '15,000+', label: 'Daily Export RFQs Handled', icon: Coins },
  { number: '150+', label: 'Destination Countries Served', icon: Ship },
  { number: '4.8 / 5', label: 'Global Importer Trust Score', icon: Star },
];

export default function Exporters() {
  useDocumentTitle('Connect with Verified Exporters | TradeSphere Export Gateway');
  const { companies } = useProducts();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Requirement Modal Form State
  const [rfqForm, setRfqForm] = useState({
    product: '',
    quantity: '100',
    unit: 'Units',
    destination: 'United States',
    port: 'Port of Los Angeles',
    incoterm: 'FOB',
    companyName: '',
    email: '',
    phone: '',
    notes: '',
  });

  const [submittedId, setSubmittedId] = useState(null);

  // Filter categories dynamically by search input if user types
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return EXPORT_CATEGORIES;
    const q = searchQuery.toLowerCase().trim();
    return EXPORT_CATEGORIES.filter(
      (cat) =>
        cat.title.toLowerCase().includes(q) ||
        cat.industry.toLowerCase().includes(q) ||
        cat.subcategories.some((s) => s.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // Verified Indian Exporters from database
  const indianExporters = useMemo(() => {
    const list = companies.filter(
      (c) => c.status !== 'Suspended' && (c.businessType === 'Exporter' || c.country === 'India')
    );
    return list.length > 0 ? list : companies.slice(0, 4);
  }, [companies]);

  const handleOpenRfqModal = (initialProduct = '') => {
    setRfqForm((prev) => ({
      ...prev,
      product: initialProduct || searchQuery || 'Basmati Rice & Spices',
    }));
    setSubmittedId(null);
    setIsModalOpen(true);
  };

  const handleRequirementSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      handleOpenRfqModal('General Sourcing Requirement');
      return;
    }
    handleOpenRfqModal(searchQuery.trim());
  };

  const handleModalSubmit = (e) => {
    e.preventDefault();
    const mockRefId = `TS-EXP-${Math.floor(100000 + Math.random() * 900000)}`;
    setSubmittedId(mockRefId);
    showToast(`Export RFQ #${mockRefId} submitted! Verified suppliers will be alerted.`, 'success');
  };

  return (
    <div className="bg-surface/50 min-h-screen pb-16">
      {/* Top Banner / Breadcrumbs bar */}
      <div className="border-b bg-white">
        <div className="ts-container py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <Breadcrumbs
              items={[{ label: 'Home', to: '/' }, { label: 'Verified Indian Exporters' }]}
            />
            <div className="hidden sm:flex items-center gap-3 text-muted">
              <span className="inline-flex items-center gap-1 font-medium text-emerald-800">
                <ShieldCheck className="size-3.5 text-emerald-600" /> IEC Validated
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-medium text-navy-800">
                <Award className="size-3.5 text-brand-600" /> TrustSEAL™ Audited
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-medium text-navy-800">
                <Globe className="size-3.5 text-blue-600" /> 150+ Export Corridors
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-surface/60 to-surface py-10 lg:py-14 border-b border-navy-900/[0.06]">
        {/* Subtle background ornamentation */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none opacity-40">
          <div className="absolute top-4 left-10 size-80 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="absolute top-8 right-10 size-96 rounded-full bg-navy-900/5 blur-3xl" />
        </div>

        <div className="ts-container relative z-10">
          {/* Top verified badge row (Matching image 1) */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-4 text-[11px] sm:text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800 ring-1 ring-emerald-600/20 shadow-xs">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              Verified Exporters Only
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-900 ring-1 ring-amber-600/20 shadow-xs">
              <Award className="size-3.5 text-amber-600" />
              TrustSEAL Certified Sellers
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-900 ring-1 ring-blue-600/20 shadow-xs">
              <FileCheck2 className="size-3.5 text-blue-600" />
              GST Verified
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-900 ring-1 ring-indigo-600/20 shadow-xs">
              <Globe className="size-3.5 text-indigo-600" />
              IEC Verified
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-900 text-white px-3 py-1 font-semibold shadow-xs">
              🇮🇳 Made in India · Exported Globally
            </span>
          </div>

          {/* Heading */}
          <div className="text-center max-w-3xl mx-auto mb-8">
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-navy-950">
              Connect with Verified Exporters
            </h1>
            <p className="mt-3 text-base sm:text-lg text-muted font-medium">
              Backed by India's Trusted B2B Global Trade & Export Sourcing Gateway
            </p>
          </div>

          {/* Search / Requirement Card (Matching IndiaMART requirement card in image 1) */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lift border border-navy-900/10 p-5 sm:p-6 transition-all hover:border-brand-500/50">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="font-display font-bold text-sm sm:text-base text-navy-900 flex items-center gap-2">
                  <Sparkles className="size-4 text-brand-600" /> Tell us what you Need
                </span>
                <span className="text-xs text-muted">Get fast quotes from verified manufacturers</span>
              </div>

              <form onSubmit={handleRequirementSubmit} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Enter Product / Service name (e.g. Basmati Rice, CNC Lathe, Cotton Shirts)..."
                      className="w-full h-11 pl-10 pr-3 rounded-xl border border-navy-900/15 bg-surface/30 text-sm focus:bg-white focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/10 transition-all"
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                        title="Clear search"
                      >
                        <X className="size-4" />
                      </button>
                    ) : null}
                  </div>
                  <Button
                    type="submit"
                    variant="navy"
                    size="md"
                    className="whitespace-nowrap px-6 shrink-0 font-bold"
                  >
                    Submit Requirement
                  </Button>
                </div>

                {/* Popular Quick Suggestions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted">
                  <span className="font-medium text-navy-800">Quick source:</span>
                  {[
                    'Basmati Rice',
                    'Vitrified Tiles',
                    'Industrial Pumps',
                    'Cotton Apparel',
                    'Solid Wood Furniture',
                    'Reactive Dyes',
                  ].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setSearchQuery(item);
                        handleOpenRfqModal(item);
                      }}
                      className="rounded-full bg-navy-50 hover:bg-navy-100 hover:text-navy-950 px-2.5 py-0.5 transition-colors font-medium text-[11px]"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Top Product Categories Grid Section (Matching Image 1) */}
      <section className="py-10 lg:py-14">
        <div className="ts-container">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full mb-2">
                <Ship className="size-3.5" /> High-Demand Export Sectors
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-navy-950">
                Top Product Categories from India
              </h2>
              <p className="mt-1 text-sm text-muted">
                Explore direct export factories, certified export houses, and bulk trade pricing across 24 core sectors.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenRfqModal('Multi-Category Sourcing')}
                className="font-semibold text-xs"
              >
                Post General RFQ
              </Button>
              <Button
                to="/suppliers?type=Exporter"
                variant="navy"
                size="sm"
                className="font-semibold text-xs"
              >
                All Exporters Directory →
              </Button>
            </div>
          </div>

          {/* If user filtered and found no matches */}
          {filteredCategories.length === 0 ? (
            <div className="ts-card p-12 text-center">
              <p className="font-bold text-navy-900 text-lg">No matching export categories found</p>
              <p className="text-sm text-muted mt-1">Try another search keyword or clear the search query.</p>
              <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="mt-4">
                View All 24 Categories
              </Button>
            </div>
          ) : (
            /* 3-Column / 4-Column Category Grid matching image 1 */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
              {filteredCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="group relative flex flex-col justify-between rounded-xl border border-navy-900/[0.08] bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/60 hover:shadow-card"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Category Thumbnail */}
                    <div className="relative size-16 sm:size-18 shrink-0 overflow-hidden rounded-lg border border-navy-900/10 bg-surface">
                      <img
                        src={photoUrl(cat.photo, 200, 200)}
                        alt={cat.title}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>

                    {/* Category Title & Subcategories List */}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-sm font-bold text-navy-950 group-hover:text-brand-700 transition-colors leading-tight">
                        <Link to={`/suppliers?industry=${encodeURIComponent(cat.industry)}`}>
                          {cat.title}
                        </Link>
                      </h3>

                      {/* Subcategory links (matching IndiaMART image 1 format) */}
                      <ul className="mt-2 space-y-1 text-xs text-muted">
                        {cat.subcategories.slice(0, 4).map((sub) => (
                          <li key={sub} className="truncate">
                            <button
                              type="button"
                              onClick={() => handleOpenRfqModal(sub)}
                              className="text-navy-700/80 hover:text-brand-700 hover:underline text-left inline-flex items-center gap-1 transition-colors"
                            >
                              <span className="size-1 rounded-full bg-navy-400 group-hover:bg-brand-500 shrink-0" />
                              <span className="truncate">{sub}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="mt-3.5 pt-2.5 border-t border-navy-900/[0.06] flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => handleOpenRfqModal(cat.title)}
                      className="font-semibold text-brand-700 hover:text-brand-800 transition-colors"
                    >
                      Get Quotes →
                    </button>
                    <Link
                      to={`/suppliers?industry=${encodeURIComponent(cat.industry)}`}
                      className="text-muted hover:text-navy-900 font-medium transition-colors"
                    >
                      View Exporters
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Verified Exporters Section */}
      <section className="py-10 bg-white border-y border-navy-900/[0.06]">
        <div className="ts-container">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full">
                Pre-Audited Suppliers
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-navy-950 mt-1">
                Featured Verified Indian Export Houses
              </h2>
            </div>
            <Link
              to="/suppliers?country=India"
              className="text-sm font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
            >
              Browse all 500,000+ Indian suppliers <ChevronRight className="size-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {indianExporters.map((company) => (
              <div
                key={company.id || company.name}
                className="ts-card p-4.5 flex flex-col justify-between hover:border-brand-500/50 hover:shadow-card transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-600/20">
                      <ShieldCheck className="size-3" /> IEC Verified
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-950">
                      <Star className="size-3.5 fill-amber-400 text-amber-500" />
                      {company.rating || 4.7}
                    </span>
                  </div>

                  <h3 className="font-display text-base font-bold text-navy-900 mt-2.5 line-clamp-1">
                    <Link to={`/suppliers/${company.slug}`} className="hover:text-brand-700">
                      {company.name}
                    </Link>
                  </h3>
                  <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                    <span>📍</span> {company.city}, {company.country}
                  </p>

                  <div className="mt-3 text-xs text-ink/80 line-clamp-2">
                    {company.description}
                  </div>

                  {company.mainProducts ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {company.mainProducts.slice(0, 3).map((prod) => (
                        <span
                          key={prod}
                          className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted font-medium"
                        >
                          {prod}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 pt-3 border-t flex items-center gap-2">
                  <Button
                    to={`/suppliers/${company.slug}`}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs !h-8 !min-h-8"
                  >
                    View Profile
                  </Button>
                  <Button
                    variant="navy"
                    size="sm"
                    onClick={() => handleOpenRfqModal(company.name)}
                    className="flex-1 text-xs !h-8 !min-h-8"
                  >
                    Contact
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Trust TradeSphere Export? (Matching Image 2) */}
      <section className="py-12 lg:py-16">
        <div className="ts-container">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-navy-950">
              Why Trust TradeSphere Export?
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted">
              TradeSphere Export is an international gateway built on India's most trusted B2B platform,
              connecting 500,000+ verified Indian suppliers to buyers across 150+ countries.
            </p>
          </div>

          {/* 4 Trust Pillars Cards matching Image 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TRUST_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.id}
                  className="rounded-2xl border border-navy-900/[0.08] bg-white p-6 shadow-xs flex flex-col justify-between hover:border-brand-500/60 transition-all hover:shadow-card text-center"
                >
                  <div>
                    {/* Badge / Seal Icon */}
                    <div className="mx-auto size-14 rounded-2xl bg-surface flex items-center justify-center text-navy-900 mb-4 ring-1 ring-navy-900/10">
                      <Icon className="size-7 text-brand-700" />
                    </div>

                    <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full mb-2">
                      {pillar.badge}
                    </span>

                    <h3 className="font-display text-base font-bold text-navy-950 leading-snug">
                      {pillar.title}
                    </h3>

                    <p className="mt-2.5 text-xs sm:text-[13px] text-muted leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action CTA Button matching Image 2 */}
          <div className="mt-8 text-center">
            <Button
              variant="navy"
              size="md"
              onClick={() => handleOpenRfqModal('Cross-Border Sourcing')}
              className="px-8 font-bold shadow-md hover:shadow-lg"
            >
              Post an Export RFQ Now
            </Button>
          </div>
        </div>
      </section>

      {/* TradeSphere Export by Numbers (Matching Image 2) */}
      <section className="py-12 bg-white border-y border-navy-900/[0.06]">
        <div className="ts-container">
          <div className="text-center max-w-xl mx-auto mb-8">
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-navy-950">
              TradeSphere Export by Numbers
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              Real transaction volumes, verified supplier bases, and international trade footprint.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {EXPORT_STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-xl border border-navy-900/10 bg-surface/40 p-4 text-center hover:bg-white hover:border-brand-500/50 hover:shadow-xs transition-all"
                >
                  <div className="mx-auto size-10 rounded-full bg-navy-900/5 flex items-center justify-center text-navy-800 mb-2">
                    <Icon className="size-5 text-brand-600" />
                  </div>
                  <div className="font-display text-xl sm:text-2xl font-black text-navy-950">
                    {stat.number}
                  </div>
                  <p className="text-xs text-muted mt-1 leading-snug">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About Us (Matching Image 2) */}
      <section className="py-12 lg:py-16">
        <div className="ts-container max-w-4xl">
          <div className="ts-card p-6 sm:p-8 lg:p-10">
            <h2 className="font-display text-2xl font-extrabold text-navy-950 mb-4">
              About TradeSphere Export
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-ink/85 leading-relaxed">
              <p>
                <strong>TradeSphere Export</strong> is India's dedicated export gateway, built as an extension of
                India's trusted B2B trade infrastructure. Our mission is to connect international buyers with vetted,
                export-ready Indian manufacturers across hundreds of industrial, textile, chemical, and agricultural
                categories.
              </p>
              <p>
                As an extension of India's export powerhouse, TradeSphere simplifies cross-border trade by removing the
                opacity of traditional brokerages. Global buyers get complete visibility into exporter certifications,
                production capacity, factory verification status, and port-level shipping terms. Every transaction is backed
                by optional TradeSphere Escrow, which holds buyer funds securely until pre-shipment inspection is cleared
                and the bill of lading is verified.
              </p>
              <p className="text-xs sm:text-sm text-muted border-t pt-4">
                Whether you are an overseas wholesaler importing full container loads (FCL), an e-commerce brand
                requiring private-label contract manufacturing (OEM/ODM), or a project contractor procuring building
                materials, TradeSphere Export ensures end-to-end reliability from factory floor to seaport.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                variant="navy"
                size="sm"
                onClick={() => handleOpenRfqModal('Enterprise Export Requirement')}
              >
                Submit Enterprise Requirement
              </Button>
              <Button to="/info/buyer-protection" variant="outline" size="sm">
                Buyer Protection Guide
              </Button>
              <Button to="/suppliers" variant="ghost" size="sm">
                Explore All Suppliers →
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Assistance Banner */}
      <div className="border-t border-navy-900/[0.08] bg-surface/70 py-4 text-navy-950">
        <div className="ts-container flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-navy-950">We are here to help you!</span>
            <span className="hidden md:inline text-muted">
              Need personalized sourcing assistance for full container loads or custom OEM?
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              to="/info/contact"
              variant="outline"
              size="sm"
              className="!h-8 !min-h-8 text-xs font-semibold"
            >
              Contact Support
            </Button>
            <Button
              variant="navy"
              size="sm"
              onClick={() => handleOpenRfqModal('Need Export Specialist Advice')}
              className="!h-8 !min-h-8 text-xs font-bold"
            >
              Talk to Export Specialist
            </Button>
          </div>
        </div>
      </div>

      {/* Interactive Requirement Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={submittedId ? 'Requirement Submitted Successfully' : 'Post an Export Requirement'}
        description={
          submittedId
            ? 'Your inquiry is now live on TradeSphere Verified Exporters network.'
            : 'Verified Indian exporters will review your specification and send competitive CIF/FOB quotes.'
        }
        size="lg"
      >
        {submittedId ? (
          <div className="text-center py-6">
            <div className="mx-auto size-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="size-10" />
            </div>
            <h3 className="font-display text-xl font-bold text-navy-900">
              Inquiry Reference: {submittedId}
            </h3>
            <p className="mt-2 text-sm text-muted max-w-md mx-auto">
              Our export matching engine has routed your request for{' '}
              <strong>"{rfqForm.product}"</strong> to audited Indian manufacturers with active DGFT IEC credentials.
            </p>
            <div className="mt-6 rounded-xl bg-surface p-4 text-xs text-left max-w-md mx-auto space-y-1.5 border">
              <div>
                <strong>Destination:</strong> {rfqForm.destination} ({rfqForm.port})
              </div>
              <div>
                <strong>Quantity:</strong> {rfqForm.quantity} {rfqForm.unit} ({rfqForm.incoterm})
              </div>
              <div>
                <strong>Estimated Quotation Turnaround:</strong> Within 2 to 4 hours
              </div>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="navy" size="sm" onClick={() => setIsModalOpen(false)}>
                Done
              </Button>
              <Button
                variant="outline"
                size="sm"
                to="/buyer/quotes"
                onClick={() => setIsModalOpen(false)}
              >
                View in Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleModalSubmit} className="space-y-4 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-navy-900 mb-1">
                  Product / Commodity Required *
                </label>
                <input
                  type="text"
                  required
                  value={rfqForm.product}
                  onChange={(e) => setRfqForm({ ...rfqForm, product: e.target.value })}
                  placeholder="e.g. Basmati Rice, CNC Lathe, Vitrified Tiles"
                  className="w-full h-9.5 px-3 rounded-lg border text-sm focus:border-navy-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-navy-900 mb-1">Quantity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={rfqForm.quantity}
                    onChange={(e) => setRfqForm({ ...rfqForm, quantity: e.target.value })}
                    className="w-full h-9.5 px-3 rounded-lg border text-sm focus:border-navy-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-navy-900 mb-1">Unit</label>
                  <select
                    value={rfqForm.unit}
                    onChange={(e) => setRfqForm({ ...rfqForm, unit: e.target.value })}
                    className="w-full h-9.5 px-2 rounded-lg border text-sm bg-white focus:border-navy-900 focus:outline-none"
                  >
                    <option value="Units">Units (Pieces)</option>
                    <option value="Metric Tons">Metric Tons</option>
                    <option value="Kilograms">Kilograms (KG)</option>
                    <option value="Square Meters">SQM (Tiles/Stone)</option>
                    <option value="20ft Containers">20ft Container (FCL)</option>
                    <option value="40ft Containers">40ft Container (FCL)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-navy-900 mb-1">Destination Country *</label>
                <select
                  value={rfqForm.destination}
                  onChange={(e) => setRfqForm({ ...rfqForm, destination: e.target.value })}
                  className="w-full h-9.5 px-2 rounded-lg border text-sm bg-white focus:border-navy-900 focus:outline-none"
                >
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="United Arab Emirates">United Arab Emirates</option>
                  <option value="Germany">Germany</option>
                  <option value="Australia">Australia</option>
                  <option value="Saudi Arabia">Saudi Arabia</option>
                  <option value="Canada">Canada</option>
                  <option value="Singapore">Singapore</option>
                  <option value="Other">Other Country</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-900 mb-1">Discharge Port</label>
                <input
                  type="text"
                  value={rfqForm.port}
                  onChange={(e) => setRfqForm({ ...rfqForm, port: e.target.value })}
                  placeholder="e.g. Jebel Ali, Rotterdam, Long Beach"
                  className="w-full h-9.5 px-3 rounded-lg border text-sm focus:border-navy-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-900 mb-1">Incoterms</label>
                <select
                  value={rfqForm.incoterm}
                  onChange={(e) => setRfqForm({ ...rfqForm, incoterm: e.target.value })}
                  className="w-full h-9.5 px-2 rounded-lg border text-sm bg-white focus:border-navy-900 focus:outline-none"
                >
                  <option value="FOB">FOB (Free on Board)</option>
                  <option value="CIF">CIF (Cost, Insurance & Freight)</option>
                  <option value="EXW">EXW (Ex Works)</option>
                  <option value="CFR">CFR (Cost & Freight)</option>
                  <option value="DDP">DDP (Delivered Duty Paid)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-navy-900 mb-1">Company / Importer Name *</label>
                <input
                  type="text"
                  required
                  value={rfqForm.companyName}
                  onChange={(e) => setRfqForm({ ...rfqForm, companyName: e.target.value })}
                  placeholder="e.g. Apex Global Trade LLC"
                  className="w-full h-9.5 px-3 rounded-lg border text-sm focus:border-navy-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-navy-900 mb-1">Business Email *</label>
                <input
                  type="email"
                  required
                  value={rfqForm.email}
                  onChange={(e) => setRfqForm({ ...rfqForm, email: e.target.value })}
                  placeholder="purchasing@company.com"
                  className="w-full h-9.5 px-3 rounded-lg border text-sm focus:border-navy-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-navy-900 mb-1">Phone / WhatsApp</label>
                <input
                  type="tel"
                  value={rfqForm.phone}
                  onChange={(e) => setRfqForm({ ...rfqForm, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="w-full h-9.5 px-3 rounded-lg border text-sm focus:border-navy-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">
                Detailed Specifications & Requirements
              </label>
              <textarea
                rows="2.5"
                value={rfqForm.notes}
                onChange={(e) => setRfqForm({ ...rfqForm, notes: e.target.value })}
                placeholder="Specify dimensions, packaging standards, grade, certification requirements (ISO, CE, FDA, Halal), or target pricing..."
                className="w-full p-2.5 rounded-lg border text-sm focus:border-navy-900 focus:outline-none"
              />
            </div>

            <div className="rounded-lg bg-surface/70 p-3 text-xs text-muted flex items-start gap-2 border">
              <ShieldCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>TradeSphere Escrow Protected:</strong> You are not charged anything to receive quotes. Once
                you approve a quotation, funds remain protected until pre-shipment inspection and bill of lading release.
              </span>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="navy" size="sm" type="submit" className="font-bold px-6">
                Broadcast to Verified Exporters
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
