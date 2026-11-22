// src/components/InteriorsCarpenterForm.tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { trackEvent } from '../lib/analytics'
import { createCarpenter, createProject, uploadProjectFileToStorage, type VrPackagePreference } from '../lib/interiors'
import { UploadProgress } from './UploadProgress'

export interface CarpenterProjectFormValues {
  companyName: string
  contactName: string
  email: string
  phone: string
  location: string
  website: string
  oib: string

  projectType: string
  projectTypes: string[]
  servicesNeeded: string[]
  spaceType: string
  areaM2: string
  budget: string
  notes: string
  hasPlan: 'plan' | 'photos' | 'none' | ''

  boards: string
  worktops: string
  fronts: string

  hardwareBrands: string[]
  hardwareOther: string

  monthlyCapacity: string
  averageProductionTime: string
  deadlineNotes: string

  wantsCompleteDrawings: boolean
  usesPartialSolutions: boolean
  collaborationNotes: string

  contactPreference: string
  bestContactTime: string

  drawnByOption: 'ani' | 'carpenter' | ''
  usesCorpus: boolean
  corpusExportFile: File | null

  wantsPhotorealisticRender: boolean

  wantsVr: boolean
  vrForClientsPerYear: string
  vrNeeds: string[]
}

interface InteriorsCarpenterFormProps {
  language?: 'hr' | 'en'
  vrEnabled?: boolean
}

const INITIAL_VALUES: CarpenterProjectFormValues = {
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  location: '',
  website: '',
  oib: '',

  projectType: '',
  projectTypes: [],
  servicesNeeded: [],
  spaceType: '',
  areaM2: '',
  budget: '',
  notes: '',
  hasPlan: '',

  boards: '',
  worktops: '',
  fronts: '',

  hardwareBrands: [],
  hardwareOther: '',

  monthlyCapacity: '',
  averageProductionTime: '',
  deadlineNotes: '',

  wantsCompleteDrawings: false,
  usesPartialSolutions: false,
  collaborationNotes: '',

  contactPreference: '',
  bestContactTime: '',

  drawnByOption: '',
  usesCorpus: false,
  corpusExportFile: null,

  wantsPhotorealisticRender: false,

  wantsVr: false,
  vrForClientsPerYear: '',
  vrNeeds: [],
}

const VR_NEEDS_OPTIONS = [
  'VR prezentacija kod Ane u studiju',
  'Materijali (slike/video iz VR-a) za prezentaciju tvom klijentu',
  'Online 3D/VR link za tvog klijenta',
]

const SERVICES_NEEDED_OPTIONS: { value: string; label: string }[] = [
  { value: '3d_vizualizacija', label: '3D vizualizacija za klijenta' },
  { value: 'fotorealisticki_prikaz', label: 'Fotorealistični prikaz prostora' },
  { value: 'krojne_liste', label: 'Tehnička dokumentacija / krojne liste' },
  { value: 'ostalo', label: 'Ostalo' },
]

export function InteriorsCarpenterForm({ language = 'hr', vrEnabled = false }: InteriorsCarpenterFormProps) {
  const inputClass =
    "w-full rounded-xl border border-slate-200 dark:border-lavender/20 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-900/30 focus:border-violet-400 dark:focus:border-violet-500 text-plum/90 dark:text-pearl placeholder:text-plum/60 dark:placeholder:text-pearl/50";

  const textareaClass =
    "w-full rounded-xl border border-slate-200 dark:border-lavender/20 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm shadow-inner resize-y min-h-[96px] focus:outline-none focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-900/30 focus:border-violet-400 dark:focus:border-violet-500 text-plum/90 dark:text-pearl placeholder:text-plum/60 dark:placeholder:text-pearl/50";

  const selectClass = inputClass;

  const [values, setValues] = useState<CarpenterProjectFormValues>(INITIAL_VALUES)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [exportFiles, setExportFiles] = useState<File[]>([])
  const [kitchenSketchFiles, setKitchenSketchFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState<string>()
  const [currentFileIndex, setCurrentFileIndex] = useState(1)

  function handleChange(
    field: keyof CarpenterProjectFormValues,
    value: CarpenterProjectFormValues[typeof field]
  ) {
    setValues(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [field]: _, ...rest } = prev
        return rest
      })
    }
  }

  function handleToggleMulti(field: keyof CarpenterProjectFormValues, option: string) {
    setValues(prev => {
      const current = (prev[field] as string[]) || []
      const exists = current.includes(option)
      const next = exists ? current.filter(o => o !== option) : [...current, option]
      return { ...prev, [field]: next }
    })
    if (errors[field]) {
      setErrors(prev => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [field]: _, ...rest } = prev
        return rest
      })
    }
  }

  const handleCarpenterExportFilesChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files
    if (!files) return
    const incoming = Array.from(files)
    setExportFiles((prev) => {
      const merged = [...prev]
      for (const f of incoming) {
        const alreadyExists = merged.some(
          (p) => p.name === f.name && p.size === f.size && p.lastModified === f.lastModified
        )
        if (!alreadyExists) merged.push(f)
      }
      return merged
    })
    event.target.value = ''
  }

  const handleKitchenSketchFilesChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files
    if (!files) return
    const incoming = Array.from(files)
    setKitchenSketchFiles((prev) => {
      const merged = [...prev]
      for (const f of incoming) {
        const alreadyExists = merged.some(
          (p) => p.name === f.name && p.size === f.size && p.lastModified === f.lastModified
        )
        if (!alreadyExists) merged.push(f)
      }
      return merged
    })
    event.target.value = ''
  }

  function removeKitchenSketchFile(index: number) {
    setKitchenSketchFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function removeExportFile(index: number) {
    setExportFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function validate(v: CarpenterProjectFormValues, form: HTMLFormElement): { isValid: boolean; errors: Record<string, string>; firstErrorField: string | null } {
    const newErrors: Record<string, string> = {}

    if (!v.companyName.trim()) {
      newErrors.companyName = language === 'hr' ? 'Naziv firme je obavezan' : 'Company name is required'
    }
    if (!v.contactName.trim()) {
      newErrors.contactName = language === 'hr' ? 'Ime kontakt osobe je obavezno' : 'Contact person name is required'
    }
    if (!v.email.trim()) {
      newErrors.email = language === 'hr' ? 'Email je obavezan' : 'Email is required'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(v.email.trim())) {
        newErrors.email = language === 'hr' ? 'Molimo unesite valjanu email adresu' : 'Please enter a valid email address'
      }
    }
    if (!v.phone.trim()) {
      newErrors.phone = language === 'hr' ? 'Telefon je obavezan' : 'Phone number is required'
    }
    if (!v.location.trim()) {
      newErrors.location = language === 'hr' ? 'Grad / lokacija je obavezna' : 'City / location is required'
    }
    const website = form.querySelector<HTMLInputElement>('#website')
    if (website?.validity.typeMismatch) {
      newErrors.website = language === 'hr'
        ? 'Unesite cijelu web adresu, npr. https://example.com.'
        : 'Enter the full website address, e.g. https://example.com.'
    }
    if (!v.projectType) {
      newErrors.projectType = language === 'hr' ? 'Molimo odaberite tip projekta' : 'Please select project type'
    }
    if (!v.contactPreference) {
      newErrors.contactPreference = language === 'hr' ? 'Molim te odaberi način kontaktiranja.' : 'Please select contact preference.'
    }

    const vrClientCount = form.querySelector<HTMLInputElement>('#vrForClientsPerYear')
    if (vrClientCount && !vrClientCount.validity.valid) {
      newErrors.vrForClientsPerYear = language === 'hr'
        ? 'Unesite cijeli broj veći od nule.'
        : 'Enter a whole number greater than zero.'
    }

    const firstErrorField = Object.keys(newErrors)[0] || null
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors, firstErrorField }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const validation = validate(values, e.currentTarget)
    setErrors(validation.errors)

    if (!validation.isValid) {
      if (validation.firstErrorField) {
        setTimeout(() => {
          const field =
            document.getElementById(validation.firstErrorField!) ||
            document.querySelector(`[name="${validation.firstErrorField}"]`) ||
            document.querySelector(
              `input[name="${validation.firstErrorField}"], select[name="${validation.firstErrorField}"], textarea[name="${validation.firstErrorField}"]`
            )
          if (field) {
            (field as HTMLElement).focus({ preventScroll: true })
            field.scrollIntoView({ block: 'center' })
          }
        }, 100)
      }
      return
    }

    setErrors({})
    setIsSubmitting(true)

    try {
      let areaM2: number | null = null
      if (values.areaM2) {
        const parsed = parseFloat(values.areaM2.replace(/[^\d.,]/g, '').replace(',', '.'))
        if (!isNaN(parsed) && parsed > 0) areaM2 = parsed
      }

      let budget: number | null = null
      if (values.budget) {
        const parsed = parseFloat(values.budget.replace(/[^\d.,]/g, '').replace(',', '.'))
        if (!isNaN(parsed) && parsed > 0) budget = parsed
      }

      let vrForClientsPerYear: number | null = null
      if (values.wantsVr && values.vrForClientsPerYear) {
        const parsed = parseInt(values.vrForClientsPerYear, 10)
        if (!isNaN(parsed) && parsed > 0) vrForClientsPerYear = parsed
      }

      let vrPackagePreference: VrPackagePreference = null
      if (values.wantsVr && values.vrNeeds.length > 0) {
        if (values.vrNeeds.includes('Online 3D/VR link za tvog klijenta')) {
          vrPackagePreference = '3d_vr_online'
        } else {
          vrPackagePreference = '3d_vr'
        }
      }

      const notesParts: string[] = []

      if (values.location.trim()) notesParts.push(`Lokacija: ${values.location.trim()}`)
      if (values.website.trim()) notesParts.push(`Website: ${values.website.trim()}`)

      if (values.servicesNeeded.length > 0) {
        const serviceLabels = values.servicesNeeded
          .map(v => SERVICES_NEEDED_OPTIONS.find(o => o.value === v)?.label ?? v)
          .join(', ')
        notesParts.push(`Traži usluge: ${serviceLabels}`)
      }

      if (values.hasPlan) {
        const hasPlanLabel =
          values.hasPlan === 'plan'
            ? 'Ima tlocrt / plan'
            : values.hasPlan === 'photos'
            ? 'Ima fotografije ili skice'
            : 'Nema tlocrta ni fotografija'
        notesParts.push(`Dokumentacija: ${hasPlanLabel}`)
      }

      notesParts.push(
        `Fotorealistični prikaz prostora: ${values.wantsPhotorealisticRender ? 'DA' : 'NE'}`
      )

      if (values.contactPreference) notesParts.push(`Način kontaktiranja: ${values.contactPreference}`)
      if (values.bestContactTime.trim()) notesParts.push(`Najbolje vrijeme za kontakt: ${values.bestContactTime.trim()}`)
      if (values.notes.trim()) notesParts.push(`Napomene o projektu: ${values.notes.trim()}`)

      const combinedNotes = notesParts.length > 0 ? notesParts.join('\n\n') : null

      const carpenter = await createCarpenter({
        company_name: values.companyName.trim(),
        contact_name: values.contactName.trim(),
        email: values.email.trim(),
        phone: values.phone.trim() || null,
        uses_corpus: values.usesCorpus,
        estimated_vr_projects_per_year: vrForClientsPerYear,
        notes: combinedNotes,
      })

      const project = await createProject({
        title: `Projekt za ${values.companyName.trim()} – ${values.projectType || 'Nepoznato'}`,
        user_type: 'carpenter',
        client_id: null,
        carpenter_id: carpenter.id,
        drawn_by: 'ani',
        uses_corpus: values.usesCorpus,
        wants_vr: values.wantsVr,
        vr_location_preference: values.wantsVr ? 'studio' : null,
        vr_package_preference: vrPackagePreference,
        status: 'inquiry',
        space_type: values.spaceType || values.projectType || null,
        area_m2: areaM2,
        budget: budget,
        notes: values.notes.trim() || null,
        review_request_sent_at: null,
      })

      const totalFiles = exportFiles.length + kitchenSketchFiles.length
      let uploadFailCount = 0

      if (totalFiles > 0) {
        setIsUploading(true)
        setUploadProgress(0)
        setCurrentFileIndex(1)

        try {
          const allFiles: Array<{ file: File; type: 'carpenter_3d_export' | 'kitchen_sketch' }> = []

          for (const file of exportFiles) {
            allFiles.push({ file, type: 'carpenter_3d_export' })
          }
          for (const file of kitchenSketchFiles) {
            allFiles.push({ file, type: 'kitchen_sketch' })
          }

          for (let i = 0; i < allFiles.length; i++) {
            const { file, type } = allFiles[i]
            setCurrentFile(file.name)
            setCurrentFileIndex(i + 1)
            try {
              await uploadProjectFileToStorage(project.id, file, type)
            } catch (uploadError) {
              uploadFailCount++
              console.error(
                '[InteriorsCarpenterForm] File upload failed:',
                { fileName: file.name, fileType: type },
                uploadError instanceof Error ? uploadError.message : uploadError
              )
            }
            setUploadProgress(((i + 1) / totalFiles) * 100)
          }

          setUploadProgress(100)
        } catch (error) {
          console.error('[InteriorsCarpenterForm] Unexpected error in upload block:', error)
        } finally {
          setIsUploading(false)
          setCurrentFile(undefined)
          setUploadProgress(0)
          setCurrentFileIndex(1)
        }
      }

      if (uploadFailCount > 0) {
        toast(
          language === 'hr'
            ? `Upit je poslan, ali ${uploadFailCount === 1 ? 'jedna datoteka nije učitana' : `${uploadFailCount} datoteke nisu učitane`}. Molimo pošaljite ih naknadno ili nas kontaktirajte.`
            : `Request sent, but ${uploadFailCount} file(s) could not be uploaded. Please resend them or contact us.`,
          { icon: '⚠️', duration: 8000 }
        )
      } else {
        toast.success(
          language === 'hr'
            ? '✨ Uspješno! Vaš zahtjev je poslan. Javit ćemo Vam se uskoro.'
            : '✨ Success! Your request has been sent. We will contact you soon.',
          { duration: 5000 }
        )
      }
      trackEvent('form_submit_success', { form: 'interiors-carpenter' })

      setValues(INITIAL_VALUES)
      setExportFiles([])
      setKitchenSketchFiles([])
    } catch (error) {
      console.error('Error submitting carpenter form:', error)
      toast.error(
        language === 'hr'
          ? 'Greška pri slanju zahtjeva. Molimo pokušajte ponovno ili nas kontaktirajte direktno.'
          : 'Error sending request. Please try again or contact us directly.',
        { duration: 6000 }
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-8 pb-1">
      {/* Naslov */}
      <div className="space-y-2 text-center mb-6">
        <h2 className="text-xl font-semibold text-slate-900">
          {language === 'hr' ? 'Upit za projekt / suradnju – stolari i studiji' : 'Project / collaboration inquiry – carpenters and studios'}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {language === 'hr'
            ? 'Ispunite kratku formu i javit ćemo vam se s informacijama u najkraćem mogućem roku.'
            : 'Fill in the short form and we will get back to you with information as soon as possible.'}
        </p>
      </div>

      <p className="text-sm text-plum/80 dark:text-pearl/80">
        {language === 'hr' ? 'Polja označena zvjezdicom (*) obavezna su.' : 'Fields marked with an asterisk (*) are required.'}
      </p>

      {/* 1. Podaci o firmi */}
      <fieldset className="space-y-4 rounded-2xl bg-white/70 dark:bg-white/8 p-5 sm:p-6 md:p-7 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50">
        <legend className="sr-only">Podaci o firmi</legend>
        <div className="mb-3 text-lg font-semibold leading-snug text-plum/90 dark:text-pearl" aria-hidden="true">
          1. Podaci o firmi
        </div>

        <div>
          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Naziv firme / obrta *</span>
            <input
              type="text"
              id="companyName"
              name="companyName"
              aria-required="true"
              aria-invalid={Boolean(errors.companyName)}
              aria-describedby={errors.companyName ? "carpenter-companyName-error" : undefined}
              autoComplete="organization"
              className={`${inputClass} ${errors.companyName ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
              value={values.companyName}
              onChange={e => handleChange('companyName', e.target.value)}
            />
          </label>
          {errors.companyName && <p id="carpenter-companyName-error" className="interiors-field-error mt-1 text-sm">{errors.companyName}</p>}
        </div>

        <div>
          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Ime i prezime kontakt osobe *</span>
            <input
              type="text"
              id="contactName"
              name="contactName"
              aria-required="true"
              aria-invalid={Boolean(errors.contactName)}
              aria-describedby={errors.contactName ? "carpenter-contactName-error" : undefined}
              autoComplete="name"
              className={`${inputClass} ${errors.contactName ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
              value={values.contactName}
              onChange={e => handleChange('contactName', e.target.value)}
            />
          </label>
          {errors.contactName && <p id="carpenter-contactName-error" className="interiors-field-error mt-1 text-sm">{errors.contactName}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
              <span>Email *</span>
              <input
                type="email"
                id="email"
                name="email"
                aria-required="true"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "carpenter-email-error" : undefined}
                autoComplete="email"
                className={`${inputClass} ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                value={values.email}
                onChange={e => handleChange('email', e.target.value)}
              />
            </label>
            {errors.email && <p id="carpenter-email-error" className="interiors-field-error mt-1 text-sm">{errors.email}</p>}
          </div>

          <div>
            <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
              <span>{language === 'hr' ? 'Telefon *' : 'Phone *'}</span>
              <input
                type="tel"
                id="phone"
                name="phone"
                aria-required="true"
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? "carpenter-phone-error" : undefined}
                autoComplete="tel"
                className={`${inputClass} ${errors.phone ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                value={values.phone}
                onChange={e => handleChange('phone', e.target.value)}
              />
            </label>
            {errors.phone && <p id="carpenter-phone-error" className="interiors-field-error mt-1 text-sm">{errors.phone}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
              <span>{language === 'hr' ? 'Grad / lokacija *' : 'City / location *'}</span>
              <input
                type="text"
                id="location"
                name="location"
                aria-required="true"
                aria-invalid={Boolean(errors.location)}
                aria-describedby={errors.location ? "carpenter-location-error" : undefined}
                className={`${inputClass} ${errors.location ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                value={values.location}
                onChange={e => handleChange('location', e.target.value)}
                placeholder={language === 'hr' ? 'npr. Rijeka' : 'e.g. Rijeka'}
              />
            </label>
            {errors.location && <p id="carpenter-location-error" className="interiors-field-error mt-1 text-sm">{errors.location}</p>}
          </div>

          <div>
            <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
              <span>{language === 'hr' ? 'Website (opcionalno)' : 'Website (optional)'}</span>
              <input
                type="url"
                id="website"
                name="website"
                aria-invalid={Boolean(errors.website)}
                aria-describedby={errors.website ? "carpenter-website-error" : undefined}
                autoComplete="url"
                className={inputClass}
                value={values.website}
                onChange={e => handleChange('website', e.target.value)}
                placeholder={language === 'hr' ? 'npr. https://example.com' : 'e.g. https://example.com'}
              />
            </label>
            {errors.website && <p id="carpenter-website-error" className="interiors-field-error mt-1 text-sm">{errors.website}</p>}
          </div>
        </div>
      </fieldset>

      {/* 2. Upit za projekt */}
      <fieldset className="space-y-4 rounded-2xl bg-white/70 dark:bg-white/8 p-5 sm:p-6 md:p-7 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50">
        <legend className="sr-only">Upit za projekt</legend>
        <div className="mb-3 text-lg font-semibold leading-snug text-plum/90 dark:text-pearl" aria-hidden="true">
          2. Upit za projekt
        </div>

        <div>
          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Tip projekta *</span>
            <select
              id="projectType"
              name="projectType"
              aria-required="true"
              aria-invalid={Boolean(errors.projectType)}
              aria-describedby={errors.projectType ? "carpenter-projectType-error" : undefined}
              value={values.projectType}
              onChange={e => handleChange('projectType', e.target.value)}
              className={`${selectClass} ${errors.projectType ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
            >
              <option value="">Odaberi...</option>
              <option value="kuhinja">Kuhinja</option>
              <option value="dnevni">Dnevni boravak</option>
              <option value="spavaca">Spavaća soba</option>
              <option value="djecja">Dječja soba</option>
              <option value="hodnik">Hodnik / predprostor</option>
              <option value="kupaonica">Kupaonica</option>
              <option value="ured">Ured / poslovni prostor</option>
              <option value="drugo">Drugo</option>
            </select>
          </label>
          {errors.projectType && <p id="carpenter-projectType-error" className="interiors-field-error mt-1 text-sm">{errors.projectType}</p>}
        </div>

        <div>
          <p className="text-sm sm:text-base font-medium text-plum/90 dark:text-pearl mb-2">
            Što trebate od Ani's Studija?
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Odaberite jednu ili više usluga koje vas zanimaju.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SERVICES_NEEDED_OPTIONS.map(option => (
              <label key={option.value} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1 accent-violet-500"
                  checked={values.servicesNeeded.includes(option.value)}
                  onChange={() => handleToggleMulti('servicesNeeded', option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div id="hasPlan">
          <p className="text-sm sm:text-base font-medium text-plum/90 dark:text-pearl mb-2">
            Ima li već tlocrt, skicu ili mjere?
          </p>
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="hasPlan"
                value="plan"
                className="accent-violet-500"
                checked={values.hasPlan === 'plan'}
                onChange={() => handleChange('hasPlan', 'plan')}
              />
              <span>Da – imam tlocrt / mjere</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="hasPlan"
                value="photos"
                className="accent-violet-500"
                checked={values.hasPlan === 'photos'}
                onChange={() => handleChange('hasPlan', 'photos')}
              />
              <span>Da – imam fotografije ili skicu</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="hasPlan"
                value="none"
                className="accent-violet-500"
                checked={values.hasPlan === 'none'}
                onChange={() => handleChange('hasPlan', 'none')}
              />
              <span>Ne, nemam ništa od navedenog</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Kratka napomena (opcionalno)</span>
            <textarea
              className={textareaClass}
              value={values.notes}
              onChange={e => handleChange('notes', e.target.value)}
              rows={4}
              placeholder="Opisite kratko projekt, posebne zahtjeve ili što god mislite da je važno..."
            />
          </label>
        </div>
      </fieldset>

      {/* 3. Fotorealistični prikaz */}
      <fieldset className="space-y-3 rounded-2xl bg-white/70 dark:bg-white/8 p-5 sm:p-6 md:p-7 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50">
        <legend className="sr-only">Fotorealistični prikaz</legend>
        <div className="text-lg font-semibold leading-snug text-plum/90 dark:text-pearl">
          3. Fotorealistični prikaz
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Fotorealistični prikaz daje klijentu realnu sliku materijala, boja, rasvjete i dekoracija. Nije dio osnovne 3D vizualizacije i posebno se uračunava u ponudu.
        </p>
        <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-pearl/90">
          <input
            type="checkbox"
            className="mt-1 accent-violet-500"
            checked={values.wantsPhotorealisticRender}
            onChange={e => handleChange('wantsPhotorealisticRender', e.target.checked)}
          />
          <span>Zanima me i fotorealistični prikaz prostora za klijenta</span>
        </label>
      </fieldset>

      {/* 4. Datoteke za projekt */}
      <fieldset className="space-y-4 rounded-2xl bg-white/70 dark:bg-white/8 p-5 sm:p-6 md:p-7 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50">
        <legend className="sr-only">Datoteke za projekt</legend>
        <div className="mb-3 text-lg font-semibold leading-snug text-plum/90 dark:text-pearl" aria-hidden="true">
          4. Datoteke za projekt (opcionalno)
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Ako imate skice, tlocrte, fotografije ili 3D eksport, možete ih priložiti ovdje.
        </p>

        <div>
          <div className="space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Skice / tlocrti / fotografije (PDF, slika...)</span>
            <div className="flex items-center gap-3 mt-2">
              <label className="interiors-upload-action inline-flex min-h-[44px] cursor-pointer items-center rounded-full bg-violet-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-800">
                Odaberi datoteke
                <input
                  type="file"
                  accept=".pdf,image/*"
                  multiple
                  className="sr-only"
                  onChange={handleKitchenSketchFilesChange}
                />
              </label>
              {kitchenSketchFiles.length > 0 && (
                <span className="text-xs text-slate-500">
                  Odabrano datoteka: {kitchenSketchFiles.length}
                </span>
              )}
            </div>
            {kitchenSketchFiles.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                {kitchenSketchFiles.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
                      <span className="min-w-0 break-all font-medium">{file.name}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Ukloni ${file.name}`}
                      onClick={() => removeKitchenSketchFile(index)}
                      className="ml-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <div className="space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>3D datoteke (.fbx, .obj, .zip, .3ds, .skp)</span>
            <div className="flex items-center gap-3 mt-2">
              <label className="interiors-upload-action inline-flex min-h-[44px] cursor-pointer items-center rounded-full bg-violet-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-800">
                Odaberi datoteke
                <input
                  type="file"
                  accept=".fbx,.obj,.zip,.3ds,.skp"
                  multiple
                  className="sr-only"
                  onChange={handleCarpenterExportFilesChange}
                />
              </label>
              {exportFiles.length > 0 && (
                <span className="text-xs text-slate-500">
                  Odabrano datoteka: {exportFiles.length}
                </span>
              )}
            </div>
            {exportFiles.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                {exportFiles.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
                      <span className="min-w-0 break-all font-medium">{file.name}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Ukloni ${file.name}`}
                      onClick={() => removeExportFile(index)}
                      className="ml-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </fieldset>

      {/* 5. Kontakt preferencije */}
      <fieldset className="space-y-4 rounded-2xl bg-white/70 dark:bg-white/8 p-5 sm:p-6 md:p-7 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50">
        <legend className="sr-only">Kontakt preferencije</legend>
        <div className="mb-3 text-lg font-semibold leading-snug text-plum/90 dark:text-pearl" aria-hidden="true">
          5. Kontakt preferencije
        </div>

        <div>
          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Način kontaktiranja *</span>
            <select
              id="contactPreference"
              name="contactPreference"
              aria-required="true"
              aria-invalid={Boolean(errors.contactPreference)}
              aria-describedby={errors.contactPreference ? "carpenter-contactPreference-error" : undefined}
              className={`${selectClass} ${errors.contactPreference ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
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
          {errors.contactPreference && <p id="carpenter-contactPreference-error" className="interiors-field-error mt-1 text-sm">{errors.contactPreference}</p>}
        </div>

        <div>
          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Najbolje vrijeme za kontakt (opcionalno)</span>
            <input
              type="text"
              className={inputClass}
              value={values.bestContactTime}
              onChange={e => handleChange('bestContactTime', e.target.value)}
              placeholder="npr. radnim danom od 8 do 16h"
            />
          </label>
        </div>
      </fieldset>

      {/* VR opcije — samo kad je vrEnabled */}
      {vrEnabled && (
        <fieldset className="space-y-4 rounded-2xl bg-white/70 dark:bg-white/8 p-5 sm:p-6 md:p-7 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50">
          <legend className="sr-only">VR opcije</legend>
          <div className="mb-3 text-lg font-semibold leading-snug text-plum/90 dark:text-pearl" aria-hidden="true">
            VR opcije
          </div>

          <div>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 accent-violet-500"
                checked={values.wantsVr}
                onChange={e => handleChange('wantsVr', e.target.checked)}
              />
              <span>{language === 'hr' ? 'Želim VR obilazak prostora za svog klijenta' : 'I want VR walkthrough for my client'}</span>
            </label>
          </div>

          {values.wantsVr && (
            <>
              <div>
                <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
                  <span>{language === 'hr' ? 'Za koliko klijenata godišnje bi ti otprilike trebao VR?' : 'For how many clients per year would you approximately need VR?'}</span>
                  <input
                    type="number"
                    id="vrForClientsPerYear"
                    aria-invalid={Boolean(errors.vrForClientsPerYear)}
                    aria-describedby={errors.vrForClientsPerYear ? 'carpenter-vrForClientsPerYear-error' : undefined}
                    className={inputClass}
                    value={values.vrForClientsPerYear}
                    onChange={e => handleChange('vrForClientsPerYear', e.target.value)}
                    placeholder="npr. 10"
                    min="1"
                  />
                </label>
                {errors.vrForClientsPerYear && (
                  <p id="carpenter-vrForClientsPerYear-error" className="interiors-field-error mt-1 text-sm">
                    {errors.vrForClientsPerYear}
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm sm:text-base font-medium text-plum/90 dark:text-pearl mb-2">
                  {language === 'hr' ? 'Što trebaš od mene?' : 'What do you need from me?'}
                </p>
                <div className="grid gap-2 sm:grid-cols-1">
                  {VR_NEEDS_OPTIONS.map(option => (
                    <label key={option} className="flex items-start gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="mt-1 accent-violet-500"
                        checked={values.vrNeeds.includes(option)}
                        onChange={() => handleToggleMulti('vrNeeds', option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </fieldset>
      )}

      {isUploading && (
        <div className="mt-4 rounded-xl bg-white/90 px-4 py-4 shadow-sm border border-violet-200">
          <UploadProgress
            progress={uploadProgress}
            currentFile={currentFile}
            totalFiles={exportFiles.length + kitchenSketchFiles.length}
            currentFileIndex={currentFileIndex}
          />
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="interiors-form-submit inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-violet-700 sm:w-auto px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-violet-800 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting
            ? (language === 'hr' ? 'Šaljem...' : 'Sending...')
            : (language === 'hr' ? 'Pošalji upit za projekt' : 'Send project inquiry')}
        </button>
        <p className="max-w-md text-center text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          {language === 'hr'
            ? 'Poslovni kontakt podaci i priložene datoteke koriste se isključivo za pregled upita, pripremu ponude i komunikaciju o mogućoj suradnji. '
            : 'Business contact details and uploaded files are used only to review your inquiry, prepare an offer, and communicate about a possible collaboration. '}
          <Link
            to="/politika-privatnosti"
            className="underline underline-offset-2 hover:text-violet-500 transition-colors"
          >
            {language === 'hr' ? 'Saznajte više u Politici privatnosti.' : 'Learn more in the Privacy Policy.'}
          </Link>
        </p>
      </div>
    </form>
  )
}
