import { useEffect, useState, type ReactNode } from 'react'
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

export interface TrackDef {
  id: string
  icon: string
  title: { en: string; de: string }
  short: { en: string; de: string }
  blurb: { en: string; de: string }
  modules: ModuleDef[]
}

export const TRACKS: TrackDef[] = [
  {
    id: 'vision',
    icon: '📷',
    title: { en: 'Camera & 3D Vision', de: 'Kamera & 3D-Vision' },
    short: { en: 'Vision', de: 'Vision' },
    blurb: {
      en: 'How cameras measure the world: from the camera matrix to calibrated stereo rigs and robot hand-eye systems.',
      de: 'Wie Kameras die Welt vermessen: von der Kameramatrix über kalibrierte Stereosysteme bis zu Roboter-Hand-Auge-Systemen.',
    },
    modules: [
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
        path: '/optimization',
        num: 3,
        title: { en: 'Numerical Optimization', de: 'Numerische Optimierung' },
        short: { en: 'Optimization', de: 'Optimierung' },
        desc: {
          en: 'How the parameters are actually found: cost landscapes, gradient descent, momentum, Gauss-Newton and Levenberg–Marquardt — with a live calibration solver.',
          de: 'Wie die Parameter wirklich gefunden werden: Kostenlandschaften, Gradientenabstieg, Momentum, Gauß-Newton und Levenberg–Marquardt — mit einem live laufenden Kalibrierlöser.',
        },
        topics: {
          en: ['Cost functions', 'Gradient descent', 'Levenberg–Marquardt', 'Bundle adjustment'],
          de: ['Kostenfunktionen', 'Gradientenabstieg', 'Levenberg–Marquardt', 'Bündelausgleich'],
        },
      },
      {
        path: '/stereo',
        num: 4,
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
        num: 5,
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
    ],
  },
  {
    id: 'data',
    icon: '📊',
    title: { en: 'Data & Patterns', de: 'Daten & Muster' },
    short: { en: 'Data', de: 'Daten' },
    blurb: {
      en: 'Finding structure in raw numbers: directions that matter (PCA) and groups that belong together (clustering).',
      de: 'Struktur in rohen Zahlen finden: Richtungen, die zählen (PCA), und Gruppen, die zusammengehören (Clustering).',
    },
    modules: [
      {
        path: '/pca',
        num: 1,
        title: { en: 'Principal Component Analysis', de: 'Hauptkomponentenanalyse' },
        short: { en: 'PCA', de: 'PCA' },
        desc: {
          en: 'The best flat shadow of your data: covariance, eigenvectors, variance explained and dimensionality reduction — in 2D and 3D.',
          de: 'Der beste flache Schatten deiner Daten: Kovarianz, Eigenvektoren, erklärte Varianz und Dimensionsreduktion — in 2D und 3D.',
        },
        topics: {
          en: ['Covariance', 'Eigenvectors', 'Variance explained', 'Dimensionality reduction'],
          de: ['Kovarianz', 'Eigenvektoren', 'Erklärte Varianz', 'Dimensionsreduktion'],
        },
      },
      {
        path: '/kmeans',
        num: 2,
        title: { en: 'K-Means Clustering', de: 'K-Means-Clustering' },
        short: { en: 'K-Means', de: 'K-Means' },
        desc: {
          en: "Grouping without labels: Lloyd's algorithm step by step, why initialization matters, choosing k, and where k-means fails.",
          de: 'Gruppieren ohne Labels: Lloyds Algorithmus Schritt für Schritt, warum die Initialisierung zählt, die Wahl von k und wo K-Means scheitert.',
        },
        topics: {
          en: ['Lloyd’s algorithm', 'k-means++', 'Elbow method', 'Failure modes'],
          de: ['Lloyds Algorithmus', 'k-means++', 'Ellbogenmethode', 'Grenzfälle'],
        },
      },
    ],
  },
  {
    id: 'ml',
    icon: '🧠',
    title: { en: 'Machine Learning', de: 'Maschinelles Lernen' },
    short: { en: 'ML', de: 'ML' },
    blurb: {
      en: 'From fitting a line to training a neural network in your browser — and the optimizers that make it possible.',
      de: 'Vom Anpassen einer Geraden bis zum Training eines neuronalen Netzes im Browser — und die Optimierer, die das möglich machen.',
    },
    modules: [
      {
        path: '/ml-basics',
        num: 1,
        title: { en: 'Machine Learning Fundamentals', de: 'Grundlagen des Maschinellen Lernens' },
        short: { en: 'ML Basics', de: 'ML-Grundlagen' },
        desc: {
          en: 'Learning is fitting: linear and logistic regression, overfitting and the bias-variance trade-off — with the famous U-curve, live.',
          de: 'Lernen ist Anpassen: lineare und logistische Regression, Überanpassung und der Bias-Varianz-Kompromiss — mit der berühmten U-Kurve, live.',
        },
        topics: {
          en: ['Linear regression', 'Overfitting', 'Regularization', 'Logistic regression'],
          de: ['Lineare Regression', 'Überanpassung', 'Regularisierung', 'Logistische Regression'],
        },
      },
      {
        path: '/optimization-advanced',
        num: 2,
        title: { en: 'Stochastic & Global Optimization', de: 'Stochastische & globale Optimierung' },
        short: { en: 'SGD & Adam', de: 'SGD & Adam' },
        desc: {
          en: 'How millions of parameters get trained: SGD and its noise, momentum, Adam, learning-rate schedules, simulated annealing and Lagrange constraints.',
          de: 'Wie Millionen Parameter trainiert werden: SGD und sein Rauschen, Momentum, Adam, Lernraten-Schedules, Simulated Annealing und Lagrange-Nebenbedingungen.',
        },
        topics: {
          en: ['SGD', 'Adam', 'LR schedules', 'Simulated annealing', 'Constraints'],
          de: ['SGD', 'Adam', 'LR-Schedules', 'Simulated Annealing', 'Nebenbedingungen'],
        },
      },
      {
        path: '/neural-networks',
        num: 3,
        title: { en: 'Neural Networks & Deep Learning', de: 'Neuronale Netze & Deep Learning' },
        short: { en: 'Neural Nets', de: 'Neuronale Netze' },
        desc: {
          en: 'Train a real neural network live in your browser: architecture, activations, backpropagation and a decision-boundary playground.',
          de: 'Trainiere ein echtes neuronales Netz live im Browser: Architektur, Aktivierungen, Backpropagation und ein Entscheidungsgrenzen-Spielplatz.',
        },
        topics: {
          en: ['Neurons & layers', 'Backpropagation', 'Live training', 'Deep learning'],
          de: ['Neuronen & Schichten', 'Backpropagation', 'Live-Training', 'Deep Learning'],
        },
      },
    ],
  },
  {
    id: 'math',
    icon: '🧮',
    title: { en: 'Math Foundations', de: 'Mathematische Grundlagen' },
    short: { en: 'Math', de: 'Mathe' },
    blurb: {
      en: 'The two mathematical power tools behind half of this site: reasoning with uncertainty, and taking matrices apart.',
      de: 'Die zwei mathematischen Kraftwerkzeuge hinter der halben Seite: Schließen unter Unsicherheit und das Zerlegen von Matrizen.',
    },
    modules: [
      {
        path: '/probability',
        num: 1,
        title: { en: 'Probability & Bayes', de: 'Wahrscheinlichkeit & Bayes' },
        short: { en: 'Probability', de: 'Wahrscheinlichkeit' },
        desc: {
          en: 'Distributions, the central limit theorem, and Bayes’ rule — including the base-rate fallacy, made visible with 1000 dots.',
          de: 'Verteilungen, der zentrale Grenzwertsatz und der Satz von Bayes — inklusive Basisraten-Trugschluss, sichtbar gemacht mit 1000 Punkten.',
        },
        topics: {
          en: ['Gaussians', 'Central limit theorem', 'Bayes’ rule', 'Bayesian updating'],
          de: ['Gauß-Verteilungen', 'Zentraler Grenzwertsatz', 'Satz von Bayes', 'Bayessches Lernen'],
        },
      },
      {
        path: '/svd',
        num: 2,
        title: { en: 'SVD & Linear Algebra', de: 'SVD & Lineare Algebra' },
        short: { en: 'SVD', de: 'SVD' },
        desc: {
          en: 'Every matrix is rotate–stretch–rotate: singular values, low-rank approximation and image compression, animated.',
          de: 'Jede Matrix ist Drehen–Strecken–Drehen: Singulärwerte, Niedrigrang-Approximation und Bildkompression, animiert.',
        },
        topics: {
          en: ['Matrix as transform', 'Singular values', 'Low-rank approximation', 'Compression'],
          de: ['Matrix als Abbildung', 'Singulärwerte', 'Niedrigrang-Approximation', 'Kompression'],
        },
      },
    ],
  },
  {
    id: 'signals',
    icon: '🎛️',
    title: { en: 'Signals & Control', de: 'Signale & Regelung' },
    short: { en: 'Signals', de: 'Signale' },
    blurb: {
      en: 'Systems that live in time: decomposing signals, closing feedback loops, and estimating state from noisy sensors.',
      de: 'Systeme, die in der Zeit leben: Signale zerlegen, Regelkreise schließen und Zustände aus verrauschten Sensoren schätzen.',
    },
    modules: [
      {
        path: '/fourier',
        num: 1,
        title: { en: 'Fourier & Signals', de: 'Fourier & Signale' },
        short: { en: 'Fourier', de: 'Fourier' },
        desc: {
          en: 'Every signal is a sum of sines: Fourier series, sampling and aliasing, the DFT, filtering in the frequency domain and convolution.',
          de: 'Jedes Signal ist eine Summe von Sinussen: Fourierreihen, Abtastung und Aliasing, die DFT, Filtern im Frequenzbereich und Faltung.',
        },
        topics: {
          en: ['Fourier series', 'Sampling & aliasing', 'DFT & filtering', 'Convolution'],
          de: ['Fourierreihen', 'Abtastung & Aliasing', 'DFT & Filterung', 'Faltung'],
        },
      },
      {
        path: '/control',
        num: 2,
        title: { en: 'Control Theory', de: 'Regelungstechnik' },
        short: { en: 'Control', de: 'Regelung' },
        desc: {
          en: 'Feedback makes imprecise systems precise: the PID controller on a real simulated plant, tuning, and the road to instability.',
          de: 'Rückkopplung macht unpräzise Systeme präzise: der PID-Regler an einer echten simulierten Strecke, Tuning und der Weg in die Instabilität.',
        },
        topics: {
          en: ['Feedback', 'PID control', 'Step response', 'Stability'],
          de: ['Rückkopplung', 'PID-Regelung', 'Sprungantwort', 'Stabilität'],
        },
      },
      {
        path: '/kalman',
        num: 3,
        title: { en: 'The Kalman Filter', de: 'Das Kalman-Filter' },
        short: { en: 'Kalman', de: 'Kalman' },
        desc: {
          en: 'Fusing a motion model with noisy sensors: predict–update, the Kalman gain, and a filter that chases your mouse.',
          de: 'Bewegungsmodell und verrauschte Sensoren verschmelzen: Prädiktion–Korrektur, das Kalman-Gain und ein Filter, das deiner Maus hinterherjagt.',
        },
        topics: {
          en: ['Sensor fusion', 'Predict & update', 'Kalman gain', 'Tracking'],
          de: ['Sensorfusion', 'Prädiktion & Korrektur', 'Kalman-Gain', 'Tracking'],
        },
      },
    ],
  },
  {
    id: 'metrology',
    icon: '📏',
    title: { en: 'Measurement & Metrology', de: 'Messtechnik & Metrologie' },
    short: { en: 'Metrology', de: 'Messtechnik' },
    blurb: {
      en: 'What it means to measure: uncertainty as a first-class citizen, and optical 3D measurement built on the calibrated camera.',
      de: 'Was Messen bedeutet: Unsicherheit als Bürger erster Klasse — und optische 3D-Messtechnik auf Basis der kalibrierten Kamera.',
    },
    modules: [
      {
        path: '/measurement',
        num: 1,
        title: { en: 'Measurement Theory', de: 'Messtheorie' },
        short: { en: 'Measurement', de: 'Messtheorie' },
        desc: {
          en: 'Accuracy vs. precision, error propagation (GUM vs. Monte Carlo), the uncertainty of the mean and honest uncertainty budgets.',
          de: 'Richtigkeit vs. Präzision, Fehlerfortpflanzung (GUM vs. Monte Carlo), die Unsicherheit des Mittelwerts und ehrliche Messunsicherheitsbudgets.',
        },
        topics: {
          en: ['Accuracy & precision', 'Error propagation', 'GUM', 'Uncertainty budgets'],
          de: ['Richtigkeit & Präzision', 'Fehlerfortpflanzung', 'GUM', 'Unsicherheitsbudgets'],
        },
      },
      {
        path: '/metrology-3d',
        num: 2,
        title: { en: '3D Optical Metrology', de: 'Optische 3D-Messtechnik' },
        short: { en: '3D Metrology', de: '3D-Messtechnik' },
        desc: {
          en: 'Laser-line triangulation, fringe projection and interferometry — three optical routes to 3D, all standing on camera calibration.',
          de: 'Laserlinien-Triangulation, Streifenprojektion und Interferometrie — drei optische Wege zu 3D, alle auf Kamerakalibrierung gebaut.',
        },
        topics: {
          en: ['Laser triangulation', 'Fringe projection', 'Interferometry', 'Range vs. resolution'],
          de: ['Lasertriangulation', 'Streifenprojektion', 'Interferometrie', 'Messbereich vs. Auflösung'],
        },
      },
    ],
  },
]

const UI = {
  en: {
    home: 'Home',
    prev: 'Previous',
    next: 'Next',
    footer:
      'The Engineer’s Pocketknife — interactive essentials: computer vision, data analysis, optimization and machine learning.',
  },
  de: {
    home: 'Start',
    prev: 'Zurück',
    next: 'Weiter',
    footer:
      'The Engineer’s Pocketknife — interaktive Grundlagen: Computer Vision, Datenanalyse, Optimierung und maschinelles Lernen.',
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

function TrackMenu({ track }: { track: TrackDef }) {
  const { lang } = useLangState()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const active = track.modules.some((m) => m.path === location.pathname)

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen(!open)}
        className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${
          active ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-white/5 hover:text-ink'
        }`}
      >
        <span className="text-[12px]">{track.icon}</span>
        {track.short[lang]}
        <span className="text-[9px] opacity-60">▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 w-64 pt-1">
          <div className="card overflow-hidden bg-[#10141f]/95 p-1.5 shadow-xl shadow-black/40">
            {track.modules.map((m) => (
              <NavLink
                key={m.path}
                to={m.path}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-[13px] transition ${
                    isActive ? 'bg-accent/15 text-accent' : 'text-ink/85 hover:bg-white/5'
                  }`
                }
              >
                <span className="mr-1.5 font-mono text-[11px] opacity-50">{m.num}</span>
                {m.short[lang]}
              </NavLink>
            ))}
          </div>
        </div>
      )}
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

  const track = TRACKS.find((tr) => tr.modules.some((m) => m.path === location.pathname))
  const idx = track ? track.modules.findIndex((m) => m.path === location.pathname) : -1
  const prev = track && idx > 0 ? track.modules[idx - 1] : null
  const next = track && idx >= 0 && idx < track.modules.length - 1 ? track.modules[idx + 1] : null

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gradient-to-br from-accent to-accent2" />
            <span>
              pocket<span className="text-accent">·</span>knife
            </span>
          </Link>
          <nav className="ml-2 hidden items-center gap-0.5 lg:flex">
            {TRACKS.map((tr) => (
              <TrackMenu key={tr.id} track={tr} />
            ))}
          </nav>
          <div className="ml-auto">
            <LangSwitch />
          </div>
        </div>
      </header>

      <main>{children}</main>

      {track && (
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
          {next ? (
            <Link to={next.path} className="btn-primary">
              {t.next}: {next.short[lang]} →
            </Link>
          ) : (
            <Link to="/" className="btn-primary">
              {t.home} →
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
