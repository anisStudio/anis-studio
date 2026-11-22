import './interiors-panorama.css'
import { DepartmentStepCard } from './DepartmentStepCard'
import { useEffect, useMemo, useState } from 'react'
import { CONTACT_INFO } from '../config/contact'
import { Link } from 'react-router-dom'
import { DecorativeSkyBackdrop } from './DecorativeSkyBackdrop'
import { sampleProducts, productTags } from '../data/products'
import { cartActions } from '../lib/cart.store'
import { trackEvent } from '../lib/analytics'

interface LRCSectionProps {
  language?: 'hr' | 'en'
  isFormEnabled?: boolean
}

export default function LRCSection({ language = 'hr', isFormEnabled = true }: LRCSectionProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState('all')

  /** Prikazuj samo tagove za koje postoji barem jedan proizvod (osim "Sve"). */
  const visibleProductTags = useMemo(
    () =>
      productTags.filter((tag) => {
        if (tag.id === 'all') return true
        return sampleProducts.some((p) => p.tags.includes(tag.id))
      }),
    []
  )

  useEffect(() => {
    if (selectedTag !== 'all' && !visibleProductTags.some((t) => t.id === selectedTag)) {
      setSelectedTag('all')
    }
  }, [selectedTag, visibleProductTags])

  const query = searchTerm.trim().toLocaleLowerCase(language)
  const filteredProducts = sampleProducts.filter(product => {
    const name = language === 'hr' ? product.nameHr : product.name
    const description = language === 'hr' ? product.descriptionHr : product.description
    const matchesSearch = [name, description].some((value) => value.toLocaleLowerCase(language).includes(query))
    const matchesTag = selectedTag === 'all' || product.tags.includes(selectedTag)
    return matchesSearch && matchesTag
  })

  const translations = {
    title: { hr: 'Pokloni s osobnim potpisom', en: 'Gifts with a personal touch' },
    browse: { hr: 'Pogledaj ponudu', en: 'Browse the catalog' },
    noResults: { hr: 'Nema proizvoda za odabranu pretragu.', en: 'No products match your search.' },
    lead: {
      hr: 'Personalizirajte poklon gravurom, bojom ili materijalom. U radionici spajamo lasersko graviranje i epoksidnu smolu, a možemo izraditi i komad prema vašoj ideji.',
      en: 'Personalize a gift with engraving, color, or material. We combine laser engraving and epoxy resin in our workshop and can make a piece based on your idea.',
    },
    offerTitle: {
      hr: 'Ponuda proizvoda',
      en: 'Product catalog',
    },
    offerIntro: {
      hr: 'Pregledaj ponudu i odaberi proizvod koji te zanima. Svaki proizvod možeš personalizirati — gravura, boje, materijali ili detalji prilagođavaju se tvojoj želji. Fotografije proizvoda dopunjuju se postupno, a opis i osnovne informacije možeš pregledati odmah.',
      en: 'Browse the catalog and choose what interests you. Every product can be personalized — engraving, colors, materials, or details adapted to your wishes. Product photos are added over time; descriptions and key details are available right away.',
    },
    searchPlaceholder: {
      hr: "Pretraži proizvod...",
      en: "Search product..."
    },
    addToCart: {
      hr: "Dodaj u košaricu",
      en: "Add to cart"
    },
    customizationTitle: {
      hr: "Kako personalizirati proizvod",
      en: "How to customize your product"
    },
    step1: {
      title: { hr: "Odaberi proizvod", en: "Choose product" },
      desc: { hr: "Pregledaj našu ponudu i odaberi proizvod koji ti se sviđa", en: "Browse our selection and choose a product you like" }
    },
    step2: {
      title: { hr: "Opiši svoju želju", en: "Describe your wish" },
      desc: { hr: "Detaljno nam opiši kako želiš personalizirati proizvod", en: "Tell us in detail how you want to customize the product" }
    },
    step3: {
      title: { hr: "Dodaj slike/inspiraciju", en: "Add images/inspiration" },
      desc: { hr: "Priloži slike ili reference koje će nam pomoći razumjeti tvoju viziju", en: "Attach images or references to help us understand your vision" }
    },
    step4: {
      title: { hr: "Pošalji upit", en: "Send inquiry" },
      desc: { hr: "Pošalji nam upit i javit ćemo ti se u najkraćem roku", en: "Send us your inquiry and we'll get back to you soon" }
    },
    formCtaTitle: {
      hr: 'Pošaljite upit za personalizaciju',
      en: 'Send a personalization inquiry'
    },
    formCtaText: {
      hr: 'Imate ideju za personalizirani proizvod, poklon ili dekoraciju? Otvorite formu i pošaljite nam svoj upit.',
      en: 'Have an idea for a personalized product, gift, or decoration? Open the form and send us your request.'
    },
    formCtaButton: {
      hr: 'Pošalji upit',
      en: 'Send inquiry'
    },
    formDisabledTitle: {
      hr: "LRC radionice",
      en: "LRC Workshops"
    },
    formDisabledMessage: {
      hr: "Trenutno nema otvorenih prijava za LRC radionice.",
      en: "Currently there are no open applications for LRC workshops."
    },
    formDisabledAdditional: {
      hr: `Ako želite da vam javimo kad otvorimo nove termine, javite nam se na ${CONTACT_INFO.email} ili nas pratite na društvenim mrežama.`,
      en: `If you would like us to notify you when we open new dates, contact us at ${CONTACT_INFO.email} or follow us on social media.`
    },
    reviewCtaTitle: {
      hr: 'Imate naš LRC proizvod?',
      en: 'Do you have an Ani’s LRC piece?',
    },
    reviewCtaText: {
      hr: 'Ostavite kratku recenziju i podijelite dojmove o narudžbi, izradi ili poklonu.',
      en: 'Leave a short review and share your experience with the order, product, or gift.',
    },
    reviewCtaButton: {
      hr: 'Ostavi recenziju',
      en: 'Leave a review',
    },
  }

  const customizationSteps = [
    {
      number: 1,
      image: '/images/odjeli/poklon.webp',
      title: translations.step1.title,
      desc: translations.step1.desc
    },
    {
      number: 2,
      image: '/images/koraci-interijeri/detalji.webp',
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
      image: '/images/koraci-interijeri/upit.webp',
      title: translations.step4.title,
      desc: translations.step4.desc
    }
  ]

  return (
    <section id="lrc" className="Section fade-in relative section-with-bg isolate overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <DecorativeSkyBackdrop priority="high" />
        <div className="absolute inset-0 section-bg-overlay-light dark:section-bg-overlay-dark" />
      </div>

      <div className="relative z-10 mx-auto min-w-0 max-w-6xl">
        <div className="mb-10 text-center sm:mb-12">
          <header className="department-panorama lrc-panorama mb-4">
            <h1 className="font-heading font-bold tracking-tight text-plum dark:text-pearl">
              {translations.title[language]}
            </h1>
          </header>
          <p className="text-sm font-bold text-plum dark:text-pearl">Ani’s LRC</p>
          <p className="mx-auto mt-3 max-w-2xl px-2 text-base leading-relaxed text-plum dark:text-pearl">
            {translations.lead[language]}
          </p>
          <div className="mx-auto mt-6 flex max-w-xs flex-col justify-center gap-3 sm:max-w-none sm:flex-row sm:flex-wrap">
            <a href="#lrc-ponuda" className="btn btn-primary min-h-12 justify-center">
              {translations.browse[language]}
            </a>
            {isFormEnabled && (
              <Link to="/lrc/upit" className="btn btn-secondary min-h-12 justify-center">
                {translations.formCtaButton[language]}
              </Link>
            )}
          </div>
        </div>

        {/* Ponuda / pretraga i filteri */}
        <div id="lrc-ponuda" className="mb-8 scroll-mt-24 space-y-4 sm:mb-10">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-5">
            <h2 className="font-heading text-xl font-bold tracking-tight text-balance text-plum dark:text-pearl sm:text-2xl">
              {translations.offerTitle[language]}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-plum/78 dark:text-pearl/72 sm:mt-4 sm:text-[0.9375rem] sm:leading-relaxed">
              {translations.offerIntro[language]}
            </p>
          </div>
          <div className="mx-auto max-w-md">
            <label htmlFor="lrc-catalog-search" className="mb-3 block text-center font-heading text-xs font-bold uppercase tracking-[0.2em] text-[--color-primary] dark:text-lavender sm:text-sm">
              {language === 'hr' ? 'PRETRAŽI' : 'SEARCH'}
            </label>
            <input
              id="lrc-catalog-search"
              type="search"
              placeholder={translations.searchPlaceholder[language]}
              className="w-full px-4 py-3 rounded-xl border border-[rgba(110,68,255,0.2)] dark:border-lavender/20 bg-white/90 dark:bg-white/10 focus:bg-white dark:focus:bg-white/15 focus:border-[--color-primary] focus:ring-2 focus:ring-[--color-primary]/20 transition-all duration-200 outline-none text-plum/90 dark:text-pearl placeholder:text-plum/60 dark:placeholder:text-pearl/50 placeholder:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                fontSize: '0.95rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            />
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            {visibleProductTags.map(tag => (
              <button
                type="button"
                key={tag.id}
                className={`pill transition-all duration-200 h-11 ${
                  selectedTag === tag.id 
                    ? 'bg-gradient-to-br from-[rgba(189,166,255,0.3)] to-[rgba(110,68,255,0.2)] border-[--color-primary] text-[--color-primary] font-semibold' 
                    : 'hover:bg-[rgba(110,68,255,0.1)]'
                }`}
                aria-pressed={selectedTag === tag.id}
                onClick={() => setSelectedTag(tag.id)}
              >
                {tag.label[language]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-10 sm:mb-12">
          {filteredProducts.length === 0 && (
            <p role="status" className="text-center">{translations.noResults[language]}</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="flex min-w-0 flex-col rounded-2xl border border-amethyst/15 bg-white/80 p-5 shadow-sm dark:border-lavender/20 dark:bg-white/[0.07]"
              >
                <h3 className="font-heading text-base font-semibold leading-snug text-plum dark:text-pearl">
                  {language === 'hr' ? product.nameHr : product.name}
                </h3>
                <p className="mb-4 mt-2 text-sm leading-relaxed text-plum dark:text-pearl">
                  {language === 'hr' ? product.descriptionHr : product.description}
                </p>
                <p className="mb-3 mt-auto text-lg font-bold text-amethyst dark:text-lavender">
                  €{product.price}
                </p>
                <button
                  type="button"
                  className="btn btn-primary min-h-11 w-full text-sm"
                  onClick={() => {
                    cartActions.addItem({
                      id: product.id,
                      title: language === 'hr' ? product.nameHr : product.name,
                      price: product.price,
                      imageUrl: product.image,
                      tags: product.tags,
                    })
                  }}
                >
                  {translations.addToCart[language]}
                </button>
              </article>
            ))}
          </div>
        </div>

        {/* Message when form is disabled */}
        {!isFormEnabled && (
          <div className="fade-in mb-10 rounded-2xl border border-[rgba(110,68,255,0.2)] bg-white/80 p-6 text-center shadow-lg backdrop-blur-sm dark:border-lavender/20 dark:bg-white/8 sm:mb-12 sm:p-8">
            <h3 className="mb-3 font-heading text-xl font-bold text-balance text-plum/90 dark:text-pearl sm:mb-4 sm:text-2xl">
              {translations.formDisabledTitle[language]}
            </h3>
            <p className="mb-3 text-base leading-relaxed text-plum/85 dark:text-pearl/85 sm:text-lg">
              {translations.formDisabledMessage[language]}
            </p>
            <p className="text-sm leading-relaxed text-[--color-ink-muted] dark:text-pearl/70 sm:text-base">
              {translations.formDisabledAdditional[language]}
            </p>
          </div>
        )}

        {/* Customization Steps - only show if form is enabled */}
        {isFormEnabled && (
          <>
            <div className="mb-6 text-center sm:mb-8">
              <h3 className="font-heading text-xl font-bold tracking-tight text-balance text-plum/90 dark:text-pearl sm:text-2xl">
                {translations.customizationTitle[language]}
              </h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
              {customizationSteps.map((step) => (
                <DepartmentStepCard
                  key={step.number}
                  number={step.number}
                  image={step.image}
                  title={step.title[language]}
                  description={step.desc[language]}
                />
              ))}
            </div>

            {/* CTA — full form na /lrc/upit */}
            <div className="fade-in mx-auto mt-10 w-full max-w-4xl sm:mt-12">
              <div className="rounded-3xl border border-[rgba(110,68,255,0.12)] bg-white/50 p-6 shadow-[0_8px_40px_rgba(46,36,71,0.06)] backdrop-blur-md dark:border-lavender/12 dark:bg-white/[0.04] dark:shadow-[0_12px_48px_rgba(0,0,0,0.25)] sm:p-8 md:p-10">
                <div className="mx-auto max-w-2xl space-y-4 text-center sm:space-y-5">
                  <h3 className="font-heading text-xl font-bold tracking-tight text-plum/95 dark:text-pearl sm:text-2xl">
                    {translations.formCtaTitle[language]}
                  </h3>
                  <p className="text-sm leading-relaxed text-plum/78 dark:text-pearl/72 sm:text-[0.9375rem] sm:leading-relaxed">
                    {translations.formCtaText[language]}
                  </p>
                  <Link
                    to="/lrc/upit"
                    onClick={() => trackEvent('inquiry_cta_click', { source: 'lrc' })}
                    className="btn btn-primary inline-flex min-h-[48px] w-full max-w-md items-center justify-center px-8 py-3 text-base font-semibold shadow-md transition-all duration-300 hover:shadow-lg sm:w-auto sm:px-12 sm:py-4"
                    style={{ letterSpacing: '0.02em' }}
                  >
                    {translations.formCtaButton[language]}
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Discrete review CTA — secondary to inquiry */}
        <div className="fade-in mx-auto mt-8 w-full max-w-xl px-4 pb-10 sm:mt-10 sm:px-5 sm:pb-14">
          <div className="rounded-2xl border border-[rgba(110,68,255,0.14)] bg-white/[0.48] px-5 py-4 text-center shadow-sm backdrop-blur-sm dark:border-lavender/14 dark:bg-white/[0.05] sm:px-6 sm:py-5">
            <p className="font-heading text-sm font-bold tracking-tight text-plum/88 dark:text-pearl/92 sm:text-base">
              {translations.reviewCtaTitle[language]}
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-plum/72 dark:text-pearl/68 sm:text-[0.8125rem] sm:leading-relaxed">
              {translations.reviewCtaText[language]}
            </p>
            <Link
              to="/ostavi-recenziju?category=lrc"
              onClick={() =>
                trackEvent('review_cta_click', {
                  category: 'lrc',
                  source: 'lrc-section',
                })
              }
              className="public-action mt-4 inline-flex min-h-[42px] w-full max-w-[14rem] items-center justify-center rounded-xl px-4 py-2 text-xs font-semibold sm:inline-flex sm:w-auto sm:text-sm"
            >
              {translations.reviewCtaButton[language]}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}