// Seed catalogue: 51 sample products across the 10 sample supplier companies. Prices are in INR.
// Prices, stock, lead times, ratings and review counts are invented sample values.
//
// Row format:
//   [name, company number (1–10), category slug, subcategory, unit price (INR), unit, MOQ, stock,
//    lead time (days), flags, image, one-line summary, variants]
// flags: F featured · T trending · R ready to ship · N new arrival · D wholesale deal
// image: "photo-…" = Unsplash photo ID, otherwise the name of a local illustration in public/images
//
// Rows are expanded into full product records at the bottom of the file.

import { daysAgo } from '../utils/formatDate.js';

const rows = [
  // 1 — Shenzhen NovaTech Electronics
  ['Wireless Noise-Cancelling Headphones', 1, 'electronics', 'Audio', 1540, 'piece', 100, 12000, 12, 'FTR', 'photo-1505740420928-5e560c06d30e', 'Over-ear Bluetooth 5.3 headphones with hybrid noise cancelling and 40-hour playback.', { Colour: ['Black', 'Ivory', 'Navy'] }],
  ['True Wireless Earbuds with Charging Case', 1, 'electronics', 'Audio', 565, 'piece', 200, 30000, 10, 'TRD', 'photo-1606220588913-b3aacb4d2f46', 'Compact earbuds with touch controls, ENC microphones and a USB-C charging case.', { Colour: ['Black', 'White'] }],
  ['Portable Bluetooth Speaker 20W', 1, 'electronics', 'Audio', 930, 'piece', 100, 8000, 14, 'FN', 'photo-1589003077984-894e133dabab', 'Splash-resistant 20W speaker with dual passive radiators and 12-hour battery.', { Colour: ['Graphite', 'Red', 'Blue'] }],
  ['Smart Fitness Watch (AMOLED)', 1, 'electronics', 'Wearables', 1240, 'piece', 100, 15000, 15, 'FT', 'photo-1579586337278-3befd40fd17a', '1.43-inch AMOLED fitness watch with heart-rate, SpO2 and sleep tracking.', { Colour: ['Black', 'Silver'], Strap: ['Silicone', 'Nylon'] }],
  ['10,000 mAh Power Bank', 1, 'electronics', 'Mobile Accessories', 450, 'piece', 300, 40000, 7, 'RD', 'photo-1566554738544-d962991c3fee', 'Slim 22.5W fast-charging power bank with USB-C in/out and LED level display.', { Colour: ['Black', 'Green', 'White'] }],
  ['Wireless Game Controller', 1, 'toys-games', 'Gaming Accessories', 795, 'piece', 200, 9000, 12, 'N', 'photo-1612287230202-1ff1d85d1bdf', 'Bluetooth and 2.4G controller with hall-effect sticks and programmable back paddles.', { Colour: ['Black', 'White'] }],

  // 2 — Pearl River Garments Co.
  ['Heavyweight Cotton T-Shirt (Blank)', 2, 'fashion-apparel', 'T-Shirts', 240, 'piece', 300, 60000, 12, 'FTR', 'photo-1620799139652-715e4d5b232d', '240 gsm combed-cotton blank tee, pre-shrunk, ready for print or embroidery.', { Colour: ['White', 'Black', 'Sand', 'Navy'], Size: ['S', 'M', 'L', 'XL', 'XXL'] }],
  ['Pullover Fleece Hoodie', 2, 'fashion-apparel', 'Hoodies', 645, 'piece', 200, 22000, 18, 'FT', 'photo-1556821840-3a63f95609a7', '320 gsm brushed-fleece hoodie with lined hood and kangaroo pocket.', { Colour: ['Grey Melange', 'Black', 'Forest'], Size: ['S', 'M', 'L', 'XL'] }],
  ['Classic Denim Jacket', 2, 'fashion-apparel', 'Outerwear', 1120, 'piece', 150, 9000, 25, 'N', 'photo-1611312449408-fcece27cdbb7', '12 oz rigid-denim trucker jacket with metal shank buttons and custom label option.', { Wash: ['Mid Blue', 'Dark Indigo'], Size: ['S', 'M', 'L', 'XL'] }],
  ['Tailored Single-Breasted Blazer', 2, 'fashion-apparel', 'Outerwear', 1740, 'piece', 100, 4000, 30, '', 'photo-1592343516109-362f7bd871aa', 'Half-lined blazer in a wool-blend twill with notch lapel and two-button front.', { Colour: ['Black', 'Charcoal'], Size: ['46', '48', '50', '52'] }],

  // 3 — Jaipur Craft & Home Exports
  ['Hand-Glazed Ceramic Vase', 3, 'home-kitchen', 'Home Decor', 380, 'piece', 100, 5000, 20, 'F', 'photo-1612196808214-b8e1d6145a8c', 'Wheel-thrown ceramic vase with a reactive matte glaze, each piece slightly unique.', { Finish: ['Ivory', 'Sand', 'Charcoal'], Height: ['18 cm', '26 cm'] }],
  ['Scented Soy Candle Set', 3, 'home-kitchen', 'Home Fragrance', 265, 'set', 200, 12000, 10, 'TR', 'photo-1643122966676-29e8597257f7', 'Set of three hand-poured soy candles with cotton wicks and custom fragrance options.', { Fragrance: ['Sandalwood', 'Jasmine', 'Citrus'] }],
  ['Stoneware Dinnerware Set (16 pc)', 3, 'home-kitchen', 'Tableware', 1620, 'set', 50, 2500, 25, 'FD', 'photo-1551807306-4bcd16b92a41', 'Sixteen-piece stoneware set for four: dinner plates, side plates, bowls and mugs.', { Glaze: ['Speckled White', 'Ocean Blue', 'Terracotta'] }],
  ['Minimal Wall Clock', 3, 'home-kitchen', 'Home Decor', 490, 'piece', 100, 6000, 15, 'R', 'photo-1563861826100-9cb868fdbe1c', '30 cm silent-sweep wall clock with a powder-coated metal case.', { Colour: ['White', 'Black', 'Brass'] }],
  ['Handcrafted Wooden Toy Blocks', 3, 'toys-games', 'Wooden Toys', 530, 'set', 100, 4000, 18, 'N', 'photo-1575364289437-fb1479d52732', 'Fifty-piece block set in sanded neem wood with water-based, child-safe colours.', { Set: ['50 pieces', '100 pieces'] }],

  // 4 — Mumbai Industrial Solutions
  ['Cordless Impact Drill 20V', 4, 'machinery', 'Power Tools', 2660, 'piece', 50, 3000, 20, 'F', 'photo-1562237553-36ad661d6f2c', 'Brushless 20V impact drill with two-speed gearbox, 13 mm chuck and two batteries.', { Kit: ['Tool only', 'With 2 batteries'] }],
  ['Bench CNC Engraving Machine (3-Axis)', 4, 'machinery', 'CNC & Machine Tools', 120400, 'unit', 1, 60, 35, 'T', 'photo-1566930665082-4ae9dbbb5b6b', 'Desktop 3-axis CNC router with 600 × 400 mm bed, ball screws and offline controller.', { Spindle: ['800 W', '1.5 kW'] }],
  ['Hydraulic Floor Jack 3 Ton', 4, 'automotive', 'Garage Equipment', 3150, 'piece', 20, 1200, 18, 'R', 'photo-1580273916550-e323be2ae537', 'Low-profile 3-ton trolley jack with dual-piston pump and safety overload valve.', { Colour: ['Red', 'Blue'] }],
  ['Knapsack Battery Sprayer 16L', 4, 'agriculture', 'Farm Equipment', 1740, 'piece', 50, 2500, 15, 'N', 'photo-1549049950-48d5887197a0', '16-litre backpack sprayer with 12V battery pump, adjustable lance and four nozzles.', { Battery: ['8 Ah', '12 Ah'] }],
  ['Industrial Safety Helmet', 4, 'industrial-supplies', 'Safety & PPE', 200, 'piece', 500, 40000, 7, 'RD', 'photo-1581092921461-eab62e97a780', 'Ventilated ABS safety helmet with ratchet suspension and chin strap.', { Colour: ['White', 'Yellow', 'Blue', 'Red'] }],
  ['Combination Wrench Set (14 pc)', 4, 'industrial-supplies', 'Hand Tools', 815, 'set', 100, 5000, 12, '', 'photo-1613206485381-b028e578e791', 'Fourteen chrome-vanadium combination wrenches, 8–24 mm, in a roll-up pouch.', { Finish: ['Mirror chrome', 'Matte'] }],

  // 5 — Seoul BeautySource Trading
  ['Vitamin C Brightening Serum 30 ml', 5, 'beauty-personal-care', 'Skincare', 230, 'piece', 500, 50000, 14, 'FTR', 'photo-1723951174326-2a97221d3b7f', 'Lightweight serum with a stabilised vitamin C derivative, available for private label.', { Size: ['30 ml', '50 ml'] }],
  ['Hydrating Gel Cream 50 ml', 5, 'beauty-personal-care', 'Skincare', 200, 'piece', 500, 35000, 14, 'T', 'photo-1629732047847-50219e9c5aef', 'Oil-free gel moisturiser with hyaluronic acid in a recyclable jar.', { Size: ['50 ml', '100 ml'] }],
  ['Velvet Matte Lipstick', 5, 'beauty-personal-care', 'Makeup', 135, 'piece', 1000, 80000, 12, 'D', 'photo-1586495777744-4413f21062fa', 'Long-wear matte bullet lipstick, offered in 24 stock shades or custom colours.', { Shade: ['Classic Red', 'Rose', 'Nude', 'Berry'] }],
  ['Professional Makeup Brush Set (12 pc)', 5, 'beauty-personal-care', 'Tools', 350, 'set', 300, 15000, 10, 'RN', 'photo-1620464003286-a5b0d79f32c2', 'Twelve synthetic-fibre brushes with wooden handles and an optional travel roll.', { Handle: ['Black', 'Walnut'] }],
  ['Mineral Sunscreen SPF 50', 5, 'beauty-personal-care', 'Sun Care', 175, 'piece', 500, 26000, 14, '', 'photo-1698906821280-34072d3ac1be', 'Zinc-oxide mineral sunscreen in a 50 ml tube with a light, non-greasy finish.', { Size: ['50 ml', '100 ml'] }],

  // 6 — Ho Chi Minh Packaging Works
  ['Kraft Paper Shopping Bags', 6, 'packaging', 'Paper Packaging', 15, 'piece', 5000, 900000, 12, 'FTR', 'photo-1513884923967-4b182ef167ab', 'Twisted-handle kraft bags in three sizes, with one- to four-colour custom print.', { Size: ['Small', 'Medium', 'Large'], Paper: ['Brown kraft', 'White kraft'] }],
  ['Amber Glass Jars with Lids', 6, 'packaging', 'Glass Packaging', 35, 'piece', 3000, 400000, 15, 'T', 'photo-1572726729207-a78d6feb18d7', 'Straight-sided amber jars for candles and cosmetics, supplied with metal lids.', { Capacity: ['120 ml', '250 ml', '500 ml'] }],
  ['Clear Glass Bottles 250 ml', 6, 'packaging', 'Glass Packaging', 29, 'piece', 3000, 350000, 15, '', 'photo-1601066551508-6d9cb1b9de65', 'Flint-glass bottles with a 28 mm neck, compatible with pump, spray or screw caps.', { Closure: ['Screw cap', 'Pump', 'Spray'] }],
  ['Amber Dropper Bottles 30 ml', 6, 'packaging', 'Cosmetic Packaging', 24, 'piece', 5000, 600000, 12, 'RD', 'photo-1608571423902-eed4a5ad8108', '30 ml amber dropper bottles with glass pipette, for serums and oils.', { Collar: ['Black', 'Gold', 'White'] }],
  ['Corrugated Shipping Cartons', 6, 'packaging', 'Corrugated Boxes', 45.5, 'piece', 2000, 250000, 10, 'N', 'photo-1513672494107-cd9d848a383e', 'Five-ply corrugated cartons made to size, with optional flexo print.', { Board: ['3-ply', '5-ply'] }],

  // 7 — Istanbul Leather & Fashion
  ['Full-Grain Leather Tote Bag', 7, 'fashion-apparel', 'Bags & Accessories', 1990, 'piece', 50, 2000, 20, 'FT', 'photo-1624687943971-e86af76d57de', 'Unlined full-grain leather tote with reinforced handles and inner zip pocket.', { Colour: ['Tan', 'Black', 'Chestnut'] }],
  ['Bifold Leather Wallet', 7, 'fashion-apparel', 'Bags & Accessories', 455, 'piece', 200, 12000, 12, 'R', 'photo-1601592996763-f05c9c80a7f1', 'Slim bifold wallet with six card slots, hand-painted edges and logo embossing.', { Colour: ['Black', 'Brown'] }],
  ['Leather Belt with Steel Buckle', 7, 'fashion-apparel', 'Bags & Accessories', 400, 'piece', 200, 10000, 12, 'D', 'photo-1624222247344-550fb60583dc', '35 mm vegetable-tanned leather belt with a brushed stainless-steel buckle.', { Colour: ['Brown', 'Black'], Length: ['95 cm', '105 cm', '115 cm'] }],
  ['Leather Laptop Briefcase', 7, 'fashion-apparel', 'Bags & Accessories', 3150, 'piece', 30, 1200, 25, 'N', 'photo-1473188588951-666fce8e7c68', 'Structured leather briefcase with a padded 15-inch laptop sleeve and shoulder strap.', { Colour: ['Brown', 'Black'] }],

  // 8 — Dhaka Cotton Industries
  ['Knitted Crewneck Sweater', 8, 'fashion-apparel', 'Knitwear', 695, 'piece', 300, 18000, 25, 'T', 'photo-1631541909061-71e349d1f203', '7-gauge cotton-blend crewneck with ribbed trims, knitted to your colour card.', { Colour: ['Oatmeal', 'Grey', 'Navy'], Size: ['S', 'M', 'L', 'XL'] }],
  ['Woven Cotton Shirt', 8, 'fashion-apparel', 'Shirts', 430, 'piece', 300, 25000, 20, 'FR', 'photo-1713881587420-113c1c43e28a', 'Poplin cotton shirt with a classic collar, available plain, striped or checked.', { Colour: ['White', 'Sky Blue'], Size: ['S', 'M', 'L', 'XL'] }],
  ['Stretch Denim Jeans', 8, 'fashion-apparel', 'Denim', 790, 'piece', 300, 30000, 28, '', 'photo-1624378439575-d8705ad7ae80', 'Five-pocket jeans in 11 oz stretch denim, with wash and trim options.', { Wash: ['Mid Blue', 'Black'], Fit: ['Slim', 'Straight'] }],
  ['Cotton Bed Linen Set', 8, 'home-kitchen', 'Bedding', 1040, 'set', 100, 8000, 22, 'D', 'photo-1606855637183-ea2a00b6f15f', '200-thread-count cotton percale set: duvet cover, fitted sheet and two pillowcases.', { Size: ['Single', 'Double', 'King'], Colour: ['White', 'Grey'] }],

  // 9 — Milan Living & Furniture
  ['Modern Fabric Sofa', 9, 'furniture', 'Living Room', 54995, 'piece', 5, 300, 40, 'FT', '/images/modern-fabric-sofa.jpg', 'Modern cream fabric sofa with plush green accent cushions on a solid beech frame.', { Fabric: ['Cream', 'Forest Green', 'Stone'] }],
  ['Upholstered Accent Armchair', 9, 'furniture', 'Living Room', 13700, 'piece', 10, 500, 35, 'F', 'photo-1586023492125-27b2c045efd7', 'Compact armchair with solid-ash legs and high-resilience foam seat.', { Fabric: ['Mustard', 'Grey', 'Teal'] }],
  ['Arc Floor Lamp', 9, 'furniture', 'Lighting', 4810, 'piece', 20, 900, 25, 'N', 'photo-1494438639946-1ebd1d20bf85', 'Steel arc floor lamp with a weighted base and E27 holder, flat-packed.', { Finish: ['Matte Black', 'Brass'] }],
  ['Chesterfield Leather Sofa', 9, 'furniture', 'Living Room', 64700, 'piece', 2, 120, 45, '', 'photo-1573866926487-a1865558a9cf', 'Hand-tufted two-seat Chesterfield in top-grain leather with rolled arms.', { Leather: ['Cognac', 'Oxblood', 'Black'] }],
  ['Ergonomic Office Chair', 9, 'furniture', 'Office', 6140, 'piece', 20, 1500, 30, 'R', 'photo-1580480095047-4aa43ab3bd1d', 'Adjustable task chair with lumbar support, tilt lock and breathable upholstery.', { Colour: ['Brown', 'Black'] }],

  // 10 — Austin GreenSupply Co.
  ['Soy Wax Candle in Amber Jar', 10, 'home-kitchen', 'Home Fragrance', 325, 'piece', 200, 9000, 10, 'RN', 'photo-1612293905607-b003de9e54fb', '220 g soy-wax candle in a reusable amber jar, with phthalate-free fragrance.', { Fragrance: ['Cedar', 'Lavender', 'Unscented'] }],
  ['Organic Cotton Pillow Set', 10, 'home-kitchen', 'Bedding', 765, 'set', 100, 4000, 14, '', 'photo-1617325247661-675ab4b64ae2', 'Pair of pillows with organic cotton covers and recycled-fibre filling.', { Firmness: ['Soft', 'Medium'] }],
  ['Refillable Amber Glass Bottle 500 ml', 10, 'packaging', 'Glass Packaging', 80, 'piece', 1000, 60000, 10, 'T', 'photo-1608571424266-edeb9bbefdec', 'Thick-walled 500 ml amber bottle designed for refill programmes.', { Closure: ['Pump', 'Screw cap'] }],
  ['Trail Running Shoes (Recycled Upper)', 10, 'sports-outdoors', 'Footwear', 1370, 'pair', 200, 7000, 25, 'F', 'photo-1562183241-b937e95585b6', 'Trail shoe with a recycled-polyester mesh upper and 4 mm lug rubber outsole.', { Size: ['EU 38', 'EU 40', 'EU 42', 'EU 44'] }],
  ['Hiking Backpack 40L', 10, 'sports-outdoors', 'Outdoor Gear', 1230, 'piece', 100, 5000, 20, 'TD', 'photo-1509762774605-f07235a08f1f', '40-litre pack in recycled ripstop with ventilated back panel and rain cover.', { Colour: ['Grey', 'Olive'] }],
  ['Seed Starter Trays (Biodegradable)', 10, 'agriculture', 'Gardening', 50, 'piece', 2000, 150000, 10, 'N', 'photo-1635574901622-8014a3ddead5', 'Moulded-fibre 12-cell seed trays that can be planted directly into soil.', { Cells: ['12-cell', '24-cell'] }],
  ['All-Season Car Floor Mats', 10, 'automotive', 'Interior Accessories', 620, 'set', 100, 6000, 14, '', 'photo-1649136378672-b965cb9935d5', 'Set of four trim-to-fit floor mats made with recycled rubber.', { Colour: ['Black', 'Grey'] }],

  // =========================================================================
  // MULTI-SUPPLIER BENCHMARK PRODUCTS (10 DISTINCT COMPETING SELLERS)
  // Enables instant, rich side-by-side / div-by-div comparison across 10 sellers
  // =========================================================================

  // --- Cotton T-Shirts line across all 10 companies ---
  ['Smart Heated Cotton T-Shirt', 1, 'fashion-apparel', 'T-Shirts', 780, 'piece', 100, 15000, 10, 'FTR', 'photo-1521572267360-ee0c2909d518', '220 gsm cotton tee with integrated washable carbon-fibre heating element and 3 temperature settings.', { Colour: ['Black', 'Navy'], Size: ['M', 'L', 'XL'] }],
  ['Organic Hand-Dyed Cotton T-Shirt', 3, 'fashion-apparel', 'T-Shirts', 320, 'piece', 150, 18000, 15, 'FR', 'photo-1503342217505-b0a15ec3261c', '100% natural organic cotton tee hand-dyed with vegetable dyes in traditional Jaipur artisan blocks.', { Colour: ['Indigo Blue', 'Ochre Yellow', 'Sage Green'], Size: ['S', 'M', 'L', 'XL'] }],
  ['Heavy-Duty Industrial Cotton Workwear T-Shirt', 4, 'fashion-apparel', 'T-Shirts', 210, 'piece', 200, 45000, 10, 'RD', 'photo-1583743814966-8936f5b7be1a', '260 gsm heavy-gauge anti-tear combed cotton crewneck engineered for factory workwear and uniforms.', { Colour: ['Navy Blue', 'Safety Orange', 'Charcoal'], Size: ['M', 'L', 'XL', 'XXL'] }],
  ['Bio-Washed Enzyme Soft Cotton T-Shirt', 5, 'fashion-apparel', 'T-Shirts', 290, 'piece', 200, 32000, 12, 'TR', 'photo-1576566588028-4147f3842f27', 'Ultra-soft enzyme bio-washed 210 gsm cotton tee with hypoallergenic finish and seamless collar.', { Colour: ['Cream White', 'Soft Pink', 'Stone Grey'], Size: ['XS', 'S', 'M', 'L'] }],
  ['Eco-Packaged Cotton Crewneck T-Shirt', 6, 'fashion-apparel', 'T-Shirts', 225, 'piece', 250, 50000, 14, 'N', 'photo-1581655353564-df123a1eb820', 'Pre-shrunk 190 gsm combed ring-spun cotton tee packaged in 100% biodegradable cassava polybags.', { Colour: ['White', 'Black', 'Heather Grey'], Size: ['S', 'M', 'L', 'XL'] }],
  ['Premium Mercerized Cotton T-Shirt', 7, 'fashion-apparel', 'T-Shirts', 480, 'piece', 100, 14000, 16, 'FT', 'photo-1618354691373-d851c5c3a990', 'Silky mercerized Aegean cotton 200 gsm tee with reinforced collar and tailored European fit.', { Colour: ['Burgundy', 'Jet Black', 'Pure White', 'Emerald'], Size: ['S', 'M', 'L', 'XL'] }],
  ['Combed Ring-Spun Cotton Blank T-Shirt', 8, 'fashion-apparel', 'T-Shirts', 185, 'piece', 500, 85000, 18, 'RD', 'photo-1527719327859-c6ce80353573', '180 gsm single-jersey combed cotton blank tee, bulk-packed for direct screen printing and DTG branding.', { Colour: ['White', 'Black', 'Royal Blue', 'Red'], Size: ['S', 'M', 'L', 'XL', 'XXL'] }],
  ['Luxury Supima Cotton Designer T-Shirt', 9, 'fashion-apparel', 'T-Shirts', 890, 'piece', 50, 6000, 20, 'F', 'photo-1503342394128-c104d54dba01', 'Long-staple Supima cotton luxury tee crafted in Milan with double-needle hems and blind stitching.', { Colour: ['Milk White', 'Obsidian Black', 'Navy'], Size: ['S', 'M', 'L', 'XL'] }],
  ['GOTS Certified Organic Cotton T-Shirt', 10, 'fashion-apparel', 'T-Shirts', 345, 'piece', 150, 25000, 14, 'FTR', 'photo-1562157873-818bc0726f68', '100% GOTS certified fair-trade organic cotton tee, low-impact non-toxic dyes and carbon-neutral freight.', { Colour: ['Natural Ecru', 'Forest Green', 'Terra Cotta'], Size: ['S', 'M', 'L', 'XL'] }],
];

const CATEGORY_SPECS = {
  electronics: { Connectivity: 'Bluetooth 5.3 / USB-C', Warranty: '12 months (sample term)', Customisation: 'Logo, colour, packaging' },
  'fashion-apparel': { Material: 'See description', Customisation: 'Label, print, embroidery', 'Size range': 'On request' },
  'home-kitchen': { Material: 'See description', Care: 'Care card included', Customisation: 'Colour and packaging' },
  machinery: { Voltage: '110 V / 220 V', Warranty: '12 months (sample term)', Documentation: 'English manual' },
  'beauty-personal-care': { 'Shelf life': '24 months (sample term)', Customisation: 'Private label artwork', Formula: 'Ingredient list on request' },
  packaging: { Material: 'See description', Printing: 'Up to four colours', Sampling: 'About 7 days' },
  furniture: { Frame: 'See description', Assembly: 'Minimal assembly', Customisation: 'Fabric and finish' },
  automotive: { Fitment: 'Universal', Warranty: '12 months (sample term)', Packaging: 'Colour box' },
  'sports-outdoors': { Material: 'See description', Customisation: 'Logo and colourway', 'Size range': 'On request' },
  'toys-games': { 'Age group': '3 years and above', Customisation: 'Colour and packaging', Finish: 'Smooth edges' },
  agriculture: { Material: 'See description', Use: 'Field and greenhouse', Packaging: 'Bulk carton' },
  'industrial-supplies': { Material: 'See description', Packaging: 'Bulk carton', Customisation: 'Logo print' },
};

const slugify = (name) => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const round = (value) => (value >= 100 ? Math.round(value) : Math.round(value * 100) / 100);

/** Three quantity tiers from a base price: MOQ, 5× MOQ (−8%) and 20× MOQ (−15%). */
export function buildPriceTiers(price, moq) {
  return [
    { minQty: moq, price: round(price) },
    { minQty: moq * 5, price: round(price * 0.92) },
    { minQty: moq * 20, price: round(price * 0.85) },
  ];
}

const products = rows.map(([name, companyNumber, category, subcategory, price, unit, moq, stock, leadTimeDays, flags, image, summary, variants], index) => {
  const number = 1001 + index;
  const isNew = flags.includes('N');
  const isPhoto = image.startsWith('photo-');
  const readyToShip = flags.includes('R');

  return {
    id: `TS-P-${number}`,
    sku: `TS-${category.slice(0, 3).toUpperCase()}-${number}`,
    name,
    slug: slugify(name),
    companyId: `TS-CO-${String(companyNumber).padStart(3, '0')}`,
    category,
    subcategory,
    summary,
    description: `${summary} Specifications, packaging and branding can be discussed with the supplier through a quote request, and a pre-production sample can be arranged before a bulk order.`,
    photo: isPhoto || image?.startsWith('/') || image?.startsWith('http') ? image : 'photo-1586528116311-ad8dd3c8310d',
    illustration: isPhoto ? image : 'photo-1586528116311-ad8dd3c8310d',
    currency: 'INR',
    price,
    priceTiers: buildPriceTiers(price, moq),
    unit,
    moq,
    stock,
    condition: 'New',
    sampleAvailable: price < 500,
    variants,
    specifications: {
      'Model no.': `TS-${number}`,
      ...CATEGORY_SPECS[category],
      'Place of origin': null, // filled from the supplier's country when displayed
    },
    packaging: {
      unitPack: unit === 'set' ? 'One set per printed box' : `One ${unit} per polybag or box`,
      cartonQty: moq >= 1000 ? 500 : moq >= 100 ? 50 : moq >= 20 ? 10 : 1,
      cartonSize: moq >= 1000 ? '60 × 40 × 40 cm' : moq >= 20 ? '55 × 40 × 35 cm' : 'Crated individually',
      note: 'Custom inner packaging and carton marks available on request.',
    },
    leadTimeDays,
    shippingEstimate: readyToShip ? 'Ships in 3–5 days from stock' : `Ships ${leadTimeDays}–${leadTimeDays + 7} days after order confirmation`,
    // Generated sample values: they are not collected from real buyers.
    rating: Math.round((4.2 + ((index * 7) % 8) / 10) * 10) / 10,
    reviewCount: 12 + ((index * 37) % 180),
    orderCount: 40 + ((index * 53) % 900),
    featured: flags.includes('F'),
    trending: flags.includes('T'),
    readyToShip,
    isNew,
    deal: flags.includes('D'),
    status: 'Active',
    createdAt: daysAgo(isNew ? 2 + (index % 9) : 40 + index * 4),
  };
});

export default products;
