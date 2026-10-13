import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { DecorativeSkyBackdrop } from './DecorativeSkyBackdrop'

interface WebAtelierFormPageLayoutProps {
  language: 'hr' | 'en'
  title: string
  children: ReactNode
}

export function WebAtelierFormPageLayout({ language, title, children }: WebAtelierFormPageLayoutProps) {
  const backLabel = language === 'hr' ? 'Natrag na Web Atelier' : 'Back to Web Atelier'

  return (
    <section className="Section fade-in relative section-with-bg min-h-[min(100dvh,auto)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <DecorativeSkyBackdrop priority="high" />
        <div className="absolute inset-0 section-bg-overlay-light dark:section-bg-overlay-dark" />
      </div>

      <div className="relative z-10 mx-auto min-w-0 max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
        <div className="mb-8">
          <Link
            to="/web-atelier"
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-[--color-primary] transition-colors hover:underline dark:text-lavender"
          >
            <span aria-hidden>←</span>
            {backLabel}
          </Link>
          <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight text-balance text-plum dark:text-pearl sm:text-3xl">
            {title}
          </h1>
        </div>
        {children}
      </div>
    </section>
  )
}
