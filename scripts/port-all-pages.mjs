#!/usr/bin/env node
/**
 * port-all-pages.mjs
 *
 * Anasayfa dışındaki tüm listing ve tekil sayfaları port eder
 * (products, applications, markets, sustainability, contact, privacy, terms, 404).
 *
 * Anasayfa ve products/applications listings zaten elle port edildi; bu script
 * sadece kalanları kapsıyor.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const legacyRoot = path.resolve(projectRoot, '..', 'Oldwebsite');
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

// Pages with EN+TR mirror
const bilingualPages = [
  { en: 'applications/index.html', tr: 'tr/applications/index.html', outEn: 'src/pages/applications/index.astro', outTr: 'src/pages/tr/applications/index.astro', urlEn: '/applications/', urlTr: '/tr/applications/' },
  { en: 'markets/index.html',      tr: 'tr/markets/index.html',      outEn: 'src/pages/markets/index.astro',      outTr: 'src/pages/tr/markets/index.astro',      urlEn: '/markets/',      urlTr: '/tr/markets/' },
  { en: 'sustainability/index.html', tr: 'tr/sustainability/index.html', outEn: 'src/pages/sustainability/index.astro', outTr: 'src/pages/tr/sustainability/index.astro', urlEn: '/sustainability/', urlTr: '/tr/sustainability/' },
  { en: 'contact/index.html',      tr: 'tr/contact/index.html',      outEn: 'src/pages/contact/index.astro',      outTr: 'src/pages/tr/contact/index.astro',      urlEn: '/contact/',      urlTr: '/tr/contact/' },
];

for (const p of bilingualPages) {
  port(path.join(legacyRoot, p.en), path.join(projectRoot, p.outEn), 'en', p.urlEn, p.urlTr);
  port(path.join(legacyRoot, p.tr), path.join(projectRoot, p.outTr), 'tr', p.urlEn, p.urlTr);
}

// EN-only pages (privacy, terms, 404)
const enOnly = [
  { src: 'privacy.html', out: 'src/pages/privacy/index.astro', urlEn: '/privacy/' },
  { src: 'terms.html',   out: 'src/pages/terms/index.astro',   urlEn: '/terms/' },
  { src: '404.html',     out: 'src/pages/404.astro',           urlEn: '/404' },
];

for (const p of enOnly) {
  port(path.join(legacyRoot, p.src), path.join(projectRoot, p.out), 'en', p.urlEn, '');
}

// TR privacy + terms are missing in legacy — drop the empty Astro placeholders
import('node:fs').then(({ default: fs }) => {
  for (const p of [
    'src/pages/tr/privacy/index.astro',
    'src/pages/tr/terms/index.astro',
  ]) {
    const abs = path.join(projectRoot, p);
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
      console.log(`✗ removed (no legacy TR mirror): ${p}`);
    }
  }
});

console.log('\nAll listing/single pages ported.');
