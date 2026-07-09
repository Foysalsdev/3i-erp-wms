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

// Per-vendor outstanding due = Σ credit purchases − Σ payments.
export function vendorDues(expenses: any[], payments: any[]): Map<string, number> {
  const due = new Map<string, number>()
  for (const e of expenses) if (isCredit(e) && e.vendor_id) due.set(e.vendor_id, (due.get(e.vendor_id) ?? 0) + amt(e))
  for (const p of payments) if (p.vendor_id) due.set(p.vendor_id, (due.get(p.vendor_id) ?? 0) - amt(p))
  return due
}

// Total still owed across all vendors (ignores overpaid/negative vendors).
export const totalDue = (expenses: any[], payments: any[]) =>
  [...vendorDues(expenses, payments).values()].reduce((s, v) => s + (v > 0.004 ? v : 0), 0)
