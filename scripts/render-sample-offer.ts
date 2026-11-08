// Renders sample EN/TR soft offers from the LOCAL D1 demo catalog (scratchpad seed) for visual review.
// Run: npx tsx scripts/render-sample-offer.ts <out-dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/d1';
import { getPlatformProxy } from 'wrangler';
import * as schema from '../server/db/schema';
import { loadCatalog } from '../server/catalog';
import { join } from 'node:path';
import { computeQuote, type Catalog, type OrderRequest } from '../src/lib/quote';
import { BRAND } from '../src/config/brand';
import { renderOfferPdf } from '../server/pdf/offer-pdf';

const [outDir] = process.argv.slice(2);
const proxy = await getPlatformProxy<{ DB: Parameters<typeof drizzle>[0] }>();
const catalog: Catalog = await loadCatalog(drizzle(proxy.env.DB, { schema }));
await proxy.dispose();
const font = (f: string) => new Uint8Array(readFileSync(join('public/fonts/pdf', f)));
const assets = {
  regular: font('OfferSans-Regular.ttf'),
  semibold: font('OfferSans-SemiBold.ttf'),
  display: font('OfferDisplay-Bold.ttf'),
  logo: new Uint8Array(readFileSync('public/images/logo/logo-primary-400w.png')),
};

const [granule, powder] = catalog.products;
const bb = granule.packagings[0];
const euro = granule.packagings[1];
const std = powder.packagings[0];
const opt = (name: string, list = granule.options) => list.find((o) => o.nameEn === name)!.id;
const c20 = catalog.containers.find((c) => c.code === '20DV')!;
const c40hc = catalog.containers.find((c) => c.code === '40HC')!;
const request: OrderRequest = {
  containers: [
    { containerTypeId: c20.id, optionIds: [], lines: [{ packagingId: bb.id, quantity: 24, optionIds: [opt('1–2 mm'), opt('Dust-free screening')] }] },
    {
      containerTypeId: c40hc.id,
      optionIds: [c40hc.options.find((o) => o.nameEn === 'Fumigation')!.id, c40hc.options.find((o) => o.nameEn === 'Cargo insurance')!.id],
      lines: [
        { packagingId: euro.id, quantity: 12, optionIds: [opt('0.5–1 mm'), opt('Private label bags')] },
        { packagingId: std.id, quantity: 8, optionIds: [] },
      ],
    },
  ],
  optionIds: [catalog.orderOptions.find((o) => o.nameEn === 'Advance payment discount')!.id],
};
const result = computeQuote(catalog, request);
if (!result.ok) throw new Error(JSON.stringify(result.errors));

for (const locale of ['en', 'tr'] as const) {
  const issuedAt = new Date('2026-11-08T10:00:00Z');
  const bytes = await renderOfferPdf(
    {
      locale,
      number: 'SM-2026-0001',
      issuedAt,
      validUntil: new Date(issuedAt.getTime() + 30 * 86400000),
      customer: { name: 'Ayşe Yılmaz', company: 'Örnek Tarım İhracat Ltd. Şti.', email: 'buyer@example.com', country: 'Türkiye', phone: '+90 555 000 00 00' },
      seller: { name: BRAND.legalName, city: BRAND.address.city, country: BRAND.address.country, phone: BRAND.contact.phone, website: 'sepiolitemine.com' },
      terms: {
        incoterm: 'FOB', incotermPlace: 'Mersin Port, Türkiye',
        paymentTermsEn: '30% advance by T/T, 70% against copy of B/L.',
        paymentTermsTr: '%30 peşin (T/T), %70 konşimento kopyası karşılığı.',
        notesEn: 'Lead time 2 to 3 weeks after advance payment.', notesTr: 'Peşinattan sonra 2-3 hafta içinde yükleme. Şğüıöç ŞĞÜİÖÇ',
        validityDays: 30,
      },
      catalog,
      result,
    },
    assets,
  );
  writeFileSync(join(outDir, `offer-${locale}.pdf`), bytes);
  console.log(locale, bytes.length, 'bytes, total', result.totalCents);
}
