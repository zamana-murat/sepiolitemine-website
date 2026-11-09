import { describe, expect, it } from 'vitest';
import { buildScene } from './scene3d';
import type { CatalogContainer, CatalogPackaging } from './types';

const C20: CatalogContainer = {
  id: 1, code: '20DV', nameEn: '', nameTr: '', innerLengthMm: 5898, innerWidthMm: 2352, innerHeightMm: 2393,
  doorWidthMm: 2340, doorHeightMm: 2280, tareKg: 2230, maxPayloadKg: 28200, practicalPayloadKg: null, payloadLimitKg: 28200,
  sortOrder: 0, options: [],
};
const pack = (id: number, type: 'bigbag' | 'pallet', l: number, w: number, h: number): CatalogPackaging => ({
  id, productId: id, type, nameEn: '', nameTr: '', netWeightKg: 1000, grossWeightKg: 1005, lengthMm: l, widthMm: w,
  heightMm: h, maxTiers: 2, allowRotation: true, priceBasis: 'per_ton', priceCents: 0, sortOrder: 0,
});
const colour = () => '#2e7d6b';

describe('buildScene', () => {
  const items = [
    { packaging: pack(1, 'bigbag', 900, 900, 1100), quantity: 6 },
    { packaging: pack(2, 'pallet', 1200, 800, 1150), quantity: 4 },
  ];

  it.each(['vertical', 'horizontal'] as const)('%s: finite geometry inside the drawing, no overflow', (o) => {
    const s = buildScene(C20, items, colour, o);
    expect(s.overflow).toBe(false);
    expect(s.paths.length).toBeGreaterThan(30);
    for (const p of s.paths) {
      const nums = p.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      expect(nums.every(Number.isFinite)).toBe(true);
      for (let i = 0; i + 1 < nums.length; i += 2) {
        expect(nums[i]).toBeGreaterThanOrEqual(0);
        expect(nums[i]).toBeLessThanOrEqual(s.width);
        expect(nums[i + 1]).toBeGreaterThanOrEqual(0);
        expect(nums[i + 1]).toBeLessThanOrEqual(s.height);
      }
    }
  });

  it('runs up the screen when vertical and across when horizontal', () => {
    const v = buildScene(C20, items, colour, 'vertical');
    const h = buildScene(C20, items, colour, 'horizontal');
    expect(v.height).toBeGreaterThan(v.width);
    expect(h.width).toBeGreaterThan(h.height);
    // Door label below the drawing (vertical) / right of it (horizontal).
    expect(v.door.y).toBeGreaterThan(v.height * 0.8);
    expect(h.door.x).toBeGreaterThan(h.width * 0.8);
  });

  it('draws see-through roof, left wall and door, and flags loads beyond the door', () => {
    const s = buildScene(C20, [{ packaging: pack(1, 'bigbag', 900, 900, 1100), quantity: 30 }], colour);
    expect(s.paths.filter((p) => p.fillOpacity !== undefined && p.fillOpacity < 0.2).length).toBeGreaterThanOrEqual(3);
    expect(s.overflow).toBe(true);
  });
});
