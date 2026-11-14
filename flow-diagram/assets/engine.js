/* Flow Kit — layout + routing engine.
 * Pure math: no DOM. Produces screen-space boxes, polyline edges and label anchors.
 * Works in the browser (globalThis.FlowEngine) and in Node (via import()).
 *
 * Coordinate model
 *   a = distance along the flow (left→right for LR, top→bottom for TB)
 *   c = distance across the flow
 *   Every route is authored in (a,c) then projected to (x,y). That keeps LR/TB identical.
 */
(function (root) {
  'use strict';

  var W = 200;               // node length across the reading direction
  var H = 68;                // node thickness
  var PAD = 0;               // the card already supplies the outer margin
  var PAD_TOP = 8;
  var RANK_GAP_LR = 108;
  var RANK_GAP_TB = 84;
  var BAND_GAP_LR = 26;
  var BAND_GAP_TB = 44;
  var CORNER = 11;
  var PORT_INSET = 15;

  function r2(n) { return Math.round(n * 100) / 100; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function byId(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  /* ---------------------------------------------------------------- graph */

  function makeGraph(spec) {
    var nodes = (spec.nodes || []).map(function (n, i) {
      return {
        id: n.id,
        label: n.label || n.id,
        sub: n.sub || '',
        icon: n.icon || '',
        group: n.group || '',
        tone: n.tone || '',
        emphasis: n.emphasis || '',
        rank: n.rank === undefined ? null : n.rank,
        index: i,
        n: n
      };
    });
    var index = {};
    nodes.forEach(function (n) { index[n.id] = n; });

    var edges = (spec.edges || []).map(function (e, i) {
      return {
        from: e.from,
        to: e.to,
        label: e.label || '',
        kind: e.kind || 'sync',       // sync | async | error | back
        style: e.style || '',          // solid | dashed | dotted
        tone: e.tone || '',
        index: i,
        back: false
      };
    }).filter(function (e) { return index[e.from] && index[e.to]; });

    return { nodes: nodes, edges: edges, byId: index };
  }

  /* Cycle-safe topological order. Edges that point back into the DFS stack are
     marked `back` and removed from ranking so the rest stays a DAG. */
  function orderGraph(g) {
    var state = {}, out = [], stack = [];
    var adj = {};
    g.nodes.forEach(function (n) { adj[n.id] = []; });
    g.edges.forEach(function (e) { adj[e.from].push(e); });

    function visit(id) {
      state[id] = 1;
      stack.push(id);
      adj[id].forEach(function (e) {
        if (state[e.to] === 1) { e.back = true; return; }
        if (!state[e.to]) visit(e.to);
      });
      stack.pop();
      state[id] = 2;
      out.push(id);
    }
    g.nodes.forEach(function (n) { if (!state[n.id]) visit(n.id); });
    return out.reverse();
  }

  function rankNodes(g, topo) {
    var rank = {};
    var preds = {};
    g.nodes.forEach(function (n) { preds[n.id] = []; });
    g.edges.forEach(function (e) {
      if (!e.back) preds[e.to].push(e.from);
    });
    topo.forEach(function (id) {
      var node = g.byId[id];
      if (node.rank !== null) { rank[id] = node.rank; return; }
      var r = 0;
      preds[id].forEach(function (p) {
        if (rank[p] !== undefined) r = Math.max(r, rank[p] + 1);
      });
      rank[id] = r;
    });
    // compact explicit gaps into adjacent columns
    var used = {};
    g.nodes.forEach(function (n) { used[rank[n.id]] = true; });
    var sorted = Object.keys(used).map(Number).sort(function (a, b) { return a - b; });
    var remap = {};
    sorted.forEach(function (v, i) { remap[v] = i; });
    g.nodes.forEach(function (n) { n.rank = remap[rank[n.id]]; });
  }

  function rankList(g) {
    var max = 0;
    g.nodes.forEach(function (n) { max = Math.max(max, n.rank); });
    var list = [];
    for (var i = 0; i <= max; i++) list.push([]);
    g.nodes.forEach(function (n) { list[n.rank].push(n); });
    return list;
  }

  /* ------------------------------------------------------------ ordering */

  function neighbours(g, id, dir) {
    var res = [];
    g.edges.forEach(function (e) {
      if (e.back) return;
      if (dir === 'down' && e.from === id) res.push(e.to);
      if (dir === 'up' && e.to === id) res.push(e.from);
    });
    return res;
  }

  function barycenter(rankListArr, g, dir) {
    var pos = {};
    rankListArr.forEach(function (row) {
      row.forEach(function (n, i) { pos[n.id] = i; });
    });
    var start = dir === 'down' ? 1 : rankListArr.length - 2;
    var end = dir === 'down' ? rankListArr.length : -1;
    var step = dir === 'down' ? 1 : -1;
    for (var r = start; r !== end; r += step) {
      var row = rankListArr[r];
      var scored = row.map(function (n, i) {
        var ns = neighbours(g, n.id, dir);
        var vals = ns.map(function (id) { return pos[id]; })
          .filter(function (v) { return v !== undefined; });
        var key = vals.length
          ? vals.reduce(function (s, v) { return s + v; }, 0) / vals.length
          : i;
        return { n: n, key: key, i: i };
      });
      scored.sort(function (a, b) {
        return a.key - b.key || a.i - b.i;
      });
      rankListArr[r] = scored.map(function (s) { return s.n; });
      scored.forEach(function (s, i) { pos[s.n.id] = i; });
    }
  }

  function countCrossings(rankListArr, g) {
    var total = 0;
    for (var r = 0; r < rankListArr.length - 1; r++) {
      var posA = {}, posB = {};
      rankListArr[r].forEach(function (n, i) { posA[n.id] = i; });
      rankListArr[r + 1].forEach(function (n, i) { posB[n.id] = i; });
      var pairs = [];
      g.edges.forEach(function (e) {
        if (e.back) return;
        if (posA[e.from] !== undefined && posB[e.to] !== undefined) {
          pairs.push([posA[e.from], posB[e.to]]);
        }
      });
      for (var i = 0; i < pairs.length; i++) {
        for (var j = i + 1; j < pairs.length; j++) {
          if ((pairs[i][0] - pairs[j][0]) * (pairs[i][1] - pairs[j][1]) < 0) total++;
        }
      }
    }
    return total;
  }

  /* ----------------------------------------------------------- projection */

  function geometry(spec, dirOverride) {
    var dir = dirOverride || (spec.direction === 'TB' ? 'TB' : 'LR');
    var edgeCount = (spec.edges || []).length;
    var gapBase = dir === 'LR' ? RANK_GAP_LR : RANK_GAP_TB;
    var span = Math.max(1, (spec.nodes || []).length);
    return {
      dir: dir,
      W: W,
      H: H,
      along: dir === 'LR' ? W : H,
      cross: dir === 'LR' ? H : W,
      pad: PAD,
      padTop: PAD_TOP,
      rankGap: gapBase,
      bandGap: dir === 'LR' ? BAND_GAP_LR : BAND_GAP_TB,
      edgeCount: edgeCount,
      span: span
    };
  }

  function project(dir, a, c) {
    return dir === 'LR' ? { x: a, y: c } : { x: c, y: a };
  }

  /* --------------------------------------------------------------- layout */

  function layoutWith(spec, dirOverride) {
    var g = makeGraph(spec);
    var geo = geometry(spec, dirOverride);
    var topo = orderGraph(g);
    rankNodes(g, topo);

    var rows = rankList(g);
    rows = rows.filter(function (r) { return r.length; });
    if (!rows.length) {
      return { nodes: [], edges: [], groups: [], width: 320, height: 120, geo: geo, warnings: ['empty diagram'] };
    }

    // initial order: group clustering, then author order
    rows.forEach(function (row) {
      row.sort(function (a, b) {
        var ga = a.group || '~', gb = b.group || '~';
        return byId(ga, gb) || a.index - b.index;
      });
    });

    var best = rows.map(function (r) { return r.slice(); });
    var bestScore = countCrossings(best, g);
    for (var it = 0; it < 8 && bestScore > 0; it++) {
      var trial = best.map(function (r) { return r.slice(); });
      barycenter(trial, g, it % 2 === 0 ? 'down' : 'up');
      var s = countCrossings(trial, g);
      if (s < bestScore) { bestScore = s; best = trial; }
    }
    rows = best;

    // cross-axis placement (centered per rank)
    var maxStack = 0;
    rows.forEach(function (row) {
      var h = row.length * geo.cross + (row.length - 1) * geo.bandGap;
      maxStack = Math.max(maxStack, h);
    });
    var groupShift = (spec.groups && spec.groups.length) ? 52 : 0;
    var crossStart = geo.dir === 'LR' ? geo.padTop + groupShift : geo.pad;
    var alongStart = geo.dir === 'LR' ? geo.pad : geo.padTop + groupShift;
    rows.forEach(function (row) {
      var h = row.length * geo.cross + (row.length - 1) * geo.bandGap;
      var start = crossStart + (maxStack - h) / 2;
      row.forEach(function (n, i) {
        n.band = i;
        n.c = start + i * (geo.cross + geo.bandGap);
      });
    });

    /* classify edges now that ranks are fixed */
    var perGap = {};
    g.edges.forEach(function (e) {
      var s = g.byId[e.from], t = g.byId[e.to];
      e.same = s === t;
      e.diff = t.rank - s.rank;
      e.adjacent = !e.same && e.diff === 1;
      e.rail = !e.adjacent;
      if (e.adjacent) (perGap[s.rank] = perGap[s.rank] || []).push(e);
    });

    /* Every column gap is sized by what has to live inside it: one corridor per
       edge, plus room for the widest edge label so nothing is ever truncated. */
    var gapWidth = [];
    for (var gr = 0; gr < rows.length - 1; gr++) {
      var glist = perGap[gr] || [];
      var widest = 0;
      glist.forEach(function (e) {
        if (e.label) widest = Math.max(widest, Math.min(196, e.label.length * 5.5 + 24));
      });
      gapWidth[gr] = Math.max(geo.rankGap, widest, 56 + glist.length * 12);
    }

    // along-axis placement
    var a = alongStart;
    var colA = [];
    rows.forEach(function (row, r) {
      colA[r] = a;
      row.forEach(function (n) { n.a = a; });
      a += geo.along + (gapWidth[r] || 0);
    });
    var contentEnd = a - (gapWidth[rows.length - 1] || 0);

    // screen boxes
    g.nodes.forEach(function (n) {
      var p = project(geo.dir, n.a, n.c);
      n.x = p.x;
      n.y = p.y;
      n.w = geo.dir === 'LR' ? geo.along : geo.cross;
      n.h = geo.dir === 'LR' ? geo.cross : geo.along;
    });

    var contentBottom = crossStart + maxStack;
    var maxRank = rows.length - 1;

    /* ---- ports: spread a node's edges across its leading/trailing face ---- */
    var outgoing = {}, incoming = {};
    g.nodes.forEach(function (n) { outgoing[n.id] = []; incoming[n.id] = []; });
    g.edges.forEach(function (e) {
      outgoing[e.from].push(e);
      incoming[e.to].push(e);
    });
    g.nodes.forEach(function (n) {
      var out = outgoing[n.id].slice().sort(function (x, y) {
        return g.byId[x.to].c - g.byId[y.to].c || x.index - y.index;
      });
      out.forEach(function (e, i) {
        e.srcPort = portOffset(i, out.length, geo.cross);
      });
      var inc = incoming[n.id].slice().sort(function (x, y) {
        return g.byId[x.from].c - g.byId[y.from].c || x.index - y.index;
      });
      inc.forEach(function (e, i) {
        e.dstPort = portOffset(i, inc.length, geo.cross);
      });
    });

    function portOffset(i, n, size) {
      if (n <= 1) return 0;
      var step = Math.min(18, (size - 26) / (n - 1));
      var room = step * (n - 1);
      return -room / 2 + i * step;
    }

    /* ------------------------------------- adjacent edges: corridor routing */
    g.edges.forEach(function (e) { e.pts = []; e.labelPos = null; });

    Object.keys(perGap).forEach(function (key) {
      var list = perGap[key].sort(function (x, y) {
        return (g.byId[x.from].c + x.srcPort) - (g.byId[y.from].c + y.srcPort) ||
          (g.byId[x.to].c + x.dstPort) - (g.byId[y.to].c + y.dstPort) || x.index - y.index;
      });
      var n = list.length;
      var gs = colA[Number(key)] + geo.along;
      var gw = gapWidth[Number(key)];
      var mid = gs + gw / 2;
      var corridorSpan = Math.max(24, gw - 58);
      var step = n > 1 ? Math.min(16, corridorSpan / (n - 1)) : 0;
      list.forEach(function (e, i) {
        var x = mid + (i - (n - 1) / 2) * step;
        var s = g.byId[e.from], t = g.byId[e.to];
        var c0 = s.c + geo.cross / 2 + e.srcPort;
        var c1 = t.c + geo.cross / 2 + e.dstPort;
        e.corridor = x;
        var ca = s.a + geo.along, cb = t.a;
        e.pts = [
          project(geo.dir, ca, c0),
          project(geo.dir, x, c0),
          project(geo.dir, x, c1),
          project(geo.dir, cb, c1)
        ];
        e.labelPos = null;
      });
    });

    /* ---------------------------------- long jumps and back edges: rails */
    var rails = g.edges.filter(function (e) { return e.rail; });
    var railBase = contentBottom + 38;
    rails.forEach(function (e, i) {
      var s = g.byId[e.from], t = g.byId[e.to];
      var railC = railBase + i * 24;
      e.railC = railC;
      if (e.same) {
        var loopC = s.c - geo.cross / 2 - 26;
        e.pts = [
          project(geo.dir, s.a + geo.along * 0.35, s.c),
          project(geo.dir, s.a + geo.along * 0.35, loopC),
          project(geo.dir, s.a + geo.along * 0.65, loopC),
          project(geo.dir, s.a + geo.along * 0.65, s.c)
        ];
        e.labelPos = { x: 0, y: 0, anchor: 'middle', hidden: true };
        return;
      }
      var outC = s.c + geo.cross / 2;
      var inC = t.c + geo.cross / 2;
      var fromA = s.a + geo.along / 2;
      var toA = t.a + geo.along / 2;
      var dirA = toA > fromA ? 1 : -1;
      e.pts = [
        project(geo.dir, fromA, outC),
        project(geo.dir, fromA, railC),
        project(geo.dir, toA, railC),
        project(geo.dir, toA, inC)
      ];
      e.labelPos = null;
    });

    var crossEnd = rails.length
      ? railBase + (rails.length - 1) * 24 + 40
      : contentBottom + 34;
    var alongEnd = contentEnd + 34;
    var width = geo.dir === 'LR' ? alongEnd : crossEnd;
    var height = geo.dir === 'LR' ? crossEnd : alongEnd;

    /* ---- groups: tone carriers first, boxes only when they tile cleanly ---- */
    var groupDefs = spec.groups || [];
    var groupTone = {};
    groupDefs.forEach(function (gr) { if (gr.tone) groupTone[gr.id] = gr.tone; });

    var groupBoxes = groupDefs.map(function (gr) {
      var members = g.nodes.filter(function (n) { return n.group === gr.id; });
      if (!members.length) return null;
      var pad = 20, labelRoom = 30;
      var minX = Math.min.apply(null, members.map(function (n) { return n.x; }));
      var minY = Math.min.apply(null, members.map(function (n) { return n.y; }));
      var maxX = Math.max.apply(null, members.map(function (n) { return n.x + n.w; }));
      var maxY = Math.max.apply(null, members.map(function (n) { return n.y + n.h; }));
      return {
        id: gr.id, label: gr.label || gr.id, icon: gr.icon || '', tone: gr.tone || '',
        x: minX - pad, y: minY - pad - labelRoom,
        w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 + labelRoom,
        _z: gr.z || 0
      };
    }).filter(Boolean);

    var clash = {};
    for (var gi = 0; gi < groupBoxes.length; gi++) {
      for (var gj = gi + 1; gj < groupBoxes.length; gj++) {
        var A = groupBoxes[gi], B = groupBoxes[gj];
        if (A.x < B.x + B.w && A.x + A.w > B.x && A.y < B.y + B.h && A.y + A.h > B.y) {
          clash[A.id] = true; clash[B.id] = true;
        }
      }
    }
    if (Object.keys(clash).length) {
      // Overlapping group boxes read as a mistake. Keep their tone, drop their boxes.
      groupBoxes.forEach(function (b) { if (clash[b.id]) b.hidden = true; });
    }
    groupBoxes.forEach(function (b) {
      if (b.hidden) return;
      if (b.x + b.w + 4 > width) width = b.x + b.w + 4;
      if (b.y + b.h + 4 > height) height = b.y + b.h + 4;
    });

    var out = {
      dir: geo.dir,
      width: Math.ceil(width),
      height: Math.ceil(height),
      nodes: g.nodes.map(function (n) {
        return {
          id: n.id, label: n.label, sub: n.sub, icon: n.icon,
          tone: n.tone || groupTone[n.group] || '',
          emphasis: n.emphasis, group: n.group, rank: n.rank, band: n.band,
          x: r2(n.x), y: r2(n.y), w: n.w, h: n.h, spec: n.n
        };
      }),
      edges: g.edges.map(function (e) {
        return {
          from: e.from, to: e.to, label: e.label, kind: e.kind,
          style: e.style || (e.back ? 'dashed' : (e.kind === 'async' ? 'dashed' : 'solid')),
          back: e.back, rail: e.rail, same: e.same,
          pts: e.pts.map(function (p) { return { x: r2(p.x), y: r2(p.y) }; }),
          labelPos: e.labelPos, index: e.index
        };
      }),
      groups: groupBoxes.filter(function (b) { return !b.hidden; }),
      geo: geo,
      stats: {
        ranks: rows.length, crossings: bestScore,
        edges: g.edges.length, nodes: g.nodes.length,
        rails: rails.length
      },
      warnings: []
    };

    placeLabels(out);
    return out;
  }

  function boxHit(a, b, pad) {
    pad = pad || 0;
    return a.x < b.x + b.w + pad && a.x + a.w > b.x - pad &&
      a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;
  }

  /* Labels get a shortlist of anchors: the quiet stretch of the route first,
     then the horizontal runs. The first one that hits nothing wins. */
  function placeLabels(out) {
    var nod = out.nodes;
    var placed = [];
    out.edges.forEach(function (e) {
      if (!e.label || e.same || !e.pts || e.pts.length < 3) return;
      var w = Math.min(200, e.label.length * 5.5 + 11);
      var h = 16;
      var segs = [];
      for (var i = 1; i < e.pts.length; i++) segs.push([e.pts[i - 1], e.pts[i]]);
      var last = segs.length - 1;
      var order = [];
      if (segs.length >= 3) order.push(1);
      order.push(0);
      if (last > 0) order.push(last);
      for (var oi = 0; oi < segs.length; oi++) if (order.indexOf(oi) === -1) order.push(oi);

      var cands = [];
      order.forEach(function (si, pref) {
        var p = segs[si][0], q = segs[si][1];
        var horiz = Math.abs(p.y - q.y) < 0.6;
        var vert = Math.abs(p.x - q.x) < 0.6;
        if (!horiz && !vert) return;
        if (Math.abs(q.x - p.x) + Math.abs(q.y - p.y) < 24) return;
        var ts;
        if (!horiz) ts = [0.5, 0.34, 0.66, 0.2, 0.8];
        else if (si === 0) ts = [0.8, 0.45, 0.65, 0.95];
        else if (si === last) ts = [0.2, 0.55, 0.35, 0.05];
        else ts = [0.5, 0.3, 0.7];
        ts.forEach(function (t, k) {
          var x = p.x + (q.x - p.x) * t;
          var y = p.y + (q.y - p.y) * t;
          var anchor = 'middle';
          if (horiz) y -= 11;
          else if (out.dir === 'TB') { x += 9; anchor = 'start'; }
          cands.push({ x: x, y: y, above: horiz, anchor: anchor, rank: pref * 6 + k });
        });
      });
      if (!cands.length) return;
      var best = null, bestScore = -1e9, bestBox = null;
      cands.forEach(function (c) {
        var box = { x: c.anchor === 'start' ? c.x : c.x - w / 2, y: c.y - h / 2, w: w, h: h };
        if (box.x < 0 || box.y < 0 || box.x + w > out.width || box.y + h > out.height) return;
        var score = -c.rank * 3;
        nod.forEach(function (n) {
          if (boxHit(box, n, 5)) score -= 100;
        });
        placed.forEach(function (p) { if (boxHit(box, p, 3)) score -= 40; });
        if (c.above) score += 1;
        if (score > bestScore) { bestScore = score; best = c; bestBox = box; }
      });
      if (!best) return;
      e.labelPos = { x: r2(best.x), y: r2(best.y), anchor: best.anchor, above: best.above };
      e.labelBox = bestBox;
      placed.push(bestBox);
    });
    out.report = out.report || {};
    out.report.crowdedLabels = out.edges.filter(function (e) {
      return e.label && !e.same && !e.labelPos;
    }).map(function (e) { return e.label; });
  }

  /* ---------------------------------------------------------------- audit */

  function pointInBox(p, box, pad) {
    pad = pad || 0;
    return p.x > box.x + pad && p.x < box.x + box.w - pad &&
      p.y > box.y + pad && p.y < box.y + box.h - pad;
  }

  function segHitsBox(p, q, box) {
    var minX = Math.min(p.x, q.x), maxX = Math.max(p.x, q.x);
    var minY = Math.min(p.y, q.y), maxY = Math.max(p.y, q.y);
    if (maxX < box.x || minX > box.x + box.w) return false;
    if (maxY < box.y || minY > box.y + box.h) return false;
    // axis aligned only
    if (Math.abs(p.y - q.y) < 0.5) {
      return p.y > box.y && p.y < box.y + box.h;
    }
    if (Math.abs(p.x - q.x) < 0.5) {
      return p.x > box.x && p.x < box.x + box.w;
    }
    return false;
  }

  function audit(spec, opts) {
    opts = opts || {};
    var lay = layout(spec);
    var problems = [];
    var ids = {};
    (spec.nodes || []).forEach(function (n) {
      if (ids[n.id]) problems.push({ level: 'error', code: 'duplicate-id', msg: 'Duplicate node id "' + n.id + '".' });
      ids[n.id] = true;
    });
    (spec.edges || []).forEach(function (e) {
      if (!ids[e.from]) problems.push({ level: 'error', code: 'unknown-node', msg: 'Edge references missing node "' + e.from + '".' });
      if (!ids[e.to]) problems.push({ level: 'error', code: 'unknown-node', msg: 'Edge references missing node "' + e.to + '".' });
    });
    var specKeys = ['title','subtitle','accent','direction','theme','groups','nodes','edges','legend','footnote','number','className','mount'];
    var nodeKeys = ['id','label','sub','icon','group','tone','emphasis','rank','badge'];
    var edgeKeys = ['from','to','label','kind','style','tone'];
    var tones = ['ink','pine','clay','steel','amber','ok','danger','accent'];
    var kinds = ['sync','async','error','back'];
    Object.keys(spec).forEach(function (k) {
      if (specKeys.indexOf(k) === -1) problems.push({ level: 'warning', code: 'unknown-key', msg: 'Unknown spec key "' + k + '" (ignored).' });
    });
    (spec.nodes || []).forEach(function (n) {
      Object.keys(n).forEach(function (k) {
        if (nodeKeys.indexOf(k) === -1) problems.push({ level: 'warning', code: 'unknown-key', msg: 'Unknown node key "' + k + '" on "' + n.id + '".' });
      });
      if (n.tone && tones.indexOf(n.tone) === -1) problems.push({ level: 'error', code: 'unknown-tone', msg: 'Node "' + n.id + '" has unknown tone "' + n.tone + '". Use ink, pine, clay, steel, amber, ok, danger or accent.' });
      if (n.label && n.label.length > 26) problems.push({ level: 'warning', code: 'long-name', msg: 'Node title "' + n.label + '" will be truncated. Keep it under ~26 characters.' });
      if (n.sub && n.sub.length > 34) problems.push({ level: 'warning', code: 'long-name', msg: 'Node subtitle "' + n.sub + '" will be truncated. Keep it under ~34 characters.' });
    });
    (spec.edges || []).forEach(function (e) {
      Object.keys(e).forEach(function (k) {
        if (edgeKeys.indexOf(k) === -1) problems.push({ level: 'warning', code: 'unknown-key', msg: 'Unknown edge key "' + k + '" on ' + e.from + ' → ' + e.to + '.' });
      });
      if (e.kind && kinds.indexOf(e.kind) === -1) problems.push({ level: 'error', code: 'unknown-kind', msg: 'Edge ' + e.from + ' → ' + e.to + ' has unknown kind "' + e.kind + '". Use sync, async, error or back.' });
      if (e.tone && tones.indexOf(e.tone) === -1) problems.push({ level: 'error', code: 'unknown-tone', msg: 'Edge ' + e.from + ' → ' + e.to + ' has unknown tone "' + e.tone + '".' });
    });
    if (spec.direction && ['LR', 'TB', 'auto'].indexOf(spec.direction) === -1) problems.push({ level: 'error', code: 'bad-direction', msg: 'direction must be "LR", "TB" or "auto".' });
    if (spec.theme && ['light', 'dark', 'auto'].indexOf(spec.theme) === -1) problems.push({ level: 'error', code: 'bad-theme', msg: 'theme must be "light", "dark" or "auto".' });
    if (opts.icons) {
      (spec.nodes || []).forEach(function (n) {
        if (n.icon && opts.icons.indexOf(n.icon) === -1) {
          problems.push({ level: 'error', code: 'unknown-icon', msg: 'Icon "' + n.icon + '" is not in the icon set.' });
        }
      });
    }

    var boxes = lay.nodes.map(function (n) {
      return { id: n.id, x: n.x, y: n.y, w: n.w, h: n.h };
    });
    lay.nodes.forEach(function (n, i) {
      boxes.forEach(function (b, j) {
        if (i >= j) return;
        if (n.x < b.x + b.w && n.x + n.w > b.x && n.y < b.y + b.h && n.y + n.h > b.y) {
          problems.push({ level: 'error', code: 'node-overlap', msg: 'Nodes "' + n.id + '" and "' + b.id + '" overlap.' });
        }
      });
      if (n.x < 0 || n.y < 0) {
        problems.push({ level: 'error', code: 'clip', msg: 'Node "' + n.id + '" sits outside the canvas.' });
      }
    });

    lay.edges.forEach(function (e) {
      for (var i = 1; i < e.pts.length; i++) {
        boxes.forEach(function (b) {
          if (b.id === e.from || b.id === e.to) return;
          if (segHitsBox(e.pts[i - 1], e.pts[i], b)) {
            problems.push({
              level: 'error', code: 'edge-through-node',
              msg: 'Edge ' + e.from + ' → ' + e.to + ' passes through node "' + b.id + '".'
            });
          }
        });
      }
      if (e.labelBox) {
        boxes.forEach(function (b) {
          var lb = e.labelBox;
          if (lb.x < b.x + b.w && lb.x + lb.w > b.x && lb.y < b.y + b.h && lb.y + lb.h > b.y) {
            problems.push({ level: 'warning', code: 'label-over-node', msg: 'Label "' + e.label + '" overlaps node "' + b.id + '".' });
          }
        });
      }
    });

    // collinear overlapping segments (the "two arrows on top of each other" smell)
    var segs = [];
    lay.edges.forEach(function (e) {
      for (var i = 1; i < e.pts.length; i++) {
        var p = e.pts[i - 1], q = e.pts[i];
        if (Math.abs(p.x - q.x) < 0.4 && Math.abs(p.y - q.y) < 0.4) continue;
        segs.push({ e: e, p: p, q: q });
      }
    });
    for (var i = 0; i < segs.length; i++) {
      for (var j = i + 1; j < segs.length; j++) {
        var A = segs[i], B = segs[j];
        if (A.e === B.e) continue;
        if (A.p.x === B.p.x && Math.abs(A.p.x - B.p.x) < 0.4 && A.p.y !== B.p.y) {
          var loA = Math.min(A.p.y, A.q.y), hiA = Math.max(A.p.y, A.q.y);
          var loB = Math.min(B.p.y, B.q.y), hiB = Math.max(B.p.y, B.q.y);
          if (Math.min(hiA, hiB) - Math.max(loA, loB) > 4) {
            problems.push({
              level: 'error', code: 'edge-overlap',
              msg: 'Edges ' + A.e.from + ' → ' + A.e.to + ' and ' + B.e.from + ' → ' + B.e.to + ' run on top of each other.'
            });
          }
        }
        if (A.p.y === B.p.y && Math.abs(A.p.y - B.p.y) < 0.4 && A.p.x !== B.p.x) {
          var loC = Math.min(A.p.x, A.q.x), hiC = Math.max(A.p.x, A.q.x);
          var loD = Math.min(B.p.x, B.q.x), hiD = Math.max(B.p.x, B.q.x);
          if (Math.min(hiC, hiD) - Math.max(loC, loD) > 4) {
            problems.push({
              level: 'error', code: 'edge-overlap',
              msg: 'Edges ' + A.e.from + ' → ' + A.e.to + ' and ' + B.e.from + ' → ' + B.e.to + ' run on top of each other.'
            });
          }
        }
      }
    }

    (lay.edges || []).forEach(function (e) {
      if (e.label && e.label.length > 28) {
        problems.push({ level: 'warning', code: 'long-label', msg: 'Edge label is long; 1–3 words reads best: "' + e.label + '"' });
      }
      if (e.label && !e.labelBox && !e.same) {
        problems.push({ level: 'warning', code: 'label-dropped', msg: 'No room for label "' + e.label + '" on ' + e.from + ' → ' + e.to + '.' });
      }
    });

    if (lay.nodes.length > 12) {
      problems.push({ level: 'warning', code: 'too-many-nodes', msg: lay.nodes.length + ' nodes is past the comfortable limit (8–10). Split the story.' });
    }
    if (lay.stats.crossings > Math.max(2, lay.nodes.length / 3)) {
      problems.push({ level: 'info', code: 'crossings', msg: lay.stats.crossings + ' edge crossings. Reordering nodes or using a rail may reduce them.' });
    }
    if (lay.geo.dir === 'LR' && lay.width > 1720) {
      problems.push({ level: 'warning', code: 'wide', msg: 'Diagram is ' + lay.width + 'px wide; collapse a step or use direction: "TB".' });
    }

    var errors = problems.filter(function (p) { return p.level === 'error'; });
    return {
      ok: errors.length === 0,
      layout: lay,
      problems: problems,
      stats: lay.stats,
      summary: errors.length + ' error(s), ' + (problems.length - errors.length) + ' note(s)'
    };
  }

  /* Auto direction: side-by-side reads best until the chain gets too long. */
  function layout(spec) {
    if (spec.direction === 'TB' || spec.direction === 'LR') return layoutWith(spec, spec.direction);
    var lr = layoutWith(spec, 'LR');
    if (lr.width <= 1520) return lr;
    var tb = layoutWith(spec, 'TB');
    return lr.width * 0.62 > tb.height ? tb : lr;
  }

  root.FlowEngine = {
    layout: layout,
    layoutWith: layoutWith,
    audit: audit,
    version: '1.0.0',
    constants: { W: W, H: H }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.FlowEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
