import { useState, useEffect } from 'react'
import { useSettings } from '../hooks/useSettings'

type VisibilityKey =
  | 'interiors_public_visible'
  | 'lrc_public_visible'
  | 'web_atelier_public_visible'
  | 'interiors_vr_enabled'

export default function AdminSettingsPage() {
  const { settings, isLoading, error, updateSettings } = useSettings()
  const [isToggling, setIsToggling] = useState(false)
  const [isVisibilityToggling, setIsVisibilityToggling] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [visibilitySuccessMessage, setVisibilitySuccessMessage] = useState<
    string | null
  >(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [visibilityToggleError, setVisibilityToggleError] = useState<
    string | null
  >(null)
  const [localEnabled, setLocalEnabled] = useState<boolean>(
    settings?.is_lrc_form_enabled ?? true
  )
  const [localInteriorsVisible, setLocalInteriorsVisible] = useState(true)
  const [localLrcPublicVisible, setLocalLrcPublicVisible] = useState(false)
  const [localWebAtelierVisible, setLocalWebAtelierVisible] = useState(false)
  const [localVrEnabled, setLocalVrEnabled] = useState(false)

  // Sync localEnabled with settings when settings change
  useEffect(() => {
    if (settings?.is_lrc_form_enabled !== undefined) {
      setLocalEnabled(settings.is_lrc_form_enabled)
    }
  }, [settings?.is_lrc_form_enabled])

  useEffect(() => {
    if (!settings) return
    if (settings.interiors_public_visible !== undefined) {
      setLocalInteriorsVisible(settings.interiors_public_visible)
    }
    if (settings.lrc_public_visible !== undefined) {
      setLocalLrcPublicVisible(settings.lrc_public_visible)
    }
    if (settings.web_atelier_public_visible !== undefined) {
      setLocalWebAtelierVisible(settings.web_atelier_public_visible)
    }
    if (settings.interiors_vr_enabled !== undefined) {
      setLocalVrEnabled(settings.interiors_vr_enabled)
    }
  }, [
    settings?.interiors_public_visible,
    settings?.lrc_public_visible,
    settings?.web_atelier_public_visible,
    settings?.interiors_vr_enabled,
  ])

  const handleToggle = async () => {
    if (!settings || isToggling) return

    setIsToggling(true)
    setSuccessMessage(null)
    setToggleError(null)

    const oldValue = localEnabled
    const newValue = !oldValue

    // Optimistic update
    setLocalEnabled(newValue)

    const result = await updateSettings({ is_lrc_form_enabled: newValue })

    if (result.success) {
      setSuccessMessage(
        newValue
          ? 'LRC prijave su sada omogućene.'
          : 'LRC prijave su sada onemogućene.'
      )
      setTimeout(() => setSuccessMessage(null), 3000)
    } else {
      // Rollback on error
      setLocalEnabled(oldValue)
      setToggleError('Nije uspjelo spremanje postavki. Pokušajte ponovno.')
    }

    setIsToggling(false)
  }

  const visibilityState = {
    interiors_public_visible: localInteriorsVisible,
    lrc_public_visible: localLrcPublicVisible,
    web_atelier_public_visible: localWebAtelierVisible,
    interiors_vr_enabled: localVrEnabled,
  } as const

  const setVisibilityState = {
    interiors_public_visible: setLocalInteriorsVisible,
    lrc_public_visible: setLocalLrcPublicVisible,
    web_atelier_public_visible: setLocalWebAtelierVisible,
    interiors_vr_enabled: setLocalVrEnabled,
  } as const

  const handleVisibilityToggle = async (key: VisibilityKey) => {
    if (!settings || isVisibilityToggling) return

    setIsVisibilityToggling(true)
    setVisibilitySuccessMessage(null)
    setVisibilityToggleError(null)

    const oldValue = visibilityState[key]
    const newValue = !oldValue
    setVisibilityState[key](newValue)

    try {
      const result = await updateSettings({ [key]: newValue })

      if (result.success) {
        const successByKey: Record<
          VisibilityKey,
          { on: string; off: string }
        > = {
          interiors_public_visible: {
            on: 'Interijeri su sada javno vidljivi.',
            off: 'Interijeri su sada skriveni s javnog puta.',
          },
          lrc_public_visible: {
            on: 'LRC je sada javno vidljiv.',
            off: 'LRC je sada skriven s javnog puta.',
          },
          web_atelier_public_visible: {
            on: 'Web Atelier je sada javno vidljiv.',
            off: 'Web Atelier je sada skriven s javnog puta.',
          },
          interiors_vr_enabled: {
            on: 'VR opcija je omogućena.',
            off: 'VR opcija je onemogućena.',
          },
        }
        setVisibilitySuccessMessage(
          newValue ? successByKey[key].on : successByKey[key].off
        )
        setTimeout(() => setVisibilitySuccessMessage(null), 3000)
      } else {
        setVisibilityState[key](oldValue)
        setVisibilityToggleError(
          'Nije uspjelo spremanje postavki. Pokušajte ponovno.'
        )
      }
    } finally {
      setIsVisibilityToggling(false)
    }
  }

  const visibilityToggleButton = (
    key: VisibilityKey,
    checked: boolean,
    ariaLabel: string
  ) => (
    <button
      type="button"
      onClick={() => handleVisibilityToggle(key)}
      disabled={isVisibilityToggling || isLoading}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2
        ${checked ? 'bg-violet-600' : 'bg-slate-200'}
        ${isVisibilityToggling || isLoading ? 'opacity-50 cursor-not-allowed' : ''}
      `.trim()}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
          transition duration-200 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `.trim()}
      />
    </button>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-4 py-8">
        <div className="mx-auto max-w-2xl">
          {/* Header */}
          <header className="mb-8 border-b pb-4">
            <h1 className="text-2xl font-semibold text-slate-900">
              Postavke sustava
            </h1>
            <p className="mt-1 text-sm text-slate-700">
              Upravljaj postavkama Ani's Studio sustava.
            </p>
          </header>

          {/* Error message */}
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-950">Greška: {error}</p>
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-950">{successMessage}</p>
            </div>
          )}

          {visibilitySuccessMessage && (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-950">
                {visibilitySuccessMessage}
              </p>
            </div>
          )}

          {/* Settings Card */}
          <div className="rounded-xl bg-white shadow-sm">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                LRC prijave
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                Kada je isključeno, public LRC forma se skriva i na stranici se
                prikazuje poruka da trenutno nema otvorenih prijava za LRC
                radionice.
              </p>
            </div>

            <div className="px-6 py-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="font-medium text-slate-700">
                    Učitavanje postavki...
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-medium text-slate-900">
                        Omogući LRC prijave
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {localEnabled
                          ? 'Prijave su trenutno omogućene i forma za prijavu na LRC radionice je vidljiva korisnicima.'
                          : 'Prijave su trenutno onemogućene i korisnici vide poruku da trenutno nema otvorenih prijava za LRC radionice.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggle}
                      disabled={isToggling || isLoading}
                      className={`
                        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2
                        ${localEnabled ? 'bg-violet-600' : 'bg-slate-200'}
                        ${isToggling || isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                      role="switch"
                      aria-checked={localEnabled}
                      aria-label="Toggle LRC form"
                    >
                      <span
                        className={`
                        pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                        transition duration-200 ease-in-out
                        ${localEnabled ? 'translate-x-5' : 'translate-x-0'}
                      `}
                      />
                    </button>
                  </div>

                  {toggleError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-xs font-semibold text-red-950">
                        {toggleError}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Javna vidljivost sekcija */}
          <div className="mt-6 rounded-xl bg-white shadow-sm">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Javna vidljivost sekcija
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                Ove postavke kontroliraju prikaz sekcija u glavnom javnom putu.
                Direktni URL-ovi ostaju dostupni dok ih posebno ne isključimo.
              </p>
            </div>

            <div className="px-6 py-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="font-medium text-slate-700">
                    Učitavanje postavki...
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-medium text-slate-900">
                        Interijeri javno vidljivi
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {localInteriorsVisible
                          ? 'Sekcija Interijeri vidljiva je na glavnom javnom putu.'
                          : 'Sekcija Interijeri skrivena je s glavnog javnog puta.'}
                      </p>
                    </div>
                    {visibilityToggleButton(
                      'interiors_public_visible',
                      localInteriorsVisible,
                      'Javna vidljivost Interijera'
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-medium text-slate-900">
                        LRC javno vidljiv
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {localLrcPublicVisible
                          ? 'LRC sekcija vidljiva je na glavnom javnom putu.'
                          : 'LRC sekcija skrivena je s glavnog javnog puta.'}
                      </p>
                    </div>
                    {visibilityToggleButton(
                      'lrc_public_visible',
                      localLrcPublicVisible,
                      'Javna vidljivost LRC-a'
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-medium text-slate-900">
                        Web Atelier javno vidljiv
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {localWebAtelierVisible
                          ? 'Web Atelier vidljiv je na glavnom javnom putu.'
                          : 'Web Atelier skriven je s glavnog javnog puta.'}
                      </p>
                    </div>
                    {visibilityToggleButton(
                      'web_atelier_public_visible',
                      localWebAtelierVisible,
                      'Javna vidljivost Web Atelier-a'
                    )}
                  </div>

                  {visibilityToggleError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-xs font-semibold text-red-950">
                        {visibilityToggleError}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* VR opcija – Interijeri */}
          <div className="mt-6 rounded-xl bg-white shadow-sm">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                VR opcija – Interijeri
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                Kada je uključeno, VR opcije su vidljive u formi za stolare i u admin pregledu projekata.
              </p>
            </div>

            <div className="px-6 py-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="font-medium text-slate-700">
                    Učitavanje postavki...
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-medium text-slate-900">
                        Omogući VR opciju
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {localVrEnabled
                          ? 'VR opcije su trenutno vidljive u formi za stolare i u admin pregledu.'
                          : 'VR opcije su trenutno skrivene. Forma za stolare ne prikazuje VR polje.'}
                      </p>
                    </div>
                    {visibilityToggleButton(
                      'interiors_vr_enabled',
                      localVrEnabled,
                      'Omogući VR opciju za Interijere'
                    )}
                  </div>

                  {visibilityToggleError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-xs font-semibold text-red-950">
                        {visibilityToggleError}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium leading-relaxed text-blue-950">
              <strong>Napomena:</strong> Promjene se primjenjuju odmah. Kada su
              LRC prijave onemogućene, korisnici vide poruku da trenutno nema
              otvorenih prijava za LRC radionice, ali webshop s gotovim
              proizvodima ostaje dostupan.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
