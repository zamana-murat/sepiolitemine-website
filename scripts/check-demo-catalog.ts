/**
 * Sanity check for a seeded catalog: every packaging is filled into every container type with the
 * default options and must give a valid quote. Run against a local D1 copy:
 *   npx tsx scripts/check-demo-catalog.ts <persistDir>
 */
import { drizzle } from 'drizzle-orm/d1';
import { getPlatformProxy } from 'wrangler';
import { loadCatalog } from '../server/catalog';
import * as schema from '../server/db/schema';
import { maxAdditionalUnits } from '../src/lib/quote/loading';
import { computeQuote } from '../src/lib/quote/pricing';
import { defaultOptionIds } from '../src/quote/state';

const persist = process.argv[2];
const proxy = await getPlatformProxy<{ DB: Parameters<typeof drizzle>[0] }>({ persist: { path: persist } });
const catalog = { ...(await loadCatalog(drizzle(proxy.env.DB, { schema }))), turnstileSiteKey: null };
let bad = 0;
const fmt = (c: number) => (c / 100).toFixed(2);
for (const p of catalog.products) {
  for (const k of p.packagings) {
    const row: string[] = [];
    for (const c of catalog.containers) {
      const qty = maxAdditionalUnits(c, [], k);
      const r = computeQuote(catalog, {
        containers: [{ containerTypeId: c.id, count: 1, optionIds: defaultOptionIds(c.options), lines: [{ packagingId: k.id, quantity: qty, optionIds: defaultOptionIds(p.options) }] }],
        optionIds: defaultOptionIds(catalog.orderOptions),
        deliveryTermId: catalog.deliveryTerms[0]?.id ?? null,
      });
      if (!r.ok || qty === 0) bad++;
      row.push(`${c.code} ${qty}u ${(r.totals.netKg / 1000).toFixed(1)}t $${fmt(r.totalCents)}${r.ok ? '' : ' ERR ' + r.errors.map((e) => e.code).join(',')}`);
    }
    console.log(`${p.slug.padEnd(26)} ${k.nameEn.padEnd(28)} ${row.join(' | ')}`);
  }
}
console.log(`terms: ${catalog.deliveryTerms.map((d) => `${d.incoterm} ${d.placeEn} ${d.amount}`).join(' / ')}`);
console.log(`docs: ${catalog.products.reduce((a, p) => a + p.documents.length, 0)} · ${bad ? `${bad} PROBLEMS` : 'all quotes valid'}`);
await proxy.dispose();
