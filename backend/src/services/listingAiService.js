import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { ENV } from '../config/env.js';
import { uploadDir, uploaderTag } from '../middleware/uploadMiddleware.js';

/*
 * Product Listing AI (product_intergreat_ai) for suppliers: product photos -> suggested listing details.
 *
 * The browser never talks to the AI service: this backend sends the supplier's own uploaded photos, starts a job and
 * returns a signed job token. Results are mapped to the TradeExpress product form (name, summary, description,
 * specifications, colours, category). Price, MOQ, stock and tax are never suggested, and nothing is saved or
 * published here: the supplier reviews the form and saves it as usual.
 *
 * Configuration (backend/.env):
 *   LISTING_AI_URL          e.g. http://localhost:8000 (the service root, without /api/v1)
 *   LISTING_AI_API_KEY      tx_live_... key (preferred), or a service account:
 *   LISTING_AI_EMAIL / LISTING_AI_PASSWORD / LISTING_AI_ORG_ID
 *   LISTING_AI_TIMEOUT_MS   per request, default 30000
 */

const JOB_TOKEN_PURPOSE = 'AI_LISTING_JOB';
const JOB_TOKEN_TTL = '2h';
const MAX_IMAGES = 5;
const DONE_STATUSES = new Set(['awaiting_review', 'approved', 'analyzed']);
const FAILED_STATUSES = new Set(['failed', 'rejected']);
const LIMITS = { name: 90, summary: 160, description: 2000 };

let session = null; // { token, expiresAt } for the service-account login

function aiError(message, code, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = code;
  return error;
}

function config() {
  return {
    baseUrl: String(process.env.LISTING_AI_URL || '').trim().replace(/\/+$/, '').replace(/\/api\/v1$/i, ''),
    apiKey: String(process.env.LISTING_AI_API_KEY || '').trim(),
    email: String(process.env.LISTING_AI_EMAIL || '').trim(),
    password: String(process.env.LISTING_AI_PASSWORD || ''),
    orgId: String(process.env.LISTING_AI_ORG_ID || '').trim(),
    timeoutMs: Math.min(Number.parseInt(process.env.LISTING_AI_TIMEOUT_MS, 10) || 30000, 120000),
  };
}

/** True when the Listing AI service is configured. */
export function isListingAiConfigured() {
  const c = config();
  return Boolean(c.baseUrl && (c.apiKey || (c.email && c.password)));
}

const UNAVAILABLE = 'The AI listing assistant is not available right now. Please fill in the details yourself or try again later.';

async function login(c) {
  const res = await rawRequest(c, 'POST', '/auth/login', { json: { email: c.email, password: c.password }, auth: {} });
  if (!res.ok || !res.body?.access_token) {
    console.warn(`[Listing AI] Service login failed: HTTP ${res.status}`);
    throw aiError(UNAVAILABLE, 'AI_LISTING_UNAVAILABLE', 503);
  }
  const ttl = Number(res.body.expires_in) || 900;
  session = { token: res.body.access_token, expiresAt: Date.now() + (ttl - 60) * 1000 };
  return session.token;
}

async function authHeaders(c, { fresh = false } = {}) {
  if (c.apiKey) return { 'X-API-Key': c.apiKey };
  if (fresh || !session || session.expiresAt <= Date.now()) await login(c);
  return { Authorization: `Bearer ${session.token}`, ...(c.orgId ? { 'X-Organization-Id': c.orgId } : {}) };
}

async function rawRequest(c, method, pathName, { json, form, auth }) {
  let res;
  try {
    res = await fetch(`${c.baseUrl}/api/v1${pathName}`, {
      method,
      headers: { ...auth, ...(json ? { 'Content-Type': 'application/json' } : {}), Accept: 'application/json' },
      body: json ? JSON.stringify(json) : form,
      signal: AbortSignal.timeout(c.timeoutMs),
    });
  } catch (err) {
    console.warn(`[Listing AI] ${method} ${pathName} failed: ${err.name === 'TimeoutError' ? 'timeout' : err.code || err.message}`);
    throw aiError(UNAVAILABLE, 'AI_LISTING_UNAVAILABLE', 503);
  }
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  return { ok: res.ok, status: res.status, body };
}

/** Calls the AI service; logs in again once if a session token was rejected. */
async function aiRequest(method, pathName, options = {}) {
  const c = config();
  if (!isListingAiConfigured()) throw aiError(UNAVAILABLE, 'AI_LISTING_NOT_CONFIGURED', 503);
  let res = await rawRequest(c, method, pathName, { ...options, auth: await authHeaders(c) });
  if (res.status === 401 && !c.apiKey) res = await rawRequest(c, method, pathName, { ...options, auth: await authHeaders(c, { fresh: true }) });
  if (!res.ok) {
    console.warn(`[Listing AI] ${method} ${pathName} -> HTTP ${res.status} ${res.body?.error?.code || ''}`);
    if (res.status === 422) throw aiError(res.body?.error?.message || 'The AI could not use this photo. Please try a clearer product photo (at least 200 x 200 pixels).', 'AI_LISTING_BAD_IMAGE', 422);
    if (res.status === 429) throw aiError('The AI listing assistant is busy. Please try again in a minute.', 'AI_LISTING_BUSY', 429);
    throw aiError(UNAVAILABLE, 'AI_LISTING_UNAVAILABLE', 503);
  }
  return res.body;
}

/**
 * The supplier's own uploaded photo for a URL from the product form. Only files this supplier uploaded (their
 * upload tag) are accepted, so nobody can send another user's files to the AI.
 */
export function resolveSupplierPhoto(photoUrl, supplierId) {
  let value = String(photoUrl || '').trim();
  if (/^https?:\/\//i.test(value)) {
    try { value = new URL(value).pathname; } catch { value = ''; }
  }
  const match = value.match(/^\/uploads\/([A-Za-z0-9._-]+\.(?:jpe?g|png|webp))$/i);
  const name = match ? path.basename(match[1]) : '';
  const file = name ? path.join(uploadDir, name) : '';
  if (!name || !name.startsWith(`${uploaderTag(supplierId)}-`) || !fs.existsSync(file)) {
    throw aiError('Upload your product photos in this form first (JPG, PNG or WebP), then use the AI assistant.', 'AI_LISTING_PHOTO_INVALID', 400);
  }
  return file;
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/** Sends the photos, starts the AI job and returns a job token bound to this supplier. */
export async function startListingJob({ supplierId, photos }) {
  const list = (Array.isArray(photos) ? photos : []).filter(Boolean);
  if (!list.length) throw aiError('Upload at least one product photo first.', 'AI_LISTING_PHOTO_REQUIRED', 400);
  const files = [...new Set(list.slice(0, MAX_IMAGES).map((url) => resolveSupplierPhoto(url, supplierId)))];

  const imageIds = [];
  for (const file of files) {
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(file)], { type: MIME[path.extname(file).toLowerCase()] || 'image/jpeg' }), path.basename(file));
    const image = await aiRequest('POST', '/images/upload', { form });
    if (!image?.id) throw aiError(UNAVAILABLE, 'AI_LISTING_UNAVAILABLE', 503);
    imageIds.push(image.id);
  }
  const job = await aiRequest('POST', '/ai/listings/generate', { json: { image_ids: imageIds } });
  const jobId = job?.job_id || job?.id;
  if (!jobId) throw aiError(UNAVAILABLE, 'AI_LISTING_UNAVAILABLE', 503);

  const jobToken = jwt.sign({ purpose: JOB_TOKEN_PURPOSE, j: String(jobId), u: supplierId }, ENV.JWT_SECRET, { expiresIn: JOB_TOKEN_TTL });
  return { jobToken, photosSent: files.length };
}

function readJobToken(token, supplierId) {
  try {
    const payload = jwt.verify(String(token || ''), ENV.JWT_SECRET);
    if (payload?.purpose === JOB_TOKEN_PURPOSE && payload.u === supplierId && payload.j) return payload.j;
  } catch { /* handled below */ }
  throw aiError('This AI request was not found or has expired. Please start again.', 'AI_LISTING_NOT_FOUND', 404);
}

// ---- Mapping the AI result to the TradeExpress product form ----------------------------------------------------

/** Shortens text to a limit at a sentence or word boundary. Line breaks are kept (bullet lists stay readable). */
export function fitText(text, max) {
  const value = String(text || '').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
  if (sentence > max * 0.4) return cut.slice(0, sentence + 1);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > max * 0.5 ? space : max - 1).replace(/[\s,;:–-]+$/, '')}…`;
}

const contentValue = (content, key) => {
  const field = content?.[key];
  return field && typeof field === 'object' && 'value' in field ? field.value : field;
};

const humanize = (key) => String(key).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const formatValue = (value) => {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value && typeof value === 'object') return Object.values(value).filter((v) => v != null && v !== '').join(' ');
  return String(value);
};

// Words treated as the same when matching AI categories to TradeExpress categories
const SYNONYMS = {
  clothing: ['apparel', 'fashion'], fashion: ['apparel'], mens: ['apparel'], womens: ['apparel'], tshirt: ['t-shirt', 'shirt'],
  sneaker: ['footwear'], shoe: ['footwear'], fitness: ['sport', 'outdoor'], gym: ['sport'], yoga: ['sport'], camping: ['outdoor'],
  hiking: ['outdoor'], tent: ['outdoor', 'gear'], machinery: ['machine', 'machinery'], cnc: ['cnc'], tool: ['tool'], hardware: ['tool', 'industrial'],
  drill: ['power', 'tool'], phone: ['mobile'], charger: ['mobile'], computer: ['computer', 'peripheral'], laptop: ['computer'],
  headphone: ['audio'], cookware: ['kitchen', 'tableware'], decor: ['decor'], skincare: ['skincare'], makeup: ['makeup'],
  car: ['automotive', 'interior'], seed: ['agriculture'], fertilizer: ['agriculture'], luggage: ['bag'], travel: ['bag', 'accessory'],
  jewelry: ['accessory'], watch: ['wearable'], sofa: ['living', 'room'], toy: ['toy'], packaging: ['packaging'],
};

const stem = (word) => word.replace(/ies$/, 'y').replace(/(ss)$/, '$1').replace(/s$/, '');
const tokens = (text) => String(text || '').toLowerCase().replace(/&/g, ' ').split(/[^a-z0-9]+/).filter((w) => w.length > 1).map(stem);
const expand = (words) => {
  const out = new Set(words);
  for (const w of words) for (const s of SYNONYMS[w] || []) tokens(s).forEach((t) => out.add(t));
  return out;
};

/**
 * Best TradeExpress category (and subcategory) for the AI's category and its parents, or null when nothing matches
 * well enough (the supplier then chooses).
 */
export function matchCategory(aiCategory, categories) {
  if (!aiCategory || !Array.isArray(categories) || !categories.length) return null;
  const terms = [aiCategory.slug, aiCategory.name, ...(aiCategory.candidates || []).map((c) => c.slug)].filter(Boolean);
  const aiWords = expand(terms.flatMap(tokens));
  const score = (text) => tokens(text).filter((w) => aiWords.has(w)).length;

  // A matching subcategory is more specific than a matching category name, so it weighs more
  // (e.g. AI "sneakers > footwear" belongs in Sports & Outdoors > Footwear rather than any fashion category)
  let best = null;
  for (const cat of categories) {
    if (!/^[a-z0-9-]+$/.test(cat.slug)) continue; // ignore malformed categories
    const catScore = Math.max(score(cat.slug), score(cat.name));
    const subs = Array.isArray(cat.subcategories) ? cat.subcategories.filter((s) => typeof s === 'string') : [];
    const sub = subs.map((name) => ({ name, s: score(name) })).sort((a, b) => b.s - a.s)[0];
    if (!catScore && !sub?.s) continue;
    const total = catScore * 2 + (sub?.s || 0) * 5;
    if (!best || total > best.total) best = { slug: cat.slug, name: cat.name, subcategory: sub?.s ? sub.name : '', total };
  }
  return best ? { slug: best.slug, name: best.name, subcategory: best.subcategory } : null;
}

/** Form-ready suggestions from an AI listing result. Never includes price, MOQ, stock or tax. */
export function mapResultToForm(result, categories) {
  const content = result?.content || {};
  const title = contentValue(content, 'title');
  const shortTitle = contentValue(content, 'short_title');
  const name = title && String(title).length <= LIMITS.name ? title : (shortTitle && String(shortTitle).length <= LIMITS.name ? shortTitle : title);

  const highlights = contentValue(content, 'highlights');
  const longDescription = contentValue(content, 'long_description') || '';
  const description = [
    longDescription,
    Array.isArray(highlights) && highlights.length ? `Highlights:\n${highlights.map((h) => `• ${h}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  const attributes = (result?.attributes || []).filter((a) => a.final_value != null && a.final_value !== '' && a.routing !== 'empty');
  const colour = attributes.find((a) => ['color', 'colour'].includes(a.attribute_key));
  const specLines = attributes
    .filter((a) => !['color', 'colour'].includes(a.attribute_key))
    .map((a) => `${humanize(a.attribute_key)}: ${formatValue(a.final_value)}`);
  const toConfirm = attributes.filter((a) => a.routing === 'confirm' || a.requires_review).map((a) => humanize(a.attribute_key));

  const category = matchCategory(result?.category, categories);
  return {
    name: name ? fitText(name, LIMITS.name) : '',
    summary: fitText(contentValue(content, 'short_description') || '', LIMITS.summary),
    description: fitText(description, LIMITS.description),
    specifications: specLines.join('\n'),
    colours: colour ? formatValue(colour.final_value) : '',
    category: category?.slug || '',
    categoryName: category?.name || '',
    subcategory: category?.subcategory || '',
    aiCategory: result?.category ? { name: result.category.name, confidence: result.category.confidence } : null,
    toConfirm,
    warnings: (result?.quality?.warnings || []).map((w) => w.message).filter(Boolean),
  };
}

/** Status of the supplier's AI job; once ready, the form suggestions. */
export async function getListingJob({ supplierId, jobToken }) {
  const jobId = readJobToken(jobToken, supplierId);
  const status = await aiRequest('GET', `/ai/listings/${encodeURIComponent(jobId)}/status`);
  const state = String(status?.status || '').toLowerCase();
  if (FAILED_STATUSES.has(state)) {
    console.warn(`[Listing AI] Job ${jobId} ${state}: ${status?.error || ''}`);
    return { status: 'failed', message: 'The AI could not create a listing from these photos. Please try clearer photos or fill in the details yourself.' };
  }
  if (!DONE_STATUSES.has(state)) {
    return { status: 'processing', progress: Number(status?.progress) || 0, stage: status?.stage || null };
  }
  const result = await aiRequest('GET', `/ai/listings/${encodeURIComponent(jobId)}/result`);
  const categories = await prisma.category.findMany({ select: { slug: true, name: true, subcategories: true } });
  return { status: 'ready', suggestions: mapResultToForm(result, categories) };
}
