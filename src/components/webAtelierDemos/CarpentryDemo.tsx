import type { WebAtelierDemoDefinition } from '../../lib/webAtelierDemos'

interface Props {
  language: 'hr' | 'en'
  demo: WebAtelierDemoDefinition
}

export function CarpentryDemo({ language, demo }: Props) {
  const hr = language === 'hr'
  const name = demo.businessName[language]

  return (
    <div className="wa-carp">
      <header className="wa-carp-nav">
        <div className="wa-carp-brand">{name}</div>
        <nav aria-label={hr ? 'Glavna navigacija' : 'Primary'}>
          <ul>
            <li>
              <a href="#radionica">{hr ? 'Radionica' : 'Workshop'}</a>
            </li>
            <li>
              <a href="#usluge">{hr ? 'Usluge' : 'Services'}</a>
            </li>
            <li>
              <a href="#radovi">{hr ? 'Radovi' : 'Projects'}</a>
            </li>
            <li>
              <a href="#kontakt">{hr ? 'Kontakt' : 'Contact'}</a>
            </li>
          </ul>
        </nav>
      </header>

      <section className="wa-carp-hero" aria-labelledby="carp-hero-title">
        <div>
          <h1 id="carp-hero-title">
            {hr
              ? 'Namještaj od drveta, rađen s preciznošću'
              : 'Timber furniture, crafted with precision'}
          </h1>
          <p>
            {hr
              ? 'Fiktivna stolarska radionica — jednostranični START koncept: jasna priča, usluge i galerija na jednoj stranici.'
              : 'Fictional carpentry workshop — a single-page START concept: clear story, services and gallery on one page.'}
          </p>
          <a className="wa-carp-btn" href="#kontakt">
            {hr ? 'Dogovori konzultacije' : 'Book a consultation'}
          </a>
        </div>
        <div className="wa-carp-illustration" role="img" aria-label={hr ? 'Ilustracija drveta' : 'Timber illustration'} />
      </section>

      <section id="radionica" aria-labelledby="carp-workshop">
        <h2 id="carp-workshop">{hr ? 'Radionica' : 'The workshop'}</h2>
        <p style={{ color: 'var(--c-muted)', maxWidth: '40rem', lineHeight: 1.55, margin: 0 }}>
          {hr
            ? 'Od odabira daske do završne obrade — priča o lokalnom zanatu bez izmišljenih klijenata ili brojki. Ovo je demonstracijski koncept, ne stvarni portfolio klijent.'
            : 'From board selection to finishing — a local craft story without invented clients or metrics. This is a demonstration concept, not a real client portfolio piece.'}
        </p>
      </section>

      <section id="usluge" aria-labelledby="carp-services">
        <h2 id="carp-services">{hr ? 'Usluge' : 'Services'}</h2>
        <div className="wa-carp-grid">
          {[
            {
              t: hr ? 'Kuhinjski elementi' : 'Kitchen pieces',
              d: hr ? 'Police, otoci i frontovi po mjeri.' : 'Custom shelves, islands and fronts.',
            },
            {
              t: hr ? 'Stolovi i stolice' : 'Tables & chairs',
              d: hr ? 'Masivno drvo za blagovanje i rad.' : 'Solid wood for dining and work.',
            },
            {
              t: hr ? 'Restauracija' : 'Restoration',
              d: hr ? 'Obnova postojećeg namještaja.' : 'Refreshing existing furniture.',
            },
          ].map((item) => (
            <article key={item.t} className="wa-carp-card">
              <h3>{item.t}</h3>
              <p>{item.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="radovi" aria-labelledby="carp-gallery">
        <h2 id="carp-gallery">{hr ? 'Primjeri radova' : 'Sample projects'}</h2>
        <div className="wa-carp-gallery" aria-hidden="true">
          <div className="wa-carp-tile" />
          <div className="wa-carp-tile" />
          <div className="wa-carp-tile" />
          <div className="wa-carp-tile" />
        </div>
        <p className="wa-carp-note">
          {hr
            ? 'Vizuali su CSS ilustracije — nisu fotografije stvarnih klijenata.'
            : 'Visuals are CSS illustrations — not photographs of real clients.'}
        </p>
      </section>

      <section id="kontakt" className="wa-carp-cta" aria-labelledby="carp-cta">
        <h2 id="carp-cta">{hr ? 'Spremni za razgovor?' : 'Ready to talk?'}</h2>
        <p style={{ color: 'var(--c-muted)', marginBottom: '1rem' }}>
          {hr
            ? 'CTA u START konceptu vodi na kontaktnu točku na istoj stranici.'
            : 'The START concept CTA points to an on-page contact anchor.'}
        </p>
        <a className="wa-carp-btn" href="mailto:demo@example.invalid">
          {hr ? 'Pošalji upit (demo adresa)' : 'Send inquiry (demo address)'}
        </a>
        <p className="wa-carp-note">{demo.packageNote[language]}</p>
      </section>
    </div>
  )
}
