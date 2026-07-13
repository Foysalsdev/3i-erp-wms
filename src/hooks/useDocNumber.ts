import { supabase } from '@/lib/supabase'
// Calls the atomic server-side client-wise document numbering function.
export async function nextDocNumber(clientId: string, docType: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('next_document_number', {
     p_doc_type: docType
  })
  if (error) { console.error(error); return null }
  return data
}

// Finance-only monthly-reset numbering (EXP-YYYYMM-00001, IV-YYYYMM-00001,
// HOS-YYYYMM-00001) — a separate sequence from the daily-reset one above.
export async function nextFinanceDocNumber(clientId: string, prefix: 'EXP' | 'IV' | 'HOS'): Promise<string | null> {
  const { data, error } = await supabase.rpc('next_finance_document_number', {
     p_prefix: prefix
  })
  if (error) { console.error(error); return null }
  return data
}

// Composite delivery-challan number: last 5 digits of the invoice + this
// challan's ordinal within that invoice (2-digit) + the client's running
// all-time challan serial (5-digit), e.g. "055050100147". Invoice is required.
export async function nextChallanNumber(clientId: string, invoiceNo: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('next_challan_number', {
     p_invoice: invoiceNo
  })
  if (error) { console.error(error); return null }
  return data
}
