#!/usr/bin/env node
/**
 * repair-corrupted-tr.mjs
 *
 * PowerShell Set-Content UTF-8 -> UTF-8 round-trip bozdu.
 * Etkilenen TR sayfalarını legacy'den yeniden port et, sonra rebrand + dims fixleri tekrar uygula.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const legacyRoot = path.resolve(projectRoot, '..', 'Oldwebsite');
const portScript = path.join(__dirname, 'port-legacy-page.mjs');

const corrupted = [
  { src: 'tr/index.html',                                       out: 'src/pages/tr/index.astro',                                       url: ['/', '/tr/'] },
  { src: 'tr/applications/index.html',                          out: 'src/pages/tr/applications/index.astro',                          url: ['/applications/', '/tr/applications/'] },
  { src: 'tr/applications/cevre-rehabilitasyon/index.html',     out: 'src/pages/tr/applications/cevre-rehabilitasyon.astro',           url: ['/applications/environmental-remediation/', '/tr/applications/cevre-rehabilitasyon/'] },
  { src: 'tr/applications/insaat/index.html',                   out: 'src/pages/tr/applications/insaat.astro',                         url: ['/applications/construction/', '/tr/applications/insaat/'] },
  { src: 'tr/products/ham-sepiyolit-cevheri/index.html',        out: 'src/pages/tr/products/ham-sepiyolit-cevheri.astro',              url: ['/products/raw-sepiolite-ore/', '/tr/products/ham-sepiyolit-cevheri/'] },
  { src: 'tr/products/sondaj-kalitesi-sepiyolit/index.html',    out: 'src/pages/tr/products/sondaj-kalitesi-sepiyolit.astro',          url: ['/products/drilling-grade-sepiolite/', '/tr/products/sondaj-kalitesi-sepiyolit/'] },
];

for (const f of corrupted) {
  const r = spawnSync(process.execPath, [
    portScript,
    path.join(legacyRoot, f.src),
    path.join(projectRoot, f.out),
    'tr',
    f.url[0],
    f.url[1],
  ], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('Failed', f.src); process.exit(1); }
}

// Note: tr/index.astro was hand-port (not auto). The legacy port for tr/index.html is fine —
// but it doesn't include the "Tedarik Yolculuğunuzu Başlatın" fix from earlier nor the
// Zamana rebrand. Those will be reapplied next.
console.log('\nTR pages re-ported. Now run rebrand-akmin-to-zamana.mjs + fix-img-dimensions.mjs.');
