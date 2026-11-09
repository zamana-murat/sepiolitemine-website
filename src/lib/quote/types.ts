/**
 * Quote engine — shared types (browser configurator + server).
 *
 * Money: integer cents in `Catalog.currency`. Weights: kg. Dimensions: mm.
 * Option `amount`: cents, or basis points when priceType = 'percent' (100 = 1%).
 */

export type Currency = 'USD' | 'EUR';
export type PriceType = 'fixed' | 'per_unit' | 'per_ton' | 'per_container' | 'percent';
export type PackagingType = 'bigbag' | 'pallet';
export type PriceBasis = 'per_unit' | 'per_ton';
export type DocType = 'tds' | 'msds' | 'coa' | 'certificate' | 'other';
export type Incoterm = 'EXW' | 'FCA' | 'FAS' | 'FOB' | 'CFR' | 'CIF' | 'CPT' | 'CIP' | 'DAP' | 'DPU' | 'DDP';
/** Price adjustment of a delivery term (order level, like an order option). */
export type DeliveryPriceType = 'fixed' | 'per_container' | 'per_ton' | 'percent';

/* ───────────── Catalog (GET /api/quote/catalog) ───────────── */

export interface CatalogOption {
  id: number;
  nameEn: string;
  nameTr: string;
  /** Short description (tooltip). */
  descriptionEn: string;
  descriptionTr: string;
  /** Long description (centred panel); plain text, blank line = paragraph. */
  longDescriptionEn: string;
  longDescriptionTr: string;
  /** Options sharing a group are mutually exclusive. */
  groupName: string | null;
  priceType: PriceType;
  amount: number;
  /** Always applied; the customer cannot remove it. */
  isMandatory: boolean;
  /** Pre-selected in the configurator (UI concern; the engine applies only what is requested). */
  isDefault: boolean;
  sortOrder: number;
}

export interface CatalogPackaging {
  id: number;
  productId: number;
  type: PackagingType;
  nameEn: string;
  nameTr: string;
  netWeightKg: number;
  grossWeightKg: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  maxTiers: number;
  allowRotation: boolean;
  priceBasis: PriceBasis;
  priceCents: number;
  sortOrder: number;
}

export interface CatalogDocument {
  id: number;
  productId: number;
  docType: DocType;
  titleEn: string;
  titleTr: string;
  fileName: string;
  sizeBytes: number;
  url: string;
}

export interface ProductSpec {
  labelEn: string;
  labelTr: string;
  value: string;
  unit?: string;
}

export interface CatalogProduct {
  id: number;
  slug: string;
  nameEn: string;
  nameTr: string;
  descriptionEn: string;
  descriptionTr: string;
  hsCode: string | null;
  specs: ProductSpec[];
  sortOrder: number;
  packagings: CatalogPackaging[];
  options: CatalogOption[];
  documents: CatalogDocument[];
}

export interface CatalogContainer {
  id: number;
  code: string;
  nameEn: string;
  nameTr: string;
  innerLengthMm: number;
  innerWidthMm: number;
  innerHeightMm: number;
  doorWidthMm: number;
  doorHeightMm: number;
  tareKg: number;
  maxPayloadKg: number;
  practicalPayloadKg: number | null;
  /** practicalPayloadKg ?? maxPayloadKg — the limit the engine enforces. */
  payloadLimitKg: number;
  sortOrder: number;
  options: CatalogOption[];
}

/**
 * A delivery term the admin offers, e.g. "FOB Mersin" or "FOB İzmir": Incoterm + place + its own
 * payment terms, notes and an optional price adjustment on the whole order.
 */
export interface CatalogDeliveryTerm {
  id: number;
  incoterm: Incoterm;
  placeEn: string;
  placeTr: string;
  paymentTermsEn: string;
  paymentTermsTr: string;
  notesEn: string;
  notesTr: string;
  priceType: DeliveryPriceType;
  /** Cents, or basis points when priceType = 'percent'. 0 = prices already include this delivery. */
  amount: number;
  sortOrder: number;
}

export interface Catalog {
  currency: Currency;
  quoteValidityDays: number;
  products: CatalogProduct[];
  containers: CatalogContainer[];
  orderOptions: CatalogOption[];
  /** Ordered; the first one is the default choice. Empty → no delivery term on the offer. */
  deliveryTerms: CatalogDeliveryTerm[];
}

/** GET /api/quote/catalog response: the catalog plus public form config. */
export interface CatalogResponse extends Catalog {
  /** Turnstile site key for the soft offer form; null → the form is not available. */
  turnstileSiteKey: string | null;
}

/* ───────────── Request ───────────── */

export interface LineRequest {
  packagingId: number;
  quantity: number;
  /** Selected non-mandatory product options (mandatory ones are added automatically). */
  optionIds: number[];
}

export interface ContainerRequest {
  containerTypeId: number;
  /** How many identical containers of this configuration (default 1). */
  count?: number;
  optionIds: number[];
  lines: LineRequest[];
}

export interface OrderRequest {
  containers: ContainerRequest[];
  optionIds: number[];
  /** Required when the catalog offers delivery terms. */
  deliveryTermId?: number | null;
}

/* ───────────── Result ───────────── */

export type IssueCode =
  | 'no_containers'
  | 'too_many_containers'
  | 'invalid_container_count'
  | 'no_delivery_term'
  | 'unknown_delivery_term'
  | 'too_many_lines'
  | 'unknown_container'
  | 'empty_container'
  | 'unknown_packaging'
  | 'invalid_quantity'
  | 'unknown_option'
  | 'option_group_conflict'
  | 'unit_too_tall'
  | 'unit_too_large'
  | 'unit_door'
  | 'container_overweight'
  | 'container_floor_overflow'
  | 'container_low_utilization';

export interface QuoteIssue {
  code: IssueCode;
  /** Location in the request, e.g. "containers.0.lines.1". */
  path: string;
  params?: Record<string, string | number>;
}

export interface AppliedOption {
  optionId: number;
  nameEn: string;
  nameTr: string;
  priceType: PriceType;
  amount: number;
  isMandatory: boolean;
  cents: number;
}

export interface LineResult {
  /** Index of this line in the request (invalid lines are skipped, so results may have gaps). */
  lineIndex: number;
  packagingId: number;
  productId: number;
  productNameEn: string;
  productNameTr: string;
  packagingNameEn: string;
  packagingNameTr: string;
  packagingType: PackagingType;
  quantity: number;
  netKg: number;
  grossKg: number;
  priceBasis: PriceBasis;
  unitPriceCents: number;
  goodsCents: number;
  options: AppliedOption[];
  totalCents: number;
}

export interface StackGroup {
  /** Identical footprint/height/tiers → may share stacks (e.g. two products in the same bigbag size). */
  key: string;
  packagingType: PackagingType;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  tiers: number;
  units: number;
  stacks: number;
  /** Container length this group occupies (full width; may exceed the container), or null if the unit cannot be placed at all. */
  floorLengthMm: number | null;
}

export interface LoadResult {
  netKg: number;
  grossKg: number;
  payloadLimitKg: number;
  /** grossKg / payloadLimitKg */
  weightUtilization: number;
  floorLengthUsedMm: number;
  /** floorLengthUsedMm / innerLengthMm (conservative: groups occupy separate full-width segments) */
  floorUtilization: number;
  /** Σ unit volume / inner volume — informational */
  volumeUtilization: number;
  groups: StackGroup[];
  fitsWeight: boolean;
  fitsFloor: boolean;
  fits: boolean;
}

/**
 * One container configuration. `lines`, `options`, `linesTotalCents`, `unitTotalCents` and `load`
 * describe a single container; `totalCents` = unitTotalCents × count.
 * Snapshots issued before `count` existed lack count/unitTotalCents (read them as 1 / totalCents).
 */
export interface ContainerResult {
  containerTypeId: number;
  code: string;
  nameEn: string;
  nameTr: string;
  count: number;
  lines: LineResult[];
  linesTotalCents: number;
  options: AppliedOption[];
  unitTotalCents: number;
  totalCents: number;
  load: LoadResult | null;
}

export interface AppliedDeliveryTerm {
  deliveryTermId: number;
  incoterm: Incoterm;
  placeEn: string;
  placeTr: string;
  priceType: DeliveryPriceType;
  amount: number;
  cents: number;
}

export interface QuoteResult {
  /** True when there are no errors (warnings allowed). */
  ok: boolean;
  errors: QuoteIssue[];
  warnings: QuoteIssue[];
  currency: Currency;
  containers: ContainerResult[];
  containersTotalCents: number;
  orderOptions: AppliedOption[];
  deliveryTerm: AppliedDeliveryTerm | null;
  totalCents: number;
  /** Physical totals: containers = Σ count; units and weights include every copy. */
  totals: { containers: number; units: number; netKg: number; grossKg: number };
}
