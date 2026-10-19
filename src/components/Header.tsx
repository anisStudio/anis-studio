import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicDepartmentVisibility } from '../hooks/usePublicDepartmentVisibility'
import { useAuth } from '../providers/AuthProvider'
import { ThemeToggle } from './ThemeToggle'

interface HeaderProps {
  language: 'hr' | 'en'
  onLanguageChange: (lang: 'hr' | 'en') => void
  cartItemCount: number
  onCartClick: () => void
}

type NavKey = 'lrc' | 'interiors' | 'webAtelier' | 'about' | 'faq' | 'contact'

/**
 * Order and static links: about / faq / contact use `visible` in the header.
 * LRC, Interijeri, Web Atelier visibility comes from central public flags
 * (fail closed until settings are ready).
 */
const PUBLIC_HEADER_NAV_ITEMS: { key: NavKey; visible: boolean }[] = [
  { key: 'lrc', visible: false },
  { key: 'interiors', visible: false },
  { key: 'webAtelier', visible: false },
  { key: 'about', visible: true },
  { key: 'faq', visible: true },
  { key: 'contact', visible: true },
]

const NAV_ROUTES: Record<NavKey, string> = {
  lrc: '/lrc',
  interiors: '/interijeri',
  webAtelier: '/web-atelier',
  about: '/o-nama',
  contact: '/kontakt',
  faq: '/faq',
}

export default function Header({ language, onLanguageChange, cartItemCount, onCartClick }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const serviceVisibility = usePublicDepartmentVisibility()
  const { isAuthenticated, logout } = useAuth()

  const visibleHeaderNavKeys = PUBLIC_HEADER_NAV_ITEMS.filter((item) => {
    switch (item.key) {
      case 'lrc':
        return serviceVisibility.lrc
      case 'interiors':
        return serviceVisibility.interiors
      case 'webAtelier':
        return serviceVisibility.webAtelier
      default:
        return item.visible
    }
  }).map((item) => item.key)

  const navigation = {
    hr: {
      lrc: 'LRC',
      interiors: 'Interijeri',
      webAtelier: 'Web Atelier',
      about: 'O nama',
      contact: 'Kontakt',
      faq: 'Česta pitanja'
    },
    en: {
      lrc: 'LRC',
      interiors: 'Interiors',
      webAtelier: 'Web Atelier',
      about: 'About',
      contact: 'Contact',
      faq: 'FAQ'
    }
  }

  const authLabels = {
    hr: { logout: 'Odjava' },
    en: { logout: 'Logout' },
  }

  return (
    <header className="sticky top-0 z-50 overflow-x-clip header-glass text-plum dark:text-pearl">
      <nav className="mx-auto max-w-7xl min-w-0 px-3 sm:px-6 md:px-8 flex items-center justify-between gap-1.5 sm:gap-3 py-2 sm:py-2.5">
        {/* Logo */}
        <Link
          to="/"
          className="group/logo flex min-w-0 shrink items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amethyst/40 dark:focus-visible:ring-lavender/40"
        >
          <span
            className="inline-block transition-[transform,filter] duration-300 ease-out group-hover/logo:-translate-y-px group-focus-visible/logo:-translate-y-px group-hover/logo:drop-shadow-[0_10px_28px_rgba(110,68,255,0.22)] group-focus-visible/logo:drop-shadow-[0_10px_28px_rgba(110,68,255,0.22)] dark:group-hover/logo:drop-shadow-[0_12px_32px_rgba(189,166,255,0.14)] dark:group-focus-visible/logo:drop-shadow-[0_12px_32px_rgba(189,166,255,0.14)] [@media(prefers-reduced-motion:reduce)]:!translate-y-0 [@media(prefers-reduced-motion:reduce)]:transition-none [@media(prefers-reduced-motion:reduce)]:drop-shadow-none [@media(prefers-reduced-motion:reduce)]:group-hover/logo:drop-shadow-none [@media(prefers-reduced-motion:reduce)]:group-focus-visible/logo:drop-shadow-none"
          >
            <img
              src="/logo-reference-purple.png"
              alt="Ani's Studio"
              width={320}
              height={132}
              decoding="async"
              className="block h-12 w-auto max-w-[min(100%,320px)] object-contain object-left sm:h-[3.25rem] md:h-[3.75rem] lg:h-[4.25rem] lg:max-w-[400px]"
            />
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex flex-1 min-w-0 items-center justify-center gap-4 lg:gap-6 px-2">
          {visibleHeaderNavKeys.map((key) => {
            return (
              <Link
                key={key}
                to={NAV_ROUTES[key]}
                className="relative text-sm font-medium py-2 transition-colors duration-200 text-plum/90 dark:text-pearl/90 hover:text-amethyst dark:hover:text-lavender"
              >
                <span className="after:absolute after:-bottom-0.5 after:left-0 after:h-[2px] after:w-0 after:bg-[--color-primary] after:transition-[width] after:duration-300 hover:after:w-full">
                  {navigation[language][key]}
                </span>
              </Link>
            )
          })}
        </div>

        {/* Right side - Auth, Cart, Language */}
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-2.5 md:gap-3">
          {/* Logout — desktop; Prijava/Registracija nisu na javnom headeru */}
          {isAuthenticated ? (
            <button
              onClick={logout}
              className="hidden sm:block px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-lg hover:bg-[rgba(110,68,255,0.05)] dark:hover:bg-[rgba(110,68,255,0.15)] text-plum/90 dark:text-pearl/90 hover:text-amethyst dark:hover:text-lavender"
              aria-label={authLabels[language].logout}
            >
              {authLabels[language].logout}
            </button>
          ) : null}

          {/* Cart Button - Elegant Design */}
          <button 
            onClick={onCartClick} 
            className="relative group p-2 sm:p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center transition-all duration-300 rounded-xl hover:bg-gradient-to-br hover:from-[rgba(110,68,255,0.08)] hover:to-[rgba(189,166,255,0.08)] dark:hover:from-[rgba(110,68,255,0.15)] dark:hover:to-[rgba(189,166,255,0.15)] hover:shadow-md hover:scale-105 active:scale-95 hover:-translate-y-0.5 text-plum/90 dark:text-pearl/90" 
            aria-label={language === 'hr' ? 'Košarica' : 'Shopping cart'}
            style={{
              background: cartItemCount > 0 ? 'linear-gradient(135deg, rgba(110,68,255,0.06) 0%, rgba(189,166,255,0.06) 100%)' : 'transparent'
            }}
          >
            {/* Shopping Cart Icon - Elegant Design */}
            <svg 
              className="w-5 h-5 sm:w-6 sm:h-6 transition-all duration-300 group-hover:scale-110 group-hover:text-[--color-primary] cart-icon-float" 
              fill="none" 
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              {/* Shopping Cart Body */}
              <path 
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.4 2.925-6.346a48.524 48.524 0 00-8.563-1.593M12 3v6m0 0v6m0-6h6m-6 0H6"
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="group-hover:stroke-[--color-primary] transition-colors duration-300"
                style={{ stroke: 'currentColor', opacity: 0.7 }}
              />
              
              {/* Cart Wheels - Left */}
              <g className="cart-wheel-left">
                <circle 
                  cx="7" 
                  cy="20" 
                  r="2.2" 
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="group-hover:stroke-[--color-primary] transition-colors duration-300 cart-wheel"
                  style={{ opacity: 0.6 }}
                />
                <circle 
                  cx="7" 
                  cy="20" 
                  r="0.8" 
                  fill="currentColor"
                  className="group-hover:fill-[--color-primary] transition-colors duration-300"
                  style={{ opacity: 0.7 }}
                />
              </g>
              
              {/* Cart Wheels - Right */}
              <g className="cart-wheel-right">
                <circle 
                  cx="17" 
                  cy="20" 
                  r="2.2" 
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="group-hover:stroke-[--color-primary] transition-colors duration-300 cart-wheel"
                  style={{ opacity: 0.6 }}
                />
                <circle 
                  cx="17" 
                  cy="20" 
                  r="0.8" 
                  fill="currentColor"
                  className="group-hover:fill-[--color-primary] transition-colors duration-300"
                  style={{ opacity: 0.7 }}
                />
              </g>
              
              {/* Animated Items in Cart - Subtle */}
              {cartItemCount > 0 && (
                <>
                  <circle cx="9" cy="10" r="1.2" fill="currentColor" className="cart-item-1" style={{ opacity: 0.6 }} />
                  <circle cx="13" cy="9" r="1.2" fill="currentColor" className="cart-item-2" style={{ opacity: 0.6 }} />
                  <circle cx="16" cy="11" r="1.2" fill="currentColor" className="cart-item-3" style={{ opacity: 0.6 }} />
                </>
              )}
            </svg>
            
            {/* Badge - Elegant Design */}
            {cartItemCount > 0 && (
              <span 
                className="absolute -top-1 -right-1 min-w-[20px] h-[20px] flex items-center justify-center px-1.5 text-[10px] font-extrabold text-white rounded-full transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg animate-cart-badge z-10"
                style={{
                  background: "linear-gradient(135deg, #FF6B6B 0%, #FF4757 100%)",
                  boxShadow: "0 2px 8px rgba(255, 71, 87, 0.4), 0 0 0 2px rgba(255, 255, 255, 0.9)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            )}
            
            {/* Subtle Pulse effect */}
            {cartItemCount > 0 && (
              <span 
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 cart-pulse"
                style={{
                  background: "radial-gradient(circle, rgba(110, 68, 255, 0.12) 0%, transparent 70%)",
                }}
              />
            )}
          </button>

          {/* Theme Toggle */}
          <div className="hidden min-[360px]:block">
            <ThemeToggle />
          </div>

          {/* Language Toggle */}
          <div
            className="hidden min-[360px]:flex items-center backdrop-blur-sm dark:bg-white/5 bg-white/60"
            style={{
              borderRadius: "12px",
              padding: "3px",
              gap: "4px",
              border: "1px solid rgba(110, 68, 255, 0.15)",
            }}
          >
            {(["hr", "en"] as const).map((lng) => (
              <button
                key={lng}
                onClick={() => onLanguageChange(lng)}
                className="sm:px-4 sm:py-1.5 sm:text-sm"
                style={{
                  padding: "5px 12px",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                  transition: "all 200ms ease",
                  border: "none",
                  cursor: "pointer",
                  background: language === lng ? "linear-gradient(135deg, #BDA6FF 0%, #6E44FF 100%)" : "transparent",
                  boxShadow: language === lng ? "0 2px 8px rgba(110, 68, 255, 0.3)" : "none",
                }}
                aria-label={language === lng ? (language === 'hr' ? 'Odabran hrvatski' : 'Selected English') : (lng === 'hr' ? 'Prebaci na hrvatski' : 'Switch to English')}
                aria-pressed={language === lng}
              >
                <span
                  className={
                    language === lng
                      ? "text-sm font-semibold text-white"
                      : "text-sm font-semibold text-plum/90 dark:text-pearl/80"
                  }
                >
                  {lng.toUpperCase()}
                </span>
              </button>
            ))}
          </div>

          {/* Mobile Menu Button - Touch-friendly */}
          <button 
            onClick={() => setIsMobileMenuOpen((v) => !v)} 
            className="md:hidden mobile-menu-button shrink-0 p-2.5 active:scale-95 transition-all rounded-lg hover:bg-[rgba(110,68,255,0.05)] dark:hover:bg-[rgba(110,68,255,0.15)] active:bg-[rgba(110,68,255,0.1)] dark:active:bg-[rgba(110,68,255,0.2)] text-plum/90 dark:text-pearl/90 hover:text-amethyst dark:hover:text-lavender" 
            aria-label={language === 'hr' ? 'Otvorite meni' : 'Toggle menu'}
            aria-expanded={isMobileMenuOpen}
            style={{ minWidth: '48px', minHeight: '48px' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Navigation - Touch-friendly */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t py-3 sm:py-4 backdrop-blur-sm dark:backdrop-blur-none mobile-menu-enter border-[rgba(110,68,255,0.12)] dark:border-lavender/25 bg-pearl/95 dark:bg-[#070812] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <nav className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 flex flex-col gap-2 text-plum dark:text-pearl">
            {visibleHeaderNavKeys.map((key) => {
              return (
                <Link
                  key={key}
                  to={NAV_ROUTES[key]}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="mobile-menu-item text-left px-3 py-2.5 active:bg-[rgba(110,68,255,0.05)] dark:active:bg-[rgba(110,68,255,0.2)] transition-all rounded-lg font-medium text-plum/90 dark:text-pearl hover:text-amethyst dark:hover:text-lavender active:text-amethyst dark:active:text-lavender"
                  style={{ minHeight: '48px' }}
                >
                  {navigation[language][key]}
                </Link>
              )
            })}
            {isAuthenticated ? (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false)
                  logout()
                }}
                className="mobile-menu-item text-left px-3 py-2.5 sm:px-4 sm:py-3 text-sm font-medium pt-3 sm:pt-4 border-t mt-1 border-[rgba(110,68,255,0.12)] dark:border-lavender/25 active:bg-[rgba(110,68,255,0.05)] dark:active:bg-[rgba(110,68,255,0.2)] transition-all rounded-lg text-plum/90 dark:text-pearl hover:text-amethyst dark:hover:text-lavender active:text-amethyst dark:active:text-lavender"
                style={{ minHeight: '48px' }}
              >
                {authLabels[language].logout}
              </button>
            ) : null}
          </nav>
        </div>
      )}

      <style>{`
        .cart-icon-float {
          transform-origin: center;
        }
        
        .group:hover .cart-icon-float {
          animation: cart-float 2s ease-in-out infinite;
        }
        
        @keyframes cart-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-2px) rotate(2deg); }
        }
        
        .cart-wheel {
          transform-origin: center;
          animation: wheel-rotate 1.5s linear infinite;
          animation-play-state: paused;
        }
        
        .group:hover .cart-wheel {
          animation-play-state: running;
        }
        
        @keyframes wheel-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .cart-item-1 {
          animation: item-bounce 1.8s ease-in-out infinite;
          animation-delay: 0s;
        }
        
        .cart-item-2 {
          animation: item-bounce 1.8s ease-in-out infinite;
          animation-delay: 0.4s;
        }
        
        .cart-item-3 {
          animation: item-bounce 1.8s ease-in-out infinite;
          animation-delay: 0.8s;
        }
        
        @keyframes item-bounce {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
          50% { transform: translateY(-2px) scale(1.05); opacity: 0.7; }
        }
        
        @keyframes cart-badge-bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        
        @keyframes cart-pulse {
          75%, 100% { transform: scale(1.5); opacity: 0; }
        }
        
        .animate-cart-badge {
          animation: cart-badge-bounce 0.6s ease-out;
        }
        
        .cart-pulse {
          animation: cart-pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        
        @media (prefers-reduced-motion: reduce) {
          .cart-icon-float,
          .cart-wheel,
          .cart-item-1,
          .cart-item-2,
          .cart-item-3,
          .animate-cart-badge,
          .cart-pulse {
            animation: none !important;
          }
        }
      `}</style>
    </header>
  )
}