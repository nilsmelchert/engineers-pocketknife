import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useLangState, useT, type Lang } from '../i18n'
import { SearchPalette } from './SearchPalette'
import { toggleCompleted, useProgress } from '../lib/progress'

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
      {
        path: '/clustering-2',
        num: 3,
        title: { en: 'Clustering II: GMM & DBSCAN', de: 'Clustering II: GMM & DBSCAN' },
        short: { en: 'GMM & DBSCAN', de: 'GMM & DBSCAN' },
        desc: {
          en: 'Beyond k-means: elastic Gaussian mixtures fitted by EM (watch the ellipses learn), and density-based DBSCAN that solves the moons.',
          de: 'Jenseits von K-Means: elastische Gauß-Mischungen per EM (sieh die Ellipsen lernen) und dichtebasiertes DBSCAN, das die Monde löst.',
        },
        topics: {
          en: ['Gaussian mixtures', 'EM algorithm', 'Soft assignment', 'DBSCAN'],
          de: ['Gauß-Mischungen', 'EM-Algorithmus', 'Weiche Zuordnung', 'DBSCAN'],
        },
      },
      {
        path: '/ransac',
        num: 4,
        title: { en: 'Robust Fitting & RANSAC', de: 'Robustes Fitten & RANSAC' },
        short: { en: 'RANSAC', de: 'RANSAC' },
        desc: {
          en: 'When data lies: how outliers destroy least squares, and how RANSAC’s random consensus voting survives them — animated.',
          de: 'Wenn Daten lügen: Wie Ausreißer kleinste Quadrate zerstören und wie RANSACs zufällige Konsensabstimmung sie überlebt — animiert.',
        },
        topics: {
          en: ['Outliers', 'RANSAC', 'Inlier consensus', 'Robust losses'],
          de: ['Ausreißer', 'RANSAC', 'Inlier-Konsens', 'Robuste Verluste'],
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
      {
        path: '/deep-learning',
        num: 4,
        title: { en: 'Modern Deep Learning: CNNs & Transformers', de: 'Modernes Deep Learning: CNNs & Transformer' },
        short: { en: 'CNNs & Transformers', de: 'CNNs & Transformer' },
        desc: {
          en: 'Inductive bias in the wiring: convolution and feature hierarchies for images, self-attention for sequences — with a live attention heatmap.',
          de: 'Induktiver Bias in der Verdrahtung: Faltung und Merkmalshierarchien für Bilder, Self-Attention für Sequenzen — mit Live-Attention-Heatmap.',
        },
        topics: {
          en: ['Convolutions', 'Feature hierarchies', 'Self-attention', 'Transformers'],
          de: ['Faltungen', 'Merkmalshierarchien', 'Self-Attention', 'Transformer'],
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
      {
        path: '/ode',
        num: 3,
        title: { en: 'ODE Solvers & Simulation', de: 'ODE-Löser & Simulation' },
        short: { en: 'ODE Solvers', de: 'ODE-Löser' },
        desc: {
          en: 'The numerics behind every simulation: Euler vs. RK4 on an oscillator (watch Euler invent energy), step size and the stability cliff.',
          de: 'Die Numerik hinter jeder Simulation: Euler vs. RK4 am Oszillator (sieh Euler Energie erfinden), Schrittweite und die Stabilitätsklippe.',
        },
        topics: {
          en: ['Euler & RK4', 'Energy drift', 'Stability limits', 'Stiffness'],
          de: ['Euler & RK4', 'Energiedrift', 'Stabilitätsgrenzen', 'Steifheit'],
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
    id: 'robotics',
    icon: '🤖',
    title: { en: 'Robotics', de: 'Robotik' },
    short: { en: 'Robotics', de: 'Robotik' },
    blurb: {
      en: 'Making machines move with intent: kinematic chains, inverse kinematics and the singularities in between.',
      de: 'Maschinen zielgerichtet bewegen: kinematische Ketten, Rückwärtskinematik und die Singularitäten dazwischen.',
    },
    modules: [
      {
        path: '/kinematics',
        num: 1,
        title: { en: 'Robot Kinematics', de: 'Roboterkinematik' },
        short: { en: 'Kinematics', de: 'Kinematik' },
        desc: {
          en: 'Forward and inverse kinematics on a draggable arm, workspace analysis, and the Jacobian — watch the manipulability ellipse collapse at a singularity.',
          de: 'Vorwärts- und Rückwärtskinematik an einem ziehbaren Arm, Arbeitsraumanalyse und die Jacobimatrix — sieh die Manipulierbarkeitsellipse an der Singularität kollabieren.',
        },
        topics: {
          en: ['Forward kinematics', 'Inverse kinematics', 'Jacobian', 'Singularities'],
          de: ['Vorwärtskinematik', 'Rückwärtskinematik', 'Jacobimatrix', 'Singularitäten'],
        },
      },
      {
        path: '/slam',
        num: 2,
        title: { en: 'SLAM & the Extended Kalman Filter', de: 'SLAM & das erweiterte Kalman-Filter' },
        short: { en: 'SLAM', de: 'SLAM' },
        desc: {
          en: 'Mapping while localizing: watch dead reckoning drift into spaghetti, then see EKF-SLAM snap the whole map tight at loop closure.',
          de: 'Kartieren beim Lokalisieren: Sieh Koppelnavigation zu Spaghetti driften — und EKF-SLAM die ganze Karte beim Schleifenschluss straffen.',
        },
        topics: {
          en: ['Dead reckoning', 'EKF', 'Landmarks', 'Loop closure'],
          de: ['Koppelnavigation', 'EKF', 'Landmarken', 'Schleifenschluss'],
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
    labs: 'Labs',
    glossary: 'Glossary',
    formulas: 'Formulas',
    search: 'Search',
    markDone: 'Mark as completed',
    done: 'Completed',
    menu: 'Menu',
  },
  de: {
    home: 'Start',
    prev: 'Zurück',
    next: 'Weiter',
    footer:
      'The Engineer’s Pocketknife — interaktive Grundlagen: Computer Vision, Datenanalyse, Optimierung und maschinelles Lernen.',
    labs: 'Labore',
    glossary: 'Glossar',
    formulas: 'Formeln',
    search: 'Suche',
    markDone: 'Als abgeschlossen markieren',
    done: 'Abgeschlossen',
    menu: 'Menü',
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
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const progress = useProgress()

  const track = TRACKS.find((tr) => tr.modules.some((m) => m.path === location.pathname))
  const idx = track ? track.modules.findIndex((m) => m.path === location.pathname) : -1
  const prev = track && idx > 0 ? track.modules[idx - 1] : null
  const next = track && idx >= 0 && idx < track.modules.length - 1 ? track.modules[idx + 1] : null

  // scroll to top on navigation — or to a requested section (search/labs deep links)
  useEffect(() => {
    setDrawerOpen(false)
    const target = (location.state as { scrollTo?: string } | null)?.scrollTo
    if (!target) {
      window.scrollTo({ top: 0 })
      return
    }
    let tries = 0
    const iv = setInterval(() => {
      const el = document.getElementById(target)
      tries++
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        clearInterval(iv)
      } else if (tries > 20) clearInterval(iv)
    }, 150)
    return () => clearInterval(iv)
  }, [location.pathname, location.state])

  // keyboard shortcuts: Cmd/Ctrl+K or '/' → search; ←/→ → prev/next module
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      } else if (e.key === '/' && !typing && !searchOpen) {
        e.preventDefault()
        setSearchOpen(true)
      } else if (e.key === 'ArrowLeft' && !typing && !searchOpen && prev) {
        navigate(prev.path)
      } else if (e.key === 'ArrowRight' && !typing && !searchOpen && next) {
        navigate(next.path)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, searchOpen, navigate])

  const isDone = track && progress.has(location.pathname)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-bg/80 backdrop-blur-md print:hidden">
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
            <NavLink
              to="/labs"
              className={({ isActive }) =>
                `rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${
                  isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-white/5 hover:text-ink'
                }`
              }
            >
              🧪 {t.labs}
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[12px] text-muted transition hover:border-accent/50 hover:text-ink sm:flex"
            >
              🔍 {t.search}
              <kbd className="rounded border border-white/15 px-1 font-mono text-[10px]">⌘K</kbd>
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="cursor-pointer rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1 text-[13px] sm:hidden"
              aria-label={t.search}
            >
              🔍
            </button>
            <LangSwitch />
            <button
              onClick={() => setDrawerOpen(true)}
              className="cursor-pointer rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[15px] lg:hidden"
              aria-label={t.menu}
            >
              ☰
            </button>
          </div>
        </div>
      </header>

      {/* mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden" onPointerDown={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute inset-y-0 right-0 w-80 max-w-[85vw] overflow-y-auto border-l border-white/10 bg-[#0d1119] p-4"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {TRACKS.map((tr) => (
              <div key={tr.id} className="mb-4">
                <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">
                  {tr.icon} {tr.title[lang]}
                </div>
                {tr.modules.map((m) => (
                  <NavLink
                    key={m.path}
                    to={m.path}
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-1.5 text-[13.5px] ${
                        isActive ? 'bg-accent/15 text-accent' : 'text-ink/85 hover:bg-white/5'
                      }`
                    }
                  >
                    <span className="mr-1.5 font-mono text-[11px] opacity-50">{m.num}</span>
                    {m.short[lang]}
                    {progress.has(m.path) && <span className="ml-1.5 text-[11px] text-green-400">✓</span>}
                  </NavLink>
                ))}
              </div>
            ))}
            <div className="mt-5 border-t border-white/10 pt-3">
              {[
                { to: '/labs', label: `🧪 ${t.labs}` },
                { to: '/glossary', label: `📖 ${t.glossary}` },
                { to: '/formulas', label: `🧾 ${t.formulas}` },
              ].map((l) => (
                <NavLink key={l.to} to={l.to} className="block rounded-lg px-3 py-1.5 text-[13.5px] text-ink/85 hover:bg-white/5">
                  {l.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />

      <main>{children}</main>

      {track && (
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pb-10 print:hidden">
          {prev ? (
            <Link to={prev.path} className="btn">
              ← {t.prev}: {prev.short[lang]}
            </Link>
          ) : (
            <Link to="/" className="btn">
              ← {t.home}
            </Link>
          )}
          <button
            onClick={() => toggleCompleted(location.pathname)}
            className={`btn ${isDone ? 'border-green-400/50 bg-green-400/10 text-green-400' : ''}`}
          >
            {isDone ? `✓ ${t.done}` : `○ ${t.markDone}`}
          </button>
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

      <footer className="border-t border-white/10 py-8 text-center text-[13px] text-muted print:hidden">
        <div className="mx-auto max-w-6xl space-y-2 px-4">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
            <Link to="/labs" className="hover:text-ink">🧪 {t.labs}</Link>
            <Link to="/glossary" className="hover:text-ink">📖 {t.glossary}</Link>
            <Link to="/formulas" className="hover:text-ink">🧾 {t.formulas}</Link>
          </div>
          <div>{t.footer}</div>
        </div>
      </footer>
    </div>
  )
}
