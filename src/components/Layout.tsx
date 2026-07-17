import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useLangState, useT, type Lang } from '../i18n'

export interface ModuleDef {
  path: string
  num: number
  title: { en: string; de: string }
  short: { en: string; de: string }
  desc: { en: string; de: string }
  topics: { en: string[]; de: string[] }
}

export const MODULES: ModuleDef[] = [
  {
    path: '/camera-matrix',
    num: 1,
    title: { en: 'The Camera Matrix', de: 'Die Kameramatrix' },
    short: { en: 'Camera Matrix', de: 'Kameramatrix' },
    desc: {
      en: 'How a 3D world becomes a 2D image: the pinhole model, intrinsics K, extrinsics [R|t] and the projection matrix P.',
      de: 'Wie aus der 3D-Welt ein 2D-Bild wird: Lochkameramodell, Intrinsik K, Extrinsik [R|t] und die Projektionsmatrix P.',
    },
    topics: {
      en: ['Pinhole model', 'Homogeneous coordinates', 'Intrinsics', 'Extrinsics'],
      de: ['Lochkameramodell', 'Homogene Koordinaten', 'Intrinsik', 'Extrinsik'],
    },
  },
  {
    path: '/calibration',
    num: 2,
    title: { en: 'Camera Calibration', de: 'Kamerakalibrierung' },
    short: { en: 'Calibration', de: 'Kalibrierung' },
    desc: {
      en: "Estimating K and lens distortion from checkerboard images: Zhang's method, the Brown–Conrady model and what makes a calibration good.",
      de: 'K und Verzeichnung aus Schachbrettbildern schätzen: Zhangs Methode, das Brown–Conrady-Modell und was eine gute Kalibrierung ausmacht.',
    },
    topics: {
      en: ['Zhang’s method', 'Lens distortion', 'Reprojection error', 'Capture strategy'],
      de: ['Zhangs Methode', 'Verzeichnung', 'Reprojektionsfehler', 'Aufnahmestrategie'],
    },
  },
  {
    path: '/stereo',
    num: 3,
    title: { en: 'Stereo Vision', de: 'Stereosehen' },
    short: { en: 'Stereo', de: 'Stereo' },
    desc: {
      en: 'Two calibrated cameras recover depth: stereo extrinsics, epipolar geometry, rectification and the disparity–depth relation.',
      de: 'Zwei kalibrierte Kameras rekonstruieren Tiefe: Stereo-Extrinsik, Epipolargeometrie, Rektifizierung und der Disparität-Tiefe-Zusammenhang.',
    },
    topics: {
      en: ['Stereo extrinsics', 'Epipolar geometry', 'Rectification', 'Triangulation'],
      de: ['Stereo-Extrinsik', 'Epipolargeometrie', 'Rektifizierung', 'Triangulation'],
    },
  },
  {
    path: '/hand-eye',
    num: 4,
    title: { en: 'Hand-Eye Calibration', de: 'Hand-Auge-Kalibrierung' },
    short: { en: 'Hand-Eye', de: 'Hand-Auge' },
    desc: {
      en: 'Connecting a camera to a robot: eye-in-hand vs. eye-to-hand, the AX = XB equation and the robot-world variant AX = ZB.',
      de: 'Kamera und Roboter verbinden: Eye-in-Hand vs. Eye-to-Hand, die Gleichung AX = XB und die Robot-World-Variante AX = ZB.',
    },
    topics: {
      en: ['Eye-in-hand', 'Eye-to-hand', 'AX = XB', 'AX = ZB'],
      de: ['Eye-in-Hand', 'Eye-to-Hand', 'AX = XB', 'AX = ZB'],
    },
  },
]

const UI = {
  en: {
    home: 'Home',
    prev: 'Previous',
    next: 'Next',
    footer: 'An interactive introduction to camera calibration, stereo vision and hand-eye calibration.',
  },
  de: {
    home: 'Start',
    prev: 'Zurück',
    next: 'Weiter',
    footer: 'Eine interaktive Einführung in Kamerakalibrierung, Stereosehen und Hand-Auge-Kalibrierung.',
  },
}

function LangSwitch() {
  const { lang, setLang } = useLangState()
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-white/15 text-xs font-semibold">
      {(['en', 'de'] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`cursor-pointer px-2.5 py-1 uppercase transition ${
            lang === l ? 'bg-accent/20 text-accent' : 'bg-white/[0.04] text-muted hover:text-ink'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const t = useT(UI)
  const { lang } = useLangState()
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const idx = MODULES.findIndex((m) => m.path === location.pathname)
  const prev = idx > 0 ? MODULES[idx - 1] : null
  const next = idx >= 0 && idx < MODULES.length - 1 ? MODULES[idx + 1] : null

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gradient-to-br from-accent to-accent2" />
            <span>
              camera<span className="text-accent">·</span>calib
            </span>
          </Link>
          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {MODULES.map((m) => (
              <NavLink
                key={m.path}
                to={m.path}
                className={({ isActive }) =>
                  `rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${
                    isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-white/5 hover:text-ink'
                  }`
                }
              >
                <span className="mr-1 font-mono text-[11px] opacity-60">{m.num}</span>
                {m.short[lang]}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <LangSwitch />
          </div>
        </div>
      </header>

      <main>{children}</main>

      {idx >= 0 && (
        <div className="mx-auto flex max-w-6xl items-stretch justify-between gap-4 px-4 pb-10">
          {prev ? (
            <Link to={prev.path} className="btn">
              ← {t.prev}: {prev.short[lang]}
            </Link>
          ) : (
            <Link to="/" className="btn">
              ← {t.home}
            </Link>
          )}
          {next && (
            <Link to={next.path} className="btn-primary">
              {t.next}: {next.short[lang]} →
            </Link>
          )}
        </div>
      )}

      <footer className="border-t border-white/10 py-8 text-center text-[13px] text-muted">
        <div className="mx-auto max-w-6xl px-4">{t.footer}</div>
      </footer>
    </div>
  )
}
