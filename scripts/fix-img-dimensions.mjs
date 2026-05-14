#!/usr/bin/env node
/**
 * fix-img-dimensions.mjs
 *
 * <img src="..."> tag'lerine width + height ekler (T1 — CLS=0 garanti).
 * Doğal boyutu public/images/<path>'ten okur.
 *
 * Mevcut width veya height varsa o tag atlanır.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');

// Lightweight WebP / PNG / JPEG dimension reader (no deps).
function readWebpDims(buf) {
  // RIFF....WEBP
  if (buf.slice(0, 4).toString() !== 'RIFF' || buf.slice(8, 12).toString() !== 'WEBP') return null;
  const fourcc = buf.slice(12, 16).toString();
  if (fourcc === 'VP8X') {
    // bytes 24..29: width-1 (24-bit LE), height-1 (24-bit LE)
    const w = (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1;
    const h = (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1;
    return { w, h };
  }
  if (fourcc === 'VP8L') {
    // lossless: byte 21 + 4 bytes contain width-1 (14 bits), height-1 (14 bits)
    const b = buf.slice(21, 25);
    const w = 1 + (((b[1] & 0x3f) << 8) | b[0]);
    const h = 1 + (((b[3] & 0x0f) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6));
    return { w, h };
  }
  if (fourcc === 'VP8 ') {
    // lossy: width/height at byte 26..29
    const w = ((buf[27] << 8) | buf[26]) & 0x3fff;
    const h = ((buf[29] << 8) | buf[28]) & 0x3fff;
    return { w, h };
  }
  return null;
}

function readPngDims(buf) {
  if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function readJpegDims(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    i += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const len = buf.readUInt16BE(i);
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { w: buf.readUInt16BE(i + 5), h: buf.readUInt16BE(i + 3) };
    }
    i += len;
  }
  return null;
}

const dimCache = new Map();
function getDims(srcPath) {
  if (dimCache.has(srcPath)) return dimCache.get(srcPath);
  if (!fs.existsSync(srcPath)) {
    dimCache.set(srcPath, null);
    return null;
  }
  const buf = fs.readFileSync(srcPath);
  let dims = null;
  if (srcPath.endsWith('.webp')) dims = readWebpDims(buf);
  else if (srcPath.endsWith('.png')) dims = readPngDims(buf);
  else if (srcPath.match(/\.(jpe?g)$/i)) dims = readJpegDims(buf);
  dimCache.set(srcPath, dims);
  return dims;
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.astro')) out.push(p);
  }
  return out;
}

const targets = walk(path.join(projectRoot, 'src', 'pages')).concat(
  walk(path.join(projectRoot, 'src', 'components')),
  walk(path.join(projectRoot, 'src', 'layouts'))
);

let total = 0;
let updated = 0;
let skippedNoSrc = 0;
let skippedAlreadyHasDims = 0;
let skippedNoDims = 0;

for (const file of targets) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  content = content.replace(/<img\b[^>]*\/?>/g, (tag) => {
    total++;
    if (/\bwidth\s*=/.test(tag) && /\bheight\s*=/.test(tag)) {
      skippedAlreadyHasDims++;
      return tag;
    }
    const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/);
    if (!srcMatch) {
      skippedNoSrc++;
      return tag;
    }
    const src = srcMatch[1];
    // skip data URIs and external URLs
    if (src.startsWith('data:') || src.startsWith('http')) {
      skippedNoSrc++;
      return tag;
    }
    const absPath = path.join(publicDir, src.replace(/^\//, ''));
    const dims = getDims(absPath);
    if (!dims) {
      skippedNoDims++;
      return tag;
    }
    // Inject width and height before closing /> or >
    let newTag = tag;
    if (!/\bwidth\s*=/.test(newTag)) {
      newTag = newTag.replace(/(<img\b)/, `$1 width="${dims.w}"`);
    }
    if (!/\bheight\s*=/.test(newTag)) {
      newTag = newTag.replace(/(<img\b\s+width="\d+")/, `$1 height="${dims.h}"`);
    }
    updated++;
    changed = true;
    return newTag;
  });

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`✓ ${path.relative(projectRoot, file)}`);
  }
}

console.log(`\nProcessed ${total} <img>; added dims to ${updated}.`);
console.log(`  already had dims: ${skippedAlreadyHasDims}`);
console.log(`  no src / external: ${skippedNoSrc}`);
console.log(`  image not found or unreadable: ${skippedNoDims}`);
