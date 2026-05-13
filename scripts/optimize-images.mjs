/**
 * optimize-images.mjs — C1 + C2 + C14 implementation
 *
 * Folder-convention approach: assets-source/<folder>/<image> → public/images/<folder>/<image>-<width>w.webp
 *
 * Variants per folder (defined below). Yeni imaj eklemek için sadece doğru klasöre
 * koy, config'e dokunma. B5 (rentable tenant) ergonomi.
 *
 * Çağrı: `npm run preimages` (npm scripts), her build öncesi otomatik.
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
 * Variant width sets per folder.
 *
 * - hero/banner usage → larger widths
 * - product main + cards → medium widths
 * - thumbnails + logos → small widths
 *
 * sharp `withoutEnlargement: true` ensures we don't upscale beyond source.
 */
const FOLDER_VARIANTS = {
  mine: [400, 800, 1280, 1600],              // landscape/banner usage
  factory: [400, 800, 1280],                  // production photos
  products: [200, 400, 800, 1280],           // product main + gallery thumbs
  certifications: [200, 400, 800, 1200],     // cert documents
  logo: [200, 400],                           // header/footer logo
};

/** Default if folder not listed above */
const DEFAULT_VARIANTS = [400, 800];

/** WebP quality */
const QUALITY = 80;

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

async function listImageFiles(dir, baseRel = '') {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    const rel = baseRel ? `${baseRel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      const nested = await listImageFiles(full, rel);
      out.push(...nested);
    } else if (/\.(jpe?g|png|webp|tiff?|avif)$/i.test(e.name)) {
      out.push({ rel, full });
    }
  }
  return out;
}

async function processImage(sourceRel, sourceFull) {
  const folder = sourceRel.split('/')[0];
  const widths = FOLDER_VARIANTS[folder] ?? DEFAULT_VARIANTS;

  const baseName = basename(sourceRel, extname(sourceRel));
  const subDir = dirname(sourceRel);
  const outDir = join(TARGET_DIR, subDir === '.' ? '' : subDir);

  await ensureDir(outDir);

  const sourceMeta = await sharp(sourceFull).metadata();
  const sourceWidth = sourceMeta.width ?? 9999;
  const generated = [];

  for (const w of widths) {
    // Skip variants larger than the source (sharp's withoutEnlargement would skip
    // resizing but still write a copy at source dimensions — we want to skip entirely)
    if (w > sourceWidth) continue;

    const outPath = join(outDir, `${baseName}-${w}w.webp`);
    try {
      await sharp(sourceFull)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(outPath);
      generated.push(`${baseName}-${w}w`);
    } catch (e) {
      console.error(`  ❌ Failed ${sourceRel} @ ${w}w: ${e.message}`);
    }
  }

  return { sourceRel, sourceWidth, widths, generated };
}

async function main() {
  console.log('🖼️  optimize-images.mjs');
  console.log(`   Source: ${SOURCE_DIR}`);
  console.log(`   Target: ${TARGET_DIR}`);

  if (!(await fileExists(SOURCE_DIR))) {
    console.log(`   ℹ️  assets-source/ does not exist yet — nothing to do.`);
    return;
  }

  const files = await listImageFiles(SOURCE_DIR);

  if (files.length === 0) {
    console.log('   ℹ️  No images found in assets-source/');
    return;
  }

  console.log(`   Processing ${files.length} source image(s)...\n`);

  let total = 0;
  let skipped = 0;

  for (const { rel, full } of files) {
    const result = await processImage(rel, full);
    total += result.generated.length;
    skipped += result.widths.length - result.generated.length;
    process.stdout.write(`  ✓ ${rel} (${result.sourceWidth}px) → ${result.generated.length} variants\n`);
  }

  console.log(`\n✅ Generated ${total} variants from ${files.length} sources (${skipped} skipped — source too small).`);
}

main().catch((err) => {
  console.error('Image optimization failed:', err);
  process.exit(1);
});
