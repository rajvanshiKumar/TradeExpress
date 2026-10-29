import { ArrowRight, Plus } from "lucide-react";
import Button from "../common/Button";
import Reveal from "../common/Reveal";
import { BotanicalAccent } from "./HeroSection";
import useAuth from "../../hooks/useAuth";

/** Supplier recruitment call to action on a sage panel. */
export default function SupplierCTA() {
  const { user } = useAuth();
  const isSupplier = user?.role === "supplier";
  const isBuyer = user?.role === "buyer";

  return (
    <section
      aria-labelledby="join-cta-title"
      className="bg-ivory py-16 sm:py-24"
    >
      <div className="ts-container">
        <Reveal className="ts-sage relative isolate overflow-hidden rounded-[2.25rem] px-7 py-14 text-center text-navy-900 sm:px-16 sm:py-20">
          <BotanicalAccent
            className="-left-6 -bottom-12 -z-10 w-52 -rotate-12"
            opacity={0.18}
          />
          <BotanicalAccent
            className="-right-4 -top-10 -z-10 w-48 rotate-[200deg]"
            opacity={0.14}
          />
          <p className="inline-flex items-center gap-2 rounded-full bg-white/55 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] ring-1 ring-navy-900/10">
            For suppliers
          </p>
          <h2
            id="join-cta-title"
            className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold !leading-[1.06] tracking-[-0.04em] sm:text-5xl"
          >
            Bring your catalogue to{" "}
            <span className="font-medium text-navy-700">
              international buyers.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-navy-900/75">
            {isSupplier
              ? "Manage your active catalogue with real-time stock, tiered wholesale pricing, and respond to commercial buyer inquiries."
              : "Create a free supplier account, publish products with MOQs and price tiers, and answer quotation requests from business buyers."}
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 xs:flex-row">
            {isSupplier ? (
              <>
                <Button
                  to="/supplier/dashboard"
                  size="lg"
                  variant="navy"
                  iconRight={ArrowRight}
                >
                  Go to Supplier Dashboard
                </Button>
                <Button
                  to="/supplier/products/new"
                  size="lg"
                  variant="white"
                  icon={Plus}
                >
                  Add New Product
                </Button>
              </>
            ) : isBuyer ? (
              <>
                <Button
                  to="/buyer"
                  size="lg"
                  variant="navy"
                  iconRight={ArrowRight}
                >
                  Go to Buyer Dashboard
                </Button>
                <Button to="/rfq" size="lg" variant="white">
                  Post Requirement (RFQ)
                </Button>
              </>
            ) : (
              <>
                <Button
                  to="/supplier/register"
                  size="lg"
                  variant="navy"
                  iconRight={ArrowRight}
                >
                  Join as a Supplier
                </Button>
                <Button to="/register" size="lg" variant="white">
                  Join as a Buyer
                </Button>
              </>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
