import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const categoriesData = [
  { slug: 'electronics', name: 'Electronics', description: 'Audio, wearables, mobile accessories and smart devices from OEM and ODM factories.', photo: 'photo-1498049794561-7780e7231661', subcategories: ['Audio', 'Wearables', 'Mobile Accessories', 'Computer Peripherals'] },
  { slug: 'fashion-apparel', name: 'Fashion & Apparel', description: 'Garments, knitwear, denim, bags and accessories for private-label and wholesale buyers.', photo: 'photo-1567401893414-76b7b1e5a7a5', subcategories: ['T-Shirts', 'Hoodies', 'Outerwear', 'Knitwear', 'Shirts', 'Denim', 'Bags & Accessories'] },
  { slug: 'home-kitchen', name: 'Home & Kitchen', description: 'Tableware, décor, bedding and home fragrance for retailers and hospitality.', photo: 'photo-1600210492493-0946911123ea', subcategories: ['Home Decor', 'Tableware', 'Bedding', 'Home Fragrance'] },
  { slug: 'machinery', name: 'Machinery', description: 'Power tools, CNC equipment and workshop machinery for production lines.', photo: 'photo-1566930665082-4ae9dbbb5b6b', subcategories: ['Power Tools', 'CNC & Machine Tools', 'Workshop Equipment'] },
  { slug: 'beauty-personal-care', name: 'Beauty & Personal Care', description: 'Skincare, makeup, sun care and tools, available for private label.', photo: 'photo-1522335789203-aabd1fc54bc9', subcategories: ['Skincare', 'Makeup', 'Sun Care', 'Tools'] },
  { slug: 'packaging', name: 'Packaging', description: 'Paper, glass, cosmetic and corrugated packaging in custom sizes and prints.', photo: 'photo-1534452203293-494d7ddbf7e0', subcategories: ['Paper Packaging', 'Glass Packaging', 'Cosmetic Packaging', 'Corrugated Boxes'] },
  { slug: 'furniture', name: 'Furniture', description: 'Living room, office and lighting pieces for projects and retail.', photo: 'photo-1628744876497-eb30460be9f6', subcategories: ['Living Room', 'Office', 'Lighting'] },
  { slug: 'automotive', name: 'Automotive', description: 'Garage equipment and interior accessories for workshops and distributors.', photo: 'photo-1580273916550-e323be2ae537', subcategories: ['Garage Equipment', 'Interior Accessories'] },
  { slug: 'sports-outdoors', name: 'Sports & Outdoors', description: 'Performance footwear and outdoor gear for brands and clubs.', photo: 'photo-1575987116913-e96e7d490b8a', subcategories: ['Footwear', 'Outdoor Gear'] },
  { slug: 'toys-games', name: 'Toys & Games', description: 'Wooden toys and gaming accessories for retailers and gift suppliers.', photo: 'photo-1618397360795-952a13220a66', subcategories: ['Wooden Toys', 'Gaming Accessories'] },
  { slug: 'agriculture', name: 'Agriculture', description: 'Farm equipment and gardening supplies for growers and co-operatives.', photo: 'photo-1527847263472-aa5338d178b8', subcategories: ['Farm Equipment', 'Gardening'] },
  { slug: 'industrial-supplies', name: 'Industrial Supplies', description: 'Safety equipment and hand tools for sites, plants and maintenance teams.', photo: 'photo-1581092921461-eab62e97a780', subcategories: ['Safety & PPE', 'Hand Tools'] },
];

const productsRaw = [
  ['Wireless Noise-Cancelling Headphones', 'TS-CO-001', 'electronics', 'Audio', 1540, 'piece', 100, 12000, 12, 'FTR', 'photo-1505740420928-5e560c06d30e', 'Over-ear Bluetooth 5.3 headphones with hybrid noise cancelling and 40-hour playback.', { Colour: ['Black', 'Ivory', 'Navy'] }],
  ['True Wireless Earbuds with Charging Case', 'TS-CO-001', 'electronics', 'Audio', 565, 'piece', 200, 30000, 10, 'TRD', 'photo-1606220588913-b3aacb4d2f46', 'Compact earbuds with touch controls, ENC microphones and a USB-C charging case.', { Colour: ['Black', 'White'] }],
  ['Portable Bluetooth Speaker 20W', 'TS-CO-001', 'electronics', 'Audio', 930, 'piece', 100, 8000, 14, 'FN', 'photo-1589003077984-894e133dabab', 'Splash-resistant 20W speaker with dual passive radiators and 12-hour battery.', { Colour: ['Graphite', 'Red', 'Blue'] }],
  ['Smart Fitness Watch (AMOLED)', 'TS-CO-001', 'electronics', 'Wearables', 1240, 'piece', 100, 15000, 15, 'FT', 'photo-1579586337278-3befd40fd17a', '1.43-inch AMOLED fitness watch with heart-rate, SpO2 and sleep tracking.', { Colour: ['Black', 'Silver'], Strap: ['Silicone', 'Nylon'] }],
  ['10,000 mAh Power Bank', 'TS-CO-001', 'electronics', 'Mobile Accessories', 450, 'piece', 300, 40000, 7, 'RD', 'photo-1566554738544-d962991c3fee', 'Slim 22.5W fast-charging power bank with USB-C in/out and LED level display.', { Colour: ['Black', 'Green', 'White'] }],
  ['Wireless Game Controller', 'TS-CO-001', 'toys-games', 'Gaming Accessories', 795, 'piece', 200, 9000, 12, 'N', 'photo-1612287230202-1ff1d85d1bdf', 'Bluetooth and 2.4G controller with hall-effect sticks and programmable back paddles.', { Colour: ['Black', 'White'] }],
  ['Heavyweight Cotton T-Shirt (Blank)', 'TS-CO-002', 'fashion-apparel', 'T-Shirts', 240, 'piece', 300, 60000, 12, 'FTR', 'photo-1620799139652-715e4d5b232d', '240 gsm combed-cotton blank tee, pre-shrunk, ready for print or embroidery.', { Colour: ['White', 'Black', 'Sand', 'Navy'], Size: ['S', 'M', 'L', 'XL', 'XXL'] }],
  ['Pullover Fleece Hoodie', 'TS-CO-002', 'fashion-apparel', 'Hoodies', 645, 'piece', 200, 22000, 18, 'FT', 'photo-1556821840-3a63f95609a7', '320 gsm brushed-fleece hoodie with lined hood and kangaroo pocket.', { Colour: ['Grey Melange', 'Black', 'Forest'], Size: ['S', 'M', 'L', 'XL'] }],
  ['Classic Denim Jacket', 'TS-CO-002', 'fashion-apparel', 'Outerwear', 1120, 'piece', 150, 9000, 25, 'N', 'photo-1611312449408-fcece27cdbb7', '12 oz rigid-denim trucker jacket with metal shank buttons and custom label option.', { Wash: ['Mid Blue', 'Dark Indigo'], Size: ['S', 'M', 'L', 'XL'] }],
  ['Tailored Single-Breasted Blazer', 'TS-CO-002', 'fashion-apparel', 'Outerwear', 1740, 'piece', 100, 4000, 30, '', 'photo-1592343516109-362f7bd871aa', 'Half-lined blazer in a wool-blend twill with notch lapel and two-button front.', { Colour: ['Black', 'Charcoal'], Size: ['46', '48', '50', '52'] }],
  ['Hand-Glazed Ceramic Vase', 'TS-CO-003', 'home-kitchen', 'Home Decor', 380, 'piece', 100, 5000, 20, 'F', 'photo-1612196808214-b8e1d6145a8c', 'Wheel-thrown ceramic vase with a reactive matte glaze, each piece slightly unique.', { Finish: ['Ivory', 'Sand', 'Charcoal'], Height: ['18 cm', '26 cm'] }],
  ['Scented Soy Candle Set', 'TS-CO-003', 'home-kitchen', 'Home Fragrance', 265, 'set', 200, 12000, 10, 'TR', 'photo-1643122966676-29e8597257f7', 'Set of three hand-poured soy candles with cotton wicks and custom fragrance options.', { Fragrance: ['Sandalwood', 'Jasmine', 'Citrus'] }],
  ['Stoneware Dinnerware Set (16 pc)', 'TS-CO-003', 'home-kitchen', 'Tableware', 1620, 'set', 50, 2500, 25, 'FD', 'photo-1551807306-4bcd16b92a41', 'Sixteen-piece stoneware set for four: dinner plates, side plates, bowls and mugs.', { Glaze: ['Speckled White', 'Ocean Blue', 'Terracotta'] }],
  ['Minimal Wall Clock', 'TS-CO-003', 'home-kitchen', 'Home Decor', 490, 'piece', 100, 6000, 15, 'R', 'photo-1563861826100-9cb868fdbe1c', '30 cm silent-sweep wall clock with a powder-coated metal case.', { Colour: ['White', 'Black', 'Brass'] }],
  ['Handcrafted Wooden Toy Blocks', 'TS-CO-003', 'toys-games', 'Wooden Toys', 530, 'set', 100, 4000, 18, 'N', 'photo-1575364289437-fb1479d52732', 'Fifty-piece block set in sanded neem wood with water-based, child-safe colours.', { Set: ['50 pieces', '100 pieces'] }],
  ['Cordless Impact Drill 20V', 'TS-CO-004', 'machinery', 'Power Tools', 2660, 'piece', 50, 3000, 20, 'F', 'photo-1562237553-36ad661d6f2c', 'Brushless 20V impact drill with two-speed gearbox, 13 mm chuck and two batteries.', { Kit: ['Tool only', 'With 2 batteries'] }],
  ['Bench CNC Engraving Machine (3-Axis)', 'TS-CO-004', 'machinery', 'CNC & Machine Tools', 120400, 'unit', 1, 60, 35, 'T', 'photo-1566930665082-4ae9dbbb5b6b', 'Desktop 3-axis CNC router with 600 × 400 mm bed, ball screws and offline controller.', { Spindle: ['800 W', '1.5 kW'] }],
  ['Hydraulic Floor Jack 3 Ton', 'TS-CO-004', 'automotive', 'Garage Equipment', 3150, 'piece', 20, 1200, 18, 'R', 'photo-1580273916550-e323be2ae537', 'Low-profile 3-ton trolley jack with dual-piston pump and safety overload valve.', { Colour: ['Red', 'Blue'] }],
  ['Knapsack Battery Sprayer 16L', 'TS-CO-004', 'agriculture', 'Farm Equipment', 1740, 'piece', 50, 2500, 15, 'N', 'photo-1549049950-48d5887197a0', '16-litre backpack sprayer with 12V battery pump, adjustable lance and four nozzles.', { Battery: ['8 Ah', '12 Ah'] }],
  ['Industrial Safety Helmet', 'TS-CO-004', 'industrial-supplies', 'Safety & PPE', 200, 'piece', 500, 40000, 7, 'RD', 'photo-1581092921461-eab62e97a780', 'Ventilated ABS safety helmet with ratchet suspension and chin strap.', { Colour: ['White', 'Yellow', 'Blue', 'Red'] }],
  ['Combination Wrench Set (14 pc)', 'TS-CO-004', 'industrial-supplies', 'Hand Tools', 815, 'set', 100, 5000, 12, '', 'photo-1613206485381-b028e578e791', 'Fourteen chrome-vanadium combination wrenches, 8–24 mm, in a roll-up pouch.', { Finish: ['Mirror chrome', 'Matte'] }],
  ['Vitamin C Brightening Serum 30 ml', 'TS-CO-005', 'beauty-personal-care', 'Skincare', 230, 'piece', 500, 50000, 14, 'FTR', 'photo-1723951174326-2a97221d3b7f', 'Lightweight serum with a stabilised vitamin C derivative, available for private label.', { Size: ['30 ml', '50 ml'] }],
  ['Hydrating Gel Cream 50 ml', 'TS-CO-005', 'beauty-personal-care', 'Skincare', 200, 'piece', 500, 35000, 14, 'T', 'photo-1629732047847-50219e9c5aef', 'Oil-free gel moisturiser with hyaluronic acid in a recyclable jar.', { Size: ['50 ml', '100 ml'] }],
  ['Velvet Matte Lipstick', 'TS-CO-005', 'beauty-personal-care', 'Makeup', 135, 'piece', 1000, 80000, 12, 'D', 'photo-1586495777744-4413f21062fa', 'Long-wear matte bullet lipstick, offered in 24 stock shades or custom colours.', { Shade: ['Classic Red', 'Rose', 'Nude', 'Berry'] }],
  ['Professional Makeup Brush Set (12 pc)', 'TS-CO-005', 'beauty-personal-care', 'Tools', 350, 'set', 300, 15000, 10, 'RN', 'photo-1620464003286-a5b0d79f32c2', 'Twelve synthetic-fibre brushes with wooden handles and an optional travel roll.', { Handle: ['Black', 'Walnut'] }],
  ['Mineral Sunscreen SPF 50', 'TS-CO-005', 'beauty-personal-care', 'Sun Care', 175, 'piece', 500, 26000, 14, '', 'photo-1698906821280-34072d3ac1be', 'Zinc-oxide mineral sunscreen in a 50 ml tube with a light, non-greasy finish.', { Size: ['50 ml', '100 ml'] }],
  ['Kraft Paper Shopping Bags', 'TS-CO-006', 'packaging', 'Paper Packaging', 15, 'piece', 5000, 900000, 12, 'FTR', 'photo-1513884923967-4b182ef167ab', 'Twisted-handle kraft bags in three sizes, with one- to four-colour custom print.', { Size: ['Small', 'Medium', 'Large'], Paper: ['Brown kraft', 'White kraft'] }],
  ['Amber Glass Jars with Lids', 'TS-CO-006', 'packaging', 'Glass Packaging', 35, 'piece', 3000, 400000, 15, 'T', 'photo-1572726729207-a78d6feb18d7', 'Straight-sided amber jars for candles and cosmetics, supplied with metal lids.', { Capacity: ['120 ml', '250 ml', '500 ml'] }],
  ['Clear Glass Bottles 250 ml', 'TS-CO-006', 'packaging', 'Glass Packaging', 29, 'piece', 3000, 350000, 15, '', 'photo-1601066551508-6d9cb1b9de65', 'Flint-glass bottles with a 28 mm neck, compatible with pump, spray or screw caps.', { Closure: ['Screw cap', 'Pump', 'Spray'] }],
  ['Amber Dropper Bottles 30 ml', 'TS-CO-006', 'packaging', 'Cosmetic Packaging', 24, 'piece', 5000, 600000, 12, 'RD', 'photo-1608571423902-eed4a5ad8108', '30 ml amber dropper bottles with glass pipette, for serums and oils.', { Collar: ['Black', 'Gold', 'White'] }],
  ['Corrugated Shipping Cartons', 'TS-CO-006', 'packaging', 'Corrugated Boxes', 45.5, 'piece', 2000, 250000, 10, 'N', 'photo-1513672494107-cd9d848a383e', 'Five-ply corrugated cartons made to size, with optional flexo print.', { Board: ['3-ply', '5-ply'] }],
  ['Full-Grain Leather Tote Bag', 'TS-CO-007', 'fashion-apparel', 'Bags & Accessories', 1990, 'piece', 50, 2000, 20, 'FT', 'photo-1624687943971-e86af76d57de', 'Unlined full-grain leather tote with reinforced handles and inner zip pocket.', { Colour: ['Tan', 'Black', 'Chestnut'] }],
  ['Bifold Leather Wallet', 'TS-CO-007', 'fashion-apparel', 'Bags & Accessories', 455, 'piece', 200, 12000, 12, 'R', 'photo-1601592996763-f05c9c80a7f1', 'Slim bifold wallet with six card slots, hand-painted edges and logo embossing.', { Colour: ['Black', 'Brown'] }],
  ['Leather Belt with Steel Buckle', 'TS-CO-007', 'fashion-apparel', 'Bags & Accessories', 400, 'piece', 200, 10000, 12, 'D', 'photo-1624222247344-550fb60583dc', '35 mm vegetable-tanned leather belt with a brushed stainless-steel buckle.', { Colour: ['Brown', 'Black'], Length: ['95 cm', '105 cm', '115 cm'] }],
  ['Leather Laptop Briefcase', 'TS-CO-007', 'fashion-apparel', 'Bags & Accessories', 3150, 'piece', 30, 1200, 25, 'N', 'photo-1473188588951-666fce8e7c68', 'Structured leather briefcase with a padded 15-inch laptop sleeve and shoulder strap.', { Colour: ['Brown', 'Black'] }],
  ['Knitted Crewneck Sweater', 'TS-CO-008', 'fashion-apparel', 'Knitwear', 695, 'piece', 300, 18000, 25, 'T', 'photo-1631541909061-71e349d1f203', '7-gauge cotton-blend crewneck with ribbed trims, knitted to your colour card.', { Colour: ['Oatmeal', 'Grey', 'Navy'], Size: ['S', 'M', 'L', 'XL'] }],
  ['Woven Cotton Shirt', 'TS-CO-008', 'fashion-apparel', 'Shirts', 430, 'piece', 300, 25000, 20, 'FR', 'photo-1713881587420-113c1c43e28a', 'Poplin cotton shirt with a classic collar, available plain, striped or checked.', { Colour: ['White', 'Sky Blue'], Size: ['S', 'M', 'L', 'XL'] }],
  ['Stretch Denim Jeans', 'TS-CO-008', 'fashion-apparel', 'Denim', 790, 'piece', 300, 30000, 28, '', 'photo-1624378439575-d8705ad7ae80', 'Five-pocket jeans in 11 oz stretch denim, with wash and trim options.', { Wash: ['Mid Blue', 'Black'], Fit: ['Slim', 'Straight'] }],
  ['Cotton Bed Linen Set', 'TS-CO-008', 'home-kitchen', 'Bedding', 1040, 'set', 100, 8000, 22, 'D', 'photo-1606855637183-ea2a00b6f15f', '200-thread-count cotton percale set: duvet cover, fitted sheet and two pillowcases.', { Size: ['Single', 'Double', 'King'], Colour: ['White', 'Grey'] }],
  ['Three-Seat Fabric Sofa', 'TS-CO-009', 'furniture', 'Living Room', 34900, 'piece', 5, 300, 40, 'FT', 'photo-1555041469-a586c61ea9bc', 'Three-seat sofa on a kiln-dried beech frame with removable, woven-fabric covers.', { Fabric: ['Forest Green', 'Stone', 'Navy'] }],
  ['Upholstered Accent Armchair', 'TS-CO-009', 'furniture', 'Living Room', 13700, 'piece', 10, 500, 35, 'F', 'photo-1586023492125-27b2c045efd7', 'Compact armchair with solid-ash legs and high-resilience foam seat.', { Fabric: ['Mustard', 'Grey', 'Teal'] }],
  ['Arc Floor Lamp', 'TS-CO-009', 'furniture', 'Lighting', 4810, 'piece', 20, 900, 25, 'N', 'photo-1494438639946-1ebd1d20bf85', 'Steel arc floor lamp with a weighted base and E27 holder, flat-packed.', { Finish: ['Matte Black', 'Brass'] }],
  ['Chesterfield Leather Sofa', 'TS-CO-009', 'furniture', 'Living Room', 64700, 'piece', 2, 120, 45, '', 'photo-1573866926487-a1865558a9cf', 'Hand-tufted two-seat Chesterfield in top-grain leather with rolled arms.', { Leather: ['Cognac', 'Oxblood', 'Black'] }],
  ['Ergonomic Office Chair', 'TS-CO-009', 'furniture', 'Office', 6140, 'piece', 20, 1500, 30, 'R', 'photo-1580480095047-4aa43ab3bd1d', 'Adjustable task chair with lumbar support, tilt lock and breathable upholstery.', { Colour: ['Brown', 'Black'] }],
  ['Soy Wax Candle in Amber Jar', 'TS-CO-010', 'home-kitchen', 'Home Fragrance', 325, 'piece', 200, 9000, 10, 'RN', 'photo-1612293905607-b003de9e54fb', '220 g soy-wax candle in a reusable amber jar, with phthalate-free fragrance.', { Fragrance: ['Cedar', 'Lavender', 'Unscented'] }],
  ['Organic Cotton Pillow Set', 'TS-CO-010', 'home-kitchen', 'Bedding', 765, 'set', 100, 4000, 14, '', 'photo-1617325247661-675ab4b64ae2', 'Pair of pillows with organic cotton covers and recycled-fibre filling.', { Firmness: ['Soft', 'Medium'] }],
  ['Refillable Amber Glass Bottle 500 ml', 'TS-CO-010', 'packaging', 'Glass Packaging', 80, 'piece', 1000, 60000, 10, 'T', 'photo-1608571424266-edeb9bbefdec', 'Thick-walled 500 ml amber bottle designed for refill programmes.', { Closure: ['Pump', 'Screw cap'] }],
  ['Trail Running Shoes (Recycled Upper)', 'TS-CO-010', 'sports-outdoors', 'Footwear', 1370, 'pair', 200, 7000, 25, 'F', 'photo-1562183241-b937e95585b6', 'Trail shoe with a recycled-polyester mesh upper and 4 mm lug rubber outsole.', { Size: ['EU 38', 'EU 40', 'EU 42', 'EU 44'] }],
  ['Hiking Backpack 40L', 'TS-CO-010', 'sports-outdoors', 'Outdoor Gear', 1230, 'piece', 100, 5000, 20, 'TD', 'photo-1509762774605-f07235a08f1f', '40-litre pack in recycled ripstop with ventilated back panel and rain cover.', { Colour: ['Grey', 'Olive'] }],
  ['Seed Starter Trays (Biodegradable)', 'TS-CO-010', 'agriculture', 'Gardening', 50, 'piece', 2000, 150000, 10, 'N', 'photo-1635574901622-8014a3ddead5', 'Moulded-fibre 12-cell seed trays that can be planted directly into soil.', { Cells: ['12-cell', '24-cell'] }],
  ['All-Season Car Floor Mats', 'TS-CO-010', 'automotive', 'Interior Accessories', 620, 'set', 100, 6000, 14, '', 'photo-1649136378672-b965cb9935d5', 'Set of four trim-to-fit floor mats made with recycled rubber.', { Colour: ['Black', 'Grey'] }],
];

const slugify = (text) =>
  text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const round = (val) => (val >= 100 ? Math.round(val) : Math.round(val * 100) / 100);

function buildPriceTiers(price, moq) {
  return [
    { minQty: moq, price: round(price) },
    { minQty: moq * 5, price: round(price * 0.92) },
    { minQty: moq * 20, price: round(price * 0.85) },
  ];
}

async function main() {
  console.log('Seeding TradeExpress MySQL database...');

  // 1. Seed Categories
  for (const cat of categoriesData) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
  }
  console.log(`Seeded ${categoriesData.length} categories.`);

  // 2. Seed Default Users (Buyer, Supplier, Admin)
  const defaultPasswordHash = await bcrypt.hash('TradeSphere@2026', 10);

  const testBuyer = await prisma.user.upsert({
    where: { email: 'buyer@tradesphere.com' },
    update: {},
    create: {
      email: 'buyer@tradesphere.com',
      passwordHash: defaultPasswordHash,
      name: 'Sarah Jenkins',
      role: 'BUYER',
      company: 'Apex Global Imports',
      phone: '+91 98765 43210',
      city: 'Mumbai',
      country: 'India',
      addresses: {
        create: {
          label: 'Main Warehouse',
          name: 'Sarah Jenkins',
          company: 'Apex Global Imports',
          phone: '+91 98765 43210',
          street: 'Plot 42, Sector 18, Vashi Industrial Area',
          city: 'Navi Mumbai',
          state: 'Maharashtra',
          postalCode: '400703',
          country: 'India',
          isDefault: true,
        },
      },
    },
  });

  const suppliersSeedData = [
    {
      companyId: 'TS-CO-001',
      email: 'supplier@novatech.com',
      name: 'Lin Wei',
      company: 'Shenzhen NovaTech Electronics',
      phone: '+86 000 0000 0001',
      city: 'Shenzhen',
      country: 'China',
      warehouseAddress: 'Building 4, Hi-Tech Industrial Park, Nanshan, Shenzhen',
      gstin: '07AAAAA0000A1Z5',
      isVerified: true,
      kycStatus: 'VERIFIED',
      certifications: ['ISO 9001:2015', 'CE Conformity', 'RoHS Compliant'],
    },
    {
      companyId: 'TS-CO-002',
      email: 'export@pearlrivergarments.com',
      name: 'Chen Yu',
      company: 'Pearl River Garments Co.',
      phone: '+86 000 0000 0002',
      city: 'Guangzhou',
      country: 'China',
      warehouseAddress: 'Block B, Panyu Garment Export Zone, Guangzhou',
      gstin: '07BBBBB0000B1Z6',
      isVerified: true,
      kycStatus: 'VERIFIED',
      certifications: ['OEKO-TEX Standard 100', 'ISO 9001:2015', 'BSCI Audited'],
    },
    {
      companyId: 'TS-CO-003',
      email: 'hello@jaipurcraft.com',
      name: 'Meera Rathore',
      company: 'Jaipur Craft & Home Exports',
      phone: '+91 98290 12345',
      city: 'Jaipur',
      country: 'India',
      warehouseAddress: 'Plot 12, RIICO Industrial Area, Sitapura, Jaipur, Rajasthan 302022',
      gstin: '08AABCR1234F1Z8',
      isVerified: true,
      kycStatus: 'VERIFIED',
      certifications: ['ISO 9001:2015', 'Sedex SMETA', 'FSC Certified'],
    },
    {
      companyId: 'TS-CO-004',
      email: 'enquiry@mumbaiindustrial.com',
      name: 'Arjun Desai',
      company: 'Mumbai Industrial Solutions',
      phone: '+91 98200 54321',
      city: 'Mumbai',
      country: 'India',
      warehouseAddress: 'C-24, TTC Industrial Area, MIDC Pawane, Navi Mumbai 400705',
      gstin: '27AABCM5678H1Z2',
      isVerified: true,
      kycStatus: 'VERIFIED',
      certifications: ['ISO 9001:2015', 'BIS Certified', 'CE Approved'],
    },
    {
      companyId: 'TS-CO-005',
      email: 'partners@beautysource.com',
      name: 'Kim Ji-ho',
      company: 'Seoul BeautySource Trading',
      phone: '+82 2 555 0199',
      city: 'Seoul',
      country: 'South Korea',
      warehouseAddress: 'Suite 802, Teheran-ro, Gangnam-gu, Seoul',
      gstin: '07CCCCC0000C1Z7',
      isVerified: true,
      kycStatus: 'VERIFIED',
      certifications: ['GMP ISO 22716', 'FDA Registered', 'Cruelty-Free'],
    },
    {
      companyId: 'TS-CO-006',
      email: 'sales@hcmpackaging.com',
      name: 'Tran Minh',
      company: 'Ho Chi Minh Packaging Works',
      phone: '+84 28 3822 0001',
      city: 'Ho Chi Minh City',
      country: 'Vietnam',
      warehouseAddress: 'Tan Binh Industrial Zone, Binh Tan District, Ho Chi Minh City',
      gstin: '07DDDDD0000D1Z8',
      isVerified: true,
      kycStatus: 'VERIFIED',
      certifications: ['ISO 9001:2015', 'FSC Recycled', 'BRC Packaging'],
    },
    {
      companyId: 'TS-CO-007',
      email: 'export@istanbulleather.com',
      name: 'Elif Kaya',
      company: 'Istanbul Leather & Fashion',
      phone: '+90 212 555 0188',
      city: 'Istanbul',
      country: 'Türkiye',
      warehouseAddress: 'Leather Industrial District, Zeytinburnu, Istanbul',
      gstin: '07EEEEE0000E1Z9',
      isVerified: true,
      kycStatus: 'VERIFIED',
      certifications: ['LWG Gold Rated', 'ISO 9001:2015', 'REACH Compliant'],
    },
    {
      companyId: 'TS-CO-008',
      email: 'merch@dhakacotton.com',
      name: 'Farhan Ahmed',
      company: 'Dhaka Cotton Industries',
      phone: '+880 2 988 0001',
      city: 'Dhaka',
      country: 'Bangladesh',
      warehouseAddress: 'DEPZ Industrial Area, Savar, Dhaka',
      gstin: '07FFFFF0000F1Z0',
      isVerified: true,
      kycStatus: 'VERIFIED',
      certifications: ['WRAP Certified', 'GOTS Organic', 'OEKO-TEX 100'],
    },
    {
      companyId: 'TS-CO-009',
      email: 'contract@milanliving.com',
      name: 'Giulia Moretti',
      company: 'Milan Living & Furniture',
      phone: '+39 02 555 0177',
      city: 'Milan',
      country: 'Italy',
      warehouseAddress: 'Via Brianza 44, Design & Furniture Park, Milan',
      gstin: '07GGGGG0000G1Z1',
      isVerified: true,
      kycStatus: 'VERIFIED',
      certifications: ['FSC Certified Wood', 'CATAS Tested', 'ISO 9001:2015'],
    },
    {
      companyId: 'TS-CO-010',
      email: 'wholesale@greensupply.com',
      name: 'Maya Torres',
      company: 'Austin GreenSupply Co.',
      phone: '+1 512 555 0166',
      city: 'Austin',
      country: 'USA',
      warehouseAddress: '7800 East Commerce Blvd, Austin, TX 78744',
      gstin: '07HHHHH0000H1Z2',
      isVerified: true,
      kycStatus: 'VERIFIED',
      certifications: ['USDA BioPreferred', 'ISO 14001', 'B-Corp Certified'],
    },
  ];

  const supplierByCompanyId = new Map();
  for (const s of suppliersSeedData) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {
        name: s.name,
        role: 'SUPPLIER',
        company: s.company,
        phone: s.phone,
        city: s.city,
        country: s.country,
        warehouseAddress: s.warehouseAddress,
        gstin: s.gstin,
        isVerified: s.isVerified,
        kycStatus: s.kycStatus,
      },
      create: {
        email: s.email,
        passwordHash: defaultPasswordHash,
        name: s.name,
        role: 'SUPPLIER',
        company: s.company,
        phone: s.phone,
        city: s.city,
        country: s.country,
        warehouseAddress: s.warehouseAddress,
        gstin: s.gstin,
        isVerified: s.isVerified,
        kycStatus: s.kycStatus,
      },
    });
    supplierByCompanyId.set(s.companyId, { user, certs: s.certifications });

    // Seed approved KYC Documents for quality certifications
    await prisma.kycDocument.deleteMany({ where: { userId: user.id } });
    await prisma.kycDocument.createMany({
      data: [
        {
          userId: user.id,
          docType: 'GST_CERTIFICATE',
          docNumber: s.gstin,
          fileName: `${s.companyId}-gst-certificate.pdf`,
          fileUrl: `/uploads/kyc/${s.companyId}-gst-certificate.pdf`,
          status: 'APPROVED',
        },
        {
          userId: user.id,
          docType: 'BUSINESS_REG',
          docNumber: `REG-${s.companyId}`,
          fileName: `${s.companyId}-business-reg.pdf`,
          fileUrl: `/uploads/kyc/${s.companyId}-business-reg.pdf`,
          status: 'APPROVED',
        },
        ...s.certifications.map((cert) => ({
          userId: user.id,
          docType: 'QUALITY_CERTIFICATE',
          docNumber: cert,
          fileName: `${s.companyId}-${cert.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
          fileUrl: `/uploads/kyc/${s.companyId}-${cert.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
          status: 'APPROVED',
          notes: `Certified ${cert} verified by TradeExpress compliance team.`,
        })),
      ],
    });
  }

  const adminPasswordHash = await bcrypt.hash('modiji@12345', 10);
  await prisma.user.upsert({
    where: { email: 'krajvanshi244@gmail.com' },
    update: {
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
    create: {
      email: 'krajvanshi244@gmail.com',
      passwordHash: adminPasswordHash,
      name: 'TradeExpress Administrator',
      role: 'ADMIN',
      company: 'TradeExpress Global HQ',
      phone: '+91 98765 00000',
      city: 'New Delhi',
      country: 'India',
    },
  });
  console.log(`Seeded default users (buyer, admin, and ${suppliersSeedData.length} TradeExpress verified suppliers).`);

  // 3. Seed Products
  for (let i = 0; i < productsRaw.length; i++) {
    const [name, companyId, categorySlug, subcategory, price, unit, moq, stock, leadTimeDays, flags, photo, summary, variants] = productsRaw[i];
    const number = 1001 + i;
    const sku = `TS-${categorySlug.slice(0, 3).toUpperCase()}-${number}`;
    const slug = slugify(name);
    const isNew = flags.includes('N');
    const featured = flags.includes('F');
    const trending = flags.includes('T');
    const readyToShip = flags.includes('R');
    const deal = flags.includes('D');

    const supplierInfo = supplierByCompanyId.get(companyId);
    const supplierId = supplierInfo?.user?.id || null;
    const certs = supplierInfo?.certs || ['ISO 9001:2015', 'TradeExpress Verified'];

    const specs = {
      'Model no.': `TS-${number}`,
      Origin: 'Verified TradeSphere Factory',
      Certifications: certs,
      'Payment Terms': 'TradeExpress Escrow Protection (100% Secure)',
      'Estimated Dispatch': `${leadTimeDays} business days`,
    };

    await prisma.product.upsert({
      where: { sku },
      update: {
        name,
        slug,
        companyId,
        supplierId,
        categorySlug,
        subcategory,
        summary,
        description: `${summary} Specifications, packaging and branding can be discussed with the supplier through a quote request, and a pre-production sample can be arranged before a bulk order.`,
        photo,
        currency: 'INR',
        price,
        unit,
        moq,
        stock,
        leadTimeDays,
        status: 'Active',
        featured,
        trending,
        readyToShip,
        isNew,
        deal,
        variants,
        priceTiers: buildPriceTiers(price, moq),
        specifications: specs,
        packaging: { unitPack: `One ${unit} per standard packaging`, note: 'Custom export packing available.' },
      },
      create: {
        sku,
        name,
        slug,
        companyId,
        supplierId,
        categorySlug,
        subcategory,
        summary,
        description: `${summary} Specifications, packaging and branding can be discussed with the supplier through a quote request, and a pre-production sample can be arranged before a bulk order.`,
        photo,
        currency: 'INR',
        price,
        unit,
        moq,
        stock,
        leadTimeDays,
        status: 'Active',
        featured,
        trending,
        readyToShip,
        isNew,
        deal,
        variants,
        priceTiers: buildPriceTiers(price, moq),
        specifications: specs,
        packaging: { unitPack: `One ${unit} per standard packaging`, note: 'Custom export packing available.' },
      },
    });
  }

  // 4. Seed Competing Product Listings so multiple TradeExpress registered suppliers offer the same product
  const competingListings = [
    {
      sku: 'TS-ELE-1001-ALT1',
      name: 'Wireless Noise-Cancelling Headphones',
      slug: 'wireless-noise-cancelling-headphones-mumbai',
      companyId: 'TS-CO-004',
      categorySlug: 'electronics',
      subcategory: 'Audio',
      price: 1590,
      unit: 'piece',
      moq: 80,
      stock: 4500,
      leadTimeDays: 9,
      photo: 'photo-1505740420928-5e560c06d30e',
      summary: 'Professional 40mm driver hybrid ANC wireless headphones with dual ENC microphones and fast-charging.',
      certifications: ['BIS Certified', 'CE Approved', 'ISO 9001:2015'],
      weightKg: 0.35,
    },
    {
      sku: 'TS-ELE-1001-ALT2',
      name: 'Wireless Noise-Cancelling Headphones',
      slug: 'wireless-noise-cancelling-headphones-greensupply',
      companyId: 'TS-CO-010',
      categorySlug: 'electronics',
      subcategory: 'Audio',
      price: 1620,
      unit: 'piece',
      moq: 50,
      stock: 3200,
      leadTimeDays: 7,
      photo: 'photo-1505740420928-5e560c06d30e',
      summary: 'Eco-packaged wireless noise-cancelling headphones made with recycled aluminium and memory foam earcups.',
      certifications: ['RoHS Compliant', 'FCC Certified', 'ISO 14001'],
      weightKg: 0.35,
    },
    {
      sku: 'TS-ELE-1002-ALT1',
      name: 'True Wireless Earbuds with Charging Case',
      slug: 'true-wireless-earbuds-mumbai',
      companyId: 'TS-CO-004',
      categorySlug: 'electronics',
      subcategory: 'Audio',
      price: 585,
      unit: 'piece',
      moq: 150,
      stock: 18000,
      leadTimeDays: 8,
      photo: 'photo-1606220588913-b3aacb4d2f46',
      summary: 'Compact TWS Bluetooth 5.3 earbuds with charging dock and low-latency gaming mode.',
      certifications: ['BIS Certified', 'CE Approved', 'ISO 9001:2015'],
      weightKg: 0.12,
    },
    {
      sku: 'TS-FAS-1007-ALT1',
      name: 'Heavyweight Cotton T-Shirt (Blank)',
      slug: 'heavyweight-cotton-tshirt-dhaka',
      companyId: 'TS-CO-008',
      categorySlug: 'fashion-apparel',
      subcategory: 'T-Shirts',
      price: 225,
      unit: 'piece',
      moq: 500,
      stock: 45000,
      leadTimeDays: 15,
      photo: 'photo-1620799139652-715e4d5b232d',
      summary: '240 gsm 100% combed ring-spun cotton blank t-shirts in bulk for brand screen printing.',
      certifications: ['GOTS Certified Organic', 'WRAP Gold Certified', 'OEKO-TEX 100'],
      weightKg: 0.25,
    },
    {
      sku: 'TS-FAS-1007-ALT2',
      name: 'Heavyweight Cotton T-Shirt (Blank)',
      slug: 'heavyweight-cotton-tshirt-jaipur',
      companyId: 'TS-CO-003',
      categorySlug: 'fashion-apparel',
      subcategory: 'T-Shirts',
      price: 255,
      unit: 'piece',
      moq: 200,
      stock: 18000,
      leadTimeDays: 10,
      photo: 'photo-1620799139652-715e4d5b232d',
      summary: 'Premium combed bio-washed heavy cotton blank tees with reinforced ribbed collar.',
      certifications: ['FairTrade Certified', 'ISO 9001:2015', 'Sedex Audited'],
      weightKg: 0.25,
    },
    {
      sku: 'TS-BEA-1022-ALT1',
      name: 'Vitamin C Brightening Serum 30 ml',
      slug: 'vitamin-c-serum-greensupply',
      companyId: 'TS-CO-010',
      categorySlug: 'beauty-personal-care',
      subcategory: 'Skincare',
      price: 245,
      unit: 'piece',
      moq: 300,
      stock: 15000,
      leadTimeDays: 10,
      photo: 'photo-1723951174326-2a97221d3b7f',
      summary: 'Organic 15% Vitamin C brightening serum with ferulic acid in UV-protective amber dropper bottles.',
      certifications: ['USDA Organic', 'Cruelty-Free International', 'ISO 22716 GMP'],
      weightKg: 0.15,
    },
    {
      sku: 'TS-MAC-1016-ALT1',
      name: 'Cordless Impact Drill 20V',
      slug: 'cordless-impact-drill-novatech',
      companyId: 'TS-CO-001',
      categorySlug: 'machinery',
      subcategory: 'Power Tools',
      price: 2580,
      unit: 'piece',
      moq: 80,
      stock: 2500,
      leadTimeDays: 14,
      photo: 'photo-1562237553-36ad661d6f2c',
      summary: 'Heavy-duty 20V cordless hammer impact driver with brushless motor and 2x 4.0Ah lithium battery pack.',
      certifications: ['CE Marked', 'ISO 9001:2015', 'RoHS Compliant'],
      weightKg: 2.2,
    },
    {
      sku: 'TS-PAC-1028-ALT1',
      name: 'Amber Glass Jars with Lids',
      slug: 'amber-glass-jars-greensupply',
      companyId: 'TS-CO-010',
      categorySlug: 'packaging',
      subcategory: 'Glass Packaging',
      price: 38,
      unit: 'piece',
      moq: 2000,
      stock: 150000,
      leadTimeDays: 10,
      photo: 'photo-1572726729207-a78d6feb18d7',
      summary: 'Heavy-base amber glass cosmetic containers with black aluminium airtight lids.',
      certifications: ['FDA Compliant Glass', 'ISO 9001:2015', '100% Recyclable'],
      weightKg: 0.2,
    },
  ];

  for (const alt of competingListings) {
    const supplierInfo = supplierByCompanyId.get(alt.companyId);
    const supplierId = supplierInfo?.user?.id || null;
    const certs = alt.certifications || supplierInfo?.certs || ['ISO 9001:2015'];

    await prisma.product.upsert({
      where: { sku: alt.sku },
      update: {
        name: alt.name,
        slug: alt.slug,
        companyId: alt.companyId,
        supplierId,
        categorySlug: alt.categorySlug,
        subcategory: alt.subcategory,
        summary: alt.summary,
        description: `${alt.summary} Verified TradeSphere supplier offering wholesale orders with quality inspection.`,
        photo: alt.photo,
        currency: 'INR',
        price: alt.price,
        unit: alt.unit,
        moq: alt.moq,
        stock: alt.stock,
        leadTimeDays: alt.leadTimeDays,
        weightKg: alt.weightKg,
        status: 'Active',
        moderationStatus: 'APPROVED',
        readyToShip: true,
        priceTiers: buildPriceTiers(alt.price, alt.moq),
        specifications: {
          Origin: 'Verified TradeSphere Factory',
          Certifications: certs,
          'Payment Terms': 'TradeExpress Escrow Protection (100% Secure)',
          'Estimated Dispatch': `${alt.leadTimeDays} business days`,
        },
      },
      create: {
        sku: alt.sku,
        name: alt.name,
        slug: alt.slug,
        companyId: alt.companyId,
        supplierId,
        categorySlug: alt.categorySlug,
        subcategory: alt.subcategory,
        summary: alt.summary,
        description: `${alt.summary} Verified TradeSphere supplier offering wholesale orders with quality inspection.`,
        photo: alt.photo,
        currency: 'INR',
        price: alt.price,
        unit: alt.unit,
        moq: alt.moq,
        stock: alt.stock,
        leadTimeDays: alt.leadTimeDays,
        weightKg: alt.weightKg,
        status: 'Active',
        moderationStatus: 'APPROVED',
        readyToShip: true,
        priceTiers: buildPriceTiers(alt.price, alt.moq),
        specifications: {
          Origin: 'Verified TradeSphere Factory',
          Certifications: certs,
          'Payment Terms': 'TradeExpress Escrow Protection (100% Secure)',
          'Estimated Dispatch': `${alt.leadTimeDays} business days`,
        },
      },
    });
  }
  console.log(`Seeded ${productsRaw.length} primary products and ${competingListings.length} competing supplier listings.`);
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
