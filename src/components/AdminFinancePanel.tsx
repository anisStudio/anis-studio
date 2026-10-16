import { useEffect, useState, type FormEvent } from 'react'
import {
  FINANCIAL_DOC_KINDS,
  FINANCIAL_DOC_KIND_LABEL_HR,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL_HR,
  PAYMENT_SCHEDULE_STATUS_LABEL_HR,
  createFinancialDocument,
  createPaymentSchedule,
  eurosToCents,
  formatEuroCents,
  listWebAtelierFinance,
  recordPayment,
  type FinancialDocKind,
  type PaymentMethod,
  type ProjectFinanceBundle,
} from '../lib/webAtelierFinance'

type Props = { projectId: string }

export default function AdminFinancePanel({ projectId }: Props) {
  const [bundle, setBundle] = useState<ProjectFinanceBundle>({
    schedules: [],
    documents: [],
    payments: [],
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [schedLabel, setSchedLabel] = useState('Avans')
  const [schedDue, setSchedDue] = useState('')
  const [schedAmount, setSchedAmount] = useState('')

  const [docKind, setDocKind] = useState<FinancialDocKind>('parra_invoice')
  const [docRef, setDocRef] = useState('')
  const [docIssued, setDocIssued] = useState('')
  const [docAmount, setDocAmount] = useState('')

  const [payAmount, setPayAmount] = useState('')
  const [payOn, setPayOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [payMethod, setPayMethod] = useState<PaymentMethod>('bank_transfer')
  const [payScheduleId, setPayScheduleId] = useState('')
  const [payRef, setPayRef] = useState('')

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

  async function addSchedule(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createPaymentSchedule({
        projectId,
        label: schedLabel,
        dueDate: schedDue || null,
        amountCents: eurosToCents(schedAmount),
      })
      setSchedAmount('')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Rata nije spremljena.')
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

  async function addPayment(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await recordPayment({
        projectId,
        amountCents: eurosToCents(payAmount),
        paidOn: payOn,
        method: payMethod,
        scheduleId: payScheduleId || null,
        externalReference: payRef || null,
      })
      setPayAmount('')
      setPayRef('')
      setPayScheduleId('')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Uplata nije spremljena.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">Financijsko praćenje</h3>
      <p className="mt-1 text-sm text-slate-600">
        Parra je izvor istine za račune i fiskalizaciju. Ovdje unosite samo reference, rate i
        ručne uplate — bez Stripea i bez automatske oznake plaćeno.
      </p>
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <form onSubmit={addSchedule} className="space-y-2 rounded-lg border border-slate-100 p-3">
          <h4 className="text-sm font-semibold text-slate-800">Nova rata</h4>
          <input
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={schedLabel}
            onChange={(e) => setSchedLabel(e.target.value)}
            placeholder="Naziv"
          />
          <input
            type="date"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={schedDue}
            onChange={(e) => setSchedDue(e.target.value)}
          />
          <input
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={schedAmount}
            onChange={(e) => setSchedAmount(e.target.value)}
            placeholder="Iznos EUR"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-violet-700 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Dodaj ratu
          </button>
        </form>

        <form onSubmit={addDocument} className="space-y-2 rounded-lg border border-slate-100 p-3">
          <h4 className="text-sm font-semibold text-slate-800">Parra / dokument</h4>
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

        <form onSubmit={addPayment} className="space-y-2 rounded-lg border border-slate-100 p-3">
          <h4 className="text-sm font-semibold text-slate-800">Ručna uplata</h4>
          <input
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder="Iznos EUR"
          />
          <input
            required
            type="date"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={payOn}
            onChange={(e) => setPayOn(e.target.value)}
          />
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL_HR[m]}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={payScheduleId}
            onChange={(e) => setPayScheduleId(e.target.value)}
          >
            <option value="">— bez veze na ratu —</option>
            {bundle.schedules.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({PAYMENT_SCHEDULE_STATUS_LABEL_HR[s.status]})
              </option>
            ))}
          </select>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={payRef}
            onChange={(e) => setPayRef(e.target.value)}
            placeholder="Bankovna referenca"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-violet-700 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Evidentiraj uplatu
          </button>
        </form>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">Rate</h4>
          <ul className="mt-2 space-y-2 text-sm">
            {bundle.schedules.length === 0 ? (
              <li className="text-slate-500">Nema rata.</li>
            ) : (
              bundle.schedules.map((s) => (
                <li key={s.id} className="rounded border border-slate-100 bg-slate-50 p-2">
                  <div className="font-medium">{s.label}</div>
                  <div className="text-slate-600">
                    {formatEuroCents(s.amount_cents)} · {PAYMENT_SCHEDULE_STATUS_LABEL_HR[s.status]}
                    {s.due_date ? ` · dosp. ${s.due_date}` : ''}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-800">Dokumenti</h4>
          <ul className="mt-2 space-y-2 text-sm">
            {bundle.documents.length === 0 ? (
              <li className="text-slate-500">Nema referenci.</li>
            ) : (
              bundle.documents.map((d) => (
                <li key={d.id} className="rounded border border-slate-100 bg-slate-50 p-2">
                  <div className="font-medium">{d.external_reference}</div>
                  <div className="text-slate-600">
                    {FINANCIAL_DOC_KIND_LABEL_HR[d.doc_kind]}
                    {d.amount_cents != null ? ` · ${formatEuroCents(d.amount_cents)}` : ''}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-800">Uplate</h4>
          <ul className="mt-2 space-y-2 text-sm">
            {bundle.payments.length === 0 ? (
              <li className="text-slate-500">Nema uplata.</li>
            ) : (
              bundle.payments.map((p) => (
                <li key={p.id} className="rounded border border-slate-100 bg-slate-50 p-2">
                  <div className="font-medium">{formatEuroCents(p.amount_cents)}</div>
                  <div className="text-slate-600">
                    {p.paid_on} · {PAYMENT_METHOD_LABEL_HR[p.method]}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}
