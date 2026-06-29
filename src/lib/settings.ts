import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Per-client application settings. Persisted in public.app_settings as one row
// per (client_id, category) holding a JSON blob, plus document_templates for
// print/email templates. Every consumer (PDFs, the notification bell, the
// outbound workflow SLAs) reads its configuration through this module so the
// Settings screens are wired to real behaviour rather than being inert forms.
// ---------------------------------------------------------------------------

export type SettingsCategory = 'company' | 'notifications' | 'workflow' | 'barcode'

export interface CompanySettings {
  name: string
  address: string        // multi-line, printed as-is on documents
  phone: string
  email: string
  website: string
  bin: string            // BIN / TIN / tax identifier
  footer: string         // small print at the bottom of every PDF
  logoUrl: string        // overrides the default Whirlpool logo when set
  bankDetails: string
}

export interface NotificationSettings {
  pendingDocs: boolean   // "N pending GRNs / pick lists / …"
  overdueOrders: boolean // sales orders past their expected completion
  awaitingPick: boolean  // orders ready to pick & scan
  lowStock: boolean      // items at/below restock level
}

export interface WorkflowStageSetting { key: string; slaDays: number }
export interface WorkflowSettings { stages: WorkflowStageSetting[] }

export interface BarcodeSettings {
  symbology: 'CODE128' | 'CODE39' | 'EAN13' | 'QR'
  prefix: string
  labelWidthMm: number
  labelHeightMm: number
  showPrice: boolean
}

// --- Defaults (mirror what the app used before Settings existed) -----------

export const DEFAULT_COMPANY: CompanySettings = {
  name: 'WHIRLPOOL BANGLADESH LIMITED',
  address: 'Central Warehouse,\nChanpur, Madanpur, Narayangonj-1410, Dhaka',
  phone: '',
  email: '',
  website: '',
  bin: 'BIN: 012-0213-16511845',
  footer: 'Regd. Office: WHIRLPOOL BANGLADESH LIMITED - (Wakil Tower) 6th Floor 8th Floor; TA 131, Gulshan Badda Link Road; Dhaka-1212.',
  logoUrl: '',
  bankDetails: ''
}

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  pendingDocs: true, overdueOrders: true, awaitingPick: true, lowStock: true
}

// Mirrors OUTBOUND_STAGES in features/outbound/workflow.ts.
export const DEFAULT_WORKFLOW: WorkflowSettings = {
  stages: [
    { key: 'order', slaDays: 1 },
    { key: 'picked', slaDays: 1 },
    { key: 'invoiced', slaDays: 1 },
    { key: 'dispatched', slaDays: 2 },
    { key: 'delivered', slaDays: 0 }
  ]
}

export const DEFAULT_BARCODE: BarcodeSettings = {
  symbology: 'CODE128', prefix: '', labelWidthMm: 50, labelHeightMm: 25, showPrice: false
}

const DEFAULTS: Record<SettingsCategory, any> = {
  company: DEFAULT_COMPANY,
  notifications: DEFAULT_NOTIFICATIONS,
  workflow: DEFAULT_WORKFLOW,
  barcode: DEFAULT_BARCODE
}

// --- Generic load / save ---------------------------------------------------

// Load a settings category for a client, merged over its defaults so callers
// always receive a complete object even before anything has been saved.
export async function loadSettings<T = any>(clientId: string, category: SettingsCategory): Promise<T> {
  const { data } = await supabase
    .from('app_settings')
    .select('data')
    .eq('client_id', clientId)
    .eq('category', category)
    .maybeSingle()
  return { ...DEFAULTS[category], ...((data?.data as object) ?? {}) } as T
}

export async function saveSettings(clientId: string, category: SettingsCategory, data: any) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ client_id: clientId, category, data }, { onConflict: 'client_id,category' })
  if (error) throw error
}

// --- Company info cache for the imperative PDF generators -------------------
// PDFs are produced outside the React tree, so they read the active client's
// company profile from this module-level cache, primed whenever the client
// context changes (see AppShell) and refreshed when Company Settings are saved.

let companyCache: CompanySettings = DEFAULT_COMPANY
let companyCacheClient: string | null = null

export function getCompanyInfo(): CompanySettings {
  return companyCache
}

export async function primeCompanyInfo(clientId: string | null): Promise<CompanySettings> {
  if (!clientId) { companyCache = DEFAULT_COMPANY; companyCacheClient = null; return companyCache }
  const company = await loadSettings<CompanySettings>(clientId, 'company')
  companyCache = company
  companyCacheClient = clientId
  return company
}

export function setCompanyCache(clientId: string, company: CompanySettings) {
  companyCache = company
  companyCacheClient = clientId
}

export function companyCacheClientId() { return companyCacheClient }
