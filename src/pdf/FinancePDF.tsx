import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import { getCompanyInfo } from '@/lib/settings'
import { downloadBlob, amountInWords } from '@/lib/utils'

// Same minimal, plain look as DeliveryChallanPDF.tsx (logo + title top row,
// company block, thin grey rules, a light-grey table header, no colour
// fills) so Finance documents read like the rest of the app's paperwork
// instead of a one-off design. Letterhead comes from Settings → Company,
// same as every other document — not hardcoded to any one organisation.
const s = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica', color: '#212326' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: 'bold' },
  titleSub: { fontSize: 9, marginTop: 2 },
  company: { marginTop: 14, marginBottom: 8 },
  companyName: { fontWeight: 'bold', fontSize: 9 },
  sub: { fontSize: 8, color: '#3a3a3a' },
  hr: { borderBottomWidth: 1, borderBottomColor: '#bbb', marginVertical: 6 },
  cols: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  col: { width: '33%' },
  k: { fontSize: 8, color: '#1f3a93', fontWeight: 'bold' },
  v: { fontSize: 9, marginTop: 1 },
  r: { flexDirection: 'row', marginBottom: 2 },
  rk: { width: 90, fontSize: 8, color: '#444' },
  rv: { fontSize: 9, flex: 1 },
  tHead: { flexDirection: 'row', alignItems: 'center', borderWidth: 0.7, borderColor: '#333', backgroundColor: '#f2f2f0' },
  th: { fontSize: 8, fontWeight: 'bold', padding: 3, borderRightWidth: 0.5, borderRightColor: '#999' },
  tr: { flexDirection: 'row', alignItems: 'center', borderWidth: 0.7, borderTopWidth: 0, borderColor: '#333', minHeight: 18 },
  td: { fontSize: 8, padding: 3, borderRightWidth: 0.5, borderRightColor: '#ccc' },
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
  footer: { position: 'absolute', bottom: 18, left: 28, right: 28, fontSize: 7, color: '#777', textAlign: 'center' },
  sectionLabel: { fontSize: 9, fontWeight: 'bold', marginTop: 10, marginBottom: 4 }
})

const money = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// This warehouse is funded by and reports to 3i Logistics — every one of
// these documents is prepared here (on this Settings → Company letterhead)
// but submitted TO 3i Logistics, so that needs to say so explicitly.
export const SUBMITTED_TO = '3i Logistics Pvt Limited'

function Header({ title, docNo }: { title: string; docNo: string }) {
  const company = getCompanyInfo()
  const companyLines = (company.address || '').split('\n').filter(Boolean)
  return (
    <>
      <View style={s.topRow}>
        <Image src={company.logoUrl || '/whirlpool-logo.png'} style={{ width: 118, height: 39 }} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.title}>{title.toUpperCase()}</Text>
          {docNo && <Text style={s.titleSub}>{docNo}</Text>}
        </View>
      </View>
      <View style={s.company}>
        <Text style={s.companyName}>{company.name}</Text>
        {companyLines.map((l, i) => <Text key={i} style={s.sub}>{l}</Text>)}
        {company.bin ? <Text style={s.sub}>{company.bin}</Text> : null}
      </View>
      <View style={s.hr} />
    </>
  )
}

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
  ))}<View style={s.hr} /></>
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

function Footer() {
  const company = getCompanyInfo()
  return <Text style={s.footer} render={({ pageNumber, totalPages }) => `${company.footer || company.name}  ·  Page ${pageNumber}/${totalPages}`} fixed />
}

// ---------------------------------------------------------------------------
// 1. Operating Cost Requisition — Purpose / Unit / Qty / Remarks / Amount.
// ---------------------------------------------------------------------------
export interface ReqLine { purpose: string; unit?: string; qty?: number; remarks?: string; amount: number }

function RequisitionDoc({ docNo, meta, lines, grandTotal }: { docNo: string; meta: DocMeta[]; lines: ReqLine[]; grandTotal: number }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header title="Operating Cost Requisition" docNo={docNo} />
        <MetaCols meta={meta} />
        <View style={s.tHead}>
          <Text style={[s.th, { width: '6%' }]}>#</Text>
          <Text style={[s.th, { width: '34%' }]}>Purpose</Text>
          <Text style={[s.th, { width: '12%' }]}>Unit</Text>
          <Text style={[s.th, { width: '10%', textAlign: 'right' }]}>Qty</Text>
          <Text style={[s.th, { width: '20%' }]}>Remarks</Text>
          <Text style={[s.th, { width: '18%', textAlign: 'right' }]}>Amount</Text>
        </View>
        {lines.map((l, i) => (
          <View key={i} style={s.tr}>
            <Text style={[s.td, { width: '6%' }]}>{i + 1}</Text>
            <Text style={[s.td, { width: '34%' }]}>{l.purpose}</Text>
            <Text style={[s.td, { width: '12%' }]}>{l.unit || '-'}</Text>
            <Text style={[s.td, { width: '10%', textAlign: 'right' }]}>{l.qty ? l.qty.toLocaleString() : '-'}</Text>
            <Text style={[s.td, { width: '20%' }]}>{l.remarks || '-'}</Text>
            <Text style={[s.td, { width: '18%', textAlign: 'right', borderRightWidth: 0 }]}>{money(l.amount)}</Text>
          </View>
        ))}
        <Summation total={grandTotal} deduction={0} net={grandTotal} />
        <View style={s.inWords}><Text><Text style={s.inWordsLabel}>In Words: </Text><Text style={s.inWordsValue}>{amountInWords(grandTotal)}</Text></Text></View>
        <SignRow blocks={[{ label: 'Prepared By' }, { label: 'Seal' }, { label: 'Approved By' }]} />
        <Footer />
      </Page>
    </Document>
  )
}

export async function downloadRequisitionPDF(opts: { client: string; docNo: string; meta: DocMeta[]; lines: ReqLine[]; grandTotal: number }) {
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
  const cols = 2 + (hasUnit ? 1 : 0) + (hasQty ? 1 : 0) + (hasRemarks ? 1 : 0) + (o.showLineSignature ? 1 : 0)
  const wPart = `${Math.max(100 - (cols - 1) * 14 - 6, 26)}%`
  // Bill Reference No already sits under the title (top right); the meta
  // strip instead names who the money was actually paid to, so the document
  // answers "paid to whom, and why" at a glance, not just "how much".
  const signBlocks: SignBlock[] = [...o.signLabels.map(l => ({ label: l })), ...(o.payee ? [{ label: 'Received By (Sign)', name: o.payee }] : [])]
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header title={o.title} docNo={o.billRef} />
        <MetaCols meta={[
          { label: 'Submitted To', value: SUBMITTED_TO },
          ...(o.payee ? [{ label: 'Paid To', value: o.payee }] : []),
          { label: 'Date', value: o.date }
        ]} />
        {o.purpose && <Text style={{ fontSize: 9, marginBottom: 10 }}><Text style={{ fontWeight: 'bold' }}>Purpose: </Text>{o.purpose}</Text>}
        <View style={s.tHead}>
          <Text style={[s.th, { width: '6%' }]}>SL No.</Text>
          <Text style={[s.th, { width: wPart }]}>Particulars</Text>
          {hasUnit && <Text style={[s.th, { width: '14%' }]}>Unit</Text>}
          {hasQty && <Text style={[s.th, { width: '10%', textAlign: 'right' }]}>Qty</Text>}
          {hasRemarks && <Text style={[s.th, { width: '18%' }]}>Remarks</Text>}
          <Text style={[s.th, { width: '16%', textAlign: 'right' }]}>Total Payable</Text>
          {o.showLineSignature && <Text style={[s.th, { width: '16%', borderRightWidth: 0 }]}>Signature</Text>}
        </View>
        {o.lines.map((l, i) => (
          <View key={i} style={s.tr}>
            <Text style={[s.td, { width: '6%' }]}>{i + 1}</Text>
            <Text style={[s.td, { width: wPart }]}>{l.particulars}</Text>
            {hasUnit && <Text style={[s.td, { width: '14%' }]}>{l.unit || '-'}</Text>}
            {hasQty && <Text style={[s.td, { width: '10%', textAlign: 'right' }]}>{l.qty ? l.qty.toLocaleString() : '-'}</Text>}
            {hasRemarks && <Text style={[s.td, { width: '18%' }]}>{l.remarks || '-'}</Text>}
            <Text style={[s.td, { width: '16%', textAlign: 'right', borderRightWidth: o.showLineSignature ? 0.5 : 0 }]}>{money(l.amount)}</Text>
            {o.showLineSignature && <Text style={[s.td, { width: '16%', borderRightWidth: 0 }]}></Text>}
          </View>
        ))}
        <Summation total={total} deduction={o.lessDeduction} net={net} />
        <View style={s.inWords}><Text><Text style={s.inWordsLabel}>In Words: </Text><Text style={s.inWordsValue}>{amountInWords(net)}</Text></Text></View>
        <SignRow blocks={signBlocks} />
        <Footer />
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
  totalReceived: number
  totalExpense: number
  closingBalance: number
}

function MonthlyAdjustmentDoc(o: AdjustmentOpts) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header title="Monthly Adjustment" docNo={o.period} />
        <MetaCols meta={[
          { label: 'Submitted To', value: SUBMITTED_TO },
          { label: 'Period', value: o.period },
          { label: 'Total Received', value: `BDT ${money(o.totalReceived)}` },
          { label: 'Total Expense', value: `BDT ${money(o.totalExpense)}` },
          { label: 'Closing Balance', value: `BDT ${money(o.closingBalance)}` }
        ]} />

        <Text style={s.sectionLabel}>Fund Received</Text>
        <View style={s.tHead}>
          <Text style={[s.th, { width: '70%' }]}>Date</Text>
          <Text style={[s.th, { width: '30%', textAlign: 'right', borderRightWidth: 0 }]}>Amount</Text>
        </View>
        {o.receipts.length === 0 ? (
          <View style={s.tr}><Text style={[s.td, { width: '100%', color: '#9a9a9f', borderRightWidth: 0 }]}>No fund received this period</Text></View>
        ) : o.receipts.map((r, i) => (
          <View key={i} style={s.tr}>
            <Text style={[s.td, { width: '70%' }]}>{r.date}</Text>
            <Text style={[s.td, { width: '30%', textAlign: 'right', borderRightWidth: 0 }]}>{money(r.amount)}</Text>
          </View>
        ))}

        <Text style={s.sectionLabel}>Expense Details</Text>
        <View style={s.tHead}>
          <Text style={[s.th, { width: '14%' }]}>Date</Text>
          <Text style={[s.th, { width: '20%' }]}>Category</Text>
          <Text style={[s.th, { width: '18%' }]}>Payee</Text>
          <Text style={[s.th, { width: '30%' }]}>Description</Text>
          <Text style={[s.th, { width: '18%', textAlign: 'right', borderRightWidth: 0 }]}>Amount</Text>
        </View>
        {o.expenses.map((e, i) => (
          <View key={i} style={s.tr}>
            <Text style={[s.td, { width: '14%' }]}>{e.date}</Text>
            <Text style={[s.td, { width: '20%' }]}>{e.category}</Text>
            <Text style={[s.td, { width: '18%' }]}>{e.payee || '-'}</Text>
            <Text style={[s.td, { width: '30%' }]}>{e.description || '-'}</Text>
            <Text style={[s.td, { width: '18%', textAlign: 'right', borderRightWidth: 0 }]}>{money(e.amount)}</Text>
          </View>
        ))}

        <Text style={s.sectionLabel}>Category Summary</Text>
        <View style={s.tHead}>
          <Text style={[s.th, { width: '70%' }]}>Category</Text>
          <Text style={[s.th, { width: '30%', textAlign: 'right', borderRightWidth: 0 }]}>Amount</Text>
        </View>
        {o.categoryTotals.map((c, i) => (
          <View key={i} style={s.tr}>
            <Text style={[s.td, { width: '70%' }]}>{c.category}</Text>
            <Text style={[s.td, { width: '30%', textAlign: 'right', borderRightWidth: 0 }]}>{money(c.amount)}</Text>
          </View>
        ))}

        <Summation total={o.totalExpense} deduction={0} net={o.totalExpense} />
        <SignRow blocks={[{ label: 'Prepared By' }, { label: 'Reviewed By' }, { label: 'Head Office Approval' }]} />
        <Footer />
      </Page>
    </Document>
  )
}

export async function downloadMonthlyAdjustmentPDF(opts: AdjustmentOpts) {
  const blob = await pdf(<MonthlyAdjustmentDoc {...opts} />).toBlob()
  downloadBlob(blob, `Monthly_Adjustment_${opts.period.replace(/[^\w]+/g, '_')}.pdf`)
}
