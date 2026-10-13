// src/components/WebProjectForm.tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { trackEvent } from '../lib/analytics'
import {
  WEB_ATELIER_FEATURES,
  WEB_ATELIER_FORM_MOODS,
  WEB_ATELIER_GOALS,
  WEB_ATELIER_PROJECT_TYPES,
} from '../lib/webAtelierOptions.ts'
import {
  canonicalSubmission,
  inquiryErrorMessage,
  inquiryFingerprint,
  readStoredIdempotency,
  rememberIdempotency,
  resolveIdempotencyKey,
  type WebAtelierDraft,
} from '../lib/webAtelierInquiry.ts'
import { submitWebAtelierInquiry } from '../lib/webAtelierSubmit.ts'
import './webProjectForm.css'
import { TurnstileWidget } from './TurnstileWidget.tsx'

export interface WebProjectFormValues {
  // 1) Osnovne informacije
  fullNameOrCompany: string
  email: string
  phone: string
  existingWebsite: string
  referral: string

  // 2) Vrsta web projekta
  projectTypes: string[]
  projectTypesOther: string

  // 3) Ciljevi stranice
  goals: string[]
  goalsOther: string

  // 4) Sadržaj
  contentReady: 'yes' | 'partial' | 'no' | ''
  visualsReady: 'yes' | 'partial' | 'no' | ''
  contentLinks: string

  // 5) Dizajn i stil
  designMood: string[]
  designMoodOther: string
  designInspiration: string

  // 6) Funkcionalnosti
  features: string[]
  featuresOther: string
  featuresNotes: string

  // 7) Budžet i rok
  budgetRange: string
  launchDeadline: string
  deadlineFlexibility: string

  // 8) Kontakt i napomene
  contactPreference: string
  contactTime: string
  extraNotes: string
  packagePreference: '' | 'start' | 'pro' | 'premium'
}

const INITIAL_VALUES: WebProjectFormValues = {
  fullNameOrCompany: '',
  email: '',
  phone: '',
  existingWebsite: '',
  referral: '',

  projectTypes: [],
  projectTypesOther: '',

  goals: [],
  goalsOther: '',

  contentReady: '',
  visualsReady: '',
  contentLinks: '',

  designMood: [],
  designMoodOther: '',
  designInspiration: '',

  features: [],
  featuresOther: '',
  featuresNotes: '',

  budgetRange: '',
  launchDeadline: '',
  deadlineFlexibility: '',

  contactPreference: '',
  contactTime: '',
  extraNotes: '',
  packagePreference: '',
}

export type WebAtelierPaket = 'start' | 'pro' | 'premium'

function packageNote(language: 'hr' | 'en', paket: WebAtelierPaket): string {
  const label = { start: 'Start', pro: 'Pro', premium: 'Premium' }[paket]
  return language === 'hr'
    ? `Informativna oznaka paketa: ${label}. Ovo nije ponuda ni konačna cijena.\n`
    : `Informational package label: ${label}. This is not a quote or a final price.\n`
}

function initialValuesFromPaket(
  language: 'hr' | 'en',
  paket?: WebAtelierPaket
): WebProjectFormValues {
  if (!paket) return { ...INITIAL_VALUES }
  return {
    ...INITIAL_VALUES,
    packagePreference: paket,
    extraNotes: packageNote(language, paket),
  }
}

interface WebProjectFormProps {
  language?: 'hr' | 'en'
  /** Hide the in-form title block when the page layout already provides an H1 (e.g. /web-atelier/upit). */
  hidePageTitle?: boolean
  /** Prefill an informational package label from `?paket=` on /web-atelier/upit. */
  initialPaket?: WebAtelierPaket
  /** Optional contact prefill (admin E2E test). Does not bypass validation or CAPTCHA. */
  initialContact?: {
    fullNameOrCompany?: string
    email?: string
    extraNotes?: string
  }
}

export function WebProjectForm({
  language = 'hr',
  hidePageTitle = false,
  initialPaket,
  initialContact,
}: WebProjectFormProps) {
  // Layout-only utility classes. ALL colours live in ./webProjectForm.css (`.wa-*`)
  // so the form never depends on `html.dark`, inherited colour or global !important rules.
  const fieldsetClass = 'wa-panel space-y-4 rounded-2xl p-4 sm:p-6'
  const headingClass = 'wa-heading mb-3 text-lg font-bold leading-snug'
  const labelClass = 'block space-y-1 text-sm font-medium sm:text-base'
  const questionClass = 'wa-heading mb-2 text-sm font-semibold sm:text-base'
  const optionClass = 'flex items-start gap-2 text-sm font-medium'
  const optionInlineClass = 'inline-flex items-center gap-2 text-sm font-medium'
  const helpClass = 'wa-help text-sm leading-relaxed'
  const legendClass = 'wa-legend mt-2 text-xs leading-relaxed'
  const errorClass = 'wa-error mt-1 text-xs font-medium'
  const controlClass =
    'wa-control w-full rounded-xl px-3 py-2 text-sm font-medium focus:outline-none'
  const inputClass = controlClass
  const textareaClass = `${controlClass} min-h-[96px] resize-y`
  const selectClass = controlClass
  const controlErrorClass = 'wa-control-error'
  const checkClass = 'wa-check mt-1 h-4 w-4 shrink-0'

  const [values, setValues] = useState<WebProjectFormValues>(() => {
    const base = initialValuesFromPaket(language, initialPaket)
    if (!initialContact) return base
    return {
      ...base,
      fullNameOrCompany: initialContact.fullNameOrCompany?.trim() || base.fullNameOrCompany,
      email: initialContact.email?.trim() || base.email,
      extraNotes: initialContact.extraNotes?.trim() || base.extraNotes,
    }
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [referenceCode, setReferenceCode] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileReset, setTurnstileReset] = useState(0)
  const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? ''

  const translations = {
    errors: {
      nameRequired: {
        hr: 'Ime i prezime ili naziv firme je obavezno',
        en: 'Full name or company name is required'
      },
      emailRequired: {
        hr: 'Email je obavezan',
        en: 'Email is required'
      },
      emailInvalid: {
        hr: 'Molimo unesite valjanu email adresu',
        en: 'Please enter a valid email address'
      },
      projectTypeRequired: {
        hr: 'Molimo odaberite barem jedan tip web projekta',
        en: 'Please select at least one project type'
      },
      projectDescriptionRequired: {
        hr: 'Molimo unesite opis projekta (najmanje 10 znakova)',
        en: 'Please enter project description (at least 10 characters)'
      },
      budgetRequired: {
        hr: 'Molimo odaberite okvirni budžet',
        en: 'Please select budget range'
      },
      contactRequired: {
        hr: 'Molimo odaberite način kontaktiranja',
        en: 'Please select contact preference'
      }
    },
    success: {
      hr: 'Hvala ti na upitu! Tvoj web projekt je uspješno zaprimljen. Javit ću ti se povratno s prijedlozima strukture, dizajna i daljnjim koracima.',
      en: 'Thank you for your inquiry! Your web project has been successfully received. I will get back to you with structure, design proposals and next steps.'
    }
  }

  function handleChange(
    field: keyof WebProjectFormValues,
    value: WebProjectFormValues[typeof field]
  ) {
    setValues(prev => ({ ...prev, [field]: value }))
    // Clear error for this field when user changes it
    if (errors[field]) {
      setErrors((prev) => {
        const rest = { ...prev }
        delete rest[field]
        return rest
      })
    }
  }

  function handleToggleMulti(field: keyof WebProjectFormValues, option: string) {
    setValues(prev => {
      const current = (prev[field] as string[]) || []
      const exists = current.includes(option)
      const next = exists ? current.filter(o => o !== option) : [...current, option]
      return { ...prev, [field]: next } as WebProjectFormValues
    })
    // Clear error for this field when user changes it
    if (errors[field]) {
      setErrors((prev) => {
        const rest = { ...prev }
        delete rest[field]
        return rest
      })
    }
  }

  function validate(values: WebProjectFormValues) {
    const newErrors: Record<string, string> = {}
    
    // Validate name
    if (!values.fullNameOrCompany.trim()) {
      newErrors.fullNameOrCompany = translations.errors.nameRequired[language]
    }
    
    // Validate email
    if (!values.email.trim()) {
      newErrors.email = translations.errors.emailRequired[language]
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(values.email.trim())) {
        newErrors.email = translations.errors.emailInvalid[language]
      }
    }
    
    // Validate project type
    if (values.projectTypes.length === 0) {
      newErrors.projectTypes = translations.errors.projectTypeRequired[language]
    }
    
    // Validate project description (using extraNotes as description field)
    if (!values.extraNotes.trim() || values.extraNotes.trim().length < 10) {
      newErrors.extraNotes = translations.errors.projectDescriptionRequired[language]
    }
    
    // Validate budget
    if (!values.budgetRange) {
      newErrors.budgetRange = translations.errors.budgetRequired[language]
    }
    
    // Validate contact preference
    if (!values.contactPreference) {
      newErrors.contactPreference = translations.errors.contactRequired[language]
    }
    
    return newErrors
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSending || isSubmitted) return
    setSubmitError(null)

    const newErrors = validate(values)
    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      const firstErrorField = Object.keys(newErrors)[0]
      setTimeout(() => {
        const field = document.getElementById(firstErrorField) ||
                     document.querySelector(`[name="${firstErrorField}"]`) ||
                     document.querySelector(`input[name="${firstErrorField}"], select[name="${firstErrorField}"], textarea[name="${firstErrorField}"]`)
        if (field instanceof HTMLElement) {
          field.focus()
          field.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
      return
    }

    if (!turnstileSiteKey || !turnstileToken) {
      setSubmitError(inquiryErrorMessage(turnstileSiteKey ? 'captcha_failed' : 'unavailable', language))
      return
    }

    const draft: WebAtelierDraft = { ...values, language }
    const submission = canonicalSubmission(draft)
    if (!submission) {
      setSubmitError(inquiryErrorMessage('invalid_payload', language))
      return
    }

    const fingerprint = inquiryFingerprint(submission)
    const storage = typeof window === 'undefined' ? null : window.sessionStorage
    const idempotency = resolveIdempotencyKey(
      readStoredIdempotency(storage),
      fingerprint,
      crypto.randomUUID(),
    )
    rememberIdempotency(storage, idempotency)

    setIsSending(true)
    const result = await submitWebAtelierInquiry(draft, idempotency.key, turnstileToken)
    setIsSending(false)
    setTurnstileToken('')
    setTurnstileReset((count) => count + 1)

    if (!result.ok) {
      setSubmitError(inquiryErrorMessage(result.error, language))
      return
    }

    setReferenceCode(result.referenceCode)
    setIsSubmitted(true)
    trackEvent('form_submit_success', { form: 'web-atelier' })
  }

  return (
    <div className="web-atelier-inquiry-form wa-form mx-auto max-w-3xl space-y-8 py-8">
      <form onSubmit={handleSubmit} className="space-y-8">
        {!hidePageTitle && (
          <div className="mb-4 space-y-1 text-center">
            <h2 className="wa-title text-xl font-bold">
              Upit za web projekt
            </h2>
            <p className={helpClass}>
              Ispunite formu s detaljima o vašem web projektu.
            </p>
          </div>
        )}

        {/* Legenda za checkboxe i radio gumbe */}
        <p className={legendClass}>
          Legenda: kružić (◉) znači da možeš odabrati <span className="wa-strong font-semibold">samo jednu</span> opciju, a kvadratić (☑) da možeš odabrati <span className="wa-strong font-semibold">više</span> opcija.
        </p>
        {values.packagePreference && (
          <p className={helpClass}>
            {packageNote(language, values.packagePreference).trim()}
          </p>
        )}

        {/* 1) Osnovne informacije */}
        <fieldset className={fieldsetClass}>
          <legend className="sr-only">Osnovne informacije</legend>
          <div className={headingClass} aria-hidden="true">
            Osnovne informacije
          </div>

          <div>
            <label className={labelClass}>
              <span>Ime i prezime ili naziv firme <span className="wa-required" aria-hidden="true">*</span></span>
              <input
                type="text"
                id="fullNameOrCompany"
                name="fullNameOrCompany"
                className={`wa-control ${inputClass} ${errors.fullNameOrCompany ? controlErrorClass : ''}`}
                value={values.fullNameOrCompany}
                onChange={e => handleChange('fullNameOrCompany', e.target.value)}
              />
            </label>
            {errors.fullNameOrCompany && (
              <p className={errorClass}>{errors.fullNameOrCompany}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              <span>Email <span className="wa-required" aria-hidden="true">*</span></span>
              <input
                type="email"
                id="email"
                name="email"
                className={`wa-control ${inputClass} ${errors.email ? controlErrorClass : ''}`}
                value={values.email}
                onChange={e => handleChange('email', e.target.value)}
              />
            </label>
            {errors.email && (
              <p className={errorClass}>{errors.email}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              <span>Telefon</span>
              <input
                type="tel"
                className={`wa-control ${inputClass}`}
                value={values.phone}
                onChange={e => handleChange('phone', e.target.value)}
              />
            </label>
          </div>

          <div>
            <label className={labelClass}>
              <span>Postoji li već web stranica? (URL)</span>
              <input
                type="url"
                className={`wa-control ${inputClass}`}
                value={values.existingWebsite}
                onChange={e => handleChange('existingWebsite', e.target.value)}
                placeholder="https://..."
              />
            </label>
          </div>

          <div>
            <label className={labelClass}>
              <span>Kako si saznao/la za Ani's Studio?</span>
              <select
                className={`wa-control ${selectClass}`}
                value={values.referral}
                onChange={e => handleChange('referral', e.target.value)}
              >
                <option value="">Odaberi...</option>
                <option value="google">Google pretraživanje</option>
                <option value="social">Društvene mreže</option>
                <option value="recommendation">Preporuka</option>
                <option value="other">Drugo</option>
              </select>
            </label>
          </div>
        </fieldset>

        {/* 2) Vrsta web projekta */}
        <fieldset className={fieldsetClass}>
          <legend className="sr-only">Koji tip web projekta želiš? *</legend>
          <div className={headingClass} aria-hidden="true">
            Koji tip web projekta želiš? <span className="wa-required" aria-hidden="true">*</span>
          </div>
          <div className={`grid gap-2 sm:grid-cols-2 ${errors.projectTypes ? 'wa-group-error rounded-xl px-3 py-2' : ''}`} id="projectTypes">
            {WEB_ATELIER_PROJECT_TYPES.map(option => (
              <label key={option} className={optionClass}>
                <input
                  type="checkbox"
                  name="projectTypes"
                  className={checkClass}
                  checked={values.projectTypes.includes(option)}
                  onChange={() => handleToggleMulti('projectTypes', option)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
          {errors.projectTypes && (
            <p className={errorClass}>{errors.projectTypes}</p>
          )}

          {values.projectTypes.includes('Drugo') && (
            <div>
              <label className={labelClass}>
                <span>Opiši drugi tip projekta</span>
                <input
                  type="text"
                  className={`wa-control ${inputClass}`}
                  value={values.projectTypesOther}
                  onChange={e => handleChange('projectTypesOther', e.target.value)}
                  placeholder="Opiši..."
                />
              </label>
            </div>
          )}
        </fieldset>

        {/* 3) Ciljevi projekta */}
        <fieldset className={fieldsetClass}>
          <legend className="sr-only">Koji su glavni ciljevi tvog online projekta?</legend>
          <div className={headingClass} aria-hidden="true">
            Koji su glavni ciljevi tvog online projekta?
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {WEB_ATELIER_GOALS.map(option => (
              <label key={option} className={optionClass}>
                <input
                  type="checkbox"
                  className={checkClass}
                  checked={values.goals.includes(option)}
                  onChange={() => handleToggleMulti('goals', option)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>

          {values.goals.includes('Drugo') && (
            <div>
              <label className={labelClass}>
                <span>Opiši druge ciljeve</span>
                <input
                  type="text"
                  className={`wa-control ${inputClass}`}
                  value={values.goalsOther}
                  onChange={e => handleChange('goalsOther', e.target.value)}
                  placeholder="Opiši..."
                />
              </label>
            </div>
          )}
        </fieldset>

        {/* 4) Sadržaj */}
        <fieldset className={fieldsetClass}>
          <legend className="sr-only">Sadržaj</legend>
          <div className={headingClass} aria-hidden="true">
            Sadržaj
          </div>

          <div>
            <p className={questionClass}>Jesu li tekstovi spremni?</p>
            <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-4">
              <label className={optionInlineClass}>
                <input
                  type="radio"
                  name="contentReady"
                  value="yes"
                  className="wa-check h-4 w-4"
                  checked={values.contentReady === 'yes'}
                  onChange={e => handleChange('contentReady', e.target.value as 'yes' | 'partial' | 'no')}
                />
                <span>Da</span>
              </label>
              <label className={optionInlineClass}>
                <input
                  type="radio"
                  name="contentReady"
                  value="partial"
                  className="wa-check h-4 w-4"
                  checked={values.contentReady === 'partial'}
                  onChange={e => handleChange('contentReady', e.target.value as 'yes' | 'partial' | 'no')}
                />
                <span>Djelomično</span>
              </label>
              <label className={optionInlineClass}>
                <input
                  type="radio"
                  name="contentReady"
                  value="no"
                  className="wa-check h-4 w-4"
                  checked={values.contentReady === 'no'}
                  onChange={e => handleChange('contentReady', e.target.value as 'yes' | 'partial' | 'no')}
                />
                <span>Ne</span>
              </label>
            </div>
          </div>

          <div>
            <p className={questionClass}>Jesu li fotografije/vizuali spremni?</p>
            <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-4">
              <label className={optionInlineClass}>
                <input
                  type="radio"
                  name="visualsReady"
                  value="yes"
                  className="wa-check h-4 w-4"
                  checked={values.visualsReady === 'yes'}
                  onChange={e => handleChange('visualsReady', e.target.value as 'yes' | 'partial' | 'no')}
                />
                <span>Da</span>
              </label>
              <label className={optionInlineClass}>
                <input
                  type="radio"
                  name="visualsReady"
                  value="partial"
                  className="wa-check h-4 w-4"
                  checked={values.visualsReady === 'partial'}
                  onChange={e => handleChange('visualsReady', e.target.value as 'yes' | 'partial' | 'no')}
                />
                <span>Djelomično</span>
              </label>
              <label className={optionInlineClass}>
                <input
                  type="radio"
                  name="visualsReady"
                  value="no"
                  className="wa-check h-4 w-4"
                  checked={values.visualsReady === 'no'}
                  onChange={e => handleChange('visualsReady', e.target.value as 'yes' | 'partial' | 'no')}
                />
                <span>Ne</span>
              </label>
            </div>
          </div>

          <div>
            <label className={labelClass}>
              <span>Linkovi na postojeće materijale (Drive, Canva, stara stranica...)</span>
              <input
                type="text"
                className={`wa-control ${inputClass}`}
                value={values.contentLinks}
                onChange={e => handleChange('contentLinks', e.target.value)}
                placeholder="https://..."
              />
            </label>
          </div>
        </fieldset>

        {/* 5) Dizajn i stil */}
        <fieldset className={fieldsetClass}>
          <legend className="sr-only">Dizajn i stil</legend>
          <div className={headingClass} aria-hidden="true">
            Dizajn i stil
          </div>

          <p className={questionClass}>
            Kakav stil dizajna želiš?
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {WEB_ATELIER_FORM_MOODS.map(option => (
              <label key={option} className={optionClass}>
                <input
                  type="checkbox"
                  className={checkClass}
                  checked={values.designMood.includes(option)}
                  onChange={() => handleToggleMulti('designMood', option)}
                />
                <span>{option}</span>
              </label>
            ))}
            <label className={optionClass}>
              <input
                type="checkbox"
                className={checkClass}
                checked={values.designMood.includes('Drugo')}
                onChange={() => handleToggleMulti('designMood', 'Drugo')}
              />
              <span>Drugo</span>
            </label>
          </div>

          {values.designMood.includes('Drugo') && (
            <div>
              <label className={labelClass}>
                <span>Opiši drugi stil</span>
                <input
                  type="text"
                  className={`wa-control ${inputClass}`}
                  value={values.designMoodOther}
                  onChange={e => handleChange('designMoodOther', e.target.value)}
                  placeholder="Opiši..."
                />
              </label>
            </div>
          )}

          <div>
            <label className={labelClass}>
              <span>Linkovi na stranice koje ti se sviđaju + opis zašto</span>
              <textarea
                className={`wa-control ${textareaClass}`}
                value={values.designInspiration}
                onChange={e => handleChange('designInspiration', e.target.value)}
                rows={4}
                placeholder="https://primjer.com - volim ovaj minimalistički pristup..."
              />
            </label>
          </div>
        </fieldset>

        {/* 6) Funkcionalnosti */}
        <fieldset className={fieldsetClass}>
          <legend className="sr-only">Funkcionalnosti</legend>
          <div className={headingClass} aria-hidden="true">
            Funkcionalnosti
          </div>

          <p className={questionClass}>
            Koje funkcionalnosti želiš u projektu?
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {WEB_ATELIER_FEATURES.map(option => (
              <label key={option} className={optionClass}>
                <input
                  type="checkbox"
                  className={checkClass}
                  checked={values.features.includes(option)}
                  onChange={() => handleToggleMulti('features', option)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>

          {values.features.includes('Drugo') && (
            <div>
              <label className={labelClass}>
                <span>Opiši druge funkcionalnosti</span>
                <input
                  type="text"
                  className={`wa-control ${inputClass}`}
                  value={values.featuresOther}
                  onChange={e => handleChange('featuresOther', e.target.value)}
                  placeholder="Opiši..."
                />
              </label>
            </div>
          )}

          <div>
            <label className={labelClass}>
              <span>Dodatne funkcionalnosti ili specifični zahtjevi</span>
              <textarea
                className={`wa-control ${textareaClass}`}
                value={values.featuresNotes}
                onChange={e => handleChange('featuresNotes', e.target.value)}
                rows={4}
                placeholder="Dodatne napomene o funkcionalnostima..."
              />
            </label>
          </div>
        </fieldset>

        {/* 7) Budžet i rok */}
        <fieldset className={fieldsetClass}>
          <legend className="sr-only">Budžet i rok</legend>
          <div className={headingClass} aria-hidden="true">
            Budžet i rok
          </div>

          <div>
            <label className={labelClass}>
              <span>Okvirni budžet <span className="wa-required" aria-hidden="true">*</span></span>
              <select
                id="budgetRange"
                name="budgetRange"
                className={`wa-control ${selectClass} ${errors.budgetRange ? controlErrorClass : ''}`}
                value={values.budgetRange}
                onChange={e => handleChange('budgetRange', e.target.value)}
              >
                <option value="">Odaberi...</option>
                <option value="under-1000">Do 1000 €</option>
                <option value="1000-3000">1000 – 3000 €</option>
                <option value="3000-7000">3000 – 7000 €</option>
                <option value="7000+">7000+ €</option>
              </select>
            </label>
            {errors.budgetRange && (
              <p className={errorClass}>{errors.budgetRange}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              <span>Željeni datum pokretanja</span>
              <input
                type="date"
                className={`wa-control ${inputClass}`}
                value={values.launchDeadline}
                onChange={e => handleChange('launchDeadline', e.target.value)}
              />
            </label>
          </div>

          <div>
            <label className={labelClass}>
              <span>Fleksibilnost roka</span>
              <select
                className={`wa-control ${selectClass}`}
                value={values.deadlineFlexibility}
                onChange={e => handleChange('deadlineFlexibility', e.target.value)}
              >
                <option value="">Odaberi...</option>
                <option value="fixed">Fiksno</option>
                <option value="flexible">Može kasniti malo</option>
                <option value="very-flexible">Vrlo fleksibilno</option>
              </select>
            </label>
          </div>
        </fieldset>

        {/* 8) Kontakt i napomene */}
        <fieldset className={fieldsetClass}>
          <legend className="sr-only">Kontakt i napomene</legend>
          <div className={headingClass} aria-hidden="true">
            Kontakt i napomene
          </div>

          <div>
            <label className={labelClass}>
              <span>Način kontaktiranja <span className="wa-required" aria-hidden="true">*</span></span>
              <select
                id="contactPreference"
                name="contactPreference"
                className={`wa-control ${selectClass} ${errors.contactPreference ? controlErrorClass : ''}`}
                value={values.contactPreference}
                onChange={e => handleChange('contactPreference', e.target.value)}
              >
                <option value="">Odaberi...</option>
                <option value="email">Email</option>
                <option value="phone">Telefon</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="viber">Viber</option>
              </select>
            </label>
            {errors.contactPreference && (
              <p className={errorClass}>{errors.contactPreference}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              <span>Najbolje vrijeme za kontakt</span>
              <input
                type="text"
                className={`wa-control ${inputClass}`}
                value={values.contactTime}
                onChange={e => handleChange('contactTime', e.target.value)}
                placeholder="npr. radnim danom od 9 do 17h"
              />
            </label>
          </div>

          <div>
            <label className={labelClass}>
              <span>Dodatne napomene / Opis projekta <span className="wa-required" aria-hidden="true">*</span></span>
              <textarea
                id="extraNotes"
                name="extraNotes"
                className={`wa-control ${textareaClass} ${errors.extraNotes ? controlErrorClass : ''}`}
                value={values.extraNotes}
                onChange={e => handleChange('extraNotes', e.target.value)}
                rows={4}
                placeholder={language === 'hr' ? 'Sve dodatne informacije koje bi mogle biti korisne...' : 'All additional information that might be useful...'}
              />
            </label>
            {errors.extraNotes && (
              <p className={errorClass}>{errors.extraNotes}</p>
            )}
          </div>
        </fieldset>

        {submitError && (
          <div className="wa-banner-error mt-4 rounded-xl border px-4 py-3 text-sm font-medium" role="alert">
            {submitError}
          </div>
        )}

        {isSubmitted && referenceCode && (
          <div className="wa-banner-ok mt-4 rounded-xl border px-4 py-3 text-sm font-medium" role="status">
            <p>{translations.success[language]}</p>
            <p className="mt-2 font-bold">
              {language === 'hr' ? 'Broj upita:' : 'Inquiry reference:'} {referenceCode}
            </p>
          </div>
        )}

        <TurnstileWidget
          siteKey={turnstileSiteKey}
          resetSignal={turnstileReset}
          onToken={setTurnstileToken}
        />

        <div className="mt-6 flex justify-center">
          <button
            type="submit"
            disabled={isSending || isSubmitted}
            className="wa-submit inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending
              ? language === 'hr'
                ? 'Šaljem upit…'
                : 'Sending…'
              : 'Pošalji upit za web projekt'}
          </button>
        </div>
      </form>
    </div>
  )
}

