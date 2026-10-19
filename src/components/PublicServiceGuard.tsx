import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../hooks/useSettings'
import {
  PUBLIC_SERVICE_SETTING_KEY,
  resolvePublicServiceAccess,
  type PublicService,
} from '../lib/publicServiceAccess'
import { useAdminAuth } from '../providers/AdminAuthProvider'
import { AdminDepartmentPreviewContext } from '../providers/AdminDepartmentPreviewContext'
import { AdminPreviewBanner } from './AdminPreviewBanner'
import { AnimatedPage } from './AnimatedPage'
import { PageSEO } from './PageSEO'

export type { PublicService }

interface PublicServiceGuardProps {
  service: PublicService
  language: 'hr' | 'en'
  children: ReactNode
}

const SERVICE_SEO_TITLE: Record<PublicService, string> = {
  interiors: "Ani's Interijeri",
  lrc: "Ani's LRC",
  webAtelier: "Ani's Web Atelier",
}

const unavailableCopy = {
  title: {
    hr: 'Usluga je trenutno u pripremi',
    en: 'This service is currently in preparation',
  },
  text: {
    hr: 'Ova usluga trenutno nije javno dostupna. Za pitanja i dogovor možete nam se javiti putem kontakt stranice.',
    en: 'This service is not publicly available at the moment. For questions and arrangements, you can contact us through the contact page.',
  },
  button: {
    hr: 'Kontakt',
    en: 'Contact',
  },
}

function SettingsLoading({
  language,
  seoTitle,
}: {
  language: 'hr' | 'en'
  seoTitle: string
}) {
  const srLabel = language === 'hr' ? 'Učitavanje…' : 'Loading…'

  return (
    <AnimatedPage>
      <PageSEO title={seoTitle} description="" noIndex />
      <main className="min-w-0">
        <div
          className="flex min-h-[50vh] w-full items-center justify-center px-4 py-16"
          aria-busy="true"
          aria-live="polite"
        >
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--clr-primary)] border-t-transparent"
            role="status"
          />
          <span className="sr-only">{srLabel}</span>
        </div>
      </main>
    </AnimatedPage>
  )
}

function ServiceUnavailable({ language }: { language: 'hr' | 'en' }) {
  return (
    <AnimatedPage>
      <PageSEO
        title={unavailableCopy.title[language]}
        description={unavailableCopy.text[language]}
        noIndex
      />
      <main className="min-w-0">
        <section className="Section fade-in">
          <div className="mx-auto min-w-0 max-w-xl px-4 py-20 text-center sm:px-6 sm:py-24">
            <h1 className="mb-4 font-heading text-2xl font-bold tracking-tight text-balance text-plum/95 dark:text-pearl sm:text-3xl">
              {unavailableCopy.title[language]}
            </h1>
            <p className="mx-auto mb-8 max-w-md text-base leading-relaxed text-plum/78 dark:text-pearl/72">
              {unavailableCopy.text[language]}
            </p>
            <Link
              to="/kontakt"
              className="btn btn-primary inline-flex min-h-[48px] items-center justify-center px-8 py-3 text-base font-semibold"
            >
              {unavailableCopy.button[language]}
            </Link>
          </div>
        </section>
      </main>
    </AnimatedPage>
  )
}

/**
 * Gates department public routes by settings flag.
 * Confirmed admins (public.is_admin via AdminAuthProvider) may preview when the flag is off.
 * Content stays hidden until settings + admin checks finish (fail closed).
 */
export function PublicServiceGuard({
  service,
  language,
  children,
}: PublicServiceGuardProps) {
  const { settings, isLoading, error } = useSettings()
  const { isAdmin, loading: adminLoading } = useAdminAuth()
  const settingsKey = PUBLIC_SERVICE_SETTING_KEY[service]
  const seoTitle = SERVICE_SEO_TITLE[service]

  const access = resolvePublicServiceAccess({
    publicVisible: settings?.[settingsKey] === true,
    isAdmin,
    loading: isLoading || adminLoading,
    settingsUnavailable: !isLoading && (error !== null || settings === null),
  })

  if (access === 'loading') {
    return <SettingsLoading language={language} seoTitle={seoTitle} />
  }

  if (access === 'denied') {
    return <ServiceUnavailable language={language} />
  }

  if (access === 'allowed_admin_preview') {
    return (
      <AdminDepartmentPreviewContext.Provider value={true}>
        <AdminPreviewBanner service={service} language={language} />
        {children}
      </AdminDepartmentPreviewContext.Provider>
    )
  }

  return (
    <AdminDepartmentPreviewContext.Provider value={false}>
      {children}
    </AdminDepartmentPreviewContext.Provider>
  )
}
