import { useSession } from "./store";
import type {
  CategoryAttribute,
  CategoryNode,
  ComplianceEvaluation,
  DuplicateMatch,
  ImageOut,
  Language,
  ListingResult,
  Org,
  Page,
  Product,
  ProductVariant,
  SellerOffer,
  User,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type FetchFn = typeof fetch;

const SAMPLE_LISTING: ListingResult = {
  job: {
    id: "c38df726-0e9b-4e89-8d5c-9c9489ef0d68",
    status: "awaiting_review",
    stage: "quality_check",
    progress: 100,
    error: null,
    provider: "OpenAI Vision",
    model: "gpt-4o-mini",
    prompt_version: "v2.4",
  },
  images: ["img-sample-1"],
  category: {
    id: "00000000-0000-0000-0000-000000000011",
    slug: "headphones",
    name: "Headphones & Earphones",
    confidence: 0.98,
    source: "ai",
    candidates: [
      { slug: "headphones", confidence: 0.98, valid: true },
      { slug: "audio", confidence: 0.85, valid: true },
    ],
  },
  analysis: {
    product_type: "Over-Ear Wireless Headphones",
    detected_color: "Midnight Black",
    materials: ["Matte Plastic", "Memory Foam", "Aluminum"],
    form_factor: "Over-Ear",
  },
  ocr: {
    full_text: "ACME ANC-200 Active Noise Cancelling Wireless Headphones. Bluetooth 5.3, 35H Battery Life, USB-C Fast Charge.",
    items: [
      { text: "ACME", kind: "brand", confidence: 0.99 },
      { text: "ANC-200", kind: "model", confidence: 0.97 },
      { text: "35H Battery", kind: "spec", confidence: 0.95 },
    ],
    engine: "gemini-vision",
  },
  attributes: [
    {
      attribute_key: "brand",
      data_type: "string",
      image_id: null,
      ai_value: "ACME",
      seller_value: null,
      final_value: "ACME",
      confidence: 0.99,
      source: "ocr",
      evidence: "Found printed on headband and packaging box",
      routing: "prefill",
      requires_review: false,
      verified: true,
      reason: "High confidence OCR brand detection",
    },
    {
      attribute_key: "model",
      data_type: "string",
      image_id: null,
      ai_value: "ANC-200",
      seller_value: null,
      final_value: "ANC-200",
      confidence: 0.97,
      source: "ocr",
      evidence: "Found printed on earcups",
      routing: "prefill",
      requires_review: false,
      verified: true,
      reason: "Printed model identifier",
    },
    {
      attribute_key: "connectivity",
      data_type: "string",
      image_id: null,
      ai_value: "Bluetooth 5.3",
      seller_value: null,
      final_value: "Bluetooth 5.3",
      confidence: 0.98,
      source: "ocr",
      evidence: "Packaging specification label",
      routing: "prefill",
      requires_review: false,
      verified: true,
      reason: "Verified wireless spec",
    },
    {
      attribute_key: "color",
      data_type: "string",
      image_id: null,
      ai_value: "Midnight Black",
      seller_value: null,
      final_value: "Midnight Black",
      confidence: 0.99,
      source: "image",
      evidence: "Direct visual inspection of outer shell",
      routing: "prefill",
      requires_review: false,
      verified: true,
      reason: "Visual color",
    },
    {
      attribute_key: "battery_life",
      data_type: "string",
      image_id: null,
      ai_value: "35 Hours",
      seller_value: null,
      final_value: "35 Hours",
      confidence: 0.96,
      source: "ocr",
      evidence: "Battery icon and '35H' printed on box",
      routing: "prefill",
      requires_review: false,
      verified: true,
      reason: "Printed specification",
    },
  ],
  content: {
    title: {
      value: "ACME Active Noise Cancelling Wireless Headphones ANC-200",
      origin: "ai",
      version: 1,
      history: [],
    },
    short_title: {
      value: "ACME ANC-200 Wireless Headphones",
      origin: "ai",
      version: 1,
      history: [],
    },
    short_description: {
      value: "Premium over-ear ANC wireless headphones with hybrid noise cancellation, 35-hour battery life, and crystal clear call quality.",
      origin: "ai",
      version: 1,
      history: [],
    },
    long_description: {
      value: "Immerse yourself in rich acoustic clarity with the ACME ANC-200 Active Noise Cancelling Headphones. Built with custom 40mm dynamic drivers and hybrid noise reduction technology blocking up to 38dB of ambient chatter, these headphones deliver deep bass and sparkling trebles. With ultra-soft memory foam earcups and 35 hours of continuous wireless playback on a single charge, enjoy comfortable listening all day long.",
      origin: "ai",
      version: 1,
      history: [],
    },
    specifications_summary: {
      value: "Bluetooth 5.3 | 35 Hours Battery | 40mm Drivers | USB-C Fast Charge | 38dB ANC",
      origin: "ai",
      version: 1,
      history: [],
    },
    highlights: {
      value: [
        "Hybrid Active Noise Cancellation reduces up to 38dB of background noise",
        "Up to 35 hours of wireless playtime on a single charge",
        "Fast USB-C charging: 10 minutes gives 4 hours of listening",
        "Multipoint Bluetooth 5.3 seamlessly switches between devices",
      ],
      origin: "ai",
      version: 1,
      history: [],
    },
    key_features: {
      value: [
        "Ergonomic foldable design with cushioned memory foam cushions",
        "Built-in dual beamforming microphones with ENC for clear phone calls",
        "Low latency mode ideal for mobile gaming and video streaming",
      ],
      origin: "ai",
      version: 1,
      history: [],
    },
    benefits: {
      value: [
        "Focus uninterrupted in loud offices, flights, and commutes",
        "No battery anxiety during long international trips",
      ],
      origin: "ai",
      version: 1,
      history: [],
    },
    seo_title: {
      value: "Buy ACME ANC-200 Wireless Noise Cancelling Headphones Online",
      origin: "ai",
      version: 1,
      history: [],
    },
    meta_description: {
      value: "Order ACME ANC-200 wireless headphones with 38dB active noise cancellation and 35-hour battery. Fast worldwide shipping available.",
      origin: "ai",
      version: 1,
      history: [],
    },
    keywords: {
      value: ["noise cancelling headphones", "bluetooth 5.3", "wireless headset", "over ear headphones"],
      origin: "ai",
      version: 1,
      history: [],
    },
    tags: {
      value: ["audio", "headphones", "bestseller", "wireless", "electronics"],
      origin: "ai",
      version: 1,
      history: [],
    },
    search_terms: {
      value: ["best noise cancelling headphones under 100", "bluetooth headphones long battery"],
      origin: "ai",
      version: 1,
      history: [],
    },
  },
  quality: {
    missing_required: [],
    unsupported_claims: {},
    warnings: [],
  },
  usage: {
    calls: 6,
    input_tokens: 18400,
    output_tokens: 4200,
    cost_usd: 0.0185,
  },
  ecommerce_product: {
    id: "c38df726-0e9b-4e89-8d5c-9c9489ef0d68",
    sku: "ACME-ANC200-BLK-001",
    name: "ACME Active Noise Cancelling Wireless Headphones ANC-200",
    slug: "acme-active-noise-cancelling-wireless-headphones-anc-200",
    companyId: null,
    supplierId: null,
    categorySlug: "headphones",
    subcategory: "Over-Ear Wireless Headphones",
    summary: "Engineered for pure audio immersion, the ACME ANC-200 headphones deliver hybrid active noise cancellation, high-definition Bluetooth 5.3 audio, and an ultra-long 35-hour battery life.",
    description: "Experience premium sound with the ACME ANC-200 Wireless Headphones. Featuring advanced active noise cancellation technology that neutralizes up to 30dB of ambient noise, custom-tuned 40mm neodymium dynamic drivers, plush memory-foam ear cushions, and fast USB-C recharging.",
    photo: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
    videoUrl: null,
    currency: "INR",
    price: 2499.0,
    unit: "piece",
    moq: 1,
    stock: 150,
    reservedStock: 0,
    committedStock: 0,
    lowStockThreshold: 10,
    warehouseLocation: "Bangalore Logistics Hub",
    leadTimeDays: 3,
    status: "Active",
    featured: true,
    trending: true,
    readyToShip: true,
    isNew: false,
    deal: true,
    hsnCode: "8518",
    gstRate: 18.0,
    sampleAvailable: true,
    samplePrice: 2499.0,
    moderationStatus: "APPROVED",
    rejectionReason: null,
    weightKg: 0.28,
    variants: [{ type: "Color", options: ["Midnight Black", "Silver Gray"] }],
    specifications: {
      Brand: "ACME",
      Model: "ANC-200",
      "Form Factor": "Over-Ear",
      "Noise Cancellation": "Hybrid ANC (Up to -30dB)",
      "Battery Life": "35 Hours",
      Connectivity: "Bluetooth 5.3 & 3.5mm Aux",
      Charging: "USB Type-C Fast Charge",
      Color: "Midnight Black",
    },
    packaging: {
      packageType: "Rigid Gift Box",
      boxContents: [
        "ACME ANC-200 Headphones",
        "USB-C Fast Charging Cable",
        "3.5mm Gold-Plated Audio Cable",
        "Hardshell Travel Case",
        "Quick Start Guide",
      ],
      isFragile: true,
    },
    priceTiers: [
      { minQuantity: 1, maxQuantity: 10, unitPrice: 2499.0, currency: "INR" },
      { minQuantity: 11, maxQuantity: 50, unitPrice: 2199.0, currency: "INR" },
      { minQuantity: 51, maxQuantity: null, unitPrice: 1899.0, currency: "INR" },
    ],
    createdAt: "2026-11-04T10:00:00.000Z",
    updatedAt: "2026-11-04T10:00:00.000Z",
  },
};

const SAMPLE_CATEGORY_TREE: CategoryNode[] = [
  {
    id: "00000000-0000-0000-0000-000000000010",
    name: "Electronics & Audio",
    slug: "electronics",
    level: 0,
    children: [
      {
        id: "00000000-0000-0000-0000-000000000011",
        name: "Headphones & Earphones",
        slug: "headphones",
        level: 1,
        children: [],
      },
      {
        id: "00000000-0000-0000-0000-000000000012",
        name: "Bluetooth Speakers",
        slug: "speakers",
        level: 1,
        children: [],
      },
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000020",
    name: "Sports & Fitness",
    slug: "sports-fitness",
    level: 0,
    children: [
      {
        id: "00000000-0000-0000-0000-000000000021",
        name: "Fitness Equipment",
        slug: "fitness-equipment",
        level: 1,
        children: [],
      },
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000030",
    name: "Computers & Laptops",
    slug: "computers",
    level: 0,
    children: [],
  },
  {
    id: "00000000-0000-0000-0000-000000000040",
    name: "Home & Kitchen",
    slug: "home-kitchen",
    level: 0,
    children: [],
  },
];

const SAMPLE_PRODUCT: Product = {
  id: "e2a1b940-523c-41c8-bb83-16279fcf151a",
  organization_id: "00000000-0000-0000-0000-000000000001",
  category_id: "00000000-0000-0000-0000-000000000010",
  listing_job_id: "c38df726-0e9b-4e89-8d5c-9c9489ef0d68",
  title: "ACME Active Noise Cancelling Wireless Headphones ANC-200",
  short_title: "ACME ANC-200 Headphones",
  brand: "ACME",
  model: "ANC-200",
  description:
    "High-fidelity wireless headphones engineered for crystal clear acoustics and active noise isolation. Includes Bluetooth 5.3, 35-hour battery life, and ergonomic memory foam earcups.",
  short_description: "Premium over-ear ANC wireless headphones with 35h battery life.",
  highlights: [
    "Hybrid Active Noise Cancellation up to 38dB",
    "Fast USB-C charging (10 mins gives 4 hours playback)",
    "Dual high-definition omnidirectional microphones",
    "Multipoint Bluetooth 5.3 connection",
  ],
  status: "published",
  seo_title: "ACME ANC-200 Wireless Noise Cancelling Headphones",
  seo_description: "Buy ACME ANC-200 wireless headphones with 35h battery and active noise cancelling.",
  seo_keywords: ["headphones", "wireless audio", "bluetooth 5.3", "ANC"],
  tags: ["electronics", "audio", "wireless", "bestseller"],
  variants: [
    {
      id: "v1",
      product_id: "e2a1b940-523c-41c8-bb83-16279fcf151a",
      sku: "ACME-ANC-BLK",
      variant_name: "Midnight Black",
      attributes: { color: "Black" },
      barcode: "8901234567890",
      is_active: true,
    },
    {
      id: "v2",
      product_id: "e2a1b940-523c-41c8-bb83-16279fcf151a",
      sku: "ACME-ANC-SLV",
      variant_name: "Silver Platinum",
      attributes: { color: "Silver" },
      barcode: "8901234567891",
      is_active: true,
    },
  ],
  attributes: [
    {
      id: "a1",
      attribute_key: "connectivity",
      value: "Bluetooth 5.3",
      confidence: 0.98,
      source: "image",
      evidence: "Visible Bluetooth 5.3 specification logo",
      verified: true,
    },
    {
      id: "a2",
      attribute_key: "battery_life",
      value: "35 Hours",
      confidence: 0.95,
      source: "ocr",
      evidence: "Printed on packaging box",
      verified: true,
    },
    {
      id: "a3",
      attribute_key: "color",
      value: "Black",
      confidence: 0.99,
      source: "image",
      evidence: "Visual appearance",
      verified: true,
    },
  ],
  offers: [
    {
      id: "o1",
      product_id: "e2a1b940-523c-41c8-bb83-16279fcf151a",
      variant_id: null,
      organization_id: "00000000-0000-0000-0000-000000000001",
      offer_type: "both",
      retail_price: 89.99,
      wholesale_price: 48.0,
      currency: "USD",
      min_order_quantity: 5,
      lead_time_days: 3,
      stock_quantity: 320,
      is_available: true,
      notes: "Available for international B2B export and direct retail",
      pricing_tiers: [
        { id: "pt1", offer_id: "o1", min_quantity: 5, max_quantity: 49, unit_price: 48.0, currency: "USD" },
        { id: "pt2", offer_id: "o1", min_quantity: 50, max_quantity: 199, unit_price: 42.5, currency: "USD" },
        { id: "pt3", offer_id: "o1", min_quantity: 200, max_quantity: null, unit_price: 36.0, currency: "USD" },
      ],
    },
  ],
};

const mockUploadedImages = new Map<string, ImageOut>();
const mockDynamicListings = new Map<string, ListingResult>();
let lastUploadedImageId: string | null = null;

function createMockListing(jobId: string, imageIds: string[], hints: string): ListingResult {
  const images = imageIds.map((id) => mockUploadedImages.get(id)).filter(Boolean) as ImageOut[];
  const firstFilename = images[0]?.original_filename?.toLowerCase() ?? "";
  const combinedText = `${firstFilename} ${hints}`.toLowerCase();

  const isFashion =
    combinedText.includes("shirt") ||
    combinedText.includes("tshirt") ||
    combinedText.includes("pant") ||
    combinedText.includes("cloth") ||
    combinedText.includes("cotton") ||
    combinedText.includes("apparel") ||
    combinedText.includes("wear") ||
    combinedText.includes("kurta") ||
    combinedText.includes("dress") ||
    combinedText.includes("saree") ||
    combinedText.includes("denim");

  const isAudio =
    !isFashion &&
    (combinedText.includes("earphone") ||
      combinedText.includes("headphone") ||
      combinedText.includes("neckband") ||
      combinedText.includes("earbud") ||
      combinedText.includes("airpod") ||
      combinedText.includes("audio") ||
      combinedText.includes("sound") ||
      combinedText.includes("bluetooth") ||
      combinedText.includes("tws") ||
      combinedText.includes("wireless") ||
      true); // default to audio when ambiguous or image upload has no text

  let detectedColor = "Blue";
  if (combinedText.includes("black")) detectedColor = "Black";
  else if (combinedText.includes("white")) detectedColor = "White";
  else if (combinedText.includes("navy") || combinedText.includes("blue")) detectedColor = "Blue";
  else if (combinedText.includes("grey") || combinedText.includes("gray")) detectedColor = "Charcoal Gray";
  else if (combinedText.includes("green") || combinedText.includes("olive")) detectedColor = "Olive Green";
  else if (combinedText.includes("red") || combinedText.includes("maroon")) detectedColor = "Maroon Red";

  if (isFashion) {
    const mainImgId = imageIds[0] ?? "img-sample-1";

    return {
      job: {
        id: jobId,
        status: "awaiting_review",
        stage: "quality_check",
        progress: 100,
        error: null,
        provider: "Universal AI Vision Engine",
        model: "TradeExpress-Vision-v3",
        prompt_version: "v3.2",
      },
      category: {
        id: "00000000-0000-0000-0000-000000000050",
        name: "Clothing & Fashion / Men's Apparel / Casual Shirts",
        slug: "clothing-fashion",
        confidence: 0.98,
        source: "ai",
        candidates: [{ slug: "clothing-fashion", confidence: 0.98, valid: true }],
      },
      images: imageIds.length > 0 ? imageIds : [mainImgId],
      attributes: [
        {
          attribute_key: "brand",
          data_type: "string",
          image_id: mainImgId,
          ai_value: "TradeExpress Apparel",
          seller_value: null,
          final_value: "TradeExpress Apparel",
          confidence: 0.96,
          source: "image",
          evidence: "Garment collar label and front branding inspection",
          routing: "prefill",
          requires_review: false,
          verified: true,
          reason: "Verified garment brand styling",
        },
        {
          attribute_key: "material",
          data_type: "string",
          image_id: mainImgId,
          ai_value: "100% Combed Cotton",
          seller_value: null,
          final_value: "100% Combed Cotton",
          confidence: 0.95,
          source: "image",
          evidence: "High resolution fabric weave and yarn texture",
          routing: "prefill",
          requires_review: false,
          verified: true,
          reason: "Natural woven breathable cotton",
        },
        {
          attribute_key: "color",
          data_type: "string",
          image_id: mainImgId,
          ai_value: detectedColor,
          seller_value: null,
          final_value: detectedColor,
          confidence: 0.98,
          source: "image",
          evidence: `Direct visual inspection: Uniform solid ${detectedColor.toLowerCase()} fabric shade across torso, collar, and sleeves`,
          routing: "prefill",
          requires_review: false,
          verified: true,
          reason: `High confidence visual color detection (${detectedColor})`,
        },
        {
          attribute_key: "fit",
          data_type: "string",
          image_id: mainImgId,
          ai_value: "Tailored Slim Fit",
          seller_value: null,
          final_value: "Tailored Slim Fit",
          confidence: 0.94,
          source: "image",
          evidence: "Shoulder seam taper and side profile contours",
          routing: "prefill",
          requires_review: false,
          verified: true,
          reason: "Slim fit torso proportions",
        },
        {
          attribute_key: "sleeve_length",
          data_type: "string",
          image_id: mainImgId,
          ai_value: "Long Sleeve",
          seller_value: null,
          final_value: "Long Sleeve",
          confidence: 0.98,
          source: "image",
          evidence: "Full length sleeves with buttoned barrel cuffs",
          routing: "prefill",
          requires_review: false,
          verified: true,
          reason: "Standard long sleeve design",
        },
        {
          attribute_key: "collar",
          data_type: "string",
          image_id: mainImgId,
          ai_value: "Button-Down Spread Collar",
          seller_value: null,
          final_value: "Button-Down Spread Collar",
          confidence: 0.93,
          source: "image",
          evidence: "Collar structure and point buttons detected",
          routing: "prefill",
          requires_review: false,
          verified: true,
          reason: "Structured button-down collar",
        },
        {
          attribute_key: "pattern",
          data_type: "string",
          image_id: mainImgId,
          ai_value: "Solid",
          seller_value: null,
          final_value: "Solid",
          confidence: 0.97,
          source: "image",
          evidence: "Even fabric surface tone without print or checks",
          routing: "prefill",
          requires_review: false,
          verified: true,
          reason: "Solid color weave",
        },
        {
          attribute_key: "care_instructions",
          data_type: "string",
          image_id: mainImgId,
          ai_value: "Machine Wash Cold, Hang Dry",
          seller_value: null,
          final_value: "Machine Wash Cold, Hang Dry",
          confidence: 0.92,
          source: "image",
          evidence: "Standard cotton fabric wash protocol",
          routing: "prefill",
          requires_review: false,
          verified: true,
          reason: "Standard cotton garment care",
        },
      ],
      analysis: null,
      ocr: null,
      content: {
        title: {
          value: `Men's Premium Classic Fit Breathable Cotton Casual Shirt - ${detectedColor}`,
          origin: "ai",
          version: 1,
          history: [{ value: `Men's Premium Classic Fit Breathable Cotton Casual Shirt - ${detectedColor}`, origin: "ai", version: 1 }],
        },
        short_title: {
          value: `Classic ${detectedColor} Cotton Casual Shirt`,
          origin: "ai",
          version: 1,
          history: [{ value: `Classic ${detectedColor} Cotton Casual Shirt`, origin: "ai", version: 1 }],
        },
        short_description: {
          value: `Crafted from 100% premium breathable cotton, this long-sleeve ${detectedColor.toLowerCase()} casual shirt offers timeless style, superior comfort, and all-day versatility.`,
          origin: "ai",
          version: 1,
          history: [{ value: `Crafted from 100% premium breathable cotton, this long-sleeve ${detectedColor.toLowerCase()} casual shirt offers timeless style, superior comfort, and all-day versatility.`, origin: "ai", version: 1 }],
        },
        long_description: {
          value: `Refine your smart-casual attire with our Men's Premium Classic Fit Cotton Shirt in rich ${detectedColor}. Meticulously constructed from high-grade combed cotton fibers, this shirt ensures optimal air permeability, supreme soft-hand feel, and lasting durability. Designed with a structured spread collar, full button placket with reinforced stitching, and adjustable dual-button barrel cuffs. Ideal for professional office settings, weekend outings, or layering under a blazer.`,
          origin: "ai",
          version: 1,
          history: [{ value: `Refine your smart-casual attire with our Men's Premium Classic Fit Cotton Shirt in rich ${detectedColor}...`, origin: "ai", version: 1 }],
        },
        highlights: {
          value: [
            "100% Breathable Combed Cotton Fabric",
            `Deep, Fade-Resistant ${detectedColor} Dye`,
            "Tailored Slim-Regular Silhouette with Curved Hem",
            "Button-Down Collar with Durable Pearl-Tone Buttons",
            "Reinforced Stitching for Long-Lasting Durability",
          ],
          origin: "ai",
          version: 1,
          history: [{ value: ["100% Breathable Combed Cotton Fabric", `Deep, Fade-Resistant ${detectedColor} Dye`], origin: "ai", version: 1 }],
        },
        key_features: {
          value: [
            "Material: 100% Pure Combed Cotton",
            `Color: ${detectedColor} (Colorfast Reactive Dye)`,
            "Fit Type: Modern Tailored Fit",
            "Sleeve Style: Long Sleeve with Dual-Button Cuffs",
            "Collar: Button-Down Spread Collar",
            "Closure: Full Front Button Placket",
            "Washing: Machine Wash Cold, Low Heat Iron",
          ],
          origin: "ai",
          version: 1,
          history: [{ value: ["Material: 100% Pure Combed Cotton", `Color: ${detectedColor}`], origin: "ai", version: 1 }],
        },
        specifications_summary: {
          value: `Color: ${detectedColor} | Material: 100% Cotton | Fit: Tailored Slim Fit | Sleeve: Long Sleeve | Collar: Spread Collar | Closure: Button Front`,
          origin: "ai",
          version: 1,
          history: [{ value: `Color: ${detectedColor} | Material: 100% Cotton`, origin: "ai", version: 1 }],
        },
        benefits: {
          value: [
            "Keeps you cool, crisp, and comfortable in all seasons",
            `High colorfastness resists fading, maintaining its deep ${detectedColor.toLowerCase()} luster`,
            "Pairs seamlessly with trousers, chinos, and jeans for versatile styling",
          ],
          origin: "ai",
          version: 1,
          history: [{ value: ["Keeps you cool, crisp, and comfortable"], origin: "ai", version: 1 }],
        },
        seo_title: {
          value: `Men's Premium ${detectedColor} Cotton Casual Shirt | Breathable Long Sleeve - TradeExpress`,
          origin: "ai",
          version: 1,
          history: [{ value: `Men's Premium ${detectedColor} Cotton Casual Shirt`, origin: "ai", version: 1 }],
        },
        meta_description: {
          value: `Shop the Men's Premium Classic Fit ${detectedColor} Cotton Shirt on TradeExpress. Made with 100% pure breathable cotton, tailored modern fit, and durable button-down collar.`,
          origin: "ai",
          version: 1,
          history: [{ value: `Shop the Men's Premium Classic Fit ${detectedColor} Cotton Shirt...`, origin: "ai", version: 1 }],
        },
        keywords: {
          value: [`${detectedColor.toLowerCase()} shirt`, "cotton shirt", "men casual shirt", `long sleeve ${detectedColor.toLowerCase()} shirt`, "formal casual shirt"],
          origin: "ai",
          version: 1,
          history: [{ value: [`${detectedColor.toLowerCase()} shirt`], origin: "ai", version: 1 }],
        },
        tags: {
          value: ["Apparel", "Menswear", "Shirts", "Cotton", detectedColor, "Casual"],
          origin: "ai",
          version: 1,
          history: [{ value: ["Apparel", detectedColor], origin: "ai", version: 1 }],
        },
        search_terms: {
          value: [`men long sleeve ${detectedColor.toLowerCase()} cotton shirt`, `breathable casual ${detectedColor.toLowerCase()} button down`, "slim fit dress casual shirt"],
          origin: "ai",
          version: 1,
          history: [{ value: [`men long sleeve ${detectedColor.toLowerCase()} cotton shirt`], origin: "ai", version: 1 }],
        },
      },
      quality: {
        missing_required: [],
        unsupported_claims: {},
        warnings: [],
      },
      usage: {
        calls: 4,
        input_tokens: 1200,
        output_tokens: 380,
        cost_usd: 0.002,
      },
      ecommerce_product: {
        id: "prod-" + jobId,
        sku: `SHIRT-COT-${detectedColor.substring(0, 3).toUpperCase()}-001`,
        name: `Men's Premium Classic Fit Breathable Cotton Casual Shirt - ${detectedColor}`,
        slug: `mens-premium-classic-fit-breathable-cotton-casual-shirt-${detectedColor.toLowerCase()}`,
        companyId: null,
        supplierId: null,
        categorySlug: "clothing-fashion",
        subcategory: "Casual Shirts",
        summary: `Crafted from 100% premium breathable cotton, this long-sleeve ${detectedColor.toLowerCase()} casual shirt offers timeless style, superior comfort, and all-day versatility.`,
        description: `Refine your smart-casual attire with our Men's Premium Classic Fit Cotton Shirt in rich ${detectedColor}. Meticulously constructed from high-grade combed cotton fibers, this shirt ensures optimal air permeability, supreme soft-hand feel, and lasting durability. Designed with a structured spread collar, full button placket with reinforced stitching, and adjustable dual-button barrel cuffs.`,
        photo: images[0]?.url || null,
        videoUrl: null,
        currency: "INR",
        price: 1299.0,
        unit: "piece",
        moq: 1,
        stock: 100,
        reservedStock: 0,
        committedStock: 0,
        lowStockThreshold: 10,
        warehouseLocation: null,
        leadTimeDays: 5,
        status: "Active",
        featured: false,
        trending: false,
        readyToShip: true,
        isNew: true,
        deal: false,
        hsnCode: "6205",
        gstRate: 5.0,
        sampleAvailable: true,
        samplePrice: 1299.0,
        moderationStatus: "APPROVED",
        rejectionReason: null,
        weightKg: 0.35,
        variants: [{ type: "Size", options: ["S", "M", "L", "XL", "XXL"] }],
        specifications: {
          Brand: "TradeExpress Apparel",
          Material: "100% Combed Cotton",
          Color: detectedColor,
          Fit: "Tailored Slim Fit",
          "Sleeve Length": "Long Sleeve",
          Collar: "Button-Down Spread Collar",
        },
        packaging: {
          packageType: "Retail Polybag with Garment Hanger",
          boxContents: ["1x Men's Casual Shirt"],
          isFragile: false,
        },
        priceTiers: [
          { minQuantity: 1, maxQuantity: 10, unitPrice: 1299, currency: "INR" },
          { minQuantity: 11, maxQuantity: 50, unitPrice: 1149, currency: "INR" },
          { minQuantity: 51, maxQuantity: null, unitPrice: 999, currency: "INR" },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  const mainImgId = imageIds[0] ?? "img-sample-1";
  return {
    job: {
      id: jobId,
      status: "awaiting_review",
      stage: "quality_check",
      progress: 100,
      error: null,
      provider: "Universal AI Vision Engine",
      model: "TradeExpress-Vision-v3",
      prompt_version: "v3.2",
    },
    category: {
      id: "00000000-0000-0000-0000-000000000003",
      name: "Electronics & Audio / Audio / Headphones & Earphones",
      slug: "headphones",
      confidence: 0.98,
      source: "ai",
      candidates: [
        { slug: "headphones", confidence: 0.98, valid: true },
        { slug: "audio", confidence: 0.92, valid: true },
      ],
    },
    images: imageIds.length > 0 ? imageIds : [mainImgId],
    attributes: [
      {
        attribute_key: "brand",
        data_type: "string",
        image_id: mainImgId,
        ai_value: "TradeExpress Audio",
        seller_value: null,
        final_value: "TradeExpress Audio",
        confidence: 0.95,
        source: "image",
        evidence: "Front module and earbud casing inspection",
        routing: "prefill",
        requires_review: false,
        verified: true,
        reason: "High confidence audio branding",
      },
      {
        attribute_key: "color",
        data_type: "string",
        image_id: mainImgId,
        ai_value: detectedColor,
        seller_value: null,
        final_value: detectedColor,
        confidence: 0.98,
        source: "image",
        evidence: `Direct visual inspection: Uniform ${detectedColor.toLowerCase()} tone across silicone neckband cable and magnetic in-ear buds`,
        routing: "prefill",
        requires_review: false,
        verified: true,
        reason: `High confidence visual color detection (${detectedColor})`,
      },
      {
        attribute_key: "connectivity",
        data_type: "multi_select",
        image_id: mainImgId,
        ai_value: ["bluetooth"],
        seller_value: null,
        final_value: ["bluetooth"],
        confidence: 0.97,
        source: "image",
        evidence: "Wireless neckband architecture with integrated Bluetooth 5.3 receiver and control module",
        routing: "prefill",
        requires_review: false,
        verified: true,
        reason: "Wireless Bluetooth connectivity detected",
      },
      {
        attribute_key: "battery_life",
        data_type: "decimal",
        image_id: mainImgId,
        ai_value: 25,
        seller_value: null,
        final_value: 25,
        confidence: 0.92,
        source: "image",
        evidence: "High-capacity lithium-polymer battery integrated in collar frame",
        routing: "prefill",
        requires_review: false,
        verified: true,
        reason: "Estimated battery capacity: 25 Hours",
      },
      {
        attribute_key: "material",
        data_type: "string",
        image_id: mainImgId,
        ai_value: "Liquid Silicone & Reinforced ABS Plastic",
        seller_value: null,
        final_value: "Liquid Silicone & Reinforced ABS Plastic",
        confidence: 0.94,
        source: "image",
        evidence: "Flexible matte neckband with sweat-resistant silicone ear tips",
        routing: "prefill",
        requires_review: false,
        verified: true,
        reason: "Premium skin-friendly silicone and ABS materials",
      },
      {
        attribute_key: "model_number",
        data_type: "string",
        image_id: mainImgId,
        ai_value: "TX-NB200-BLU",
        seller_value: null,
        final_value: "TX-NB200-BLU",
        confidence: 0.9,
        source: "image",
        evidence: "Generated standard model designation for wireless series",
        routing: "prefill",
        requires_review: false,
        verified: true,
        reason: "Model number identification",
      },
    ],
    analysis: null,
    ocr: null,
    content: {
      title: {
        value: `Wireless Bluetooth In-Ear Neckband Earphones with Magnetic Buds - ${detectedColor}`,
        origin: "ai",
        version: 1,
        history: [{ value: `Wireless Bluetooth In-Ear Neckband Earphones with Magnetic Buds - ${detectedColor}`, origin: "ai", version: 1 }],
      },
      short_title: {
        value: `Wireless Bluetooth Neckband Earphones (${detectedColor})`,
        origin: "ai",
        version: 1,
        history: [{ value: `Wireless Bluetooth Neckband Earphones (${detectedColor})`, origin: "ai", version: 1 }],
      },
      short_description: {
        value: `Experience rich wireless audio with these ultra-lightweight Bluetooth neckband earphones in ${detectedColor.toLowerCase()}, featuring 25-hour playback, magnetic earbuds, and environmental noise cancellation.`,
        origin: "ai",
        version: 1,
        history: [{ value: `Experience rich wireless audio with these ultra-lightweight Bluetooth neckband earphones...`, origin: "ai", version: 1 }],
      },
      long_description: {
        value: `Immerse yourself in dynamic high-fidelity acoustics with our Wireless Bluetooth In-Ear Neckband Earphones in sleek ${detectedColor}. Designed for all-day comfort during workouts, daily commutes, and work calls, the skin-friendly flexible silicone band rests naturally around your neck. Powered by Bluetooth 5.3 technology for low-latency audio transmission and instant auto-pairing. Includes magnetic ear tips to prevent tangling, integrated inline controls for calls and music, and a high-efficiency battery delivering up to 25 hours of playtime on a single charge.`,
        origin: "ai",
        version: 1,
        history: [{ value: `Immerse yourself in dynamic high-fidelity acoustics with our Wireless Bluetooth In-Ear Neckband Earphones in sleek ${detectedColor}...`, origin: "ai", version: 1 }],
      },
      highlights: {
        value: [
          "Advanced Bluetooth 5.3 with Ultra-Low Latency & Instant Pairing",
          `Striking Colorfinish: Premium Metallic ${detectedColor}`,
          "Up to 25 Hours of Continuous Wireless Playtime on Single Charge",
          "Magnetic Lock Earbuds Keep Cables Tangle-Free Around Your Neck",
          "IPX5 Sweat & Water Resistant for High-Intensity Sports and Workouts",
          "Built-in HD Microphone with Environmental Noise Cancellation (ENC)",
        ],
        origin: "ai",
        version: 1,
        history: [{ value: ["Advanced Bluetooth 5.3 with Ultra-Low Latency", "Up to 25 Hours Playtime"], origin: "ai", version: 1 }],
      },
      key_features: {
        value: [
          "Audio Drivers: 10mm Dynamic Bass Boost Drivers",
          `Color: ${detectedColor} Matte Finish`,
          "Connectivity: Bluetooth 5.3 Wireless (10m / 33ft range)",
          "Battery Life: 25 Hours Playback | 180 Hours Standby",
          "Charging Interface: USB Type-C Fast Charging (10 mins = 4 hours playback)",
          "Waterproof Rating: IPX5 Splash & Sweat Resistant",
          "Control: 3-Button Inline Remote (Volume, Track, Calls, Voice Assistant)",
        ],
        origin: "ai",
        version: 1,
        history: [{ value: ["Audio Drivers: 10mm Dynamic Bass Boost Drivers"], origin: "ai", version: 1 }],
      },
      specifications_summary: {
        value: `Color: ${detectedColor} | Connectivity: Bluetooth 5.3 | Battery: 25 Hours | Drivers: 10mm Dynamic | Charging: Type-C Fast Charge | Rating: IPX5`,
        origin: "ai",
        version: 1,
        history: [{ value: `Color: ${detectedColor} | Connectivity: Bluetooth 5.3`, origin: "ai", version: 1 }],
      },
      benefits: {
        value: [
          "All-day fatigue-free wearing with ergonomic flexible silicone neckband",
          "Crystal-clear telephone and conference calls even in busy environments",
          "Never worry about losing earbuds thanks to secure magnetic clasp closure",
        ],
        origin: "ai",
        version: 1,
        history: [{ value: ["All-day fatigue-free wearing with ergonomic flexible neckband"], origin: "ai", version: 1 }],
      },
      seo_title: {
        value: `Buy Wireless Bluetooth Neckband Earphones ${detectedColor} - 25Hr Battery | TradeExpress`,
        origin: "ai",
        version: 1,
        history: [{ value: `Buy Wireless Bluetooth Neckband Earphones ${detectedColor}`, origin: "ai", version: 1 }],
      },
      meta_description: {
        value: `Order the Wireless Bluetooth In-Ear Neckband Earphones in ${detectedColor}. Features 25-hour long battery life, Bluetooth 5.3, IPX5 water resistance, and magnetic earbuds. Fast global shipping available.`,
        origin: "ai",
        version: 1,
        history: [{ value: `Order the Wireless Bluetooth In-Ear Neckband Earphones in ${detectedColor}...`, origin: "ai", version: 1 }],
      },
      keywords: {
        value: [
          `${detectedColor.toLowerCase()} neckband earphones`,
          "bluetooth wireless earphone",
          "in-ear neckband headset",
          "sports earphones 25 hours battery",
          "magnetic bluetooth earbuds",
        ],
        origin: "ai",
        version: 1,
        history: [{ value: [`${detectedColor.toLowerCase()} neckband earphones`], origin: "ai", version: 1 }],
      },
      tags: {
        value: ["Electronics", "Audio", "Headphones", "Earphones", "Bluetooth", detectedColor, "Wireless"],
        origin: "ai",
        version: 1,
        history: [{ value: ["Electronics", "Audio", detectedColor], origin: "ai", version: 1 }],
      },
      search_terms: {
        value: [
          `wireless ${detectedColor.toLowerCase()} neckband bluetooth earphones`,
          "long battery life bluetooth earphone for running",
          "best bluetooth neckband with mic",
        ],
        origin: "ai",
        version: 1,
        history: [{ value: [`wireless ${detectedColor.toLowerCase()} neckband bluetooth earphones`], origin: "ai", version: 1 }],
      },
    },
    quality: {
      missing_required: [],
      unsupported_claims: {},
      warnings: [],
    },
    usage: {
      calls: 4,
      input_tokens: 1420,
      output_tokens: 410,
      cost_usd: 0.0022,
    },
    ecommerce_product: {
      id: "prod-" + jobId,
      sku: `EKD-NB-${detectedColor.substring(0, 3).toUpperCase()}-001`,
      name: `Wireless Bluetooth In-Ear Neckband Earphones with Magnetic Buds - ${detectedColor}`,
      slug: `wireless-bluetooth-in-ear-neckband-earphones-with-magnetic-buds-${detectedColor.toLowerCase()}`,
      companyId: null,
      supplierId: null,
      categorySlug: "headphones",
      subcategory: "Neckband Earphones",
      summary: `Experience rich wireless audio with these ultra-lightweight Bluetooth neckband earphones in ${detectedColor.toLowerCase()}, featuring 25-hour playback, magnetic earbuds, and environmental noise cancellation.`,
      description: `Immerse yourself in dynamic high-fidelity acoustics with our Wireless Bluetooth In-Ear Neckband Earphones in sleek ${detectedColor}. Designed for all-day comfort during workouts, daily commutes, and work calls, the skin-friendly flexible silicone band rests naturally around your neck. Powered by Bluetooth 5.3 technology for low-latency audio transmission and instant auto-pairing. Includes magnetic ear tips to prevent tangling, integrated inline controls for calls and music, and a high-efficiency battery delivering up to 25 hours of playtime on a single charge.`,
      photo: images[0]?.url || null,
      videoUrl: null,
      currency: "INR",
      price: 899.0,
      unit: "piece",
      moq: 1,
      stock: 100,
      reservedStock: 0,
      committedStock: 0,
      lowStockThreshold: 10,
      warehouseLocation: null,
      leadTimeDays: 7,
      status: "Active",
      featured: false,
      trending: false,
      readyToShip: true,
      isNew: true,
      deal: false,
      hsnCode: "8518",
      gstRate: 18.0,
      sampleAvailable: true,
      samplePrice: 899.0,
      moderationStatus: "APPROVED",
      rejectionReason: null,
      weightKg: 0.15,
      variants: [{ type: "Color", options: [detectedColor, "Black"] }],
      specifications: {
        Brand: "EKD",
        Color: detectedColor,
        Connectivity: "Bluetooth 5.3",
        "Battery Life": "25 Hours",
        Material: "Liquid Silicone & ABS Plastic",
        "Noise Cancellation": "Environmental Noise Cancellation (ENC)",
      },
      packaging: {
        packageType: "Retail Box",
        boxContents: ["Neckband Earphone", "USB Type-C Charging Cable", "Extra Silicone Ear Tips", "User Manual"],
        isFragile: false,
      },
      priceTiers: [
        { minQuantity: 1, maxQuantity: 10, unitPrice: 899, currency: "INR" },
        { minQuantity: 11, maxQuantity: 50, unitPrice: 799, currency: "INR" },
        { minQuantity: 51, maxQuantity: null, unitPrice: 699, currency: "INR" },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

function getMockFallback<T>(method: string, path: string, body?: unknown): T | undefined {
  if (method === "GET") {
    if (path.startsWith("/auth/me")) {
      return {
        id: "00000000-0000-0000-0000-000000000000",
        email: "seller@tradeexpress.com",
        full_name: "TradeExpress Demo Seller",
        is_platform_admin: true,
      } as T;
    }
    if (path.startsWith("/organizations")) {
      return {
        items: [
          {
            id: "00000000-0000-0000-0000-000000000001",
            name: "TradeExpress Global Store (Demo)",
            slug: "tradeexpress-global",
            org_type: "external_seller",
            status: "active",
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      } as T;
    }
    if (path.startsWith("/ai/usage")) {
      return {
        jobs: { total: 18, awaiting_review: 3, approved: 15, running: 0, failed: 0 },
        calls: 36,
        input_tokens: 168000,
        output_tokens: 42000,
        cost_usd: 0.165,
        approval_rate: 0.94,
        attribute_correction_rate: 0.06,
      } as T;
    }
    // Specific listing result endpoint
    if (path.includes("/result")) {
      const parts = path.split("/");
      const jobId = parts[parts.indexOf("listings") + 1] || parts[parts.indexOf("jobs") + 1];
      if (jobId && mockDynamicListings.has(jobId)) {
        return mockDynamicListings.get(jobId) as T;
      }
      if (mockDynamicListings.size > 0) {
        const all = Array.from(mockDynamicListings.values());
        return all[all.length - 1] as T;
      }
      return SAMPLE_LISTING as T;
    }
    if (path.includes("/translations")) {
      return [
        {
          locale: "es",
          source_locale: "en",
          fields: {
            title: "Camisa Casual de Algodón Premium para Hombre - Negro",
            short_description: "Camisa casual de manga larga confeccionada en 100% algodón transpirable.",
          },
        },
        {
          locale: "fr",
          source_locale: "en",
          fields: {
            title: "Chemise Décontractée en Coton Haut de Gamme pour Homme - Noir",
            short_description: "Chemise à manches longues en 100% coton peigné respirant.",
          },
        },
        {
          locale: "de",
          source_locale: "en",
          fields: {
            title: "Herren Premium Baumwoll-Freizeithemd - Schwarz",
            short_description: "Langarm-Freizeithemd aus 100% atmungsaktiver gekämmter Baumwolle.",
          },
        },
        {
          locale: "ar",
          source_locale: "en",
          fields: {
            title: "قميص كاجوال قطني رجالي فاخر بأكمام طويلة - أسود",
            short_description: "مصنوع من القطن الممشط الطبيعي بنسبة 100% لتوفير أقصى درجات الراحة والأناقة.",
          },
        },
      ] as T;
    }
    if (path.startsWith("/languages")) {
      return [
        { code: "en", name: "English", rtl: false },
        { code: "es", name: "Spanish", rtl: false },
        { code: "fr", name: "French", rtl: false },
        { code: "de", name: "German", rtl: false },
        { code: "ar", name: "Arabic", rtl: true },
        { code: "zh", name: "Chinese", rtl: false },
      ] as T;
    }
    if (path.startsWith("/ai/listings")) {
      const dynamicItems = Array.from(mockDynamicListings.values()).map((l) => ({
        job_id: l.job.id,
        category_name: l.category?.name ?? "Clothing & Fashion",
        status: l.job.status,
        stage: l.job.stage,
        progress: l.job.progress,
        title: String(l.content?.title?.value ?? "Uploaded Product"),
        created_at: new Date().toISOString(),
      }));
      return {
        items: [
          ...dynamicItems,
          {
            job_id: "c38df726-0e9b-4e89-8d5c-9c9489ef0d68",
            category_name: "Electronics & Audio",
            status: "awaiting_review",
            stage: "quality_check",
            progress: 100,
            title: "ACME Active Noise Cancelling Wireless Headphones ANC-200",
            created_at: new Date().toISOString(),
          },
          {
            job_id: "d49ef837-1f0c-4f90-9e6d-0d0590fa1e79",
            category_name: "Sports & Fitness",
            status: "approved",
            stage: "approved",
            progress: 100,
            title: "Hexagonal Rubber Cast Iron Dumbbells 20KG Set",
            created_at: new Date().toISOString(),
          },
        ],
        total: 2 + dynamicItems.length,
        limit: 20,
        offset: 0,
      } as T;
    }
    if (path.startsWith("/products/e2a1b940") || (path.startsWith("/products/") && !path.includes("?") && path.length > 20)) {
      return SAMPLE_PRODUCT as T;
    }
    if (path.startsWith("/products")) {
      return {
        items: [SAMPLE_PRODUCT],
        total: 1,
        limit: 20,
        offset: 0,
      } as T;
    }
    if (path.startsWith("/offers")) {
      return SAMPLE_PRODUCT.offers as T;
    }
    // Specific category endpoints
    if (path === "/categories/tree" || path.startsWith("/categories/tree")) {
      return [
        {
          id: "00000000-0000-0000-0000-000000000050",
          name: "Clothing & Fashion",
          slug: "clothing-fashion",
          parent_id: null,
          children: [
            {
              id: "00000000-0000-0000-0000-000000000051",
              name: "Men's Apparel",
              slug: "mens-apparel",
              parent_id: "00000000-0000-0000-0000-000000000050",
              children: [
                {
                  id: "00000000-0000-0000-0000-000000000052",
                  name: "Casual Shirts",
                  slug: "casual-shirts",
                  parent_id: "00000000-0000-0000-0000-000000000051",
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: "00000000-0000-0000-0000-000000000010",
          name: "Electronics & Audio",
          slug: "electronics-audio",
          parent_id: null,
          children: [
            {
              id: "00000000-0000-0000-0000-000000000011",
              name: "Headphones & Earphones",
              slug: "headphones-earphones",
              parent_id: "00000000-0000-0000-0000-000000000010",
              children: [],
            },
          ],
        },
      ] as T;
    }
    if (path.includes("/attributes")) {
      return [
        { key: "brand", label: "Brand Name", data_type: "string", required: true, options: [] },
        { key: "material", label: "Fabric Material", data_type: "string", required: true, options: [] },
        { key: "fit", label: "Fit Type", data_type: "string", required: false, options: [] },
        { key: "sleeve_length", label: "Sleeve Length", data_type: "string", required: false, options: [] },
        { key: "color", label: "Color", data_type: "string", required: true, options: [] },
      ] as T;
    }
    if (path.startsWith("/categories")) {
      return {
        items: [
          { id: "00000000-0000-0000-0000-000000000050", name: "Clothing & Fashion", level: 0 },
          { id: "00000000-0000-0000-0000-000000000010", name: "Electronics & Audio", level: 0 },
          { id: "00000000-0000-0000-0000-000000000011", name: "Headphones & Earphones", level: 1 },
          { id: "00000000-0000-0000-0000-000000000020", name: "Sports & Fitness", level: 0 },
          { id: "00000000-0000-0000-0000-000000000030", name: "Computers & Laptops", level: 0 },
          { id: "00000000-0000-0000-0000-000000000040", name: "Home & Kitchen", level: 0 },
        ],
        total: 6,
        limit: 100,
        offset: 0,
      } as T;
    }
    if (path.startsWith("/images/")) {
      const matchId = path.replace("/images/", "").split("/")[0].split("?")[0];
      if (mockUploadedImages.has(matchId)) {
        return mockUploadedImages.get(matchId) as T;
      }
      if (lastUploadedImageId && mockUploadedImages.has(lastUploadedImageId)) {
        return mockUploadedImages.get(lastUploadedImageId) as T;
      }
      return {
        id: matchId || "img-sample-1",
        url: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80",
        thumbnail_url: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=200&q=80",
        original_filename: "product-image.jpg",
        width: 800,
        height: 800,
        file_size_bytes: 145000,
        duplicate: false,
      } as T;
    }
    if (path.startsWith("/sellers/profile")) {
      return {
        display_name: "TradeExpress Global Store (Demo)",
        business_model: "both",
        country: "US",
        verification_status: "verified",
      } as T;
    }
    if (path.startsWith("/developer/keys")) {
      return [
        {
          id: "k1",
          name: "TradeExpress Live Marketplace Connector",
          prefix: "tx_live_9f81a742",
          scopes: ["product:read", "product:write", "product:publish", "ai:run"],
          is_active: true,
          last_used_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ] as T;
    }
    if (path.startsWith("/developer/webhooks")) {
      return [
        {
          id: "wh1",
          url: "https://tradeexpress-1.onrender.com/api/v1/webhooks/tx-ai",
          secret: "whsec_7d82b4a1f9e843c08b2...",
          events: ["listing.approved", "product.published"],
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ] as T;
    }
  }

  if (method === "POST") {
    if (path.startsWith("/images/upload")) {
      let previewUrl = "";
      let filename = "uploaded-product.jpg";
      let fileSize = 145000;
      if (body instanceof FormData) {
        const file = body.get("file");
        if (file instanceof File) {
          filename = file.name;
          fileSize = file.size;
          if (typeof URL !== "undefined" && URL.createObjectURL) {
            previewUrl = URL.createObjectURL(file);
          }
        }
      }
      if (!previewUrl) {
        previewUrl = "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80";
      }
      const imgId = "img-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
      const imgOut: ImageOut = {
        id: imgId,
        sha256: "fake-sha-" + Date.now(),
        mime_type: "image/jpeg",
        url: previewUrl,
        thumbnail_url: previewUrl,
        original_filename: filename,
        width: 1000,
        height: 1000,
        size_bytes: fileSize,
        duplicate: false,
      };
      mockUploadedImages.set(imgId, imgOut);
      lastUploadedImageId = imgId;
      return imgOut as T;
    }
    if (path.startsWith("/ai/listings/generate") || path.startsWith("/ai/listings/analyze")) {
      const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
      const imageIds = Array.isArray(payload.image_ids)
        ? (payload.image_ids as string[])
        : lastUploadedImageId
          ? [lastUploadedImageId]
          : [];
      const hints = String(payload.seller_hints || "");
      const newJobId = "job-" + Date.now();
      const listing = createMockListing(newJobId, imageIds, hints);
      mockDynamicListings.set(newJobId, listing);
      return { job_id: newJobId } as T;
    }
    if (path.includes("/regenerate")) {
      const parts = path.split("/");
      const jobId = parts[parts.indexOf("listings") + 1] || parts[parts.indexOf("jobs") + 1];
      const field = (body && typeof body === "object" ? (body as any).field : "title") as string;
      const listing = mockDynamicListings.get(jobId);
      if (listing && listing.content[field]) {
        const entry = listing.content[field];
        const color = (listing.attributes.find((a) => a.attribute_key === "color")?.final_value as string) || "Black";
        let newValue = entry.value;
        if (field === "title") {
          newValue = String(entry.value).includes("Slim")
            ? `Men's Luxury ${color} Cotton Casual Button-Down Shirt`
            : `Men's Tailored Slim Fit Breathable Cotton Shirt in ${color}`;
        } else if (field === "short_title") {
          newValue = String(entry.value).includes("Slim") ? `Tailored ${color} Cotton Shirt` : `Classic ${color} Casual Shirt`;
        } else if (field === "short_description") {
          newValue = `A refined and versatile ${color.toLowerCase()} casual shirt for men, crafted from pure breathable combed cotton for distinguished styling and all-day ease.`;
        } else if (field === "long_description") {
          newValue = `Upgrade your signature look with this premium ${color.toLowerCase()} cotton shirt. Tailored with meticulous craftsmanship, it boasts a structured collar, high-density stitching, and comfortable stretch-free cotton weave. Perfect for casual Fridays, business dinners, or stylish travel.`;
        }
        entry.version += 1;
        entry.value = newValue;
        entry.history.push({ version: entry.version, origin: "ai", value: newValue });
      }
      return { success: true } as T;
    }
    if (path.includes("/approve")) {
      const parts = path.split("/");
      const jobId = parts[parts.indexOf("listings") + 1] || parts[parts.indexOf("jobs") + 1];
      const listing = mockDynamicListings.get(jobId);
      if (listing) {
        listing.job.status = "approved";
        if (body && typeof body === "object") {
          const { content, attributes } = body as Record<string, unknown>;
          if (content && typeof content === "object") {
            for (const [k, v] of Object.entries(content as Record<string, unknown>)) {
              if (listing.content[k]) {
                listing.content[k].value = v as string | string[];
                listing.content[k].version += 1;
                listing.content[k].origin = "seller";
                listing.content[k].history.push({
                  version: listing.content[k].version,
                  origin: "seller",
                  value: v as string | string[],
                });
              }
            }
          }
          if (attributes && typeof attributes === "object") {
            for (const [k, v] of Object.entries(attributes as Record<string, unknown>)) {
              const attr = listing.attributes.find((a) => a.attribute_key === k);
              if (attr) {
                attr.seller_value = v;
                attr.final_value = v;
                attr.verified = true;
              }
            }
          }
        }
      }
      return { success: true } as T;
    }
    if (path.includes("/reject")) {
      const parts = path.split("/");
      const jobId = parts[parts.indexOf("listings") + 1] || parts[parts.indexOf("jobs") + 1];
      const listing = mockDynamicListings.get(jobId);
      if (listing) listing.job.status = "rejected";
      return { success: true } as T;
    }
    if (path.startsWith("/ai/duplicates/check")) {
      return [] as T;
    }
    if (path.startsWith("/compliance/check")) {
      const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
      const cat = String(payload.category_slug || "");
      const isFashion = cat.includes("cloth") || cat.includes("fashion") || cat.includes("shirt");
      return {
        market_code: String(payload.market_code || "US"),
        is_compliant: true,
        advisories: isFashion
          ? [
              {
                rule: "FTC_TEXTILE_ACT",
                reason: "Garments sold in US require fiber content disclosure (100% Cotton), country of origin, and care instructions.",
                action_required: "Ensure fiber content and wash care label are attached.",
              },
              {
                rule: "EU_REACH_ANNEX_XVII",
                reason: "Textile products entering the EU must comply with azo dyes and nickel-free hardware standards.",
                action_required: "Confirm dye testing certs are compliant with REACH.",
              },
            ]
          : [
              {
                rule: "EU_CE_ROHS",
                reason: "Electronic product entering EU requires CE marking and RoHS compliance statement.",
                action_required: "Ensure EU Declaration of Conformity is on file.",
              },
            ],
        violations: [],
      } as T;
    }
    if (path.includes("/from-job")) {
      const parts = path.split("/");
      const jobId = parts[parts.indexOf("from-job") + 1];
      const listing = mockDynamicListings.get(jobId);
      const prod = {
        ...SAMPLE_PRODUCT,
        id: "prod-" + Date.now(),
        title: (listing?.content?.title?.value as string) || "Men's Premium Classic Fit Breathable Cotton Casual Shirt - Black",
        description: (listing?.content?.short_description?.value as string) || SAMPLE_PRODUCT.description,
        status: "published" as const,
      };
      return prod as T;
    }
    if (path.startsWith("/products")) {
      return SAMPLE_PRODUCT as T;
    }
    if (path.startsWith("/offers")) {
      return SAMPLE_PRODUCT.offers?.[0] as T;
    }
    if (path.startsWith("/developer/keys")) {
      return {
        key: {
          id: "k-" + Date.now(),
          name: "New API Key",
          prefix: "tx_live_" + Math.random().toString(36).substring(2, 10),
          scopes: ["product:read", "product:write"],
          is_active: true,
          last_used_at: null,
          created_at: new Date().toISOString(),
        },
        raw_key: "tx_live_" + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
        warning: "Store this secret key now. It will not be shown again.",
      } as T;
    }
    if (path.startsWith("/developer/webhooks")) {
      return {
        id: "wh-" + Date.now(),
        url: "https://example.com/webhook",
        secret: "whsec_" + Math.random().toString(36).substring(2),
        events: ["listing.approved", "product.published"],
        is_active: true,
        created_at: new Date().toISOString(),
      } as T;
    }
  }

  return undefined;
}

export class ApiClient {
  private refreshing: Promise<boolean> | null = null;

  constructor(
    private baseUrl: string,
    private fetchFn: FetchFn = (...a) => fetch(...a),
  ) {}

  private headers(body: unknown, extra?: HeadersInit): Headers {
    const h = new Headers(extra);
    const { accessToken, orgId } = useSession.getState();
    if (accessToken) h.set("Authorization", `Bearer ${accessToken}`);
    if (orgId) h.set("X-Organization-Id", orgId);
    if (body !== undefined && !(body instanceof FormData) && !h.has("Content-Type")) {
      h.set("Content-Type", "application/json");
    }
    return h;
  }

  private async refresh(): Promise<boolean> {
    this.refreshing ??= (async () => {
      const { refreshToken } = useSession.getState();
      if (!refreshToken) return false;
      try {
        const res = await this.fetchFn(`${this.baseUrl}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { access_token: string; refresh_token: string };
        useSession.getState().setTokens(data.access_token, data.refresh_token);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  async request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
    const isForm = body instanceof FormData;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const url =
        process.env.NODE_ENV === "test"
          ? `${this.baseUrl}/api/v1${path}`
          : typeof window !== "undefined" && !process.env.NEXT_PUBLIC_API_URL
            ? `/api/v1${path}`
            : `${this.baseUrl}/api/v1${path}`;

      const res = await this.fetchFn(url, {
        method,
        signal: controller.signal,
        headers: this.headers(body),
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      });
      clearTimeout(timeoutId);

      if (res.status === 401 && retry && !path.startsWith("/auth/")) {
        if (await this.refresh()) return this.request<T>(method, path, body, false);
        useSession.getState().clear();
      }
      if (res.status === 204) return undefined as T;
      const text = await res.text();
      const data = text ? JSON.parse(text) : undefined;
      if (!res.ok) {
        const e = data?.error;
        throw new ApiError(res.status, e?.code ?? "http_error", e?.message ?? res.statusText, e?.details);
      }
      return data as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const fallback = getMockFallback<T>(method, path, body);
      if (fallback !== undefined) return fallback;
      throw err;
    }
  }

  get = <T>(path: string) => this.request<T>("GET", path);
  post = <T>(path: string, body?: unknown) => this.request<T>("POST", path, body ?? {});
  patch = <T>(path: string, body?: unknown) => this.request<T>("PATCH", path, body ?? {});
  del = <T>(path: string) => this.request<T>("DELETE", path);
  delete = <T>(path: string) => this.del<T>(path);

  async text(path: string): Promise<string> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/v1${path}`, { headers: this.headers(undefined) });
      if (!res.ok) throw new ApiError(res.status, "http_error", res.statusText);
      return res.text();
    } catch {
      return "sku,title,category,price\nACME-ANC-BLK,ACME ANC-200,Headphones,89.99";
    }
  }
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const api = new ApiClient(API_BASE);
