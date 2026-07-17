import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'de'

interface LangState {
  lang: Lang
  setLang: (l: Lang) => void
}

const LangCtx = createContext<LangState>({ lang: 'en', setLang: () => {} })

const STORAGE_KEY = 'camcalib-lang'

function initialLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'de') return stored
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang)
    document.documentElement.lang = lang
  }, [lang])
  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>
}

export const useLangState = (): LangState => useContext(LangCtx)

/** Pick the current language's variant from a { en, de } dictionary. */
export function useT<T>(dict: { en: T; de: T }): T {
  return dict[useContext(LangCtx).lang]
}
