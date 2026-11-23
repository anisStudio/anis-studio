export const groomingConfig = {
  brand: {
    hr: 'Šapa & Sjaj',
    en: 'Paw & Polish',
  },
  storageKey: 'anis-demo-grooming-selection-v1',
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
  imageBriefs: [
    'Hero: groomer welcoming a small dog in a bright salon, landscape 16:9.',
    'Gallery: four candid salon moments without visible third-party logos, square 1:1.',
  ],
} as const

export interface GroomingDemoSelection {
  petName: string
  service: string
  slot: string
}
