import { useMemo, useState } from "react";
import Section from "./Section";
import Tabs, { TabPanel } from "../common/Tabs";
import ProductGrid from "../products/ProductGrid";
import useProducts from "../../hooks/useProducts";

const TABS = [
  { id: "best", label: "Trending", link: "/products?sort=popular" },
  { id: "new", label: "New Arrivals", link: "/products?new=1&sort=newest" },
  { id: "deals", label: "Volume Deals", link: "/products?deal=1" },
];

export default function FeaturedProducts() {
  const { products, loading } = useProducts();
  const [tab, setTab] = useState("best");

  const lists = useMemo(() => {
    const active = products.filter((product) => product.status === "Active");
    return {
      best: [...active].sort((a, b) => b.orderCount - a.orderCount).slice(0, 8),
      new: active
        .filter((product) => product.isNew)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 8),
      deals: active.filter((product) => product.deal).slice(0, 8),
    };
  }, [products]);

  const current = TABS.find((item) => item.id === tab);

  return (
    <Section
      id="home-featured"
      tone="white"
      className="!bg-white"
      eyebrow="Featured wholesale"
      title="Products buyers are"
      accent="sourcing now."
      description="Every listing shows its minimum order quantity, tiered wholesale pricing in INR, and the supplier's country."
      linkTo={current.link}
      linkLabel={`All ${current.label.toLowerCase()}`}
    >
      <Tabs
        tabs={TABS}
        active={tab}
        onChange={setTab}
        idPrefix="featured"
        variant="pill"
        className="mb-6"
      />
      <TabPanel id={tab} idPrefix="featured">
        <ProductGrid
          products={lists[tab]}
          loading={loading}
          emptyTitle="Nothing here yet"
          emptyText="No products match this list at the moment."
        />
      </TabPanel>
    </Section>
  );
}
