// Serial numbers are keyed by the product's Material Code prefix (e.g. 25001…).
// Units often arrive labelled with a factory prefix instead — the China Code
// (shared manufacturing code) or the barcode value from the product master.
// When a scanned serial starts with one of those, swap the prefix for the
// Material Code so every product keeps a single serial scheme.
export interface ProductCodes { material_code?: string | null; china_code?: string | null; barcode?: string | null }

export function normaliseSerial(raw: string, p: ProductCodes): { serial: string; original?: string } {
  const s = raw.trim()
  const up = (x: string) => x.trim().toUpperCase()
  const code = String(p.material_code ?? '').trim()
  if (!s || !code || up(s).startsWith(up(code))) return { serial: s }
  for (const alt of [p.china_code, p.barcode]) {
    const a = String(alt ?? '').trim()
    if (a && up(s).startsWith(up(a))) return { serial: code + s.slice(a.length), original: s }
  }
  return { serial: s }
}
