import { supabase } from '@/lib/supabase'
// Calls the atomic server-side client-wise document numbering function.
export async function nextDocNumber(clientId: string, docType: string): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc('next_document_number', {
    p_client: clientId, p_doc_type: docType
  })
  if (error) { console.error(error); return null }
  return data as string
}
