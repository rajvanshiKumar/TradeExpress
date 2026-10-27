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

  // --- Expanded Catalogue Rows (12-15 Products in Every Section & Category) ---
  // Electronics (+7 -> 12)
  ['Fast Wireless Charging Pad 15W', 1, 'electronics', 'Mobile Accessories', 340, 'piece', 200, 25000, 10, 'RD', 'photo-1622445262464-84b1456045b6', '15W Qi-certified ultra-slim aluminum wireless fast charging pad with temperature control.', { Colour: ['Space Grey', 'Silver'] }],
  ['ANC Wireless Gaming Headset with Mic', 1, 'electronics', 'Audio', 1890, 'piece', 100, 8000, 12, 'FT', 'photo-1546435770-a3e426bf472b', 'Low-latency 2.4GHz and Bluetooth dual-mode gaming headset with detachable ENC boom microphone.', { Colour: ['Black', 'White'] }],
  ['Mechanical Keyboard RGB Hot-Swappable', 1, 'electronics', 'Computer Peripherals', 1750, 'piece', 100, 12000, 14, 'FTR', 'photo-1587829741301-dc798b83add3', '75% compact mechanical keyboard with gasket mount, hot-swappable switches and customizable RGB.', { Switch: ['Red Linear', 'Brown Tactile'] }],
  ['Ergonomic Vertical Wireless Mouse', 1, 'electronics', 'Computer Peripherals', 420, 'piece', 200, 30000, 10, 'RD', 'photo-1615663245857-ac93bb7c39e7', 'Rechargeable 2.4G optical vertical mouse designed to alleviate wrist strain during prolonged desk work.', { Colour: ['Matte Black', 'Silver Grey'] }],
  ['Multi-Port 65W GaN Wall Charger', 1, 'electronics', 'Mobile Accessories', 680, 'piece', 150, 28000, 8, 'FTR', 'photo-1583863788434-e58a36330cf0', 'Dual USB-C and USB-A 65W GaN fast charger with foldable pins and international voltage support.', { Plug: ['India / EU Type', 'UK Type', 'US Type'] }],
  ['Smart Home WiFi Security Camera 2K', 1, 'electronics', 'Wearables', 1120, 'piece', 100, 16000, 12, 'TN', 'photo-1557862921-37829c790f19', '360-degree pan-tilt 2K indoor surveillance camera with two-way audio and IR night vision.', { Resolution: ['2K HD', '4K Ultra'] }],
  ['Rugged Outdoor Bluetooth Speaker 40W', 1, 'electronics', 'Audio', 1450, 'piece', 100, 11000, 14, 'FD', 'photo-1608043152269-423dbba4e7e1', 'IPX7 waterproof shockproof 40W stereo cylinder speaker with 24-hour battery and powerbank function.', { Colour: ['Camo Green', 'Stealth Black'] }],

  // Home & Kitchen (+5 -> 12)
  ['Cast Iron Dutch Oven 5.5 Quart', 3, 'home-kitchen', 'Tableware', 1850, 'piece', 80, 4500, 18, 'FTR', 'photo-1584269600464-37b1b58a9fe7', 'Heavy-duty enameled cast iron Dutch oven with self-basting lid for slow cooking and braising.', { Colour: ['Cherry Red', 'Cobalt Blue', 'Matte Black'] }],
  ['Natural Bamboo Cutting Board Set (3 pc)', 3, 'home-kitchen', 'Tableware', 390, 'set', 150, 18000, 12, 'RD', 'photo-1590794056226-79ef3a8147e1', 'Set of 3 organic bamboo chopping boards with juice grooves and handle holes.', { Thickness: ['1.5 cm', '2.0 cm'] }],
  ['Linen Textured Blackout Curtains (Pair)', 8, 'home-kitchen', 'Home Decor', 890, 'pair', 100, 12000, 15, 'TN', 'photo-1513694203232-719a280e022f', 'Thermal insulated faux linen window drape panels with eyelet grommet header.', { Size: ['84 inch', '96 inch'], Colour: ['Beige', 'Slate Grey'] }],
  ['Stainless Steel Thermal Vacuum Carafe 2L', 3, 'home-kitchen', 'Tableware', 540, 'piece', 120, 14000, 14, 'F', 'photo-1517256064527-09c73fc73e38', 'Double-wall vacuum insulated coffee dispenser jug keeping liquids hot or cold for 24 hours.', { Finish: ['Brushed Steel', 'Matte Black'] }],
  ['Ceramic Essential Oil Reed Diffuser', 3, 'home-kitchen', 'Home Fragrance', 210, 'piece', 200, 22000, 10, 'RN', 'photo-1602928321679-560bb453f190', 'Aromatherapy reed fragrance diffuser in glazed ceramic flacon with 8 natural rattan reeds.', { Scent: ['White Tea', 'Lemongrass', 'Lavender'] }],

  // Machinery (+10 -> 12)
  ['Brushless Rotary Hammer Drill SDS-Plus', 4, 'machinery', 'Power Tools', 3450, 'piece', 40, 2500, 16, 'FTR', 'photo-1504917599217-d4dc5ebe6122', '1100W heavy-duty 4-mode concrete rotary hammer drill with vibration damping handle.', { Voltage: ['220V', '110V'] }],
  ['Heavy Duty Inverter ARC Welding Machine', 4, 'machinery', 'Workshop Equipment', 4200, 'unit', 30, 1800, 15, 'FT', 'photo-1504307651254-35680f356dfd', '250A IGBT digital inverter welder supporting MMA electrodes with anti-stick technology.', { Capacity: ['200A', '250A'] }],
  ['Benchtop Drill Press 5-Speed 350W', 4, 'machinery', 'Power Tools', 5800, 'unit', 20, 1200, 20, 'N', 'photo-1581092160607-ee22621dd758', 'Cast-iron base 13mm chuck pillar drill press with adjustable depth gauge and tilting work table.', { Speeds: ['5 Speed', '9 Speed'] }],
  ['Industrial Portable Air Compressor 50L', 4, 'machinery', 'Workshop Equipment', 6900, 'unit', 15, 900, 18, 'RD', 'photo-1581092335397-9583fe92d232', '2.5HP direct-drive oil-lubricated air compressor with twin pressure gauges and transport wheels.', { Tank: ['50L', '100L'] }],
  ['Electric Angle Grinder 125mm 900W', 4, 'machinery', 'Power Tools', 1150, 'piece', 100, 8000, 10, 'TR', 'photo-1572981779307-38b8cabb2407', 'Slim-body 900W corded angle grinder with spindle lock and toolless wheel guard.', { DiscSize: ['115 mm', '125 mm'] }],
  ['Precision Fiber Laser Marking Machine 30W', 4, 'machinery', 'CNC & Machine Tools', 95000, 'unit', 1, 45, 25, 'F', 'photo-1581092162384-8987c1d64718', 'Enclosed 30W galvo fiber laser marker for barcode, serial number and logo engraving on metals.', { Power: ['20W', '30W', '50W'] }],
  ['Automatic Edge Banding Machine', 4, 'machinery', 'CNC & Machine Tools', 145000, 'unit', 1, 30, 30, 'T', 'photo-1581091226825-a6a2a5aee158', 'Industrial woodworking edge bander with pre-milling, gluing, end trimming and scraping units.', { FeedRate: ['12m/min', '18m/min'] }],
  ['Electric Circular Saw 185mm 1400W', 4, 'machinery', 'Power Tools', 1850, 'piece', 60, 4500, 12, 'RN', 'photo-1518709268805-4e9042af9f23', 'Robust aluminum base circular saw with laser guide and 65mm max cutting depth.', { Blade: ['24T Wood', '40T Precision'] }],
  ['Industrial Wet & Dry Vacuum Cleaner 30L', 4, 'machinery', 'Workshop Equipment', 3200, 'unit', 40, 3200, 14, 'D', 'photo-1527515637462-cff94eecc1ac', '1400W stainless steel drum industrial vacuum with blower port and HEPA filter.', { Drum: ['30 Litre', '60 Litre'] }],
  ['CNC Plasma Cutting Table 1530', 4, 'machinery', 'CNC & Machine Tools', 185000, 'unit', 1, 20, 35, 'F', 'photo-1563986768609-322da13575f3', '1500 x 3000 mm heavy-duty gantry CNC plasma table with automatic torch height controller.', { PlasmaSource: ['63A', '100A', '120A'] }],

  // Beauty & Personal Care (+7 -> 12)
  ['Hyaluronic Acid Hydrating Face Cleanser', 5, 'beauty-personal-care', 'Skincare', 160, 'piece', 500, 45000, 12, 'FTR', 'photo-1556228720-195a672e8a03', 'Gentle foaming low-pH face wash infused with 8 multi-weight hyaluronic acids and ceramides.', { Volume: ['120 ml', '150 ml'] }],
  ['Centella Asiatica Soothing Toner 200ml', 5, 'beauty-personal-care', 'Skincare', 210, 'piece', 400, 38000, 12, 'TR', 'photo-1598440947619-2c35fc9aa908', 'Calming skin barrier facial toner formulated with 84% Madagascar Centella Asiatica extract.', { Size: ['200 ml', '300 ml'] }],
  ['Collagen Firming Hydrogel Eye Patches (60 pc)', 5, 'beauty-personal-care', 'Skincare', 195, 'jar', 300, 30000, 10, 'N', 'photo-1512290900672-1f4139e55728', 'Cooling hydrogel under-eye patches enriched with marine collagen, peptides and niacinamide.', { Formula: ['Gold Collagen', 'Green Tea Caffeine'] }],
  ['Waterproof Liquid Eyeliner Pen', 5, 'beauty-personal-care', 'Makeup', 85, 'piece', 1000, 95000, 10, 'RD', 'photo-1522337360788-8b13dee7a37e', 'Smudge-proof 0.1mm micro-felt tip black liquid eyeliner with quick-dry film formers.', { Colour: ['Intense Black', 'Dark Brown'] }],
  ['Silicone Electric Facial Cleansing Brush', 5, 'beauty-personal-care', 'Tools', 320, 'piece', 200, 22000, 12, 'F', 'photo-1570172619644-dfd03ed5d881', 'IPX7 waterproof sonic vibrating silicone facial brush with magnetic USB recharge.', { Colour: ['Blush Pink', 'Teal Mint', 'Lilac'] }],
  ['Exfoliating AHA BHA Peeling Solution 30ml', 5, 'beauty-personal-care', 'Skincare', 180, 'piece', 500, 40000, 14, 'T', 'photo-1608248597359-00f72a5a54b3', 'Red-tinted exfoliating facial treatment with 30% AHA and 2% BHA for gentle chemical peeling.', { Formula: ['Original Red', 'Sensitive Green'] }],
  ['SPF 50+ Matte Sun Cushion Compact', 5, 'beauty-personal-care', 'Sun Care', 280, 'piece', 300, 25000, 14, 'FD', 'photo-1596462502278-27bfdc403348', 'Portable sun protection cushion compact with cooling puff and pore-blurring matte powder finish.', { Shade: ['Translucent', 'Natural Beige'] }],

  // Packaging (+6 -> 12)
  ['Custom Rigid Magnetic Gift Box', 6, 'packaging', 'Paper Packaging', 110, 'piece', 1000, 120000, 15, 'FTR', 'photo-1549465220-1a8b9238cd48', 'Collapsible luxury paperboard gift box with concealed magnetic snap closure and soft-touch lamination.', { Finish: ['Matte Black', 'Gold Foil', 'Pearl White'] }],
  ['Biodegradable Compostable Mailer Bags', 6, 'packaging', 'Corrugated Boxes', 8.5, 'piece', 5000, 800000, 10, 'RD', 'photo-1589939705384-5185137a7f0f', 'Zero-plastic plant-based shipping satchel certified Home Compostable with dual adhesive strips.', { Size: ['Small 25x35cm', 'Medium 30x40cm', 'Large 40x50cm'] }],
  ['Aluminum Cosmetic Screw-Top Tins 50ml', 6, 'packaging', 'Cosmetic Packaging', 14, 'piece', 3000, 500000, 12, 'TR', 'photo-1563178406-4cdc2923acbc', 'Seamless rust-proof aluminum metal containers with foam liner for balms, waxes and creams.', { Size: ['30 ml', '50 ml', '100 ml'] }],
  ['Honeycomb Paper Protective Cushion Wrap', 6, 'packaging', 'Corrugated Boxes', 650, 'roll', 50, 8000, 8, 'N', 'photo-1530587191325-3db32d826c18', 'Recyclable kraft expandable honeycomb paper roll (50cm x 100m) replacing plastic bubble wrap.', { Width: ['30 cm', '50 cm'] }],
  ['Frosted Glass Dropper Bottles with Bamboo Cap', 6, 'packaging', 'Glass Packaging', 38, 'piece', 2000, 350000, 14, 'F', 'photo-1598440947619-2c35fc9aa908', 'Luxury frosted glass cosmetic dropper bottles featuring real bamboo wood screw collars.', { Capacity: ['15 ml', '30 ml', '50 ml'] }],
  ['Custom Printed Adhesive Packing Tape 50mm', 6, 'packaging', 'Paper Packaging', 85, 'roll', 200, 40000, 10, 'D', 'photo-1586528116311-ad8dd3c8310d', 'Low-noise heavy-duty BOPP brand packaging carton sealing tape printed in up to 3 pantone colours.', { Length: ['50 m', '100 m'] }],

  // Furniture (+7 -> 12)
  ['Solid Oak Dining Table 6-Seater', 9, 'furniture', 'Living Room', 38500, 'piece', 5, 250, 35, 'FTR', 'photo-1615066390971-03e4e1c36ddf', 'Minimalist Scandinavian solid white oak dining table with beveled edges and matte lacquer coat.', { Finish: ['Natural Oak', 'Smoked Walnut'] }],
  ['Mid-Century Modern Nightstand (Pair)', 9, 'furniture', 'Living Room', 6200, 'pair', 15, 600, 25, 'TR', 'photo-1532372998445-5f6e83847097', 'Solid pine wood bedroom nightstands with soft-close drawers and tapered dowel legs.', { Colour: ['Walnut', 'White / Natural'] }],
  ['Commercial Stacking Cafe Chairs (Set of 4)', 9, 'furniture', 'Living Room', 7800, 'set', 10, 1200, 20, 'RD', 'photo-1503602642458-232111445657', 'Curved bentwood restaurant dining chairs with tubular powder-coated steel black frames.', { Seat: ['Oak Ply', 'Black Ply'] }],
  ['Height-Adjustable Dual Motor Standing Desk', 9, 'furniture', 'Office', 18900, 'piece', 10, 450, 25, 'F', 'photo-1518455027359-f3f8164ba6bd', 'Dual-motor electric motorized sit-stand work desk with digital 4-memory LED handset and anti-collision.', { Desktop: ['140x70cm Walnut', '160x80cm Oak'] }],
  ['Industrial Pendant Ceiling Light Fixture', 9, 'furniture', 'Lighting', 1850, 'piece', 30, 2800, 15, 'N', 'photo-1513506003901-1e6a229e2d15', 'Spun aluminum dome chandelier pendant lamp with woven cord and vintage brass socket.', { Diameter: ['30 cm', '45 cm'], Colour: ['Matte Black', 'Brushed Brass'] }],
  ['Velvet Tufted Storage Ottoman Bench', 9, 'furniture', 'Living Room', 4600, 'piece', 15, 750, 22, 'T', 'photo-1586023492125-27b2c045efd7', 'End-of-bed entryway bench with plush button-tufted velvet upholstery and deep storage chest.', { Colour: ['Emerald Green', 'Royal Navy', 'Champagne'] }],
  ['Modern Minimalist Coffee Table', 9, 'furniture', 'Living Room', 8200, 'piece', 10, 400, 28, 'FD', 'photo-1533090161767-e6ffed986b88', 'Low-profile circular coffee table featuring sintered stone marble-look top and fluted base.', { Top: ['Carrara White', 'Nero Marquina'] }],

  // Automotive (+10 -> 12)
  ['OBD2 Bluetooth Diagnostic Car Scanner', 4, 'automotive', 'Garage Equipment', 650, 'piece', 100, 25000, 10, 'FTR', 'photo-1580273916550-e323be2ae537', 'Wireless OBD-II automotive engine fault code reader compatible with Android and iOS apps.', { Protocol: ['Bluetooth 4.0', 'WiFi Dual-Band'] }],
  ['Heavy Duty 12V Portable Tyre Inflator', 4, 'automotive', 'Garage Equipment', 1350, 'piece', 80, 15000, 12, 'TR', 'photo-1578844251758-2f71da64c96f', 'Dual-cylinder 150 PSI metal air pump with preset digital display and bright LED worklight.', { Power: ['12V Cigarette Plug', 'Battery Clamps Included'] }],
  ['Magnetic Wireless Car Mount Charger 15W', 1, 'automotive', 'Interior Accessories', 580, 'piece', 150, 32000, 10, 'RD', 'photo-1615906655593-ad0386982a0f', 'Air vent and dashboard MagSafe-compatible phone holder with 360-degree ball joint.', { Mount: ['Air Vent Hook', 'Suction Arm'] }],
  ['HD 1080P Dual Dash Cam with Night Vision', 1, 'automotive', 'Interior Accessories', 1950, 'piece', 50, 9000, 14, 'FN', 'photo-1508974239320-0a029497e820', 'Front and interior cabin dual lens dashboard camera with G-sensor and loop recording.', { Memory: ['32GB Included', '64GB Included'] }],
  ['Car Emergency Battery Jump Starter 20000mAh', 4, 'automotive', 'Garage Equipment', 2750, 'piece', 40, 7500, 14, 'FTR', 'photo-1549465220-1a8b9238cd48', '1500A peak current booster pack capable of jumping up to 8.0L petrol and 6.0L diesel engines.', { Colour: ['Black/Yellow', 'Black/Red'] }],
  ['Microfibre Car Detailing Towel Pack (6 pc)', 2, 'automotive', 'Interior Accessories', 290, 'pack', 200, 45000, 8, 'RD', 'photo-1607860108855-64acf2078ed9', '800 gsm ultra-thick edgeless plush microfibre drying and buffing cloth set.', { Pack: ['6 Pack (40x40cm)', '12 Pack (40x40cm)'] }],
  ['Hydraulic Creeper Seat with Tool Tray', 4, 'automotive', 'Garage Equipment', 2400, 'piece', 30, 2200, 18, 'T', 'photo-1581092160607-ee22621dd758', 'Pneumatic height-adjustable mechanic roller stool with swivel casters and divided parts tray.', { Cushion: ['Vinyl Red', 'Vinyl Black'] }],
  ['Custom Fit Waterproof Car Body Cover', 8, 'automotive', 'Interior Accessories', 1100, 'piece', 100, 12000, 14, 'N', 'photo-1617814076367-b759c7d7e738', '5-layer heavy all-weather outdoor car cover with soft fleece lining and windproof straps.', { VehicleSize: ['Sedan L', 'SUV XL'] }],
  ['Professional Spray Gun for Auto Paint HVLP', 4, 'automotive', 'Garage Equipment', 1650, 'piece', 60, 5000, 12, 'F', 'photo-1562237553-36ad661d6f2c', 'High volume low pressure pneumatic paint sprayer with 1.3mm stainless steel fluid nozzle.', { Cup: ['600 ml Plastic', '1000 ml Aluminum'] }],
  ['LED Headlight Bulb Conversion Kit H7/H4', 1, 'automotive', 'Interior Accessories', 920, 'pair', 100, 28000, 10, 'FD', 'photo-1549399542-7e3f8b79c341', '120W 20,000 lumens 6500K cool white CSP chip LED headlight bulbs with silent cooling fan.', { Socket: ['H7', 'H4', 'H11'] }],

  // Sports & Outdoors (+10 -> 12)
  ['Non-Slip TPE Eco Yoga Mat 6mm', 10, 'sports-outdoors', 'Outdoor Gear', 480, 'piece', 100, 25000, 10, 'FTR', 'photo-1592432678016-e910b452f9a2', 'Dual-layer textured non-slip exercise yoga mat with alignment body lines and carry strap.', { Colour: ['Teal / Mint', 'Purple / Pink', 'Midnight Black'] }],
  ['Insulated Stainless Steel Sports Bottle 1L', 3, 'sports-outdoors', 'Outdoor Gear', 340, 'piece', 200, 35000, 12, 'RD', 'photo-1602143407151-7111542de6e8', '32 oz double-wall vacuum water flask with leakproof straw lid and powder-coat finish.', { Colour: ['Matte Black', 'Olive Green', 'Ocean Blue'] }],
  ['Ultra-Lightweight Camping Hammock with Straps', 10, 'sports-outdoors', 'Outdoor Gear', 580, 'piece', 120, 18000, 12, 'TR', 'photo-1520072959219-c595dc870360', '210T parachute nylon portable double camping hammock with tree-friendly daisy chain straps.', { Capacity: ['Single (150 kg)', 'Double (250 kg)'] }],
  ['Waterproof Automatic 4-Person Pop Up Tent', 10, 'sports-outdoors', 'Outdoor Gear', 2950, 'piece', 30, 4200, 18, 'F', 'photo-1510312305653-8ed496efae75', 'Hydraulic pop-up instant dome tent with dual vestibules, mesh windows and PU 3000mm rainfly.', { Colour: ['Forest Green', 'Sky Blue'] }],
  ['Adjustable Quick-Lock Trekking Poles (Pair)', 10, 'sports-outdoors', 'Outdoor Gear', 790, 'pair', 100, 14000, 12, 'N', 'photo-1551632811-561732d1e306', 'Aircraft-grade 7075 aluminum hiking walking sticks with natural cork moisture-wicking grip.', { Lock: ['Flip Lock', 'Twist Lock'] }],
  ['Carbon Fiber Pickleball Paddle Set', 10, 'sports-outdoors', 'Outdoor Gear', 1450, 'set', 60, 8500, 14, 'T', 'photo-1626244453003-888998d363d6', 'USAPA standard carbon grit surface pickleball set including 2 paddles, 4 balls and carry case.', { Core: ['Polymer Honeycomb', 'Nomex Core'] }],
  ['Breathable Athletic Running Socks (3 Pair Pack)', 2, 'sports-outdoors', 'Footwear', 150, 'pack', 300, 60000, 10, 'RD', 'photo-1582966772680-860e372bb558', 'Cushioned anti-blister ankle running socks with arch compression band and moisture-wicking coolmax.', { Size: ['M (UK 6-8)', 'L (UK 9-11)'], Colour: ['White', 'Black'] }],
  ['Rechargeable LED Headlamp 1000 Lumens', 1, 'sports-outdoors', 'Outdoor Gear', 420, 'piece', 150, 26000, 8, 'RN', 'photo-1508974239320-0a029497e820', 'USB-C rechargeable hands-free waterproof head flashlight with wave motion sensor switch.', { Beam: ['Spot + Flood', 'Red Light Auxiliary'] }],
  ['Resistance Bands Set with Handles & Door Anchor', 10, 'sports-outdoors', 'Outdoor Gear', 380, 'set', 150, 30000, 10, 'D', 'photo-1598971639058-fab3c3109a00', 'Stackable 5-tube natural latex workout exercise resistance band set up to 150 lbs.', { Tension: ['100 lbs Kit', '150 lbs Kit'] }],
  ['Men Cushion Sole Road Running Shoes', 10, 'sports-outdoors', 'Footwear', 1650, 'pair', 100, 6500, 20, 'FTR', 'photo-1542291026-7eec264c27ff', 'High-rebound EVA foam road racing marathon trainers with breathable engineered mesh vamp.', { Size: ['EU 40', 'EU 41', 'EU 42', 'EU 43', 'EU 44'], Colour: ['Fire Red', 'Triple Black'] }],

  // Toys & Games (+10 -> 12)
  ['Montessori Wooden Sensory Activity Board', 3, 'toys-games', 'Wooden Toys', 780, 'piece', 80, 6000, 14, 'FTR', 'photo-1515488042361-ee00e0ddd4e4', 'Toddler learning busy board with latches, gears, musical bell, and fine motor tactile activities.', { Theme: ['Dinosaur', 'Space Explorer'] }],
  ['Magnetic 3D Building Tiles Set (100 pc)', 1, 'toys-games', 'Wooden Toys', 1120, 'set', 100, 15000, 12, 'TR', 'photo-1587654780291-39c9404d746b', 'Non-toxic ultrasonic-welded translucent rainbow magnetic geometric construction blocks for STEM.', { Pieces: ['60 Pieces', '100 Pieces'] }],
  ['Solid Beech Wood Balance Board 83cm', 3, 'toys-games', 'Wooden Toys', 1450, 'piece', 50, 4500, 18, 'F', 'photo-1596461404969-9ae70f2830c1', 'Curved open-ended Waldorf wobble board supporting up to 200kg with protective natural wool felt bottom.', { Felt: ['Sky Blue', 'Light Grey', 'No Felt'] }],
  ['Arcade Style Fight Stick Controller', 1, 'toys-games', 'Gaming Accessories', 2850, 'unit', 30, 3200, 16, 'T', 'photo-1550745165-9bc0b252726f', 'Universal Sanwa-style arcade joystick with 8 responsive mechanical switches for PC and consoles.', { Layout: ['Viewlix', 'Noir'] }],
  ['RGB Headphone Stand with USB 3.0 Hub', 1, 'toys-games', 'Gaming Accessories', 540, 'piece', 120, 22000, 10, 'RD', 'photo-1583394838336-acd977736f90', 'Aluminum desktop gaming headset cradle with 3 USB data pass-through ports and dynamic RGB ring.', { Colour: ['Black', 'White'] }],
  ['Wooden Animal Stacking & Balancing Game', 3, 'toys-games', 'Wooden Toys', 290, 'set', 200, 18000, 12, 'RN', 'photo-1566576912321-d58ddd7a6088', 'Fourteen smoothly sanded hardwood jungle animals that stack upon a rocking base boat.', { Theme: ['Safari Jungle', 'Arctic Animals'] }],
  ['Gaming Mouse Bungee with Flexible Cable Arm', 1, 'toys-games', 'Gaming Accessories', 220, 'piece', 250, 35000, 8, 'D', 'photo-1615663245857-ac93bb7c39e7', 'Weighted anti-drag mouse cord stabilizer with anti-slip rubber feet for competitive esports.', { Colour: ['Black', 'White'] }],
  ['Pretend Play Wooden Kitchen Accessories Set', 3, 'toys-games', 'Wooden Toys', 620, 'set', 100, 7500, 14, 'N', 'photo-1596461404969-9ae70f2830c1', 'Ten-piece sliceable fruits and veggies with hook-and-loop fasteners, cutting board, and toy wooden knife.', { Set: ['Bakery Set', 'Farmer Fruit Set'] }],
  ['XXL Extended Gaming Mouse Pad 900x400mm', 1, 'toys-games', 'Gaming Accessories', 340, 'piece', 150, 28000, 10, 'FTR', 'photo-1527864550417-7fd91fc51a46', 'Water-resistant micro-woven desk mat with anti-fray stitched edges and heavy non-skid rubber base.', { Pattern: ['Topographic Map', 'Cyberpunk Grid', 'Clean Plain Black'] }],
  ['Classic Wooden Chess & Checkers Set 15-inch', 3, 'toys-games', 'Wooden Toys', 890, 'set', 80, 8500, 14, 'FD', 'photo-1529699211952-734e80c4d42b', 'Hand-carved magnetic folding wooden chessboard with felted bottoms and interior storage slots.', { Wood: ['Sheesham & Boxwood', 'Walnut & Maple'] }],

  // Agriculture (+10 -> 12)
  ['Heavy Duty Drip Irrigation Kit 100m', 4, 'agriculture', 'Farm Equipment', 1450, 'set', 50, 12000, 12, 'FTR', 'photo-1527847263472-aa5338d178b8', 'Complete commercial micro drip watering kit with 16mm UV-resistant mainline, emitters and fittings.', { Length: ['50 m', '100 m', '200 m'] }],
  ['Electric Cordless Pruning Shears 25mm', 4, 'agriculture', 'Farm Equipment', 2600, 'set', 40, 5500, 14, 'TR', 'photo-1589923188900-85dae523342b', '21V lithium-ion battery orchard bypass pruner with SK5 high carbon steel blade for easy branch cutting.', { Blades: ['Standard SK5', 'Titanium Coated'] }],
  ['Full Spectrum LED Plant Grow Light 600W', 1, 'agriculture', 'Farm Equipment', 3800, 'unit', 20, 3500, 15, 'FT', 'photo-1518531933037-91b2f5f229cc', 'Dimmable indoor horticultural greenhouse LED board with Samsung LM301B diodes and silent heat sink.', { Spectrum: ['Veg / Bloom Dual', 'Full Spectrum 3000K+5000K'] }],
  ['Heavy Duty Anti-Bird Garden Netting 5x10m', 6, 'agriculture', 'Gardening', 240, 'piece', 150, 45000, 10, 'RD', 'photo-1530587191325-3db32d826c18', 'High-density polyethylene knitted mesh netting protecting fruit trees and crops from pests.', { Size: ['5 x 10 m', '10 x 20 m'] }],
  ['Soil Moisture pH and Sunlight Meter 3-in-1', 4, 'agriculture', 'Gardening', 165, 'piece', 250, 38000, 8, 'RN', 'photo-1585314062340-f1a5a7c9328d', 'No-battery dual-probe soil fertility, moisture and sunlight acidity tester for agriculture growers.', { Probe: ['Copper / Aluminum 20cm', 'Long 30cm'] }],
  ['Weed Barrier Landscape Fabric 1x50m', 6, 'agriculture', 'Gardening', 790, 'roll', 60, 14000, 12, 'N', 'photo-1635574901622-8014a3ddead5', '100 gsm heavy-duty woven polypropylene geotextile weed control mat with high water permeability.', { Roll: ['1m x 50m', '2m x 50m'] }],
  ['Industrial Polyethylene Tunnel Greenhouse 3x6m', 4, 'agriculture', 'Farm Equipment', 9200, 'unit', 10, 800, 20, 'F', 'photo-1585320806297-9794b3e4eeae', 'Galvanized steel hoop frame polytunnel greenhouse with reinforced UV-resistant PE cover.', { Frame: ['25mm Steel Tube', '32mm Reinforced'] }],
  ['Brass Garden Hose Spray Nozzle Heavy-Duty', 4, 'agriculture', 'Gardening', 195, 'piece', 200, 32000, 10, 'D', 'photo-1549049950-48d5887197a0', 'Solid brass adjustable twist barrel hose nozzle for pressure cleaning and agricultural spraying.', { Connection: ['1/2 inch', '3/4 inch Standard'] }],
  ['Hydroponic NFT Channel System 4-Pipe', 4, 'agriculture', 'Farm Equipment', 3600, 'set', 20, 1500, 18, 'T', 'photo-1527847263472-aa5338d178b8', 'Food-grade PVC nutrient film technique 36-hole vertical farming planting rig with submersible pump.', { Holes: ['36 Holes', '72 Holes'] }],
  ['Heavy Duty Steel Garden Wheelbarrow 100L', 4, 'agriculture', 'Gardening', 1750, 'piece', 40, 2800, 16, 'RD', 'photo-1592417817098-8f3d6910985b', 'Seamless pressed steel tray utility wheelbarrow with pneumatic all-terrain tyre and ergonomic grips.', { Wheel: ['Pneumatic Tyre', 'Solid Puncture-Proof'] }],

  // Industrial Supplies (+10 -> 12)
  ['Safety Goggles Anti-Fog Scratch-Resistant', 4, 'industrial-supplies', 'Safety & PPE', 75, 'piece', 500, 95000, 7, 'FTR', 'photo-1584744982491-665216d95f8b', 'Clear wrap-around polycarbonate protective eye goggles meeting EN166 / ANSI Z87.1 standards.', { Lens: ['Clear Anti-Fog', 'Smoke Tint'] }],
  ['Heavy Duty Nitrile Dipped Work Gloves (12 Pairs)', 4, 'industrial-supplies', 'Safety & PPE', 340, 'pack', 100, 40000, 8, 'TRD', 'photo-1581092921461-eab62e97a780', '13-gauge nylon seamless knitted protective gloves with micro-foam nitrile palm grip for oily handling.', { Size: ['M (8)', 'L (9)', 'XL (10)'] }],
  ['High-Visibility Reflective Safety Vest Class 2', 2, 'industrial-supplies', 'Safety & PPE', 85, 'piece', 500, 120000, 8, 'RD', 'photo-1578844251758-2f71da64c96f', 'Fluorescent yellow mesh breathable construction vest with 2-inch wide 360-degree reflective strips.', { Colour: ['Neon Yellow', 'Safety Orange'] }],
  ['Digital Vernier Caliper 150mm Stainless Steel', 4, 'industrial-supplies', 'Hand Tools', 540, 'piece', 100, 18000, 10, 'F', 'photo-1504917599217-d4dc5ebe6122', '0.01mm high precision digital caliper gauge with inch/metric conversion and hard protective case.', { Range: ['150 mm', '200 mm', '300 mm'] }],
  ['Industrial Ear Defenders Hearing Protection 34dB', 4, 'industrial-supplies', 'Safety & PPE', 290, 'piece', 150, 28000, 10, 'N', 'photo-1581092160607-ee22621dd758', 'Adjustable padded headband noise-cancelling earmuffs certified NRR 28dB / SNR 34dB for factory use.', { Colour: ['Safety Yellow', 'Matte Black'] }],
  ['Drop-Forged Adjustable Pipe Wrench 14-inch', 4, 'industrial-supplies', 'Hand Tools', 420, 'piece', 100, 16000, 12, 'T', 'photo-1613206485381-b028e578e791', 'Heavy-duty ductile iron handle plumbing stillson pipe wrench with induction hardened teeth.', { Size: ['12 inch', '14 inch', '18 inch'] }],
  ['Anti-Static ESD Safe Tweezers Set (6 pc)', 4, 'industrial-supplies', 'Hand Tools', 160, 'set', 200, 35000, 8, 'RN', 'photo-1581092162384-8987c1d64718', 'Non-magnetic stainless steel precision tweezers with black conductive electrostatic dissipative coating.', { Kit: ['6 Piece Set', '9 Piece Set'] }],
  ['Steel Toe Anti-Piercing Safety Work Boots', 10, 'industrial-supplies', 'Safety & PPE', 1350, 'pair', 80, 12000, 15, 'FTR', 'photo-1542291026-7eec264c27ff', 'Lightweight puncture-proof kevlar midsole work trainers with 200J European standard steel toe cap.', { Size: ['EU 40', 'EU 41', 'EU 42', 'EU 43', 'EU 44'] }],
  ['Industrial First Aid Kit Wall-Mountable (120 pc)', 4, 'industrial-supplies', 'Safety & PPE', 890, 'unit', 50, 9000, 10, 'D', 'photo-1584744982491-665216d95f8b', 'OSHA compliant waterproof emergency medical supplies cabinet with quick release bracket.', { Capacity: ['25 Person', '50 Person'] }],
  ['Torque Wrench Drive Click Type 1/2-inch', 4, 'industrial-supplies', 'Hand Tools', 1450, 'piece', 50, 6500, 12, 'FD', 'photo-1613206485381-b028e578e791', 'Dual direction micrometer click torque wrench (20-210 Nm) with calibration certificate.', { Drive: ['3/8 inch (10-60 Nm)', '1/2 inch (20-210 Nm)'] }],
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
