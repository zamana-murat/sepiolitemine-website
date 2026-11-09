/** Settings that shape a soft offer (currency, validity, numbering, general notes) + the chosen delivery term. */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { CatalogDeliveryTerm, Currency } from '../src/lib/quote/types';
import * as schema from './db/schema';
import type { OfferTerms } from './db/schema';

export interface OfferSettings {
  currency: Currency;
  prefix: string;
  validityDays: number;
  /** General notes printed on every offer (the delivery term may add its own). */
  notesEn: string;
  notesTr: string;
}

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

export async function loadOfferSettings(d: DrizzleD1Database<typeof schema>): Promise<OfferSettings> {
  const rows = await d.select().from(schema.settings);
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, unknown>;
  return {
    currency: s.currency === 'EUR' ? 'EUR' : 'USD',
    prefix: /^[A-Z]{1,6}$/.test(str(s.quote_number_prefix)) ? str(s.quote_number_prefix) : 'SM',
    validityDays: typeof s.quote_validity_days === 'number' ? s.quote_validity_days : 30,
    notesEn: str(s.offer_notes_en),
    notesTr: str(s.offer_notes_tr),
  };
}

const joinNotes = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join('\n\n');

/** Terms snapshot stored with the offer and printed on the PDF. */
export function offerTerms(settings: OfferSettings, term: CatalogDeliveryTerm | null): OfferTerms {
  return {
    incoterm: term?.incoterm ?? null,
    incotermPlace: term?.placeEn ?? '',
    incotermPlaceTr: term?.placeTr ?? '',
    deliveryTermId: term?.id ?? null,
    paymentTermsEn: term?.paymentTermsEn ?? '',
    paymentTermsTr: term?.paymentTermsTr ?? '',
    notesEn: joinNotes(term?.notesEn ?? '', settings.notesEn),
    notesTr: joinNotes(term?.notesTr ?? '', settings.notesTr),
    validityDays: settings.validityDays,
  };
}
