/* Flow Kit — renderer. Turns a spec into HTML + SVG. Requires engine.js and icons.js. */
(function (root) {
  'use strict';

  var ENG = root.FlowEngine;
  var ICONS = root.FLOW_ICONS || {};

  var TONES = {
    ink:   { light: '#3F3B34', dark: '#D8D4CB' },
    pine:  { light: '#2C6B57', dark: '#5FB79B' },
    clay:  { light: '#A9542F', dark: '#D98A61' },
    amber: { light: '#8A6414', dark: '#D2AC5A' },
    steel: { light: '#3A5F7D', dark: '#7FAED1' },
    ok:    { light: '#3B7050', dark: '#6FBE8C' },
    danger:{ light: '#A4402F', dark: '#E08472' }
  };

  var ACCENTS = {
    pine:  { light: '#266B57', dark: '#58B394' },
    clay:  { light: '#A0512D', dark: '#D98F66' },
    steel: { light: '#345B7A', dark: '#83B0D0' },
    ink:   { light: '#2B2924', dark: '#E7E3DA' },
    amber: { light: '#8A6414', dark: '#D6B166' }
  };

  function el(tag, cls, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function iconSvg(name, size) {
    var body = ICONS[name];
    if (!body) return '';
    return '<svg class="fk-ico" width="' + (size || 16) + '" height="' + (size || 16) +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  /* --------------------------------------------------------- edge paths */

  function cleanPts(pts) {
    var out = [];
    pts.forEach(function (p) {
      var last = out[out.length - 1];
      if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) return;
      out.push(p);
    });
    return out;
  }

  function roundedPath(pts, radius) {
    pts = cleanPts(pts);
    if (pts.length < 2) return '';
    var d = 'M ' + pts[0].x + ' ' + pts[0].y;
    for (var i = 1; i < pts.length - 1; i++) {
      var prev = pts[i - 1], cur = pts[i], next = pts[i + 1];
      var d1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      var d2 = Math.hypot(next.x - cur.x, next.y - cur.y);
      var r = Math.min(radius, d1 / 2, d2 / 2);
      if (r < 0.5) { d += ' L ' + cur.x + ' ' + cur.y; continue; }
      var a = { x: cur.x + (prev.x - cur.x) * (r / d1), y: cur.y + (prev.y - cur.y) * (r / d1) };
      var b = { x: cur.x + (next.x - cur.x) * (r / d2), y: cur.y + (next.y - cur.y) * (r / d2) };
      d += ' L ' + round(a.x) + ' ' + round(a.y) + ' Q ' + cur.x + ' ' + cur.y + ' ' + round(b.x) + ' ' + round(b.y);
    }
    var last = pts[pts.length - 1];
    d += ' L ' + round(last.x) + ' ' + round(last.y);
    return d;
  }

  function round(n) { return Math.round(n * 100) / 100; }

  /* tone resolution */
  function edgeTone(e) {
    if (e.kind === 'error') return 'danger';
    if (e.kind === 'async') return 'steel';
    if (e.tone) return e.tone;
    return 'neutral';
  }

  /* ------------------------------------------------------------- render */

  function render(spec, opts) {
    opts = opts || {};
    spec = JSON.parse(JSON.stringify(spec));
    var lay = opts.layout || ENG.layout(spec);
    var accentName = ACCENTS[spec.accent] ? spec.accent : 'pine';
    var accent = ACCENTS[accentName];
    var theme = spec.theme || 'light';

    var mount = opts.target || document.getElementById(spec.mount || 'diagram') || document.body;
    var rootEl = el('div', 'fk' + (spec.className ? ' ' + spec.className : ''));
    rootEl.setAttribute('role', 'figure');
    rootEl.setAttribute('aria-label', spec.title || 'Flow diagram');
    rootEl.style.setProperty('--fk-accent-light', accent.light);
    rootEl.style.setProperty('--fk-accent-dark', accent.dark);
    if (theme === 'dark') rootEl.dataset.theme = 'dark';
    if (theme === 'auto') rootEl.dataset.theme = 'auto';

    /* header */
    if (spec.title || spec.subtitle) {
      var head = el('header', 'fk-head', rootEl);
      if (spec.title) {
        var h = el('h1', 'fk-title', head);
        h.textContent = spec.title;
      }
      if (spec.subtitle) {
        var sub = el('p', 'fk-sub', head);
        sub.textContent = spec.subtitle;
      }
    }

    var canvas = el('div', 'fk-canvas', rootEl);
    canvas.style.width = lay.width + 'px';
    canvas.style.height = lay.height + 'px';

    /* groups behind everything */
    var groupLayer = el('div', 'fk-group-layer', canvas);
    lay.groups.forEach(function (g) {
      var gd = el('div', 'fk-group', groupLayer);
      gd.style.left = g.x + 'px';
      gd.style.top = g.y + 'px';
      gd.style.width = g.w + 'px';
      gd.style.height = g.h + 'px';
      if (g.tone) gd.dataset.tone = g.tone;
      var lab = el('div', 'fk-group-label', gd);
      if (g.icon) lab.insertAdjacentHTML('beforeend', iconSvg(g.icon, 13));
      var span = el('span', '', lab);
      span.textContent = g.label;
    });

    /* edges */
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'fk-edges');
    svg.setAttribute('width', lay.width);
    svg.setAttribute('height', lay.height);
    svg.setAttribute('viewBox', '0 0 ' + lay.width + ' ' + lay.height);
    canvas.appendChild(svg);

    var defs = document.createElementNS(svgNS, 'defs');
    svg.appendChild(defs);
    ['neutral', 'accent', 'danger', 'steel', 'ok'].forEach(function (tone) {
      var m = document.createElementNS(svgNS, 'marker');
      m.setAttribute('id', 'fk-arrow-' + tone);
      m.setAttribute('viewBox', '0 0 8 8');
      m.setAttribute('refX', '7');
      m.setAttribute('refY', '4');
      m.setAttribute('markerWidth', '7');
      m.setAttribute('markerHeight', '7');
      m.setAttribute('orient', 'auto-start-reverse');
      var p = document.createElementNS(svgNS, 'path');
      p.setAttribute('d', 'M0.6,1.1 L7,4 L0.6,6.9 L1.9,4 Z');
      p.setAttribute('class', 'fk-arrow fk-arrow--' + tone);
      m.appendChild(p);
      defs.appendChild(m);
    });

    var edgeEls = [];
    lay.edges.forEach(function (e) {
      var tone = e.tone === 'accent' ? 'accent' : edgeTone(e);
      var g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', 'fk-edge fk-edge--' + tone + (e.style ? ' fk-edge--' + e.style : ''));
      g.setAttribute('data-from', e.from);
      g.setAttribute('data-to', e.to);
      var path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', roundedPath(e.pts, 11));
      path.setAttribute('class', 'fk-edge-line');
      path.setAttribute('marker-end', 'url(#fk-arrow-' + tone + ')');
      g.appendChild(path);
      svg.appendChild(g);
      edgeEls.push({ e: e, g: g, path: path });
    });

    /* edge labels above lines, below nodes */
    var labelLayer = el('div', 'fk-label-layer', canvas);
    edgeEls.forEach(function (item) {
      var e = item.e;
      if (!e.label || !e.labelPos || e.labelPos.hidden) return;
      var pill = el('div', 'fk-edge-label', labelLayer);
      pill.style.left = e.labelPos.x + 'px';
      pill.style.top = e.labelPos.y + 'px';
      if (e.labelPos.above) pill.classList.add('is-above');
      if (e.labelPos.anchor === 'start') pill.classList.add('is-start');
      pill.textContent = e.label;
    });

    /* nodes */
    var nodeLayer = el('div', 'fk-node-layer', canvas);
    var nodeEls = {};
    var step = 0;
    lay.nodes.forEach(function (n, i) {
      var tone = n.tone || (n.emphasis === 'accent' ? 'accent' : 'ink');
      if (STRING_TONES.indexOf(tone) === -1) tone = 'ink';
      var d = el('div', 'fk-node', nodeLayer);
      d.style.left = n.x + 'px';
      d.style.top = n.y + 'px';
      d.style.width = n.w + 'px';
      d.style.height = n.h + 'px';
      d.style.setProperty('--d', (i * 36 + 40) + 'ms');
      d.dataset.id = n.id;
      d.dataset.tone = tone;
      if (n.emphasis === 'accent') d.dataset.emphasis = 'accent';
      if (n.emphasis === 'muted') d.dataset.emphasis = 'muted';

      if (n.icon) {
        var ib = el('span', 'fk-icon', d);
        ib.innerHTML = iconSvg(n.icon, 17);
      } else {
        el('span', 'fk-dot', d);
      }
      var body = el('span', 'fk-node-text', d);
      var t = el('span', 'fk-node-title', body);
      t.textContent = n.label;
      if (n.sub) {
        var s = el('span', 'fk-node-sub', body);
        s.textContent = n.sub;
      }
      if (spec.number && (!n.spec || n.spec.badge !== false)) {
        step += 1;
        var b = el('span', 'fk-badge', d);
        b.textContent = (n.spec && n.spec.badge) || step;
      }
      nodeEls[n.id] = d;
    });

    /* hover focus */
    var edgesByNode = {};
    lay.edges.forEach(function (e) {
      (edgesByNode[e.from] = edgesByNode[e.from] || []).push(e);
      (edgesByNode[e.to] = edgesByNode[e.to] || []).push(e);
    });
    Object.keys(nodeEls).forEach(function (id) {
      var d = nodeEls[id];
      d.addEventListener('mouseenter', function () {
        var on = {};
        on[id] = true;
        (edgesByNode[id] || []).forEach(function (e) { on[e.from] = true; on[e.to] = true; });
        canvas.dataset.focus = '1';
        Object.keys(nodeEls).forEach(function (k) {
          nodeEls[k].classList.toggle('is-on', !!on[k]);
        });
        edgeEls.forEach(function (it) {
          it.g.classList.toggle('is-on', !!on[it.e.from] && !!on[it.e.to]);
        });
      });
      d.addEventListener('mouseleave', function () {
        delete canvas.dataset.focus;
        Object.keys(nodeEls).forEach(function (k) { nodeEls[k].classList.remove('is-on'); });
        edgeEls.forEach(function (it) { it.g.classList.remove('is-on'); });
      });
    });

    /* legend + footnote */
    var usedKinds = {};
    lay.edges.forEach(function (e) {
      usedKinds[e.kind] = true;
      if (e.back) usedKinds.back = true;
    });
    var legendItems = spec.legend === true ? autoLegend(usedKinds) : Array.isArray(spec.legend) ? spec.legend : [];
    if (legendItems.length || spec.footnote) {
      var foot = el('footer', 'fk-foot', rootEl);
      if (legendItems.length) {
        var legend = el('div', 'fk-legend', foot);
        legendItems.forEach(function (item) {
          var li = el('span', 'fk-legend-item', legend);
          var sw = el('span', 'fk-legend-line', li);
          sw.dataset.kind = item.kind || 'sync';
          if (item.dashed) sw.classList.add('is-dashed');
          var txt = el('span', '', li);
          txt.textContent = item.label;
        });
      }
      if (spec.footnote) {
        var note = el('p', 'fk-note', foot);
        note.textContent = spec.footnote;
      }
    }

    mount.appendChild(rootEl);
    if (opts.audit) root.__FLOW_REPORT__ = ENG.audit(spec, opts);
    return rootEl;
  }

  var STRING_TONES = ['ink', 'pine', 'clay', 'amber', 'steel', 'ok', 'danger', 'accent'];

  function autoLegend(kinds) {
    var map = {
      sync: { label: 'Request', kind: 'sync' },
      async: { label: 'Async / event', kind: 'async', dashed: true },
      error: { label: 'Failure path', kind: 'error', dashed: true },
      back: { label: 'Return / retry', kind: 'back', dashed: true }
    };
    var order = ['sync', 'async', 'error', 'back'];
    var out = [];
    order.forEach(function (k) { if (kinds[k] && map[k]) out.push(map[k]); });
    return out.length > 1 ? out : [];
  }

  root.FlowKit = { render: render, audit: function (spec, opts) { return ENG.audit(spec, opts); }, icons: ICONS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
