import { Link } from 'react-router-dom'
import { ErrorBoundary } from '../ErrorBoundary'
import FAQSection from '../sections/FAQSection'
import type { FAQItem } from '../sections/FAQSection'
import { AnimatedPage } from '../components/AnimatedPage'
import { PageSEO } from '../components/PageSEO'

interface FAQPageProps {
  language: 'hr' | 'en'
}

const GLOBAL_FAQ_ITEMS: FAQItem[] = [
  {
    id: 7,
    category: 'global',
    question: {
      hr: 'Kako izgleda suradnja od prvog upita do gotovog projekta?',
      en: 'How does collaboration look from the first inquiry to the finished project?'
    },
    answer: {
      hr: 'Suradnja započinje prvim kontaktom (forma / e-mail / Instagram), nakon čega slijedi kratko upoznavanje i pitanja o prostoru/webu/biznisu. Zatim pripremam prijedlog paketa i rokova, radim na konceptu, provodim dorade, te na kraju šaljem završne materijale i upute za sljedeće korake.',
      en: 'Collaboration starts with the first contact (form / email / Instagram), followed by a brief introduction and questions about the space/web/business. Then I prepare a package proposal and deadlines, work on the concept, conduct revisions, and finally send final materials and instructions for next steps.'
    }
  },
  {
    id: 8,
    category: 'global',
    question: {
      hr: 'Radite li samo u Zagrebu ili i online / na daljinu?',
      en: 'Do you work only in Zagreb or also online / remotely?'
    },
    answer: {
      hr: "Usluge se pružaju online ili uživo, ovisno o odjelu. Ani's Interijeri u pravilu se pružaju online na temelju mjera, fotografija i podataka koje dostavlja klijent. Prema prethodnom dogovoru moguć je dolazak radi pregleda prostora, ali takav dolazak ne predstavlja završnu izmjeru za izradu ili montažu namještaja. Završnu izmjeru i tehničku provjeru prije izrade obavlja izvođač ili stolar. LRC radionice uglavnom se održavaju uživo, uz dio komunikacije i materijala online, dok se Web Atelier može odraditi potpuno na daljinu.",
      en: "Services are provided online or in person, depending on the department. Ani's Interiors is generally provided online based on measurements, photographs, and information supplied by the client. A site visit may be arranged in advance to review the space, but it does not constitute the final measurement for furniture production or installation. The contractor or carpenter is responsible for the final measurements and technical checks before production. LRC workshops are generally held in person, with some communication and materials provided online, while Web Atelier can be completed entirely remotely."
    }
  },
  {
    id: 9,
    category: 'global',
    question: {
      hr: 'Kako funkcionira plaćanje i rate?',
      en: 'How does payment and installments work?'
    },
    answer: {
      hr: 'Manje usluge (radionica i sl.) → plaćanje unaprijed. Veći projekti (interijeri, web) → plaćanje po fazama: predujam za rezervaciju termina, druga rata nakon odobrenja koncepta, zadnja rata prije isporuke finalnih materijala.',
      en: 'Smaller services (workshop etc.) → payment in advance. Larger projects (interiors, web) → payment in installments: advance payment for reservation, second installment after concept approval, final installment before delivery of final materials.'
    }
  },
  {
    id: 10,
    category: 'global',
    question: {
      hr: 'Koliko unaprijed se trebam javiti da bih osigurala termin?',
      en: 'How far in advance should I contact you to secure a time slot?'
    },
    answer: {
      hr: 'Za interijere → idealno 2–3 mjeseca prije radova ili narudžbe namještaja. Za web → 1–2 mjeseca prije željenog lansiranja. Za radionice → čim najavim novi ciklus, mjesta se znaju brzo popuniti.',
      en: 'For interiors → ideally 2–3 months before work or furniture order. For web → 1–2 months before desired launch. For workshops → as soon as I announce a new cycle, places tend to fill up quickly.'
    }
  },
  {
    id: 11,
    category: 'global',
    question: {
      hr: 'Što ako trebam više izmjena od onoga što je uključeno u paket?',
      en: 'What if I need more revisions than what is included in the package?'
    },
    answer: {
      hr: 'Svaki paket ima uključeni broj krugova izmjena (u ponudi). Manje kozmetičke izmjene obično stanu u taj okvir. Veće promjene (drugi stil, druga organizacija) tretiramo kao dodatnu mini-fazu uz prethodni dogovor.',
      en: 'Each package includes a number of revision rounds (in the offer). Minor cosmetic changes usually fit within that framework. Larger changes (different style, different organization) are treated as an additional mini-phase with prior agreement.'
    }
  },
  {
    id: 12,
    category: 'global',
    question: {
      hr: 'Što ako usput shvatim da možda trebam drugačiju uslugu?',
      en: 'What if I realize along the way that I might need a different service?'
    },
    answer: {
      hr: 'Suradnju gradimo korak po korak. Ako vidimo da vam ne treba puni paket, možemo ga suziti (npr. samo konzultacije, samo raspored, samo nekoliko stranica weba). Ako odustanete prije početka rada → zadržava se samo predujam. Ako odustanete nakon što je dio posla već odrađen → naplaćuje se odrađeni dio.',
      en: 'We build collaboration step by step. If we see that you don\'t need the full package, we can reduce it (e.g., only consultations, only layout, only a few web pages). If you cancel before work begins → only the advance payment is retained. If you cancel after part of the work is already done → the completed part is charged.'
    }
  },
  {
    id: 13,
    category: 'global',
    question: {
      hr: 'Kako izgleda komunikacija tijekom projekta?',
      en: 'How does communication look during the project?'
    },
    answer: {
      hr: 'E-mail za službenu komunikaciju i slanje materijala. WhatsApp / Viber / Slack za brze provjere (po dogovoru). Zoom / Google Meet za ključne faze (brief, prezentacija koncepta, završni walkthrough). Na početku dogovaramo glavni kanal i okvirni ritam javljanja.',
      en: 'Email for official communication and sending materials. WhatsApp / Viber / Slack for quick checks (by agreement). Zoom / Google Meet for key phases (brief, concept presentation, final walkthrough). At the beginning, we agree on the main channel and approximate communication rhythm.'
    }
  }
]

const finalCtaCopy = {
  heading: {
    hr: 'Spremni za prvi korak?',
    en: 'Ready to take the first step?'
  },
  subline: {
    hr: 'Ako vam je sve jasno, javite nam se — kratkim upitom započinjemo razgovor o vašem projektu.',
    en: 'If everything is clear, get in touch — a short message starts the conversation about your project.'
  },
  button: {
    hr: 'Pokreni projekt',
    en: "Let's start a project"
  }
} as const

export default function FAQPage({ language }: FAQPageProps) {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: GLOBAL_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question.hr,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer.hr,
      },
    })),
  }

  return (
    <AnimatedPage>
      <PageSEO
        title="Često postavljana pitanja"
        description="Odgovori na najčešća pitanja o procesu suradnje, rokovima, plaćanju i uslugama Ani's Studija."
        canonical="/faq"
        jsonLd={faqJsonLd}
      />
      <main className="min-w-0">
        <ErrorBoundary name="FAQ">
          <FAQSection language={language} items={GLOBAL_FAQ_ITEMS} hideTitle={false} standalonePage />
        </ErrorBoundary>

        <ErrorBoundary name="FAQFinalCta">
          <section className="Section fade-in px-4 pb-12 sm:px-6 sm:pb-14 lg:pb-16" aria-labelledby="faq-final-cta-heading">
            <div className="mx-auto max-w-xl">
              <div className="rounded-2xl border border-[rgba(110,68,255,0.12)] bg-white/50 p-6 text-center shadow-[0_8px_40px_rgba(46,36,71,0.06)] backdrop-blur-md dark:border-lavender/12 dark:bg-white/[0.04] dark:shadow-[0_12px_48px_rgba(0,0,0,0.25)] sm:p-8">
                <h2
                  id="faq-final-cta-heading"
                  className="font-heading text-xl font-bold tracking-tight text-balance text-plum/95 dark:text-pearl sm:text-2xl"
                >
                  {finalCtaCopy.heading[language]}
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-plum/78 dark:text-pearl/72 sm:mt-4 sm:text-[0.9375rem] sm:leading-relaxed">
                  {finalCtaCopy.subline[language]}
                </p>
                <Link
                  to="/kontakt"
                  className="btn btn-primary mt-6 inline-flex min-h-[48px] w-full max-w-sm items-center justify-center px-8 py-3 text-base font-semibold shadow-md transition-all duration-300 hover:shadow-lg sm:mt-7 sm:w-auto sm:px-10 sm:py-3.5"
                >
                  {finalCtaCopy.button[language]}
                </Link>
              </div>
            </div>
          </section>
        </ErrorBoundary>
      </main>
    </AnimatedPage>
  )
}

