import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageSEO } from '../components/PageSEO'
import { PASSWORD_RESET_REQUEST_GENERIC_SUCCESS } from '../lib/adminPassword'
import { useAdminAuth } from '../providers/AdminAuthProvider'

export default function AdminForgotPasswordPage() {
  const { requestPasswordReset } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setError(null)
    setIsSubmitting(true)
    const result = await requestPasswordReset(email)
    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error ?? 'Zahtjev nije uspio. Pokušajte ponovo.')
      return
    }

    setDone(true)
  }

  return (
    <div className="admin-scope min-h-screen bg-slate-50 px-4 py-8">
      <PageSEO title="Zaboravljena lozinka — Admin" description="" noIndex />
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 border-b pb-4">
          <h1 className="text-2xl font-semibold text-slate-900">
            Zaboravljena lozinka
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pošaljemo poveznicu za reset administratorske lozinke na e-poštu računa.
          </p>
        </header>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          {done ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-slate-700">
                {PASSWORD_RESET_REQUEST_GENERIC_SUCCESS}
              </p>
              <Link
                to="/admin/login"
                className="inline-flex text-sm font-semibold text-violet-700 underline underline-offset-2"
              >
                Natrag na prijavu
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-forgot-email"
                  className="mb-2 block text-sm font-medium text-slate-900"
                >
                  E-pošta administratorskog računa
                </label>
                <input
                  id="admin-forgot-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
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

              <button
                type="submit"
                disabled={isSubmitting || email.trim().length === 0}
                className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Šaljem…' : 'Pošalji poveznicu za reset'}
              </button>

              <p className="text-center text-sm text-slate-600">
                <Link
                  to="/admin/login"
                  className="font-semibold text-violet-700 underline underline-offset-2"
                >
                  Natrag na prijavu
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
