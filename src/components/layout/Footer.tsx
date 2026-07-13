// Quiet, theme-aware footer — a single hairline-separated strip on the app
// canvas instead of the old heavy dark bar. Small, calm, out of the way.
export function Footer() {
  return (
    <footer className="flex h-9 shrink-0 items-center justify-between border-t border-surface-line bg-surface px-4 sm:px-6 text-[11px] text-ink-soft">
      <span>© {new Date().getFullYear()} Whirlpool Bangladesh · ERP · WMS</span>
      <span className="flex items-center gap-1.5 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        <span>All systems operational · v1.0</span>
      </span>
    </footer>
  )
}
