import { AnimatedPage } from '../components/AnimatedPage'
import { CONTACT_INFO } from '../config/contact'
import { PageSEO } from '../components/PageSEO'

interface PolitikaPrivatnostiPageProps {
  language: 'hr' | 'en'
}

const copy = {
  pageTitle: {
    hr: "Politika privatnosti — Ani's Studio",
    en: "Privacy Policy — Ani's Studio",
  },
  pageDescription: {
    hr: "Politika privatnosti Ani's Studio. Saznajte kako koristimo i štitimo vaše osobne podatke.",
    en: "Privacy Policy for Ani's Studio. Learn how we use and protect your personal data.",
  },
  heading: {
    hr: 'Politika privatnosti',
    en: 'Privacy Policy',
  },
  intro: {
    hr: "Ani's Studio poštuje privatnost korisnika i osobne podatke koristi isključivo za svrhe za koje su dostavljeni. Ova stranica objašnjava koje podatke prikupljamo, zašto i kako ih koristimo.",
    en: "Ani's Studio respects the privacy of its users and uses personal data only for the purposes for which it was provided. This page explains what data we collect, why, and how we use it.",
  },
  sections: {
    controller: {
      title: { hr: 'Voditelj obrade podataka', en: 'Data Controller' },
      body: {
        hr: `Voditelj obrade je Ani's Studio. Za sva pitanja vezana uz obradu osobnih podataka možete nas kontaktirati na: ${CONTACT_INFO.email}`,
        en: `The data controller is Ani's Studio. For any questions regarding the processing of personal data, you can contact us at: ${CONTACT_INFO.email}`,
      },
    },
    whatWeCollect: {
      title: { hr: 'Koje podatke prikupljamo', en: 'What Data We Collect' },
      body: {
        hr: 'Ovisno o usluzi ili upitu, možemo prikupiti: ime i prezime, email adresu, broj telefona (ako je unesen), sadržaj poruke ili upita, informacije o projektu, priložene datoteke (tlocrte, fotografije, skice), te — kod recenzija — tekst recenzije, javno ime za prikaz i lokaciju ako ih korisnik unese.',
        en: 'Depending on the service or inquiry, we may collect: your name, email address, phone number (if provided), the content of your message or inquiry, project information, uploaded files (floor plans, photos, sketches), and — for reviews — review text, public display name, and location if provided by the user.',
      },
    },
    whyWeUseIt: {
      title: { hr: 'Zašto koristimo vaše podatke', en: 'Why We Use Your Data' },
      body: {
        hr: 'Vaše podatke koristimo isključivo za: odgovor na upit, pripremu ponude, komunikaciju o projektu ili suradnji, te obradu i moderaciju recenzija.',
        en: 'We use your data exclusively for: responding to inquiries, preparing offers, communicating about projects or collaborations, and processing and moderating reviews.',
      },
    },
    files: {
      title: { hr: 'Priložene datoteke', en: 'Uploaded Files' },
      body: {
        hr: 'Datoteke koje priložite (tlocrti, fotografije prostora, skice, inspiracijski materijali) koriste se samo za razumijevanje vašeg upita i projekta. Nisu javno dostupne i ne dijele se s trećim stranama.',
        en: 'Files you upload (floor plans, space photos, sketches, inspiration materials) are used only to understand your inquiry and project. They are not publicly accessible and are not shared with third parties.',
      },
    },
    reviews: {
      title: { hr: 'Recenzije', en: 'Reviews' },
      body: {
        hr: `Recenzije se objavljuju na web stranici isključivo nakon pregleda i uz izričitu privolu korisnika. Korisnik može u bilo kojem trenutku zatražiti izmjenu ili uklanjanje javno prikazane recenzije slanjem poruke na ${CONTACT_INFO.email}.`,
        en: `Reviews are published on the website only after review and with explicit user consent. Users may at any time request modification or removal of a publicly displayed review by contacting ${CONTACT_INFO.email}.`,
      },
    },
    retention: {
      title: { hr: 'Čuvanje podataka', en: 'Data Retention' },
      body: {
        hr: 'Podatke čuvamo koliko je potrebno za obradu upita, pripremu ponude, komunikaciju ili provedbu dogovorenog projekta, a najdulje 24 mjeseca od zadnje komunikacije — osim ako postoji zakonska obveza ili opravdan razlog za dulje čuvanje.',
        en: 'We retain data for as long as necessary to process an inquiry, prepare an offer, communicate, or carry out an agreed project, and no longer than 24 months from the last communication — unless there is a legal obligation or justified reason for longer retention.',
      },
    },
    sharing: {
      title: { hr: 'Dijeljenje podataka', en: 'Data Sharing' },
      body: {
        hr: 'Vaši podaci se ne prodaju. Ne dijele se s trećim osobama osim ako je to potrebno za pružanje usluge, tehničko održavanje stranice, ispunjavanje zakonske obveze ili uz vašu privolu.',
        en: 'Your data is not sold. It is not shared with third parties unless necessary for providing the service, technical maintenance of the website, fulfilling a legal obligation, or with your consent.',
      },
    },
    cookiesAnalytics: {
      title: { hr: 'Kolačići i analitika', en: 'Cookies and analytics' },
      body: {
        hr:
          'Stranica može koristiti funkcionalnu lokalnu pohranu za postavke kao što su jezik, tema ili košarica. Ako prihvatite analitičke kolačiće, možemo koristiti Google Analytics za razumijevanje posjećenosti i poboljšanje sadržaja. Analitički kolačići nisu nužni za rad stranice i možete ih odbiti.',
        en:
          'The website may use functional local storage for preferences such as language, theme, or cart. If you accept analytics cookies, we may use Google Analytics to understand website usage and improve the content. Analytics cookies are not required for the website to work and you can decline them.',
      },
    },
    rights: {
      title: { hr: 'Vaša prava', en: 'Your Rights' },
      body: {
        hr: `Imate pravo zatražiti pristup, ispravak ili brisanje svojih osobnih podataka. Zahtjev možete poslati na: ${CONTACT_INFO.email}`,
        en: `You have the right to request access to, correction of, or deletion of your personal data. You can send your request to: ${CONTACT_INFO.email}`,
      },
    },
    note: {
      title: { hr: 'Napomena', en: 'Note' },
      body: {
        hr: 'Ova stranica je informativna i može se ažurirati prema razvoju usluga. Preporučujemo povremenu provjeru sadržaja.',
        en: 'This page is informational and may be updated as services develop. We recommend checking back occasionally.',
      },
    },
  },
}

export default function PolitikaPrivatnostiPage({ language }: PolitikaPrivatnostiPageProps) {
  const s = copy.sections

  return (
    <AnimatedPage>
      <PageSEO
        title={copy.pageTitle[language]}
        description={copy.pageDescription[language]}
        canonical="/politika-privatnosti"
        noIndex
      />
      <main className="min-w-0">
        <section className="Section fade-in">
          <div className="mx-auto min-w-0 max-w-2xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <h1 className="mb-6 font-heading text-3xl font-bold tracking-tight text-plum/95 dark:text-pearl sm:text-4xl">
              {copy.heading[language]}
            </h1>

            <p className="mb-10 text-base leading-relaxed text-plum/78 dark:text-pearl/75 sm:text-[1.0625rem]">
              {copy.intro[language]}
            </p>

            <div className="space-y-8">
              {Object.values(s).map((section) => (
                <div
                  key={section.title.hr}
                  className="rounded-2xl border border-[rgba(110,68,255,0.1)] bg-white/60 px-5 py-5 shadow-sm backdrop-blur-sm dark:border-lavender/12 dark:bg-white/[0.04] sm:px-6"
                >
                  <h2 className="mb-2 font-heading text-base font-bold tracking-tight text-plum/90 dark:text-pearl sm:text-lg">
                    {section.title[language]}
                  </h2>
                  <p className="text-sm leading-relaxed text-plum/75 dark:text-pearl/70 sm:text-[0.9375rem]">
                    {section.body[language]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </AnimatedPage>
  )
}
