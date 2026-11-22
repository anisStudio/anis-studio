import { useState, type FormEvent } from 'react'
import { useAuth } from '../providers/AuthProvider'
import { useUi } from '../providers/UiProvider'

interface RegisterModalProps {
  language: 'hr' | 'en'
}

export default function RegisterModal({ language }: RegisterModalProps) {
  const { register, isLoading } = useAuth()
  const { modals, closeModal, openModal } = useUi()
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '' 
  })
  const [error, setError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isOpen = modals['register'] || false

  const translations = {
    title: {
      hr: 'Registracija',
      en: 'Sign Up'
    },
    name: {
      hr: 'Ime',
      en: 'Name'
    },
    email: {
      hr: 'Email',
      en: 'Email'
    },
    password: {
      hr: 'Lozinka',
      en: 'Password'
    },
    confirmPassword: {
      hr: 'Potvrdi lozinku',
      en: 'Confirm Password'
    },
    submit: {
      hr: 'Registriraj se',
      en: 'Sign Up'
    },
    cancel: {
      hr: 'Odustani',
      en: 'Cancel'
    },
    switchToLogin: {
      hr: 'Već imate račun? Prijavite se',
      en: 'Already have an account? Sign in'
    },
    errors: {
      passwordMismatch: {
        hr: 'Lozinke se ne podudaraju',
        en: 'Passwords do not match'
      },
      invalidEmail: {
        hr: 'Molimo unesite validan email',
        en: 'Please enter a valid email'
      },
      passwordTooShort: {
        hr: 'Lozinka mora imati najmanje 6 znakova',
        en: 'Password must be at least 6 characters'
      }
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    // Validacija
    if (formData.password !== formData.confirmPassword) {
      setError(translations.errors.passwordMismatch[language])
      return
    }

    if (formData.password.length < 6) {
      setError(translations.errors.passwordTooShort[language])
      return
    }

    if (!formData.email.includes('@')) {
      setError(translations.errors.invalidEmail[language])
      return
    }

    setIsSubmitting(true)

    try {
      await register(formData.name, formData.email, formData.password)
      closeModal('register')
      setFormData({ name: '', email: '', password: '', confirmPassword: '' })
    } catch (err) {
      setError(language === 'hr' ? 'Greška pri registraciji' : 'Registration error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSwitchToLogin = () => {
    closeModal('register')
    setTimeout(() => {
      openModal('login')
    }, 100)
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[1060] flex min-h-0 items-center justify-center overflow-y-auto overscroll-contain p-4 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeModal('register')
        }
      }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        style={{ animation: 'fade-in 0.2s ease-out' }}
      />

      {/* Modal */}
      <div 
        className="relative my-auto w-full min-w-0 max-w-md max-h-[min(92dvh,800px)] overflow-y-auto overscroll-contain rounded-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl glass-morphism sm:p-8 sm:pb-8"
        style={{ animation: 'fade-in-up 0.3s ease-out' }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => closeModal('register')}
          className="absolute right-3 top-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg p-0 text-plum/80 touch-manipulation dark:text-pearl/70 hover:text-[--color-primary] transition-colors hover:bg-[rgba(110,68,255,0.05)] dark:hover:bg-[rgba(189,166,255,0.15)] sm:right-4 sm:top-4"
          aria-label={language === 'hr' ? 'Zatvori' : 'Close'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <h2 className="mb-6 pr-12 font-heading text-2xl font-bold text-plum/90 dark:text-pearl sm:mb-7 sm:text-3xl">
          {translations.title[language]}
        </h2>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="register-name" className="mb-2 block text-sm font-semibold text-plum/90 dark:text-pearl">
              {translations.name[language]}
            </label>
            <input
              type="text"
              id="register-name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              autoComplete="name"
              className="min-h-[44px] w-full rounded-xl border border-[rgba(110,68,255,0.2)] bg-white/90 px-4 py-3 text-base text-plum/90 outline-none transition-all duration-200 placeholder:text-plum/60 focus:border-[--color-primary] focus:ring-2 focus:ring-[--color-primary]/20 dark:border-lavender/20 dark:bg-white/10 dark:text-pearl dark:placeholder:text-pearl/50 dark:focus:bg-white/15"
              placeholder={translations.name[language]}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="register-email" className="mb-2 block text-sm font-semibold text-plum/90 dark:text-pearl">
              {translations.email[language]}
            </label>
            <input
              type="email"
              id="register-email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              autoComplete="email"
              className="min-h-[44px] w-full rounded-xl border border-[rgba(110,68,255,0.2)] bg-white/90 px-4 py-3 text-base text-plum/90 outline-none transition-all duration-200 placeholder:text-plum/60 focus:border-[--color-primary] focus:ring-2 focus:ring-[--color-primary]/20 dark:border-lavender/20 dark:bg-white/10 dark:text-pearl dark:placeholder:text-pearl/50 dark:focus:bg-white/15"
              placeholder={translations.email[language]}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="register-password" className="mb-2 block text-sm font-semibold text-plum/90 dark:text-pearl">
              {translations.password[language]}
            </label>
            <input
              type="password"
              id="register-password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              autoComplete="new-password"
              className="min-h-[44px] w-full rounded-xl border border-[rgba(110,68,255,0.2)] bg-white/90 px-4 py-3 text-base text-plum/90 outline-none transition-all duration-200 placeholder:text-plum/60 focus:border-[--color-primary] focus:ring-2 focus:ring-[--color-primary]/20 dark:border-lavender/20 dark:bg-white/10 dark:text-pearl dark:focus:bg-white/15"
              placeholder={translations.password[language]}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="register-confirm-password" className="mb-2 block text-sm font-semibold text-plum/90 dark:text-pearl">
              {translations.confirmPassword[language]}
            </label>
            <input
              type="password"
              id="register-confirm-password"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              autoComplete="new-password"
              className="min-h-[44px] w-full rounded-xl border border-[rgba(110,68,255,0.2)] bg-white/90 px-4 py-3 text-base text-plum/90 outline-none transition-all duration-200 placeholder:text-plum/60 focus:border-[--color-primary] focus:ring-2 focus:ring-[--color-primary]/20 dark:border-lavender/20 dark:bg-white/10 dark:text-pearl dark:focus:bg-white/15"
              placeholder={translations.confirmPassword[language]}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="public-action btn btn-primary min-h-[48px] w-full py-3 text-base disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting || isLoading 
              ? (language === 'hr' ? 'Registriranje...' : 'Signing up...')
              : translations.submit[language]
            }
          </button>

          {/* Switch to login */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={handleSwitchToLogin}
              className="min-h-[44px] touch-manipulation px-2 text-sm text-plum/80 underline-offset-2 hover:text-[--color-primary] hover:underline dark:text-pearl/70"
            >
              {translations.switchToLogin[language]}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

