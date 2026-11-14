/* Shared plumbing for the flow-diagram scripts. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function asset(name) {
  return fs.readFileSync(path.join(SKILL_DIR, 'assets', name), 'utf8');
}

export function readSpec(html) {
  var re = /\/\* @spec:start \*\/([\s\S]*?)\/\* @spec:end \*\//;
  var m = html.match(re);
  if (!m) throw new Error('No spec block found. Keep the /* @spec:start */ … /* @spec:end */ markers around your SPEC object.');
  return m[1];
}

export function evalSpec(code) {
  var ctx = { console: console };
  vm.createContext(ctx);
  vm.runInContext(asset('engine.js'), ctx, { filename: 'engine.js' });
  vm.runInContext(asset('icons.js'), ctx, { filename: 'icons.js' });
  vm.runInContext(code + '\n;globalThis.__SPEC__ = SPEC;', ctx, { filename: 'spec.js' });
  return ctx.__SPEC__;
}

export function auditSpec(spec) {
  var ctx = { console: console };
  vm.createContext(ctx);
  vm.runInContext(asset('engine.js'), ctx, { filename: 'engine.js' });
  vm.runInContext(asset('icons.js'), ctx, { filename: 'icons.js' });
  var icons = Object.keys(ctx.FLOW_ICONS);
  return ctx.FlowEngine.audit(spec, { icons: icons });
}

export function specFile(file) {
  var abs = path.resolve(process.cwd(), file);
  return { abs: abs, html: fs.readFileSync(abs, 'utf8') };
}

export function human(b) {
  return b >= 1024 ? (b / 1024).toFixed(1) + ' KB' : b + ' B';
}

export function pageHtml(specCode, title) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${String(title || 'Flow diagram').replace(/[<>&]/g, '')}</title>
<style>
  html, body { margin: 0; background: #f1efe9; }
  body { -webkit-font-smoothing: antialiased; }
  .fk-page {
    box-sizing: border-box;
    display: flex;
    align-items: flex-start;
    min-height: 100vh;
    padding: 48px 40px;
  }
  .fk-page > .fk { margin: 0 auto; }
  @media (max-width: 700px) { .fk-page { padding: 16px; } }
  @media print { html, body, .fk-page { background: #fff; } .fk-page { padding: 0; } }
</style>
<style>
${asset('flow.css')}
</style>
</head>
<body>
<main class="fk-page">
  <div id="diagram"></div>
</main>

<script>
${asset('icons.js')}
</script>
<script>
${asset('engine.js')}
</script>
<script>
${asset('render.js')}
</script>
<script>
/* @spec:start */
const SPEC = ${specCode};
/* @spec:end */

FlowKit.render(SPEC, { audit: true });
</script>
</body>
</html>
`;
}

export function paletteOf(spec) {
  return ['pine', 'clay', 'steel', 'amber', 'ink'].indexOf(spec.accent) >= 0 ? spec.accent : 'pine';
}
