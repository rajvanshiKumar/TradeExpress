import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import {
  ImageUp,
  Upload,
  RefreshCw,
  Sparkles,
  X,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  SearchX,
  ScanSearch,
} from "lucide-react";
import useCurrency from "../../hooks/useCurrency";
import useOverlay from "./useOverlay";
import Image from "./Image";
import { searchProductsByImage } from "../../services/visualSearchApi";

const SAMPLE_IMAGES = [
  { label: "🎧 Headphones", file: "sample-headphones.jpg", photo: "photo-1505740420928-5e560c06d30e" },
  { label: "👕 Cotton T-Shirt", file: "sample-tshirt.jpg", photo: "photo-1620799139652-715e4d5b232d" },
  { label: "🏺 Ceramic Vase", file: "sample-vase.jpg", photo: "photo-1612196808214-b8e1d6145a8c" },
  { label: "🛠️ Cordless Drill", file: "sample-drill.jpg", photo: "photo-1562237553-36ad661d6f2c" },
  { label: "🧴 Brightening Serum", file: "sample-serum.jpg", photo: "photo-1723951174326-2a97221d3b7f" },
  { label: "📦 Shipping Box", file: "sample-box.jpg", photo: "photo-1513672494107-cd9d848a383e" },
  { label: "🚫 Non-Matching Image", file: "sample-landscape.jpg", photo: "photo-1506744038136-46273834b3fb" },
];

const IDLE = { status: "idle", result: null, error: null };

export default function VisualSearchModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  // Browsing prices, shown in the buyer's currency ("≈" when converted); checkout and orders keep the real currency
  const { displayMoney: money } = useCurrency();
  const panelRef = useOverlay(isOpen, onClose);

  const [preview, setPreview] = useState(null); // { url, name }
  const [search, setSearch] = useState(IDLE); // status: idle | searching | done | error
  const fileInputRef = useRef(null);
  const requestRef = useRef(null); // AbortController of the search in progress
  const lastFileRef = useRef(null); // for "Try again" after a temporary failure

  const cancelSearch = () => {
    requestRef.current?.abort();
    requestRef.current = null;
  };

  const reset = () => {
    cancelSearch();
    lastFileRef.current = null;
    setPreview((current) => {
      if (current?.url?.startsWith("blob:")) URL.revokeObjectURL(current.url);
      return null;
    });
    setSearch(IDLE);
  };

  // Start fresh each time the search is closed; never leave a request running
  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen]);
  useEffect(() => () => cancelSearch(), []);

  const runSearch = async (file, name) => {
    cancelSearch();
    const controller = new AbortController();
    requestRef.current = controller;
    lastFileRef.current = { file, name };
    setPreview((current) => {
      if (current?.url?.startsWith("blob:")) URL.revokeObjectURL(current.url);
      return { url: URL.createObjectURL(file), name };
    });
    setSearch({ status: "searching", result: null, error: null });
    try {
      const result = await searchProductsByImage(file, { signal: controller.signal });
      if (requestRef.current !== controller) return;
      setSearch({ status: "done", result, error: null });
    } catch (error) {
      if (requestRef.current !== controller) return;
      setSearch({ status: "error", result: null, error });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // Reset so selecting the same file again starts a new search
    if (file) runSearch(file, file.name);
  };

  const handleSample = async (sample) => {
    try {
      const response = await fetch(`https://images.unsplash.com/${sample.photo}?auto=format&fit=crop&w=800&q=80`);
      if (!response.ok) throw new Error("Sample image unavailable");
      const blob = await response.blob();
      runSearch(new File([blob], sample.file, { type: blob.type || "image/jpeg" }), sample.file);
    } catch {
      setPreview(null);
      setSearch({ status: "error", result: null, error: { code: "SAMPLE_UNAVAILABLE", message: "The sample image could not be loaded. Please upload your own photo." } });
    }
  };

  const handleSelectProduct = (product) => {
    onClose();
    navigate(`/products/${product.slug || product.id}`);
  };

  if (!isOpen || typeof document === "undefined") return null;

  const { status, result, error } = search;
  const products = result?.products || [];
  const recognized = result?.recognized;
  const categoryOnly = result?.matchType === "category";
  const unavailable = error?.code === "VISUAL_SEARCH_UNAVAILABLE";
  const canRetry = status === "error" && !unavailable && error?.code !== "INVALID_IMAGE" && lastFileRef.current;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-navy-950/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Visual Product Search"
        tabIndex={-1}
        className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-navy-900/[0.08] bg-ivory px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-navy-900 text-brand-400">
              <ImageUp className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-navy-900 sm:text-lg">
                Visual Product Search
              </h2>
              <p className="text-xs text-muted">
                Upload a product image to find matching wholesale products
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-full text-navy-600 transition-colors hover:bg-navy-900/10 hover:text-navy-900"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {status === "idle" ? (
            /* Upload */
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-navy-200 bg-surface px-6 py-10 text-center transition-all hover:border-brand-500 hover:bg-brand-50/20"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <div className="flex size-14 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-md ring-1 ring-navy-900/5 transition-transform group-hover:scale-110">
                  <Upload className="size-7" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-navy-900 sm:text-base">
                  Click to upload product image
                </h3>
                <p className="mt-1 text-xs text-muted max-w-sm">
                  JPG, PNG or WEBP. We recognise the product in the photo and find it in our wholesale catalog.
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform group-hover:scale-105">
                  <Sparkles className="size-3.5 text-brand-400" />
                  Select Image File
                </span>
              </div>

              {/* Sample photos run through the same recognition */}
              <div className="rounded-2xl border border-navy-900/[0.07] bg-surface/80 p-3 sm:p-4 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
                  Or try a sample photo:
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {SAMPLE_IMAGES.map((sample) => (
                    <button
                      key={sample.file}
                      type="button"
                      onClick={() => handleSample(sample)}
                      className="inline-flex items-center rounded-xl border border-navy-900/10 bg-white px-2.5 py-1.5 text-xs font-semibold text-navy-800 shadow-2xs hover:border-brand-500 hover:bg-brand-50/50 hover:text-navy-950 transition-all hover:-translate-y-0.5 active:scale-95"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Results View */
            <div className="space-y-5">
              {/* Image Preview & Status Header */}
              <div className="flex items-center gap-3.5 rounded-2xl border border-navy-900/[0.08] bg-surface p-3 sm:p-4">
                {preview?.url ? (
                  <img
                    src={preview.url}
                    alt="Uploaded product image"
                    className="size-16 shrink-0 rounded-xl object-cover ring-1 ring-navy-900/10 shadow-sm"
                  />
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-white text-navy-400 ring-1 ring-navy-900/10">
                    <ImageUp className="size-6" />
                  </span>
                )}
                <div className="min-w-0 flex-1" aria-live="polite">
                  {status === "searching" ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-navy-700">
                      <ScanSearch className="size-4" />
                      <span>Recognising product…</span>
                    </div>
                  ) : status === "done" && products.length > 0 ? (
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${categoryOnly ? "text-amber-700" : "text-brand-700"}`}>
                      {categoryOnly ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
                      <span>
                        {categoryOnly
                          ? `No exact match — similar products in ${recognized?.category?.name || "this category"}`
                          : `${products.length} matching ${products.length === 1 ? "product" : "products"} found`}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                      <AlertCircle className="size-4" />
                      <span>{status === "error" ? (unavailable ? "Visual search unavailable" : "Search failed") : "No matching products found"}</span>
                    </div>
                  )}
                  <h4 className="truncate text-sm font-bold text-navy-900">
                    {recognized?.productName ? `Recognised: ${recognized.productName}` : preview?.name || "Uploaded image"}
                  </h4>
                  <p className="truncate text-[11px] text-muted">
                    {status === "searching"
                      ? "Identifying the product and searching our active listings"
                      : recognized?.productName
                        ? preview?.name
                        : status === "error"
                          ? error?.message
                          : "We could not find matching products for this image in our active listings"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-navy-900/10 bg-white px-3 py-2 text-xs font-semibold text-navy-700 hover:bg-navy-50 transition-colors"
                >
                  <RefreshCw className="size-3.5" />
                  New Image
                </button>
              </div>

              {status === "searching" ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="size-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
                  <p className="mt-3 text-sm font-bold text-navy-900">
                    Recognising the product in your photo…
                  </p>
                  <p className="text-xs text-muted">
                    Then matching it against active wholesale listings
                  </p>
                </div>
              ) : status === "done" && products.length > 0 ? (
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                      {categoryOnly ? "Similar products" : "Matched wholesale products"} ({products.length})
                    </h3>
                    {recognized?.category?.name ? (
                      <span className="truncate text-xs text-brand-700 font-semibold">{recognized.category.name}</span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {products.map((product, idx) => (
                      <div
                        key={product.id || idx}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectProduct(product)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelectProduct(product);
                          }
                        }}
                        className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-navy-900/[0.06] bg-white p-3 shadow-xs transition-all hover:-translate-y-0.5 hover:border-brand-500/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                      >
                        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-navy-50 ring-1 ring-navy-900/5">
                          <Image
                            photo={product.photo || product.images?.[0]?.url}
                            illustration={product.illustration}
                            category={product.categorySlug}
                            alt={product.name}
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          {idx === 0 && !categoryOnly ? (
                            <span className="inline-block rounded-md bg-brand-50 text-brand-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                              Best match
                            </span>
                          ) : null}
                          <h4 className="truncate text-xs font-bold text-navy-900 group-hover:text-brand-600 sm:text-sm">
                            {product.name}
                          </h4>
                          <p className="text-xs font-semibold text-navy-700">
                            {money(product.price)}
                            <span className="text-[10px] font-normal text-muted">
                              {" "}
                              / {product.unit || "unit"}{product.moq ? ` (MOQ: ${product.moq})` : ""}
                            </span>
                          </p>
                        </div>
                        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-navy-50 text-navy-700 transition-colors group-hover:bg-brand-500 group-hover:text-navy-950">
                          <ArrowRight className="size-4" />
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-navy-900/[0.08] pt-4">
                    <button
                      type="button"
                      onClick={reset}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-navy-900 transition-colors"
                    >
                      <RefreshCw className="size-3.5" />
                      Search Another Image
                    </button>
                    <Link
                      to={recognized?.searchTerms?.[0] ? `/products?q=${encodeURIComponent(recognized.searchTerms[0])}` : "/products"}
                      onClick={onClose}
                      className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-brand-700 hover:text-brand-800 transition-colors"
                    >
                      <span>See all results</span>
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              ) : (
                /* No matches, or the search could not run */
                <div>
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-navy-900/[0.08] bg-surface p-8 text-center sm:p-10">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200/60 shadow-xs">
                      {status === "error" ? <AlertCircle className="size-7" /> : <SearchX className="size-7" />}
                    </div>
                    <h3 className="mt-4 text-base font-bold text-navy-900 sm:text-lg">
                      {status === "error"
                        ? unavailable ? "Visual search is not available right now" : "We couldn't search this image"
                        : "No matching products found"}
                    </h3>
                    <p className="mt-1.5 max-w-md text-xs text-muted sm:text-sm">
                      {status === "error"
                        ? error?.message || "Please try again in a moment."
                        : recognized?.productName
                          ? `We recognised "${recognized.productName}", but no active listing matches it yet. Try another photo or search by name.`
                          : "We couldn't recognise a product in this photo. Try a clear photo of a single product."}
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                      {canRetry ? (
                        <button
                          type="button"
                          onClick={() => runSearch(lastFileRef.current.file, lastFileRef.current.name)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-navy-800 transition-colors"
                        >
                          <RefreshCw className="size-3.5" />
                          Try Again
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={reset}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-navy-900/10 bg-white px-4 py-2 text-xs font-semibold text-navy-800 shadow-2xs hover:bg-navy-50 transition-colors"
                      >
                        <Upload className="size-3.5" />
                        Try Another Image
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-end border-t border-navy-900/[0.08] pt-4">
                    <Link
                      to={recognized?.searchTerms?.[0] ? `/products?q=${encodeURIComponent(recognized.searchTerms[0])}` : "/products"}
                      onClick={onClose}
                      className="group inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-600 hover:shadow"
                    >
                      <span>{recognized?.searchTerms?.[0] ? `Search "${recognized.searchTerms[0]}"` : "Browse all products"}</span>
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
