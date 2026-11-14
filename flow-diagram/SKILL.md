---
name: flow-diagram
description: Build a beautiful, minimal flow diagram as a single self-contained HTML file — user navigation flows, onboarding journeys, code execution paths, app-to-app request traces, async pipelines, and multi-step concept explainers. Uses a layered layout engine with orthogonal edge routing and lane assignment so arrows never tangle, cross labels, or overlap; ships a Lucide icon set and a warm paper / ink visual system. Use when the user asks to diagram, visualize, map, or explain a flow, journey, path, trace, call stack, sequence, request lifecycle, or "how X works" in steps, or asks for a diagram that looks designed rather than generated.
license: MIT
metadata:
  version: "1.0"
---

# Flow diagram

A flow diagram is an argument about cause and effect. The engine handles geometry; you handle the argument.

**Never hand-place boxes or draw arrows yourself.** This skill ships a layout engine that ranks nodes, orders them to minimize crossings, spreads ports across each node's face, gives every edge its own routing lane, and sends long jumps around the outside on rails. Hand-positioned SVG is how diagrams end up with tangled lines. Declare the story, let the engine draw it.

## 1. Pick the kind of flow

| Kind | A node is | Flow direction | Typical size |
|---|---|---|---|
| `nav` — navigation / journey | a screen or user action | left → right, numbered | 4–7 |
| `code` — execution path | a function, guard, service call | top → bottom (call stack) | 5–8 |
| `request` — app to app | a hop between systems | left → right | 5–9 |
| `concept` — explainer | a step in an idea | left → right, numbered | 4–7 |

Same engine, different copy. A `request` diagram names systems and payloads; a `concept` diagram names operations ("Hash the key", "Compare digests").

## 2. Write the spine before the spec

List the steps as plain lines, in order. Then cut:

- **5–9 nodes.** Over 10, split into two diagrams ("the happy path" and "what happens on failure").
- **One idea per node.** If a node's subtitle restates its title, delete the subtitle.
- **Merge hops that always travel together.** "Client → CDN → Load balancer" is one node unless the CDN is the point.
- **Every edge carries a payload or a decision.** If you cannot label it in 1–3 words, it probably is not an edge.
- **The user is not always a node.** If the flow starts with a click, start at the screen, not at "User".

The one-sentence test: can you say the whole diagram out loud as a sentence with "so" and "because"? If not, the story is not ready.

## 3. Scaffold

Run this from the user's project, pointing at this skill's folder:

```bash
node <skill>/scripts/new.mjs checkout --type request --out ./diagrams
```

Flags: `--type nav|request|code|concept`, `--out <dir>`, `--title "..."`, `--accent pine|clay|steel|amber|ink`, `--direction LR|TB`, `--dark`, `--force`.

This writes one standalone HTML file (CSS, engine, icons and the spec all inline — no server, no dependencies, safe to email). Edit only the block between `/* @spec:start */` and `/* @spec:end */`.

## 4. The spec

```js
const SPEC = {
  title: "Payment, end to end",
  subtitle: "One POST, one webhook, and the two writes that make retries safe.",
  accent: "pine",                 // pine | clay | steel | amber | ink
  direction: "LR",                // LR | TB | auto (default)
  number: false,                  // step badges on every node
  legend: true,                   // only when more than one line style is used
  nodes: [
    { id: "pay", label: "Pay with card", sub: "saved card", icon: "mouse-pointer-click" },
    { id: "api", label: "POST /intents", sub: "idempotency key", icon: "server",
      tone: "accent", emphasis: "accent" },
    { id: "ledger", label: "Ledger", sub: "hold + double entry", icon: "database" },
    { id: "psp", label: "PaymentIntent", sub: "card confirmed", icon: "credit-card", tone: "steel" },
    { id: "done", label: "Order confirmed", sub: "receipt + email", icon: "circle-check", tone: "ok" }
  ],
  edges: [
    { from: "pay", to: "api", label: "POST" },
    { from: "api", to: "ledger", label: "hold" },
    { from: "api", to: "psp", label: "charge", tone: "accent" },
    { from: "psp", to: "done", label: "webhook", kind: "async" },
    { from: "ledger", to: "done", label: "settle", kind: "async" }
  ],
  footnote: "The webhook is the only source of truth."
};
```

**Node fields:** `id`, `label` (≤ 26 chars), `sub` (≤ 34 chars), `icon`, `group`, `tone`, `emphasis` (`accent` | `muted`), `rank`, `badge`.
**Edge fields:** `from`, `to`, `label` (1–3 words), `kind` (`sync` | `async` | `error` | `back`), `style`, `tone`.
**Groups:** tone is inherited by member nodes; the box is drawn only when group boxes do not overlap. Overlapping groups keep their tone and lose the box — that is deliberate, not a bug.

Full field reference, tone palette and edge semantics: `references/spec.md`.
Icon names (113, Lucide): `references/icons.md`. **Only use names from that list** — a missing icon renders as a grey dot and the audit fails.

## 5. Verify, then look at it

```bash
node <skill>/scripts/audit.mjs diagrams/checkout.html
```

Zero errors is the bar. The audit checks node overlap, edges running through nodes, two edges drawn on top of each other, labels colliding with nodes, canvas clipping, icon names, typos in keys, and story size. Warnings explain what to change; `error` items must be fixed.

Then look at the rendered result:

```bash
node <skill>/scripts/shot.mjs diagrams/checkout.html     # PNG at 2×, cropped to the card
open diagrams/checkout.html
```

Three things to check with your own eyes, because no audit can see them:

1. **Reading order** — does the eye move left to right (or top to bottom) without jumping back?
2. **Breathing room** — are any two lines, or a line and a label, closer than ~8px? Widen the gap by shortening the label, not by adding whitespace.
3. **Truncation** — is any title or subtitle cut off with "…"? Shorten the copy. Never widen a node.

If the audit complains and the fix is not obvious, read `references/layout.md` — it explains the routing model and the exact remedies.

## 6. Design law

- **One accent per diagram.** Accent marks the single most important node (the decision, the write, the failure). Two accents cancel out.
- **Monochrome first.** Nodes are paper and ink. Tone tints the icon and, lightly, the surface. No gradients, no glows, no neon, no purple.
- **Kind beats decoration.** `async` edges are dashed and steel-blue; `error` edges are dashed and rust; `back` edges are dashed and neutral. Do not also colour the nodes to repeat the same fact.
- **Icons are labels, not illustrations.** One icon per node, from the catalog, chosen for the noun (a database, a card, a terminal). No emoji.
- **Copy is concrete.** `sub` holds the fact: the endpoint, the table, the timeout, the status code. "Handles the request" says nothing.
- **Numbers only for ordered steps.** Do not number a concept diagram where branches are equal.
- **A legend only when it decodes something.** One line style needs no legend.
- **Nothing touches.** The audit enforces geometry; you enforce the last 8 pixels of judgement.

## 7. When it does not fit

- **Wide and thin (> 5 columns)** — set `direction: "TB"` or split the story. `auto` switches at ~1520px.
- **A branch that ends far away** — long jumps are routed on rails below the diagram automatically; give the edge a short label and leave it alone.
- **Retry / loop** — use `kind: "back"`; it routes on the rail and reads as a return path.
- **Two systems, several hops** — use `groups` only if each group occupies a clean band of columns. If the systems interleave, drop the groups and give each system a tone instead.
- **The audit says "too many nodes"** — it is right. Two diagrams beat one crowded one.
- **Stuck on the shape** — `references/recipes.md` has seven worked patterns (linear, fan-out, decision, retry, async pipeline, swimlanes, explainer) with copyable specs.

## 8. Deliver

- Default deliverable: the HTML file. It is self-contained and opens anywhere.
- If the user wants it in a doc, slide, or chat: `scripts/shot.mjs` produces a 2× PNG cropped to the card with a 24px margin.
- If they want to edit: the spec block is the whole diagram — no build step, no assets to lose.

## Files

```
SKILL.md
assets/     flow.css · engine.js · render.js · icons.js · starters.mjs
scripts/    new.mjs  audit.mjs  shot.mjs  _lib.mjs
examples/   six diagrams, each as .html and a 2× .png
references/ spec.md · layout.md · icons.md · recipes.md
```

Examples are the quality bar: read a `.png` before building your first diagram in a session, and open the matching `.html` when you want the spec that produced it.
