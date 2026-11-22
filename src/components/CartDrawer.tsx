import { motion, AnimatePresence } from 'framer-motion'
import { useCart } from '../lib/cart.store'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  language: 'hr' | 'en'
}

export default function CartDrawer({
  isOpen,
  onClose,
  language
}: CartDrawerProps) {
  const { items, totalPrice, removeItem, setQty } = useCart()
  const translations = {
    title: {
      hr: 'Košarica',
      en: 'Shopping Cart'
    },
    empty: {
      hr: 'Vaša košarica je prazna',
      en: 'Your cart is empty'
    },
    continueShopping: {
      hr: 'Nastavi kupovinu',
      en: 'Continue Shopping'
    },
    subtotal: {
      hr: 'Međuzbroj',
      en: 'Subtotal'
    },
    payWithStripe: {
      hr: 'Kupi putem Stripe-a',
      en: 'Pay with Stripe'
    },
    paymentNote: {
      hr: 'Plaćanja obrađena sigurno preko Stripe-a (test način).',
      en: 'Payments processed securely via Stripe (test mode).'
    },
    remove: {
      hr: 'Ukloni',
      en: 'Remove'
    }
  }

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem(itemId)
    } else {
      setQty(itemId, newQuantity)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999,
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)'
            }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="flex max-h-[100dvh] min-h-0 w-full max-w-[min(400px,100vw)] flex-col text-[var(--clr-text)] shadow-[var(--shadow-xl)] dark:text-pearl"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              background: 'var(--clr-glass)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 1000,
            }}
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4 sm:px-5"
              style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
            >
              <h2 style={{
                fontSize: 'var(--text-xl)',
                fontWeight: '600',
                margin: 0,
                color: 'var(--clr-text)'
              }}>
                {translations.title[language]}
              </h2>
              
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg text-[var(--clr-text)] hover:bg-white/10"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
                aria-label={language === 'hr' ? 'Zatvori košaricu' : 'Close cart'}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12"></path>
                </svg>
              </motion.button>
            </div>

            {/* Content */}
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {items.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                  style={{
                    padding: 'var(--space-4xl) var(--space-lg)',
                    color: 'var(--clr-text-light)'
                  }}
                >
                  <div style={{
                    fontSize: 'var(--text-4xl)',
                    marginBottom: 'var(--space-lg)'
                  }}>
                    🛒
                  </div>
                  <p style={{
                    fontSize: 'var(--text-lg)',
                    marginBottom: 'var(--space-xl)'
                  }}>
                    {translations.empty[language]}
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClose}
                    style={{
                      background: 'var(--gradient-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--space-md) var(--space-xl)',
                      fontSize: 'var(--text-base)',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {translations.continueShopping[language]}
                  </motion.button>
                </motion.div>
              ) : (
                <div className="flex flex-col gap-4">
                  {items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="glass-panel flex flex-col gap-3 rounded-xl border border-white/10 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4"
                    >
                      <div className="flex min-w-0 flex-1 gap-3">
                        {/* Product Image */}
                        <div
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-2xl sm:h-[60px] sm:w-[60px]"
                          style={{
                            background:
                              'var(--gradient-epoxy, linear-gradient(135deg, rgba(189,166,255,0.35) 0%, rgba(110,68,255,0.25) 100%))',
                          }}
                        >
                          {item.imageUrl || '🎨'}
                        </div>

                        {/* Product Info */}
                        <div className="min-w-0 flex-1">
                          <h4 className="line-clamp-2 text-sm font-semibold text-[var(--clr-text)] sm:text-base sm:line-clamp-1 sm:truncate">
                            {item.title}
                          </h4>
                          <p className="mt-0.5 text-sm text-[var(--clr-text-light)]">
                            €{item.price.toFixed(2)} × {item.qty}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 sm:w-auto sm:justify-end sm:border-0 sm:pt-0">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2">
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleQuantityChange(item.id, item.qty - 1)}
                            className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-md border border-[rgba(110,68,255,0.25)] bg-[rgba(110,68,255,0.1)] text-sm font-semibold text-[var(--clr-primary)]"
                            aria-label={language === 'hr' ? 'Smanji količinu' : 'Decrease quantity'}
                          >
                            −
                          </motion.button>
                          <span className="min-w-[1.5rem] text-center text-sm font-semibold text-[var(--clr-text)]">
                            {item.qty}
                          </span>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleQuantityChange(item.id, item.qty + 1)}
                            className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-md border border-[rgba(110,68,255,0.25)] bg-[rgba(110,68,255,0.1)] text-sm font-semibold text-[var(--clr-primary)]"
                            aria-label={language === 'hr' ? 'Povećaj količinu' : 'Increase quantity'}
                          >
                            +
                          </motion.button>
                        </div>

                        {/* Remove Button */}
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => removeItem(item.id)}
                          className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-md p-2 text-[var(--clr-text-light)] hover:bg-white/10"
                          title={translations.remove[language]}
                          aria-label={translations.remove[language]}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                          </svg>
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="shrink-0 border-t border-white/10 bg-white/5 px-4 py-4 sm:px-5"
                style={{
                  paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
                }}
              >
                {/* Subtotal */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--space-lg)'
                }}>
                  <span style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: '600',
                    color: 'var(--clr-text)'
                  }}>
                    {translations.subtotal[language]}:
                  </span>
                  <span style={{
                    fontSize: 'var(--text-xl)',
                    fontWeight: '700',
                    color: 'var(--clr-primary)'
                  }}>
                    €{totalPrice.toFixed(2)}
                  </span>
                </div>

                {/* Payment Note */}
                <p style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--clr-text-light)',
                  textAlign: 'center',
                  marginBottom: 'var(--space-lg)',
                  lineHeight: 'var(--leading-relaxed)'
                }}>
                  {translations.paymentNote[language]}
                </p>

                {/* Checkout Button */}
                <motion.button
                  className="public-action"
                  onClick={() => alert('Checkout functionality coming soon!')}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-lg)',
                    fontSize: 'var(--text-lg)',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-lg)'
                  }}
                >
                  {translations.payWithStripe[language]}
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}