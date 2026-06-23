import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import type { DocMeta, DocLine } from './DocumentPDF'

const s = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica', color: '#212326' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#eeb111', paddingBottom: 8, marginBottom: 8 },
  sub: { fontSize: 8, color: '#63666c' },
  banner: { backgroundColor: '#1c1c1c', color: '#ffffff', textAlign: 'center', paddingVertical: 7, borderRadius: 4, marginBottom: 4 },
  bannerT: { fontSize: 16, fontWeight: 'bold', letterSpacing: 2 },
  docNo: { fontSize: 11, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  notice: { backgroundColor: '#fff8e6', borderWidth: 1, borderColor: '#eeb111', borderRadius: 4, padding: 8, marginBottom: 12, fontSize: 8.5, color: '#7c5300' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  metaItem: { width: '50%', paddingVertical: 3, fontSize: 9 },
  metaLabel: { color: '#63666c' },
  th: { flexDirection: 'row', backgroundColor: '#f7f7f4', borderBottomWidth: 0.5, borderColor: '#ececec', paddingVertical: 5, fontWeight: 'bold' },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#ececec', paddingVertical: 5 },
  cIdx: { width: '8%', paddingHorizontal: 4 }, cName: { width: '72%', paddingHorizontal: 4 }, cQty: { width: '20%', paddingHorizontal: 4, textAlign: 'right' },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 40 },
  signBox: { width: '30%', borderTopWidth: 1, borderColor: '#212326', paddingTop: 4, fontSize: 8.5, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, fontSize: 7, color: '#9a9a9f', textAlign: 'center', borderTopWidth: 0.5, borderColor: '#ececec', paddingTop: 6 }
})

function GatePass({ client, docNo, meta, lines }: { client: string; docNo: string; meta: DocMeta[]; lines: DocLine[] }) {
  const totalQty = lines.reduce((a, l) => a + l.qty, 0)
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Image src="/whirlpool-logo.png" style={{ width: 118, height: 39 }} />
          <View><Text style={s.sub}>Whirlpool WH · {client}</Text><Text style={s.sub}>Security Gate Pass</Text></View>
        </View>
        <View style={s.banner}><Text style={s.bannerT}>GATE PASS</Text></View>
        <Text style={s.docNo}>{docNo}</Text>
        <View style={s.notice}>
          <Text>SECURITY COPY — This gate pass must be surrendered to the security guard at the gate. Goods will NOT be released or allowed to leave the premises without this authorized gate pass.</Text>
        </View>
        <View style={s.metaRow}>
          {meta.map((m, i) => (
            <View key={i} style={s.metaItem}><Text><Text style={s.metaLabel}>{m.label}: </Text>{m.value}</Text></View>
          ))}
        </View>
        <View style={s.th}><Text style={s.cIdx}>#</Text><Text style={s.cName}>Product</Text><Text style={s.cQty}>Qty</Text></View>
        {lines.map((l, i) => (
          <View key={i} style={s.tr}><Text style={s.cIdx}>{i + 1}</Text><Text style={s.cName}>{l.name}</Text><Text style={s.cQty}>{l.qty.toLocaleString()}</Text></View>
        ))}
        <View style={[s.tr, { borderTopWidth: 1, borderColor: '#eeb111', fontWeight: 'bold' }]}>
          <Text style={s.cIdx}></Text><Text style={s.cName}>Total Quantity</Text><Text style={s.cQty}>{totalQty.toLocaleString()}</Text>
        </View>
        <View style={s.signRow}>
          <Text style={s.signBox}>Prepared / Authorized by</Text>
          <Text style={s.signBox}>Driver / Receiver</Text>
          <Text style={s.signBox}>Security Guard (Gate Out)</Text>
        </View>
        <Text style={s.footer} render={({ pageNumber, totalPages }) => `Whirlpool WH  ·  ${docNo}  ·  Security Gate Pass  ·  Page ${pageNumber}/${totalPages}`} fixed />
      </Page>
    </Document>
  )
}

export async function downloadGatePassPDF(opts: { client: string; docNo: string; meta: DocMeta[]; lines: DocLine[] }) {
  const blob = await pdf(<GatePass {...opts} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `GatePass_${opts.docNo.replace(/[^\w]+/g, '_')}.pdf`; a.click()
  URL.revokeObjectURL(url)
}
