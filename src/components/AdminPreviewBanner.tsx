import { Link } from 'react-router-dom'
import type { PublicService } from '../lib/publicServiceAccess'
import { PUBLIC_SERVICE_LABEL } from '../lib/publicServiceAccess'

interface AdminPreviewBannerProps {
  service: PublicService
  language: 'hr' | 'en'
  /** When true, remind that form submit writes production rows. */
  formsCreateProductionData?: boolean
}

/**
 * Unobtrusive marker for admin-only department preview (public flag off).
 * Not a sandbox — real pages, real production backends on intentional submit.
 */
export function AdminPreviewBanner({
  service,
  language,
  formsCreateProductionData = true,
}: AdminPreviewBannerProps) {
  const label = PUBLIC_SERVICE_LABEL[service]
  const title =
    language === 'hr'
      ? `Administratorski pregled — ${label}`
      : `Admin preview — ${label}`
  const body =
    language === 'hr'
      ? 'Ovaj odjel nije javno vidljiv. Pregledavate stvarne produkcijske stranice s potvrđenom administratorskom ulogom.'
      : 'This department is not publicly visible. You are viewing real production pages with a confirmed admin role.'
  const formNote =
    language === 'hr'
      ? 'Slanje obrasca, rezervacije ili upita stvara stvarne produkcijske zapise — nema sandbox načina rada.'
      : 'Submitting a form, booking, or inquiry creates real production records — there is no sandbox mode.'
  const backLabel = language === 'hr' ? 'Natrag na pregled stranice' : 'Back to site preview'

  return (
    <div
      className="border-b border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-50"
      role="status"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <div className="min-w-0">
          <p className="font-semibold tracking-tight">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-900/85 dark:text-amber-100/85">
            {body}
            {formsCreateProductionData ? ` ${formNote}` : null}
          </p>
        </div>
        <Link
          to="/admin/preview"
          className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-100"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  )
}
