#!/usr/bin/env node
/* Audit a diagram file. Geometry, collisions, icon names, story size.
 *
 *   node scripts/audit.mjs diagrams/checkout.html
 *   node scripts/audit.mjs diagrams/checkout.html --json
 */
import { readSpec, specFile, evalSpec, auditSpec } from './_lib.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: node scripts/audit.mjs <diagram.html> [--json]');
  process.exit(2);
}

let spec, report;
try {
  const { html } = specFile(file);
  spec = evalSpec(readSpec(html));
  report = auditSpec(spec);
} catch (err) {
  console.error(`Audit failed: ${err.message}`);
  process.exit(2);
}

if (args.includes('--json')) {
  console.log(JSON.stringify({
    ok: report.ok,
    stats: report.stats,
    size: { width: report.layout.width, height: report.layout.height, direction: report.layout.dir },
    problems: report.problems
  }, null, 2));
  process.exit(report.ok ? 0 : 1);
}

const icon = (p) => (p.level === 'error' ? '✕' : p.level === 'warning' ? '!' : '·');
console.log('');
console.log(`  ${spec.title || file}`);
console.log(`  ${report.stats.nodes} nodes · ${report.stats.edges} edges · ${report.stats.ranks} columns · ` +
  `${report.layout.width}×${report.layout.height} · ${report.layout.dir} · ${report.stats.crossings} crossings`);
console.log('');
if (!report.problems.length) {
  console.log('  ✓ clean — no overlaps, no edge collisions, no clipped labels');
} else {
  report.problems.forEach((p) => {
    console.log(`  ${icon(p)} ${p.msg}`);
  });
}
console.log('');
if (!report.ok) {
  console.log('  Fix the ✕ items. Re-run after every edit.');
  console.log('');
  process.exit(1);
}
