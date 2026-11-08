import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { computeQuote } from '../../src/lib/quote/pricing';
import type { Catalog, OrderRequest } from '../../src/lib/quote/types';
import { renderOfferPdf, type OfferPdfInput } from './offer-pdf';

const read = (p: string) => new Uint8Array(readFileSync(join(process.cwd(), 'public', p)));
const assets = {
  regular: read('fonts/pdf/OfferSans-Regular.ttf'),
  semibold: read('fonts/pdf/OfferSans-SemiBold.ttf'),
  display: read('fonts/pdf/OfferDisplay-Bold.ttf'),
  logo: read('images/logo/logo-primary-400w.png'),
};

const opt = { descriptionEn: '', descriptionTr: '', groupName: null, isDefault: false, sortOrder: 0 };
const catalog: Catalog = {
  currency: 'USD',
  quoteValidityDays: 30,
  products: [
    {
      id: 1,
      slug: 'granule',
      nameEn: 'Granulated Sepiolite',
      nameTr: 'Granül Sepiyolit',
      descriptionEn: '',
      descriptionTr: '',
      hsCode: '2530.90',
      specs: [],
      sortOrder: 0,
      documents: [],
      options: [{ ...opt, id: 1, nameEn: 'Certificate of analysis', nameTr: 'Analiz sertifikası', priceType: 'fixed', amount: 2500, isMandatory: true }],
      packagings: [
        {
          id: 11, productId: 1, type: 'bigbag', nameEn: '1000 kg Big Bag', nameTr: '1000 kg Bigbag',
          netWeightKg: 1000, grossWeightKg: 1005, lengthMm: 900, widthMm: 900, heightMm: 1100,
          maxTiers: 2, allowRotation: true, priceBasis: 'per_ton', priceCents: 18550, sortOrder: 0,
        },
      ],
    },
  ],
  containers: [
    {
      id: 1, code: '20DV', nameEn: "20' Dry Van", nameTr: "20'lik Standart",
      innerLengthMm: 5898, innerWidthMm: 2352, innerHeightMm: 2393, doorWidthMm: 2340, doorHeightMm: 2280,
      tareKg: 2230, maxPayloadKg: 28200, practicalPayloadKg: null, payloadLimitKg: 28200, sortOrder: 0,
      options: [{ ...opt, id: 2, nameEn: 'Loading supervision', nameTr: 'Yükleme gözetimi', priceType: 'fixed', amount: 9000, isMandatory: true }],
    },
  ],
  orderOptions: [{ ...opt, id: 3, nameEn: 'Advance payment discount', nameTr: 'Peşin ödeme indirimi', priceType: 'percent', amount: -200, isMandatory: false }],
};

const order = (containers: number): OrderRequest => ({
  containers: Array.from({ length: containers }, () => ({
    containerTypeId: 1,
    optionIds: [],
    lines: [{ packagingId: 11, quantity: 24, optionIds: [] }],
  })),
  optionIds: [3],
});

const input = (over: Partial<OfferPdfInput> & { containers?: number } = {}): OfferPdfInput => {
  const result = computeQuote(catalog, order(over.containers ?? 1));
  return {
    locale: 'en',
    number: 'SM-2026-0001',
    issuedAt: new Date('2026-11-08T10:00:00Z'),
    validUntil: new Date('2026-12-08T10:00:00Z'),
    customer: { name: 'Ayşe Yılmaz', company: 'Örnek İhracat Şti.', email: 'a@example.com', country: 'Türkiye', phone: '' },
    seller: { name: 'Sepiolite Mine', city: 'Ankara', country: 'Türkiye', phone: '+90 530 490 4740', website: 'sepiolitemine.com' },
    terms: { incoterm: 'FOB', incotermPlace: 'Mersin', paymentTermsEn: '30% advance', paymentTermsTr: '%30 peşin', notesEn: '', notesTr: '', validityDays: 30 },
    catalog,
    result,
    ...over,
  };
};

describe('renderOfferPdf', () => {
  it('fixture order is valid', () => {
    expect(computeQuote(catalog, order(1)).ok).toBe(true);
  });

  it.each(['en', 'tr'] as const)('renders a one-page %s offer with metadata', async (locale) => {
    const bytes = await renderOfferPdf(input({ locale }), assets);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toContain('SM-2026-0001');
    expect(doc.getAuthor()).toBe('Sepiolite Mine');
  });

  it('paginates long offers and keeps every page A4', async () => {
    const bytes = await renderOfferPdf(input({ containers: 8 }), assets);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(2);
    for (const p of doc.getPages()) {
      expect(Math.round(p.getWidth())).toBe(595);
      expect(Math.round(p.getHeight())).toBe(842);
    }
  });

  it('survives characters outside the embedded fonts', async () => {
    const odd = input({ customer: { ...input().customer, company: 'Emoji 🚢 Ltd · 中文 · Ω x' } });
    await expect(renderOfferPdf(odd, assets)).resolves.toBeInstanceOf(Uint8Array);
  });

  it('works without a logo', async () => {
    const { logo: _l, ...noLogo } = assets;
    const bytes = await renderOfferPdf(input(), noLogo);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
