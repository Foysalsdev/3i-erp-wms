// Named filter presets ("My open orders", "Overdue only"…), kept per browser
// like the theme/density preferences. Scoped by a caller-chosen key so each
// list (Sales Orders, each Operations doc type, …) has its own set.
export interface SavedView<S> { id: string; name: string; state: S }

const keyFor = (scope: string) => `3i_views_${scope}`

export function loadViews<S>(scope: string): SavedView<S>[] {
  try {
    const raw = localStorage.getItem(keyFor(scope))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveView<S>(scope: string, name: string, state: S): SavedView<S>[] {
  const next = [...loadViews<S>(scope), { id: crypto.randomUUID(), name, state }]
  localStorage.setItem(keyFor(scope), JSON.stringify(next))
  return next
}

export function removeView<S>(scope: string, id: string): SavedView<S>[] {
  const next = loadViews<S>(scope).filter(v => v.id !== id)
  localStorage.setItem(keyFor(scope), JSON.stringify(next))
  return next
}
