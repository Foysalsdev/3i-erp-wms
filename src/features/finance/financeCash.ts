// The finance module's cash model. A Credit purchase is a payable — it does not
// move cash until the vendor is actually paid — so cash-in-hand excludes credit
// expenses and instead counts recorded vendor payments as the outflow. Accrual
// "what we spent" views (Dashboard by-head, Registers) keep counting everything.
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

// Domain row types shared across the finance screens.
export type Expense = Tables<'finance_expenses'>
export type VendorPayment = Tables<'finance_vendor_payments'>
export type FundReceipt = Tables<'finance_fund_receipts'>
export type BalanceAdjustment = Tables<'finance_balance_adjustments'>
export type HoSubmission = Tables<'finance_ho_submissions'>
export type FinanceItem = Tables<'finance_items'>
export type ExpenseCategory = Tables<'finance_expense_categories'>

// The editable line shapes the Procurement grid works with (a projection of
// finance_expense_bills / finance_additional_expenses rows).
export interface ExpenseLineItem { item_id: string; name: string; category_id: string; unit: string; qty?: number; rate?: number }
export interface ExpenseAddlLine { expense_type: string; amount?: number }

const amt = (r: { amount: number | null } | null | undefined) => Number(r?.amount) || 0

// The Head Office entity finance documents are submitted to. Lives here (not
// in FinancePDF) so screens can render it without pulling the pdf chunk.
export const SUBMITTED_TO = '3i Logistics Pvt Limited'

// Procurement's item grid + additional expenses for one expense — shared by
// every screen that views/edits/prints/duplicates a Procurement-type row.
export async function fetchExpenseLines(expId: string): Promise<{ __items: ExpenseLineItem[]; __addl: ExpenseAddlLine[] }> {
  const [{ data: bills, error: e1 }, { data: extra, error: e2 }] = await Promise.all([
    supabase.from('finance_expense_bills').select('*').eq('expense_id', expId).order('created_at'),
    supabase.from('finance_additional_expenses').select('*').eq('expense_id', expId).order('created_at')
  ])
  if (e1 || e2) throw new Error(`Could not load expense lines: ${(e1 ?? e2)!.message}`)
  const __items = (bills ?? []).map(b => ({ item_id: b.item_id || '', name: b.bill_ref || '', category_id: b.category_id || '', unit: b.unit || '', qty: b.qty != null ? Number(b.qty) : undefined, rate: b.rate != null ? Number(b.rate) : undefined }))
  const __addl = (extra ?? []).map(a => ({ expense_type: a.expense_type || '', amount: a.amount != null ? Number(a.amount) : undefined }))
  return { __items, __addl }
}

type CashRow = Pick<Expense, 'payment_mode' | 'amount'>

export const isCredit = (e: Pick<Expense, 'payment_mode'>) => String(e?.payment_mode ?? '').toLowerCase() === 'credit'
// Cash that actually left the drawer for this expense at purchase time (0 for credit).
export const cashOut = (e: CashRow) => (isCredit(e) ? 0 : amt(e))

// Cash outflow across a set of expenses + vendor payments (optionally date-filtered
// by the caller before passing in).
export const cashOutflow = (expenses: CashRow[], payments: Pick<VendorPayment, 'amount'>[]) =>
  expenses.reduce((s, e) => s + cashOut(e), 0) + payments.reduce((s, p) => s + amt(p), 0)

// Keyed by normalized payee_name text, not vendor_id — Vendor/Payee is a
// free-text field (no master list), and payee_name has always been populated
// on every expense row (even historically, copied from the linked vendor at
// save time), so this works uniformly for old and new rows alike.
export const payeeKey = (name?: string | null) => (name ?? '').trim().toLowerCase()

type DueExpense = Pick<Expense, 'payment_mode' | 'amount' | 'payee_name'>
type DuePayment = Pick<VendorPayment, 'amount' | 'payee_name'>

// Per-payee outstanding due = Σ credit purchases − Σ payments.
export function vendorDues(expenses: DueExpense[], payments: DuePayment[]): Map<string, number> {
  const due = new Map<string, number>()
  for (const e of expenses) { const k = payeeKey(e.payee_name); if (isCredit(e) && k) due.set(k, (due.get(k) ?? 0) + amt(e)) }
  for (const p of payments) { const k = payeeKey(p.payee_name); if (k) due.set(k, (due.get(k) ?? 0) - amt(p)) }
  return due
}

// Earliest still-open due_date per payee (the one to flag overdue), from
// unpaid Credit expenses only.
export function earliestDueDate(expenses: (DueExpense & Pick<Expense, 'due_date'>)[], payments: DuePayment[]): Map<string, string> {
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
export const totalDue = (expenses: DueExpense[], payments: DuePayment[]) =>
  [...vendorDues(expenses, payments).values()].reduce((s, v) => s + (v > 0.004 ? v : 0), 0)

// Shared voucher-lifecycle display — used by the Expenses list, Voucher
// Register and HO Submission.
export const VOUCHER_STATUS_LABEL: Record<string, string> = {
  pending_collection: 'Pending Collection', collected: 'Collected', lost: 'Lost', submitted: 'Submitted', verified: 'Verified'
}
export const VOUCHER_STATUS_TONE: Record<string, 'positive' | 'critical' | 'neutral' | 'brand' | 'negative' | 'info'> = {
  pending_collection: 'critical', collected: 'info', lost: 'negative', submitted: 'brand', verified: 'positive'
}
export const DOC_TYPE_LABEL: Record<string, string> = {
  vendor_voucher: 'Vendor Voucher', internal_voucher: 'Internal Voucher', no_document: 'No Document'
}
