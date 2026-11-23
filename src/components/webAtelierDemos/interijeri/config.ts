export type DemoLanguage = 'hr' | 'en'

type LocalizedText = Record<DemoLanguage, string>

export interface InteriorDemoProject {
  id: string
  title: LocalizedText
  type: LocalizedText
  summary: LocalizedText
  execution: LocalizedText
  cover: string
  photos: readonly { src: string; alt: LocalizedText }[]
  materials: readonly LocalizedText[]
}

export const interiorsStudioConfig = {
  brand: 'Studio Sloj',
  tagline: {
    hr: 'Interijeri i namještaj po mjeri',
    en: 'Interiors and bespoke furniture',
  },
  contact: {
    email: 'studio@studio-sloj.example',
    phone: '+385 91 555 0472',
  },
  projects: [
    {
      id: 'kuhinja-mirna',
      title: { hr: 'Kuhinja Mirna', en: 'Mirna Kitchen' },
      type: { hr: 'Kuhinja po mjeri · demo projekt', en: 'Bespoke kitchen · demo project' },
      summary: {
        hr: 'Topli hrast, mat fronte i pažljivo planirana rasvjeta za otvoreni dnevni prostor.',
        en: 'Warm oak, matte fronts, and carefully planned lighting for an open living space.',
      },
      execution: {
        hr: 'Koncept spaja visoke elemente uz puni zid, radni otok za pripremu i druženje te skrivenu LED rasvjetu. Prikazane su dvije ogledne varijante kako bi klijent mogao usporediti raspored i količinu otvorenih polica.',
        en: 'The concept combines a full-height storage wall, a preparation and social island, and concealed LED lighting. Two sample variants let the client compare layout and the amount of open shelving.',
      },
      cover: '/images/interijeri/kitchen-advanced.webp',
      photos: [
        {
          src: '/images/interijeri/kitchen-advanced.webp',
          alt: { hr: 'Demo kuhinja s otokom i toplom rasvjetom', en: 'Demo kitchen with an island and warm lighting' },
        },
        {
          src: '/images/interijeri/kitchen-complex.webp',
          alt: { hr: 'Alternativna demo varijanta kutne kuhinje', en: 'Alternative demo corner-kitchen variant' },
        },
      ],
      materials: [
        { hr: 'Mat lakirane fronte u toploj bež nijansi', en: 'Warm beige matte lacquered fronts' },
        { hr: 'Hrastov furnir na otoku i otvorenim policama', en: 'Oak veneer on the island and open shelving' },
        { hr: 'Radna ploča svijetlog kamenog uzorka', en: 'Light stone-pattern worktop' },
        { hr: 'Crna galanterija i viseća rasvjeta', en: 'Black fittings and pendant lighting' },
      ],
    },
    {
      id: 'kuhinja-linija',
      title: { hr: 'Kuhinja Linija', en: 'Linea Kitchen' },
      type: { hr: 'Kompaktna kuhinja · demo projekt', en: 'Compact kitchen · demo project' },
      summary: {
        hr: 'Ravna kompozicija s puno spremišta i mirnim, svijetlim materijalima.',
        en: 'A linear composition with generous storage and calm, light materials.',
      },
      execution: {
        hr: 'Jednostavan raspored stavlja svakodnevne funkcije u jednu jasnu liniju i ostavlja prostor prozračnim.',
        en: 'A simple layout places everyday functions in one clear line and keeps the room open.',
      },
      cover: '/images/interijeri/kitchen-basic.webp',
      photos: [
        {
          src: '/images/interijeri/kitchen-basic.webp',
          alt: { hr: 'Svijetla ravna demo kuhinja', en: 'Light linear demo kitchen' },
        },
      ],
      materials: [
        { hr: 'Svijetle mat fronte', en: 'Light matte fronts' },
        { hr: 'Hrastova radna ploča i zidna obloga', en: 'Oak worktop and splashback' },
      ],
    },
    {
      id: 'kuhinja-kut',
      title: { hr: 'Kuhinja Kut', en: 'Corner Kitchen' },
      type: { hr: 'Obiteljska kuhinja · demo projekt', en: 'Family kitchen · demo project' },
      summary: {
        hr: 'Kutni raspored koji koristi cijeli zid i ostavlja udobnu komunikaciju kroz prostor.',
        en: 'A corner layout that uses the full wall while preserving comfortable circulation.',
      },
      execution: {
        hr: 'Visoki elementi, otvorene niše i kontinuitet radne plohe stvaraju praktičnu obiteljsku cjelinu.',
        en: 'Tall units, open niches, and a continuous worktop create a practical family composition.',
      },
      cover: '/images/interijeri/kitchen-complex.webp',
      photos: [
        {
          src: '/images/interijeri/kitchen-complex.webp',
          alt: { hr: 'Kutna demo kuhinja s otvorenim nišama', en: 'Demo corner kitchen with open niches' },
        },
      ],
      materials: [
        { hr: 'Bež fronte i hrastove niše', en: 'Beige fronts and oak niches' },
        { hr: 'Crna slavina i ugradbeni uređaji', en: 'Black tap and integrated appliances' },
      ],
    },
  ] satisfies readonly InteriorDemoProject[],
  imageRightsNote: {
    hr: 'Vizuali su postojeći autorski materijali Ani’s Studija, prenamijenjeni isključivo za ovaj jasno označeni demo.',
    en: 'Visuals are existing original Ani’s Studio materials, reused only in this clearly labelled demo.',
  },
} as const
