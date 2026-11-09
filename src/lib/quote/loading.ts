/**
 * Container loading estimate for bigbags and pallets.
 *
 * Model (deliberately simple and explainable — this backs a *soft* offer):
 *  - Units with identical footprint, height and tier limit form one stack group, even across
 *    products (two grades in the same 1 t bigbag can share a stack).
 *  - tiers = min(maxTiers, floor(innerHeight / unitHeight)).
 *  - A group's own layout is the shortest full-width segment that holds its stacks, using the best
 *    of two layout families:
 *      lanes: parallel lanes along the length, mixing both orientations across the width
 *             (e.g. 11 Euro pallets in a 20' = one 7-pallet lane + one 4-pallet lane);
 *      rows:  full-width rows of one orientation, then rows of the other in the remaining length.
 *  - Groups are loaded from the front wall towards the door, in item order (packFloor). Each group
 *    either continues behind everything loaded so far (its own segment) or, when that ends nearer
 *    the front wall, drops its stacks one by one into the free places left by earlier groups (the
 *    half-empty last row of a bigbag group, say). The shorter of the two is used, so mixing never
 *    needs more floor than loading the groups one after another.
 *  - Weight uses gross weight against the container's payload limit (practical limit if set).
 *  - A unit must pass the door: height ≤ door height, narrow side ≤ door width.
 */
import type { CatalogContainer, CatalogPackaging, LoadResult, QuoteIssue, StackGroup } from './types';

export interface LoadItem {
  packaging: CatalogPackaging;
  quantity: number;
}

interface Orientation {
  /** Extent along the container length. */
  depth: number;
  /** Extent across the container width. */
  across: number;
}

function orientations(p: Pick<CatalogPackaging, 'lengthMm' | 'widthMm' | 'allowRotation'>): [Orientation, Orientation | null] {
  const a: Orientation = { depth: p.lengthMm, across: p.widthMm };
  if (!p.allowRotation || p.lengthMm === p.widthMm) return [a, null];
  return [a, { depth: p.widthMm, across: p.lengthMm }];
}

type LayoutConfig =
  | { kind: 'lanes'; nA: number; nB: number }
  | { kind: 'rowsAB'; rows: number }
  | { kind: 'rowsBA'; rows: number };

/** Best layout of one footprint in a full-width floor segment of length L. */
function bestLayout(
  p: Pick<CatalogPackaging, 'lengthMm' | 'widthMm' | 'allowRotation'>,
  W: number,
  L: number,
): { count: number; config: LayoutConfig; a: Orientation; b: Orientation | null } {
  const [a, b] = orientations(p);
  let best = { count: 0, config: { kind: 'lanes', nA: 0, nB: 0 } as LayoutConfig };
  const consider = (count: number, config: LayoutConfig) => {
    if (count > best.count) best = { count, config };
  };

  // Lanes: nA lanes in orientation A, the remaining width filled with lanes in orientation B.
  for (let nA = 0; nA * a.across <= W; nA++) {
    const nB = b ? Math.floor((W - nA * a.across) / b.across) : 0;
    consider(nA * Math.floor(L / a.depth) + (b ? nB * Math.floor(L / b.depth) : 0), { kind: 'lanes', nA, nB });
  }

  // Rows: full-width rows in orientation A, then full-width rows in orientation B (and B first).
  const perRowA = Math.floor(W / a.across);
  const perRowB = b ? Math.floor(W / b.across) : 0;
  for (let rows = 0; rows * a.depth <= L; rows++) {
    const rest = L - rows * a.depth;
    consider(rows * perRowA + (b ? Math.floor(rest / b.depth) * perRowB : 0), { kind: 'rowsAB', rows });
  }
  if (b) {
    for (let rows = 0; rows * b.depth <= L; rows++) {
      const rest = L - rows * b.depth;
      consider(rows * perRowB + Math.floor(rest / a.depth) * perRowA, { kind: 'rowsBA', rows });
    }
  }
  return { ...best, a, b };
}

/** Max number of stacks of this footprint in a full-width floor segment of length `lengthMm`. */
export function stacksInLength(
  p: Pick<CatalogPackaging, 'lengthMm' | 'widthMm' | 'allowRotation'>,
  containerWidthMm: number,
  lengthMm: number,
): number {
  return bestLayout(p, containerWidthMm, lengthMm).count;
}

/** Floor rectangle: x along the container length (0 = front wall), y across the width. */
export interface FloorRect {
  x: number;
  y: number;
  depth: number;
  across: number;
}

/** Positions of the best layout in a segment of length L, ordered front to back. */
export function layoutRects(
  p: Pick<CatalogPackaging, 'lengthMm' | 'widthMm' | 'allowRotation'>,
  W: number,
  L: number,
): FloorRect[] {
  const { config, a, b } = bestLayout(p, W, L);
  const rects: FloorRect[] = [];
  const grid = (o: Orientation, x0: number, nx: number, y0: number, ny: number) => {
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++)
        rects.push({ x: x0 + i * o.depth, y: y0 + j * o.across, depth: o.depth, across: o.across });
  };
  if (config.kind === 'lanes') {
    grid(a, 0, Math.floor(L / a.depth), 0, config.nA);
    if (b) grid(b, 0, Math.floor(L / b.depth), config.nA * a.across, config.nB);
  } else if (config.kind === 'rowsAB') {
    grid(a, 0, config.rows, 0, Math.floor(W / a.across));
    if (b) {
      const x0 = config.rows * a.depth;
      grid(b, x0, Math.floor((L - x0) / b.depth), 0, Math.floor(W / b.across));
    }
  } else if (b) {
    grid(b, 0, config.rows, 0, Math.floor(W / b.across));
    const x0 = config.rows * b.depth;
    grid(a, x0, Math.floor((L - x0) / a.depth), 0, Math.floor(W / a.across));
  }
  return rects.sort((r, s) => r.x - s.x || r.y - s.y);
}

/** Shortest full-width segment (mm) holding `stacks` stacks, or null if the container is too short. */
export function floorLengthFor(
  p: Pick<CatalogPackaging, 'lengthMm' | 'widthMm' | 'allowRotation'>,
  containerWidthMm: number,
  containerLengthMm: number,
  stacks: number,
): number | null {
  if (stacks <= 0) return 0;
  if (stacksInLength(p, containerWidthMm, containerLengthMm) < stacks) return null;
  let lo = 0;
  let hi = containerLengthMm; // invariant: stacksInLength(hi) >= stacks
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (stacksInLength(p, containerWidthMm, mid) >= stacks) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function effectiveTiers(p: Pick<CatalogPackaging, 'heightMm' | 'maxTiers'>, innerHeightMm: number): number {
  return Math.max(0, Math.min(p.maxTiers, Math.floor(innerHeightMm / p.heightMm)));
}

const groupKey = (p: CatalogPackaging, tiers: number) =>
  `${p.type}|${p.lengthMm}x${p.widthMm}x${p.heightMm}|t${tiers}|${p.allowRotation ? 'r' : 'f'}`;

/**
 * Per-unit problems that make a packaging impossible in this container (independent of quantity).
 * `path` is attached by the caller.
 */
export function unitIssues(c: CatalogContainer, p: CatalogPackaging): Omit<QuoteIssue, 'path'>[] {
  const issues: Omit<QuoteIssue, 'path'>[] = [];
  if (p.heightMm > c.innerHeightMm) {
    issues.push({ code: 'unit_too_tall', params: { heightMm: p.heightMm, innerHeightMm: c.innerHeightMm } });
  }
  const narrow = p.allowRotation ? Math.min(p.lengthMm, p.widthMm) : p.widthMm;
  if (p.heightMm > c.doorHeightMm || narrow > c.doorWidthMm) {
    issues.push({ code: 'unit_door', params: { doorWidthMm: c.doorWidthMm, doorHeightMm: c.doorHeightMm } });
  }
  if (stacksInLength(p, c.innerWidthMm, c.innerLengthMm) === 0) {
    issues.push({ code: 'unit_too_large', params: { lengthMm: p.lengthMm, widthMm: p.widthMm } });
  }
  return issues;
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

/* ───────────── Floor packing (shared by computeLoad and planLoad) ───────────── */

interface PackGroup {
  packaging: CatalogPackaging;
  stacks: number;
}

/** Distance from the front wall reached by `placed` within the width band [y0, y1). */
function skyline(placed: FloorRect[], y0: number, y1: number): number {
  let x = 0;
  for (const r of placed) if (r.y < y1 && r.y + r.across > y0) x = Math.max(x, r.x + r.depth);
  return x;
}

const frontier = (rects: FloorRect[]) => rects.reduce((m, r) => Math.max(m, r.x + r.depth), 0);

/**
 * Positions of every group's stacks, front wall first. Per group the shorter of:
 *   appended: the group's own segment layout behind everything placed so far;
 *   dropped:  stack by stack into the place that ends nearest the front wall, using the group's
 *             orientations aligned to either side wall (keeps lanes tidy, fills partial rows).
 * A group whose footprint does not fit the width gets no positions.
 */
function packFloor(c: CatalogContainer, groups: PackGroup[]): FloorRect[][] {
  const W = c.innerWidthMm;
  const placed: FloorRect[] = [];
  return groups.map(({ packaging: p, stacks }) => {
    if (stacks <= 0) return [];
    // Laid out past the door when needed, so overloads stay visible (and measurable) beyond it.
    const reach = Math.max(c.innerLengthMm, stacks * Math.max(p.lengthMm, p.widthMm));
    const segment = floorLengthFor(p, W, reach, stacks);
    if (segment === null) return [];
    const pattern = layoutRects(p, W, segment).slice(0, stacks);

    const base = frontier(placed);
    const appended = pattern.map((r) => ({ ...r, x: r.x + base }));

    const shapes = new Map<string, { depth: number; across: number }>();
    for (const r of pattern) shapes.set(`${r.depth}x${r.across}`, { depth: r.depth, across: r.across });
    const spots: { y: number; depth: number; across: number }[] = [];
    for (const o of shapes.values()) {
      const lanes = Math.floor(W / o.across);
      const ys = new Set<number>();
      for (let k = 0; k < lanes; k++) {
        ys.add(k * o.across);
        ys.add(W - (k + 1) * o.across);
      }
      for (const y of ys) spots.push({ y, ...o });
    }
    const work = [...placed];
    const dropped: FloorRect[] = [];
    for (let i = 0; i < stacks; i++) {
      let best: FloorRect | null = null;
      for (const sp of spots) {
        const x = skyline(work, sp.y, sp.y + sp.across);
        const end = x + sp.depth;
        const bestEnd = best ? best.x + best.depth : Infinity;
        if (end < bestEnd || (end === bestEnd && best && (x < best.x || (x === best.x && sp.y < best.y)))) {
          best = { x, y: sp.y, depth: sp.depth, across: sp.across };
        }
      }
      work.push(best!);
      dropped.push(best!);
    }

    // Equal length: behind other goods prefer filling the gaps (front to back, no holes); on an empty
    // floor keep the group's own proven layout.
    const fd = frontier(dropped);
    const fa = frontier(appended);
    const chosen = fd < fa || (fd === fa && placed.length > 0) ? dropped : appended;
    placed.push(...chosen);
    return chosen;
  });
}

export function computeLoad(c: CatalogContainer, items: LoadItem[]): LoadResult {
  let netKg = 0;
  let grossKg = 0;
  let unitVolume = 0;
  const groups = new Map<string, { packaging: CatalogPackaging; tiers: number; units: number }>();

  for (const { packaging: p, quantity } of items) {
    if (quantity <= 0) continue;
    netKg += quantity * p.netWeightKg;
    grossKg += quantity * p.grossWeightKg;
    unitVolume += quantity * p.lengthMm * p.widthMm * p.heightMm;
    const tiers = effectiveTiers(p, c.innerHeightMm);
    const key = groupKey(p, tiers);
    const g = groups.get(key);
    if (g) g.units += quantity;
    else groups.set(key, { packaging: p, tiers, units: quantity });
  }

  let floorFeasible = true;
  const stackGroups: StackGroup[] = [];
  const toPack: PackGroup[] = [];
  for (const [key, g] of groups) {
    const p = g.packaging;
    const stacks = g.tiers > 0 ? Math.ceil(g.units / g.tiers) : 0;
    const reach = Math.max(c.innerLengthMm, stacks * Math.max(p.lengthMm, p.widthMm));
    // The group's own segment length (informational; the floor total comes from packFloor).
    const len = g.tiers > 0 ? floorLengthFor(p, c.innerWidthMm, reach, stacks) : null;
    if (len === null) floorFeasible = false;
    toPack.push({ packaging: p, stacks: len === null ? 0 : stacks });
    stackGroups.push({
      key,
      packagingType: p.type,
      lengthMm: p.lengthMm,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      tiers: g.tiers,
      units: g.units,
      stacks,
      floorLengthMm: len,
    });
  }
  const floorLengthUsedMm = frontier(packFloor(c, toPack).flat());

  const fitsWeight = grossKg <= c.payloadLimitKg + 1e-9;
  const fitsFloor = floorFeasible && floorLengthUsedMm <= c.innerLengthMm;
  return {
    netKg,
    grossKg,
    payloadLimitKg: c.payloadLimitKg,
    weightUtilization: ratio(grossKg, c.payloadLimitKg),
    floorLengthUsedMm,
    floorUtilization: ratio(floorLengthUsedMm, c.innerLengthMm),
    volumeUtilization: ratio(unitVolume, c.innerLengthMm * c.innerWidthMm * c.innerHeightMm),
    groups: stackGroups,
    fitsWeight,
    fitsFloor,
    fits: fitsWeight && fitsFloor,
  };
}

/**
 * How many more units of `packaging` fit on top of `items` (weight, floor and height together).
 * Used by the configurator's "fill container" action. Returns 0 if the unit cannot be loaded.
 */
export function maxAdditionalUnits(c: CatalogContainer, items: LoadItem[], packaging: CatalogPackaging): number {
  if (unitIssues(c, packaging).length > 0) return 0;
  const current = computeLoad(c, items);
  if (!current.fits) return 0;

  const byWeight = packaging.grossWeightKg > 0
    ? Math.floor((c.payloadLimitKg - current.grossKg) / packaging.grossWeightKg + 1e-9)
    : Number.MAX_SAFE_INTEGER;
  const byFloor = effectiveTiers(packaging, c.innerHeightMm) * stacksInLength(packaging, c.innerWidthMm, c.innerLengthMm);
  let lo = 0;
  let hi = Math.max(0, Math.min(byWeight, byFloor));
  const fitsWith = (n: number) => computeLoad(c, [...items, { packaging, quantity: n }]).fits;
  // Feasibility is monotonic in n → binary search the largest n that still fits.
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fitsWith(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/* ───────────── Load plan (positions for the configurator drawing) ───────────── */

export interface StackPlacement extends FloorRect {
  groupKey: string;
  packagingType: CatalogPackaging['type'];
  /** Units in this stack, bottom first. */
  units: { packagingId: number; productId: number; count: number }[];
  /** Units stacked here (≤ tiers). */
  height: number;
  /** Lies beyond the container's inner length (the load does not fit). */
  overflow: boolean;
}

export interface LoadPlan {
  placements: StackPlacement[];
  usedLengthMm: number;
  /** Stacks that cannot be placed at all (footprint wider than the container). */
  unplacedStacks: number;
}

/**
 * Same model as computeLoad (packFloor), with positions: stacks are filled front to back in item
 * order. Drawing and capacity always agree.
 */
export function planLoad(c: CatalogContainer, items: LoadItem[]): LoadPlan {
  const groups = new Map<string, { packaging: CatalogPackaging; tiers: number; items: LoadItem[] }>();
  for (const item of items) {
    if (item.quantity <= 0) continue;
    const tiers = effectiveTiers(item.packaging, c.innerHeightMm);
    const key = groupKey(item.packaging, tiers);
    const g = groups.get(key);
    if (g) g.items.push(item);
    else groups.set(key, { packaging: item.packaging, tiers, items: [item] });
  }

  const list = [...groups].map(([key, g]) => {
    const total = g.items.reduce((s, i) => s + i.quantity, 0);
    return { key, ...g, total, stacks: g.tiers > 0 ? Math.ceil(total / g.tiers) : 0 };
  });
  const packed = packFloor(c, list.map((g) => ({ packaging: g.packaging, stacks: g.stacks })));

  const placements: StackPlacement[] = [];
  let unplacedStacks = 0;
  list.forEach((g, gi) => {
    if (g.tiers === 0) {
      unplacedStacks += g.total;
      return;
    }
    const rects = packed[gi];
    unplacedStacks += g.stacks - rects.length;
    const slots: StackPlacement[] = rects.map((r) => ({
      ...r,
      groupKey: g.key,
      packagingType: g.packaging.type,
      units: [],
      height: 0,
      overflow: r.x + r.depth > c.innerLengthMm,
    }));
    let si = 0;
    for (const item of g.items) {
      let left = item.quantity;
      while (left > 0 && si < slots.length) {
        const slot = slots[si];
        const take = Math.min(left, g.tiers - slot.height);
        const last = slot.units[slot.units.length - 1];
        if (last && last.packagingId === item.packaging.id) last.count += take;
        else slot.units.push({ packagingId: item.packaging.id, productId: item.packaging.productId, count: take });
        slot.height += take;
        left -= take;
        if (slot.height === g.tiers) si++;
      }
    }
    placements.push(...slots);
  });
  return { placements, usedLengthMm: frontier(placements), unplacedStacks };
}
