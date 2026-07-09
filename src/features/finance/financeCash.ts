// The finance module's cash model. A Credit purchase is a payable — it does not
// move cash until the vendor is actually paid — so cash-in-hand excludes credit
// expenses and instead counts recorded vendor payments as the outflow. Accrual
// "what we spent" views (Dashboard by-head, Registers) keep counting everything.

const amt = (r: any) => Number(r?.amount) || 0

export const isCredit = (e: any) => String(e?.payment_mode ?? '').toLowerCase() === 'credit'
// Cash that actually left the drawer for this expense at purchase time (0 for credit).
export const cashOut = (e: any) => (isCredit(e) ? 0 : amt(e))

// Cash outflow across a set of expenses + vendor payments (optionally date-filtered
// by the caller before passing in).
export const cashOutflow = (expenses: any[], payments: any[]) =>
  expenses.reduce((s, e) => s + cashOut(e), 0) + payments.reduce((s, p) => s + amt(p), 0)

// Keyed by normalized payee_name text, not vendor_id — Vendor/Payee is a
// free-text field (no master list), and payee_name has always been populated
// on every expense row (even historically, copied from the linked vendor at
// save time), so this works uniformly for old and new rows alike.
export const payeeKey = (name?: string) => (name ?? '').trim().toLowerCase()

// Per-payee outstanding due = Σ credit purchases − Σ payments.
export function vendorDues(expenses: any[], payments: any[]): Map<string, number> {
  const due = new Map<string, number>()
  for (const e of expenses) { const k = payeeKey(e.payee_name); if (isCredit(e) && k) due.set(k, (due.get(k) ?? 0) + amt(e)) }
  for (const p of payments) { const k = payeeKey(p.payee_name); if (k) due.set(k, (due.get(k) ?? 0) - amt(p)) }
  return due
}

// Earliest still-open due_date per payee (the one to flag overdue), from
// unpaid Credit expenses only.
export function earliestDueDate(expenses: any[], payments: any[]): Map<string, string> {
  const dues = vendorDues(expenses, payments)
  const earliest = new Map<string, string>()
  for (const e of expenses) {
    const k = payeeKey(e.payee_name)
    if (!isCredit(e) || !k || !e.due_date || (dues.get(k) ?? 0) <= 0.004) continue
    const cur = earliest.get(k)
    if (!cur || e.due_date < cur) earliest.set(k, e.due_date)
  }
  return earliest
}

// Total still owed across all vendors (ignores overpaid/negative vendors).
export const totalDue = (expenses: any[], payments: any[]) =>
  [...vendorDues(expenses, payments).values()].reduce((s, v) => s + (v > 0.004 ? v : 0), 0)
