import { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import type { Group } from 'three'
import { useLangState, useT } from '../i18n'
import { TRACKS } from '../components/Layout'
import { mulberry32, type V3 } from '../lib/math'

const T = {
  en: {
    heroKicker: 'Interactive engineering essentials',
    heroTitle1: 'The Engineer’s',
    heroTitle2: 'Pocketknife',
    heroText:
      'The concepts every engineer keeps reaching for — cameras and 3D vision, PCA and clustering, optimization, machine learning — explained in depth, with live 3D scenes and interactive math you can grab, drag and train right in the browser.',
    start: 'Start learning',
    browse: 'All tracks',
    open: 'Open module',
    moduleWord: 'modules',
    roadmapTitle: 'More tools in the making',
    roadmapText:
      'The pocketknife keeps growing. These blades are being sharpened next:',
    nextUp: 'next up',
    roadmap: [
      { icon: '🦾', name: 'Robot Kinematics', desc: 'Forward/inverse kinematics, Jacobians and workspace — the robot from the hand-eye module, understood.', soon: true },
      { icon: '🗺️', name: 'SLAM & EKF', desc: 'Nonlinear Kalman filtering and simultaneous localization and mapping.', soon: false },
      { icon: '🫧', name: 'GMM & DBSCAN', desc: 'Clustering beyond k-means: soft assignments and density-based groups.', soon: false },
    ],
    madeFor:
      'No installation required — everything runs in the browser. Formulas follow the standard notation of the field (Hartley & Zisserman, Bishop, the OpenCV and scikit-learn docs).',
  },
  de: {
    heroKicker: 'Interaktive Ingenieurgrundlagen',
    heroTitle1: 'The Engineer’s',
    heroTitle2: 'Pocketknife',
    heroText:
      'Die Konzepte, zu denen jede Ingenieurin und jeder Ingenieur immer wieder greift — Kameras und 3D-Vision, PCA und Clustering, Optimierung, maschinelles Lernen — in der Tiefe erklärt, mit live berechneten 3D-Szenen und interaktiver Mathematik zum Anfassen, Ziehen und Trainieren direkt im Browser.',
    start: 'Loslegen',
    browse: 'Alle Themen',
    open: 'Modul öffnen',
    moduleWord: 'Module',
    roadmapTitle: 'Weitere Werkzeuge in Arbeit',
    roadmapText: 'Das Taschenmesser wächst weiter. Diese Klingen werden als Nächstes geschärft:',
    nextUp: 'als Nächstes',
    roadmap: [
      { icon: '🦾', name: 'Roboterkinematik', desc: 'Vorwärts-/Rückwärtskinematik, Jacobimatrizen und Arbeitsraum — der Roboter aus dem Hand-Auge-Modul, verstanden.', soon: true },
      { icon: '🗺️', name: 'SLAM & EKF', desc: 'Nichtlineare Kalman-Filterung und simultane Lokalisierung und Kartierung.', soon: false },
      { icon: '🫧', name: 'GMM & DBSCAN', desc: 'Clustering jenseits von K-Means: weiche Zuordnungen und dichtebasierte Gruppen.', soon: false },
    ],
    madeFor:
      'Keine Installation nötig — alles läuft im Browser. Die Notation folgt den Standards des Fachs (Hartley & Zisserman, Bishop, OpenCV- und scikit-learn-Doku).',
  },
}

function HeroScene() {
  const group = useRef<Group>(null)
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.12
  })

  const { frustum, points } = useMemo(() => {
    const d = 1.6
    const hw = 1.0
    const hh = 0.72
    const corners: V3[] = [
      [-hw, -hh, d],
      [hw, -hh, d],
      [hw, hh, d],
      [-hw, hh, d],
    ]
    const frustum: V3[][] = [...corners.map((c) => [[0, 0, 0] as V3, c]), [...corners, corners[0]]]
    const rand = mulberry32(7)
    const points: V3[] = Array.from({ length: 42 }, () => [
      (rand() - 0.5) * 2.2,
      (rand() - 0.5) * 1.6,
      d + 0.4 + rand() * 2.2,
    ])
    return { frustum, points }
  }, [])

  return (
    <group ref={group} position={[0, 0, 0]} rotation={[0.15, 0, 0]}>
      {frustum.map((pts, i) => (
        <Line key={i} points={pts} color="#22d3ee" lineWidth={1.2} transparent opacity={0.55} />
      ))}
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshBasicMaterial color={i % 3 === 0 ? '#a78bfa' : '#22d3ee'} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

export function HomePage() {
  const t = useT(T)
  const { lang } = useLangState()

  return (
    <div>
      {/* hero */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [0, 0.4, -3.2], fov: 50 }}>
            <HeroScene />
          </Canvas>
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
            <Link to="/camera-matrix" className="btn-primary px-5 py-2.5 text-[15px]">
              {t.start} →
            </Link>
            <a href="#tracks" className="btn px-5 py-2.5 text-[15px]">
              {t.browse}
            </a>
          </div>
        </div>
      </div>

      {/* tracks */}
      <div id="tracks" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-8">
        {TRACKS.map((track) => (
          <section key={track.id} className="mb-14">
            <div className="mb-1 flex items-baseline gap-3">
              <span className="text-xl">{track.icon}</span>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{track.title[lang]}</h2>
              <span className="chip">{track.modules.length} {t.moduleWord}</span>
            </div>
            <p className="mb-6 max-w-3xl text-[15px] leading-7 text-muted">{track.blurb[lang]}</p>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {track.modules.map((m) => (
                <Link
                  key={m.path}
                  to={m.path}
                  className="card group flex flex-col p-5 transition hover:border-accent/50 hover:bg-accent/[0.04]"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="bg-gradient-to-br from-accent to-accent2 bg-clip-text font-mono text-2xl font-bold text-transparent">
                      {String(m.num).padStart(2, '0')}
                    </span>
                    <h3 className="text-[16px] font-bold tracking-tight group-hover:text-accent">
                      {m.title[lang]}
                    </h3>
                  </div>
                  <p className="mt-2.5 flex-1 text-[13.5px] leading-6 text-ink/80">{m.desc[lang]}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
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
        ))}

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
