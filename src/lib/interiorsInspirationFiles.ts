export const MAX_INSPIRATION_IMAGES = 5
export const MAX_PROJECT_FILE_SIZE_BYTES = 20 * 1024 * 1024

const SUPPORTED_INSPIRATION_MIME_TYPES = new Set(['image/jpeg', 'image/png'])
const SUPPORTED_INSPIRATION_FILE_NAME = /\.(?:jpe?g|png)$/i

export type InspirationFileLike = Pick<
  File,
  'name' | 'size' | 'lastModified' | 'type'
>

export interface InspirationFileRejections {
  duplicate: InspirationFileLike[]
  unsupportedType: InspirationFileLike[]
  oversized: InspirationFileLike[]
  overLimit: InspirationFileLike[]
}

export interface InspirationFileSelection<T extends InspirationFileLike> {
  files: T[]
  rejections: InspirationFileRejections
}

export function hasSameFileIdentity(
  left: InspirationFileLike,
  right: InspirationFileLike,
): boolean {
  return (
    left.name === right.name &&
    left.size === right.size &&
    left.lastModified === right.lastModified
  )
}

export function isSupportedInspirationImage(file: InspirationFileLike): boolean {
  const supportedName = SUPPORTED_INSPIRATION_FILE_NAME.test(file.name)
  if (!supportedName) return false
  return file.type === '' || SUPPORTED_INSPIRATION_MIME_TYPES.has(file.type)
}

export function selectInspirationFiles<T extends InspirationFileLike>(
  existing: readonly T[],
  incoming: readonly T[],
): InspirationFileSelection<T> {
  const files = existing.slice(0, MAX_INSPIRATION_IMAGES)
  const rejections: InspirationFileRejections = {
    duplicate: [],
    unsupportedType: [],
    oversized: [],
    overLimit: [],
  }

  for (const file of incoming) {
    if (!isSupportedInspirationImage(file)) {
      rejections.unsupportedType.push(file)
      continue
    }
    if (file.size > MAX_PROJECT_FILE_SIZE_BYTES) {
      rejections.oversized.push(file)
      continue
    }
    if (files.some((selected) => hasSameFileIdentity(selected, file))) {
      rejections.duplicate.push(file)
      continue
    }
    if (files.length >= MAX_INSPIRATION_IMAGES) {
      rejections.overLimit.push(file)
      continue
    }
    files.push(file)
  }

  return { files, rejections }
}

export function isValidInspirationFileState(
  files: readonly InspirationFileLike[],
): boolean {
  if (files.length > MAX_INSPIRATION_IMAGES) return false
  if (
    files.some(
      (file) =>
        !isSupportedInspirationImage(file) ||
        file.size > MAX_PROJECT_FILE_SIZE_BYTES,
    )
  ) {
    return false
  }

  return files.every(
    (file, index) =>
      files.findIndex((candidate) => hasSameFileIdentity(candidate, file)) ===
      index,
  )
}
