import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import { getCompanyInfo } from '@/lib/settings'

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica', color: '#212326' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  brand: { fontSize: 16, fontWeight: 'bold', color: '#1f3a93' },
  title: { fontSize: 17, fontWeight: 'bold' },
  titleSub: { fontSize: 9, marginTop: 2 },
  company: { marginTop: 14, marginBottom: 8 },
  companyName: { fontWeight: 'bold', fontSize: 9 },
  sub: { fontSize: 8, color: '#3a3a3a' },
  hr: { borderBottomWidth: 1, borderBottomColor: '#bbb', marginVertical: 6 },
  three: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  col: { width: '33%' },
  k: { fontSize: 8, color: '#1f3a93', fontWeight: 'bold' },
  v: { fontSize: 9, marginTop: 1 },
  two: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  vb: { fontSize: 10, fontWeight: 'bold' },
  r: { flexDirection: 'row', marginBottom: 2 },
  rk: { width: 78, fontSize: 8, color: '#444' },
  rv: { fontSize: 9, flex: 1 },
  tHead: { flexDirection: 'row', alignItems: 'center', borderWidth: 0.7, borderColor: '#333', backgroundColor: '#f2f2f0' },
  th: { fontSize: 8, fontWeight: 'bold', padding: 3, borderRightWidth: 0.5, borderRightColor: '#999' },
  tr: { flexDirection: 'row', alignItems: 'center', borderWidth: 0.7, borderTopWidth: 0, borderColor: '#333' },
  td: { fontSize: 8, padding: 3, borderRightWidth: 0.5, borderRightColor: '#ccc' },
  totalRow: { flexDirection: 'row', borderWidth: 0.7, borderTopWidth: 0, borderColor: '#333', paddingVertical: 3 },
  notes: { marginTop: 14, fontSize: 9, fontWeight: 'bold', textAlign: 'center' },
  sign: { marginTop: 22, fontSize: 9, fontWeight: 'bold', textAlign: 'right' },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 60 },
  footer: { position: 'absolute', bottom: 18, left: 28, right: 28, fontSize: 7, color: '#777', textAlign: 'center' }
})

function Row({ k, v }: { k: string; v?: string }) {
  return <View style={s.r}><Text style={s.rk}>{k}</Text><Text style={s.rv}>{v || ''}</Text></View>
}

function Doc({ challan, customerName, vehicleNo, items }: any) {
  const company = getCompanyInfo()
  const companyLines = (company.address || '').split('\n').filter(Boolean)
  const total = (items || []).reduce((a: number, it: any) => a + (Number(it.qty) || 0), 0)
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.topRow}>
          <Image src={company.logoUrl || '/whirlpool-logo.png'} style={{ width: 118, height: 39 }} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.title}>DELIVERY CHALLAN</Text>
            <Text style={s.titleSub}>Delivery Challan# - {challan.challan_no}</Text>
          </View>
        </View>

        <View style={s.company}>
          <Text style={s.companyName}>{company.name}</Text>
          {companyLines.map((l, i) => <Text key={i} style={s.sub}>{l}</Text>)}
          {company.bin ? <Text style={s.sub}>{company.bin}</Text> : null}
        </View>
        <View style={s.hr} />

        <View style={s.three}>
          <View style={s.col}><Text style={s.k}>PO #</Text><Text style={s.v}>{challan.po_no || '-'}</Text></View>
          <View style={s.col}><Text style={s.k}>Invoice No #</Text><Text style={s.v}>{challan.invoice_no || '-'}</Text></View>
          <View style={s.col}><Text style={s.k}>Dispatch time #</Text><Text style={s.v}>{challan.dispatch_time || '-'}</Text></View>
        </View>
        <View style={s.hr} />

        <View style={s.two}>
          <View style={{ width: '55%' }}>
            <Text style={s.k}>Bill To:</Text>
            <Text style={s.vb}>{customerName}</Text>
            {challan.bill_to_address ? <Text style={s.sub}>{challan.bill_to_address}</Text> : null}
            <Text style={s.sub}>Receiver: {challan.receiver_name || ''}{challan.receiver_phone ? '  ' + challan.receiver_phone : ''}</Text>
            <Text style={s.sub}>Unloading Point: {challan.unloading_point || ''}</Text>
          </View>
          <View style={{ width: '43%' }}>
            <Row k="Lock No #" v={challan.lock_no} />
            <Row k="Driver #" v={[challan.driver_name, challan.driver_phone].filter(Boolean).join(' | ')} />
            <Row k="Vehicle No#" v={vehicleNo} />
            <Row k="Transport Vendor:" v={challan.transport_vendor} />
            <Row k="Prepared by:" v={challan.prepared_by} />
          </View>
        </View>

        <View style={s.tHead}>
          <Text style={[s.th, { width: '5%' }]}>SL</Text>
          <Text style={[s.th, { width: '41%' }]}>Description</Text>
          <Text style={[s.th, { width: '14%' }]}>Material Code</Text>
          <Text style={[s.th, { width: '13%' }]}>Category</Text>
          <Text style={[s.th, { width: '7%', textAlign: 'right' }]}>Qty</Text>
          <Text style={[s.th, { width: '7%' }]}>Unit</Text>
          <Text style={[s.th, { width: '13%' }]}>Remarks</Text>
        </View>
        {(items || []).map((it: any) => (
          <View key={it.sl} style={s.tr}>
            <Text style={[s.td, { width: '5%' }]}>{it.sl}</Text>
            <Text style={[s.td, { width: '41%', fontSize: 7.5 }]}>{it.description}</Text>
            <Text style={[s.td, { width: '14%' }]}>{it.material_code}</Text>
            <Text style={[s.td, { width: '13%' }]}>{it.category}</Text>
            <Text style={[s.td, { width: '7%', textAlign: 'right' }]}>{it.qty}</Text>
            <Text style={[s.td, { width: '7%' }]}>{it.unit}</Text>
            <Text style={[s.td, { width: '13%' }]}>{it.remarks}</Text>
          </View>
        ))}
        <View style={s.totalRow}>
          <Text style={{ width: '73%', textAlign: 'right', paddingRight: 6, fontWeight: 'bold' }}>Total =</Text>
          <Text style={{ width: '7%', textAlign: 'right', fontWeight: 'bold' }}>{total}</Text>
          <Text style={{ width: '20%' }}></Text>
        </View>

        <Text style={s.notes}>Notes: Acknowledgement receipt of Goods: Goods received in following described order and condition</Text>
        <Text style={s.sign}>Receiver Sign with Seal &amp; Date..</Text>
        <View style={s.signRow}><Text>security</Text><Text>Authorised by</Text></View>

        <Text style={s.footer} fixed>{company.footer}</Text>
      </Page>
    </Document>
  )
}

export async function downloadChallanPDF(opts: any) {
  const blob = await pdf(<Doc {...opts} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `Challan-${String(opts.challan.challan_no || 'DC').replace(/[^\w]+/g, '_')}.pdf`; a.click()
  URL.revokeObjectURL(url)
}
