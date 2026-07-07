import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { downloadBlob } from '@/lib/utils'
import { pdfLayout, PdfHeader, PdfFooter } from './pdfLayout'

const s = StyleSheet.create({
  three: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  col: { width: '33%' },
  k: { fontSize: 8, color: '#1f3a93', fontWeight: 'bold' },
  v: { fontSize: 9, marginTop: 1 },
  two: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  vb: { fontSize: 10, fontWeight: 'bold' },
  r: { flexDirection: 'row', marginBottom: 2 },
  rk: { width: 78, fontSize: 8, color: '#444' },
  rv: { fontSize: 9, flex: 1 },
  totalRow: { flexDirection: 'row', borderWidth: 0.7, borderTopWidth: 0, borderColor: '#333', paddingVertical: 3 },
  notes: { marginTop: 14, fontSize: 9, fontWeight: 'bold', textAlign: 'center' },
  sign: { marginTop: 22, fontSize: 9, fontWeight: 'bold', textAlign: 'right' },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 60 }
})

function Row({ k, v }: { k: string; v?: string }) {
  return <View style={s.r}><Text style={s.rk}>{k}</Text><Text style={s.rv}>{v || ''}</Text></View>
}

function Doc({ challan, customerName, vehicleNo, items }: any) {
  const total = (items || []).reduce((a: number, it: any) => a + (Number(it.qty) || 0), 0)
  return (
    <Document>
      <Page size="A4" style={pdfLayout.page}>
        <PdfHeader title="Delivery Challan" docNo={`Delivery Challan# - ${challan.challan_no}`} />

        <View style={s.three}>
          <View style={s.col}><Text style={s.k}>PO #</Text><Text style={s.v}>{challan.po_no || '-'}</Text></View>
          <View style={s.col}><Text style={s.k}>Invoice No #</Text><Text style={s.v}>{challan.invoice_no || '-'}</Text></View>
          <View style={s.col}><Text style={s.k}>Dispatch time #</Text><Text style={s.v}>{challan.dispatch_time || '-'}</Text></View>
        </View>
        <View style={pdfLayout.hr} />

        <View style={s.two}>
          <View style={{ width: '55%' }}>
            <Text style={s.k}>Bill To:</Text>
            <Text style={s.vb}>{customerName}</Text>
            {challan.bill_to_address ? <Text style={pdfLayout.sub}>{challan.bill_to_address}</Text> : null}
            <Text style={pdfLayout.sub}>Receiver: {challan.receiver_name || ''}{challan.receiver_phone ? '  ' + challan.receiver_phone : ''}</Text>
            <Text style={pdfLayout.sub}>Unloading Point: {challan.unloading_point || ''}</Text>
          </View>
          <View style={{ width: '43%' }}>
            {challan.delivery_method === 'courier' ? (
              // Courier despatch: the vehicle/driver block is meaningless — show
              // the courier and consignment/tracking number instead.
              <>
                <Row k="Sent via:" v="Courier" />
                <Row k="Courier:" v={challan.courier_name} />
                <Row k="Tracking / CN #" v={challan.courier_tracking_no} />
                <Row k="Prepared by:" v={challan.prepared_by} />
              </>
            ) : (
              <>
                <Row k="Lock No #" v={challan.lock_no} />
                <Row k="Driver #" v={[challan.driver_name, challan.driver_phone].filter(Boolean).join(' | ')} />
                <Row k="Vehicle No#" v={vehicleNo} />
                <Row k="Transport Vendor:" v={challan.transport_vendor} />
                <Row k="Prepared by:" v={challan.prepared_by} />
              </>
            )}
          </View>
        </View>

        <View style={pdfLayout.tHead}>
          <Text style={[pdfLayout.th, { width: '5%' }]}>SL</Text>
          <Text style={[pdfLayout.th, { width: '41%' }]}>Description</Text>
          <Text style={[pdfLayout.th, { width: '14%' }]}>Material Code</Text>
          <Text style={[pdfLayout.th, { width: '13%' }]}>Category</Text>
          <Text style={[pdfLayout.th, { width: '7%', textAlign: 'right' }]}>Qty</Text>
          <Text style={[pdfLayout.th, { width: '7%' }]}>Unit</Text>
          <Text style={[pdfLayout.th, { width: '13%' }]}>Remarks</Text>
        </View>
        {(items || []).map((it: any) => (
          <View key={it.sl} style={pdfLayout.tr}>
            <Text style={[pdfLayout.td, { width: '5%' }]}>{it.sl}</Text>
            <Text style={[pdfLayout.td, { width: '41%', fontSize: 7.5 }]}>{it.description}</Text>
            <Text style={[pdfLayout.td, { width: '14%' }]}>{it.material_code}</Text>
            <Text style={[pdfLayout.td, { width: '13%' }]}>{it.category}</Text>
            <Text style={[pdfLayout.td, { width: '7%', textAlign: 'right' }]}>{it.qty}</Text>
            <Text style={[pdfLayout.td, { width: '7%' }]}>{it.unit}</Text>
            <Text style={[pdfLayout.td, { width: '13%' }]}>{it.remarks}</Text>
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

        <PdfFooter />
      </Page>
    </Document>
  )
}

export async function downloadChallanPDF(opts: any) {
  const blob = await pdf(<Doc {...opts} />).toBlob()
  downloadBlob(blob, `Challan-${String(opts.challan.challan_no || 'DC').replace(/[^\w]+/g, '_')}.pdf`)
}
