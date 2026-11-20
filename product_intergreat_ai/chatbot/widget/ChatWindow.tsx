"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./types";
import { ProductCard } from "./ProductCard";
import { OrderTracker } from "./OrderTracker";
import { FormattedMessage } from "./FormattedMessage";

interface ChatWindowProps {
  onClose: () => void;
  apiUrl?: string;
}

export function ChatWindow({ onClose, apiUrl }: ChatWindowProps) {
  const baseChatUrl =
    apiUrl ||
    (typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat`
      : "/api/v1/chat");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "Welcome to **TradeExpress** ✨\n\nYour personal shopping assistant for product discovery, live order tracking, and store queries. How may I assist you today?",
      quickSuggestions: [],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const startVoiceInput = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please try Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  useEffect(() => {
    let savedSess = "";
    try {
      savedSess = sessionStorage.getItem("tx_chat_session_id") || "";
    } catch {}
    if (!savedSess) {
      savedSess = `sess_${Math.random().toString(36).substring(2, 10)}`;
      try {
        sessionStorage.setItem("tx_chat_session_id", savedSess);
      } catch {}
    }
    setSessionId(savedSess);
  }, []);

  useEffect(() => {
    if (messages.length <= 1) return;
    const lastMsg = messages[messages.length - 1];

    if (lastMsg.role === "assistant") {
      // Auto-scroll to the top/beginning of the newly arrived AI response
      // so the user reads from the first line and NEVER has to scroll up!
      setTimeout(() => {
        const el = document.getElementById(`msg-${lastMsg.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }, 50);
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSend = async (messageText: string) => {
    const text = messageText.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      let res: Response;
      try {
        res = await fetch(`${baseChatUrl}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            session_id: sessionId,
          }),
        });
      } catch {
        // Fallback through Next.js proxy rewrite
        res = await fetch(`/api/v1/chat/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            session_id: sessionId,
          }),
        });
      }

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = await res.json();
      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        role: "assistant",
        content: data.reply || "Aapka sawal mil gaya hai, please thoda intezaar karein.",
        products: data.products || [],
        orderStatus: data.order_status || null,
        quickSuggestions: data.quick_suggestions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const fallbackMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content:
          "Network se connect karne me problem aayi. Please make sure backend is running on `http://localhost:8000` ya support team (+91 98765 43210) se sampark karein.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: `reset_${Date.now()}`,
        role: "assistant",
        content: "Chat cleared! How can I assist you with your shopping or orders?",
        quickSuggestions: [
          "📦 Track an Order",
          "👕 Black Shirts under ₹1000",
          "🔄 7-Day Return Policy",
          "💼 Wholesale Bulk Rates",
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[580px] w-[370px] sm:w-[410px] bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden font-sans ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 px-4 py-3.5 text-white flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-lg border border-white/25 shadow-inner">
            🤖
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-indigo-700 rounded-full ring-1 ring-emerald-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm tracking-tight text-white">TradeExpress AI</h3>
              <span className="bg-white/20 text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded text-indigo-100">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-indigo-100/90 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Online · Typically replies instantly
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            title="Reset Chat"
            className="p-1.5 hover:bg-white/15 active:scale-95 rounded-xl text-white/80 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={onClose}
            title="Minimize"
            className="p-1.5 hover:bg-white/15 active:scale-95 rounded-xl text-white/80 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gradient-to-b from-slate-50/80 to-white">
        {messages.map((m, mIdx) => (
          <div
            key={m.id}
            id={`msg-${m.id}`}
            className={`flex flex-col scroll-mt-2 ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs transition-all ${
                m.role === "user"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-xs font-medium shadow-indigo-600/10"
                  : "bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs shadow-slate-100"
              }`}
            >
              <FormattedMessage content={m.content} isUser={m.role === "user"} />
            </div>

            {/* If welcome message and first load, show 4 clean quick action cards */}
            {mIdx === 0 && messages.length === 1 && (
              <div className="grid grid-cols-2 gap-2 w-full mt-2.5">
                <button
                  onClick={() => handleSend("Track an Order")}
                  className="flex items-center gap-2.5 p-2.5 bg-white hover:bg-indigo-50/70 border border-slate-200/90 hover:border-indigo-300 rounded-xl transition-all text-left group shadow-xs active:scale-95"
                >
                  <span className="text-xl">📦</span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600 block leading-tight">
                      Track Order
                    </span>
                    <span className="text-[10px] text-slate-400">Live courier status</span>
                  </div>
                </button>

                <button
                  onClick={() => handleSend("Black Shirts under ₹1000")}
                  className="flex items-center gap-2.5 p-2.5 bg-white hover:bg-indigo-50/70 border border-slate-200/90 hover:border-indigo-300 rounded-xl transition-all text-left group shadow-xs active:scale-95"
                >
                  <span className="text-xl">👕</span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600 block leading-tight">
                      Find Clothes
                    </span>
                    <span className="text-[10px] text-slate-400">Under ₹1,000</span>
                  </div>
                </button>

                <button
                  onClick={() => handleSend("What is your return policy?")}
                  className="flex items-center gap-2.5 p-2.5 bg-white hover:bg-indigo-50/70 border border-slate-200/90 hover:border-indigo-300 rounded-xl transition-all text-left group shadow-xs active:scale-95"
                >
                  <span className="text-xl">🔄</span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600 block leading-tight">
                      7-Day Return
                    </span>
                    <span className="text-[10px] text-slate-400">Hassle-free refund</span>
                  </div>
                </button>

                <button
                  onClick={() => handleSend("Check Delivery Time")}
                  className="flex items-center gap-2.5 p-2.5 bg-white hover:bg-indigo-50/70 border border-slate-200/90 hover:border-indigo-300 rounded-xl transition-all text-left group shadow-xs active:scale-95"
                >
                  <span className="text-xl">🚚</span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600 block leading-tight">
                      Delivery Time
                    </span>
                    <span className="text-[10px] text-slate-400">Free over ₹999</span>
                  </div>
                </button>
              </div>
            )}

            {/* Embedded Order Tracker Card */}
            {m.orderStatus && (
              <div className="w-full mt-2 animate-in fade-in duration-300">
                <OrderTracker order={m.orderStatus} />
              </div>
            )}

            {/* Embedded Product Cards (Horizontal Carousel) */}
            {m.products && m.products.length > 0 && (
              <div className="w-full mt-2.5 animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-1.5 px-0.5">
                  <span className="text-[11px] font-bold text-slate-700 tracking-tight">
                    Recommended Products ({m.products.length})
                  </span>
                  <span className="text-[10px] text-indigo-600 font-semibold">Swipe to explore →</span>
                </div>
                <div className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 scrollbar-thin">
                  {m.products.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            )}

            {/* Quick Suggestions Chips (only for follow-up responses, never on the initial welcome screen) */}
            {m.quickSuggestions && m.quickSuggestions.length > 0 && !(mIdx === 0 && messages.length === 1) && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {m.quickSuggestions.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(chip)}
                    className="text-[11px] bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 border border-slate-200/90 hover:border-indigo-300 rounded-full px-3 py-1 transition-all font-medium shadow-2xs active:scale-95 flex items-center gap-1"
                  >
                    <span>{chip}</span>
                    <span className="text-indigo-400 font-bold">→</span>
                  </button>
                ))}
              </div>
            )}

            <span className="text-[10px] text-slate-400 mt-1 px-1 font-medium">{m.timestamp}</span>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2.5 bg-white border border-slate-200/90 rounded-2xl px-4 py-2.5 w-fit text-xs text-slate-600 shadow-sm animate-pulse">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
            <span className="font-medium">Searching catalog & orders...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form & Footer */}
      <div className="p-3 bg-white border-t border-slate-100 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-2xl p-1.5 pl-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white transition-all shadow-inner"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening... speak now" : "Ask in English or Hindi / Order ID..."}
            className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />

          {/* Voice Search (Mic) Button */}
          <button
            type="button"
            onClick={startVoiceInput}
            title={isListening ? "Stop listening" : "Voice search (Hindi/English)"}
            className={`p-1.5 rounded-xl transition-all shrink-0 flex items-center justify-center ${
              isListening
                ? "bg-rose-500 text-white animate-pulse shadow-sm"
                : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`rounded-xl p-2 transition-all flex items-center justify-center shrink-0 ${
              input.trim() && !isLoading
                ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30 hover:shadow-lg active:scale-95"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            <svg className="w-4 h-4 rotate-90" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </form>

        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mt-2 font-medium">
          <span>⚡</span>
          <span>Powered by TradeExpress AI</span>
        </div>
      </div>
    </div>
  );
}
