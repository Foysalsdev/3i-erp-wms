// Heavy half of the report exporter: everything that touches
// @react-pdf/renderer lives here so the pdf chunk is only fetched when the
// user actually clicks PDF (export.tsx dynamic-imports this module).
import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import { getCompanyInfo } from '@/lib/settings'
import { downloadBlob } from '@/lib/utils'
import type { RepCol, RepRow } from './export'

const s = StyleSheet.create({
  page: { padding: 26, fontSize: 8, fontFamily: 'Helvetica', color: '#212326' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title: { fontSize: 14, fontWeight: 'bold' },
  sub: { fontSize: 8, color: '#556b82', marginTop: 2 },
  hr: { borderBottomWidth: 1, borderBottomColor: '#bbb', marginVertical: 6 },
  tHead: { flexDirection: 'row', alignItems: 'center', borderWidth: 0.7, borderColor: '#333', backgroundColor: '#f2f2f0' },
  th: { fontSize: 7.5, fontWeight: 'bold', padding: 3, borderRightWidth: 0.5, borderRightColor: '#999' },
  tr: { flexDirection: 'row', alignItems: 'center', borderWidth: 0.7, borderTopWidth: 0, borderColor: '#333' },
  td: { fontSize: 7.5, padding: 3, borderRightWidth: 0.5, borderRightColor: '#ccc' },
  footer: { position: 'absolute', bottom: 16, left: 26, right: 26, fontSize: 7, color: '#888', textAlign: 'center' }
})

function ReportDoc({ title, subtitle, cols, rows }: { title: string; subtitle?: string; cols: RepCol[]; rows: RepRow[] }) {
  const w = (c: RepCol) => c.width ?? `${(100 / cols.length).toFixed(2)}%`
  const company = getCompanyInfo()
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.top}>
          <View>
            <Image src={company.logoUrl || '/whirlpool-logo.png'} style={{ width: 110, height: 36 }} />
            <Text style={s.sub}>{company.name}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.title}>{title}</Text>
            {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
            <Text style={s.sub}>Generated {new Date().toLocaleString('en-GB')}</Text>
          </View>
        </View>
        <View style={s.tHead} fixed>
          {cols.map(c => <Text key={c.key} style={[s.th, { width: w(c), textAlign: c.align ?? 'left' }]}>{c.header}</Text>)}
        </View>
        {rows.map((r, i) => (
          <View key={i} style={s.tr} wrap={false}>
            {cols.map(c => <Text key={c.key} style={[s.td, { width: w(c), textAlign: c.align ?? 'left' }]}>{String(r[c.key] ?? '')}</Text>)}
          </View>
        ))}
        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${title} · page ${pageNumber}/${totalPages}`} />
      </Page>
    </Document>
  )
}

export async function downloadReportPDF(title: string, subtitle: string, cols: RepCol[], rows: RepRow[]) {
  const blob = await pdf(<ReportDoc title={title} subtitle={subtitle} cols={cols} rows={rows} />).toBlob()
  downloadBlob(blob, `${title.replace(/[^\w]+/g, '_')}.pdf`)
}
