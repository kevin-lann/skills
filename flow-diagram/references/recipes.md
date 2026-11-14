# Recipes

Seven shapes that cover most requests. Copy the `nodes`/`edges` block, keep the field order, change the copy. Fragments show the shape of the graph, not a whole spec — define any node an edge references.

## 1. Linear spine — the default

Use when the story is genuinely sequential. Add `number: true` if it is a user journey.

```js
{
  direction: "LR", accent: "pine", number: true,
  nodes: [
    { id: "a", label: "Landing page", sub: "marketing site", icon: "globe" },
    { id: "b", label: "Create account", sub: "email + passkey", icon: "user-plus" },
    { id: "c", label: "Verify email", sub: "one-tap link", icon: "mail" },
    { id: "d", label: "First project", sub: "saved", icon: "circle-check", tone: "ok" }
  ],
  edges: [
    { from: "a", to: "b", label: "Get started" },
    { from: "b", to: "c", label: "send link" },
    { from: "c", to: "d", label: "verified" }
  ]
}
```

## 2. Fan-out, fan-in — one write, two consequences

The engine centres the single node against the split and gives each branch its own lane.

```js
nodes: [
  { id: "api", label: "POST /intents", sub: "idempotency key", icon: "server", tone: "pine", emphasis: "accent" },
  { id: "ledger", label: "Ledger", sub: "hold", icon: "database" },
  { id: "psp", label: "PaymentIntent", sub: "card confirmed", icon: "credit-card", tone: "steel" },
  { id: "done", label: "Order confirmed", sub: "receipt + email", icon: "circle-check", tone: "ok" }
],
edges: [
  { from: "api", to: "ledger", label: "hold" },
  { from: "api", to: "psp", label: "charge", tone: "accent" },
  { from: "psp", to: "done", label: "webhook", kind: "async" },
  { from: "ledger", to: "done", label: "settle", kind: "async" }
]
```

## 3. Decision with a failure terminal

A decision is just a node with two labelled outs. Make the failure the same size as success — it is part of the story.

```js
nodes: [
  { id: "match", label: "Compare digests", sub: "constant time", icon: "git-merge" },
  { id: "ok", label: "Allow", sub: "scope attached", icon: "circle-check", tone: "ok" },
  { id: "no", label: "401", sub: "no detail leaked", icon: "circle-x", tone: "danger" }
],
edges: [
  { from: "match", to: "ok", label: "equal" },
  { from: "match", to: "no", label: "mismatch", kind: "error" }
]
```

## 4. Retry loop — a back edge on the rail

Never draw the return arrow through the middle of the diagram. `kind: "back"` sends it under the content automatically.

```js
edges: [
  { from: "send", to: "accept", label: "email", kind: "async" },
  { from: "send", to: "expired", label: "no click", kind: "async" },
  { from: "expired", to: "invite", label: "resend", kind: "back" }
]
```

Give the loop a real trigger (`no click after 7 days`), not just "retry".

## 5. Async pipeline — dashed is a promise, not a style

If the sender does not wait, the edge is dashed. If it can fail silently, say where it is retried.

```js
edges: [
  { from: "api", to: "queue", label: "enqueue", kind: "async" },
  { from: "queue", to: "worker", label: "consume", kind: "async" },
  { from: "worker", to: "db", label: "upsert" },
  { from: "worker", to: "dlq", label: "3 fails", kind: "error" }
]
```

## 6. Swimlanes — two systems, clean bands

Use groups when each system owns consecutive columns. The tone carries the grouping even if a box is suppressed.

```js
groups: [
  { id: "web", label: "Web app", icon: "monitor", tone: "ink" },
  { id: "api", label: "API", icon: "server", tone: "clay" }
],
nodes: [
  { id: "form", label: "Settings", sub: "/settings", icon: "settings", group: "web" },
  { id: "save", label: "Save", sub: "optimistic UI", icon: "mouse-pointer-click", group: "web" },
  { id: "patch", label: "PATCH /me", sub: "zod validated", icon: "server", group: "api", tone: "clay" },
  { id: "table", label: "Users table", sub: "row updated", icon: "database", group: "api" }
],
edges: [
  { from: "form", to: "save", label: "edit" },
  { from: "save", to: "patch", label: "PATCH" },
  { from: "patch", to: "table", label: "update" }
]
```

## 7. Concept explainer — operations, not boxes

For "how does X work", name each step as an operation, number them, and end with the two outcomes. Keep the subtitle as the thesis.

```js
{
  accent: "clay", number: true,
  nodes: [
    { id: "in", label: "Request", sub: "Bearer sk_live_…", icon: "terminal" },
    { id: "hash", label: "Hash the key", sub: "SHA-256", icon: "fingerprint" },
    { id: "find", label: "Look up prefix", sub: "indexed", icon: "search" },
    { id: "cmp", label: "Compare digests", sub: "constant time", icon: "git-merge" }
  ],
  edges: [
    { from: "in", to: "hash", label: "header" },
    { from: "hash", to: "find", label: "digest" },
    { from: "find", to: "cmp", label: "candidate" },
    { from: "cmp", to: "ok", label: "equal" },
    { from: "cmp", to: "no", label: "mismatch", kind: "error" }
  ]
}
```

## Anti-patterns

| Smell | Why it fails | Fix |
|---|---|---|
| 14 nodes, every microservice | Nothing is emphasised; crossing count explodes | Split by phase or viewer |
| A node per HTTP hop (`Browser → CDN → LB → App`) | Four boxes say one thing | One node: "Edge" |
| Edge labels `then`, `next`, `and then` | The arrow already says that | Label the payload or delete it |
| Every node a different tone | Rainbow; grouping signal lost | Tones per system, accent once |
| Numbered failure branch | Implies failure is step 6 | Number only the happy path, or drop numbers |
| Legend with one entry | Decoration | Remove `legend` |
| `sub` repeating the title | Wasted line | Put the endpoint, table or TTL there |
