// The single catalogue of stock-movement kinds (see docs/TRACKING-ARCHITECTURE.md).
// Everything that displays or filters movements reads this registry; adding a
// new kind (e.g. SAMPLE_OUT, SCRAP) is one line here plus a call site that
// posts through app.post_stock_movement — no schema change, no scattered strings.
export interface MovementType {
  label: string
  direction: 'in' | 'out' | 'move' | 'both'
  icon: string
}

export const MOVEMENT_TYPES: Record<string, MovementType> = {
  GRN:               { label: 'Goods Receipt',     direction: 'in',   icon: 'login' },
  DELIVERY:          { label: 'Delivery',          direction: 'out',  icon: 'logout' },
  TRANSFER:          { label: 'Transfer',          direction: 'move', icon: 'swap_horiz' },
  ADJUST:            { label: 'Adjustment',        direction: 'both', icon: 'tune' },
  PUTAWAY:           { label: 'Putaway',           direction: 'move', icon: 'move_to_inbox' },
  PICK:              { label: 'Pick',              direction: 'out',  icon: 'shopping_cart_checkout' },
  RETURN:            { label: 'Return',            direction: 'in',   icon: 'undo' },
  SALES_RETURN:      { label: 'Sales Return',      direction: 'in',   icon: 'assignment_return' },
  EXCHANGE:          { label: 'Exchange',          direction: 'both', icon: 'swap_horizontal_circle' },
  REPLACEMENT:       { label: 'Replacement',       direction: 'both', icon: 'cached' },
  RETURN_INSPECTION: { label: 'Return Inspection', direction: 'both', icon: 'search_check' },
  REFURBISHMENT:     { label: 'Refurbishment',     direction: 'both', icon: 'build_circle' },
  COUNT_ADJUST:      { label: 'Count Variance',    direction: 'both', icon: 'fact_check' }
}

export const movementLabel = (t: string | null | undefined) => (t && MOVEMENT_TYPES[t]?.label) || t || '—'
