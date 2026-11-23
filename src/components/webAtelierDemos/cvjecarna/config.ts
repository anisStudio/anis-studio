export type DemoLanguage = 'hr' | 'en'

type LocalizedText = Record<DemoLanguage, string>

export interface FloristArrangement {
  id: string
  name: LocalizedText
  description: LocalizedText
  occasions: readonly string[]
  visualClass: string
}

export const floristConfig = {
  brand: 'Atelier Latice',
  contact: {
    phoneDisplay: '+385 91 555 0184',
    phoneHref: 'tel:+385915550184',
    email: 'pozdrav@atelier-latice.example',
    location: {
      hr: 'Ilica 24, Zagreb — demo adresa',
      en: '24 Ilica, Zagreb — demo address',
    },
  },
  hero: {
    title: {
      hr: 'Cvijeće koje kaže baš ono što želite',
      en: 'Flowers that say exactly what you mean',
    },
    lead: {
      hr: 'Fiktivna zagrebačka cvjećarnica s malom, pažljivo složenom ponudom za važne trenutke.',
      en: 'A fictional Zagreb florist with a small, carefully curated offer for meaningful moments.',
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
      visualClass: 'wa-flor-visual-rose',
    },
    {
      id: 'topla-gesta',
      name: { hr: 'Topla gesta', en: 'Warm Gesture' },
      description: {
        hr: 'Buket toplih tonova za zahvalu, čestitku ili mali znak pažnje.',
        en: 'A warm-toned bouquet for thanks, congratulations, or a thoughtful gesture.',
      },
      occasions: ['thanks', 'celebration'],
      visualClass: 'wa-flor-visual-sunset',
    },
    {
      id: 'tiha-pratnja',
      name: { hr: 'Tiha pratnja', en: 'Quiet Tribute' },
      description: {
        hr: 'Smirena kompozicija neutralnih tonova za izražavanje sućuti.',
        en: 'A calm, neutral composition for expressing sympathy.',
      },
      occasions: ['sympathy'],
      visualClass: 'wa-flor-visual-sage',
    },
  ] satisfies readonly FloristArrangement[],
  imageBriefs: [
    'Hero: florist arranging a bouquet at a bright worktable, landscape 16:9.',
    'Arrangements: three isolated bouquets on neutral backgrounds, portrait 4:5.',
    'Contact: storefront or consultation table with flowers, landscape 3:2.',
  ],
} as const
