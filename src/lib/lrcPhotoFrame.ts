import { averageRgbHex, edgePixels, LRC_FRAME_FALLBACK } from './lrcCatalog'

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Fotografiju nije moguće pročitati.'))
    image.src = url
  })
}

/**
 * Boja okvira je prosjek lijevog i desnog ruba.
 * Cijeli kadar ostaje u datoteci: platno samo mjeri boju i ne izrezuje sliku.
 */
export async function frameColorFromImageFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const sourceWidth = image.naturalWidth
    const sourceHeight = image.naturalHeight
    if (sourceWidth < 1 || sourceHeight < 1) return LRC_FRAME_FALLBACK
    const scale = Math.min(1, 128 / Math.max(sourceWidth, sourceHeight))
    const width = Math.max(1, Math.round(sourceWidth * scale))
    const height = Math.max(1, Math.round(sourceHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return LRC_FRAME_FALLBACK
    context.drawImage(image, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height)
    return averageRgbHex(edgePixels(width, height, pixels.data))
  } finally {
    URL.revokeObjectURL(url)
  }
}
