import { Text, View, StyleSheet, Image, Svg, Rect } from '@react-pdf/renderer'
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

// --- Code 39 barcode --------------------------------------------------------
// Dependency-free barcode drawn as react-pdf <Rect>s. Code 39 is chosen over
// Code 128 because it needs no checksum and directly encodes the uppercase
// letters, digits and hyphen that document numbers use (e.g. DC-0707260025) —
// simple enough to implement inline yet scannable by any 1D reader.
const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw', 'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw',
  'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn', 'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn',
  'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn', 'K': 'wnnnnnnww', 'L': 'nnwnnnnww',
  'M': 'wnwnnnnwn', 'N': 'nnnnwnnww', 'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn',
  'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn', 'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn',
  'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw', 'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw',
  'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
  '$': 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn'
}

function code39Rects(raw: string) {
  const clean = (raw || '').toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '')
  const text = `*${clean}*` // Code 39 frames the data with a start/stop '*'
  const NARROW = 1, WIDE = 3, GAP = 1
  const rects: { x: number; w: number }[] = []
  let x = 0
  for (const ch of text) {
    const pat = CODE39[ch]
    if (!pat) continue
    for (let i = 0; i < 9; i++) {
      const w = pat[i] === 'w' ? WIDE : NARROW
      if (i % 2 === 0) rects.push({ x, w }) // even element = bar, odd = space
      x += w
    }
    x += GAP // narrow inter-character gap
  }
  return { rects, total: x }
}

// --- Code 128 (subset C) ----------------------------------------------------
// For all-numeric values (the new challan number is 12 digits), Code 128-C
// encodes two digits per symbol, so the bars are far finer and the symbol far
// shorter than Code 39 — the dense, professional look of a retail barcode.
// Falls back to Code 39 for anything non-numeric or odd-length.
const CODE128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232'
]
const CODE128_STOP = '2331112'

function code128CRects(raw: string) {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 0 || digits.length % 2 !== 0) return null // subset C needs digit pairs
  const codes = [105] // Start C
  for (let i = 0; i < digits.length; i += 2) codes.push(parseInt(digits.slice(i, i + 2), 10))
  let sum = codes[0]
  for (let i = 1; i < codes.length; i++) sum += codes[i] * i
  codes.push(sum % 103) // checksum
  const rects: { x: number; w: number }[] = []
  let x = 0
  const draw = (pat: string) => {
    for (let i = 0; i < pat.length; i++) {
      const w = parseInt(pat[i], 10)
      if (i % 2 === 0) rects.push({ x, w }) // even element = bar
      x += w
    }
  }
  for (const c of codes) draw(CODE128[c])
  draw(CODE128_STOP)
  return { rects, total: x }
}

export function Barcode({ value, width = 150, height = 32, showText = true }:
  { value?: string; width?: number; height?: number; showText?: boolean }) {
  const encoded = code128CRects(value || '') ?? code39Rects(value || '')
  const { rects, total } = encoded
  if (!rects.length || total === 0) return null
  const barH = showText ? height - 9 : height
  return (
    <View style={{ width, alignItems: 'center' }}>
      <Svg width={width} height={barH} viewBox={`0 0 ${total} 100`} preserveAspectRatio="none">
        {rects.map((r, i) => <Rect key={i} x={r.x} y={0} width={r.w} height={100} fill="#000" />)}
      </Svg>
      {showText ? <Text style={{ fontSize: 7, marginTop: 2, letterSpacing: 1 }}>{value}</Text> : null}
    </View>
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
