export interface User {
  id: string;
  email: string;
  full_name: string;
  is_platform_admin: boolean;
}
export interface Org {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  status: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
export interface ImageOut {
  id: string;
  sha256: string;
  original_filename: string;
  mime_type: string;
  width: number;
  height: number;
  size_bytes: number;
  duplicate: boolean;
  url: string;
  thumbnail_url: string;
}
export interface JobListItem {
  job_id: string;
  status: string;
  stage: string;
  progress: number;
  error: string | null;
  mode: string;
  created_at: string;
  title: string | null;
  category_slug: string | null;
  category_name: string | null;
  thumbnail_url: string | null;
}
export type Routing = "prefill" | "confirm" | "empty";
export interface AttributeResult {
  attribute_key: string;
  data_type: string;
  ai_value: unknown;
  seller_value: unknown;
  final_value: unknown;
  confidence: number;
  source: string;
  evidence: string;
  image_id: string | null;
  routing: Routing;
  reason: string;
  requires_review: boolean;
  verified: boolean;
}
export interface ContentEntry {
  value: string | string[];
  origin: string;
  version: number;
  history: { version: number; origin: string; value: string | string[] }[];
}
export interface ListingResult {
  job: {
    id: string;
    status: string;
    stage: string;
    progress: number;
    error: string | null;
    provider: string | null;
    model: string | null;
    prompt_version: string | null;
  };
  images: string[];
  category: {
    id: string;
    slug: string;
    name: string;
    confidence: number | null;
    source: string | null;
    candidates: { slug: string; confidence: number; valid: boolean }[];
  } | null;
  analysis: Record<string, unknown> | null;
  ocr: { full_text: string; items: { text: string; kind: string; confidence: number }[]; engine: string } | null;
  attributes: AttributeResult[];
  content: Record<string, ContentEntry>;
  quality: {
    missing_required: string[];
    unsupported_claims: Record<string, string[]>;
    warnings: { code: string; message: string }[];
  };
  usage: { calls: number; input_tokens: number; output_tokens: number; cost_usd: number | null };
  ecommerce_product?: EcommerceProduct;
}

export interface EcommerceProduct {
  id: string;
  sku: string;
  name: string;
  slug: string;
  companyId: string | null;
  supplierId: string | null;
  categorySlug: string;
  subcategory: string | null;
  summary: string | null;
  description: string | null;
  photo: string | null;
  photos?: string[];
  videoUrl: string | null;
  currency: string;
  price: number;
  unit: string;
  moq: number;
  stock: number;
  reservedStock: number;
  committedStock: number;
  lowStockThreshold: number;
  warehouseLocation: string | null;
  leadTimeDays: number;
  status: string;
  featured: boolean;
  trending: boolean;
  readyToShip: boolean;
  isNew: boolean;
  deal: boolean;
  hsnCode: string | null;
  gstRate: number;
  sampleAvailable: boolean;
  samplePrice: number | null;
  moderationStatus: string;
  rejectionReason: string | null;
  weightKg: number | null;
  variants: any;
  specifications: any;
  packaging: any;
  priceTiers: any;
  seo?: {
    seoTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    tags?: string[];
    searchTerms?: string[];
  };
  createdAt: string;
  updatedAt: string;
}
export interface Translation {
  locale: string;
  source_locale: string;
  fields: Record<string, string | string[]>;
  status: string;
  version: number;
  provider: string;
  model: string;
}
export interface Language {
  code: string;
  name: string;
  rtl: boolean;
}
export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  level: number;
  children: CategoryNode[];
}
export interface CategoryAttribute {
  key: string;
  label: string;
  data_type: string;
  required: boolean;
  unit: string | null;
  ocr_extractable: boolean;
  options: { value: string; label: string }[];
}
export interface BulkSummary {
  bulk_id: string;
  total: number;
  status: string;
  counts: Record<string, number>;
  items: { filename: string; status: string; job_id: string | null; progress: number; error: string | null }[];
}

// Commerce & Products
export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  variant_name: string;
  attributes: Record<string, unknown>;
  barcode: string | null;
  is_active: boolean;
}

export interface ProductAttributeValue {
  id: string;
  attribute_key: string;
  value: unknown;
  confidence: number | null;
  source: string;
  evidence: string | null;
  verified: boolean;
}

export interface PricingTier {
  id: string;
  offer_id: string;
  min_quantity: number;
  max_quantity: number | null;
  unit_price: number;
  currency: string;
}

export interface SellerOffer {
  id: string;
  product_id: string;
  variant_id: string | null;
  organization_id: string;
  offer_type: "b2c" | "b2b" | "both";
  retail_price: number | null;
  wholesale_price: number | null;
  currency: string;
  min_order_quantity: number;
  lead_time_days: number;
  stock_quantity: number;
  is_available: boolean;
  notes: string | null;
  pricing_tiers: PricingTier[];
}

export interface Product {
  id: string;
  organization_id: string;
  category_id: string;
  listing_job_id: string | null;
  title: string;
  short_title: string | null;
  brand: string | null;
  model: string | null;
  description: string;
  short_description: string | null;
  highlights: string[];
  status: "draft" | "published" | "archived";
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[];
  tags: string[];
  variants: ProductVariant[];
  attributes: ProductAttributeValue[];
  offers?: SellerOffer[];
}

export interface DuplicateMatch {
  product_id: string | null;
  title: string;
  match_type: string;
  confidence: number;
  reason: string;
}

export interface ComplianceEvaluation {
  market_code: string;
  is_compliant: boolean;
  advisories: { rule: string; reason: string; action_required: string }[];
  violations: { rule: string; reason: string; action_required: string }[];
}

export interface Market {
  code: string;
  name: string;
  default_currency: string;
  languages: string[];
  is_active: boolean;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  exchange_rate_to_usd: number;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status_code: number | null;
  success: boolean;
  response_text: string | null;
  created_at: string;
}
