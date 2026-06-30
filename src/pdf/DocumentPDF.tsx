import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import { getCompanyInfo } from '@/lib/settings'

const s = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: 'Helvetica', color: '#212326' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 2, borderBottomColor: '#f2a900', paddingBottom: 10, marginBottom: 14 },
  brand: { fontSize: 15, fontWeight: 'bold' },
  sub: { fontSize: 8, color: '#63666c' },
  docTitle: { fontSize: 13, fontWeight: 'bold', textAlign: 'right' },
  docNo: { fontSize: 10, color: '#63666c', textAlign: 'right', marginTop: 2 },
  metaBox: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, fontSize: 9 },
  metaCol: { width: '48%' },
  metaLabel: { color: '#63666c', marginBottom: 2 },
  th: { flexDirection: 'row', backgroundColor: '#f7f7f4', borderBottomWidth: 0.5, borderColor: '#ececec', paddingVertical: 5, fontWeight: 'bold' },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#ececec', paddingVertical: 5 },
  cIdx: { width: '6%', paddingHorizontal: 4 }, cName: { width: '50%', paddingHorizontal: 4 },
  cQty: { width: '14%', paddingHorizontal: 4, textAlign: 'right' },
  cPrice: { width: '15%', paddingHorizontal: 4, textAlign: 'right' },
  cAmt: { width: '15%', paddingHorizontal: 4, textAlign: 'right' },
  total: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  totalBox: { width: '30%', flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#f2a900', paddingTop: 5, fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, fontSize: 7, color: '#9a9a9f', textAlign: 'center', borderTopWidth: 0.5, borderColor: '#ececec', paddingTop: 6 }
})

export interface DocLine { name: string; qty: number; price?: number }
export interface DocMeta { label: string; value: string }

function DocPDF({ client, title, docNo, meta, lines, showPrice }:
  { client: string; title: string; docNo: string; meta: DocMeta[]; lines: DocLine[]; showPrice?: boolean }) {
  const company = getCompanyInfo()
  const total = lines.reduce((a, l) => a + l.qty * (l.price ?? 0), 0)
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View><Image src={company.logoUrl || '/whirlpool-logo.png'} style={{ width: 118, height: 39, marginBottom: 3 }} /><Text style={s.sub}>{company.name} · {client}</Text></View>
          <View><Text style={s.docTitle}>{title}</Text><Text style={s.docNo}>{docNo}</Text></View>
        </View>
        <View style={s.metaBox}>
          <View style={s.metaCol}>{meta.slice(0, Math.ceil(meta.length / 2)).map((m, i) => (
            <Text key={i}><Text style={s.metaLabel}>{m.label}: </Text>{m.value}</Text>))}</View>
          <View style={s.metaCol}>{meta.slice(Math.ceil(meta.length / 2)).map((m, i) => (
            <Text key={i}><Text style={s.metaLabel}>{m.label}: </Text>{m.value}</Text>))}</View>
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
        <Text style={s.footer} render={({ pageNumber, totalPages }) => `${company.name}  ·  ${docNo}  ·  Page ${pageNumber}/${totalPages}`} fixed />
      </Page>
    </Document>
  )
}

export async function downloadDocPDF(opts: { client: string; title: string; docNo: string; meta: DocMeta[]; lines: DocLine[]; showPrice?: boolean }) {
  const blob = await pdf(<DocPDF {...opts} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${opts.docNo.replace(/[^\w]+/g, '_') || opts.title}.pdf`; a.click()
  URL.revokeObjectURL(url)
}
