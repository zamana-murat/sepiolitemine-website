/** Client-side shapes of the admin API (JSON: timestamps arrive as ISO strings). */

export type PriceType = 'fixed' | 'per_unit' | 'per_ton' | 'per_container' | 'percent';
export type PackagingType = 'bigbag' | 'pallet';
export type PriceBasis = 'per_unit' | 'per_ton';
export type DocType = 'tds' | 'msds' | 'coa' | 'certificate' | 'other';
export type Currency = 'USD' | 'EUR';

export interface ProductSpec {
  labelEn: string;
  labelTr: string;
  value: string;
  unit?: string;
}

export interface Product {
  id: number;
  slug: string;
  nameEn: string;
  nameTr: string;
  descriptionEn: string;
  descriptionTr: string;
  hsCode: string | null;
  specs: ProductSpec[];
  active: boolean;
  sortOrder: number;
}

export interface Packaging {
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
  active: boolean;
  sortOrder: number;
}

export interface ProductDocument {
  id: number;
  productId: number;
  docType: DocType;
  titleEn: string;
  titleTr: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  isPublic: boolean;
  sortOrder: number;
}

export interface OptionRow {
  id: number;
  nameEn: string;
  nameTr: string;
  descriptionEn: string;
  descriptionTr: string;
  groupName: string | null;
  priceType: PriceType;
  amount: number;
  isMandatory: boolean;
  isDefault: boolean;
  active: boolean;
  sortOrder: number;
  productId?: number;
  containerTypeId?: number | null;
}

export interface ProductDetail extends Product {
  packagings: Packaging[];
  documents: ProductDocument[];
  options: OptionRow[];
}

export interface ContainerType {
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
  enabled: boolean;
  sortOrder: number;
}

export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const;
export type Incoterm = (typeof INCOTERMS)[number];

export interface Settings {
  currency: Currency;
  quote_validity_days: number;
  quote_number_prefix: string;
  incoterm: Incoterm;
  incoterm_place: string;
  payment_terms_en: string;
  payment_terms_tr: string;
  offer_notes_en: string;
  offer_notes_tr: string;
}

export type QuoteStatus = 'new' | 'contacted' | 'won' | 'lost';
export type EmailStatus = 'sent' | 'failed' | 'skipped' | null;

export interface QuoteListRow {
  id: number;
  number: string;
  createdAt: string;
  validUntil: string;
  locale: 'en' | 'tr';
  currency: Currency;
  totalCents: number;
  customerName: string;
  customerCompany: string;
  customerEmail: string;
  customerCountry: string;
  status: QuoteStatus;
  emailStatus: EmailStatus;
  containers: number;
}

export interface QuoteList {
  rows: QuoteListRow[];
  total: number;
  page: number;
  pageSize: number;
}
