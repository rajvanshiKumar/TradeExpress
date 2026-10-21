// All navigation lives here so the header, mobile menu, footer and dashboards stay in sync.

export const mainNav = [
  { label: 'Explore Products', to: '/products' },
  { label: 'Categories', to: '/categories', megaMenu: true },
  { label: 'Find Suppliers', to: '/suppliers' },
  { label: 'Exporters', to: '/exporters' },
  { label: 'Request For Quotation', to: '/rfq' },
  { label: 'Help', to: '/help' },
  { label: 'About Us', to: '/info/about' },
  { label: 'Become a Supplier', to: '/register?role=supplier', highlight: true },
];

// Secondary shortcuts shown in the mobile menu and footer.
export const quickLinks = [
  { label: 'Help Center', to: '/help' },
  { label: 'Verified Exporters', to: '/exporters' },
  { label: 'Find Suppliers', to: '/suppliers' },
  { label: 'Request for Quotation (RFQ)', to: '/rfq' },
  { label: 'Smart Quote Comparison', to: '/buyer/quotes/compare' },
  { label: 'Ready to Ship', to: '/products?ready=1' },
  { label: 'Wholesale Deals', to: '/products?deal=1' },
  { label: 'Buyer Protection Guide', to: '/info/buyer-protection' },
];

export const footerColumns = [
  {
    title: 'About TradeSphere',
    links: [
      { label: 'About us', to: '/info/about' },
      { label: 'How it works', to: '/info/about#how-it-works' },
      { label: 'Help Center', to: '/help' },
      { label: 'Contact', to: '/info/contact' },
    ],
  },
  {
    title: 'For buyers',
    links: [
      { label: 'Explore products', to: '/products' },
      { label: 'All categories', to: '/categories' },
      { label: 'Find verified suppliers', to: '/suppliers' },
      { label: 'Verified Indian exporters', to: '/exporters' },
      { label: 'Request for quotation (RFQ)', to: '/rfq' },
      { label: 'Smart quote comparison', to: '/buyer/quotes/compare' },
      { label: 'Ready to ship', to: '/products?ready=1' },
      { label: 'Buyer protection guide', to: '/info/buyer-protection' },
      { label: 'Buyer dashboard', to: '/buyer' },
    ],
  },
  {
    title: 'For suppliers',
    links: [
      { label: 'Become a supplier', to: '/register?role=supplier' },
      { label: 'Supplier directory', to: '/suppliers' },
      { label: 'Supplier dashboard', to: '/supplier' },
      { label: 'Verification status', to: '/supplier/verification' },
    ],
  },
  {
    title: 'Policies',
    links: [
      { label: 'Terms of use', to: '/info/terms' },
      { label: 'Privacy', to: '/info/privacy' },
      { label: 'Buyer protection guide', to: '/info/buyer-protection' },
      { label: 'Admin sign in', to: '/admin/login' },
    ],
  },
];

export const dashboardNav = {
  buyer: [
    { label: 'Overview', to: '/buyer', icon: 'LayoutDashboard' },
    { label: 'Orders', to: '/buyer/orders', icon: 'Package' },
    { label: 'Quotes', to: '/buyer/quotes', icon: 'FileText' },
    { label: 'Compare Quotes', to: '/buyer/quotes/compare', icon: 'Scale' },
    { label: 'Messages', to: '/messages', icon: 'MessageSquare' },
    { label: 'Saved items', to: '/buyer/wishlist', icon: 'Heart' },
    { label: 'Address book', to: '/buyer/addresses', icon: 'MapPin' },
    { label: 'Profile & settings', to: '/buyer/profile', icon: 'Settings' },
  ],
  supplier: [
    { label: 'Overview', to: '/supplier', icon: 'LayoutDashboard' },
    { label: 'Products & inventory', to: '/supplier/products', icon: 'Boxes' },
    { label: 'Orders', to: '/supplier/orders', icon: 'Package' },
    { label: 'Inquiries', to: '/supplier/inquiries', icon: 'FileText' },
    { label: 'Messages', to: '/messages', icon: 'MessageSquare' },
    { label: 'Analytics', to: '/supplier/analytics', icon: 'ChartColumn' },
    { label: 'Verification', to: '/supplier/verification', icon: 'ShieldCheck' },
    { label: 'Company settings', to: '/supplier/settings', icon: 'Settings' },
  ],
  admin: [
    { label: 'Overview', to: '/admin', icon: 'LayoutDashboard' },
    { label: 'Products', to: '/admin/products', icon: 'Boxes' },
    { label: 'Companies', to: '/admin/companies', icon: 'Building2' },
    { label: 'Verification review', to: '/admin/verification', icon: 'ShieldCheck' },
    { label: 'Users', to: '/admin/users', icon: 'Users' },
    { label: 'Categories', to: '/admin/categories', icon: 'LayoutGrid' },
    { label: 'Reports', to: '/admin/reports', icon: 'ChartColumn' },
  ],
};
