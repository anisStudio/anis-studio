import { useState } from 'react'
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  messageForPasswordValidation,
  validateNewPasswordPair,
} from '../lib/adminPassword'
import { useAdminAuth } from '../providers/AdminAuthProvider'

/**
 * Logged-in admin password change (re-auth with current password first).
 */
export function AdminPasswordChangeForm() {
  const { changePassword, user } = useAdminAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setError(null)
    setSuccess(null)

    if (!currentPassword) {
      setError(messageForPasswordValidation('current_required'))
      return
    }

    const validation = validateNewPasswordPair({
      newPassword,
      confirmPassword,
      currentPassword,
    })
    if (validation) {
      setError(messageForPasswordValidation(validation))
      return
    }

    setIsSubmitting(true)
    const result = await changePassword(currentPassword, newPassword)
    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error ?? 'Promjena lozinke nije uspjela.')
      return
    }

    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSuccess('Lozinka je uspješno promijenjena.')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <p className="text-sm text-slate-600">
        Prijavljeni račun:{' '}
        <span className="font-medium text-slate-800">
          {user?.email ?? '—'}
        </span>
      </p>

      <div>
        <label
          htmlFor="admin-current-password"
          className="mb-2 block text-sm font-medium text-slate-900"
        >
          Trenutačna lozinka
        </label>
        <input
          id="admin-current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          disabled={isSubmitting}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div>
        <label
          htmlFor="admin-new-password"
          className="mb-2 block text-sm font-medium text-slate-900"
        >
          Nova lozinka
        </label>
        <input
          id="admin-new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={isSubmitting}
          minLength={ADMIN_PASSWORD_MIN_LENGTH}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <p className="mt-1 text-xs text-slate-500">
          Najmanje {ADMIN_PASSWORD_MIN_LENGTH} znakova.
        </p>
      </div>

      <div>
        <label
          htmlFor="admin-confirm-password"
          className="mb-2 block text-sm font-medium text-slate-900"
        >
          Potvrda nove lozinke
        </label>
        <input
          id="admin-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isSubmitting}
          minLength={ADMIN_PASSWORD_MIN_LENGTH}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3"
        >
          <p className="text-sm font-semibold text-red-950">{error}</p>
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3"
        >
          <p className="text-sm font-semibold text-emerald-950">{success}</p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? 'Spremam…' : 'Promijeni lozinku'}
      </button>
    </form>
  )
}
