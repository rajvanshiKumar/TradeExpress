/**
 * TradeExpress B2B category taxonomy: the single source of truth for the 60 main categories.
 *
 * Hierarchy: Main category -> Subcategory -> (optional) Product type -> Product listing.
 *
 * Stable identifiers:
 *  - Each main category has a permanent `slug` (used as the database key and in URLs).
 *  - The 12 categories that already exist keep their original slug (`legacySlug`), so every existing product
 *    stays in its category. Only their display names change.
 *  - Subcategories that existing products already use (`legacySubcategories`) are kept as valid, selectable
 *    subcategories, so no listing is misclassified. They can be reclassified later from the admin panel.
 */

export const slugify = (value) => String(value || '')
  .toLowerCase()
  .replace(/&/g, ' ')
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

// [group name, [ [category name, description, subcategories, options] ]]
// options: { legacySlug, legacySubcategories, productTypes: { [subcategory]: [types] } }
const GROUPS = [
  ['Electronics, Electrical & Technology', [
    ['Electronics', 'Consumer and professional electronics, audio, wearables and electronic components.',
      ['Audio Equipment', 'Wearables', 'Smart Devices', 'Consumer Electronics', 'Cameras', 'Electronic Accessories', 'Home Entertainment', 'Electronic Components'],
      { legacySlug: 'electronics', legacySubcategories: ['Audio', 'Mobile Accessories', 'Computer Peripherals'] }],
    ['Mobiles & Accessories', 'Smartphones, feature phones, chargers, cables and mobile spare parts.',
      ['Smartphones', 'Feature Phones', 'Chargers', 'Cables', 'Power Banks', 'Earphones', 'Mobile Covers', 'Screen Protectors', 'Mobile Spare Parts'],
      { productTypes: { Chargers: ['Wall Chargers', 'Car Chargers', 'Wireless Chargers', 'Multi-Port Chargers'] } }],
    ['Computers & IT Hardware', 'Laptops, desktops, servers, peripherals, storage and networking hardware.',
      ['Laptops', 'Desktops', 'Servers', 'Monitors', 'Printers', 'Keyboards', 'Mice', 'Storage Devices', 'Networking Equipment', 'Computer Components']],
    ['Electrical Equipment & Supplies', 'Wires, switchgear, transformers, motors and power distribution equipment.',
      ['Wires & Cables', 'Switches', 'Sockets', 'Circuit Breakers', 'Transformers', 'Electric Motors', 'Control Panels', 'Power Distribution Equipment']],
    ['Telecommunications', 'Telecom and network equipment, fibre optics, antennas and radio communication.',
      ['Telecom Equipment', 'Routers', 'Network Switches', 'Fiber Optic Equipment', 'Antennas', 'Communication Cables', 'Radio Communication Equipment']],
    ['Lighting & LED Products', 'LED bulbs and panels, street, flood, decorative, industrial and solar lighting.',
      ['LED Bulbs', 'LED Panels', 'Street Lights', 'Floodlights', 'Decorative Lighting', 'Industrial Lighting', 'Solar Lights', 'Lighting Accessories']],
  ]],
  ['Industrial, Manufacturing & Engineering', [
    ['Industrial Machinery', 'Machine tools and production machinery for manufacturing and processing lines.',
      ['CNC Machines', 'Lathe Machines', 'Milling Machines', 'Cutting Machines', 'Grinding Machines', 'Welding Machines', 'Textile Machinery', 'Food Processing Machinery'],
      { legacySlug: 'machinery', legacySubcategories: ['Power Tools', 'CNC & Machine Tools', 'Workshop Equipment'], productTypes: { 'CNC Machines': ['CNC Lathe Machines', 'CNC Milling Machines', 'CNC Routers', 'CNC Plasma Cutters'] } }],
    ['Industrial Tools & Equipment', 'Power and hand tools, cutting and drilling tools, measuring instruments and workshop equipment.',
      ['Power Tools', 'Hand Tools', 'Cutting Tools', 'Drilling Tools', 'Measuring Instruments', 'Workshop Equipment', 'Tool Kits'],
      { legacySlug: 'industrial-supplies', legacySubcategories: ['Safety & PPE', 'Valves & Fittings'] }],
    ['Industrial Components & Spare Parts', 'Bearings, gears, valves, pumps, compressors, fasteners and fluid-power components.',
      ['Bearings', 'Gears', 'Shafts', 'Valves', 'Pumps', 'Compressors', 'Motors', 'Fasteners', 'Hydraulic Components', 'Pneumatic Components']],
    ['Industrial Automation & Robotics', 'PLCs, sensors, industrial robots, HMI panels, servo motors and control systems.',
      ['PLC Systems', 'Sensors', 'Industrial Robots', 'Control Systems', 'HMI Panels', 'Servo Motors', 'Automation Accessories']],
    ['Material Handling Equipment', 'Forklifts, pallet trucks, conveyors, cranes, hoists and warehouse racking.',
      ['Forklifts', 'Pallet Trucks', 'Conveyor Systems', 'Cranes', 'Hoists', 'Industrial Trolleys', 'Lifting Equipment', 'Warehouse Racking']],
    ['Metals & Alloys', 'Ferrous and non-ferrous metals, sheets, pipes, rods and metal scrap.',
      ['Iron', 'Steel', 'Stainless Steel', 'Aluminium', 'Copper', 'Brass', 'Zinc', 'Metal Sheets', 'Pipes', 'Rods', 'Metal Scrap']],
    ['Minerals & Mining', 'Industrial minerals, ores, mineral powders and mining equipment.',
      ['Industrial Minerals', 'Ores', 'Limestone', 'Silica', 'Quartz', 'Graphite', 'Mining Equipment', 'Mineral Powders']],
    ['Industrial Raw Materials', 'Metal, polymer, chemical, textile, rubber, wood and recycled raw materials.',
      ['Metal Raw Materials', 'Polymer Raw Materials', 'Chemical Raw Materials', 'Textile Fibres', 'Rubber Materials', 'Wood Raw Materials', 'Recycled Materials']],
  ]],
  ['Chemicals, Plastics & Packaging', [
    ['Industrial Chemicals', 'Solvents, acids, alkalis, cleaning, water-treatment, textile and speciality chemicals.',
      ['Solvents', 'Acids', 'Alkalis', 'Industrial Cleaning Chemicals', 'Water Treatment Chemicals', 'Textile Chemicals', 'Specialty Chemicals', 'Adhesives'],
      { regulated: true }],
    ['Plastics & Polymers', 'Plastic granules, PVC, HDPE and LDPE products, sheets and recycled plastics.',
      ['Plastic Granules', 'PVC Products', 'HDPE Products', 'LDPE Products', 'Plastic Sheets', 'Plastic Components', 'Recycled Plastic']],
    ['Rubber Products', 'Rubber sheets, seals, gaskets, hoses, conveyor belts and moulded components.',
      ['Rubber Sheets', 'Rubber Seals', 'Gaskets', 'Rubber Hoses', 'Conveyor Belts', 'Rubber Mouldings', 'Industrial Rubber Components']],
    ['Packaging Materials', 'Corrugated boxes, cartons, bags, pouches, bottles, containers and packaging films.',
      ['Corrugated Boxes', 'Cartons', 'Paper Bags', 'Plastic Packaging', 'Pouches', 'Bottles', 'Containers', 'Bubble Wrap', 'Stretch Film', 'Packaging Tape'],
      { legacySlug: 'packaging', legacySubcategories: ['Paper Packaging', 'Glass Packaging', 'Cosmetic Packaging'] }],
    ['Printing & Publishing Supplies', 'Printing machines, inks, paper, labels, plates and binding equipment.',
      ['Printing Machines', 'Printing Inks', 'Printing Paper', 'Labels', 'Stickers', 'Printing Plates', 'Binding Equipment', 'Printing Accessories']],
    ['Paper & Paper Products', 'Kraft, tissue and speciality paper, cardboard, paperboard and paper rolls.',
      ['Kraft Paper', 'Tissue Paper', 'Cardboard', 'Paper Rolls', 'Disposable Paper Products', 'Paperboard', 'Specialty Paper']],
  ]],
  ['Fashion, Clothing & Textiles', [
    ['Fashion & Apparel', 'Men’s, women’s and kids’ clothing, ethnic and western wear, uniforms and workwear.',
      ['Men\'s Clothing', 'Women\'s Clothing', 'Kids\' Clothing', 'Ethnic Wear', 'Western Wear', 'Winter Wear', 'Innerwear', 'Uniforms', 'Workwear'],
      { productTypes: { 'Men\x27s Clothing': ['T-Shirts', 'Shirts', 'Trousers', 'Jeans', 'Jackets'], 'Women\x27s Clothing': ['Tops', 'Dresses', 'Kurtis', 'Sarees', 'Leggings'] }, legacySlug: 'fashion-apparel', legacySubcategories: ['T-Shirts', 'Hoodies', 'Outerwear', 'Knitwear', 'Shirts', 'Denim', 'Bags & Accessories'] }],
    ['Textiles & Fabrics', 'Cotton, silk, wool, polyester, denim, knitted and technical fabrics, yarns and threads.',
      ['Cotton Fabric', 'Silk Fabric', 'Wool Fabric', 'Polyester Fabric', 'Denim', 'Knitted Fabric', 'Technical Textiles', 'Yarns', 'Threads']],
    ['Footwear', 'Men’s, women’s and kids’ footwear, sports and safety shoes and footwear components.',
      ['Men\'s Footwear', 'Women\'s Footwear', 'Kids\' Footwear', 'Sports Shoes', 'Safety Shoes', 'Sandals', 'Slippers', 'Footwear Components']],
    ['Bags & Luggage', 'Backpacks, handbags, travel and trolley bags, laptop and school bags, wallets and industrial bags.',
      ['Backpacks', 'Handbags', 'Travel Bags', 'Trolley Bags', 'Laptop Bags', 'School Bags', 'Wallets', 'Industrial Bags']],
    ['Jewellery & Fashion Accessories', 'Gold, silver, artificial and fashion jewellery, watches, belts and accessories.',
      ['Gold Jewellery', 'Silver Jewellery', 'Artificial Jewellery', 'Fashion Jewellery', 'Watches', 'Belts', 'Sunglasses', 'Hair Accessories']],
    ['Garment Manufacturing Supplies', 'Buttons, zippers, elastic, labels, embroidery materials, threads and trims.',
      ['Buttons', 'Zippers', 'Elastic', 'Labels', 'Embroidery Materials', 'Sewing Threads', 'Garment Trims', 'Tailoring Accessories']],
  ]],
  ['Food, Beverages & Agriculture', [
    ['Food & Beverages', 'Grains, flour, pulses, spices, edible oils, dairy, snacks, beverages and frozen foods.',
      ['Rice', 'Wheat', 'Flour', 'Pulses', 'Spices', 'Edible Oils', 'Ghee', 'Dairy Products', 'Snacks', 'Bakery Products', 'Dry Fruits', 'Beverages', 'Frozen Foods'],
      { productTypes: { 'Dairy Products': ['Ghee', 'Milk', 'Butter', 'Cheese', 'Milk Powder', 'Paneer'], Ghee: ['Cow Ghee', 'Buffalo Ghee', 'A2 Ghee'] } }],
    ['Agriculture & Farming', 'Seeds, fertilisers, agricultural inputs, irrigation, greenhouse supplies and farming tools.',
      ['Seeds', 'Fertilisers', 'Biofertilisers', 'Agricultural Inputs', 'Irrigation Supplies', 'Greenhouse Supplies', 'Farming Tools', 'Crop Protection Products'],
      { legacySlug: 'agriculture', legacySubcategories: ['Farm Equipment', 'Gardening'], regulated: true }],
    ['Agricultural Machinery', 'Tractors, tillers, harvesters, seed drills, sprayers and farm machinery spares.',
      ['Tractors', 'Power Tillers', 'Harvesters', 'Seed Drills', 'Sprayers', 'Rotavators', 'Cultivators', 'Farm Machinery Spare Parts']],
    ['Animal Feed & Livestock Supplies', 'Cattle, poultry and fish feed, supplements and livestock farming equipment.',
      ['Cattle Feed', 'Poultry Feed', 'Fish Feed', 'Feed Supplements', 'Dairy Farming Equipment', 'Poultry Farming Equipment', 'Livestock Accessories']],
    ['Food Processing & Commercial Kitchen Equipment', 'Flour mills, oil expellers, processing machines, ovens, refrigeration and food packaging machines.',
      ['Flour Mills', 'Oil Expellers', 'Food Processing Machines', 'Mixers', 'Grinders', 'Industrial Ovens', 'Refrigeration Equipment', 'Food Packaging Machines']],
  ]],
  ['Construction, Home & Furniture', [
    ['Building & Construction Materials', 'Cement, bricks, aggregates, TMT bars, tiles, stone, glass, roofing and insulation.',
      ['Cement', 'Bricks', 'Sand', 'Aggregates', 'TMT Bars', 'Tiles', 'Marble', 'Granite', 'Glass', 'Roofing Materials', 'Insulation Materials']],
    ['Construction Machinery & Equipment', 'Concrete mixers and pumps, excavators, loaders, compactors, scaffolding and site tools.',
      ['Concrete Mixers', 'Excavators', 'Loaders', 'Compactors', 'Scaffolding', 'Construction Tools', 'Concrete Pumps']],
    ['Hardware & Building Fittings', 'Locks, hinges, handles, screws, nuts, bolts and door, window and architectural fittings.',
      ['Locks', 'Hinges', 'Door Handles', 'Screws', 'Nuts', 'Bolts', 'Door Fittings', 'Window Fittings', 'Architectural Hardware']],
    ['Plumbing & Sanitaryware', 'Pipes, fittings, taps, faucets, basins, toilets, bathroom accessories and water tanks.',
      ['Pipes', 'Pipe Fittings', 'Taps', 'Faucets', 'Wash Basins', 'Toilets', 'Bathroom Accessories', 'Water Tanks', 'Plumbing Tools']],
    ['Furniture', 'Office, home, school, hospital, hotel, outdoor and industrial furniture.',
      ['Office Furniture', 'Home Furniture', 'School Furniture', 'Hospital Furniture', 'Hotel Furniture', 'Outdoor Furniture', 'Industrial Furniture'],
      { legacySlug: 'furniture', legacySubcategories: ['Living Room', 'Office', 'Lighting'], productTypes: { 'Office Furniture': ['Office Chairs', 'Office Desks', 'Workstations', 'Filing Cabinets', 'Conference Tables'] } }],
    ['Home & Kitchen', 'Kitchenware, cookware, dinnerware, kitchen and home appliances and household products.',
      ['Kitchenware', 'Cookware', 'Dinnerware', 'Kitchen Appliances', 'Home Appliances', 'Storage Containers', 'Household Products', 'Kitchen Accessories'],
      { legacySlug: 'home-kitchen', legacySubcategories: ['Home Decor', 'Tableware', 'Bedding', 'Home Fragrance'] }],
    ['Home Decor & Furnishings', 'Curtains, bedsheets, carpets, rugs, cushions, wall decor, mirrors and decorative products.',
      ['Curtains', 'Bedsheets', 'Carpets', 'Rugs', 'Cushions', 'Wall Decor', 'Artificial Plants', 'Mirrors', 'Decorative Products']],
    ['HVAC & Refrigeration', 'Air conditioners, coolers, ventilation, industrial fans, refrigeration and cold storage.',
      ['Air Conditioners', 'Air Coolers', 'Ventilation Systems', 'Industrial Fans', 'Refrigeration Units', 'Cold Storage Equipment', 'HVAC Spare Parts']],
  ]],
  ['Automotive & Transportation', [
    ['Automotive & Vehicles', 'Cars, two- and three-wheelers, commercial and electric vehicles, accessories and workshop equipment.',
      ['Cars', 'Two-Wheelers', 'Three-Wheelers', 'Commercial Vehicles', 'Electric Vehicles', 'Vehicle Accessories', 'Automotive Workshop Equipment'],
      { legacySlug: 'automotive', legacySubcategories: ['Garage Equipment', 'Interior Accessories'] }],
    ['Automotive Parts & Components', 'Engine, brake and suspension parts, filters, batteries, tyres, lubricants and electricals.',
      ['Engine Parts', 'Brake Parts', 'Suspension Components', 'Filters', 'Batteries', 'Tyres', 'Tubes', 'Lubricants', 'Electrical Components']],
    ['Transportation & Logistics Supplies', 'Shipping containers, pallets, cargo handling, logistics packaging and warehouse supplies.',
      ['Shipping Containers', 'Pallets', 'Cargo Handling Equipment', 'Logistics Packaging', 'Fleet Accessories', 'Warehouse Supplies']],
  ]],
  ['Health, Beauty & Medical', [
    ['Beauty & Personal Care', 'Skincare, haircare, cosmetics, fragrances, grooming, salon supplies and beauty equipment.',
      ['Skincare', 'Haircare', 'Cosmetics', 'Makeup', 'Fragrances', 'Grooming Products', 'Salon Supplies', 'Beauty Equipment'],
      { legacySlug: 'beauty-personal-care', legacySubcategories: ['Sun Care', 'Tools'] }],
    ['Medical & Healthcare Equipment', 'Hospital beds, diagnostic and patient monitoring equipment, surgical instruments and consumables.',
      ['Hospital Beds', 'Diagnostic Equipment', 'Surgical Instruments', 'Medical Consumables', 'Patient Monitoring Equipment', 'Mobility Aids', 'Dental Equipment'],
      { regulated: true }],
    ['Pharmaceuticals & Healthcare Supplies', 'Pharmaceutical products, medical disposables, first aid, packaging and nutraceuticals.',
      ['Pharmaceutical Products', 'Medical Disposables', 'First Aid Supplies', 'Healthcare Consumables', 'Pharmaceutical Packaging', 'Nutraceutical Products'],
      { regulated: true }],
    ['Laboratory & Scientific Equipment', 'Laboratory glassware, microscopes, analytical and testing instruments and lab chemicals.',
      ['Laboratory Glassware', 'Microscopes', 'Analytical Instruments', 'Testing Equipment', 'Laboratory Chemicals', 'Scientific Instruments'],
      { regulated: true }],
  ]],
  ['Business, Office & Commercial Supplies', [
    ['Office Supplies & Stationery', 'Paper, notebooks, pens, files, organisers, printer consumables and office accessories.',
      ['Paper', 'Notebooks', 'Pens', 'Files', 'Office Organisers', 'Printer Consumables', 'Whiteboards', 'Office Accessories']],
    ['Education & School Supplies', 'School stationery, educational kits, teaching aids, school lab equipment and classroom supplies.',
      ['School Stationery', 'Educational Kits', 'Teaching Aids', 'School Laboratory Equipment', 'Classroom Supplies', 'Educational Models']],
    ['Hospitality & Restaurant Supplies', 'Hotel amenities, restaurant equipment, commercial tableware, catering supplies and hotel linen.',
      ['Hotel Amenities', 'Restaurant Equipment', 'Commercial Tableware', 'Catering Supplies', 'Hotel Linen', 'Food Service Products']],
    ['Cleaning & Housekeeping Supplies', 'Cleaning chemicals, mops, brooms, brushes, tissue products, waste bins and cleaning machines.',
      ['Cleaning Chemicals', 'Mops', 'Brooms', 'Brushes', 'Tissue Products', 'Waste Bins', 'Commercial Cleaning Machines', 'Housekeeping Equipment']],
  ]],
  ['Lifestyle, Recreation & Specialised Industries', [
    ['Sports & Fitness', 'Gym and fitness equipment, cricket, football and badminton gear, sportswear and outdoor fitness.',
      ['Gym Equipment', 'Fitness Accessories', 'Cricket Equipment', 'Football Equipment', 'Badminton Equipment', 'Sportswear', 'Outdoor Fitness Equipment'],
      { legacySlug: 'sports-outdoors', legacySubcategories: ['Footwear', 'Outdoor Gear'] }],
    ['Toys & Games', 'Educational, soft, electronic and outdoor toys, board games, puzzles and toy manufacturing supplies.',
      ['Educational Toys', 'Soft Toys', 'Electronic Toys', 'Board Games', 'Puzzles', 'Outdoor Toys', 'Baby Toys', 'Toy Manufacturing Supplies'],
      { legacySlug: 'toys-games', legacySubcategories: ['Wooden Toys', 'Gaming Accessories'] }],
    ['Baby & Maternity Products', 'Baby clothing, diapers, feeding accessories, baby care, strollers, baby furniture and maternity accessories.',
      ['Baby Clothing', 'Diapers', 'Feeding Accessories', 'Baby Care Products', 'Strollers', 'Baby Furniture', 'Maternity Accessories']],
    ['Gifts, Handicrafts & Festival Supplies', 'Corporate and promotional gifts, handicrafts, religious items, festival decorations and souvenirs.',
      ['Corporate Gifts', 'Promotional Gifts', 'Handicrafts', 'Religious Items', 'Festival Decorations', 'Gift Packaging', 'Souvenirs']],
    ['Pet Products', 'Pet food, grooming, accessories, beds, toys, aquariums and hygiene supplies.',
      ['Pet Food', 'Pet Grooming Products', 'Pet Accessories', 'Pet Beds', 'Pet Toys', 'Aquariums', 'Pet Hygiene Supplies']],
    ['Safety & Security Equipment', 'CCTV, access control, alarms, fire safety, PPE and industrial safety products.',
      ['CCTV Cameras', 'Access Control Systems', 'Alarm Systems', 'Fire Safety Equipment', 'PPE', 'Safety Helmets', 'Safety Gloves', 'Industrial Safety Products']],
    ['Solar & Renewable Energy', 'Solar panels, inverters, batteries, pumps, mounting structures, wind components and energy storage.',
      ['Solar Panels', 'Solar Inverters', 'Solar Batteries', 'Solar Pumps', 'Solar Mounting Structures', 'Wind Energy Components', 'Energy Storage Systems']],
    ['Environment & Waste Management', 'Water purification, wastewater treatment, air pollution control, recycling machines and waste containers.',
      ['Water Purification Equipment', 'Wastewater Treatment Equipment', 'Air Pollution Control Equipment', 'Recycling Machines', 'Waste Containers']],
    ['Marine & Aerospace Supplies', 'Marine equipment, ship components, navigation, aviation components and ground support equipment.',
      ['Marine Equipment', 'Ship Components', 'Navigation Equipment', 'Aviation Components', 'Aircraft Ground Support Equipment', 'Marine Safety Supplies']],
    ['Garden, Outdoor & Landscaping', 'Garden tools, planters, irrigation accessories, lawn equipment, outdoor furniture and landscaping supplies.',
      ['Garden Tools', 'Planters', 'Irrigation Accessories', 'Lawn Equipment', 'Outdoor Furniture', 'Landscaping Supplies', 'Greenhouse Equipment']],
  ]],
];

const toSub = (name, order, extra = {}) => ({ slug: slugify(name), name, order, ...extra });

/** Structured records for all main categories, in display order. */
export const CATEGORY_TAXONOMY = GROUPS.flatMap(([groupName, cats], groupIndex) => cats.map(([name, description, subs, options = {}], i) => {
  const slug = options.legacySlug || slugify(name);
  const productTypes = options.productTypes || {};
  const subcategories = [
    ...subs.map((sub, j) => toSub(sub, j + 1, productTypes[sub] ? { productTypes: productTypes[sub].map((t, k) => toSub(t, k + 1)) } : {})),
    // Subcategories existing listings already use: kept valid so no product is misclassified
    ...(options.legacySubcategories || [])
      .filter((legacy) => !subs.some((s) => s.toLowerCase() === legacy.toLowerCase()))
      .map((legacy, k) => toSub(legacy, subs.length + k + 1, { legacy: true })),
  ];
  return {
    slug,
    name,
    description,
    group: groupName,
    groupSlug: slugify(groupName),
    displayOrder: groupIndex * 100 + i + 1,
    isActive: true,
    regulated: Boolean(options.regulated),
    legacy: Boolean(options.legacySlug),
    subcategories,
  };
}));

/** The ten industry groups with their categories' slugs, in display order. */
export const CATEGORY_GROUPS = GROUPS.map(([groupName, cats]) => ({
  slug: slugify(groupName),
  name: groupName,
  categories: CATEGORY_TAXONOMY.filter((c) => c.group === groupName).map((c) => c.slug),
}));
