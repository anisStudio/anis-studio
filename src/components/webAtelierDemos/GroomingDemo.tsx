import { useId, useState, type FormEvent } from 'react'
import {
  DEMO_ACTION_IS_LOCAL_ONLY,
  demoBookingConfirmation,
  type WebAtelierDemoDefinition,
} from '../../lib/webAtelierDemos'

interface Props {
  language: 'hr' | 'en'
  demo: WebAtelierDemoDefinition
}

export function GroomingDemo({ language, demo }: Props) {
  const hr = language === 'hr'
  const formId = useId()
  const [petName, setPetName] = useState('')
  const [service, setService] = useState('wash')
  const [slot, setSlot] = useState('tue-10')
  const [confirmation, setConfirmation] = useState<string | null>(null)

  function handleDemoBook(e: FormEvent) {
    e.preventDefault()
    // Explicitly local-only — no fetch, no storage writes for reservations.
    void DEMO_ACTION_IS_LOCAL_ONLY
    setConfirmation(demoBookingConfirmation(language))
  }

  return (
    <div className="wa-groom">
      <header className="wa-groom-nav">
        <div className="wa-groom-brand">{demo.businessName[language]}</div>
        <nav aria-label={hr ? 'Navigacija salona' : 'Salon navigation'}>
          <ul>
            <li>
              <a href="#usluge">{hr ? 'Usluge' : 'Services'}</a>
            </li>
            <li>
              <a href="#cijene">{hr ? 'Cijene' : 'Prices'}</a>
            </li>
            <li>
              <a href="#galerija">{hr ? 'Galerija' : 'Gallery'}</a>
            </li>
            <li>
              <a href="#rezervacija">{hr ? 'Rezervacija' : 'Booking'}</a>
            </li>
          </ul>
        </nav>
      </header>

      <section className="wa-groom-hero" aria-labelledby="groom-hero">
        <div className="wa-groom-hero-inner">
          <div>
            <h1 id="groom-hero">
              {hr ? 'Njega ljubimaca s osmijehom' : 'Pet care with a smile'}
            </h1>
            <p>
              {hr
                ? 'Fiktivni grooming salon — PRO višesekcijski koncept s orijentacijskim cijenama i demo rezervacijom.'
                : 'Fictional grooming salon — a PRO multi-section concept with indicative prices and demo booking.'}
            </p>
            <a className="wa-groom-btn" href="#rezervacija">
              {hr ? 'Isprobaj demo rezervaciju' : 'Try the demo booking'}
            </a>
          </div>
          <div className="wa-groom-blob" role="img" aria-label={hr ? 'Ilustracija salona' : 'Salon illustration'} />
        </div>
      </section>

      <section id="usluge" aria-labelledby="groom-services">
        <h2 id="groom-services">{hr ? 'Usluge' : 'Services'}</h2>
        <div className="wa-groom-services">
          {[
            {
              t: hr ? 'Kupanje i sušenje' : 'Bath & dry',
              d: hr ? 'Blagi proizvodi za osjetljivu kožu.' : 'Gentle products for sensitive skin.',
            },
            {
              t: hr ? 'Šišanje' : 'Haircut',
              d: hr ? 'Po pasmini ili po želji vlasnika.' : 'Breed standard or owner preference.',
            },
            {
              t: hr ? 'Njega šapa' : 'Paw care',
              d: hr ? 'Šišanje noktiju i čišćenje ušiju.' : 'Nail trim and ear cleaning.',
            },
          ].map((item) => (
            <article key={item.t} className="wa-groom-card">
              <h3>{item.t}</h3>
              <p>{item.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="cijene" aria-labelledby="groom-prices">
        <h2 id="groom-prices">{hr ? 'Orijentacijske cijene' : 'Indicative prices'}</h2>
        <div className="wa-groom-services">
          {[
            { t: hr ? 'Mali pas' : 'Small dog', p: 'od 25 EUR' },
            { t: hr ? 'Srednji pas' : 'Medium dog', p: 'od 35 EUR' },
            { t: hr ? 'Veliki pas' : 'Large dog', p: 'od 45 EUR' },
          ].map((item) => (
            <article key={item.t} className="wa-groom-card">
              <h3>{item.t}</h3>
              <p className="price">{item.p}</p>
            </article>
          ))}
        </div>
        <p className="wa-groom-addon">
          {hr
            ? 'Cijene su fiktivne i informativne — nisu stvarna ponuda salona.'
            : 'Prices are fictional and indicative — not a real salon offer.'}
        </p>
      </section>

      <section id="galerija" aria-labelledby="groom-gallery">
        <h2 id="groom-gallery">{hr ? 'Galerija' : 'Gallery'}</h2>
        <div className="wa-groom-gallery" aria-hidden="true">
          <div className="wa-groom-tile" />
          <div className="wa-groom-tile" />
          <div className="wa-groom-tile" />
          <div className="wa-groom-tile" />
        </div>
      </section>

      <section id="rezervacija" aria-labelledby="groom-book">
        <h2 id="groom-book">{hr ? 'Demo rezervacija' : 'Demo booking'}</h2>
        <form className="wa-groom-book" onSubmit={handleDemoBook} noValidate>
          <label htmlFor={`${formId}-pet`}>{hr ? 'Ime ljubimca' : 'Pet name'}</label>
          <input
            id={`${formId}-pet`}
            name="petName"
            value={petName}
            onChange={(e) => setPetName(e.target.value)}
            autoComplete="off"
          />

          <label htmlFor={`${formId}-service`}>{hr ? 'Usluga' : 'Service'}</label>
          <select
            id={`${formId}-service`}
            name="service"
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            <option value="wash">{hr ? 'Kupanje' : 'Bath'}</option>
            <option value="cut">{hr ? 'Šišanje' : 'Haircut'}</option>
            <option value="full">{hr ? 'Komplet' : 'Full package'}</option>
          </select>

          <label htmlFor={`${formId}-slot`}>{hr ? 'Termin (demo)' : 'Time slot (demo)'}</label>
          <select
            id={`${formId}-slot`}
            name="slot"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
          >
            <option value="tue-10">{hr ? 'Uto 10:00' : 'Tue 10:00'}</option>
            <option value="wed-14">{hr ? 'Sri 14:00' : 'Wed 14:00'}</option>
            <option value="fri-11">{hr ? 'Pet 11:00' : 'Fri 11:00'}</option>
          </select>

          <button type="submit" className="wa-groom-btn">
            {hr ? 'Pošalji demo rezervaciju' : 'Submit demo booking'}
          </button>

          {confirmation && (
            <p className="wa-groom-alert" role="status" aria-live="polite">
              {confirmation}
              {petName.trim()
                ? hr
                  ? ` (uneseno: ${petName.trim()})`
                  : ` (entered: ${petName.trim()})`
                : ''}
            </p>
          )}

          <p className="wa-groom-addon">{demo.packageNote[language]}</p>
        </form>
      </section>
    </div>
  )
}
