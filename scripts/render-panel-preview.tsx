/**
 * Static render of one container tab (ContainerPanel) with the site CSS, for checking the layout
 * without a running server.  npx tsx --tsconfig tsconfig.json scripts/render-panel-preview.tsx <out.html>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { render } from 'preact-render-to-string';
import { computeQuote } from '../src/lib/quote/pricing';
import type { Catalog, CatalogPackaging, CatalogProduct } from '../src/lib/quote/types';
import { productColors } from '../src/quote/colors';
import { ContainerPanel } from '../src/quote/ContainerCard';
import { formatters } from '../src/quote/i18n';
import { packagingIndex, toRequest, type Draft } from '../src/quote/state';

const pk = (id: number, productId: number, type: 'bigbag' | 'pallet', l: number, w: number, h: number, nameEn: string): CatalogPackaging => ({
  id, productId, type, nameEn, nameTr: nameEn, netWeightKg: type === 'bigbag' ? 1000 : 1250, grossWeightKg: type === 'bigbag' ? 1005 : 1275,
  lengthMm: l, widthMm: w, heightMm: h, maxTiers: 2, allowRotation: true, priceBasis: 'per_ton', priceCents: 12000, sortOrder: 0,
});
const product = (id: number, name: string, packagings: CatalogPackaging[]): CatalogProduct => ({
  id, slug: `p${id}`, nameEn: name, nameTr: name, descriptionEn: '', descriptionTr: '', hsCode: null, specs: [], sortOrder: id,
  packagings, options: [], documents: [],
});
const catalog: Catalog = {
  currency: 'USD',
  quoteValidityDays: 30,
  products: [
    product(1, 'Foundry Bentonite', [pk(11, 1, 'bigbag', 900, 900, 1150, '1000 kg Big Bag')]),
    product(2, 'Brown Sepiolite Powder', [pk(21, 2, 'bigbag', 950, 950, 1150, '600 kg Big Bag')]),
    product(3, 'Micronised Calcite', [pk(31, 3, 'pallet', 1200, 1000, 1100, 'Pallet, 50 × 25 kg bags')]),
  ],
  containers: [
    {
      id: 1, code: '20DV', nameEn: "20' Dry Van", nameTr: "20'lik Standart", innerLengthMm: 5898, innerWidthMm: 2352, innerHeightMm: 2393,
      doorWidthMm: 2340, doorHeightMm: 2280, tareKg: 2230, maxPayloadKg: 28200, practicalPayloadKg: null, payloadLimitKg: 28200,
      sortOrder: 0, options: [],
    },
  ],
  orderOptions: [],
  deliveryTerms: [],
};
const draft: Draft = {
  v: 1,
  activeUid: 'a',
  optionIds: [],
  deliveryTermId: null,
  containers: [
    {
      uid: 'a', containerTypeId: 1, count: 1, optionIds: [],
      lines: [
        { uid: 'l1', packagingId: 11, quantity: 6, optionIds: [] },
        { uid: 'l2', packagingId: 21, quantity: 10, optionIds: [] },
        { uid: 'l3', packagingId: 31, quantity: 4, optionIds: [] },
      ],
    },
  ],
};
const result = computeQuote(catalog, toRequest(draft));
const fmt = formatters('en', 'USD');
const noop = () => {};
const html = render(
  <ContainerPanel
    index={0} draft={draft.containers[0]} result={result.containers[0]} catalog={catalog} packs={packagingIndex(catalog)}
    errors={result.errors} warnings={result.warnings} onChange={noop} onRemove={noop} onDuplicate={noop} onAddProduct={noop}
    onDetails={noop} canRemove={false} canDuplicate maxCount={50} colorOf={productColors(catalog)} fmt={fmt} locale="en"
  />,
);
const css = readFileSync('src/styles/global.css', 'utf8') + readFileSync('src/quote/quote.css', 'utf8');
writeFileSync(
  process.argv[2],
  `<!doctype html><meta charset="utf-8"><style>${css}</style><main class="q-main"><div class="container"><div class="q-panel q-containers">${html}</div></div></main>`,
);
