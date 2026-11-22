import './interiors-panorama.css'
import { DepartmentStepCard } from './DepartmentStepCard'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PortfolioImageLightbox } from './PortfolioImageLightbox'
import { Link, useLocation } from 'react-router-dom'
import { trackEvent } from '../lib/analytics'
import { usePortfolioItems } from '../hooks/usePortfolioItems'
import { DecorativeSkyBackdrop } from './DecorativeSkyBackdrop'

import { INTERIORS_INQUIRY_HASH } from '../data/interiorsPublic'

const livingRoomImage = '/images/odjeli/dnevni-boravak.webp'

interface InteriorsSectionProps {
  language: 'hr' | 'en'
}

export default function InteriorsSection({ language }: InteriorsSectionProps) {
  const { items: allPortfolioItems } = usePortfolioItems(language)
  const previewItems = allPortfolioItems.filter((item) => item.category === 'interiors').slice(0, 4)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const lightboxItem =
    lightboxIndex !== null ? (previewItems[lightboxIndex] ?? null) : null
  const showPreviewLightboxNav = previewItems.length > 1
  const { hash } = useLocation()
  const inquiryHeadingId = INTERIORS_INQUIRY_HASH.slice(1)

  useEffect(() => {
    if (hash !== INTERIORS_INQUIRY_HASH) return
    const heading = document.getElementById(inquiryHeadingId)
    heading?.scrollIntoView({ block: 'start' })
    heading?.focus({ preventScroll: true })
  }, [hash, inquiryHeadingId])


  const previewCopy = {
    title: { hr: 'Primjeri 3D vizualizacija', en: '3D Visualization Examples' },
    subtitle: {
      hr: 'Primjeri 3D vizualizacija koje pomažu vidjeti raspored, stil i dojam prostora prije izvedbe. Svaki prikaz služi kao jasnija priprema za odluku, usklađivanje s obitelji ili prezentaciju stolaru.',
      en: 'Examples of 3D visualizations that help you see layout, materials, and the overall feel of a space before build-out. Each view supports clearer decisions, alignment at home, or presentations to a carpenter.',
    },
    allWork: { hr: 'Svi radovi', en: 'All work' },
    badge: { hr: 'Interijeri', en: 'Interiors' },
    placeholder: { hr: 'Uskoro', en: 'Coming soon' },
  }

  const goPreviewLightboxPrev = () => {
    if (lightboxIndex === null || previewItems.length < 2) return
    setLightboxIndex(
      (i) => (i === null ? null : (i - 1 + previewItems.length) % previewItems.length)
    )
  }

  const goPreviewLightboxNext = () => {
    if (lightboxIndex === null || previewItems.length < 2) return
    setLightboxIndex((i) => (i === null ? null : (i + 1) % previewItems.length))
  }

  useEffect(() => {
    if (lightboxIndex === null) return
    if (lightboxIndex < 0 || lightboxIndex >= previewItems.length) {
      setLightboxIndex(null)
    }
  }, [lightboxIndex, previewItems.length])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (lightboxIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setLightboxIndex(null)
        return
      }
      if (previewItems.length < 2) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setLightboxIndex((i) => {
          if (i === null) return null
          return (i - 1 + previewItems.length) % previewItems.length
        })
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setLightboxIndex((i) => {
          if (i === null) return null
          return (i + 1) % previewItems.length
        })
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [lightboxIndex, previewItems.length])

  const chooser = {
    sectionTitle: { hr: 'Odaberite vrstu upita', en: 'Choose the type of inquiry' },
    sectionIntro: {
      hr: 'Trebate 3D prikaz interijera po mjeri ili šaljete upit za suradnju? Odaberite opciju koja najbolje odgovara vašem projektu.',
      en: 'Need a bespoke 3D interior visualization or sending a collaboration inquiry? Choose the option that best fits your project.',
    },
    clientsTitle: { hr: 'Upit za klijente', en: 'Client inquiry' },
    clientsText: {
      hr: 'Za privatne klijente koji žele vidjeti prostor prije nego naruče namještaj ili krenu u uređenje.',
      en: 'For private clients who want to see the space before ordering furniture or starting a renovation.',
    },
    stolariTitle: { hr: 'Upit za stolare i studije', en: 'Inquiry for carpenters & studios' },
    stolariText: {
      hr: 'Za stolare i salone kojima treba profesionalan 3D prikaz za lakšu prezentaciju klijentu.',
      en: 'For carpenters and showrooms who need a professional 3D render for easier client presentations.',
    },
    ctaAction: { hr: 'Zatraži ponudu', en: 'Request a quote' },
    clientAction: { hr: 'Otvori upit za klijente', en: 'Open client inquiry' },
    carpenterAction: { hr: 'Otvori upit za stolare i studije', en: 'Open carpenter and studio inquiry' },
  }

  const reviewCta = {
    title: {
      hr: 'Već ste surađivali s nama?',
      en: 'Have we worked together?',
    },
    text: {
      hr: 'Ostavite kratku recenziju i pomozite drugima da lakše odluče.',
      en: 'Leave a short review and help others make their decision more easily.',
    },
    button: { hr: 'Ostavi recenziju', en: 'Leave a review' },
  }

  const translations = {
    title: {
      hr: "Ani's Interijeri — 3D vizualizacija prostora",
      en: "Ani's Interijeri — 3D space visualization",
    },
    subtitle: {
      hr: 'Vidiš svoj prostor prije nego ga napraviš — realistični 3D prikazi na temelju tvojih mjera, ideja i željenog stila.',
      en: 'See your space before you build it — realistic 3D visuals based on your dimensions, ideas, and desired style.',
    },
    bridge: {
      hr: "Ani's Interijeri pomaže ti da jasnije vidiš kako će prostor izgledati prije izrade ili uređenja. Usluga je namijenjena privatnim klijentima koji uređuju dom, ali i stolarima ili salonima kojima treba profesionalan prikaz za prezentaciju klijentu.",
      en: "Ani's Interijeri helps you see more clearly how a space will look before production or renovation. It's for private clients updating their home, and for carpenters or showrooms who need a professional presentation for their clients.",
    },
    stepsTitle: {
      hr: "Kako do Vašeg 3D prikaza",
      en: "How to get your 3D visualization"
    },
    step1: {
      title: { hr: "Izmjerite prostor", en: "Measure the space" },
      desc: { hr: "Izmjerite duljinu, širinu i visinu prostora u kojem želite namještaj", en: "Measure the length, width and height of the space where you want furniture" }
    },
    step2: {
      title: { hr: "Skicirajte tlocrt", en: "Sketch the floor plan" },
      desc: { hr: "Nacrtajte grubu skicu tlocrta prostora kako biste prikazali raspored", en: "Draw a rough sketch of the floor plan to show the layout" }
    },
    step3: {
      title: { hr: "Dodajte reference", en: "Add references" },
      desc: { hr: "Priložite slike postojećih rješenja ili skica koje vam se sviđaju kao inspiracija", en: "Attach images of existing solutions or sketches you like as inspiration" }
    },
    step4: {
      title: { hr: "Opišite detalje", en: "Describe details" },
      desc: { hr: "Napišite na što obratiti pažnju: boje, materijale, stil, posebnosti prostora", en: "Write what to pay attention to: colors, materials, style, space specifics" }
    },
    step5: {
      title: { hr: "Pošaljite upit", en: "Send inquiry" },
      desc: { hr: "Koristite obrazac za klijente za slanje upita.", en: "Use the client inquiry form to send your request." }
    },
    step6: {
      title: { hr: "Primite prikaz", en: "Receive visualization" },
      desc: {
        hr: "Nakon potvrde ponude i izrade primate dogovoreno 3D idejno rješenje. Fotorealistična vizualizacija dostupna je kao dodatna opcija nakon odobrenja modela.",
        en: "After the quote is confirmed and the work is completed, you receive the agreed 3D concept design. Photorealistic visualization is available as an add-on after the model is approved."
      }
    }
  }

  const visualizationSteps = [
    {
      number: 1,
      image: '/images/koraci-interijeri/metar.webp',
      title: translations.step1.title,
      desc: translations.step1.desc
    },
    {
      number: 2,
      image: '/images/koraci-interijeri/tlocrt.webp',
      title: translations.step2.title,
      desc: translations.step2.desc
    },
    {
      number: 3,
      image: '/images/koraci-interijeri/reference.webp',
      title: translations.step3.title,
      desc: translations.step3.desc
    },
    {
      number: 4,
      image: '/images/koraci-interijeri/detalji.webp',
      title: translations.step4.title,
      desc: translations.step4.desc
    },
    {
      number: 5,
      image: '/images/koraci-interijeri/upit.webp',
      title: translations.step5.title,
      desc: translations.step5.desc
    },
    {
      number: 6,
      image: livingRoomImage,
      title: translations.step6.title,
      desc: translations.step6.desc
    }
  ]

  return (
    <section
      id="interiors"
      className="Section fade-in relative section-with-bg !pt-[clamp(0.85rem,2vw,2.75rem)] !pb-[clamp(2rem,3.5vw,3.5rem)] sm:!pb-[clamp(2.25rem,3.5vw,3.75rem)]"
    >
      {/* Background wrapper */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <DecorativeSkyBackdrop priority="high" />
        {/* Overlay for readability */}
        <div className="absolute inset-0 section-bg-overlay-light dark:section-bg-overlay-dark" />
      </div>
      
      <div className="relative z-10 mx-auto flex min-w-0 w-full max-w-6xl flex-col px-0">
        {/* Section Header — single centered column */}
        <div className="mx-auto mb-10 w-full text-center sm:mb-12 max-sm:mb-5 max-sm:max-w-2xl max-sm:px-4">
          <header className="department-panorama interiors-panorama interiors-panorama--compact mb-4 max-sm:mb-3">
            <h1 className="font-heading font-bold tracking-tight">{translations.title[language]}</h1>
          </header>
          <p className="mx-auto mb-2 max-w-2xl text-base font-semibold italic leading-snug text-amethyst dark:text-lavender max-sm:mb-1 sm:text-lg sm:text-xl">
            {translations.subtitle[language]}
          </p>
          <div className="mx-auto mt-6 max-w-2xl border-t border-amethyst/10 px-2 pt-6 text-center dark:border-lavender/15 max-sm:mt-3 max-sm:pt-3 sm:mt-7 sm:px-3 sm:pt-7">
            <p className="text-sm leading-relaxed text-plum/78 dark:text-pearl/75 max-sm:text-[0.8125rem] max-sm:leading-snug sm:text-[0.9375rem] sm:leading-relaxed">
              {translations.bridge[language]}
            </p>
          </div>
          <Link
            to={INTERIORS_INQUIRY_HASH}
            className="public-action mx-auto mt-6 inline-flex min-h-[48px] w-full max-w-xs items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold max-sm:mt-3 sm:w-auto"
          >
            {chooser.ctaAction[language]}
          </Link>
        </div>

        {/* Visualization Steps — heading + balanced grid below */}
        <div className="mx-auto mb-7 max-w-3xl text-center sm:mb-8">
          <h3 className="font-heading text-xl font-bold tracking-tight text-balance text-plum/90 dark:text-pearl sm:text-2xl">
            {translations.stepsTitle[language]}
          </h3>
        </div>

        <div className="mx-auto mb-12 grid w-full max-w-5xl grid-cols-1 gap-4 sm:mb-14 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 md:gap-5">
          {visualizationSteps.map((step) => (
            <DepartmentStepCard
              key={step.number}
              number={step.number}
              image={step.image}
              title={step.title[language]}
              description={step.desc[language]}
            />
          ))}
        </div>

        {/* Portfolio preview — interiors examples before inquiry chooser */}
        <div className="mx-auto mb-12 w-full max-w-5xl sm:mb-14">
          <div className="mx-auto mb-6 max-w-3xl text-center sm:mb-8">
            <h3 className="font-heading text-xl font-bold tracking-tight text-balance text-plum/90 dark:text-pearl sm:text-2xl">
              {previewCopy.title[language]}
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-plum/78 dark:text-pearl/75 sm:mt-4 sm:text-[0.9375rem] sm:leading-relaxed">
              {previewCopy.subtitle[language]}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-5">
            {previewItems.map((item, index) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setLightboxIndex(index)}
                aria-label={
                  language === 'hr' ? `Otvori prikaz: ${item.title}` : `Open preview: ${item.title}`
                }
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-[rgba(110,68,255,0.15)] bg-[rgba(248,246,255,0.72)] text-left shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary] focus-visible:ring-offset-2 dark:border-lavender/15 dark:bg-white/8 dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:focus-visible:ring-lavender/60 dark:focus-visible:ring-offset-slate-900"
              >
                <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden border-b border-amethyst/[0.14] dark:border-lavender/10">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.imageAlt ?? item.title}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-lavender/30 via-amethyst/20 to-lavender/30 dark:from-lavender/15 dark:via-amethyst/10 dark:to-lavender/15" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl opacity-60 dark:opacity-50" aria-hidden>
                          🏠
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-3.5">
                  <h4 className="line-clamp-2 text-xs font-semibold leading-snug text-plum/90 dark:text-pearl sm:text-sm">
                    {item.title}
                  </h4>
                  {item.description ? (
                    <p className="line-clamp-3 text-[11px] leading-relaxed text-plum/72 dark:text-pearl/68 sm:text-xs">
                      {item.description}
                    </p>
                  ) : null}
                  {item.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 5).map((tag, ti) => (
                        <span
                          key={`${tag}-${ti}`}
                          className="inline-flex max-w-full truncate rounded-md border border-amethyst/18 bg-white/55 px-1.5 py-px text-[10px] font-medium text-plum/85 dark:border-lavender/22 dark:bg-white/10 dark:text-pearl/85 sm:text-[11px]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <span className="mt-auto inline-flex w-fit max-w-full items-center gap-1 rounded-full border border-amethyst/20 bg-gradient-to-r from-amethyst/15 to-lavender/15 px-2 py-0.5 text-[10px] font-semibold text-amethyst dark:border-lavender/20 dark:from-amethyst/25 dark:to-lavender/20 dark:text-lavender sm:text-[11px]">
                    <span className="shrink-0 text-xs" aria-hidden>
                      🏠
                    </span>
                    <span className="truncate">{previewCopy.badge[language]}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Informative block — what the client gets and how to use it */}
          <div className="mt-8 rounded-2xl border border-[rgba(110,68,255,0.12)] bg-white/50 px-5 py-6 backdrop-blur-sm dark:border-lavender/12 dark:bg-white/[0.04] sm:mt-10 sm:px-7 sm:py-7">
            <h4 className="mb-3 font-heading text-base font-bold tracking-tight text-plum/90 dark:text-pearl sm:text-lg">
              {language === 'hr'
                ? 'Što dobivate i kako se koristi'
                : 'What you get and how to use it'}
            </h4>
            <div className="space-y-3 text-sm leading-relaxed text-plum/75 dark:text-pearl/70 sm:text-[0.9375rem]">
              <p className="font-medium text-plum/85 dark:text-pearl/80">
                {language === 'hr'
                  ? 'Naručuješ namještaj, planiraš renovaciju ili razgovaraš s klijentom — ali nisi siguran hoće li sve zajedno izgledati onako kako zamišljaš. 3D vizualizacija to razjašnjava prije nego počneš.'
                  : "You're ordering furniture, planning a renovation, or presenting to a client — but you're not sure how everything will actually look together. A 3D visualization makes that clear before you start."}
              </p>
              <p>
                {language === 'hr'
                  ? '3D prikaz pomaže vam jasnije vidjeti raspored, proporcije, boje, materijale i atmosferu prostora prije daljnjeg uređenja ili izvedbe.'
                  : 'A 3D visualization helps you clearly see the layout, proportions, colors, materials, and atmosphere of a space before further planning or execution.'}
              </p>
              <p>
                {language === 'hr'
                  ? 'Možete ga koristiti za dogovor s ukućanima, razgovor sa stolarom ili kao vizualnu referencu pri odabiru namještaja, dekora i materijala.'
                  : 'You can use it for discussions at home, communication with a carpenter, or as a visual reference when choosing furniture, decor, and materials.'}
              </p>
              <p className="text-plum/60 dark:text-pearl/55">
                {language === 'hr'
                  ? 'Vizualizacija nije zamjena za arhitektonski projekt ili tehničku dokumentaciju — ona je jasna slika mogućeg izgleda prostora, izrađena na temelju vaših mjera, ideja i dostupnih informacija.'
                  : 'A visualization is not a replacement for an architectural project or technical documentation — it is a clear picture of a possible look for the space, created from your measurements, ideas, and available information.'}
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-center sm:mt-7">
            <a
              href="/#portfolio"
              onClick={() =>
                trackEvent('interiors_portfolio_preview_click', { destination: '/#portfolio' })
              }
              className="public-action inline-flex min-h-[48px] w-full max-w-xs items-center justify-center rounded-xl px-8 py-3.5 text-sm font-semibold sm:w-auto sm:min-w-[200px]"
            >
              {previewCopy.allWork[language]}
            </a>
          </div>
        </div>

        {/* Chooser — forms on /interijeri/klijenti and /interijeri/stolari */}
        <div className="mx-auto w-full max-w-5xl">
          <div className="rounded-3xl border border-[rgba(110,68,255,0.12)] bg-white/50 p-6 shadow-[0_8px_40px_rgba(46,36,71,0.06)] backdrop-blur-md dark:border-lavender/12 dark:bg-white/[0.04] dark:shadow-[0_12px_48px_rgba(0,0,0,0.25)] sm:p-8 md:p-10">
            <header className="mx-auto mb-7 max-w-2xl text-center sm:mb-9">
              <div className="mb-3 flex w-full justify-center">
                <p className="font-heading text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amethyst/80 dark:text-lavender/85 [text-indent:0.2em]">
                  {language === 'hr' ? 'Upit' : 'Inquiry'}
                </p>
              </div>
              <h3 id={inquiryHeadingId} tabIndex={-1} className="scroll-mt-28 font-heading text-xl font-bold tracking-tight text-balance text-plum/95 dark:text-pearl sm:text-2xl md:text-[1.65rem]">
                {chooser.sectionTitle[language]}
              </h3>
              <p className="mx-auto mt-4 text-sm leading-relaxed text-plum/78 dark:text-pearl/72 sm:text-[0.95rem] sm:leading-relaxed">
                {chooser.sectionIntro[language]}
              </p>
              <div
                className="mx-auto mt-8 h-px max-w-xs bg-gradient-to-r from-transparent via-[rgba(110,68,255,0.35)] to-transparent dark:via-lavender/35"
                aria-hidden
              />
            </header>

            <nav
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6"
              aria-label={language === 'hr' ? 'Vrste upita' : 'Inquiry types'}
            >
              <Link
                to="/interijeri/klijenti"
                onClick={() => trackEvent('interiors_chooser_click', { type: 'klijenti' })}
                className="group relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[rgba(110,68,255,0.16)] bg-[rgba(248,246,255,0.80)] p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[--color-primary]/35 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--color-primary] dark:border-lavender/18 dark:bg-white/[0.06] dark:hover:shadow-[0_20px_50px_rgba(189,166,255,0.14)] sm:p-7"
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(110,68,255,0.25)] to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:via-lavender/30" aria-hidden />
                <img
                  src={livingRoomImage}
                  alt=""
                  width={192}
                  height={120}
                  loading="lazy"
                  className="mx-auto mb-4 h-[120px] w-48 max-w-full object-contain sm:mb-5"
                />
                <h4 className="font-heading text-lg font-bold leading-snug text-plum/95 dark:text-pearl sm:text-xl">
                  {chooser.clientsTitle[language]}
                </h4>
                <p className="mx-auto mt-3 flex-1 text-sm leading-relaxed text-plum/76 dark:text-pearl/70 sm:text-[0.9375rem]">
                  {chooser.clientsText[language]}
                </p>
                <span className="public-action mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold sm:w-auto sm:self-center">
                  {chooser.clientAction[language]}
                  <span className="ml-1.5 transition-transform group-hover:translate-x-0.5" aria-hidden>
                    →
                  </span>
                </span>
              </Link>

              <Link
                to="/interijeri/stolari"
                onClick={() => trackEvent('interiors_chooser_click', { type: 'stolari' })}
                className="group relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[rgba(110,68,255,0.16)] bg-[rgba(248,246,255,0.80)] p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[--color-primary]/35 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--color-primary] dark:border-lavender/18 dark:bg-white/[0.06] dark:hover:shadow-[0_20px_50px_rgba(189,166,255,0.14)] sm:p-7"
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(110,68,255,0.25)] to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:via-lavender/30" aria-hidden />
                <img
                  src={'/images/koraci-interijeri/stolari.webp'}
                  alt=""
                  width={192}
                  height={120}
                  loading="lazy"
                  className="mx-auto mb-4 h-[120px] w-48 max-w-full object-contain sm:mb-5"
                />
                <h4 className="font-heading text-lg font-bold leading-snug text-plum/95 dark:text-pearl sm:text-xl">
                  {chooser.stolariTitle[language]}
                </h4>
                <p className="mx-auto mt-3 flex-1 text-sm leading-relaxed text-plum/76 dark:text-pearl/70 sm:text-[0.9375rem]">
                  {chooser.stolariText[language]}
                </p>
                <span className="public-action mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold sm:w-auto sm:self-center">
                  {chooser.carpenterAction[language]}
                  <span className="ml-1.5 transition-transform group-hover:translate-x-0.5" aria-hidden>
                    →
                  </span>
                </span>
              </Link>
            </nav>
          </div>
        </div>

        {/* Discrete review CTA — secondary to inquiry chooser */}
        <div className="mx-auto mt-8 w-full max-w-xl px-4 sm:mt-10 sm:px-5">
          <div className="rounded-2xl border border-[rgba(110,68,255,0.14)] bg-white/[0.48] px-5 py-4 text-center shadow-sm backdrop-blur-sm dark:border-lavender/14 dark:bg-white/[0.05] sm:px-6 sm:py-5">
            <p className="font-heading text-sm font-bold tracking-tight text-plum/88 dark:text-pearl/92 sm:text-base">
              {reviewCta.title[language]}
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-plum/72 dark:text-pearl/68 sm:text-[0.8125rem] sm:leading-relaxed">
              {reviewCta.text[language]}
            </p>
            <Link
              to="/ostavi-recenziju?category=interiors"
              onClick={() =>
                trackEvent('review_cta_click', {
                  category: 'interiors',
                  source: 'interiors-section',
                })
              }
              className="public-action mt-4 inline-flex min-h-[42px] w-full max-w-[14rem] items-center justify-center rounded-xl px-4 py-2 text-xs font-semibold sm:inline-flex sm:w-auto sm:text-sm"
            >
              {reviewCta.button[language]}
            </Link>
          </div>
        </div>
      </div>

      {lightboxItem?.imageUrl && typeof document !== 'undefined'
        ? createPortal(
            <PortfolioImageLightbox
              language={language}
              imageUrl={lightboxItem.imageUrl}
              imageAlt={lightboxItem.imageAlt ?? lightboxItem.title}
              title={lightboxItem.title}
              description={lightboxItem.description}
              showNav={showPreviewLightboxNav}
              onClose={() => setLightboxIndex(null)}
              onPrev={goPreviewLightboxPrev}
              onNext={goPreviewLightboxNext}
              badge={
                <span className="inline-flex max-w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-lavender/40 bg-lavender/15 px-3 py-1.5 text-xs font-semibold text-white sm:text-sm">
                  {previewCopy.badge[language]}
                </span>
              }
            />,
            document.body
          )
        : null}
    </section>
  )
}
