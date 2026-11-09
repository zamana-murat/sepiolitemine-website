/**
 * Builds the public quote catalog from D1. Used by GET /api/quote/catalog and
 * by the server-side recalculation before a soft offer PDF — both see the same data.
 * Mapping is explicit so the shape is checked against src/lib/quote/types.ts.
 */
import { asc, eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { Catalog, CatalogOption, Currency } from '../src/lib/quote/types';
import * as schema from './db/schema';

const {
  containerOptions,
  containerTypes,
  deliveryTerms,
  orderOptions,
  productDocuments,
  productOptions,
  productPackagings,
  products,
  settings,
} = schema;

type OptionRow = typeof productOptions.$inferSelect | typeof containerOptions.$inferSelect | typeof orderOptions.$inferSelect;

const toOption = (o: OptionRow): CatalogOption => ({
  id: o.id,
  nameEn: o.nameEn,
  nameTr: o.nameTr,
  descriptionEn: o.descriptionEn,
  descriptionTr: o.descriptionTr,
  longDescriptionEn: o.longDescriptionEn,
  longDescriptionTr: o.longDescriptionTr,
  groupName: o.groupName,
  priceType: o.priceType,
  amount: o.amount,
  isMandatory: o.isMandatory,
  isDefault: o.isDefault,
  sortOrder: o.sortOrder,
});

export async function loadCatalog(d: DrizzleD1Database<typeof schema>): Promise<Catalog> {
  const [prods, packs, docs, pOpts, cTypes, cOpts, oOpts, terms, sets] = await Promise.all([
    d.select().from(products).where(eq(products.active, true))
      .orderBy(asc(products.sortOrder), asc(products.id)),
    d.select().from(productPackagings).where(eq(productPackagings.active, true))
      .orderBy(asc(productPackagings.sortOrder), asc(productPackagings.id)),
    d.select().from(productDocuments).where(eq(productDocuments.isPublic, true))
      .orderBy(asc(productDocuments.sortOrder), asc(productDocuments.id)),
    d.select().from(productOptions).where(eq(productOptions.active, true))
      .orderBy(asc(productOptions.sortOrder), asc(productOptions.id)),
    d.select().from(containerTypes).where(eq(containerTypes.enabled, true))
      .orderBy(asc(containerTypes.sortOrder), asc(containerTypes.id)),
    d.select().from(containerOptions).where(eq(containerOptions.active, true))
      .orderBy(asc(containerOptions.sortOrder), asc(containerOptions.id)),
    d.select().from(orderOptions).where(eq(orderOptions.active, true))
      .orderBy(asc(orderOptions.sortOrder), asc(orderOptions.id)),
    d.select().from(deliveryTerms).where(eq(deliveryTerms.active, true))
      .orderBy(asc(deliveryTerms.sortOrder), asc(deliveryTerms.id)),
    d.select().from(settings),
  ]);

  const setting = Object.fromEntries(sets.map((s) => [s.key, s.value])) as Record<string, unknown>;

  return {
    currency: (setting.currency as Currency | undefined) ?? 'USD',
    quoteValidityDays: (setting.quote_validity_days as number | undefined) ?? 30,
    products: prods
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        nameEn: p.nameEn,
        nameTr: p.nameTr,
        descriptionEn: p.descriptionEn,
        descriptionTr: p.descriptionTr,
        hsCode: p.hsCode,
        specs: p.specs,
        sortOrder: p.sortOrder,
        packagings: packs
          .filter((x) => x.productId === p.id)
          .map((x) => ({
            id: x.id,
            productId: x.productId,
            type: x.type,
            nameEn: x.nameEn,
            nameTr: x.nameTr,
            netWeightKg: x.netWeightKg,
            grossWeightKg: x.grossWeightKg,
            lengthMm: x.lengthMm,
            widthMm: x.widthMm,
            heightMm: x.heightMm,
            maxTiers: x.maxTiers,
            allowRotation: x.allowRotation,
            priceBasis: x.priceBasis,
            priceCents: x.priceCents,
            sortOrder: x.sortOrder,
          })),
        options: pOpts.filter((x) => x.productId === p.id).map(toOption),
        documents: docs
          .filter((x) => x.productId === p.id)
          .map((x) => ({
            id: x.id,
            productId: x.productId,
            docType: x.docType,
            titleEn: x.titleEn,
            titleTr: x.titleTr,
            fileName: x.fileName,
            sizeBytes: x.sizeBytes,
            url: `/api/quote/documents/${x.id}`,
          })),
      }))
      // A product without an active packaging cannot be loaded into a container.
      .filter((p) => p.packagings.length > 0),
    containers: cTypes.map((t) => ({
      id: t.id,
      code: t.code,
      nameEn: t.nameEn,
      nameTr: t.nameTr,
      innerLengthMm: t.innerLengthMm,
      innerWidthMm: t.innerWidthMm,
      innerHeightMm: t.innerHeightMm,
      doorWidthMm: t.doorWidthMm,
      doorHeightMm: t.doorHeightMm,
      tareKg: t.tareKg,
      maxPayloadKg: t.maxPayloadKg,
      practicalPayloadKg: t.practicalPayloadKg,
      payloadLimitKg: t.practicalPayloadKg ?? t.maxPayloadKg,
      sortOrder: t.sortOrder,
      options: cOpts.filter((o) => o.containerTypeId === null || o.containerTypeId === t.id).map(toOption),
    })),
    orderOptions: oOpts.map(toOption),
    deliveryTerms: terms.map((x) => ({
      id: x.id,
      incoterm: x.incoterm,
      placeEn: x.placeEn,
      placeTr: x.placeTr,
      paymentTermsEn: x.paymentTermsEn,
      paymentTermsTr: x.paymentTermsTr,
      notesEn: x.notesEn,
      notesTr: x.notesTr,
      priceType: x.priceType,
      amount: x.amount,
      sortOrder: x.sortOrder,
    })),
  };
}
