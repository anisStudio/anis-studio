import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import CartDrawer from './components/CartDrawer'
import { PublicServiceGuard } from './components/PublicServiceGuard'
import { RouteFallback } from './components/RouteFallback'
import { useCart } from './lib/cart.store'
import { ErrorBoundary } from './ErrorBoundary'
import LoginModal from './components/LoginModal'
import RegisterModal from './components/RegisterModal'
import { useGlobalScrollAnimations } from './hooks/useGlobalScrollAnimations'
import { useThemeStore } from './lib/theme.store'
import MainLayout from './layouts/MainLayout'
import AdminLayout from './layouts/AdminLayout'
import HomePage from './pages/HomePage'
import AdminRoute from './components/AdminRoute'
import { AdminAuthProvider } from './providers/AdminAuthProvider'
import CookieBanner from './components/CookieBanner'

const LRCPage = lazy(() => import('./pages/LRCPage'))
const LrcInquiryPage = lazy(() => import('./pages/LrcInquiryPage'))
const InterijeriPage = lazy(() => import('./pages/InterijeriPage'))
const InterijeriClientsPage = lazy(() => import('./pages/InterijeriClientsPage'))
const InterijeriStolariPage = lazy(() => import('./pages/InterijeriStolariPage'))
const WebAtelierPage = lazy(() => import('./pages/WebAtelierPage'))
const WebAtelierInquiryPage = lazy(() => import('./pages/WebAtelierInquiryPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const FAQPage = lazy(() => import('./pages/FAQPage'))
const CjeniciPage = lazy(() => import('./pages/CjeniciPage'))
const CjeniciInterijeriPage = lazy(() => import('./pages/CjeniciInterijeriPage'))
const PublicProjectVrPage = lazy(() => import('./pages/PublicProjectVrPage'))

const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'))
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage'))
const AdminLrcInquiriesPage = lazy(() => import('./pages/AdminLrcInquiriesPage'))
const AdminInteriorsProjectsPage = lazy(() => import('./pages/AdminInteriorsProjectsPage'))
const AdminInteriorsProjectDetailPage = lazy(
  () => import('./pages/AdminInteriorsProjectDetailPage')
)
const AdminPortfolioPage = lazy(() => import('./pages/AdminPortfolioPage'))
const AdminReviewsPage = lazy(() => import('./pages/AdminReviewsPage'))
const OstaviRecenzijuPage = lazy(() => import('./pages/OstaviRecenzijuPage'))
const PolitikaPrivatnostiPage = lazy(() => import('./pages/PolitikaPrivatnostiPage'))
const StarlinkHrvatskaPage = lazy(() => import('./pages/StarlinkHrvatskaPage'))

// Routes component with AnimatePresence
function AnimatedRoutes({
  language,
  cartCount,
  onLanguageChange,
  onCartClick
}: {
  language: 'hr' | 'en'
  cartCount: number
  onLanguageChange: (lang: 'hr' | 'en') => void
  onCartClick: () => void
}) {
  const location = useLocation()
  // Avoid remounting the whole route tree between admin URLs (better dashboard UX).
  // Public URLs still key by pathname so AnimatePresence + page exits behave as before.
  const routeKey = location.pathname.startsWith('/admin') ? '/admin' : location.pathname

  // Scroll restoration on route change.
  // - No hash → instant scroll to top so form pages open at the beginning.
  // - Hash present → let the hash target scroll into view (e.g. /#portfolio).
  useEffect(() => {
    const { hash } = location
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    } else {
      const id = hash.replace('#', '')
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'start' })
      }
    }
  }, [location.pathname, location.hash])

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location} key={routeKey}>
          <Route
            element={
              <MainLayout
                language={language}
                onLanguageChange={onLanguageChange}
                cartItemCount={cartCount}
                onCartClick={onCartClick}
              />
            }
          >
            <Route path="/" element={<HomePage language={language} />} />
            <Route
              path="/lrc"
              element={
                <PublicServiceGuard service="lrc" language={language}>
                  <Outlet />
                </PublicServiceGuard>
              }
            >
              <Route index element={<LRCPage language={language} />} />
              <Route path="upit" element={<LrcInquiryPage language={language} />} />
            </Route>
            <Route
              path="/interijeri/klijenti"
              element={<InterijeriClientsPage language={language} />}
            />
            <Route
              path="/interijeri/stolari"
              element={<InterijeriStolariPage language={language} />}
            />
            <Route path="/interijeri" element={<InterijeriPage language={language} />} />
            <Route
              path="/web-atelier"
              element={
                <PublicServiceGuard service="webAtelier" language={language}>
                  <Outlet />
                </PublicServiceGuard>
              }
            >
              <Route index element={<WebAtelierPage language={language} />} />
              <Route path="upit" element={<WebAtelierInquiryPage language={language} />} />
            </Route>
            <Route path="/o-nama" element={<AboutPage language={language} />} />
            <Route path="/kontakt" element={<ContactPage language={language} />} />
            <Route path="/faq" element={<FAQPage language={language} />} />
            <Route
              path="/cjenici/interijeri"
              element={<CjeniciInterijeriPage language={language} />}
            />
            <Route path="/cjenici" element={<CjeniciPage language={language} />} />
            <Route path="/vr/:projectId" element={<PublicProjectVrPage />} />
            <Route
              path="/ostavi-recenziju"
              element={<OstaviRecenzijuPage language={language} />}
            />
            <Route
              path="/politika-privatnosti"
              element={<PolitikaPrivatnostiPage language={language} />}
            />
            <Route
              path="/starlink-hrvatska"
              element={<StarlinkHrvatskaPage language={language} />}
            />
          </Route>

          {/* Admin routes - no public header/footer; login outside persistent shell */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="lrc-inquiries" element={<AdminLrcInquiriesPage />} />
            <Route path="interiors-projects" element={<AdminInteriorsProjectsPage />} />
            <Route path="interiors-projects/:id" element={<AdminInteriorsProjectDetailPage />} />
            <Route path="portfolio" element={<AdminPortfolioPage />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </AnimatePresence>
  )
}

export default function App() {
  const { initializeTheme } = useThemeStore()

  const [language, setLanguage] = useState<'hr' | 'en'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('language') as 'hr' | 'en') || 'hr'
    }
    return 'hr'
  })
  const [isCartOpen, setIsCartOpen] = useState(false)
  const cartCount = useCart(s => s.totalQty)

  // Globalni scroll animacije
  useGlobalScrollAnimations()

  // Initialize theme on app mount
  useEffect(() => {
    initializeTheme()
  }, [initializeTheme])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', language)
    }
  }, [language])

  return (
    <div className="min-h-screen">
      {/* Toast Notifications */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(110, 68, 255, 0.2)',
            borderRadius: '1rem',
            boxShadow: '0 8px 32px rgba(110, 68, 255, 0.15)',
            color: 'var(--color-ink)',
            fontFamily: 'Inter, sans-serif',
          },
          success: {
            iconTheme: {
              primary: '#6E44FF',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* Development warning banner when Supabase is not configured */}
      {/* Banner sakriven jer je fixed i prikazuje se na svim stranicama */}
      {/* {import.meta.env.DEV && !isSupabaseConfigured && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-3 text-center text-sm shadow-lg">
          <strong>⚠️ Development Mode:</strong> Supabase not configured. Check .env.local file. Forms will use fallback mode.
        </div>
      )} */}

      <BrowserRouter>
        <CookieBanner language={language} />
        <AdminAuthProvider>
          <AnimatedRoutes
            language={language}
            cartCount={cartCount}
            onLanguageChange={setLanguage}
            onCartClick={() => setIsCartOpen(true)}
          />

          <ErrorBoundary name="CartDrawer">
            <CartDrawer
              isOpen={isCartOpen}
              onClose={() => setIsCartOpen(false)}
              language={language}
            />
          </ErrorBoundary>

          {/* Auth Modals */}
          <ErrorBoundary name="LoginModal">
            <LoginModal language={language} />
          </ErrorBoundary>
          <ErrorBoundary name="RegisterModal">
            <RegisterModal language={language} />
          </ErrorBoundary>
        </AdminAuthProvider>
      </BrowserRouter>
    </div>
  )
}
