import React from "react";
import LRCSection from "../components/LRCSection";
import { useSettings } from "../hooks/useSettings";
import { ErrorBoundary } from "../ErrorBoundary";
import FAQSection from "../sections/FAQSection";
import { AnimatedPage } from "../components/AnimatedPage";
import { PageSEO } from "../components/PageSEO";
import { useLrcWebshop } from "../hooks/useLrcWebshop";

interface LRCPageProps {
  language?: 'hr' | 'en';
  /** Local preview can keep the inquiry on a dev route. */
  inquiryPath?: string;
}

const LRCPage: React.FC<LRCPageProps> = ({ language = 'hr', inquiryPath = '/lrc/upit' }) => {
  const { settings, isLoading, error } = useSettings();
  const webshop = useLrcWebshop();
  const isFormEnabled =
    error === null &&
    settings !== null &&
    settings.is_lrc_form_enabled === true;

  return (
    <AnimatedPage>
      <PageSEO
        title="Ani's LRC — Lasersko rezanje, graviranje i radionice"
        description="Personalizirani pokloni i ručni radovi od drva, epoksidne smole, svile i stakla. Lasersko rezanje i graviranje u Ani's LRC studiju."
        canonical="/lrc"
      />
      <main className="min-h-screen min-w-0 bg-pearl text-plum dark:bg-[#070812] dark:text-pearl">
      {/* Detalji i upit ostaju. Kupnja ovisi o zasebnom prekidaču webshopa. */}
      <section className="pb-10 sm:pb-14">
        <div className="mx-auto max-w-6xl min-w-0">
          {isLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center px-4 py-10 sm:py-12">
              <p className="text-center text-sm leading-relaxed text-[--color-ink-muted] dark:text-pearl/70 sm:text-base">
                {language === 'hr' ? 'Učitavanje postavki prijava...' : 'Loading application settings...'}
              </p>
            </div>
          ) : (
            <LRCSection
              language={language}
              isFormEnabled={isFormEnabled}
              webshopEnabled={webshop.enabled}
              webshopUrl={webshop.webshopUrl}
              inquiryPath={inquiryPath}
            />
          )}
        </div>
      </section>

      {/* FAQ Section — subtle handoff from LRC content */}
      <ErrorBoundary name="FAQ">
        <div className="border-t border-[rgba(110,68,255,0.1)] dark:border-lavender/15">
          <FAQSection language={language} categories={['lrc']} />
        </div>
      </ErrorBoundary>
    </main>
    </AnimatedPage>
  );
};

export default LRCPage;
