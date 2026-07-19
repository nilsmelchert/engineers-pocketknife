import { Link } from 'react-router-dom'
import { useLangState, useT } from '../i18n'
import { TRACKS } from '../components/Layout'
import { LAB_INDEX } from '../lib/labIndex'

const T = {
  en: {
    title: 'All labs',
    intro:
      'Every interactive on the site, in one place - jump straight to the widget, skip the prose. Perfect for revisiting before an exam or showing a colleague that one demo.',
    count: 'interactive labs',
  },
  de: {
    title: 'Alle Labore',
    intro:
      'Jedes interaktive Element der Seite an einem Ort - spring direkt zum Widget, überspringe die Prosa. Perfekt zum Wiederholen vor einer Prüfung oder um Kolleg:innen diese eine Demo zu zeigen.',
    count: 'interaktive Labore',
  },
}

export function LabsPage() {
  const t = useT(T)
  const { lang } = useLangState()

  return (
    <div className="mx-auto max-w-6xl px-4">
      <header className="pt-10 pb-6">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight md:text-4xl">🧪 {t.title}</h1>
        <p className="max-w-3xl text-[15px] leading-7 text-muted">
          {t.intro} <span className="chip ml-1">{LAB_INDEX.length} {t.count}</span>
        </p>
      </header>

      {TRACKS.map((track) => {
        const labs = LAB_INDEX.filter((l) => track.modules.some((m) => m.path === l.path))
        if (labs.length === 0) return null
        return (
          <section key={track.id} className="mb-10">
            <h2 className="mb-4 text-xl font-bold tracking-tight">
              {track.icon} {track.title[lang]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {labs.map((lab) => {
                const mod = track.modules.find((m) => m.path === lab.path)!
                return (
                  <Link
                    key={`${lab.path}-${lab.sectionId}`}
                    to={lab.path}
                    state={{ scrollTo: lab.sectionId }}
                    className="card group flex items-center gap-3 px-4 py-3 transition hover:border-accent/50 hover:bg-accent/[0.04]"
                  >
                    <span className="text-xl">{lab.emoji}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold group-hover:text-accent">
                        {lab.title[lang]}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted">{mod.short[lang]}</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
