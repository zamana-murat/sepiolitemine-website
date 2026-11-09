/**
 * Renders loading plan drawings (the configurator's ContainerView) to an HTML file for a visual
 * check without a running server.  npx tsx scripts/render-plan-preview.tsx <out.html>
 */
import { writeFileSync } from 'node:fs';
import { render } from 'preact-render-to-string';
import type { CatalogContainer, CatalogPackaging } from '../src/lib/quote/types';
import { computeLoad, type LoadItem } from '../src/lib/quote/loading';
import { ContainerView } from '../src/quote/ContainerView';

const C20: CatalogContainer = {
  id: 1, code: '20DV', nameEn: "20' Dry Van", nameTr: "20'lik", innerLengthMm: 5898, innerWidthMm: 2352, innerHeightMm: 2393,
  doorWidthMm: 2340, doorHeightMm: 2280, tareKg: 2230, maxPayloadKg: 28200, practicalPayloadKg: null, payloadLimitKg: 28200,
  sortOrder: 0, options: [],
};
const pack = (id: number, productId: number, l: number, w: number, h: number, type: 'bigbag' | 'pallet' = 'bigbag'): CatalogPackaging => ({
  id, productId, type, nameEn: '', nameTr: '', netWeightKg: 1000, grossWeightKg: 1005, lengthMm: l, widthMm: w, heightMm: h,
  maxTiers: 2, allowRotation: true, priceBasis: 'per_ton', priceCents: 0, sortOrder: 0,
});
const colours: Record<number, string> = { 1: '#8B3A2E', 2: '#9C7019', 3: '#2E7D6B' };
const cases: [string, LoadItem[]][] = [
  ['6 × foundry bentonite 90 cm + 10 × brown sepiolite 95 cm (screenshot case)', [
    { packaging: pack(1, 1, 900, 900, 1150), quantity: 6 },
    { packaging: pack(2, 2, 950, 950, 1150), quantity: 10 },
  ]],
  ['10 bigbags 90 cm + 4 Euro pallets', [
    { packaging: pack(1, 1, 900, 900, 1100), quantity: 10 },
    { packaging: pack(3, 3, 1200, 800, 1150, 'pallet'), quantity: 4 },
  ]],
  ['5 × 90 cm + 7 × 95 cm + 3 Euro pallets', [
    { packaging: pack(1, 1, 900, 900, 1100), quantity: 5 },
    { packaging: pack(2, 2, 950, 950, 1150), quantity: 7 },
    { packaging: pack(3, 3, 1200, 800, 1150, 'pallet'), quantity: 3 },
  ]],
];
const css = `body{font:14px Inter,system-ui,sans-serif;background:#f7f3ee;padding:16px;margin:0}
section{background:#fff;border-radius:10px;padding:12px 16px;margin:0 0 14px;width:620px}
h2{font-size:14px;margin:0 0 6px}.q-drawing{width:100%;height:auto}
.q-drawing__floor{fill:#f7f3ee;stroke:#7a6652;stroke-width:28}.q-drawing__overflow{fill:rgba(180,35,24,.12);stroke:#b42318;stroke-width:20}
.q-drawing__stack text{font-weight:700}.q-drawing__door{stroke:#c9922a;stroke-width:60}.q-drawing__label{fill:#7a6652}`;
const body = cases
  .map(([title, items], i) => {
    const load = computeLoad(C20, items);
    const svg = render(<ContainerView container={C20} items={items} colorOf={(p) => colours[p] ?? '#999'} index={i} locale="en" />);
    return `<section><h2>${title}</h2><div>floor ${load.floorLengthUsedMm} mm of ${C20.innerLengthMm} · ${load.fits ? 'fits' : 'does not fit'}</div>${svg}</section>`;
  })
  .join('');
writeFileSync(process.argv[2], `<!doctype html><meta charset="utf-8"><style>${css}</style>${body}`);
