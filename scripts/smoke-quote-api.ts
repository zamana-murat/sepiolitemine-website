// Local smoke test for the quote API (local D1/R2 via getPlatformProxy, no dev server).
// Run: npx tsx scripts/smoke-quote-api.ts   (after npm run db:migrate:local)
import { getPlatformProxy } from 'wrangler';
import { adminApp } from '../server/admin/app';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeQuote } from '../src/lib/quote/pricing';
import { publicApp, OFFER_RATE_LIMITS } from '../server/public/app';

const proxy = await getPlatformProxy<any>();
// Strip Access / Turnstile / mail vars (wrangler.toml + .dev.vars) so each test sets them explicitly.
const {
  ACCESS_TEAM_DOMAIN: _team, ACCESS_AUD: _aud, ACCESS_DEV_BYPASS: _bypass,
  TURNSTILE_SITE_KEY: _tsk, TURNSTILE_SECRET_KEY: _tss, RESEND_API_KEY: _rk, ...rest
} = proxy.env;
// Pages static assets (PDF fonts + logo) served from public/.
const ASSETS = {
  fetch: async (url: string) => {
    try {
      return new Response(readFileSync(join('public', new URL(url).pathname)));
    } catch {
      return new Response('not found', { status: 404 });
    }
  },
};
const base = { ...rest, ASSETS };
const dev = { ...base, ACCESS_DEV_BYPASS: 'true' };
let fails = 0;
const check = (label: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`, cond ? '' : JSON.stringify(extra));
  if (!cond) fails++;
};
const A = 'http://localhost/api/admin';
const json = (method: string, body: unknown) => ({
  method,
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
  body: JSON.stringify(body),
});
const call = async (app: any, url: string, init: RequestInit | undefined, env: any) => {
  const r = await app.request(url, init, env);
  const ct = r.headers.get('content-type') ?? '';
  return { status: r.status, body: ct.includes('json') ? await r.json() : await r.text(), headers: r.headers };
};

let r = await call(adminApp, `${A}/me`, undefined, dev);
check('GET /me bypass 200', r.status === 200, r);
r = await call(adminApp, `${A}/me`, undefined, base);
check('no Access config → 503', r.status === 503, r);
r = await call(adminApp, `${A}/me`, undefined, { ...base, ACCESS_TEAM_DOMAIN: 'x.cloudflareaccess.com', ACCESS_AUD: 'aud' });
check('missing JWT → 401', r.status === 401, r);
r = await call(adminApp, `https://sepiolitemine.com/api/admin/me`, undefined, dev);
check('bypass ignored off-localhost → 503', r.status === 503, r);

const slug = `test-granule-${Date.now()}`;
r = await call(adminApp, `${A}/products`, json('POST', {
  slug, nameEn: 'Granulated Sepiolite', nameTr: 'Granül Sepiyolit',
  specs: [{ labelEn: 'Moisture', labelTr: 'Nem', value: '≤ 10', unit: '%' }],
}), dev);
check('POST product 201', r.status === 201, r);
const pid = r.body.data?.id;

r = await call(adminApp, `${A}/products`, json('POST', { slug, nameEn: 'x', nameTr: 'y' }), dev);
check('duplicate slug → 409', r.status === 409, r);
r = await call(adminApp, `${A}/products`, json('POST', { slug: 'Bad Slug', nameEn: 'x', nameTr: 'y' }), dev);
check('bad slug → 400', r.status === 400, r);

r = await call(adminApp, `${A}/products/${pid}/packagings`, json('POST', {
  type: 'bigbag', nameEn: '1000 kg Big Bag', nameTr: '1000 kg Big Bag',
  netWeightKg: 1000, grossWeightKg: 1004, lengthMm: 900, widthMm: 900, heightMm: 1100,
  maxTiers: 2, priceBasis: 'per_ton', priceCents: 18500,
}), dev);
check('POST packaging 201', r.status === 201, r);
r = await call(adminApp, `${A}/products/${pid}/packagings`, json('POST', {
  type: 'pallet', nameEn: 'x', nameTr: 'x', netWeightKg: 1000, grossWeightKg: 900,
  lengthMm: 1200, widthMm: 800, heightMm: 1200, priceCents: 1,
}), dev);
check('gross < net → 400', r.status === 400, r);
r = await call(adminApp, `${A}/products/9999999/packagings`, json('POST', {
  type: 'pallet', nameEn: 'x', nameTr: 'x', netWeightKg: 1000, grossWeightKg: 1020,
  lengthMm: 1200, widthMm: 800, heightMm: 1200, priceCents: 1,
}), dev);
check('packaging for missing product → 400 (FK)', r.status === 400, r);

r = await call(adminApp, `${A}/products/${pid}/options`, json('POST', {
  nameEn: 'Dust-free screening', nameTr: 'Tozsuz eleme', priceType: 'percent', amount: 250,
}), dev);
check('POST product option 201', r.status === 201, r);
r = await call(adminApp, `${A}/products/${pid}/options`, json('POST', {
  nameEn: 'x', nameTr: 'x', priceType: 'per_container', amount: 1,
}), dev);
check('per_container not allowed on product → 400', r.status === 400, r);

const fd = new FormData();
fd.set('file', new File([new TextEncoder().encode('%PDF-1.4 test')], 'TDS Granül Ğüş.pdf', { type: 'application/pdf' }));
fd.set('docType', 'tds'); fd.set('titleEn', 'Technical Data Sheet'); fd.set('titleTr', 'Teknik Veri Föyü');
r = await call(adminApp, `${A}/products/${pid}/documents`, { method: 'POST', body: fd, headers: { Origin: 'http://localhost' } }, dev);
check('upload document 201', r.status === 201, r);
check("TR filename transliterated", r.body.data?.fileName === "TDS-Granul-Gus.pdf", r.body.data?.fileName);
const docId = r.body.data?.id; const r2Key = r.body.data?.r2Key;
const fd2 = new FormData();
fd2.set('file', new File(['x'], 'a.exe', { type: 'application/x-msdownload' }));
fd2.set('docType', 'tds'); fd2.set('titleEn', 'a'); fd2.set('titleTr', 'a');
r = await call(adminApp, `${A}/products/${pid}/documents`, { method: 'POST', body: fd2, headers: { Origin: 'http://localhost' } }, dev);
check('reject .exe upload → 400', r.status === 400, r);
r = await call(adminApp, `${A}/products/${pid}/documents`, { method: 'POST', body: fd, headers: { Origin: 'https://evil.example' } }, dev);
check('cross-origin form POST → 403 (csrf)', r.status === 403, r.status);

r = await call(adminApp, `${A}/containers`, undefined, dev);
check('GET containers: 3 types', r.body.data?.types?.length === 3, r.body);
const types = Object.fromEntries(r.body.data.types.map((t: any) => [t.code, t]));
r = await call(adminApp, `${A}/containers/${types['20DV'].id}`, json('PUT', { practicalPayloadKg: 21000 }), dev);
check('PUT 20DV practical payload', r.body.data?.practicalPayloadKg === 21000, r);
r = await call(adminApp, `${A}/containers/${types['40DV'].id}`, json('PUT', { enabled: false }), dev);
check('disable 40DV', r.body.data?.enabled === false, r);

r = await call(adminApp, `${A}/container-options`, json('POST', {
  nameEn: 'Fumigation', nameTr: 'Fumigasyon', priceType: 'fixed', amount: 15000,
}), dev);
check('POST container option (all types)', r.status === 201, r);
const coId = r.body.data?.id;
r = await call(adminApp, `${A}/order-options`, json('POST', {
  nameEn: 'Documentation fee', nameTr: 'Evrak ücreti', priceType: 'fixed', amount: 7500, isMandatory: true,
}), dev);
check('POST order option', r.status === 201, r);
const ooId = r.body.data?.id;
r = await call(adminApp, `${A}/settings`, json('PUT', { quote_validity_days: 15 }), dev);
check('PUT settings', r.status === 200, r);
r = await call(adminApp, `${A}/settings`, undefined, dev);
check('settings persisted', r.body.data?.quote_validity_days === 15 && r.body.data?.currency === 'USD', r);

r = await call(publicApp, 'http://localhost/api/quote/catalog', undefined, base);
const cat = r.body.data;
const prod = cat?.products?.find((p: any) => p.id === pid);
check('catalog 200', r.status === 200, r);
check('catalog hides disabled 40DV', !cat.containers.some((c: any) => c.code === '40DV'), cat.containers);
check('catalog payloadLimit uses practical', cat.containers.find((c: any) => c.code === '20DV')?.payloadLimitKg === 21000);
check('catalog product has packaging + doc url', prod?.packagings?.length === 1 && prod?.documents?.[0]?.url === `/api/quote/documents/${docId}`, prod);
check('catalog never leaks r2Key', !JSON.stringify(cat).includes('r2Key'));
check('catalog 20DV includes all-type option', cat.containers.find((c: any) => c.code === '20DV')?.options?.some((o: any) => o.id === coId));

r = await call(publicApp, `http://localhost/api/quote/documents/${docId}`, undefined, base);
check('public doc download', r.status === 200 && String(r.body).startsWith('%PDF'), r.status);

/* ── Soft offer requests ── */
const TS_PASS = { TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' };
const TS_FAIL = { TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '2x0000000000000000000000000000000AA' };
const offerEnv = { ...base, ...TS_PASS };
check('catalog: no Turnstile config → siteKey null', cat.turnstileSiteKey === null, cat.turnstileSiteKey);
r = await call(publicApp, 'http://localhost/api/quote/catalog', undefined, offerEnv);
check('catalog exposes Turnstile site key', r.body.data?.turnstileSiteKey === TS_PASS.TURNSTILE_SITE_KEY);

const c20 = cat.containers.find((c: any) => c.code === '20DV');
const order = {
  containers: [{ containerTypeId: c20.id, optionIds: [], lines: [{ packagingId: prod.packagings[0].id, quantity: 20, optionIds: [] }] }],
  optionIds: [],
};
const expected = computeQuote(cat, order);
check('engine: test order valid in the browser model', expected.ok, expected.errors);
const stamp = Date.now();
const email = `smoke-${stamp}@example.com`;
const ipA = `198.51.100.${stamp % 250}`;
const offer = (over: Record<string, unknown> = {}) => ({
  locale: 'tr',
  customer: { name: 'Ayşe Yılmaz', company: 'Smoke Test Ltd. Şti.', email, country: 'Türkiye', phone: '', note: 'Ölçü notu' },
  order,
  expectedTotalCents: expected.totalCents,
  turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
  consent: true,
  ...over,
});
const post = (b: unknown, env: any, ip = ipA, origin = 'http://localhost') =>
  call(publicApp, 'http://localhost/api/quote/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, 'CF-Connecting-IP': ip },
    body: JSON.stringify(b),
  }, env);

r = await post(offer(), base);
check('request without Turnstile config → 503', r.status === 503, r.body);
r = await post(offer(), { ...base, ...TS_FAIL });
check('failed bot check → 403', r.status === 403 && r.body.error === 'bot_check_failed', r.body);
r = await post(offer({ consent: false }), offerEnv);
check('missing consent → 400', r.status === 400, r.body);
r = await post(offer({ website: 'http://spam' }), offerEnv);
check('honeypot filled → 400', r.status === 400, r.body);
r = await post(offer({ customer: { ...offer().customer, email: 'not-an-email' } }), offerEnv);
check('bad e-mail → 400 with path', r.status === 400 && r.body.details?.some((d: any) => d.path === 'customer.email'), r.body);
r = await post(offer(), offerEnv, ipA, 'https://evil.example');
check('cross-origin request → 403 (csrf)', r.status === 403, r.status);
r = await post(offer({ expectedTotalCents: expected.totalCents + 1 }), offerEnv);
check('stale total → 409 with server total', r.status === 409 && r.body.details?.totalCents === expected.totalCents, r.body);
r = await post(offer({ order: { ...order, containers: [{ ...order.containers[0], lines: [{ ...order.containers[0].lines[0], quantity: 30 }] }] } }), offerEnv);
check('overloaded container → 422 with engine errors', r.status === 422 && r.body.details?.some((e: any) => e.code === 'container_overweight'), r.body);

r = await post(offer(), offerEnv);
check('valid request → 201', r.status === 201, r.body);
const first = r.body.data;
const year = new Date().getFullYear();
check('offer number SM-YYYY-NNNN', new RegExp(`^SM-${year}-[0-9]{4}$`).test(first?.number ?? ''), first?.number);
check('server total = browser total', first?.totalCents === expected.totalCents, [first?.totalCents, expected.totalCents]);
check('no Resend key → emailStatus skipped', first?.emailStatus === 'skipped', first?.emailStatus);
const pdfRes = await publicApp.request(`http://localhost${first.pdfUrl}`, undefined, base);
const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
check('customer PDF link → application/pdf', pdfRes.status === 200 && pdfRes.headers.get('content-type') === 'application/pdf');
check('PDF bytes start with %PDF', new TextDecoder().decode(pdfBytes.slice(0, 4)) === '%PDF', pdfBytes.length);
check('PDF download name = offer number', (pdfRes.headers.get('content-disposition') ?? '').includes(`${first.number}.pdf`));
r = await call(publicApp, 'http://localhost/api/quote/offers/00000000-0000-0000-0000-000000000000.pdf', undefined, base);
check('unknown offer link → 404', r.status === 404, r.status);
r = await call(publicApp, 'http://localhost/api/quote/offers/..%2F..%2Fsecret.pdf', undefined, base);
check('malformed offer link → 404', r.status === 404, r.status);

r = await post(offer(), offerEnv);
const second = r.body.data;
const seqOf = (n: string) => Number(n.split('-')[2]);
check('second offer gets the next number', r.status === 201 && seqOf(second.number) === seqOf(first.number) + 1, [first?.number, second?.number]);

r = await call(adminApp, `${A}/quotes?q=${encodeURIComponent(email)}`, undefined, dev);
check('admin list finds both offers by e-mail', r.body.data?.rows?.length === 2 && r.body.data.rows[0].containers === 1, r.body);
const qid = r.body.data.rows.find((x: any) => x.number === second.number)?.id;
r = await call(adminApp, `${A}/quotes/${qid}`, undefined, dev);
check(
  'admin detail: snapshot, no ipHash/publicId',
  r.body.data?.result?.totalCents === expected.totalCents && !('ipHash' in r.body.data) && !('publicId' in r.body.data) && r.body.data.hasPdf === true,
  Object.keys(r.body.data ?? {}),
);
check('admin detail keeps customer note + TR chars', r.body.data?.customerNote === 'Ölçü notu' && r.body.data?.customerCompany === 'Smoke Test Ltd. Şti.');
r = await call(adminApp, `${A}/quotes/${qid}`, json('PUT', { status: 'contacted', adminNote: 'Arandı' }), dev);
check('admin status update', r.body.data?.status === 'contacted' && r.body.data?.adminNote === 'Arandı', r.body);
r = await call(adminApp, `${A}/quotes?status=contacted&q=${encodeURIComponent(email)}`, undefined, dev);
check('admin status filter', r.body.data?.rows?.length === 1, r.body.data?.rows?.length);
r = await call(adminApp, `${A}/quotes?q=${encodeURIComponent('%')}`, undefined, dev);
check('admin search treats % literally', r.status === 200 && r.body.data.rows.every((x: any) => JSON.stringify(x).includes('%')), r.body.data?.rows?.length);
r = await call(adminApp, `${A}/quotes/${qid}/pdf`, undefined, dev);
check('admin PDF', r.status === 200 && String(r.body).startsWith('%PDF'), r.status);
r = await call(adminApp, `${A}/quotes/${qid}`, json('PUT', { status: 'bogus' }), dev);
check('admin bad status → 400', r.status === 400, r.status);

// Deleting the latest offer must not free its number.
const secondKey = `quotes/${year}/${second.number}.pdf`;
check('offer PDF stored in R2', (await base.FILES.get(secondKey)) !== null);
r = await call(adminApp, `${A}/quotes/${qid}`, { method: 'DELETE', headers: { Origin: 'http://localhost' } }, dev);
check('admin delete offer', r.status === 200, r.body);
check('offer PDF removed from R2', (await base.FILES.get(secondKey)) === null);
r = await post(offer(), offerEnv);
const third = r.body.data;
check('number of a deleted offer is not reused', r.status === 201 && seqOf(third.number) === seqOf(second.number) + 1, [second.number, third?.number]);

// Rate limit per IP (fresh address; earlier requests used ipA).
const ipB = `203.0.113.${stamp % 250}`;
let limited = 0;
for (let i = 0; i < OFFER_RATE_LIMITS.perIpHour; i++) {
  r = await post(offer({ customer: { ...offer().customer, email: `rl${i}-${email}` } }), offerEnv, ipB);
  if (r.status !== 201) limited++;
}
r = await post(offer({ customer: { ...offer().customer, email: `rlx-${email}` } }), offerEnv, ipB);
check(`IP limit: ${OFFER_RATE_LIMITS.perIpHour} allowed, next → 429`, limited === 0 && r.status === 429, [limited, r.status]);

// Remove every offer this run created (and their PDFs).
r = await call(adminApp, `${A}/quotes?q=${encodeURIComponent(email)}`, undefined, dev);
for (const row of r.body.data.rows) {
  await call(adminApp, `${A}/quotes/${row.id}`, { method: 'DELETE', headers: { Origin: 'http://localhost' } }, dev);
}
r = await call(adminApp, `${A}/quotes?q=${encodeURIComponent(email)}`, undefined, dev);
check('cleanup: test offers deleted', r.body.data?.total === 0, r.body.data?.total);

// cleanup
r = await call(adminApp, `${A}/products/${pid}`, { method: 'DELETE', headers: { Origin: 'http://localhost' } }, dev);
check('DELETE product', r.status === 200, r);
r = await call(adminApp, `${A}/products/${pid}`, { method: 'DELETE' }, dev);
check('DELETE without Origin → 403 (csrf)', r.status === 403, r);
check('R2 object removed with product', (await base.FILES.get(r2Key)) === null);
r = await call(adminApp, `${A}/products/${pid}`, undefined, dev);
check('product gone → 404', r.status === 404, r);
await call(adminApp, `${A}/container-options/${coId}`, { method: 'DELETE', headers: { Origin: 'http://localhost' } }, dev);
await call(adminApp, `${A}/order-options/${ooId}`, { method: 'DELETE', headers: { Origin: 'http://localhost' } }, dev);
await call(adminApp, `${A}/containers/${types['40DV'].id}`, json('PUT', { enabled: true }), dev);
await call(adminApp, `${A}/containers/${types['20DV'].id}`, json('PUT', { practicalPayloadKg: null }), dev);
await call(adminApp, `${A}/settings`, json('PUT', { quote_validity_days: 30 }), dev);

await proxy.dispose();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
