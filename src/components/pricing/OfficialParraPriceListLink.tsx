import { OFFICIAL_PARRA_PRICE_LIST_PATH } from '../../config/officialPriceList'

interface OfficialParraPriceListHubCtaProps {
  language: 'hr' | 'en'
}

const copy = {
  button: {
    hr: 'Službeni cjenik – Parra',
    en: 'Official price list – Parra',
  },
  hint: {
    hr: 'Službeno objavljene cijene svih odjela.',
    en: 'Officially published prices for all departments.',
  },
}

export function OfficialParraPriceListHubCta({ language }: OfficialParraPriceListHubCtaProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2 text-center">
      <a
        href={OFFICIAL_PARRA_PRICE_LIST_PATH}
        className="btn btn-secondary inline-flex min-h-[44px] w-full items-center justify-center px-6 py-2.5 text-sm font-semibold sm:w-auto"
        rel="noopener noreferrer"
        target="_blank"
      >
        {copy.button[language]}
      </a>
      <p className="text-xs leading-relaxed text-plum/58 dark:text-pearl/52">{copy.hint[language]}</p>
    </div>
  )
}

