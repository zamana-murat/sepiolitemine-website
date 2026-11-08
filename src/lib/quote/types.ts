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

/* ───────────── Catalog (GET /api/quote/catalog) ───────────── */

export interface CatalogOption {
  id: number;
  nameEn: string;
  nameTr: string;
  descriptionEn: string;
  descriptionTr: string;
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

export interface Catalog {
  currency: Currency;
  quoteValidityDays: number;
  products: CatalogProduct[];
  containers: CatalogContainer[];
  orderOptions: CatalogOption[];
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
  optionIds: number[];
  lines: LineRequest[];
}

export interface OrderRequest {
  containers: ContainerRequest[];
  optionIds: number[];
}

/* ───────────── Result ───────────── */

export type IssueCode =
  | 'no_containers'
  | 'too_many_containers'
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

export interface ContainerResult {
  containerTypeId: number;
  code: string;
  nameEn: string;
  nameTr: string;
  lines: LineResult[];
  linesTotalCents: number;
  options: AppliedOption[];
  totalCents: number;
  load: LoadResult | null;
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
  totalCents: number;
  totals: { containers: number; units: number; netKg: number; grossKg: number };
}
