export function Footer() {
  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t-2 border-brand-500 bg-coal-900 px-4 text-[11px] text-white/70">
      <span>© {new Date().getFullYear()} Whirlpool Bangladesh · ERP · WMS</span>
      <span className="font-semibold text-brand-400">v1.0</span>
    </footer>
  )
}
