import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Modal } from './Modal'
import { Button } from './Button'
import { Field, Input } from './Field'

// Destructive-delete confirmation that requires the admin to re-enter their
// password. The password is verified against Supabase Auth before onConfirm runs.
// When onUndo is given, the success toast offers a few seconds to reverse it
// (re-inserting the deleted row(s)) instead of the delete being final.
export function ConfirmDelete({ open, onClose, name, onConfirm, onUndo }: {
  open: boolean
  onClose: () => void
  name?: string
  onConfirm: () => Promise<{ error?: any } | void>
  onUndo?: () => Promise<void> | void
}) {
  const email = useAuth(s => s.session?.user.email)
  const notify = useUI(s => s.notify)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)

  const close = () => { setPw(''); onClose() }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw) { notify('error', 'Enter your password to confirm.'); return }
    if (!email) { notify('error', 'No active session.'); return }
    setBusy(true)
    try {
      // Verify the admin's identity by re-authenticating with the entered password.
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: pw })
      if (authErr) { notify('error', 'Incorrect password. Delete cancelled.'); return }

      const res = await onConfirm()
      if (res && res.error) {
        const err: any = res.error
        // Postgres 23503 = foreign-key violation: the row is still referenced by
        // linked documents (e.g. a challan's gate pass / POD, or an SO's challan).
        // Show a plain-language reason instead of the raw constraint message.
        const msg = err.code === '23503'
          ? `Cannot delete ${name ?? 'this record'} — it still has linked documents that depend on it. Cancel or remove those first, then try again.`
          : (err.message ?? String(err))
        notify('error', msg); return
      }

      notify('success', name ? `${name} deleted` : 'Deleted', onUndo
        ? { action: { label: 'Undo', onClick: onUndo }, duration: 6000 }
        : undefined)
      close()
    } catch (err: any) {
      notify('error', err?.message ?? 'Could not delete. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title="Confirm delete">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-soft">
          You are about to delete {name ? <b className="text-ink">{name}</b> : 'this record'}.{' '}
          {onUndo ? "You'll get a short window to undo it right after." : 'This action cannot be undone.'}
        </p>
        <Field label="Re-enter your admin password to confirm">
          <Input type="password" value={pw} autoFocus autoComplete="current-password"
            onChange={e => setPw(e.target.value)} placeholder="Admin password" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          <Button type="submit" variant="danger" icon="delete" loading={busy}>Delete</Button>
        </div>
      </form>
    </Modal>
  )
}
