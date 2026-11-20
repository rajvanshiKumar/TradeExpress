"use client";

import React, { useState } from "react";
import { ChatWindow } from "./ChatWindow";

interface ChatWidgetProps {
  apiUrl?: string;
}

export function ChatWidget({ apiUrl }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Expanded Chat Window */}
      {isOpen && (
        <div className="mb-3">
          <ChatWindow onClose={() => setIsOpen(false)} apiUrl={apiUrl} />
        </div>
      )}

      {/* Floating Action Trigger */}
      <div className="flex items-center gap-3">
        {/* Helper Notification Pill (only shown when closed) */}
        {!isOpen && showTooltip && (
          <div className="hidden sm:flex items-center gap-2 bg-white text-slate-800 text-xs font-semibold py-2 px-3.5 rounded-2xl shadow-xl border border-slate-200/80 animate-bounce duration-1000">
            <span>✨ Need help? Track order or search items!</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTooltip(false);
              }}
              className="text-slate-400 hover:text-slate-600 text-[10px] ml-1 p-0.5 rounded-full hover:bg-slate-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Floating Bubble Button */}
        <button
          onClick={() => {
            setIsOpen((prev) => !prev);
            setShowTooltip(false);
          }}
          className={`relative rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-indigo-300/60 active:scale-95 ${
            isOpen
              ? "w-13 h-13 bg-slate-800 hover:bg-slate-900 text-white"
              : "px-4 py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white shadow-indigo-600/30"
          }`}
          aria-label="Toggle Shopping Assistant Chatbot"
        >
          {isOpen ? (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <span className="text-xs font-bold tracking-tight">Ask AI</span>
              {/* Online pulse indicator */}
              <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-indigo-700 animate-pulse" />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

export default ChatWidget;
