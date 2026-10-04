import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAdminAuth } from '../providers/AdminAuthProvider'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { login, isAdmin, loading, user } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (loading || !isAdmin) return

    const from = location.state?.from?.pathname
    navigate(from || '/admin/settings', { replace: true })
  }, [isAdmin, loading, navigate, location.state])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await login(email, password)

    if (result.success) {
      const from = location.state?.from?.pathname
      navigate(from || '/admin/settings', { replace: true })
    } else {
      setError(result.error ?? 'Prijava nije uspjela.')
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="admin-scope min-h-screen bg-slate-50 px-4 py-8 flex items-center justify-center">
        <p className="text-sm font-medium text-slate-700">Provjera prijave...</p>
      </div>
    )
  }

  const canSubmit = email.trim().length > 0 && password.length > 0
  const visibleError =
    error ??
    (user && !isAdmin ? 'Ovaj račun nema pristup admin panelu.' : null)

  return (
    <div className="admin-scope min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 border-b pb-4">
          <h1 className="text-2xl font-semibold text-slate-900">
            Admin prijava
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Ova stranica je namijenjena samo vlasniku Ani's Studia.
          </p>
        </header>

        <div className="rounded-xl bg-white shadow-sm">
          <div className="px-6 py-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-sm font-medium text-slate-900 mb-2"
                >
                  E-pošta
                </label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-slate-900"
                  placeholder="admin@example.com"
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-sm font-medium text-slate-900 mb-2"
                >
                  Lozinka
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-4 pr-11 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-slate-900"
                    placeholder="Unesite lozinku"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Sakrij lozinku' : 'Prikaži lozinku'}
                    aria-pressed={showPassword}
                    disabled={isSubmitting}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:opacity-40"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 shrink-0" aria-hidden />
                    ) : (
                      <Eye className="h-5 w-5 shrink-0" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              {visibleError && (
                <div
                  role="alert"
                  className="rounded-lg border-2 border-red-600 bg-red-100 px-4 py-3 shadow-sm dark:border-red-500 dark:bg-red-950 dark:outline dark:outline-1 dark:outline-red-700"
                >
                  <p className="text-sm font-semibold leading-relaxed text-red-950 dark:text-red-50">
                    {visibleError}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className="w-full px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: 'linear-gradient(135deg, #BDA6FF 0%, #6E44FF 100%)',
                  boxShadow: '0 2px 8px rgba(110, 68, 255, 0.3)',
                }}
              >
                {isSubmitting ? 'Prijava...' : 'Prijava'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
