/**
 * optimize-images.mjs — C1 + C2 + C14 implementation
 *
 * Ham imajları `assets-source/` klasöründen okur, sharp ile WebP varyantlara
 * dönüştürür ve `public/images/` altına yazar.
 *
 * Çağrı: `npm run preimages` (npm scripts), her build öncesi otomatik.
 *
 * Yeni imaj ekleme: VARIANTS objesine satır ekle, ham dosyayı assets-source/'a koy.
 */

import sharp from 'sharp';
import { readdir, mkdir, stat } from 'fs/promises';
import { join, resolve, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, '..', '..');
const SOURCE_DIR = join(ROOT, 'assets-source');
const TARGET_DIR = join(__dirname, '..', 'public', 'images');

/**
 * Variant config — her ham dosya için hangi boyutlarda varyant üretilecek.
 *
 * KEY: assets-source/ içindeki göreli path
 * VALUE: { widths: number[], quality?: number, outputName?: string }
 *
 * Output ismi default: <input-name>-<width>w.webp
 * Örnek: hero-main.png + widths [640, 1280, 1920] →
 *   public/images/hero-main-640w.webp
 *   public/images/hero-main-1280w.webp
 *   public/images/hero-main-1920w.webp
 */
const VARIANTS = {
  // Phase 3'te eski sitedan asset'ler taşındıkça doldurulur (C14).
  // Örnek (şu anlık placeholder — assets-source/ boş olabilir, script no-op olur):
  //
  // 'hero/hero-main.jpg':      { widths: [640, 1280, 1920], quality: 80 },
  // 'factory/exterior-01.jpg': { widths: [640, 1280, 1920], quality: 80 },
  // 'products/granulated.jpg': { widths: [400, 800, 1600], quality: 82 },
  // 'logo/logo-light.png':     { widths: [200, 400], quality: 90 },
};

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

async function processVariant(sourceRel, widths, quality = 80) {
  const sourcePath = join(SOURCE_DIR, sourceRel);

  if (!(await fileExists(sourcePath))) {
    console.warn(`  ⚠️  Source missing: ${sourceRel} — skipping`);
    return;
  }

  const baseName = basename(sourceRel, extname(sourceRel));
  const targetSubdir = dirname(sourceRel);
  const outDir = join(TARGET_DIR, targetSubdir === '.' ? '' : targetSubdir);

  await ensureDir(outDir);

  for (const w of widths) {
    const outPath = join(outDir, `${baseName}-${w}w.webp`);
    try {
      await sharp(sourcePath)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality })
        .toFile(outPath);
      console.log(`  ✅ ${sourceRel} → ${basename(outPath)}`);
    } catch (e) {
      console.error(`  ❌ Failed ${sourceRel} @ ${w}w: ${e.message}`);
    }
  }
}

async function main() {
  console.log('🖼️  optimize-images.mjs');
  console.log(`   Source: ${SOURCE_DIR}`);
  console.log(`   Target: ${TARGET_DIR}`);

  if (!(await fileExists(SOURCE_DIR))) {
    console.log(`   ℹ️  assets-source/ does not exist yet — skipping (Phase 3'te doldurulacak)`);
    return;
  }

  const entries = Object.entries(VARIANTS);

  if (entries.length === 0) {
    console.log('   ℹ️  VARIANTS map is empty — no images to process yet.');
    console.log("   ℹ️  Phase 3 (içerik migration) sırasında bu dosyaya entry eklenecek.");
    return;
  }

  await ensureDir(TARGET_DIR);

  console.log(`   Processing ${entries.length} source image(s)...`);

  for (const [sourceRel, opts] of entries) {
    await processVariant(sourceRel, opts.widths, opts.quality);
  }

  console.log('✅ Image optimization done.');
}

main().catch((err) => {
  console.error('Image optimization failed:', err);
  process.exit(1);
});
