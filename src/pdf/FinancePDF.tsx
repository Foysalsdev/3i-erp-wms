import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { downloadBlob, amountInWords } from '@/lib/utils'

// Finance documents (Requisition, Bill/Voucher, Monthly Adjustment) are all
// internal 3i Logistics paperwork raised by this warehouse and sent up to
// 3i Logistics Head Office — they carry 3i's own letterhead, not the
// Whirlpool company branding used on inventory documents (GRN/PO/Challan),
// so this file has its own fixed letterhead rather than reading Settings →
// Company. Layout mirrors 3i's existing Excel bill/voucher forms: centered
// letterhead, a solid title banner, a plain meta block, a bordered table,
// a boxed summation, "In Words", and a signature row with as many blocks
// as the document needs.
const NAVY = '#1F4E79'
const LIGHT_GREEN = '#E2EFDA'
const BORDER = '#333333'

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica', color: '#212326' },
  letterhead: { alignItems: 'center', marginBottom: 10 },
  logoBadge: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F2A900', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  logoBadgeText: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 15 },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: NAVY },
  companyAddress: { fontSize: 8, color: '#63666c', marginTop: 2, textAlign: 'center' },
  banner: { backgroundColor: NAVY, paddingVertical: 7, marginTop: 10, marginBottom: 12 },
  bannerText: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 12, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaBox: { marginBottom: 12 },
  metaRow: { flexDirection: 'row', marginBottom: 2 },
  metaLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  metaValue: { fontSize: 9, marginLeft: 3 },
  th: { flexDirection: 'row', backgroundColor: NAVY, borderWidth: 0.7, borderColor: BORDER, borderBottomWidth: 0, paddingVertical: 5 },
  thText: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 8.5, paddingHorizontal: 4 },
  tr: { flexDirection: 'row', borderWidth: 0.7, borderTopWidth: 0, borderColor: BORDER, paddingVertical: 5, minHeight: 20 },
  tdText: { fontSize: 9, paddingHorizontal: 4 },
  sumWrap: { marginTop: 10, width: '46%' },
  sumHeader: { flexDirection: 'row', backgroundColor: NAVY },
  sumHeaderText: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 8.5, paddingHorizontal: 6, paddingVertical: 4 },
  sumRow: { flexDirection: 'row', borderWidth: 0.7, borderTopWidth: 0, borderColor: BORDER },
  sumLabel: { flex: 1, fontSize: 9, paddingHorizontal: 6, paddingVertical: 4, fontFamily: 'Helvetica-Bold' },
  sumValue: { fontSize: 9, paddingHorizontal: 6, paddingVertical: 4, textAlign: 'right', minWidth: 70 },
  inWords: { marginTop: 10, fontSize: 9 },
  inWordsLabel: { fontFamily: 'Helvetica-Bold' },
  inWordsValue: { fontStyle: 'italic' },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 44 },
  signBlock: { borderTopWidth: 0.7, borderColor: BORDER, paddingTop: 4, textAlign: 'center', fontSize: 8, color: '#63666c' },
  footer: { position: 'absolute', bottom: 18, left: 32, right: 32, fontSize: 7, color: '#9a9a9f', textAlign: 'center', borderTopWidth: 0.5, borderColor: '#ececec', paddingTop: 6 }
})

const money = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Letterhead({ title }: { title: string }) {
  return (
    <>
      <View style={s.letterhead}>
        <View style={s.logoBadge}><Text style={s.logoBadgeText}>3i</Text></View>
        <Text style={s.companyName}>3i LOGISTICS Pvt Limited</Text>
        <Text style={s.companyAddress}>House:1/B (5th floor), Road-08, Gulshan-01, Dhaka</Text>
      </View>
      <View style={s.banner}><Text style={s.bannerText}>{title}</Text></View>
    </>
  )
}

export interface DocMeta { label: string; value: string }

function MetaBox({ meta }: { meta: DocMeta[] }) {
  return <View style={s.metaBox}>{meta.map((m, i) => (
    <View key={i} style={s.metaRow}><Text style={s.metaLabel}>{m.label}:</Text><Text style={s.metaValue}>{m.value || '—'}</Text></View>
  ))}</View>
}

function SignRow({ labels }: { labels: string[] }) {
  const width = `${Math.floor(92 / Math.max(labels.length, 1))}%`
  return <View style={s.signRow}>{labels.map(l => <View key={l} style={[s.signBlock, { width }]}><Text>{l}</Text></View>)}</View>
}

function Summation({ total, deduction, net }: { total: number; deduction: number; net: number }) {
  return (
    <View style={s.sumWrap}>
      <View style={s.sumHeader}><Text style={[s.sumHeaderText, { flex: 1 }]}>SUMMATION</Text><Text style={[s.sumHeaderText, { minWidth: 70, textAlign: 'right' }]}>AMOUNT (BDT)</Text></View>
      <View style={s.sumRow}><Text style={s.sumLabel}>Total Payable</Text><Text style={s.sumValue}>{money(total)}</Text></View>
      <View style={s.sumRow}><Text style={[s.sumLabel, { fontFamily: 'Helvetica' }]}>Less: Advance / Deduction</Text><Text style={s.sumValue}>{money(deduction)}</Text></View>
      <View style={[s.sumRow, { backgroundColor: LIGHT_GREEN }]}><Text style={s.sumLabel}>Net Amount Paid</Text><Text style={[s.sumValue, { fontFamily: 'Helvetica-Bold' }]}>{money(net)}</Text></View>
    </View>
  )
}

function Footer({ docNo }: { docNo: string }) {
  return <Text style={s.footer} render={({ pageNumber, totalPages }) => `3i LOGISTICS Pvt Limited  ·  ${docNo}  ·  Page ${pageNumber}/${totalPages}`} fixed />
}

// ---------------------------------------------------------------------------
// 1. Operating Cost Requisition — Purpose / Unit / Qty / Remarks / Amount.
// ---------------------------------------------------------------------------
export interface ReqLine { purpose: string; unit?: string; qty?: number; remarks?: string; amount: number }

function RequisitionDoc({ docNo, meta, lines, grandTotal }: { docNo: string; meta: DocMeta[]; lines: ReqLine[]; grandTotal: number }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Letterhead title="Operating Cost Requisition" />
        <MetaBox meta={meta} />
        <View style={s.th}>
          <Text style={[s.thText, { width: '6%' }]}>#</Text>
          <Text style={[s.thText, { width: '34%' }]}>Purpose</Text>
          <Text style={[s.thText, { width: '12%' }]}>Unit</Text>
          <Text style={[s.thText, { width: '10%', textAlign: 'right' }]}>Qty</Text>
          <Text style={[s.thText, { width: '20%' }]}>Remarks</Text>
          <Text style={[s.thText, { width: '18%', textAlign: 'right' }]}>Amount</Text>
        </View>
        {lines.map((l, i) => (
          <View key={i} style={s.tr}>
            <Text style={[s.tdText, { width: '6%' }]}>{i + 1}</Text>
            <Text style={[s.tdText, { width: '34%' }]}>{l.purpose}</Text>
            <Text style={[s.tdText, { width: '12%' }]}>{l.unit || '—'}</Text>
            <Text style={[s.tdText, { width: '10%', textAlign: 'right' }]}>{l.qty ? l.qty.toLocaleString() : '—'}</Text>
            <Text style={[s.tdText, { width: '20%' }]}>{l.remarks || '—'}</Text>
            <Text style={[s.tdText, { width: '18%', textAlign: 'right' }]}>{money(l.amount)}</Text>
          </View>
        ))}
        <Summation total={grandTotal} deduction={0} net={grandTotal} />
        <View style={s.inWords}><Text><Text style={s.inWordsLabel}>In Words: </Text><Text style={s.inWordsValue}>{amountInWords(grandTotal)}</Text></Text></View>
        <SignRow labels={['Prepared By', 'Seal', 'Approved By']} />
        <Footer docNo={docNo} />
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
  project: string
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
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Letterhead title={o.title} />
        <MetaBox meta={[{ label: 'Project', value: o.project }, { label: 'Bill Reference No', value: o.billRef }, { label: 'Date', value: o.date }]} />
        <View style={s.th}>
          <Text style={[s.thText, { width: '6%' }]}>SL No.</Text>
          <Text style={[s.thText, { width: wPart }]}>Particulars</Text>
          {hasUnit && <Text style={[s.thText, { width: '14%' }]}>Unit</Text>}
          {hasQty && <Text style={[s.thText, { width: '10%', textAlign: 'right' }]}>Qty</Text>}
          {hasRemarks && <Text style={[s.thText, { width: '18%' }]}>Remarks</Text>}
          <Text style={[s.thText, { width: '16%', textAlign: 'right' }]}>Total Payable</Text>
          {o.showLineSignature && <Text style={[s.thText, { width: '16%' }]}>Signature</Text>}
        </View>
        {o.lines.map((l, i) => (
          <View key={i} style={s.tr}>
            <Text style={[s.tdText, { width: '6%' }]}>{i + 1}</Text>
            <Text style={[s.tdText, { width: wPart }]}>{l.particulars}</Text>
            {hasUnit && <Text style={[s.tdText, { width: '14%' }]}>{l.unit || '—'}</Text>}
            {hasQty && <Text style={[s.tdText, { width: '10%', textAlign: 'right' }]}>{l.qty ? l.qty.toLocaleString() : '—'}</Text>}
            {hasRemarks && <Text style={[s.tdText, { width: '18%' }]}>{l.remarks || '—'}</Text>}
            <Text style={[s.tdText, { width: '16%', textAlign: 'right' }]}>{money(l.amount)}</Text>
            {o.showLineSignature && <Text style={[s.tdText, { width: '16%' }]}></Text>}
          </View>
        ))}
        <Summation total={total} deduction={o.lessDeduction} net={net} />
        <View style={s.inWords}><Text><Text style={s.inWordsLabel}>In Words: </Text><Text style={s.inWordsValue}>{amountInWords(net)}</Text></Text></View>
        <SignRow labels={o.signLabels} />
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
  client: string; period: string
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
        <Letterhead title="Monthly Adjustment" />
        <MetaBox meta={[
          { label: 'Project', value: o.client },
          { label: 'Period', value: o.period },
          { label: 'Total Received', value: `BDT ${money(o.totalReceived)}` },
          { label: 'Total Expense', value: `BDT ${money(o.totalExpense)}` },
          { label: 'Closing Balance', value: `BDT ${money(o.closingBalance)}` }
        ]} />

        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Fund Received</Text>
        <View style={s.th}>
          <Text style={[s.thText, { width: '70%' }]}>Date</Text>
          <Text style={[s.thText, { width: '30%', textAlign: 'right' }]}>Amount</Text>
        </View>
        {o.receipts.length === 0 ? (
          <View style={s.tr}><Text style={[s.tdText, { width: '100%', color: '#9a9a9f' }]}>No fund received this period</Text></View>
        ) : o.receipts.map((r, i) => (
          <View key={i} style={s.tr}>
            <Text style={[s.tdText, { width: '70%' }]}>{r.date}</Text>
            <Text style={[s.tdText, { width: '30%', textAlign: 'right' }]}>{money(r.amount)}</Text>
          </View>
        ))}

        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 4 }}>Expense Details</Text>
        <View style={s.th}>
          <Text style={[s.thText, { width: '14%' }]}>Date</Text>
          <Text style={[s.thText, { width: '20%' }]}>Category</Text>
          <Text style={[s.thText, { width: '18%' }]}>Payee</Text>
          <Text style={[s.thText, { width: '30%' }]}>Description</Text>
          <Text style={[s.thText, { width: '18%', textAlign: 'right' }]}>Amount</Text>
        </View>
        {o.expenses.map((e, i) => (
          <View key={i} style={s.tr}>
            <Text style={[s.tdText, { width: '14%' }]}>{e.date}</Text>
            <Text style={[s.tdText, { width: '20%' }]}>{e.category}</Text>
            <Text style={[s.tdText, { width: '18%' }]}>{e.payee || '—'}</Text>
            <Text style={[s.tdText, { width: '30%' }]}>{e.description || '—'}</Text>
            <Text style={[s.tdText, { width: '18%', textAlign: 'right' }]}>{money(e.amount)}</Text>
          </View>
        ))}

        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 4 }}>Category Summary</Text>
        <View style={s.th}>
          <Text style={[s.thText, { width: '70%' }]}>Category</Text>
          <Text style={[s.thText, { width: '30%', textAlign: 'right' }]}>Amount</Text>
        </View>
        {o.categoryTotals.map((c, i) => (
          <View key={i} style={s.tr}>
            <Text style={[s.tdText, { width: '70%' }]}>{c.category}</Text>
            <Text style={[s.tdText, { width: '30%', textAlign: 'right' }]}>{money(c.amount)}</Text>
          </View>
        ))}

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Summation total={o.totalExpense} deduction={0} net={o.totalExpense} />
        </View>

        <SignRow labels={['Prepared By', 'Reviewed By', 'Head Office Approval']} />
        <Footer docNo={`Monthly Adjustment · ${o.period}`} />
      </Page>
    </Document>
  )
}

export async function downloadMonthlyAdjustmentPDF(opts: AdjustmentOpts) {
  const blob = await pdf(<MonthlyAdjustmentDoc {...opts} />).toBlob()
  downloadBlob(blob, `Monthly_Adjustment_${opts.period.replace(/[^\w]+/g, '_')}.pdf`)
}
