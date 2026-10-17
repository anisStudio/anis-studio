import { Link } from 'react-router-dom'
import {
  demoBannerText,
  type WebAtelierDemoDefinition,
} from '../../lib/webAtelierDemos'
import './webAtelierDemos.css'

interface WebAtelierDemoChromeProps {
  language: 'hr' | 'en'
  demo: WebAtelierDemoDefinition
}

export function WebAtelierDemoChrome({ language, demo }: WebAtelierDemoChromeProps) {
  const back = language === 'hr' ? 'Natrag na Web Atelier' : 'Back to Web Atelier'
  const cfg = language === 'hr' ? 'Otvori konfigurator' : 'Open configurator'
  const upit = language === 'hr' ? 'Upit za sličan projekt' : 'Inquire about a similar project'

  return (
    <>
      <div className="wa-demo-banner" role="status">
        <strong>{demoBannerText(language)}</strong>
        <Link to="/web-atelier">{back}</Link>
      </div>
      <div className="wa-demo-chrome">
        <span className="wa-demo-chip">{demo.accentLabel[language]}</span>
        <Link to="/web-atelier#web-atelier-configurator">{cfg}</Link>
        <Link to={`/web-atelier/upit?paket=${demo.packageTier}`}>{upit}</Link>
      </div>
    </>
  )
}
