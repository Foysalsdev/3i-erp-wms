import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { downloadBlob, formatDate } from '@/lib/utils'
import { DEFAULT_CHALLAN_NOTE } from '@/lib/constants'
import { pdfLayout, PdfFooter, LetterheadSlim, DocInfoBox, Barcode } from './pdfLayout'

const s = StyleSheet.create({
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  parties: { width: '52%' },
  partyBox: { marginBottom: 8 },
  cap: { fontSize: 8, color: '#555', marginBottom: 3 },
  billName: { fontSize: 11, fontWeight: 'bold' },
  billSub: { fontSize: 8.5, color: '#3a3a3a', marginTop: 2 },
  section: { fontSize: 8, fontWeight: 'bold', color: '#555', letterSpacing: 0.5, marginBottom: 4 },
  dispatch: { flexDirection: 'row', borderWidth: 0.7, borderColor: '#333', marginBottom: 12 },
  dispatchCol: { flex: 1, paddingVertical: 4, paddingHorizontal: 7 },
  dispatchColDiv: { borderLeftWidth: 0.5, borderLeftColor: '#999' },
  r: { flexDirection: 'row', paddingVertical: 1.5 },
  rk: { width: 92, fontSize: 8, color: '#555' },
  rv: { fontSize: 8.5, flex: 1, fontWeight: 'bold' },
  totalRow: { flexDirection: 'row', borderWidth: 0.7, borderTopWidth: 0, borderColor: '#333', backgroundColor: '#eceff3', paddingVertical: 3 },
  stripe: { backgroundColor: '#fafafa' },
  notes: { marginTop: 16, fontSize: 9, fontWeight: 'bold', textAlign: 'center' },
  sign: { marginTop: 20, fontSize: 9, fontWeight: 'bold', textAlign: 'right' },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 55, fontSize: 9 }
})

function KV({ k, v }: { k: string; v?: string }) {
  return <View style={s.r}><Text style={s.rk}>{k}</Text><Text style={s.rv}>{v || '-'}</Text></View>
}

function Doc({ challan, customerName, vehicleNo, items }: any) {
  const total = (items || []).reduce((a: number, it: any) => a + (Number(it.qty) || 0), 0)
  const isCourier = challan.delivery_method === 'courier'
  return (
    <Document>
      <Page size="A4" style={pdfLayout.page}>
        <LetterheadSlim />

        {/* Bill-To (billing party) and Ship-To (delivery destination) on the
            left — the two can differ (bill HQ, ship to a branch) — with the
            bordered document box on the right. */}
        <View style={s.billRow}>
          <View style={s.parties}>
            <View style={s.partyBox}>
              <Text style={s.cap}>BILL TO</Text>
              <Text style={s.billName}>{customerName}</Text>
              {challan.bill_to_address ? <Text style={s.billSub}>{challan.bill_to_address}</Text> : null}
            </View>
            <View style={s.partyBox}>
              <Text style={s.cap}>SHIP TO</Text>
              <Text style={s.billSub}>{challan.ship_to_address || challan.bill_to_address || '-'}</Text>
              {challan.unloading_point ? <Text style={s.billSub}>Unloading Point: {challan.unloading_point}</Text> : null}
              <Text style={s.billSub}>Receiver: {challan.receiver_name || '-'}{challan.receiver_phone ? '  ·  ' + challan.receiver_phone : ''}</Text>
            </View>
          </View>
          <View style={{ width: '44%', alignItems: 'flex-end' }}>
            {/* Barcode sits at the top-right, above the box; it already prints
                the number beneath it, so the box no longer repeats Challan No. */}
            <View style={{ marginBottom: 6 }}>
              <Barcode value={challan.challan_no} width={155} height={28} />
            </View>
            <DocInfoBox title="Delivery Challan" width="100%" fields={[
              { label: 'Date', value: formatDate(challan.challan_date) },
              { label: 'PO No', value: challan.po_no },
              { label: 'Invoice No', value: challan.invoice_no },
              { label: 'Dispatch Time', value: challan.dispatch_time },
              { label: 'Delivery Mode', value: isCourier ? 'Courier' : 'Transport' }
            ]} />
          </View>
        </View>

        {/* Dispatch conditions, split into two labelled columns. */}
        <Text style={s.section}>DISPATCH DETAILS</Text>
        <View style={s.dispatch}>
          {isCourier ? (
            <>
              <View style={s.dispatchCol}>
                <KV k="Courier" v={challan.courier_name} />
                <KV k="Tracking / CN #" v={challan.courier_tracking_no} />
              </View>
              <View style={[s.dispatchCol, s.dispatchColDiv]}>
                <KV k="Prepared By" v={challan.prepared_by} />
              </View>
            </>
          ) : (
            <>
              <View style={s.dispatchCol}>
                <KV k="Vehicle No" v={vehicleNo} />
                <KV k="Driver" v={[challan.driver_name, challan.driver_phone].filter(Boolean).join(' | ')} />
                <KV k="Lock No" v={challan.lock_no} />
              </View>
              <View style={[s.dispatchCol, s.dispatchColDiv]}>
                <KV k="Transport Vendor" v={challan.transport_vendor} />
                <KV k="Prepared By" v={challan.prepared_by} />
              </View>
            </>
          )}
        </View>

        <Text style={s.section}>ITEMS DISPATCHED</Text>
        <View style={pdfLayout.tHead}>
          <Text style={[pdfLayout.th, { width: '5%' }]}>SL</Text>
          <Text style={[pdfLayout.th, { width: '41%' }]}>Description</Text>
          <Text style={[pdfLayout.th, { width: '14%' }]}>Material Code</Text>
          <Text style={[pdfLayout.th, { width: '13%' }]}>Category</Text>
          <Text style={[pdfLayout.th, { width: '7%', textAlign: 'right' }]}>Qty</Text>
          <Text style={[pdfLayout.th, { width: '7%' }]}>Unit</Text>
          <Text style={[pdfLayout.th, { width: '13%', borderRightWidth: 0 }]}>Remarks</Text>
        </View>
        {(items || []).map((it: any, i: number) => (
          <View key={it.sl} style={[pdfLayout.tr, i % 2 === 1 ? s.stripe : {}]}>
            <Text style={[pdfLayout.td, { width: '5%' }]}>{it.sl}</Text>
            <Text style={[pdfLayout.td, { width: '41%', fontSize: 7.5 }]}>{it.description}</Text>
            <Text style={[pdfLayout.td, { width: '14%' }]}>{it.material_code}</Text>
            <Text style={[pdfLayout.td, { width: '13%' }]}>{it.category}</Text>
            <Text style={[pdfLayout.td, { width: '7%', textAlign: 'right' }]}>{it.qty}</Text>
            <Text style={[pdfLayout.td, { width: '7%' }]}>{it.unit}</Text>
            <Text style={[pdfLayout.td, { width: '13%', borderRightWidth: 0 }]}>{it.remarks}</Text>
          </View>
        ))}
        <View style={s.totalRow}>
          <Text style={{ width: '73%', textAlign: 'right', paddingRight: 6, fontWeight: 'bold' }}>Total Qty =</Text>
          <Text style={{ width: '7%', textAlign: 'right', fontWeight: 'bold' }}>{total}</Text>
          <Text style={{ width: '20%' }}></Text>
        </View>

        <Text style={s.notes}>Notes: {challan.print_note || DEFAULT_CHALLAN_NOTE}</Text>
        <Text style={s.sign}>Receiver Sign with Seal &amp; Date..</Text>
        <View style={s.signRow}><Text>Security</Text><Text>Authorised By</Text></View>

        <PdfFooter />
      </Page>
    </Document>
  )
}

export async function downloadChallanPDF(opts: any) {
  const blob = await pdf(<Doc {...opts} />).toBlob()
  downloadBlob(blob, `Challan-${String(opts.challan.challan_no || 'DC').replace(/[^\w]+/g, '_')}.pdf`)
}
