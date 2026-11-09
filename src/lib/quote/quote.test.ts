import { describe, expect, it } from 'vitest';
import {
  computeLoad,
  computeQuote,
  effectiveTiers,
  floorLengthFor,
  layoutRects,
  planLoad,
  maxAdditionalUnits,
  roundCents,
  stacksInLength,
  type Catalog,
  type CatalogContainer,
  type CatalogOption,
  type CatalogPackaging,
} from './index';

/* ───────────── Fixtures (seed container sizes) ───────────── */

const container = (over: Partial<CatalogContainer>): CatalogContainer => ({
  id: 1,
  code: '20DV',
  nameEn: "20' Dry Van",
  nameTr: "20'lik Standart",
  innerLengthMm: 5898,
  innerWidthMm: 2352,
  innerHeightMm: 2393,
  doorWidthMm: 2340,
  doorHeightMm: 2280,
  tareKg: 2230,
  maxPayloadKg: 28200,
  practicalPayloadKg: null,
  payloadLimitKg: 28200,
  sortOrder: 10,
  options: [],
  ...over,
});

const C20 = container({});
const C40 = container({ id: 2, code: '40DV', innerLengthMm: 12032, tareKg: 3750, maxPayloadKg: 26700, payloadLimitKg: 26700 });
const C40HC = container({
  id: 3,
  code: '40HC',
  innerLengthMm: 12032,
  innerHeightMm: 2698,
  doorHeightMm: 2585,
  tareKg: 3900,
  maxPayloadKg: 26500,
  payloadLimitKg: 26500,
});

const packaging = (over: Partial<CatalogPackaging>): CatalogPackaging => ({
  id: 11,
  productId: 1,
  type: 'bigbag',
  nameEn: '1000 kg Big Bag',
  nameTr: '1000 kg Bigbag',
  netWeightKg: 1000,
  grossWeightKg: 1005,
  lengthMm: 900,
  widthMm: 900,
  heightMm: 1100,
  maxTiers: 2,
  allowRotation: true,
  priceBasis: 'per_ton',
  priceCents: 18550,
  sortOrder: 0,
  ...over,
});

const BB = packaging({});
const EUR = packaging({
  id: 21,
  productId: 2,
  type: 'pallet',
  nameEn: 'Euro pallet',
  nameTr: 'Euro palet',
  grossWeightKg: 1025,
  lengthMm: 1200,
  widthMm: 800,
  heightMm: 1150,
  priceBasis: 'per_unit',
  priceCents: 21000,
});
const STD = packaging({ id: 31, type: 'pallet', lengthMm: 1200, widthMm: 1000, heightMm: 1150 });
const TALL = packaging({ id: 41, type: 'pallet', lengthMm: 1200, widthMm: 1000, heightMm: 1300 });

/* ───────────── Loading ───────────── */

describe('floor layout (stacksInLength)', () => {
  it('bigbag 90×90: 2 across × 6 rows = 12 in a 20DV', () => {
    expect(stacksInLength(BB, 2352, 5898)).toBe(12);
  });
  it('Euro pallet: 11 in 20DV, 25 in 40DV (mixed-orientation lanes)', () => {
    expect(stacksInLength(EUR, 2352, 5898)).toBe(11);
    expect(stacksInLength(EUR, 2352, 12032)).toBe(25);
  });
  it('standard pallet 120×100: 9 in 20DV, 22 in 40DV', () => {
    expect(stacksInLength(STD, 2352, 5898)).toBe(9);
    expect(stacksInLength(STD, 2352, 12032)).toBe(22);
  });
  it('a non-rotatable Euro pallet only uses its fixed orientation', () => {
    // 1200 along the length, 800 across → 2 across × 4 rows
    expect(stacksInLength({ ...EUR, allowRotation: false }, 2352, 5898)).toBe(8);
  });
  it('shortest segment for 5 bigbag stacks is 3 rows = 2700 mm', () => {
    expect(floorLengthFor(BB, 2352, 5898, 5)).toBe(2700);
    expect(floorLengthFor(BB, 2352, 5898, 13)).toBeNull();
  });
});

describe('stacking height', () => {
  it('limits tiers by inner height: 1300 mm pallet → 1 tier in DV, 2 in HC', () => {
    expect(effectiveTiers(TALL, C20.innerHeightMm)).toBe(1);
    expect(effectiveTiers(TALL, C40HC.innerHeightMm)).toBe(2);
  });
});

describe('computeLoad', () => {
  it('fits 10 bigbags + 4 Euro pallets in a 20DV: pallets use the free side of the half row (3400 mm)', () => {
    const load = computeLoad(C20, [
      { packaging: BB, quantity: 10 },
      { packaging: EUR, quantity: 4 },
    ]);
    expect(load.fits).toBe(true);
    // Loaded one after another it would be 2700 + 1200 mm.
    expect(load.floorLengthUsedMm).toBe(3400);
    expect(load.grossKg).toBe(14150);
    expect(load.groups).toHaveLength(2);
  });

  it('lets two products in the same bigbag size share stacks', () => {
    const other = { ...BB, id: 12, productId: 9 };
    const load = computeLoad(C20, [
      { packaging: BB, quantity: 13 },
      { packaging: other, quantity: 11 },
    ]);
    expect(load.groups).toHaveLength(1);
    expect(load.groups[0]).toMatchObject({ units: 24, stacks: 12, floorLengthMm: 5400 });
    expect(load.fits).toBe(true);
  });

  it('flags floor overflow at 25 bigbags in a 20DV although weight is fine', () => {
    const load = computeLoad(C20, [{ packaging: BB, quantity: 25 }]);
    expect(load.fitsWeight).toBe(true);
    expect(load.fitsFloor).toBe(false);
  });
});

describe('maxAdditionalUnits', () => {
  it('20DV holds 24 bigbags (floor × 2 tiers) at the technical payload', () => {
    expect(maxAdditionalUnits(C20, [], BB)).toBe(24);
  });
  it('a 21 t practical limit makes weight the binding constraint: 20 bigbags', () => {
    const c = { ...C20, practicalPayloadKg: 21000, payloadLimitKg: 21000 };
    expect(maxAdditionalUnits(c, [], BB)).toBe(20);
  });
  it('40DV is weight-bound for bigbags: floor holds 52, payload 26 700 kg allows 26', () => {
    expect(stacksInLength(BB, C40.innerWidthMm, C40.innerLengthMm) * effectiveTiers(BB, C40.innerHeightMm)).toBe(52);
    expect(maxAdditionalUnits(C40, [], BB)).toBe(26);
  });
  it('accounts for what is already loaded', () => {
    expect(maxAdditionalUnits(C20, [{ packaging: EUR, quantity: 4 }], BB)).toBe(20);
  });
});

/* ───────────── Load plan (drawing) ───────────── */

const overlaps = (r: { x: number; y: number; depth: number; across: number }, s: typeof r) =>
  r.x < s.x + s.depth && s.x < r.x + r.depth && r.y < s.y + s.across && s.y < r.y + r.across;

describe('layoutRects / planLoad', () => {
  it.each([
    ['Euro pallet 20DV', EUR, 5898, 11],
    ['Euro pallet 40DV', EUR, 12032, 25],
    ['standard pallet 20DV', STD, 5898, 9],
    ['bigbag 20DV', BB, 5898, 12],
  ])('%s: rect count equals capacity, inside the floor, no overlaps', (_n, p, L, expected) => {
    const rects = layoutRects(p, 2352, L);
    expect(rects).toHaveLength(expected);
    expect(rects).toHaveLength(stacksInLength(p, 2352, L));
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.depth).toBeLessThanOrEqual(L);
      expect(r.y + r.across).toBeLessThanOrEqual(2352);
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i], rects[j])).toBe(false);
  });

  it('loads groups from the front wall without gaps and agrees with computeLoad', () => {
    const items = [
      { packaging: BB, quantity: 10 },
      { packaging: EUR, quantity: 4 },
    ];
    const plan = planLoad(C20, items);
    const load = computeLoad(C20, items);
    expect(plan.usedLengthMm).toBe(load.floorLengthUsedMm);
    expect(plan.placements).toHaveLength(5 + 2);
    // The first pallet stands beside the last, half-filled bigbag row (x 1800-2700), not behind it.
    expect(Math.min(...plan.placements.filter((p) => p.packagingType === 'pallet').map((p) => p.x))).toBe(1800);
    expect(plan.placements.reduce((s, p) => s + p.height, 0)).toBe(14);
    expect(plan.placements.some((p) => p.overflow)).toBe(false);
  });

  it('fills shared stacks across products and marks overflow beyond the container', () => {
    const other = { ...BB, id: 12, productId: 9 };
    const mixed = planLoad(C20, [
      { packaging: BB, quantity: 3 },
      { packaging: other, quantity: 3 },
    ]);
    expect(mixed.placements.map((p) => p.units.map((u) => `${u.packagingId}x${u.count}`).join('+'))).toEqual([
      '11x2',
      '11x1+12x1',
      '12x2',
    ]);
    const tooMany = planLoad(C20, [
      { packaging: BB, quantity: 10 },
      { packaging: EUR, quantity: 16 },
    ]);
    expect(tooMany.placements.some((p) => p.overflow)).toBe(true);
    const over = planLoad(C20, [{ packaging: BB, quantity: 30 }]);
    expect(over.placements).toHaveLength(15);
    expect(over.placements.filter((p) => p.overflow)).toHaveLength(3);
    expect(over.usedLengthMm).toBeGreaterThan(C20.innerLengthMm);
    expect(over.unplacedStacks).toBe(0);
    // drawing and numbers agree even when overloaded: floor use > 100 %
    const overLoad = computeLoad(C20, [{ packaging: BB, quantity: 30 }]);
    expect(overLoad.floorLengthUsedMm).toBe(over.usedLengthMm);
    expect(overLoad.floorUtilization).toBeGreaterThan(1);
    expect(overLoad.fitsFloor).toBe(false);
  });
});

/* ───────────── Pricing ───────────── */

const opt = (over: Partial<CatalogOption> & Pick<CatalogOption, 'id' | 'priceType' | 'amount'>): CatalogOption => ({
  nameEn: `opt-${over.id}`,
  nameTr: `secenek-${over.id}`,
  descriptionEn: '',
  descriptionTr: '',
  longDescriptionEn: '',
  longDescriptionTr: '',
  groupName: null,
  isMandatory: false,
  isDefault: false,
  sortOrder: over.id,
  ...over,
});

const containerOpts = {
  fumigation: opt({ id: 201, priceType: 'fixed', amount: 15000 }),
  portService: opt({ id: 202, priceType: 'fixed', amount: 9000, isMandatory: true }),
  insurance: opt({ id: 203, priceType: 'percent', amount: 100 }),
};

const catalog: Catalog = {
  currency: 'USD',
  quoteValidityDays: 30,
  products: [
    {
      id: 1,
      slug: 'granulated',
      nameEn: 'Granulated Sepiolite',
      nameTr: 'Granül Sepiyolit',
      descriptionEn: '',
      descriptionTr: '',
      hsCode: null,
      specs: [],
      sortOrder: 0,
      packagings: [BB],
      options: [
        opt({ id: 101, priceType: 'percent', amount: 250, groupName: 'Screening' }),
        opt({ id: 102, priceType: 'percent', amount: 400, groupName: 'Screening' }),
        opt({ id: 103, priceType: 'per_unit', amount: 500 }),
        opt({ id: 104, priceType: 'fixed', amount: 2500, isMandatory: true }),
      ],
      documents: [],
    },
    {
      id: 2,
      slug: 'powder',
      nameEn: 'Sepiolite Powder',
      nameTr: 'Sepiyolit Tozu',
      descriptionEn: '',
      descriptionTr: '',
      hsCode: null,
      specs: [],
      sortOrder: 1,
      packagings: [EUR],
      options: [],
      documents: [],
    },
  ],
  containers: [
    { ...C20, options: [containerOpts.fumigation, containerOpts.portService, containerOpts.insurance] },
    // 40DV is disabled → absent from the catalog
    { ...C40HC, options: [containerOpts.fumigation, containerOpts.portService] },
  ],
  orderOptions: [
    opt({ id: 301, priceType: 'fixed', amount: 5000, isMandatory: true }),
    opt({ id: 302, priceType: 'per_container', amount: 2500, isMandatory: true }),
    opt({ id: 303, priceType: 'percent', amount: -200 }),
  ],
  deliveryTerms: [],
};

describe('roundCents', () => {
  it('rounds half away from zero', () => {
    expect(roundCents(2.5)).toBe(3);
    expect(roundCents(-2.5)).toBe(-3);
    expect(roundCents(-14199.26)).toBe(-14199);
  });
});

describe('computeQuote — full order', () => {
  const result = computeQuote(catalog, {
    containers: [
      {
        containerTypeId: 1,
        optionIds: [201, 203],
        lines: [
          { packagingId: 11, quantity: 20, optionIds: [101, 103] },
          { packagingId: 21, quantity: 4, optionIds: [] },
        ],
      },
      { containerTypeId: 3, optionIds: [], lines: [{ packagingId: 11, quantity: 10, optionIds: [102] }] },
    ],
    optionIds: [303],
  });

  it('has no errors', () => {
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('prices line 1: 20 t × 185.50 + mandatory 25.00 + 2.5 % + 5.00 × 20', () => {
    const line = result.containers[0].lines[0];
    expect(line.goodsCents).toBe(371000);
    expect(line.options.map((o) => [o.optionId, o.cents])).toEqual([
      [101, 9275],
      [103, 10000],
      [104, 2500],
    ]);
    expect(line.totalCents).toBe(392775);
  });

  it('prices a per-unit pallet line: 4 × 210.00', () => {
    expect(result.containers[0].lines[1].totalCents).toBe(84000);
  });

  it('container 1: lines + mandatory port 90.00 + fumigation 150.00 + 1 % of lines', () => {
    const c = result.containers[0];
    expect(c.linesTotalCents).toBe(476775);
    expect(c.options.map((o) => [o.optionId, o.cents])).toEqual([
      [201, 15000],
      [202, 9000],
      [203, 4768],
    ]);
    expect(c.totalCents).toBe(505543);
  });

  it('container 2 (40HC): line with 4 % option + mandatory port service', () => {
    const c = result.containers[1];
    expect(c.lines[0].totalCents).toBe(185500 + 2500 + 7420);
    expect(c.totalCents).toBe(204420);
  });

  it('order: fixed 50.00 + 25.00 × 2 containers − 2 % of containers', () => {
    expect(result.containersTotalCents).toBe(709963);
    expect(result.orderOptions.map((o) => [o.optionId, o.cents])).toEqual([
      [301, 5000],
      [302, 5000],
      [303, -14199],
    ]);
    expect(result.totalCents).toBe(705764);
  });

  it('reports totals and a low-utilization warning for the half-empty 40HC', () => {
    expect(result.totals).toEqual({ containers: 2, units: 34, netKg: 34000, grossKg: 34250 });
    expect(result.warnings).toEqual([
      { code: 'container_low_utilization', path: 'containers.1', params: { percent: 38 } },
    ]);
  });
});

describe('computeQuote — validation', () => {
  const one = (lines: { packagingId: number; quantity: number; optionIds: number[] }[], containerTypeId = 1) =>
    computeQuote(catalog, { containers: [{ containerTypeId, optionIds: [], lines }], optionIds: [] });
  const codes = (r: ReturnType<typeof computeQuote>) => r.errors.map((e) => `${e.code}@${e.path}`);

  it('rejects two options from the same group', () => {
    expect(codes(one([{ packagingId: 11, quantity: 5, optionIds: [101, 102] }]))).toEqual([
      'option_group_conflict@containers.0.lines.0',
    ]);
  });

  it("rejects another product's option", () => {
    expect(codes(one([{ packagingId: 21, quantity: 2, optionIds: [101] }]))).toEqual([
      'unknown_option@containers.0.lines.0',
    ]);
  });

  it('rejects a disabled / unknown container type', () => {
    expect(codes(one([{ packagingId: 11, quantity: 5, optionIds: [] }], 2))).toContain('unknown_container@containers.0');
  });

  it('rejects a container option that belongs to another container type', () => {
    const r = computeQuote(catalog, {
      containers: [{ containerTypeId: 3, optionIds: [203], lines: [{ packagingId: 11, quantity: 5, optionIds: [] }] }],
      optionIds: [],
    });
    expect(codes(r)).toEqual(['unknown_option@containers.0']);
  });

  it('rejects invalid quantities and unknown packagings', () => {
    expect(
      codes(
        one([
          { packagingId: 11, quantity: 0, optionIds: [] },
          { packagingId: 11, quantity: 1.5, optionIds: [] },
          { packagingId: 999, quantity: 1, optionIds: [] },
        ]),
      ),
    ).toEqual([
      'invalid_quantity@containers.0.lines.0',
      'invalid_quantity@containers.0.lines.1',
      'unknown_packaging@containers.0.lines.2',
    ]);
  });

  it('rejects empty orders and empty containers', () => {
    expect(codes(computeQuote(catalog, { containers: [], optionIds: [] }))).toEqual(['no_containers@containers']);
    expect(codes(one([]))).toEqual(['empty_container@containers.0']);
  });

  it('flags floor overflow and overweight', () => {
    expect(codes(one([{ packagingId: 11, quantity: 25, optionIds: [] }]))).toEqual([
      'container_floor_overflow@containers.0',
    ]);
    const heavy: Catalog = {
      ...catalog,
      containers: [{ ...catalog.containers[0], practicalPayloadKg: 21000, payloadLimitKg: 21000 }],
    };
    const r = computeQuote(heavy, {
      containers: [{ containerTypeId: 1, optionIds: [], lines: [{ packagingId: 11, quantity: 21, optionIds: [] }] }],
      optionIds: [],
    });
    expect(r.errors).toEqual([
      { code: 'container_overweight', path: 'containers.0', params: { grossKg: 21105, limitKg: 21000 } },
    ]);
  });

  it('flags a unit that cannot pass the door although it fits inside', () => {
    const doorTest: Catalog = {
      ...catalog,
      products: [{ ...catalog.products[1], packagings: [{ ...EUR, heightMm: 2300, maxTiers: 1 }] }],
    };
    const r = computeQuote(doorTest, {
      containers: [{ containerTypeId: 1, optionIds: [], lines: [{ packagingId: 21, quantity: 2, optionIds: [] }] }],
      optionIds: [],
    });
    expect(codes(r)).toEqual(['unit_door@containers.0.lines.0']);
  });
});

describe('computeQuote — container count', () => {
  const base = {
    containerTypeId: 1,
    optionIds: [201],
    lines: [{ packagingId: 11, quantity: 20, optionIds: [] }],
  };
  const single = computeQuote(catalog, { containers: [base], optionIds: [] });
  const triple = computeQuote(catalog, { containers: [{ ...base, count: 3 }], optionIds: [] });

  it('multiplies one configuration by its count', () => {
    expect(triple.errors).toEqual([]);
    const c = triple.containers[0];
    expect(c.count).toBe(3);
    expect(c.unitTotalCents).toBe(single.containers[0].totalCents);
    expect(c.totalCents).toBe(3 * c.unitTotalCents);
    expect(c.load?.netKg).toBe(20000); // the load describes one container
  });

  it('counts physical containers in totals and per-container order options', () => {
    expect(triple.totals).toEqual({ containers: 3, units: 60, netKg: 60000, grossKg: 3 * single.totals.grossKg });
    expect(triple.orderOptions.find((o) => o.optionId === 302)?.cents).toBe(3 * 2500);
  });

  it('treats a missing count as 1 (older snapshots)', () => {
    expect(single.containers[0].count).toBe(1);
    expect(single.totals.containers).toBe(1);
  });

  it('rejects invalid counts and more than the container limit in total', () => {
    const codes = (count: number) =>
      computeQuote(catalog, { containers: [{ ...base, count }], optionIds: [] }).errors.map((e) => `${e.code}@${e.path}`);
    expect(codes(0)).toEqual(['invalid_container_count@containers.0']);
    expect(codes(2.5)).toEqual(['invalid_container_count@containers.0']);
    const many = computeQuote(catalog, { containers: [{ ...base, count: 30 }, { ...base, count: 21 }], optionIds: [] });
    expect(many.errors.map((e) => e.code)).toEqual(['too_many_containers']);
  });
});

describe('computeQuote — delivery terms', () => {
  const term = (over: Partial<Catalog['deliveryTerms'][number]>): Catalog['deliveryTerms'][number] => ({
    id: 1,
    incoterm: 'FOB',
    placeEn: 'Mersin',
    placeTr: 'Mersin',
    paymentTermsEn: '',
    paymentTermsTr: '',
    notesEn: '',
    notesTr: '',
    priceType: 'fixed',
    amount: 0,
    sortOrder: 0,
    ...over,
  });
  const withTerms: Catalog = {
    ...catalog,
    orderOptions: [],
    deliveryTerms: [term({}), term({ id: 2, placeEn: 'Izmir', placeTr: 'İzmir', priceType: 'per_container', amount: 15000 })],
  };
  const order = (deliveryTermId?: number | null) =>
    computeQuote(withTerms, {
      containers: [{ containerTypeId: 1, count: 2, optionIds: [], lines: [{ packagingId: 11, quantity: 20, optionIds: [] }] }],
      optionIds: [],
      deliveryTermId,
    });

  it('requires a term when the catalog offers some', () => {
    expect(order().errors.map((e) => e.code)).toEqual(['no_delivery_term']);
    expect(order(99).errors.map((e) => e.code)).toEqual(['unknown_delivery_term']);
  });

  it('adds the term adjustment to the total (per container × count)', () => {
    const fob = order(1);
    const izmir = order(2);
    expect(fob.ok && izmir.ok).toBe(true);
    expect(fob.deliveryTerm).toMatchObject({ deliveryTermId: 1, incoterm: 'FOB', cents: 0 });
    expect(izmir.deliveryTerm?.cents).toBe(2 * 15000);
    expect(izmir.totalCents - fob.totalCents).toBe(30000);
  });

  it('needs no term when the catalog has none', () => {
    const r = computeQuote(catalog, { containers: [{ containerTypeId: 1, optionIds: [], lines: [{ packagingId: 11, quantity: 20, optionIds: [] }] }], optionIds: [] });
    expect(r.deliveryTerm).toBeNull();
    expect(r.errors.filter((e) => e.path === 'deliveryTerm')).toEqual([]);
  });
});

describe('packing mixed loads from the front wall', () => {
  const B95 = packaging({ id: 51, productId: 5, lengthMm: 950, widthMm: 950, heightMm: 1150 });
  const B90 = packaging({ id: 61, productId: 6, heightMm: 1150 });

  it('fills the free half of the last row of the first product (6 × 90 cm + 10 × 95 cm bigbags)', () => {
    const items = [
      { packaging: B90, quantity: 6 },
      { packaging: B95, quantity: 10 },
    ];
    const plan = planLoad(C20, items);
    const load = computeLoad(C20, items);
    // One after another: 2 rows of 90 (1800) + 3 rows of 95 (2850) = 4650 mm.
    expect(load.floorLengthUsedMm).toBe(3750);
    expect(plan.usedLengthMm).toBe(3750);
    const first95 = plan.placements.find((p) => p.units[0]?.packagingId === 51)!;
    expect(first95.x).toBe(900);
    expect(plan.placements.reduce((n, p) => n + p.height, 0)).toBe(16);
  });

  const mixes: [string, CatalogContainer, { packaging: CatalogPackaging; quantity: number }[]][] = [
    ['bigbags + Euro pallets', C20, [{ packaging: BB, quantity: 7 }, { packaging: EUR, quantity: 5 }]],
    ['three footprints', C40, [{ packaging: B95, quantity: 9 }, { packaging: STD, quantity: 7 }, { packaging: BB, quantity: 5 }]],
    ['pallets first', C40HC, [{ packaging: EUR, quantity: 9 }, { packaging: B95, quantity: 11 }, { packaging: TALL, quantity: 3 }]],
    ['overloaded', C20, [{ packaging: STD, quantity: 12 }, { packaging: B95, quantity: 20 }]],
  ];

  it.each(mixes)('%s: no overlaps, inside the width, never longer than loading one after another', (_n, c, items) => {
    const plan = planLoad(c, items);
    const load = computeLoad(c, items);
    expect(plan.usedLengthMm).toBe(load.floorLengthUsedMm);
    for (const r of plan.placements) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.across).toBeLessThanOrEqual(c.innerWidthMm);
    }
    for (let i = 0; i < plan.placements.length; i++)
      for (let j = i + 1; j < plan.placements.length; j++) expect(overlaps(plan.placements[i], plan.placements[j])).toBe(false);
    const sequential = load.groups.reduce((sum, g) => sum + (g.floorLengthMm ?? 0), 0);
    expect(load.floorLengthUsedMm).toBeLessThanOrEqual(sequential);
  });

  it('keeps single-product loads exactly as before', () => {
    for (const [c, p, n] of [[C20, EUR, 11], [C40, EUR, 25], [C20, STD, 9], [C20, BB, 24]] as const) {
      const load = computeLoad(c, [{ packaging: p, quantity: n }]);
      expect(load.floorLengthUsedMm).toBe(load.groups[0].floorLengthMm);
    }
  });
});
