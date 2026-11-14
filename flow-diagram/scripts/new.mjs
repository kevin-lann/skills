#!/usr/bin/env node
/* Scaffold a standalone, self-contained flow diagram.
 *
 *   node scripts/new.mjs checkout --type request --out ./diagrams
 */
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_DIR, evalSpec, auditSpec, human, readSpec, pageHtml } from './_lib.mjs';
import { starters } from '../assets/starters.mjs';

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--')) || 'flow';
const flag = (key, fallback) => {
  const i = args.indexOf('--' + key);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const has = (key) => args.includes('--' + key);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Scaffold a standalone flow diagram.

  node scripts/new.mjs <name> [flags]

  --type nav|request|code|concept   starter story (default: nav)
  --out <dir>                       output directory (default: ./diagrams)
  --title "..."                     diagram title
  --accent pine|clay|steel|amber|ink
  --direction LR|TB                 default: starter's direction (LR)
  --dark                            dark theme
  --force                           overwrite an existing file

Writes one self-contained HTML file. Edit the object between the
/* @spec:start */ and /* @spec:end */ markers — nothing else.`);
  process.exit(0);
}

const type = flag('type', 'nav');
if (!starters[type]) {
  console.error(`Unknown --type "${type}". Pick one of: ${Object.keys(starters).join(', ')}`);
  process.exit(1);
}

const outDir = path.resolve(process.cwd(), flag('out', 'diagrams'));
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'flow';
const file = path.join(outDir, slug + '.html');

if (fs.existsSync(file) && !has('force')) {
  console.error(`${file} already exists. Pass --force to replace it.`);
  process.exit(1);
}

let specCode = starters[type];
const title = flag('title', null);
if (title) specCode = specCode.replace(/title: "[^"]*"/, `title: ${JSON.stringify(title)}`);
const accent = flag('accent', null);
if (accent) {
  if (!['pine', 'clay', 'steel', 'amber', 'ink'].includes(accent)) {
    console.error('--accent must be one of: pine, clay, steel, amber, ink');
    process.exit(1);
  }
  specCode = specCode.replace(/accent: "[^"]*"/, `accent: ${JSON.stringify(accent)}`);
}
const direction = flag('direction', null);
if (direction) {
  if (!/^(LR|TB)$/.test(direction)) {
    console.error('--direction must be LR or TB');
    process.exit(1);
  }
  if (/direction: /.test(specCode)) specCode = specCode.replace(/direction: "[^"]*"/, `direction: "${direction}"`);
  else specCode = specCode.replace(/^\{/, `{\n  direction: "${direction}",`);
}
if (has('dark')) specCode = specCode.replace(/^\{/, `{\n  theme: "dark",`);

const page = pageHtml(specCode, title || slug);

let report;
try {
  report = auditSpec(evalSpec(readSpec(page)));
} catch (err) {
  report = { ok: false, problems: [{ level: 'error', code: 'spec', msg: err.message }], stats: {} };
}

if (!report.ok) {
  console.error('The starter spec failed its own audit:');
  report.problems.forEach((p) => console.error(`  ${p.level}: ${p.msg}`));
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(file, page);

console.log(`Created ${path.relative(process.cwd(), file)}  (${human(Buffer.byteLength(page))})`);
console.log(`  ${report.stats.nodes} nodes · ${report.stats.edges} edges · ${report.stats.ranks} columns · ${report.layout.width}×${report.layout.height}`);
console.log('');
console.log('Next:');
console.log(`  1. Replace the nodes and edges inside the @spec block — that is the whole design.`);
console.log(`  2. node ${path.join(SKILL_DIR, 'scripts/audit.mjs')} ${path.relative(process.cwd(), file)}`);
console.log(`  3. open ${path.relative(process.cwd(), file)}   (or screenshot it with scripts/shot.mjs)`);
