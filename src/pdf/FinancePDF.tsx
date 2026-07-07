import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { getCompanyInfo } from '@/lib/settings'
import { downloadBlob, amountInWords } from '@/lib/utils'
import { pdfLayout, PdfHeader, PdfFooter } from './pdfLayout'

// Finance-specific pieces on top of the shared pdfLayout.tsx letterhead/table
// styles: a wrap-by-three meta strip, a summation box, and a signature row.
const s = StyleSheet.create({
  cols: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  col: { width: '33%' },
  k: { fontSize: 8, color: '#1f3a93', fontWeight: 'bold' },
  v: { fontSize: 9, marginTop: 1 },
  sumWrap: { marginTop: 8, alignItems: 'flex-end' },
  sumBox: { width: '46%' },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  sumLabel: { fontSize: 9 },
  sumValue: { fontSize: 9 },
  sumTotalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.7, borderTopColor: '#333', paddingTop: 3, marginTop: 2 },
  inWords: { marginTop: 10, fontSize: 9 },
  inWordsLabel: { fontWeight: 'bold' },
  inWordsValue: { fontStyle: 'italic' },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 50 },
  signName: { fontSize: 9, fontWeight: 'bold', marginBottom: 3 },
  signBlock: { borderTopWidth: 0.7, borderColor: '#333', paddingTop: 4, textAlign: 'center', fontSize: 8, color: '#444' },
  sectionLabel: { fontSize: 9, fontWeight: 'bold', marginTop: 10, marginBottom: 4 }
})

const money = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// This warehouse is funded by and reports to 3i Logistics — every one of
// these documents is prepared here (on this Settings → Company letterhead)
// but submitted TO 3i Logistics, so that needs to say so explicitly.
export const SUBMITTED_TO = '3i Logistics Pvt Limited'

export interface DocMeta { label: string; value: string }

// Three per row (matches the Delivery Challan's PO#/Invoice#/Dispatch-time
// strip), wrapping onto further rows of three if there are more fields.
function MetaCols({ meta }: { meta: DocMeta[] }) {
  const rows: DocMeta[][] = []
  for (let i = 0; i < meta.length; i += 3) rows.push(meta.slice(i, i + 3))
  return <>{rows.map((row, i) => (
    <View key={i} style={s.cols}>
      {row.map(m => <View key={m.label} style={s.col}><Text style={s.k}>{m.label}</Text><Text style={s.v}>{m.value || '-'}</Text></View>)}
    </View>
  ))}<View style={pdfLayout.hr} /></>
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

function Summation({ total, deduction, net }: { total: number; deduction: number; net: number }) {
  return (
    <View style={s.sumWrap}>
      <View style={s.sumBox}>
        <View style={s.sumRow}><Text style={s.sumLabel}>Total Payable</Text><Text style={s.sumValue}>{money(total)}</Text></View>
        <View style={s.sumRow}><Text style={s.sumLabel}>Less: Advance / Deduction</Text><Text style={s.sumValue}>{money(deduction)}</Text></View>
        <View style={s.sumTotalRow}><Text style={[s.sumLabel, { fontWeight: 'bold' }]}>Net Amount Paid</Text><Text style={[s.sumValue, { fontWeight: 'bold' }]}>{money(net)}</Text></View>
      </View>
    </View>
  )
}

function Footer({ docNo }: { docNo: string }) {
  const company = getCompanyInfo()
  return <PdfFooter render={({ pageNumber, totalPages }) => `${company.footer || company.name}  ·  ${docNo}  ·  Page ${pageNumber}/${totalPages}`} />
}

// ---------------------------------------------------------------------------
// 1. Operating Cost Requisition — Purpose / Unit / Qty / Remarks / Amount.
// ---------------------------------------------------------------------------
export interface ReqLine { purpose: string; unit?: string; qty?: number; remarks?: string; amount: number }

function RequisitionDoc({ docNo, meta, lines, grandTotal }: { docNo: string; meta: DocMeta[]; lines: ReqLine[]; grandTotal: number }) {
  return (
    <Document>
      <Page size="A4" style={pdfLayout.page}>
        <PdfHeader title="Operating Cost Requisition" docNo={docNo} />
        <MetaCols meta={meta} />
        <View style={pdfLayout.tHead}>
          <Text style={[pdfLayout.th, { width: '6%' }]}>#</Text>
          <Text style={[pdfLayout.th, { width: '34%' }]}>Purpose</Text>
          <Text style={[pdfLayout.th, { width: '12%' }]}>Unit</Text>
          <Text style={[pdfLayout.th, { width: '10%', textAlign: 'right' }]}>Qty</Text>
          <Text style={[pdfLayout.th, { width: '20%' }]}>Remarks</Text>
          <Text style={[pdfLayout.th, { width: '18%', textAlign: 'right' }]}>Amount</Text>
        </View>
        {lines.map((l, i) => (
          <View key={i} style={pdfLayout.tr}>
            <Text style={[pdfLayout.td, { width: '6%' }]}>{i + 1}</Text>
            <Text style={[pdfLayout.td, { width: '34%' }]}>{l.purpose}</Text>
            <Text style={[pdfLayout.td, { width: '12%' }]}>{l.unit || '-'}</Text>
            <Text style={[pdfLayout.td, { width: '10%', textAlign: 'right' }]}>{l.qty ? l.qty.toLocaleString() : '-'}</Text>
            <Text style={[pdfLayout.td, { width: '20%' }]}>{l.remarks || '-'}</Text>
            <Text style={[pdfLayout.td, { width: '18%', textAlign: 'right', borderRightWidth: 0 }]}>{money(l.amount)}</Text>
          </View>
        ))}
        <Summation total={grandTotal} deduction={0} net={grandTotal} />
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
export interface BillLine { particulars: string; unit?: string; qty?: number; rate?: number; remarks?: string; amount: number }
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
  // Particulars gets whatever's left after the other columns' actual (not
  // approximated) widths, so the row can never sum past 100% of the page.
  const wPart = `${Math.max(100 - 6 - (hasUnit ? 14 : 0) - (hasQty ? 10 : 0) - (hasRemarks ? 18 : 0) - 16 - (o.showLineSignature ? 16 : 0), 20)}%`
  // Bill Reference No already sits under the title (top right); the meta
  // strip instead names who the money was actually paid to, so the document
  // answers "paid to whom, and why" at a glance, not just "how much".
  const signBlocks: SignBlock[] = [...o.signLabels.map(l => ({ label: l })), ...(o.payee ? [{ label: 'Received By (Sign)', name: o.payee }] : [])]
  return (
    <Document>
      <Page size="A4" style={pdfLayout.page}>
        <PdfHeader title={o.title} docNo={o.billRef} />
        <MetaCols meta={[
          { label: 'Submitted To', value: SUBMITTED_TO },
          ...(o.payee ? [{ label: 'Paid To', value: o.payee }] : []),
          { label: 'Date', value: o.date }
        ]} />
        {o.purpose && <Text style={{ fontSize: 9, marginBottom: 10 }}><Text style={{ fontWeight: 'bold' }}>Purpose: </Text>{o.purpose}</Text>}
        <View style={pdfLayout.tHead}>
          <Text style={[pdfLayout.th, { width: '6%' }]}>SL No.</Text>
          <Text style={[pdfLayout.th, { width: wPart }]}>Particulars</Text>
          {hasUnit && <Text style={[pdfLayout.th, { width: '14%' }]}>Unit</Text>}
          {hasQty && <Text style={[pdfLayout.th, { width: '10%', textAlign: 'right' }]}>Qty</Text>}
          {hasRemarks && <Text style={[pdfLayout.th, { width: '18%' }]}>Remarks</Text>}
          <Text style={[pdfLayout.th, { width: '16%', textAlign: 'right' }]}>Total Payable</Text>
          {o.showLineSignature && <Text style={[pdfLayout.th, { width: '16%', borderRightWidth: 0 }]}>Signature</Text>}
        </View>
        {o.lines.map((l, i) => (
          <View key={i} style={pdfLayout.tr}>
            <Text style={[pdfLayout.td, { width: '6%' }]}>{i + 1}</Text>
            <Text style={[pdfLayout.td, { width: wPart }]}>{l.particulars}</Text>
            {hasUnit && <Text style={[pdfLayout.td, { width: '14%' }]}>{l.unit || '-'}</Text>}
            {hasQty && <Text style={[pdfLayout.td, { width: '10%', textAlign: 'right' }]}>{l.qty ? l.qty.toLocaleString() : '-'}</Text>}
            {hasRemarks && <Text style={[pdfLayout.td, { width: '18%' }]}>{l.remarks || '-'}</Text>}
            <Text style={[pdfLayout.td, { width: '16%', textAlign: 'right', borderRightWidth: o.showLineSignature ? 0.5 : 0 }]}>{money(l.amount)}</Text>
            {o.showLineSignature && <Text style={[pdfLayout.td, { width: '16%', borderRightWidth: 0 }]}></Text>}
          </View>
        ))}
        <Summation total={total} deduction={o.lessDeduction} net={net} />
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
// 3. Monthly Adjustment — fund receipts + full expense list + category
//    subtotals, submitted to Head Office to settle the month.
// ---------------------------------------------------------------------------
export interface AdjustmentReceipt { date: string; amount: number }
export interface AdjustmentExpense { date: string; category: string; payee?: string; description?: string; amount: number }
export interface AdjustmentCategoryTotal { category: string; amount: number }

export interface AdjustmentOpts {
  period: string
  receipts: AdjustmentReceipt[]
  expenses: AdjustmentExpense[]
  categoryTotals: AdjustmentCategoryTotal[]
  openingBalance: number
  totalReceived: number
  totalExpense: number
  closingBalance: number
}

function MonthlyAdjustmentDoc(o: AdjustmentOpts) {
  return (
    <Document>
      <Page size="A4" style={pdfLayout.page}>
        <PdfHeader title="Monthly Adjustment" docNo={o.period} />
        <MetaCols meta={[
          { label: 'Submitted To', value: SUBMITTED_TO },
          { label: 'Period', value: o.period },
          { label: 'Balance B/D', value: `BDT ${money(o.openingBalance)}` },
          { label: 'Fund Received', value: `BDT ${money(o.totalReceived)}` },
          { label: 'Expense', value: `BDT ${money(o.totalExpense)}` },
          { label: 'Balance C/D', value: `BDT ${money(o.closingBalance)}` }
        ]} />

        <Text style={s.sectionLabel}>Fund Received</Text>
        <View style={pdfLayout.tHead}>
          <Text style={[pdfLayout.th, { width: '70%' }]}>Date</Text>
          <Text style={[pdfLayout.th, { width: '30%', textAlign: 'right', borderRightWidth: 0 }]}>Amount</Text>
        </View>
        {o.receipts.length === 0 ? (
          <View style={pdfLayout.tr}><Text style={[pdfLayout.td, { width: '100%', color: '#9a9a9f', borderRightWidth: 0 }]}>No fund received this period</Text></View>
        ) : o.receipts.map((r, i) => (
          <View key={i} style={pdfLayout.tr}>
            <Text style={[pdfLayout.td, { width: '70%' }]}>{r.date}</Text>
            <Text style={[pdfLayout.td, { width: '30%', textAlign: 'right', borderRightWidth: 0 }]}>{money(r.amount)}</Text>
          </View>
        ))}

        <Text style={s.sectionLabel}>Expense Details</Text>
        <View style={pdfLayout.tHead}>
          <Text style={[pdfLayout.th, { width: '14%' }]}>Date</Text>
          <Text style={[pdfLayout.th, { width: '20%' }]}>Category</Text>
          <Text style={[pdfLayout.th, { width: '18%' }]}>Payee</Text>
          <Text style={[pdfLayout.th, { width: '30%' }]}>Description</Text>
          <Text style={[pdfLayout.th, { width: '18%', textAlign: 'right', borderRightWidth: 0 }]}>Amount</Text>
        </View>
        {o.expenses.map((e, i) => (
          <View key={i} style={pdfLayout.tr}>
            <Text style={[pdfLayout.td, { width: '14%' }]}>{e.date}</Text>
            <Text style={[pdfLayout.td, { width: '20%' }]}>{e.category}</Text>
            <Text style={[pdfLayout.td, { width: '18%' }]}>{e.payee || '-'}</Text>
            <Text style={[pdfLayout.td, { width: '30%' }]}>{e.description || '-'}</Text>
            <Text style={[pdfLayout.td, { width: '18%', textAlign: 'right', borderRightWidth: 0 }]}>{money(e.amount)}</Text>
          </View>
        ))}

        <Text style={s.sectionLabel}>Category Summary</Text>
        <View style={pdfLayout.tHead}>
          <Text style={[pdfLayout.th, { width: '70%' }]}>Category</Text>
          <Text style={[pdfLayout.th, { width: '30%', textAlign: 'right', borderRightWidth: 0 }]}>Amount</Text>
        </View>
        {o.categoryTotals.map((c, i) => (
          <View key={i} style={pdfLayout.tr}>
            <Text style={[pdfLayout.td, { width: '70%' }]}>{c.category}</Text>
            <Text style={[pdfLayout.td, { width: '30%', textAlign: 'right', borderRightWidth: 0 }]}>{money(c.amount)}</Text>
          </View>
        ))}

        <Summation total={o.totalExpense} deduction={0} net={o.totalExpense} />
        <SignRow blocks={[{ label: 'Prepared By' }, { label: 'Reviewed By' }, { label: 'Head Office Approval' }]} />
        <Footer docNo={`Monthly Adjustment · ${o.period}`} />
      </Page>
    </Document>
  )
}

export async function downloadMonthlyAdjustmentPDF(opts: AdjustmentOpts) {
  const blob = await pdf(<MonthlyAdjustmentDoc {...opts} />).toBlob()
  downloadBlob(blob, `Monthly_Adjustment_${opts.period.replace(/[^\w]+/g, '_')}.pdf`)
}
