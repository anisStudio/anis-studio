import { useEffect, useState } from 'react'
import { CONTACT_INFO } from '../config/contact'
import { handleCheckoutSuccess } from '../lib/stripe'

interface CheckoutSuccessProps {
  isOpen: boolean
  onClose: () => void
  language: 'hr' | 'en'
}

export default function CheckoutSuccess({ isOpen, onClose, language }: CheckoutSuccessProps) {
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      const processCheckout = async () => {
        try {
          const result = await handleCheckoutSuccess()
          setStatus(result)
        } catch (error) {
          setStatus({
            success: false,
            message: 'An error occurred while processing your payment.'
          })
        } finally {
          setLoading(false)
        }
      }

      processCheckout()
    }
  }, [isOpen])

  const content = {
    hr: {
      title: 'Hvala vam na kupnji!',
      subtitle: 'Vaša narudžba je uspješno obrađena.',
      message: 'Poslali smo vam potvrdu na email. Vaši proizvodi će biti pripremljeni i poslani u najkraćem mogućem roku.',
      continueShopping: 'Nastavi kupovinu',
      orderNumber: 'Broj narudžbe',
      estimatedDelivery: 'Procijenjena dostava',
      contactInfo: `Za pitanja o narudžbi kontaktirajte nas na ${CONTACT_INFO.email}`
    },
    en: {
      title: 'Thank you for your purchase!',
      subtitle: 'Your order has been successfully processed.',
      message: 'We have sent you a confirmation email. Your items will be prepared and shipped as soon as possible.',
      continueShopping: 'Continue Shopping',
      orderNumber: 'Order Number',
      estimatedDelivery: 'Estimated Delivery',
      contactInfo: `For questions about your order, contact us at ${CONTACT_INFO.email}`
    }
  }

  const t = content[language]

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      
      {/* Success Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          {loading ? (
            <div className="py-8">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Processing your payment...</p>
            </div>
          ) : status?.success ? (
            <>
              {/* Success Icon */}
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h2 className="text-2xl font-heading font-bold text-gray-900 mb-2">
                {t.title}
              </h2>
              
              <p className="text-gray-600 mb-6">
                {t.subtitle}
              </p>

              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600">{t.orderNumber}:</span>
                  <span className="text-sm font-mono text-gray-900">#AS-{Date.now().toString().slice(-6)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">{t.estimatedDelivery}:</span>
                  <span className="text-sm text-gray-900">5-7 business days</span>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                {t.message}
              </p>

              <p className="text-xs text-gray-500 mb-6">
                {t.contactInfo}
              </p>

              <button
                onClick={onClose}
                className="w-full btn btn-primary"
              >
                {t.continueShopping}
              </button>
            </>
          ) : (
            <>
              {/* Error Icon */}
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>

              <h2 className="text-2xl font-heading font-bold text-gray-900 mb-2">
                Payment Error
              </h2>
              
              <p className="text-gray-600 mb-6">
                {status?.message || 'An unexpected error occurred.'}
              </p>

              <button
                onClick={onClose}
                className="w-full btn btn-secondary"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}