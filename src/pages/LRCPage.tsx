import React from "react";
import LRCSection from "../components/LRCSection";
import { useSettings } from "../hooks/useSettings";
import { ErrorBoundary } from "../ErrorBoundary";
import FAQSection from "../sections/FAQSection";
import { AnimatedPage } from "../components/AnimatedPage";
import { PageSEO } from "../components/PageSEO";
import { resolveLrcWebshopUrl } from "../lib/lrcWebshop";

interface LRCPageProps {
  language?: 'hr' | 'en';
}

const LRCPage: React.FC<LRCPageProps> = ({ language = 'hr' }) => {
  const { settings, isLoading, error } = useSettings();
  const isFormEnabled =
    error === null &&
    settings !== null &&
    settings.is_lrc_form_enabled === true;
  const webshopUrl = resolveLrcWebshopUrl(
    settings?.lrc_webshop_enabled === true,
    settings?.lrc_webshop_url,
  );

  return (
    <AnimatedPage>
      <PageSEO
        title="Ani's LRC — Lasersko rezanje, graviranje i radionice"
        description="Personalizirani pokloni i ručni radovi od drva, epoksidne smole, svile i stakla. Lasersko rezanje i graviranje u Ani's LRC studiju."
        canonical="/lrc"
      />
      <main className="min-h-screen min-w-0 bg-pearl text-plum dark:bg-[#070812] dark:text-pearl">
      {/* Glavni sadržaj: webshop uvijek vidljiv, forma ovisno o isFormEnabled */}
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
              webshopUrl={webshopUrl}
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
