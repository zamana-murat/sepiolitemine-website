/**
 * Configurator draft state. Kept in localStorage as a per-viewer convenience only
 * (the server never trusts it; the offer is recalculated server-side).
 */
import { LIMITS } from '../lib/quote/pricing';
import type { Catalog, CatalogContainer, CatalogOption, CatalogPackaging, CatalogProduct, OrderRequest } from '../lib/quote/types';

export interface DraftLine {
  uid: string;
  packagingId: number;
  quantity: number;
  optionIds: number[];
}

export interface DraftContainer {
  uid: string;
  containerTypeId: number;
  /** Identical containers of this configuration. */
  count: number;
  optionIds: number[];
  lines: DraftLine[];
}

export interface Draft {
  v: 1;
  containers: DraftContainer[];
  optionIds: number[];
  activeUid: string | null;
  deliveryTermId: number | null;
}

const STORAGE_KEY = 'sm-quote-draft-v1';

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Non-mandatory defaults, at most one per group. */
export function defaultOptionIds(options: CatalogOption[]): number[] {
  const groups = new Set<string>();
  const ids: number[] = [];
  for (const o of options) {
    if (!o.isDefault || o.isMandatory) continue;
    if (o.groupName) {
      if (groups.has(o.groupName) || options.some((m) => m.isMandatory && m.groupName === o.groupName)) continue;
      groups.add(o.groupName);
    }
    ids.push(o.id);
  }
  return ids;
}

/** Keeps only selectable (non-mandatory, available) option ids. */
const keepSelectable = (ids: number[], options: CatalogOption[]) =>
  ids.filter((id) => options.some((o) => o.id === id && !o.isMandatory));

export function newContainer(catalog: Catalog, typeId?: number): DraftContainer {
  const type = catalog.containers.find((c) => c.id === typeId) ?? catalog.containers[0];
  return { uid: uid(), containerTypeId: type.id, count: 1, optionIds: defaultOptionIds(type.options), lines: [] };
}

export function emptyDraft(catalog: Catalog): Draft {
  const first = newContainer(catalog);
  return {
    v: 1,
    containers: [first],
    optionIds: defaultOptionIds(catalog.orderOptions),
    activeUid: first.uid,
    deliveryTermId: catalog.deliveryTerms[0]?.id ?? null,
  };
}

export function packagingIndex(catalog: Catalog) {
  const map = new Map<number, { packaging: CatalogPackaging; product: CatalogProduct }>();
  for (const product of catalog.products) for (const packaging of product.packagings) map.set(packaging.id, { packaging, product });
  return map;
}

/** Repairs a stored draft against the current catalog (products/containers/options may have changed). */
export function sanitize(draft: Draft | null, catalog: Catalog): Draft {
  if (!draft || draft.v !== 1 || !Array.isArray(draft.containers) || catalog.containers.length === 0) {
    return emptyDraft(catalog);
  }
  const packs = packagingIndex(catalog);
  const containers = draft.containers.map((c): DraftContainer => {
    const type: CatalogContainer = catalog.containers.find((t) => t.id === c.containerTypeId) ?? catalog.containers[0];
    return {
      uid: typeof c.uid === 'string' ? c.uid : uid(),
      containerTypeId: type.id,
      count: Number.isInteger(c.count) && c.count >= 1 && c.count <= LIMITS.maxContainers ? c.count : 1,
      optionIds: keepSelectable(c.optionIds ?? [], type.options),
      lines: (c.lines ?? [])
        .filter((l) => packs.has(l.packagingId) && Number.isInteger(l.quantity) && l.quantity > 0)
        .map((l) => ({
          uid: typeof l.uid === 'string' ? l.uid : uid(),
          packagingId: l.packagingId,
          quantity: l.quantity,
          optionIds: keepSelectable(l.optionIds ?? [], packs.get(l.packagingId)!.product.options),
        })),
    };
  });
  if (containers.length === 0) return emptyDraft(catalog);
  const activeUid = containers.some((c) => c.uid === draft.activeUid) ? draft.activeUid : containers[0].uid;
  const deliveryTermId = catalog.deliveryTerms.some((d) => d.id === draft.deliveryTermId)
    ? draft.deliveryTermId
    : (catalog.deliveryTerms[0]?.id ?? null);
  return {
    v: 1,
    containers,
    optionIds: keepSelectable(draft.optionIds ?? [], catalog.orderOptions),
    activeUid,
    deliveryTermId,
  };
}

export function changeContainerType(c: DraftContainer, catalog: Catalog, typeId: number): DraftContainer {
  const type = catalog.containers.find((t) => t.id === typeId);
  if (!type) return c;
  return { ...c, containerTypeId: type.id, optionIds: keepSelectable(c.optionIds, type.options) };
}

export const duplicateContainer = (c: DraftContainer): DraftContainer => ({
  ...c,
  uid: uid(),
  optionIds: [...c.optionIds],
  lines: c.lines.map((l) => ({ ...l, uid: uid(), optionIds: [...l.optionIds] })),
});

export function toRequest(draft: Draft): OrderRequest {
  return {
    containers: draft.containers.map((c) => ({
      containerTypeId: c.containerTypeId,
      count: c.count,
      optionIds: c.optionIds,
      lines: c.lines.map((l) => ({ packagingId: l.packagingId, quantity: l.quantity, optionIds: l.optionIds })),
    })),
    optionIds: draft.optionIds,
    deliveryTermId: draft.deliveryTermId,
  };
}

/** Physical containers in the draft (Σ count). */
export const physicalCount = (draft: Draft) => draft.containers.reduce((a, c) => a + c.count, 0);

/** Selecting an option clears the other members of its group. */
export function toggleOption(selected: number[], options: CatalogOption[], id: number, on: boolean): number[] {
  const o = options.find((x) => x.id === id);
  if (!o || o.isMandatory) return selected;
  let next = selected.filter((x) => x !== id);
  if (on) {
    if (o.groupName) next = next.filter((x) => options.find((y) => y.id === x)?.groupName !== o.groupName);
    next.push(id);
  }
  return next;
}

export function loadDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable (private mode, blocked) — the configurator still works */
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
