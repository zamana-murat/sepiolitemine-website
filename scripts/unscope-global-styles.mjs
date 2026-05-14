#!/usr/bin/env node
/**
 * unscope-global-styles.mjs
 *
 * Legacy port'undan kalma `<style is:global>` blokları tüm sayfalardaki CSS'i
 * tek shared chunk'a topluyor (örn. agriculture.Dp0sQmws.css), home dahil her
 * sayfada yükleniyor. PageSpeed bunu "Render-blocking 300ms, 607ms critical
 * path latency" olarak flag ediyor.
 *
 * Çözüm: is:global → <style> (Astro-scoped). Her sayfa kendi CSS'ini yükler,
 * cross-page leak yok, çok daha küçük per-page CSS.
 *
 * Risk: cross-page shared class kullanımı varsa kırılır. Legacy port'lar
 * page-scoped olduğu için risk düşük. global.css'teki utilities (.section-tag
 * vs.) is:global olarak değil zaten Layout import'undan global yükleniyor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.astro')) out.push(p);
  }
  return out;
}

let total = 0;
for (const f of walk(path.join(projectRoot, 'src', 'pages'))) {
  const content = fs.readFileSync(f, 'utf8');
  if (!content.includes('<style is:global>')) continue;
  const newContent = content.replace(/<style is:global>/g, '<style>');
  fs.writeFileSync(f, newContent, 'utf8');
  console.log(`✓ ${path.relative(projectRoot, f)}`);
  total++;
}
console.log(`\n${total} files unscoped.`);
