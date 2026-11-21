import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  initializeTheme: () => void
}

const applyThemeToDOM = (theme: Theme) => {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark' && !/^\/admin(?:\/|$)/.test(window.location.pathname))
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',

  setTheme: (theme) => {
    set({ theme })
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', theme)
      applyThemeToDOM(theme)
    }
  },

  toggleTheme: () => {
    const current = get().theme
    const next: Theme = current === 'light' ? 'dark' : 'light'
    get().setTheme(next)
  },

  initializeTheme: () => {
    if (typeof window === 'undefined') return

    const stored = window.localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') {
      get().setTheme(stored as Theme)
      return
    }

    // DEFAULT: uvijek light na prvom učitavanju
    get().setTheme('light')
  },
}))
