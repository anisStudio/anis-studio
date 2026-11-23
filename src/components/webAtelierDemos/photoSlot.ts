/**
 * Photography slots for the START and PRO demos.
 * Each slot paints its WebP from public/images/web-atelier-demos/.
 * The stand-in class keeps the ratio and frame if the file fails to load.
 */

export const DEMO_PHOTO_PUBLIC_DIR = '/images/web-atelier-demos'

export type DemoPhotoRatio = '16:9' | '4:5' | '3:2' | '1:1'

export interface DemoPhotoCopy {
  readonly hr: string
  readonly en: string
}

export interface DemoPhotoSlot {
  readonly id: string
  readonly file: string
  readonly motif: DemoPhotoCopy
  readonly ratio: DemoPhotoRatio
  readonly usedIn: readonly DemoPhotoCopy[]
  /** CSS illustration shown until `file` is added. */
  readonly standInClass: string
}

export function photoById(slots: readonly DemoPhotoSlot[], id: string): DemoPhotoSlot {
  const slot = slots.find((item) => item.id === id)
  if (!slot) throw new Error(`Missing demo photo slot: ${id}`)
  return slot
}

/** Paints the delivered file inside the prepared ratio frame. */
export function photoSlotAttrs(slot: DemoPhotoSlot) {
  const src = `${DEMO_PHOTO_PUBLIC_DIR}/${slot.file}`
  return {
    'data-photo-file': src,
    'data-photo-ratio': slot.ratio,
    'data-photo-status': 'photo' as const,
    style: {
      backgroundImage: `url("${src}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    },
  }
}
