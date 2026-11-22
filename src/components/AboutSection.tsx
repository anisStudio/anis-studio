import { Link } from 'react-router-dom'
import { usePublicDepartmentVisibility } from '../hooks/usePublicDepartmentVisibility'
import { DecorativeSkyBackdrop } from './DecorativeSkyBackdrop'
import aboutStudioImage from '../assets/about/anamarija-about.png'

interface AboutSectionProps {
  language: 'hr' | 'en'
  /** O nama: jedan H1 iznad fotografije, bez zasebnog hero bloka */
  showPageTitle?: boolean
}

const HIGHLIGHTS = [
  {
    image: '/images/about/tehnicko-obrazovanje.webp',
    title: { hr: 'Tehničko obrazovanje', en: 'Technical education' },
    desc: {
      hr: 'Preciznost u razradi i pažnja prema detaljima.',
      en: 'Precision in development and attention to detail.',
    },
  },
  {
    image: '/images/about/fizika-i-tehnika.webp',
    title: { hr: 'mag. educ. phys. et techn.', en: 'M.Ed. physics & technical culture' },
    desc: {
      hr: 'Složene ideje volim prikazati jasno i razumljivo.',
      en: 'I like presenting complex ideas clearly and understandably.',
    },
  },
  {
    image: '/images/about/tehnicko-crtanje-i-3d.webp',
    title: { hr: 'Tehničko crtanje i 3D modeliranje', en: 'Technical drawing & 3D modeling' },
    desc: {
      hr: 'Od prve skice do prikaza koji pomaže pri odluci.',
      en: 'From the first sketch to visuals that support decisions.',
    },
  },
  {
    image: '/images/about/strast-prema-strojevima.webp',
    title: { hr: 'Strast prema strojevima', en: 'Passion for machines' },
    desc: {
      hr: 'Zanimaju me alati, mehanika i način na koji stvari nastaju.',
      en: 'I am drawn to tools, mechanics, and how things are made.',
    },
  },
  {
    image: '/images/about/novi-alati.webp',
    title: { hr: 'Isprobavam nove alate', en: 'Trying new tools' },
    desc: {
      hr: 'Nove alate i tehnike isprobavam na konkretnim projektima.',
      en: 'I try new tools and techniques on real projects.',
    },
  },
] as const

export default function AboutSection({ language, showPageTitle = false }: AboutSectionProps) {
  const visibility = usePublicDepartmentVisibility()

  const copy = {
    pageTitle: { hr: "Ani's Studio", en: "Ani's Studio" },
    intro: {
      hr: 'Ja sam Anamarija, osnivačica Ani\'s Studija. U radu spajam tehničku preciznost, dizajn i suvremene alate. Važno mi je da ideja od početka bude jasna, a detalji promišljeni za izvedbu.',
      en: 'I am Anamarija, founder of Ani\'s Studio. I combine technical precision, design, and modern tools. I want the idea to be clear from the start, with details planned for execution.',
    },
    departments: {
      interiors: {
        hr: 'Interijeri — Izrađujem 3D prikaze interijera i kuhinja kako biste prije izvedbe mogli vidjeti raspored, materijale i atmosferu prostora.',
        en: 'Interiors — I create 3D interior and kitchen visualizations so you can see layout, materials, and atmosphere before work begins.',
      },
      lrc: {
        hr: 'LRC — Oblikujem personalizirane predmete i poklone ručnom izradom i laserskom obradom.',
        en: 'LRC — I shape personalized gifts and items through handcraft and laser work.',
      },
      webAtelier: {
        hr: 'Web Atelier — Dizajniram web stranice za male poslovne subjekte koje jasno predstavljaju ponudu i olakšavaju prvi kontakt.',
        en: 'Web Atelier — I design websites for small businesses that present their offer clearly and make first contact easier.',
      },
    },
    buttons: {
      interiors: { hr: '3D vizualizacija', en: '3D visualization' },
      lrc: { hr: 'LRC ponuda', en: 'LRC offer' },
      webAtelier: { hr: 'Web Atelier ponuda', en: 'Web Atelier offer' },
      contact: { hr: 'Pokreni projekt', en: 'Start a project' },
    },
    imageAlt: {
      hr: "Anamarija — Ani's Studio",
      en: "Anamarija — Ani's Studio",
    },
  }

  const departmentParagraphs = [
    visibility.interiors ? copy.departments.interiors : null,
    visibility.lrc ? copy.departments.lrc : null,
    visibility.webAtelier ? copy.departments.webAtelier : null,
  ].filter(Boolean) as { hr: string; en: string }[]

  const serviceButtons = [
    visibility.interiors
      ? { key: 'interiors' as const, to: '/interijeri', label: copy.buttons.interiors }
      : null,
    visibility.lrc ? { key: 'lrc' as const, to: '/lrc', label: copy.buttons.lrc } : null,
    visibility.webAtelier
      ? { key: 'webAtelier' as const, to: '/web-atelier', label: copy.buttons.webAtelier }
      : null,
  ].filter(Boolean) as {
    key: 'interiors' | 'lrc' | 'webAtelier'
    to: string
    label: { hr: string; en: string }
  }[]

  return (
    <section
      id="about"
      className={`Section fade-in relative section-with-bg ${
        showPageTitle ? '!pt-8 max-sm:!pt-6 sm:!pt-10' : ''
      }`}
    >
      <div className="absolute inset-0 overflow-hidden -z-10">
        <DecorativeSkyBackdrop priority={showPageTitle ? 'high' : 'lazy'} />
        <div className="absolute inset-0 section-bg-overlay-light dark:section-bg-overlay-dark" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl min-w-0 px-4 sm:px-6">
        {showPageTitle ? (
          <h1 className="mx-auto max-w-2xl break-words text-center font-heading text-3xl font-bold tracking-tight text-balance text-plum/95 dark:text-pearl max-sm:mb-3 max-sm:text-[1.65rem] sm:mb-5 sm:text-4xl md:text-[2.5rem] md:leading-[1.15]">
            {copy.pageTitle[language]}
          </h1>
        ) : null}
        <div
          className={`flex flex-col lg:flex-row lg:items-start lg:gap-10 ${
            showPageTitle ? 'gap-3 max-sm:gap-2 sm:gap-8' : 'gap-8 sm:mt-2'
          }`}
        >
          <div className="about-studio-photo-col order-1 flex w-full justify-center lg:order-none lg:w-[42%] lg:shrink-0 lg:justify-start">
            <div className="about-studio-photo-frame relative w-full max-w-md rounded-2xl border border-[rgba(110,68,255,0.14)] bg-white/45 p-2 shadow-md backdrop-blur-md dark:border-lavender/18 dark:bg-white/[0.06]">
              <img
                src={aboutStudioImage}
                alt={copy.imageAlt[language]}
                width={1448}
                height={1086}
                className="about-studio-photo-img block h-auto w-full rounded-xl object-contain"
                decoding="async"
                loading="lazy"
              />
            </div>
          </div>

          <div className="order-2 min-w-0 flex-1 space-y-4 text-base leading-relaxed text-plum/85 dark:text-pearl/80 lg:pt-1">
            <p>{copy.intro[language]}</p>
            {departmentParagraphs.map((block) => (
              <p key={block.hr}>{block[language]}</p>
            ))}
          </div>
        </div>

        <nav
            className="mt-8 flex flex-wrap justify-center gap-3 sm:mt-10 sm:gap-4"
            aria-label={language === 'hr' ? 'Usluge i kontakt' : 'Services and contact'}
          >
            {serviceButtons.map((btn) => (
              <Link
                key={btn.key}
                to={btn.to}
                className="pill px-5 py-2.5 text-sm font-semibold text-plum/90 transition hover:scale-[1.02] dark:text-pearl"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(189, 166, 255, 0.15) 0%, rgba(110, 68, 255, 0.1) 100%)',
                  borderColor: 'rgba(110, 68, 255, 0.3)',
                }}
              >
                {btn.label[language]}
              </Link>
            ))}
            <Link to="/kontakt" className="btn btn-primary min-h-[44px] px-6 py-2.5 text-sm font-semibold">
              {copy.buttons.contact[language]}
            </Link>
          </nav>

        <div className="mt-10 grid grid-cols-1 gap-4 border-t border-[rgba(110,68,255,0.1)] pt-10 dark:border-lavender/15 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 sm:gap-5">
          {HIGHLIGHTS.map((item) => (
            <div
              key={item.image}
              className="flex flex-col items-center rounded-xl border border-[rgba(110,68,255,0.15)] bg-white/70 p-4 text-center shadow-sm backdrop-blur-sm dark:border-lavender/15 dark:bg-white/8"
            >
              <img
                src={item.image}
                alt=""
                width={160}
                height={160}
                className="mb-3 h-20 w-20 object-contain"
                loading="lazy"
                decoding="async"
              />
              <h3 className="font-heading text-xs font-bold leading-snug text-[--color-primary] sm:text-sm">
                {item.title[language]}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-plum/78 dark:text-pearl/65">{item.desc[language]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}