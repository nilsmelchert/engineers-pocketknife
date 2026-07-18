import { useMemo, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { Derivation } from '../components/Derivation'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Slider } from '../components/ui'
import { fmt } from '../lib/math'
import { eulerStep, rk4Step } from '../lib/signal'

const T = {
  en: {
    kicker: 'Math · Module 3',
    title: 'ODE Solvers & Simulation',
    intro:
      'Every simulation on this site — the PID plant, the Kalman target, the robot replay — is secretly doing the same thing: advancing a differential equation one small step at a time. How you take that step decides whether your simulation is physics or fiction. This module is about taking steps honestly.',
    ideaTitle: 'Simulation = integrating an ODE',
    idea1: 'Physics gives you derivatives: F = ma tells you the acceleration, not the trajectory. A solver turns the local slope into a global path by stepping: from the current state, estimate the change over a small h, add it, repeat ten thousand times. The subtlety: the slope changes during the step, and how well a method accounts for that is its entire quality.',
    orbitTitle: 'Interactive: Euler vs. Runge-Kutta on an oscillator',
    orbit1: 'The harmonic oscillator x″ = −x is the perfect stress test because its exact solution is known: circles in phase space (position vs. velocity), forever, with constant energy. Explicit Euler follows the tangent at the step start — always pointing outward from a circle — so it spirals out, injecting energy from nothing. Classic RK4 samples the slope four times per step and cancels the error to fourth order: at the same step size its circle is indistinguishable from truth. Widen h and watch the fiction grow.',
    hLabel: 'step size h',
    phaseTitle: 'phase space (x, v) — truth dashed',
    energyTitle: 'energy over time',
    eulerDrift: 'Euler energy drift',
    rk4Drift: 'RK4 energy drift',
    evals: 'slope evaluations',
    orbitDerivTitle: 'Why Euler spirals and RK4 does not',
    orbitDeriv: [
      { tex: String.raw`\begin{bmatrix}x\\v\end{bmatrix}_{n+1} = \begin{bmatrix}1 & h\\ -h & 1\end{bmatrix}\begin{bmatrix}x\\v\end{bmatrix}_n \quad\Rightarrow\quad E_{n+1} = (1+h^2)\,E_n`, note: 'One Euler step on the oscillator multiplies the energy by exactly 1 + h² — always greater than 1. The outward spiral in the phase plot is this factor, compounded every step.' },
      { tex: String.raw`\text{Euler: local error } O(h^2),\; \text{global } O(h) \qquad \text{RK4: local } O(h^5),\; \text{global } O(h^4)`, note: 'RK4’s four slope samples emulate a Taylor expansion to 4th order. Halving h buys Euler 2× accuracy but RK4 16× — which is why RK4 wins even though each step costs 4 evaluations.' },
    ],
    stabTitle: 'Interactive: stability — when the solver explodes',
    stab1: 'Accuracy is not the only failure mode. Take the simplest decay y′ = −λy (a hot part cooling, a discharging capacitor): the truth dies smoothly to zero. Explicit Euler multiplies y by (1 − hλ) each step — and if that factor leaves (−1, 1), the numerical solution oscillates or blows up while the real system is perfectly calm. Slide h across the two boundaries and watch all three regimes: smooth, ringing, exploding.',
    lamNote: 'λ = 3 → monotone below h = 0.33, oscillating below h = 0.67, divergent above',
    stabState: 'regime',
    regimes: ['smooth ✓', 'oscillating decay', 'DIVERGENT 💥'],
    stabDerivTitle: 'The stability bound, exactly',
    stabDeriv: [
      { tex: String.raw`y_{n+1} = y_n + h(-\lambda y_n) = (1 - h\lambda)\, y_n \quad\Rightarrow\quad y_n = (1-h\lambda)^n y_0`, note: 'Euler on the decay equation is just repeated multiplication by the amplification factor (1 − hλ).' },
      { tex: String.raw`|1 - h\lambda| < 1 \quad\Longleftrightarrow\quad 0 < h < \frac{2}{\lambda}`, note: 'The exact slider threshold: h > 2/λ makes the factor smaller than −1 — sign-flipping growth. Between 1/λ and 2/λ the factor is negative but shrinking: the ringing regime.' },
      { tex: String.raw`\text{stiff systems: } \lambda_{\max} \gg \lambda_{\text{interest}} \;\Rightarrow\; h \text{ enslaved to } \frac{2}{\lambda_{\max}}`, note: 'When a system contains one fast-decaying mode, the stability of that mode dictates a tiny h even though it is boring — the definition of stiffness, and the reason implicit solvers exist.' },
    ],
    tableTitle: 'Choosing a solver',
    tableHead: ['method', 'order', 'cost/step', 'use when'],
    tableRows: [
      ['explicit Euler', '1', '1 eval', 'quick prototypes, real-time with tiny h — or never'],
      ['RK4', '4', '4 evals', 'the workhorse for smooth, non-stiff systems'],
      ['adaptive RK (RK45)', '4/5', 'varies', 'unknown scales — the solver picks h itself (scipy default)'],
      ['implicit (BDF, backward Euler)', '1–5', 'solve per step', 'stiff systems: chemistry, circuits, contact mechanics'],
    ],
    table2: 'The PID plant of the Control module integrates with small fixed steps — fine, because the sim is designed non-stiff. The moment you simulate a real system, check stiffness first and let an adaptive solver choose the step.',
    codeTitle: 'In practice',
    appTitle: '🏭 In the real world: tuning a suspension over a pothole',
    appIntro:
      'Before a single prototype shock absorber is machined, suspension engineers drive a quarter-car model — one wheel, a spring, a damper, a quarter of the body mass — over virtual road bumps, exactly the RK4 integration of this module. Two numbers decide the character of the car: peak body acceleration (what your spine feels) and how quickly the oscillation dies (how long the tire load stays predictable). Tune the damper: too soft and the body floats and wallows for meters; too hard and the bump hits your passengers unfiltered. The sweet spot in between is what ride engineers are paid to find — here you can find it in thirty seconds.',
    appDamp: 'damper c',
    appStiff: 'spring k',
    appPeak: 'peak body acceleration',
    appSettle: 'settling time',
    appVerdict: 'ride verdict',
    appSoft: 'wallowing',
    appGood: 'COMFORT ✓',
    appHard: 'harsh',
    appLegend: 'gray = road profile (8 cm bump) · cyan = body height, RK4-integrated',
    appWhere:
      'The same quarter-car-and-integrator loop tunes train bogies, aircraft landing gear, washing-machine suspensions and seismic building dampers — and the identical RK4 core propagates satellites and simulates every battery model in a BMS.',
  },
  de: {
    kicker: 'Mathe · Modul 3',
    title: 'ODE-Löser & Simulation',
    intro:
      'Jede Simulation auf dieser Seite — die PID-Strecke, das Kalman-Ziel, das Roboter-Replay — tut insgeheim dasselbe: Sie schreibt eine Differentialgleichung in kleinen Schritten fort. Wie man diesen Schritt macht, entscheidet, ob die Simulation Physik ist oder Fiktion. Dieses Modul handelt vom ehrlichen Schrittemachen.',
    ideaTitle: 'Simulation = eine ODE integrieren',
    idea1: 'Die Physik liefert Ableitungen: F = ma gibt die Beschleunigung, nicht die Bahn. Ein Löser macht aus der lokalen Steigung einen globalen Pfad durch Schreiten: Vom aktuellen Zustand die Änderung über ein kleines h schätzen, addieren, zehntausendmal wiederholen. Die Feinheit: Die Steigung ändert sich während des Schritts, und wie gut eine Methode das berücksichtigt, ist ihre gesamte Qualität.',
    orbitTitle: 'Interaktiv: Euler vs. Runge-Kutta am Oszillator',
    orbit1: 'Der harmonische Oszillator x″ = −x ist der perfekte Stresstest, denn seine exakte Lösung ist bekannt: Kreise im Phasenraum (Ort gegen Geschwindigkeit), für immer, mit konstanter Energie. Das explizite Euler-Verfahren folgt der Tangente am Schrittanfang — die von einem Kreis immer nach außen zeigt — und spiralt daher hinaus, Energie aus dem Nichts. Das klassische RK4 tastet die Steigung viermal pro Schritt ab und löscht den Fehler bis zur vierten Ordnung: Bei gleicher Schrittweite ist sein Kreis von der Wahrheit nicht zu unterscheiden. Vergrößere h und sieh die Fiktion wachsen.',
    hLabel: 'Schrittweite h',
    phaseTitle: 'Phasenraum (x, v) — Wahrheit gestrichelt',
    energyTitle: 'Energie über der Zeit',
    eulerDrift: 'Euler-Energiedrift',
    rk4Drift: 'RK4-Energiedrift',
    evals: 'Steigungsauswertungen',
    orbitDerivTitle: 'Warum Euler spiralt und RK4 nicht',
    orbitDeriv: [
      { tex: String.raw`\begin{bmatrix}x\\v\end{bmatrix}_{n+1} = \begin{bmatrix}1 & h\\ -h & 1\end{bmatrix}\begin{bmatrix}x\\v\end{bmatrix}_n \quad\Rightarrow\quad E_{n+1} = (1+h^2)\,E_n`, note: 'Ein Euler-Schritt am Oszillator multipliziert die Energie mit exakt 1 + h² — immer größer als 1. Die Auswärtsspirale im Phasenplot ist dieser Faktor, in jedem Schritt aufgezinst.' },
      { tex: String.raw`\text{Euler: lokaler Fehler } O(h^2),\; \text{global } O(h) \qquad \text{RK4: lokal } O(h^5),\; \text{global } O(h^4)`, note: 'Die vier Steigungsproben von RK4 emulieren eine Taylor-Entwicklung 4. Ordnung. h zu halbieren bringt Euler 2× Genauigkeit, RK4 aber 16× — deshalb gewinnt RK4, obwohl jeder Schritt 4 Auswertungen kostet.' },
    ],
    stabTitle: 'Interaktiv: Stabilität — wenn der Löser explodiert',
    stab1: 'Genauigkeit ist nicht der einzige Fehlermodus. Nimm den einfachsten Zerfall y′ = −λy (ein heißes Teil kühlt ab, ein Kondensator entlädt sich): Die Wahrheit stirbt glatt gegen null. Das explizite Euler-Verfahren multipliziert y in jedem Schritt mit (1 − hλ) — und verlässt dieser Faktor (−1, 1), oszilliert oder explodiert die numerische Lösung, während das reale System völlig ruhig ist. Schiebe h über die beiden Grenzen und sieh alle drei Regime: glatt, klingelnd, explodierend.',
    lamNote: 'λ = 3 → monoton unter h = 0,33, oszillierend unter h = 0,67, divergent darüber',
    stabState: 'Regime',
    regimes: ['glatt ✓', 'oszillierender Zerfall', 'DIVERGENT 💥'],
    stabDerivTitle: 'Die Stabilitätsgrenze, exakt',
    stabDeriv: [
      { tex: String.raw`y_{n+1} = y_n + h(-\lambda y_n) = (1 - h\lambda)\, y_n \quad\Rightarrow\quad y_n = (1-h\lambda)^n y_0`, note: 'Euler an der Zerfallsgleichung ist bloß wiederholte Multiplikation mit dem Verstärkungsfaktor (1 − hλ).' },
      { tex: String.raw`|1 - h\lambda| < 1 \quad\Longleftrightarrow\quad 0 < h < \frac{2}{\lambda}`, note: 'Die exakte Slider-Schwelle: h > 2/λ macht den Faktor kleiner als −1 — vorzeichenwechselndes Wachstum. Zwischen 1/λ und 2/λ ist der Faktor negativ, aber schrumpfend: das Klingel-Regime.' },
      { tex: String.raw`\text{steife Systeme: } \lambda_{\max} \gg \lambda_{\text{interessant}} \;\Rightarrow\; h \text{ versklavt an } \frac{2}{\lambda_{\max}}`, note: 'Enthält ein System einen schnell zerfallenden Modus, diktiert dessen Stabilität ein winziges h, obwohl er langweilig ist — die Definition von Steifheit und der Grund für implizite Löser.' },
    ],
    tableTitle: 'Die Löserwahl',
    tableHead: ['Methode', 'Ordnung', 'Kosten/Schritt', 'wann'],
    tableRows: [
      ['explizites Euler', '1', '1 Auswertung', 'schnelle Prototypen, Echtzeit mit winzigem h — oder nie'],
      ['RK4', '4', '4 Auswertungen', 'das Arbeitspferd für glatte, nicht-steife Systeme'],
      ['adaptives RK (RK45)', '4/5', 'variabel', 'unbekannte Skalen — der Löser wählt h selbst (scipy-Standard)'],
      ['implizit (BDF, Rückwärts-Euler)', '1–5', 'Gleichungslösen pro Schritt', 'steife Systeme: Chemie, Schaltungen, Kontaktmechanik'],
    ],
    table2: 'Die PID-Strecke des Regelungsmoduls integriert mit kleinen festen Schritten — in Ordnung, weil die Simulation bewusst nicht-steif entworfen ist. Sobald du ein echtes System simulierst: erst Steifheit prüfen und einen adaptiven Löser die Schrittweite wählen lassen.',
    codeTitle: 'In der Praxis',
    appTitle: '🏭 In der echten Welt: ein Fahrwerk über ein Schlagloch abstimmen',
    appIntro:
      'Bevor ein einziger Prototypen-Stoßdämpfer gefertigt wird, fahren Fahrwerksingenieure ein Viertelfahrzeugmodell — ein Rad, eine Feder, ein Dämpfer, ein Viertel der Karosseriemasse — über virtuelle Fahrbahnstöße, exakt die RK4-Integration dieses Moduls. Zwei Zahlen entscheiden den Charakter des Autos: die maximale Aufbaubeschleunigung (was deine Wirbelsäule spürt) und wie schnell die Schwingung abklingt (wie lange die Radlast berechenbar bleibt). Stimme den Dämpfer ab: zu weich, und der Aufbau schwimmt und schaukelt meterlang; zu hart, und der Stoß trifft die Passagiere ungefiltert. Der Sweet Spot dazwischen ist das, wofür Fahrkomfort-Ingenieure bezahlt werden — hier findest du ihn in dreißig Sekunden.',
    appDamp: 'Dämpfer c',
    appStiff: 'Feder k',
    appPeak: 'max. Aufbaubeschleunigung',
    appSettle: 'Beruhigungszeit',
    appVerdict: 'Fahrkomfort-Urteil',
    appSoft: 'schaukelt',
    appGood: 'KOMFORT ✓',
    appHard: 'hart',
    appLegend: 'grau = Fahrbahnprofil (8-cm-Stoß) · cyan = Aufbauhöhe, RK4-integriert',
    appWhere:
      'Dieselbe Viertelfahrzeug-und-Integrator-Schleife stimmt Drehgestelle von Zügen, Flugzeugfahrwerke, Waschmaschinen-Aufhängungen und seismische Gebäudedämpfer ab — und derselbe RK4-Kern propagiert Satelliten und simuliert jedes Batteriemodell in einem BMS.',
  },
}

const SNIPPET = `from scipy.integrate import solve_ivp

def f(t, y):                      # harmonic oscillator: y = [x, v]
    return [y[1], -y[0]]

sol = solve_ivp(f, (0, 50), [1, 0],
                method="RK45", rtol=1e-8)   # adaptive step size
# stiff system? -> method="BDF" or "Radau"`

// ---------------------------------------------------------------- orbit lab

const OSC = (_t: number, y: number[]): number[] => [y[1], -y[0]]

function OrbitLab() {
  const t = useT(T)
  const [h, setH] = useState(0.22)

  const { euler, rk4, energyE, energyR, n } = useMemo(() => {
    const T_END = 40
    const n = Math.min(Math.ceil(T_END / h), 3000)
    let ye = [1, 0]
    let yr = [1, 0]
    const euler: [number, number][] = [[1, 0]]
    const rk4: [number, number][] = [[1, 0]]
    const energyE: number[] = [0.5]
    const energyR: number[] = [0.5]
    for (let i = 0; i < n; i++) {
      ye = eulerStep(OSC, i * h, ye, h)
      yr = rk4Step(OSC, i * h, yr, h)
      euler.push([ye[0], ye[1]])
      rk4.push([yr[0], yr[1]])
      energyE.push(0.5 * (ye[0] ** 2 + ye[1] ** 2))
      energyR.push(0.5 * (yr[0] ** 2 + yr[1] ** 2))
    }
    return { euler, rk4, energyE, energyR, n }
  }, [h])

  const PW = 440
  const PH = 420
  const R = Math.min(Math.max(...euler.map((p) => Math.hypot(p[0], p[1]))) * 1.05, 6)
  const px = (x: number) => ((x + R) / (2 * R)) * PW
  const py = (y: number) => PH - ((y + R) / (2 * R)) * PH

  const EW = 460
  const EH = 190
  const maxE = Math.min(Math.max(...energyE), 12)
  const ex = (i: number) => (i / (energyE.length - 1)) * EW
  const ey = (v: number) => EH - 14 - (Math.min(v, maxE) / maxE) * (EH - 28)

  const driftE = ((energyE[energyE.length - 1] - 0.5) / 0.5) * 100
  const driftR = ((energyR[energyR.length - 1] - 0.5) / 0.5) * 100

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-2">
        <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.phaseTitle}</div>
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          <circle cx={px(0)} cy={py(0)} r={(1 / (2 * R)) * PW} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} strokeDasharray="5 4" />
          <polyline points={euler.map((p) => `${px(p[0])},${py(p[1])}`).join(' ')} fill="none" stroke="#22d3ee" strokeWidth={1.4} opacity={0.9} />
          <polyline points={rk4.map((p) => `${px(p[0])},${py(p[1])}`).join(' ')} fill="none" stroke="#4ade80" strokeWidth={2} />
        </svg>
      </div>
      <div className="flex flex-col gap-3 lg:col-span-3">
        <div className="card overflow-hidden">
          <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.energyTitle}</div>
          <svg viewBox={`0 0 ${EW} ${EH}`} className="block w-full">
            <line x1={0} y1={ey(0.5)} x2={EW} y2={ey(0.5)} stroke="rgba(255,255,255,0.3)" strokeDasharray="5 4" />
            <polyline points={energyE.map((v, i) => `${ex(i)},${ey(v)}`).join(' ')} fill="none" stroke="#22d3ee" strokeWidth={1.6} />
            <polyline points={energyR.map((v, i) => `${ex(i)},${ey(v)}`).join(' ')} fill="none" stroke="#4ade80" strokeWidth={2} />
          </svg>
        </div>
        <div className="card-pad">
          <Slider label={t.hLabel} value={h} min={0.02} max={0.5} step={0.005} onChange={setH} format={(v) => fmt(v, 3)} accent="#fbbf24" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Readout label={t.eulerDrift} value={`+${fmt(driftE, 0)}`} unit="%" accent="#22d3ee" />
          <Readout label={t.rk4Drift} value={fmt(driftR, 4)} unit="%" accent="#4ade80" />
          <Readout label={t.evals} value={`${n} / ${4 * n}`} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- stability lab

const LAM = 3

function StabilityLab() {
  const t = useT(T)
  const [h, setH] = useState(0.2)

  const { pts, truth } = useMemo(() => {
    const T_END = 5
    const n = Math.ceil(T_END / h)
    let y = 1
    const pts: [number, number][] = [[0, 1]]
    for (let i = 0; i < n; i++) {
      y = y * (1 - h * LAM)
      pts.push([(i + 1) * h, y])
    }
    const truth = Array.from({ length: 120 }, (_, i) => {
      const tt = (i / 119) * T_END
      return [tt, Math.exp(-LAM * tt)] as [number, number]
    })
    return { pts, truth }
  }, [h])

  const regime = h < 1 / LAM ? 0 : h < 2 / LAM ? 1 : 2
  const PW = 540
  const PH = 260
  const yMax = Math.min(Math.max(...pts.map((p) => Math.abs(p[1])), 1) * 1.1, 8)
  const px = (tt: number) => (tt / 5) * PW
  const py = (v: number) => PH / 2 - (Math.max(-yMax, Math.min(yMax, v)) / yMax) * (PH / 2 - 12)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          <line x1={0} y1={py(0)} x2={PW} y2={py(0)} stroke="rgba(255,255,255,0.15)" />
          <polyline points={truth.map(([tt, v]) => `${px(tt)},${py(v)}`).join(' ')} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} strokeDasharray="5 4" />
          <polyline points={pts.map(([tt, v]) => `${px(tt)},${py(v)}`).join(' ')} fill="none" stroke={regime === 2 ? '#f87171' : regime === 1 ? '#fbbf24' : '#4ade80'} strokeWidth={2} />
          {pts.map(([tt, v], i) => (
            <circle key={i} cx={px(tt)} cy={py(v)} r={3} fill={regime === 2 ? '#f87171' : regime === 1 ? '#fbbf24' : '#4ade80'} />
          ))}
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3">
          <Slider label={t.hLabel} value={h} min={0.05} max={1} step={0.005} onChange={setH} format={(v) => fmt(v, 3)} accent="#fbbf24" />
          <div className="text-[12px] text-muted">{t.lamNote}</div>
        </div>
        <Readout
          label={t.stabState}
          value={t.regimes[regime]}
          accent={regime === 0 ? '#4ade80' : regime === 1 ? '#fbbf24' : '#f87171'}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- application: suspension

const SUSP_M = 300 // kg, quarter body mass
const BUMP_H = 0.08
const BUMP_T0 = 0.4
const BUMP_D = 0.22

function roadZ(time: number): number {
  if (time < BUMP_T0 || time > BUMP_T0 + BUMP_D) return 0
  return (BUMP_H / 2) * (1 - Math.cos((2 * Math.PI * (time - BUMP_T0)) / BUMP_D))
}
function roadV(time: number): number {
  if (time < BUMP_T0 || time > BUMP_T0 + BUMP_D) return 0
  return ((BUMP_H * Math.PI) / BUMP_D) * Math.sin((2 * Math.PI * (time - BUMP_T0)) / BUMP_D)
}

function SuspensionLab() {
  const t = useT(T)
  const [c, setC] = useState(900)
  const [k, setK] = useState(30000)

  const { ts, zs, peakAcc, settle } = useMemo(() => {
    const f = (time: number, y: number[]) => {
      const acc = (-k * (y[0] - roadZ(time)) - c * (y[1] - roadV(time))) / SUSP_M
      return [y[1], acc]
    }
    const dt = 0.004
    const TEND = 3.5
    let y = [0, 0]
    const ts2: number[] = []
    const zs2: number[] = []
    let peak = 0
    let lastBig = 0
    for (let time = 0; time <= TEND; time += dt) {
      ts2.push(time)
      zs2.push(y[0])
      const acc = (-k * (y[0] - roadZ(time)) - c * (y[1] - roadV(time))) / SUSP_M
      if (time > BUMP_T0) peak = Math.max(peak, Math.abs(acc))
      if (Math.abs(y[0]) > 0.005) lastBig = time
      y = rk4Step(f, time, y, dt)
    }
    return { ts: ts2, zs: zs2, peakAcc: peak, settle: Math.max(0, lastBig - BUMP_T0) }
  }, [c, k])

  const good = peakAcc < 4 && settle < 1.2
  const verdict = good ? t.appGood : peakAcc >= 4 ? t.appHard : t.appSoft
  const color = good ? '#4ade80' : '#f87171'

  const PW = 560
  const PH = 240
  const sx = (time: number) => (time / 3.5) * PW
  const sy = (z: number) => PH / 2 + 30 - z * 1400

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          <polyline
            points={ts.map((time, i) => `${sx(time)},${sy(roadZ(ts[i]))}`).join(' ')}
            fill="none"
            stroke="#5b6270"
            strokeWidth={1.4}
          />
          <polyline points={ts.map((time, i) => `${sx(time)},${sy(zs[i])}`).join(' ')} fill="none" stroke="#22d3ee" strokeWidth={2} />
          <text x={PW - 10} y={20} textAnchor="end" fill={color} fontSize={13} fontWeight={700} fontFamily="JetBrains Mono, monospace">
            {verdict}
          </text>
        </svg>
        <div className="border-t border-white/10 px-4 py-2 text-[12px] text-muted">{t.appLegend}</div>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.appDamp} value={c} min={200} max={6000} step={50} onChange={setC} format={(v) => `${v} N·s/m`} />
          <Slider label={t.appStiff} value={k} min={15000} max={60000} step={1000} onChange={setK} format={(v) => `${v / 1000} kN/m`} accent="#a78bfa" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.appPeak} value={fmt(peakAcc, 1)} unit="m/s²" accent={peakAcc < 4 ? '#4ade80' : '#f87171'} />
          <Readout label={t.appSettle} value={fmt(settle, 2)} unit="s" accent={settle < 1.2 ? '#4ade80' : '#f87171'} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function OdePage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'idea', label: t.ideaTitle },
          { id: 'orbit', label: t.orbitTitle },
          { id: 'stability', label: t.stabTitle },
          { id: 'table', label: t.tableTitle },
          { id: 'code', label: t.codeTitle },
          { id: 'application', label: t.appTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="idea" title={t.ideaTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.idea1}</p>
          <TeX block>{String.raw`\dot{\mathbf{y}} = f(t, \mathbf{y}), \qquad \mathbf{y}_{n+1} = \mathbf{y}_n + h\cdot \Phi(f, t_n, \mathbf{y}_n, h)`}</TeX>
        </div>
      </Section>

      <Section id="orbit" title={t.orbitTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.orbit1}</p>
        </div>
        <div className="mt-4">
          <OrbitLab />
        </div>
        <Derivation title={t.orbitDerivTitle} steps={t.orbitDeriv} />
      </Section>

      <Section id="stability" title={t.stabTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.stab1}</p>
        </div>
        <div className="mt-4">
          <StabilityLab />
        </div>
        <Derivation title={t.stabDerivTitle} steps={t.stabDeriv} />
      </Section>

      <Section id="table" title={t.tableTitle}>
        <div className="card max-w-4xl overflow-hidden">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-muted">
                {t.tableHead.map((hh, i) => (
                  <th key={i} className="px-3.5 py-2 font-medium">
                    {hh}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.tableRows.map((row, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className={`px-3.5 py-2.5 ${j === 0 ? 'font-semibold text-accent' : 'text-ink/85'}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="prose-cv mt-4 max-w-3xl">
          <p>{t.table2}</p>
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
          <SuspensionLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
