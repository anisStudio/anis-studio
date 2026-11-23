import {
  photoById,
  type DemoPhotoSlot,
} from '../photoSlot.ts'

export type DemoLanguage = 'hr' | 'en'

type LocalizedText = Record<DemoLanguage, string>

export interface FloristArrangement {
  id: string
  name: LocalizedText
  description: LocalizedText
  occasions: readonly string[]
}

/**
 * Client adaptation for this START template.
 * Brand: `brand` (the Web Atelier card uses the same object).
 * Colors: `.wa-flor` custom properties in webAtelierDemos.css.
 * Copy: `hero`, `contact` title/lead, `occasions`, and `arrangements` here.
 *   Nav and section headings stay in FloristDemo.tsx.
 * Photos: `photos`. CSS stand-in until public/images/web-atelier-demos/<file> exists.
 *   The hero file is also the Web Atelier demo-card cover.
 * Contact: `contact`.
 */
export const floristPhotos = [
  {
    id: 'hero',
    file: 'cvjecarna-hero-16x9.webp',
    motif: {
      hr: 'Cvjećarica slaže buket za svijetlim radnim stolom',
      en: 'A florist arranging a bouquet at a bright worktable',
    },
    ratio: '16:9',
    usedIn: [
      { hr: 'Hero na demo stranici cvjećarnice', en: 'Hero on the florist demo page' },
      {
        hr: 'Naslovna slika demo kartice Cvjećarnica — START u Web Atelieru',
        en: 'Cover image of the Florist — START demo card in Web Atelier',
      },
    ],
    standInClass: 'wa-flor-hero-frame',
  },
  {
    id: 'jutarnja-rosa',
    file: 'cvjecarna-jutarnja-rosa-4x5.webp',
    motif: {
      hr: 'Izoliran buket Jutarnja rosa, bijeli i zeleni tonovi, neutralna podloga',
      en: 'Morning Dew bouquet isolated on a neutral ground, white and green tones',
    },
    ratio: '4:5',
    usedIn: [
      { hr: 'Kartica aranžmana Jutarnja rosa', en: 'Morning Dew arrangement card' },
    ],
    standInClass: 'wa-flor-arrangement wa-flor-visual-rose',
  },
  {
    id: 'topla-gesta',
    file: 'cvjecarna-topla-gesta-4x5.webp',
    motif: {
      hr: 'Izoliran buket Topla gesta, topli tonovi, neutralna podloga',
      en: 'Warm Gesture bouquet isolated on a neutral ground, warm tones',
    },
    ratio: '4:5',
    usedIn: [
      { hr: 'Kartica aranžmana Topla gesta', en: 'Warm Gesture arrangement card' },
    ],
    standInClass: 'wa-flor-arrangement wa-flor-visual-sunset',
  },
  {
    id: 'tiha-pratnja',
    file: 'cvjecarna-tiha-pratnja-4x5.webp',
    motif: {
      hr: 'Izolirana kompozicija Tiha pratnja, smireni neutralni tonovi',
      en: 'Quiet Tribute composition isolated, calm neutral tones',
    },
    ratio: '4:5',
    usedIn: [
      { hr: 'Kartica aranžmana Tiha pratnja', en: 'Quiet Tribute arrangement card' },
    ],
    standInClass: 'wa-flor-arrangement wa-flor-visual-sage',
  },
  {
    id: 'prostor',
    file: 'cvjecarna-prostor-3x2.webp',
    motif: {
      hr: 'Radni stol za dogovor ili izlog s cvijećem',
      en: 'A consultation table or storefront with flowers',
    },
    ratio: '3:2',
    usedIn: [
      { hr: 'Prostor uz kontakt na demo stranici cvjećarnice', en: 'Space with the contact block on the florist demo page' },
    ],
    standInClass: 'wa-flor-space',
  },
] as const satisfies readonly DemoPhotoSlot[]

export const floristConfig = {
  brand: {
    hr: 'Atelier Latice',
    en: 'Petal Atelier',
  },
  contact: {
    phoneDisplay: '+385 91 555 0184',
    phoneHref: 'tel:+385915550184',
    email: 'pozdrav@atelier-latice.example',
    location: {
      hr: 'Ilica 24, Zagreb — demo adresa',
      en: '24 Ilica, Zagreb — demo address',
    },
    title: {
      hr: 'Dogovorimo cvjetnu priču',
      en: 'Let’s plan the floral story',
    },
    lead: {
      hr: 'Nazovite, pošaljite poruku ili svratite na konzultaciju. Svi podaci u ovom primjeru su fiktivni.',
      en: 'Call, send a message, or stop by for a consultation. All details in this example are fictional.',
    },
  },
  hero: {
    kicker: {
      hr: 'Cvjećarnica · Zagreb',
      en: 'Florist · Zagreb',
    },
    title: {
      hr: 'Cvijeće koje kaže baš ono što želite',
      en: 'Flowers that say exactly what you mean',
    },
    lead: {
      hr: 'Fiktivna zagrebačka cvjećarnica s malom, pažljivo složenom ponudom za važne trenutke.',
      en: 'A fictional Zagreb florist with a small, carefully curated offer for meaningful moments.',
    },
    cta: {
      hr: 'Pronađi aranžman',
      en: 'Find an arrangement',
    },
  },
  occasions: [
    { id: 'all', label: { hr: 'Sve prigode', en: 'All occasions' } },
    { id: 'birthday', label: { hr: 'Rođendan', en: 'Birthday' } },
    { id: 'thanks', label: { hr: 'Zahvala', en: 'Thank you' } },
    { id: 'celebration', label: { hr: 'Proslava', en: 'Celebration' } },
    { id: 'sympathy', label: { hr: 'Sućut', en: 'Sympathy' } },
  ],
  arrangements: [
    {
      id: 'jutarnja-rosa',
      name: { hr: 'Jutarnja rosa', en: 'Morning Dew' },
      description: {
        hr: 'Nježni sezonski buket u bijelim i zelenim tonovima.',
        en: 'A gentle seasonal bouquet in white and green tones.',
      },
      occasions: ['birthday', 'thanks'],
    },
    {
      id: 'topla-gesta',
      name: { hr: 'Topla gesta', en: 'Warm Gesture' },
      description: {
        hr: 'Buket toplih tonova za zahvalu, čestitku ili mali znak pažnje.',
        en: 'A warm-toned bouquet for thanks, congratulations, or a thoughtful gesture.',
      },
      occasions: ['thanks', 'celebration'],
    },
    {
      id: 'tiha-pratnja',
      name: { hr: 'Tiha pratnja', en: 'Quiet Tribute' },
      description: {
        hr: 'Smirena kompozicija neutralnih tonova za izražavanje sućuti.',
        en: 'A calm, neutral composition for expressing sympathy.',
      },
      occasions: ['sympathy'],
    },
  ] satisfies readonly FloristArrangement[],
  photos: floristPhotos,
} as const

export function floristPhoto(id: string): DemoPhotoSlot {
  return photoById(floristConfig.photos, id)
}
