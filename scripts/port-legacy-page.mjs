#!/usr/bin/env node
/**
 * port-legacy-page.mjs
 *
 * Legacy sepiolitemine.com HTML sayfasını 1:1 Astro page'e dönüştürür.
 *
 * Kullanım:
 *   node scripts/port-legacy-page.mjs <legacy-html-path> <output-astro-path> <locale> <en-alt> <tr-alt>
 *
 * Örnek:
 *   node scripts/port-legacy-page.mjs \
 *     ../Oldwebsite/products/raw-sepiolite-ore/index.html \
 *     src/pages/products/raw-sepiolite-ore.astro \
 *     en \
 *     /products/raw-sepiolite-ore/ \
 *     /tr/products/ham-sepiyolit-cevheri/
 *
 * Yaptıkları:
 *   - <title>, <meta description>, og:image yakala → frontmatter
 *   - <head> içindeki <style> bloklarını ve <script type="application/ld+json"> JSON-LD'leri yakala
 *   - <body>'den header/footer include div'lerini ve include.js scriptlerini at
 *   - Image path'lerini lowercase'e rewrite et:
 *       ../images/Mine/ → /images/mine/
 *       ../images/Product/ → /images/products/
 *       ../images/Cert/ → /images/certifications/
 *       ../images/Factory/ → /images/factory/
 *       /images/Mine/ → /images/mine/  (tr legacy mutlak path'leri)
 *       /images/Product/ → /images/products/
 *       /images/Cert/ → /images/certifications/
 *       /images/Factory/ → /images/factory/
 *   - Internal href rewrite: `../foo/` → `/foo/`, `../index.html` → `/`, vs.
 *   - "&" outside attributes → leave (zaten HTML); Astro JSX literal `{` görmüyorsa sorun yok
 *   - Schema JSON-LD'leri Layout'a `schemaJson` prop olarak geçir
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// ── CLI args
const [inputPath, outputPath, localeArg, enAlt, trAlt] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error('Usage: node port-legacy-page.mjs <legacy.html> <output.astro> <locale=en|tr> <enAlt> <trAlt>');
  process.exit(1);
}
const locale = localeArg || 'en';

// ── Read legacy
const absInput = path.isAbsolute(inputPath) ? inputPath : path.resolve(projectRoot, inputPath);
const absOutput = path.isAbsolute(outputPath) ? outputPath : path.resolve(projectRoot, outputPath);
const raw = fs.readFileSync(absInput, 'utf8');

// ── Extract head fields
const titleMatch = raw.match(/<title>([\s\S]*?)<\/title>/i);
const descMatch = raw.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
const ogImageMatch = raw.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']*)["']/i);

const fullTitle = (titleMatch?.[1] || 'Sepiolite Mine').trim();
const description = (descMatch?.[1] || '').trim();
const ogImageFull = (ogImageMatch?.[1] || '').trim();

// Layout adds " | Sepiolite Mine" — strip it from legacy title to avoid duplication.
// Also strip site suffix `– Sepiolite Mine` and `| Sepiolite Mine` variants.
let cleanTitle = fullTitle
  .replace(/\s*[|–—\-]\s*Sepiolite Mine.*$/i, '')
  .trim();

// ── Extract JSON-LD blocks (in <head>)
const ldBlocks = [];
const ldRe = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = ldRe.exec(raw)) !== null) {
  const json = m[1].trim();
  try {
    JSON.parse(json); // validate
    ldBlocks.push(json);
  } catch (e) {
    console.warn(`Warning: invalid JSON-LD skipped: ${e.message}`);
  }
}

// ── Extract all <style> blocks from <head>
const headMatch = raw.match(/<head[\s\S]*?<\/head>/i);
const headHtml = headMatch ? headMatch[0] : '';
const styleBlocks = [];
const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
while ((m = styleRe.exec(headHtml)) !== null) {
  styleBlocks.push(m[1]);
}
const combinedStyle = styleBlocks.join('\n\n').trim();

// ── Extract body content
const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
let body = bodyMatch ? bodyMatch[1] : raw;

// Strip header/footer include divs
body = body.replace(/<div\s+data-include=["'][^"']*header\.html["']\s*><\/div>/gi, '');
body = body.replace(/<div\s+data-include=["'][^"']*footer\.html["']\s*><\/div>/gi, '');

// Strip include.js script + bottom navbar/hamburger IIFE
body = body.replace(/<script\s+src=["'][^"']*include\.js["'][^>]*><\/script>/gi, '');
// Strip the wrapping `(function(){...})();` IIFE that handles navbar/hamburger — Layout has its own.
body = body.replace(
  /<script>\s*\(function\s*\(\s*\)\s*\{[\s\S]*?\}\s*\)\s*\(\s*\)\s*;?\s*<\/script>/gi,
  ''
);
// Strip JSON-LD <script> blocks from body to avoid duplicating with schemaJson prop.
body = body.replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');

// ── Image & href path rewrites
function rewritePaths(s) {
  // Image paths — handle any depth of ../ prefix (../, ../../, ../../../, ...)
  // and rewrite legacy capitalized folders to lowercase canonical paths.
  s = s.replace(/(["'(\s])(?:\.\.\/)+images\/Mine\//gi,    '$1/images/mine/');
  s = s.replace(/(["'(\s])(?:\.\.\/)+images\/Product\//gi, '$1/images/products/');
  s = s.replace(/(["'(\s])(?:\.\.\/)+images\/Cert\//gi,    '$1/images/certifications/');
  s = s.replace(/(["'(\s])(?:\.\.\/)+images\/Factory\//gi, '$1/images/factory/');
  s = s.replace(/(["'(\s])(?:\.\.\/)+images\//gi,          '$1/images/');
  // Absolute legacy paths (TR pages and schema JSON-LD use /images/...)
  s = s.replace(/(["'(\s])\/images\/Mine\//g,    '$1/images/mine/');
  s = s.replace(/(["'(\s])\/images\/Product\//g, '$1/images/products/');
  s = s.replace(/(["'(\s])\/images\/Cert\//g,    '$1/images/certifications/');
  s = s.replace(/(["'(\s])\/images\/Factory\//g, '$1/images/factory/');
  // Full-URL legacy paths inside schema JSON-LD or OG meta
  s = s.replace(/https:\/\/sepiolitemine\.com\/images\/Mine\//g,    'https://sepiolitemine.com/images/mine/');
  s = s.replace(/https:\/\/sepiolitemine\.com\/images\/Product\//g, 'https://sepiolitemine.com/images/products/');
  s = s.replace(/https:\/\/sepiolitemine\.com\/images\/Cert\//g,    'https://sepiolitemine.com/images/certifications/');
  s = s.replace(/https:\/\/sepiolitemine\.com\/images\/Factory\//g, 'https://sepiolitemine.com/images/factory/');
  // Schema breadcrumbs that reference index.html
  s = s.replace(/https:\/\/sepiolitemine\.com\/index\.html/g, 'https://sepiolitemine.com/');
  s = s.replace(/https:\/\/sepiolitemine\.com\/tr\/index\.html/g, 'https://sepiolitemine.com/tr/');
  // Internal page hrefs — minimal rewrite, leave relative ../foo/ alone (URLs mirror legacy)
  s = s.replace(/href=["']\.\.\/index\.html(#[^"']*)?["']/gi, (_, h) => `href="/${h || ''}"`);
  s = s.replace(/href=["']\.\.\/(privacy|terms|404)\.html["']/gi, 'href="/$1/"');
  s = s.replace(/href=["']([\w./-]+?)\/index\.html(#[^"']*)?["']/gi, (_, p, h) => `href="${p}/${h || ''}"`);
  // TR root absolute
  s = s.replace(/href=["']\/tr\/index\.html(#[^"']*)?["']/gi, (_, h) => `href="/tr/${h || ''}"`);
  s = s.replace(/href=["']\/index\.html(#[^"']*)?["']/gi, (_, h) => `href="/${h || ''}"`);
  return s;
}
body = rewritePaths(body);
const combinedStyleRewritten = rewritePaths(combinedStyle);
// Rewrite paths inside JSON-LD blocks too
const ldBlocksRewritten = ldBlocks.map(rewritePaths);

// ── Curly brace escaping for Astro/JSX
// Astro's template treats `{...}` as JS expressions. CSS in `<style>` is safe.
// In the body content, raw `{` outside attributes can break parsing. Wrap in {`...`}? No, too invasive.
// Strategy: scan body for any `{` or `}` that aren't inside a <style>...</style> block, and escape them.
function escapeCurly(html) {
  const styleSplit = html.split(/(<style[\s\S]*?<\/style>)/i);
  return styleSplit
    .map((chunk, i) => {
      if (i % 2 === 1) return chunk; // style block — keep
      // For non-style chunks, replace { with &#123; and } with &#125;
      // (but NOT inside <script> blocks — keep those too)
      const scriptSplit = chunk.split(/(<script[\s\S]*?<\/script>)/i);
      return scriptSplit
        .map((c, j) => {
          if (j % 2 === 1) return c; // inside a script — leave (Astro keeps script raw)
          return c.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
        })
        .join('');
    })
    .join('');
}
const safeBody = escapeCurly(body);

// ── Build frontmatter
const altFrag = enAlt && trAlt
  ? `\n  alternates={{ en: ${JSON.stringify(enAlt)}, tr: ${JSON.stringify(trAlt)} }}`
  : '';
const ogImg = ogImageFull
  ? `\n  ogImage="${path.basename(ogImageFull, path.extname(ogImageFull))}"`
  : '';

const schemaJsonLines = ldBlocksRewritten.map((b) => `  ${b}`).join(',\n');
const schemaPropLine = ldBlocksRewritten.length
  ? `\nconst schemaJson = [\n${schemaJsonLines}\n];`
  : '';
const schemaPropAttr = ldBlocksRewritten.length ? `\n  schemaJson={schemaJson}` : '';

// Escape backtick & dollar-sign in title/description for JS string
const j = (s) => JSON.stringify(s);

const out = `---
import Layout from '@layouts/Layout.astro';
import { BRAND } from '@config/brand';

const siteUrl = Astro.site?.toString().replace(/\\/$/, '') ?? '';${schemaPropLine}
---

<Layout
  title=${j(cleanTitle)}
  description=${j(description)}
  locale="${locale}"${altFrag}${schemaPropAttr}
>
${safeBody.trim()}
</Layout>

${combinedStyleRewritten ? `<style is:global>\n${combinedStyleRewritten}\n</style>\n` : ''}`;

fs.mkdirSync(path.dirname(absOutput), { recursive: true });
fs.writeFileSync(absOutput, out, 'utf8');
console.log(`✓ ${path.relative(projectRoot, absOutput)}`);
