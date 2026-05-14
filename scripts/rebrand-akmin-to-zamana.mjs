#!/usr/bin/env node
/**
 * rebrand-akmin-to-zamana.mjs
 *
 * "Akmin Mining" / "Akmin Madencilik" / "Akmin Madencilik Grubu" → "Zamana"
 * URL: https://akmin.com.tr → https://zamana.com.tr
 * LinkedIn: https://www.linkedin.com/company/akmin → kullanıcının kişisel profili
 *
 * Yasal entity (AKMİN ENDÜSTRİYEL MADENCİLİK LTD ŞTİ) tescilli isim, dokunulmuyor.
 * `.akmin-badge` CSS class adı da bırakılıyor (cosmetic; başka yerden referans yok).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const newLinkedIn = 'https://www.linkedin.com/in/murat-%C3%B6zsayg%C4%B1l%C4%B1-59790865/?locale=en';

const replacements = [
  // ── Brand text (long → short to avoid partial replacement)
  { from: /Akmin Madencilik Grubu/g,  to: 'Zamana' },
  { from: /Akmin Madencilik/g,        to: 'Zamana' },
  { from: /Akmin Mining Group/g,      to: 'Zamana' },
  { from: /Akmin Mining Co\./g,       to: 'Zamana' },
  { from: /Akmin Mining/g,            to: 'Zamana' },
  // ── URLs
  { from: /https:\/\/akmin\.com\.tr/g, to: 'https://zamana.com.tr' },
  { from: /https:\/\/www\.linkedin\.com\/company\/akmin/g, to: newLinkedIn },
];

function walk(dir, ext) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, ext));
    else if (ext.some((e) => entry.name.endsWith(e))) out.push(p);
  }
  return out;
}

const targets = [
  ...walk(path.join(projectRoot, 'src'), ['.astro', '.ts', '.js', '.mjs', '.md', '.mdx', '.json']),
  ...walk(path.join(projectRoot, 'public'), ['.html', '.json', '.xml', '.webmanifest', '.txt']).filter(
    (p) => !p.includes(path.sep + 'images' + path.sep) // skip image files
  ),
];

let total = 0;
let filesChanged = 0;
for (const f of targets) {
  const before = fs.readFileSync(f, 'utf8');
  let after = before;
  let perFile = 0;
  for (const { from, to } of replacements) {
    const matches = after.match(from);
    if (matches) {
      perFile += matches.length;
      after = after.replace(from, to);
    }
  }
  if (perFile > 0) {
    fs.writeFileSync(f, after, 'utf8');
    filesChanged++;
    total += perFile;
    console.log(`  ${perFile.toString().padStart(3)}  ${path.relative(projectRoot, f)}`);
  }
}
console.log(`\n${total} replacement(s) across ${filesChanged} file(s).`);
