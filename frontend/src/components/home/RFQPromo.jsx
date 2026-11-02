import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, FileText } from "lucide-react";
import Reveal from "../common/Reveal";
import { BotanicalAccent } from "./HeroSection";

const POINTS = [
  "Describe the product, specification and packaging once",
  "Set a target unit price and delivery window",
  "Track the status and supplier quotes in your dashboard",
];

/** High-visibility Request for Quotation feature panel with a working quick-start form. */
export default function RFQPromo() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");

  const submit = (event) => {
    event.preventDefault();
    if (!name.trim()) return setError("Tell us what you want to source.");
    if (
      quantity &&
      (!Number.isInteger(Number(quantity)) || Number(quantity) < 1)
    )
      return setError("Quantity must be a whole number above zero.");
    const params = new URLSearchParams({ name: name.trim() });
    if (quantity) params.set("qty", quantity);
    return navigate(`/rfq?${params.toString()}`);
  };

  return (
    <section
      aria-labelledby="rfq-promo-title"
      className="bg-white py-16 sm:py-24"
    >
      <div className="ts-container">
        <div className="ts-navy-texture relative isolate grid grid-cols-1 items-center gap-10 overflow-hidden rounded-[2.25rem] p-8 text-white sm:p-12 lg:grid-cols-[1.1fr_1fr] lg:p-16">
          <BotanicalAccent
            className="-left-8 -bottom-10 -z-10 w-52 -rotate-12 !text-[#a8c494]"
            opacity={0.25}
          />
          <BotanicalAccent
            className="right-[38%] -top-14 -z-10 hidden w-40 rotate-[160deg] !text-[#a8c494] lg:block"
            opacity={0.18}
          />
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#d6e6c8] ring-1 ring-white/15">
              Request for quotation
            </p>
            <h2
              id="rfq-promo-title"
              className="mt-5 text-4xl font-extrabold !leading-[1.05] tracking-[-0.04em] !text-white sm:text-5xl"
            >
              One request.
              <br />
              <span className="font-medium text-[#c9dcb9]">Many quotes.</span>
            </h2>
            <p className="mt-5 max-w-md text-[1.0625rem] leading-relaxed text-white/75">
              Can’t find the exact product? Post a buying request and let
              suppliers respond with pricing, lead time and sample terms.
            </p>
            <ul className="mt-8 space-y-3.5">
              {POINTS.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 text-[0.9375rem] text-white/90"
                >
                  <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#a8c494] text-[#123f25]">
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            <form
              onSubmit={submit}
              noValidate
              className="rounded-[1.75rem] bg-white p-6 text-ink shadow-pop sm:p-8"
            >
              <p className="flex items-center gap-2 font-display text-lg font-bold text-navy-900">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-[#e7efe0] text-navy-900">
                  <FileText className="size-4" aria-hidden="true" />
                </span>
                Start a buying request
              </p>
              <label htmlFor="rfq-quick-name" className="ts-label mt-6">
                What are you looking for?
              </label>
              <input
                id="rfq-quick-name"
                className="ts-input"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
                placeholder="e.g. 500 ml stainless steel bottles"
                aria-invalid={error && !name.trim() ? "true" : undefined}
              />
              <label htmlFor="rfq-quick-qty" className="ts-label mt-4">
                Quantity
              </label>
              <input
                id="rfq-quick-qty"
                className="ts-input"
                type="number"
                min="1"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setError("");
                }}
                placeholder="e.g. 2000"
              />
              {error ? (
                <p
                  role="alert"
                  className="mt-2 text-[0.8125rem] font-medium text-danger"
                >
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="mt-6 inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-navy-900 px-6 font-semibold text-white shadow-lift transition-all hover:-translate-y-px hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Continue to full request{" "}
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
              <p className="mt-3 text-center text-xs text-muted">
                You can add specifications, target price and delivery details on
                the next step.
              </p>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
