# TradeSphere — Global B2B Wholesale Marketplace

TradeSphere is a full-stack, enterprise-grade B2B marketplace platform for manufacturers, exporters, wholesale buyers, and international trading companies.

---

## Tech Stack

- **Frontend**: React (Vite), Tailwind CSS utility styling + custom component tokens, Lucide Icons.
- **Backend**: Node.js + Express.js modular REST API with route controllers, services, middleware, and centralized error handling.
- **Database**: MySQL 8.0 with **Prisma ORM** (models, relations, migrations, seeding, atomic transactions).
- **Payment Gateway**: Razorpay in **Sandbox Mode** with cryptographic HMAC SHA-256 signature verification and Cash on Delivery (COD) support.
- **Email System**: Nodemailer with SMTP configuration and automatic fallback to Ethereal Email test sandbox with preview URLs.
- **Images**: High-Definition (HD) uncompressed verified photography from Unsplash with multi-tier image fallback handling.

---

## Project Structure

```
TradeSphere-full/
├── frontend/                     # React + Vite client application
│   ├── src/
│   │   ├── components/           # Reusable UI cards, forms, dialogs, modals
│   │   ├── contexts/             # Auth, Cart, Currency, Order, Product contexts
│   │   ├── pages/                # Home, Products, Checkout, OrderConfirmation, OrderTracking, Dashboards
│   │   ├── services/             # apiClient, orderService, paymentService, productService
│   │   ├── utils/                # images (HD mappings), calculateTotals, formatDate, units
│   │   └── routes/               # AppRoutes (Public, RoleRoute, ProtectedRoute)
│   ├── .env                      # Local frontend environment config
│   ├── .env.example              # Template frontend environment variables
│   └── package.json
│
├── backend/                      # Node.js + Express.js REST API
│   ├── prisma/
│   │   ├── schema.prisma         # Prisma MySQL database schema
│   │   └── seed.js               # Database seeding (categories, users, 51 products)
│   ├── src/
│   │   ├── config/               # db (Prisma), env, mailer (Nodemailer), razorpay
│   │   ├── controllers/          # auth, product, category, order, payment, tracking
│   │   ├── middleware/           # authMiddleware (JWT), errorHandler, validate
│   │   ├── routes/               # REST API route definitions
│   │   ├── services/             # Business logic, transactions, email, payment verification
│   │   ├── utils/                # jwt, orderNumber generator, emailTemplates (HTML)
│   │   ├── app.js                # Express app configuration & middleware
│   │   └── server.js             # Server entry point
│   ├── scripts/
│   │   └── verify-all.js         # Automated end-to-end verification test suite
│   ├── .env                      # Local backend environment config
│   ├── .env.example              # Template backend environment variables
│   └── package.json
└── README.md                     # Monorepo documentation
```

---

## Getting Started Locally (Windows / macOS / Linux)

### 1. Prerequisites

- **Node.js**: v18.0.0 or later
- **MySQL Server**: 8.0 or later (running locally on port 3306 or remote)
- **npm** or **pnpm**

---

### 2. Database Setup (MySQL)

1. Ensure MySQL Server is running.
2. Create the database:
   ```sql
   CREATE DATABASE tradesphere_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. In `backend/.env`, configure your database connection string:
   ```env
   DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/tradesphere_db"
   ```

---

### 3. Backend Setup

1. Open a terminal and navigate to `backend/`:
   ```bash
   cd backend
   npm install
   ```
2. Generate Prisma Client and push the schema to MySQL:
   ```bash
   npm run prisma:generate
   npm run prisma:push
   ```
3. Seed the database with categories, default users, and 51 wholesale products:
   ```bash
   npm run prisma:seed
   ```
4. Start the backend development server:
   ```bash
   npm start
   # or with live reloading:
   npm run dev
   ```
   The backend server runs on `http://localhost:5000/api`.

---

### 4. Frontend Setup

1. Open a new terminal and navigate to `frontend/`:
   ```bash
   cd frontend
   npm install
   ```
2. Ensure `frontend/.env` points to the backend:
   ```env
   VITE_PUBLIC_API_BASE_URL=http://localhost:5000/api
   VITE_PUBLIC_API_PRODUCTS_PATH=products
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend runs on `http://localhost:5173`.

---

## Default Seeded Accounts

The seed script creates the following pre-configured accounts:

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Buyer** | `buyer@tradesphere.com` | `TradeSphere@2026` | Verified wholesale buyer with saved address |
| **Supplier** | `supplier@novatech.com` | `TradeSphere@2026` | Verified electronics manufacturer |
| **Admin** | `krajvanshi244@gmail.com` | `modiji@12345` | Platform super administrator with full panel access (`/admin/login`) |

---

## Payment Gateway Sandbox Configuration

Online payments are processed through **Razorpay** in sandbox/test mode:

- In `backend/.env`:
  ```env
  RAZORPAY_KEY_ID="rzp_test_placeholder_key"
  RAZORPAY_KEY_SECRET="placeholder_secret_key"
  PAYMENT_GATEWAY_MODE="sandbox"
  ```
- **How Verification Works**:
  1. The client initiates an order on the backend (`POST /api/orders`).
  2. The server verifies stock, MOQ, and server-side pricing.
  3. The payment gateway generates an order ID (`POST /api/payments/create-order`).
  4. In sandbox mode, the backend generates and validates an HMAC SHA-256 signature (`POST /api/payments/verify` or `POST /api/payments/sandbox-pay`).
  5. The order status is transactionally updated to `ORDER_CONFIRMED` and `paymentStatus` to `PAID`.
  6. Cash on Delivery (COD) orders are confirmed immediately with `paymentStatus: 'COD'`.

---

## Email Notifications (Nodemailer SMTP)

Order confirmation emails are dispatched automatically upon order confirmation:

- **SMTP Configuration** (`backend/.env`):
  ```env
  SMTP_HOST="smtp.gmail.com"
  SMTP_PORT=587
  SMTP_SECURE=false
  SMTP_USER="your-email@gmail.com"
  SMTP_PASS="your-16-character-app-password"
  SMTP_FROM="TradeSphere Orders <orders@tradesphere.com>"
  ```
- **Fallback Behavior**:
  If no SMTP credentials are provided, Nodemailer automatically creates an ephemeral **Ethereal Email** test account and logs the public preview link in the backend console (e.g. `https://ethereal.email/message/...`).
- **Template Details**:
  - Branded TradeSphere HTML header and styling
  - Itemized product table with public HTTPS photographs
  - Order reference number and date
  - Subtotal, Shipping fee, 18% GST calculation, and Grand Total
  - Shipping address and payment method
  - Clickable direct link to **Track My Order** (`/track/:orderNumber`)

---

## Order Tracking

The `/track/:orderNumber` page renders a visual progress timeline with 6 lifecycle stages:
1. **Order Placed**: Logged in database with initial status.
2. **Order Confirmed**: Payment verified or Cash on Delivery approved.
3. **Processing**: Items picked and packed at the supplier warehouse.
4. **Shipped**: Dispatched with freight carrier.
5. **Out for Delivery**: Local courier handoff for final delivery.
6. **Delivered**: Goods delivered and signed.

Support for **Cancelled** and **Refunded** states is included, displaying appropriate alerts and stopping further progression.

---

## Running Verification Tests

To verify the entire full-stack pipeline end-to-end:

```bash
cd backend
npm run test:e2e
```

The test suite runs 27 automated assertions verifying:
1. MySQL database connection & seeded tables
2. User authentication & JWT token generation
3. Product catalog retrieval & HD image integrity
4. Server-side inventory, MOQ, and tiered price calculations
5. Cash on Delivery (COD) order flow & stock decrement
6. Duplicate order submission prevention (Idempotency)
7. Online payment sandbox creation & HMAC SHA-256 signature verification
8. Order confirmation email dispatch & HTML rendering
9. Multi-stage order tracking API & lifecycle timeline
10. Order status progression persistence in MySQL
