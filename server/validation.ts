/**
 * Zod schemas for admin input. Shared with the admin UI (Phase Q1) for client-side checks.
 */
import { z } from 'zod';
import { DELIVERY_PRICE_TYPES, DOC_TYPES, INCOTERMS, PACKAGING_TYPES, PRICE_BASES, QUOTE_STATUSES } from './db/schema';

const name = z.string().trim().min(1).max(200);
const longText = z.string().trim().max(5000).default('');
const sortOrder = z.number().int().min(0).max(100000).default(0);
const cents = z.number().int().min(0).max(1_000_000_000);

export const productSpec = z.object({
  labelEn: z.string().trim().min(1).max(100),
  labelTr: z.string().trim().min(1).max(100),
  value: z.string().trim().min(1).max(200),
  unit: z.string().trim().max(30).optional(),
});

export const productInput = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase-kebab-case'),
  nameEn: name,
  nameTr: name,
  descriptionEn: longText,
  descriptionTr: longText,
  hsCode: z.string().trim().max(20).nullable().default(null),
  specs: z.array(productSpec).max(50).default([]),
  active: z.boolean().default(true),
  sortOrder,
});

export const packagingInput = z
  .object({
    type: z.enum(PACKAGING_TYPES),
    nameEn: name,
    nameTr: name,
    netWeightKg: z.number().positive().max(5000),
    grossWeightKg: z.number().positive().max(5000),
    lengthMm: z.number().int().positive().max(3000),
    widthMm: z.number().int().positive().max(3000),
    heightMm: z.number().int().positive().max(3000),
    maxTiers: z.number().int().min(1).max(5).default(1),
    allowRotation: z.boolean().default(true),
    priceBasis: z.enum(PRICE_BASES).default('per_ton'),
    priceCents: cents,
    active: z.boolean().default(true),
    sortOrder,
  })
  .refine((p) => p.grossWeightKg >= p.netWeightKg, {
    message: 'grossWeightKg must be >= netWeightKg',
    path: ['grossWeightKg'],
  });

/** Allowed price types per scope — see the amount semantics in db/schema.ts. */
export const PRICE_TYPES_BY_SCOPE = {
  product: ['fixed', 'per_unit', 'per_ton', 'percent'],
  container: ['fixed', 'per_ton', 'percent'],
  order: ['fixed', 'per_ton', 'per_container', 'percent'],
} as const;

const optionBase = <T extends readonly [string, ...string[]]>(priceTypes: T) =>
  z
    .object({
      nameEn: name,
      nameTr: name,
      descriptionEn: z.string().trim().max(300).default(''),
      descriptionTr: z.string().trim().max(300).default(''),
      longDescriptionEn: longText,
      longDescriptionTr: longText,
      groupName: z.string().trim().min(1).max(100).nullable().default(null),
      priceType: z.enum(priceTypes),
      amount: z.number().int().min(-1_000_000_000).max(1_000_000_000),
      isMandatory: z.boolean().default(false),
      isDefault: z.boolean().default(false),
      active: z.boolean().default(true),
      sortOrder,
    })
    .refine((o) => o.priceType !== 'percent' || (o.amount >= -10000 && o.amount <= 10000), {
      message: 'percent amount is basis points, range -10000..10000',
      path: ['amount'],
    });

export const productOptionInput = optionBase(PRICE_TYPES_BY_SCOPE.product);
export const containerOptionInput = optionBase(PRICE_TYPES_BY_SCOPE.container).and(
  z.object({ containerTypeId: z.number().int().positive().nullable().default(null) }),
);
export const orderOptionInput = optionBase(PRICE_TYPES_BY_SCOPE.order);

export const containerTypeUpdate = z
  .object({
    nameEn: name,
    nameTr: name,
    innerLengthMm: z.number().int().positive().max(20000),
    innerWidthMm: z.number().int().positive().max(5000),
    innerHeightMm: z.number().int().positive().max(5000),
    doorWidthMm: z.number().int().positive().max(5000),
    doorHeightMm: z.number().int().positive().max(5000),
    tareKg: z.number().int().positive().max(10000),
    maxPayloadKg: z.number().int().positive().max(40000),
    practicalPayloadKg: z.number().int().positive().max(40000).nullable(),
    enabled: z.boolean(),
    sortOrder: z.number().int().min(0).max(100000),
  })
  .partial();

export const documentMeta = z.object({
  docType: z.enum(DOC_TYPES),
  titleEn: name,
  titleTr: name,
  isPublic: z.boolean().default(true),
  sortOrder,
});

export const settingsInput = z
  .object({
    currency: z.enum(['USD', 'EUR']),
    quote_validity_days: z.number().int().min(1).max(365),
    quote_number_prefix: z.string().trim().regex(/^[A-Z]{1,6}$/),
    offer_notes_en: z.string().trim().max(2000),
    offer_notes_tr: z.string().trim().max(2000),
  })
  .partial();

/** Delivery term (Incoterm + place) with its own payment terms and optional price adjustment. */
export const deliveryTermInput = z
  .object({
    incoterm: z.enum(INCOTERMS),
    placeEn: z.string().trim().min(1).max(120),
    placeTr: z.string().trim().min(1).max(120),
    paymentTermsEn: z.string().trim().max(500).default(''),
    paymentTermsTr: z.string().trim().max(500).default(''),
    notesEn: z.string().trim().max(2000).default(''),
    notesTr: z.string().trim().max(2000).default(''),
    priceType: z.enum(DELIVERY_PRICE_TYPES).default('fixed'),
    amount: z.number().int().min(-1_000_000_000).max(1_000_000_000).default(0),
    active: z.boolean().default(true),
    sortOrder,
  })
  .refine((o) => o.priceType !== 'percent' || (o.amount >= -10000 && o.amount <= 10000), {
    message: 'percent amount is basis points, range -10000..10000',
    path: ['amount'],
  });

/* ───────────── Public soft offer request ───────────── */

const id = z.number().int().positive();
const ids = z.array(id).max(50);

/** Shape only; business limits (max containers, lines, quantity) are reported by computeQuote. */
export const orderRequestInput = z.object({
  containers: z
    .array(
      z.object({
        containerTypeId: id,
        count: z.number().int().optional(),
        optionIds: ids,
        lines: z.array(z.object({ packagingId: id, quantity: z.number().int(), optionIds: ids })).max(100),
      }),
    )
    .max(100),
  optionIds: ids,
  deliveryTermId: id.nullable().optional(),
});

const field = (min: number, max: number) => z.string().trim().min(min).max(max);

export const quoteRequestInput = z.object({
  locale: z.enum(['en', 'tr']),
  customer: z.object({
    name: field(2, 120),
    company: field(2, 160),
    email: z.string().trim().toLowerCase().max(200).pipe(z.email()),
    country: field(2, 80),
    phone: z.string().trim().max(40).default(''),
    note: z.string().trim().max(2000).default(''),
  }),
  order: orderRequestInput,
  /** Total the customer saw; a mismatch means the catalog changed meanwhile (→ 409). */
  expectedTotalCents: z.number().int(),
  turnstileToken: z.string().max(4096),
  consent: z.literal(true),
  /** Honeypot: must stay empty. */
  website: z.string().max(0).optional(),
});

export const quoteUpdateInput = z
  .object({
    status: z.enum(QUOTE_STATUSES),
    adminNote: z.string().trim().max(5000),
  })
  .partial();
