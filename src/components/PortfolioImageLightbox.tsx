import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

const MIN_SCALE = 1
const MAX_SCALE = 4

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export interface PortfolioImageLightboxProps {
  language: 'hr' | 'en'
  imageUrl: string
  imageAlt: string
  title: string
  description?: string | null
  badge?: ReactNode
  showNav?: boolean
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}

export function PortfolioImageLightbox({
  language,
  imageUrl,
  imageAlt,
  title,
  description,
  badge,
  showNav,
  onClose,
  onPrev,
  onNext,
}: PortfolioImageLightboxProps) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const pinchRef = useRef({
    active: false,
    startDist: 0,
    startScale: 1,
    startOffset: { x: 0, y: 0 },
    lastCenter: { x: 0, y: 0 },
    panning: false,
    panStart: { x: 0, y: 0 },
  })
  const viewportRef = useRef<HTMLDivElement>(null)

  const resetZoom = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    resetZoom()
  }, [imageUrl, resetZoom])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (!showNav) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        resetZoom()
        onPrev?.()
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        resetZoom()
        onNext?.()
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose, onNext, onPrev, resetZoom, showNav])

  function distance(t1: { clientX: number; clientY: number }, t2: { clientX: number; clientY: number }) {
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    return Math.hypot(dx, dy)
  }

  function center(t1: { clientX: number; clientY: number }, t2: { clientX: number; clientY: number }) {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    }
  }

  const navBtnClass =
    'relative z-20 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-violet-600 text-white shadow-lg touch-manipulation hover:bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111018]'

  const goPrev = () => {
    resetZoom()
    onPrev?.()
  }

  const goNext = () => {
    resetZoom()
    onNext?.()
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/85 px-2 py-4 sm:px-4 sm:py-6"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-lightbox-title"
        className="portfolio-lightbox-panel relative z-[9999] flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111018] shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-30 flex items-center gap-2 rounded-full border border-white/20 bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-lg touch-manipulation hover:bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4 sm:top-4"
          aria-label={language === 'hr' ? 'Zatvori prikaz' : 'Close preview'}
        >
          <span>{language === 'hr' ? 'Zatvori' : 'Close'}</span>
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-4 pt-12 sm:gap-4 sm:px-5 sm:pb-6 sm:pt-14">
          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center md:grid md:grid-cols-[3rem_minmax(0,1fr)_3rem] md:items-center md:gap-2">
            {showNav ? (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className={`${navBtnClass} order-2 hidden md:order-none md:col-start-1 md:row-start-1 md:flex`}
                  aria-label={language === 'hr' ? 'Prethodna stavka' : 'Previous item'}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className={`${navBtnClass} order-3 hidden md:order-none md:col-start-3 md:row-start-1 md:flex`}
                  aria-label={language === 'hr' ? 'Sljedeća stavka' : 'Next item'}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            ) : null}

            <div
              ref={viewportRef}
              className="order-1 flex h-[min(72dvh,520px)] w-full min-h-[200px] min-w-0 touch-none items-center justify-center overflow-hidden rounded-xl bg-black/30 md:col-start-2 md:row-start-1 sm:h-[min(78dvh,640px)]"
            >
              <img
                src={imageUrl}
                alt={imageAlt}
                decoding="async"
                draggable={false}
                className="pointer-events-auto max-h-full max-w-full select-none touch-none object-contain transition-transform duration-75 ease-out"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                }}
                onDoubleClick={resetZoom}
                onTouchStart={(e) => {
                  if (e.touches.length === 2) {
                    const p = pinchRef.current
                    p.active = true
                    p.panning = false
                    p.startDist = distance(e.touches[0], e.touches[1])
                    p.startScale = scale
                    p.startOffset = { ...offset }
                    p.lastCenter = center(e.touches[0], e.touches[1])
                  } else if (e.touches.length === 1 && scale > 1) {
                    const p = pinchRef.current
                    p.panning = true
                    p.panStart = {
                      x: e.touches[0].clientX - offset.x,
                      y: e.touches[0].clientY - offset.y,
                    }
                  }
                }}
                onTouchMove={(e) => {
                  const p = pinchRef.current
                  if (p.active && e.touches.length === 2) {
                    e.preventDefault()
                    const dist = distance(e.touches[0], e.touches[1])
                    const nextScale = clamp(p.startScale * (dist / p.startDist), MIN_SCALE, MAX_SCALE)
                    const c = center(e.touches[0], e.touches[1])
                    const dx = c.x - p.lastCenter.x
                    const dy = c.y - p.lastCenter.y
                    p.lastCenter = c
                    setScale(nextScale)
                    if (nextScale > 1) {
                      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
                    } else {
                      setOffset({ x: 0, y: 0 })
                    }
                  } else if (p.panning && e.touches.length === 1 && scale > 1) {
                    e.preventDefault()
                    setOffset({
                      x: e.touches[0].clientX - p.panStart.x,
                      y: e.touches[0].clientY - p.panStart.y,
                    })
                  }
                }}
                onTouchEnd={(e) => {
                  const p = pinchRef.current
                  if (e.touches.length < 2) p.active = false
                  if (e.touches.length === 0) p.panning = false
                  if (scale <= 1.02) {
                    setScale(1)
                    setOffset({ x: 0, y: 0 })
                  }
                }}
              />
            </div>
          </div>

          {showNav ? (
            <div className="flex shrink-0 items-center justify-center gap-10 md:hidden">
              <button
                type="button"
                onClick={goPrev}
                className={navBtnClass}
                aria-label={language === 'hr' ? 'Prethodna stavka' : 'Previous item'}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={goNext}
                className={navBtnClass}
                aria-label={language === 'hr' ? 'Sljedeća stavka' : 'Next item'}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ) : null}

          <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col items-center space-y-2 overflow-y-auto text-center sm:max-w-4xl sm:space-y-3">
            <h2
              id="portfolio-lightbox-title"
              className="w-full text-balance font-heading text-lg font-bold leading-snug text-white sm:text-2xl"
            >
              {title}
            </h2>
            {description ? (
              <p className="portfolio-lightbox-description w-full text-balance text-sm leading-relaxed text-zinc-200 sm:text-base">
                {description}
              </p>
            ) : null}
            {badge}
          </div>
        </div>
      </div>
    </div>
  )
}