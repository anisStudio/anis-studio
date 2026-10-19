import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageSEO } from '../components/PageSEO'
import {
  ADMIN_FORGOT_PASSWORD_PATH,
  ADMIN_PASSWORD_MIN_LENGTH,
  ADMIN_PASSWORD_RECOVERY_PATH,
  classifyRecoveryLinkError,
  messageForPasswordValidation,
  messageForRecoveryLinkError,
  parseAuthCallbackParams,
  validateNewPasswordPair,
} from '../lib/adminPassword'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useAdminAuth } from '../providers/AdminAuthProvider'

type PagePhase = 'loading' | 'ready' | 'link_error' | 'success' | 'unavailable'

export default function AdminResetPasswordPage() {
  const { completePasswordRecovery, passwordRecoveryActive } = useAdminAuth()
  const [phase, setPhase] = useState<PagePhase>('loading')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setPhase('unavailable')
      return
    }

    const params = parseAuthCallbackParams(window.location.href)
    const linkKind = classifyRecoveryLinkError(params)
    if (linkKind) {
      setLinkError(messageForRecoveryLinkError(linkKind))
      setPhase('link_error')
      window.history.replaceState({}, document.title, ADMIN_PASSWORD_RECOVERY_PATH)
      return
    }

    const allowSessionFallback =
      params.type === 'recovery' || params.hasAuthCode || params.hasAccessToken

    let cancelled = false
    let settled = false

    const markReady = () => {
      if (cancelled || settled) return
      settled = true
      setPhase('ready')
      window.history.replaceState({}, document.title, ADMIN_PASSWORD_RECOVERY_PATH)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY') {
        markReady()
      }
    })

    if (passwordRecoveryActive) {
      markReady()
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled || settled) return
      if (data.session && (passwordRecoveryActive || allowSessionFallback)) {
        markReady()
        return
      }

      window.setTimeout(() => {
        if (cancelled || settled) return
        void supabase!.auth.getSession().then(({ data: again }) => {
          if (cancelled || settled) return
          if (again.session && (passwordRecoveryActive || allowSessionFallback)) {
            markReady()
            return
          }
          setLinkError(messageForRecoveryLinkError('other'))
          setPhase('link_error')
        })
      }, 1500)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [passwordRecoveryActive])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setFormError(null)
    const validation = validateNewPasswordPair({
      newPassword,
      confirmPassword,
    })
    if (validation) {
      setFormError(messageForPasswordValidation(validation))
      return
    }

    setIsSubmitting(true)
    const result = await completePasswordRecovery(newPassword)
    setIsSubmitting(false)

    if (!result.success) {
      setFormError(result.error ?? 'Promjena lozinke nije uspjela.')
      return
    }

    setNewPassword('')
    setConfirmPassword('')
    setPhase('success')
  }

  return (
    <div className="admin-scope min-h-screen bg-slate-50 px-4 py-8">
      <PageSEO title="Nova lozinka — Admin" description="" noIndex />
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 border-b pb-4">
          <h1 className="text-2xl font-semibold text-slate-900">
            Postavljanje nove lozinke
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Administratorski reset lozinke putem e-mail poveznice.
          </p>
        </header>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          {phase === 'loading' ? (
            <p className="text-sm text-slate-600">Provjera poveznice za reset…</p>
          ) : null}

          {phase === 'unavailable' ? (
            <p className="text-sm text-red-800">
              Autentifikacijska usluga nije konfigurirana u ovom okruženju.
            </p>
          ) : null}

          {phase === 'link_error' ? (
            <div className="space-y-4">
              <div
                role="alert"
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
              >
                <p className="text-sm font-semibold text-amber-950">
                  {linkError ?? messageForRecoveryLinkError('other')}
                </p>
              </div>
              <Link
                to={ADMIN_FORGOT_PASSWORD_PATH}
                className="inline-flex text-sm font-semibold text-violet-700 underline underline-offset-2"
              >
                Pošalji novi zahtjev za reset
              </Link>
              <p className="text-sm text-slate-600">
                <Link
                  to="/admin/login"
                  className="font-semibold text-violet-700 underline underline-offset-2"
                >
                  Natrag na prijavu
                </Link>
              </p>
            </div>
          ) : null}

          {phase === 'success' ? (
            <div className="space-y-4">
              <div
                role="status"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3"
              >
                <p className="text-sm font-semibold text-emerald-950">
                  Lozinka je uspješno promijenjena. Prijavite se novom lozinkom.
                </p>
              </div>
              <Link
                to="/admin/login"
                className="inline-flex text-sm font-semibold text-violet-700 underline underline-offset-2"
              >
                Idi na prijavu
              </Link>
            </div>
          ) : null}

          {phase === 'ready' ? (
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div>
                <label
                  htmlFor="admin-recovery-new-password"
                  className="mb-2 block text-sm font-medium text-slate-900"
                >
                  Nova lozinka
                </label>
                <input
                  id="admin-recovery-new-password"
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
                  htmlFor="admin-recovery-confirm-password"
                  className="mb-2 block text-sm font-medium text-slate-900"
                >
                  Potvrda nove lozinke
                </label>
                <input
                  id="admin-recovery-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  minLength={ADMIN_PASSWORD_MIN_LENGTH}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {formError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-red-950">{formError}</p>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Spremam…' : 'Spremi novu lozinku'}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  )
}
