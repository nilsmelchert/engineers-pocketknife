import { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import type { Group } from 'three'
import { useLangState, useT } from '../i18n'
import { MODULES } from '../components/Layout'
import { mulberry32, type V3 } from '../lib/math'

const T = {
  en: {
    heroKicker: 'An interactive guide for students',
    heroTitle1: 'See how cameras',
    heroTitle2: 'measure the world',
    heroText:
      'From a single pixel to a robot that grabs what it sees: learn the geometry of cameras — the camera matrix, calibration, stereo vision and hand-eye calibration — with live 3D scenes and interactive math you can grab and move.',
    start: 'Start with module 1',
    browse: 'All modules',
    pathTitle: 'The learning path',
    pathText:
      'The five modules build on each other. Module 1 explains how a camera maps 3D to 2D; module 2 shows how to measure that mapping for a real camera; module 3 reveals the numerical optimization engine behind it; module 4 uses two calibrated cameras to recover 3D; module 5 connects the camera to a robot.',
    open: 'Open module',
    madeFor: 'No installation required — everything runs in the browser. Formulas follow the notation of Hartley & Zisserman and the OpenCV documentation.',
  },
  de: {
    heroKicker: 'Ein interaktiver Leitfaden für Studierende',
    heroTitle1: 'Sieh, wie Kameras',
    heroTitle2: 'die Welt vermessen',
    heroText:
      'Vom einzelnen Pixel bis zum Roboter, der greift, was er sieht: Lerne die Geometrie von Kameras — Kameramatrix, Kalibrierung, Stereosehen und Hand-Auge-Kalibrierung — mit live berechneten 3D-Szenen und interaktiver Mathematik zum Anfassen.',
    start: 'Mit Modul 1 starten',
    browse: 'Alle Module',
    pathTitle: 'Der Lernpfad',
    pathText:
      'Die fünf Module bauen aufeinander auf. Modul 1 erklärt, wie eine Kamera 3D auf 2D abbildet; Modul 2 zeigt, wie man diese Abbildung für eine echte Kamera vermisst; Modul 3 enthüllt den numerischen Optimierungsmotor dahinter; Modul 4 rekonstruiert mit zwei kalibrierten Kameras 3D; Modul 5 verbindet die Kamera mit einem Roboter.',
    open: 'Modul öffnen',
    madeFor: 'Keine Installation nötig — alles läuft im Browser. Die Notation folgt Hartley & Zisserman und der OpenCV-Dokumentation.',
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
    const frustum: V3[][] = [
      ...corners.map((c) => [[0, 0, 0] as V3, c]),
      [...corners, corners[0]],
    ]
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
            <a href="#modules" className="btn px-5 py-2.5 text-[15px]">
              {t.browse}
            </a>
          </div>
        </div>
      </div>

      {/* modules */}
      <div id="modules" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-8">
        <h2 className="mb-2 text-2xl font-bold tracking-tight md:text-3xl">{t.pathTitle}</h2>
        <p className="mb-8 max-w-3xl text-[15px] leading-7 text-muted">{t.pathText}</p>
        <div className="grid gap-5 md:grid-cols-2">
          {MODULES.map((m) => (
            <Link
              key={m.path}
              to={m.path}
              className="card group p-6 transition hover:border-accent/50 hover:bg-accent/[0.04]"
            >
              <div className="flex items-baseline gap-3">
                <span className="bg-gradient-to-br from-accent to-accent2 bg-clip-text font-mono text-3xl font-bold text-transparent">
                  {String(m.num).padStart(2, '0')}
                </span>
                <h3 className="text-lg font-bold tracking-tight group-hover:text-accent">
                  {m.title[lang]}
                </h3>
              </div>
              <p className="mt-3 text-[14px] leading-6 text-ink/80">{m.desc[lang]}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {m.topics[lang].map((topic, i) => (
                  <span key={i} className="chip">
                    {topic}
                  </span>
                ))}
              </div>
              <div className="mt-4 text-[13px] font-semibold text-accent opacity-0 transition group-hover:opacity-100">
                {t.open} →
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-10 max-w-3xl text-[13px] leading-6 text-muted">{t.madeFor}</p>
      </div>
    </div>
  )
}
