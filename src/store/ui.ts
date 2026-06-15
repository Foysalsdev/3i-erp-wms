import { create } from 'zustand'

export interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string }
type Theme = 'light' | 'dark'

const THEME_KEY = '3i_theme'
function initialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY) as Theme | null
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
}

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  theme: Theme
  toggleTheme: () => void
  toasts: Toast[]
  notify: (type: Toast['type'], message: string) => void
  dismiss: (id: number) => void
}

let seq = 1
const startTheme = initialTheme()
applyTheme(startTheme)

export const useUI = create<UIState>((set, get) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  theme: startTheme,
  toggleTheme: () => set(s => {
    const next: Theme = s.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(THEME_KEY, next); applyTheme(next)
    return { theme: next }
  }),
  toasts: [],
  notify: (type, message) => {
    const id = seq++
    set(s => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => get().dismiss(id), 4000)
  },
  dismiss: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
}))
