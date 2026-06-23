import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica', color: '#212326' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#f2a900', paddingBottom: 10, marginBottom: 16 },
  brand: { fontSize: 15, fontWeight: 'bold' },
  sub: { fontSize: 8, color: '#63666c' },
  metaR: { fontSize: 8, color: '#63666c', textAlign: 'right' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  photo: { width: 64, height: 64, borderRadius: 6, marginRight: 14, objectFit: 'cover', border: '1px solid #e9e9e9' },
  title: { fontSize: 14, fontWeight: 'bold' },
  code: { fontSize: 9, color: '#63666c', marginTop: 2 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ececec', paddingVertical: 5 },
  label: { width: '40%', color: '#63666c' },
  value: { width: '60%' },
  footer: { position: 'absolute', bottom: 22, left: 32, right: 32, fontSize: 7, color: '#9a9a9f', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#ececec', paddingTop: 6 }
})

export interface RecordField { label: string; value: string }

function Doc({ client, title, code, photo, fields }:
  { client: string; title: string; code?: string; photo?: string; fields: RecordField[] }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View><Image src="/whirlpool-logo.png" style={{ width: 120, height: 40, marginBottom: 3 }} /><Text style={s.sub}>ERP + WMS · {client}</Text></View>
          <View><Text style={s.metaR}>Generated: {new Date().toLocaleString('en-GB')}</Text><Text style={s.metaR}>Confidential</Text></View>
        </View>
        <View style={s.titleRow}>
          {photo ? <Image src={photo} style={s.photo} /> : null}
          <View><Text style={s.title}>{title}</Text>{code ? <Text style={s.code}>{code}</Text> : null}</View>
        </View>
        {fields.map((f, i) => (
          <View key={i} style={s.row}><Text style={s.label}>{f.label}</Text><Text style={s.value}>{f.value || '—'}</Text></View>
        ))}
        <Text style={s.footer} render={({ pageNumber, totalPages }) => `Whirlpool WH  ·  Page ${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  )
}

export async function downloadRecordPDF(opts: { client: string; title: string; code?: string; photo?: string; fields: RecordField[] }) {
  const blob = await pdf(<Doc {...opts} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${(opts.code || opts.title).replace(/[^\w]+/g, '_')}.pdf`; a.click()
  URL.revokeObjectURL(url)
}
