// Content for the information pages at /info/:slug.

const infoPages = {
  about: {
    title: 'About Us – TradeExpress',
    intro: 'Connecting Businesses. Creating Opportunities. Powering Growth.',
    sections: [
      {
        heading: 'Who We Are',
        body: [
          'TradeExpress is a business-focused digital marketplace created to support the evolving needs of wholesale and commercial trade.',
          'We aim to reduce the complexity of traditional B2B transactions by providing a centralized platform where buyers can explore multiple suppliers and sellers can showcase their products to a wider business audience.',
          'Whether you are a manufacturer looking to expand your distribution network, a wholesaler seeking new customers, or a business owner sourcing products in bulk, TradeExpress is designed to make the process simpler and more organized.',
          'Our focus is on building a professional trading environment that encourages transparency, fair competition, and long-term business relationships.',
        ],
      },
      {
        heading: 'Our Mission',
        body: [
          'To make B2B trading simpler, smarter, and more accessible for every business.',
          'Our mission is to empower buyers and sellers through digital technology, efficient product discovery, transparent business information, and practical tools that support better purchasing and selling decisions.',
          'We strive to create opportunities for businesses of different sizes to connect, compete, and grow in an increasingly digital marketplace.',
        ],
      },
      {
        heading: 'Our Vision',
        body: [
          'To become a trusted and preferred digital marketplace for B2B trade.',
          'We envision a connected business ecosystem where geographical boundaries and traditional sourcing challenges are reduced through technology.',
          'Our long-term vision is to help businesses expand their market reach, discover new trading opportunities, and establish sustainable commercial relationships.',
        ],
      },
      {
        id: 'how-it-works',
        heading: 'What We Offer',
        body: [
          '1. A Comprehensive B2B Marketplace: Explore products across diverse business categories, compare available options, and discover suppliers based on your sourcing requirements.',
          '2. Wholesale & Bulk Purchasing: Discover products with minimum order quantities (MOQ), available wholesale pricing, and quantity-based discounts offered by sellers.',
          '3. Request for Quotation (RFQ): Submit product-specific or general sourcing requirements and receive quotations from relevant suppliers, helping you evaluate suitable purchasing options.',
          '4. Product Comparison: Compare product specifications, pricing, minimum order quantities, and other relevant details to make more informed procurement decisions.',
          '5. Business Growth Opportunities: Manufacturers, suppliers, and wholesalers can showcase their offerings, reach prospective business buyers, and explore opportunities beyond their existing customer networks.',
          '6. Streamlined Trading Experience: Access tools for managing product listings, inquiries, quotations, orders, and other marketplace activities through an organized digital experience.',
        ],
      },
      {
        heading: 'Why Choose TradeExpress?',
        body: [
          'Built for Business: TradeExpress focuses on the specific requirements of B2B commerce, including bulk purchases, wholesale pricing, supplier discovery, and business procurement.',
          'Transparency in Trading: We aim to provide clear product information, pricing details, supplier profiles, and marketplace policies to support informed business decisions.',
          'Opportunities for Every Business: From emerging enterprises to established manufacturers and distributors, TradeExpress is designed to support businesses at different stages of growth.',
          'Technology-Driven Convenience: Our platform brings important trading activities into one digital environment, helping businesses reduce manual processes and improve efficiency.',
          'Long-Term Business Relationships: We believe successful B2B commerce is not only about completing transactions but also about building dependable and sustainable commercial connections.',
        ],
      },
      {
        heading: 'Our Core Values',
        body: [
          'Trust & Integrity: Encouraging responsible business practices, honest communication, and transparent marketplace interactions.',
          'Customer Focus: Understanding the practical needs of buyers and sellers and continuously improving the platform experience.',
          'Innovation: Using technology to simplify traditional trading processes and create better business opportunities.',
          'Fairness: Promoting a marketplace environment where businesses can compete based on their products, pricing, service, and capabilities.',
          'Growth & Collaboration: Supporting meaningful partnerships that contribute to long-term business success.',
        ],
      },
      {
        heading: 'Our Commitment',
        body: [
          'At TradeExpress, our commitment goes beyond providing an online product marketplace.',
          'We are focused on developing a dependable digital trading ecosystem that supports business discovery, efficient communication, informed procurement, and transparent marketplace processes.',
          'We recognize that trust plays an essential role in B2B transactions. Therefore, we aim to continuously strengthen our platform through clear policies, improved user experiences, responsible marketplace practices, and effective customer support.',
          'Our goal is to make TradeExpress a valuable business partner in the digital trading journey of buyers and sellers.',
        ],
      },
    ],
  },
  'buyer-protection': {
    title: 'Buyer protection guide',
    intro: 'Good sourcing habits protect a purchase far more than any badge. This page is general guidance for trading safely. TradeExpress does not currently provide a payment-protection, escrow or supplier-verification service.',
    sections: [
      { heading: 'Before you order', body: ['Ask for a business licence and check it with the issuing authority.', 'Order a sample, and agree written specifications, tolerances and packaging before production.', 'Compare at least three quotes so you can spot a price that is unrealistically low.'] },
      { heading: 'Paying safely', body: ['Use a payment method that offers recourse, such as a letter of credit or a recognised escrow service, for large orders.', 'Split payments around milestones: deposit, pre-shipment inspection, and balance against shipping documents.', 'Check that the bank account name matches the company you are contracting with.'] },
      { heading: 'On delivery', body: ['Book an independent pre-shipment inspection for bulk orders.', 'Photograph the cartons and record any damage before signing for the goods.', 'Keep all messages, invoices and inspection reports together in case of a dispute.'] },
    ],
  },
  help: {
    title: 'Help Center',
    intro: 'Answers to common questions about buying and selling on TradeExpress.',
    faqs: [
      ['How do I create an account?', 'Choose Join Free and register as a Buyer or a Supplier. You need a valid email, a mobile number for your country, your city and a password of at least 8 characters with a letter and a number.'],
      ['Which currency are prices in?', 'All prices are in Indian Rupees (₹), per unit, excluding shipping and taxes. Larger quantities unlock the lower price tiers shown on each listing.'],
      ['What is the minimum order quantity (MOQ)?', 'The smallest quantity a supplier accepts for a listing. Buy Now and the cart start at the MOQ automatically.'],
      ['Can I pay online?', 'Not yet. Online payment processing is not connected. You can place an order with payment pending and arrange payment with the supplier, or choose Cash on Delivery.'],
      ['Where is my data stored?', 'In this version of TradeExpress, accounts, orders, quotes and messages are stored in your browser. They are not shared with other devices, and clearing your browser data removes them.'],
      ['Are suppliers verified?', 'No. Company profiles are self-described and have not been independently verified. Follow the buyer protection guide before you trade.'],
    ],
  },
  contact: {
    title: 'Contact',
    intro: 'Send us a note using the form below. Email delivery is not connected yet, so your message is stored in this browser for now.',
    contactForm: true,
  },
  terms: {
    title: 'Terms and Conditions of Use',
    intro: 'Official Terms and Conditions governing access to and transactions on the TradeExpress B2B Marketplace (Effective: 29/10/2026).',
    sections: [
      { heading: '26 Controlled Operating Sections', body: ['Comprehensive legal terms encompassing marketplace facilitator role, seller product listings, buyer obligations, order formation, pricing & GST, escrow settlements, open-box inspection & logistics, 7-day returns, 5-day refunds, intellectual property, DPDP data protection, limitation of liability, and designated grievance redressal.'] },
    ],
  },
  privacy: {
    title: 'Privacy',
    intro: 'What happens to the information you enter on TradeExpress.',
    sections: [
      { heading: 'Stored in your browser', body: ['Account details, the cart, saved products, quote requests, messages and orders are saved in your browser’s local storage under keys that begin with “tradeexpress:”.', 'Passwords are never stored in readable form: only a salted hash is kept. Payment card numbers, UPI PINs and bank logins are never requested or stored.'] },
      { heading: 'Third-party requests', body: ['Product photographs are loaded from the Unsplash image CDN and fonts from Google Fonts, so those services receive ordinary web requests from your browser.'] },
      { heading: 'Removing your data', body: ['Use “Reset sample data” in the footer, or clear the site data in your browser settings.'] },
    ],
  },
};

export default infoPages;
