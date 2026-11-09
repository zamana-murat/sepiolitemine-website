/**
 * Renders one specific load as a large 3D view (debugging a drawing).
 *   npx tsx --tsconfig tsconfig.json scripts/render-case-preview.tsx <out.html>
 */
import { writeFileSync } from 'node:fs';
import { render } from 'preact-render-to-string';
import { computeLoad, planLoad, type LoadItem } from '../src/lib/quote/loading';
import type { CatalogContainer, CatalogPackaging } from '../src/lib/quote/types';
import { ContainerView } from '../src/quote/ContainerView';

const C40: CatalogContainer = {
  id: 2, code: '40DV', nameEn: "40' Dry Van", nameTr: "40'lık", innerLengthMm: 12032, innerWidthMm: 2352, innerHeightMm: 2393,
  doorWidthMm: 2340, doorHeightMm: 2280, tareKg: 3750, maxPayloadKg: 26700, practicalPayloadKg: null, payloadLimitKg: 26700,
  sortOrder: 0, options: [],
};
const pack = (id: number, productId: number, type: 'bigbag' | 'pallet', l: number, w: number, h: number, tiers: number): CatalogPackaging => ({
  id, productId, type, nameEn: '', nameTr: '', netWeightKg: 1000, grossWeightKg: 1005, lengthMm: l, widthMm: w, heightMm: h,
  maxTiers: tiers, allowRotation: true, priceBasis: 'per_ton', priceCents: 0, sortOrder: 0,
});
const items: LoadItem[] = [
  { packaging: pack(1, 1, 'bigbag', 900, 900, 1150, 2), quantity: 4 },
  { packaging: pack(2, 2, 'bigbag', 950, 950, 1150, 2), quantity: 12 },
  { packaging: pack(3, 3, 'pallet', 1200, 1000, 1400, 1), quantity: 10 },
];
const colours: Record<number, string> = { 1: '#8B3A2E', 2: '#9C7019', 3: '#7a6652' };
const load = computeLoad(C40, items);
const plan = planLoad(C40, items);
const rows = plan.placements
  .map((p) => `${p.packagingType} x=${p.x} y=${p.y} depth=${p.depth} across=${p.across} h=${p.height}`)
  .join('<br>');
const svg = render(<ContainerView container={C40} items={items} colorOf={(p) => colours[p]} index={0} locale="en" />);
writeFileSync(
  process.argv[2],
  `<!doctype html><meta charset="utf-8"><style>body{font:12px system-ui;margin:10px;display:flex;gap:20px}.q-drawing{height:1400px}.q-drawing__label{fill:#7a6652}</style><div>${svg}</div><div>floor ${load.floorLengthUsedMm}<br>${rows}</div>`,
);
