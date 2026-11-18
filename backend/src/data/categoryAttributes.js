/**
 * Category-specific product specification schema (the "dynamic fields" of Add Product).
 *
 * - Attributes have STABLE keys, so values can drive search filters and product comparison.
 * - Definitions inherit: category -> subcategory -> product type. A later level adds attributes or overrides
 *   an inherited one by key (e.g. makes it required); `{ key, remove: true }` drops an inherited attribute.
 * - Values are validated on the server against the resolved schema (never trust the browser).
 * - `SPEC_SCHEMA_VERSION` is stored with every product's values, so old listings stay readable after changes.
 *
 * Field types: text, textarea, number (integer), decimal, select, radio, multiselect, boolean, date.
 * Definition fields: key, label, type, required, unit, options, min, max, placeholder, help, filterable,
 * comparable, showIf { key, equals | in }, active, order.
 */
import { CATEGORY_TAXONOMY, slugify } from './categoryTaxonomy.js';

export const SPEC_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------- reusable attribute definitions
const A = {
  brand: { label: 'Brand', type: 'text', filterable: true, comparable: true, placeholder: 'e.g. TradeExpress Select' },
  model_number: { label: 'Model Number', type: 'text', comparable: true },
  material: { label: 'Material', type: 'text', filterable: true, comparable: true },
  colour: { label: 'Colour', type: 'text', filterable: true, comparable: true },
  dimensions: { label: 'Dimensions (L × W × H)', type: 'text', unit: 'cm', comparable: true, placeholder: 'e.g. 60 × 40 × 35' },
  weight: { label: 'Weight', type: 'decimal', unit: 'kg', min: 0, comparable: true },
  net_weight: { label: 'Net Weight', type: 'decimal', unit: 'kg', min: 0, filterable: true, comparable: true },
  power_output: { label: 'Power', type: 'decimal', unit: 'W', min: 0, filterable: true, comparable: true },
  power_consumption: { label: 'Power Consumption', type: 'decimal', unit: 'kW', min: 0, comparable: true },
  operating_voltage: { label: 'Operating Voltage', type: 'select', options: ['5 V', '12 V', '24 V', '110 V', '220–240 V', '380–415 V', 'Other'], comparable: true },
  warranty_months: { label: 'Warranty', type: 'number', unit: 'months', min: 0, max: 120, filterable: true, comparable: true },
  condition: { label: 'Condition', type: 'select', options: ['New', 'Refurbished', 'Used'], filterable: true, comparable: true },
  capacity: { label: 'Capacity', type: 'text', comparable: true, placeholder: 'e.g. 500 units/hour' },
  grade: { label: 'Grade', type: 'text', filterable: true, comparable: true },
  standard: { label: 'Applicable Standard', type: 'text', comparable: true, placeholder: 'e.g. IS 269, ASTM A36, ISO 9001' },
  purity: { label: 'Purity', type: 'decimal', unit: '%', min: 0, max: 100, comparable: true },
  packaging_type: { label: 'Packaging Type', type: 'select', options: ['Bag', 'Box', 'Carton', 'Drum', 'Tin', 'Jar', 'Bottle', 'Pouch', 'Bulk', 'Pallet'], filterable: true, comparable: true },
  shelf_life_months: { label: 'Shelf Life', type: 'number', unit: 'months', min: 1, max: 120, filterable: true, comparable: true },
  storage_conditions: { label: 'Storage Conditions', type: 'textarea', placeholder: 'e.g. Store in a cool, dry place below 25 °C' },
  ingredients: { label: 'Ingredients', type: 'textarea' },
  size_range: { label: 'Available Sizes', type: 'multiselect', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size'], filterable: true },
  fabric: { label: 'Fabric / Material', type: 'text', filterable: true, comparable: true },
  compatibility: { label: 'Compatible With', type: 'text', comparable: true },
  connectivity: { label: 'Connectivity', type: 'multiselect', options: ['Wired', 'Bluetooth', 'Wi-Fi', 'USB', 'NFC', '4G/5G', 'Ethernet'], filterable: true, comparable: true },
  ip_rating: { label: 'IP Rating', type: 'select', options: ['IP20', 'IP44', 'IP54', 'IP65', 'IP66', 'IP67', 'IP68'], filterable: true, comparable: true },
  certifications: { label: 'Certifications', type: 'multiselect', options: ['ISO 9001', 'ISO 14001', 'CE', 'RoHS', 'BIS', 'FSSAI', 'FDA', 'GMP', 'Organic', 'Halal', 'IEC', 'UL'] },
  usage: { label: 'Application / Use', type: 'textarea' },
  hs_code: { label: 'HS Code', type: 'text', help: 'Harmonised System code used for customs, if known.' },
};

/** Definition for a reusable attribute, optionally adjusted (e.g. required, different options). */
const use = (key, overrides = {}) => ({ key, ...A[key], ...overrides });
const field = (key, def) => ({ key, ...def });

// ---------------------------------------------------------------- category level (all 60 categories)
const COMMON_GOODS = [use('brand'), use('model_number'), use('material'), use('dimensions'), use('weight'), use('certifications')];
const MACHINE = [use('brand'), use('model_number'), use('condition', { required: true }), use('power_consumption'), use('operating_voltage'), use('capacity'), use('dimensions'), use('weight'), use('warranty_months'), use('certifications')];
const ELECTRONIC = [use('brand'), use('model_number'), use('power_output'), use('operating_voltage'), use('connectivity'), use('warranty_months'), use('certifications')];
const MATERIAL = [use('grade'), use('standard'), use('purity'), use('packaging_type'), use('net_weight'), use('hs_code'), use('certifications')];
const CONSUMABLE = [use('brand'), use('net_weight'), use('packaging_type'), use('shelf_life_months'), use('storage_conditions'), use('certifications')];
const APPAREL = [use('brand'), use('fabric', { required: true }), use('size_range'), use('colour'), use('certifications')];

const BY_CATEGORY = {
  'Electronics': ELECTRONIC,
  'Mobiles & Accessories': [use('brand'), use('model_number'), use('compatibility'), use('colour'), use('warranty_months'), use('certifications')],
  'Computers & IT Hardware': [...ELECTRONIC, field('processor', { label: 'Processor', type: 'text', comparable: true }), field('ram_gb', { label: 'RAM', type: 'number', unit: 'GB', min: 0, filterable: true, comparable: true }), field('storage_gb', { label: 'Storage', type: 'number', unit: 'GB', min: 0, filterable: true, comparable: true })],
  'Electrical Equipment & Supplies': [use('brand'), use('model_number'), use('operating_voltage'), field('current_rating', { label: 'Current Rating', type: 'decimal', unit: 'A', min: 0, comparable: true }), use('ip_rating'), use('standard'), use('warranty_months'), use('certifications')],
  'Telecommunications': [...ELECTRONIC, field('frequency_band', { label: 'Frequency Band', type: 'text', comparable: true })],
  'Lighting & LED Products': [use('brand'), use('power_output', { label: 'Wattage' }), field('lumens', { label: 'Luminous Flux', type: 'number', unit: 'lm', min: 0, comparable: true }), field('colour_temperature', { label: 'Colour Temperature', type: 'select', options: ['2700K Warm White', '4000K Neutral White', '6500K Cool Daylight', 'RGB'], filterable: true, comparable: true }), use('ip_rating'), use('warranty_months'), use('certifications')],
  'Industrial Machinery': MACHINE,
  'Industrial Tools & Equipment': [use('brand'), use('model_number'), field('tool_power_source', { label: 'Power Source', type: 'select', options: ['Manual', 'Corded Electric', 'Cordless / Battery', 'Pneumatic', 'Hydraulic'], filterable: true, comparable: true }), use('power_output'), use('material'), use('warranty_months'), use('certifications')],
  'Industrial Components & Spare Parts': [use('brand'), use('model_number'), use('material', { required: true }), use('standard'), use('dimensions'), use('weight'), use('certifications')],
  'Industrial Automation & Robotics': [...MACHINE, field('communication_protocol', { label: 'Communication Protocol', type: 'multiselect', options: ['Modbus', 'Profibus', 'Profinet', 'EtherNet/IP', 'CANopen', 'OPC UA'], comparable: true })],
  'Material Handling Equipment': [...MACHINE, field('load_capacity_kg', { label: 'Load Capacity', type: 'decimal', unit: 'kg', min: 0, filterable: true, comparable: true }), field('lift_height_m', { label: 'Lift Height', type: 'decimal', unit: 'm', min: 0, comparable: true })],
  'Metals & Alloys': [...MATERIAL, field('form', { label: 'Form', type: 'select', options: ['Sheet', 'Plate', 'Coil', 'Pipe', 'Tube', 'Rod', 'Bar', 'Wire', 'Ingot', 'Scrap'], filterable: true, comparable: true }), field('thickness_mm', { label: 'Thickness', type: 'decimal', unit: 'mm', min: 0, comparable: true })],
  'Minerals & Mining': [...MATERIAL, field('particle_size', { label: 'Particle / Mesh Size', type: 'text', comparable: true })],
  'Industrial Raw Materials': MATERIAL,
  'Industrial Chemicals': [...MATERIAL, field('cas_number', { label: 'CAS Number', type: 'text', comparable: true }), field('physical_form', { label: 'Physical Form', type: 'select', options: ['Liquid', 'Powder', 'Granules', 'Paste', 'Gas', 'Flakes'], filterable: true, comparable: true }), field('hazard_class', { label: 'Hazard Classification', type: 'text', help: 'GHS / UN hazard class, if applicable.' }), use('shelf_life_months')],
  'Plastics & Polymers': [...MATERIAL, field('polymer_type', { label: 'Polymer Type', type: 'select', options: ['PP', 'PE', 'HDPE', 'LDPE', 'PVC', 'PET', 'ABS', 'PS', 'Nylon', 'Other'], filterable: true, comparable: true }), field('melt_flow_index', { label: 'Melt Flow Index', type: 'decimal', unit: 'g/10 min', min: 0, comparable: true })],
  'Rubber Products': [use('material', { required: true }), field('hardness_shore_a', { label: 'Hardness', type: 'number', unit: 'Shore A', min: 0, max: 100, comparable: true }), use('dimensions'), use('standard'), use('certifications')],
  'Packaging Materials': [use('material', { required: true }), use('dimensions'), field('ply_or_thickness', { label: 'Ply / Thickness', type: 'text', comparable: true }), field('custom_printing', { label: 'Custom Printing Available', type: 'boolean', filterable: true }), field('food_grade', { label: 'Food Grade', type: 'boolean', filterable: true, comparable: true }), use('certifications')],
  'Printing & Publishing Supplies': [use('brand'), use('model_number'), use('material'), use('dimensions'), use('certifications')],
  'Paper & Paper Products': [field('gsm', { label: 'Paper Weight', type: 'number', unit: 'GSM', min: 1, filterable: true, comparable: true }), use('material'), use('dimensions'), use('packaging_type'), use('certifications')],
  'Fashion & Apparel': APPAREL,
  'Textiles & Fabrics': [use('fabric', { required: true }), field('gsm', { label: 'Fabric Weight', type: 'number', unit: 'GSM', min: 1, filterable: true, comparable: true }), field('width_inches', { label: 'Fabric Width', type: 'number', unit: 'inches', min: 1, comparable: true }), use('colour'), field('weave_or_knit', { label: 'Weave / Knit', type: 'text', comparable: true }), use('certifications')],
  'Footwear': [use('brand'), field('upper_material', { label: 'Upper Material', type: 'text', comparable: true }), field('sole_material', { label: 'Sole Material', type: 'text', comparable: true }), field('size_range_footwear', { label: 'Available Sizes', type: 'multiselect', options: ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'], filterable: true }), use('colour'), use('certifications')],
  'Bags & Luggage': [use('brand'), use('material', { required: true }), use('dimensions'), field('capacity_litres', { label: 'Capacity', type: 'decimal', unit: 'L', min: 0, comparable: true }), use('colour'), use('warranty_months')],
  'Jewellery & Fashion Accessories': [use('brand'), use('material', { required: true }), field('metal_purity', { label: 'Metal Purity', type: 'select', options: ['24K', '22K', '18K', '14K', '925 Sterling', 'Alloy / Plated', 'Not applicable'], filterable: true, comparable: true }), use('weight', { unit: 'g' }), use('colour'), use('certifications')],
  'Garment Manufacturing Supplies': [use('material', { required: true }), use('dimensions', { label: 'Size / Dimensions' }), use('colour'), use('packaging_type'), use('certifications')],
  'Food & Beverages': [...CONSUMABLE, use('ingredients'), field('veg_status', { label: 'Vegetarian Status', type: 'select', options: ['Vegetarian', 'Non-Vegetarian', 'Vegan'], filterable: true, comparable: true }), field('fssai_licence', { label: 'FSSAI Licence Number', type: 'text', help: 'Required for food products sold in India.' })],
  'Agriculture & Farming': [use('brand'), use('net_weight'), use('packaging_type'), field('crop_suitability', { label: 'Suitable Crops', type: 'text', comparable: true }), use('shelf_life_months'), field('registration_number', { label: 'Registration / Licence Number', type: 'text', help: 'Registration for regulated inputs (fertilisers, seeds, crop protection), if applicable.' }), use('certifications')],
  'Agricultural Machinery': [...MACHINE, field('horsepower', { label: 'Engine Power', type: 'decimal', unit: 'HP', min: 0, filterable: true, comparable: true })],
  'Animal Feed & Livestock Supplies': [...CONSUMABLE, field('suitable_for', { label: 'Suitable For', type: 'text', comparable: true }), field('protein_percent', { label: 'Protein', type: 'decimal', unit: '%', min: 0, max: 100, comparable: true })],
  'Food Processing & Commercial Kitchen Equipment': [...MACHINE, field('food_contact_material', { label: 'Food-Contact Material', type: 'text', comparable: true })],
  'Building & Construction Materials': [...MATERIAL, use('dimensions')],
  'Construction Machinery & Equipment': MACHINE,
  'Hardware & Building Fittings': [use('brand'), use('material', { required: true }), field('finish', { label: 'Finish', type: 'text', filterable: true, comparable: true }), use('dimensions'), use('standard'), use('warranty_months')],
  'Plumbing & Sanitaryware': [use('brand'), use('material', { required: true }), field('pipe_size', { label: 'Size / Diameter', type: 'text', comparable: true }), field('pressure_rating', { label: 'Pressure Rating', type: 'text', comparable: true }), use('standard'), use('warranty_months'), use('certifications')],
  'Furniture': [use('brand'), use('material', { required: true }), use('dimensions'), use('weight'), use('colour'), field('assembly_required', { label: 'Assembly Required', type: 'boolean', comparable: true }), use('warranty_months')],
  'Home & Kitchen': COMMON_GOODS,
  'Home Decor & Furnishings': [use('material', { required: true }), use('dimensions'), use('colour'), field('pattern', { label: 'Pattern / Design', type: 'text', filterable: true })],
  'HVAC & Refrigeration': [...ELECTRONIC, field('cooling_capacity', { label: 'Cooling Capacity', type: 'text', unit: 'tons / BTU', comparable: true }), field('energy_rating', { label: 'Energy Rating', type: 'select', options: ['1 Star', '2 Star', '3 Star', '4 Star', '5 Star', 'Not rated'], filterable: true, comparable: true })],
  'Automotive & Vehicles': [use('brand'), use('model_number'), field('fuel_type', { label: 'Fuel / Power Type', type: 'select', options: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid', 'Not applicable'], filterable: true, comparable: true }), use('condition'), use('warranty_months'), use('certifications')],
  'Automotive Parts & Components': [use('brand'), field('part_number', { label: 'Part Number', type: 'text', comparable: true }), field('vehicle_compatibility', { label: 'Compatible Vehicles', type: 'text', comparable: true }), field('oem_or_aftermarket', { label: 'OEM / Aftermarket', type: 'radio', options: ['OEM', 'Aftermarket'], filterable: true, comparable: true }), use('warranty_months')],
  'Transportation & Logistics Supplies': [use('material'), use('dimensions'), field('load_capacity_kg', { label: 'Load Capacity', type: 'decimal', unit: 'kg', min: 0, comparable: true }), use('standard')],
  'Beauty & Personal Care': [...CONSUMABLE, use('ingredients'), field('skin_hair_type', { label: 'Suitable Skin / Hair Type', type: 'text', filterable: true }), field('cosmetic_licence', { label: 'Cosmetic Licence Number', type: 'text' })],
  'Medical & Healthcare Equipment': [use('brand'), use('model_number'), field('device_class', { label: 'Device Risk Class', type: 'select', options: ['Class A', 'Class B', 'Class C', 'Class D', 'Not a medical device'], required: true, comparable: true }), field('regulatory_licence', { label: 'Medical Device Licence / Registration', type: 'text', required: true, help: 'Required to list regulated medical devices.' }), use('power_output'), use('warranty_months'), use('certifications')],
  'Pharmaceuticals & Healthcare Supplies': [field('composition', { label: 'Composition', type: 'textarea', required: true }), field('dosage_form', { label: 'Dosage Form', type: 'select', options: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Powder', 'Drops', 'Not applicable'], comparable: true }), field('drug_licence', { label: 'Drug Licence Number', type: 'text', required: true, help: 'Required to list pharmaceutical products.' }), use('shelf_life_months', { required: true }), use('storage_conditions'), use('packaging_type'), use('certifications')],
  'Laboratory & Scientific Equipment': [...MACHINE.filter((d) => d.key !== 'condition'), use('condition'), field('accuracy', { label: 'Accuracy / Resolution', type: 'text', comparable: true })],
  'Office Supplies & Stationery': COMMON_GOODS,
  'Education & School Supplies': [use('brand'), use('material'), field('age_group', { label: 'Age Group', type: 'text', filterable: true }), use('dimensions'), use('certifications')],
  'Hospitality & Restaurant Supplies': COMMON_GOODS,
  'Cleaning & Housekeeping Supplies': [use('brand'), use('material'), use('net_weight'), use('packaging_type'), use('usage'), use('certifications')],
  'Sports & Fitness': [use('brand'), use('material'), use('size_range'), use('weight'), use('colour'), use('certifications')],
  'Toys & Games': [use('brand'), use('material', { required: true }), field('age_group', { label: 'Recommended Age', type: 'text', required: true, filterable: true, comparable: true }), field('battery_required', { label: 'Batteries Required', type: 'boolean', comparable: true }), use('certifications')],
  'Baby & Maternity Products': [use('brand'), use('material', { required: true }), field('age_group', { label: 'Age Group', type: 'text', filterable: true }), use('certifications')],
  'Gifts, Handicrafts & Festival Supplies': [use('material'), use('dimensions'), use('colour'), field('customisation', { label: 'Customisation Available', type: 'boolean', filterable: true })],
  'Pet Products': [use('brand'), field('pet_type', { label: 'Pet Type', type: 'multiselect', options: ['Dog', 'Cat', 'Bird', 'Fish', 'Small Animals'], filterable: true }), use('material'), use('net_weight'), use('shelf_life_months')],
  'Safety & Security Equipment': [use('brand'), use('model_number'), use('standard', { label: 'Safety Standard' }), use('material'), use('ip_rating'), use('warranty_months'), use('certifications')],
  'Solar & Renewable Energy': [use('brand'), use('model_number'), use('power_output', { label: 'Rated Power', required: true }), field('efficiency_percent', { label: 'Efficiency', type: 'decimal', unit: '%', min: 0, max: 100, comparable: true }), use('operating_voltage'), use('warranty_months', { max: 360 }), use('certifications')],
  'Environment & Waste Management': MACHINE,
  'Marine & Aerospace Supplies': [use('brand'), use('model_number'), use('material'), use('standard'), use('certifications')],
  'Garden, Outdoor & Landscaping': COMMON_GOODS,
};

// ---------------------------------------------------------------- subcategory and product-type level (inheriting)
const BY_SUBCATEGORY = {
  'Food & Beverages::Dairy Products': [use('storage_conditions', { label: 'Storage Temperature / Conditions', required: true }), use('shelf_life_months', { required: true }), use('packaging_type', { required: true })],
  'Food & Beverages::Ghee': [
    field('ghee_type', { label: 'Ghee Type', type: 'select', options: ['Cow Ghee', 'Buffalo Ghee', 'A2 Cow Ghee', 'Mixed Milk Ghee'], required: true, filterable: true, comparable: true }),
    field('milk_fat_percent', { label: 'Milk Fat', type: 'decimal', unit: '%', min: 0, max: 100, required: true, comparable: true }),
    use('net_weight', { required: true }), use('shelf_life_months', { required: true }),
    // storage conditions are inherited (category level, and "Storage Temperature / Conditions" from Dairy Products)
  ],
  'Mobiles & Accessories::Chargers': [
    field('charger_type', { label: 'Charger Type', type: 'select', options: ['Wall Charger', 'Car Charger', 'Wireless Charger', 'Multi-Port Charger'], required: true, filterable: true, comparable: true }),
    use('power_output', { label: 'Output Power', required: true }),
    field('input_voltage', { label: 'Input Voltage', type: 'text', placeholder: 'e.g. 100–240 V AC', comparable: true }),
    field('output_voltage', { label: 'Output Voltage', type: 'text', placeholder: 'e.g. 5 V / 9 V / 12 V', comparable: true }),
    field('connector_type', { label: 'Connector Type', type: 'select', options: ['USB-C', 'Lightning', 'Micro-USB', 'USB-A', 'Multiple'], required: true, filterable: true, comparable: true }),
    field('fast_charging', { label: 'Fast Charging Support', type: 'boolean', filterable: true, comparable: true }),
    use('compatibility', { label: 'Compatible Devices' }),
    use('warranty_months'),
  ],
  'Fashion & Apparel::Men\'s Clothing': [
    field('fit_type', { label: 'Fit Type', type: 'select', options: ['Slim Fit', 'Regular Fit', 'Relaxed Fit', 'Oversized'], filterable: true, comparable: true }),
    field('pattern', { label: 'Pattern', type: 'select', options: ['Solid', 'Striped', 'Checked', 'Printed', 'Graphic', 'Self-design'], filterable: true }),
    field('wash_care', { label: 'Washing Instructions', type: 'textarea' }),
  ],
  'Industrial Machinery::CNC Machines': [
    field('machine_type', { label: 'Machine Type', type: 'select', options: ['CNC Lathe', 'CNC Milling', 'CNC Router', 'CNC Plasma', 'CNC Laser', 'Machining Centre'], required: true, filterable: true, comparable: true }),
    field('axes', { label: 'Number of Axes', type: 'number', min: 2, max: 9, required: true, filterable: true, comparable: true }),
    use('power_consumption', { required: true }),
    use('operating_voltage', { required: true }),
    use('capacity', { label: 'Production Capacity' }),
    field('control_system', { label: 'Control System', type: 'text', placeholder: 'e.g. Fanuc 0i-TF, Siemens 828D', comparable: true }),
  ],
  'Building & Construction Materials::Cement': [
    field('cement_type', { label: 'Cement Type', type: 'select', options: ['OPC', 'PPC', 'PSC', 'White Cement', 'Rapid Hardening', 'Other'], required: true, filterable: true, comparable: true }),
    use('grade', { options: undefined, required: true, placeholder: 'e.g. 43, 53' }),
    use('net_weight', { label: 'Packaging Weight', required: true }),
    use('standard', { placeholder: 'e.g. IS 269, IS 1489' }),
    field('manufacturing_date', { label: 'Manufacturing Date', type: 'date' }),
    field('compressive_strength', { label: 'Strength Specification', type: 'text', unit: 'MPa', placeholder: 'e.g. 53 MPa at 28 days', comparable: true }),
    use('storage_conditions', { label: 'Storage Requirements' }),
  ],
  'Furniture::Office Furniture': [field('adjustable_height', { label: 'Adjustable Height', type: 'boolean', filterable: true, comparable: true })],
};

const BY_PRODUCT_TYPE = {
  'Food & Beverages::Dairy Products::Ghee': BY_SUBCATEGORY['Food & Beverages::Ghee'],
  'Food & Beverages::Dairy Products::Milk': [
    field('milk_type', { label: 'Milk Type', type: 'select', options: ['Cow Milk', 'Buffalo Milk', 'Toned', 'Double Toned', 'Skimmed', 'Full Cream', 'UHT'], required: true, filterable: true, comparable: true }),
    field('fat_percent', { label: 'Fat Percentage', type: 'decimal', unit: '%', min: 0, max: 100, required: true, comparable: true }),
    field('packaging_volume', { label: 'Packaging Volume', type: 'decimal', unit: 'L', min: 0, required: true, comparable: true }),
  ],
  'Fashion & Apparel::Men\'s Clothing::T-Shirts': [
    use('size_range', { required: true }),
    use('colour', { label: 'Available Colours', required: true }),
    field('gsm', { label: 'Fabric GSM', type: 'number', unit: 'GSM', min: 80, max: 400, filterable: true, comparable: true }),
    field('sleeve_type', { label: 'Sleeve Type', type: 'select', options: ['Half Sleeve', 'Full Sleeve', 'Sleeveless', 'Three-Quarter'], required: true, filterable: true, comparable: true }),
  ],
  'Furniture::Office Furniture::Office Chairs': [
    field('frame_material', { label: 'Frame Material', type: 'text', required: true, comparable: true }),
    field('upholstery_material', { label: 'Upholstery Material', type: 'text', comparable: true }),
    field('weight_capacity_kg', { label: 'Weight Capacity', type: 'decimal', unit: 'kg', min: 0, required: true, comparable: true }),
    field('adjustable_height', { label: 'Adjustable Height', type: 'boolean', filterable: true, comparable: true }),
  ],
};

// ---------------------------------------------------------------- resolution
const byName = (name) => String(name || '').trim().toLowerCase();

/** Taxonomy entry for a category slug (legacy slugs included). */
export function taxonomyCategory(categorySlug) {
  return CATEGORY_TAXONOMY.find((c) => c.slug === categorySlug) || null;
}

/** Merge definition lists by key: later lists add attributes or override inherited ones. */
function mergeDefinitions(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const def of list || []) {
      if (def.remove) { map.delete(def.key); continue; }
      map.set(def.key, { ...(map.get(def.key) || {}), ...def });
    }
  }
  return [...map.values()]
    .filter((d) => d.active !== false)
    .map((d, i) => ({ type: 'text', required: false, filterable: false, comparable: false, ...d, order: d.order ?? i + 1 }));
}

const findList = (table, ...parts) => {
  const want = parts.map(byName).join('::');
  const entry = Object.entries(table).find(([k]) => byName(k.split('::').join('::')) === want);
  return entry ? entry[1] : [];
};

/**
 * The specification schema for a category / subcategory / product type.
 * `override` lets an admin-maintained definition list (stored in Category.attributes.specSchema) replace the
 * built-in category level.
 */
export function resolveAttributeSchema(categorySlug, subcategory = null, productType = null, override = null) {
  const category = taxonomyCategory(categorySlug);
  const catName = category?.name;
  const categoryLevel = Array.isArray(override) ? override : (catName ? BY_CATEGORY[catName] || COMMON_GOODS : COMMON_GOODS);
  const subcategoryLevel = catName && subcategory ? findList(BY_SUBCATEGORY, catName, subcategory) : [];
  const productTypeLevel = catName && subcategory && productType ? findList(BY_PRODUCT_TYPE, catName, subcategory, productType) : [];
  const sub = category?.subcategories.find((s) => byName(s.name) === byName(subcategory));
  return {
    version: SPEC_SCHEMA_VERSION,
    categorySlug,
    subcategory: subcategory || null,
    productType: productType || null,
    productTypes: (sub?.productTypes || []).map((t) => t.name),
    regulated: Boolean(category?.regulated),
    attributes: mergeDefinitions(categoryLevel, subcategoryLevel, productTypeLevel),
  };
}

// ---------------------------------------------------------------- validation and formatting
const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);

function visible(def, values) {
  if (!def.showIf) return true;
  const other = values[def.showIf.key];
  if (Array.isArray(def.showIf.in)) return def.showIf.in.includes(other);
  return other === def.showIf.equals;
}

/**
 * Validates submitted values against a resolved schema. Unknown keys are rejected, values are coerced to their
 * type, and hidden (conditional) fields are dropped. Returns { values, errors } where errors maps key -> message.
 */
export function validateSpecificationValues(schema, input = {}) {
  const errors = {};
  const values = {};
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const defs = new Map(schema.attributes.map((d) => [d.key, d]));

  for (const key of Object.keys(source)) {
    if (!defs.has(key)) errors[key] = 'This specification is not defined for the selected category.';
  }

  for (const def of schema.attributes) {
    if (!visible(def, source)) continue;
    const raw = source[def.key];
    if (isEmpty(raw)) {
      if (def.required) errors[def.key] = `${def.label} is required.`;
      continue;
    }
    switch (def.type) {
      case 'number':
      case 'decimal': {
        const n = Number(raw);
        if (!Number.isFinite(n) || (def.type === 'number' && !Number.isInteger(n))) { errors[def.key] = `${def.label} must be a ${def.type === 'number' ? 'whole ' : ''}number.`; break; }
        if (def.min !== undefined && n < def.min) { errors[def.key] = `${def.label} must be at least ${def.min}${def.unit ? ` ${def.unit}` : ''}.`; break; }
        if (def.max !== undefined && n > def.max) { errors[def.key] = `${def.label} must be at most ${def.max}${def.unit ? ` ${def.unit}` : ''}.`; break; }
        values[def.key] = n;
        break;
      }
      case 'boolean': {
        if (raw === true || raw === 'true' || raw === 'yes') values[def.key] = true;
        else if (raw === false || raw === 'false' || raw === 'no') values[def.key] = false;
        else errors[def.key] = `${def.label} must be Yes or No.`;
        break;
      }
      case 'select':
      case 'radio': {
        const v = String(raw).trim();
        if (def.options && !def.options.includes(v)) { errors[def.key] = `Choose a valid option for ${def.label}.`; break; }
        values[def.key] = v;
        break;
      }
      case 'multiselect': {
        const list = (Array.isArray(raw) ? raw : String(raw).split(',')).map((v) => String(v).trim()).filter(Boolean);
        const invalid = def.options ? list.filter((v) => !def.options.includes(v)) : [];
        if (invalid.length) { errors[def.key] = `${def.label} has an invalid option: ${invalid[0]}.`; break; }
        if (!list.length) { if (def.required) errors[def.key] = `${def.label} is required.`; break; }
        values[def.key] = [...new Set(list)];
        break;
      }
      case 'date': {
        const v = String(raw).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) { errors[def.key] = `${def.label} must be a valid date.`; break; }
        values[def.key] = v;
        break;
      }
      default: {
        const v = String(raw).trim();
        const max = def.type === 'textarea' ? 2000 : 200;
        if (v.length > max) { errors[def.key] = `${def.label} must be at most ${max} characters.`; break; }
        values[def.key] = v;
      }
    }
  }
  return { values, errors };
}

/** Human-readable value with unit, e.g. "99.5 %", "Yes", "S, M, L". */
export function formatSpecificationValue(def, value) {
  if (isEmpty(value)) return null;
  if (def.type === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (def.unit && (def.type === 'number' || def.type === 'decimal')) return `${Number(value).toLocaleString('en-IN')} ${def.unit}`;
  return String(value);
}

/** Label -> display value map for the product's `specifications` (only filled values, in schema order). */
export function buildDisplaySpecifications(schema, values) {
  const out = {};
  if (schema.productType) out['Product Type'] = schema.productType;
  for (const def of schema.attributes) {
    const text = formatSpecificationValue(def, values[def.key]);
    if (text) out[def.label] = text;
  }
  return out;
}

export const attributeKey = (label) => slugify(label).replace(/-/g, '_');
