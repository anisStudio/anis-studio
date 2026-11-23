/**
 * F2.7 Web Atelier demo portfolio — fictional concepts only.
 * Routes live under /web-atelier/demo/* and inherit PublicServiceGuard.
 */

import type { WebAtelierPackageTier } from './webAtelierOffers.ts'

export const WEB_ATELIER_DEMO_BANNER_HR = 'DEMO KONCEPT — nije klijentski projekt'
export const WEB_ATELIER_DEMO_BANNER_EN = 'DEMO CONCEPT — not a client project'

export const WEB_ATELIER_DEMO_SLUGS = ['cvjecarna', 'grooming', 'interijeri'] as const
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
    slug: 'cvjecarna',
    packageTier: 'start',
    path: '/web-atelier/demo/cvjecarna',
    title: {
      hr: 'Cvjećarnica — START',
      en: 'Florist — START',
    },
    businessName: {
      hr: 'Atelier Latice',
      en: 'Petal Atelier',
    },
    summary: {
      hr: 'Jednostranični demo cvjećarne: aranžmani, odabir ponude prema prigodi i izravan kontakt.',
      en: 'Single-page florist demo: arrangements, occasion-based browsing, and direct contact.',
    },
    packageNote: {
      hr: 'Prikazuje opseg START paketa: jedna fokusirana stranica, responzivni prikaz, osnovni SEO i jasna kontaktna točka. Nema webshopa ni stvarne narudžbe.',
      en: 'Shows the START package scope: one focused page, responsive layout, basic SEO, and a clear contact point. No webshop or real ordering.',
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
      hr: 'Višesekcijski demo salona: usluge, galerija i lokalno spremljen ogledni odabir termina.',
      en: 'Multi-section salon demo: services, gallery, and a sample appointment selection saved locally.',
    },
    packageNote: {
      hr: 'Prikazuje PRO opseg (do 5 stranica, 2 korekcije; responzivni prikaz, osnovni SEO i kontaktni obrazac u osnovnoj cijeni). Booking je opcionalna usluga — nije uključen besplatno.',
      en: 'Shows PRO scope (up to 5 pages, 2 corrections; responsive layout, basic SEO, and contact form in the base price). Booking is an optional add-on — not included free.',
    },
    accentLabel: { hr: 'PRO + booking', en: 'PRO + booking' },
  },
  {
    slug: 'interijeri',
    packageTier: 'premium',
    path: '/web-atelier/demo/interijeri',
    title: {
      hr: 'Studio interijera — PREMIUM',
      en: 'Interior studio — PREMIUM',
    },
    businessName: {
      hr: 'Studio Sloj',
      en: 'Studio Layer',
    },
    summary: {
      hr: 'Premium portfolio demo: više projekata, detaljna studija izvedbe, fotografije i materijali.',
      en: 'Premium portfolio demo: multiple projects, a detailed execution study, photography, and materials.',
    },
    packageNote: {
      hr: 'Prikazuje PREMIUM opseg: izražen vizualni identitet, bogat portfolio, detaljne studije projekta i pripremu sadržaja za više stranica. Svi projekti su jasno označeni kao demo.',
      en: 'Shows the PREMIUM scope: a distinct visual identity, rich portfolio, detailed project studies, and content prepared for a multi-page site. Every project is clearly marked as a demo.',
    },
    accentLabel: { hr: 'PREMIUM', en: 'PREMIUM' },
  },
] as const

export function isWebAtelierDemoSlug(value: string | undefined | null): value is WebAtelierDemoSlug {
  return value === 'cvjecarna' || value === 'grooming' || value === 'interijeri'
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
    ? 'Ovo je demo odabir. Spremljen je samo lokalno u ovom pregledniku; e-mail nije poslan i kalendar nije ažuriran.'
    : 'This is a demo selection. It is saved only in this browser; no email was sent and no calendar was updated.'
}

export function demoOrderConfirmation(language: 'hr' | 'en'): string {
  return language === 'hr'
    ? 'Ovo je demo narudžba. Nema naplate, zalihe se ne mijenjaju i narudžba nije poslana.'
    : 'This is a demo order. There is no payment, inventory is unchanged, and nothing was submitted.'
}
