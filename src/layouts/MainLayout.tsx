import { Outlet } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { ErrorBoundary } from '../ErrorBoundary'

interface MainLayoutProps {
  language: 'hr' | 'en'
  onLanguageChange: (lang: 'hr' | 'en') => void
  cartItemCount: number
  onCartClick: () => void
}

const MainLayout: React.FC<MainLayoutProps> = ({
  language,
  onLanguageChange,
  cartItemCount,
  onCartClick,
}) => {
  return (
    <div className="public-site">
      <ErrorBoundary name="Header">
        <Header
          language={language}
          onLanguageChange={onLanguageChange}
          cartItemCount={cartItemCount}
          onCartClick={onCartClick}
        />
      </ErrorBoundary>

      <Outlet />

      <ErrorBoundary name="Footer">
        <Footer language={language} />
      </ErrorBoundary>
    </div>
  )
}

export default MainLayout

