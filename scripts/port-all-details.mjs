#!/usr/bin/env node
/**
 * port-all-details.mjs
 *
 * Bütün ürün ve uygulama detay sayfalarını legacy'den port eder.
 * scripts/port-legacy-page.mjs'i her sayfa için programatik çağırır.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const legacyRoot = path.resolve(projectRoot, '..', 'Oldwebsite');

// EN ↔ TR slug map (CLAUDE.md'den)
const productSlugMap = [
  { en: 'raw-sepiolite-ore',            tr: 'ham-sepiyolit-cevheri' },
  { en: 'granulated-sepiolite',         tr: 'granule-sepiyolit' },
  { en: 'milled-sepiolite-powder',      tr: 'ogutulmus-sepiyolit-tozu' },
  { en: 'drilling-grade-sepiolite',     tr: 'sondaj-kalitesi-sepiyolit' },
  { en: 'agricultural-sepiolite',       tr: 'tarimsal-sepiyolit' },
  { en: 'construction-insulation-grade', tr: 'insaat-yalitim-kalitesi' },
];

const applicationSlugMap = [
  { en: 'pet-care-cat-litter',       tr: 'evcil-hayvan-kedi-kumu' },
  { en: 'agriculture',               tr: 'tarim' },
  { en: 'oil-gas-drilling',          tr: 'petrol-gaz-sondaj' },
  { en: 'construction',              tr: 'insaat' },
  { en: 'environmental-remediation', tr: 'cevre-rehabilitasyon' },
  { en: 'paints-coatings',           tr: 'boya-kaplama' },
  { en: 'catalysis-chemical',        tr: 'kataliz-kimya' },
  { en: 'pharma-cosmetics',          tr: 'ilac-kozmetik' },
  { en: 'bioplastics',               tr: 'biyoplastik' },
];

const portScript = path.join(__dirname, 'port-legacy-page.mjs');

function port(legacy, out, locale, enAlt, trAlt) {
  const r = spawnSync(process.execPath, [portScript, legacy, out, locale, enAlt, trAlt], {
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error(`Failed: ${legacy} → ${out}`);
    process.exit(r.status || 1);
  }
}

// Products
for (const { en, tr } of productSlugMap) {
  port(
    path.join(legacyRoot, 'products', en, 'index.html'),
    path.join(projectRoot, 'src', 'pages', 'products', `${en}.astro`),
    'en',
    `/products/${en}/`,
    `/tr/products/${tr}/`
  );
  port(
    path.join(legacyRoot, 'tr', 'products', tr, 'index.html'),
    path.join(projectRoot, 'src', 'pages', 'tr', 'products', `${tr}.astro`),
    'tr',
    `/products/${en}/`,
    `/tr/products/${tr}/`
  );
}

// Applications
for (const { en, tr } of applicationSlugMap) {
  port(
    path.join(legacyRoot, 'applications', en, 'index.html'),
    path.join(projectRoot, 'src', 'pages', 'applications', `${en}.astro`),
    'en',
    `/applications/${en}/`,
    `/tr/applications/${tr}/`
  );
  port(
    path.join(legacyRoot, 'tr', 'applications', tr, 'index.html'),
    path.join(projectRoot, 'src', 'pages', 'tr', 'applications', `${tr}.astro`),
    'tr',
    `/applications/${en}/`,
    `/tr/applications/${tr}/`
  );
}

console.log('\nAll details ported.');
