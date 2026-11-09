/**
 * Quote module — D1 (SQLite) schema.
 *
 * Money is stored as integer cents in the quote currency (settings.currency).
 * Option `amount` semantics depend on `priceType`:
 *   fixed          → cents, once per line / container / order
 *   per_unit       → cents per packaging unit (bigbag / pallet)
 *   per_ton        → cents per metric ton of net product weight
 *   per_container  → cents per container in the order
 *   percent        → basis points (100 = 1%) of the goods subtotal at that level
 * Allowed price types per scope are enforced in server/validation.ts.
 */
import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { OrderRequest, QuoteResult } from '../../src/lib/quote/types';

export const PACKAGING_TYPES = ['bigbag', 'pallet'] as const;
export const PRICE_BASES = ['per_unit', 'per_ton'] as const;
export const PRICE_TYPES = ['fixed', 'per_unit', 'per_ton', 'per_container', 'percent'] as const;
export const DOC_TYPES = ['tds', 'msds', 'coa', 'certificate', 'other'] as const;
export const QUOTE_STATUSES = ['new', 'contacted', 'won', 'lost'] as const;
export const EMAIL_STATUSES = ['sent', 'failed', 'skipped'] as const;
export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const;
export const DELIVERY_PRICE_TYPES = ['fixed', 'per_container', 'per_ton', 'percent'] as const;

/**
 * Commercial terms printed on the soft offer: snapshot of the chosen delivery term + settings at
 * request time. Offers issued before delivery terms existed have no incotermPlaceTr / deliveryTermId.
 */
export type OfferTerms = {
  incoterm: (typeof INCOTERMS)[number] | null;
  /** English place name (also the fallback for Turkish). */
  incotermPlace: string;
  incotermPlaceTr?: string;
  deliveryTermId?: number | null;
  paymentTermsEn: string;
  paymentTermsTr: string;
  notesEn: string;
  notesTr: string;
  validityDays: number;
};

export type ProductSpec = { labelEn: string; labelTr: string; value: string; unit?: string };

const timestamps = () => ({
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/** Shared shape of product / container / order options. Mandatory option = always-applied fee. */
const optionColumns = () => ({
  id: integer('id').primaryKey({ autoIncrement: true }),
  nameEn: text('name_en').notNull(),
  nameTr: text('name_tr').notNull(),
  /** Short description: tooltip on hover in the configurator. */
  descriptionEn: text('description_en').notNull().default(''),
  descriptionTr: text('description_tr').notNull().default(''),
  /** Long description: opened in a centred panel when the option name is clicked. Plain text, blank line = paragraph. */
  longDescriptionEn: text('long_description_en').notNull().default(''),
  longDescriptionTr: text('long_description_tr').notNull().default(''),
  /** Options sharing a groupName are mutually exclusive (radio); null = independent checkbox. */
  groupName: text('group_name'),
  priceType: text('price_type', { enum: PRICE_TYPES }).notNull(),
  amount: integer('amount').notNull(),
  isMandatory: integer('is_mandatory', { mode: 'boolean' }).notNull().default(false),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps(),
});

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameTr: text('name_tr').notNull(),
  descriptionEn: text('description_en').notNull().default(''),
  descriptionTr: text('description_tr').notNull().default(''),
  hsCode: text('hs_code'),
  specs: text('specs', { mode: 'json' }).$type<ProductSpec[]>().notNull().default(sql`'[]'`),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps(),
});

export const productPackagings = sqliteTable(
  'product_packagings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    type: text('type', { enum: PACKAGING_TYPES }).notNull(),
    nameEn: text('name_en').notNull(),
    nameTr: text('name_tr').notNull(),
    netWeightKg: real('net_weight_kg').notNull(),
    grossWeightKg: real('gross_weight_kg').notNull(),
    lengthMm: integer('length_mm').notNull(),
    widthMm: integer('width_mm').notNull(),
    heightMm: integer('height_mm').notNull(),
    /** How many units may be stacked on top of each other (1 = no stacking). */
    maxTiers: integer('max_tiers').notNull().default(1),
    /** Unit may be turned 90° on the container floor. */
    allowRotation: integer('allow_rotation', { mode: 'boolean' }).notNull().default(true),
    priceBasis: text('price_basis', { enum: PRICE_BASES }).notNull().default('per_ton'),
    priceCents: integer('price_cents').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('idx_packagings_product').on(t.productId)],
);

export const productDocuments = sqliteTable(
  'product_documents',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    docType: text('doc_type', { enum: DOC_TYPES }).notNull(),
    titleEn: text('title_en').notNull(),
    titleTr: text('title_tr').notNull(),
    r2Key: text('r2_key').notNull().unique(),
    fileName: text('file_name').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index('idx_documents_product').on(t.productId)],
);

export const productOptions = sqliteTable(
  'product_options',
  {
    ...optionColumns(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
  },
  (t) => [index('idx_product_options_product').on(t.productId)],
);

export const containerTypes = sqliteTable('container_types', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameTr: text('name_tr').notNull(),
  innerLengthMm: integer('inner_length_mm').notNull(),
  innerWidthMm: integer('inner_width_mm').notNull(),
  innerHeightMm: integer('inner_height_mm').notNull(),
  doorWidthMm: integer('door_width_mm').notNull(),
  doorHeightMm: integer('door_height_mm').notNull(),
  tareKg: integer('tare_kg').notNull(),
  /** Technical max payload (ISO / manufacturer). */
  maxPayloadKg: integer('max_payload_kg').notNull(),
  /** Commercial limit actually applied (road / carrier rules). Null → maxPayloadKg. */
  practicalPayloadKg: integer('practical_payload_kg'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps(),
});

export const containerOptions = sqliteTable(
  'container_options',
  {
    ...optionColumns(),
    /** Null → option applies to every container type. */
    containerTypeId: integer('container_type_id').references(() => containerTypes.id, {
      onDelete: 'cascade',
    }),
  },
  (t) => [index('idx_container_options_type').on(t.containerTypeId)],
);

export const orderOptions = sqliteTable('order_options', optionColumns());

/**
 * Delivery terms the customer chooses from, e.g. FOB Mersin, FOB İzmir: each with its own payment
 * terms, notes and an optional order-level price adjustment (amount semantics as order options).
 */
export const deliveryTerms = sqliteTable('delivery_terms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  incoterm: text('incoterm', { enum: INCOTERMS }).notNull(),
  placeEn: text('place_en').notNull(),
  placeTr: text('place_tr').notNull(),
  paymentTermsEn: text('payment_terms_en').notNull().default(''),
  paymentTermsTr: text('payment_terms_tr').notNull().default(''),
  notesEn: text('notes_en').notNull().default(''),
  notesTr: text('notes_tr').notNull().default(''),
  priceType: text('price_type', { enum: DELIVERY_PRICE_TYPES }).notNull().default('fixed'),
  amount: integer('amount').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps(),
});

/** Key/value settings (currency, quote validity, numbering, general offer notes). Value is JSON. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/**
 * Soft offers requested from the public configurator. `request` / `result` / `terms` are
 * snapshots: later catalog or settings edits never change an issued offer.
 * Number = `${prefix}-${year}-${seq:0000}`; seq comes from quote_counters, so a deleted offer's
 * number is never reused.
 */
export const quotes = sqliteTable(
  'quotes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    year: integer('year').notNull(),
    seq: integer('seq').notNull(),
    number: text('number').notNull().unique(),
    /** Unguessable id for the customer's PDF link. */
    publicId: text('public_id').notNull().unique(),
    locale: text('locale', { enum: ['en', 'tr'] }).notNull(),
    currency: text('currency').notNull(),
    customerName: text('customer_name').notNull(),
    customerCompany: text('customer_company').notNull(),
    customerEmail: text('customer_email').notNull(),
    customerCountry: text('customer_country').notNull(),
    customerPhone: text('customer_phone').notNull().default(''),
    customerNote: text('customer_note').notNull().default(''),
    request: text('request', { mode: 'json' }).$type<OrderRequest>().notNull(),
    result: text('result', { mode: 'json' }).$type<QuoteResult>().notNull(),
    terms: text('terms', { mode: 'json' }).$type<OfferTerms>().notNull(),
    totalCents: integer('total_cents').notNull(),
    validUntil: integer('valid_until', { mode: 'timestamp' }).notNull(),
    pdfKey: text('pdf_key'),
    emailStatus: text('email_status', { enum: EMAIL_STATUSES }),
    status: text('status', { enum: QUOTE_STATUSES }).notNull().default('new'),
    adminNote: text('admin_note').notNull().default(''),
    /** SHA-256 of the client IP (rate limiting only; the address itself is not stored). */
    ipHash: text('ip_hash').notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('uq_quotes_year_seq').on(t.year, t.seq),
    index('idx_quotes_created').on(t.createdAt),
    index('idx_quotes_email').on(t.customerEmail, t.createdAt),
    index('idx_quotes_ip').on(t.ipHash, t.createdAt),
  ],
);

/** Last issued offer sequence per year (allocated in the same D1 batch as the quote insert). */
export const quoteCounters = sqliteTable('quote_counters', {
  year: integer('year').primaryKey(),
  seq: integer('seq').notNull(),
});
