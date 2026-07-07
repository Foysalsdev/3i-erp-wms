import { supabase } from '@/lib/supabase'
// Calls the atomic server-side client-wise document numbering function.
export async function nextDocNumber(clientId: string, docType: string): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc('next_document_number', {
    p_client: clientId, p_doc_type: docType
  })
  if (error) { console.error(error); return null }
  return data as string
}

// Composite delivery-challan number: last 5 digits of the invoice + this
// challan's ordinal within that invoice (2-digit) + the client's running
// all-time challan serial (5-digit), e.g. "055050100147". Invoice is required.
export async function nextChallanNumber(clientId: string, invoiceNo: string): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc('next_challan_number', {
    p_client: clientId, p_invoice: invoiceNo
  })
  if (error) { console.error(error); return null }
  return data as string
}
