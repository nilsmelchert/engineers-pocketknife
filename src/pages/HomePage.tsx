import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { useLangState, useT } from '../i18n'
import { TRACKS } from '../components/Layout'
import { useProgress } from '../lib/progress'

const HeroScene = lazy(() => import('../components/HeroScene'))

const MINUTES: Record<string, number> = {
  '/camera-matrix': 25, '/calibration': 30, '/optimization': 30, '/stereo': 30, '/hand-eye': 25,
  '/pca': 20, '/kmeans': 20, '/clustering-2': 20, '/ransac': 15,
  '/ml-basics': 25, '/optimization-advanced': 25, '/neural-networks': 30, '/deep-learning': 25, '/vision-transformers': 30,
  '/probability': 20, '/svd': 20, '/ode': 15,
  '/fourier': 25, '/control': 20, '/kalman': 25,
  '/kinematics': 20, '/slam': 25,
  '/measurement': 20, '/metrology-3d': 30,
}

const PATHS: { icon: string; name: { en: string; de: string }; modules: string[] }[] = [
  {
    icon: '📏',
    name: { en: '3D Metrology Engineer', de: '3D-Messtechnik-Ingenieur:in' },
    modules: ['/camera-matrix', '/calibration', '/optimization', '/stereo', '/measurement', '/metrology-3d'],
  },
  {
    icon: '🧠',
    name: { en: 'ML Engineer', de: 'ML-Ingenieur:in' },
    modules: ['/probability', '/ml-basics', '/optimization-advanced', '/neural-networks', '/deep-learning', '/vision-transformers', '/pca', '/ransac'],
  },
  {
    icon: '🤖',
    name: { en: 'Robotics & Control', de: 'Robotik & Regelung' },
    modules: ['/kinematics', '/control', '/kalman', '/slam', '/hand-eye', '/ode'],
  },
]

const ALL_MODULES = TRACKS.flatMap((tr) => tr.modules)

const T = {
  en: {
    heroKicker: 'Interactive engineering essentials',
    heroTitle1: 'The Engineer’s',
    heroTitle2: 'Pocket Knife',
    heroText:
      'The concepts every engineer keeps reaching for - cameras and 3D vision, PCA and clustering, optimization, machine learning - explained in depth, with live 3D scenes and interactive math you can grab, drag and train right in the browser.',
    start: 'Start learning',
    continue: 'Continue learning',
    browse: 'All tracks',
    open: 'Open module',
    moduleWord: 'modules',
    minutes: 'min',
    allDone: '🎉 All modules completed - you are officially dangerous.',
    pathsTitle: 'Curated learning paths',
    pathsText: 'Not sure where to start? Follow one of these cross-track sequences, ordered so that each module builds on the previous ones.',
    roadmapTitle: 'More tools in the making',
    roadmapText:
      'The pocket knife keeps growing. These blades are being sharpened next:',
    nextUp: 'next up',
    roadmap: [
      { icon: '🧭', name: 'Path Planning (A*)', desc: 'Grid and graph search, heuristics, smooth trajectories - the planner behind every robot route.', soon: true },
      { icon: '🏗️', name: 'FEM Basics', desc: 'Finite elements: how software bends beams and predicts stress.', soon: false },
      { icon: '🎚️', name: 'Digital Filters', desc: 'FIR & IIR filter design - the practical sequel to the Fourier module.', soon: false },
    ],
    madeFor:
      'No installation required - everything runs in the browser. Formulas follow the standard notation of the field (Hartley & Zisserman, Bishop, the OpenCV and scikit-learn docs).',
  },
  de: {
    heroKicker: 'Interaktive Ingenieurgrundlagen',
    heroTitle1: 'The Engineer’s',
    heroTitle2: 'Pocket Knife',
    heroText:
      'Die Konzepte, zu denen jede Ingenieurin und jeder Ingenieur immer wieder greift - Kameras und 3D-Vision, PCA und Clustering, Optimierung, maschinelles Lernen - in der Tiefe erklärt, mit live berechneten 3D-Szenen und interaktiver Mathematik zum Anfassen, Ziehen und Trainieren direkt im Browser.',
    start: 'Loslegen',
    continue: 'Weiterlernen',
    browse: 'Alle Themen',
    open: 'Modul öffnen',
    moduleWord: 'Module',
    minutes: 'Min',
    allDone: '🎉 Alle Module abgeschlossen - du bist offiziell gefährlich.',
    pathsTitle: 'Kuratierte Lernpfade',
    pathsText: 'Unsicher, wo du anfangen sollst? Folge einer dieser trackübergreifenden Sequenzen - so geordnet, dass jedes Modul auf den vorherigen aufbaut.',
    roadmapTitle: 'Weitere Werkzeuge in Arbeit',
    roadmapText: 'Das Taschenmesser wächst weiter. Diese Klingen werden als Nächstes geschärft:',
    nextUp: 'als Nächstes',
    roadmap: [
      { icon: '🧭', name: 'Bahnplanung (A*)', desc: 'Gitter- und Graphensuche, Heuristiken, glatte Trajektorien - der Planer hinter jeder Roboterroute.', soon: true },
      { icon: '🏗️', name: 'FEM-Grundlagen', desc: 'Finite Elemente: Wie Software Balken biegt und Spannungen vorhersagt.', soon: false },
      { icon: '🎚️', name: 'Digitale Filter', desc: 'FIR- & IIR-Filterentwurf - die praktische Fortsetzung des Fourier-Moduls.', soon: false },
    ],
    madeFor:
      'Keine Installation nötig - alles läuft im Browser. Die Notation folgt den Standards des Fachs (Hartley & Zisserman, Bishop, OpenCV- und scikit-learn-Doku).',
  },
}


export function HomePage() {
  const t = useT(T)
  const { lang } = useLangState()
  const progress = useProgress()
  const firstIncomplete = ALL_MODULES.find((m) => !progress.has(m.path))
  const doneCount = ALL_MODULES.filter((m) => progress.has(m.path)).length

  return (
    <div>
      {/* hero */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <Suspense fallback={null}>
            <HeroScene />
          </Suspense>
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-24 md:py-32">
          <div className="text-sm font-semibold tracking-[0.2em] text-accent uppercase">
            {t.heroKicker}
          </div>
          <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-extrabold tracking-tight md:text-6xl">
            {t.heroTitle1}{' '}
            <span className="bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">
              {t.heroTitle2}
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-muted md:text-lg">{t.heroText}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {doneCount === 0 ? (
              <Link to="/camera-matrix" className="btn-primary px-5 py-2.5 text-[15px]">
                {t.start} →
              </Link>
            ) : firstIncomplete ? (
              <Link to={firstIncomplete.path} className="btn-primary px-5 py-2.5 text-[15px]">
                ▶ {t.continue}: {firstIncomplete.short[lang]}
              </Link>
            ) : null}
            <a href="#tracks" className="btn px-5 py-2.5 text-[15px]">
              {t.browse}
            </a>
          </div>
          {doneCount === ALL_MODULES.length && (
            <p className="mt-4 text-[14px] font-semibold text-green-400">{t.allDone}</p>
          )}
        </div>
      </div>

      {/* tracks */}
      <div id="tracks" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-8">
        {TRACKS.map((track) => {
          const done = track.modules.filter((m) => progress.has(m.path)).length
          const frac = done / track.modules.length
          return (
            <section key={track.id} className="mb-14">
              <div className="mb-1 flex items-center gap-3">
                <span className="text-xl">{track.icon}</span>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{track.title[lang]}</h2>
                <span className="chip">{track.modules.length} {t.moduleWord}</span>
                {done > 0 && (
                  <span className="flex items-center gap-1.5">
                    <svg viewBox="0 0 28 28" className="h-6 w-6 -rotate-90">
                      <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3.5" />
                      <circle
                        cx="14"
                        cy="14"
                        r="11"
                        fill="none"
                        stroke={frac === 1 ? '#4ade80' : '#22d3ee'}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeDasharray={`${frac * 69.1} 69.1`}
                      />
                    </svg>
                    <span className={`font-mono text-[12px] ${frac === 1 ? 'text-green-400' : 'text-accent'}`}>
                      {done}/{track.modules.length}
                    </span>
                  </span>
                )}
              </div>
              <p className="mb-6 max-w-3xl text-[15px] leading-7 text-muted">{track.blurb[lang]}</p>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {track.modules.map((m) => (
                  <Link
                    key={m.path}
                    to={m.path}
                    className="card group relative flex flex-col p-5 transition hover:border-accent/50 hover:bg-accent/[0.04]"
                  >
                    {progress.has(m.path) && (
                      <span className="absolute top-3 right-3 rounded-full border border-green-400/50 bg-green-400/15 px-1.5 py-0.5 text-[11px] font-bold text-green-400">
                        ✓
                      </span>
                    )}
                    <div className="flex items-baseline gap-3">
                      <span className="bg-gradient-to-br from-accent to-accent2 bg-clip-text font-mono text-2xl font-bold text-transparent">
                        {String(m.num).padStart(2, '0')}
                      </span>
                      <h3 className="pr-6 text-[16px] font-bold tracking-tight group-hover:text-accent">
                        {m.title[lang]}
                      </h3>
                    </div>
                    <p className="mt-2.5 flex-1 text-[13.5px] leading-6 text-ink/80">{m.desc[lang]}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {MINUTES[m.path] && (
                        <span className="chip text-[11px] text-accent">⏱ {MINUTES[m.path]} {t.minutes}</span>
                      )}
                      {m.topics[lang].map((topic, i) => (
                        <span key={i} className="chip text-[11px]">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}

        {/* learning paths */}
        <section className="mb-14">
          <h2 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">{t.pathsTitle}</h2>
          <p className="mb-6 max-w-3xl text-[15px] leading-7 text-muted">{t.pathsText}</p>
          <div className="space-y-4">
            {PATHS.map((p, i) => (
              <div key={i} className="card p-5">
                <div className="mb-3 text-[15px] font-bold">
                  {p.icon} {p.name[lang]}
                </div>
                <div className="flex flex-wrap items-center gap-y-2">
                  {p.modules.map((path, j) => {
                    const m = ALL_MODULES.find((mm) => mm.path === path)
                    if (!m) return null
                    const isDone = progress.has(path)
                    return (
                      <span key={path} className="flex items-center">
                        {j > 0 && <span className="mx-1.5 text-muted/50">→</span>}
                        <Link
                          to={path}
                          className={`rounded-lg border px-2.5 py-1 text-[12.5px] font-medium transition ${
                            isDone
                              ? 'border-green-400/40 bg-green-400/10 text-green-400'
                              : 'border-white/15 bg-white/[0.04] text-ink/85 hover:border-accent/50 hover:text-accent'
                          }`}
                        >
                          {isDone && '✓ '}
                          {m.short[lang]}
                        </Link>
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* roadmap */}
        <section className="mb-10">
          <h2 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">{t.roadmapTitle}</h2>
          <p className="mb-6 max-w-3xl text-[15px] leading-7 text-muted">{t.roadmapText}</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {t.roadmap.map((r, i) => (
              <div key={i} className="card relative p-5 opacity-70">
                {r.soon && (
                  <span className="absolute top-3 right-3 rounded-full border border-warn/50 bg-warn/10 px-2 py-0.5 text-[10px] font-semibold text-warn uppercase">
                    ⏳ {t.nextUp}
                  </span>
                )}
                <div className="text-2xl">{r.icon}</div>
                <div className="mt-2 text-[15px] font-bold">{r.name}</div>
                <p className="mt-1.5 text-[13px] leading-5.5 text-muted">{r.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-6 max-w-3xl text-[13px] leading-6 text-muted">{t.madeFor}</p>
      </div>
    </div>
  )
}
