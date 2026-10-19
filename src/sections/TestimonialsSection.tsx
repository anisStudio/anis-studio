import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { DecorativeSkyBackdrop } from '../components/DecorativeSkyBackdrop'
import TestimonialMarquee, {
  type TestimonialMarqueeRowBlock,
} from '../components/TestimonialMarquee'
import { usePublicDepartmentVisibility } from '../hooks/usePublicDepartmentVisibility'
import type { Testimonial, TestimonialCategory } from '../data/testimonials'
import { TESTIMONIALS } from '../data/testimonials'
import {
  fetchApprovedTestimonialSubmissionsPublic,
  mapApprovedSubmissionToTestimonial,
} from '../lib/testimonials'
import { isSupabaseConfigured } from '../lib/supabase'

interface TestimonialsSectionProps {
  language: 'hr' | 'en'
  /**
   * I8E-3C: kad je true, nema sky PNG + sekcijskog wash-a (samo globalni canvas).
   * Kada je undefined, homepage (`/`) automatski koristi ovaj način; ostale rute zadržavaju puni stack.
   */
  blendWithGlobalCanvas?: boolean
}

const byIdAsc = <T extends { id: number }>(a: T, b: T) => a.id - b.id

type PublicSectionFlags = {
  interiors: boolean
  lrc: boolean
  webAtelier: boolean
}

/**
 * Local preview: when `true`, shows all rows that have items (plus optional empty Web Atelier preview),
 * ignoring admin public visibility flags.
 */
export const PREVIEW_ALL_TESTIMONIAL_ROWS = false

/**
 * Preview-only: show dashed placeholder for Web Atelier when there are no testimonials yet.
 * No fake cards are created.
 */
export const PREVIEW_WEB_ATELIER_EMPTY_ROW = false

function collectTrustRowItems(
  all: Testimonial[],
  preview: boolean,
  pub: PublicSectionFlags,
): Testimonial[] {
  if (preview) {
    return all
      .filter((t) => t.category === 'general' || t.category === 'interiors')
      .sort(byIdAsc)
  }
  const anySectionActive = pub.interiors || pub.lrc || pub.webAtelier
  const general = all.filter((t) => t.category === 'general' && anySectionActive)
  const interiors = all.filter((t) => t.category === 'interiors' && pub.interiors)
  return [...general, ...interiors].sort(byIdAsc)
}

function collectCategoryRowItems(
  all: Testimonial[],
  category: Extract<TestimonialCategory, 'lrc' | 'webAtelier'>,
  preview: boolean,
  pub: PublicSectionFlags,
): Testimonial[] {
  if (preview) {
    return all.filter((t) => t.category === category).sort(byIdAsc)
  }
  const flag = category === 'lrc' ? pub.lrc : pub.webAtelier
  return all.filter((t) => t.category === category && flag).sort(byIdAsc)
}

function buildTestimonialRowBlocks(
  allTestimonials: Testimonial[],
  pub: PublicSectionFlags,
): TestimonialMarqueeRowBlock[] {
  const preview = PREVIEW_ALL_TESTIMONIAL_ROWS

  const trustItems = collectTrustRowItems(allTestimonials, preview, pub)
  const lrcItems = collectCategoryRowItems(allTestimonials, 'lrc', preview, pub)
  const webItems = collectCategoryRowItems(allTestimonials, 'webAtelier', preview, pub)

  const blocks: TestimonialMarqueeRowBlock[] = []

  if (trustItems.length > 0) {
    blocks.push({
      groupKey: 'trust',
      items: trustItems,
      rowTone: 'purple',
      marqueeDirection: 'left',
    })
  }

  if (lrcItems.length > 0) {
    blocks.push({
      groupKey: 'lrc',
      items: lrcItems,
      rowTone: 'softPink',
      marqueeDirection: 'right',
    })
  }

  if (webItems.length > 0) {
    blocks.push({
      groupKey: 'webAtelier',
      items: webItems,
      rowTone: 'softBlue',
      marqueeDirection: 'left',
    })
  } else if (preview && PREVIEW_WEB_ATELIER_EMPTY_ROW) {
    blocks.push({
      groupKey: 'webAtelier',
      items: [],
      rowTone: 'softBlue',
      marqueeDirection: 'left',
      emptyPreview: true,
    })
  }

  return blocks
}

export default function TestimonialsSection({
  language,
  blendWithGlobalCanvas,
}: TestimonialsSectionProps) {
  const { pathname } = useLocation()
  const useGlobalCanvasOnly =
    blendWithGlobalCanvas !== undefined ? blendWithGlobalCanvas : pathname === '/'
  const publicSectionFlags = usePublicDepartmentVisibility()
  const [dbTestimonials, setDbTestimonials] = useState<Testimonial[]>([])

  useEffect(() => {
    let cancelled = false
    if (!isSupabaseConfigured) return

    ;(async () => {
      try {
        const rows = await fetchApprovedTestimonialSubmissionsPublic()
        if (cancelled) return
        setDbTestimonials(rows.map((row, i) => mapApprovedSubmissionToTestimonial(row, i)))
      } catch {
        if (!cancelled) setDbTestimonials([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const allTestimonials = useMemo(
    () => [...TESTIMONIALS, ...dbTestimonials],
    [dbTestimonials],
  )

  const rowBlocks = buildTestimonialRowBlocks(allTestimonials, {
    interiors: publicSectionFlags.interiors,
    lrc: publicSectionFlags.lrc,
    webAtelier: publicSectionFlags.webAtelier,
  })

  const translations = {
    title: {
      hr: 'Što kažu naši kupci',
      en: 'What Our Customers Say',
    },
    subtitle: {
      hr: 'Povjerenje naših kupaca je naš najveći uspjeh.',
      en: "Our customers' trust is our greatest success.",
    },
    helperHover: {
      hr: 'Za čitanje, zadrži pokazivač iznad recenzije.',
      en: 'To read, keep your pointer over a review.',
    },
  }

  if (rowBlocks.length === 0) return null

  return (
    <section id="testimonials" className="section-with-bg relative overflow-x-clip px-4 py-12 sm:px-6 sm:py-14 md:px-8 md:py-16">
      {!useGlobalCanvasOnly ? (
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <DecorativeSkyBackdrop priority="lazy" />
          <div className="absolute inset-0 section-bg-overlay-light dark:section-bg-overlay-dark" />
        </div>
      ) : null}

      <div className="relative z-10 mx-auto min-w-0 max-w-6xl">
        <div className="mb-6 text-center sm:mb-8">
          <h2 className="mb-3 font-heading text-2xl font-bold tracking-tight text-balance text-plum/90 dark:text-pearl sm:mb-3.5 sm:text-3xl md:text-4xl">
            <span className="mr-2">💬</span>
            {translations.title[language]}
          </h2>
          <p className="mx-auto max-w-2xl px-1 text-base leading-relaxed text-plum/80 dark:text-pearl/75 sm:text-lg">
            {translations.subtitle[language]}
          </p>
          <p
            className="mx-auto mt-3.5 hidden max-w-2xl px-1 text-center text-xs font-normal leading-relaxed tracking-wide text-plum/45 dark:text-pearl/42 sm:mt-4 sm:text-[0.8125rem] [@media(hover:hover)_and_(pointer:fine)]:block"
          >
            {translations.helperHover[language]}
          </p>
        </div>

        <TestimonialMarquee language={language} rowBlocks={rowBlocks} />
      </div>
    </section>
  )
}
