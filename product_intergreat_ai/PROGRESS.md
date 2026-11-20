# TradeExpress Product Listing AI - Progress

Method: test-driven (tests written first, verified failing, then implemented). Unit tests are pure and fast (`backend/tests/unit`); integration tests hit real PostgreSQL instances with migrations applied (`backend/tests/integration`); frontend tests are verified with Vitest component tests and Next.js production builds.

---

## Milestone 1 - Core Backend Foundation: COMPLETED (Verified)
- [x] FastAPI app factory, validated settings, standard error envelope, security headers, request body size limit.
- [x] PostgreSQL + SQLAlchemy 2.0 Async + Alembic migrations `0001` through `0004` (up/down/up verified on clean DB).
- [x] Auth: Argon2 password hashing, JWT access + rotating refresh tokens with reuse detection, logout, login rate limiting.
- [x] RBAC: Database-driven roles and permissions (`owner`, `admin`, `editor`, `viewer`).
- [x] Organizations, members, seller profiles; tenant context verified via server-checked `X-Organization-Id` or scoped API keys.
- [x] Tenant isolation: server-side verification + PostgreSQL Row Level Security (RLS) policies across all tenant tables.
- [x] Dynamic category hierarchy (4 levels), DB-stored attribute schemas, inheritance, versioned snapshots, value validation endpoint, 25 default categories seeded from `app/seed/categories.json`.
- [x] Audit log (tamper-proof recording for all state-changing commerce and AI actions).

---

## Milestone 2 - AI Vision & Intelligence Engine: COMPLETED (Verified)
- [x] Provider-independent AI architecture with factory pattern:
  - **Gemini Provider** (`gemini-2.5-flash-lite`), structured JSON output, token/latency tracking, prompt-injection defense (`<untrusted_data>` delimiters).
  - **OpenAI Vision Provider** (`gpt-4o-mini`), structured JSON outputs via OpenAI chat completions, token and USD cost tracking, backoff retries.
  - **Fake Provider** for deterministic, offline, and sub-millisecond automated testing.
- [x] Local-disk image storage: MIME validation, SHA-256 deduplication, EXIF orientation correction, thumbnail and optimized image generation, HMAC-signed expiring URLs, path traversal protection.
- [x] Pipeline stages: Image Ingestion -> OCR -> Category Classification -> Attribute Extraction -> Content Generation -> Quality & Compliance Validation.
- [x] Calibrated confidence scoring with policy-driven routing (`prefill`, `confirm`, `empty`), sensitive-attribute checks, unsupported-claim detection.
- [x] Mandatory seller approval workflow: status/result, edit + approve (explicit human sign-off required), per-field regeneration with version history; raw AI value, seller value, and final value tracked independently.

---

## Milestone 3 - B2B/B2C Master Catalog & Commerce Engine: COMPLETED (Verified)
- [x] Database migration `0004_commerce_and_integrations.py`:
  - `products`, `product_variants`, `product_attribute_values`, `product_image_mappings`
  - `seller_offers`, `pricing_tiers`, `markets`, `currencies`
  - `compliance_rules`, `compliance_results`
  - `api_keys`, `api_idempotency_keys`, `webhook_endpoints`, `webhook_deliveries`
- [x] Master Product Catalog Service & Endpoints (`/api/v1/products`):
  - Product CRUD, lifecycle transitions (`draft` -> `published` -> `archived`).
  - `POST /api/v1/products/from-job/{job_id}`: converts approved AI listings into official catalog products, copies verified attributes, creates initial variants, and links seller commercial terms.
- [x] B2B/B2C Commercial Offers Service & Endpoints (`/api/v1/offers`):
  - Seller-controlled commercial terms (retail price, wholesale price, MOQ, stock, lead time).
  - Volume tiered pricing (`PricingTier`) for B2B wholesale orders.
  - Strict rule: AI never invents commercial terms or prices.
- [x] Perceptual Duplicate & Similarity Engine (`/api/v1/ai/duplicates/check`):
  - Exact SHA-256 content match.
  - Perceptual difference hash (dHash, 64-bit via Pillow) with Hamming distance thresholding for scaled, compressed, or cropped duplicates.
  - Brand and model number correlation.
  - Jaccard token text similarity.
- [x] International Compliance Advisory Engine (`/api/v1/compliance/check`, `/api/v1/compliance/rules`):
  - Evaluates technical attributes and product descriptions against target markets (EU CE/RoHS/WEEE, US FCC Part 15/FDA, GCC SASO bilingual labeling, India BIS registration).
  - Flags blocking violations and advisory guidance.

---

## Milestone 4 - Developer Integrations & External Connectivity: COMPLETED (Verified)
- [x] Cryptographic API Keys (`/api/v1/developer/keys`):
  - `tx_live_` prefixed keys generated with 32-byte cryptographic entropy.
  - Secure SHA-256 storage, prefix-based identification, tenant-scoped permissions (`product:read`, `product:write`, `product:publish`, `offer:write`, `ai:run`).
  - Dual authentication: endpoints accept either `Authorization: Bearer <jwt>` or `X-API-Key: tx_live_...`.
- [x] Webhook Delivery & HMAC-SHA256 Signatures (`/api/v1/developer/webhooks`):
  - Subscriptions for `listing.approved` and `product.published` events.
  - HMAC-SHA256 signature generation (`whsec_` secrets) with replay-attack protection via `t=` timestamps.
  - Test ping delivery and delivery logging.
- [x] API Idempotency Keys (`api_idempotency_keys`):
  - Concurrency lock and cached result replay via `Idempotency-Key` header.
- [x] Tabular Bulk CSV Import (`/api/v1/ai/bulk-upload/csv`):
  - Ingests structured CSV feeds, generates jobs, links categories and image URLs.

---

## Milestone 5 - Full-Stack Web Application (Next.js): COMPLETED (Verified)
- [x] AppShell navigation with responsive layout, tenant switcher, user profile, and notification toasts.
- [x] Authentication & Onboarding (`/login`, `/register`, `/settings`):
  - Form validation, password strength rules, organization creation, seller onboarding.
- [x] Master Product Catalog View (`/products`):
  - Search by title, brand, or model; filter by status (`published`, `draft`, `archived`); offer and variant summary badges.
- [x] Master Product Detail & Offer Manager (`/products/[id]`):
  - Comprehensive master product details, verified attributes table with evidence sources.
  - Product variant management (SKU, barcode, name, status) with modal form.
  - B2B/B2C Commercial Offer manager: retail/wholesale pricing, MOQ, stock quantity, lead times.
  - Volume tiered pricing editor.
- [x] Listing Editor Enhancements (`/listings/[id]`):
  - Per-field diff comparison, confidence badges, per-field regeneration.
  - **Duplicate Alert Banner**: queries `/api/v1/ai/duplicates/check` and alerts seller to perceptual image or brand/model duplicates.
  - **Compliance & Market Readiness Tab**: live regulatory evaluations for EU, US, GCC, and India.
  - **Publish to Master Catalog Modal**: one-click publishing from approved AI listings to official catalog products with customized commercial terms.
- [x] Developer Settings Hub (`/settings`):
  - Tabbed interface: Organization & Team, Developer API Keys, Webhooks & Events.
  - Generate, view raw key with one-time copy modal, and revoke API keys.
  - Register webhook URLs, select event topics, send test pings, and view recent delivery logs.

---

## Verification & Test Evidence
- **Backend Pytest Suite:** **213 tests passed, 0 failures** (`python -m pytest tests/unit tests/integration` in 40.86s).
  - 111 Unit tests (AI policy, attribute validation, image processing, security, OpenAI provider, Gemini provider, duplicate detection, compliance).
  - 102 Integration tests (auth, RBAC, tenant isolation, RLS policies, migrations health, product catalog, offers, API keys, webhooks, bulk imports).
- **Frontend Vitest Suite:** **24 tests passed, 0 failures** (`npx vitest run` in 5.60s).
- **TypeScript & Static Analysis:** `npx tsc --noEmit` clean (0 errors).
- **Next.js Production Build:** **16/16 routes compiled and optimized successfully** (`next build`).
