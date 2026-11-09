/**
 * Quote pricing engine. Pure and deterministic: the browser runs it for the live preview,
 * the server re-runs it on the authoritative catalog before issuing a soft offer.
 *
 * Price layers (each percent applies to the subtotal of the layer below):
 *   line       goods  = unit price × quantity (per_unit) or × net tons (per_ton)
 *              + product options     — percent of goods
 *   container  lines  = Σ line totals
 *              + container options   — percent of lines
 *   container  × count               — identical copies of one configuration
 *   order      containers = Σ container totals
 *              + order options       — percent of containers; per_container × container count
 *              + delivery term       — same price types as order options (e.g. FOB İzmir surcharge)
 *
 * Mandatory options are always applied. Options sharing a groupName are mutually exclusive.
 * All money is integer cents; rounding happens once per amount (half away from zero).
 */
import { computeLoad, unitIssues, type LoadItem } from './loading';
import type {
  AppliedDeliveryTerm,
  AppliedOption,
  Catalog,
  CatalogContainer,
  CatalogOption,
  CatalogPackaging,
  CatalogProduct,
  ContainerResult,
  LineResult,
  OrderRequest,
  QuoteIssue,
  QuoteResult,
} from './types';

export const LIMITS = {
  maxContainers: 50,
  maxLinesPerContainer: 20,
  maxQuantity: 100_000,
  /** Below this weight and floor utilization a container gets a warning. */
  lowUtilization: 0.5,
} as const;

/** Round half away from zero (Math.round rounds -2.5 to -2). */
export const roundCents = (x: number) => Math.sign(x) * Math.round(Math.abs(x));

interface PriceContext {
  /** Basis for percent options. */
  base: number;
  netTons: number;
  units?: number;
  containers?: number;
}

export function optionCents(o: Pick<CatalogOption, 'priceType' | 'amount'>, ctx: PriceContext): number {
  switch (o.priceType) {
    case 'fixed':
      return o.amount;
    case 'per_unit':
      return o.amount * (ctx.units ?? 0);
    case 'per_ton':
      return roundCents(o.amount * ctx.netTons);
    case 'per_container':
      return o.amount * (ctx.containers ?? 0);
    case 'percent':
      return roundCents((ctx.base * o.amount) / 10_000);
  }
}

/** Mandatory + requested options; reports unknown ids and group conflicts. */
export function resolveOptions(
  available: CatalogOption[],
  requestedIds: number[],
  path: string,
  errors: QuoteIssue[],
): CatalogOption[] {
  const byId = new Map(available.map((o) => [o.id, o]));
  const chosen = new Map<number, CatalogOption>();
  for (const o of available) if (o.isMandatory) chosen.set(o.id, o);
  for (const id of new Set(requestedIds)) {
    const o = byId.get(id);
    if (!o) errors.push({ code: 'unknown_option', path, params: { optionId: id } });
    else chosen.set(id, o);
  }
  const perGroup = new Map<string, number>();
  for (const o of chosen.values()) {
    if (o.groupName) perGroup.set(o.groupName, (perGroup.get(o.groupName) ?? 0) + 1);
  }
  for (const [group, n] of perGroup) {
    if (n > 1) errors.push({ code: 'option_group_conflict', path, params: { group } });
  }
  return [...chosen.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

const apply = (opts: CatalogOption[], ctx: PriceContext): AppliedOption[] =>
  opts.map((o) => ({
    optionId: o.id,
    nameEn: o.nameEn,
    nameTr: o.nameTr,
    priceType: o.priceType,
    amount: o.amount,
    isMandatory: o.isMandatory,
    cents: optionCents(o, ctx),
  }));

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function computeQuote(catalog: Catalog, req: OrderRequest): QuoteResult {
  const errors: QuoteIssue[] = [];
  const warnings: QuoteIssue[] = [];

  const packagings = new Map<number, { packaging: CatalogPackaging; product: CatalogProduct }>();
  for (const product of catalog.products)
    for (const packaging of product.packagings) packagings.set(packaging.id, { packaging, product });
  const containerTypes = new Map<number, CatalogContainer>(catalog.containers.map((c) => [c.id, c]));

  if (req.containers.length === 0) errors.push({ code: 'no_containers', path: 'containers' });
  const countOf = (c: { count?: number }) => c.count ?? 1;
  const validCount = (n: number) => Number.isInteger(n) && n >= 1 && n <= LIMITS.maxContainers;
  const physical = req.containers.reduce((a, c) => a + (validCount(countOf(c)) ? countOf(c) : 1), 0);
  if (req.containers.length > LIMITS.maxContainers || physical > LIMITS.maxContainers) {
    errors.push({ code: 'too_many_containers', path: 'containers', params: { max: LIMITS.maxContainers } });
  }

  const containers: ContainerResult[] = req.containers.slice(0, LIMITS.maxContainers).map((creq, ci) => {
    const cpath = `containers.${ci}`;
    const ctype = containerTypes.get(creq.containerTypeId);
    let count = countOf(creq);
    if (!validCount(count)) {
      errors.push({ code: 'invalid_container_count', path: cpath, params: { max: LIMITS.maxContainers } });
      count = 1;
    }
    if (!ctype) errors.push({ code: 'unknown_container', path: cpath, params: { containerTypeId: creq.containerTypeId } });
    if (creq.lines.length === 0) errors.push({ code: 'empty_container', path: cpath });
    if (creq.lines.length > LIMITS.maxLinesPerContainer) {
      errors.push({ code: 'too_many_lines', path: cpath, params: { max: LIMITS.maxLinesPerContainer } });
    }

    const loadItems: LoadItem[] = [];
    const lines: LineResult[] = [];
    creq.lines.slice(0, LIMITS.maxLinesPerContainer).forEach((lreq, li) => {
      const lpath = `${cpath}.lines.${li}`;
      const entry = packagings.get(lreq.packagingId);
      if (!entry) {
        errors.push({ code: 'unknown_packaging', path: lpath, params: { packagingId: lreq.packagingId } });
        return;
      }
      const q = lreq.quantity;
      if (!Number.isInteger(q) || q < 1 || q > LIMITS.maxQuantity) {
        errors.push({ code: 'invalid_quantity', path: lpath, params: { max: LIMITS.maxQuantity } });
        return;
      }
      const { packaging: p, product } = entry;
      if (ctype) for (const issue of unitIssues(ctype, p)) errors.push({ ...issue, path: lpath });

      const netKg = q * p.netWeightKg;
      const netTons = netKg / 1000;
      const goodsCents =
        p.priceBasis === 'per_ton' ? roundCents(p.priceCents * netTons) : p.priceCents * q;
      const options = apply(resolveOptions(product.options, lreq.optionIds, lpath, errors), {
        base: goodsCents,
        netTons,
        units: q,
      });
      loadItems.push({ packaging: p, quantity: q });
      lines.push({
        lineIndex: li,
        packagingId: p.id,
        productId: product.id,
        productNameEn: product.nameEn,
        productNameTr: product.nameTr,
        packagingNameEn: p.nameEn,
        packagingNameTr: p.nameTr,
        packagingType: p.type,
        quantity: q,
        netKg,
        grossKg: q * p.grossWeightKg,
        priceBasis: p.priceBasis,
        unitPriceCents: p.priceCents,
        goodsCents,
        options,
        totalCents: goodsCents + sum(options.map((o) => o.cents)),
      });
    });

    const linesTotalCents = sum(lines.map((l) => l.totalCents));
    const containerNetTons = sum(lines.map((l) => l.netKg)) / 1000;
    const options = ctype
      ? apply(resolveOptions(ctype.options, creq.optionIds, cpath, errors), {
          base: linesTotalCents,
          netTons: containerNetTons,
        })
      : [];

    let load = null;
    if (ctype && loadItems.length > 0) {
      load = computeLoad(ctype, loadItems);
      if (!load.fitsWeight) {
        errors.push({
          code: 'container_overweight',
          path: cpath,
          params: { grossKg: Math.round(load.grossKg), limitKg: load.payloadLimitKg },
        });
      }
      if (!load.fitsFloor) {
        errors.push({
          code: 'container_floor_overflow',
          path: cpath,
          params: { usedMm: load.floorLengthUsedMm, lengthMm: ctype.innerLengthMm },
        });
      }
      const util = Math.max(load.weightUtilization, load.floorUtilization);
      if (load.fits && util < LIMITS.lowUtilization) {
        warnings.push({ code: 'container_low_utilization', path: cpath, params: { percent: Math.round(util * 100) } });
      }
    }

    const unitTotalCents = linesTotalCents + sum(options.map((o) => o.cents));
    return {
      containerTypeId: creq.containerTypeId,
      code: ctype?.code ?? '',
      nameEn: ctype?.nameEn ?? '',
      nameTr: ctype?.nameTr ?? '',
      count,
      lines,
      linesTotalCents,
      options,
      unitTotalCents,
      totalCents: unitTotalCents * count,
      load,
    };
  });

  const containersTotalCents = sum(containers.map((c) => c.totalCents));
  /** Σ over containers of (per-container value × count). */
  const physicalSum = (f: (l: LineResult) => number) =>
    sum(containers.map((c) => c.count * sum(c.lines.map(f))));
  const netKg = physicalSum((l) => l.netKg);
  const containerCount = sum(containers.map((c) => c.count));
  const ctx = { base: containersTotalCents, netTons: netKg / 1000, containers: containerCount };
  const orderOptions = apply(resolveOptions(catalog.orderOptions, req.optionIds, 'order', errors), ctx);

  let deliveryTerm: AppliedDeliveryTerm | null = null;
  const terms = catalog.deliveryTerms ?? [];
  if (req.deliveryTermId != null) {
    const dt = terms.find((x) => x.id === req.deliveryTermId);
    if (!dt) errors.push({ code: 'unknown_delivery_term', path: 'deliveryTerm', params: { deliveryTermId: req.deliveryTermId } });
    else {
      deliveryTerm = {
        deliveryTermId: dt.id,
        incoterm: dt.incoterm,
        placeEn: dt.placeEn,
        placeTr: dt.placeTr,
        priceType: dt.priceType,
        amount: dt.amount,
        cents: optionCents(dt, ctx),
      };
    }
  } else if (terms.length > 0) {
    errors.push({ code: 'no_delivery_term', path: 'deliveryTerm' });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    currency: catalog.currency,
    containers,
    containersTotalCents,
    orderOptions,
    deliveryTerm,
    totalCents: containersTotalCents + sum(orderOptions.map((o) => o.cents)) + (deliveryTerm?.cents ?? 0),
    totals: {
      containers: containerCount,
      units: physicalSum((l) => l.quantity),
      netKg,
      grossKg: physicalSum((l) => l.grossKg),
    },
  };
}
