// All navigation lives here so the header, mobile menu, footer and dashboards stay in sync.

export const mainNav = [
  { label: 'Products', to: '/products' },
  { label: 'Categories', to: '/categories', megaMenu: true },
  { label: 'Suppliers', to: '/suppliers' },
  { label: 'Compare Products', to: '/compare-products' },
  // Buyers and guests only (hidden for suppliers and admins in the header and mobile menu)
  { label: 'Request a Quote', to: '/rfq', buyerOnly: true },
  { label: 'Wishlist', to: '/wishlist' },
  { label: 'Help', to: '/help' },
  { label: 'About Us', to: '/info/about' },
  { label: 'Become a Supplier', to: '/register?role=supplier', highlight: true },
];

// Secondary shortcuts shown in the mobile menu and footer.
export const quickLinks = [
  { label: 'Help Center', to: '/help' },
  { label: 'Suppliers', to: '/suppliers' },
  { label: 'Request for Quotation (RFQ)', to: '/rfq' },
  { label: 'Ready to Ship', to: '/products?ready=1' },
  { label: 'Wholesale Deals', to: '/products?deal=1' },
  { label: 'Buyer Protection Guide', to: '/info/buyer-protection' },
];

export const footerColumns = [
  {
    title: 'About TradeExpress',
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
      { label: 'Products', to: '/products' },
      { label: 'All categories', to: '/categories' },
      { label: 'Suppliers', to: '/suppliers' },
      { label: 'Request for quotation (RFQ)', to: '/rfq' },
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
      { label: 'Supplier dashboard', to: '/supplier/dashboard' },
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
    { label: 'Dashboard', to: '/buyer', icon: 'LayoutDashboard' },
    { label: 'My Orders', to: '/buyer/orders', icon: 'Package' },
    { label: 'Payments & Invoices', to: '/buyer/payments', icon: 'Receipt' },
    { label: 'Saved Products', to: '/buyer/wishlist', icon: 'Heart' },
    { label: 'Messages', to: '/buyer/messages', icon: 'MessageSquare' },
    { label: 'My Quotes', to: '/buyer/quotes', icon: 'ClipboardList' },
    { label: 'TradeExpress ID & Certificates', to: '/buyer/documents', icon: 'FileBadge2' },
    { label: 'My Business Profile', to: '/buyer/account-settings', icon: 'Building2' },
  ],
  supplier: [
    { label: 'Overview', to: '/supplier/dashboard', icon: 'LayoutDashboard' },
    { label: 'My Products', to: '/supplier/products', icon: 'Boxes' },
    { label: 'Inventory Management', to: '/supplier/inventory', icon: 'Warehouse' },
    { label: 'Buyer Inquiries/RFQs', to: '/supplier/inquiries', icon: 'FileText' },
    { label: 'Orders', to: '/supplier/orders', icon: 'Package' },
    { label: 'Transport & Delivery Management', to: '/supplier/transport', icon: 'Truck' },
    { label: 'Payments & Earnings', to: '/supplier/payments', icon: 'CircleDollarSign' },
    { label: 'Verification Center', to: '/supplier/verification', icon: 'ShieldCheck' },
    { label: 'Business Profile', to: '/supplier/profile', icon: 'Building2' },
    { label: 'Notifications', to: '/supplier/notifications', icon: 'Bell' },
    { label: 'Analytics', to: '/supplier/analytics', icon: 'ChartColumn' },
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
