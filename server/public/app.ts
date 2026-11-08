/**
 * Public quote API — /api/quote/*
 *   GET  /catalog            read-only catalog for the container configurator
 *   GET  /documents/:id      public product documents
 *   POST /requests           issue a soft offer: server-side recalculation → number → PDF → R2 → e-mail
 *   GET  /offers/:publicId.pdf  the customer's PDF (unguessable link)
 * Never exposes inactive records, private documents or R2 keys.
 */
import { and, eq, gt, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { BRAND } from '../../src/config/brand';
import { computeQuote } from '../../src/lib/quote/pricing';
import type { CatalogResponse } from '../../src/lib/quote/types';
import { formatters } from '../../src/quote/i18n';
import { loadCatalog } from '../catalog';
import { productDocuments, products, quotes } from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError, body, db, found, idParam, ok, onError } from '../http';
import { loadOfferSettings } from '../offer-settings';
import { loadPdfAssets } from '../offers/assets';
import { sendOfferMails } from '../offers/email';
import { verifyTurnstile } from '../offers/turnstile';
import { renderOfferPdf } from '../pdf/offer-pdf';
import { quoteRequestInput } from '../validation';

/** Per client IP per hour, per e-mail address per day. */
export const OFFER_RATE_LIMITS = { perIpHour: 5, perEmailDay: 10 } as const;

export const publicApp = new Hono<AppEnv>().basePath('/api/quote');

publicApp.use('*', csrf());
publicApp.onError(onError);
publicApp.notFound((c) => c.json({ ok: false, error: 'Not found' }, 404));

publicApp.get('/catalog', async (c) => {
  const catalog = await loadCatalog(db(c));
  const configured = Boolean(c.env.TURNSTILE_SITE_KEY && c.env.TURNSTILE_SECRET_KEY);
  const data: CatalogResponse = { ...catalog, turnstileSiteKey: configured ? c.env.TURNSTILE_SITE_KEY! : null };
  c.header('Cache-Control', 'public, max-age=60');
  return ok(c, data);
});

publicApp.get('/documents/:id', async (c) => {
  const id = idParam(c);
  const doc = found(
    (
      await db(c)
        .select({
          r2Key: productDocuments.r2Key,
          fileName: productDocuments.fileName,
          contentType: productDocuments.contentType,
        })
        .from(productDocuments)
        .innerJoin(products, eq(products.id, productDocuments.productId))
        .where(and(eq(productDocuments.id, id), eq(productDocuments.isPublic, true), eq(products.active, true)))
    )[0],
    'Document',
  );
  const obj = found((await c.env.FILES.get(doc.r2Key)) ?? undefined, 'File');
  return new Response(obj.body, {
    headers: {
      'Content-Type': doc.contentType,
      'Content-Disposition': `inline; filename="${doc.fileName}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
});

/* ───────────── Soft offer ───────────── */

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const istanbulYear = (d: Date) =>
  Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Istanbul' }).format(d));

publicApp.post('/requests', async (c) => {
  const env = c.env;
  // hono/csrf only checks form content types; a JSON POST from another site is refused here.
  const origin = c.req.header('Origin');
  if (origin && origin !== new URL(c.req.url).origin) throw new ApiError(403, 'Forbidden origin');
  if (!env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY) throw new ApiError(503, 'not_configured');

  const input = await body(c, quoteRequestInput);
  const ip = c.req.header('CF-Connecting-IP') ?? null;
  if (!(await verifyTurnstile(env.TURNSTILE_SECRET_KEY, input.turnstileToken, ip))) {
    throw new ApiError(403, 'bot_check_failed');
  }

  const d = db(c);
  const issuedAt = new Date();
  const nowSec = Math.floor(issuedAt.getTime() / 1000);
  const ipHash = await sha256Hex(`sm-quote:${ip ?? 'unknown'}`);
  const [byIp, byEmail] = await Promise.all([
    d.select({ n: sql<number>`count(*)` }).from(quotes)
      .where(and(eq(quotes.ipHash, ipHash), gt(quotes.createdAt, new Date((nowSec - 3600) * 1000)))),
    d.select({ n: sql<number>`count(*)` }).from(quotes)
      .where(and(eq(quotes.customerEmail, input.customer.email), gt(quotes.createdAt, new Date((nowSec - 86400) * 1000)))),
  ]);
  if (byIp[0].n >= OFFER_RATE_LIMITS.perIpHour || byEmail[0].n >= OFFER_RATE_LIMITS.perEmailDay) {
    throw new ApiError(429, 'rate_limited');
  }

  // The browser's numbers are never trusted: recompute from the current catalog.
  const [catalog, offer] = await Promise.all([loadCatalog(d), loadOfferSettings(d)]);
  const result = computeQuote(catalog, input.order);
  if (!result.ok) throw new ApiError(422, 'invalid_order', result.errors);
  if (result.totalCents !== input.expectedTotalCents) {
    throw new ApiError(409, 'price_changed', { totalCents: result.totalCents });
  }

  const year = istanbulYear(issuedAt);
  const validUntil = new Date(issuedAt.getTime() + offer.terms.validityDays * 86400_000);
  const publicId = crypto.randomUUID();
  const cu = input.customer;

  // Counter bump + insert run as one D1 batch (a transaction): numbers are unique and never reused.
  const [, insertRes] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO quote_counters (year, seq) VALUES (?1, 1) ON CONFLICT(year) DO UPDATE SET seq = seq + 1`,
    ).bind(year),
    env.DB.prepare(
      `INSERT INTO quotes (year, seq, number, public_id, locale, currency, customer_name, customer_company,
         customer_email, customer_country, customer_phone, customer_note, request, result, terms, total_cents,
         valid_until, ip_hash, created_at, updated_at)
       SELECT ?1, k.seq, printf('%s-%d-%04d', ?2, ?1, k.seq),
         ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?18
       FROM quote_counters k WHERE k.year = ?1
       RETURNING id, number`,
    ).bind(
      year, offer.prefix, publicId, input.locale, result.currency, cu.name, cu.company, cu.email, cu.country,
      cu.phone, cu.note, JSON.stringify(input.order), JSON.stringify(result), JSON.stringify(offer.terms),
      result.totalCents, Math.floor(validUntil.getTime() / 1000), ipHash, nowSec,
    ),
  ]);
  const inserted = (insertRes.results as { id: number; number: string }[])[0];
  if (!inserted) throw new ApiError(500, 'Could not allocate an offer number');

  let pdf: Uint8Array;
  const pdfKey = `quotes/${year}/${inserted.number}.pdf`;
  try {
    const origin = new URL(c.req.url).origin;
    pdf = await renderOfferPdf(
      {
        locale: input.locale,
        number: inserted.number,
        issuedAt,
        validUntil,
        customer: { name: cu.name, company: cu.company, email: cu.email, country: cu.country, phone: cu.phone },
        seller: {
          name: BRAND.legalName,
          city: BRAND.address.city,
          country: BRAND.address.country,
          phone: BRAND.contact.phone,
          website: new URL(origin).hostname === 'localhost' ? 'sepiolitemine.com' : new URL(origin).hostname,
        },
        terms: offer.terms,
        catalog,
        result,
      },
      await loadPdfAssets(env.ASSETS, origin),
    );
    await env.FILES.put(pdfKey, pdf, {
      httpMetadata: { contentType: 'application/pdf' },
      customMetadata: { quoteId: String(inserted.id) },
    });
  } catch (e) {
    // No half-issued offers: drop the row (its number stays unused) and report.
    await d.delete(quotes).where(eq(quotes.id, inserted.id));
    throw e;
  }

  const fmt = formatters(input.locale, result.currency);
  const validText = new Intl.DateTimeFormat(input.locale === 'tr' ? 'tr-TR' : 'en-GB', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul',
  }).format(validUntil);

  let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped';
  if (env.RESEND_API_KEY) {
    const sent = await sendOfferMails(
      {
        apiKey: env.RESEND_API_KEY,
        from: env.CONTACT_FROM ?? `${BRAND.name} <${BRAND.contact.formFromEmail}>`,
        salesTo: env.QUOTE_NOTIFY_TO ?? BRAND.contact.internalEmail,
      },
      {
        locale: input.locale,
        number: inserted.number,
        quoteId: inserted.id,
        total: fmt.money(result.totalCents),
        validUntil: validText,
        containers: result.containers.length,
        netTons: fmt.tons(result.totals.netKg),
        customer: cu,
        pdf,
        siteOrigin: new URL(c.req.url).origin,
      },
    );
    emailStatus = sent ? 'sent' : 'failed';
  }
  await d.update(quotes).set({ pdfKey, emailStatus, updatedAt: new Date() }).where(eq(quotes.id, inserted.id));

  return ok(
    c,
    {
      number: inserted.number,
      pdfUrl: `/api/quote/offers/${publicId}.pdf`,
      emailStatus,
      totalCents: result.totalCents,
      validUntil: validUntil.toISOString(),
    },
    201,
  );
});

publicApp.get('/offers/:file', async (c) => {
  const m = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.pdf$/.exec(c.req.param('file'));
  if (!m) throw new ApiError(404, 'Offer not found');
  const row = found(
    (await db(c).select({ number: quotes.number, pdfKey: quotes.pdfKey }).from(quotes).where(eq(quotes.publicId, m[1])))[0],
    'Offer',
  );
  const obj = found((row.pdfKey ? await c.env.FILES.get(row.pdfKey) : null) ?? undefined, 'Offer file');
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${row.number}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
});
