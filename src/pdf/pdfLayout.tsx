import { Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { getCompanyInfo } from '@/lib/settings'

// Shared building blocks for the app's "plain minimal document" PDF style —
// logo + title top row, company block, thin grey rules, a light-grey table
// header. Used by DeliveryChallanPDF.tsx and FinancePDF.tsx so a
// letterhead/table tweak (logo size, rule color, footer text) only has to
// be made once instead of drifting between near-identical copies.
export const pdfLayout = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica', color: '#212326' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: 'bold' },
  titleSub: { fontSize: 9, marginTop: 2 },
  company: { marginTop: 14, marginBottom: 8 },
  companyName: { fontWeight: 'bold', fontSize: 9 },
  sub: { fontSize: 8, color: '#3a3a3a' },
  hr: { borderBottomWidth: 1, borderBottomColor: '#bbb', marginVertical: 6 },
  tHead: { flexDirection: 'row', alignItems: 'center', borderWidth: 0.7, borderColor: '#333', backgroundColor: '#f2f2f0' },
  th: { fontSize: 8, fontWeight: 'bold', padding: 3, borderRightWidth: 0.5, borderRightColor: '#999' },
  tr: { flexDirection: 'row', alignItems: 'center', borderWidth: 0.7, borderTopWidth: 0, borderColor: '#333' },
  td: { fontSize: 8, padding: 3, borderRightWidth: 0.5, borderRightColor: '#ccc' },
  footer: { position: 'absolute', bottom: 18, left: 28, right: 28, fontSize: 7, color: '#777', textAlign: 'center' }
})

export function PdfHeader({ title, docNo }: { title: string; docNo?: string }) {
  const company = getCompanyInfo()
  const companyLines = (company.address || '').split('\n').filter(Boolean)
  return (
    <>
      <View style={pdfLayout.topRow}>
        <Image src={company.logoUrl || '/whirlpool-logo.png'} style={{ width: 118, height: 39 }} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={pdfLayout.title}>{title.toUpperCase()}</Text>
          {docNo && <Text style={pdfLayout.titleSub}>{docNo}</Text>}
        </View>
      </View>
      <View style={pdfLayout.company}>
        <Text style={pdfLayout.companyName}>{company.name}</Text>
        {companyLines.map((l, i) => <Text key={i} style={pdfLayout.sub}>{l}</Text>)}
      </View>
      <View style={pdfLayout.hr} />
    </>
  )
}

// Static company footer text by default; pass `render` for a page-numbered variant.
export function PdfFooter({ render }: { render?: (info: { pageNumber: number; totalPages: number }) => string }) {
  const company = getCompanyInfo()
  if (render) return <Text style={pdfLayout.footer} render={render} fixed />
  return <Text style={pdfLayout.footer} fixed>{company.footer}</Text>
}

// --- "Software-generated invoice" header pieces (SAP/ERP style) -------------
// A slim sender line on the left + logo on the right, and a bordered
// document-info box (title bar over a labelled key/value grid) that sits on
// the right beside the recipient's Bill-To block — the layout that reads as
// machine-produced rather than a hand-made voucher.
const dib = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  headLeft: { width: '62%' },
  headName: { fontSize: 13, fontWeight: 'bold' },
  headAddr: { fontSize: 8.5, color: '#3a3a3a', marginTop: 1 },
  headContact: { fontSize: 8, color: '#555', marginTop: 2 },
  box: { borderWidth: 0.8, borderColor: '#333' },
  boxTitleBar: { paddingVertical: 5, paddingHorizontal: 7, borderBottomWidth: 0.8, borderBottomColor: '#333', backgroundColor: '#f2f2f0' },
  boxTitle: { fontSize: 12, fontWeight: 'bold' },
  boxSub: { fontSize: 7.5, color: '#555', marginTop: 1 },
  boxBody: { paddingVertical: 3 },
  row: { flexDirection: 'row', paddingHorizontal: 7, paddingVertical: 1.8 },
  k: { width: '46%', fontSize: 8, color: '#555' },
  v: { flex: 1, fontSize: 8.5, fontWeight: 'bold', textAlign: 'right' }
})

export interface DocField { label: string; value?: string }

// Full letterhead: company name + address block on the left, logo on the
// right. Name and each address line print on their own line (not crammed
// onto one), and the logo comes from Settings → Company (falling back to the
// bundled Whirlpool mark).
export function LetterheadSlim() {
  const company = getCompanyInfo()
  const addrLines = (company.address || '').split('\n').map(l => l.trim()).filter(Boolean)
  const contact = [company.phone, company.email, company.website].filter(Boolean).join('   ·   ')
  return (
    <>
      <View style={dib.head}>
        <View style={dib.headLeft}>
          <Text style={dib.headName}>{company.name}</Text>
          {addrLines.map((l, i) => <Text key={i} style={dib.headAddr}>{l}</Text>)}
          {contact ? <Text style={dib.headContact}>{contact}</Text> : null}
        </View>
        <Image src={company.logoUrl || '/whirlpool-logo.png'} style={{ width: 118, height: 39 }} />
      </View>
      <View style={pdfLayout.hr} />
    </>
  )
}

// Bordered document-info box: a title bar over a right-aligned key/value grid.
export function DocInfoBox({ title, subtitle, fields, width = '44%' }: { title: string; subtitle?: string; fields: DocField[]; width?: string }) {
  return (
    <View style={[dib.box, { width }]}>
      <View style={dib.boxTitleBar}>
        <Text style={dib.boxTitle}>{title}</Text>
        {subtitle ? <Text style={dib.boxSub}>{subtitle}</Text> : null}
      </View>
      <View style={dib.boxBody}>
        {fields.map((f, i) => (
          <View key={i} style={dib.row}>
            <Text style={dib.k}>{f.label}</Text>
            <Text style={dib.v}>{f.value || '-'}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
