import { useId, useState, type FormEvent } from 'react'
import {
  DEMO_ACTION_IS_LOCAL_ONLY,
  demoOrderConfirmation,
  type WebAtelierDemoDefinition,
} from '../../lib/webAtelierDemos'

interface Props {
  language: 'hr' | 'en'
  demo: WebAtelierDemoDefinition
}

export function FloristDemo({ language, demo }: Props) {
  const hr = language === 'hr'
  const formId = useId()
  const [bouquet, setBouquet] = useState('seasonal')
  const [occasion, setOccasion] = useState('thanks')
  const [note, setNote] = useState('')
  const [confirmation, setConfirmation] = useState<string | null>(null)

  function handleDemoOrder(e: FormEvent) {
    e.preventDefault()
    void DEMO_ACTION_IS_LOCAL_ONLY
    setConfirmation(demoOrderConfirmation(language))
  }

  return (
    <div className="wa-flor">
      <header className="wa-flor-nav">
        <div className="wa-flor-brand">{demo.businessName[language]}</div>
        <nav aria-label={hr ? 'Navigacija cvjećarne' : 'Florist navigation'}>
          <ul>
            <li>
              <a href="#kolekcije">{hr ? 'Kolekcije' : 'Collections'}</a>
            </li>
            <li>
              <a href="#prigode">{hr ? 'Prigode' : 'Occasions'}</a>
            </li>
            <li>
              <a href="#galerija">{hr ? 'Galerija' : 'Gallery'}</a>
            </li>
            <li>
              <a href="#narudzba">{hr ? 'Narudžba' : 'Order'}</a>
            </li>
          </ul>
        </nav>
      </header>

      <section className="wa-flor-hero" aria-labelledby="flor-hero">
        <h1 id="flor-hero">
          {hr ? 'Cvijeće s uredničkim mirisom' : 'Flowers with an editorial touch'}
        </h1>
        <p>
          {hr
            ? 'Fiktivna cvjećarna — PREMIUM vizualni koncept. Uzorak narudžbe nema naplatu ni web shop.'
            : 'Fictional florist — a PREMIUM visual concept. The sample order has no payment and is not a shop.'}
        </p>
        <a className="wa-flor-btn" href="#narudzba">
          {hr ? 'Isprobaj demo narudžbu' : 'Try the demo order'}
        </a>
      </section>

      <section id="kolekcije" aria-labelledby="flor-collections">
        <h2 id="flor-collections">{hr ? 'Kolekcije' : 'Collections'}</h2>
        <div className="wa-flor-grid">
          {[
            {
              t: hr ? 'Sezonski buket' : 'Seasonal bouquet',
              d: hr ? 'Lokalno cvijeće tjedna.' : 'Local stems of the week.',
            },
            {
              t: hr ? 'Minimalni aranžman' : 'Minimal arrangement',
              d: hr ? 'Čiste linije, malo boja.' : 'Clean lines, restrained colour.',
            },
            {
              t: hr ? 'Svečani set' : 'Ceremony set',
              d: hr ? 'Za događaje i proslave.' : 'For events and celebrations.',
            },
          ].map((item) => (
            <article key={item.t} className="wa-flor-card">
              <div className="wa-flor-swatch" aria-hidden="true" />
              <div className="wa-flor-card-body">
                <h3>{item.t}</h3>
                <p>{item.d}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="prigode" aria-labelledby="flor-occasions">
        <h2 id="flor-occasions">{hr ? 'Prigode' : 'Occasions'}</h2>
        <div className="wa-flor-grid">
          {[
            hr ? 'Zahvala' : 'Thank you',
            hr ? 'Rođendan' : 'Birthday',
            hr ? 'Sućut' : 'Sympathy',
          ].map((label) => (
            <article key={label} className="wa-flor-card">
              <div className="wa-flor-card-body">
                <h3>{label}</h3>
                <p>
                  {hr
                    ? 'Kategorija u PREMIUM demo strukturi — bez stvarnog kataloga.'
                    : 'A category in the PREMIUM demo structure — no real catalogue.'}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="galerija" aria-labelledby="flor-gallery">
        <h2 id="flor-gallery">{hr ? 'Galerija' : 'Gallery'}</h2>
        <div className="wa-flor-grid" aria-hidden="true">
          <div className="wa-flor-card">
            <div className="wa-flor-swatch" />
          </div>
          <div className="wa-flor-card">
            <div className="wa-flor-swatch" />
          </div>
          <div className="wa-flor-card">
            <div className="wa-flor-swatch" />
          </div>
        </div>
        <p className="wa-flor-note">
          {hr
            ? 'CSS gradijenti umjesto licenciranih fotografija ili tuđih brendova.'
            : 'CSS gradients instead of licensed photos or third-party brands.'}
        </p>
      </section>

      <section id="narudzba" aria-labelledby="flor-order">
        <h2 id="flor-order">{hr ? 'Demo narudžba' : 'Demo order'}</h2>
        <form className="wa-flor-order" onSubmit={handleDemoOrder} noValidate>
          <label htmlFor={`${formId}-bouquet`}>{hr ? 'Buket' : 'Bouquet'}</label>
          <select
            id={`${formId}-bouquet`}
            value={bouquet}
            onChange={(e) => setBouquet(e.target.value)}
          >
            <option value="seasonal">{hr ? 'Sezonski' : 'Seasonal'}</option>
            <option value="minimal">{hr ? 'Minimalni' : 'Minimal'}</option>
            <option value="ceremony">{hr ? 'Svečani' : 'Ceremony'}</option>
          </select>

          <label htmlFor={`${formId}-occasion`}>{hr ? 'Prigoda' : 'Occasion'}</label>
          <select
            id={`${formId}-occasion`}
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
          >
            <option value="thanks">{hr ? 'Zahvala' : 'Thank you'}</option>
            <option value="birthday">{hr ? 'Rođendan' : 'Birthday'}</option>
            <option value="sympathy">{hr ? 'Sućut' : 'Sympathy'}</option>
          </select>

          <label htmlFor={`${formId}-note`}>{hr ? 'Poruka (opcionalno)' : 'Note (optional)'}</label>
          <input
            id={`${formId}-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoComplete="off"
          />

          <button type="submit" className="wa-flor-btn">
            {hr ? 'Pošalji demo narudžbu' : 'Submit demo order'}
          </button>

          {confirmation && (
            <p className="wa-flor-alert" role="status" aria-live="polite">
              {confirmation}
            </p>
          )}

          <p className="wa-flor-note">{demo.packageNote[language]}</p>
        </form>
      </section>
    </div>
  )
}
