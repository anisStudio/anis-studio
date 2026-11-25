import { useEffect, useState } from 'react'
import { fetchPublicLrcProducts } from '../lib/lrcCatalogApi'
import type { LrcProduct } from '../lib/lrcCatalog'

export interface PublicLrcProductsState {
  status: 'loading' | 'ready' | 'error'
  products: LrcProduct[]
  source: 'catalog' | 'fallback' | 'none'
}

export function usePublicLrcProducts(): PublicLrcProductsState {
  const [state, setState] = useState<PublicLrcProductsState>({
    status: 'loading',
    products: [],
    source: 'none',
  })

  useEffect(() => {
    let cancelled = false
    fetchPublicLrcProducts().then((result) => {
      if (cancelled) return
      if (result.status === 'error') {
        setState({ status: 'error', products: [], source: 'none' })
        return
      }
      setState({ status: 'ready', products: result.products, source: result.source })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
