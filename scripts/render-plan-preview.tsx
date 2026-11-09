/**
 * Renders the 3D loading views to an HTML file for a visual check without a running server:
 * the configurator's ContainerView (vertical) and the PDF orientation (horizontal).
 *   npx tsx --tsconfig tsconfig.json scripts/render-plan-preview.tsx <out.html>
 */
import { writeFileSync } from 'node:fs';
import { render } from 'preact-render-to-string';
import { computeLoad, type LoadItem } from '../src/lib/quote/loading';
import { buildScene } from '../src/lib/quote/scene3d';
import type { CatalogContainer, CatalogPackaging } from '../src/lib/quote/types';
import { ContainerView } from '../src/quote/ContainerView';

const C20: CatalogContainer = {
  id: 1, code: '20DV', nameEn: "20' Dry Van", nameTr: "20'lik", innerLengthMm: 5898, innerWidthMm: 2352, innerHeightMm: 2393,
  doorWidthMm: 2340, doorHeightMm: 2280, tareKg: 2230, maxPayloadKg: 28200, practicalPayloadKg: null, payloadLimitKg: 28200,
  sortOrder: 0, options: [],
};
const C40HC: CatalogContainer = { ...C20, id: 3, code: '40HC', innerLengthMm: 12032, innerHeightMm: 2698, doorHeightMm: 2585 };
const pack = (id: number, productId: number, l: number, w: number, h: number, type: 'bigbag' | 'pallet' = 'bigbag'): CatalogPackaging => ({
  id, productId, type, nameEn: '', nameTr: '', netWeightKg: 1000, grossWeightKg: 1005, lengthMm: l, widthMm: w, heightMm: h,
  maxTiers: 2, allowRotation: true, priceBasis: 'per_ton', priceCents: 0, sortOrder: 0,
});
const colours: Record<number, string> = { 1: '#8B3A2E', 2: '#9C7019', 3: '#2E7D6B' };
const colorOf = (p: number) => colours[p] ?? '#999';
const cases: [string, CatalogContainer, LoadItem[]][] = [
  ['20DV · 6 × 90 cm + 10 × 95 cm bigbags', C20, [
    { packaging: pack(1, 1, 900, 900, 1150), quantity: 6 },
    { packaging: pack(2, 2, 950, 950, 1150), quantity: 10 },
  ]],
  ['20DV · 10 bigbags + 4 Euro pallets', C20, [
    { packaging: pack(1, 1, 900, 900, 1100), quantity: 10 },
    { packaging: pack(3, 3, 1200, 800, 1150, 'pallet'), quantity: 4 },
  ]],
  ['40HC · 12 bigbags + 14 pallets', C40HC, [
    { packaging: pack(2, 2, 950, 950, 1150), quantity: 12 },
    { packaging: pack(3, 3, 1200, 1000, 1300, 'pallet'), quantity: 14 },
  ]],
  ['20DV · overloaded (30 bigbags)', C20, [{ packaging: pack(1, 1, 900, 900, 1100), quantity: 30 }]],
];
const css = `body{font:14px Inter,system-ui,sans-serif;background:#f7f3ee;padding:16px;margin:0}
section{background:#fff;border-radius:10px;padding:12px 16px;margin:0 14px 14px 0;width:330px;display:inline-block;vertical-align:top}
section.wide{width:700px}h2{font-size:12px;margin:0 0 6px}.q-drawing{width:100%;height:auto;max-height:640px}
.q-drawing__label{font-size:260px;fill:#7a6652;font-weight:600}`;
const vertical = cases
  .map(([title, c, items], i) => {
    const load = computeLoad(c, items);
    const svg = render(<ContainerView container={c} items={items} colorOf={colorOf} index={i} locale="en" />);
    return `<section><h2>${title}</h2><div>floor ${load.floorLengthUsedMm} of ${c.innerLengthMm} mm · ${load.fits ? 'fits' : 'does not fit'}</div>${svg}</section>`;
  })
  .join('');
const horizontal = cases
  .slice(0, 3)
  .map(([title, c, items]) => {
    const s = buildScene(c, items, colorOf, 'horizontal');
    const paths = s.paths
      .map((p) => `<path d="${p.d}" fill="${p.fill ?? 'none'}" fill-opacity="${p.fillOpacity ?? 1}" stroke="${p.stroke ?? 'none'}" stroke-width="${p.strokeWidth ?? 0}" stroke-opacity="${p.strokeOpacity ?? 1}" stroke-linejoin="round" stroke-linecap="round"/>`)
      .join('');
    return `<section class="wide"><h2>PDF (horizontal) · ${title}</h2><svg viewBox="0 0 ${Math.round(s.width)} ${Math.round(s.height)}" style="width:100%">${paths}<text x="${s.door.x}" y="${s.door.y}" class="q-drawing__label" dominant-baseline="middle">Door</text></svg></section>`;
  })
  .join('');
writeFileSync(process.argv[2], `<!doctype html><meta charset="utf-8"><style>${css}</style>${vertical}<br>${horizontal}`);
