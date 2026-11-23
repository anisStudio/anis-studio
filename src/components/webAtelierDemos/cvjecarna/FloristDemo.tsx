import { useState } from 'react'
import type { WebAtelierDemoDefinition } from '../../../lib/webAtelierDemos'
import { photoSlotAttrs } from '../photoSlot'
import { floristConfig, floristPhoto } from './config'

interface Props {
  language: 'hr' | 'en'
  demo: WebAtelierDemoDefinition
}

export function FloristDemo({ language, demo }: Props) {
  const hr = language === 'hr'
  const heroPhoto = floristPhoto('hero')
  const spacePhoto = floristPhoto('prostor')
  const [occasion, setOccasion] = useState('all')
  const arrangements = floristConfig.arrangements.filter(
    (item) => occasion === 'all' || item.occasions.includes(occasion),
  )

  return (
    <div className="wa-flor">
      <header className="wa-flor-nav">
        <div className="wa-flor-brand">{floristConfig.brand[language]}</div>
        <nav aria-label={hr ? 'Navigacija cvjećarne' : 'Florist navigation'}>
          <ul>
            <li><a href="#aranzmani">{hr ? 'Aranžmani' : 'Arrangements'}</a></li>
            <li><a href="#prigode">{hr ? 'Prigode' : 'Occasions'}</a></li>
            <li><a href="#kontakt">{hr ? 'Kontakt' : 'Contact'}</a></li>
          </ul>
        </nav>
      </header>

      <section className="wa-flor-hero" aria-labelledby="flor-hero">
        <p className="wa-flor-kicker">{floristConfig.hero.kicker[language]}</p>
        <h1 id="flor-hero">{floristConfig.hero.title[language]}</h1>
        <p>{floristConfig.hero.lead[language]}</p>
        <div
          className={heroPhoto.standInClass}
          role="img"
          aria-label={heroPhoto.motif[language]}
          {...photoSlotAttrs(heroPhoto)}
        />
        <a className="wa-flor-btn" href="#prigode">
          {floristConfig.hero.cta[language]}
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
          {arrangements.map((item) => {
            const photo = floristPhoto(item.id)
            return (
            <article key={item.id} className="wa-flor-card">
              <div
                className={photo.standInClass}
                role="img"
                aria-label={photo.motif[language]}
                {...photoSlotAttrs(photo)}
              />
              <div className="wa-flor-card-body">
                <h3>{item.name[language]}</h3>
                <p>{item.description[language]}</p>
              </div>
            </article>
            )
          })}
        </div>
        <p className="wa-flor-note">
          {hr
            ? 'Fotografije su fiktivni demo materijal ovog koncepta.'
            : 'The photographs are fictional material for this demo concept.'}
        </p>
      </section>

      <section id="kontakt" className="wa-flor-contact" aria-labelledby="flor-contact">
        <div
          className={spacePhoto.standInClass}
          role="img"
          aria-label={spacePhoto.motif[language]}
          {...photoSlotAttrs(spacePhoto)}
        />
        <p className="wa-flor-kicker">{hr ? 'Kontakt' : 'Contact'}</p>
        <h2 id="flor-contact">{floristConfig.contact.title[language]}</h2>
        <p>{floristConfig.contact.lead[language]}</p>
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
