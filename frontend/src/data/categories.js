// Seed categories. Admins can add, rename and remove categories;
// changes are saved in this browser only.
//
// `photo` is an Unsplash photo ID where a suitable free-licence photo is known;
// `illustration` is a local SVG in public/images that is always available as a fallback.

const categories = [
  { slug: 'electronics', name: 'Electronics', description: 'Audio, wearables, mobile accessories and smart devices from OEM and ODM factories.', subcategories: ['Audio', 'Wearables', 'Mobile Accessories', 'Computer Peripherals'], photo: 'photo-1498049794561-7780e7231661', illustration: 'category-electronics' },
  { slug: 'fashion-apparel', name: 'Fashion & Apparel', description: 'Garments, knitwear, denim, bags and accessories for private-label and wholesale buyers.', subcategories: ['T-Shirts', 'Hoodies', 'Outerwear', 'Knitwear', 'Shirts', 'Denim', 'Bags & Accessories'], photo: 'photo-1567401893414-76b7b1e5a7a5', illustration: 'category-fashion-apparel' },
  { slug: 'home-kitchen', name: 'Home & Kitchen', description: 'Tableware, décor, bedding and home fragrance for retailers and hospitality.', subcategories: ['Home Decor', 'Tableware', 'Bedding', 'Home Fragrance'], photo: 'photo-1600210492493-0946911123ea', illustration: 'category-home-kitchen' },
  { slug: 'machinery', name: 'Machinery', description: 'Power tools, CNC equipment and workshop machinery for production lines.', subcategories: ['Power Tools', 'CNC & Machine Tools', 'Workshop Equipment'], photo: 'photo-1566930665082-4ae9dbbb5b6b', illustration: 'category-machinery' },
  { slug: 'beauty-personal-care', name: 'Beauty & Personal Care', description: 'Skincare, makeup, sun care and tools, available for private label.', subcategories: ['Skincare', 'Makeup', 'Sun Care', 'Tools'], photo: 'photo-1522335789203-aabd1fc54bc9', illustration: 'category-beauty-personal-care' },
  { slug: 'packaging', name: 'Packaging', description: 'Paper, glass, cosmetic and corrugated packaging in custom sizes and prints.', subcategories: ['Paper Packaging', 'Glass Packaging', 'Cosmetic Packaging', 'Corrugated Boxes'], photo: 'photo-1534452203293-494d7ddbf7e0', illustration: 'category-packaging' },
  { slug: 'furniture', name: 'Furniture', description: 'Living room, office and lighting pieces for projects and retail.', subcategories: ['Living Room', 'Office', 'Lighting'], photo: 'photo-1628744876497-eb30460be9f6', illustration: 'category-furniture' },
  { slug: 'automotive', name: 'Automotive', description: 'Garage equipment and interior accessories for workshops and distributors.', subcategories: ['Garage Equipment', 'Interior Accessories'], photo: 'photo-1580273916550-e323be2ae537', illustration: 'category-automotive' },
  { slug: 'sports-outdoors', name: 'Sports & Outdoors', description: 'Performance footwear and outdoor gear for brands and clubs.', subcategories: ['Footwear', 'Outdoor Gear'], photo: 'photo-1575987116913-e96e7d490b8a', illustration: 'category-sports-outdoors' },
  { slug: 'toys-games', name: 'Toys & Games', description: 'Wooden toys and gaming accessories for retailers and gift suppliers.', subcategories: ['Wooden Toys', 'Gaming Accessories'], photo: 'photo-1618397360795-952a13220a66', illustration: 'category-toys-games' },
  { slug: 'agriculture', name: 'Agriculture', description: 'Farm equipment and gardening supplies for growers and co-operatives.', subcategories: ['Farm Equipment', 'Gardening'], photo: 'photo-1527847263472-aa5338d178b8', illustration: 'category-agriculture' },
  { slug: 'industrial-supplies', name: 'Industrial Supplies', description: 'Safety equipment and hand tools for sites, plants and maintenance teams.', subcategories: ['Safety & PPE', 'Hand Tools'], photo: 'photo-1581092921461-eab62e97a780', illustration: 'category-industrial-supplies' },
].map((category, index) => ({ id: `TS-CAT-${String(index + 1).padStart(2, '0')}`, ...category }));

export default categories;
