"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ProductCardData } from "./types";

interface ProductCardProps {
  product: ProductCardData;
}

export function ProductCard({ product }: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const previewUrl = `/listings/${product.id}/preview`;

  const handleAddToCart = () => {
    try {
      const existingCart = JSON.parse(localStorage.getItem("tx_cart") || "[]");
      const existingItemIndex = existingCart.findIndex((item: any) => item.id === product.id);
      if (existingItemIndex > -1) {
        existingCart[existingItemIndex].quantity = (existingCart[existingItemIndex].quantity || 1) + 1;
      } else {
        existingCart.push({
          id: product.id,
          name: product.name,
          price: product.price,
          currency: product.currency,
          photo: product.photo,
          quantity: 1,
        });
      }
      localStorage.setItem("tx_cart", JSON.stringify(existingCart));
      window.dispatchEvent(new CustomEvent("cart-updated", { detail: { count: existingCart.length } }));
    } catch {}

    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  return (
    <div className="flex flex-col bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all text-slate-900 w-full max-w-[220px] shrink-0 group">
      {/* Image container */}
      <div className="relative h-28 w-full bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100">
        {product.photo ? (
          <img
            src={product.photo}
            alt={product.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        ) : (
          <span className="text-3xl">🛍️</span>
        )}
        <span className="absolute top-2 right-2 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
          In Stock
        </span>
      </div>

      {/* Info container */}
      <div className="p-3 flex flex-col flex-1 justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug">
            {product.name}
          </h4>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{product.sku}</p>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <span className="text-sm font-bold text-indigo-600">
                ₹{product.price.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400 ml-1">/ piece</span>
            </div>
            {product.rating && (
              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                ★ {product.rating}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100">
            <button
              onClick={handleAddToCart}
              className={`text-[11px] font-semibold py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 shadow-xs active:scale-95 ${
                added
                  ? "bg-emerald-600 text-white"
                  : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-200/80"
              }`}
            >
              {added ? (
                <>
                  <span>✓</span>
                  <span>Added</span>
                </>
              ) : (
                <>
                  <span>🛒</span>
                  <span>Add</span>
                </>
              )}
            </button>

            <Link
              href={previewUrl}
              target="_blank"
              className="text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-white py-1.5 px-2 rounded-lg transition-colors text-center shadow-xs flex items-center justify-center gap-0.5"
            >
              <span>View</span>
              <span className="text-[9px]">↗</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}