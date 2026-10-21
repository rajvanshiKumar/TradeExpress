# TradeSphere — Global B2B Wholesale Marketplace

TradeSphere is a full-stack, enterprise-grade B2B marketplace platform for manufacturers, exporters, wholesale buyers, and international trading companies.

---

## Tech Stack

- **Frontend**: React (Vite), Tailwind CSS utility styling + custom component tokens, Lucide Icons, Recharts data analytics.
- **Backend**: Node.js + Express.js modular REST API with route controllers, services, middleware, and centralized error handling.
- **Database**: MySQL 8.0 with **Prisma ORM** (models, relations, migrations, seeding, atomic transactions).
- **Payment Gateway**: Razorpay in **Sandbox Mode** with cryptographic HMAC SHA-256 signature verification and Cash on Delivery (COD) support.
- **SMS & Mobile OTP**: MSG91 OTP API (API v5) with rate limiting, resend cooldown, country dialing rules, single-use verification tokens, and tamper-proof signup validation.
- **Email System**: Nodemailer with SMTP configuration and automatic fallback to Ethereal Email test sandbox with preview URLs.
- **Images**: High-Definition (HD) uncompressed verified photography from Unsplash with multi-tier image fallback handling.

---

## Platform Features Overview

### Phase 1: Core Bulk-Trade & Statutory Operations (P1)
1. **Statutory KYC & Business Verification**:
   - Company registration, GSTIN (15-character state-coded), PAN (10-character alphanumeric), bank account & IFSC verification.
   - Warehouse location with address, state, and pincode.
   - Document upload for GST certificate, PAN card, and cancelled cheque via `/api/upload`.
   - Admin KYC verification review panel (`/admin/verification`) with Approve/Reject ruling and rejection reasons.
2. **Supplier Product Management & Bulk Upload**:
   - Product CRUD with title, description, category, MOQ, unit (pieces, kg, cartons), tiered price breaks, stock quantity, lead time.
   - Mandatory **HSN Code** (e.g. 8471) and **GST Rate** (0%, 5%, 12%, 18%, 28%).
   - Sample availability toggle and sample pricing.
   - Bulk Excel product upload via `.xlsx` with downloadable template (`/api/supplier/products/bulk/template`) and row-by-row validation report.
3. **Supplier Order Fulfillment Workflow**:
   - Accept or Reject incoming bulk orders with reasons.
   - Status progression: `ORDER_CONFIRMED` → `PACKED` → `SHIPPED` → `DELIVERED`.
   - "Dispatch Order" modal requiring Transporter Name, Tracking / LR Number, Tax Invoice PDF link, and E-Way Bill PDF link.
4. **GST Tax Engine & Escrow Advance**:
   - State-based tax calculation: Intra-state (CGST 9% + SGST 9%) vs Inter-state (IGST 18%).
   - 20% partial advance payment option with remaining balance payable on delivery.
   - Unique supplier tax invoice numbering series: `TS-INV-<SUP>-<TIMESTAMP>`.
   - Cancellation enforcement: buyer can cancel strictly prior to `PACKED` status.
   - Razorpay webhook endpoint with HMAC-SHA256 signature verification.
   - Platform Commission Settings (`/api/admin/commission`) with global, category, and supplier overrides.

---

### Phase 2: Wholesale Negotiation, Escrow & Disputes (P2)
1. **RFQ 3-Round Negotiation State Machine**:
   - Enforces a maximum of 3 negotiation rounds (`currentVersion <= 3`).
   - Revision history saved across versions (`v1`, `v2`, `v3`) with audit trail of proposed unit price, freight, lead time, and notes.
   - Quoted statuses: `SENT`, `COUNTERED`, `ACCEPTED`, `REJECTED`, `CLOSED`.
   - "Accept & Order" converts negotiated locked price directly into cart and checkout.
2. **Escrow Ledger & Supplier Payout Flow**:
   - Automated escrow initiation on order payment holding funds securely during inspection.
   - Automatic platform commission deduction.
   - Admin Escrow & Payouts management tab (`/admin/reports?tab=escrow`) with live volume cards: Total Held, Payouts Settled, Platform Commission, Total Refunded.
   - "Release Payout" creates verifiable `SupplierPayout` record (`PAY-TS-...`).
3. **Buyer Inspection & Dispute Resolution**:
   - Inspection dispute filing on `DELIVERED` orders (`QUALITY_MISMATCH`, `DAMAGED_GOODS`, `SHORTAGE`, `INCORRECT_ITEMS`).
   - Automatically freezes escrow payout (`FROZEN_DISPUTED`).
   - Admin dispute mediation modal supporting Full Refund, Partial Refund, or Rejection.
4. **Verified Ratings & Reviews**:
   - Rating locked until order reaches `DELIVERED` state (1 review per order).
   - Multi-metric rating: Overall 1–5 stars, Material Quality, Packaging Protection, Delivery Timeliness, and verified buyer comment.
   - Integrated into Product Details page with verified buyer badges.

---

### Phase 3: Communications, Help Desk & Enterprise Readiness (P3)
1. **Live In-App Notification Centre**:
   - Notification Bell in header with real-time unread count badge.
   - Automated triggers on new orders, status changes, quote submissions, counter-offers, escrow releases, disputes, and ticket replies.
   - Dual sync: merges local alerts and backend `/api/notifications` records.
2. **Support Ticketing System**:
   - Help Desk modal for Buyers and Suppliers to raise issues (Order, Billing, Technical, General) with priority flags.
   - Interactive conversation thread between users and support staff.
   - Admin Support Desk tab in `AdminReports.jsx` for reviewing tickets, updating statuses (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`), and sending official replies.
3. **One-Click Reorder & Downloadable Invoices**:
   - One-click "Reorder" button on past orders in `BuyerOrders.jsx` automatically loading products and quantities into cart.
   - Standardized printable GST Tax Invoice & Purchase Order window (`printInvoice.js`) with full tax breakdown, consignor/consignee GSTIN, and E.&O.E. legal footer.
4. **Multi-Currency Wholesale Selector**:
   - Header currency switcher (`INR ₹`, `USD $`, `EUR €`).
   - Live conversion rates from INR base pricing to international wholesale currencies.
5. **Supplier Subscription Plans**:
   - Gold, Silver, and Free Tier comparison matrix on Supplier Dashboard.
   - Listing limit indicators (e.g. 100 listings on Gold, instant escrow payout, verified trust badge).
6. **SEO & Clean Crawling**:
   - `sitemap.xml` listing public marketplace pages with update frequencies.
   - `robots.txt` protecting authenticated panels and guiding search engine bots.

---

## Getting Started Locally

### 1. Prerequisites
- **Node.js**: v18.0.0 or later
- **MySQL Server**: 8.0 or later (running locally on port 3306 or remote)
- **npm** or **pnpm**

---

### 2. Database Setup (MySQL)
1. Ensure MySQL Server is running.
2. In `backend/.env`, configure your database connection string:
   ```env
   DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/tradesphere_db"
   ```
3. **Database Migration & Backup Notice**:
   > [!IMPORTANT]
   > **Backup First**: Before applying any database schema migration or running `prisma db push`, always back up your existing database (e.g. `mysqldump -u root -p tradesphere_db > tradesphere_backup.sql`).
   ```bash
   cd backend
   npx prisma db push
   npx prisma generate
   ```

---

### 3. MSG91 SMS OTP Configuration
In `backend/.env`, set your MSG91 credentials:
```env
MSG91_AUTH_KEY="your_msg91_authkey_here"
MSG91_TEMPLATE_ID="your_msg91_otp_template_id_here"
MSG91_OTP_EXPIRY_MINUTES=10
MSG91_OTP_LENGTH=6
```
> [!NOTE]
> In your MSG91 account dashboard:
> 1. Create an SMS OTP Template (e.g. `##OTP## is your verification code for TradeSphere. Valid for 10 minutes.`).
> 2. Copy the Template ID into `MSG91_TEMPLATE_ID`.
> 3. Generate an AuthKey in MSG91 settings and set it in `MSG91_AUTH_KEY`.

---

### 4. Backend Setup
1. Open a terminal and navigate to `backend/`:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   The backend server runs on `http://localhost:5000/api`.

---

### 5. Frontend Setup
1. Open a new terminal and navigate to `frontend/`:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The frontend runs on `http://localhost:5173`.


---

## Public Deployment & Hosting Guide

TradeSphere is architected as a decoupled client-server application:
1. **Frontend (Vercel / Netlify / Cloudflare Pages / Render)**
2. **Backend (Render / Railway / Fly.io / DigitalOcean / VPS)**
3. **Database (Aiven MySQL / Railway MySQL / PlanetScale / TiDB Serverless)**

### Option 1: Frontend on Vercel
1. Import the GitHub repository into [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Framework Preset: **Vite**.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Add Environment Variable:
   - `VITE_PUBLIC_API_BASE_URL`: `https://your-backend-domain.com/api`
7. Click **Deploy**. (SPA rewrites are pre-configured via `frontend/vercel.json`).

### Option 2: Backend on Render
1. Create a new **Web Service** on [Render](https://render.com) from your GitHub repo.
2. Set **Root Directory** to `backend`.
3. Runtime: **Node**.
4. Build Command: `npm install && npx prisma generate`.
5. Start Command: `npm start`.
6. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `5000` (or leave default assigned by Render)
   - `DATABASE_URL`: `mysql://<user>:<password>@<host>:<port>/<db_name>`
   - `FRONTEND_URL`: `https://your-frontend-domain.vercel.app`
   - `JWT_SECRET`: A long random secret string
   - `RAZORPAY_KEY_ID`: Your Razorpay Key ID
   - `RAZORPAY_KEY_SECRET`: Your Razorpay Key Secret
   - (Optional) `SMS_AUTH_KEY`, `SMS_TEMPLATE_ID`, `SMTP_USER`, etc.
7. Click **Create Web Service**.

### Option 3: Backend on Railway
1. Create a **New Project** in [Railway](https://railway.app).
2. Add a **MySQL** database service (Railway provisions a managed MySQL database with instant connection URL).
3. Add a **GitHub Repo** service pointing to the repo, Root Directory `backend`.
4. Set `DATABASE_URL` reference variable to the MySQL service's `MYSQL_URL`.
5. Run migration: `npx prisma db push` or `npx prisma migrate deploy`.

---

## Default Seeded Accounts

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Buyer** | `buyer@tradesphere.com` | `TradeSphere@2026` | Verified wholesale buyer with saved address |
| **Supplier** | `supplier@novatech.com` | `TradeSphere@2026` | Verified electronics manufacturer |
| **Admin** | `admin@tradesphere.com` | `password123` | Platform super administrator with full panel access |
| **Admin (Legacy)** | `krajvanshi244@gmail.com` | `modiji@12345` | Super admin login (`/admin/login`) |

---

## API Endpoints Reference

### Authentication & Mobile OTP Verification
- `POST /api/auth/send-mobile-otp` — Request mobile OTP via MSG91 (rate-limited, duplicate checked)
- `POST /api/auth/verify-mobile-otp` — Verify OTP with MSG91 and receive a 15-minute single-use verification token
- `POST /api/auth/resend-mobile-otp` — Resend OTP via MSG91 after 60-second cooldown
- `POST /api/auth/register` — Register Buyer or Supplier (requires valid `verificationToken` and verified phone)
- `POST /api/auth/login` — Sign in and receive JWT token
- `POST /api/auth/kyc/submit` — Submit statutory KYC (GSTIN, PAN, bank IFSC)
- `POST /api/auth/kyc/documents` — Upload KYC verification documents

### Products & Bulk Upload
- `GET /api/products` — Filter products by category, MOQ, price, location
- `GET /api/products/:id` — Product details with tiered pricing and verified reviews
- `POST /api/supplier/products` — Add product with HSN code and GST rate
- `GET /api/supplier/products/bulk/template` — Download standard `.xlsx` product template
- `POST /api/supplier/products/bulk/upload` — Upload `.xlsx` spreadsheet with error report

### Orders & Logistics
- `POST /api/orders` — Create bulk wholesale order with state tax breakdown
- `GET /api/orders/:id` — Order status and tracking details
- `POST /api/supplier/orders/:id/accept` — Accept order and generate `TS-INV` invoice series
- `POST /api/supplier/orders/:id/reject` — Reject order with capacity/inventory reason
- `PATCH /api/supplier/orders/:id/status` — Advance status to `PACKED`
- `POST /api/supplier/orders/:id/dispatch` — Dispatch order with Transporter LR & E-Way Bill

### RFQ & Quotation Negotiation
- `POST /api/rfq` — Post Request for Quotation
- `GET /api/rfq` — List open RFQs
- `POST /api/rfq/:id/quote` — Submit wholesale quotation
- `POST /api/rfq/quotes/:quoteId/counter` — Submit Counter-Offer (max 3 rounds)
- `POST /api/rfq/quotes/:quoteId/accept` — Accept Quote and lock negotiated price

### Escrow, Disputes & Reviews
- `GET /api/escrow/summary` — Overview of held, settled, and refunded escrow
- `POST /api/escrow/:orderId/release` — Admin manual/automatic supplier payout release
- `POST /api/disputes` — Raise inspection dispute for delivered order with photo evidence
- `POST /api/disputes/:id/resolve` — Admin dispute ruling (Full Refund, Partial Refund, Reject)
- `POST /api/reviews/:orderId` — Submit verified buyer review after delivery

### Notifications & Support Tickets
- `GET /api/notifications` — Fetch user's in-app alerts and unread count
- `PATCH /api/notifications/:id/read` — Mark notification as read
- `PATCH /api/notifications/read-all` — Mark all notifications read
- `POST /api/tickets` — Create support ticket
- `GET /api/tickets` — List user tickets or all tickets for admin
- `POST /api/tickets/:id/messages` — Add message reply to support ticket thread
- `PATCH /api/tickets/:id/status` — Admin update ticket status (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`)
