import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Derivation } from '../components/Derivation'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Slider } from '../components/ui'
import { fmt, mulberry32 } from '../lib/math'
import { makeGauss, type P2 } from '../lib/stats'

const TRUE_A = -0.1
const TRUE_B = 0.55

const T = {
  en: {
    kicker: 'Data · Module 4',
    title: 'Robust Fitting & RANSAC',
    intro:
      'Every fitting method so far had a hidden assumption: all data points are honest. Real data lies — a glare pixel, a mismatched feature, a sensor glitch. Least squares, which squares errors, is catastrophically gullible: a single wild point can drag the whole fit away. Robust estimation is the immune system of data fitting, and RANSAC is its most famous antibody.',
    probTitle: 'The outlier problem',
    prob1: 'Squared loss grows quadratically, so the farther a point is, the MORE power it has over the fit — precisely backwards for outliers. Click into the lab below to add outliers and watch the amber least-squares line chase them while the truth stays put. In vision pipelines (feature matching!) 30–50 % outliers are routine; without robustness, nothing downstream survives.',
    labTitle: 'Interactive: RANSAC',
    lab1: 'RANSAC (random sample consensus) flips the logic: instead of using all points and hoping, it repeatedly fits a candidate model to a minimal random sample — two points define a line — and asks the rest of the data to vote: how many points lie within the threshold band? Wild hypotheses get no votes; a hypothesis from two inliers collects the whole inlier population. Keep the best, then refit least squares on its supporters only.',
    lab2: 'Press ▶ and watch hypotheses flicker: most are nonsense, some are gold. Add outliers by clicking — RANSAC shrugs where least squares panics. Then tighten or loosen the band: too tight rejects noisy inliers, too loose lets outliers vote.',
    addHint: 'click into the plot to add outliers',
    tau: 'inlier threshold τ',
    stepBtn: 'Hypothesis',
    runBtn: 'Run',
    pauseBtn: 'Pause',
    resetBtn: 'Reset data',
    iter: 'hypotheses tried',
    bestIn: 'best inlier count',
    slopes: 'slope: truth / RANSAC / LS',
    n99: 'N for 99 % success',
    derivTitle: 'How many iterations are enough?',
    deriv: [
      { tex: String.raw`P(\text{one sample all-inlier}) = w^{s}, \qquad w = \text{inlier fraction},\; s = 2 \text{ points}`, note: 'Both sampled points must be inliers for the hypothesis to be good; w is estimated from the best consensus so far (see readouts).' },
      { tex: String.raw`P(\text{all } N \text{ samples fail}) = (1 - w^{s})^{N} \;\overset{!}{\le}\; 1 - p`, note: 'Demand overall success probability p (say 99 %).' },
      { tex: String.raw`N \;\ge\; \frac{\log(1-p)}{\log(1 - w^{s})}`, note: 'The live readout computes exactly this with p = 0.99 and the current w — note how mild it is: even at 50 % outliers, a line needs only ~16 hypotheses.' },
    ],
    lossTitle: 'The gentler alternative: robust losses',
    loss1: 'RANSAC is a hard in/out vote. Robust losses soften it: keep least squares near zero error but let the penalty grow only linearly (Huber) or saturate entirely (Tukey, Cauchy) for large residuals — outliers keep a voice, but a quiet one. These kernels are exactly what bundle adjustment (Vision track) and the big optimization libraries plug into their least-squares machinery; RANSAC finds the inliers, a robust refinement polishes the answer.',
    lossSquared: 'squared',
    lossHuber: 'Huber',
    whereTitle: 'Where you will meet it',
    whereList: [
      'Homography and fundamental-matrix estimation (Vision track): feature matches are outlier-ridden; every panorama stitcher and SfM pipeline runs RANSAC before the least-squares refinement.',
      'Plane and primitive fitting in point clouds — including the cloud your laser scanner built in the Metrology track.',
      'Any sensor pipeline with gross errors: GPS jumps, radar ghosts, mismatched fiducials. If your residual histogram has heavy tails, you need this module.',
      'Rule of thumb: RANSAC for finding the consensus set, robust kernels for the final polish, plain least squares only after the outliers are gone.',
    ],
    codeTitle: 'In practice',
    appTitle: '🏭 In the real world: lane detection',
    appIntro:
      'A lane-keeping camera extracts bright edge points from every frame and must fit the lane line through them — while shadows, tar seams, guardrail reflections and old repainted markings all produce edge points too. Least squares averages over all of that clutter and steers the fit into the bushes; RANSAC finds the largest consensus among the points and locks onto the true marking. Crank up the clutter and compare the two lines — then imagine each of them steering your car at 130 km/h.',
    appClutter: 'clutter points',
    appThresh: 'inlier threshold',
    appInliers: 'RANSAC consensus',
    appErrRansac: 'lane-position error (RANSAC)',
    appErrLs: 'lane-position error (least squares)',
    appLegend: 'green = RANSAC · red dashed = least squares · dots = detected edge points',
    appWhere:
      'The same consensus trick locks onto runway edges for autonomous landing, pallet edges for forklift docking, weld seams for tracking torches, and floor planes in AR headsets.',
  },
  de: {
    kicker: 'Daten · Modul 4',
    title: 'Robustes Fitten & RANSAC',
    intro:
      'Jede bisherige Fitting-Methode hatte eine versteckte Annahme: Alle Datenpunkte sind ehrlich. Echte Daten lügen — ein Glanzpixel, ein falsch zugeordnetes Merkmal, ein Sensoraussetzer. Kleinste Quadrate, die Fehler quadrieren, sind katastrophal leichtgläubig: Ein einziger wilder Punkt kann den ganzen Fit wegziehen. Robuste Schätzung ist das Immunsystem des Datenfittens, und RANSAC ist sein berühmtester Antikörper.',
    probTitle: 'Das Ausreißerproblem',
    prob1: 'Quadratischer Verlust wächst quadratisch — je weiter ein Punkt weg ist, desto MEHR Macht hat er über den Fit: für Ausreißer genau verkehrt herum. Klicke unten ins Labor, füge Ausreißer hinzu und sieh zu, wie die bernsteinfarbene Kleinste-Quadrate-Gerade ihnen hinterherjagt, während die Wahrheit stehen bleibt. In Vision-Pipelines (Feature-Matching!) sind 30–50 % Ausreißer Routine; ohne Robustheit überlebt nichts danach.',
    labTitle: 'Interaktiv: RANSAC',
    lab1: 'RANSAC (Random Sample Consensus) dreht die Logik um: Statt alle Punkte zu nutzen und zu hoffen, passt es wiederholt ein Kandidatenmodell an eine minimale Zufallsstichprobe an — zwei Punkte definieren eine Gerade — und lässt den Rest der Daten abstimmen: Wie viele Punkte liegen im Schwellenband? Wilde Hypothesen bekommen keine Stimmen; eine Hypothese aus zwei Inliern sammelt die ganze Inlier-Population ein. Behalte die beste, dann fitte kleinste Quadrate nur auf ihren Unterstützern.',
    lab2: 'Drücke ▶ und sieh Hypothesen aufflackern: die meisten Unsinn, manche Gold. Füge per Klick Ausreißer hinzu — RANSAC zuckt mit den Schultern, wo kleinste Quadrate in Panik geraten. Verenge oder weite dann das Band: zu eng verwirft verrauschte Inlier, zu weit lässt Ausreißer mitstimmen.',
    addHint: 'in den Plot klicken, um Ausreißer hinzuzufügen',
    tau: 'Inlier-Schwelle τ',
    stepBtn: 'Hypothese',
    runBtn: 'Start',
    pauseBtn: 'Pause',
    resetBtn: 'Daten zurücksetzen',
    iter: 'getestete Hypothesen',
    bestIn: 'beste Inlier-Zahl',
    slopes: 'Steigung: Wahrheit / RANSAC / KQ',
    n99: 'N für 99 % Erfolg',
    derivTitle: 'Wie viele Iterationen genügen?',
    deriv: [
      { tex: String.raw`P(\text{Stichprobe rein aus Inliern}) = w^{s}, \qquad w = \text{Inlier-Anteil},\; s = 2 \text{ Punkte}`, note: 'Beide gezogenen Punkte müssen Inlier sein, damit die Hypothese gut ist; w wird aus dem bisher besten Konsens geschätzt (siehe Readouts).' },
      { tex: String.raw`P(\text{alle } N \text{ Stichproben scheitern}) = (1 - w^{s})^{N} \;\overset{!}{\le}\; 1 - p`, note: 'Fordere Gesamterfolgswahrscheinlichkeit p (etwa 99 %).' },
      { tex: String.raw`N \;\ge\; \frac{\log(1-p)}{\log(1 - w^{s})}`, note: 'Das Live-Readout rechnet exakt das mit p = 0,99 und dem aktuellen w — und wie mild es ist: Selbst bei 50 % Ausreißern braucht eine Gerade nur ~16 Hypothesen.' },
    ],
    lossTitle: 'Die sanftere Alternative: robuste Verlustfunktionen',
    loss1: 'RANSAC ist eine harte Drinnen/Draußen-Abstimmung. Robuste Verluste weichen sie auf: nahe null Fehler bleibt es bei kleinsten Quadraten, aber die Strafe wächst für große Residuen nur noch linear (Huber) oder sättigt ganz (Tukey, Cauchy) — Ausreißer behalten eine Stimme, aber eine leise. Genau diese Kerne stecken Bündelausgleich (Vision-Track) und die großen Optimierungsbibliotheken in ihre Kleinste-Quadrate-Maschinerie; RANSAC findet die Inlier, eine robuste Verfeinerung poliert die Antwort.',
    lossSquared: 'quadratisch',
    lossHuber: 'Huber',
    whereTitle: 'Wo es dir begegnet',
    whereList: [
      'Homographie- und Fundamentalmatrix-Schätzung (Vision-Track): Feature-Matches strotzen vor Ausreißern; jeder Panorama-Stitcher und jede SfM-Pipeline lässt RANSAC vor der Kleinste-Quadrate-Verfeinerung laufen.',
      'Ebenen- und Primitiv-Fitting in Punktwolken — auch in der Wolke, die dein Laserscanner im Messtechnik-Track gebaut hat.',
      'Jede Sensorpipeline mit groben Fehlern: GPS-Sprünge, Radar-Geister, falsch zugeordnete Marken. Hat dein Residuen-Histogramm schwere Ränder, brauchst du dieses Modul.',
      'Faustregel: RANSAC zum Finden der Konsensmenge, robuste Kerne für die Politur, reine kleinste Quadrate erst, wenn die Ausreißer weg sind.',
    ],
    codeTitle: 'In der Praxis',
    appTitle: '🏭 In der echten Welt: Spurerkennung',
    appIntro:
      'Eine Spurhaltekamera extrahiert aus jedem Frame helle Kantenpunkte und muss die Spurlinie hindurchfitten — während Schatten, Teernähte, Leitplankenreflexe und alte, übermalte Markierungen ebenfalls Kantenpunkte erzeugen. Kleinste Quadrate mitteln über all diesen Müll und lenken den Fit ins Gebüsch; RANSAC findet den größten Konsens unter den Punkten und rastet auf der echten Markierung ein. Dreh den Störpunkte-Regler hoch und vergleiche die beiden Linien — und stell dir dann vor, jede von ihnen lenkt dein Auto bei 130 km/h.',
    appClutter: 'Störpunkte',
    appThresh: 'Inlier-Schwelle',
    appInliers: 'RANSAC-Konsens',
    appErrRansac: 'Spurpositionsfehler (RANSAC)',
    appErrLs: 'Spurpositionsfehler (kleinste Quadrate)',
    appLegend: 'grün = RANSAC · rot gestrichelt = kleinste Quadrate · Punkte = erkannte Kantenpunkte',
    appWhere:
      'Derselbe Konsens-Trick rastet auf Landebahnkanten für autonome Landungen ein, auf Palettenkanten beim Stapler-Andocken, auf Schweißnähten für nachgeführte Brenner und auf Bodenebenen in AR-Headsets.',
  },
}

const SNIPPET = `import numpy as np
from sklearn.linear_model import RANSACRegressor, LinearRegression

ransac = RANSACRegressor(LinearRegression(),
                         residual_threshold=0.1, max_trials=100)
ransac.fit(X, y)
inliers = ransac.inlier_mask_

# OpenCV: the same idea for geometry
# H, mask = cv2.findHomography(pts1, pts2, cv2.RANSAC, 3.0)`

// ---------------------------------------------------------------- lab

const SW = 500
const SH = 420
const RNG = 1.6
const px = (x: number) => ((x + RNG) / (2 * RNG)) * SW
const py = (y: number) => SH - ((y + RNG) / (2 * RNG)) * SH

interface Hypo {
  a: number
  b: number
  inliers: number[]
}

function lsFit(pts: P2[]): { a: number; b: number } {
  const n = pts.length
  const mx = pts.reduce((s, p) => s + p[0], 0) / n
  const my = pts.reduce((s, p) => s + p[1], 0) / n
  let num = 0
  let den = 0
  for (const p of pts) {
    num += (p[0] - mx) * (p[1] - my)
    den += (p[0] - mx) ** 2
  }
  const b = den > 1e-12 ? num / den : 0
  return { a: my - b * mx, b }
}

function inliersOf(pts: P2[], a: number, b: number, tau: number): number[] {
  const denom = Math.sqrt(1 + b * b)
  return pts.map((_, i) => i).filter((i) => Math.abs(pts[i][1] - (a + b * pts[i][0])) / denom < tau)
}

function RansacLab() {
  const t = useT(T)
  const [tau, setTau] = useState(0.12)
  const [seed, setSeed] = useState(1)
  const [extra, setExtra] = useState<P2[]>([])
  const [state, setState] = useState<{ iter: number; best: Hypo | null; current: Hypo | null }>({
    iter: 0,
    best: null,
    current: null,
  })
  const [running, setRunning] = useState(false)
  const rngRef = useRef(mulberry32(99))
  const stRef = useRef(state)
  stRef.current = state

  const base = useMemo(() => {
    const g = makeGauss(seed * 17 + 1)
    const rand = mulberry32(seed * 31 + 2)
    const inl: P2[] = Array.from({ length: 40 }, () => {
      const x = -1.4 + rand() * 2.8
      return [x, TRUE_A + TRUE_B * x + g() * 0.06]
    })
    const out: P2[] = Array.from({ length: 12 }, () => [
      -1.5 + rand() * 3,
      -1.5 + rand() * 3,
    ])
    return [...inl, ...out]
  }, [seed])

  const pts = useMemo(() => [...base, ...extra], [base, extra])
  const ls = useMemo(() => lsFit(pts), [pts])

  const hypothesis = (): boolean => {
    const rand = rngRef.current
    let i = 0
    let j = 0
    let tries = 0
    do {
      i = Math.floor(rand() * pts.length)
      j = Math.floor(rand() * pts.length)
      tries++
    } while ((j === i || Math.abs(pts[i][0] - pts[j][0]) < 1e-3) && tries < 20)
    if (j === i) return true
    const b = (pts[j][1] - pts[i][1]) / (pts[j][0] - pts[i][0])
    const a = pts[i][1] - b * pts[i][0]
    const inl = inliersOf(pts, a, b, tau)
    const cur: Hypo = { a, b, inliers: inl }
    const prev = stRef.current
    const best = !prev.best || inl.length > prev.best.inliers.length ? cur : prev.best
    setState({ iter: prev.iter + 1, best, current: cur })
    return true
  }

  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => {
      hypothesis()
      if (stRef.current.iter > 120) setRunning(false)
    }, 160)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, tau, pts])

  // reset RANSAC when data or threshold changes
  useEffect(() => {
    setState({ iter: 0, best: null, current: null })
    setRunning(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, tau])

  const refined = useMemo(() => {
    if (!state.best || state.best.inliers.length < 2) return null
    return lsFit(state.best.inliers.map((i) => pts[i]))
  }, [state.best, pts])

  const w = state.best ? state.best.inliers.length / pts.length : 0
  const n99 = w > 0.02 && w < 1 ? Math.ceil(Math.log(0.01) / Math.log(1 - w * w)) : null

  const lineSeg = (a: number, b: number) =>
    `${px(-RNG)},${py(a + b * -RNG)} ${px(RNG)},${py(a + b * RNG)}`

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">
          {t.addHint}
        </div>
        <svg
          viewBox={`0 0 ${SW} ${SH}`}
          className="block w-full cursor-crosshair touch-none"
          style={{ background: 'radial-gradient(120% 120% at 50% 40%, #141a28 0%, #0a0e17 100%)' }}
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setExtra([
              ...extra,
              [
                ((e.clientX - rect.left) / rect.width) * 2 * RNG - RNG,
                RNG - ((e.clientY - rect.top) / rect.height) * 2 * RNG,
              ],
            ])
          }}
        >
          {/* current hypothesis band */}
          {state.current && (
            <g>
              <polyline points={lineSeg(state.current.a, state.current.b)} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.2} />
              <polyline points={lineSeg(state.current.a + tau * Math.sqrt(1 + state.current.b ** 2), state.current.b)} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="4 4" />
              <polyline points={lineSeg(state.current.a - tau * Math.sqrt(1 + state.current.b ** 2), state.current.b)} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="4 4" />
            </g>
          )}
          {/* points */}
          {pts.map((p, i) => {
            const inCur = state.current?.inliers.includes(i)
            return (
              <circle
                key={i}
                cx={px(p[0])}
                cy={py(p[1])}
                r={inCur ? 4.6 : 3.4}
                fill={inCur ? '#4ade80' : '#22d3ee'}
                opacity={inCur ? 1 : 0.7}
                stroke="#0a0e17"
                strokeWidth={1}
              />
            )
          })}
          {/* LS fit (corrupted) */}
          <polyline points={lineSeg(ls.a, ls.b)} fill="none" stroke="#fbbf24" strokeWidth={2.2} />
          {/* RANSAC refined */}
          {refined && <polyline points={lineSeg(refined.a, refined.b)} fill="none" stroke="#4ade80" strokeWidth={2.6} />}
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.tau} value={tau} min={0.03} max={0.3} step={0.005} onChange={setTau} format={(v) => fmt(v, 3)} accent="#4ade80" />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setRunning(!running)}>
              {running ? `⏸ ${t.pauseBtn}` : `▶ ${t.runBtn}`}
            </button>
            <button className="btn" onClick={hypothesis}>
              🎲 {t.stepBtn}
            </button>
            <button
              className="btn"
              onClick={() => {
                setExtra([])
                setSeed((s) => s + 1)
              }}
            >
              ↺ {t.resetBtn}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.iter} value={`${state.iter}`} />
          <Readout label={t.bestIn} value={state.best ? `${state.best.inliers.length} / ${pts.length}` : '—'} accent="#4ade80" />
          <Readout
            label={t.slopes}
            value={`${fmt(TRUE_B, 2)} / ${refined ? fmt(refined.b, 2) : '—'} / ${fmt(ls.b, 2)}`}
          />
          <Readout label={t.n99} value={n99 !== null ? `${n99}` : '—'} accent="#a78bfa" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- robust losses figure

function LossFigure() {
  const t = useT(T)
  const PW = 480
  const PH = 220
  const rMax = 3
  const px2 = (r: number) => ((r + rMax) / (2 * rMax)) * PW
  const py2 = (v: number) => PH - 16 - (v / 4.5) * (PH - 32)
  const huber = (r: number) => (Math.abs(r) <= 1 ? 0.5 * r * r : Math.abs(r) - 0.5)
  return (
    <div className="card max-w-xl overflow-hidden">
      <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
        <polyline
          points={Array.from({ length: 140 }, (_, i) => {
            const r = -rMax + (i / 139) * 2 * rMax
            return `${px2(r)},${py2(0.5 * r * r)}`
          }).join(' ')}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={2}
        />
        <polyline
          points={Array.from({ length: 140 }, (_, i) => {
            const r = -rMax + (i / 139) * 2 * rMax
            return `${px2(r)},${py2(huber(r))}`
          }).join(' ')}
          fill="none"
          stroke="#4ade80"
          strokeWidth={2.4}
        />
        <line x1={0} y1={py2(0)} x2={PW} y2={py2(0)} stroke="rgba(255,255,255,0.15)" />
        <text x={PW - 12} y={26} textAnchor="end" fill="#fbbf24" fontSize={12} fontFamily="JetBrains Mono, monospace">
          {t.lossSquared}
        </text>
        <text x={PW - 12} y={44} textAnchor="end" fill="#4ade80" fontSize={12} fontFamily="JetBrains Mono, monospace">
          {t.lossHuber}
        </text>
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------- application: lane detection

const LANE_W = 520
const LANE_H = 300
const HORIZON = 100
// true right lane edge in image coords: x = LANE_X0 + LANE_SLOPE · (y − horizon)
const LANE_X0 = 285
const LANE_SLOPE = 0.78

function laneFitLs(pts: P2[]): { m: number; c: number } {
  // fit x = m·y + c
  const n = pts.length
  const sy = pts.reduce((s, p) => s + p[1], 0)
  const sx = pts.reduce((s, p) => s + p[0], 0)
  const syy = pts.reduce((s, p) => s + p[1] * p[1], 0)
  const sxy = pts.reduce((s, p) => s + p[0] * p[1], 0)
  const m = (n * sxy - sy * sx) / Math.max(n * syy - sy * sy, 1e-9)
  return { m, c: (sx - m * sy) / n }
}

function LaneLab() {
  const t = useT(T)
  const [clutter, setClutter] = useState(30)
  const [thresh, setThresh] = useState(8)

  const pts = useMemo(() => {
    const g = makeGauss(5)
    const rand = mulberry32(11)
    const out: P2[] = []
    for (let i = 0; i < 26; i++) {
      const y = HORIZON + 12 + ((LANE_H - HORIZON - 20) / 25) * i
      out.push([LANE_X0 + LANE_SLOPE * (y - HORIZON) + g() * 3, y])
    }
    for (let i = 0; i < clutter; i++) {
      const y = HORIZON + 10 + rand() * (LANE_H - HORIZON - 20)
      const halfRoad = 40 + 1.6 * (y - HORIZON)
      out.push([LANE_W / 2 - 60 + (rand() - 0.35) * halfRoad * 1.6, y])
    }
    return out
  }, [clutter])

  const { ransac, inliers, ls } = useMemo(() => {
    const rand = mulberry32(97)
    let best = { m: 0, c: 0 }
    let bestCount = -1
    for (let it = 0; it < 250; it++) {
      const i = Math.floor(rand() * pts.length)
      let j = Math.floor(rand() * pts.length)
      if (j === i) j = (j + 1) % pts.length
      const [x1, y1] = pts[i]
      const [x2, y2] = pts[j]
      if (Math.abs(y2 - y1) < 8) continue
      const m = (x2 - x1) / (y2 - y1)
      const c = x1 - m * y1
      const count = pts.filter((p) => Math.abs(p[0] - (m * p[1] + c)) < thresh).length
      if (count > bestCount) {
        bestCount = count
        best = { m, c }
      }
    }
    return { ransac: best, inliers: bestCount, ls: laneFitLs(pts) }
  }, [pts, thresh])

  const laneX = (y: number) => LANE_X0 + LANE_SLOPE * (y - HORIZON)
  const errAt = (fit: { m: number; c: number }) => Math.abs(fit.m * LANE_H + fit.c - laneX(LANE_H))
  const errR = errAt(ransac)
  const errL = errAt(ls)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${LANE_W} ${LANE_H}`} className="block w-full">
          {/* sky + road */}
          <rect width={LANE_W} height={HORIZON} fill="#141a28" />
          <polygon
            points={`${LANE_W / 2 - 95},${HORIZON} ${LANE_W / 2 + 45},${HORIZON} ${LANE_W - 30},${LANE_H} -80,${LANE_H}`}
            fill="#1a2030"
          />
          {/* center dashes */}
          {[0, 1, 2, 3].map((i) => {
            const y1 = HORIZON + 22 + i * 48
            return <line key={i} x1={185 - i * 26} y1={y1} x2={177 - i * 34} y2={y1 + 26} stroke="#8b93a733" strokeWidth={4 + i} />
          })}
          {/* edge points */}
          {pts.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r={2.8} fill="#22d3ee99" />
          ))}
          {/* LS line */}
          <line x1={ls.m * HORIZON + ls.c} y1={HORIZON} x2={ls.m * LANE_H + ls.c} y2={LANE_H} stroke="#f87171" strokeWidth={2} strokeDasharray="7 5" />
          {/* RANSAC line */}
          <line x1={ransac.m * HORIZON + ransac.c} y1={HORIZON} x2={ransac.m * LANE_H + ransac.c} y2={LANE_H} stroke="#4ade80" strokeWidth={2.5} />
        </svg>
        <div className="border-t border-white/10 px-4 py-2 text-[12px] text-muted">{t.appLegend}</div>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.appClutter} value={clutter} min={0} max={70} step={1} onChange={setClutter} />
          <Slider label={t.appThresh} value={thresh} min={3} max={25} step={1} onChange={setThresh} format={(v) => `${v} px`} accent="#a78bfa" />
        </div>
        <div className="grid grid-cols-1 gap-3">
          <Readout label={t.appInliers} value={`${inliers} / ${pts.length}`} />
          <Readout label={t.appErrRansac} value={fmt(errR, 1)} unit="px" accent={errR < 10 ? '#4ade80' : '#f87171'} />
          <Readout label={t.appErrLs} value={fmt(errL, 1)} unit="px" accent={errL < 10 ? '#4ade80' : '#f87171'} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function RansacPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'problem', label: t.probTitle },
          { id: 'lab', label: t.labTitle },
          { id: 'losses', label: t.lossTitle },
          { id: 'where', label: t.whereTitle },
          { id: 'code', label: t.codeTitle },
          { id: 'application', label: t.appTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="problem" title={t.probTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.prob1}</p>
        </div>
      </Section>

      <Section id="lab" title={t.labTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.lab1}</p>
          <p>{t.lab2}</p>
        </div>
        <div className="mt-4">
          <RansacLab />
        </div>
        <Derivation title={t.derivTitle} steps={t.deriv} />
      </Section>

      <Section id="losses" title={t.lossTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.loss1}</p>
        </div>
        <div className="mt-4">
          <LossFigure />
        </div>
      </Section>

      <Section id="where" title={t.whereTitle}>
        <div className="prose-cv max-w-3xl">
          <ul>
            {t.whereList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="code" title={t.codeTitle}>
        <pre className="card overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-ink/85">{SNIPPET}</pre>
      </Section>

      <Section id="application" title={t.appTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.appIntro}</p>
        </div>
        <div className="mt-4">
          <LaneLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
