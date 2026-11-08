/**
 * Admin API — /api/admin/*  (protected by Cloudflare Access + requireAccess).
 */
import { and, asc, desc, eq, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { requireAccess } from '../access';
import {
  containerOptions,
  containerTypes,
  orderOptions,
  productDocuments,
  productOptions,
  productPackagings,
  products,
  QUOTE_STATUSES,
  quotes,
  settings,
} from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError, body, db, found, idParam, ok, onError, validate } from '../http';
import {
  containerOptionInput,
  containerTypeUpdate,
  documentMeta,
  orderOptionInput,
  packagingInput,
  productInput,
  productOptionInput,
  quoteUpdateInput,
  settingsInput,
} from '../validation';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

const now = () => new Date();

export const adminApp = new Hono<AppEnv>().basePath('/api/admin');

adminApp.use('*', csrf());
adminApp.use('*', requireAccess);
adminApp.onError(onError);
adminApp.notFound((c) => c.json({ ok: false, error: 'Not found' }, 404));

adminApp.get('/me', (c) => ok(c, { email: c.get('adminEmail') }));

/* ───────────── Products ───────────── */

adminApp.get('/products', async (c) => {
  const rows = await db(c).select().from(products).orderBy(asc(products.sortOrder), asc(products.id));
  return ok(c, rows);
});

adminApp.post('/products', async (c) => {
  const data = await body(c, productInput);
  const [row] = await db(c).insert(products).values(data).returning();
  return ok(c, row, 201);
});

adminApp.get('/products/:id', async (c) => {
  const id = idParam(c);
  const d = db(c);
  const product = found((await d.select().from(products).where(eq(products.id, id)))[0], 'Product');
  const [packagings, documents, options] = await Promise.all([
    d.select().from(productPackagings).where(eq(productPackagings.productId, id))
      .orderBy(asc(productPackagings.sortOrder), asc(productPackagings.id)),
    d.select().from(productDocuments).where(eq(productDocuments.productId, id))
      .orderBy(asc(productDocuments.sortOrder), asc(productDocuments.id)),
    d.select().from(productOptions).where(eq(productOptions.productId, id))
      .orderBy(asc(productOptions.sortOrder), asc(productOptions.id)),
  ]);
  return ok(c, { ...product, packagings, documents, options });
});

adminApp.put('/products/:id', async (c) => {
  const id = idParam(c);
  const data = await body(c, productInput);
  const [row] = await db(c).update(products).set({ ...data, updatedAt: now() })
    .where(eq(products.id, id)).returning();
  return ok(c, found(row, 'Product'));
});

adminApp.delete('/products/:id', async (c) => {
  const id = idParam(c);
  const d = db(c);
  const docs = await d.select({ r2Key: productDocuments.r2Key }).from(productDocuments)
    .where(eq(productDocuments.productId, id));
  const [row] = await d.delete(products).where(eq(products.id, id)).returning({ id: products.id });
  found(row, 'Product');
  // Packagings, options and document rows go via ON DELETE CASCADE; files are removed here.
  if (docs.length) await c.env.FILES.delete(docs.map((x) => x.r2Key));
  return ok(c, { id });
});

/* ───────────── Packagings ───────────── */

adminApp.post('/products/:id/packagings', async (c) => {
  const productId = idParam(c);
  const data = await body(c, packagingInput);
  const [row] = await db(c).insert(productPackagings).values({ ...data, productId }).returning();
  return ok(c, row, 201);
});

adminApp.put('/packagings/:id', async (c) => {
  const id = idParam(c);
  const data = await body(c, packagingInput);
  const [row] = await db(c).update(productPackagings).set({ ...data, updatedAt: now() })
    .where(eq(productPackagings.id, id)).returning();
  return ok(c, found(row, 'Packaging'));
});

adminApp.delete('/packagings/:id', async (c) => {
  const id = idParam(c);
  const [row] = await db(c).delete(productPackagings).where(eq(productPackagings.id, id))
    .returning({ id: productPackagings.id });
  return ok(c, found(row, 'Packaging'));
});

/* ───────────── Product options ───────────── */

adminApp.post('/products/:id/options', async (c) => {
  const productId = idParam(c);
  const data = await body(c, productOptionInput);
  const [row] = await db(c).insert(productOptions).values({ ...data, productId }).returning();
  return ok(c, row, 201);
});

adminApp.put('/product-options/:id', async (c) => {
  const id = idParam(c);
  const data = await body(c, productOptionInput);
  const [row] = await db(c).update(productOptions).set({ ...data, updatedAt: now() })
    .where(eq(productOptions.id, id)).returning();
  return ok(c, found(row, 'Product option'));
});

adminApp.delete('/product-options/:id', async (c) => {
  const id = idParam(c);
  const [row] = await db(c).delete(productOptions).where(eq(productOptions.id, id))
    .returning({ id: productOptions.id });
  return ok(c, found(row, 'Product option'));
});

/* ───────────── Documents (R2) ───────────── */

function safeFileName(name: string): string {
  const cleaned = name
    .replace(/ı/g, 'i')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // drop combining marks: ü→u, ş→s, ğ→g, İ→I
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-');
  return cleaned.slice(-100) || 'file';
}

adminApp.post('/products/:id/documents', async (c) => {
  const productId = idParam(c);
  const form = await c.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new ApiError(400, 'file is required');
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) throw new ApiError(400, 'File size must be 1 B – 20 MB');
  if (!ALLOWED_UPLOAD_TYPES.has(file.type)) throw new ApiError(400, 'Only PDF, PNG, JPEG or WebP');

  const meta = validate(documentMeta, {
    docType: form.get('docType'),
    titleEn: form.get('titleEn'),
    titleTr: form.get('titleTr'),
    isPublic: form.get('isPublic') !== 'false',
    sortOrder: Number(form.get('sortOrder') ?? 0),
  });

  const d = db(c);
  found((await d.select({ id: products.id }).from(products).where(eq(products.id, productId)))[0], 'Product');

  const fileName = safeFileName(file.name);
  const r2Key = `products/${productId}/${crypto.randomUUID()}-${fileName}`;
  await c.env.FILES.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  try {
    const [row] = await d.insert(productDocuments).values({
      ...meta,
      productId,
      r2Key,
      fileName,
      contentType: file.type,
      sizeBytes: file.size,
    }).returning();
    return ok(c, row, 201);
  } catch (err) {
    await c.env.FILES.delete(r2Key);
    throw err;
  }
});

adminApp.put('/documents/:id', async (c) => {
  const id = idParam(c);
  const data = await body(c, documentMeta);
  const [row] = await db(c).update(productDocuments).set(data)
    .where(eq(productDocuments.id, id)).returning();
  return ok(c, found(row, 'Document'));
});

adminApp.get('/documents/:id/file', async (c) => {
  const id = idParam(c);
  const doc = found(
    (await db(c).select().from(productDocuments).where(eq(productDocuments.id, id)))[0],
    'Document',
  );
  const obj = found((await c.env.FILES.get(doc.r2Key)) ?? undefined, 'File');
  return new Response(obj.body, {
    headers: {
      'Content-Type': doc.contentType,
      'Content-Disposition': `inline; filename="${doc.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
});

adminApp.delete('/documents/:id', async (c) => {
  const id = idParam(c);
  const [row] = await db(c).delete(productDocuments).where(eq(productDocuments.id, id))
    .returning({ id: productDocuments.id, r2Key: productDocuments.r2Key });
  const doc = found(row, 'Document');
  await c.env.FILES.delete(doc.r2Key);
  return ok(c, { id: doc.id });
});

/* ───────────── Containers ───────────── */

adminApp.get('/containers', async (c) => {
  const d = db(c);
  const [types, options] = await Promise.all([
    d.select().from(containerTypes).orderBy(asc(containerTypes.sortOrder), asc(containerTypes.id)),
    d.select().from(containerOptions).orderBy(asc(containerOptions.sortOrder), asc(containerOptions.id)),
  ]);
  return ok(c, { types, options });
});

adminApp.put('/containers/:id', async (c) => {
  const id = idParam(c);
  const data = await body(c, containerTypeUpdate);
  if (Object.keys(data).length === 0) throw new ApiError(400, 'Nothing to update');
  const [row] = await db(c).update(containerTypes).set({ ...data, updatedAt: now() })
    .where(eq(containerTypes.id, id)).returning();
  return ok(c, found(row, 'Container type'));
});

adminApp.post('/container-options', async (c) => {
  const data = await body(c, containerOptionInput);
  const [row] = await db(c).insert(containerOptions).values(data).returning();
  return ok(c, row, 201);
});

adminApp.put('/container-options/:id', async (c) => {
  const id = idParam(c);
  const data = await body(c, containerOptionInput);
  const [row] = await db(c).update(containerOptions).set({ ...data, updatedAt: now() })
    .where(eq(containerOptions.id, id)).returning();
  return ok(c, found(row, 'Container option'));
});

adminApp.delete('/container-options/:id', async (c) => {
  const id = idParam(c);
  const [row] = await db(c).delete(containerOptions).where(eq(containerOptions.id, id))
    .returning({ id: containerOptions.id });
  return ok(c, found(row, 'Container option'));
});

/* ───────────── Order options ───────────── */

adminApp.get('/order-options', async (c) => {
  const rows = await db(c).select().from(orderOptions)
    .orderBy(asc(orderOptions.sortOrder), asc(orderOptions.id));
  return ok(c, rows);
});

adminApp.post('/order-options', async (c) => {
  const data = await body(c, orderOptionInput);
  const [row] = await db(c).insert(orderOptions).values(data).returning();
  return ok(c, row, 201);
});

adminApp.put('/order-options/:id', async (c) => {
  const id = idParam(c);
  const data = await body(c, orderOptionInput);
  const [row] = await db(c).update(orderOptions).set({ ...data, updatedAt: now() })
    .where(eq(orderOptions.id, id)).returning();
  return ok(c, found(row, 'Order option'));
});

adminApp.delete('/order-options/:id', async (c) => {
  const id = idParam(c);
  const [row] = await db(c).delete(orderOptions).where(eq(orderOptions.id, id))
    .returning({ id: orderOptions.id });
  return ok(c, found(row, 'Order option'));
});

/* ───────────── Settings ───────────── */

adminApp.get('/settings', async (c) => {
  const rows = await db(c).select().from(settings);
  return ok(c, Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

adminApp.put('/settings', async (c) => {
  const data = await body(c, settingsInput);
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  if (entries.length === 0) throw new ApiError(400, 'Nothing to update');
  const d = db(c);
  const stmts = entries.map(([key, value]) =>
    d.insert(settings).values({ key, value }).onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: now() },
    }),
  );
  await d.batch(stmts as [typeof stmts[number], ...typeof stmts]);
  return ok(c, Object.fromEntries(entries));
});

/* ───────────── Quotes (soft offers issued from the configurator) ───────────── */

const QUOTES_PAGE = 50;

adminApp.get('/quotes', async (c) => {
  const status = c.req.query('status');
  const q = (c.req.query('q') ?? '').trim().slice(0, 100);
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const filters = [];
  if (status && (QUOTE_STATUSES as readonly string[]).includes(status)) {
    filters.push(eq(quotes.status, status as (typeof QUOTE_STATUSES)[number]));
  }
  if (q) {
    const pat = `%${q.replace(/[%_!]/g, (m) => `!${m}`)}%`;
    filters.push(
      or(
        sql`${quotes.number} LIKE ${pat} ESCAPE '!'`,
        sql`${quotes.customerCompany} LIKE ${pat} ESCAPE '!'`,
        sql`${quotes.customerName} LIKE ${pat} ESCAPE '!'`,
        sql`${quotes.customerEmail} LIKE ${pat} ESCAPE '!'`,
      ),
    );
  }
  const where = filters.length ? and(...filters) : undefined;
  const d = db(c);
  const [rows, [{ total }]] = await Promise.all([
    d.select({
      id: quotes.id,
      number: quotes.number,
      createdAt: quotes.createdAt,
      validUntil: quotes.validUntil,
      locale: quotes.locale,
      currency: quotes.currency,
      totalCents: quotes.totalCents,
      customerName: quotes.customerName,
      customerCompany: quotes.customerCompany,
      customerEmail: quotes.customerEmail,
      customerCountry: quotes.customerCountry,
      status: quotes.status,
      emailStatus: quotes.emailStatus,
      containers: sql<number>`json_array_length(${quotes.request}, '$.containers')`,
    })
      .from(quotes)
      .where(where)
      .orderBy(desc(quotes.id))
      .limit(QUOTES_PAGE)
      .offset((page - 1) * QUOTES_PAGE),
    d.select({ total: sql<number>`count(*)` }).from(quotes).where(where),
  ]);
  return ok(c, { rows, total, page, pageSize: QUOTES_PAGE });
});

adminApp.get('/quotes/:id', async (c) => {
  const id = idParam(c);
  const row = found((await db(c).select().from(quotes).where(eq(quotes.id, id)))[0], 'Quote');
  const { ipHash: _ip, publicId: _pid, pdfKey, ...rest } = row;
  return ok(c, { ...rest, hasPdf: Boolean(pdfKey) });
});

adminApp.put('/quotes/:id', async (c) => {
  const id = idParam(c);
  const data = await body(c, quoteUpdateInput);
  const [row] = await db(c).update(quotes).set({ ...data, updatedAt: now() }).where(eq(quotes.id, id))
    .returning({ id: quotes.id, status: quotes.status, adminNote: quotes.adminNote });
  return ok(c, found(row, 'Quote'));
});

adminApp.get('/quotes/:id/pdf', async (c) => {
  const id = idParam(c);
  const row = found(
    (await db(c).select({ number: quotes.number, pdfKey: quotes.pdfKey }).from(quotes).where(eq(quotes.id, id)))[0],
    'Quote',
  );
  const obj = found((row.pdfKey ? await c.env.FILES.get(row.pdfKey) : null) ?? undefined, 'PDF');
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${row.number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
});

/** Removes the offer and its PDF (e.g. a personal-data deletion request). Its number is never reissued. */
adminApp.delete('/quotes/:id', async (c) => {
  const id = idParam(c);
  const [row] = await db(c).delete(quotes).where(eq(quotes.id, id))
    .returning({ id: quotes.id, pdfKey: quotes.pdfKey });
  const deleted = found(row, 'Quote');
  if (deleted.pdfKey) await c.env.FILES.delete(deleted.pdfKey);
  return ok(c, { id: deleted.id });
});
