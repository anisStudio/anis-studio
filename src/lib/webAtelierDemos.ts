/**
 * F2.7 Web Atelier demo portfolio — fictional concepts only.
 * Routes live under /web-atelier/demo/* and inherit PublicServiceGuard.
 */

import type { WebAtelierPackageTier } from './webAtelierOffers.ts'

export const WEB_ATELIER_DEMO_BANNER_HR = 'DEMO KONCEPT — nije klijentski projekt'
export const WEB_ATELIER_DEMO_BANNER_EN = 'DEMO CONCEPT — not a client project'

export const WEB_ATELIER_DEMO_SLUGS = ['stolarija', 'grooming', 'cvjecarna'] as const
export type WebAtelierDemoSlug = (typeof WEB_ATELIER_DEMO_SLUGS)[number]

export interface WebAtelierDemoDefinition {
  slug: WebAtelierDemoSlug
  packageTier: WebAtelierPackageTier
  /** Path under the site, always behind /web-atelier guard. */
  path: string
  title: { hr: string; en: string }
  businessName: { hr: string; en: string }
  summary: { hr: string; en: string }
  packageNote: { hr: string; en: string }
  accentLabel: { hr: string; en: string }
}

export const WEB_ATELIER_DEMOS: readonly WebAtelierDemoDefinition[] = [
  {
    slug: 'stolarija',
    packageTier: 'start',
    path: '/web-atelier/demo/stolarija',
    title: {
      hr: 'Stolarska radionica — START',
      en: 'Carpentry workshop — START',
    },
    businessName: {
      hr: 'Radionica Hrast',
      en: 'Oak Workshop',
    },
    summary: {
      hr: 'Jednostranični demo za fiktivnog stolara: hero, usluge, galerija radova i kontakt CTA.',
      en: 'Single-page demo for a fictional carpenter: hero, services, project gallery and contact CTA.',
    },
    packageNote: {
      hr: 'Prikazuje opseg START paketa: jednostranična stranica, jedna revizija. Informativni koncept.',
      en: 'Shows START package scope: one-page site, one revision. Indicative concept only.',
    },
    accentLabel: { hr: 'START', en: 'START' },
  },
  {
    slug: 'grooming',
    packageTier: 'pro',
    path: '/web-atelier/demo/grooming',
    title: {
      hr: 'Pet grooming salon — PRO',
      en: 'Pet grooming salon — PRO',
    },
    businessName: {
      hr: 'Šapa & Sjaj',
      en: 'Paw & Polish',
    },
    summary: {
      hr: 'Višesekcijski demo salona: usluge, orijentacijske cijene, galerija i demo rezervacija (samo UI).',
      en: 'Multi-section salon demo: services, indicative prices, gallery and demo booking (UI only).',
    },
    packageNote: {
      hr: 'Prikazuje PRO opseg (do 5 stranica, dvije revizije). Booking je opcionalna usluga — nije uključen besplatno.',
      en: 'Shows PRO scope (up to 5 pages, two revisions). Booking is an optional add-on — not included free.',
    },
    accentLabel: { hr: 'PRO + booking', en: 'PRO + booking' },
  },
  {
    slug: 'cvjecarna',
    packageTier: 'premium',
    path: '/web-atelier/demo/cvjecarna',
    title: {
      hr: 'Cvjećarna — PREMIUM',
      en: 'Florist — PREMIUM',
    },
    businessName: {
      hr: 'Atelier Latice',
      en: 'Petal Atelier',
    },
    summary: {
      hr: 'Premium vizualni demo: kolekcije, prigode, galerija i uzorak narudžbe bez plaćanja.',
      en: 'Premium visual demo: collections, occasions, gallery and sample ordering without payment.',
    },
    packageNote: {
      hr: 'Prikazuje PREMIUM opseg (do 7 stranica, mini branding, prioritetna podrška). E-commerce nije uključen u bazni paket.',
      en: 'Shows PREMIUM scope (up to 7 pages, mini branding, priority support). Ecommerce is not included in the base package.',
    },
    accentLabel: { hr: 'PREMIUM', en: 'PREMIUM' },
  },
] as const

export function isWebAtelierDemoSlug(value: string | undefined | null): value is WebAtelierDemoSlug {
  return value === 'stolarija' || value === 'grooming' || value === 'cvjecarna'
}

export function getWebAtelierDemo(slug: string | undefined | null): WebAtelierDemoDefinition | null {
  if (!isWebAtelierDemoSlug(slug)) return null
  return WEB_ATELIER_DEMOS.find((demo) => demo.slug === slug) ?? null
}

export function demoBannerText(language: 'hr' | 'en'): string {
  return language === 'hr' ? WEB_ATELIER_DEMO_BANNER_HR : WEB_ATELIER_DEMO_BANNER_EN
}

export function demoPath(slug: WebAtelierDemoSlug): string {
  return `/web-atelier/demo/${slug}`
}

/** Demo booking / order never hit network — local UI confirmation only. */
export const DEMO_ACTION_IS_LOCAL_ONLY = true

export function demoBookingConfirmation(language: 'hr' | 'en'): string {
  return language === 'hr'
    ? 'Ovo je demo rezervacija. Termin nije spremljen, e-mail nije poslan i kalendar nije ažuriran.'
    : 'This is a demo booking. No appointment was saved, no email was sent, and no calendar was updated.'
}

export function demoOrderConfirmation(language: 'hr' | 'en'): string {
  return language === 'hr'
    ? 'Ovo je demo narudžba. Nema naplate, zalihe se ne mijenjaju i narudžba nije poslana.'
    : 'This is a demo order. There is no payment, inventory is unchanged, and nothing was submitted.'
}
