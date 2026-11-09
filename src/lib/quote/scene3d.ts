/**
 * 3D loading view (orthographic) — pure geometry, rendered as SVG in the configurator and as
 * vector paths in the offer PDF, so both always show the same picture.
 *
 * World: x across the container (0 = left wall), y along it (0 = door, L = front wall), z up.
 * Camera: above, in front of the door and to the left, so the door face, the left side and the
 * roof face the viewer. Those three faces are drawn transparent; the floor, the right wall and the
 * front wall are the solid back of the picture. Positions come from planLoad(), the same model as
 * the capacity check.
 */
import { planLoad, type LoadItem } from './loading';
import type { CatalogContainer, CatalogPackaging } from './types';

export interface ScenePath {
  d: string;
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
}

export interface Scene {
  /** Drawing size in scene units (≈ mm); paths are already translated into [0, width] × [0, height]. */
  width: number;
  height: number;
  paths: ScenePath[];
  /** Anchor just outside the door face, for the "Door" label. */
  door: { x: number; y: number };
  /** Some stacks stand beyond the door (the load does not fit). */
  overflow: boolean;
}

export type SceneOrientation = 'vertical' | 'horizontal';

type V3 = [number, number, number];
type P2 = [number, number];

/* ───────────── Camera ───────────── */

const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

interface Camera {
  /** Unit vector from the scene towards the camera. */
  toCamera: V3;
  project: (p: V3) => P2;
}

/**
 * Orthographic camera above, in front of the door and to the left; screen up = world up (z).
 * vertical:   mostly behind the door → the container runs up the screen, door at the bottom.
 * horizontal: mostly beside the left wall → the container runs across, door on the right.
 */
function camera(orientation: SceneOrientation): Camera {
  const c = norm(orientation === 'vertical' ? [-0.3, -0.84, 0.8] : [-0.8, -0.34, 0.62]);
  const up = norm([-c[2] * c[0], -c[2] * c[1], 1 - c[2] * c[2]]);
  const right = cross(up, c);
  return { toCamera: c, project: (p) => [dot(p, right), -dot(p, up)] };
}

type Project = (p: V3) => P2;

/* ───────────── Colours ───────────── */

const hexToRgb = (h: string): V3 => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (c: V3) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
/** Mix `a` towards `b` by t (0 = a, 1 = b). */
const mix = (a: string, b: string, t: number) => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
};
const light = (c: string, t: number) => mix(c, '#ffffff', t);
const dark = (c: string, t: number) => mix(c, '#000000', t);

const STEEL = '#c9c2b8';
const FRAME = '#3a2c22';
const FLOOR = '#c4a27a';
const WOOD = '#a77b4f';
const RED = '#b42318';
const KRAFT = '#d9c19b';

/* ───────────── Path helpers ───────────── */

const r1 = (v: number) => Math.round(v * 10) / 10;
const pt = (p: P2) => `${r1(p[0])} ${r1(p[1])}`;
const poly = (ps: P2[]) => `M${ps.map(pt).join('L')}Z`;
const line = (a: P2, b: P2) => `M${pt(a)}L${pt(b)}`;

/** Soft, slightly bulging face with rounded corners (bigbag fabric). */
function softPoly(ps: P2[], round = 0.16, bulge = 0.05): string {
  const n = ps.length;
  const c: P2 = [ps.reduce((s, p) => s + p[0], 0) / n, ps.reduce((s, p) => s + p[1], 0) / n];
  const lerp = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const A = ps.map((p, i) => lerp(p, ps[(i - 1 + n) % n], round)); // before corner i
  const B = ps.map((p, i) => lerp(p, ps[(i + 1) % n], round)); // after corner i
  let d = `M${pt(B[0])}`;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const mid = lerp(B[i], A[j], 0.5);
    const ctrl: P2 = [mid[0] + (mid[0] - c[0]) * bulge, mid[1] + (mid[1] - c[1]) * bulge];
    d += `Q${pt(ctrl)} ${pt(A[j])}Q${pt(ps[j])} ${pt(B[j])}`;
  }
  return `${d}Z`;
}

/* ───────────── Scene ───────────── */

export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/** The three faces that look towards the camera: top (z1), left (x0), door side (y0). */
function faces(b: Box, project: Project) {
  const P = (x: number, y: number, z: number) => project([x, y, z]);
  return {
    top: [P(b.x0, b.y0, b.z1), P(b.x1, b.y0, b.z1), P(b.x1, b.y1, b.z1), P(b.x0, b.y1, b.z1)],
    left: [P(b.x0, b.y0, b.z0), P(b.x0, b.y1, b.z0), P(b.x0, b.y1, b.z1), P(b.x0, b.y0, b.z1)],
    front: [P(b.x0, b.y0, b.z0), P(b.x1, b.y0, b.z0), P(b.x1, b.y0, b.z1), P(b.x0, b.y0, b.z1)],
  };
}

function bigbag(out: ScenePath[], b: Box, colour: string, over: boolean, project: Project) {
  const f = faces(b, project);
  const base = mix('#f4efe6', colour, 0.72);
  const edge = dark(colour, 0.35);
  const sw = 14;
  out.push({ d: softPoly(f.left), fill: dark(base, 0.16), stroke: edge, strokeWidth: sw });
  out.push({ d: softPoly(f.front), fill: base, stroke: edge, strokeWidth: sw });
  out.push({ d: softPoly(f.top, 0.2, 0.03), fill: light(base, 0.28), stroke: edge, strokeWidth: sw });
  // Woven fabric: a vertical seam on each side face, a belt near the top.
  const P = (x: number, y: number, z: number) => project([x, y, z]);
  const mx = (b.x0 + b.x1) / 2;
  const my = (b.y0 + b.y1) / 2;
  const zb = b.z0 + (b.z1 - b.z0) * 0.82;
  const seams = [
    line(P(mx, b.y0, b.z0 + 60), P(mx, b.y0, b.z1 - 60)),
    line(P(b.x0, my, b.z0 + 60), P(b.x0, my, b.z1 - 60)),
    line(P(b.x0 + 40, b.y0, zb), P(b.x1 - 40, b.y0, zb)),
    line(P(b.x0, b.y0 + 40, zb), P(b.x0, b.y1 - 40, zb)),
  ];
  out.push({ d: seams.join(''), stroke: edge, strokeWidth: 8, strokeOpacity: 0.45 });
  // Filling spout in the middle of the top.
  const ring = (z: number, r: number) =>
    poly(Array.from({ length: 14 }, (_, i) => P(mx + Math.cos((i / 14) * 2 * Math.PI) * r, my + Math.sin((i / 14) * 2 * Math.PI) * r, z)));
  out.push({ d: ring(b.z1, 150), fill: dark(base, 0.08), stroke: edge, strokeWidth: 8 });
  out.push({ d: ring(b.z1 + 70, 115), fill: light(base, 0.15), stroke: edge, strokeWidth: 8 });
  // Lifting loops at the four top corners.
  const loops: string[] = [];
  const k = 140;
  for (const [cx, cy, sx, sy] of [
    [b.x0, b.y0, 1, 1],
    [b.x1, b.y0, -1, 1],
    [b.x1, b.y1, -1, -1],
    [b.x0, b.y1, 1, -1],
  ] as const) {
    const a = P(cx + sx * k, cy + sy * 25, b.z1);
    const c = P(cx + sx * 25, cy + sy * k, b.z1);
    const top = P(cx + sx * 70, cy + sy * 70, b.z1 + 260);
    loops.push(`M${pt(a)}Q${pt(top)} ${pt(c)}`);
  }
  out.push({ d: loops.join(''), stroke: dark(colour, 0.45), strokeWidth: 26 });
  if (over) out.push({ d: softPoly(f.front), stroke: RED, strokeWidth: 30 });
}

function pallet(out: ScenePath[], b: Box, colour: string, over: boolean, project: Project) {
  const P = (x: number, y: number, z: number) => project([x, y, z]);
  const deck = Math.min(144, (b.z1 - b.z0) * 0.2);
  // Wooden pallet with fork openings on the visible sides.
  const wood: Box = { ...b, z1: b.z0 + deck };
  const fw = faces(wood, project);
  out.push({ d: poly(fw.left), fill: dark(WOOD, 0.18), stroke: dark(WOOD, 0.5), strokeWidth: 10 });
  out.push({ d: poly(fw.front), fill: WOOD, stroke: dark(WOOD, 0.5), strokeWidth: 10 });
  const holes: string[] = [];
  const zA = b.z0 + deck * 0.18;
  const zB = b.z0 + deck * 0.72;
  for (const [a, c] of [[0.12, 0.42], [0.58, 0.88]]) {
    const x0 = b.x0 + (b.x1 - b.x0) * a;
    const x1 = b.x0 + (b.x1 - b.x0) * c;
    holes.push(poly([P(x0, b.y0, zA), P(x1, b.y0, zA), P(x1, b.y0, zB), P(x0, b.y0, zB)]));
    const y0 = b.y0 + (b.y1 - b.y0) * a;
    const y1 = b.y0 + (b.y1 - b.y0) * c;
    holes.push(poly([P(b.x0, y0, zA), P(b.x0, y1, zA), P(b.x0, y1, zB), P(b.x0, y0, zB)]));
  }
  out.push({ d: holes.join(''), fill: dark(WOOD, 0.62) });

  // Small bags (≈ 50 kg) in layers, bonded pattern alternating per layer.
  const bags: Box = { ...b, z0: b.z0 + deck };
  const fb = faces(bags, project);
  const bag = mix(KRAFT, colour, 0.66);
  const edge = dark(bag, 0.45);
  out.push({ d: poly(fb.left), fill: dark(bag, 0.15), stroke: edge, strokeWidth: 10 });
  out.push({ d: poly(fb.front), fill: bag, stroke: edge, strokeWidth: 10 });
  out.push({ d: poly(fb.top), fill: light(bag, 0.25), stroke: edge, strokeWidth: 10 });
  const layers = Math.max(1, Math.round((bags.z1 - bags.z0) / 165));
  const lh = (bags.z1 - bags.z0) / layers;
  const lines: string[] = [];
  const W = b.x1 - b.x0;
  const D = b.y1 - b.y0;
  for (let i = 0; i < layers; i++) {
    const z0 = bags.z0 + i * lh;
    const z1 = z0 + lh;
    if (i > 0) {
      lines.push(line(P(b.x0, b.y0, z0), P(b.x1, b.y0, z0)));
      lines.push(line(P(b.x0, b.y0, z0), P(b.x0, b.y1, z0)));
    }
    const across = i % 2 === 0 ? [1 / 3, 2 / 3] : [1 / 2];
    const along = i % 2 === 0 ? [1 / 2] : [1 / 3, 2 / 3];
    for (const t of across) lines.push(line(P(b.x0 + W * t, b.y0, z0 + 8), P(b.x0 + W * t, b.y0, z1 - 8)));
    for (const t of along) lines.push(line(P(b.x0, b.y0 + D * t, z0 + 8), P(b.x0, b.y0 + D * t, z1 - 8)));
  }
  // Top layer pattern.
  const zt = bags.z1;
  const top = layers % 2 === 1 ? 'a' : 'b';
  if (top === 'a') {
    lines.push(line(P(b.x0, b.y0 + D / 2, zt), P(b.x1, b.y0 + D / 2, zt)));
    for (const t of [1 / 3, 2 / 3]) lines.push(line(P(b.x0 + W * t, b.y0, zt), P(b.x0 + W * t, b.y0 + D / 2, zt)));
    lines.push(line(P(b.x0 + W / 2, b.y0 + D / 2, zt), P(b.x0 + W / 2, b.y1, zt)));
  } else {
    lines.push(line(P(b.x0 + W / 2, b.y0, zt), P(b.x0 + W / 2, b.y1, zt)));
    for (const t of [1 / 3, 2 / 3]) lines.push(line(P(b.x0, b.y0 + D * t, zt), P(b.x0 + W / 2, b.y0 + D * t, zt)));
    lines.push(line(P(b.x0 + W / 2, b.y0 + D / 2, zt), P(b.x1, b.y0 + D / 2, zt)));
  }
  out.push({ d: lines.join(''), stroke: edge, strokeWidth: 9, strokeOpacity: 0.7 });
  if (over) out.push({ d: poly(fb.front), stroke: RED, strokeWidth: 30 });
}

/**
 * Drawing order (painter's algorithm) for non-overlapping boxes. Sorting by centre distance fails
 * when heights differ (the top of a two-high bigbag stack would be painted over the low pallet in
 * front of it). Instead: for every pair whose screen outlines overlap, the axis that separates the
 * two boxes says which one is nearer (smaller x: left side, smaller y: door side, higher z: above —
 * for overlapping outlines these never disagree), then a topological sort paints far before near.
 * Exported for tests.
 */
export function paintOrder(boxes: Box[], toCamera: V3, project: Project): number[] {
  const n = boxes.length;
  const rect = boxes.map((b) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const x of [b.x0, b.x1])
      for (const y of [b.y0, b.y1])
        for (const z of [b.z0, b.z1]) {
          const [px, py] = project([x, y, z]);
          x0 = Math.min(x0, px);
          x1 = Math.max(x1, px);
          y0 = Math.min(y0, py);
          y1 = Math.max(y1, py);
        }
    return { x0, y0, x1, y1 };
  });
  const depth = boxes.map((b) => dot([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2], toCamera));
  /** 1: a is in front of b, -1: b in front of a, 0: unknown (intersecting). */
  const front = (a: Box, b: Box) => {
    if (a.x1 <= b.x0) return 1;
    if (b.x1 <= a.x0) return -1;
    if (a.y1 <= b.y0) return 1;
    if (b.y1 <= a.y0) return -1;
    if (a.z0 >= b.z1) return 1;
    if (b.z0 >= a.z1) return -1;
    return 0;
  };
  const after: number[][] = Array.from({ length: n }, () => []); // i must be painted before after[i]
  const pending = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const a = rect[i];
      const b = rect[j];
      if (a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0) continue;
      const f = front(boxes[i], boxes[j]);
      if (f === 0) continue;
      const [back, near] = f === 1 ? [j, i] : [i, j];
      after[back].push(near);
      pending[near]++;
    }
  const order: number[] = [];
  const ready = new Set<number>();
  for (let i = 0; i < n; i++) if (pending[i] === 0) ready.add(i);
  const done = new Array<boolean>(n).fill(false);
  while (order.length < n) {
    let pick = -1;
    for (const i of ready) if (pick < 0 || depth[i] < depth[pick]) pick = i;
    if (pick < 0) {
      // Should not happen for non-overlapping boxes; fall back to the farthest remaining one.
      for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || depth[i] < depth[pick])) pick = i;
    }
    ready.delete(pick);
    done[pick] = true;
    order.push(pick);
    for (const k of after[pick]) if (--pending[k] === 0 && !done[k]) ready.add(k);
  }
  return order;
}

/** Builds the 3D loading view of one container. `colorOf(productId)` gives each product's colour. */
export function buildScene(
  c: CatalogContainer,
  items: LoadItem[],
  colorOf: (productId: number) => string,
  orientation: SceneOrientation = 'vertical',
): Scene {
  const W = c.innerWidthMm;
  const L = c.innerLengthMm;
  const H = c.innerHeightMm;
  const plan = planLoad(c, items);
  const { project, toCamera } = camera(orientation);
  const packs = new Map<number, CatalogPackaging>(items.map((i) => [i.packaging.id, i.packaging]));
  const P = (x: number, y: number, z: number) => project([x, y, z]);
  const paths: ScenePath[] = [];

  /* back: floor, right wall, front wall (inner surfaces) */
  paths.push({ d: poly([P(0, 0, 0), P(W, 0, 0), P(W, L, 0), P(0, L, 0)]), fill: FLOOR, stroke: dark(FLOOR, 0.35), strokeWidth: 12 });
  const planks: string[] = [];
  for (let x = 280; x < W; x += 280) planks.push(line(P(x, 0, 0), P(x, L, 0)));
  paths.push({ d: planks.join(''), stroke: dark(FLOOR, 0.25), strokeWidth: 8, strokeOpacity: 0.6 });
  paths.push({ d: poly([P(W, 0, 0), P(W, L, 0), P(W, L, H), P(W, 0, H)]), fill: light(STEEL, 0.25), stroke: dark(STEEL, 0.3), strokeWidth: 12 });
  paths.push({ d: poly([P(0, L, 0), P(W, L, 0), P(W, L, H), P(0, L, H)]), fill: STEEL, stroke: dark(STEEL, 0.3), strokeWidth: 12 });
  const ribs: string[] = [];
  for (let y = 140; y < L; y += 280) ribs.push(line(P(W, y, 40), P(W, y, H - 40)));
  for (let x = 140; x < W; x += 280) ribs.push(line(P(x, L, 40), P(x, L, H - 40)));
  paths.push({ d: ribs.join(''), stroke: dark(STEEL, 0.18), strokeWidth: 9, strokeOpacity: 0.55 });
  const E = (a: V3, b: V3) => line(project(a), project(b));
  const corner = (p: V3) => {
    const s = 90;
    return poly([project([p[0] - s, p[1] - s, p[2]]), project([p[0] + s, p[1] - s, p[2]]), project([p[0] + s, p[1] + s, p[2]]), project([p[0] - s, p[1] + s, p[2]])]);
  };
  // Edges between the solid back faces lie behind the load.
  paths.push({ d: [E([W, 0, 0], [W, L, 0]), E([0, L, 0], [W, L, 0]), E([W, L, 0], [W, L, H])].join(''), stroke: FRAME, strokeWidth: 30 });
  paths.push({ d: [corner([W, L, 0]), corner([W, 0, 0]), corner([0, L, 0])].join(''), fill: FRAME });

  /* load: every unit as a box, far to near (painter's order) */
  type Unit = { box: Box; kind: CatalogPackaging['type']; colour: string; over: boolean; depth: number };
  const units: Unit[] = [];
  for (const s of plan.placements) {
    // Plan: x from the front wall, y across → world: y from the door, x across.
    const y1 = L - s.x;
    const y0 = y1 - s.depth;
    let z = 0;
    for (const u of s.units) {
      const p = packs.get(u.packagingId);
      const h = p?.heightMm ?? 1000;
      for (let i = 0; i < u.count; i++) {
        const box: Box = { x0: s.y, x1: s.y + s.across, y0, y1, z0: z, z1: z + h };
        const centre: V3 = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, (box.z0 + box.z1) / 2];
        units.push({ box, kind: s.packagingType, colour: colorOf(u.productId), over: s.overflow, depth: dot(centre, toCamera) });
        z += h;
      }
    }
  }
  for (const i of paintOrder(units.map((u) => u.box), toCamera, project)) {
    const u = units[i];
    (u.kind === 'bigbag' ? bigbag : pallet)(paths, u.box, u.colour, u.over, project);
  }

  /* front: transparent roof, left wall and door face, then the frame */
  const glass = { fill: '#e8f1f5', fillOpacity: 0.12, stroke: FRAME, strokeWidth: 10, strokeOpacity: 0.35 };
  paths.push({ d: poly([P(0, 0, 0), P(0, L, 0), P(0, L, H), P(0, 0, H)]), ...glass });
  paths.push({ d: poly([P(0, 0, H), P(W, 0, H), P(W, L, H), P(0, L, H)]), ...glass, fillOpacity: 0.06 });
  paths.push({ d: poly([P(0, 0, 0), P(W, 0, 0), P(W, 0, H), P(0, 0, H)]), ...glass, fillOpacity: 0.1 });
  // Door leaves and locking bars, drawn faintly so the load stays readable.
  const bars: string[] = [line(P(W / 2, 0, 30), P(W / 2, 0, H - 30))];
  for (const t of [0.18, 0.36, 0.64, 0.82]) bars.push(line(P(W * t, 0, 60), P(W * t, 0, H - 60)));
  paths.push({ d: bars.join(''), stroke: FRAME, strokeWidth: 14, strokeOpacity: 0.28 });
  const ribsL: string[] = [];
  for (let y = 140; y < L; y += 280) ribsL.push(line(P(0, y, 40), P(0, y, H - 40)));
  paths.push({ d: ribsL.join(''), stroke: FRAME, strokeWidth: 6, strokeOpacity: 0.1 });
  // Edges touching a solid face: the outline of the container, drawn over the load but light.
  paths.push({
    d: [E([0, 0, 0], [W, 0, 0]), E([0, 0, 0], [0, L, 0]), E([W, 0, 0], [W, 0, H]), E([W, 0, H], [W, L, H]), E([0, L, H], [W, L, H]), E([0, L, 0], [0, L, H])].join(''),
    stroke: FRAME,
    strokeWidth: 28,
    strokeOpacity: 0.85,
  });
  // Edges between the transparent faces are nearest to the viewer: thin, so the load stays readable.
  paths.push({ d: [E([0, 0, H], [W, 0, H]), E([0, 0, H], [0, L, H]), E([0, 0, 0], [0, 0, H])].join(''), stroke: FRAME, strokeWidth: 16, strokeOpacity: 0.45 });
  paths.push({ d: [[0, 0, 0], [W, 0, H], [0, L, H], [W, L, H], [0, 0, H]].map((p) => corner(p as V3)).join(''), fill: FRAME, fillOpacity: 0.9 });
  if (plan.usedLengthMm > L) {
    paths.push({ d: poly([P(0, 0, 0), P(W, 0, 0), P(W, L - plan.usedLengthMm, 0), P(0, L - plan.usedLengthMm, 0)]), fill: RED, fillOpacity: 0.08, stroke: RED, strokeWidth: 16, strokeOpacity: 0.6 });
  }

  /* fit: bounds of everything, orientation, translation */
  const vertical = orientation === 'vertical';
  const beyond = Math.min(0, L - plan.usedLengthMm);
  const door = vertical ? P(W / 2, beyond, 0) : P(W / 2, beyond, H / 2);
  const nums = paths.flatMap((p) => p.d.match(/-?\d+(\.\d+)?/g)!.map(Number));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i];
    const y = nums[i + 1];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const pad = 120;
  const labelRoom = 420;
  const shift = (p: P2): P2 => [p[0] - minX + pad, p[1] - minY + pad];
  const moved = paths.map((p) => ({
    ...p,
    d: p.d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_m, a, b) => pt(shift([Number(a), Number(b)]))),
  }));
  const d = shift(door);
  return {
    width: maxX - minX + 2 * pad + (vertical ? 0 : labelRoom),
    height: maxY - minY + 2 * pad + (vertical ? labelRoom : 0),
    paths: moved,
    door: vertical ? { x: d[0], y: d[1] + 260 } : { x: maxX - minX + pad + 90, y: d[1] },
    overflow: plan.usedLengthMm > L,
  };
}
