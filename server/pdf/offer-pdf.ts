/**
 * Soft offer PDF (A4, EN or TR). Pure: takes the computed quote + font/logo bytes, returns PDF
 * bytes. Runs in Workers and Node (tests). Fonts are pre-subset static TTFs (public/fonts/pdf),
 * embedded whole, so Turkish glyphs and kerning-free metrics are predictable.
 */
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';
import { planLoad, type LoadItem } from '../../src/lib/quote/loading';
import type { AppliedOption, Catalog, CatalogPackaging, ContainerResult, QuoteResult } from '../../src/lib/quote/types';
import { productColors, textOn } from '../../src/quote/colors';
import { STRINGS, formatters, optionPriceLabel, type Locale } from '../../src/quote/i18n';
import type { OfferTerms } from '../db/schema';

export interface OfferPdfAssets {
  regular: Uint8Array;
  semibold: Uint8Array;
  display: Uint8Array;
  logo?: Uint8Array;
}

export interface OfferPdfInput {
  locale: Locale;
  number: string;
  issuedAt: Date;
  validUntil: Date;
  customer: { name: string; company: string; email: string; country: string; phone: string };
  seller: { name: string; city: string; country: string; phone: string; website: string };
  terms: OfferTerms;
  /** Catalog the result was computed from (packaging sizes + colours for the loading plan). */
  catalog: Catalog;
  result: QuoteResult;
}

const L = {
  en: {
    title: 'Soft Offer',
    number: 'Offer no.',
    date: 'Date',
    validUntil: 'Valid until',
    preparedFor: 'Prepared for',
    from: 'From',
    terms: 'Terms',
    incoterm: 'Delivery',
    currency: 'Currency',
    payment: 'Payment',
    validity: (d: number) => `${d} days from the offer date`,
    container: (n: number, code: string, name: string) => `Container ${n} · ${code} · ${name}`,
    loadLine: (units: string, net: string, gross: string, w: string, f: string) =>
      `${units} units · net ${net} t · gross ${gross} t · weight ${w} · floor ${f}`,
    cols: ['Product', 'Qty', 'Net t', 'Unit price', 'Amount'],
    containerServices: 'Container services',
    containerSubtotal: 'Container subtotal',
    plan: 'Loading plan, top view (door on the right). ×2 means stacked two high.',
    overflow: 'Does not fit',
    door: 'Door',
    summary: 'Offer summary',
    containers: (n: number) => `Containers (${n})`,
    total: 'Total',
    totalWeight: (net: string, gross: string, units: string) => `Net ${net} t · gross ${gross} t · ${units} units`,
    notes: 'Notes',
    page: (a: number, b: number) => `Page ${a} of ${b}`,
    hs: 'HS',
  },
  tr: {
    title: 'Ön Teklif (Soft Offer)',
    number: 'Teklif no.',
    date: 'Tarih',
    validUntil: 'Geçerlilik',
    preparedFor: 'Alıcı',
    from: 'Satıcı',
    terms: 'Koşullar',
    incoterm: 'Teslim şekli',
    currency: 'Para birimi',
    payment: 'Ödeme',
    validity: (d: number) => `Teklif tarihinden itibaren ${d} gün`,
    container: (n: number, code: string, name: string) => `${n}. konteyner · ${code} · ${name}`,
    loadLine: (units: string, net: string, gross: string, w: string, f: string) =>
      `${units} adet · net ${net} ton · brüt ${gross} ton · ağırlık ${w} · taban ${f}`,
    cols: ['Ürün', 'Adet', 'Net ton', 'Birim fiyat', 'Tutar'],
    containerServices: 'Konteyner hizmetleri',
    containerSubtotal: 'Konteyner ara toplamı',
    plan: 'Yükleme planı, üstten görünüm (kapı sağda). ×2: iki kat istif.',
    overflow: 'Sığmıyor',
    door: 'Kapı',
    summary: 'Teklif özeti',
    containers: (n: number) => `Konteynerler (${n})`,
    total: 'Toplam',
    totalWeight: (net: string, gross: string, units: string) => `Net ${net} ton · brüt ${gross} ton · ${units} adet`,
    notes: 'Notlar',
    page: (a: number, b: number) => `Sayfa ${a} / ${b}`,
    hs: 'GTİP',
  },
} as const;

/* ───────────── Layout constants (points; A4 = 595.28 × 841.89) ───────────── */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 48;
const CONTENT_W = PAGE_W - 2 * M;
const TOP = PAGE_H - M;
const BOTTOM = M + 28; // room for the footer

const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const C = {
  ink: hex('#1C1410'),
  stone: hex('#7A6652'),
  gold: hex('#C9922A'),
  cream: hex('#F7F3EE'),
  creamDark: hex('#EDE6DC'),
  line: hex('#D9CFC2'),
  red: hex('#B23A2E'),
  redSoft: hex('#F6DEDA'),
  white: rgb(1, 1, 1),
};

/** Table columns: description, qty, net t, unit price, amount (right-aligned except the first). */
const COLS = [CONTENT_W - 250, 45, 55, 75, 75];
const colX = (i: number) => M + COLS.slice(0, i).reduce((a, b) => a + b, 0);

export async function renderOfferPdf(input: OfferPdfInput, assets: OfferPdfAssets): Promise<Uint8Array> {
  const { locale, result, catalog } = input;
  const t = L[locale];
  const ui = STRINGS[locale];
  const fmt = formatters(locale, result.currency);
  const dateFmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  });

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = {
    regular: await doc.embedFont(assets.regular, { subset: false }),
    semibold: await doc.embedFont(assets.semibold, { subset: false }),
    display: await doc.embedFont(assets.display, { subset: false }),
  };
  const logo: PDFImage | null = assets.logo ? await doc.embedPng(assets.logo) : null;

  doc.setTitle(`${t.title} ${input.number}`);
  doc.setSubject(`${t.title} ${input.number} · ${input.customer.company}`);
  doc.setAuthor(input.seller.name);
  doc.setCreator(input.seller.website);
  doc.setProducer(input.seller.website);
  doc.setLanguage(locale === 'tr' ? 'tr-TR' : 'en-GB');
  doc.setCreationDate(input.issuedAt);
  doc.setModificationDate(input.issuedAt);

  /* ── text helpers ── */

  // Glyphs outside the subset (e.g. U+202F from Intl) fall back to a plain space / '?'.
  const supported = new Set(fonts.regular.getCharacterSet());
  const clean = (s: string) =>
    [...s.replace(/[   ]/g, ' ').replace(/[\r\t]/g, ' ')]
      .map((ch) => (ch === '\n' || supported.has(ch.codePointAt(0)!) ? ch : '?'))
      .join('');

  const width = (s: string, font: PDFFont, size: number) => font.widthOfTextAtSize(clean(s), size);

  function wrap(s: string, font: PDFFont, size: number, maxW: number): string[] {
    const out: string[] = [];
    for (const para of clean(s).split('\n')) {
      let line = '';
      for (const word of para.split(/ +/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(next, size) > maxW) {
          out.push(line);
          line = word;
        } else line = next;
      }
      out.push(line);
    }
    return out;
  }

  /* ── page flow ── */

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = TOP;
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    y = TOP;
  };
  const ensure = (h: number) => {
    if (y - h < BOTTOM) {
      newPage();
      y -= 8;
    }
  };

  type TextOpts = { font?: PDFFont; size?: number; color?: RGB; align?: 'left' | 'right'; maxW?: number };
  const text = (s: string, x: number, yy: number, o: TextOpts = {}) => {
    const font = o.font ?? fonts.regular;
    const size = o.size ?? 9;
    let str = clean(s);
    if (o.maxW) {
      while (str.length > 1 && font.widthOfTextAtSize(str, size) > o.maxW) str = str.slice(0, -2) + '…';
    }
    const dx = o.align === 'right' ? -font.widthOfTextAtSize(str, size) : 0;
    page.drawText(str, { x: x + dx, y: yy, size, font, color: o.color ?? C.ink });
  };
  const paragraph = (s: string, o: TextOpts & { lineH?: number } = {}) => {
    const font = o.font ?? fonts.regular;
    const size = o.size ?? 9;
    const lh = o.lineH ?? size * 1.45;
    for (const line of wrap(s, font, size, o.maxW ?? CONTENT_W)) {
      ensure(lh);
      text(line, M, y - size, { ...o, font, size });
      y -= lh;
    }
  };
  const rule = (yy: number, color = C.line, thickness = 0.6) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: M + CONTENT_W, y: yy }, thickness, color });

  /* ── header ── */

  newPage();
  if (logo) {
    const h = 40;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: M, y: y - h, width: w, height: h });
  } else {
    text(input.seller.name, M, y - 22, { font: fonts.display, size: 20 });
  }
  text(t.title, M + CONTENT_W, y - 20, { font: fonts.display, size: 20, align: 'right' });
  const meta: [string, string][] = [
    [t.number, input.number],
    [t.date, dateFmt.format(input.issuedAt)],
    [t.validUntil, dateFmt.format(input.validUntil)],
  ];
  let my = y - 36;
  for (const [k, v] of meta) {
    text(v, M + CONTENT_W, my, { font: fonts.semibold, size: 9, align: 'right' });
    text(k, M + CONTENT_W - width(v, fonts.semibold, 9) - 8, my, { size: 9, color: C.stone, align: 'right' });
    my -= 13;
  }
  y = my - 6;
  page.drawLine({ start: { x: M, y }, end: { x: M + CONTENT_W, y }, thickness: 1.5, color: C.gold });
  y -= 18;

  /* ── parties ── */

  const half = CONTENT_W / 2 - 10;
  const party = (title: string, lines: string[], x: number, top: number) => {
    let py = top;
    text(title.toUpperCase(), x, py - 8, { font: fonts.semibold, size: 7.5, color: C.stone });
    py -= 22;
    lines.filter(Boolean).forEach((l, i) => {
      text(l, x, py, { font: i === 0 ? fonts.semibold : fonts.regular, size: i === 0 ? 10.5 : 9, maxW: half });
      py -= i === 0 ? 15 : 12.5;
    });
    return py;
  };
  const c = input.customer;
  const s = input.seller;
  const yA = party(t.preparedFor, [c.company, c.name, c.email, c.phone, c.country], M, y);
  const yB = party(t.from, [s.name, `${s.city}, ${s.country}`, s.phone, s.website], M + CONTENT_W / 2 + 10, y);
  y = Math.min(yA, yB) - 6;

  /* ── terms box ── */

  const terms = input.terms;
  const payment = locale === 'tr' ? terms.paymentTermsTr : terms.paymentTermsEn;
  const termRows: [string, string][] = [
    [t.incoterm, [terms.incoterm, terms.incotermPlace].filter(Boolean).join(' · ')],
    [t.currency, result.currency],
    [t.validUntil, t.validity(terms.validityDays)],
    ...(payment ? [[t.payment, payment] as [string, string]] : []),
  ];
  const labelW = 92;
  const termLines = termRows.map(([k, v]) => ({ k, lines: wrap(v, fonts.regular, 9, CONTENT_W - labelW - 24) }));
  const boxH = 14 + termLines.reduce((a, r) => a + r.lines.length * 12.5, 0) + 6;
  ensure(boxH + 10);
  page.drawRectangle({ x: M, y: y - boxH, width: CONTENT_W, height: boxH, color: C.cream });
  let ty = y - 18;
  for (const r of termLines) {
    text(r.k, M + 12, ty, { size: 9, color: C.stone });
    for (const line of r.lines) {
      text(line, M + 12 + labelW, ty, { size: 9 });
      ty -= 12.5;
    }
  }
  y -= boxH + 20;

  /* ── containers ── */

  const colorOf = productColors(catalog);
  const packagings = new Map<number, CatalogPackaging>(
    catalog.products.flatMap((p) => p.packagings.map((x) => [x.id, x] as const)),
  );
  const productHs = new Map(catalog.products.map((p) => [p.id, p.hsCode]));

  const tableHeader = () => {
    ensure(22);
    t.cols.forEach((h, i) => {
      const x = i === 0 ? colX(0) + 4 : colX(i + 1) - 4;
      text(h, x, y - 10, { font: fonts.semibold, size: 8, color: C.stone, align: i === 0 ? 'left' : 'right' });
    });
    y -= 15;
    rule(y);
    y -= 2;
  };

  const optionRow = (o: AppliedOption, indent: number) => {
    ensure(13);
    const name = locale === 'tr' ? o.nameTr : o.nameEn;
    const label = `+ ${name}  (${optionPriceLabel(o, fmt, locale)})`;
    text(label, colX(0) + indent, y - 9.5, { size: 8.5, color: C.stone, maxW: COLS[0] + COLS[1] + COLS[2] + COLS[3] - indent - 8 });
    text(fmt.signedMoney(o.cents), colX(5) - 4, y - 9.5, { size: 8.5, color: C.stone, align: 'right' });
    y -= 13;
  };

  const drawPlan = (cr: ContainerResult) => {
    const ct = catalog.containers.find((x) => x.id === cr.containerTypeId);
    if (!ct) return;
    const items: LoadItem[] = cr.lines.flatMap((l) => {
      const p = packagings.get(l.packagingId);
      return p ? [{ packaging: p, quantity: l.quantity }] : [];
    });
    const plan = planLoad(ct, items);
    const drawn = Math.max(ct.innerLengthMm, plan.usedLengthMm);
    // Fit the width; cap the height so a 20' plan does not dominate the page.
    const scale = Math.min((CONTENT_W - 30) / drawn, 96 / ct.innerWidthMm);
    const h = ct.innerWidthMm * scale;
    ensure(h + 34);
    const x0 = M;
    const y0 = y - 8 - h; // bottom of the floor rectangle
    // PDF y grows upwards; plan y = 0 is the left wall → draw from the top edge down.
    const X = (mm: number) => x0 + mm * scale;
    const Y = (mm: number, size: number) => y0 + h - (mm + size) * scale;
    if (plan.usedLengthMm > ct.innerLengthMm) {
      page.drawRectangle({ x: X(ct.innerLengthMm), y: y0, width: (plan.usedLengthMm - ct.innerLengthMm) * scale, height: h, color: C.redSoft });
      text(t.overflow, X(ct.innerLengthMm) + 3, y0 + h + 3, { size: 7, color: C.red });
    }
    page.drawRectangle({ x: x0, y: y0, width: ct.innerLengthMm * scale, height: h, color: C.cream, borderColor: C.stone, borderWidth: 0.8 });
    const inset = Math.min(18 * scale, 1);
    for (const st of plan.placements) {
      let cursor = st.x;
      for (const u of st.units) {
        const w = (st.depth * u.count) / st.height;
        page.drawRectangle({
          x: X(cursor) + inset,
          y: Y(st.y, st.across) + inset,
          width: Math.max(w * scale - 2 * inset, 0.5),
          height: Math.max(st.across * scale - 2 * inset, 0.5),
          color: hex(colorOf(u.productId)),
          borderColor: st.overflow ? C.red : undefined,
          borderWidth: st.overflow ? 0.8 : 0,
        });
        cursor += w;
      }
      if (st.height > 1) {
        const label = `×${st.height}`;
        const size = Math.min(7, st.across * scale * 0.35);
        const fill = hex(textOn(colorOf(st.units[0]?.productId ?? 0)));
        text(label, X(st.x + st.depth / 2) + width(label, fonts.semibold, size) / 2, Y(st.y, st.across / 2) - size / 3, {
          font: fonts.semibold,
          size,
          color: fill,
          align: 'right',
        });
      }
    }
    // Door marker on the right end of the container.
    const dx = X(ct.innerLengthMm);
    page.drawLine({ start: { x: dx, y: y0 }, end: { x: dx, y: y0 + h }, thickness: 2.2, color: C.gold });
    text(t.door, dx + 4, y0 + h / 2 - 3, { size: 7, color: C.stone });
    y = y0 - 6;
    paragraph(t.plan, { size: 7.5, color: C.stone });
  };

  result.containers.forEach((cr, ci) => {
    ensure(70);
    const name = locale === 'tr' ? cr.nameTr : cr.nameEn;
    text(t.container(ci + 1, cr.code, name), M, y - 12, { font: fonts.display, size: 13 });
    y -= 18;
    if (cr.load) {
      const ld = cr.load;
      const units = cr.lines.reduce((a, l) => a + l.quantity, 0);
      text(
        t.loadLine(fmt.kg(units), fmt.tons(ld.netKg), fmt.tons(ld.grossKg), fmt.pct(ld.weightUtilization), fmt.pct(ld.floorUtilization)),
        M,
        y - 9,
        { size: 8.5, color: C.stone },
      );
      y -= 16;
    }
    tableHeader();

    for (const l of cr.lines) {
      ensure(30);
      const pName = locale === 'tr' ? l.productNameTr : l.productNameEn;
      const packName = locale === 'tr' ? l.packagingNameTr : l.packagingNameEn;
      const hs = productHs.get(l.productId);
      const swatch = hex(colorOf(l.productId));
      page.drawRectangle({ x: colX(0) + 4, y: y - 11, width: 6, height: 6, color: swatch });
      text(pName, colX(0) + 14, y - 11, { font: fonts.semibold, size: 9.5, maxW: COLS[0] - 18 });
      text(fmt.kg(l.quantity), colX(2) - 4, y - 11, { size: 9.5, align: 'right' });
      text(fmt.tons(l.netKg), colX(3) - 4, y - 11, { size: 9.5, align: 'right' });
      const basis = l.priceBasis === 'per_ton' ? ui.perTon : ui.perUnit;
      text(`${fmt.money(l.unitPriceCents)} ${basis}`, colX(4) - 4, y - 11, { size: 9.5, align: 'right' });
      text(fmt.money(l.goodsCents), colX(5) - 4, y - 11, { size: 9.5, align: 'right' });
      y -= 14;
      text(hs ? `${packName} · ${t.hs} ${hs}` : packName, colX(0) + 14, y - 9, { size: 8.5, color: C.stone, maxW: COLS[0] - 18 });
      y -= 13;
      for (const o of l.options) optionRow(o, 14);
      y -= 3;
      rule(y, C.creamDark);
      y -= 2;
    }

    if (cr.options.length > 0) {
      ensure(16);
      text(ui.containerServices, colX(0) + 4, y - 10, { font: fonts.semibold, size: 8.5, color: C.stone });
      y -= 14;
      for (const o of cr.options) optionRow(o, 4);
    }
    ensure(20);
    y -= 3;
    rule(y, C.stone, 0.8);
    text(t.containerSubtotal, colX(4) - 4, y - 12, { font: fonts.semibold, size: 9.5, align: 'right' });
    text(fmt.money(cr.totalCents), colX(5) - 4, y - 12, { font: fonts.semibold, size: 9.5, align: 'right' });
    y -= 22;
    drawPlan(cr);
    y -= 16;
  });

  /* ── summary ── */

  const sumRows: [string, string][] = [
    [t.containers(result.containers.length), fmt.money(result.containersTotalCents)],
    ...result.orderOptions.map(
      (o) => [`${locale === 'tr' ? o.nameTr : o.nameEn}  (${optionPriceLabel(o, fmt, locale)})`, fmt.signedMoney(o.cents)] as [string, string],
    ),
  ];
  const sumH = 30 + sumRows.length * 15 + 40;
  ensure(sumH);
  text(t.summary, M, y - 12, { font: fonts.display, size: 13 });
  y -= 24;
  const sx = M + CONTENT_W * 0.35;
  for (const [k, v] of sumRows) {
    text(k, sx, y - 10, { size: 9.5, maxW: CONTENT_W * 0.65 - 100 });
    text(v, M + CONTENT_W - 4, y - 10, { size: 9.5, align: 'right' });
    y -= 15;
  }
  y -= 2;
  page.drawRectangle({ x: sx - 8, y: y - 26, width: M + CONTENT_W - sx + 8, height: 26, color: C.ink });
  text(t.total, sx, y - 17, { font: fonts.semibold, size: 11, color: C.white });
  text(fmt.money(result.totalCents), M + CONTENT_W - 4, y - 17, { font: fonts.semibold, size: 12, color: hex('#E8B84B'), align: 'right' });
  y -= 38;
  text(
    t.totalWeight(fmt.tons(result.totals.netKg), fmt.tons(result.totals.grossKg), fmt.kg(result.totals.units)),
    M + CONTENT_W - 4,
    y,
    { size: 8.5, color: C.stone, align: 'right' },
  );
  y -= 22;

  /* ── notes + disclaimer ── */

  const notes = locale === 'tr' ? terms.notesTr : terms.notesEn;
  ensure(40);
  text(t.notes.toUpperCase(), M, y - 8, { font: fonts.semibold, size: 7.5, color: C.stone });
  y -= 16;
  if (notes) {
    paragraph(notes, { size: 8.5 });
    y -= 4;
  }
  paragraph(ui.disclaimer, { size: 8.5, color: C.stone });

  /* ── footer on every page ── */

  pages.forEach((p, i) => {
    page = p;
    rule(M + 14, C.line);
    text(`${input.seller.name} · ${input.seller.website} · ${input.seller.phone}`, M, M, { size: 7.5, color: C.stone });
    text(`${input.number} · ${t.page(i + 1, pages.length)}`, M + CONTENT_W, M, { size: 7.5, color: C.stone, align: 'right' });
  });

  return doc.save();
}
