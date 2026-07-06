import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import { getCompanyInfo } from '@/lib/settings'
import { downloadBlob } from '@/lib/utils'

// Petty-cash style documents for the Finance module (Requisition, Payment
// Receipt, Monthly Adjustment). Same look-and-feel as DocumentPDF.tsx
// (boxed meta header, ruled title, signature block) but each has its own
// column layout, so they live in their own file rather than overloading the
// generic DocLine shape used by every other module's documents.
const s = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: 'Helvetica', color: '#212326' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  sub: { fontSize: 8, color: '#63666c', marginTop: 2 },
  titleBar: { alignItems: 'flex-end' },
  docTitle: { fontSize: 15, fontWeight: 'bold', textAlign: 'right', letterSpacing: 0.5, textTransform: 'uppercase' },
  docNo: { fontSize: 10, color: '#63666c', textAlign: 'right', marginTop: 3, fontFamily: 'Helvetica-Bold' },
  rule: { borderBottomWidth: 2, borderBottomColor: '#f2a900', marginBottom: 14 },
  metaBox: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 0.7, borderColor: '#d8d8d4', backgroundColor: '#fafaf8', borderRadius: 2, padding: 10, marginBottom: 14, fontSize: 9 },
  metaCol: { width: '48%' },
  metaRow: { flexDirection: 'row', marginBottom: 3 },
  metaLabel: { width: 90, color: '#63666c' },
  metaValue: { flex: 1, fontFamily: 'Helvetica-Bold' },
  sectionLabel: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.4, color: '#63666c', marginBottom: 5, marginTop: 12 },
  th: { flexDirection: 'row', backgroundColor: '#eeb111', borderWidth: 0.7, borderColor: '#212326', borderBottomWidth: 0, paddingVertical: 5, fontFamily: 'Helvetica-Bold' },
  tr: { flexDirection: 'row', borderWidth: 0.7, borderTopWidth: 0, borderColor: '#212326', paddingVertical: 5 },
  total: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  totalBox: { minWidth: '30%', flexDirection: 'row', justifyContent: 'space-between', gap: 16, borderTopWidth: 1, borderColor: '#f2a900', paddingTop: 5, fontWeight: 'bold' },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 46 },
  signBlock: { width: '30%', borderTopWidth: 0.7, borderColor: '#212326', paddingTop: 4, textAlign: 'center', fontSize: 8, color: '#63666c' },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, fontSize: 7, color: '#9a9a9f', textAlign: 'center', borderTopWidth: 0.5, borderColor: '#ececec', paddingTop: 6 }
})

export interface DocMeta { label: string; value: string }

function Header({ client, title, docNo }: { client: string; title: string; docNo: string }) {
  const company = getCompanyInfo()
  return (
    <>
      <View style={s.header}>
        <View><Image src={company.logoUrl || '/whirlpool-logo.png'} style={{ width: 118, height: 39, marginBottom: 3 }} /><Text style={s.sub}>{company.name} · {client}</Text></View>
        <View style={s.titleBar}><Text style={s.docTitle}>{title}</Text><Text style={s.docNo}>{docNo}</Text></View>
      </View>
      <View style={s.rule} />
    </>
  )
}

function MetaBox({ meta }: { meta: DocMeta[] }) {
  const half = Math.ceil(meta.length / 2)
  const Col = ({ items }: { items: DocMeta[] }) => (
    <View style={s.metaCol}>
      {items.map((m, i) => <View key={i} style={s.metaRow}><Text style={s.metaLabel}>{m.label}</Text><Text style={s.metaValue}>{m.value || '—'}</Text></View>)}
    </View>
  )
  return <View style={s.metaBox}><Col items={meta.slice(0, half)} /><Col items={meta.slice(half)} /></View>
}

function SignRow({ labels }: { labels: [string, string, string] }) {
  return <View style={s.signRow}>{labels.map(l => <View key={l} style={s.signBlock}><Text>{l}</Text></View>)}</View>
}

function Footer({ company, docNo }: { company: string; docNo: string }) {
  return <Text style={s.footer} render={({ pageNumber, totalPages }) => `${company}  ·  ${docNo}  ·  Page ${pageNumber}/${totalPages}`} fixed />
}

const money = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ---------------------------------------------------------------------------
// 1. Operating Cost Requisition — Purpose / Unit / Qty / Remarks / Amount.
// ---------------------------------------------------------------------------
export interface ReqLine { purpose: string; unit?: string; qty?: number; remarks?: string; amount: number }

function RequisitionDoc({ client, docNo, meta, lines, grandTotal }:
  { client: string; docNo: string; meta: DocMeta[]; lines: ReqLine[]; grandTotal: number }) {
  const company = getCompanyInfo()
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header client={client} title="Operating Cost Requisition" docNo={docNo} />
        <MetaBox meta={meta} />
        <View style={s.th}>
          <Text style={{ width: '6%', paddingHorizontal: 4 }}>#</Text>
          <Text style={{ width: '34%', paddingHorizontal: 4 }}>Purpose</Text>
          <Text style={{ width: '12%', paddingHorizontal: 4 }}>Unit</Text>
          <Text style={{ width: '10%', paddingHorizontal: 4, textAlign: 'right' }}>Qty</Text>
          <Text style={{ width: '20%', paddingHorizontal: 4 }}>Remarks</Text>
          <Text style={{ width: '18%', paddingHorizontal: 4, textAlign: 'right' }}>Amount (BDT)</Text>
        </View>
        {lines.map((l, i) => (
          <View key={i} style={s.tr}>
            <Text style={{ width: '6%', paddingHorizontal: 4 }}>{i + 1}</Text>
            <Text style={{ width: '34%', paddingHorizontal: 4 }}>{l.purpose}</Text>
            <Text style={{ width: '12%', paddingHorizontal: 4 }}>{l.unit || '—'}</Text>
            <Text style={{ width: '10%', paddingHorizontal: 4, textAlign: 'right' }}>{l.qty ? l.qty.toLocaleString() : '—'}</Text>
            <Text style={{ width: '20%', paddingHorizontal: 4 }}>{l.remarks || '—'}</Text>
            <Text style={{ width: '18%', paddingHorizontal: 4, textAlign: 'right' }}>{money(l.amount)}</Text>
          </View>
        ))}
        <View style={s.total}><View style={s.totalBox}><Text>Grand Total</Text><Text>{money(grandTotal)}</Text></View></View>
        <SignRow labels={['Prepared By', 'Seal', 'Approved By']} />
        <Footer company={company.name} docNo={docNo} />
      </Page>
    </Document>
  )
}

export async function downloadRequisitionPDF(opts: { client: string; docNo: string; meta: DocMeta[]; lines: ReqLine[]; grandTotal: number }) {
  const blob = await pdf(<RequisitionDoc {...opts} />).toBlob()
  downloadBlob(blob, `${opts.docNo.replace(/[^\w]+/g, '_')}.pdf`)
}

// ---------------------------------------------------------------------------
// 2. Payment Receipt — a single acknowledgement slip for one expense payment.
// ---------------------------------------------------------------------------
export interface ReceiptOpts { client: string; date: string; payee: string; purpose: string; amount: number; billRefs?: string }

function PaymentReceiptDoc({ client, date, payee, purpose, amount, billRefs }: ReceiptOpts) {
  const company = getCompanyInfo()
  const meta: DocMeta[] = [
    { label: 'Date', value: date },
    { label: 'Received By', value: payee },
    { label: 'Purpose', value: purpose },
    { label: 'Bill Ref(s)', value: billRefs || '—' }
  ]
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header client={client} title="Payment Receipt" docNo="" />
        <MetaBox meta={meta} />
        <View style={s.total}><View style={s.totalBox}><Text>Amount Paid (BDT)</Text><Text>{money(amount)}</Text></View></View>
        <Text style={{ marginTop: 18, fontSize: 9.5, lineHeight: 1.5 }}>
          Received an amount of BDT {money(amount)} from {company.name} ({client}) towards the purpose stated above.
        </Text>
        <SignRow labels={['Paid By', 'Witness', 'Received By (Sign)']} />
        <Footer company={company.name} docNo="Payment Receipt" />
      </Page>
    </Document>
  )
}

export async function downloadPaymentReceiptPDF(opts: ReceiptOpts) {
  const blob = await pdf(<PaymentReceiptDoc {...opts} />).toBlob()
  downloadBlob(blob, `Payment_Receipt_${opts.payee.replace(/[^\w]+/g, '_')}_${opts.date}.pdf`)
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
  const company = getCompanyInfo()
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header client={o.client} title="Monthly Adjustment" docNo={o.period} />
        <MetaBox meta={[
          { label: 'Period', value: o.period },
          { label: 'Total Received', value: `BDT ${money(o.totalReceived)}` },
          { label: 'Total Expense', value: `BDT ${money(o.totalExpense)}` },
          { label: 'Closing Balance', value: `BDT ${money(o.closingBalance)}` }
        ]} />

        <Text style={s.sectionLabel}>Fund Received</Text>
        <View style={s.th}>
          <Text style={{ width: '70%', paddingHorizontal: 4 }}>Date</Text>
          <Text style={{ width: '30%', paddingHorizontal: 4, textAlign: 'right' }}>Amount (BDT)</Text>
        </View>
        {o.receipts.length === 0 ? (
          <View style={s.tr}><Text style={{ width: '100%', paddingHorizontal: 4, color: '#9a9a9f' }}>No fund received this period</Text></View>
        ) : o.receipts.map((r, i) => (
          <View key={i} style={s.tr}>
            <Text style={{ width: '70%', paddingHorizontal: 4 }}>{r.date}</Text>
            <Text style={{ width: '30%', paddingHorizontal: 4, textAlign: 'right' }}>{money(r.amount)}</Text>
          </View>
        ))}

        <Text style={s.sectionLabel}>Expense Details</Text>
        <View style={s.th}>
          <Text style={{ width: '14%', paddingHorizontal: 4 }}>Date</Text>
          <Text style={{ width: '20%', paddingHorizontal: 4 }}>Category</Text>
          <Text style={{ width: '18%', paddingHorizontal: 4 }}>Payee</Text>
          <Text style={{ width: '30%', paddingHorizontal: 4 }}>Description</Text>
          <Text style={{ width: '18%', paddingHorizontal: 4, textAlign: 'right' }}>Amount (BDT)</Text>
        </View>
        {o.expenses.map((e, i) => (
          <View key={i} style={s.tr}>
            <Text style={{ width: '14%', paddingHorizontal: 4 }}>{e.date}</Text>
            <Text style={{ width: '20%', paddingHorizontal: 4 }}>{e.category}</Text>
            <Text style={{ width: '18%', paddingHorizontal: 4 }}>{e.payee || '—'}</Text>
            <Text style={{ width: '30%', paddingHorizontal: 4 }}>{e.description || '—'}</Text>
            <Text style={{ width: '18%', paddingHorizontal: 4, textAlign: 'right' }}>{money(e.amount)}</Text>
          </View>
        ))}

        <Text style={s.sectionLabel}>Category Summary</Text>
        <View style={s.th}>
          <Text style={{ width: '70%', paddingHorizontal: 4 }}>Category</Text>
          <Text style={{ width: '30%', paddingHorizontal: 4, textAlign: 'right' }}>Amount (BDT)</Text>
        </View>
        {o.categoryTotals.map((c, i) => (
          <View key={i} style={s.tr}>
            <Text style={{ width: '70%', paddingHorizontal: 4 }}>{c.category}</Text>
            <Text style={{ width: '30%', paddingHorizontal: 4, textAlign: 'right' }}>{money(c.amount)}</Text>
          </View>
        ))}
        <View style={s.total}><View style={s.totalBox}><Text>Total Expense</Text><Text>{money(o.totalExpense)}</Text></View></View>

        <SignRow labels={['Prepared By', 'Reviewed By', 'Head Office Approval']} />
        <Footer company={company.name} docNo={`Monthly Adjustment · ${o.period}`} />
      </Page>
    </Document>
  )
}

export async function downloadMonthlyAdjustmentPDF(opts: AdjustmentOpts) {
  const blob = await pdf(<MonthlyAdjustmentDoc {...opts} />).toBlob()
  downloadBlob(blob, `Monthly_Adjustment_${opts.period.replace(/[^\w]+/g, '_')}.pdf`)
}
