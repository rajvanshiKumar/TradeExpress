"use client";

import React from "react";
import { OrderStatusData } from "./types";

interface OrderTrackerProps {
  order: OrderStatusData;
}

export function OrderTracker({ order }: OrderTrackerProps) {
  const getBadgeColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "DELIVERED":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "SHIPPED":
      case "OUT_FOR_DELIVERY":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "CANCELLED":
        return "bg-rose-100 text-rose-800 border-rose-300";
      default:
        return "bg-amber-100 text-amber-800 border-amber-300";
    }
  };

  const progress = order.progress_percentage ?? 50;

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm my-1 text-slate-800 text-xs">
      {/* Header with order number and status pill */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
        <div>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
            Order Reference
          </span>
          <span className="font-bold text-slate-900 font-mono text-sm">
            #{order.order_number}
          </span>
        </div>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getBadgeColor(
            order.order_status
          )}`}
        >
          {order.order_status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-slate-500 font-medium mb-1">
          <span>Placed</span>
          <span>Packed</span>
          <span>Shipped</span>
          <span>Delivered</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className="bg-indigo-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Shipment & ETA Details */}
      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-2.5">
        <div>
          <span className="text-[10px] text-slate-400 block">Courier Carrier</span>
          <span className="font-semibold text-slate-800">{order.carrier_name || "Delhivery"}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block">Tracking ID</span>
          <span className="font-mono text-slate-800 font-semibold">{order.tracking_number || "EXP-98124"}</span>
        </div>
        <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center gap-1.5 text-indigo-700">
          <span>🕒</span>
          <span className="font-medium text-[11px]">{order.shipping_eta || "Delivery in 2-3 business days"}</span>
        </div>
      </div>

      {/* Items list */}
      {order.items && order.items.length > 0 && (
        <div className="border-t border-slate-100 pt-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Items in this Package ({order.items.length})
          </span>
          {order.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-1 text-slate-700">
              <span className="truncate max-w-[170px] text-[11px]">
                {item.quantity}x {item.product_name}
              </span>
              <span className="font-semibold text-slate-900 text-[11px]">
                ₹{item.line_total.toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Total Amount Footer */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500">Total Paid ({order.payment_status}):</span>
        <span className="font-bold text-slate-900 text-sm text-indigo-600">
          ₹{order.total.toLocaleString("en-IN")}
        </span>
      </div>
    </div>
  );
}
