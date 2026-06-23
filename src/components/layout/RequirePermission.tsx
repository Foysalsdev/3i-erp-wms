import { useAuth } from '@/store/auth'
import { EmptyState } from '@/components/ui/States'
export function RequirePermission({ perm, children }: { perm?: string; children: React.ReactNode }) {
  const can = useAuth(s => s.can)
  if (perm && !can(perm)) return <EmptyState icon="lock" title="Access restricted" hint="You do not have permission to view this module." />
  return <>{children}</>
}
