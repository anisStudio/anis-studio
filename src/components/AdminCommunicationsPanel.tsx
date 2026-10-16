import { useEffect, useState, type FormEvent } from 'react'
import {
  COMMUNICATION_CHANNELS,
  COMMUNICATION_CHANNEL_LABEL_HR,
  COMMUNICATION_DIRECTIONS,
  COMMUNICATION_DIRECTION_LABEL_HR,
  createWebAtelierCommunication,
  listCommunicationTemplates,
  listWebAtelierCommunications,
  type CommunicationChannel,
  type CommunicationDirection,
  type CommunicationTemplate,
  type WebAtelierCommunication,
} from '../lib/webAtelierCommunications'

type Props = {
  inquiryId?: string | null
  offerId?: string | null
  projectId?: string | null
}

export default function AdminCommunicationsPanel({ inquiryId, offerId, projectId }: Props) {
  const [rows, setRows] = useState<WebAtelierCommunication[]>([])
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [channel, setChannel] = useState<CommunicationChannel>('email')
  const [direction, setDirection] = useState<CommunicationDirection>('outbound')
  const [subject, setSubject] = useState('')
  const [summary, setSummary] = useState('')
  const [templateId, setTemplateId] = useState('')

  async function reload() {
    const [comms, tpls] = await Promise.all([
      listWebAtelierCommunications({ inquiryId, offerId, projectId }),
      listCommunicationTemplates('web_atelier'),
    ])
    setRows(comms)
    setTemplates(tpls.filter((t) => t.is_active))
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await reload()
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Komunikacije nisu učitane.')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId, offerId, projectId])

  function applyTemplate(id: string) {
    setTemplateId(id)
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) return
    setChannel(tpl.channel)
    if (tpl.subject_template) setSubject(tpl.subject_template)
    setSummary(tpl.body_template)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createWebAtelierCommunication({
        channel,
        direction,
        subject: subject || null,
        summary,
        inquiryId,
        offerId,
        projectId,
        templateId: templateId || null,
      })
      setSubject('')
      setSummary('')
      setTemplateId('')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Zapis nije spremljen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">Komunikacije</h3>
      <p className="mt-1 text-sm text-slate-600">
        Ručni admin zapisi. Sustav ne šalje e-mailove i ne potvrđuje isporuku.
      </p>

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-700">
          Predložak
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={templateId}
            onChange={(e) => applyTemplate(e.target.value)}
          >
            <option value="">— bez predloška —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Kanal
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={channel}
            onChange={(e) => setChannel(e.target.value as CommunicationChannel)}
          >
            {COMMUNICATION_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {COMMUNICATION_CHANNEL_LABEL_HR[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Smjer
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={direction}
            onChange={(e) => setDirection(e.target.value as CommunicationDirection)}
          >
            {COMMUNICATION_DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {COMMUNICATION_DIRECTION_LABEL_HR[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Predmet
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>
        <label className="sm:col-span-2 text-sm text-slate-700">
          Sažetak
          <textarea
            required
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy || !summary.trim()}
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Spremanje…' : 'Spremi zapis'}
          </button>
        </div>
      </form>

      <ul className="mt-6 space-y-3">
        {rows.length === 0 ? (
          <li className="text-sm text-slate-500">Nema komunikacijskih zapisa.</li>
        ) : (
          rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
              <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                <span>{COMMUNICATION_CHANNEL_LABEL_HR[row.channel]}</span>
                <span>·</span>
                <span>{COMMUNICATION_DIRECTION_LABEL_HR[row.direction]}</span>
                <span>·</span>
                <span>{new Date(row.occurred_at).toLocaleString('hr-HR')}</span>
              </div>
              {row.subject ? <p className="mt-1 font-medium text-slate-900">{row.subject}</p> : null}
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{row.summary}</p>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
