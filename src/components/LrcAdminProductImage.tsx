import { useEffect, useState } from 'react'
import { lrcProductImageObjectPath } from '../lib/lrcCatalog'
import { loadLrcAdminImage } from '../lib/lrcCatalogApi'

/** Shows a stored LRC photo to a signed-in admin, including photos on hidden products. */
export function LrcAdminProductImage({ src, className }: { src: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let blobUrl: string | null = null
    setFailed(false)
    if (!lrcProductImageObjectPath(src)) {
      setUrl(src)
      return
    }
    setUrl(null)
    loadLrcAdminImage(src)
      .then((next) => {
        if (cancelled) {
          if (next.startsWith('blob:')) URL.revokeObjectURL(next)
          return
        }
        if (next.startsWith('blob:')) blobUrl = next
        setUrl(next)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [src])

  if (failed) {
    return <span className="px-1 text-center text-[10px] leading-tight text-slate-500">Fotografija nije učitana.</span>
  }
  if (!url) return <span className="text-[10px] text-slate-400">…</span>
  return <img src={url} alt="" className={className} />
}
