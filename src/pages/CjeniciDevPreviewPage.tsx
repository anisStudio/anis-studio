import { formatEurFromCents } from '../lib/interiorsPricing'
import { WEB_ATELIER_PACKAGE_DEFINITIONS } from '../lib/webAtelierConfigurator'
import CjeniciPage from './CjeniciPage'

interface CjeniciDevPreviewPageProps {
  language: 'hr' | 'en'
}

/**
 * Local development view of the price-list hub.
 * Registered only when import.meta.env.DEV is true.
 * The public /cjenici page does not receive the Web Atelier link.
 */
function startPackagePriceLine(language: 'hr' | 'en'): string | null {
  const start = WEB_ATELIER_PACKAGE_DEFINITIONS.find((item) => item.id === 'start')
  if (!start) return null
  const amount = formatEurFromCents(Math.round(start.fromEur * 100), language)
  return language === 'hr' ? `od ${amount}` : `from ${amount}`
}

export default function CjeniciDevPreviewPage({ language }: CjeniciDevPreviewPageProps) {
  const priceLine = startPackagePriceLine(language)

  return (
    <>
      <p className="bg-white/80 px-4 py-2 text-center text-xs text-plum/70 dark:bg-black/20 dark:text-pearl/70">
        {language === 'hr'
          ? 'DEV pregled — nije javno objavljeno'
          : 'DEV preview — not publicly published'}
      </p>
      <CjeniciPage
        language={language}
        webAtelierPreview={
          priceLine ? { priceLine, href: '/dev/cjenici/web-atelier' } : undefined
        }
      />
    </>
  )
}
