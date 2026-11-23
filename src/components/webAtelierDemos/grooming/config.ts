import {
  photoById,
  type DemoPhotoSlot,
} from '../photoSlot.ts'

/**
 * Client adaptation for this PRO template.
 * Brand: `brand` (the Web Atelier card uses the same object).
 * Colors: `.wa-groom` custom properties in webAtelierDemos.css.
 * Copy: `hero`, `services`, `gallery` labels, and `slots` here.
 *   Booking-form labels stay in GroomingDemo.tsx.
 * Photos: `photos`. CSS stand-in until public/images/web-atelier-demos/<file> exists.
 *   The hero file is also the Web Atelier demo-card cover.
 * Contact: no separate contact block. The sample appointment stays in this browser only.
 */
export const groomingPhotos = [
  {
    id: 'hero',
    file: 'grooming-hero-16x9.webp',
    motif: {
      hr: 'Groomer dočekuje malog psa u svijetlom salonu',
      en: 'A groomer welcoming a small dog in a bright salon',
    },
    ratio: '16:9',
    usedIn: [
      { hr: 'Hero na demo stranici salona', en: 'Hero on the salon demo page' },
      {
        hr: 'Naslovna slika demo kartice Pet grooming salon — PRO u Web Atelieru',
        en: 'Cover image of the Pet grooming salon — PRO demo card in Web Atelier',
      },
    ],
    standInClass: 'wa-groom-hero-frame',
  },
  {
    id: 'calm',
    file: 'grooming-mirni-docek-1x1.webp',
    motif: {
      hr: 'Mirni doček u salonu, bez logotipa trećih strana',
      en: 'A calm welcome in the salon, no third-party logos',
    },
    ratio: '1:1',
    usedIn: [
      { hr: 'Galerija salona — Mirni doček', en: 'Salon gallery — A calm welcome' },
    ],
    standInClass: 'wa-groom-tile',
  },
  {
    id: 'bath',
    file: 'grooming-zona-kupanja-1x1.webp',
    motif: {
      hr: 'Zona za kupanje, kadar iz salona bez logotipa',
      en: 'Bathing area, a salon moment without logos',
    },
    ratio: '1:1',
    usedIn: [
      { hr: 'Galerija salona — Zona za kupanje', en: 'Salon gallery — Bathing area' },
    ],
    standInClass: 'wa-groom-tile',
  },
  {
    id: 'finish',
    file: 'grooming-zavrsno-uredjivanje-1x1.webp',
    motif: {
      hr: 'Završno uređivanje dlake u salonu',
      en: 'Finishing touches on the coat in the salon',
    },
    ratio: '1:1',
    usedIn: [
      { hr: 'Galerija salona — Završno uređivanje', en: 'Salon gallery — Finishing touches' },
    ],
    standInClass: 'wa-groom-tile',
  },
  {
    id: 'after',
    file: 'grooming-nakon-tretmana-1x1.webp',
    motif: {
      hr: 'Ljubimac nakon tretmana, kadar iz salona',
      en: 'A pet after the treatment, a salon moment',
    },
    ratio: '1:1',
    usedIn: [
      { hr: 'Galerija salona — Nakon tretmana', en: 'Salon gallery — After the treatment' },
    ],
    standInClass: 'wa-groom-tile',
  },
] as const satisfies readonly DemoPhotoSlot[]

export const groomingConfig = {
  brand: {
    hr: 'Šapa & Sjaj',
    en: 'Paw & Polish',
  },
  storageKey: 'anis-demo-grooming-selection-v1',
  hero: {
    eyebrow: {
      hr: 'Salon za njegu ljubimaca',
      en: 'Pet grooming salon',
    },
    title: {
      hr: 'Nježno, stručno i bez žurbe',
      en: 'Gentle, skilled, and never rushed',
    },
    lead: {
      hr: 'Fiktivni PRO primjer salona s jasnom ponudom, galerijom i oglednim odabirom termina.',
      en: 'A fictional PRO salon example with clear services, a gallery, and a sample appointment selector.',
    },
    cta: {
      hr: 'Isprobaj ogledni termin',
      en: 'Try the sample booking',
    },
  },
  services: [
    {
      id: 'wash',
      title: { hr: 'Kupanje i sušenje', en: 'Bath & dry' },
      description: {
        hr: 'Blagi proizvodi, raščešljavanje i završno sušenje.',
        en: 'Gentle products, brushing, and a careful dry.',
      },
    },
    {
      id: 'cut',
      title: { hr: 'Šišanje', en: 'Haircut' },
      description: {
        hr: 'Uređivanje prema tipu dlake i dogovoru s vlasnikom.',
        en: 'A trim tailored to coat type and owner preference.',
      },
    },
    {
      id: 'full',
      title: { hr: 'Kompletna njega', en: 'Full care' },
      description: {
        hr: 'Kupanje, šišanje, njega šapa i osnovno uređivanje ušiju.',
        en: 'Bath, haircut, paw care, and basic ear care.',
      },
    },
  ],
  slots: [
    { id: 'tue-10', label: { hr: 'Utorak · 10:00', en: 'Tuesday · 10:00' } },
    { id: 'wed-14', label: { hr: 'Srijeda · 14:00', en: 'Wednesday · 14:00' } },
    { id: 'fri-11', label: { hr: 'Petak · 11:00', en: 'Friday · 11:00' } },
  ],
  gallery: [
    { id: 'calm', label: { hr: 'Mirni doček', en: 'A calm welcome' } },
    { id: 'bath', label: { hr: 'Zona za kupanje', en: 'Bathing area' } },
    { id: 'finish', label: { hr: 'Završno uređivanje', en: 'Finishing touches' } },
    { id: 'after', label: { hr: 'Nakon tretmana', en: 'After the treatment' } },
  ],
  photos: groomingPhotos,
} as const

export function groomingPhoto(id: string): DemoPhotoSlot {
  return photoById(groomingConfig.photos, id)
}

export interface GroomingDemoSelection {
  petName: string
  service: string
  slot: string
}
