import { useEffect, useMemo, useState } from 'react'
import { fetchPublicPortfolioItems, type PortfolioItem } from '../lib/portfolio'
import { isSupabaseConfigured } from '../lib/supabase'

export type PortfolioGridCategory = 'lrc' | 'interiors' | 'web-atelier'

export interface PortfolioGridItem {
  /** Stable React key fragment */
  key: string
  category: PortfolioGridCategory
  title: string
  /** Mapped from description / description_en; null when empty or fallback item */
  description: string | null
  /** From DB tags; empty for fallback items */
  tags: string[]
  imageUrl: string | null
  imageAlt: string | null
}

type ResolveKind = 'loading' | 'fallback' | 'remote'

type FallbackDefinition = {
  id: number
  category: PortfolioGridCategory
  titleHr: string
  titleEn: string
}

function buildFallbackGridItems(language: 'hr' | 'en'): PortfolioGridItem[] {
  const ids: FallbackDefinition[] = [
    { id: 1, category: 'lrc', titleHr: 'Personalizirani poklon', titleEn: 'Customized Gift' },
    { id: 2, category: 'lrc', titleHr: 'Epoksidno umjetničko djelo', titleEn: 'Epoxy Art Piece' },
    { id: 3, category: 'interiors', titleHr: 'Moderna kuhinja', titleEn: 'Modern Kitchen' },
    { id: 4, category: 'interiors', titleHr: 'Ugradni ormar', titleEn: 'Built-in Wardrobe' },
    { id: 5, category: 'web-atelier', titleHr: 'Landing stranica', titleEn: 'Landing Page' },
    { id: 6, category: 'lrc', titleHr: 'Laser graviranje', titleEn: 'Laser Engraving' },
    { id: 7, category: 'interiors', titleHr: 'Radni prostor', titleEn: 'Workspace' },
    { id: 8, category: 'web-atelier', titleHr: 'E-commerce stranica', titleEn: 'E-commerce Site' },
    { id: 9, category: 'lrc', titleHr: 'Makrame ukras', titleEn: 'Macrame Decoration' },
    { id: 10, category: 'interiors', titleHr: 'Dnevni boravak', titleEn: 'Living Room' },
  ]
  return ids.map((row) => ({
    key: `fallback-${row.id}`,
    category: row.category,
    title: language === 'hr' ? row.titleHr : row.titleEn,
    description: null,
    tags: [],
    imageUrl: null,
    imageAlt: null,
  }))
}

function titleForLanguage(item: PortfolioItem, language: 'hr' | 'en'): string {
  if (language === 'en') {
    const t = item.title_en?.trim()
    if (t) return t
  }
  return item.title.trim() || ''
}

function descriptionForLanguage(item: PortfolioItem, language: 'hr' | 'en'): string | null {
  if (language === 'en') {
    const dEn = item.description_en?.trim()
    if (dEn) return dEn
    const dHr = item.description?.trim()
    if (dHr) return dHr
    return null
  }
  const d = item.description?.trim()
  return d ? d : null
}

function imageAltForLanguage(item: PortfolioItem, language: 'hr' | 'en'): string | null {
  if (language === 'en') {
    const a = item.image_alt_en?.trim()
    if (a) return a
    const aHr = item.image_alt?.trim()
    if (aHr) return aHr
    return titleForLanguage(item, language)
  }
  const a = item.image_alt?.trim()
  if (a) return a
  return titleForLanguage(item, language)
}

function mapRemoteToGrid(rows: PortfolioItem[], language: 'hr' | 'en'): PortfolioGridItem[] {
  return rows.map((item) => ({
    key: item.id,
    category: item.category,
    title: titleForLanguage(item, language),
    description: descriptionForLanguage(item, language),
    tags: item.tags.map((t) => t.trim()).filter(Boolean),
    imageUrl: item.image_url?.trim() || null,
    imageAlt: item.image_url ? imageAltForLanguage(item, language) : null,
  }))
}

/**
 * Loads visible public portfolio_items when Supabase is configured.
 * While resolving, uses the same hardcoded fallback as the legacy section so the homepage never looks empty.
 */
export function usePortfolioItems(language: 'hr' | 'en'): {
  items: PortfolioGridItem[]
  resolvedKind: ResolveKind
} {
  const [resolvedKind, setResolvedKind] = useState<ResolveKind>(() =>
    isSupabaseConfigured ? 'loading' : 'fallback'
  )
  const [remoteRows, setRemoteRows] = useState<PortfolioItem[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }

    let cancelled = false

    async function load() {
      setResolvedKind('loading')
      try {
        const data = await fetchPublicPortfolioItems()
        if (cancelled) return
        if (data.length > 0) {
          setRemoteRows(data)
          setResolvedKind('remote')
        } else {
          setRemoteRows([])
          setResolvedKind('fallback')
        }
      } catch (e) {
        console.warn(
          '[Portfolio] Neuspjeli dohvat javnog portfelja s Supabasea; koristim rezervnu galeriju.',
          e
        )
        if (!cancelled) {
          setRemoteRows([])
          setResolvedKind('fallback')
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const items = useMemo(() => {
    if (resolvedKind === 'remote' && remoteRows.length > 0) {
      return mapRemoteToGrid(remoteRows, language)
    }
    return buildFallbackGridItems(language)
  }, [resolvedKind, remoteRows, language])

  return { items, resolvedKind }
}