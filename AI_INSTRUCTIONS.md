# TradeExpress — AI Assistant Development Instructions & Technical Reference

> **Purpose**: This document serves as the shared, authoritative project knowledge base, architectural specification, and operational rulebook for all AI coding assistants (including Claude AI in VS Code and Antigravity) working on the TradeExpress project. All AI assistants must strictly read and adhere to this document before planning, modifying, or executing any task.

---

## 1. Shared AI Assistant Workflow Protocol & Core Operational Rules

Every AI assistant (Claude AI, Antigravity, or others) must execute development tasks following this strict 5-phase protocol and adhere to the 12 mandatory operational rules.

### The 12 Mandatory Operational Rules
1. **Mandatory Documentation Reading**: Always read `AI_INSTRUCTIONS.md` and `CLAUDE.md` before planning or starting any coding task.
2. **Inspect Before Assuming**: Inspect the actual source code, Prisma models, and route definitions before making any assumptions about how a feature works.
3. **Reuse Existing Infrastructure**: Always reuse existing APIs, services, controllers, UI components, and Prisma database queries. Never rebuild what already exists.
4. **Zero Duplication**: Never introduce duplicate routes, redundant service methods, duplicate components, or parallel state architectures.
5. **Preserve Multi-Tab Role Isolation**: Strictly preserve the token slots (`buyer_token`, `supplier_token`, `admin_token`) and window binding (`tradeexpress_window_role`) in `src/utils/authSession.js`. Never introduce global token overrides that break cross-role multi-window sessions.
6. **No Unrelated Modifications**: Never edit, refactor, or format files that are unrelated to the specific assigned task.
7. **No Regression or Deletion**: Never delete, comment out, or break existing working features, tests, or database relationships.
8. **Check Git Status First**: Always run `git status` or inspect the working tree before modifying any files to understand the current workspace state.
9. **Mandatory Verification**: Run available backend tests (`npm --prefix backend test`), frontend tests (`npm --prefix frontend test`), and the frontend production build (`npm --prefix frontend run build`) after making relevant changes.
10. **Honest Reporting**: Never claim that a test passed unless it was executed and exited with code 0. If a test command is unavailable, fails, or requires database setup, report it honestly with full error logs.
11. **Explain Impact**: Clearly explain all modified files, the exact code changes made, and their operational impact on dependent modules.
12. **Zero Secret Exposure**: Never expose, print, log, or hardcode environment variables, secrets, credentials, API keys, or full payment/identity tokens.

### Standard 5-Phase Execution Cycle
```
┌────────────────────────────────────────────────────────┐
│ Phase 1: Context Initialization & Workspace Audit      │
│ - Read AI_INSTRUCTIONS.md & CLAUDE.md                  │
│ - Check git status to ensure working tree is clean     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Phase 2: Source Code Inspection & Reuse Check          │
│ - Identify affected models, routes, and components     │
│ - Locate existing services in Section 10 for reuse     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Phase 3: Minimal, Surgical Implementation              │
│ - Make targeted changes strictly to necessary files    │
│ - Adhere to existing coding patterns & naming          │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Phase 4: Automated Verification                        │
│ - Execute backend tests: npm --prefix backend test     │
│ - Execute frontend tests: npm --prefix frontend test   │
│ - Execute build: npm --prefix frontend run build       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Phase 5: Structured Reporting                          │
│ - List modified files with exact paths                 │
│ - Detail added/fixed behavior & test results           │
└────────────────────────────────────────────────────────┘
```

---

## 2. Project Overview & Business Purpose

**TradeExpress** (developed by TradeExpress B2B Private Limited) is an enterprise B2B wholesale marketplace, RFQ negotiation engine, and fulfillment platform connecting verified manufacturers/suppliers with bulk wholesale buyers across India and international markets.

### Primary User Roles
1. **Buyer**: Discovers wholesale products, compares suppliers, submits Requests for Quotation (RFQs), negotiates pricing up to 3 rounds, places bulk orders, pays via advance/escrow, tracks shipments, confirms delivery with OTP, and raises inspection disputes if goods are defective.
2. **Supplier**: Registers with statutory business credentials (GSTIN, PAN, bank IFSC), undergoes KYC verification, receives a verified TradeExpress Supplier Certificate & QR ID Card, lists wholesale products with HSN/GST rates, responds to RFQs, manages orders, handles dispatch logistics, and receives escrow payouts.
3. **Super Admin**: Platform control room managing platform commission rates, user statuses, product moderation, statutory KYC reviews, escrow payouts, dispute arbitration, sub-admin delegation, logistics oversight, and system audit logs.
4. **Transport Partner / Fleet**: Manages commercial trucks and drivers, receives shipment manifests, reports transit waypoints, and verifies 6-digit delivery OTPs.

---

## 3. Complete Technology Stack

### Frontend (`frontend/`)
- **Framework & Build**: React 18.3.1, React DOM 18.3.1, Vite 6.3.0 (`@vitejs/plugin-react` 4.4.0)
- **Styling**: Tailwind CSS v4.1.0 via `@tailwindcss/vite` plugin. Design tokens and custom utilities are defined directly in `src/styles/index.css` (no `tailwind.config.js` or `postcss.config.js` needed).
- **Icons**: `lucide-react` 0.468.0
- **Charts & Visualizations**: `recharts` 2.15.0
- **Routing**: `react-router-dom` 6.28.0 (code-split using `React.lazy` and `Suspense`)
- **Real-Time Client**: `socket.io-client` 4.8.4
- **Test Runner**: Node.js Native Test Runner (`node --test tests/**/*.test.js`)

### Backend (`backend/`)
- **Runtime & Architecture**: Node.js 18+ with pure ECMAScript Modules (`"type": "module"`)
- **Framework**: Express.js 4.21.2
- **Database & ORM**: MySQL 8.0 with Prisma ORM 5.22.0 (`@prisma/client` 5.22.0)
- **Security & Middleware**: `helmet` 8.0.0, `cors` 2.8.5, `express-rate-limit` 8.7.1, `express-validator` 7.2.1, `bcryptjs` 2.4.3, `jsonwebtoken` 9.0.2
- **Payment Gateway**: `razorpay` 2.9.8 (Webhook validation via HMAC SHA-256)
- **PDF & Document Engine**: `pdfkit` 0.20.2, `svg-to-pdfkit` 0.1.8, `qrcode` 1.5.4
- **Spreadsheet Processing**: `xlsx` 0.18.5 (Bulk catalog Excel template and ingestion)
- **File Uploads**: `multer` 2.4.0 (Memory storage and `/uploads` destination)
- **Messaging & Notifications**: `nodemailer` 6.9.16 (SMTP with Ethereal fallback), `socket.io` 4.8.4, MSG91 API v5, and PowersText HTTP token API
- **Test Runner**: Node.js Native Test Runner (`node --test tests/**/*.test.js`)

---

## 4. Frontend Architecture

### Directory Layout (`frontend/src/`)
- `api/`: Specialized API adapters (`authClient.js`, `superAdminApi.js`, `transportApi.js`, `supplierInventoryApi.js`).
- `components/`: Modular UI elements categorized into `account/`, `admin/`, `common/`, `forms/`, `help/`, `home/`, `inventory/`, `layout/`, `payments/`, `products/`, `search/`, `superadmin/`, `suppliers/`, `support/`, and `transport/`.
- `config/`: Administrative credentials configuration (`admin.js`).
- `contexts/`: React state contexts (`AuthContext`, `CartContext`, `MessageContext`, `OrderContext`, `ProductContext`, `NotificationContext`, `WishlistContext`, `InquiryContext`).
- `hooks/`: Custom hooks (`useLocalStorage`, `useDebounce`, `useCurrency`, `useNotifications`).
- `pages/`: Public pages, authentication screens, and role-specific dashboard views (`buyer/`, `supplier/`, `admin/`, `superadmin/`, `help/`, `account/`).
- `routes/`: Routing tree (`AppRoutes.jsx`), route guards (`ProtectedRoute.jsx`, `RoleRoute.jsx`).
- `services/`: API integration services (`apiClient.js`, `authorizedApi.js`, `orderService.js`, `productService.js`, `supplierService.js`, `socketService.js`).
- `styles/`: Global stylesheets and Tailwind v4 theme definitions (`index.css`, `components.css`).
- `utils/`: Utilities for currency formatting, date parsing, GST invoice generation, storage, and password validation.

### Multi-Tab Session Isolation (`src/utils/authSession.js`)
TradeExpress supports signing in simultaneously as a Buyer, Supplier, and Super Admin in separate browser tabs without session collision:
- **Storage Slots**: `localStorage` maintains isolated tokens: `buyer_token`, `supplier_token`, `admin_token`.
- **Window Role Binding**: Each tab stores `tradeexpress_window_role` in `sessionStorage`. When navigating to `/buyer/*`, the window binds to the `buyer` slot; when opening `/supplier/*` or `/super-admin/*`, it binds to its respective slot.
- **Header Injection**: Requests made from that tab inject the active slot's token via `Authorization: Bearer <token>`.
- **Automatic Slot Resolution**: `slotForPath(pathname)` detects route changes and binds the window to the correct role before rendering child components.

### Client-Side API Communication & Failover (`src/api/authClient.js` & `src/services/apiClient.js`)
- `apiClient.js`: Standard REST wrapper handling GET, POST, PUT, PATCH, DELETE. Automatically triggers `handleRejectedToken()` when receiving HTTP 401.
- `authClient.js`: Implements candidate failover order:
  1. `verifiedWorkingBase` (cached from prior successful call)
  2. `VITE_PUBLIC_API_BASE_URL` (from `.env`)
  3. `http://localhost:5000/api`
  4. `http://127.0.0.1:5000/api`
  5. `/api` (Vite dev proxy)
- `vite.config.js`: Proxies `/api`, `/auth`, `/verification`, and `/uploads` directly to `http://localhost:5000`.

---

## 5. Backend Architecture

### Directory Layout (`backend/src/`)
- `config/`: Database (`db.js`), Environment variables (`env.js`), CORS (`cors.js`), Mailer (`mailer.js`), Razorpay (`razorpay.js`).
- `controllers/`: Route request handlers validating input and mapping HTTP responses.
- `middleware/`: Authentication (`authMiddleware.js`), Validation (`validate.js`), Rate limiting (`rateLimiter.js`), Error handling (`errorHandler.js`), File uploads (`uploadMiddleware.js`).
- `routes/`: Express route definitions mapped to endpoint groups.
- `services/`: Core business logic, Prisma transactions, calculations, and integrations (`authService.js`, `orderService.js`, `rfqService.js`, `escrowService.js`, `inventoryLifecycleService.js`, `verificationService.js`, `sessionService.js`, `supplierDocumentService.js`, `transport/`).
- `utils/`: Password validation, JWT signing, GST order numbering, request context tracking.
- `app.js`: Express app assembly, Helmet, CORS, body parsers, upload statics, and route mounting.
- `server.js`: HTTP server instantiation, database connection check, Super Admin account bootstrap, Socket.IO initialization, stock reservation sweeper, and graceful shutdown handling.

### Request Pipeline & Middleware Chain
```
[Request] ──► [Helmet & CORS] ──► [requestContextMiddleware] 
          ──► [Rate Limiters] ──► [authenticateJWT / optionalAuth] 
          ──► [requireRole / requirePermission] 
          ──► [express-validator Rules] ──► [Controller] ──► [Service / Prisma]
          ──► [Global Error Handler]
```

### In-Memory Background Services
- **Stock Reservation Sweeper** (`inventoryLifecycleService.startReservationSweeper`): Runs continuously every 60 seconds. Releases inventory reserved by orders awaiting payment if unpaid after 30 minutes (`RESERVATION_MINUTES = 30`).

---

## 6. Database Schema & Relational Models

Managed via Prisma in `backend/prisma/schema.prisma` with 50 relational models.

### Key Relational Models & Foreign Keys
- `User`: Primary user entity with `Role` (`BUYER`, `SUPPLIER`, `ADMIN`, `SUPER_ADMIN`, `TRANSPORT_PARTNER`). Holds statutory details (GSTIN, PAN, Bank account, KYC status, masked Aadhaar).
  - Relations: `orders` (Buyer), `supplierOrders` (Supplier), `rfqs` (Buyer), `quotations` (Supplier), `disputesRaised` (Buyer), `reviewsWritten` (Buyer), `loginSessions` (`UserSession`), `kycDocuments`, `supplierDocument`.
- `Category` $\leftrightarrow$ `Product` (`1:N` via `categorySlug`): Categories with attributes; products with HSN code, GST rate, stock levels, sample pricing, and price tiers (JSON).
- `Product` $\leftrightarrow$ `InventoryLog` (`1:N` via `productId`): Immutable audit trail recording previous/new stock, reserved stock, committed stock, and reason.
- `Rfq` $\leftrightarrow$ `RfqItem` (`1:N` via `rfqId`): RFQ inquiry lines with target prices and quantities.
- `Rfq` $\leftrightarrow$ `Quotation` (`1:N` via `rfqId`): Quotations submitted by suppliers for an RFQ.
- `Quotation` $\leftrightarrow$ `QuotationVersion` (`1:N` via `quotationId`): 3-round negotiation history storing proposed unit prices, freight, lead times, notes, and `proposedBy` (`'BUYER'` or `'SUPPLIER'`).
- `Order` $\leftrightarrow$ `OrderItem` (`1:N` via `orderId`): Order details, itemized tax rates, and quantities.
- `Order` $\leftrightarrow$ `Payment` (`1:N` via `orderId`): Gateway transaction records and Razorpay signatures.
- `Order` $\leftrightarrow$ `EscrowLedger` (`1:1` via `orderId`): Secure fund holding record with platform commission calculations.
- `Order` $\leftrightarrow$ `Dispute` (`1:1` via `orderId`): Inspection dispute tracking, resolution actions, and refunded amounts.
- `Order` $\leftrightarrow$ `Review` (`1:1` via `orderId`): Verified multi-metric rating (Quality, Packaging, Timeliness).
- `Shipment` $\leftrightarrow$ `ShipmentItem`, `ShipmentLocation`, `ShipmentEvent`, `DeliveryProof` (`1:N`): Logistics tracking, driver details, GPS waypoints, and 6-digit delivery confirmation OTP.
- `UserSession` (`N:1` via `userId`): Active device tracking, IP address, user agent, expiration, and revocation status.

---

## 7. User Roles & Capabilities

| Role | Route Scope | Primary Responsibilities & Permissions |
| :--- | :--- | :--- |
| **Buyer** | `/buyer/*`<br>`/products`<br>`/cart`<br>`/checkout` | - Browse & filter verified wholesale catalog.<br>- Submit RFQs and negotiate quotes (max 3 rounds).<br>- Add items to cart; order sample or production volumes.<br>- Pay via Razorpay (100% or 20% partial advance) or COD.<br>- Manage saved delivery addresses and payment methods.<br>- Track shipment; confirm delivery with 6-digit OTP.<br>- Raise inspection dispute within 7 days of delivery.<br>- Write verified multi-metric supplier reviews. |
| **Supplier** | `/supplier/*` | - Statutory business registration (GSTIN, PAN, bank IFSC).<br>- Download verified Supplier Certificate & QR ID card.<br>- Create and edit products with HSN, GST %, and price tiers.<br>- Bulk product upload via `.xlsx` spreadsheet.<br>- Manage stock, reserved stock, and low-stock alerts.<br>- Review open RFQs and submit itemized quotations.<br>- Accept/reject orders; progress orders to `PACKED`.<br>- Dispatch shipments with Lorry Receipt (LR) & E-Way Bill.<br>- Receive escrow payouts upon delivery confirmation. |
| **Super Admin** | `/super-admin/*` | - Dedicated secure login at `/super-admin/login`.<br>- Platform overview (GMV, escrow volume, total orders).<br>- Statutory KYC review (Approve/Reject with reasons).<br>- Product catalog moderation queue.<br>- Escrow ledger management and manual payout releases.<br>- Configure tiered commission settings (Global/Category/Supplier).<br>- Mediate disputes (Full Refund, Partial Refund, Reject).<br>- Fleet, vehicle, and driver credential verification.<br>- Provision and manage sub-admins with permission codes.<br>- Inspect immutable platform audit logs. |

---

## 8. Authentication, Session & Authorization Flow

### JWT Issuance & Verification
- Handled by `sessionService.issueLoginToken()` and `jwt.signJwt()`.
- Payload: `{ userId: user.id, role: user.role, sid: session.id }`.
- Lifetime: 7 days (`JWT_EXPIRES_IN = "7d"`).
- Invalidation: Checked on every request via `authMiddleware.authenticateJWT`. Rejects tokens if:
  1. The token signature or expiration is invalid.
  2. The `UserSession` record (`sid`) has a non-null `revokedAt`.
  3. `user.sessionsValidAfter` is greater than the token's issued-at time (`iat`).
  4. User status is `SUSPENDED` or `DEACTIVATED`.

### Multi-Channel OTP Workflow
1. **Mobile OTP**:
   - `POST /api/auth/send-mobile-otp`: Validates phone, generates 6-digit OTP, sends via MSG91/PowersText, stores SHA-256 hash in `MobileVerification`.
   - `POST /api/auth/verify-mobile-otp`: Verifies OTP, marks `verified = true`, returns single-use `verificationToken` (15-min expiry).
2. **Email OTP**:
   - `POST /api/auth/send-email-verification-otp` and `verify-email-verification-otp` for buyer signup.
   - `POST /api/auth/send-email-otp` and `verify-email-otp` for buyer OTP login and sensitive account changes.

### Role Authorization Middleware 
- `requireRole(...roles)`: Allows access if `req.user.role === 'SUPER_ADMIN'` or if `roles.includes(req.user.role)`. 
- `requireSuperAdmin`: Restricts access strictly to `SUPER_ADMIN`.
- `requirePermission(code)`: Checks permission codes and wildcards (e.g. `transport.*`, `transport.manage`) for sub-admins.

---------------

## 9. Complete RFQ & Quotation Negotiation Workflow

```
[Buyer creates RFQ] ──► Status: OPEN
                              │
                              ▼
[Supplier submits Quote] ──► Status: SENT (Round 1)
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
       [Buyer Counters]              [Buyer Accepts]
        Round 2 of 3                        │
               │                            ▼
       [Supplier Counters]         Quotation: ACCEPTED
        Round 3 of 3 (FINAL)       Parent RFQ: CLOSED
               │                            │
        (Max 3 reached)                     ▼
               │                   [Agreed Price Locked]
               ▼                            │
      [Accept or Decline]                   ▼
                                   [Added to Cart & Checkout]
```

1. **Inquiry Creation (`POST /api/rfq`)**:
   - Created with `rfqNumber: TS-RFQ-XXXXXX-XXX`, destination pincode, target price, quantity, specifications, and optional attachment. Status is set to `OPEN`.
2. **Supplier Quoting (`POST /api/rfq/:id/quote`)**:
   - Supplier specifies unit price, MOQ, freight, lead time, GST %, payment terms, and validity.
   - Initial quote created with `currentVersion = 1`, status `SENT`, and an initial `QuotationVersion` record.
3. **3-Round State Machine (`POST /api/rfq/quotes/:quoteId/counter`)**:
   - Enforced by `rfqService.counterOffer`:
     ```javascript
     if (quotation.currentVersion >= 3) {
       throw new Error('Maximum 3 rounds of negotiation limit reached. Either accept or decline the final offer.');
     }
     ```
   - Each counter increments `currentVersion` and creates a new immutable `QuotationVersion` record noting `proposedBy: 'BUYER' | 'SUPPLIER'`.
   - Quote status updates to `COUNTERED`.
4. **Acceptance (`POST /api/rfq/quotes/:quoteId/accept`)**:
   - Quote status updates to `ACCEPTED`; parent RFQ status updates to `CLOSED`.
   - Negotiated terms (unit price, freight, lead time) are returned and loaded directly into the buyer's active Cart and Checkout.

---

## 10. Order, Tax Engine, Payment & Fulfillment Workflow

### 1. Calculation & Tax Engine (`POST /api/orders/calculate`)
- Implemented in `orderService.calculateOrderTotals`:
  - **Intra-State**: If buyer state matches supplier warehouse state $\rightarrow$ CGST + SGST (e.g. 9% + 9%).
  - **Inter-State**: If buyer state differs from supplier warehouse state $\rightarrow$ IGST (18%).
  - **Partial Advance**: Supports 20% advance payment with remaining balance due upon delivery.

### 2. Order Placement & Inventory Reservation (`POST /api/orders`)
- Generates order number `TS-YYMMDD-XXXXXX`.
- `orderStatus = 'ORDER_PLACED'`, `paymentStatus = 'PENDING'`.
- `inventoryLifecycleService.reserveStockForOrder` increments `reservedStock`, decrements `stock`, sets `reservationExpiresAt` (30 mins), and records `InventoryLog`.

### 3. Payment & Escrow Initialization (`POST /api/payments/*`)
- Razorpay order created via `POST /api/payments/create-order`.
- Payment verified via `POST /api/payments/verify` with HMAC-SHA256 signature check.
- `orderStatus` advances to `ORDER_CONFIRMED`.
- Stock moves from `reservedStock` to `committedStock`.
- `escrowService.createEscrowLedger` initializes `EscrowLedger`, holding the funds and computing platform commission based on declining tiers:
  - Subtotal $\le$ ₹50,000 $\rightarrow$ **8%**
  - Subtotal $\le$ ₹2,00,000 $\rightarrow$ **6%**
  - Subtotal $>$ ₹2,00,000 $\rightarrow$ **4%**

### 4. Supplier Fulfillment & Dispatch
- Supplier accepts order: status $\rightarrow$ `ORDER_CONFIRMED` $\rightarrow$ `PROCESSING` $\rightarrow$ `PACKED`.
- In `SupplierTransport.jsx`, supplier dispatches order:
  - Inputs transporter name, Lorry Receipt (LR / Bilty) number, and E-Way bill link.
  - Generates unique supplier tax invoice: `TS-INV-<SUP>-<TIMESTAMP>`.
  - Order status advances to `SHIPPED`.
- Goods cannot be cancelled once status reaches `PACKED`.

### 5. Delivery & OTP Verification
- Driver arrives at buyer's address: status $\rightarrow$ `OUT_FOR_DELIVERY` / `ARRIVED`.
- Buyer provides 6-digit confirmation PIN.
- Driver/Supplier calls `POST /api/transport/shipments/:id/confirm-delivery`.
- Status advances to `DELIVERED`, and proof of delivery (POD) is recorded.

### 6. Escrow Release & Disputes
- Delivery starts the 7-day inspection window.
- If goods are damaged/mismatched, buyer raises a dispute via `POST /api/disputes/:orderId`. Escrow status freezes as `FROZEN_DISPUTED`.
- If no dispute occurs, Super Admin (or automated release) executes `POST /api/escrow/:orderId/release`:
  - Deducts platform commission.
  - Creates a verifiable `SupplierPayout` record (`PAY-TS-...`).
  - Marks escrow status as `RELEASED`.

---

## 11. Important API Routes & Services

| Endpoint | Method | Middleware / Auth | Handler / Controller | Service Function |
| :--- | :--- | :--- | :--- | :--- |
| `/api/auth/register-buyer` | POST | Rate Limit, Validator | `authController.registerBuyer` | `authService.registerBuyer` |
| `/api/auth/register-supplier` | POST | Rate Limit, Validator | `authController.registerSupplier` | `authService.registerSupplier` |
| `/api/auth/login` | POST | Rate Limit, Validator | `authController.login` | `authService.login` |
| `/api/auth/admin-login` | POST | Rate Limit, Validator | `authController.adminLogin` | `authService.adminLogin` |
| `/api/products` | GET | `optionalAuth` | `productController.getProducts` | `productService.getProducts` |
| `/api/products/:slug` | GET | `optionalAuth` | `productController.getProductBySlug` | `productService.getProductBySlug` |
| `/api/supplier/products` | POST | `authenticateJWT`, `requireRole('SUPPLIER')` | `supplierProductController.createProduct` | `supplierProductService.createProduct` |
| `/api/supplier/products/bulk/upload` | POST | `authenticateJWT`, `uploadMemory` | `supplierProductController.handleBulkUpload` | `supplierProductService.processBulkExcel` |
| `/api/rfq` | POST | `optionalAuth`, Validator | `rfqController.createRfq` | `rfqService.createRfq` |
| `/api/rfq/:id/quote` | POST | `authenticateJWT`, Validator | `rfqController.submitQuote` | `rfqService.submitQuote` |
| `/api/rfq/quotes/:quoteId/counter` | POST | `optionalAuth`, Validator | `rfqController.counterQuote` | `rfqService.counterOffer` |
| `/api/rfq/quotes/:quoteId/accept` | POST | `optionalAuth` | `rfqController.acceptQuote` | `rfqService.acceptQuote` |
| `/api/orders/calculate` | POST | Public | `orderController.calculateTotals` | `orderService.calculateOrderTotals` |
| `/api/orders` | POST | `optionalAuth`, Validator | `orderController.createOrder` | `orderService.createOrder` |
| `/api/payments/create-order` | POST | `authenticateJWT` | `paymentController.createPaymentOrder` | `paymentService.createOrder` |
| `/api/payments/verify` | POST | `authenticateJWT` | `paymentController.verifyPayment` | `paymentService.verifyPayment` |
| `/api/escrow/:orderId/release` | POST | `authenticateJWT`, `requireRole('ADMIN')` | `escrowController.releasePayout` | `escrowService.releasePayout` |
| `/api/disputes/:orderId` | POST | `authenticateJWT`, `requireRole('BUYER')` | `disputeController.createDispute` | `disputeService.createDispute` |
| `/api/transport/shipments` | POST | `authenticateJWT`, Supplier/Admin | `transport.createShipment` | `shipmentService.createShipment` |
| `/api/super-admin/dashboard` | GET | `authenticateJWT`, `requireRole('SUPER_ADMIN')` | `superAdminController.getDashboard` | `superAdminService.getDashboard` |
| `/api/super-admin/suppliers/:id/kyc/review` | POST | `authenticateJWT`, `requireRole('SUPER_ADMIN')` | `superAdminController.reviewSupplierKyc` | `superAdminService.reviewKyc` |

---

## 12. Coding Standards & Development Rules

1. **Do Not Break Multi-Tab Role Isolation**:
   - Always route authenticated requests through `apiClient.js` or `authorizedApi.js`.
   - Never use global localStorage tokens without referencing `authSession.js`.
2. **Preserve Real Database Logic**:
   - Never replace database endpoints with mock data or static JSON in production.
   - All marketplace products, orders, RFQs, and KYC records must come from MySQL via Prisma.
3. **Database Integrity & Transactions**:
   - Use Prisma transactions (`prisma.$transaction`) for operations spanning multiple models (e.g. order creation + inventory reservation + status logging).
   - Never execute destructive database pushes or reset production tables.
4. **Validation**:
   - Validate every endpoint using `express-validator`.
   - Enforce server-side checks for GSTIN format, PAN format, HSN codes, and password strength. Never rely solely on frontend validation.
5. **UI & Design Tokens**:
   - Maintain TradeExpress branding colors: Emerald Green (`#047857`) and Champagne Gold accents.
   - Use custom component tokens defined in `src/styles/index.css`.
   - Provide explicit loading, empty, error, and success states for all interactive views.

---

## 13. Security Requirements

1. **Credential & Secret Protection**:
   - Never log or return raw passwords, OTP codes, Razorpay webhook secrets, or private API keys in API responses.
   - Environment variables must remain in `.env` and never be leaked into client bundles.
2. **Statutory Data Minimization (India UIDAI & DPDP Act)**:
   - Never store full 12-digit Aadhaar numbers. Store only the masked last 4 digits (`aadhaarLast4`).
   - Mask PAN numbers in safe user outputs (`ABCDE****F`).
3. **Authorization & Ownership Checks**:
   - Never trust client-supplied user IDs in request bodies for identity. Always resolve user identity from `req.user.id`.
   - Verify that suppliers can only view and update their own products, orders, and shipments.
   - Verify that buyers can only view and cancel their own orders.
4. **Idempotency & Double-Submit Protection**:
   - Enforce unique constraint on `Order.idempotencyKey` and `Payment.transactionId` to prevent duplicate billing.

---

## 14. Known Bugs & Incomplete Features (Verified Status)

### Confirmed Bugs
1. **`verificationService.js` PAN-Aadhaar Test Mode Short-Circuit**:
   - **File**: `backend/src/services/verificationService.js` (lines 277–283)
   - **Detail**: In `checkPanAadhaarLinkStatus()`, when `isPanAadhaarTestMode()` is true, the code immediately returns `{ status: 'LINKED', linked: true }` before querying the provider.
   - **Impact**: Causes backend unit test failure in `tests/unit/verificationService.test.js:176` (`test mode never overrides a real NOT_LINKED answer`).
   - **Resolution Required**: Query provider first; only apply test mode fallback if the provider request fails with a network or connection error.

### Incomplete Features & Enhancements
1. **Mocked Telematics Adapter**:
   - **File**: `backend/src/services/transport/providers/ManualTransportProvider.js`
   - **Status**: Fleet management and shipment state machines are fully functional, but external telematics APIs (e.g. GPS tracking via FleetX/WheelsEye) are currently mocked.
2. **Root Workspace Scripting**:
   - The repository lacks a root `package.json`. Developers must execute commands via `npm --prefix backend <cmd>` and `npm --prefix frontend <cmd>`.
3. **Large Client Bundles**:
   - Vite production build produces chunks over 500 kB (`index.js` ~1.2 MB, `ChartCard.js` ~386 kB) due to bundled `recharts` and `lucide-react`. Manual chunking in `vite.config.js` is recommended.

---

## 15. Important Development Decisions & Restrictions

1. **Golden Rule**: Treat TradeExpress as an active, production-grade enterprise marketplace, not a prototype or demo project.
2. **No Unilateral Deletions**: Do not delete or refactor existing features or database models without explicit user instructions.
3. **Verification Before Completion**:
   - Always run the relevant unit tests before reporting a task as complete:
     - Backend: `npm --prefix backend test`
     - Frontend: `npm --prefix frontend test`
     - Production Build: `npm --prefix frontend run build`
   - Never claim a test passed unless it was executed and exited with code 0.
4. **Adherence to CLAUDE.md**: All conventions and requirements outlined in `CLAUDE.md` remain permanently in effect and are complemented by this specification.


