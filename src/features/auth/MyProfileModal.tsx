import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { useUI } from '@/store/ui'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { ImageUpload } from '@/features/masters/components/ImageUpload'

// Self-service profile: the logged-in user's own name/avatar/phone and password.
// Distinct from HR > User Management, which is an admin editing OTHER users.
export function MyProfileModal({ onClose }: { onClose: () => void }) {
  const { profile, loadContext } = useAuth()
  const notify = useUI(s => s.notify)
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (newPassword && newPassword !== confirmPassword) { notify('error', 'New password and confirmation do not match'); return }
    if (newPassword && newPassword.length < 6) { notify('error', 'Password must be at least 6 characters'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: fullName || null, phone: phone || null, avatar_url: avatarUrl || null
      }).eq('id', profile!.id)
      if (error) throw error
      if (newPassword) {
        const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword })
        if (pwErr) throw pwErr
      }
      await loadContext()
      notify('success', 'Profile updated')
      onClose()
    } catch (e: any) {
      notify('error', e?.message ?? 'Could not update profile')
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title="My Profile" size="md">
      <div className="space-y-5">
        <ImageUpload label="Photo" value={avatarUrl} onChange={setAvatarUrl} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full Name"><Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Karim Uddin" /></Field>
          <Field label="Phone"><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 01700000000" /></Field>
          <Field label="Email" className="sm:col-span-2"><Input value={profile?.email ?? ''} disabled /></Field>
        </div>

        <div className="border-t border-surface-line pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Change Password (optional)</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="New Password"><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" /></Field>
            <Field label="Confirm Password"><Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-type new password" /></Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-surface-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon="save" loading={saving} onClick={save}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}
