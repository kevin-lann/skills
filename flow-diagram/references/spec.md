# Spec reference

Everything the renderer reads. Unknown keys are reported by the audit; nothing crashes.

## Top level

| Key | Type | Default | Notes |
|---|---|---|---|
| `title` | string | — | One line, sentence case, ≤ 60 chars. The claim the diagram proves. |
| `subtitle` | string | — | One sentence with the payoff or constraint. |
| `accent` | `pine` `clay` `steel` `amber` `ink` | `pine` | One per diagram. Colours the badge, the emphasis node, accent edges, legend marks. |
| `direction` | `LR` `TB` `auto` | `auto` | `auto` keeps LR until the drawing would exceed ~1520px, then stacks vertically. |
| `theme` | `light` `dark` `auto` | `light` | `auto` follows the OS. |
| `number` | boolean | `false` | Adds step badges in topological order. Set per-node `badge` to override. |
| `legend` | `true` or array | — | `true` derives entries from the edge kinds present (only if >1 kind). An array overrides the wording: `[{ label: "Sync", kind: "sync" }, { label: "Event", kind: "async", dashed: true }]`. |
| `groups` | array | — | Tone carriers and optional boxes. See below. |
| `footnote` | string | — | The fact a reader would otherwise ask about. Renders under a hairline. |
| `nodes` | array | required | |
| `edges` | array | required | |
| `mount` | string | `"diagram"` | Element id when rendering with `FlowKit.render`. |
| `className` | string | — | Extra class on the card root. |

## Node

| Key | Type | Notes |
|---|---|---|
| `id` | string | Unique. Used by edges. |
| `label` | string | 1–3 words, ≤ 26 chars. A noun (`Ledger`) or an action (`Hash the key`). No "Step 1:". |
| `sub` | string | A concrete fact, ≤ 34 chars: endpoint, table, TTL, status. One line, ellipsised. |
| `icon` | string | A name from `icons.md`. Missing icons are an audit error. |
| `group` | string | Matches a group id. Inherits the group's tone. |
| `tone` | `ink` `pine` `clay` `steel` `amber` `ok` `danger` `accent` | Tints the icon chip and, if `emphasis: "accent"`, the surface. Defaults to the group tone, then ink. |
| `emphasis` | `accent` `muted` | `accent` adds an accent hairline and a 4% accent wash. Use once. `muted` removes the shadow. |
| `rank` | number | Force the column. Rarely needed; useful to pull a node next to a peer. |
| `badge` | number/string or `false` | Overrides the step number; `false` hides it on one node. |

## Edge

| Key | Type | Notes |
|---|---|---|
| `from` | node id | Must exist. |
| `to` | node id | Must exist. Back edges (target in an earlier column) route on the rail. |
| `label` | string | 1–3 words: the payload (`POST`), the decision (`equal`), or the verb (`hold`). Not "then". |
| `kind` | `sync` `async` `error` `back` | `sync` solid neutral · `async` dashed steel-blue · `error` dashed rust · `back` dashed neutral. |
| `style` | `solid` `dashed` `dotted` | Overrides the kind's line. Use sparingly. |
| `tone` | `accent` etc. | `accent` promotes one edge on the critical path. |

Parallel edges between the same two nodes are allowed; ports and lanes separate them.

## Group

```js
groups: [
  { id: "web", label: "Web app", icon: "monitor", tone: "ink" },
  { id: "api", label: "API", icon: "server", tone: "clay" }
]
```

- A group's `tone` becomes the default tone of its nodes.
- A group box is drawn around the member nodes **only if it does not intersect another group's box**. This keeps "API → Stripe → API" from producing overlapping frames. When boxes are suppressed the tones remain, so the grouping still reads.
- Groups read best when each one owns a contiguous band of columns. If your systems interleave, use tones and drop the boxes.
- Group label sits inside the top-left of the box, with a 30px label room above the first node.

## Tone palette

| Tone | Light | Dark | Use for |
|---|---|---|---|
| `ink` | `#3F3B34` | `#D8D4CB` | default, UI, actors |
| `pine` | `#2C6B57` | `#5FB79B` | your service, success-ish writes |
| `clay` | `#A9542F` | `#D98A61` | second system, product surface |
| `amber` | `#8A6414` | `#D2AC5A` | caution, queued work |
| `steel` | `#3A5F7D` | `#7FAED1` | third-party, async |
| `ok` | `#3B7050` | `#6FBE8C` | terminal success |
| `danger` | `#A4402F` | `#E08472` | failure, expired, rejected |

Accents: `pine #266B57`, `clay #A0512D`, `steel #345B7A`, `ink #2B2924`, `amber #8A6414` (dark variants are lighter).

## Render API

```js
FlowKit.render(SPEC, { target: element, audit: true });
FlowKit.audit(SPEC);            // { ok, problems, stats, layout }
window.__FLOW_REPORT__          // set by render(..., { audit: true }) on the card root
```

The generated file already calls `FlowKit.render(SPEC, { audit: true })`. To embed the same diagram in an existing page, copy the `assets/` files and render into a div.

## Copy rules

- `title` names the claim: "Payment, end to end", "Inside one invoice read".
- `subtitle` adds what the picture cannot show: "One POST, one webhook, and the two writes that make retries safe."
- `footnote` closes the loop: the invariant, the TTL, the reason the design is safe.
- Node `sub` is evidence, never a paraphrase. `sub: "Postgres · double entry"` earns its line; `sub: "handles payments"` does not.
