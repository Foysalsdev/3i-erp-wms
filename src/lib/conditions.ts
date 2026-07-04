// ---------------------------------------------------------------------------
// Stock condition registry — the single catalogue of every state a unit can
// sit in inside the warehouse. Real appliance-warehouse life is richer than
// good/damaged: units come back from replacements, boxes get torn, parts get
// pulled out of fresh units. Each row of inventory_stock carries one of these
// keys; only `saleable` conditions count toward available-to-sell, everything
// else is the non-saleable pool that must stay visible and traceable.
//
// WHERE a unit came from / WHY it changed / WHAT document covers it is not
// stored here — every condition move posts through a Condition Change
// document (reverse module) or a stock movement, both of which land in
// inventory_ledger with reason + reference, so the trail is always queryable.
//
// Adding a condition = one entry here + extending the DB check constraints
// (see migration add_extended_stock_conditions). No feature code changes.
// ---------------------------------------------------------------------------

export type Tone = 'positive' | 'negative' | 'neutral' | 'info' | 'critical'

export interface StockCondition {
  key: string
  label: string
  saleable: boolean
  tone: Tone
  icon: string
  hint: string
}

export const STOCK_CONDITIONS: Record<string, StockCondition> = {
  good: {
    key: 'good', label: 'Fresh', saleable: true, tone: 'positive', icon: 'verified',
    hint: 'Fresh saleable stock — billed & dispatched as normal'
  },
  replacement_return: {
    key: 'replacement_return', label: 'Replacement Return', saleable: false, tone: 'info', icon: 'cached',
    hint: 'Came back through a replacement — awaiting inspection/decision'
  },
  box_damaged: {
    key: 'box_damaged', label: 'Box Damaged', saleable: false, tone: 'critical', icon: 'package_2',
    hint: 'Packet torn / exterior damage — unit itself likely OK'
  },
  parts_removed: {
    key: 'parts_removed', label: 'Parts Removed', saleable: false, tone: 'critical', icon: 'build',
    hint: 'Parts taken out of a fresh unit — incomplete'
  },
  damaged: {
    key: 'damaged', label: 'Damaged', saleable: false, tone: 'negative', icon: 'report',
    hint: 'Physically damaged unit'
  },
  quarantine: {
    key: 'quarantine', label: 'Quarantine', saleable: false, tone: 'critical', icon: 'gpp_maybe',
    hint: 'Held for inspection'
  }
}

export const CONDITION_LIST = Object.values(STOCK_CONDITIONS)
export const NON_SALEABLE = CONDITION_LIST.filter(c => !c.saleable)

export const conditionLabel = (key: string | null | undefined) =>
  (key && STOCK_CONDITIONS[key]?.label) || key || '—'
export const conditionTone = (key: string | null | undefined): Tone =>
  (key && STOCK_CONDITIONS[key]?.tone) || 'neutral'
export const isSaleable = (key: string | null | undefined) =>
  !!(key && STOCK_CONDITIONS[key]?.saleable)

// Options shape used by the ui/Combobox and native selects.
export const CONDITION_OPTIONS = CONDITION_LIST.map(c => ({ id: c.key, label: c.label }))
