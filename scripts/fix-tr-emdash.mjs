#!/usr/bin/env node
/**
 * fix-tr-emdash.mjs
 *
 * C8 locked rule: em-dash (—) yasak Türkçe sayfalarda.
 * Tüm src/pages/tr/ altındaki .astro dosyalarında em-dash → "-" değiştirir.
 * Node fs ile yapılır (PowerShell Set-Content UTF-8'i bozuyor).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const trDir = path.join(projectRoot, 'src', 'pages', 'tr');

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
for (const f of walk(trDir)) {
  const content = fs.readFileSync(f, 'utf8');
  const newContent = content.replace(/—/g, '-');
  if (newContent !== content) {
    const count = (content.match(/—/g) || []).length;
    fs.writeFileSync(f, newContent, 'utf8');
    console.log(`  ${count.toString().padStart(2)}  ${path.relative(projectRoot, f)}`);
    total += count;
  }
}
console.log(`\n${total} em-dash → hyphen in TR pages.`);
