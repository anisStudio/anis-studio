import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import clsx from 'clsx'
import type { Testimonial, TestimonialCategory } from '../data/testimonials'
import { parseRating1to5 } from '../lib/testimonials'

export type TestimonialRowTone = 'purple' | 'softPink' | 'softBlue'

/** Row groups: trust = general + interiors combined; lrc; webAtelier */
export type TestimonialRowGroupKey = 'trust' | 'lrc' | 'webAtelier'

/** Horizontal scroll: 'left' = default track motion; 'right' = reversed (e.g. LRC row). */
export type TestimonialMarqueeDirection = 'left' | 'right'

export interface TestimonialMarqueeRowBlock {
  groupKey: TestimonialRowGroupKey
  items: Testimonial[]
  rowTone: TestimonialRowTone
  /** Marquee travel: trust/webAtelier typically 'left', LRC typically 'right'. */
  marqueeDirection?: TestimonialMarqueeDirection
  /** Preview-only placeholder when Web Atelier has no testimonials yet */
  emptyPreview?: boolean
}

interface TestimonialMarqueeProps {
  language: 'hr' | 'en'
  rowBlocks: TestimonialMarqueeRowBlock[]
}

const MARQUEE_DURATION_SEC = 36
const MARQUEE_DURATION_COARSE_SEC = 50

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduce(mq.matches)
    const onChange = () => setReduce(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduce
}

/** True when primary pointer is coarse (typical touch / tablet touch). */
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    setCoarse(mq.matches)
    const onChange = () => setCoarse(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return coarse
}

/** Purple-forward gradients so white initials stay readable in light and dark UI. */
const avatarGradients = [
  'from-amethyst to-plum',
  'from-violet-700 to-amethyst',
  'from-plum to-violet-800',
  'from-amethyst to-violet-900',
  'from-violet-800 to-plum',
]

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

/**
 * One horizontal marquee lane.
 * On coarse (touch) devices: static horizontal scroll with snap.
 * On fine (desktop) pointers: animated marquee with hover pause.
 */
function MarqueeLane({
  items,
  language,
  verifiedLabel,
  renderStars,
  rowTone,
  direction,
  autoPaused,
}: {
  items: Testimonial[]
  language: 'hr' | 'en'
  verifiedLabel: string
  renderStars: (rating: number) => ReactNode
  rowTone: TestimonialRowTone
  direction: TestimonialMarqueeDirection
  autoPaused: boolean
}) {
  const isCoarse = useCoarsePointer()
  const rowRef = useRef<HTMLDivElement>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [touchHold, setTouchHold] = useState(false)

  const displayItems = items.length > 1 ? [...items, ...items] : items

  useEffect(() => {
    if (activeKey === null) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setActiveKey(null)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [activeKey])

  useEffect(() => {
    if (activeKey === null) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setActiveKey(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activeKey])

  const handleRowFocusOut = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null
    if (next && rowRef.current?.contains(next)) return
    setActiveKey(null)
  }

  const paused = autoPaused || touchHold || (activeKey !== null && !isCoarse)

  return (
    <div
      ref={rowRef}
      data-coarse-pointer={isCoarse ? 'true' : 'false'}
      data-paused={paused ? 'true' : 'false'}
      onBlur={handleRowFocusOut}
      className={clsx(
        'testimonial-marquee-row group/marquee relative py-2',
        isCoarse && paused
          ? 'overflow-x-auto overflow-y-visible scrollbar-thin scrollbar-thumb-amethyst/20 scrollbar-track-transparent snap-x snap-mandatory'
          : 'overflow-x-hidden overflow-y-visible',
        direction === 'right' && 'marquee-dir-right'
      )}
    >
      <div
        className={clsx(
          'isolate flex gap-3 sm:gap-4',
          displayItems.length > items.length ? 'testimonial-marquee-track w-max' : 'w-full'
        )}
        style={
          displayItems.length > items.length
            ? { animationDuration: `${isCoarse ? MARQUEE_DURATION_COARSE_SEC : MARQUEE_DURATION_SEC}s` }
            : undefined
        }
      >
        {displayItems.map((testimonial, index) => {
          const cardKey = `${testimonial.id}-${index}`
          return (
            <TestimonialCard
              key={cardKey}
              testimonial={testimonial}
              language={language}
              cardIndex={index % items.length}
              verifiedLabel={verifiedLabel}
              renderStars={renderStars}
              layout="marquee"
              rowTone={rowTone}
              isCoarse={isCoarse}
              expandedTap={isCoarse && activeKey === cardKey}
              onCoarseToggle={() =>
                setActiveKey((prev) => (prev === cardKey ? null : cardKey))
              }
              onCoarseTouchHold={(hold) => setTouchHold(hold)}
            />
          )
        })}
      </div>
    </div>
  )
}

function toneCardClasses(rowTone: TestimonialRowTone, layout: 'marquee' | 'grid'): string {
  if (rowTone === 'softPink') {
    return clsx(
      'border-rose-200/35 dark:border-rose-300/25',
      layout === 'marquee' && [
        '[@media(hover:hover)_and_(pointer:fine)]:hover:border-rose-300/45 dark:[@media(hover:hover)_and_(pointer:fine)]:hover:border-rose-400/35',
        'focus-within:border-rose-300/45 dark:focus-within:border-rose-400/35',
        'focus-visible:outline-rose-400/45 dark:focus-visible:outline-rose-300/40',
      ],
      layout === 'grid' &&
        'dark:hover:border-rose-400/25 dark:focus-within:border-rose-400/30 hover:border-rose-200/45'
    )
  }
  if (rowTone === 'softBlue') {
    return clsx(
      'border-sky-200/45 dark:border-sky-400/28',
      layout === 'marquee' && [
        '[@media(hover:hover)_and_(pointer:fine)]:hover:border-sky-300/55 dark:[@media(hover:hover)_and_(pointer:fine)]:hover:border-sky-400/40',
        'focus-within:border-sky-300/55 dark:focus-within:border-sky-400/40',
        'focus-visible:outline-sky-400/45 dark:focus-visible:outline-sky-300/40',
      ],
      layout === 'grid' &&
        'dark:hover:border-sky-400/30 dark:focus-within:border-sky-400/35 hover:border-sky-200/55'
    )
  }
  return clsx(
    'border-amethyst/18 dark:border-lavender/12',
    layout === 'marquee' && [
      '[@media(hover:hover)_and_(pointer:fine)]:hover:border-amethyst/28 dark:[@media(hover:hover)_and_(pointer:fine)]:hover:border-lavender/22',
      'focus-within:border-amethyst/28 dark:focus-within:border-lavender/22',
      'focus-visible:outline-amethyst/40 dark:focus-visible:outline-lavender/40',
    ],
    layout === 'grid' &&
      'dark:focus-within:border-lavender/22 dark:hover:border-lavender/18 hover:border-amethyst/25'
  )
}

function toneMarqueeHoverShadow(rowTone: TestimonialRowTone): string {
  if (rowTone === 'softPink') {
    return '[@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_16px_44px_rgba(190,24,93,0.12)] dark:[@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_18px_48px_rgba(251,113,133,0.12)] focus-within:shadow-[0_16px_44px_rgba(190,24,93,0.12)] dark:focus-within:shadow-[0_18px_48px_rgba(251,113,133,0.1)]'
  }
  if (rowTone === 'softBlue') {
    return '[@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_16px_44px_rgba(14,116,144,0.14)] dark:[@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_18px_48px_rgba(56,189,248,0.12)] focus-within:shadow-[0_16px_44px_rgba(14,116,144,0.14)] dark:focus-within:shadow-[0_18px_48px_rgba(56,189,248,0.1)]'
  }
  return '[@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_16px_44px_rgba(110,68,255,0.14)] dark:[@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_18px_48px_rgba(189,166,255,0.1)] focus-within:shadow-[0_16px_44px_rgba(110,68,255,0.14)] dark:focus-within:shadow-[0_18px_48px_rgba(189,166,255,0.1)]'
}

function toneMarqueeTapOpen(rowTone: TestimonialRowTone): string {
  if (rowTone === 'softPink') {
    return 'border-rose-300/45 shadow-[0_16px_44px_rgba(190,24,93,0.12)] dark:border-rose-400/35 dark:shadow-[0_18px_48px_rgba(251,113,133,0.1)]'
  }
  if (rowTone === 'softBlue') {
    return 'border-sky-300/55 shadow-[0_16px_44px_rgba(14,116,144,0.14)] dark:border-sky-400/40 dark:shadow-[0_18px_48px_rgba(56,189,248,0.1)]'
  }
  return 'border-amethyst/28 shadow-[0_16px_44px_rgba(110,68,255,0.14)] dark:border-lavender/22 dark:shadow-[0_18px_48px_rgba(189,166,255,0.1)]'
}

function toneQuoteBoxClasses(rowTone: TestimonialRowTone): string {
  if (rowTone === 'softPink') {
    return 'border-rose-200/20 bg-white/55 dark:border-rose-400/15 dark:bg-white/[0.05]'
  }
  if (rowTone === 'softBlue') {
    return 'border-sky-200/25 bg-white/55 dark:border-sky-400/18 dark:bg-white/[0.05]'
  }
  return 'border-amethyst/10 bg-white/55 dark:border-lavender/10 dark:bg-white/[0.05]'
}

/** Lijevi naglasak (blockquote) — tekst bez ručnih navodnika u sadržaju */
function toneQuoteLeftAccentClass(rowTone: TestimonialRowTone): string {
  if (rowTone === 'softPink') {
    return 'border-l-[3px] border-l-rose-400/45 dark:border-l-rose-400/35'
  }
  if (rowTone === 'softBlue') {
    return 'border-l-[3px] border-l-sky-400/50 dark:border-l-sky-400/40'
  }
  return 'border-l-[3px] border-l-amethyst/40 dark:border-l-lavender/35'
}

function testimonialDisplayRating(testimonial: Testimonial): number | null {
  return parseRating1to5(testimonial.rating)
}

function toneVerifiedBadgeClasses(rowTone: TestimonialRowTone): string {
  if (rowTone === 'softPink') {
    return 'border-rose-200/25 bg-white/70 text-rose-800/90 dark:border-rose-400/30 dark:bg-white/10 dark:text-rose-100/90'
  }
  if (rowTone === 'softBlue') {
    return 'border-sky-200/35 bg-white/70 text-sky-900/85 dark:border-sky-400/35 dark:bg-white/10 dark:text-sky-100/90'
  }
  return 'border-amethyst/15 bg-white/70 text-amethyst/90 dark:border-lavender/25 dark:bg-white/10 dark:text-lavender/90'
}

function getTestimonialCategoryLabel(category: TestimonialCategory, language: 'hr' | 'en'): string {
  const hr: Record<TestimonialCategory, string> = {
    general: 'Općenito',
    interiors: 'Interijeri',
    lrc: 'LRC',
    webAtelier: 'Web Atelier',
  }
  const en: Record<TestimonialCategory, string> = {
    general: 'General',
    interiors: 'Interiors',
    lrc: 'LRC',
    webAtelier: 'Web Atelier',
  }
  return language === 'hr' ? hr[category] : en[category]
}

/** Category badge colors (by review section), not row tone. */
function testimonialCategoryBadgeClasses(category: TestimonialCategory): string {
  if (category === 'lrc') {
    return 'border-rose-200/25 bg-white/70 text-rose-800/90 dark:border-rose-400/30 dark:bg-white/10 dark:text-rose-100/90'
  }
  if (category === 'webAtelier') {
    return 'border-sky-200/35 bg-white/70 text-sky-900/85 dark:border-sky-400/35 dark:bg-white/10 dark:text-sky-100/90'
  }
  return 'border-amethyst/15 bg-white/70 text-amethyst/90 dark:border-lavender/25 dark:bg-white/10 dark:text-lavender/90'
}

function TestimonialCard({
  testimonial,
  language,
  cardIndex,
  verifiedLabel,
  renderStars,
  layout,
  rowTone,
  isCoarse,
  expandedTap,
  onCoarseToggle,
  onCoarseTouchHold,
}: {
  testimonial: Testimonial
  language: 'hr' | 'en'
  cardIndex: number
  verifiedLabel: string
  renderStars: (rating: number) => ReactNode
  layout: 'marquee' | 'grid'
  rowTone: TestimonialRowTone
  isCoarse?: boolean
  expandedTap?: boolean
  onCoarseToggle?: () => void
  onCoarseTouchHold?: (hold: boolean) => void
}) {
  const widthClass =
    layout === 'marquee'
      ? isCoarse
        ? 'w-[min(100vw-2rem,304px)] shrink-0 snap-start sm:w-[328px]'
        : 'w-[min(100vw-2rem,304px)] shrink-0 sm:w-[328px]'
      : 'w-full min-w-0'

  const isMarquee = layout === 'marquee'
  const coarse = Boolean(isCoarse && isMarquee)
  const tapOpen = Boolean(expandedTap)

  const handleMarqueeClick = (e: MouseEvent) => {
    if (!coarse || !onCoarseToggle) return
    e.stopPropagation()
    onCoarseToggle()
  }

  const handleMarqueeKeyDown = (e: KeyboardEvent) => {
    if (!coarse || !onCoarseToggle) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onCoarseToggle()
    }
  }

  const quoteClass = clsx(
    'min-h-0 text-left text-[0.8125rem] leading-relaxed text-plum/88 dark:text-pearl/88 sm:text-sm',
    layout === 'grid' &&
      'line-clamp-4 sm:line-clamp-5 group-hover/card:line-clamp-none group-focus-within/card:line-clamp-none',
    isMarquee &&
      !tapOpen &&
      'line-clamp-3 sm:line-clamp-4',
    isMarquee &&
      tapOpen &&
      'line-clamp-none',
    isMarquee &&
      !coarse &&
      'group-hover/card:line-clamp-none',
    isMarquee && 'group-focus-within/card:line-clamp-none'
  )

  const displayRating = testimonialDisplayRating(testimonial)

  const articleClass = clsx(
    'group/card flex flex-col rounded-xl border bg-white/[0.82] p-4 shadow-[0_8px_28px_rgba(46,36,71,0.06)] backdrop-blur-xl transition-[transform,box-shadow,border-color] duration-300 ease-out sm:rounded-2xl sm:p-[1.125rem] dark:bg-white/[0.07] dark:shadow-[0_10px_36px_rgba(0,0,0,0.22)]',
    toneCardClasses(rowTone, layout),
    'min-h-[218px] sm:min-h-[228px]',
    isMarquee && 'relative touch-manipulation',
    isMarquee && 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
    widthClass,
    isMarquee && [
      'z-0',
      '[@media(hover:hover)_and_(pointer:fine)]:hover:z-30 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]',
      toneMarqueeHoverShadow(rowTone),
    ],
    isMarquee &&
      tapOpen &&
      clsx('z-30 scale-[1.02]', toneMarqueeTapOpen(rowTone)),
    layout === 'grid' &&
      'dark:focus-within:shadow-[0_12px_40px_rgba(0,0,0,0.28)] dark:hover:shadow-[0_12px_40px_rgba(189,166,255,0.08)] hover:shadow-[0_12px_36px_rgba(110,68,255,0.09)]'
  )

  return (
    <article
      tabIndex={0}
      role="article"
      data-expanded={isMarquee && tapOpen ? 'true' : 'false'}
      aria-expanded={coarse ? tapOpen : undefined}
      onClick={isMarquee ? handleMarqueeClick : undefined}
      onKeyDown={isMarquee ? handleMarqueeKeyDown : undefined}
      onPointerDown={
        isMarquee && coarse
          ? () => onCoarseTouchHold?.(true)
          : undefined
      }
      onPointerUp={
        isMarquee && coarse
          ? () => onCoarseTouchHold?.(false)
          : undefined
      }
      onPointerCancel={
        isMarquee && coarse
          ? () => onCoarseTouchHold?.(false)
          : undefined
      }
      className={articleClass}
    >
      <div className="flex items-start gap-3 sm:gap-3.5">
        <div
          className={`testimonial-avatar-initials flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[0.6875rem] font-bold tracking-wide text-white shadow-[0_2px_12px_rgba(110,68,255,0.28)] [text-shadow:0_1px_2px_rgba(26,17,43,0.35)] ring-1 ring-white/30 dark:ring-white/15 sm:h-11 sm:w-11 sm:text-sm ${avatarGradients[cardIndex % avatarGradients.length]}`}
          aria-hidden={true}
        >
          {getInitials(testimonial.name)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
          <p className="font-heading text-left text-sm font-semibold leading-snug tracking-tight text-plum/95 dark:text-pearl sm:text-[0.9375rem]">
            {testimonial.name}
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {displayRating === 5 ? (
              <span
                className={clsx(
                  'inline-flex w-fit shrink-0 items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none',
                  toneVerifiedBadgeClasses(rowTone)
                )}
              >
                <span aria-hidden>✓</span>
                {verifiedLabel}
              </span>
            ) : null}
            <span
              className={clsx(
                'inline-flex w-fit max-w-full shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none',
                testimonialCategoryBadgeClasses(testimonial.category)
              )}
            >
              {getTestimonialCategoryLabel(testimonial.category, language)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex min-h-[1.3125rem] items-center gap-0.5 sm:mt-3.5 sm:min-h-[1.375rem]">
        {displayRating != null ? renderStars(displayRating) : null}
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col sm:mt-3.5">
        <div
          className={clsx(
            'rounded-lg border py-2.5 pl-3 pr-3 sm:py-3 sm:pl-4 sm:pr-3.5',
            toneQuoteBoxClasses(rowTone),
            toneQuoteLeftAccentClass(rowTone)
          )}
        >
          <p className={quoteClass}>{testimonial.text[language]}</p>
        </div>
      </div>
    </article>
  )
}

function GroupMarqueeBlock({
  groupKey,
  items,
  rowTone,
  language,
  prefersReducedMotion,
  emptyPreview,
  marqueeDirection = 'left',
  autoPaused,
}: {
  groupKey: TestimonialRowGroupKey
  items: Testimonial[]
  rowTone: TestimonialRowTone
  language: 'hr' | 'en'
  prefersReducedMotion: boolean
  emptyPreview?: boolean
  marqueeDirection?: TestimonialMarqueeDirection
  autoPaused: boolean
}) {
  const verifiedLabel = language === 'hr' ? 'Verificirano' : 'Verified'
  const renderStars = (rating: number) =>
    Array.from({ length: 5 }).map((_, index) => {
      const filled = index < rating
      return (
        <span
          key={index}
          aria-hidden
          className={`inline-block transition-all duration-300 ${
            filled
              ? 'text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]'
              : 'text-plum/22 dark:text-pearl/18 opacity-[0.45]'
          }`}
          style={{
            fontSize: '0.875rem',
            animation: filled ? `starPulse 2s ease-in-out ${index * 0.1}s infinite` : 'none',
          }}
        >
          ★
        </span>
      )
    })

  if (emptyPreview && items.length === 0) {
    return <WebAtelierEmptyPreview language={language} rowTone={rowTone} />
  }

  if (prefersReducedMotion) {
    return (
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        data-testimonial-group={groupKey}
      >
        {items.map((testimonial, index) => (
          <TestimonialCard
            key={testimonial.id}
            testimonial={testimonial}
            language={language}
            cardIndex={index}
            verifiedLabel={verifiedLabel}
            renderStars={renderStars}
            layout="grid"
            rowTone={rowTone}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col" data-testimonial-group={groupKey}>
      <MarqueeLane
        items={items}
        language={language}
        verifiedLabel={verifiedLabel}
        renderStars={renderStars}
        rowTone={rowTone}
        direction={marqueeDirection}
        autoPaused={autoPaused}
      />
    </div>
  )
}

function WebAtelierEmptyPreview({
  language,
  rowTone,
}: {
  language: 'hr' | 'en'
  rowTone: TestimonialRowTone
}) {
  const border =
    rowTone === 'softBlue'
      ? 'border-sky-200/45 dark:border-sky-400/25'
      : 'border-amethyst/20 dark:border-lavender/15'
  return (
    <div
      className={clsx(
        'rounded-2xl border border-dashed px-4 py-6 text-center text-sm leading-relaxed text-plum/65 dark:text-pearl/60 sm:py-7',
        border
      )}
      data-testimonial-group="webAtelier"
      data-empty-preview="true"
    >
      {language === 'hr'
        ? 'Web Atelier — još nema javnih recenzija za ovu liniju.'
        : 'Web Atelier — no public reviews for this line yet.'}
    </div>
  )
}

export default function TestimonialMarquee({ language, rowBlocks }: TestimonialMarqueeProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const isCoarse = useCoarsePointer()
  const [autoPaused, setAutoPaused] = useState(false)

  const pauseToggleLabel =
    language === 'hr'
      ? autoPaused
        ? 'Nastavi'
        : 'Pauziraj'
      : autoPaused
        ? 'Resume'
        : 'Pause'

  const pauseToggleAriaLabel =
    language === 'hr'
      ? autoPaused
        ? 'Nastavi automatsko pomicanje recenzija'
        : 'Pauziraj automatsko pomicanje recenzija'
      : autoPaused
        ? 'Resume automatic review scrolling'
        : 'Pause automatic review scrolling'

  return (
    <>
      <style>{`
        @keyframes starPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.9; }
        }
        @keyframes testimonial-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .testimonial-marquee-track {
          animation-name: testimonial-marquee;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
        }
        .testimonial-marquee-row.marquee-dir-right .testimonial-marquee-track {
          animation-direction: reverse;
        }
        @media (hover: hover) and (pointer: fine) {
          .testimonial-marquee-row:hover .testimonial-marquee-track {
            animation-play-state: paused;
          }
        }
        .testimonial-marquee-row:not([data-coarse-pointer="true"]):focus-within .testimonial-marquee-track {
          animation-play-state: paused;
        }
        .testimonial-marquee-row[data-paused="true"] .testimonial-marquee-track {
          animation-play-state: paused;
        }
        .testimonial-marquee-row[data-coarse-pointer="true"]:not([data-paused="true"]) .testimonial-marquee-track {
          animation-play-state: running;
        }
        @media (prefers-reduced-motion: reduce) {
          .testimonial-marquee-track {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>

      {!prefersReducedMotion && isCoarse ? (
        <div className="mb-4 flex justify-center sm:mb-5">
          <button
            type="button"
            className="inline-flex min-h-[40px] min-w-[6.5rem] items-center justify-center rounded-full border border-amethyst/25 bg-white/75 px-4 py-2 text-xs font-semibold tracking-wide text-plum/90 shadow-sm backdrop-blur-sm transition hover:border-amethyst/40 dark:border-lavender/22 dark:bg-white/[0.09] dark:text-pearl/92 dark:hover:border-lavender/35"
            aria-pressed={autoPaused}
            aria-label={pauseToggleAriaLabel}
            onClick={() => setAutoPaused((v) => !v)}
          >
            {pauseToggleLabel}
          </button>
        </div>
      ) : !prefersReducedMotion ? (
        <button
          type="button"
          className="sr-only"
          aria-pressed={autoPaused}
          onClick={() => setAutoPaused((v) => !v)}
        >
          {pauseToggleAriaLabel}
        </button>
      ) : null}

      <div className="flex flex-col gap-8 sm:gap-10">
        {rowBlocks.map((block) => (
          <GroupMarqueeBlock
            key={
              block.emptyPreview
                ? `${block.groupKey}-empty-preview`
                : `${block.groupKey}-${block.items.map((t) => t.id).join('-')}`
            }
            groupKey={block.groupKey}
            items={block.items}
            rowTone={block.rowTone}
            language={language}
            prefersReducedMotion={prefersReducedMotion}
            emptyPreview={block.emptyPreview}
            marqueeDirection={block.marqueeDirection}
            autoPaused={autoPaused}
          />
        ))}
      </div>
    </>
  )
}
