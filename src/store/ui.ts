import { create } from 'zustand'

export interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string }
export type ThemeMode = 'light' | 'dark' | 'system'
type Theme = 'light' | 'dark'

const THEME_KEY = '3i_theme'
const media = window.matchMedia?.('(prefers-color-scheme: dark)')

function resolveTheme(mode: ThemeMode): Theme {
  return mode === 'system' ? (media?.matches ? 'dark' : 'light') : mode
}
function initialMode(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY)
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
}
function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
}

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  themeMode: ThemeMode
  theme: Theme
  setThemeMode: (mode: ThemeMode) => void
  toasts: Toast[]
  notify: (type: Toast['type'], message: string) => void
  dismiss: (id: number) => void
}

let seq = 1
const startMode = initialMode()
const startTheme = resolveTheme(startMode)
applyTheme(startTheme)

export const useUI = create<UIState>((set, get) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  themeMode: startMode,
  theme: startTheme,
  setThemeMode: (mode) => set(() => {
    localStorage.setItem(THEME_KEY, mode)
    const resolved = resolveTheme(mode)
    applyTheme(resolved)
    return { themeMode: mode, theme: resolved }
  }),
  toasts: [],
  notify: (type, message) => {
    const id = seq++
    set(s => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => get().dismiss(id), 4000)
  },
  dismiss: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
}))

// Live-follow the OS theme while the user has picked "system".
media?.addEventListener('change', (e) => {
  if (useUI.getState().themeMode !== 'system') return
  const resolved: Theme = e.matches ? 'dark' : 'light'
  applyTheme(resolved)
  useUI.setState({ theme: resolved })
})
