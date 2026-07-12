import ExcelJS from 'exceljs'
import { downloadBlob } from '@/lib/utils'

export interface PreworkLine { sl: number; code: string; name: string; qty: number; basic: number; vat: number; total: number }
export interface PreworkSerial { model: string; serial: string }

export interface PreworkInput {
  soNo: string
  poNo: string
  customerName: string
  sapCustomerCode: string
  invoiceAmount: number
  sapSoNo: string
  outboundDeliveryNo: string
  transferOrderNo: string
  billingDocNo: string
  lines: PreworkLine[]
  serials: PreworkSerial[]
}

// Builds the SAP "pre-work" workbook the team currently maintains by hand:
//  • Summary sheet — header (customer, PO, payment), the priced line items, and
//    the SAP reference numbers entered back after invoicing.
//  • Serial sheet  — every scanned unit (SL / Model / Serial).
// The output mirrors the existing Excel so it can be used the same way.
export async function downloadPrework(input: PreworkInput) {
  const wb = new ExcelJS.Workbook()
  wb.creator = '3i ERP/WMS'
  wb.created = new Date()

  // ---- Summary sheet ----
  const sum = wb.addWorksheet('Summary')
  sum.columns = [{ width: 22 }, { width: 38 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 16 }]
  const kv = (label: string, value: string | number, extra?: string | number) => {
    const row = sum.addRow([label, value, extra ?? ''])
    row.getCell(1).font = { bold: true }
  }
  kv('Customer Name', input.customerName, input.sapCustomerCode)
  kv('Order Ref', input.poNo)
  kv('Invoice Amount', input.invoiceAmount)
  sum.addRow([])

  const head = sum.addRow(['SL no.', 'Product Code', 'Qty', 'SKU Description', 'Basic Price/ Unit', 'VAT %', 'Total Billing Amount'])
  head.font = { bold: true }
  head.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } } })
  for (const l of input.lines) {
    sum.addRow([l.sl, l.code, l.qty, l.name, round2(l.basic), l.vat, round2(l.total)])
  }
  const totalQty = input.lines.reduce((s, l) => s + l.qty, 0)
  const totalAmt = input.lines.reduce((s, l) => s + l.total, 0)
  const totalRow = sum.addRow(['Total', '', totalQty, '', '', '', round2(totalAmt)])
  totalRow.font = { bold: true }
  sum.addRow([])
  kv('Sales Order', input.sapSoNo)
  kv('Outbound Delivery', input.outboundDeliveryNo)
  kv('Transfer Order No', input.transferOrderNo)
  kv('Billing Document No', input.billingDocNo)

  // ---- Serial sheet ----
  const ser = wb.addWorksheet('Serial')
  ser.columns = [{ width: 8 }, { width: 16 }, { width: 26 }]
  const title = ser.addRow([`${input.soNo} — ${input.customerName}`])
  title.font = { bold: true }
  ser.mergeCells(1, 1, 1, 3)
  const sh = ser.addRow(['SL.', 'Model', 'Serial'])
  sh.font = { bold: true }
  sh.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } } })
  input.serials.forEach((s, i) => ser.addRow([i + 1, s.model, s.serial]))

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, `${safe(input.soNo)}_prework.xlsx`)
}

const round2 = (n: number) => Math.round(n * 100) / 100
const safe = (s: string) => (s || 'order').replace(/[^A-Za-z0-9._-]+/g, '_')
