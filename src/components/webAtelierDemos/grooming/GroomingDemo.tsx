import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  DEMO_ACTION_IS_LOCAL_ONLY,
  demoBookingConfirmation,
  type WebAtelierDemoDefinition,
} from '../../../lib/webAtelierDemos'
import { groomingConfig, type GroomingDemoSelection } from './config'

interface Props {
  language: 'hr' | 'en'
  demo: WebAtelierDemoDefinition
}

const DEFAULT_SELECTION: GroomingDemoSelection = {
  petName: '',
  service: 'wash',
  slot: 'tue-10',
}

function readLocalSelection(): GroomingDemoSelection {
  if (typeof window === 'undefined') return DEFAULT_SELECTION
  try {
    const saved = window.localStorage.getItem(groomingConfig.storageKey)
    if (!saved) return DEFAULT_SELECTION
    const parsed = JSON.parse(saved) as Partial<GroomingDemoSelection>
    return {
      petName: typeof parsed.petName === 'string' ? parsed.petName : '',
      service: groomingConfig.services.some((item) => item.id === parsed.service)
        ? parsed.service!
        : 'wash',
      slot: groomingConfig.slots.some((item) => item.id === parsed.slot)
        ? parsed.slot!
        : 'tue-10',
    }
  } catch {
    return DEFAULT_SELECTION
  }
}

export function GroomingDemo({ language, demo }: Props) {
  const hr = language === 'hr'
  const formId = useId()
  const [selection, setSelection] = useState<GroomingDemoSelection>(readLocalSelection)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  useEffect(() => {
    window.localStorage.setItem(groomingConfig.storageKey, JSON.stringify(selection))
  }, [selection])

  function updateSelection(patch: Partial<GroomingDemoSelection>) {
    setSelection((current) => ({ ...current, ...patch }))
    setConfirmation(null)
  }

  function handleDemoBook(event: FormEvent) {
    event.preventDefault()
    void DEMO_ACTION_IS_LOCAL_ONLY
    window.localStorage.setItem(groomingConfig.storageKey, JSON.stringify(selection))
    setConfirmation(demoBookingConfirmation(language))
  }

  return (
    <div className="wa-groom">
      <header className="wa-groom-nav">
        <div className="wa-groom-brand">{groomingConfig.brand[language]}</div>
        <nav aria-label={hr ? 'Navigacija salona' : 'Salon navigation'}>
          <ul>
            <li><a href="#usluge">{hr ? 'Usluge' : 'Services'}</a></li>
            <li><a href="#galerija">{hr ? 'Galerija' : 'Gallery'}</a></li>
            <li><a href="#rezervacija">{hr ? 'Demo termin' : 'Demo booking'}</a></li>
          </ul>
        </nav>
      </header>

      <section className="wa-groom-hero" aria-labelledby="groom-hero">
        <div className="wa-groom-hero-inner">
          <div>
            <p className="wa-groom-eyebrow">{hr ? 'Salon za njegu ljubimaca' : 'Pet grooming salon'}</p>
            <h1 id="groom-hero">{hr ? 'Nježno, stručno i bez žurbe' : 'Gentle, skilled, and never rushed'}</h1>
            <p>
              {hr
                ? 'Fiktivni PRO primjer salona s jasnom ponudom, galerijom i oglednim odabirom termina.'
                : 'A fictional PRO salon example with clear services, a gallery, and a sample appointment selector.'}
            </p>
            <a className="wa-groom-btn" href="#rezervacija">
              {hr ? 'Isprobaj ogledni termin' : 'Try the sample booking'}
            </a>
          </div>
          <div className="wa-groom-blob" role="img" aria-label={hr ? 'Autorska demo ilustracija salona' : 'Original demo salon illustration'} />
        </div>
      </section>

      <section id="usluge" aria-labelledby="groom-services">
        <h2 id="groom-services">{hr ? 'Usluge' : 'Services'}</h2>
        <div className="wa-groom-services">
          {groomingConfig.services.map((item) => (
            <article key={item.id} className="wa-groom-card">
              <h3>{item.title[language]}</h3>
              <p>{item.description[language]}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="galerija" aria-labelledby="groom-gallery">
        <h2 id="groom-gallery">{hr ? 'Ugođaj salona' : 'Inside the salon'}</h2>
        <div className="wa-groom-gallery">
          {groomingConfig.gallery.map((item) => (
            <figure key={item.id} className="wa-groom-tile">
              <figcaption>{item.label[language]}</figcaption>
            </figure>
          ))}
        </div>
        <p className="wa-groom-addon">
          {hr
            ? 'Autorske CSS ilustracije zamjenjuju fotografije dok se ne pripreme motivi fiktivnog salona.'
            : 'Original CSS illustrations stand in until fictional-salon photography is prepared.'}
        </p>
      </section>

      <section id="rezervacija" aria-labelledby="groom-book">
        <h2 id="groom-book">{hr ? 'Ogledni odabir termina' : 'Sample appointment selection'}</h2>
        <form className="wa-groom-book" onSubmit={handleDemoBook}>
          <div className="wa-groom-demo-notice" role="note">
            <strong>{hr ? 'DEMO — nema stvarne rezervacije' : 'DEMO — no real appointment'}</strong>
            <span>
              {hr
                ? 'Odabir se čuva samo lokalno u ovom pregledniku i ne šalje se salonu.'
                : 'Your selection is kept only in this browser and is not sent to the salon.'}
            </span>
          </div>

          <label htmlFor={`${formId}-pet`}>{hr ? 'Ime ljubimca' : 'Pet name'}</label>
          <input
            id={`${formId}-pet`}
            value={selection.petName}
            onChange={(event) => updateSelection({ petName: event.target.value })}
            autoComplete="off"
          />

          <label htmlFor={`${formId}-service`}>{hr ? 'Usluga' : 'Service'}</label>
          <select
            id={`${formId}-service`}
            value={selection.service}
            onChange={(event) => updateSelection({ service: event.target.value })}
          >
            {groomingConfig.services.map((item) => (
              <option key={item.id} value={item.id}>{item.title[language]}</option>
            ))}
          </select>

          <label htmlFor={`${formId}-slot`}>{hr ? 'Termin (demo)' : 'Time slot (demo)'}</label>
          <select
            id={`${formId}-slot`}
            value={selection.slot}
            onChange={(event) => updateSelection({ slot: event.target.value })}
          >
            {groomingConfig.slots.map((item) => (
              <option key={item.id} value={item.id}>{item.label[language]}</option>
            ))}
          </select>

          <button type="submit" className="wa-groom-btn">
            {hr ? 'Potvrdi ogledni odabir' : 'Confirm sample selection'}
          </button>

          {confirmation ? (
            <p className="wa-groom-alert" role="status" aria-live="polite">
              {confirmation}
            </p>
          ) : null}

          <p className="wa-groom-addon">{demo.packageNote[language]}</p>
        </form>
      </section>
    </div>
  )
}
