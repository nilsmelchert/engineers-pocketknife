import { useEffect, useState } from 'react'
import { useT } from '../i18n'

export interface TocItem {
  id: string
  label: string
}

const UI = { en: { onPage: 'On this page' }, de: { onPage: 'Auf dieser Seite' } }

/**
 * Sticky on-page section navigation (2xl screens only). Uses button + scrollIntoView
 * instead of anchors, because with HashRouter `#foo` would be interpreted as a route.
 */
export function PageToc({ items }: { items: TocItem[] }) {
  const t = useT(UI)
  const [active, setActive] = useState<string>(items[0]?.id ?? '')

  useEffect(() => {
    const visible = new Set<string>()
    const pick = () => {
      const first = items.find((i) => visible.has(i.id))
      if (first) setActive(first.id)
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id)
          else visible.delete(e.target.id)
        }
        pick()
      },
      { rootMargin: '-10% 0px -55% 0px' },
    )
    for (const i of items) {
      const el = document.getElementById(i.id)
      if (el) obs.observe(el)
    }
    return () => obs.disconnect()
  }, [items])

  return (
    <nav className="fixed top-28 right-5 z-40 hidden w-48 2xl:block">
      <div className="mb-2 text-[10px] font-semibold tracking-[0.15em] text-muted uppercase">
        {t.onPage}
      </div>
      <ul className="space-y-0.5 border-l border-white/10">
        {items.map((i) => (
          <li key={i.id}>
            <button
              onClick={() => document.getElementById(i.id)?.scrollIntoView({ behavior: 'smooth' })}
              className={`-ml-px block w-full cursor-pointer truncate border-l-2 px-2.5 py-1 text-left text-[12px] transition ${
                active === i.id
                  ? 'border-accent font-medium text-accent'
                  : 'border-transparent text-muted hover:border-white/30 hover:text-ink'
              }`}
            >
              {i.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
