// Ten sample supplier companies used to populate the catalogue. Their details are illustrative.
// Names, contacts, figures, reviews and "certificates" are invented sample data.
// No company here is real, verified or endorsed, and nothing sent to them leaves this browser.

import { daysAgo } from '../utils/formatDate.js';

const rows = [
  {
    name: 'Shenzhen NovaTech Electronics', city: 'Shenzhen', country: 'China', flag: '🇨🇳', industry: 'Consumer Electronics', businessType: 'Manufacturer',
    established: 2012, employees: '201–500', color: '#1D4ED8', responseTime: 'Within 6 hours', rating: 4.7,
    description: 'NovaTech designs and assembles audio devices, wearables and mobile accessories for brands that want OEM or ODM production. The team runs four SMT lines and an in-house acoustics lab, and supports custom firmware, packaging and logo printing.',
    mainProducts: ['Wireless headphones', 'Earbuds', 'Bluetooth speakers', 'Smart watches', 'Power banks'],
    moqInfo: 'From 100 pieces per model. Mixed colours allowed in one order.',
    contact: { person: 'Lin Wei (Sales Manager)', email: 'sales@novatech.example', phone: '+86 000 0000 0001', address: 'Sample Industrial Park, Bao’an District, Shenzhen (illustrative address)' },
    cover: 'photo-1498049794561-7780e7231661', gallery: ['photo-1505740420928-5e560c06d30e', 'photo-1589003077984-894e133dabab', 'photo-1579586337278-3befd40fd17a'],
  },
  {
    name: 'Pearl River Garments Co.', city: 'Guangzhou', country: 'China', flag: '🇨🇳', industry: 'Fashion and Textiles', businessType: 'Manufacturer',
    established: 2008, employees: '501–1000', color: '#BE185D', responseTime: 'Within 12 hours', rating: 4.5,
    description: 'Pearl River Garments is a cut-and-sew factory producing T-shirts, hoodies and outerwear for private-label buyers. Services include pattern making, fabric sourcing, screen and DTG printing, embroidery and retail-ready packing.',
    mainProducts: ['Blank T-shirts', 'Hoodies', 'Denim jackets', 'Blazers'],
    moqInfo: 'From 150 pieces per style and colour. Size ratios on request.',
    contact: { person: 'Chen Yu (Export Sales)', email: 'export@pearlrivergarments.example', phone: '+86 000 0000 0002', address: 'Sample Garment Zone, Panyu District, Guangzhou (illustrative address)' },
    cover: 'photo-1567401893414-76b7b1e5a7a5', gallery: ['photo-1620799139652-715e4d5b232d', 'photo-1556821840-3a63f95609a7', 'photo-1611312449408-fcece27cdbb7'],
  },
  {
    name: 'Jaipur Craft & Home Exports', city: 'Jaipur', country: 'India', flag: '🇮🇳', industry: 'Home Decor and Handicrafts', businessType: 'Exporter',
    established: 2010, employees: '51–200', color: '#B45309', responseTime: 'Within 8 hours', rating: 4.6,
    description: 'Jaipur Craft & Home works with artisan workshops across Rajasthan to export ceramics, tableware, candles and wooden décor. Each order is consolidated, quality-checked and export-packed at the company’s Jaipur warehouse.',
    mainProducts: ['Ceramic vases', 'Stoneware dinnerware', 'Soy candles', 'Wall clocks', 'Wooden toys'],
    moqInfo: 'From 50 sets or 100 pieces. Assorted designs can be combined.',
    contact: { person: 'Meera Rathore (Exports)', email: 'hello@jaipurcraft.example', phone: '+91 00000 00003', address: 'Sample Export Park, Sitapura, Jaipur (illustrative address)' },
    cover: 'photo-1597696929736-6d13bed8e6a8', gallery: ['photo-1612196808214-b8e1d6145a8c', 'photo-1551807306-4bcd16b92a41', 'photo-1643122966676-29e8597257f7'],
  },
  {
    name: 'Mumbai Industrial Solutions', city: 'Mumbai', country: 'India', flag: '🇮🇳', industry: 'Industrial Machinery and Tools', businessType: 'Manufacturer',
    established: 2004, employees: '201–500', color: '#334155', responseTime: 'Within 24 hours', rating: 4.4,
    description: 'Mumbai Industrial Solutions builds power tools, workshop machinery, garage equipment and safety gear for contractors and distributors. The plant covers casting, machining, assembly and load testing under one roof.',
    mainProducts: ['Cordless drills', 'CNC engraving machines', 'Hydraulic jacks', 'Sprayers', 'Safety helmets', 'Wrench sets'],
    moqInfo: 'Machines from 1 unit. Tools and safety gear from 50 pieces.',
    contact: { person: 'Arjun Desai (Business Development)', email: 'enquiry@mumbaiindustrial.example', phone: '+91 00000 00004', address: 'Sample MIDC Estate, Navi Mumbai (illustrative address)' },
    cover: 'photo-1566930665082-4ae9dbbb5b6b', coverIllustration: 'cover-default', gallery: ['photo-1562237553-36ad661d6f2c', 'photo-1613206485381-b028e578e791', 'photo-1581092921461-eab62e97a780'],
  },
  {
    name: 'Seoul BeautySource Trading', city: 'Seoul', country: 'South Korea', flag: '🇰🇷', industry: 'Beauty and Personal Care', businessType: 'Trading Company',
    established: 2015, employees: '11–50', color: '#DB2777', responseTime: 'Within 4 hours', rating: 4.8,
    description: 'Seoul BeautySource sources skincare, makeup and beauty tools from partner laboratories in Korea and manages formulation choice, private-label artwork and export documents for small and mid-size brands.',
    mainProducts: ['Serums', 'Gel creams', 'Lipsticks', 'Makeup brushes', 'Sunscreen'],
    moqInfo: 'From 300 pieces per SKU. Private label from 1,000 pieces.',
    contact: { person: 'Kim Ji-ho (Account Manager)', email: 'partners@beautysource.example', phone: '+82 00 0000 0005', address: 'Sample Tower, Gangnam-gu, Seoul (illustrative address)' },
    cover: 'photo-1522335789203-aabd1fc54bc9', gallery: ['photo-1723951174326-2a97221d3b7f', 'photo-1620464003286-a5b0d79f32c2', 'photo-1586495777744-4413f21062fa'],
  },
  {
    name: 'Ho Chi Minh Packaging Works', city: 'Ho Chi Minh City', country: 'Vietnam', flag: '🇻🇳', industry: 'Packaging and Supplies', businessType: 'Manufacturer',
    established: 2011, employees: '201–500', color: '#0F766E', responseTime: 'Within 10 hours', rating: 4.5,
    description: 'Ho Chi Minh Packaging Works produces paper bags, glass containers, cosmetic bottles and corrugated cartons with custom sizes and printing. Sampling takes around a week and artwork support is included.',
    mainProducts: ['Kraft paper bags', 'Glass jars', 'Glass bottles', 'Dropper bottles', 'Shipping cartons'],
    moqInfo: 'From 2,000 pieces. Custom print from 5,000 pieces.',
    contact: { person: 'Tran Minh (Sales)', email: 'sales@hcmpackaging.example', phone: '+84 000 000 0006', address: 'Sample Industrial Zone, Binh Tan, Ho Chi Minh City (illustrative address)' },
    cover: 'photo-1513884923967-4b182ef167ab', gallery: ['photo-1572726729207-a78d6feb18d7', 'photo-1601066551508-6d9cb1b9de65', 'photo-1608571423902-eed4a5ad8108'],
  },
  {
    name: 'Istanbul Leather & Fashion', city: 'Istanbul', country: 'Türkiye', flag: '🇹🇷', industry: 'Bags and Fashion Accessories', businessType: 'Manufacturer',
    established: 2006, employees: '51–200', color: '#7C2D12', responseTime: 'Within 8 hours', rating: 4.6,
    description: 'Istanbul Leather & Fashion crafts full-grain leather bags, wallets and belts in a family-run atelier. Buyers can choose leather, lining, hardware and embossing, and approve a pre-production sample before the run.',
    mainProducts: ['Leather totes', 'Wallets', 'Belts', 'Briefcases'],
    moqInfo: 'From 30 pieces for bags and 200 pieces for small leather goods.',
    contact: { person: 'Elif Kaya (Export Manager)', email: 'export@istanbulleather.example', phone: '+90 000 000 0007', address: 'Sample Leather District, Zeytinburnu, Istanbul (illustrative address)' },
    cover: 'photo-1511556820780-d912e42b4980', gallery: ['photo-1624687943971-e86af76d57de', 'photo-1601592996763-f05c9c80a7f1', 'photo-1473188588951-666fce8e7c68'],
  },
  {
    name: 'Dhaka Cotton Industries', city: 'Dhaka', country: 'Bangladesh', flag: '🇧🇩', industry: 'Garments and Fabrics', businessType: 'Manufacturer',
    established: 2001, employees: '1000+', color: '#15803D', responseTime: 'Within 12 hours', rating: 4.3,
    description: 'Dhaka Cotton Industries is a vertically integrated mill and garment maker covering knitting, dyeing and sewing. It produces knitwear, woven shirts, denim and bed linen in large volumes for retail programmes.',
    mainProducts: ['Sweaters', 'Woven shirts', 'Denim jeans', 'Bed linen'],
    moqInfo: 'From 300 pieces per style. Lower minimums for stock fabrics.',
    contact: { person: 'Farhan Ahmed (Merchandiser)', email: 'merch@dhakacotton.example', phone: '+880 0000 000008', address: 'Sample Export Processing Zone, Savar, Dhaka (illustrative address)' },
    cover: 'photo-1643015862949-5c8d15a4242e', gallery: ['photo-1631541909061-71e349d1f203', 'photo-1713881587420-113c1c43e28a', 'photo-1624378439575-d8705ad7ae80'],
  },
  {
    name: 'Milan Living & Furniture', city: 'Milan', country: 'Italy', flag: '🇮🇹', industry: 'Furniture and Interiors', businessType: 'Manufacturer',
    established: 1998, employees: '51–200', color: '#4338CA', responseTime: 'Within 24 hours', rating: 4.7,
    description: 'Milan Living & Furniture designs and builds upholstered seating, office chairs and lighting for hospitality projects and retailers. Frames, fabrics and finishes can be specified per project.',
    mainProducts: ['Fabric sofas', 'Leather sofas', 'Armchairs', 'Office chairs', 'Floor lamps'],
    moqInfo: 'Sofas from 2 pieces. Chairs and lighting from 10 pieces.',
    contact: { person: 'Giulia Moretti (Contract Sales)', email: 'contract@milanliving.example', phone: '+39 000 000 0009', address: 'Sample Design District, Brianza, Milan (illustrative address)' },
    cover: 'photo-1600210492493-0946911123ea', gallery: ['photo-1555041469-a586c61ea9bc', 'photo-1586023492125-27b2c045efd7', 'photo-1494438639946-1ebd1d20bf85'],
  },
  {
    name: 'Austin GreenSupply Co.', city: 'Austin', country: 'USA', flag: '🇺🇸', industry: 'Sustainable Products', businessType: 'Wholesaler',
    established: 2017, employees: '11–50', color: '#166534', responseTime: 'Within 6 hours', rating: 4.6,
    description: 'Austin GreenSupply wholesales lower-impact everyday goods: soy candles, organic cotton bedding, refillable glass, recycled-material outdoor gear and gardening supplies. Orders ship from its Texas warehouse.',
    mainProducts: ['Soy candles', 'Organic cotton bedding', 'Refillable bottles', 'Trail shoes', 'Backpacks', 'Seed trays'],
    moqInfo: 'From 100 pieces. Mixed cartons available for stocked lines.',
    contact: { person: 'Maya Torres (Wholesale)', email: 'wholesale@greensupply.example', phone: '+1 000 000 0010', address: 'Sample Commerce Park, East Austin, Texas (illustrative address)' },
    cover: 'photo-1748543669178-efd3de4e64e0', gallery: ['photo-1612293905607-b003de9e54fb', 'photo-1562183241-b937e95585b6', 'photo-1509762774605-f07235a08f1f'],
  },
];

const REVIEWERS = ['Procurement lead, retail chain', 'Founder, online brand', 'Sourcing manager, distributor', 'Buyer, hospitality group', 'Owner, boutique store'];
const REVIEW_TEXT = [
  'Samples matched the bulk order closely and the team kept us updated at every stage.',
  'Clear quotation, fair pricing at volume, and the packing was better than we expected.',
  'Lead time slipped by a few days, but communication was honest and the quality was good.',
  'Flexible on minimum quantities for our first order and quick to answer technical questions.',
  'Custom branding was handled carefully. We have already placed a repeat order.',
];

const slug = (name) => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const initials = (name) => name.split(/\s+/).filter((word) => /^[A-Za-z]/.test(word)).slice(0, 2).map((word) => word[0]).join('').toUpperCase();

const companies = rows.map((row, index) => {
  const number = index + 1;
  return {
    id: `TS-CO-${String(number).padStart(3, '0')}`,
    slug: slug(row.name),
    initials: initials(row.name),
    status: 'Active',
    isSample: true,
    coverIllustration: 'cover-default',
    ...row,
    reviewCount: 18 + number * 7,
    // Verification starts as "not submitted". Two sample companies have documents waiting
    // for review so the admin review screen has something to show. None is pre-approved.
    verification: number === 4 || number === 9
      ? { status: 'under-review', submittedAt: daysAgo(number), reviewedAt: null, note: '', documents: [
        { id: `TS-DOC-${number}-1`, type: 'Business registration certificate', reference: `REG-${1000 + number}`, fileName: `registration-${number}.pdf`, submittedAt: daysAgo(number) },
        { id: `TS-DOC-${number}-2`, type: 'Tax registration (GST / VAT)', reference: `TAX-${2000 + number}`, fileName: `tax-${number}.pdf`, submittedAt: daysAgo(number) },
      ] }
      : { status: 'not-submitted', submittedAt: null, reviewedAt: null, note: '', documents: [] },
    // Illustrative examples only: these are not real certificates.
    certificates: ['Quality management system (example)', 'Social compliance audit (example)', 'Product safety test report (example)'].slice(0, 2 + (number % 2)),
    reviews: [0, 1, 2].map((offset) => ({
      id: `TS-CO-${number}-R${offset + 1}`,
      author: REVIEWERS[(index + offset) % REVIEWERS.length],
      rating: [5, 4, 5][(index + offset) % 3],
      text: REVIEW_TEXT[(index * 2 + offset) % REVIEW_TEXT.length],
      date: daysAgo(12 + offset * 19 + index * 3),
    })),
  };
});

export default companies;
