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
