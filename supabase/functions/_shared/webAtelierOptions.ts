/** Exact option sets accepted by create_public_web_atelier_inquiry. */
export const WEB_ATELIER_PROJECT_TYPES = [
  'Nova web stranica od nule',
  'Redizajn postojeće stranice',
  'Landing stranica za kampanju',
  'Web shop',
  'Portfolio / osobna stranica',
  'Sustav za rezervacije / termine',
  'Web aplikacija / SaaS',
  'Interna aplikacija / alat (za firmu)',
  'Drugo',
] as const

export const WEB_ATELIER_GOALS = [
  'Predstaviti usluge / brand',
  'Prodavati proizvode online (web shop)',
  'Prikazati radove / portfolio',
  'Dobiti upite (leadove)',
  'Educirati (blog, članci, tutorijali)',
  'Primati rezervacije / termine online',
  'Omogućiti prijave / članstva (user accounti)',
  'Automatizirati interne procese (interna aplikacija / alat)',
  'Drugo',
] as const

export const WEB_ATELIER_MOODS = [
  'Ozbiljno / poslovno',
  'Svježe i moderno',
  'Elegantno i luksuzno',
  'Razigrano i kreativno',
  'Minimalistički',
  'Drugo',
] as const

export const WEB_ATELIER_FEATURES = [
  'Kontakt forma i osnovni upiti',
  'Blog / novosti',
  'Web shop (košarica, naplata)',
  'Sustav za rezervacije (kalendar, termini)',
  'Korisnički računi / članstvo',
  'Administratorski panel / dashboard',
  'Višejezičnost (npr. HR/EN)',
  'Integracija s newsletterom (Mailchimp, sl.)',
  'Integracije s vanjskim servisima (npr. CRM, sustav naplate)',
  'Integracija s društvenim mrežama',
  'Drugo',
] as const

export const WEB_ATELIER_BUDGETS = ['under-1000', '1000-3000', '3000-7000', '7000+'] as const
export const WEB_ATELIER_PACKAGES = ['start', 'pro', 'premium'] as const
export const WEB_ATELIER_REFERRALS = ['google', 'social', 'recommendation', 'other'] as const
export const WEB_ATELIER_READY = ['yes', 'partial', 'no'] as const
export const WEB_ATELIER_FLEXIBILITY = ['fixed', 'flexible', 'very-flexible'] as const
export const WEB_ATELIER_CONTACT = ['email', 'phone', 'whatsapp', 'viber'] as const

export const WEB_ATELIER_FORM_MOODS = WEB_ATELIER_MOODS.filter((item) => item !== 'Drugo')
