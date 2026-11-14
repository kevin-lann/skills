# Layout and routing

The engine is a small Sugiyama pipeline. Knowing its four moves explains every audit message.

## 1. Rank — which column a node lands in

Topological order; every node sits one column after its furthest predecessor. Cycles are detected by DFS: the edge that closes the loop is marked `back` and routed on the rail, so the rest still ranks cleanly.

Implication: a node with two inputs moves right to wait for both. If `Order confirmed` is fed by `Ledger` and `Stripe`, it lands after both. That is correct for a flow and it is why flows get wide.

Force a column with `rank: 2` when you want a node to sit beside a peer rather than after it.

## 2. Order — which row a node lands in

Eight barycentre sweeps (median of neighbours, alternating direction), keeping the ordering with the fewest crossings. Then each column is centred vertically.

There is no manual `row`. Order is driven by `nodes[]` order as a tie-break: within a column, earlier-author nodes sit higher. So arrange the array roughly in the order you want to read.

## 3. Ports — where an edge touches a node

A node's outgoing edges are sorted by the row of their targets and spread evenly across the trailing face, at most 18px apart. Incoming edges are spread the same way across the leading face.

This is why a fan-out looks like a fan and not like five arrows from one pixel. A node with one edge gets one centred port.

## 4. Corridors — how adjacent edges avoid each other

Every edge between neighbouring columns gets its own vertical lane inside that gap, ordered to match its ports. The gap itself is sized by what must live inside it: one lane per edge plus room for the widest edge label. So a wide label widens the gap instead of being truncated.

Consequences:

- Two edges can **cross** (unavoidable in some graphs), but they cross at right angles in different lanes — never run on top of each other.
- Corridor labels sit on their own lane, which is why they do not collide.
- A label longer than ~28 characters starts to dominate the gap. Shorten the label; the audit warns at 28.

## 5. Rails — long jumps and loops

An edge that skips a column, goes backwards, or loops to itself cannot use a corridor: a vertical run through an intermediate column would cut through its nodes. Those edges leave from the bottom of the source, travel along a dedicated rail below the content, and enter the bottom of the target. Each rail has its own y, so rails stack without touching.

`kind: "back"` is for retries, resends, and returns. It routes on the rail automatically and is dashed neutral, distinct from dashed steel `async`.

## 6. Groups

A group box is the bounding box of its member nodes, plus 20px padding and 30px of label room. Boxes that intersect **another group's box** are suppressed; tones are kept. This is the sane behaviour for interleaved systems like `API → Stripe → API`, where a naive bounding box would swallow half the diagram.

If you want the boxes, design for clean bands: each group owns a run of consecutive columns.

## Direction

`LR` is the default because reading order is horizontal and diagrams are screens. `TB` is better when:

- the chain is longer than five columns,
- the container is narrow (docs sidebar, phone, slide half),
- the story is a checklist or a pipeline with equal-weight steps.

`auto` measures the LR result and switches to TB above ~1520px if TB is meaningfully more compact. Set `LR` or `TB` explicitly when the layout is part of the point.

## Geometry constants

| | LR | TB |
|---|---|---|
| Node box | 200 × 68 | 200 × 68 |
| Column gap | 108 (widens with labels) | 84 |
| Row gap | 26 | 44 |
| Corner radius on routes | 11 | 11 |
| Port spacing | ≤ 18 | ≤ 18 |
| Rail pitch | 24 | 24 |

The card supplies the outer margin; the canvas has no padding of its own, so the first node aligns with the title.

## Audit codes → remedy

| Code | Level | What it means | Fix |
|---|---|---|---|
| `node-overlap` | error | Two boxes share space. | Should be impossible; report it. |
| `edge-through-node` | error | A route crosses an unrelated box. | Give the edge a `rank` hint, reorder `nodes[]`, or split the diagram. |
| `edge-overlap` | error | Two edges share a segment. | Should be impossible; report it. |
| `label-over-node` | warning | An edge label touches a node. | Shorten the label, or move the edge earlier/later in the flow. |
| `label-dropped` | warning | No clean anchor for a label. | Shorten it; the pill could not fit between nodes. |
| `long-label` | warning | > 28 chars. | 1–3 words. |
| `unknown-icon` | error | Icon not in the catalog. | Pick one from `icons.md`. |
| `unknown-tone` / `unknown-kind` | error | Typo in an enum. | Use the documented values. |
| `unknown-key` | warning | A key the renderer ignores. | Usually a typo (`colour`, `subtitle` on a node). |
| `long-name` | warning | Title > 26 or sub > 34 chars. | Shorten; it will ellipsise. |
| `too-many-nodes` | warning | > 12 nodes. | Split the story into two diagrams. |
| `crossings` | info | More crossings than the heuristic likes. | Reorder `nodes[]`; consider `TB`; check for a node that wants a `rank`. |
| `wide` | warning | LR width > 1720px. | `direction: "TB"`, or cut a step. |
| `clip` | error | A node sits outside the canvas. | Report it. |
| `duplicate-id` | error | Two nodes share an id. | Rename one. |
| `unknown-node` | error | An edge points at a node that does not exist. | Fix the id or add the node. |
| `bad-direction` / `bad-theme` | error | Enum typo at the top level. | `LR` \| `TB` \| `auto`; `light` \| `dark` \| `auto`. |

## The five-minute visual review

1. Put the PNG at 100% and squint. The darkest path should be the important one.
2. Follow the arrows with a finger. Any moment you lift the finger to find the continuation is a layout defect.
3. Read every label. If one needs a second pass, it is too long.
4. Count accents. More than one accent node or three accent edges means nothing is emphasised.
5. Check the edges you did **not** draw: a missing failure path is a content bug, not a layout bug.
