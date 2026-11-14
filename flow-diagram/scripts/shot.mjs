#!/usr/bin/env node
/* Screenshot a diagram to PNG at 2x, cropped to the card.
 *
 *   node scripts/shot.mjs diagrams/checkout.html
 *   node scripts/shot.mjs diagrams/checkout.html --out checkout@2x.png --scale 3 --pad 32
 *
 * Uses headless Chrome over the DevTools protocol. Falls back to a plain
 * viewport screenshot when the protocol is unavailable.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const flag = (k, d) => {
  const i = args.indexOf('--' + k);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};

if (!file) {
  console.error('usage: node scripts/shot.mjs <diagram.html> [--out file.png] [--scale 2] [--pad 24]');
  process.exit(2);
}

const abs = path.resolve(process.cwd(), file);
if (!fs.existsSync(abs)) {
  console.error(`No such file: ${abs}`);
  process.exit(2);
}
const out = path.resolve(process.cwd(), flag('out', abs.replace(/\.html?$/i, '') + '.png'));
const scale = Number(flag('scale', '2')) || 2;
const pad = Number(flag('pad', '24'));

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

const chrome = CANDIDATES.find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('Chrome or Chromium not found. Set CHROME_PATH, or open the HTML and screenshot it yourself.');
  process.exit(2);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fk-shot-'));
const child = spawn(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--force-color-profile=srgb',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });

let wsUrl = '';
const kill = () => { try { child.kill('SIGKILL'); } catch {} };
process.on('exit', kill);

const started = Date.now();
await new Promise((resolve, reject) => {
  let buf = '';
  const timer = setTimeout(() => reject(new Error('Chrome did not start in 20s')), 20000);
  child.stderr.on('data', (chunk) => {
    buf += chunk.toString();
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) {
      wsUrl = m[1];
      clearTimeout(timer);
      resolve();
    }
  });
  child.on('exit', (code) => {
    clearTimeout(timer);
    reject(new Error(`Chrome exited early (${code})`));
  });
});

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        (this.listeners.get(msg.method) || []).forEach((fn) => fn(msg.params, msg.sessionId));
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, 20000);
    });
  }
  once(method) {
    return new Promise((resolve) => {
      const list = this.listeners.get(method) || [];
      const fn = (params, sid) => {
        this.listeners.set(method, (this.listeners.get(method) || []).filter((f) => f !== fn));
        resolve(params);
      };
      this.listeners.set(method, [...list, fn]);
    });
  }
}

let exitCode = 0;
try {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('DevTools socket failed')), { once: true });
  });
  const cdp = new CDP(ws);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const s = sessionId;

  await cdp.send('Page.enable', {}, s);
  await cdp.send('Runtime.enable', {}, s);
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: 'file://' + abs.split(path.sep).map(encodeURIComponent).join('/') }, s);
  await loaded;

  await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      await document.fonts.ready;
      document.querySelectorAll('.fk-node,.fk-edge').forEach(n => {
        n.style.animation = 'none';
        n.style.opacity = '1';
        n.style.transform = 'none';
      });
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return true;
    })()`,
    awaitPromise: true
  }, s);

  const { result } = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('.fk') || document.body;
      const r = el.getBoundingClientRect();
      return JSON.stringify({ x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height });
    })()`,
    returnByValue: true
  }, s);
  const rect = JSON.parse(result.value);

  const width = Math.ceil(rect.w + pad * 2);
  const height = Math.ceil(rect.h + pad * 2);

  // Put the card flush in the top-left corner, then size the viewport to it.
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      document.body.style.margin = '0';
      document.body.style.background = '#f1efe9';
      const page = document.querySelector('.fk-page');
      if (page) {
        page.style.padding = '${pad}px';
        page.style.minHeight = '0';
        page.style.display = 'block';
      }
      const card = document.querySelector('.fk');
      if (card) card.style.margin = '0';
      window.scrollTo(0, 0);
    })()`
  }, s);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: scale, mobile: false
  }, s);
  await cdp.send('Runtime.evaluate', {
    expression: 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))',
    awaitPromise: true
  }, s);

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, s);

  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`Saved ${path.relative(process.cwd(), out)} — ${width}×${height} @${scale}x, ${kb} KB, ${((Date.now() - started) / 1000).toFixed(1)}s`);
  ws.close();
} catch (err) {
  console.error(`Screenshot failed: ${err.message}`);
  exitCode = 1;
} finally {
  kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}

process.exit(exitCode);
