/**
 * Adds / updates the 60-category B2B taxonomy (src/data/categoryTaxonomy.js) in the categories table.
 *
 *   node scripts/seedCategoryTaxonomy.js            dry run (default): reads only, prints what would change
 *   node scripts/seedCategoryTaxonomy.js --apply    writes the changes
 *
 * Safe and repeatable:
 *  - upsert by slug; running it again changes nothing that is already up to date
 *  - never deletes a category and never touches products
 *  - existing categories keep their slug (so every product keeps its category) and their photo
 *  - `subcategories` stays a list of names (what the app already reads); the structured data (subcategory
 *    slugs, order, product types, legacy flags, group, display order, active and regulated flags) is stored
 *    under `attributes.taxonomy`, so no schema change is needed
 *  - categories in the database that are not in the taxonomy are reported, not changed
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { CATEGORY_TAXONOMY } from '../src/data/categoryTaxonomy.js';

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function main() {
  const existing = await prisma.category.findMany();
  const bySlug = new Map(existing.map((c) => [c.slug, c]));
  const plan = { create: [], update: [], unchanged: [] };

  for (const cat of CATEGORY_TAXONOMY) {
    const subcategoryNames = cat.subcategories.map((s) => s.name);
    const taxonomy = {
      group: cat.group,
      groupSlug: cat.groupSlug,
      displayOrder: cat.displayOrder,
      isActive: cat.isActive,
      regulated: cat.regulated,
      subcategories: cat.subcategories,
    };
    const current = bySlug.get(cat.slug);
    if (!current) {
      plan.create.push({ slug: cat.slug, data: { slug: cat.slug, name: cat.name, description: cat.description, subcategories: subcategoryNames, attributes: { taxonomy } } });
      continue;
    }
    const attributes = { ...(current.attributes && typeof current.attributes === 'object' ? current.attributes : {}), taxonomy };
    const data = { name: cat.name, description: cat.description, subcategories: subcategoryNames, attributes };
    const changed = current.name !== data.name || current.description !== data.description
      || !sameJson(current.subcategories, data.subcategories) || !sameJson(current.attributes, data.attributes);
    if (changed) plan.update.push({ slug: cat.slug, from: current.name, to: cat.name, data });
    else plan.unchanged.push(cat.slug);
  }

  const taxonomySlugs = new Set(CATEGORY_TAXONOMY.map((c) => c.slug));
  const notInTaxonomy = existing.filter((c) => !taxonomySlugs.has(c.slug));
  const productCounts = await prisma.product.groupBy({ by: ['categorySlug'], _count: { _all: true } });
  const countOf = (slug) => productCounts.find((p) => p.categorySlug === slug)?._count._all || 0;

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN (nothing written)'}: ${CATEGORY_TAXONOMY.length} taxonomy categories vs ${existing.length} in the database`);
  console.log(`  create: ${plan.create.length}`);
  console.log(`  update: ${plan.update.length}${plan.update.length ? ` -> ${plan.update.map((u) => (u.from === u.to ? u.slug : `${u.slug} ("${u.from}" -> "${u.to}")`)).join(', ')}` : ''}`);
  console.log(`  unchanged: ${plan.unchanged.length}`);
  console.log(`  in database but not in taxonomy (left untouched): ${notInTaxonomy.length ? notInTaxonomy.map((c) => `"${c.name}" (${countOf(c.slug)} products)`).join(', ') : 'none'}`);

  if (!APPLY) return;
  await prisma.$transaction([
    ...plan.create.map((c) => prisma.category.create({ data: c.data })),
    ...plan.update.map((u) => prisma.category.update({ where: { slug: u.slug }, data: u.data })),
  ]);
  const after = await prisma.category.count();
  console.log(`Done. Categories in database: ${after}. Products were not modified.`);
}

main()
  .catch((error) => { console.error('Category taxonomy seed failed:', error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
