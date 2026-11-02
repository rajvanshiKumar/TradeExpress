# TradeExpress — Your World of Business

An international B2B marketplace for importers, exporters, manufacturers and wholesale buyers,
built **frontend-only** with React and Vite. Buyers browse wholesale listings with minimum order
quantities and price tiers, request quotations, message suppliers and place orders. Suppliers
manage their catalogue. An admin area oversees the marketplace.

> **Prototype architecture.** There is no server, database or payment provider. Accounts,
> orders and messages are stored in the browser. See **Security limitations** below before using
> it with real business data.

## Quick start

Requires Node.js 18 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command              | What it does                                            |
| -------------------- | ------------------------------------------------------- |
| `npm run dev`        | Start the Vite development server                       |
| `npm run build`      | Create a production build in `dist/`                    |
| `npm run preview`    | Serve the production build locally                      |
| `npm run admin:hash` | Create the admin password hash (see Admin sign-in)      |

Sign-in uses the browser's Web Crypto API, which only works on `https://` or `localhost`.
A static host must serve `index.html` for unknown paths (single-page app fallback).

## Accounts

- **Buyer** and **Supplier** accounts are created on **Join Free** (`/register`). The form needs a
  valid email, a mobile number valid for the selected country, a city, and a password of at least
  8 characters with a letter and a number. Admin cannot be chosen there.
- There are no pre-filled or automatic logins. Sample companies, orders and quotes in the catalogue
  belong to sample records that cannot sign in.
- A registered supplier gets a company profile and can add products straight away.

### Admin sign-in

The admin account (`hello.techvunex@gmail.com`) signs in at **`/admin/login`**. The password is
**not** in the source code. To enable it:

```bash
npm run admin:hash            # type the admin password when asked
# copy the printed VITE_ADMIN_PASSWORD_HASH=... line into a file named .env.local
npm run dev                   # or npm run build
```

`.env.local` is git-ignored. Without the hash, the admin page says admin sign-in is not configured.

## Security limitations (frontend-only)

- **This is not secure authentication.** Everything runs in the visitor's browser. Anyone can open
  the developer tools and read or change browser storage and React state, including roles.
- Passwords are never stored in plain text: only a salted PBKDF2 hash is kept. But the admin hash is
  bundled into the public site, so a determined person could try to guess the password offline, or
  simply edit the stored data. Use a long, unique admin password and never reuse it elsewhere.
- Role checks (Buyer / Supplier / Admin) only prevent accidental navigation. They are not
  authorisation. Real protection of admin and business data needs a trusted server or an external
  authentication service.
- Each browser has its own separate data. Nothing is shared between users or devices.
- After 5 failed sign-in attempts the form pauses for 30 seconds. This is a convenience, not a defence.

## Prices and payments

- All prices are stored and shown in **Indian Rupees (₹)** with Indian digit grouping
  (₹45,000, ₹1,25,000). Shipping and tax are estimates set in `src/utils/constants.js`.
- Payment methods: UPI, Credit / Debit Card, Net Banking, Digital Wallet and Cash on Delivery.
  No card numbers, UPI PINs or bank logins are ever requested or stored.
- **No payment provider is connected.** Online payments show a pending state and then report that
  processing is unavailable; buyers can retry, cancel, choose another method, or place the order
  with **Payment pending**. Cash on Delivery orders are **Cash on Delivery: payment pending**.
  No order is ever marked as paid by the browser alone. To accept real payments, connect a provider
  in `src/services/paymentService.js` (this needs a server).
- Orders are protected against double clicks: one confirmation creates exactly one order.

## Design system

- **Palette** (tokens in `src/styles/index.css`): midnight navy `#101827`, charcoal `#171A21`,
  warm ivory `#F8F6F1`, champagne gold `#C9A66B` (used sparingly for highlights and active states),
  white, muted slate for secondary text, and a restrained emerald for reviewed suppliers and success.
  Gold text on light backgrounds uses the darker `brand-600/700` shades for contrast.
- **Typography**: Manrope for headings, Inter for body text, and DM Serif Display italic for a few
  editorial accent words (loaded from Google Fonts in `index.html`).
- **Components**: buttons, badges, inputs, product cards, supplier cards, section headings, page
  headers and dashboard layouts live in `src/components/common`, `products`, `suppliers` and `home`.
- **Motion**: sections fade in once on scroll (`Reveal`), pages fade between routes, images zoom
  gently on hover. All motion is disabled when the visitor prefers reduced motion.
- **Code splitting**: dashboards, messaging and checkout load on demand.

## Supplier verification

Suppliers can submit business documents (type, number and file name: files are not uploaded) from
**Supplier portal → Verification**. The admin reviews them at **Admin console → Verification review**.
An approved supplier shows a **Documents reviewed** badge; others show **Not verified**,
**Verification pending** or **Verification declined**. This reflects an admin review inside the
prototype only, not a legal or third-party certification. No sample company is pre-approved.

## Tech stack

- React 18 + Vite 6 (JavaScript)
- Tailwind CSS v4 through `@tailwindcss/vite`. Design tokens live in `src/styles/index.css`
  (`@theme`), so there is no `tailwind.config.js`
- React Router DOM 6
- React Context API for state, `localStorage` for persistence
- Lucide React icons, Recharts for charts

## Features

**Marketplace**
- Homepage: announcement bar, hero search, marketplace figures, 12 categories, featured product tabs
  (Best Sellers, New Arrivals, Hot Deals), ready-to-ship, recommended suppliers, wholesale deals
  with quantity tiers, industries, manufacturer showcase, why choose us, how it works, supplier
  call to action, newsletter, footer
- Header with search across products, suppliers or company names, region/language/currency,
  messages, notifications, orders, wishlist, cart, desktop mega-menu and mobile drawer
- Product listing: filter sidebar (a drawer on small screens), sorting, grid/list toggle, active
  filter chips, clear-all, pagination. Filters live in the URL, so results can be shared
- Product details: gallery, price tiers, variants, quantity with live total, stock, lead time,
  specifications, packaging, reviews, supplier card, inquiry form, related products,
  similar suppliers, share
- Supplier directory and company profiles with Products, Company Profile, Reviews and Contact tabs
- Category index and category pages, information pages (About, Help, Contact, Terms, Privacy,
  Buyer protection guide), 404 page

**Workflows**
- Request for quotation with validation, confirmation, history and status
- Messaging with search, unread counts and clearly labelled automated acknowledgements
- Cart with tier pricing, and a six-step checkout: contact, address, shipping, payment method,
  review, confirmation
- **Buy Now** on every product card and on the product page. It checks out that one product
  (default option, at least the minimum order quantity; the product page uses your chosen quantity
  and option) and never changes the cart. Quantity can be adjusted at checkout within MOQ and stock.
  The selection is kept for 30 minutes and survives a refresh

**Dashboards**
- Buyer: overview, orders and order details, quotes, saved products, recently viewed, address
  book, profile and notification preferences
- Supplier: overview, product management (add, edit, hide, delete), inline inventory, orders
  with status updates, inquiries with quote replies, analytics charts, company settings
- Admin: metrics and charts, product moderation, company suspension, buyer and supplier lists,
  category management, inquiry monitoring and order oversight

Supplier and admin changes update shared state, so they appear in the catalogue immediately.

## How data works

- **React Context API is client-side state management, not an external data API.** Eight
  contexts (Auth, Product, Cart, Wishlist, Inquiry, Message, Order, Notification) hold the app
  state, each with a matching hook in `src/hooks`.
- **`localStorage` data stays in the current browser.** It is not shared between users, browsers
  or devices, and clearing site data removes it. All keys start with `tradeexpress:v2:` (older data from earlier versions is ignored).
- Seed data in `src/data` is written only when nothing is saved yet. Missing or malformed saved
  data falls back to the seed instead of breaking the app.
- Services in `src/services` return Promises with a short simulated delay, so pages have real
  loading, empty and error states and could later be pointed at a real API.
- **Reset sample data** (in the footer and in every dashboard) clears everything saved by
  TradeExpress after a confirmation and restores the sample data.

### Sample data

10 sample supplier companies, 51 products across 12 categories (prices in INR), 8 orders,
9 quote requests and 5 conversations. Company profiles are not verified; the supplier pages say so.

### Optional public API

No public API is configured, and none is required. `src/services/apiClient.js` is an optional
adapter: if you set `VITE_PUBLIC_API_BASE_URL` and `VITE_PUBLIC_API_PRODUCTS_PATH` in a `.env`
file, the product service also loads products from that endpoint, expecting the same shape as
`src/data/products.js`, and falls back to local data if the request fails. No endpoint is
assumed or invented. Never put private keys in `VITE_` variables: they ship to the browser.

## Images

- Product, category and company photographs are free-licence Unsplash photos loaded from the
  Unsplash CDN by photo ID (`src/utils/images.js`).
- Every image has a local SVG illustration in `public/images`. It is used when a record has no
  photo, and automatically if a photo fails to load, so the site never shows a broken image.
- The hero artwork, logo and all illustrations are original to this project.

## Project structure

```
TradeExpress/
├── public/            favicon, logo, SVG illustrations
└── src/
    ├── assets/        logo used by the app
    ├── components/
    │   ├── common/    design system: Button, Input, Select, Modal, Drawer, Badge, Tabs, Toast…
    │   ├── layout/    AnnouncementBar, Header, MegaMenu, MobileMenu, Footer, layouts
    │   ├── home/      homepage sections
    │   ├── products/  cards, grid, filters, sort, gallery, price tiers, catalogue view
    │   ├── suppliers/ supplier cards, filters, header, product list
    │   └── forms/     search, inquiry, login, register, address, checkout forms
    ├── contexts/      the eight context providers
    ├── data/          seed data and navigation
    ├── hooks/         context hooks and helpers
    ├── pages/         marketplace pages, plus buyer/, supplier/ and admin/
    ├── routes/        AppRoutes, ProtectedRoute, RoleRoute
    ├── services/      Promise-based mock services and the optional API adapter
    ├── styles/        index.css (tokens, base) and components.css
    └── utils/         formatting, totals, validation, storage, constants
```

## Accessibility and responsiveness

Semantic landmarks, a skip link, labelled form fields with inline errors, keyboard-operable
menus, tabs, dialogs and drawers (focus is trapped and restored), visible focus rings, live
regions for results and toasts, text alternatives for charts, and reduced-motion support.
Layouts adapt from 360 px phones to large desktops.

## Limitations

- No backend: no server-side accounts, payment processing, email, order fulfilment or supplier
  verification. Password reset by email is not available.
- Role-based access runs in the browser only (see Security limitations).
- English is the only language. Product images cannot be uploaded; new listings use a category illustration.
- Photography comes from the Unsplash photo IDs already in the catalogue. No new industrial,
  shipping or warehouse photos were added (none could be sourced and licence-checked during the
  redesign); the hero uses category photography. Drop licensed images into `public/images` and
  reference them to replace any visual.
- Shipping costs, taxes and ratings are estimates or sample values.
