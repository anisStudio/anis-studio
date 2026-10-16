import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { isSupabaseConfigured } from '../lib/supabase'
import AdminCommunicationsPanel from '../components/AdminCommunicationsPanel'
import {
  WEB_ATELIER_DELIVERY_CHANNELS,
  WEB_ATELIER_EVIDENCE_CHANNELS,
  WEB_ATELIER_INFORMATIVE_PRICES_EUR,
  WEB_ATELIER_OFFER_ITEM_TYPES,
  WEB_ATELIER_PACKAGE_TIERS,
  buildEvidenceReference,
  calculateOfferTotals,
  canCreateProject,
  canEditOffer,
  canRecordDecision,
  canRecordDelivery,
  canReviseOffer,
  createWebAtelierOfferDraft,
  createWebAtelierProjectFromOffer,
  createWebAtelierScopeVersion,
  discardWebAtelierOfferDraft,
  fetchWebAtelierApprovalForOffer,
  fetchWebAtelierOffer,
  formatEuroCents,
  markWebAtelierOfferSent,
  recordWebAtelierOfferDecision,
  recordWebAtelierOfferDelivery,
  setWebAtelierOfferItems,
  suggestedLineForTier,
  updateWebAtelierOfferDraft,
  type WebAtelierApprovalRecord,
  type WebAtelierDeliveryChannel,
  type WebAtelierEvidenceChannel,
  type WebAtelierOfferDetail,
  type WebAtelierOfferItemInput,
  type WebAtelierOfferStatus,
  type WebAtelierPackageTier,
} from '../lib/webAtelierOffers'

const STATUS_LABEL: Record<WebAtelierOfferStatus, string> = {
  draft: 'Nacrt',
  sent: 'Izdana (snapshot, nepromjenjiva)',
  accepted: 'Prihvaćena',
  rejected: 'Odbijena',
  expired: 'Istekla',
  superseded: 'Zamijenjena',
}

const emptyItem = (): WebAtelierOfferItemInput => ({
  item_type: 'service',
  description: '',
  details: '',
  quantity: 1,
  unit_price_cents: 0,
})

function eurosInput(cents: number): string {
  return (cents / 100).toFixed(2)
}

export default function AdminWebAtelierOfferDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [offer, setOffer] = useState<WebAtelierOfferDetail | null>(null)
  const [approval, setApproval] = useState<WebAtelierApprovalRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<WebAtelierOfferItemInput[]>([emptyItem()])
  const [title, setTitle] = useState('')
  const [packageTier, setPackageTier] = useState<WebAtelierPackageTier | ''>('')
  const [validUntil, setValidUntil] = useState('')
  const [termsNote, setTermsNote] = useState('')
  const [scopeSummary, setScopeSummary] = useState('')
  const [scopeDeliverables, setScopeDeliverables] = useState('Dizajn\nIzrada')
  const [deliveryChannel, setDeliveryChannel] = useState<WebAtelierDeliveryChannel>('email_manual')
  const [deliveryReference, setDeliveryReference] = useState('')
  const [decision, setDecision] = useState<'accepted' | 'rejected'>('accepted')
  const [decidedByName, setDecidedByName] = useState('')
  const [evidenceChannel, setEvidenceChannel] = useState<WebAtelierEvidenceChannel>('email')
  const [evidenceNarrative, setEvidenceNarrative] = useState('')
  const [evidenceRetentionNote, setEvidenceRetentionNote] = useState('')
  const [adminConfirmed, setAdminConfirmed] = useState(false)

  async function reload() {
    const data = await fetchWebAtelierOffer(id)
    setOffer(data)
    if (data) {
      setTitle(data.title)
      setPackageTier(data.package_tier ?? '')
      setValidUntil(data.valid_until ?? '')
      setTermsNote(data.terms_note ?? '')
      setItems(
        data.items.length
          ? data.items.map((item) => ({
              item_type: item.item_type,
              description: item.description,
              details: item.details ?? '',
              quantity: Number(item.quantity),
              unit_price_cents: item.unit_price_cents,
            }))
          : [emptyItem()],
      )
      const nextApproval = await fetchWebAtelierApprovalForOffer(data.id)
      setApproval(nextApproval)
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Supabase nije konfiguriran.')
      setIsLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        await reload()
      } catch {
        if (!cancelled) setError('Ponuda nije dohvaćena.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const previewTotals = useMemo(() => {
    try {
      return calculateOfferTotals(items.filter((item) => item.description.trim()))
    } catch {
      return null
    }
  }, [items])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Radnja nije uspjela.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto max-w-3xl px-4 py-10">
        <Link className="text-sm font-medium text-violet-700 hover:underline" to="/admin/web-atelier-offers">
          Natrag na ponude
        </Link>
        <header className="mb-8 mt-4 border-b pb-4">
          <h1 className="text-2xl font-semibold text-slate-900">
            {offer ? offer.offer_number : 'Ponuda'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Ponuda nije račun. Račun ide preko Parre. Projekt nastaje samo nakon izričitog
            prihvaćanja.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        {isLoading && <p className="text-sm text-slate-600">Učitavam ponudu…</p>}
        {!isLoading && !offer && !error && <p className="text-slate-600">Ponuda nije pronađena.</p>}

        {offer && (
          <div className="space-y-8">
            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p>
                <span className="font-medium text-slate-500">Status:</span> {STATUS_LABEL[offer.status]}
              </p>
              <p>
                <span className="font-medium text-slate-500">Iznos:</span>{' '}
                {formatEuroCents(offer.total_cents)}
              </p>
              <p>
                <span className="font-medium text-slate-500">Klijent:</span> {offer.client_name} (
                {offer.client_email})
              </p>
              {offer.inquiry_id && (
                <p>
                  Upit:{' '}
                  <Link className="text-violet-700 hover:underline" to={`/admin/web-atelier-inquiries/${offer.inquiry_id}`}>
                    otvori
                  </Link>
                </p>
              )}
              {offer.snapshot_sha256 && (
                <p className="break-all text-xs text-slate-500">Snapshot: {offer.snapshot_sha256}</p>
              )}
              <p className="text-xs text-slate-600">
                Izdavanje snapshota ≠ dostava klijentu.
                {offer.delivered_at
                  ? ` Dostavljeno: ${new Date(offer.delivered_at).toLocaleString('hr-HR')} (${offer.delivery_channel}).`
                  : ' Dostava još nije zabilježena.'}
              </p>
            </div>

            {canRecordDelivery(offer.status, offer.delivered_at) && (
              <section className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
                <h2 className="text-lg font-semibold">Zabilježi ručnu dostavu</h2>
                <p className="text-sm text-slate-700">
                  Sustav ne šalje e-mail. Ovdje potvrđuješ da si izdani snapshot ručno dostavio
                  klijentu (npr. e-mailom iz vlastite sandučića).
                </p>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={deliveryChannel}
                  onChange={(event) => setDeliveryChannel(event.target.value as WebAtelierDeliveryChannel)}
                >
                  {WEB_ATELIER_DELIVERY_CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </select>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Referenca dostave (najmanje 10 znakova)"
                  value={deliveryReference}
                  onChange={(event) => setDeliveryReference(event.target.value)}
                />
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={() =>
                    void run(() =>
                      recordWebAtelierOfferDelivery({
                        offerId: offer.id,
                        deliveredAt: new Date().toISOString(),
                        deliveryChannel,
                        deliveryReference,
                      }),
                    )
                  }
                >
                  Spremi dostavu
                </button>
              </section>
            )}

            {canEditOffer(offer.status) && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">Uređivanje nacrta</h2>
                <label className="block text-sm">
                  Naslov
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Informativni paket
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={packageTier}
                    onChange={(event) => setPackageTier(event.target.value as WebAtelierPackageTier | '')}
                  >
                    <option value="">Bez oznake</option>
                    {WEB_ATELIER_PACKAGE_TIERS.map((tier) => (
                      <option key={tier} value={tier}>
                        {tier.toUpperCase()} ({WEB_ATELIER_INFORMATIVE_PRICES_EUR[tier]} €)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Vrijedi do
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={validUntil}
                    onChange={(event) => setValidUntil(event.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Uvjeti
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    rows={3}
                    value={termsNote}
                    onChange={(event) => setTermsNote(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                  onClick={() =>
                    void run(() =>
                      updateWebAtelierOfferDraft(offer.id, {
                        title,
                        package_tier: packageTier || null,
                        valid_until: validUntil || null,
                        terms_note: termsNote || null,
                      }),
                    )
                  }
                >
                  Spremi zaglavlje
                </button>

                <h3 className="pt-4 text-base font-semibold">Stavke</h3>
                <p className="text-xs text-slate-500">
                  Ukupni iznos računa server. Klijent ne može unijeti line_total.
                </p>
                {packageTier && (
                  <button
                    type="button"
                    className="text-sm text-violet-700 hover:underline"
                    onClick={() => setItems([suggestedLineForTier(packageTier)])}
                  >
                    Predloži informativnu cijenu {packageTier.toUpperCase()}
                  </button>
                )}
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                      <select
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        value={item.item_type}
                        onChange={(event) => {
                          const next = [...items]
                          next[index] = {
                            ...item,
                            item_type: event.target.value as WebAtelierOfferItemInput['item_type'],
                          }
                          setItems(next)
                        }}
                      >
                        {WEB_ATELIER_OFFER_ITEM_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <input
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        placeholder="Opis"
                        value={item.description}
                        onChange={(event) => {
                          const next = [...items]
                          next[index] = { ...item, description: event.target.value }
                          setItems(next)
                        }}
                      />
                      <input
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(event) => {
                          const next = [...items]
                          next[index] = { ...item, quantity: Number(event.target.value) }
                          setItems(next)
                        }}
                      />
                      <input
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        type="number"
                        min="0"
                        step="0.01"
                        value={eurosInput(item.unit_price_cents)}
                        onChange={(event) => {
                          const next = [...items]
                          next[index] = {
                            ...item,
                            unit_price_cents: Math.round(Number(event.target.value) * 100),
                          }
                          setItems(next)
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-1 text-sm"
                    onClick={() => setItems([...items, emptyItem()])}
                  >
                    Dodaj stavku
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-sm disabled:opacity-50"
                    onClick={() =>
                      void run(() =>
                        setWebAtelierOfferItems(
                          offer.id,
                          items.filter((item) => item.description.trim()),
                        ).then(() => undefined),
                      )
                    }
                  >
                    Spremi stavke
                  </button>
                </div>
                {previewTotals && (
                  <p className="text-sm text-slate-700">
                    Pregled: {formatEuroCents(previewTotals.subtotal_cents)} − popust{' '}
                    {formatEuroCents(previewTotals.discount_cents)} ={' '}
                    <strong>{formatEuroCents(previewTotals.total_cents)}</strong>
                  </p>
                )}

                <h3 className="pt-4 text-base font-semibold">Opseg rada</h3>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Sažetak opsega"
                  value={scopeSummary}
                  onChange={(event) => setScopeSummary(event.target.value)}
                />
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Isporuke, svaka u novom retku"
                  value={scopeDeliverables}
                  onChange={(event) => setScopeDeliverables(event.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !offer.inquiry_id}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                  onClick={() =>
                    void run(async () => {
                      if (!offer.inquiry_id) return
                      const scopeId = await createWebAtelierScopeVersion(offer.inquiry_id, {
                        summary: scopeSummary,
                        deliverables: scopeDeliverables.split('\n'),
                      })
                      await updateWebAtelierOfferDraft(offer.id, { scope_version_id: scopeId })
                    })
                  }
                >
                  Spremi opseg i veži na nacrt
                </button>

                <div className="flex flex-wrap gap-3 pt-4">
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    onClick={() => void run(() => markWebAtelierOfferSent(offer.id).then(() => undefined))}
                  >
                    Izdaj snapshot (bez e-maila / bez dostave)
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-800 disabled:opacity-50"
                    onClick={() =>
                      void run(async () => {
                        await discardWebAtelierOfferDraft(offer.id)
                        navigate('/admin/web-atelier-offers')
                      })
                    }
                  >
                    Obriši nacrt
                  </button>
                </div>
              </section>
            )}

            {canRecordDecision(offer.status, offer.delivered_at) && (
              <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h2 className="text-lg font-semibold">Zabilježi odluku klijenta</h2>
                <p className="text-sm text-slate-700">
                  Nema javnog linka za prihvaćanje. Baza ne verificira e-mail ni potpis — samo veže
                  tvoj citat na {offer.offer_number} #v{offer.version} i snapshot hash. Original
                  dokaza moraš čuvati izvan baze (retencija).
                </p>
                <select
                  className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  value={decision}
                  onChange={(event) => setDecision(event.target.value as 'accepted' | 'rejected')}
                >
                  <option value="accepted">Prihvaćeno</option>
                  <option value="rejected">Odbijeno</option>
                </select>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Ime osobe koja je odlučila"
                  value={decidedByName}
                  onChange={(event) => setDecidedByName(event.target.value)}
                />
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={evidenceChannel}
                  onChange={(event) => setEvidenceChannel(event.target.value as WebAtelierEvidenceChannel)}
                >
                  {WEB_ATELIER_EVIDENCE_CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </select>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Opis vanjskog dokaza (e-mail predmet, datoteka…)"
                  value={evidenceNarrative}
                  onChange={(event) => setEvidenceNarrative(event.target.value)}
                />
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Gdje je original zadržan (mailbox arhiva, Drive, mapa…)"
                  value={evidenceRetentionNote}
                  onChange={(event) => setEvidenceRetentionNote(event.target.value)}
                />
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={adminConfirmed}
                    onChange={(event) => setAdminConfirmed(event.target.checked)}
                  />
                  Potvrđujem da vanjski dokaz postoji, da citiram točnu verziju ponude i da
                  original čuvam na navedenoj lokaciji. Ovo nije tiho prihvaćanje.
                </label>
                <button
                  type="button"
                  disabled={busy || !offer.snapshot_sha256}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={() =>
                    void run(() =>
                      recordWebAtelierOfferDecision({
                        offerId: offer.id,
                        decision,
                        expectedOfferVersion: offer.version,
                        expectedSnapshotSha256: offer.snapshot_sha256 ?? '',
                        offerNumber: offer.offer_number,
                        decidedByName,
                        decidedAt: new Date().toISOString(),
                        evidenceChannel,
                        evidenceReference: buildEvidenceReference({
                          offerNumber: offer.offer_number,
                          offerVersion: offer.version,
                          narrative: evidenceNarrative,
                        }),
                        evidenceRetentionNote,
                        adminConfirmed,
                      }).then(() => undefined),
                    )
                  }
                >
                  Spremi odluku
                </button>
              </section>
            )}

            {approval && (
              <section className="rounded-xl border border-slate-200 p-4 text-sm">
                <h2 className="mb-2 text-lg font-semibold">Zabilježena odluka</h2>
                <p>
                  {approval.decision === 'accepted' ? 'Prihvaćeno' : 'Odbijeno'} — {approval.decided_by_name}
                </p>
                <p className="mt-1 text-slate-600">{approval.evidence_reference}</p>
              </section>
            )}

            {canCreateProject(offer.status) && (
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={() =>
                  void run(async () => {
                    const result = await createWebAtelierProjectFromOffer(offer.id)
                    navigate(`/admin/web-atelier-projects/${result.project_id}`)
                  })
                }
              >
                Otvori projekt iz prihvaćene ponude
              </button>
            )}

            {canReviseOffer(offer.status) && offer.inquiry_id && (
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-50"
                onClick={() =>
                  void run(async () => {
                    const nextId = await createWebAtelierOfferDraft(offer.inquiry_id as string, offer.id)
                    navigate(`/admin/web-atelier-offers/${nextId}`)
                  })
                }
              >
                Nova verzija ponude
              </button>
            )}

            <AdminCommunicationsPanel
              inquiryId={offer.inquiry_id}
              offerId={offer.id}
            />
          </div>
        )}
      </section>
    </main>
  )
}
