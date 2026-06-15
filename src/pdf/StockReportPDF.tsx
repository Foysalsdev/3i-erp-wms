import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica', color: '#1d2d3e' },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#0033A0', paddingBottom: 8, marginBottom: 12 },
  brand: { fontSize: 16, fontWeight: 'bold', color: '#0033A0' },
  meta: { fontSize: 8, color: '#556b82', textAlign: 'right' },
  title: { fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', paddingVertical: 4 },
  th: { backgroundColor: '#f5f6f7', fontWeight: 'bold' },
  c1: { width: '20%' }, c2: { width: '32%' }, c3: { width: '20%' }, c4: { width: '14%' }, c5: { width: '14%', textAlign: 'right' },
  footer: { position: 'absolute', bottom: 20, left: 28, right: 28, fontSize: 7, color: '#94a3b8', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 6 }
})

export interface StockRow { code: string; name: string; warehouse: string; status: string; qty: number }

function Report({ client, rows, title }: { client: string; rows: StockRow[]; title: string }) {
  const total = rows.reduce((a, r) => a + r.qty, 0)
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View><Text style={s.brand}>3i Logistics</Text><Text style={{ fontSize: 8, color: '#556b82' }}>ERP + WMS · {client}</Text></View>
          <View><Text style={s.meta}>Generated: {new Date().toLocaleString('en-GB')}</Text><Text style={s.meta}>Confidential</Text></View>
        </View>
        <Text style={s.title}>{title}</Text>
        <View style={[s.row, s.th]}>
          <Text style={s.c1}>Material Code</Text><Text style={s.c2}>Product</Text><Text style={s.c3}>Warehouse</Text><Text style={s.c4}>Condition</Text><Text style={s.c5}>Qty</Text>
        </View>
        {rows.map((r, i) => (
          <View key={i} style={s.row}>
            <Text style={s.c1}>{r.code}</Text><Text style={s.c2}>{r.name}</Text><Text style={s.c3}>{r.warehouse}</Text><Text style={s.c4}>{r.status}</Text><Text style={s.c5}>{r.qty.toLocaleString()}</Text>
          </View>
        ))}
        <View style={[s.row, { borderTopWidth: 1, borderTopColor: '#0033A0' }]}>
          <Text style={s.c1}></Text><Text style={s.c2}></Text><Text style={s.c3}></Text><Text style={[s.c4, { fontWeight: 'bold' }]}>Total</Text><Text style={[s.c5, { fontWeight: 'bold' }]}>{total.toLocaleString()}</Text>
        </View>
        <Text style={s.footer} render={({ pageNumber, totalPages }) => `3i Logistics ERP + WMS  ·  Page ${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  )
}

export async function downloadStockPDF(client: string, rows: StockRow[], title = 'Inventory Stock Report') {
  const blob = await pdf(<Report client={client} rows={rows} title={title} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${title.replace(/\s+/g, '_')}_${Date.now()}.pdf`; a.click()
  URL.revokeObjectURL(url)
}
