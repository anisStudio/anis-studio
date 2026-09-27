import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DecorativeSkyBackdrop } from '../components/DecorativeSkyBackdrop'

export type FaqCategory = 'lrc' | 'interiors' | 'web' | 'global'

interface FAQSectionProps {
  language: 'hr' | 'en'
  categories?: FaqCategory[]
  items?: FAQItem[]
  hideTitle?: boolean
  /** Layout tuned for the dedicated /faq page only (does not affect embedded FAQ on other pages). */
  standalonePage?: boolean
}

export interface FAQItem {
  id: number
  category: FaqCategory
  question: {
    hr: string
    en: string
  }
  answer: {
    hr: string
    en: string
  }
}

function splitFaqAnswerParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

export const FAQ_ITEMS: FAQItem[] = [
  {
    id: 1,
    category: 'lrc',
    question: {
      hr: 'Kako mogu naručiti proizvod?',
      en: 'How can I order a product?'
    },
    answer: {
      hr: 'Možete naručiti proizvod direktno preko web stranice dodavanjem u košaricu, ili možete kontaktirati nas putem kontakt formulara za personalizirane narudžbe.',
      en: 'You can order a product directly through the website by adding it to your cart, or you can contact us through the contact form for personalized orders.'
    }
  },
  {
    id: 2,
    category: 'lrc',
    question: {
      hr: 'Koliko vremena traje isporuka?',
      en: 'How long does delivery take?'
    },
    answer: {
      hr: 'Standardna isporuka traje 5-7 radnih dana za gotove proizvode. Za personalizirane narudžbe, vrijeme isporuke je 2-3 tjedna ovisno o složenosti proizvoda.',
      en: 'Standard delivery takes 5-7 business days for ready-made products. For personalized orders, delivery time is 2-3 weeks depending on product complexity.'
    }
  },
  {
    id: 3,
    category: 'lrc',
    question: {
      hr: 'Mogu li personalizirati proizvod?',
      en: 'Can I personalize a product?'
    },
    answer: {
      hr: 'Da! Većina naših proizvoda može biti personalizirana. Možete dodati imena, datume, poruke ili prilagoditi boje i dizajn prema vašim željama. Kontaktirajte nas za više detalja.',
      en: 'Yes! Most of our products can be personalized. You can add names, dates, messages, or customize colors and design according to your wishes. Contact us for more details.'
    }
  },
  {
    id: 4,
    category: 'lrc',
    question: {
      hr: 'Koje načine plaćanja prihvaćate?',
      en: 'What payment methods do you accept?'
    },
    answer: {
      hr: 'Prihvaćamo plaćanja karticom putem Stripe-a, te možete kontaktirati nas za druge opcije plaćanja ako je potrebno.',
      en: 'We accept card payments via Stripe, and you can contact us for other payment options if needed.'
    }
  },
  {
    id: 7,
    category: 'lrc',
    question: {
      hr: 'Zašto nisu dostupne sve fotografije proizvoda?',
      en: "Why aren't all product photos available yet?"
    },
    answer: {
      hr: 'Fotografije proizvoda dopunjuju se postupno. Ako te zanima određeni proizvod, pošalji upit i javit ću ti koje su mogućnosti personalizacije te mogu li podijeliti dodatne primjere sličnog rada.',
      en: 'Product photos are added gradually. If you are interested in a specific product, send an inquiry and I will share customization options and whether I can provide more examples of similar work.'
    }
  },
  {
    id: 5,
    category: 'interiors',
    question: {
      hr: 'Kako funkcionira usluga 3D vizualizacije interijera?',
      en: 'How does the 3D interior visualization service work?'
    },
    answer: {
      hr:
        'Nakon što pošaljete osnovne dimenzije prostora, fotografije postojećeg stanja ako ih imate i svoje ideje ili reference, izrađujemo 3D idejno rješenje prostora. Cilj je da jasno vidite raspored elemenata, odnos proporcija i osnovnu logiku prostora prije izvedbe ili narudžbe namještaja.\n\nFotorealistična vizualizacija nije automatski dio osnovne usluge. Može se dodatno naručiti nakon odobrenja konačnog 3D modela.',
      en:
        'After you send basic room dimensions, photos of the existing space if you have them, and your ideas or references, we create a 3D concept design of the space. The goal is for you to clearly see the arrangement of elements, proportions, and basic spatial logic before execution or ordering furniture.\n\nPhotorealistic visualization is not automatically included in the base service. It can be ordered as an add-on after the final 3D model has been approved.'
    }
  },
  {
    id: 8,
    category: 'interiors',
    question: {
      hr: 'Što točno dobivam kao isporuku?',
      en: 'What exactly do I receive as a deliverable?'
    },
    answer: {
      hr:
        'Osnovna usluga uključuje 3D model prema zahtjevima klijenta, prikaz zatvorenih i otvorenih fronti kada je primjenjivo, kotirani idejni prikaz, tlocrt, nacrt i jednu manju korekciju.\n\nSvi nacrti, kote i prikazi su idejni. Nisu izvedbeni ili radionički nacrti ni proizvodna dokumentacija. Fotorealistična vizualizacija dogovara se kao zasebna dodatna usluga.',
      en:
        'The base service includes a 3D model based on the client’s requirements, closed and open front views where applicable, a dimensioned concept view, a floor plan, an elevation drawing, and one minor revision.\n\nAll drawings, dimensions, and visuals are conceptual. They are not construction drawings, workshop drawings, or production documentation. Photorealistic visualization is agreed as a separate add-on.'
    }
  },
  {
    id: 9,
    category: 'interiors',
    question: {
      hr: 'Što trebam poslati za početak?',
      en: 'What do I need to send to get started?'
    },
    answer: {
      hr:
        'Za početak su potrebne osnovne izmjere prostora, fotografije postojećeg stanja ako postoje, skica tlocrta ili rasporeda te reference stila koji vam se sviđa. To mogu biti slike s Pinteresta, katalozi materijala, primjeri kuhinja, boja, fronti, radnih ploča ili rasvjete.\n\nŠto su informacije jasnije, to će i 3D prikaz biti precizniji.',
      en:
        'To get started we need basic room measurements, photos of the existing space if available, a sketch of the floor plan or layout, and style references you like. These can be Pinterest images, material catalogues, examples of kitchens, colours, fronts, worktops, or lighting.\n\nThe clearer the information, the more precise the 3D visualization will be.'
    }
  },
  {
    id: 10,
    category: 'interiors',
    question: {
      hr: 'Koliko traje izrada 3D vizualizacije?',
      en: 'How long does 3D visualization take?'
    },
    answer: {
      hr:
        'Za standardne projekte, poput jedne prostorije, kuhinje ili manjeg prostora, izrada najčešće traje 5 do 10 radnih dana nakon potvrde ponude i dostave svih potrebnih podataka.\n\nSloženiji projekti, veći broj prostorija, fotorealistični renderi ili hitni rokovi dogovaraju se individualno.',
      en:
        'For standard projects, such as one room, a kitchen, or a smaller space, work usually takes 5 to 10 business days after the quote is confirmed and all required information has been supplied.\n\nMore complex projects, more rooms, photorealistic renders, or urgent deadlines are agreed individually.'
    }
  },
  {
    id: 11,
    category: 'interiors',
    question: {
      hr: 'Jesu li korekcije uključene?',
      en: 'Are corrections included?'
    },
    answer: {
      hr:
        'Jedna manja korekcija, poput promjene boje, materijala, detalja ili manje prilagodbe rasporeda, uključena je u osnovnu cijenu.\n\nDodatni rad iznad uključenog opsega modeliranja obračunava se kroz dodatak za dodatnu složenost 3D idejnog rješenja (obračunska jedinica). Veća izmjena ili potpuno novo idejno rješenje dogovaraju se prema opsegu / prema ponudi.',
      en:
        'One minor revision, such as a colour, material, detail, or small layout adjustment, is included in the base price.\n\nAdditional work beyond the included modelling scope is billed through the additional-complexity add-on for a 3D concept design (billing unit). A major revision or an entirely new concept design is agreed based on scope / by quote.'
    }
  },
  {
    id: 12,
    category: 'interiors',
    question: {
      hr: 'Kako se formira cijena?',
      en: 'How is the price formed?'
    },
    answer: {
      hr:
        'Početne cijene odnose se na jednostavnije rješenje standardnog opsega. Konačna cijena ovisi o stvarnom opsegu modeliranja, broju i složenosti elemenata te dodatnoj složenosti iznad osnovnog opsega.\n\nNakon pregleda upita dobivate ponudu, a konačnu cijenu potvrđujemo prije početka izrade. Aktualne iznose možete provjeriti na stranici Cjenici.',
      en:
        'Starting prices apply to a simpler solution within a standard scope. The final price depends on the actual modelling scope, the number and complexity of elements, and any additional complexity beyond the base scope.\n\nYou receive a quote after we review your inquiry, and the final price is confirmed before work begins. Current amounts are available on the Price lists page.'
    }
  },
  {
    id: 13,
    category: 'interiors',
    question: {
      hr: 'Je li usluga samo vizualizacija prostora?',
      en: 'Is the service only for space visualization?'
    },
    answer: {
      hr:
        "Usluga za privatne klijente usmjerena je na 3D idejno rješenje i vizualnu prezentaciju prostora. Kotirani prikaz, tlocrt i nacrt pomažu razumjeti ideju, ali nisu izvedbeni ili radionički nacrti ni proizvodna dokumentacija.\n\nAni's Studio radi prema mjerama i podacima koje dostavlja klijent i ne obavlja izmjeru na lokaciji. Prije proizvodnje ili izvedbe izvođač odnosno stolar mora napraviti vlastitu izmjeru, provjeriti dimenzije i potvrditi tehničku izvedivost.",
      en:
        "The private-client service focuses on a 3D concept design and visual presentation of the space. The dimensioned view, floor plan, and elevation help explain the idea, but they are not construction drawings, workshop drawings, or production documentation.\n\nAni's Studio works from measurements and information supplied by the client and does not perform on-site measurements. Before production or installation, the contractor or carpenter must take their own measurements, verify all dimensions, and confirm technical feasibility."
    }
  },
  {
    id: 14,
    category: 'interiors',
    question: {
      hr: 'Koja je razlika između upita za privatne klijente i upita za stolare ili salone?',
      en: 'What is the difference between the inquiry for private clients and the inquiry for carpenters or showrooms?'
    },
    answer: {
      hr:
        'Upit za privatne klijente namijenjen je osobama koje uređuju vlastiti dom, kuhinju, apartman ili poslovni prostor i žele vidjeti kako će prostor izgledati prije donošenja odluke.\n\nUpit za stolare i salone namijenjen je profesionalcima koji trebaju 3D prikaz ili vizualizaciju za prezentaciju krajnjem kupcu. Ako niste sigurni koji upit odabrati, možete poslati opću poruku u kontaktima pa ćemo vas usmjeriti.',
      en:
        'The private client inquiry is for people renovating their own home, kitchen, apartment, or commercial space who want to see how the space will look before making a decision.\n\nThe carpenter and showroom inquiry is for professionals who need a 3D presentation or visualization for presenting to an end customer. If you are not sure which form to choose, you can send a general message through the contact page and we will guide you.'
    }
  },
  {
    id: 6,
    category: 'web',
    question: {
      hr: 'Što je uključeno u Web Atelier paket?',
      en: 'What is included in the Web Atelier package?'
    },
    answer: {
      hr: 'Web Atelier paket uključuje dizajn, razvoj, osnovnu SEO optimizaciju, kontakt formular i Google Analytics integraciju. Za detalje pogledajte cjenovni plan u Web Atelier sekciji.',
      en: 'The Web Atelier package includes design, development, basic SEO optimization, contact form, and Google Analytics integration. For details, see the pricing plan in the Web Atelier section.'
    }
  }
]

export default function FAQSection({
  language,
  categories,
  items,
  hideTitle = false,
  standalonePage = false,
}: FAQSectionProps) {
  const [openItems, setOpenItems] = useState<number[]>([])

  const translations = {
    title: {
      hr: "Česta pitanja",
      en: "Frequently Asked Questions"
    },
    subtitle: {
      hr: "Pronađite odgovore na najčešća pitanja",
      en: "Find answers to common questions"
    }
  }

  // Use provided items or filter FAQ_ITEMS by categories
  const displayItems = items || (categories 
    ? FAQ_ITEMS.filter(item => categories.includes(item.category))
    : FAQ_ITEMS)
  const showInteriorsPricingLink = categories?.includes('interiors') ?? false

  const toggleItem = (id: number) => {
    setOpenItems(prev =>
      prev.includes(id)
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    )
  }

  return (
    <section id="faq" className="Section fade-in relative section-with-bg">
      {/* Background wrapper */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <DecorativeSkyBackdrop priority={standalonePage ? 'high' : 'lazy'} />
        {/* Overlay for readability */}
        <div className="absolute inset-0 section-bg-overlay-light dark:section-bg-overlay-dark" />
      </div>
      
      <div
        className={
          standalonePage
            ? 'relative z-10 mx-auto min-w-0 max-w-3xl px-1 py-6 sm:px-2 sm:py-8 md:py-10 lg:py-12'
            : 'relative z-10 mx-auto min-w-0 max-w-3xl py-8 sm:py-10 lg:py-12'
        }
      >
        {/* Section Header */}
        {!hideTitle && (
          <header
            className={
              standalonePage
                ? 'mx-auto mb-8 max-w-2xl text-center sm:mb-10 lg:mb-12'
                : 'mb-6 text-center sm:mb-8'
            }
          >
            <div
              className={
                standalonePage
                  ? 'mb-3 flex flex-col items-center gap-2 sm:mb-4 sm:flex-row sm:justify-center sm:gap-3'
                  : 'mb-2 inline-flex items-center gap-2'
              }
            >
              <span className="text-2xl text-pink-500" aria-hidden>
                ❓
              </span>
              <h2
                className={
                  standalonePage
                    ? 'font-heading text-3xl font-bold tracking-tight text-balance text-plum/95 dark:text-pearl sm:text-4xl md:text-[2.25rem] md:leading-tight'
                    : 'font-heading text-2xl font-bold tracking-tight text-balance text-plum dark:text-pearl sm:text-3xl'
                }
              >
                {translations.title[language]}
              </h2>
            </div>
            <p
              className={
                standalonePage
                  ? 'mx-auto max-w-xl text-pretty text-base leading-relaxed text-plum/78 dark:text-pearl/75 sm:text-lg'
                  : 'mx-auto max-w-2xl px-1 text-sm leading-relaxed text-plum/75 dark:text-pearl/75 sm:text-base'
              }
            >
              {translations.subtitle[language]}
            </p>
          </header>
        )}

        {/* FAQ Items */}
        <div className={standalonePage ? 'space-y-3 sm:space-y-4' : 'space-y-4'}>
          {displayItems.length === 0 ? (
            <p className="text-center text-plum/80 dark:text-pearl/80 py-8">
              {language === 'hr' ? 'Nema dostupnih pitanja.' : 'No questions available.'}
            </p>
          ) : (
            displayItems.map((item, index) => {
            const isOpen = openItems.includes(item.id)
            return (
              <div
                key={item.id}
                className="rounded-xl bg-[rgba(248,246,255,0.74)] dark:bg-white/8 backdrop-blur-sm border border-[rgba(110,68,255,0.15)] dark:border-lavender/15 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:shadow-md dark:hover:shadow-[0_20px_50px_rgba(189,166,255,0.12)] transition-all duration-200 overflow-hidden fade-in"
                style={{ 
                  animationDelay: `${index * 0.1}s`,
                  animation: 'fadeInUp 0.6s ease-out forwards',
                  opacity: 0
                }}
              >
                {/* Question */}
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-3 text-left sm:gap-4 sm:px-5 sm:py-4 hover:bg-[rgba(110,68,255,0.05)] dark:hover:bg-[rgba(189,166,255,0.1)] transition-colors duration-200"
                >
                  <span className="min-w-0 flex-1 font-semibold text-base text-plum/90 dark:text-pearl">
                    {item.question[language]}
                  </span>
                  <span
                    className={`text-[--color-primary] text-xl font-bold transition-transform duration-300 flex-shrink-0 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  >
                    ▼
                  </span>
                </button>

                {/* Answer */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-[min(70vh,28rem)] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="max-h-[min(65vh,26rem)] overflow-y-auto px-4 pb-4 pt-0 text-sm leading-relaxed text-plum/75 dark:text-pearl/70 sm:px-5">
                    <div className="space-y-3">
                      {splitFaqAnswerParagraphs(item.answer[language]).map((paragraph, pIndex) => (
                        <p key={pIndex}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          }))}
        </div>
        {showInteriorsPricingLink ? (
          <div className="mt-7 flex justify-center sm:mt-8">
            <Link
              to="/cjenici/interijeri"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-amethyst/25 bg-white/65 px-5 py-2.5 text-sm font-semibold text-plum/88 shadow-sm transition hover:border-[--color-primary]/45 hover:bg-white/85 dark:border-lavender/25 dark:bg-white/[0.08] dark:text-pearl dark:hover:bg-white/[0.12]"
            >
              {language === 'hr' ? 'Pogledaj detaljan cjenik' : 'View detailed pricing'}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  )
}

