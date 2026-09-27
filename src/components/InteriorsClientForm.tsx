// src/components/InteriorsClientForm.tsx
import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAdminStore, type AdminStoreState } from '../lib/admin.store'
import { trackEvent } from '../lib/analytics'
import { createClient, createProject, uploadProjectFileToStorage, type VrLocationPreference, type VrPackagePreference } from '../lib/interiors'
import {
  MAX_INSPIRATION_IMAGES,
  MAX_PROJECT_FILE_SIZE_BYTES,
  isValidInspirationFileState,
  selectInspirationFiles,
  type InspirationFileRejections,
} from '../lib/interiorsInspirationFiles'
import { UploadProgress } from './UploadProgress'

export interface StolarOption {
  id: string
  name: string // npr. "Josip Radat"
}

export interface ClientProjectFormValues {
  clientName: string
  email: string
  phone: string

  projectType: string
  location: string
  spaceStatus: string

  hasPlan: 'plan' | 'photos' | 'none' | ''
  planFiles: File[]
  photoFiles: File[]

  approxWidth: string
  approxLength: string
  approxHeight: string
  specialFeatures: string[]

  style: string[]
  mood: string[]
  colorPreference: string[]

  mainUsers: string
  priority: string[]

  budgetRange: string
  desiredStartDate: string
  flexibility: string

  hasOwnStolar: 'yes' | 'no' | ''
  stolarId: string
  stolarNotRegistered: string
  needStolarRecommendation: boolean

  projectNote: string

  contactPreference: string
  contactTime: string

  wantsVr: boolean
  vrLocationPreference: VrLocationPreference | null
  vrPackagePreference: VrPackagePreference | null

  /** Optional add-on; stored in project notes until DB field exists */
  wantsPhotorealisticRender: boolean
}

interface InteriorsClientFormProps {
  stolars: StolarOption[]
  onSubmit?: (values: ClientProjectFormValues) => void
  language?: 'hr' | 'en'
}

const INITIAL_VALUES: ClientProjectFormValues = {
  clientName: '',
  email: '',
  phone: '',

  projectType: '',
  location: '',
  spaceStatus: '',

  hasPlan: '',
  planFiles: [],
  photoFiles: [],

  approxWidth: '',
  approxLength: '',
  approxHeight: '',
  specialFeatures: [],

  style: [],
  mood: [],
  colorPreference: [],

  mainUsers: '',
  priority: [],

  budgetRange: '',
  desiredStartDate: '',
  flexibility: '',

  hasOwnStolar: '',
  stolarId: '',
  stolarNotRegistered: '',
  needStolarRecommendation: false,

  projectNote: '',

  contactPreference: '',
  contactTime: '',

  wantsVr: false,
  vrLocationPreference: null,
  vrPackagePreference: null,

  wantsPhotorealisticRender: false,
}

const BUDGET_RANGE_LABELS_HR: Record<string, string> = {
  '0-1000': 'do 1.000 €',
  '1000-3000': '1.000 – 3.000 €',
  '3000-7000': '3.000 – 7.000 €',
  '7000+': 'iznad 7.000 €',
  unknown: 'Ne znam, trebam okvirnu procjenu',
}

export function InteriorsClientForm({ stolars: _stolarsUnused, onSubmit, language = 'hr' }: InteriorsClientFormProps) {
  void _stolarsUnused
  const inputClass =
    "w-full rounded-xl border border-slate-200 dark:border-lavender/20 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-900/30 focus:border-violet-400 dark:focus:border-violet-500 text-plum/90 dark:text-pearl placeholder:text-plum/60 dark:placeholder:text-pearl/50";

  const textareaClass =
    "w-full rounded-xl border border-slate-200 dark:border-lavender/20 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm shadow-inner resize-y min-h-[96px] focus:outline-none focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-900/30 focus:border-violet-400 dark:focus:border-violet-500 text-plum/90 dark:text-pearl placeholder:text-plum/60 dark:placeholder:text-pearl/50";

  const selectClass = inputClass;

  const [values, setValues] = useState<ClientProjectFormValues>(INITIAL_VALUES)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedPlanFileNames, setSelectedPlanFileNames] = useState<string[]>([])
  const [selectedPhotoFileNames, setSelectedPhotoFileNames] = useState<string[]>([])
  const [inspirationFiles, setInspirationFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState<string>()
  const [currentFileIndex, setCurrentFileIndex] = useState(1)
  const selectedInspirationFileNames = inspirationFiles.map((file) => file.name)
  const maxInspirationFileSizeMiB =
    MAX_PROJECT_FILE_SIZE_BYTES / (1024 * 1024)
  const inspirationLimitReached =
    inspirationFiles.length >= MAX_INSPIRATION_IMAGES

  useEffect(() => {
    setSelectedPhotoFileNames(values.photoFiles.map((f) => f.name))
  }, [values.photoFiles])

  const addInteriorsRequest = useAdminStore((state: AdminStoreState) => state.addInteriorsRequest)

  const translations = {
    errors: {
      nameRequired: {
        hr: 'Ime i prezime ili naziv klijenta je obavezno',
        en: 'Client name is required'
      },
      emailRequired: {
        hr: 'Email je obavezan',
        en: 'Email is required'
      },
      emailInvalid: {
        hr: 'Molimo unesite valjanu email adresu',
        en: 'Please enter a valid email address'
      },
      phoneRequired: {
        hr: 'Molim te, upiši broj mobitela kako bih te mogla kontaktirati.',
        en: 'Please enter your phone number so I can contact you.'
      },
      projectTypeRequired: {
        hr: 'Molimo odaberite tip prostora',
        en: 'Please select space type'
      },
      locationRequired: {
        hr: 'Molimo unesite grad ili lokaciju',
        en: 'Please enter city or location'
      },
      projectDescriptionRequired: {
        hr: 'Molimo unesite opis projekta (najmanje 10 znakova)',
        en: 'Please enter project description (at least 10 characters)'
      },
    },
    success: {
      hr: 'Hvala ti na povjerenju! Tvoj upit za interijerski projekt je zaprimljen. Javit ću ti se povratno s informacijama i prijedlozima u najkraćem mogućem roku.',
      en: 'Thank you for your trust! Your interior project inquiry has been received. I will get back to you with information and proposals as soon as possible.'
    },
    vr: {
      wantsVr: {
        hr: 'Želim ponudu i za VR šetnju mojim budućim interijerom',
        en: 'I want a quote for VR walkthrough of my future interior'
      },
      locationTitle: {
        hr: 'Gdje želite VR prezentaciju?',
        en: 'Where would you like the VR presentation?'
      },
      locationStudio: {
        hr: 'Kod Ane u studiju',
        en: 'At Ana\'s studio'
      },
      locationClientHome: {
        hr: 'Kod mene doma',
        en: 'At my home'
      },
      locationUnsure: {
        hr: 'Nisam siguran, treba mi savjet',
        en: 'I\'m not sure, I need advice'
      },
      packageTitle: {
        hr: 'Koji VR paket vas zanima?',
        en: 'Which VR package interests you?'
      },
      package3dVr: {
        hr: '3D projekt + VR obilazak',
        en: '3D project + VR walkthrough'
      },
      package3dVrOnline: {
        hr: '3D + VR + online za obitelj',
        en: '3D + VR + online for family'
      },
      packageUnsure: {
        hr: 'Nisam siguran',
        en: 'I\'m not sure'
      }
    },
    error: {
      hr: 'Greška pri spremanju, pokušaj ponovno.',
      en: 'Error saving, please try again.'
    },
    fileUpload: {
      selectedFile: {
        hr: 'Odabrana datoteka:',
        en: 'Selected file:'
      },
      noFileSelected: {
        hr: 'Niste još odabrali datoteku.',
        en: 'No file selected yet.'
      },
      noFilesSelected: {
        hr: 'Niste još odabrali datoteke.',
        en: 'No files selected yet.'
      },
      oneFileSelectedLabel: {
        hr: 'Odabrana datoteka:',
        en: 'Selected file:'
      },
      multipleFilesSelectedLabel: {
        hr: 'Odabrane datoteke:',
        en: 'Selected files:'
      }
    }
  }

  function handleChange(
    field: keyof ClientProjectFormValues,
    value: ClientProjectFormValues[typeof field]
  ) {
    setValues(prev => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [field]: _, ...rest } = prev
        return rest
      })
    }
  }

  type FileField = 'planFile' | 'photoFiles' | 'inspirationFiles'

  function removePhotoFile(index: number) {
    setValues((prev) => ({
      ...prev,
      photoFiles: prev.photoFiles.filter((_, i) => i !== index),
    }))
  }

  function clearInspirationFileError() {
    setErrors((prev) => {
      if (!prev.inspirationFiles) return prev
      const next = { ...prev }
      delete next.inspirationFiles
      return next
    })
  }

  function showInspirationFileFeedback(rejections: InspirationFileRejections) {
    const messages: string[] = []
    if (rejections.overLimit.length > 0) {
      messages.push(
        language === 'hr'
          ? `Dopušteno je najviše ${MAX_INSPIRATION_IMAGES} inspiracijskih fotografija. Dodano je samo onoliko novih fotografija koliko je bilo slobodnih mjesta.`
          : `A maximum of ${MAX_INSPIRATION_IMAGES} inspiration images is allowed. Only the images that fit the remaining slots were added.`
      )
    }
    if (rejections.unsupportedType.length > 0) {
      messages.push(
        language === 'hr'
          ? 'Neke datoteke nisu dodane. Podržani su samo JPG, JPEG i PNG formati.'
          : 'Some files were not added. Only JPG, JPEG, and PNG formats are supported.'
      )
    }
    if (rejections.oversized.length > 0) {
      messages.push(
        language === 'hr'
          ? `Neke datoteke nisu dodane jer su veće od ${maxInspirationFileSizeMiB} MiB.`
          : `Some files were not added because they exceed ${maxInspirationFileSizeMiB} MiB.`
      )
    }
    if (rejections.duplicate.length > 0) {
      messages.push(
        language === 'hr'
          ? 'Fotografija koja je već odabrana nije dodana ponovno.'
          : 'An image that was already selected was not added again.'
      )
    }
    if (messages.length > 0) {
      toast.error(messages.join(' '), { duration: 7000 })
    }
  }

  function removeInspirationFile(index: number) {
    setInspirationFiles((prev) => prev.filter((_, i) => i !== index))
    clearInspirationFileError()
  }

  function removePlanFile(index: number) {
    setValues((prev) => ({
      ...prev,
      planFiles: prev.planFiles.filter((_, i) => i !== index),
    }))
    setSelectedPlanFileNames((prev) => prev.filter((_, i) => i !== index))
  }

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    field: FileField
  ) => {
    const files = event.target.files
    if (!files) return

    if (field === 'planFile') {
      const incoming = Array.from(files)

      setValues((prev) => {
        const merged = [...prev.planFiles]
        for (const f of incoming) {
          const alreadyExists = merged.some(
            (p) =>
              p.name === f.name &&
              p.size === f.size &&
              p.lastModified === f.lastModified
          )
          if (!alreadyExists) merged.push(f)
        }
        return { ...prev, planFiles: merged }
      })

      setSelectedPlanFileNames((prev) => {
        const merged = [...prev]
        for (const f of incoming) {
          if (!merged.includes(f.name)) merged.push(f.name)
        }
        return merged
      })

      event.target.value = ''
      return
    } else if (field === 'inspirationFiles') {
      const incoming = Array.from(files)
      const selection = selectInspirationFiles(inspirationFiles, incoming)
      setInspirationFiles(selection.files)
      clearInspirationFileError()
      showInspirationFileFeedback(selection.rejections)

      // ne diramo values.inspirationFiles – to polje ni ne postoji u tipu
      event.target.value = ''
      return
    } else {
      const incoming = Array.from(files)

      setValues((prev) => {
        const merged = [...prev.photoFiles]

        for (const f of incoming) {
          const alreadyExists = merged.some(
            (p) =>
              p.name === f.name &&
              p.size === f.size &&
              p.lastModified === f.lastModified
          )

          if (!alreadyExists) {
            merged.push(f)
          }
        }

        return {
          ...prev,
          photoFiles: merged,
        }
      })

      event.target.value = ''
    }
  }


  function validate(values: ClientProjectFormValues): { isValid: boolean; errors: Record<string, string>; firstErrorField: string | null } {
    const newErrors: Record<string, string> = {}

    // Validate name
    if (!values.clientName.trim()) {
      newErrors.clientName = translations.errors.nameRequired[language]
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

    // Validate phone
    if (!values.phone.trim()) {
      newErrors.phone = translations.errors.phoneRequired[language]
    }

    // Validate project type
    if (!values.projectType) {
      newErrors.projectType = translations.errors.projectTypeRequired[language]
    }

    // Validate location
    if (!values.location.trim()) {
      newErrors.location = translations.errors.locationRequired[language]
    }

    // Validate project description (projectNote)
    if (!values.projectNote.trim() || values.projectNote.trim().length < 10) {
      newErrors.projectNote = translations.errors.projectDescriptionRequired[language]
    }

    const firstErrorField = Object.keys(newErrors)[0] || null

    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors,
      firstErrorField
    }
  }

  function parseBudgetLowerBoundEur(budgetRange: string): number | null {
    if (!budgetRange || budgetRange === 'unknown') return null
    const m = budgetRange.match(/(\d+)/)
    if (!m) return null
    return parseFloat(m[0])
  }

  function buildClientInquiryNotes(
    v: ClientProjectFormValues,
    inspirationCount: number
  ): string | null {
    const main = v.projectNote.trim()
    const extras: string[] = []

    // Snapshot kontaktnih podataka ovog upita (uvijek prisutan)
    extras.push(`Kontakt ime: ${v.clientName.trim()}`)
    extras.push(`Email: ${v.email.trim()}`)
    extras.push(`Telefon: ${v.phone.trim() || '—'}`)

    if (v.contactPreference.trim()) {
      extras.push(`Način kontakta: ${v.contactPreference}`)
    }
    if (v.contactTime.trim()) {
      extras.push(`Najbolje vrijeme za kontakt: ${v.contactTime.trim()}`)
    }
    if (v.spaceStatus) {
      const label =
        v.spaceStatus === 'existing'
          ? 'Postojeći – renovacija'
          : v.spaceStatus === 'new'
            ? 'Potpuno novi (novogradnja)'
            : v.spaceStatus
      extras.push(`Stanje prostora: ${label}`)
    }
    if (v.stolarNotRegistered.trim()) {
      extras.push(`Stolar: ${v.stolarNotRegistered.trim()}`)
    }
    const dimParts: string[] = []
    if (v.approxWidth.trim()) dimParts.push(`širina ${v.approxWidth.trim()} cm`)
    if (v.approxLength.trim()) dimParts.push(`dužina ${v.approxLength.trim()} cm`)
    if (v.approxHeight.trim()) dimParts.push(`visina ${v.approxHeight.trim()} cm`)
    if (dimParts.length) {
      extras.push(`Dimenzije prostora (cca): ${dimParts.join(', ')}`)
    }
    if (v.budgetRange) {
      const label = BUDGET_RANGE_LABELS_HR[v.budgetRange] ?? v.budgetRange
      extras.push(`Okvirni budžet [${v.budgetRange}]: ${label}`)
    }
    if (v.hasPlan) {
      const hasPlanLabel =
        v.hasPlan === 'plan'
          ? 'Imam tlocrt / plan'
          : v.hasPlan === 'photos'
            ? 'Imam samo fotografije ili skice'
            : v.hasPlan === 'none'
              ? 'Nemam tlocrt ni fotografije'
              : v.hasPlan
      extras.push(`Dokumentacija: ${hasPlanLabel}`)
    }
    if (inspirationCount > 0) {
      extras.push(`Broj priloženih slika inspiracije: ${inspirationCount}`)
    }
    if (v.photoFiles.length > 0) {
      extras.push(
        `Broj priloženih fotografija prostora: ${v.photoFiles.length}`
      )
    }
    extras.push(
      `Fotorealistični prikaz prostora: ${v.wantsPhotorealisticRender ? 'DA' : 'NE'}`
    )

    if (!main && extras.length === 0) return null
    if (!main) return extras.join('\n')
    if (extras.length === 0) return main
    return `${main}\n\n--- Upit (dodatno) ---\n${extras.join('\n')}`
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!isValidInspirationFileState(inspirationFiles)) {
      const message =
        language === 'hr'
          ? `Provjeri inspiracijske fotografije. Dopušteno je najviše ${MAX_INSPIRATION_IMAGES} JPG/JPEG ili PNG fotografija, do ${maxInspirationFileSizeMiB} MiB po datoteci.`
          : `Check the inspiration images. A maximum of ${MAX_INSPIRATION_IMAGES} JPG/JPEG or PNG images is allowed, up to ${maxInspirationFileSizeMiB} MiB per file.`
      setErrors((prev) => ({ ...prev, inspirationFiles: message }))
      toast.error(message, { duration: 7000 })
      document.getElementById('inspiration-file-input')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      return
    }

    const validation = validate(values)
    setErrors(validation.errors)

    if (!validation.isValid) {
      // Focus first error field
      if (validation.firstErrorField) {
        setTimeout(() => {
          const field = document.getElementById(validation.firstErrorField!) || 
                       document.querySelector(`[name="${validation.firstErrorField}"]`) ||
                       document.querySelector(`input[name="${validation.firstErrorField}"], select[name="${validation.firstErrorField}"], textarea[name="${validation.firstErrorField}"]`)
          if (field) {
            field.focus()
            field.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
      }
      return
    }

    // Clear all errors
    setErrors({})
    setIsSubmitting(true)

    try {
      // Dimenzije su u cm: površina u m² = (cm/100) * (cm/100)
      let areaM2: number | null = null
      if (values.approxWidth && values.approxLength) {
        const widthCm = parseFloat(values.approxWidth.replace(/[^\d.,]/g, '').replace(',', '.'))
        const lengthCm = parseFloat(values.approxLength.replace(/[^\d.,]/g, '').replace(',', '.'))
        if (
          !isNaN(widthCm) &&
          !isNaN(lengthCm) &&
          widthCm > 0 &&
          lengthCm > 0
        ) {
          areaM2 = (widthCm / 100) * (lengthCm / 100)
        }
      }

      const budget: number | null = parseBudgetLowerBoundEur(values.budgetRange)

      const inspirationCount = inspirationFiles.length
      const photoFilesArray = [...values.photoFiles]

      const combinedNotes = buildClientInquiryNotes(
        { ...values, photoFiles: photoFilesArray },
        inspirationCount
      )

      // Create client — bez duplikata napomena na profilu; puni tekst je na projektu
      const client = await createClient({
        name: values.clientName.trim(),
        email: values.email.trim(),
        phone: values.phone.trim() || null,
        language: language,
        notes: null,
      })

      // Create project — VR polja ostaju u šemi, ali javni klijentski upit trenutno ne nudi VR u UI-u
      const project = await createProject({
        title: `Projekt za ${values.clientName.trim()} – ${values.projectType || 'Nepoznato'}`,
        user_type: 'client',
        client_id: client.id,
        carpenter_id: null,
        drawn_by: 'ani',
        uses_corpus: true,
        wants_vr: false,
        vr_location_preference: null,
        vr_package_preference: null,
        status: 'inquiry',
        space_type: values.projectType || null,
        area_m2: areaM2,
        budget: budget,
        notes: combinedNotes,
        review_request_sent_at: null,
      })

      const totalFiles =
        (values.planFiles?.length || 0) +
        inspirationFiles.length +
        photoFilesArray.length
      
      if (totalFiles > 0) {
        setIsUploading(true)
        setUploadProgress(0)
        setCurrentFileIndex(1)
        
        try {
          const allFiles: Array<{ file: File; type: "plan" | "inspiration" | "space_photo" }> = []

          if (values.planFiles && values.planFiles.length > 0) {
            for (const file of values.planFiles) {
              allFiles.push({ file, type: "plan" })
            }
          }

          if (inspirationFiles.length > 0) {
            for (const file of inspirationFiles) {
              allFiles.push({ file, type: "inspiration" })
            }
          }

          for (const file of photoFilesArray) {
            allFiles.push({ file, type: "space_photo" })
          }
          
          // Upload files sequentially; track per-file failures without aborting
          let uploadFailCount = 0
          for (let i = 0; i < allFiles.length; i++) {
            const { file, type } = allFiles[i]
            setCurrentFile(file.name)
            setCurrentFileIndex(i + 1)

            try {
              await uploadProjectFileToStorage(project.id, file, type)
            } catch (uploadError) {
              uploadFailCount++
              console.error(
                "[InteriorsClientForm] File upload failed:",
                { fileName: file.name, fileType: type },
                uploadError instanceof Error ? uploadError.message : uploadError
              )
            }

            // Update progress regardless of individual file success/failure
            const progress = ((i + 1) / totalFiles) * 100
            setUploadProgress(progress)
          }

          setUploadProgress(100)

          if (uploadFailCount > 0) {
            toast(
              language === 'hr'
                ? `Upit je poslan, ali ${uploadFailCount === 1 ? 'jedna datoteka nije učitana' : `${uploadFailCount} datoteke nisu učitane`}. Molimo pošaljite ih naknadno ili nas kontaktirajte.`
                : `Request sent, but ${uploadFailCount} file(s) could not be uploaded. Please resend them or contact us.`,
              { icon: '⚠️', duration: 8000 }
            )
          }
        } catch (uploadError) {
          console.error(
            "[InteriorsClientForm] Unexpected error in upload block:",
            uploadError
          )
        } finally {
          setIsUploading(false)
          setCurrentFile(undefined)
          setUploadProgress(0)
          setCurrentFileIndex(1)
        }
      }

      // Reset poruke o odabranom tlocrtu odmah nakon uspješnog slanja
      setSelectedPlanFileNames([])

      // Save to admin store (keep existing behavior)
      addInteriorsRequest({
        clientName: values.clientName || '',
        email: values.email || '',
        spaceType: values.projectType || 'Nije odabrano',
        city: values.location || '',
        stolarId: null,
      })

      if (onSubmit) {
        // ne šalji File objekte u callback
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { planFiles, photoFiles, ...valuesWithoutFiles } = values

        onSubmit(valuesWithoutFiles as ClientProjectFormValues)
      }

      // Show success toast
      toast.success(
        language === 'hr'
          ? '✨ Uspješno! Vaš zahtjev je poslan. Javit ćemo Vam se uskoro.'
          : '✨ Success! Your request has been sent. We will contact you soon.',
        { duration: 5000 }
      )
      trackEvent('form_submit_success', { form: 'interiors-client' })

      // Reset form immediately
      setValues(INITIAL_VALUES)
      setSelectedPlanFileNames([])
      setSelectedPhotoFileNames([])
      setInspirationFiles([])
    } catch (error) {
      console.error('Error submitting client form:', error)

      // dodatne informacije ako je običan Error objekt
      if (error instanceof Error) {
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      }

      // ako je "Supabase-stil" error ili bilo što s .message
      if (error && typeof error === 'object' && 'message' in error) {
        try {
          console.error(
            'Supabase error details:',
            JSON.stringify(error, null, 2)
          )
        } catch {
          // ako JSON.stringify pukne, ignoriraj
        }
      }

      // Show error toast
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
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-8 pb-1">
      {/* Naslov i podnaslov */}
      <div className="space-y-2 text-center mb-6">
        <h2 className="text-xl font-semibold text-plum/90 dark:text-pearl">
          Naručite svoj 3D prikaz interijera po mjeri
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 dark:text-slate-400">
          Ispunite formu s približnim dimenzijama u centimetrima, potrebama i opisom. Javit ćemo vam se u najkraćem mogućem roku.
        </p>
      </div>

      {/* Legenda za checkboxe i radio gumbe */}
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Legenda: kružić (◉) znači da možeš odabrati <span className="font-semibold">samo jednu</span> opciju, a kvadratić (☑) da možeš odabrati <span className="font-semibold">više</span> opcija.
      </p>

      {/* Kontakt podaci */}
      <fieldset className="space-y-4 rounded-2xl bg-white/70 dark:bg-white/8 dark:bg-white/8 p-5 sm:p-6 md:p-7 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50 dark:ring-slate-700/50">
        <legend className="sr-only">Kontakt podaci</legend>
        <div className="mb-3 text-lg font-semibold leading-snug text-plum/90 dark:text-pearl" aria-hidden="true">
          Kontakt podaci
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Ove informacije koristimo za kontaktiranje u vezi vašeg projekta.</p>

        <div>
          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Ime i prezime / naziv klijenta *</span>
            <input
              type="text"
              id="clientName"
              name="clientName"
              className={`${inputClass} ${errors.clientName ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
              value={values.clientName}
              onChange={e => handleChange('clientName', e.target.value)}
            />
          </label>
          {errors.clientName && (
            <p className="text-xs text-red-500 mt-1">{errors.clientName}</p>
          )}
        </div>

        <div>
          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Email *</span>
            <input
              type="email"
              id="email"
              name="email"
              className={`${inputClass} ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
              value={values.email}
              onChange={e => handleChange('email', e.target.value)}
            />
          </label>
          {errors.email && (
            <p className="text-xs text-red-500 mt-1">{errors.email}</p>
          )}
        </div>

        <div>
          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>{language === 'hr' ? 'Broj mobitela *' : 'Phone number *'}</span>
            <input
              type="tel"
              id="phone"
              name="phone"
              className={`${inputClass} ${errors.phone ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
              value={values.phone}
              onChange={e => handleChange('phone', e.target.value)}
              placeholder={language === 'hr' ? 'npr. 095 123 4567' : 'e.g. +385 95 123 4567'}
            />
          </label>
          {errors.phone && (
            <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
          )}
        </div>

        <div>
          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Kako želiš da te kontaktiram?</span>
            <select
              id="contactPreference"
              name="contactPreference"
              value={values.contactPreference}
              onChange={e => handleChange('contactPreference', e.target.value)}
              className={selectClass}
            >
              <option value="">Odaberi (opcionalno)...</option>
              <option value="email">Email</option>
              <option value="phone">Telefon</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="viber">Viber</option>
            </select>
          </label>
        </div>

        <div>
          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Kada ti najviše odgovara da te kontaktiram?</span>
            <input
              type="text"
              id="contactTime"
              name="contactTime"
              placeholder="npr. radnim danom od 17 do 20h"
              className={inputClass}
              value={values.contactTime}
              onChange={e => handleChange('contactTime', e.target.value)}
            />
            <span className="text-xs text-slate-500">Navedite preferirano vrijeme za kontakt (opcionalno)</span>
          </label>
        </div>
      </fieldset>

      {/* KORAK 1 – Osnovne informacije */}
      <fieldset className="space-y-4 rounded-2xl bg-white/70 dark:bg-white/8 dark:bg-white/8 p-5 sm:p-6 md:p-7 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50 dark:ring-slate-700/50">
        <legend className="sr-only">Osnovne informacije o prostoru</legend>
        <div className="mb-3 text-lg font-semibold leading-snug text-plum/90 dark:text-pearl" aria-hidden="true">
          Osnovne informacije o prostoru
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
              <span>Tip prostora *</span>
              <select
                id="projectType"
                name="projectType"
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
            {errors.projectType && (
              <p className="text-xs text-red-500 mt-1">{errors.projectType}</p>
            )}
          </div>

          <div>
            <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
              <span>Grad / lokacija *</span>
              <input
                type="text"
                id="location"
                name="location"
                value={values.location}
                onChange={e => handleChange('location', e.target.value)}
                className={`${inputClass} ${errors.location ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
              />
            </label>
            {errors.location && (
              <p className="text-xs text-red-500 mt-1">{errors.location}</p>
            )}
          </div>

          <div>
            <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
              <span>Prostor je</span>
              <select
                id="spaceStatus"
                name="spaceStatus"
                value={values.spaceStatus}
                onChange={e => handleChange('spaceStatus', e.target.value)}
                className={selectClass}
              >
                <option value="">Odaberi (opcionalno)...</option>
                <option value="existing">Postojeći – renovacija</option>
                <option value="new">Potpuno novi (novogradnja)</option>
              </select>
            </label>
          </div>
        </div>
      </fieldset>

      {/* KORAK 2 – Dimenzije i postojeće stanje */}
      <fieldset className="space-y-4 rounded-2xl bg-white/70 dark:bg-white/8 p-5 sm:p-6 md:p-7 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50">
        <legend className="sr-only">Dimenzije i postojeće stanje</legend>
        <div className="mb-3 text-lg font-semibold leading-snug text-plum/90 dark:text-pearl" aria-hidden="true">
          Dimenzije i postojeće stanje
        </div>

        <div id="hasPlan">
          <p className="text-sm sm:text-base font-medium text-plum/90 dark:text-pearl mb-2">Imaš li tlocrt ili skicu?</p>
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
              <span>Imam tlocrt</span>
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
              <span>Imam samo fotografije / skice</span>
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
              <span>Nemam ništa od navedenog</span>
            </label>
          </div>
        </div>

        {values.hasPlan === 'plan' && (
          <div className="space-y-2">
            <p className="block text-sm font-medium text-plum/90 dark:text-pearl">
              Tlocrt prostora (PDF ili slika)
            </p>
            <p className="text-xs text-slate-500">
              Možeš učitati više datoteka (preporučeno 3–5, PDF ili slike).
            </p>

            <div className="flex items-center gap-3 mt-2">
              {/* Gumb za tlocrt – isti stil kao inspiracije */}
              <label className="inline-flex cursor-pointer items-center rounded-full bg-violet-500 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-violet-600">
                Odaberi datoteke
                <input
                  id="plan-file-input"
                  type="file"
                  accept=".pdf,image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileChange(e, 'planFile')}
                />
              </label>
            </div>

            {selectedPlanFileNames.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                {selectedPlanFileNames.map((name, i) => (
                  <li key={`${name}-${i}`} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
                      <span className="font-medium">{name}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Ukloni ${name}`}
                      onClick={() => removePlanFile(i)}
                      className="ml-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {(values.hasPlan === 'photos' || values.hasPlan === 'none') && (
          <div className="space-y-2">
            <p className="block text-sm sm:text-base font-medium text-plum/90 dark:text-pearl">
              Učitaj fotografije prostora
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="interiors-space-photo-input"
                className="inline-flex cursor-pointer items-center rounded-full bg-violet-500 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-violet-600"
              >
                Odaberi datoteke
              </label>
              <input
                id="interiors-space-photo-input"
                type="file"
                accept="image/jpeg,image/png,image/jpg,.jpg,.jpeg,.png"
                className="hidden"
                multiple
                onChange={(e) => handleFileChange(e, 'photoFiles')}
              />
              <span className="text-xs text-slate-500">
                Možeš u jednom koraku odabrati više slika ili više puta pritisnuti gumb — sve se zbraja na listu ispod.
              </span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              {selectedPhotoFileNames.length === 0 ? (
                translations.fileUpload.noFilesSelected[language]
              ) : (
                <ul className="mt-1 space-y-1">
                  {selectedPhotoFileNames.map((name, i) => (
                    <li key={`${name}-${i}`} className="flex items-center justify-between gap-2">
                      <span>{name}</span>
                      <button
                        type="button"
                        aria-label={`Ukloni ${name}`}
                        onClick={() => removePhotoFile(i)}
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
        )}

        {/* Dimenzije prostora (cm) */}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Širina prostora (cca, cm)</span>
            <input
              type="text"
              className={inputClass}
              value={values.approxWidth}
              onChange={e => handleChange('approxWidth', e.target.value)}
              placeholder="npr. 350"
            />
            <span className="text-xs text-slate-500">Približna širina u centimetrima</span>
          </label>

          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Dužina prostora (cca, cm)</span>
            <input
              type="text"
              className={inputClass}
              value={values.approxLength}
              onChange={e => handleChange('approxLength', e.target.value)}
              placeholder="npr. 420"
            />
            <span className="text-xs text-slate-500">Približna dužina u centimetrima</span>
          </label>

          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Visina prostora (cca, cm)</span>
            <input
              type="text"
              className={inputClass}
              value={values.approxHeight}
              onChange={e => handleChange('approxHeight', e.target.value)}
              placeholder="npr. 270"
            />
            <span className="text-xs text-slate-500">Približna visina u centimetrima (opcionalno)</span>
          </label>
        </div>
        <p className="rounded-xl bg-violet-50/70 px-4 py-3 text-xs leading-relaxed text-plum/70 dark:bg-violet-300/[0.06] dark:text-pearl/65">
          Mjere i podatke dostavljaš ti, a 3D idejno rješenje izrađuje se prema
          dostavljenim informacijama. Prije stvarne izrade ili ugradnje izvođač
          odnosno stolar treba napraviti završnu izmjeru i tehničku provjeru.
        </p>
      </fieldset>

      {/* Budžet (opcionalno) */}
      <fieldset className="space-y-4 rounded-2xl bg-white/70 dark:bg-white/8 p-5 sm:p-6 md:p-7 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50">
        <legend className="sr-only">Budžet</legend>
        <div className="mb-3 text-lg font-semibold leading-snug text-plum/90 dark:text-pearl" aria-hidden="true">
          Budžet
        </div>

        <div>
          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Okvirni budžet za namještaj</span>
            <select
              id="budgetRange"
              name="budgetRange"
              value={values.budgetRange}
              onChange={e => handleChange('budgetRange', e.target.value)}
              className={selectClass}
            >
              <option value="">Odaberi (opcionalno)...</option>
              <option value="0-1000">do 1.000 €</option>
              <option value="1000-3000">1.000 – 3.000 €</option>
              <option value="3000-7000">3.000 – 7.000 €</option>
              <option value="7000+">iznad 7.000 €</option>
              <option value="unknown">Ne znam, trebam okvirnu procjenu</option>
            </select>
            <span className="text-xs text-slate-500 mt-1 block">Okvirni budžet za namještaj i izradu</span>
          </label>
        </div>
      </fieldset>

      {/* Stolar — jedno polje */}
      <fieldset className="space-y-4 rounded-2xl bg-white/70 dark:bg-white/8 p-5 sm:p-6 md:p-7 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50">
        <legend className="sr-only">Stolar</legend>
        <div className="mb-3 text-lg font-semibold leading-snug text-plum/90 dark:text-pearl" aria-hidden="true">
          Stolar
        </div>

        <div>
          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Imaš li stolara? (ako da, navedi naziv ili ime – neobavezno)</span>
            <input
              type="text"
              id="stolarNotRegistered"
              name="stolarNotRegistered"
              className={inputClass}
              value={values.stolarNotRegistered}
              onChange={e => handleChange('stolarNotRegistered', e.target.value)}
              placeholder="npr. ime i prezime ili naziv tvrtke, 091 234 5678"
            />
          </label>
        </div>
      </fieldset>

      {/* Inspiracija i opis */}
      <fieldset className="space-y-4 rounded-2xl bg-white/70 dark:bg-white/8 p-5 sm:p-6 md:p-7 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50">
        <legend className="sr-only">Inspiracija i opis</legend>
        <div className="mb-3 text-lg font-semibold leading-snug text-plum/90 dark:text-pearl" aria-hidden="true">
          Inspiracija i opis
        </div>

        <div>
          <div className="block space-y-2 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <p>Učitaj slike inspiracije (npr. Pinterest, Instagram)</p>
            <div className="flex flex-wrap items-center gap-3">
              <label
                className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-medium text-white shadow-sm ${
                  inspirationLimitReached
                    ? 'cursor-not-allowed bg-violet-300 opacity-70 dark:bg-violet-800'
                    : 'cursor-pointer bg-violet-500 hover:bg-violet-600'
                }`}
              >
                {inspirationLimitReached ? 'Limit dosegnut' : 'Odaberi datoteke'}
                <input
                  id="inspiration-file-input"
                  type="file"
                  accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                  className="hidden"
                  multiple
                  disabled={inspirationLimitReached}
                  onChange={e => handleFileChange(e, 'inspirationFiles')}
                />
              </label>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  inspirationLimitReached
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-300/15 dark:text-amber-200'
                    : 'bg-violet-100 text-violet-700 dark:bg-violet-300/10 dark:text-lavender'
                }`}
                aria-live="polite"
              >
                {inspirationFiles.length} / {MAX_INSPIRATION_IMAGES} fotografija
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Do {MAX_INSPIRATION_IMAGES} fotografija u JPG/JPEG ili PNG formatu, najviše{' '}
              {maxInspirationFileSizeMiB} MiB po datoteci.
            </p>
            {selectedInspirationFileNames.length === 0 ? (
              <p className="text-xs text-slate-400 mt-1">
                {translations.fileUpload.noFilesSelected[language]}
              </p>
            ) : (
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                <p>
                  {selectedInspirationFileNames.length === 1
                    ? translations.fileUpload.oneFileSelectedLabel[language]
                    : translations.fileUpload.multipleFilesSelectedLabel[language]}
                </p>
                <ul className="list-disc list-inside">
                  {selectedInspirationFileNames.map((name, i) => (
                    <li key={`${name}-${i}`} className="flex items-center justify-between gap-2">
                      <span>{name}</span>
                      <button
                        type="button"
                        aria-label={`Ukloni ${name}`}
                        onClick={() => removeInspirationFile(i)}
                        className="ml-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {errors.inspirationFiles ? (
              <p className="mt-1 text-xs text-red-500">{errors.inspirationFiles}</p>
            ) : null}
          </div>
        </div>

        <div>
          <label className="block space-y-1 text-sm sm:text-base text-plum/90 dark:text-pearl">
            <span>Opiši svojim riječima što ti je najvažnije u ovom prostoru</span>
            <textarea
              id="projectNote"
              name="projectNote"
              value={values.projectNote}
              className={`${textareaClass} ${errors.projectNote ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
              onChange={e => handleChange('projectNote', e.target.value)}
              rows={4}
              placeholder="Opišite svoje želje, prioritete i sve što mislite da bi moglo biti važno za projekt..."
            />
            <span className="text-xs text-slate-500">Najmanje 10 znakova. Opišite detaljno što želite postići u ovom prostoru.</span>
          </label>
          {errors.projectNote && (
            <p className="text-xs text-red-500 mt-1">{errors.projectNote}</p>
          )}
        </div>

      </fieldset>

      <fieldset className="space-y-3 rounded-2xl bg-white/70 dark:bg-white/8 p-5 sm:p-6 md:p-7 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50">
        <legend className="sr-only">Fotorealistični prikaz</legend>
        <div className="text-lg font-semibold leading-snug text-plum/90 dark:text-pearl">
          Dodatna opcija: fotorealistični prikaz prostora
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Ako želiš realističniji prikaz materijala, boja, rasvjete, dekoracija i općeg dojma prostora, možeš označiti ovu opciju. Fotorealistični prikaz nije dio osnovne 3D vizualizacije i posebno se uračunava u ponudu.
        </p>
        <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-pearl/90">
          <input
            type="checkbox"
            className="mt-1 accent-violet-500"
            checked={values.wantsPhotorealisticRender}
            onChange={(e) =>
              handleChange('wantsPhotorealisticRender', e.target.checked)
            }
          />
          <span>Zanima me i fotorealistični prikaz prostora</span>
        </label>
      </fieldset>

      {isUploading && (
        <div className="mt-4 rounded-xl bg-white/90 px-4 py-4 shadow-sm border border-violet-200">
          <UploadProgress
            progress={uploadProgress}
            currentFile={currentFile}
            totalFiles={
              (values.planFiles?.length || 0) +
              inspirationFiles.length +
              values.photoFiles.length
            }
            currentFileIndex={currentFileIndex}
          />
        </div>
      )}


      <div className="mt-6 flex flex-col items-center gap-3">
        <p className="max-w-xl text-center text-sm leading-relaxed text-plum/75 dark:text-pearl/70">
          Nakon pregleda dostavljenih podataka potvrdit ćemo konačnu cijenu prije
          početka izrade.{' '}
          <Link
            to="/cjenici/interijeri"
            className="font-semibold text-[--color-primary] underline-offset-2 hover:underline dark:text-lavender"
          >
            Pogledaj detaljan cjenik.
          </Link>
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-full bg-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-violet-600 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (language === 'hr' ? 'Šaljem...' : 'Sending...') : (language === 'hr' ? 'Pošalji upit za projekt' : 'Send project inquiry')}
        </button>
        <p className="max-w-md text-center text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          {language === 'hr'
            ? 'Kontakt podaci i priložene datoteke koriste se isključivo za pregled upita, pripremu ponude i komunikaciju vezanu uz vaš projekt. '
            : 'Contact details and uploaded files are used only to review your inquiry, prepare an offer, and communicate about your project. '}
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
