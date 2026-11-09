import { describe, expect, it } from 'vitest';
import { buildScene, paintOrder } from './scene3d';
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

describe('paintOrder', () => {
  // Camera as in the vertical view: left, door side, above.
  const c = [-0.3, -0.84, 0.8];
  const l = Math.hypot(...c);
  const toCamera = c.map((v) => v / l) as [number, number, number];
  const up = (() => {
    const v = [-toCamera[2] * toCamera[0], -toCamera[2] * toCamera[1], 1 - toCamera[2] * toCamera[2]];
    const m = Math.hypot(...v);
    return v.map((x) => x / m);
  })();
  const right = [up[1] * toCamera[2] - up[2] * toCamera[1], up[2] * toCamera[0] - up[0] * toCamera[2], up[0] * toCamera[1] - up[1] * toCamera[0]];
  const project = (p: [number, number, number]): [number, number] => [
    p[0] * right[0] + p[1] * right[1] + p[2] * right[2],
    -(p[0] * up[0] + p[1] * up[1] + p[2] * up[2]),
  ];

  it('paints a low pallet in front of a two-high bigbag stack after both bigbags', () => {
    const lower = { x0: 0, x1: 950, y0: 1200, y1: 2150, z0: 0, z1: 1150 };
    const upper = { x0: 0, x1: 950, y0: 1200, y1: 2150, z0: 1150, z1: 2300 };
    const pallet = { x0: 0, x1: 1000, y0: 0, y1: 1200, z0: 0, z1: 1400 };
    const order = paintOrder([pallet, upper, lower], toCamera, project);
    expect(order.indexOf(0)).toBeGreaterThan(order.indexOf(1));
    expect(order.indexOf(0)).toBeGreaterThan(order.indexOf(2));
    expect(order.indexOf(1)).toBeGreaterThan(order.indexOf(2));
  });
});

