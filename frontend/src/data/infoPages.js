// Content for the information pages at /info/:slug.

const infoPages = {
  about: {
    title: 'About TradeSphere',
    intro: 'TradeSphere is an international B2B marketplace where importers, wholesalers and retailers discover manufacturers, exporters and trading companies, compare wholesale prices and request quotations.',
    sections: [
      { heading: 'Built for business buyers', body: ['Every listing shows its minimum order quantity and quantity price tiers in Indian Rupees, so buyers can see what volume does to the unit cost before they ask for a quote.', 'Suppliers manage their own company profile, product listings, inquiries and orders from a supplier dashboard.'] },
      { id: 'how-it-works', heading: 'How it works', body: ['Search the catalogue or browse by category, compare suppliers, send a request for quotation, then place an order with Buy Now or from your cart.'] },
      { heading: 'Current limitations', body: ['TradeSphere does not yet verify suppliers, hold payments or arrange freight. Online payment processing is not yet connected, and account data is stored in your browser in this version of the site.'] },
    ],
  },
  'buyer-protection': {
    title: 'Buyer protection guide',
    intro: 'Good sourcing habits protect a purchase far more than any badge. This page is general guidance for trading safely. TradeSphere does not currently provide a payment-protection, escrow or supplier-verification service.',
    sections: [
      { heading: 'Before you order', body: ['Ask for a business licence and check it with the issuing authority.', 'Order a sample, and agree written specifications, tolerances and packaging before production.', 'Compare at least three quotes so you can spot a price that is unrealistically low.'] },
      { heading: 'Paying safely', body: ['Use a payment method that offers recourse, such as a letter of credit or a recognised escrow service, for large orders.', 'Split payments around milestones: deposit, pre-shipment inspection, and balance against shipping documents.', 'Check that the bank account name matches the company you are contracting with.'] },
      { heading: 'On delivery', body: ['Book an independent pre-shipment inspection for bulk orders.', 'Photograph the cartons and record any damage before signing for the goods.', 'Keep all messages, invoices and inspection reports together in case of a dispute.'] },
    ],
  },
  help: {
    title: 'Help Center',
    intro: 'Answers to common questions about buying and selling on TradeSphere.',
    faqs: [
      ['How do I create an account?', 'Choose Join Free and register as a Buyer or a Supplier. You need a valid email, a mobile number for your country, your city and a password of at least 8 characters with a letter and a number.'],
      ['Which currency are prices in?', 'All prices are in Indian Rupees (₹), per unit, excluding shipping and taxes. Larger quantities unlock the lower price tiers shown on each listing.'],
      ['What is the minimum order quantity (MOQ)?', 'The smallest quantity a supplier accepts for a listing. Buy Now and the cart start at the MOQ automatically.'],
      ['Can I pay online?', 'Not yet. Online payment processing is not connected. You can place an order with payment pending and arrange payment with the supplier, or choose Cash on Delivery.'],
      ['Where is my data stored?', 'In this version of TradeSphere, accounts, orders, quotes and messages are stored in your browser. They are not shared with other devices, and clearing your browser data removes them.'],
      ['Are suppliers verified?', 'No. Company profiles are self-described and have not been independently verified. Follow the buyer protection guide before you trade.'],
    ],
  },
  contact: {
    title: 'Contact',
    intro: 'Send us a note using the form below. Email delivery is not connected yet, so your message is stored in this browser for now.',
    contactForm: true,
  },
  terms: {
    title: 'Terms of use',
    intro: 'Plain-language terms for using TradeSphere.',
    sections: [
      { heading: 'Marketplace listings', body: ['Suppliers are responsible for the accuracy of their company profiles, product details, prices and stock. TradeSphere does not independently verify them.'] },
      { heading: 'Orders and payment', body: ['Orders record a buyer’s intent to purchase from a supplier. Online payment processing is not currently available; payment terms are agreed between buyer and supplier.'] },
      { heading: 'Accounts', body: ['Keep your password private. In the current version accounts are stored in your browser, which is not a secure store for sensitive business information.'] },
    ],
  },
  privacy: {
    title: 'Privacy',
    intro: 'What happens to the information you enter on TradeSphere.',
    sections: [
      { heading: 'Stored in your browser', body: ['Account details, addresses, the cart, saved products, quote requests, messages and orders are saved in your browser’s local storage under keys that begin with “tradesphere:”.', 'Passwords are never stored in readable form: only a salted hash is kept. Payment card numbers, UPI PINs and bank logins are never requested or stored.'] },
      { heading: 'Third-party requests', body: ['Product photographs are loaded from the Unsplash image CDN and fonts from Google Fonts, so those services receive ordinary web requests from your browser.'] },
      { heading: 'Removing your data', body: ['Use “Reset sample data” in the footer, or clear the site data in your browser settings.'] },
    ],
  },
};

export default infoPages;
