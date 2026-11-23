import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { AdminPasswordChangeForm } from '../components/AdminPasswordChangeForm'
import { useLrcWebshop } from '../hooks/useLrcWebshop'
import { useSettings } from '../hooks/useSettings'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  confirmLrcWebshopServer,
  setLrcWebshopPreview,
} from '../lib/lrcWebshopStore'

type VisibilityKey =
  | 'interiors_public_visible'
  | 'lrc_public_visible'
  | 'web_atelier_public_visible'
  | 'interiors_vr_enabled'

export default function AdminSettingsPage() {
  const { pathname } = useLocation()
  const isLocalDemo = pathname === '/dev/postavke'
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
  const webshop = useLrcWebshop()
  const [webshopUrlDraft, setWebshopUrlDraft] = useState('')
  const [webshopUrlDirty, setWebshopUrlDirty] = useState(false)
  const [webshopSaving, setWebshopSaving] = useState(false)
  const [webshopMessage, setWebshopMessage] = useState<string | null>(null)

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

  useEffect(() => {
    if (!webshopUrlDirty) setWebshopUrlDraft(webshop.draftUrl)
  }, [webshop.draftUrl, webshopUrlDirty])

  const saveWebshop = async (enabled: boolean, url: string) => {
    if (webshopSaving) return
    setWebshopSaving(true)
    setWebshopMessage(null)
    const trimmed = url.trim() ? url.trim() : null
    setLrcWebshopPreview({ enabled, url: trimmed })

    const result = await updateSettings(
      { lrc_webshop_enabled: enabled, lrc_webshop_url: trimmed },
      { reportError: false },
    )
    const savedOnServer = result.success && isSupabaseConfigured

    if (savedOnServer) {
      confirmLrcWebshopServer({ enabled, url: trimmed })
      setWebshopMessage(
        enabled
          ? 'Webshop je uključen. Postojeća košarica ostaje ista.'
          : 'Webshop je isključen. Spremljeni sadržaj košarice nije obrisan.',
      )
    } else {
      setWebshopMessage(
        enabled
          ? 'Webshop je uključen samo u ovom pregledniku. Migracija nije primijenjena i produkcijska baza nije mijenjana.'
          : 'Webshop je isključen u ovom pregledniku. Sadržaj košarice ostaje spremljen. Produkcijska baza nije mijenjana.',
      )
    }

    setWebshopUrlDirty(false)
    setWebshopSaving(false)
    setTimeout(() => setWebshopMessage(null), 6000)
  }

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
          ? 'LRC upiti za proizvode su sada omogućeni.'
          : 'LRC upiti za proizvode su sada onemogućeni.'
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

          {isLocalDemo ? (
            <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium leading-relaxed text-amber-950">
              Lokalna demonstracija. Ovo nije admin okvir. Stvarne Postavke
              otvaraju se iz admin izbornika, stavka Postavke, na /admin/settings.
            </p>
          ) : null}

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

          <div className="rounded-xl bg-white shadow-sm">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Javna vidljivost sekcija
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                Ove postavke određuju smiju li javni posjetitelji pristupiti odjelu
                (navigacija i izravni URL). Administratori mogu pregledavati skrivene
                odjele putem Admin → Pregled stranice. Vidljivost nije isto što i
                objavljivanje novog koda (za to koristite Vercel Preview).
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

          <div className="mt-6 rounded-xl bg-white shadow-sm">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Ani’s LRC
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                Upiti za proizvode i poveznica webshopa. Isključeni upiti skrivaju
                obrazac i gumbe „Pošalji upit”. Webshop je zaseban prekidač i ne
                briše košaricu.
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
                        Omogući LRC upite za proizvode
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {localEnabled
                          ? 'Upiti za proizvode su uključeni. Obrazac i gumbi „Pošalji upit” su vidljivi.'
                          : 'Upiti za proizvode su isključeni. Obrazac i gumbi „Pošalji upit” nisu dostupni.'}
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
                      aria-label="Omogući LRC upite za proizvode"
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
            <div className="space-y-5 border-t px-6 py-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-base font-medium text-slate-900">
                    Prikaži webshop i košaricu
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {webshop.enabled
                      ? 'Ikona košarice i dodavanje u košaricu su vidljivi.'
                      : 'Ikona košarice, ulazi u kupnju i gumbi za dodavanje su skriveni.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => saveWebshop(!webshop.enabled, webshopUrlDraft)}
                  disabled={webshopSaving || isLoading}
                  className={`
                    relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                    transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2
                    ${webshop.enabled ? 'bg-violet-600' : 'bg-slate-200'}
                    ${webshopSaving || isLoading ? 'cursor-not-allowed opacity-50' : ''}
                  `.trim()}
                  role="switch"
                  aria-checked={webshop.enabled}
                  aria-label="LRC webshop"
                >
                  <span
                    className={`
                      pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                      transition duration-200 ease-in-out
                      ${webshop.enabled ? 'translate-x-5' : 'translate-x-0'}
                    `.trim()}
                  />
                </button>
              </div>

              <div>
                <label htmlFor="lrc-webshop-url" className="text-base font-medium text-slate-900">
                  Adresa webshopa
                </label>
                <p className="mt-1 text-sm text-slate-700">
                  Poveznica „Otvori webshop” prikazuje se samo dok je prekidač uključen i adresa počinje s https://.
                  Košaricu možete provjeriti i bez adrese.
                </p>
                <input
                  id="lrc-webshop-url"
                  type="url"
                  inputMode="url"
                  value={webshopUrlDraft}
                  onChange={(event) => {
                    setWebshopUrlDirty(true)
                    setWebshopUrlDraft(event.target.value)
                  }}
                  placeholder="https://"
                  className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => saveWebshop(webshop.enabled, webshopUrlDraft)}
                  disabled={webshopSaving || isLoading}
                  className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Spremi adresu
                </button>
              </div>

              {webshopMessage && (
                <p className="text-sm font-medium text-slate-800">{webshopMessage}</p>
              )}
              {webshop.localPreview && (
                <p className="text-sm text-slate-600">
                  Vrijednost je u ovom pregledniku. Datoteka za pregled migracije:
                  supabase/review/lrc_webshop_settings.sql
                </p>
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

          {/* Sigurnost administratorskog računa */}
          <div className="mt-6 rounded-xl bg-white shadow-sm">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Sigurnost administratorskog računa
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                Promjena lozinke koristi Supabase Auth. Lozinka se ne sprema u
                tablice aplikacije. Prije promjene potrebna je potvrda trenutačnom
                lozinkom.
              </p>
            </div>
            <div className="px-6 py-6">
              <AdminPasswordChangeForm />
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium leading-relaxed text-blue-950">
              <strong>Napomena:</strong> Promjene se primjenjuju odmah. Kada su
              LRC upiti za proizvode onemogućeni, obrazac i gumbi „Pošalji upit”
              nisu dostupni. Košarica slijedi zaseban prekidač webshopa.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
