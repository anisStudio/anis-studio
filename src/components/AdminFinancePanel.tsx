import { useEffect, useState, type FormEvent } from 'react'
import {
  FINANCIAL_DOC_KINDS,
  FINANCIAL_DOC_KIND_LABEL_HR,
  PAYMENT_PLAN_KIND_LABEL_HR,
  RECEIPT_STATUS_LABEL_HR,
  buildFullPaymentPlan,
  confirmPaymentReceipt,
  correctPaymentReceipt,
  createFinancialDocument,
  eurosToCents,
  formatEuroCents,
  listWebAtelierFinance,
  savePaymentPlan,
  scheduleReceiptStatus,
  type FinancialDocKind,
  type PaymentPlanItemInput,
  type PaymentPlanKind,
  type ProjectFinanceBundle,
} from '../lib/webAtelierFinance'

type Props = {
  projectId: string
  agreedTotalCents: number
}

export default function AdminFinancePanel({ projectId, agreedTotalCents }: Props) {
  const [bundle, setBundle] = useState<ProjectFinanceBundle>({
    schedules: [],
    documents: [],
    payments: [],
    receipt_events: [],
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [planKind, setPlanKind] = useState<PaymentPlanKind>('full')
  const [advanceAmount, setAdvanceAmount] = useState('')
  const [advanceDue, setAdvanceDue] = useState('')
  const [balanceDue, setBalanceDue] = useState('')
  const [customRows, setCustomRows] = useState<Array<{ label: string; amount: string; due: string }>>(
    [{ label: 'Rata 1', amount: '', due: '' }],
  )

  const [docKind, setDocKind] = useState<FinancialDocKind>('parra_invoice')
  const [docRef, setDocRef] = useState('')
  const [docIssued, setDocIssued] = useState('')
  const [docAmount, setDocAmount] = useState('')

  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [correctId, setCorrectId] = useState<string | null>(null)
  const [correctReason, setCorrectReason] = useState('')

  const activeSchedules = bundle.schedules.filter((s) => s.status !== 'cancelled')
  const hasPlan = activeSchedules.length > 0

  async function reload() {
    setBundle(await listWebAtelierFinance(projectId))
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await reload()
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Financije nisu učitane.')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  function planItemsFromForm(): PaymentPlanItemInput[] {
    if (planKind === 'full') {
      return buildFullPaymentPlan(agreedTotalCents)
    }
    if (planKind === 'advance_balance') {
      const advanceCents = eurosToCents(advanceAmount)
      const balanceCents = agreedTotalCents - advanceCents
      if (balanceCents < 0) throw new Error('Avans ne smije premašiti dogovoreni iznos.')
      return [
        { label: 'Avans', amountCents: advanceCents, dueDate: advanceDue || null },
        { label: 'Završna uplata', amountCents: balanceCents, dueDate: balanceDue || null },
      ]
    }
    return customRows.map((row, index) => ({
      label: row.label.trim() || `Rata ${index + 1}`,
      amountCents: eurosToCents(row.amount),
      dueDate: row.due || null,
    }))
  }

  async function submitPlan(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const items = planItemsFromForm()
      await savePaymentPlan({
        projectId,
        planKind,
        items,
        agreedTotalCents,
      })
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Plan uplate nije spremljen.')
    } finally {
      setBusy(false)
    }
  }

  async function addDocument(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createFinancialDocument({
        projectId,
        docKind,
        externalReference: docRef,
        issuedOn: docIssued || null,
        amountCents: docAmount ? eurosToCents(docAmount) : null,
      })
      setDocRef('')
      setDocAmount('')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dokument nije spremljen.')
    } finally {
      setBusy(false)
    }
  }

  async function doConfirm(scheduleId: string) {
    setBusy(true)
    setError(null)
    try {
      await confirmPaymentReceipt(scheduleId)
      setConfirmId(null)
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Potvrda nije spremljena.')
    } finally {
      setBusy(false)
    }
  }

  async function doCorrect(scheduleId: string) {
    setBusy(true)
    setError(null)
    try {
      await correctPaymentReceipt(scheduleId, correctReason)
      setCorrectId(null)
      setCorrectReason('')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ispravak nije spremljen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">Financijsko praćenje</h3>
      <p className="mt-1 text-sm text-slate-600">
        Ovdje pratite dogovorene rate i potvrđujete njihov primitak nakon provjere. Računi,
        fiskalizacija i službena evidencija uplata vode se u Parri.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Dogovoreni iznos projekta: <strong>{formatEuroCents(agreedTotalCents)}</strong> (nije
        konfiguratorska procjena).
      </p>
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {!hasPlan ? (
          <form onSubmit={submitPlan} className="space-y-3 rounded-lg border border-slate-100 p-3">
            <h4 className="text-sm font-semibold text-slate-800">Plan uplate</h4>
            <p className="text-xs text-slate-500">
              Zadano je jednokratno 100%. Avans ili više rata samo ako je dogovoreno s klijentom.
              Spremanje je eksplicitno — ništa se ne generira automatski.
            </p>
            <fieldset className="space-y-2">
              <legend className="sr-only">Vrsta plana</legend>
              {(Object.keys(PAYMENT_PLAN_KIND_LABEL_HR) as PaymentPlanKind[]).map((kind) => (
                <label key={kind} className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="radio"
                    name="planKind"
                    checked={planKind === kind}
                    onChange={() => setPlanKind(kind)}
                  />
                  {PAYMENT_PLAN_KIND_LABEL_HR[kind]}
                  {kind === 'full' ? (
                    <span className="text-xs font-medium text-violet-700">(zadano)</span>
                  ) : null}
                </label>
              ))}
            </fieldset>

            {planKind === 'full' ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Jedna rata: <strong>Cjelokupna uplata</strong> · {formatEuroCents(agreedTotalCents)}
              </p>
            ) : null}

            {planKind === 'advance_balance' ? (
              <div className="space-y-2">
                <input
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="Avans (EUR)"
                />
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={advanceDue}
                  onChange={(e) => setAdvanceDue(e.target.value)}
                />
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={balanceDue}
                  onChange={(e) => setBalanceDue(e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Ostatak se računa automatski do dogovorenog iznosa.
                </p>
              </div>
            ) : null}

            {planKind === 'custom' ? (
              <div className="space-y-2">
                {customRows.map((row, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-3">
                    <input
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={row.label}
                      onChange={(e) => {
                        const next = [...customRows]
                        next[index] = { ...row, label: e.target.value }
                        setCustomRows(next)
                      }}
                      placeholder="Naziv"
                      required
                    />
                    <input
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={row.amount}
                      onChange={(e) => {
                        const next = [...customRows]
                        next[index] = { ...row, amount: e.target.value }
                        setCustomRows(next)
                      }}
                      placeholder="EUR"
                      required
                    />
                    <input
                      type="date"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={row.due}
                      onChange={(e) => {
                        const next = [...customRows]
                        next[index] = { ...row, due: e.target.value }
                        setCustomRows(next)
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="text-sm font-medium text-violet-700"
                  onClick={() =>
                    setCustomRows((rows) => [
                      ...rows,
                      { label: `Rata ${rows.length + 1}`, amount: '', due: '' },
                    ])
                  }
                >
                  + Dodaj ratu
                </button>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-violet-700 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Spremi plan uplate
            </button>
          </form>
        ) : (
          <div className="rounded-lg border border-slate-100 p-3">
            <h4 className="text-sm font-semibold text-slate-800">Plan uplate</h4>
            <p className="mt-1 text-xs text-slate-500">
              Plan već postoji. Postojeće rate se ne prepisuju automatski. Za ispravak potvrđenog
              primitka koristi kontrolirani postupak ispravka.
            </p>
          </div>
        )}

        <form onSubmit={addDocument} className="space-y-2 rounded-lg border border-slate-100 p-3">
          <h4 className="text-sm font-semibold text-slate-800">Parra / dokument (opcionalno)</h4>
          <p className="text-xs text-slate-500">
            Referenca na dokument izdan u Parri. Prisutnost reference ne potvrđuje uplatu.
          </p>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={docKind}
            onChange={(e) => setDocKind(e.target.value as FinancialDocKind)}
          >
            {FINANCIAL_DOC_KINDS.map((k) => (
              <option key={k} value={k}>
                {FINANCIAL_DOC_KIND_LABEL_HR[k]}
              </option>
            ))}
          </select>
          <input
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={docRef}
            onChange={(e) => setDocRef(e.target.value)}
            placeholder="Externi broj / referenca"
          />
          <input
            type="date"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={docIssued}
            onChange={(e) => setDocIssued(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={docAmount}
            onChange={(e) => setDocAmount(e.target.value)}
            placeholder="Iznos EUR (opcionalno)"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-violet-700 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Spremi referencu
          </button>
        </form>
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-slate-800">Dogovorene rate</h4>
        <ul className="mt-2 space-y-2 text-sm">
          {activeSchedules.length === 0 ? (
            <li className="text-slate-500">Nema rata.</li>
          ) : (
            activeSchedules.map((s) => {
              const receipt = scheduleReceiptStatus(s)
              return (
                <li
                  key={s.id}
                  className={`rounded border p-3 ${
                    receipt === 'confirmed'
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-900">{s.label}</div>
                      <div className="text-slate-600">
                        {formatEuroCents(s.amount_cents)}
                        {s.due_date ? ` · dosp. ${s.due_date}` : ''}
                      </div>
                      <div
                        className={`mt-1 text-xs font-semibold ${
                          receipt === 'confirmed' ? 'text-emerald-800' : 'text-amber-800'
                        }`}
                      >
                        {RECEIPT_STATUS_LABEL_HR[receipt]}
                        {s.receipt_confirmed_at
                          ? ` · ${new Date(s.receipt_confirmed_at).toLocaleString('hr-HR')}`
                          : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {receipt === 'awaiting' ? (
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          onClick={() => setConfirmId(s.id)}
                        >
                          Potvrdi primitak
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-50"
                          onClick={() => {
                            setCorrectId(s.id)
                            setCorrectReason('')
                          }}
                        >
                          Ispravi potvrdu
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </div>

      {bundle.documents.length > 0 ? (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-slate-800">Parra reference</h4>
          <ul className="mt-2 space-y-2 text-sm">
            {bundle.documents.map((d) => (
              <li key={d.id} className="rounded border border-slate-100 bg-slate-50 p-2">
                <div className="font-medium">{d.external_reference}</div>
                <div className="text-slate-600">
                  {FINANCIAL_DOC_KIND_LABEL_HR[d.doc_kind]}
                  {d.amount_cents != null ? ` · ${formatEuroCents(d.amount_cents)}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {bundle.receipt_events.length > 0 ? (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-slate-800">Povijest potvrda / ispravaka</h4>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {bundle.receipt_events.slice(0, 12).map((event) => (
              <li key={event.id}>
                {new Date(event.created_at).toLocaleString('hr-HR')} ·{' '}
                {event.event_type === 'confirmed' ? 'potvrda' : 'ispravak'}
                {event.reason ? ` — ${event.reason}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {confirmId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-receipt-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h4 id="confirm-receipt-title" className="text-base font-semibold text-slate-900">
              Potvrdi primitak?
            </h4>
            <p className="mt-2 text-sm text-slate-600">
              Potvrdi tek nakon što si provjerio uplatu u Parri ili na poslovnom računu. Ovo nije
              knjiženje uplate ni izrada računa.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setConfirmId(null)}
                disabled={busy}
              >
                Odustani
              </button>
              <button
                type="button"
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={busy}
                onClick={() => void doConfirm(confirmId)}
              >
                Da, potvrdi primitak
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {correctId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="correct-receipt-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h4 id="correct-receipt-title" className="text-base font-semibold text-slate-900">
              Ispravi potvrdu primitka
            </h4>
            <p className="mt-2 text-sm text-slate-600">
              Razlog ispravka bilježi se u administrativnoj povijesti. Klijent će opet vidjeti
              status „Čeka potvrdu”.
            </p>
            <label className="mt-3 block text-sm font-medium text-slate-800">
              Razlog
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                value={correctReason}
                onChange={(e) => setCorrectReason(e.target.value)}
                required
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setCorrectId(null)}
                disabled={busy}
              >
                Odustani
              </button>
              <button
                type="button"
                className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={busy || correctReason.trim().length < 3}
                onClick={() => void doCorrect(correctId)}
              >
                Spremi ispravak
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
