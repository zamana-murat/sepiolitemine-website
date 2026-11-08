/** Settings that shape a soft offer (currency, validity, numbering, commercial terms). */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { Currency } from '../src/lib/quote/types';
import * as schema from './db/schema';
import type { OfferTerms } from './db/schema';

export interface OfferSettings {
  currency: Currency;
  prefix: string;
  terms: OfferTerms;
}

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

export async function loadOfferSettings(d: DrizzleD1Database<typeof schema>): Promise<OfferSettings> {
  const rows = await d.select().from(schema.settings);
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, unknown>;
  const incoterm = (schema.INCOTERMS as readonly string[]).includes(str(s.incoterm))
    ? (s.incoterm as OfferTerms['incoterm'])
    : 'FOB';
  return {
    currency: s.currency === 'EUR' ? 'EUR' : 'USD',
    prefix: /^[A-Z]{1,6}$/.test(str(s.quote_number_prefix)) ? str(s.quote_number_prefix) : 'SM',
    terms: {
      incoterm,
      incotermPlace: str(s.incoterm_place),
      paymentTermsEn: str(s.payment_terms_en),
      paymentTermsTr: str(s.payment_terms_tr),
      notesEn: str(s.offer_notes_en),
      notesTr: str(s.offer_notes_tr),
      validityDays: typeof s.quote_validity_days === 'number' ? s.quote_validity_days : 30,
    },
  };
}
