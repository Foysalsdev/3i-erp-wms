# Tracking Architecture — every movement, every pending matter

**Goal.** One software that digitises all Whirlpool warehouse work. Two guarantees
follow from that goal, and this document is the blueprint for both:

1. **Every movement is tracked** — stock, serials, vehicles, documents, money —
   queryable from one place, answering "what happened / where is it / who did it".
2. **Every pending matter surfaces itself** — nothing waits silently; each open
   item knows *what* is due, *who* owes it, and *how long* it has waited.

---

## 1. What already exists (the foundation)

| Layer | Table / code | What it gives us |
| --- | --- | --- |
| Change audit | `audit_logs` (generic trigger on every business table) | who / when / old→new for **every** insert, update, delete |
| Stock movement | `inventory_ledger` + `app.post_stock_movement` | qty in/out, balance-after, type (GRN/DELIVERY/TRANSFER/ADJUST/REPLACEMENT/COUNT_ADJUST), reference doc, negative-stock guard, row locks |
| Serial lifecycle | `serial_numbers.status` + audit_logs | in_stock → reserved → delivered → returned … per unit |
| Document workflow | `workflow.ts` (SO stages), GRN status derivation (MIGO→MIRO→posted), op-registry `statuses`/`openStatuses` | per-document state machines |
| Registries | `OPERATIONS`, `MASTERS`, inbound `docConfigs` | config-driven modules — new doc types without new code |

**Architectural rule this design honours:** `audit_logs` and `inventory_ledger`
are the two write-time sources of truth. We **derive** everything else from them
— we never create a second place that must be kept in sync by hand.

## 2. Gaps

- Movement types are hardcoded strings scattered through feature files.
- "Pending" logic is re-implemented per module (SO workflow, GRN chips,
  op `openStatuses`, report filters) — no single answer to *"what is pending
  in this warehouse right now, and whose move is it?"*
- No role-scoped task view: every user sees module lists, not *their* queue.
- Cross-entity trails (a serial's life, a vehicle's day) require joining
  several screens by hand.

## 3. Design

### 3.1 Movement type registry (data, not code)

`src/lib/movements.ts` — the single catalogue of movement kinds:

```ts
export const MOVEMENT_TYPES = {
  GRN:         { label: 'Goods Receipt',   direction: 'in',   icon: 'login' },
  DELIVERY:    { label: 'Delivery',        direction: 'out',  icon: 'logout' },
  TRANSFER:    { label: 'Transfer',        direction: 'move', icon: 'swap_horiz' },
  ADJUST:      { label: 'Adjustment',      direction: 'both', icon: 'tune' },
  REPLACEMENT: { label: 'Replacement',     direction: 'both', icon: 'cached' },
  COUNT_ADJUST:{ label: 'Count Variance',  direction: 'both', icon: 'fact_check' },
  // future: SAMPLE_OUT, INTERNAL_USE, SCRAP … added here, nowhere else
} as const
```

Ledger tabs, reports, dashboards and the Daily In/Out report all read this
registry. Adding a movement kind = one registry line + (if it posts stock)
one call site using `post_stock_movement`. No schema change.

### 3.2 Unified Movement Trail (derived, not duplicated)

A read model `entity_trail(kind, ref_no)` that merges, per entity:

- `inventory_ledger` rows (stock legs) — by `reference_no`
- `audit_logs` rows (status/data changes) — by `table_name + record_id`
- `serial_numbers` transitions (unit legs) — by `reference_no`

Phase 1 implements this as a **frontend hook** (`useEntityTrail`) that issues
the three queries and merges by timestamp — zero schema risk, works today
(DocTimeline already does ⅓ of this). Phase 3 can materialise it as a SQL view
if volume demands. The UI face is one shared `<TrailPanel>` used by every
overview modal, replacing per-module timeline variants.

### 3.3 Pending Matter Engine

One registry describes what "pending" means per document type; one engine
evaluates it everywhere. `src/lib/pending.ts`:

```ts
export interface PendingRule {
  key: string                 // 'so-invoice', 'grn-miro', 'challan-cn', …
  table: string               // source table
  filter: (q) => q            // supabase filter for "open" rows
  matter: (row) => string     // human sentence: 'Enter SAP invoice for SO-…'
  ownerPerm: string           // who acts: 'outbound.edit', 'inbound.post', …
  route: (row) => string      // deep link that opens the exact work screen
  ageFrom: (row) => string    // date the wait started (for overdue math)
  slaDays?: number
}
```

Seed rules (covers today's real waits):

| Rule | Pending when | Owner |
| --- | --- | --- |
| SO awaiting scan | status draft/pending/approved | warehouse picker |
| SO awaiting invoice | status picking/packed | billing |
| SO awaiting dispatch | status invoiced | dispatch desk |
| GRN awaiting MIRO | sap_miro_ref null, not posted | billing |
| GRN awaiting posting | status completed, posted_at null | warehouse manager |
| Challan not issued | status draft | warehouse |
| Courier CN missing | delivery_method courier, tracking null, issued | dispatch desk |
| POD not received | challan issued, no POD row | delivery follow-up |
| PR not received | status pending/approved | inbound |
| Stock count draft | status draft | inventory officer |

The engine powers three surfaces from the same rules:

1. **My Tasks** (new home widget/tab): rules filtered by the user's
   permissions → their queue, oldest first, one tap to the work screen.
2. **Dashboard "Needs attention" strip**: counts per rule + overdue reds.
3. **Pending Matters report**: full list with age, owner and export.

New module ⇒ add one rule ⇒ it appears in all three automatically.

### 3.4 What we explicitly do NOT build

- No second write-path for events (audit trigger already captures all writes).
- No queue/workflow tables until a real approval chain needs them.
- No per-module dashboard code — surfaces read the rule registry only.

## 4. Delivery phases

| Phase | Scope | Risk |
| --- | --- | --- |
| **P1** | `movements.ts` + `pending.ts` registries; Pending engine; **My Tasks** widget on Dashboard; "Needs attention" strip | UI-only, no schema |
| **P2** | `useEntityTrail` + shared `<TrailPanel>` in SO/GRN/Challan/Serial overviews; Pending Matters report tab | UI-only |
| **P3** | Materialised SQL views for trail & pending (perf, mobile), notification hooks (bell → pending deltas) | additive SQL |

Each phase ships independently; nothing breaks if we stop after any phase.
