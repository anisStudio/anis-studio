import { useState } from 'react'
import type { WebAtelierDemoDefinition } from '../../../lib/webAtelierDemos'
import { floristConfig } from './config'

interface Props {
  language: 'hr' | 'en'
  demo: WebAtelierDemoDefinition
}

export function FloristDemo({ language, demo }: Props) {
  const hr = language === 'hr'
  const [occasion, setOccasion] = useState('all')
  const arrangements = floristConfig.arrangements.filter(
    (item) => occasion === 'all' || item.occasions.includes(occasion),
  )

  return (
    <div className="wa-flor">
      <header className="wa-flor-nav">
        <div className="wa-flor-brand">{floristConfig.brand}</div>
        <nav aria-label={hr ? 'Navigacija cvjećarne' : 'Florist navigation'}>
          <ul>
            <li><a href="#aranzmani">{hr ? 'Aranžmani' : 'Arrangements'}</a></li>
            <li><a href="#prigode">{hr ? 'Prigode' : 'Occasions'}</a></li>
            <li><a href="#kontakt">{hr ? 'Kontakt' : 'Contact'}</a></li>
          </ul>
        </nav>
      </header>

      <section className="wa-flor-hero" aria-labelledby="flor-hero">
        <p className="wa-flor-kicker">{hr ? 'Cvjećarnica · Zagreb' : 'Florist · Zagreb'}</p>
        <h1 id="flor-hero">{floristConfig.hero.title[language]}</h1>
        <p>{floristConfig.hero.lead[language]}</p>
        <a className="wa-flor-btn" href="#prigode">
          {hr ? 'Pronađi aranžman' : 'Find an arrangement'}
        </a>
      </section>

      <section id="prigode" aria-labelledby="flor-occasions">
        <h2 id="flor-occasions">{hr ? 'Što danas obilježavate?' : 'What are you marking today?'}</h2>
        <p className="wa-flor-section-lead">
          {hr
            ? 'Odaberite prigodu i pogledajte odgovarajuće primjere iz demo ponude.'
            : 'Choose an occasion to see matching examples from this demo offer.'}
        </p>
        <div className="wa-flor-occasion-list" aria-label={hr ? 'Filtriraj po prigodi' : 'Filter by occasion'}>
          {floristConfig.occasions.map((item) => (
            <button
              key={item.id}
              type="button"
              className={occasion === item.id ? 'is-active' : ''}
              aria-pressed={occasion === item.id}
              onClick={() => setOccasion(item.id)}
            >
              {item.label[language]}
            </button>
          ))}
        </div>
      </section>

      <section id="aranzmani" aria-labelledby="flor-arrangements">
        <h2 id="flor-arrangements">{hr ? 'Aranžmani' : 'Arrangements'}</h2>
        <div className="wa-flor-grid">
          {arrangements.map((item) => (
            <article key={item.id} className="wa-flor-card">
              <div
                className={`wa-flor-swatch ${item.visualClass}`}
                role="img"
                aria-label={hr ? `Demo vizual: ${item.name.hr}` : `Demo visual: ${item.name.en}`}
              />
              <div className="wa-flor-card-body">
                <h3>{item.name[language]}</h3>
                <p>{item.description[language]}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="wa-flor-note">
          {hr
            ? 'Demo koristi autorske CSS ilustracije dok se ne dostave fotografije fiktivnog brenda.'
            : 'This demo uses original CSS illustrations until fictional-brand photography is supplied.'}
        </p>
      </section>

      <section id="kontakt" className="wa-flor-contact" aria-labelledby="flor-contact">
        <p className="wa-flor-kicker">{hr ? 'Kontakt' : 'Contact'}</p>
        <h2 id="flor-contact">{hr ? 'Dogovorimo cvjetnu priču' : 'Let’s plan the floral story'}</h2>
        <p>
          {hr
            ? 'Nazovite, pošaljite poruku ili svratite na konzultaciju. Svi podaci u ovom primjeru su fiktivni.'
            : 'Call, send a message, or stop by for a consultation. All details in this example are fictional.'}
        </p>
        <div className="wa-flor-contact-links">
          <a className="wa-flor-btn" href={floristConfig.contact.phoneHref}>
            {floristConfig.contact.phoneDisplay}
          </a>
          <a href={`mailto:${floristConfig.contact.email}`}>{floristConfig.contact.email}</a>
          <span>{floristConfig.contact.location[language]}</span>
        </div>
        <p className="wa-flor-note">{demo.packageNote[language]}</p>
      </section>
    </div>
  )
}
