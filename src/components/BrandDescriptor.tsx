import clsx from 'clsx'
import { usePublicDepartmentVisibility } from '../hooks/usePublicDepartmentVisibility'

/** Interiors-first copy when loading or when Interiors is the only visible line. */
const INTERIORS_FIRST = {
  hr: {
    labels: ['3D vizualizacije', 'Interijeri', 'Vizualna prezentacija'],
    ariaLabel: '3D vizualizacije, Interijeri, Vizualna prezentacija',
  },
  en: {
    labels: ['3D visualisations', 'Interiors', 'Visual presentation'],
    ariaLabel: '3D visualisations, Interiors, Visual presentation',
  },
} as const

function sectionDescriptor(
  language: 'hr' | 'en',
  lrcVisible: boolean,
  interiorsVisible: boolean,
  webAtelierVisible: boolean,
): { labels: readonly string[]; ariaLabel: string } {
  const onlyInteriorsForRichCopy = interiorsVisible && !lrcVisible && !webAtelierVisible
  if (onlyInteriorsForRichCopy) {
    return INTERIORS_FIRST[language]
  }

  const labels =
    language === 'hr'
      ? ([
          lrcVisible && 'LRC',
          interiorsVisible && 'Interijeri',
          webAtelierVisible && 'Web Atelier',
        ].filter(Boolean) as string[])
      : ([
          lrcVisible && 'LRC',
          interiorsVisible && 'Interiors',
          webAtelierVisible && 'Web Atelier',
        ].filter(Boolean) as string[])

  return { labels, ariaLabel: labels.join(', ') }
}

/** Adapts tagline to admin public visibility; optional `language` (footer defaults to Croatian). */
export function BrandDescriptor({
  className,
  language = 'hr',
}: {
  className?: string
  language?: 'hr' | 'en'
}) {
  const { lrc: lrcVisible, interiors: interiorsVisible, webAtelier: webAtelierVisible } =
    usePublicDepartmentVisibility()

  const labelClass =
    'text-[0.625rem] sm:text-[0.6875rem] font-normal tracking-[0.04em] text-plum/58 dark:text-pearl/52'
  const diamondClass =
    'inline-block shrink-0 align-[-0.1em] text-[1.1em] sm:text-[1.14em] font-semibold leading-none text-amethyst/70 dark:text-lavender/65'

  const { labels, ariaLabel } = sectionDescriptor(
    language,
    lrcVisible,
    interiorsVisible,
    webAtelierVisible,
  )

  return (
    <p
      className={clsx(
        'm-0 flex max-w-full flex-wrap items-baseline justify-center gap-x-1.5 gap-y-1 sm:justify-start sm:gap-x-2',
        className
      )}
      {...(labels.length > 0 ? { 'aria-label': ariaLabel } : { 'aria-hidden': true })}
    >
      {labels.map((label) => (
        <span key={label} className="contents">
          <span className={diamondClass} aria-hidden>
            ◆
          </span>
          <span className={labelClass}>{label}</span>
        </span>
      ))}
    </p>
  )
}
