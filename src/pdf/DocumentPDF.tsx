import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import { getCompanyInfo } from '@/lib/settings'
import { downloadBlob } from '@/lib/utils'

// This layout is shared by every non-specialised document (Order, Inward
// Requisition, Putaway, Purchase Return, Supplier Invoice, Dispatch, Packing,
// Trip, Courier, Billing, ...). It must read as an internal working FORM —
// something printed, signed and filed — not as an analytics printout: a
// boxed header strip for the header fields, a ruled title bar, and a
// signature/acknowledgement block are what make that distinction, and are
// deliberately different from the Reports module's plain table layout.
const s = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: 'Helvetica', color: '#212326' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  sub: { fontSize: 8, color: '#63666c', marginTop: 2 },
  titleBar: { alignItems: 'flex-end' },
  docTitle: { fontSize: 15, fontWeight: 'bold', textAlign: 'right', letterSpacing: 0.5, textTransform: 'uppercase' },
  docNo: { fontSize: 10, color: '#63666c', textAlign: 'right', marginTop: 3, fontFamily: 'Helvetica-Bold' },
  rule: { borderBottomWidth: 2, borderBottomColor: '#eeb111', marginBottom: 14 },
  metaBox: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 0.7, borderColor: '#d8d8d4', backgroundColor: '#fafaf8', borderRadius: 2, padding: 10, marginBottom: 14, fontSize: 9 },
  metaCol: { width: '48%' },
  metaRow: { flexDirection: 'row', marginBottom: 3 },
  metaLabel: { width: 78, color: '#63666c' },
  metaValue: { flex: 1, fontFamily: 'Helvetica-Bold' },
  th: { flexDirection: 'row', backgroundColor: '#eeb111', borderWidth: 0.7, borderColor: '#212326', borderBottomWidth: 0, paddingVertical: 5, fontFamily: 'Helvetica-Bold' },
  tr: { flexDirection: 'row', borderWidth: 0.7, borderTopWidth: 0, borderColor: '#212326', paddingVertical: 5 },
  cIdx: { width: '6%', paddingHorizontal: 4 }, cName: { width: '50%', paddingHorizontal: 4 },
  cQty: { width: '14%', paddingHorizontal: 4, textAlign: 'right' },
  cPrice: { width: '15%', paddingHorizontal: 4, textAlign: 'right' },
  cAmt: { width: '15%', paddingHorizontal: 4, textAlign: 'right' },
  total: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  totalBox: { width: '30%', flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#eeb111', paddingTop: 5, fontWeight: 'bold' },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 46 },
  signBlock: { width: '30%', borderTopWidth: 0.7, borderColor: '#212326', paddingTop: 4, textAlign: 'center', fontSize: 8, color: '#63666c' },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, fontSize: 7, color: '#9a9a9f', textAlign: 'center', borderTopWidth: 0.5, borderColor: '#ececec', paddingTop: 6 }
})

export interface DocLine { name: string; qty: number; price?: number }
export interface DocMeta { label: string; value: string }

function MetaCol({ items }: { items: DocMeta[] }) {
  return (
    <View style={s.metaCol}>
      {items.map((m, i) => (
        <View key={i} style={s.metaRow}><Text style={s.metaLabel}>{m.label}</Text><Text style={s.metaValue}>{m.value || '—'}</Text></View>
      ))}
    </View>
  )
}

function DocPDF({ client, title, docNo, meta, lines, showPrice }:
  { client: string; title: string; docNo: string; meta: DocMeta[]; lines: DocLine[]; showPrice?: boolean }) {
  const company = getCompanyInfo()
  const total = lines.reduce((a, l) => a + l.qty * (l.price ?? 0), 0)
  const half = Math.ceil(meta.length / 2)
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View><Image src={company.logoUrl || '/whirlpool-logo.png'} style={{ width: 118, height: 39, marginBottom: 3 }} /><Text style={s.sub}>{company.name} · {client}</Text></View>
          <View style={s.titleBar}><Text style={s.docTitle}>{title}</Text><Text style={s.docNo}>{docNo}</Text></View>
        </View>
        <View style={s.rule} />
        <View style={s.metaBox}>
          <MetaCol items={meta.slice(0, half)} />
          <MetaCol items={meta.slice(half)} />
        </View>
        <View style={s.th}>
          <Text style={s.cIdx}>#</Text><Text style={s.cName}>Product</Text><Text style={s.cQty}>Qty</Text>
          {showPrice && <Text style={s.cPrice}>Unit Price</Text>}{showPrice && <Text style={s.cAmt}>Amount</Text>}
        </View>
        {lines.map((l, i) => (
          <View key={i} style={s.tr}>
            <Text style={s.cIdx}>{i + 1}</Text><Text style={s.cName}>{l.name}</Text>
            <Text style={s.cQty}>{l.qty.toLocaleString()}</Text>
            {showPrice && <Text style={s.cPrice}>{(l.price ?? 0).toLocaleString()}</Text>}
            {showPrice && <Text style={s.cAmt}>{(l.qty * (l.price ?? 0)).toLocaleString()}</Text>}
          </View>
        ))}
        {showPrice && <View style={s.total}><View style={s.totalBox}><Text>Total</Text><Text>{total.toLocaleString()}</Text></View></View>}

        <View style={s.signRow}>
          <View style={s.signBlock}><Text>Prepared By</Text></View>
          <View style={s.signBlock}><Text>Checked By</Text></View>
          <View style={s.signBlock}><Text>Approved By</Text></View>
        </View>

        <Text style={s.footer} render={({ pageNumber, totalPages }) => `${company.name}  ·  ${docNo}  ·  Page ${pageNumber}/${totalPages}`} fixed />
      </Page>
    </Document>
  )
}

export async function downloadDocPDF(opts: { client: string; title: string; docNo: string; meta: DocMeta[]; lines: DocLine[]; showPrice?: boolean }) {
  const blob = await pdf(<DocPDF {...opts} />).toBlob()
  downloadBlob(blob, `${opts.docNo.replace(/[^\w]+/g, '_') || opts.title}.pdf`)
}
