import { useEffect, useState } from 'react'
import type { WebAtelierDemoDefinition } from '../../../lib/webAtelierDemos'
import {
  interiorsStudioConfig,
  type InteriorDemoProject,
} from './config'
import './interiorsStudioDemo.css'

interface Props {
  language: 'hr' | 'en'
  demo: WebAtelierDemoDefinition
}

function ProjectDetails({
  language,
  project,
  onClose,
}: {
  language: 'hr' | 'en'
  project: InteriorDemoProject
  onClose: () => void
}) {
  const hr = language === 'hr'

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      className="wa-int-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="wa-int-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`wa-int-project-${project.id}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="wa-int-close" onClick={onClose}>
          {hr ? 'Zatvori detalj' : 'Close details'}
        </button>
        <p className="wa-int-kicker">{project.type[language]}</p>
        <h2 id={`wa-int-project-${project.id}`}>{project.title[language]}</h2>

        <div className="wa-int-detail-gallery">
          {project.photos.map((photo) => (
            <img key={photo.src} src={photo.src} alt={photo.alt[language]} />
          ))}
        </div>

        <div className="wa-int-detail-copy">
          <div>
            <h3>{hr ? 'Opis izvedbe' : 'Execution notes'}</h3>
            <p>{project.execution[language]}</p>
          </div>
          <div>
            <h3>{hr ? 'Materijali i detalji' : 'Materials and details'}</h3>
            <ul>
              {project.materials.map((material) => (
                <li key={material.hr}>{material[language]}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="wa-int-rights">{interiorsStudioConfig.imageRightsNote[language]}</p>
      </section>
    </div>
  )
}

export function InteriorsStudioDemo({ language, demo }: Props) {
  const hr = language === 'hr'
  const [selectedProject, setSelectedProject] = useState<InteriorDemoProject | null>(null)

  return (
    <div className="wa-int">
      <header className="wa-int-nav">
        <div>
          <strong>{interiorsStudioConfig.brand}</strong>
          <span>{interiorsStudioConfig.tagline[language]}</span>
        </div>
        <nav aria-label={hr ? 'Navigacija studija' : 'Studio navigation'}>
          <a href="#projekti">{hr ? 'Projekti' : 'Projects'}</a>
          <a href="#pristup">{hr ? 'Pristup' : 'Approach'}</a>
          <a href="#kontakt">{hr ? 'Kontakt' : 'Contact'}</a>
        </nav>
      </header>

      <section className="wa-int-hero" aria-labelledby="wa-int-hero-title">
        <div className="wa-int-hero-copy">
          <p className="wa-int-kicker">{hr ? 'Studio interijera · PREMIUM demo' : 'Interior studio · PREMIUM demo'}</p>
          <h1 id="wa-int-hero-title">
            {hr ? 'Prostori koji djeluju mirno, a rade pametno' : 'Spaces that feel calm and work beautifully'}
          </h1>
          <p>
            {hr
              ? 'Fiktivni studio za interijere i namještaj po mjeri. Koncept pokazuje projektni portfolio, detaljne studije i prezentaciju materijala.'
              : 'A fictional interiors and bespoke furniture studio. This concept demonstrates a project portfolio, detailed case studies, and material presentation.'}
          </p>
          <a href="#projekti" className="wa-int-primary">
            {hr ? 'Pogledaj projekte' : 'View projects'}
          </a>
        </div>
        <img
          src="/images/interijeri/kitchen-advanced.webp"
          alt={hr ? 'Premium demo interijer kuhinje s otokom' : 'Premium demo kitchen interior with an island'}
        />
      </section>

      <section id="projekti" className="wa-int-section" aria-labelledby="wa-int-projects">
        <header className="wa-int-section-heading">
          <p className="wa-int-kicker">{hr ? 'Odabrani radovi' : 'Selected work'}</p>
          <h2 id="wa-int-projects">{hr ? 'Projekti s pričom i materijalima' : 'Projects with story and material depth'}</h2>
        </header>
        <div className="wa-int-project-grid">
          {interiorsStudioConfig.projects.map((project) => (
            <article key={project.id} className="wa-int-project-card">
              <img src={project.cover} alt={project.title[language]} />
              <div>
                <p className="wa-int-kicker">{project.type[language]}</p>
                <h3>{project.title[language]}</h3>
                <p>{project.summary[language]}</p>
                <button type="button" onClick={() => setSelectedProject(project)}>
                  {hr ? 'Otvori detalj projekta' : 'Open project details'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="pristup" className="wa-int-approach" aria-labelledby="wa-int-approach">
        <p className="wa-int-kicker">{hr ? 'Način rada' : 'Approach'}</p>
        <h2 id="wa-int-approach">{hr ? 'Od razgovora do izvedivog koncepta' : 'From conversation to a buildable concept'}</h2>
        <div>
          <article><strong>01</strong><span>{hr ? 'Smjer i potrebe prostora' : 'Direction and spatial needs'}</span></article>
          <article><strong>02</strong><span>{hr ? 'Raspored, volumeni i materijali' : 'Layout, volumes, and materials'}</span></article>
          <article><strong>03</strong><span>{hr ? 'Prezentacija za jasnu odluku' : 'Presentation for a clear decision'}</span></article>
        </div>
      </section>

      <section id="kontakt" className="wa-int-contact" aria-labelledby="wa-int-contact">
        <p className="wa-int-kicker">{hr ? 'Kontakt' : 'Contact'}</p>
        <h2 id="wa-int-contact">{hr ? 'Imate prostor koji traži dobar plan?' : 'Does your space need a clear plan?'}</h2>
        <p>{hr ? 'Podaci su fiktivni i služe samo demonstraciji PREMIUM predloška.' : 'These details are fictional and only demonstrate the PREMIUM template.'}</p>
        <a href={`mailto:${interiorsStudioConfig.contact.email}`}>{interiorsStudioConfig.contact.email}</a>
        <span>{interiorsStudioConfig.contact.phone}</span>
        <p className="wa-int-package-note">{demo.packageNote[language]}</p>
      </section>

      {selectedProject ? (
        <ProjectDetails
          language={language}
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      ) : null}
    </div>
  )
}
