import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { formatLrcEuro, lrcPresentationInquirySummary } from '../lib/lrcCatalog'
import { usePublicLrcProducts } from '../hooks/usePublicLrcProducts'
import { trackEvent } from '../lib/analytics'
import { submitLrcInquiry } from '../lib/lrcInquiries'

interface LRCInquiryFormProps {
  language: 'hr' | 'en'
}

export default function LRCInquiryForm({ language }: LRCInquiryFormProps) {
  const [searchParams] = useSearchParams()
  const requestedCode = (searchParams.get('proizvod') ?? '').trim().toUpperCase()
  const catalog = usePublicLrcProducts()
  const products = catalog.products
  const [formData, setFormData] = useState({
    product: '',
    description: '',
    name: '',
    email: '',
    phone: ''
  })

  useEffect(() => {
    if (catalog.status !== 'ready') return
    setFormData((prev) => {
      const currentVisible = products.some((product) => product.code === prev.product)
      if (currentVisible) return prev
      const fromQuery = products.find((product) => product.code === requestedCode)
      return { ...prev, product: fromQuery?.code ?? '' }
    })
  }, [catalog.status, products, requestedCode])
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const translations = {
    formDesc: {
      hr: 'Ispuni formu i pošalji nam svoju ideju',
      en: 'Fill out the form and send us your idea'
    },
    selectProductLabel: {
      hr: 'Odaberi proizvod',
      en: 'Choose product'
    },
    selectProductPlaceholder: {
      hr: 'Odaberi proizvod...',
      en: 'Choose a product...'
    },
    descriptionLabel: {
      hr: 'Opiši svoju želju',
      en: 'Describe your wish'
    },
    descriptionPlaceholder: {
      hr: 'Detaljno opiši što želiš personalizirati...',
      en: 'Describe in detail what you want to customize...'
    },
    addImagesLabel: {
      hr: 'Dodaj slike (opciono, max 5)',
      en: 'Add images (optional, max 5)'
    },
    nameLabel: {
      hr: 'Tvoje ime',
      en: 'Your name'
    },
    emailLabel: {
      hr: 'Email',
      en: 'Email'
    },
    phoneLabel: {
      hr: 'Telefon (opciono)',
      en: 'Phone (optional)'
    },
    submitButton: {
      hr: 'Pošalji svoju ideju',
      en: 'Send your idea'
    },
    submittingButton: {
      hr: 'Šaljem...',
      en: 'Sending...'
    },
    submitHelperText: {
      hr: 'Nakon slanja upita, javit ćemo vam se e-mailom u roku od 3 radna dana s više informacija i sljedećim koracima.',
      en: 'After you submit your inquiry, we will contact you by email within 3 business days with more information and next steps.'
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const fileArray = Array.from(files).slice(0, 5 - uploadedFiles.length)
      setUploadedFiles(prev => [...prev, ...fileArray])
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const selectedPresentation = products.find((product) => product.code === formData.product) ?? null
    if (!selectedPresentation || !formData.description || !formData.name || !formData.email) {
      alert(language === 'hr' ? 'Molimo ispunite sva obavezna polja' : 'Please fill in all required fields')
      return
    }

    setIsSubmitting(true)

    try {
      await submitLrcInquiry({
        product: lrcPresentationInquirySummary(selectedPresentation, language),
        description: formData.description,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        language: language
      })

      toast.success(
        language === 'hr'
          ? '✨ Uspješno! Vaš upit je poslan.'
          : '✨ Success! Your inquiry has been sent.',
        { duration: 4000 }
      )
      trackEvent('form_submit_success', { form: 'lrc' })

      setFormData({
        product: '',
        description: '',
        name: '',
        email: '',
        phone: ''
      })
      setUploadedFiles([])
    } catch (error) {
      toast.error(
        language === 'hr'
          ? 'Greška pri slanju upita. Pokušajte ponovno.'
          : 'Error sending inquiry. Please try again.',
        { duration: 5000 }
      )
      console.error('Error submitting LRC inquiry:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fade-in mx-auto w-full min-w-0 max-w-4xl">
      <div className="rounded-2xl bg-white/80 p-6 shadow-[0_8px_40px_rgba(46,36,71,0.07)] ring-1 ring-[rgba(110,68,255,0.14)] backdrop-blur-sm dark:bg-white/[0.08] dark:shadow-[0_12px_48px_rgba(0,0,0,0.22)] dark:ring-lavender/25 sm:rounded-3xl sm:p-8 md:p-10">
        <div className="mx-auto mb-7 max-w-2xl space-y-3 px-0.5 text-center sm:mb-9 sm:space-y-3.5 sm:px-0">
          <p className="text-sm leading-relaxed text-plum/78 dark:text-pearl/72 sm:text-[0.9375rem] sm:leading-relaxed">
            {translations.formDesc[language]}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6 sm:space-y-8">
          <div className="space-y-2">
            <label htmlFor="lrc-product" className="block text-left text-sm font-semibold tracking-tight text-plum/90 dark:text-pearl">
              {translations.selectProductLabel[language]} *
            </label>
            <select
              id="lrc-product"
              name="product"
              value={formData.product}
              onChange={handleInputChange}
              required
              disabled={catalog.status !== 'ready' || isSubmitting}
              className="min-h-[48px] w-full rounded-xl border border-[rgba(110,68,255,0.18)] bg-white px-4 py-3 text-base shadow-sm outline-none transition-all duration-200 focus:border-[--color-primary] focus:ring-2 focus:ring-[--color-primary]/25 dark:border-lavender/22 dark:bg-white/10 dark:text-pearl dark:focus:bg-white/15"
            >
              <option value="" className="text-plum/55 dark:text-pearl/55">
                {catalog.status === 'loading'
                  ? (language === 'hr' ? 'Učitavanje proizvoda...' : 'Loading products...')
                  : translations.selectProductPlaceholder[language]}
              </option>
              {products.map((product) => (
                <option key={product.code} value={product.code}>
                  {product.code} — {product.title[language]} ({formatLrcEuro(product.retailPriceEuro)})
                </option>
              ))}
            </select>
            {catalog.status === 'ready' && products.length === 0 ? (
              <p className="text-sm text-plum/70 dark:text-pearl/70">
                {language === 'hr' ? 'Nema javno vidljivih proizvoda.' : 'There are no publicly visible products.'}
              </p>
            ) : null}
            {catalog.status === 'error' ? (
              <p className="text-sm text-plum/70 dark:text-pearl/70">
                {language === 'hr'
                  ? 'Proizvodi se trenutno ne mogu učitati.'
                  : 'The products cannot be loaded right now.'}
              </p>
            ) : null}
            {(() => {
              const selected = products.find((product) => product.code === formData.product) ?? null
              if (!selected) return null
              const rows = language === 'hr'
                ? [
                    ['Naziv', selected.title.hr],
                    ['Maloprodajna cijena', formatLrcEuro(selected.retailPriceEuro)],
                    ['Šifra', selected.code],
                  ]
                : [
                    ['Name', selected.title.en],
                    ['Retail price', formatLrcEuro(selected.retailPriceEuro)],
                    ['Code', selected.code],
                  ]
              return (
                <dl className="rounded-xl border border-amethyst/15 bg-white/70 px-4 py-3 text-sm dark:border-lavender/20 dark:bg-white/[0.04]">
                  {rows.map(([label, value]) => (
                    <div key={label} className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:gap-3">
                      <dt className="shrink-0 font-semibold text-plum/70 dark:text-pearl/65 sm:w-44">{label}</dt>
                      <dd className="text-plum dark:text-pearl">{value}</dd>
                    </div>
                  ))}
                </dl>
              )
            })()}
          </div>

          <div className="space-y-2">
            <label htmlFor="lrc-description" className="block text-left text-sm font-semibold tracking-tight text-plum/90 dark:text-pearl">
              {translations.descriptionLabel[language]} *
            </label>
            <textarea
              id="lrc-description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              required
              rows={5}
              placeholder={translations.descriptionPlaceholder[language]}
              className="min-h-[128px] w-full resize-y rounded-xl border border-[rgba(110,68,255,0.18)] bg-white px-4 py-3.5 text-base shadow-sm outline-none transition-all duration-200 placeholder:text-plum/55 focus:border-[--color-primary] focus:ring-2 focus:ring-[--color-primary]/25 dark:border-lavender/22 dark:bg-white/10 dark:text-pearl dark:placeholder:text-pearl/45 dark:focus:bg-white/15"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="lrc-files" className="block text-left text-sm font-semibold tracking-tight text-plum/90 dark:text-pearl">
              {translations.addImagesLabel[language]}
            </label>
            <div className="rounded-xl border-2 border-dashed border-[rgba(110,68,255,0.22)] bg-white/70 px-4 py-4 dark:border-lavender/25 dark:bg-white/[0.04] sm:px-5 sm:py-5">
              <input
                id="lrc-files"
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploadedFiles.length >= 5}
                className="min-h-[44px] w-full rounded-lg border-0 bg-transparent px-0 py-1 text-[0.9375rem] outline-none transition-all duration-200 file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-[rgba(110,68,255,0.12)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[--color-primary] hover:file:bg-[rgba(110,68,255,0.2)] dark:text-pearl dark:file:bg-[rgba(189,166,255,0.18)] dark:hover:file:bg-[rgba(189,166,255,0.28)] disabled:opacity-50"
              />
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="group relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${index + 1}`}
                      width={256}
                      height={256}
                      decoding="async"
                      className="h-16 w-full rounded-lg border border-[rgba(110,68,255,0.2)] object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-5 md:gap-6">
            <div className="space-y-2">
              <label htmlFor="lrc-name" className="block text-left text-sm font-semibold tracking-tight text-plum/90 dark:text-pearl">
                {translations.nameLabel[language]} *
              </label>
              <input
                id="lrc-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                autoComplete="name"
                className="min-h-[48px] w-full rounded-xl border border-[rgba(110,68,255,0.18)] bg-white px-4 py-3 text-base shadow-sm outline-none transition-all duration-200 placeholder:text-plum/55 focus:border-[--color-primary] focus:ring-2 focus:ring-[--color-primary]/25 dark:border-lavender/22 dark:bg-white/10 dark:text-pearl dark:placeholder:text-pearl/45 dark:focus:bg-white/15"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="lrc-email" className="block text-left text-sm font-semibold tracking-tight text-plum/90 dark:text-pearl">
                {translations.emailLabel[language]} *
              </label>
              <input
                id="lrc-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                autoComplete="email"
                className="min-h-[48px] w-full rounded-xl border border-[rgba(110,68,255,0.18)] bg-white px-4 py-3 text-base shadow-sm outline-none transition-all duration-200 placeholder:text-plum/55 focus:border-[--color-primary] focus:ring-2 focus:ring-[--color-primary]/25 dark:border-lavender/22 dark:bg-white/10 dark:text-pearl dark:placeholder:text-pearl/45 dark:focus:bg-white/15"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="lrc-phone" className="block text-left text-sm font-semibold tracking-tight text-plum/90 dark:text-pearl">
                {translations.phoneLabel[language]}
              </label>
              <input
                id="lrc-phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                autoComplete="tel"
                className="min-h-[48px] w-full rounded-xl border border-[rgba(110,68,255,0.18)] bg-white px-4 py-3 text-base shadow-sm outline-none transition-all duration-200 placeholder:text-plum/55 focus:border-[--color-primary] focus:ring-2 focus:ring-[--color-primary]/25 dark:border-lavender/22 dark:bg-white/10 dark:text-pearl dark:placeholder:text-pearl/45 dark:focus:bg-white/15"
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-[rgba(110,68,255,0.1)] px-0.5 pt-8 text-center dark:border-lavender/12 sm:space-y-4 sm:px-0 sm:pt-10">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary min-h-[48px] w-full max-w-md px-8 py-3 text-base font-semibold shadow-md transition-all duration-300 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-12 sm:py-4"
              style={{ letterSpacing: '0.02em' }}
            >
              {isSubmitting ? translations.submittingButton[language] : translations.submitButton[language]}
            </button>
            <p className="mx-auto max-w-lg px-1 text-[0.8125rem] leading-relaxed text-plum/62 dark:text-pearl/58 sm:px-2 sm:text-sm">
              {translations.submitHelperText[language]}
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
