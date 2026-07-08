import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { getCompanyInfo } from '@/lib/settings'
import { downloadBlob, amountInWords } from '@/lib/utils'
import { pdfLayout, PdfFooter, LetterheadSlim, DocInfoBox, Barcode } from './pdfLayout'

// Finance-specific pieces on top of the shared pdfLayout.tsx letterhead/table
// styles — the ERP document language every finance PDF shares: a bordered
// metadata header grid, a bordered totals box, a running-balance ledger and
// a signature row.
const s = StyleSheet.create({
  inWords: { marginTop: 10, fontSize: 9 },
  inWordsLabel: { fontWeight: 'bold' },
  inWordsValue: { fontStyle: 'italic' },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 50 },
  signName: { fontSize: 9, fontWeight: 'bold', marginBottom: 3 },
  signBlock: { borderTopWidth: 0.7, borderColor: '#333', paddingTop: 4, textAlign: 'center', fontSize: 8, color: '#444' },
  sectionLabel: { fontSize: 9, fontWeight: 'bold', marginTop: 10, marginBottom: 4 },
  // Statement-of-account (ledger / cash-book) pieces — an account-summary
  // strip and a running-balance ledger, the two things that make a document
  // read as a finance statement rather than a generic goods table.
  sumGrid: { flexDirection: 'row', borderWidth: 0.7, borderColor: '#333', marginBottom: 12 },
  sumCell: { flex: 1, padding: 6, borderRightWidth: 0.5, borderRightColor: '#999' },
  sumCellLast: { flex: 1, padding: 6, backgroundColor: '#eceff3' },
  sumCap: { fontSize: 7, color: '#555', marginBottom: 3 },
  sumAmt: { fontSize: 10, fontWeight: 'bold' },
  rowOpen: { backgroundColor: '#f7f7f5' },
  rowStripe: { backgroundColor: '#fafafa' },
  rowTotal: { backgroundColor: '#f2f2f0' },
  rowClose: { backgroundColor: '#eceff3' },
  bold: { fontWeight: 'bold' },
  // Finance-document header: "Submitted To" party block on the left, doc box
  // on the right — mirrors the challan's Bill-To / document-box split.
  fhRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  fhLeft: { width: '52%' },
  fhRight: { width: '44%', alignItems: 'flex-end' },
  fhCap: { fontSize: 8, color: '#555', marginBottom: 2 },
  fhName: { fontSize: 11, fontWeight: 'bold' },
  fhSub: { fontSize: 8.5, color: '#3a3a3a', marginTop: 1 },
  // Bordered totals block, right-aligned, with an emphasised final row.
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  totalsBox: { width: '52%', borderWidth: 0.7, borderColor: '#333' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 7 },
  totalsRowLast: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 7, backgroundColor: '#eceff3', borderTopWidth: 0.7, borderTopColor: '#333' },
  totalsTxt: { fontSize: 9 }
})

// Ledger column widths — kept in one place so header and body rows can never drift.
const LW = { date: '11%', part: '38%', ref: '15%', dr: '12%', cr: '12%', bal: '12%' }

const money = (n?: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// This warehouse is funded by and reports to 3i Logistics — every one of
// these documents is prepared here (on this Settings → Company letterhead)
// but submitted TO 3i Logistics, so that needs to say so explicitly.
export const SUBMITTED_TO = '3i Logistics Pvt Limited'

// `wide` fields (a long note/purpose) and `left` fields (the payee) render in
// the left block of the header; everything else goes into the right-hand box.
export interface DocMeta { label: string; value: string; wide?: boolean; left?: boolean }

// Shared finance-document header, matching the Delivery Challan's ERP look:
// company letterhead, a "Submitted To" party block on the left, and a bordered
// document-info box (title bar + key/value) on the right with an optional
// barcode of the document number above it.
function FinanceHeader({ title, meta, barcode }: { title: string; meta: DocMeta[]; barcode?: string }) {
  const submittedTo = meta.find(m => m.label === 'Submitted To')?.value
  const leftExtras = meta.filter(m => (m.wide || m.left) && m.label !== 'Submitted To')
  const boxFields = meta.filter(m => m.label !== 'Submitted To' && !m.wide && !m.left)
  return (
    <>
      <LetterheadSlim />
      <View style={s.fhRow}>
        <View style={s.fhLeft}>
          {submittedTo ? <><Text style={s.fhCap}>SUBMITTED TO</Text><Text style={s.fhName}>{submittedTo}</Text></> : null}
          {leftExtras.map((m, i) => (
            <View key={i} style={{ marginTop: 6 }}>
              <Text style={s.fhCap}>{m.label.toUpperCase()}</Text>
              <Text style={s.fhSub}>{m.value || '-'}</Text>
            </View>
          ))}
        </View>
        <View style={s.fhRight}>
          {barcode ? <View style={{ marginBottom: 6 }}><Barcode value={barcode} width={155} height={28} /></View> : null}
          <DocInfoBox title={title} width="100%" fields={boxFields.map(m => ({ label: m.label, value: m.value }))} />
        </View>
      </View>
    </>
  )
}

interface TotalRow { label: string; value: string; strong?: boolean }
function TotalsBox({ rows }: { rows: TotalRow[] }) {
  return (
    <View style={s.totalsWrap}>
      <View style={s.totalsBox}>
        {rows.map((r, i) => (
          <View key={i} style={r.strong ? s.totalsRowLast : s.totalsRow}>
            <Text style={[s.totalsTxt, r.strong ? s.bold : {}]}>{r.label}</Text>
            <Text style={[s.totalsTxt, r.strong ? s.bold : {}]}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

interface SignBlock { label: string; name?: string }

// Each block is a blank line to physically sign above a label — optionally
// with a name printed above the line (e.g. the payee), so it's clear whose
// signature is expected there rather than just a generic role.
function SignRow({ blocks }: { blocks: SignBlock[] }) {
  const width = `${Math.floor(92 / Math.max(blocks.length, 1))}%`
  return <View style={s.signRow}>{blocks.map((b, i) => (
    <View key={i} style={{ width }}>
      {b.name && <Text style={s.signName}>{b.name}</Text>}
      <View style={s.signBlock}><Text>{b.label}</Text></View>
    </View>
  ))}</View>
}

function Footer({ docNo }: { docNo: string }) {
  const company = getCompanyInfo()
  return <PdfFooter render={({ pageNumber, totalPages }) => `${company.footer || company.name}  ·  ${docNo}  ·  Page ${pageNumber}/${totalPages}`} />
}

// ---------------------------------------------------------------------------
// 1. Operating Cost Requisition — Purpose / Unit / Qty / Remarks / Amount.
// ---------------------------------------------------------------------------
export interface ReqLine { purpose: string; unit?: string; qty?: number; remarks?: string; amount?: number }

function RequisitionDoc({ docNo, meta, lines, grandTotal }: { docNo: string; meta: DocMeta[]; lines: ReqLine[]; grandTotal: number }) {
  return (
    <Document>
      <Page size="A4" style={pdfLayout.page}>
        <FinanceHeader title="Operating Cost Requisition" meta={meta} barcode={docNo} />
        <View style={pdfLayout.tHead}>
          <Text style={[pdfLayout.th, { width: '6%' }]}>#</Text>
          <Text style={[pdfLayout.th, { width: '34%' }]}>Purpose</Text>
          <Text style={[pdfLayout.th, { width: '12%' }]}>Unit</Text>
          <Text style={[pdfLayout.th, { width: '10%', textAlign: 'right' }]}>Qty</Text>
          <Text style={[pdfLayout.th, { width: '20%' }]}>Note</Text>
          <Text style={[pdfLayout.th, { width: '18%', textAlign: 'right', borderRightWidth: 0 }]}>Amount (BDT)</Text>
        </View>
        {lines.map((l, i) => (
          <View key={i} style={[pdfLayout.tr, i % 2 === 1 ? s.rowStripe : {}]}>
            <Text style={[pdfLayout.td, { width: '6%' }]}>{i + 1}</Text>
            <Text style={[pdfLayout.td, { width: '34%' }]}>{l.purpose}</Text>
            <Text style={[pdfLayout.td, { width: '12%' }]}>{l.unit || '-'}</Text>
            <Text style={[pdfLayout.td, { width: '10%', textAlign: 'right' }]}>{l.qty ? l.qty.toLocaleString() : '-'}</Text>
            <Text style={[pdfLayout.td, { width: '20%' }]}>{l.remarks || '-'}</Text>
            <Text style={[pdfLayout.td, { width: '18%', textAlign: 'right', borderRightWidth: 0 }]}>{money(l.amount)}</Text>
          </View>
        ))}
        <TotalsBox rows={[{ label: 'Grand Total (BDT)', value: money(grandTotal), strong: true }]} />
        <View style={s.inWords}><Text><Text style={s.inWordsLabel}>In Words: </Text><Text style={s.inWordsValue}>{amountInWords(grandTotal)}</Text></Text></View>
        <SignRow blocks={[{ label: 'Prepared By' }, { label: 'Seal' }, { label: 'Approved By' }]} />
        <Footer docNo={docNo} />
      </Page>
    </Document>
  )
}

export async function downloadRequisitionPDF(opts: { docNo: string; meta: DocMeta[]; lines: ReqLine[]; grandTotal: number }) {
  const blob = await pdf(<RequisitionDoc docNo={opts.docNo} meta={opts.meta} lines={opts.lines} grandTotal={opts.grandTotal} />).toBlob()
  downloadBlob(blob, `${opts.docNo.replace(/[^\w]+/g, '_')}.pdf`)
}

// ---------------------------------------------------------------------------
// 2. Bill / Voucher — dynamic title (the expense's category, e.g. "Dinner
//    Bill" / "Labour Bill" / "Accommodation House Rent"), Particulars /
//    Unit / Qty / Rate / Remarks / Amount lines, summation, in-words, and a
//    configurable signature row (blank per-line signature column optional).
// ---------------------------------------------------------------------------
export interface BillLine { particulars: string; unit?: string; qty?: number; rate?: number; remarks?: string; amount: number; vendor?: string; memoNo?: string }
export interface BillVoucherOpts {
  title: string
  billRef: string
  date: string
  payee?: string
  purpose?: string
  lines: BillLine[]
  lessDeduction: number
  signLabels: string[]
  showLineSignature?: boolean
}

function BillVoucherDoc(o: BillVoucherOpts) {
  const total = o.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const net = total - (Number(o.lessDeduction) || 0)
  const hasUnit = o.lines.some(l => l.unit)
  const hasQty = o.lines.some(l => l.qty)
  const hasRemarks = o.lines.some(l => l.remarks)
  const hasVendor = o.lines.some(l => l.vendor)
  const hasMemo = o.lines.some(l => l.memoNo)
  // Particulars gets whatever's left after the other columns' actual (not
  // approximated) widths, so the row can never sum past 100% of the page.
  const wPart = `${Math.max(100 - 6 - (hasVendor ? 20 : 0) - (hasMemo ? 12 : 0) - (hasUnit ? 14 : 0) - (hasQty ? 10 : 0) - (hasRemarks ? 18 : 0) - 16 - (o.showLineSignature ? 16 : 0), 18)}%`
  // Bill Reference No already sits under the title (top right); the meta
  // strip instead names who the money was actually paid to, so the document
  // answers "paid to whom, and why" at a glance, not just "how much".
  const signBlocks: SignBlock[] = [...o.signLabels.map(l => ({ label: l })), ...(o.payee ? [{ label: 'Received By (Sign)', name: o.payee }] : [])]
  return (
    <Document>
      <Page size="A4" style={pdfLayout.page}>
        <FinanceHeader title={o.title} barcode={o.billRef} meta={[
          { label: 'Voucher No', value: o.billRef },
          { label: 'Date', value: o.date },
          ...(o.payee ? [{ label: 'Paid To', value: o.payee, left: true }] : []),
          { label: 'Submitted To', value: SUBMITTED_TO },
          ...(o.purpose ? [{ label: 'Purpose', value: o.purpose, wide: true }] : [])
        ]} />
        <View style={pdfLayout.tHead}>
          <Text style={[pdfLayout.th, { width: '6%' }]}>SL No.</Text>
          <Text style={[pdfLayout.th, { width: wPart }]}>Particulars</Text>
          {hasVendor && <Text style={[pdfLayout.th, { width: '20%' }]}>Shop / Vendor</Text>}
          {hasMemo && <Text style={[pdfLayout.th, { width: '12%' }]}>Memo No</Text>}
          {hasUnit && <Text style={[pdfLayout.th, { width: '14%' }]}>Unit</Text>}
          {hasQty && <Text style={[pdfLayout.th, { width: '10%', textAlign: 'right' }]}>Qty</Text>}
          {hasRemarks && <Text style={[pdfLayout.th, { width: '18%' }]}>Remarks</Text>}
          <Text style={[pdfLayout.th, { width: '16%', textAlign: 'right', borderRightWidth: o.showLineSignature ? 0.5 : 0 }]}>Amount (BDT)</Text>
          {o.showLineSignature && <Text style={[pdfLayout.th, { width: '16%', borderRightWidth: 0 }]}>Signature</Text>}
        </View>
        {o.lines.map((l, i) => (
          <View key={i} style={[pdfLayout.tr, i % 2 === 1 ? s.rowStripe : {}]}>
            <Text style={[pdfLayout.td, { width: '6%' }]}>{i + 1}</Text>
            <Text style={[pdfLayout.td, { width: wPart }]}>{l.particulars}</Text>
            {hasVendor && <Text style={[pdfLayout.td, { width: '20%' }]}>{l.vendor || '-'}</Text>}
            {hasMemo && <Text style={[pdfLayout.td, { width: '12%' }]}>{l.memoNo || '-'}</Text>}
            {hasUnit && <Text style={[pdfLayout.td, { width: '14%' }]}>{l.unit || '-'}</Text>}
            {hasQty && <Text style={[pdfLayout.td, { width: '10%', textAlign: 'right' }]}>{l.qty ? l.qty.toLocaleString() : '-'}</Text>}
            {hasRemarks && <Text style={[pdfLayout.td, { width: '18%' }]}>{l.remarks || '-'}</Text>}
            <Text style={[pdfLayout.td, { width: '16%', textAlign: 'right', borderRightWidth: o.showLineSignature ? 0.5 : 0 }]}>{money(l.amount)}</Text>
            {o.showLineSignature && <Text style={[pdfLayout.td, { width: '16%', borderRightWidth: 0 }]}></Text>}
          </View>
        ))}
        <TotalsBox rows={[
          { label: 'Total Payable', value: money(total) },
          { label: 'Less: Advance / Deduction', value: money(o.lessDeduction) },
          { label: 'Net Amount Paid (BDT)', value: money(net), strong: true }
        ]} />
        <View style={s.inWords}><Text><Text style={s.inWordsLabel}>In Words: </Text><Text style={s.inWordsValue}>{amountInWords(net)}</Text></Text></View>
        <SignRow blocks={signBlocks} />
        <Footer docNo={o.billRef} />
      </Page>
    </Document>
  )
}

export async function downloadBillVoucherPDF(opts: BillVoucherOpts) {
  const blob = await pdf(<BillVoucherDoc {...opts} />).toBlob()
  downloadBlob(blob, `${(opts.billRef || opts.title).replace(/[^\w]+/g, '_')}.pdf`)
}

// ---------------------------------------------------------------------------
// 3. Monthly Statement of Account — a running-balance cash book. Opening
//    Balance (b/d) → every receipt (Dr) and payment (Cr) in date order, each
//    updating a running Balance column → Closing Balance (c/d). This is the
//    format an accounts department (Zoho Books / SAP FI statement of account)
//    actually reads: the balance column is the point, not a list of tables.
// ---------------------------------------------------------------------------
export interface AdjustmentCategoryTotal { category: string; amount: number }
// One posted line of the cash book. receipt/payment are mutually exclusive;
// balance is the running total AFTER this line is applied.
export interface LedgerRow { date: string; particulars: string; ref?: string; receipt?: number; payment?: number; balance: number }

export interface AdjustmentOpts {
  period: string
  openingBalance: number
  closingBalance: number
  ledger: LedgerRow[]
  categoryTotals: AdjustmentCategoryTotal[]
}

function SumCell({ cap, amount, last }: { cap: string; amount: number; last?: boolean }) {
  return (
    <View style={last ? s.sumCellLast : s.sumCell}>
      <Text style={s.sumCap}>{cap}</Text>
      <Text style={s.sumAmt}>BDT {money(amount)}</Text>
    </View>
  )
}

const LedgerHead = () => (
  <View style={pdfLayout.tHead}>
    <Text style={[pdfLayout.th, { width: LW.date }]}>Date</Text>
    <Text style={[pdfLayout.th, { width: LW.part }]}>Particulars</Text>
    <Text style={[pdfLayout.th, { width: LW.ref }]}>Voucher / Ref</Text>
    <Text style={[pdfLayout.th, { width: LW.dr, textAlign: 'right' }]}>Receipt (Dr)</Text>
    <Text style={[pdfLayout.th, { width: LW.cr, textAlign: 'right' }]}>Payment (Cr)</Text>
    <Text style={[pdfLayout.th, { width: LW.bal, textAlign: 'right', borderRightWidth: 0 }]}>Balance</Text>
  </View>
)

function MonthlyAdjustmentDoc(o: AdjustmentOpts) {
  const totalReceipt = o.ledger.reduce((sum, r) => sum + (r.receipt || 0), 0)
  const totalPayment = o.ledger.reduce((sum, r) => sum + (r.payment || 0), 0)
  return (
    <Document>
      <Page size="A4" style={pdfLayout.page}>
        <FinanceHeader title="Statement of Account" meta={[
          { label: 'Statement Period', value: o.period },
          { label: 'Submitted To', value: SUBMITTED_TO }
        ]} />

        {/* Account summary — the four figures an accounts reviewer checks first. */}
        <View style={s.sumGrid}>
          <SumCell cap="Opening Balance (B/D)" amount={o.openingBalance} />
          <SumCell cap="Total Receipts" amount={totalReceipt} />
          <SumCell cap="Total Payments" amount={totalPayment} />
          <SumCell cap="Closing Balance (C/D)" amount={o.closingBalance} last />
        </View>

        <LedgerHead />
        {/* Opening balance b/d — the ledger's first line, carried from last month. */}
        <View style={[pdfLayout.tr, s.rowOpen]}>
          <Text style={[pdfLayout.td, { width: LW.date }]}></Text>
          <Text style={[pdfLayout.td, s.bold, { width: LW.part }]}>Opening Balance b/d</Text>
          <Text style={[pdfLayout.td, { width: LW.ref }]}></Text>
          <Text style={[pdfLayout.td, { width: LW.dr }]}></Text>
          <Text style={[pdfLayout.td, { width: LW.cr }]}></Text>
          <Text style={[pdfLayout.td, s.bold, { width: LW.bal, textAlign: 'right', borderRightWidth: 0 }]}>{money(o.openingBalance)}</Text>
        </View>
        {o.ledger.length === 0 ? (
          <View style={pdfLayout.tr}><Text style={[pdfLayout.td, { width: '100%', color: '#9a9a9f', borderRightWidth: 0 }]}>No transactions this period</Text></View>
        ) : o.ledger.map((r, i) => (
          <View key={i} style={[pdfLayout.tr, i % 2 === 1 ? s.rowStripe : {}]}>
            <Text style={[pdfLayout.td, { width: LW.date }]}>{r.date}</Text>
            <Text style={[pdfLayout.td, { width: LW.part }]}>{r.particulars}</Text>
            <Text style={[pdfLayout.td, { width: LW.ref }]}>{r.ref || '-'}</Text>
            <Text style={[pdfLayout.td, { width: LW.dr, textAlign: 'right' }]}>{r.receipt ? money(r.receipt) : ''}</Text>
            <Text style={[pdfLayout.td, { width: LW.cr, textAlign: 'right' }]}>{r.payment ? money(r.payment) : ''}</Text>
            <Text style={[pdfLayout.td, { width: LW.bal, textAlign: 'right', borderRightWidth: 0 }]}>{money(r.balance)}</Text>
          </View>
        ))}
        {/* Column totals, then the closing balance carried down. */}
        <View style={[pdfLayout.tr, s.rowTotal]}>
          <Text style={[pdfLayout.td, { width: LW.date }]}></Text>
          <Text style={[pdfLayout.td, s.bold, { width: LW.part }]}>Total for the period</Text>
          <Text style={[pdfLayout.td, { width: LW.ref }]}></Text>
          <Text style={[pdfLayout.td, s.bold, { width: LW.dr, textAlign: 'right' }]}>{money(totalReceipt)}</Text>
          <Text style={[pdfLayout.td, s.bold, { width: LW.cr, textAlign: 'right' }]}>{money(totalPayment)}</Text>
          <Text style={[pdfLayout.td, { width: LW.bal, borderRightWidth: 0 }]}></Text>
        </View>
        <View style={[pdfLayout.tr, s.rowClose]}>
          <Text style={[pdfLayout.td, { width: LW.date }]}></Text>
          <Text style={[pdfLayout.td, s.bold, { width: LW.part }]}>Closing Balance c/d</Text>
          <Text style={[pdfLayout.td, { width: LW.ref }]}></Text>
          <Text style={[pdfLayout.td, { width: LW.dr }]}></Text>
          <Text style={[pdfLayout.td, { width: LW.cr }]}></Text>
          <Text style={[pdfLayout.td, s.bold, { width: LW.bal, textAlign: 'right', borderRightWidth: 0 }]}>{money(o.closingBalance)}</Text>
        </View>

        <View style={s.inWords}><Text><Text style={s.inWordsLabel}>Closing Balance in Words: </Text><Text style={s.inWordsValue}>{amountInWords(o.closingBalance)}</Text></Text></View>

        {o.categoryTotals.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Expense Breakdown by Category</Text>
            <View style={pdfLayout.tHead}>
              <Text style={[pdfLayout.th, { width: '70%' }]}>Category</Text>
              <Text style={[pdfLayout.th, { width: '30%', textAlign: 'right', borderRightWidth: 0 }]}>Amount</Text>
            </View>
            {o.categoryTotals.map((c, i) => (
              <View key={i} style={[pdfLayout.tr, i % 2 === 1 ? s.rowStripe : {}]}>
                <Text style={[pdfLayout.td, { width: '70%' }]}>{c.category}</Text>
                <Text style={[pdfLayout.td, { width: '30%', textAlign: 'right', borderRightWidth: 0 }]}>{money(c.amount)}</Text>
              </View>
            ))}
          </>
        )}

        <SignRow blocks={[{ label: 'Prepared By' }, { label: 'Reviewed By' }, { label: 'Head Office Approval' }]} />
        <Footer docNo={`Statement of Account · ${o.period}`} />
      </Page>
    </Document>
  )
}

export async function downloadMonthlyAdjustmentPDF(opts: AdjustmentOpts) {
  const blob = await pdf(<MonthlyAdjustmentDoc {...opts} />).toBlob()
  downloadBlob(blob, `Statement_of_Account_${opts.period.replace(/[^\w]+/g, '_')}.pdf`)
}
