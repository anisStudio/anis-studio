import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { trackEvent } from '../lib/analytics'
import {
  WEB_ATELIER_ADDON_DEFINITIONS,
  WEB_ATELIER_PACKAGE_DEFINITIONS,
  addonLabel,
  calculateConfiguratorEstimate,
  emptyConfiguratorSelection,
  formatEur,
  packageLabel,
  writeStoredConfiguratorSelection,
  type ConfiguratorAddonId,
  type ConfiguratorPackageId,
  type ConfiguratorSelection,
  type FixedAddonId,
} from '../lib/webAtelierConfigurator'
import './webAtelierConfigurator.css'

interface WebAtelierConfiguratorProps {
  language: 'hr' | 'en'
  /** When true, CTA navigates to inquiry with stored selection. */
  enableInquiryCta?: boolean
}

const QTY_ADDONS: FixedAddonId[] = ['extra_page', 'minor_revision']

type ConfigStep = 0 | 1 | 2 | 3

export function WebAtelierConfigurator({
  language,
  enableInquiryCta = true,
}: WebAtelierConfiguratorProps) {
  const baseId = useId()
  const [selection, setSelection] = useState<ConfiguratorSelection>(() => emptyConfiguratorSelection())
  const [step, setStep] = useState<ConfigStep>(0)

  const estimate = useMemo(() => calculateConfiguratorEstimate(selection), [selection])

  const copy = language === 'hr'
    ? {
        title: 'Konfigurator usluge',
        intro:
          'Odaberite paket i opcionalne dodatke korak po korak. Izračun je informativan, neobvezujući i podložan ručnoj provjeri — nije ponuda, narudžba ni plaćanje.',
        packages: 'Osnovni paketi',
        addons: 'Opcionalne usluge',
        ecommerce: 'Složeniji e-commerce',
        summary: 'Sažetak procjene',
        totalFixed: 'Fiksni zbroj',
        totalEstimate: 'Informativna procjena (od)',
        customNote: 'Uključene stavke s individualnom ponudom.',
        superseded:
          'Cijena paketa nije zbrojena jer je odabrana opcija „Nova web + shop” (izbjegava se dvostruko zbrajanje).',
        cta: 'Nastavi na upit s ovom konfiguracijom',
        ctaHint: 'Odaberite barem paket ili jednu opciju.',
        from: 'od',
        qty: 'Količina',
        customQuote: 'Individualna ponuda',
        popular: 'Preporučeno',
        next: 'Dalje',
        back: 'Natrag',
        skip: 'Preskoči',
        stepOf: 'Korak',
        of: 'od',
        progressLabel: 'Napredak konfiguratora',
        selectedPackage: 'Paket',
        selectedAddons: 'Dodaci',
        noneYet: 'Još nije odabrano',
        stickyHint: 'Procjena se ažurira dok birate opcije.',
      }
    : {
        title: 'Service configurator',
        intro:
          'Choose a package and optional add-ons step by step. The total is indicative, nonbinding, and subject to manual review — not an offer, order, or payment.',
        packages: 'Base packages',
        addons: 'Optional services',
        ecommerce: 'Complex ecommerce',
        summary: 'Estimate summary',
        totalFixed: 'Fixed subtotal',
        totalEstimate: 'Indicative estimate (from)',
        customNote: 'Includes custom-quote items.',
        superseded:
          'Package price is not stacked because “New web + shop” is selected (avoids double-counting).',
        cta: 'Continue to inquiry with this configuration',
        ctaHint: 'Select at least a package or one option.',
        from: 'from',
        qty: 'Quantity',
        customQuote: 'Custom quote',
        popular: 'Recommended',
        next: 'Next',
        back: 'Back',
        skip: 'Skip',
        stepOf: 'Step',
        of: 'of',
        progressLabel: 'Configurator progress',
        selectedPackage: 'Package',
        selectedAddons: 'Add-ons',
        noneYet: 'Nothing selected yet',
        stickyHint: 'The estimate updates as you choose options.',
      }

  const stepLabels = language === 'hr'
    ? ['Paket', 'Dodaci', 'E-commerce', 'Sažetak']
    : ['Package', 'Add-ons', 'Ecommerce', 'Summary']

  function setPackage(id: ConfiguratorPackageId) {
    setSelection((prev) => ({
      ...prev,
      packageId: prev.packageId === id ? null : id,
    }))
  }

  function setAddonQuantity(id: ConfiguratorAddonId, quantity: number) {
    setSelection((prev) => {
      const addons = { ...prev.addons }
      if (quantity <= 0) delete addons[id]
      else addons[id] = quantity
      return { ...prev, addons }
    })
  }

  function toggleAddon(id: ConfiguratorAddonId) {
    const current = selection.addons[id] ?? 0
    setAddonQuantity(id, current > 0 ? 0 : 1)
  }

  const canContinue =
    estimate.selection.packageId != null || Object.keys(estimate.selection.addons).length > 0

  function persistForInquiry() {
    writeStoredConfiguratorSelection(
      typeof window === 'undefined' ? null : window.sessionStorage,
      estimate.selection,
    )
    trackEvent('inquiry_cta_click', { source: 'web-atelier-configurator' })
  }

  const inquiryHref = estimate.selection.packageId
    ? `/web-atelier/upit?paket=${estimate.selection.packageId}&cfg=1`
    : '/web-atelier/upit?cfg=1'

  const standardAddons = WEB_ATELIER_ADDON_DEFINITIONS.filter(
    (def) =>
      def.id !== 'shop_integration' &&
      def.id !== 'new_web_shop' &&
      def.id !== 'advanced_ecommerce',
  )
  const ecommerceAddons = WEB_ATELIER_ADDON_DEFINITIONS.filter(
    (def) =>
      def.id === 'shop_integration' ||
      def.id === 'new_web_shop' ||
      def.id === 'advanced_ecommerce',
  )

  const addonCount = Object.keys(selection.addons).length

  function SummaryBlock({ compact = false }: { compact?: boolean }) {
    return (
      <div
        className={`wa-cfg-panel space-y-2 ${compact ? 'p-3' : 'p-4'}`}
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="text-xs wa-cfg-muted">{copy.stickyHint}</p>
        <p className="text-sm">
          <span className="wa-cfg-help">{copy.selectedPackage}: </span>
          <span className="font-semibold">
            {selection.packageId ? selection.packageId.toUpperCase() : copy.noneYet}
          </span>
        </p>
        <p className="text-sm">
          <span className="wa-cfg-help">{copy.selectedAddons}: </span>
          <span className="font-semibold">{addonCount}</span>
        </p>
        {estimate.fixedTotalEur > 0 && (
          <p className="text-sm">
            <span className="wa-cfg-help">{copy.totalFixed}: </span>
            <span className="wa-cfg-total">{formatEur(estimate.fixedTotalEur, language)}</span>
          </p>
        )}
        {estimate.estimateFloorEur != null && (
          <p className={`text-base ${compact ? '' : 'sm:text-lg'}`}>
            <span className="wa-cfg-help">{copy.totalEstimate}: </span>
            <span className="wa-cfg-total">{formatEur(estimate.estimateFloorEur, language)}</span>
          </p>
        )}
        {estimate.hasCustomQuote && <p className="wa-cfg-help text-xs">{copy.customNote}</p>}
        {estimate.packageSupersededByEcommerce && (
          <p className="wa-cfg-help text-xs">{copy.superseded}</p>
        )}
        {!canContinue && <p className="wa-cfg-muted text-xs">{copy.ctaHint}</p>}
      </div>
    )
  }

  return (
    <section
      id="web-atelier-configurator"
      className="wa-cfg scroll-mt-28 sm:scroll-mt-32"
      aria-labelledby={`${baseId}-title`}
    >
      <header className="mb-5 text-center sm:mb-6">
        <h3 id={`${baseId}-title`} className="wa-cfg-title font-heading text-xl sm:text-2xl">
          {copy.title}
        </h3>
        <p className="wa-cfg-help mx-auto mt-3 max-w-2xl text-sm leading-relaxed">{copy.intro}</p>
        <p className="wa-cfg-muted mt-2 text-xs" aria-live="polite">
          {copy.stepOf} {step + 1} {copy.of} 4 — {stepLabels[step]}
        </p>
      </header>

      <nav aria-label={copy.progressLabel} className="wa-cfg-progress mb-5">
        <ol className="wa-cfg-progress-list">
          {stepLabels.map((label, index) => {
            const current = index === step
            const done = index < step
            return (
              <li key={label}>
                <button
                  type="button"
                  className={`wa-cfg-progress-btn${current ? ' is-current' : ''}${done ? ' is-done' : ''}`}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => setStep(index as ConfigStep)}
                >
                  <span className="wa-cfg-progress-index" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>{label}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="wa-cfg-layout">
        <div className="wa-cfg-main min-w-0">
          {step === 0 && (
            <fieldset className="mb-2">
              <legend className="wa-cfg-title mb-3 text-sm font-semibold sm:text-base">
                {copy.packages}
              </legend>
              <div
                className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4"
                role="radiogroup"
                aria-label={copy.packages}
              >
                {WEB_ATELIER_PACKAGE_DEFINITIONS.map((pkg) => {
                  const selected = selection.packageId === pkg.id
                  const inputId = `${baseId}-pkg-${pkg.id}`
                  return (
                    <div
                      key={pkg.id}
                      className={`wa-cfg-panel flex h-full flex-col p-4 ${selected ? 'is-selected' : ''}`}
                    >
                      <label htmlFor={inputId} className="flex cursor-pointer flex-col gap-2">
                        <span className="flex items-start gap-2">
                          <input
                            id={inputId}
                            type="radio"
                            name={`${baseId}-package`}
                            checked={selected}
                            onChange={() => setPackage(pkg.id)}
                            onClick={() => {
                              if (selected) setPackage(pkg.id)
                            }}
                            className="mt-1 h-4 w-4 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-bold">{pkg.id.toUpperCase()}</span>
                              {pkg.id === 'pro' && (
                                <span className="wa-cfg-muted text-xs font-semibold">
                                  {copy.popular}
                                </span>
                              )}
                            </span>
                            <span className="wa-cfg-accent mt-1 block text-lg">
                              {copy.from} {formatEur(pkg.fromEur, language)}
                            </span>
                            <span className="wa-cfg-help mt-2 block text-xs leading-relaxed">
                              {language === 'hr'
                                ? `${pkg.pages === 1 ? 'Jednostranična stranica' : `Do ${pkg.pages} stranica`}, ${pkg.revisions} ${pkg.revisions === 1 ? 'revizija' : 'revizije'}${
                                    pkg.id === 'premium'
                                      ? ', mini branding, 30 dana prioritetne tehničke podrške'
                                      : ''
                                  }.`
                                : `${pkg.pages === 1 ? 'One-page site' : `Up to ${pkg.pages} pages`}, ${pkg.revisions} revision${pkg.revisions === 1 ? '' : 's'}${
                                    pkg.id === 'premium'
                                      ? ', mini branding, 30-day priority technical support'
                                      : ''
                                  }.`}
                            </span>
                          </span>
                        </span>
                      </label>
                      <p className="wa-cfg-muted mt-2 text-xs">{packageLabel(pkg.id, language)}</p>
                    </div>
                  )
                })}
              </div>
            </fieldset>
          )}

          {step === 1 && (
            <fieldset className="mb-2">
              <legend className="wa-cfg-title mb-3 text-sm font-semibold sm:text-base">
                {copy.addons}
              </legend>
              <ul className="space-y-2">
                {standardAddons.map((def) => {
                  const checked = (selection.addons[def.id] ?? 0) > 0
                  const inputId = `${baseId}-addon-${def.id}`
                  const isQty = QTY_ADDONS.includes(def.id as FixedAddonId)
                  return (
                    <li key={def.id} className="wa-cfg-panel p-3 sm:p-3.5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <label
                          htmlFor={inputId}
                          className="flex min-w-0 cursor-pointer items-start gap-2"
                        >
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAddon(def.id)}
                            className="mt-1 h-4 w-4 shrink-0"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">
                              {addonLabel(def.id, language)}
                            </span>
                            <span className="wa-cfg-help block text-xs">
                              {def.kind === 'custom_quote'
                                ? copy.customQuote
                                : def.kind === 'estimate_from' && def.unitEur != null
                                  ? `${copy.from} ${formatEur(def.unitEur, language)}`
                                  : def.unitEur != null
                                    ? formatEur(def.unitEur, language)
                                    : copy.customQuote}
                            </span>
                          </span>
                        </label>
                        {isQty && checked && (
                          <label className="flex items-center gap-2 text-xs sm:text-sm">
                            <span className="wa-cfg-muted">{copy.qty}</span>
                            <input
                              type="number"
                              min={1}
                              max={def.maxQuantity}
                              value={selection.addons[def.id] ?? 1}
                              onChange={(e) =>
                                setAddonQuantity(def.id, Number(e.target.value) || 0)
                              }
                              aria-label={`${addonLabel(def.id, language)} — ${copy.qty}`}
                              className="w-16"
                            />
                          </label>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset className="mb-2">
              <legend className="wa-cfg-title mb-3 text-sm font-semibold sm:text-base">
                {copy.ecommerce}
              </legend>
              <ul className="space-y-2">
                {ecommerceAddons.map((def) => {
                  const checked = (selection.addons[def.id] ?? 0) > 0
                  const inputId = `${baseId}-ecom-${def.id}`
                  return (
                    <li key={def.id} className="wa-cfg-panel p-3 sm:p-3.5">
                      <label htmlFor={inputId} className="flex cursor-pointer items-start gap-2">
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAddon(def.id)}
                          className="mt-1 h-4 w-4 shrink-0"
                        />
                        <span>
                          <span className="block text-sm font-semibold">
                            {addonLabel(def.id, language)}
                          </span>
                          <span className="wa-cfg-help block text-xs">
                            {def.kind === 'custom_quote'
                              ? copy.customQuote
                              : def.unitEur != null
                                ? `${copy.from} ${formatEur(def.unitEur, language)}`
                                : copy.customQuote}
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </fieldset>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h4 className="wa-cfg-title text-sm font-semibold sm:text-base">{copy.summary}</h4>
              <SummaryBlock />
              {enableInquiryCta && (
                <div className="flex justify-center">
                  {canContinue ? (
                    <Link
                      to={inquiryHref}
                      onClick={persistForInquiry}
                      className="wa-cfg-btn inline-flex w-full max-w-md touch-manipulation items-center justify-center px-6 py-3 text-sm sm:w-auto sm:text-base"
                    >
                      {copy.cta}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="wa-cfg-btn w-full max-w-md px-6 py-3 text-sm"
                      disabled
                    >
                      {copy.cta}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="wa-cfg-nav mt-5 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="wa-cfg-nav-btn"
              disabled={step === 0}
              onClick={() => setStep((s) => (s > 0 ? ((s - 1) as ConfigStep) : s))}
            >
              {copy.back}
            </button>
            <div className="flex flex-wrap gap-2">
              {step === 2 && (
                <button
                  type="button"
                  className="wa-cfg-nav-btn"
                  onClick={() => setStep(3)}
                >
                  {copy.skip}
                </button>
              )}
              {step < 3 && (
                <button
                  type="button"
                  className="wa-cfg-nav-btn wa-cfg-nav-btn-primary"
                  onClick={() => setStep((s) => (s < 3 ? ((s + 1) as ConfigStep) : s))}
                >
                  {copy.next}
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="wa-cfg-aside" aria-label={copy.summary}>
          <div className="wa-cfg-sticky">
            <SummaryBlock compact />
            {enableInquiryCta && step !== 3 && (
              <div className="mt-3">
                {canContinue ? (
                  <Link
                    to={inquiryHref}
                    onClick={persistForInquiry}
                    className="wa-cfg-btn inline-flex w-full touch-manipulation items-center justify-center px-4 py-3 text-sm"
                  >
                    {copy.cta}
                  </Link>
                ) : (
                  <button type="button" className="wa-cfg-btn w-full px-4 py-3 text-sm" disabled>
                    {copy.cta}
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

export default WebAtelierConfigurator
