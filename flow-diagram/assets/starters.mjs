/* Starter stories. Each one is a complete, audited spec — replace the copy, keep the shape. */

export const starters = {
  nav: `{
  title: "First run",
  subtitle: "The shortest path from landing page to a saved project.",
  accent: "pine",
  number: true,
  direction: "LR",
  nodes: [
    { id: "land", label: "Landing page", sub: "marketing site", icon: "globe" },
    { id: "signup", label: "Create account", sub: "email + passkey", icon: "user-plus" },
    { id: "verify", label: "Verify email", sub: "one-tap link", icon: "mail" },
    { id: "pick", label: "Pick a template", sub: "three starters", icon: "layout-dashboard" },
    { id: "done", label: "First project", sub: "saved to workspace", icon: "circle-check", tone: "ok" }
  ],
  edges: [
    { from: "land", to: "signup", label: "Get started" },
    { from: "signup", to: "verify", label: "send link" },
    { from: "verify", to: "pick", label: "verified" },
    { from: "pick", to: "done", label: "create" }
  ]
}`,

  request: `{
  title: "Payment, end to end",
  subtitle: "One POST, one webhook, and the two writes that make it safe to retry.",
  accent: "pine",
  direction: "LR",
  legend: true,
  nodes: [
    { id: "pay", label: "Pay with card", sub: "saved card", icon: "mouse-pointer-click" },
    { id: "api", label: "POST /intents", sub: "idempotency key", icon: "server", tone: "accent", emphasis: "accent" },
    { id: "ledger", label: "Ledger", sub: "hold + double entry", icon: "database", tone: "pine" },
    { id: "stripe", label: "PaymentIntent", sub: "card confirmed", icon: "credit-card", tone: "steel" },
    { id: "done", label: "Order confirmed", sub: "receipt + email", icon: "circle-check", tone: "ok" }
  ],
  edges: [
    { from: "pay", to: "api", label: "POST" },
    { from: "api", to: "ledger", label: "hold" },
    { from: "api", to: "stripe", label: "charge", tone: "accent" },
    { from: "stripe", to: "done", label: "webhook", kind: "async" },
    { from: "ledger", to: "done", label: "settle", kind: "async" }
  ]
}`,

  code: `{
  title: "One call to createOrder()",
  subtitle: "A pure guard, one charge, and a transaction that can still roll back.",
  accent: "steel",
  direction: "TB",
  nodes: [
    { id: "handler", label: "handleCreateOrder", sub: "POST /orders", icon: "terminal" },
    { id: "check", label: "validateCart()", sub: "pure · no I/O", icon: "list-checks" },
    { id: "price", label: "priceOrder()", sub: "catalog read", icon: "table", tone: "steel" },
    { id: "charge", label: "charge()", sub: "idempotency key", icon: "credit-card", emphasis: "accent" },
    { id: "commit", label: "commit()", sub: "one transaction", icon: "database", tone: "ok" },
    { id: "bad", label: "throw 422", sub: "before any write", icon: "circle-x", tone: "danger" }
  ],
  edges: [
    { from: "handler", to: "check", label: "body" },
    { from: "check", to: "price", label: "ok" },
    { from: "price", to: "charge", label: "total" },
    { from: "charge", to: "commit", label: "auth code" },
    { from: "check", to: "bad", label: "invalid", kind: "error" }
  ],
  footnote: "Validation runs before the first write, so a bad cart costs nothing."
}`,

  concept: `{
  title: "How an API key is checked",
  subtitle: "Why the key itself is never stored, and why the lookup is still one index hit.",
  accent: "clay",
  number: true,
  direction: "LR",
  nodes: [
    { id: "req", label: "Request", sub: "Authorization: Bearer sk_…", icon: "terminal" },
    { id: "hash", label: "Hash the key", sub: "SHA-256, no salt", icon: "fingerprint" },
    { id: "lookup", label: "Look up prefix", sub: "indexed, first 8 chars", icon: "search" },
    { id: "match", label: "Compare digests", sub: "constant time", icon: "git-merge" },
    { id: "ok", label: "Allow", sub: "scope attached", icon: "circle-check", tone: "ok" },
    { id: "no", label: "401", sub: "no detail leaked", icon: "circle-x", tone: "danger" }
  ],
  edges: [
    { from: "req", to: "hash", label: "header" },
    { from: "hash", to: "lookup", label: "digest" },
    { from: "lookup", to: "match", label: "candidate" },
    { from: "match", to: "ok", label: "equal" },
    { from: "match", to: "no", label: "mismatch", kind: "error" }
  ]
}`
};
