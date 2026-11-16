import WebAtelierPage from './WebAtelierPage'

interface WebAtelierDevPagePreviewProps {
  language: 'hr' | 'en'
}

/**
 * Local development view of the current Web Atelier page.
 * Registered only when import.meta.env.DEV is true.
 * Inquiry, review, and demo links that open real forms stay inactive.
 */
export default function WebAtelierDevPagePreview({ language }: WebAtelierDevPagePreviewProps) {
  return (
    <>
      <p className="bg-white/80 px-4 py-2 text-center text-xs text-plum/70 dark:bg-black/20 dark:text-pearl/70">
        {language === 'hr'
          ? 'DEV pregled — nije javno objavljeno'
          : 'DEV preview — not publicly published'}
      </p>
      <WebAtelierPage language={language} enableInquiryLinks={false} />
    </>
  )
}
