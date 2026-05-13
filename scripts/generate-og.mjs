/**
 * generate-og.mjs — Dinamik OG image üretimi (Phase 2.6 — stub)
 *
 * Build-time olarak 1200×630 PNG OG görselleri üretir.
 * Şu anlık STUB: gerçek satori+resvg-js implementasyonu Phase 3'te eklenir.
 * Şimdilik sadece /og/default.png placeholder'ını sağlamak yeterli.
 *
 * Phase 3'te full implementation:
 * - satori (HTML/JSX → SVG)
 * - @resvg/resvg-js (SVG → PNG)
 * - Tüm sayfa slug'larını tarayıp her biri için özelleştirilmiş OG üretir
 */

import { mkdir, copyFile, stat } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TARGET_DIR = join(__dirname, '..', 'public', 'og');

async function ensureDir(dir) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🖼️  generate-og.mjs (stub — Phase 3 full implementation pending)');

  await ensureDir(TARGET_DIR);

  const defaultOg = join(TARGET_DIR, 'default.png');

  if (await fileExists(defaultOg)) {
    console.log(`   ✅ /og/default.png already exists — keeping.`);
  } else {
    console.log(`   ℹ️  /og/default.png missing — will be created in Phase 3.`);
    console.log(`   ℹ️  For now, /og/default.png references will 404; Layout.astro fallback handles this.`);
  }

  console.log('✅ OG generation step complete (stub).');
}

main().catch((err) => {
  console.error('OG generation failed:', err);
  process.exit(1);
});
