// TradeExpress Help Center content (Phase 1: static, versioned with the code).
//
// Every statement here describes behaviour that exists in the TradeExpress code. Do not add timelines,
// guarantees, phone numbers or features that the platform does not provide. The shape mirrors the planned
// HelpArticle / HelpCategory tables so the content can later move into the database unchanged.
//
// Article body blocks: a string is a paragraph; { steps: [...] } is a numbered list; { list: [...] } is a
// bulleted list; { note: '...' } is a highlighted tip.

export const HELP_CONTENT_UPDATED = '2026-11-02';

/** Who an article is written for. 'all' articles appear for both buyers and suppliers. */
export const HELP_AUDIENCES = [
  { id: 'all', label: 'Everyone' },
  { id: 'buyer', label: 'Buyers' },
  { id: 'supplier', label: 'Suppliers' },
];

/** `icon` is a key resolved to a Lucide icon by the Help Center UI. */
export const HELP_CATEGORIES = [
  { id: 'getting-started', title: 'Getting Started', icon: 'rocket', description: 'Create your account, verify your email and mobile, and sign in.' },
  { id: 'buying-sourcing', title: 'Buying & Sourcing', icon: 'search', description: 'Find wholesale products, read MOQ and price tiers, and compare offers.' },
  { id: 'supplier-management', title: 'Supplier Management', icon: 'store', description: 'Supplier signup, business verification, listings and inventory.' },
  { id: 'rfq-negotiation', title: 'RFQ & Negotiations', icon: 'messages', description: 'Post RFQs, compare quotations and negotiate up to three rounds.' },
  { id: 'orders-logistics', title: 'Orders & Logistics', icon: 'truck', description: 'Place, cancel, fulfil and track wholesale orders.' },
  { id: 'payments-escrow', title: 'Payments & Escrow', icon: 'wallet', description: 'Payment options, advance payments, escrow, invoices and payouts.' },
  { id: 'returns-disputes', title: 'Returns & Disputes', icon: 'scale', description: 'Raise a trade dispute, submit evidence and understand outcomes.' },
  { id: 'account-security', title: 'Account Security', icon: 'shield', description: 'Keep your account, OTPs and password safe.' },
];

const ARTICLE_SOURCE = [
  // ── Getting Started ────────────────────────────────────────────────────────
  {
    slug: 'create-buyer-account',
    category: 'getting-started',
    audience: 'buyer',
    title: 'How to create a buyer account',
    summary: 'Register as a buyer with a verified email address, mobile number and PAN–Aadhaar check.',
    body: [
      'Buyer registration takes a few minutes and verifies your contact details before your account is created.',
      { steps: [
        'Open the buyer registration page and enter your name and business email address.',
        'Request an email verification code and enter the 6-digit code sent to your inbox.',
        'Enter your mobile number, request an OTP and enter the 6-digit code sent by SMS.',
        'Create a password that meets the password rules shown on the form.',
        'Complete the PAN–Aadhaar link verification with your PAN and Aadhaar number and give your consent.',
        'Submit the form. You are signed in and taken to your buyer dashboard.',
      ] },
      { note: 'You can also use “Continue with Google”. A new buyer account is created automatically with your Google email address, which Google has already verified.' },
    ],
    keywords: ['register', 'signup', 'sign up', 'new account', 'buyer registration', 'join'],
    related: ['mobile-and-email-otp', 'continue-with-google', 'pan-aadhaar-verification'],
    action: { to: '/buyer/register', label: 'Register as a buyer' },
  },
  {
    slug: 'mobile-and-email-otp',
    category: 'getting-started',
    audience: 'all',
    title: 'Verifying your mobile number and email with OTP',
    summary: 'How one-time passwords work during signup and sign-in, and what to do if a code does not arrive.',
    body: [
      'TradeExpress sends a 6-digit one-time password (OTP) to confirm that you own an email address or mobile number. Codes are valid for 10 minutes.',
      { list: [
        'After requesting a code, wait for the on-screen countdown before asking for a new one.',
        'There is a limit on how many codes can be requested in an hour for the same email or number.',
        'Too many incorrect attempts cancel the code; request a new one and try again.',
        'If an email code does not arrive, check your spam or promotions folder.',
      ] },
      { note: 'Never share an OTP with anyone. TradeExpress staff will never ask you for a verification code or your password.' },
    ],
    keywords: ['otp', 'verification code', 'sms', 'code not received', 'resend', 'email code', 'mobile verification'],
    related: ['create-buyer-account', 'sign-in-options', 'otp-and-password-safety'],
  },
  {
    slug: 'sign-in-options',
    category: 'getting-started',
    audience: 'all',
    title: 'Ways to sign in to TradeExpress',
    summary: 'Sign in with an email OTP, a mobile OTP or your Google account.',
    body: [
      'Choose whether you are signing in as a buyer or a supplier, then use one of the available methods:',
      { list: [
        'Email OTP: enter your registered email address and the code sent to it.',
        'Mobile OTP: enter your registered mobile number and the code sent by SMS.',
        'Continue with Google: choose the Google account that uses your registered email address.',
      ] },
      'If your signup was not finished, you are asked to complete it first. Suspended or unapproved accounts cannot sign in until their status is resolved.',
    ],
    keywords: ['login', 'log in', 'sign in', 'signin', 'cannot login', 'google login'],
    related: ['continue-with-google', 'mobile-and-email-otp', 'reset-password'],
    action: { to: '/login', label: 'Go to sign in' },
  },
  {
    slug: 'continue-with-google',
    category: 'getting-started',
    audience: 'all',
    title: 'Using “Continue with Google”',
    summary: 'How Google sign-in works for buyers and suppliers.',
    body: [
      'Clicking “Continue with Google” opens Google’s own account chooser. TradeExpress receives your name, email address and profile picture only after Google confirms your identity.',
      { list: [
        'Existing account: if your Google email matches a TradeExpress account, you are signed in to it.',
        'New buyer: a buyer account is created automatically.',
        'New supplier: you are taken to supplier registration with your name and verified email filled in, because suppliers must add business details.',
      ] },
      'If you close Google’s window, nothing happens and you can try again. If the window does not open, allow pop-ups for TradeExpress in your browser.',
    ],
    keywords: ['google', 'gmail', 'oauth', 'social login', 'popup blocked'],
    related: ['sign-in-options', 'create-buyer-account', 'supplier-registration'],
  },

  // ── Buying & Sourcing ──────────────────────────────────────────────────────
  {
    slug: 'search-wholesale-products',
    category: 'buying-sourcing',
    audience: 'buyer',
    title: 'Searching for wholesale products',
    summary: 'Use search, categories and filters to find products listed by TradeExpress suppliers.',
    body: [
      'Products on TradeExpress are listed by registered suppliers. Only active listings are shown to buyers.',
      { steps: [
        'Type a product name or keyword in the search bar, or browse by category.',
        'Use the filters on the products page to narrow results.',
        'Open a product to see its price tiers, minimum order quantity, GST rate and supplier details.',
      ] },
    ],
    keywords: ['find products', 'search', 'browse', 'catalogue', 'catalog', 'categories', 'filter'],
    related: ['moq-and-price-tiers', 'compare-products-suppliers', 'supplier-verification-status'],
    action: { to: '/products', label: 'Browse products' },
  },
  {
    slug: 'moq-and-price-tiers',
    category: 'buying-sourcing',
    audience: 'all',
    title: 'Understanding MOQ and tiered wholesale prices',
    summary: 'What minimum order quantity means and how volume price tiers are applied.',
    body: [
      'Minimum order quantity (MOQ) is the smallest quantity a supplier accepts for a product. You cannot order less than the MOQ shown on the listing.',
      'Many listings have tiered prices: the unit price depends on the quantity you order, with lower unit prices for larger quantities. The tier that matches your quantity is applied in your cart and at checkout.',
      { note: 'Need a quantity or price that is not listed? Post an RFQ so suppliers can quote for your exact requirement.' },
    ],
    keywords: ['moq', 'minimum order', 'minimum quantity', 'price tiers', 'bulk price', 'volume discount', 'tier pricing'],
    related: ['post-an-rfq', 'search-wholesale-products', 'supplier-create-listing'],
  },
  {
    slug: 'compare-products-suppliers',
    category: 'buying-sourcing',
    audience: 'buyer',
    title: 'Comparing products and supplier offers',
    summary: 'Compare similar products side by side before you buy.',
    body: [
      'Use product comparison to review similar products and the suppliers that offer them, including price, MOQ and supplier details.',
      { steps: [
        'Open Compare Products from the site menu.',
        'Choose the products you want to compare and review them side by side.',
        'Open the product you prefer to add it to your cart, or post an RFQ for a custom quotation.',
      ] },
    ],
    keywords: ['compare', 'comparison', 'side by side', 'similar products', 'best price'],
    related: ['search-wholesale-products', 'compare-quotations'],
    action: { to: '/compare-products', label: 'Open product comparison' },
  },
  {
    slug: 'supplier-verification-status',
    category: 'buying-sourcing',
    audience: 'buyer',
    title: 'Checking a supplier’s verification',
    summary: 'Where to see what a supplier has verified before you trade with them.',
    body: [
      'Supplier profiles show the business details the supplier has provided and the status of their business verification on TradeExpress.',
      'PAN–Aadhaar link status shows only whether the Aadhaar number is linked with the PAN in Income Tax records. It is not full KYC, GST verification or a guarantee of the supplier’s performance.',
      { note: 'Review the supplier profile and product details carefully, and use RFQs to confirm specifications in writing before ordering.' },
    ],
    keywords: ['verified supplier', 'trust', 'kyc', 'gst', 'genuine supplier', 'supplier profile'],
    related: ['pan-aadhaar-verification', 'supplier-business-verification', 'post-an-rfq'],
    action: { to: '/suppliers', label: 'View suppliers' },
  },

  // ── Supplier Management ────────────────────────────────────────────────────
  {
    slug: 'supplier-registration',
    category: 'supplier-management',
    audience: 'supplier',
    title: 'How to register as a supplier',
    summary: 'The supplier signup steps: account, business details, address and verification.',
    body: [
      'Supplier registration collects the information buyers and TradeExpress need to trust your business.',
      { steps: [
        'Account details: your name, company name, mobile number and email (both verified by OTP), and a password.',
        'Business information: business type, GST registration status and GSTIN where applicable, and company details.',
        'Address: your business address, and your factory address if it is different.',
        'Verification: your PAN and Aadhaar number for the PAN–Aadhaar link check, and supporting documents.',
        'Accept the terms and submit your registration.',
      ] },
      'After signup, your business verification continues from the Verification page of your supplier dashboard.',
    ],
    keywords: ['supplier signup', 'become a supplier', 'sell', 'seller registration', 'register company'],
    related: ['supplier-business-verification', 'pan-aadhaar-verification', 'supplier-create-listing'],
    action: { to: '/supplier/register', label: 'Register as a supplier' },
  },
  {
    slug: 'supplier-business-verification',
    category: 'supplier-management',
    audience: 'supplier',
    title: 'Completing business verification (KYC)',
    summary: 'Review your business details and submit them for verification from your dashboard.',
    body: [
      'The Verification page of your supplier dashboard is pre-filled with the details you entered at signup. Check them, add anything that is missing and submit them for review.',
      { list: [
        'Fields that came from signup are shown so you do not need to type them again.',
        'Your business is shown as verified only after the verification review is completed, not when you submit.',
        'If a detail is wrong, correct it on the Verification page before submitting.',
      ] },
    ],
    keywords: ['kyc', 'business verification', 'gstin', 'pan', 'documents', 'verified badge', 'compliance'],
    related: ['supplier-registration', 'pan-aadhaar-verification'],
    action: { to: '/supplier/verification', label: 'Open verification' },
  },
  {
    slug: 'pan-aadhaar-verification',
    category: 'supplier-management',
    audience: 'all',
    title: 'PAN–Aadhaar link verification',
    summary: 'What the PAN–Aadhaar check confirms and what its results mean.',
    body: [
      'With your consent, TradeExpress checks with Income Tax records whether your Aadhaar number is linked with the PAN you entered. Buyer and supplier signup both include this step.',
      { list: [
        'Linked: your Aadhaar is linked with the PAN you entered. You can continue.',
        'Not linked: Income Tax records show the Aadhaar is not linked with that PAN, or it is linked to a different PAN. Check both numbers.',
        'Unable to verify: the verification service could not answer (for example, it is temporarily unavailable). Try again later.',
      ] },
      'Your full Aadhaar number is not stored; only the last four digits are kept with your account.',
      { note: 'This check confirms PAN–Aadhaar linkage only. It is not full KYC, Aadhaar identity authentication or GST verification.' },
    ],
    keywords: ['pan', 'aadhaar', 'aadhar', 'pan aadhaar link', 'income tax', 'not linked', 'unable to verify'],
    related: ['create-buyer-account', 'supplier-registration', 'supplier-business-verification'],
  },
  {
    slug: 'supplier-create-listing',
    category: 'supplier-management',
    audience: 'supplier',
    title: 'Creating a product listing',
    summary: 'Add a product with MOQ, tiered prices, HSN code, GST rate and images.',
    body: [
      { steps: [
        'Go to Products in your supplier dashboard and choose to add a new product.',
        'Enter the product name, category, description and images.',
        'Set the minimum order quantity (MOQ) and add price tiers for larger quantities.',
        'Enter the HSN code and GST rate that apply to the product.',
        'Set the available stock and save the listing.',
      ] },
      'Only active products are shown to buyers. You can edit a listing later from your products list.',
    ],
    keywords: ['add product', 'new listing', 'list product', 'hsn', 'gst rate', 'price tiers', 'product images'],
    related: ['supplier-bulk-upload', 'supplier-inventory', 'moq-and-price-tiers'],
    action: { to: '/supplier/products/new', label: 'Add a product' },
  },
  {
    slug: 'supplier-bulk-upload',
    category: 'supplier-management',
    audience: 'supplier',
    title: 'Uploading products in bulk with Excel',
    summary: 'Use the bulk upload template to add many products at once.',
    body: [
      { steps: [
        'Open Products in your supplier dashboard and choose bulk upload.',
        'Download the Excel template and fill in one product per row, following the column headings.',
        'Upload the completed file. Rows with problems are reported so you can correct them and upload again.',
      ] },
    ],
    keywords: ['bulk upload', 'excel', 'xlsx', 'csv', 'import products', 'template', 'many products'],
    related: ['supplier-create-listing', 'supplier-inventory'],
    action: { to: '/supplier/products', label: 'Open my products' },
  },
  {
    slug: 'supplier-inventory',
    category: 'supplier-management',
    audience: 'supplier',
    title: 'Managing product inventory',
    summary: 'Keep stock levels accurate so buyers only order what you can supply.',
    body: [
      'The Inventory page of your supplier dashboard shows stock for each product. Update stock when you receive or set aside goods, and review the stock history to see what changed.',
    ],
    keywords: ['stock', 'inventory', 'quantity available', 'out of stock', 'stock history'],
    related: ['supplier-create-listing', 'supplier-accept-orders'],
    action: { to: '/supplier/inventory', label: 'Open inventory' },
  },

  // ── RFQ & Negotiations ─────────────────────────────────────────────────────
  {
    slug: 'post-an-rfq',
    category: 'rfq-negotiation',
    audience: 'buyer',
    title: 'Posting a Request for Quotation (RFQ)',
    summary: 'Describe what you need and receive quotations from suppliers.',
    body: [
      'An RFQ lets suppliers quote for your exact product, quantity and requirements.',
      { steps: [
        'Open the RFQ page and describe the product you need.',
        'Enter the quantity, unit and any specifications or delivery requirements.',
        'Submit the RFQ. Quotations from suppliers appear under Quotes in your buyer dashboard.',
      ] },
    ],
    keywords: ['rfq', 'request for quotation', 'quote', 'quotation', 'buying requirement', 'custom order'],
    related: ['compare-quotations', 'negotiate-quotation', 'moq-and-price-tiers'],
    action: { to: '/rfq', label: 'Post an RFQ' },
  },
  {
    slug: 'compare-quotations',
    category: 'rfq-negotiation',
    audience: 'buyer',
    title: 'Comparing quotations',
    summary: 'Review quotations for the same RFQ side by side, including landed cost.',
    body: [
      'For each RFQ, you can compare the quotations you received. The comparison shows the unit price, GST, freight and other charges, and the total landed cost per unit, so offers can be compared fairly.',
    ],
    keywords: ['compare quotes', 'landed cost', 'best quote', 'quotation comparison'],
    related: ['post-an-rfq', 'negotiate-quotation', 'accept-quotation'],
    action: { to: '/buyer/quotes', label: 'View my quotes' },
  },
  {
    slug: 'negotiate-quotation',
    category: 'rfq-negotiation',
    audience: 'all',
    title: 'Negotiating a quotation (up to three rounds)',
    summary: 'Send counteroffers on a quotation; each quotation can be negotiated for at most three rounds.',
    body: [
      'Buyers and suppliers can counter a quotation with a new unit price. Each revision is saved as a new version so both sides can see how the offer changed.',
      { list: [
        'Negotiation is limited to three rounds per quotation.',
        'After the third round, the quotation must be accepted or declined.',
        'You are notified when the other party sends a counteroffer.',
      ] },
    ],
    keywords: ['negotiate', 'counteroffer', 'counter offer', 'bargain', 'rounds', 'revise price'],
    related: ['compare-quotations', 'accept-quotation', 'supplier-send-quotation'],
  },
  {
    slug: 'accept-quotation',
    category: 'rfq-negotiation',
    audience: 'buyer',
    title: 'Accepting or declining a quotation',
    summary: 'What happens when you accept or decline a supplier’s quotation.',
    body: [
      'Accepting a quotation confirms the negotiated terms with that supplier, closes the RFQ and notifies the supplier. Declining a quotation tells the supplier you will not proceed with that offer.',
    ],
    keywords: ['accept quote', 'decline quote', 'reject quote', 'confirm quotation'],
    related: ['negotiate-quotation', 'compare-quotations'],
    action: { to: '/buyer/quotes', label: 'View my quotes' },
  },
  {
    slug: 'supplier-send-quotation',
    category: 'rfq-negotiation',
    audience: 'supplier',
    title: 'Receiving RFQs and sending quotations',
    summary: 'Respond to buyer RFQs with a quotation and negotiate terms.',
    body: [
      { steps: [
        'Open Quotations in your supplier dashboard to see RFQs you can respond to.',
        'Send a quotation with your unit price, GST, freight and any other charges.',
        'Respond to buyer counteroffers. Each quotation can be negotiated for up to three rounds.',
      ] },
      'You are notified when a buyer counters, accepts or declines your quotation.',
    ],
    keywords: ['supplier quotation', 'respond to rfq', 'send quote', 'buyer requirement', 'inquiry'],
    related: ['negotiate-quotation', 'supplier-accept-orders'],
    action: { to: '/supplier/quotations', label: 'Open quotations' },
  },

  // ── Orders & Logistics ─────────────────────────────────────────────────────
  {
    slug: 'place-bulk-order',
    category: 'orders-logistics',
    audience: 'buyer',
    title: 'Placing a wholesale order',
    summary: 'Order through your cart or Buy Now and complete checkout.',
    body: [
      { steps: [
        'Add products to your cart at or above their MOQ, or use Buy Now on a product.',
        'At checkout, choose your delivery address from your address book.',
        'Choose a payment option and review the order summary, including GST.',
        'Place the order. You receive an order number to track it.',
      ] },
    ],
    keywords: ['place order', 'buy', 'checkout', 'cart', 'buy now', 'purchase'],
    related: ['payment-options', 'cancel-order', 'track-shipment'],
    action: { to: '/cart', label: 'Go to cart' },
  },
  {
    slug: 'cancel-order',
    category: 'orders-logistics',
    audience: 'buyer',
    title: 'Cancelling an order',
    summary: 'Orders can be cancelled until the supplier has packed them.',
    body: [
      'You can cancel an order from My Orders while it is placed, confirmed or being processed. Once an order has been packed, shipped or delivered, it can no longer be cancelled.',
      { note: 'If there is a problem with goods you have received, raise a trade dispute instead.' },
    ],
    keywords: ['cancel', 'cancellation', 'cancel order', 'stop order'],
    related: ['raise-trade-dispute', 'place-bulk-order'],
    action: { to: '/buyer/orders', label: 'Open my orders' },
  },
  {
    slug: 'track-shipment',
    category: 'orders-logistics',
    audience: 'buyer',
    title: 'Tracking your order and shipment',
    summary: 'Follow your order from confirmation to delivery.',
    body: [
      'Use your order number on the order tracking page, or open Shipments in your buyer dashboard, to see the current status and shipment updates.',
      { list: [
        'Order statuses: placed, confirmed, processing, packed, shipped, out for delivery and delivered.',
        'Shipment updates and documents appear as the supplier and transporter record them.',
      ] },
    ],
    keywords: ['track', 'tracking', 'where is my order', 'shipment', 'delivery status', 'order status'],
    related: ['place-bulk-order', 'inspect-on-delivery'],
    action: { to: '/track', label: 'Track an order' },
  },
  {
    slug: 'inspect-on-delivery',
    category: 'orders-logistics',
    audience: 'buyer',
    title: 'Inspecting goods on delivery',
    summary: 'Check your consignment and keep evidence in case you need to raise a dispute.',
    body: [
      { list: [
        'Check the quantity and condition of the goods against your order and invoice.',
        'Take clear photos of any damage, shortage or mismatch before using the goods.',
        'Keep the packaging and documents until you are satisfied with the order.',
      ] },
      'If something is wrong, raise a trade dispute on the order and attach your evidence.',
    ],
    keywords: ['inspection', 'check goods', 'damaged', 'delivery check', 'quality check'],
    related: ['raise-trade-dispute', 'track-shipment'],
  },
  {
    slug: 'supplier-accept-orders',
    category: 'orders-logistics',
    audience: 'supplier',
    title: 'Accepting, packing and dispatching orders',
    summary: 'Manage incoming orders from your supplier dashboard.',
    body: [
      { steps: [
        'Open Orders in your supplier dashboard to see new orders.',
        'Accept the order if you can fulfil it, or reject it if you cannot.',
        'Pack the goods and update the order status.',
        'Arrange dispatch from Shipping, and record the invoice and transport details.',
      ] },
      'The buyer sees each status update on their order.',
    ],
    keywords: ['accept order', 'reject order', 'dispatch', 'packing', 'ship', 'fulfil', 'fulfill', 'transport'],
    related: ['supplier-inventory', 'supplier-payments'],
    action: { to: '/supplier/orders', label: 'Open orders' },
  },

  // ── Payments & Escrow ──────────────────────────────────────────────────────
  {
    slug: 'payment-options',
    category: 'payments-escrow',
    audience: 'buyer',
    title: 'Payment options at checkout',
    summary: 'Pay in full, pay a 20% advance, or choose cash on delivery where offered.',
    body: [
      { list: [
        'Full payment: pay the whole order amount online through Razorpay.',
        'Advance payment: pay 20% of the order total online now, and the remaining 80% on delivery.',
        'Cash on delivery: pay the carrier when the goods arrive, where this option is offered at checkout.',
      ] },
      'You can save cards and accounts securely for faster checkout. Card details are stored by Razorpay, not by TradeExpress.',
    ],
    keywords: ['payment', 'pay', 'razorpay', 'advance', 'partial payment', 'cod', 'cash on delivery', 'upi', 'card'],
    related: ['payment-failed', 'escrow-explained', 'gst-invoice'],
    action: { to: '/buyer/payments', label: 'View my payments' },
  },
  {
    slug: 'payment-failed',
    category: 'payments-escrow',
    audience: 'buyer',
    title: 'If a payment fails',
    summary: 'What to check when an online payment does not go through.',
    body: [
      { list: [
        'Check that your card, UPI or bank account has enough balance and is enabled for online payments.',
        'If money was deducted but the order shows as unpaid, do not pay again. Raise a support ticket under Billing & GST with your order number.',
        'For any other payment problem, raise a support ticket with your order number and the time of the payment attempt.',
      ] },
    ],
    keywords: ['payment failed', 'payment declined', 'money deducted', 'transaction failed', 'payment problem'],
    related: ['payment-options', 'raise-support-ticket'],
  },
  {
    slug: 'escrow-explained',
    category: 'payments-escrow',
    audience: 'all',
    title: 'How escrow works on TradeExpress',
    summary: 'Buyer payments are held by TradeExpress and released to the supplier after the order is completed.',
    body: [
      'When a buyer pays online, the amount is recorded in escrow instead of going straight to the supplier.',
      { list: [
        'Held: the payment is held while the order is fulfilled.',
        'Released: after the order is completed, TradeExpress releases the payout to the supplier, less the platform commission.',
        'Frozen: if the buyer raises a dispute, the payout is paused until the dispute is decided.',
        'Refunded: if a dispute is decided in the buyer’s favour, all or part of the held amount is refunded.',
      ] },
    ],
    keywords: ['escrow', 'held', 'release', 'frozen', 'safe payment', 'protection', 'payout'],
    related: ['raise-trade-dispute', 'supplier-payments', 'payment-options'],
  },
  {
    slug: 'gst-invoice',
    category: 'payments-escrow',
    audience: 'all',
    title: 'Getting your GST tax invoice',
    summary: 'View, print or download the tax invoice for an order.',
    body: [
      'Each order has a GST tax invoice showing the supplier and buyer details, HSN codes, taxable value and GST. Buyers can open it from My Orders or Payments; suppliers can open it from their orders.',
    ],
    keywords: ['invoice', 'gst invoice', 'tax invoice', 'bill', 'download invoice', 'print invoice', 'itc'],
    related: ['payment-options', 'supplier-accept-orders'],
    action: { to: '/buyer/orders', label: 'Open my orders' },
  },
  {
    slug: 'supplier-payments',
    category: 'payments-escrow',
    audience: 'supplier',
    title: 'Payment status, commission and payouts',
    summary: 'See what you have earned, what is held in escrow and what has been paid out.',
    body: [
      'The Payments page of your supplier dashboard shows each order’s payment status, the amount held in escrow, the platform commission and your payouts.',
      { list: [
        'Commission is calculated on the order value using the tiers shown in your dashboard.',
        'Payouts are released after the order is completed.',
        'A dispute on an order pauses its payout until the dispute is decided.',
      ] },
    ],
    keywords: ['payout', 'settlement', 'commission', 'earnings', 'supplier payment', 'escrow release'],
    related: ['escrow-explained', 'supplier-respond-dispute'],
    action: { to: '/supplier/payments', label: 'Open payments' },
  },

  // ── Returns & Disputes ─────────────────────────────────────────────────────
  {
    slug: 'raise-trade-dispute',
    category: 'returns-disputes',
    audience: 'buyer',
    title: 'Raising a trade dispute',
    summary: 'Report a problem with an order and submit evidence for review.',
    body: [
      'If an order has a problem, you can raise one dispute for that order from Disputes in your buyer dashboard.',
      { steps: [
        'Open Disputes and choose the order.',
        'Select the reason: quality mismatch, damaged or defective goods, quantity shortage, delayed consignment, counterfeit material, or another compliance issue.',
        'Describe the problem in detail and attach photo evidence.',
        'Submit the dispute. The supplier’s payout for that order is paused while TradeExpress reviews it.',
      ] },
      'You can add messages to the dispute while it is being reviewed.',
    ],
    keywords: ['dispute', 'complaint', 'problem with order', 'damaged goods', 'shortage', 'wrong item', 'quality issue', 'refund'],
    related: ['dispute-outcomes', 'inspect-on-delivery', 'escrow-explained'],
    action: { to: '/buyer/disputes', label: 'Open disputes' },
  },
  {
    slug: 'dispute-outcomes',
    category: 'returns-disputes',
    audience: 'all',
    title: 'How disputes are decided',
    summary: 'The possible outcomes of a dispute review.',
    body: [
      'A TradeExpress administrator reviews the dispute, the evidence and the messages from both sides, and records one of these decisions:',
      { list: [
        'Full refund: the held amount is refunded to the buyer.',
        'Partial refund: part of the held amount is refunded to the buyer and the rest is settled with the supplier.',
        'Rejected: the claim is not accepted, and the payout is released to the supplier as normal.',
      ] },
      'Both the buyer and the supplier are notified of the decision.',
    ],
    keywords: ['dispute decision', 'refund', 'partial refund', 'rejected', 'resolution', 'outcome'],
    related: ['raise-trade-dispute', 'escrow-explained'],
  },
  {
    slug: 'supplier-respond-dispute',
    category: 'returns-disputes',
    audience: 'supplier',
    title: 'When a buyer raises a dispute',
    summary: 'What a dispute means for your order and payout.',
    body: [
      'When a buyer raises a dispute on one of your orders, the payout for that order is paused until TradeExpress decides the dispute. Keep your packing records, invoices and dispatch documents for the order, as they help the review.',
    ],
    keywords: ['supplier dispute', 'buyer complaint', 'payout paused', 'frozen payout'],
    related: ['dispute-outcomes', 'supplier-payments'],
  },

  // ── Account Security ───────────────────────────────────────────────────────
  {
    slug: 'otp-and-password-safety',
    category: 'account-security',
    audience: 'all',
    title: 'Keeping your account safe',
    summary: 'Simple steps that protect your account and your business.',
    body: [
      { list: [
        'Never share an OTP or your password, including with anyone claiming to be from TradeExpress.',
        'Use a strong password that you do not use on other websites.',
        'Sign out on shared computers.',
        'Check that you are on the TradeExpress website before entering your details.',
      ] },
      { note: 'TradeExpress staff will never ask for your verification code or account password by phone, SMS or WhatsApp.' },
    ],
    keywords: ['security', 'safe', 'fraud', 'phishing', 'scam', 'protect account', 'hacked'],
    related: ['reset-password', 'mobile-and-email-otp'],
  },
  {
    slug: 'reset-password',
    category: 'account-security',
    audience: 'all',
    title: 'Resetting your password',
    summary: 'Use Forgot password to set a new password.',
    body: [
      { steps: [
        'Open the Forgot password page from the sign-in screen.',
        'Enter the email address registered with your account and follow the instructions sent to it.',
        'Choose a new password that meets the password rules.',
      ] },
    ],
    keywords: ['forgot password', 'reset password', 'change password', 'locked out'],
    related: ['sign-in-options', 'otp-and-password-safety'],
    action: { to: '/forgot-password', label: 'Reset password' },
  },
  {
    slug: 'raise-support-ticket',
    category: 'account-security',
    audience: 'all',
    title: 'Contacting TradeExpress support',
    summary: 'Raise a support ticket and follow the conversation with our team.',
    body: [
      'Signed-in buyers and suppliers can raise a support ticket from the Help Center. Choose the category that fits your question: General, Order & Shipping, Billing & GST, or Technical / Account.',
      { list: [
        'Give a clear subject and include order or quotation numbers where relevant.',
        'You can reply to your ticket and see responses from the support team.',
        'Ticket statuses: open, in progress, resolved and closed.',
      ] },
    ],
    keywords: ['support', 'contact', 'help', 'ticket', 'customer care', 'complaint', 'raise ticket'],
    related: ['raise-trade-dispute', 'payment-failed'],
  },
];

/** Articles default to published and to the content release date; either can be set per article. */
export const HELP_ARTICLES = ARTICLE_SOURCE.map((article) => ({ published: true, updatedAt: HELP_CONTENT_UPDATED, ...article }));

/** Frequently asked questions shown in the Help Center tabs. `article` links to the full answer. */
export const HELP_FAQ_TABS = [
  {
    id: 'account',
    label: 'My Account',
    items: [
      { q: 'How do I register as a buyer?', a: 'Verify your email and mobile number with OTPs, create a password and complete the PAN–Aadhaar link check. You can also use Continue with Google.', article: 'create-buyer-account' },
      { q: 'How do I register as a supplier?', a: 'Complete the four signup steps: account details, business information, address and verification.', article: 'supplier-registration' },
      { q: 'I did not receive my OTP. What should I do?', a: 'Wait for the countdown to finish and request a new code. For email codes, check your spam folder.', article: 'mobile-and-email-otp' },
      { q: 'How do I reset my password?', a: 'Use Forgot password on the sign-in screen and follow the instructions sent to your registered email.', article: 'reset-password' },
    ],
  },
  {
    id: 'sourcing',
    label: 'Sourcing',
    items: [
      { q: 'What is MOQ?', a: 'Minimum order quantity is the smallest quantity a supplier accepts for a product. Orders below the MOQ are not accepted.', article: 'moq-and-price-tiers' },
      { q: 'How do tiered prices work?', a: 'The unit price depends on the quantity you order. The matching tier is applied in your cart and at checkout.', article: 'moq-and-price-tiers' },
      { q: 'How can I compare products?', a: 'Use product comparison to review similar products, prices, MOQs and suppliers side by side.', article: 'compare-products-suppliers' },
      { q: 'What does PAN–Aadhaar “Linked” mean on a supplier?', a: 'It confirms linkage in Income Tax records only. It is not full KYC or a guarantee of performance.', article: 'supplier-verification-status' },
    ],
  },
  {
    id: 'negotiation',
    label: 'Negotiation',
    items: [
      { q: 'How do I post an RFQ?', a: 'Open the RFQ page, describe the product, quantity and requirements, and submit. Quotations appear under Quotes in your dashboard.', article: 'post-an-rfq' },
      { q: 'How many times can a quotation be negotiated?', a: 'Up to three rounds per quotation. After that, the quotation must be accepted or declined.', article: 'negotiate-quotation' },
      { q: 'What happens when I accept a quotation?', a: 'The negotiated terms are confirmed with that supplier, the RFQ is closed and the supplier is notified.', article: 'accept-quotation' },
      { q: 'How do suppliers respond to RFQs?', a: 'From Quotations in the supplier dashboard, with unit price, GST, freight and other charges.', article: 'supplier-send-quotation' },
    ],
  },
  {
    id: 'orders-payments',
    label: 'Orders & Payments',
    items: [
      { q: 'Which payment options are available?', a: 'Full online payment through Razorpay, a 20% advance with the balance on delivery, or cash on delivery where offered.', article: 'payment-options' },
      { q: 'Can I cancel my order?', a: 'Yes, until the supplier has packed it. Packed, shipped or delivered orders cannot be cancelled.', article: 'cancel-order' },
      { q: 'How do I track my order?', a: 'Enter your order number on the tracking page, or open Shipments in your buyer dashboard.', article: 'track-shipment' },
      { q: 'Where is my GST invoice?', a: 'Open the order in My Orders or Payments to view, print or download its tax invoice.', article: 'gst-invoice' },
    ],
  },
  {
    id: 'after-sales',
    label: 'After-Sales',
    items: [
      { q: 'My goods arrived damaged or short. What should I do?', a: 'Take photos, keep the packaging and raise a trade dispute on the order with your evidence.', article: 'raise-trade-dispute' },
      { q: 'What happens to the payment during a dispute?', a: 'The supplier’s payout for that order is paused until TradeExpress decides the dispute.', article: 'escrow-explained' },
      { q: 'What are the possible dispute outcomes?', a: 'A full refund, a partial refund, or rejection of the claim with the payout released to the supplier.', article: 'dispute-outcomes' },
    ],
  },
  {
    id: 'self-service',
    label: 'Self-Service',
    items: [
      { q: 'Track an order', a: 'Use your order number on the order tracking page.', article: 'track-shipment' },
      { q: 'Download an invoice', a: 'Open the order in My Orders or Payments.', article: 'gst-invoice' },
      { q: 'Update stock levels (suppliers)', a: 'Open Inventory in your supplier dashboard.', article: 'supplier-inventory' },
      { q: 'Contact support', a: 'Sign in and raise a support ticket from the Help Center.', article: 'raise-support-ticket' },
    ],
  },
];

/** Topics shown as quick chips under the Help Center search box. */
export const HELP_POPULAR_TOPICS = [
  'post-an-rfq',
  'moq-and-price-tiers',
  'payment-options',
  'raise-trade-dispute',
  'track-shipment',
  'supplier-registration',
];

export const getHelpArticle = (slug) => HELP_ARTICLES.find((article) => article.slug === slug && article.published !== false) || null;
export const getHelpCategory = (id) => HELP_CATEGORIES.find((category) => category.id === id) || null;
