import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { Heatmap } from '../components/Heatmap'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import { fmt, mulberry32 } from '../lib/math'
import { FN2D, gdStep2D, momentumStep2D, type Fn2D, type Vec2 } from '../lib/optim'
import { adam2DInit, adamStep2D, annealStep, sgdNoisyStep2D, type Adam2DState } from '../lib/ml'
import { makeGauss } from '../lib/stats'
import { simulatePid, type PidOptions, type PidResult } from '../lib/signal'

const T = {
  en: {
    kicker: 'ML · Module 2',
    title: 'Stochastic & Global Optimization',
    intro:
      'The vision track crowned Levenberg–Marquardt the king of small, smooth least-squares problems. Machine learning breaks both of its crutches: millions of parameters make JᵀJ unthinkable, and the loss is a sum over millions of examples you cannot even afford to evaluate exactly. This module is about what works instead — and about escaping the local minima that plain descent cannot.',
    recapTitle: 'When the gold standard stops applying',
    recap1: 'Two properties of modern learning problems change the rules:',
    recapList: [
      'Scale: with 10⁶–10⁹ parameters, anything quadratic in the parameter count (Hessians, JᵀJ, matrix factorizations) is off the table. Only gradients survive — and they must be cheap.',
      'Summed losses: L(θ) = 1/n Σᵢ ℓᵢ(θ) over huge n. Computing the exact gradient means touching every example. But a small random mini-batch gives an unbiased estimate of it — noisy, and dramatically cheaper.',
    ],
    sgdTitle: 'Interactive: gradient descent with noisy gradients (SGD)',
    sgd1: 'This is full gradient descent with gaussian noise injected into every gradient — exactly what mini-batch sampling does. Click to start a run. With no noise you get the familiar clean path; turn the noise up and the path becomes a drunken walk that still finds its way down, because the noise averages out over many steps. Notice it never quite settles: it jitters around the minimum forever unless the learning rate decays.',
    sgd2: 'On the two-pits landscape, noise even becomes a feature: a run that falls into the shallow pit can be kicked out again and find the deep one. Randomness as an exploration tool — a theme that returns with annealing below.',
    noise: 'gradient noise σ',
    schedule: 'lr schedule',
    schedNames: ['constant', 'decay 1/t', 'cosine'],
    effLr: 'current lr',
    sgdTry: [
      'valley, σ = 0: clean deterministic zigzag. σ = 1.5: the same path drawn by a shaky hand — but it still arrives.',
      'Set σ high and watch the endpoint: it never converges to a point, it hovers in a noise ball around the minimum. Now switch the schedule to decay — the ball shrinks as the steps do.',
      'two pits, start above the shallow pit, σ ≈ 1.5: some runs get kicked over the ridge into the deep pit. Plain GD (σ = 0) never does.',
    ],
    raceTitle: 'Interactive: the optimizer race — GD vs. momentum vs. Adam',
    race1: 'Same landscape, same start, three optimizers with sensible settings each. GD suffers on ill-conditioned valleys (module Vision·3 showed why). Momentum accumulates speed along the valley. Adam additionally rescales every parameter by its own gradient history — automatic per-parameter preconditioning, which is why it became the default of deep learning: it is momentum + the diagonal scaling trick, self-tuning.',
    raceStart: 'Start race',
    raceReset: 'Reset',
    raceSteps: 'steps',
    raceStatus: { running: 'running', done: 'finished', diverged: 'diverged 💥', idle: '—' },
    schedTitle: 'Learning-rate schedules',
    sched1: 'SGD noise never lets the loss settle unless steps shrink. Schedules manage the trade-off between fast early progress (large lr) and precise late convergence (small lr): step decay is the classic, cosine annealing the modern default, and warmup (start tiny, ramp up) stabilizes the first chaotic steps of large models. You already felt the effect in the SGD lab above.',
    annealTitle: 'Interactive: simulated annealing — optimization with courage',
    anneal1: 'Descent methods only ever go downhill, so the nearest valley is their final answer. Simulated annealing borrows a trick from metallurgy: propose random moves and accept uphill ones with probability exp(−ΔC/T). At high temperature T the walker roams freely across ridges; as T cools, it commits to the best valley found. Run both from the same start: gradient descent parks in the nearest dent, annealing crosses ridges and finds the global minimum (✕).',
    annealRun: 'Run annealing',
    annealGd: 'Run gradient descent',
    annealReset: 'Reset',
    annealT: 'temperature T',
    annealCool: 'cooling rate',
    annealBest: 'best C found',
    annealPacc: 'p(accept uphill)',
    lagTitle: 'Interactive: constraints — the Lagrange picture',
    lag1: 'Real designs are constrained: minimize drag subject to fixed lift, minimize cost at given strength. Walk the point around the constraint circle and watch the two arrows: ∇f (red) pulls toward the unconstrained minimum, ∇g (green) is perpendicular to the constraint. As long as ∇f has a component along the circle, sliding that way improves f. The constrained optimum is exactly where the arrows become parallel — nothing tangential is left. That geometric condition is the whole content of the Lagrange multiplier:',
    lagAngle: 'position on the constraint',
    lagF: 'f at current point',
    lagAlign: 'angle between ∇f and ∇g',
    lagOpt: '✕ marks the constrained optimum — arrows parallel, λ = ratio of their lengths.',
    tableTitle: 'Choosing your weapon',
    tableHead: ['situation', 'reach for'],
    tableRows: [
      ['small–medium smooth least squares (calibration, PnP, bundle adjustment)', 'Gauss-Newton / Levenberg–Marquardt'],
      ['huge parameter count, loss = sum over data (deep learning)', 'SGD + momentum, Adam(W), cosine schedule'],
      ['multiple minima, low dimension, cheap function', 'simulated annealing, multi-start, CMA-ES'],
      ['constraints on the design variables', 'Lagrange / KKT methods, projected gradients, SQP'],
      ['no gradients at all (black-box simulation)', 'Nelder–Mead, Bayesian optimization, CMA-ES'],
    ],
    codeTitle: 'In practice',
    appTitle: '🏭 In the real world: auto-tuning a PID controller',
    appIntro:
      'Commissioning engineers tune thousands of PID loops per plant — and “auto-tune” buttons on modern drives do exactly what this module taught: they treat the controller gains as parameters, the simulated (or measured) step response as the data, and the integrated squared error as the loss. The heatmap below is that loss over the (Kp, Ki) plane for the module’s mass-spring-damper plant — every pixel is a full closed-loop simulation. Click anywhere to drop a starting guess: finite-difference gradient descent walks downhill and lands in the valley of well-tuned gains. The step-response plot shows what the descent bought you.',
    appMapTitle: 'loss landscape: log ISE over (Kp, Ki) — click to start a descent',
    appStart: 'start',
    appTuned: 'auto-tuned',
    appIse: 'ISE (tuned)',
    appGains: 'tuned Kp / Ki',
    appResp: 'step response: start vs. tuned',
    appHint: 'click the heatmap to auto-tune from that starting point',
    appWhere:
      'The same simulate-and-descend loop tunes motor drives at commissioning, aircraft autopilot gains, chemical-reactor temperature loops, and the throttle response maps in your car — black-box optimization over a simulator is half of modern engineering.',
  },
  de: {
    kicker: 'ML · Modul 2',
    title: 'Stochastische & globale Optimierung',
    intro:
      'Der Vision-Track kürte Levenberg–Marquardt zum König der kleinen, glatten Kleinste-Quadrate-Probleme. Maschinelles Lernen schlägt ihm beide Krücken weg: Millionen Parameter machen JᵀJ undenkbar, und der Verlust ist eine Summe über Millionen Beispiele, die man nicht einmal exakt auswerten kann. Dieses Modul zeigt, was stattdessen funktioniert — und wie man den lokalen Minima entkommt, an denen reiner Abstieg scheitert.',
    recapTitle: 'Wenn der Goldstandard nicht mehr greift',
    recap1: 'Zwei Eigenschaften moderner Lernprobleme ändern die Regeln:',
    recapList: [
      'Größe: Bei 10⁶–10⁹ Parametern ist alles Quadratische in der Parameterzahl (Hesse-Matrizen, JᵀJ, Faktorisierungen) vom Tisch. Nur Gradienten überleben — und sie müssen billig sein.',
      'Summenverluste: L(θ) = 1/n Σᵢ ℓᵢ(θ) über riesiges n. Der exakte Gradient verlangt, jedes Beispiel anzufassen. Aber ein kleiner zufälliger Mini-Batch liefert eine erwartungstreue Schätzung davon — verrauscht, und dramatisch billiger.',
    ],
    sgdTitle: 'Interaktiv: Gradientenabstieg mit verrauschten Gradienten (SGD)',
    sgd1: 'Das hier ist voller Gradientenabstieg, dem in jeden Gradienten gaußsches Rauschen injiziert wird — genau das, was Mini-Batch-Sampling tut. Klicke, um einen Lauf zu starten. Ohne Rauschen bekommst du den vertrauten sauberen Pfad; dreh das Rauschen auf, und der Pfad wird ein trunkener Gang, der trotzdem nach unten findet, weil sich das Rauschen über viele Schritte herausmittelt. Beachte: Er kommt nie ganz zur Ruhe — er zittert ewig um das Minimum, sofern die Lernrate nicht abklingt.',
    sgd2: 'Auf der Zwei-Gruben-Landschaft wird das Rauschen sogar zum Feature: Ein Lauf, der in die flache Grube fällt, kann wieder herausgekickt werden und die tiefe finden. Zufall als Erkundungswerkzeug — ein Thema, das unten beim Annealing zurückkehrt.',
    noise: 'Gradientenrauschen σ',
    schedule: 'LR-Schedule',
    schedNames: ['konstant', 'Abkling 1/t', 'Cosinus'],
    effLr: 'aktuelle LR',
    sgdTry: [
      'Enges Tal, σ = 0: sauberer deterministischer Zickzack. σ = 1,5: derselbe Pfad, mit zittriger Hand gezeichnet — aber er kommt an.',
      'Setze σ hoch und beobachte das Ende: Es konvergiert nie zu einem Punkt, sondern schwebt in einer Rauschkugel ums Minimum. Stelle nun den Schedule auf Abkling — die Kugel schrumpft mit den Schritten.',
      'Zwei Gruben, Start über der flachen Grube, σ ≈ 1,5: Manche Läufe werden über den Grat in die tiefe Grube gekickt. Reiner GD (σ = 0) schafft das nie.',
    ],
    raceTitle: 'Interaktiv: das Optimierer-Rennen — GD vs. Momentum vs. Adam',
    race1: 'Gleiche Landschaft, gleicher Start, drei Optimierer mit jeweils vernünftigen Einstellungen. GD leidet in schlecht konditionierten Tälern (Modul Vision·3 zeigte warum). Momentum sammelt Schwung entlang des Tals. Adam skaliert zusätzlich jeden Parameter mit seiner eigenen Gradientenhistorie — automatische parameterweise Präkonditionierung. Deshalb wurde es zum Standard des Deep Learning: Momentum + der Diagonalskalierungs-Trick, selbstjustierend.',
    raceStart: 'Rennen starten',
    raceReset: 'Zurücksetzen',
    raceSteps: 'Schritte',
    raceStatus: { running: 'läuft', done: 'fertig', diverged: 'divergiert 💥', idle: '—' },
    schedTitle: 'Lernraten-Schedules',
    sched1: 'SGD-Rauschen lässt den Verlust nie zur Ruhe kommen, solange die Schritte nicht schrumpfen. Schedules verwalten den Kompromiss zwischen schnellem frühem Fortschritt (große LR) und präziser später Konvergenz (kleine LR): Stufenabkling ist der Klassiker, Cosinus-Annealing der moderne Standard, und Warmup (winzig starten, hochfahren) stabilisiert die ersten chaotischen Schritte großer Modelle. Den Effekt hast du im SGD-Labor oben bereits gespürt.',
    annealTitle: 'Interaktiv: Simulated Annealing — Optimieren mit Mut',
    anneal1: 'Abstiegsverfahren gehen immer nur bergab, also ist das nächstgelegene Tal ihre endgültige Antwort. Simulated Annealing leiht sich einen Trick aus der Metallurgie: Schlage zufällige Züge vor und akzeptiere Aufwärtszüge mit Wahrscheinlichkeit exp(−ΔC/T). Bei hoher Temperatur T streift der Wanderer frei über die Grate; beim Abkühlen legt er sich auf das beste gefundene Tal fest. Starte beide vom selben Punkt: Der Gradientenabstieg parkt in der nächsten Delle, das Annealing überquert Grate und findet das globale Minimum (✕).',
    annealRun: 'Annealing starten',
    annealGd: 'Gradientenabstieg starten',
    annealReset: 'Zurücksetzen',
    annealT: 'Temperatur T',
    annealCool: 'Abkühlrate',
    annealBest: 'bestes gefundenes C',
    annealPacc: 'p(bergauf akzeptieren)',
    lagTitle: 'Interaktiv: Nebenbedingungen — das Lagrange-Bild',
    lag1: 'Echte Entwürfe sind beschränkt: Widerstand minimieren bei festem Auftrieb, Kosten minimieren bei gegebener Festigkeit. Wandere mit dem Punkt den Nebenbedingungskreis entlang und beobachte die beiden Pfeile: ∇f (rot) zieht zum unbeschränkten Minimum, ∇g (grün) steht senkrecht auf der Nebenbedingung. Solange ∇f eine Komponente entlang des Kreises hat, verbessert Gleiten in diese Richtung f. Das beschränkte Optimum liegt genau dort, wo die Pfeile parallel werden — nichts Tangentiales bleibt übrig. Diese geometrische Bedingung ist der gesamte Inhalt des Lagrange-Multiplikators:',
    lagAngle: 'Position auf der Nebenbedingung',
    lagF: 'f am aktuellen Punkt',
    lagAlign: 'Winkel zwischen ∇f und ∇g',
    lagOpt: '✕ markiert das beschränkte Optimum — Pfeile parallel, λ = Verhältnis ihrer Längen.',
    tableTitle: 'Die Waffenwahl',
    tableHead: ['Situation', 'Werkzeug'],
    tableRows: [
      ['kleine–mittlere glatte Kleinste-Quadrate (Kalibrierung, PnP, Bündelausgleich)', 'Gauß-Newton / Levenberg–Marquardt'],
      ['riesige Parameterzahl, Verlust = Summe über Daten (Deep Learning)', 'SGD + Momentum, Adam(W), Cosinus-Schedule'],
      ['mehrere Minima, niedrige Dimension, billige Funktion', 'Simulated Annealing, Multi-Start, CMA-ES'],
      ['Nebenbedingungen an die Entwurfsvariablen', 'Lagrange-/KKT-Verfahren, projizierte Gradienten, SQP'],
      ['gar keine Gradienten (Black-Box-Simulation)', 'Nelder–Mead, Bayessche Optimierung, CMA-ES'],
    ],
    codeTitle: 'In der Praxis',
    appTitle: '🏭 In der echten Welt: einen PID-Regler auto-tunen',
    appIntro:
      'Inbetriebnahme-Ingenieure stimmen tausende PID-Schleifen pro Anlage ab — und die „Auto-Tune“-Knöpfe moderner Antriebe machen genau das, was dieses Modul gelehrt hat: Sie behandeln die Reglerverstärkungen als Parameter, die simulierte (oder gemessene) Sprungantwort als Daten und den integrierten quadratischen Fehler als Verlust. Die Heatmap unten ist dieser Verlust über der (Kp, Ki)-Ebene für die Masse-Feder-Dämpfer-Strecke des Moduls — jedes Pixel ist eine komplette Regelkreis-Simulation. Klicke irgendwohin, um einen Startwert zu setzen: Finite-Differenzen-Gradientenabstieg läuft bergab und landet im Tal der gut abgestimmten Verstärkungen. Der Sprungantwort-Plot zeigt, was der Abstieg gebracht hat.',
    appMapTitle: 'Verlustlandschaft: log ISE über (Kp, Ki) — klicken startet einen Abstieg',
    appStart: 'Start',
    appTuned: 'auto-getunt',
    appIse: 'ISE (getunt)',
    appGains: 'getunte Kp / Ki',
    appResp: 'Sprungantwort: Start vs. getunt',
    appHint: 'in die Heatmap klicken, um von dort zu auto-tunen',
    appWhere:
      'Dieselbe Simulieren-und-Absteigen-Schleife stimmt Motorantriebe bei der Inbetriebnahme ab, Autopilot-Verstärkungen in Flugzeugen, Temperaturschleifen chemischer Reaktoren und die Gasannahme-Kennfelder deines Autos — Black-Box-Optimierung über einem Simulator ist die halbe moderne Ingenieurskunst.',
  },
}

const SNIPPET = `import torch

opt = torch.optim.AdamW(model.parameters(), lr=3e-4)
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=num_epochs)

for epoch in range(num_epochs):
    for x, y in loader:              # mini-batches → stochastic gradients
        opt.zero_grad()
        loss = criterion(model(x), y)
        loss.backward()              # backprop (next module!)
        opt.step()
    sched.step()`

// ---------------------------------------------------------------- SGD noise lab

type SchedKey = 'const' | 'decay' | 'cosine'
const schedLr = (base: number, t: number, key: SchedKey): number => {
  if (key === 'decay') return base / (1 + 0.02 * t)
  if (key === 'cosine') return base * 0.5 * (1 + Math.cos(Math.PI * Math.min(t / 350, 1)))
  return base
}

interface NoisyRun {
  pts: Vec2[]
  status: 'running' | 'done' | 'diverged'
}

function SgdLab() {
  const t = useT(T)
  const [fnKey, setFnKey] = useState<'valley' | 'twopits'>('valley')
  const [sigma, setSigma] = useState(1.0)
  const [lrExp, setLrExp] = useState(-1.15)
  const [sched, setSched] = useState<SchedKey>('const')
  const [runs, setRuns] = useState<NoisyRun[]>([])
  const [running, setRunning] = useState(false)
  const runsRef = useRef(runs)
  runsRef.current = runs
  const gaussRef = useRef(makeGauss(1))

  const fn: Fn2D = FN2D[fnKey]
  const lr0 = 10 ** lrExp
  const PW = 560
  const PH = 440
  const toPx = (p: Vec2): Vec2 => [
    ((p[0] - fn.domain.x[0]) / (fn.domain.x[1] - fn.domain.x[0])) * PW,
    ((p[1] - fn.domain.y[0]) / (fn.domain.y[1] - fn.domain.y[0])) * PH,
  ]

  const startAt = (x: number, y: number) => {
    gaussRef.current = makeGauss(Math.floor(x * 1e4) ^ Math.floor(y * 1e4))
    setRuns([...runsRef.current, { pts: [[x, y]], status: 'running' }])
    setRunning(true)
  }

  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => {
      const cur = runsRef.current
      const last = cur[cur.length - 1]
      if (!last || last.status !== 'running') {
        setRunning(false)
        return
      }
      let pts = last.pts
      let status: NoisyRun['status'] = 'running'
      for (let s = 0; s < 4; s++) {
        const p = pts[pts.length - 1]
        const lr = schedLr(lr0, pts.length, sched)
        const np = sgdNoisyStep2D(fn, p, lr, sigma, gaussRef.current)
        pts = [...pts, np]
        if (!isFinite(np[0]) || Math.abs(np[0]) + Math.abs(np[1]) > 30) {
          status = 'diverged'
          break
        }
        if (pts.length > 450) {
          status = 'done'
          break
        }
      }
      setRuns([...cur.slice(0, -1), { pts, status }])
      if (status !== 'running') setRunning(false)
    }, 35)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, fnKey, sigma, lrExp, sched])

  const last = runs[runs.length - 1]
  const curLr = last ? schedLr(lr0, last.pts.length, sched) : lr0

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Heatmap
          w={PW}
          h={PH}
          xr={fn.domain.x}
          yr={fn.domain.y}
          cost={fn.f}
          ckey={fnKey}
          onPick={startAt}
          title={`C(θ₁, θ₂) — ${fnKey === 'valley' ? 'valley' : 'two pits'}`}
        >
          {fn.minima.map((m, i) => {
            const [mx, my] = toPx(m)
            return (
              <g key={i} stroke="#4ade80" strokeWidth={2}>
                <line x1={mx - 7} y1={my - 7} x2={mx + 7} y2={my + 7} />
                <line x1={mx - 7} y1={my + 7} x2={mx + 7} y2={my - 7} />
              </g>
            )
          })}
          {runs.map((run, ri) => (
            <g key={ri} opacity={ri === runs.length - 1 ? 1 : 0.45}>
              <polyline
                points={run.pts.map((p) => toPx(p).join(',')).join(' ')}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={1.6}
              />
              <circle cx={toPx(run.pts[0])[0]} cy={toPx(run.pts[0])[1]} r={4.5} fill="#22d3ee" stroke="#0a0e17" strokeWidth={1.5} />
            </g>
          ))}
        </Heatmap>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Segmented<'valley' | 'twopits'>
            options={[
              { value: 'valley', label: 'valley' },
              { value: 'twopits', label: 'two pits' },
            ]}
            value={fnKey}
            onChange={(k) => {
              setFnKey(k)
              setRuns([])
              setRunning(false)
            }}
          />
          <Slider label={t.noise} value={sigma} min={0} max={3} step={0.05} onChange={setSigma} format={(v) => fmt(v, 2)} accent="#fbbf24" />
          <Slider label="lr" value={lrExp} min={-2.5} max={-0.5} step={0.05} onChange={setLrExp} format={() => lr0.toPrecision(2)} />
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-muted">{t.schedule}</div>
            <Segmented<SchedKey>
              options={[
                { value: 'const', label: t.schedNames[0] },
                { value: 'decay', label: t.schedNames[1] },
                { value: 'cosine', label: t.schedNames[2] },
              ]}
              value={sched}
              onChange={setSched}
            />
          </div>
          <button className="btn" onClick={() => { setRuns([]); setRunning(false) }}>
            ↺
          </button>
        </div>
        <Readout label={t.effLr} value={curLr.toPrecision(2)} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- optimizer race

type Racer = 'gd' | 'mom' | 'adam'
const RACER_COLORS: Record<Racer, string> = { gd: '#22d3ee', mom: '#a78bfa', adam: '#4ade80' }
const RACER_LR: Record<'valley' | 'rosenbrock', Record<Racer, number>> = {
  // GD gets the lr you would naively pick for the shallow direction → heavy zigzag
  valley: { gd: 0.115, mom: 0.03, adam: 0.09 },
  rosenbrock: { gd: 0.009, mom: 0.006, adam: 0.05 },
}

interface RacerState {
  pts: Vec2[]
  vel: Vec2
  adam: Adam2DState
  status: 'running' | 'done' | 'diverged'
}

function RaceLab() {
  const t = useT(T)
  const [fnKey, setFnKey] = useState<'valley' | 'rosenbrock'>('valley')
  const [racers, setRacers] = useState<Record<Racer, RacerState> | null>(null)
  const [running, setRunning] = useState(false)
  const racersRef = useRef(racers)
  racersRef.current = racers

  const fn = FN2D[fnKey]
  const PW = 560
  const PH = 440
  const toPx = (p: Vec2): Vec2 => [
    ((p[0] - fn.domain.x[0]) / (fn.domain.x[1] - fn.domain.x[0])) * PW,
    ((p[1] - fn.domain.y[0]) / (fn.domain.y[1] - fn.domain.y[0])) * PH,
  ]

  const initRacers = (): Record<Racer, RacerState> => {
    const mk = (): RacerState => ({ pts: [fn.start], vel: [0, 0], adam: adam2DInit(), status: 'running' })
    return { gd: mk(), mom: mk(), adam: mk() }
  }

  const start = () => {
    setRacers(initRacers())
    setRunning(true)
  }

  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => {
      const cur = racersRef.current
      if (!cur) return
      const next: Record<Racer, RacerState> = { ...cur }
      let anyRunning = false
      for (const key of ['gd', 'mom', 'adam'] as Racer[]) {
        const r = cur[key]
        if (r.status !== 'running') {
          next[key] = r
          continue
        }
        const p = r.pts[r.pts.length - 1]
        const lr = RACER_LR[fnKey][key]
        let np: Vec2 = p
        let vel = r.vel
        let adam = r.adam
        if (key === 'gd') np = gdStep2D(fn, p, lr)
        else if (key === 'mom') {
          const res = momentumStep2D(fn, p, r.vel, lr, 0.9)
          np = res.p
          vel = res.v
        } else {
          const res = adamStep2D(fn, p, r.adam, lr)
          np = res.p
          adam = res.st
        }
        let status: RacerState['status'] = 'running'
        if (!isFinite(np[0]) || Math.abs(np[0]) + Math.abs(np[1]) > 30) status = 'diverged'
        else {
          const g = fn.grad(np[0], np[1])
          const nearMin = fn.minima.some((m) => Math.hypot(np[0] - m[0], np[1] - m[1]) < 0.04)
          if (Math.hypot(g[0], g[1]) < 2e-3 || nearMin) status = 'done'
          else if (r.pts.length > 900) status = 'done'
        }
        next[key] = { pts: [...r.pts, np], vel, adam, status }
        if (status === 'running') anyRunning = true
      }
      setRacers(next)
      if (!anyRunning) setRunning(false)
    }, 30)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, fnKey])

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Heatmap w={PW} h={PH} xr={fn.domain.x} yr={fn.domain.y} cost={fn.f} ckey={fnKey} title={`C(θ₁, θ₂) — ${fnKey}`}>
          {fn.minima.map((m, i) => {
            const [mx, my] = toPx(m)
            return (
              <g key={i} stroke="#e6eaf2" strokeWidth={2}>
                <line x1={mx - 7} y1={my - 7} x2={mx + 7} y2={my + 7} />
                <line x1={mx - 7} y1={my + 7} x2={mx + 7} y2={my - 7} />
              </g>
            )
          })}
          {racers &&
            (['gd', 'mom', 'adam'] as Racer[]).map((key) => {
              const r = racers[key]
              const col = RACER_COLORS[key]
              return (
                <g key={key}>
                  <polyline points={r.pts.map((p) => toPx(p).join(',')).join(' ')} fill="none" stroke={col} strokeWidth={2} opacity={0.9} />
                  <circle cx={toPx(r.pts[r.pts.length - 1])[0]} cy={toPx(r.pts[r.pts.length - 1])[1]} r={5} fill={col} stroke="#0a0e17" strokeWidth={1.5} />
                </g>
              )
            })}
        </Heatmap>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Segmented<'valley' | 'rosenbrock'>
            options={[
              { value: 'valley', label: 'valley' },
              { value: 'rosenbrock', label: 'Rosenbrock' },
            ]}
            value={fnKey}
            onChange={(k) => {
              setFnKey(k)
              setRacers(null)
              setRunning(false)
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={start}>
              🏁 {t.raceStart}
            </button>
            <button className="btn" onClick={() => { setRacers(null); setRunning(false) }}>
              ↺ {t.raceReset}
            </button>
          </div>
        </div>
        <div className="card-pad space-y-2 font-mono text-[13px]">
          {(['gd', 'mom', 'adam'] as Racer[]).map((key) => {
            const r = racers?.[key]
            return (
              <div key={key} className="flex items-center justify-between gap-2">
                <span style={{ color: RACER_COLORS[key] }}>
                  {key === 'gd' ? 'GD' : key === 'mom' ? 'Momentum' : 'Adam'}
                </span>
                <span className="text-muted">
                  {r ? `${r.pts.length - 1} ${t.raceSteps} · ${t.raceStatus[r.status]}` : t.raceStatus.idle}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- annealing lab

const AF = (x: number) => 0.09 * x * x + Math.sin(2.1 * x) + 0.65 * Math.sin(4.5 * x + 1.2) + 2.2
const AF_DOMAIN: Vec2 = [-5.6, 5.6]

function AnnealLab() {
  const t = useT(T)
  const [t0, setT0] = useState(1.4)
  const [cool, setCool] = useState(0.985)
  const [state, setState] = useState<{
    anneal: { x: number; T: number; best: number; pAccept: number; trail: number[] } | null
    gd: { x: number; trail: number[] } | null
  }>({ anneal: null, gd: null })
  const [mode, setMode] = useState<'idle' | 'anneal' | 'gd'>('idle')
  const stRef = useRef(state)
  stRef.current = state
  const rngRef = useRef({ rand: mulberry32(1), gauss: makeGauss(2) })

  const START_X = 4.4

  const globalMin = useMemo(() => {
    let bx = 0
    let bv = Infinity
    for (let i = 0; i <= 1000; i++) {
      const x = AF_DOMAIN[0] + (i / 1000) * (AF_DOMAIN[1] - AF_DOMAIN[0])
      const v = AF(x)
      if (v < bv) {
        bv = v
        bx = x
      }
    }
    return { x: bx, v: bv }
  }, [])

  useEffect(() => {
    if (mode === 'idle') return
    const iv = setInterval(() => {
      const cur = stRef.current
      if (mode === 'anneal' && cur.anneal) {
        const a = cur.anneal
        let x = a.x
        let pAccept = a.pAccept
        for (let s = 0; s < 3; s++) {
          const res = annealStep(AF, x, a.T, 0.55, rngRef.current.rand, rngRef.current.gauss)
          x = res.x
          pAccept = res.dC > 0 ? res.pAccept : pAccept
        }
        const T = a.T * cool
        const best = Math.min(a.best, AF(x))
        const trail = [...a.trail, x].slice(-260)
        setState({ ...cur, anneal: { x, T, best, pAccept, trail } })
        if (T < 0.005) setMode('idle')
      } else if (mode === 'gd' && cur.gd) {
        const g = cur.gd
        const h = 1e-4
        const grad = (AF(g.x + h) - AF(g.x - h)) / (2 * h)
        const x = g.x - 0.02 * grad
        setState({ ...cur, gd: { x, trail: [...g.trail, x].slice(-260) } })
        if (Math.abs(grad) < 1e-3) setMode('idle')
      }
    }, 40)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cool])

  const PW = 560
  const PH = 320
  const yRange = useMemo(() => {
    let mn = Infinity
    let mx = -Infinity
    for (let i = 0; i <= 300; i++) {
      const v = AF(AF_DOMAIN[0] + (i / 300) * (AF_DOMAIN[1] - AF_DOMAIN[0]))
      mn = Math.min(mn, v)
      mx = Math.max(mx, v)
    }
    return [mn - 0.35, mx + 0.35]
  }, [])
  const mx = (x: number) => ((x - AF_DOMAIN[0]) / (AF_DOMAIN[1] - AF_DOMAIN[0])) * PW
  const my = (v: number) => PH - 14 - ((v - yRange[0]) / (yRange[1] - yRange[0])) * (PH - 28)

  const curve = Array.from({ length: 200 }, (_, i) => {
    const x = AF_DOMAIN[0] + (i / 199) * (AF_DOMAIN[1] - AF_DOMAIN[0])
    return `${mx(x)},${my(AF(x))}`
  }).join(' ')

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          <polyline points={curve} fill="none" stroke="#22d3ee" strokeWidth={2.2} />
          <g stroke="#4ade80" strokeWidth={2}>
            <line x1={mx(globalMin.x) - 7} y1={my(globalMin.v) - 7} x2={mx(globalMin.x) + 7} y2={my(globalMin.v) + 7} />
            <line x1={mx(globalMin.x) - 7} y1={my(globalMin.v) + 7} x2={mx(globalMin.x) + 7} y2={my(globalMin.v) - 7} />
          </g>
          {state.gd?.trail.map((x, i) => (
            <circle key={`g${i}`} cx={mx(x)} cy={my(AF(x))} r={2.5} fill="#f87171" opacity={0.2 + (0.6 * i) / state.gd!.trail.length} />
          ))}
          {state.anneal?.trail.map((x, i) => (
            <circle key={`a${i}`} cx={mx(x)} cy={my(AF(x))} r={2.5} fill="#fbbf24" opacity={0.15 + (0.65 * i) / state.anneal!.trail.length} />
          ))}
          {state.gd && <circle cx={mx(state.gd.x)} cy={my(AF(state.gd.x))} r={7} fill="#f87171" stroke="#0a0e17" strokeWidth={2} />}
          {state.anneal && <circle cx={mx(state.anneal.x)} cy={my(AF(state.anneal.x))} r={7} fill="#fbbf24" stroke="#0a0e17" strokeWidth={2} />}
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.annealT} value={t0} min={0.2} max={3} step={0.05} onChange={setT0} format={(v) => fmt(v, 2)} accent="#fbbf24" />
          <Slider label={t.annealCool} value={cool} min={0.9} max={0.998} step={0.001} onChange={setCool} format={(v) => fmt(v, 3)} />
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary"
              onClick={() => {
                rngRef.current = { rand: mulberry32(Date.now() % 100000), gauss: makeGauss((Date.now() % 100000) + 1) }
                setState((s) => ({ ...s, anneal: { x: START_X, T: t0, best: AF(START_X), pAccept: 1, trail: [START_X] } }))
                setMode('anneal')
              }}
            >
              🔥 {t.annealRun}
            </button>
            <button
              className="btn"
              onClick={() => {
                setState((s) => ({ ...s, gd: { x: START_X, trail: [START_X] } }))
                setMode('gd')
              }}
            >
              ⛷ {t.annealGd}
            </button>
            <button className="btn" onClick={() => { setMode('idle'); setState({ anneal: null, gd: null }) }}>
              ↺ {t.annealReset}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label="T" value={state.anneal ? fmt(state.anneal.T, 3) : '—'} accent="#fbbf24" />
          <Readout label={t.annealPacc} value={state.anneal ? fmt(state.anneal.pAccept, 2) : '—'} />
          <Readout
            label={t.annealBest}
            value={state.anneal ? fmt(state.anneal.best, 3) : '—'}
            accent={state.anneal && state.anneal.best < globalMin.v + 0.05 ? '#4ade80' : undefined}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Lagrange lab

const LAG_F = (x: number, y: number) => (x - 1.35) ** 2 + 0.65 * (y - 0.95) ** 2
const LAG_GRAD = (x: number, y: number): Vec2 => [2 * (x - 1.35), 1.3 * (y - 0.95)]

function LagrangeLab() {
  const t = useT(T)
  const [phi, setPhi] = useState(150)

  const opt = useMemo(() => {
    let best = 0
    let bv = Infinity
    for (let i = 0; i < 720; i++) {
      const a = (i / 720) * 2 * Math.PI
      const v = LAG_F(Math.cos(a), Math.sin(a))
      if (v < bv) {
        bv = v
        best = a
      }
    }
    return best
  }, [])

  const PW = 520
  const PH = 440
  const XR: Vec2 = [-1.9, 2.3]
  const YR: Vec2 = [-1.8, 2.0]
  const toPx = (p: Vec2): Vec2 => [
    ((p[0] - XR[0]) / (XR[1] - XR[0])) * PW,
    ((YR[1] - p[1]) / (YR[1] - YR[0])) * PH,
  ]

  const a = (phi * Math.PI) / 180
  const P: Vec2 = [Math.cos(a), Math.sin(a)]
  const gf = LAG_GRAD(P[0], P[1])
  const gg: Vec2 = [2 * P[0], 2 * P[1]]
  const angleBetween =
    (Math.acos(
      Math.min(
        1,
        Math.abs(gf[0] * gg[0] + gf[1] * gg[1]) /
          (Math.hypot(gf[0], gf[1]) * Math.hypot(gg[0], gg[1])),
      ),
    ) *
      180) /
    Math.PI

  const arrow = (from: Vec2, dir: Vec2, len: number): [Vec2, Vec2] => {
    const n = Math.hypot(dir[0], dir[1]) || 1
    return [toPx(from), toPx([from[0] + (dir[0] / n) * len, from[1] + (dir[1] / n) * len])]
  }
  const [fa, fb] = arrow(P, [-gf[0], -gf[1]], 0.55) // draw -∇f (downhill pull), clearer visually
  const [ga, gb] = arrow(P, gg, 0.45)
  const circlePts = Array.from({ length: 121 }, (_, i) => {
    const aa = (i / 120) * 2 * Math.PI
    return toPx([Math.cos(aa), Math.sin(aa)]).join(',')
  }).join(' ')
  const optPx = toPx([Math.cos(opt), Math.sin(opt)])

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Heatmap w={PW} h={PH} xr={XR} yr={[YR[0], YR[1]]} cost={(x, y) => LAG_F(x, y)} ckey="lag" title="f(x, y) with constraint g(x, y) = x² + y² − 1 = 0">
          <polyline points={circlePts} fill="none" stroke="#4ade80" strokeWidth={2} />
          <g stroke="#e6eaf2" strokeWidth={2}>
            <line x1={optPx[0] - 7} y1={optPx[1] - 7} x2={optPx[0] + 7} y2={optPx[1] + 7} />
            <line x1={optPx[0] - 7} y1={optPx[1] + 7} x2={optPx[0] + 7} y2={optPx[1] - 7} />
          </g>
          <defs>
            <marker id="lagF" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,1 L7,4 L0,7 z" fill="#f87171" />
            </marker>
            <marker id="lagG" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,1 L7,4 L0,7 z" fill="#4ade80" />
            </marker>
          </defs>
          <line x1={fa[0]} y1={fa[1]} x2={fb[0]} y2={fb[1]} stroke="#f87171" strokeWidth={2.5} markerEnd="url(#lagF)" />
          <line x1={ga[0]} y1={ga[1]} x2={gb[0]} y2={gb[1]} stroke="#4ade80" strokeWidth={2.5} markerEnd="url(#lagG)" />
          <circle cx={toPx(P)[0]} cy={toPx(P)[1]} r={6.5} fill="#fbbf24" stroke="#0a0e17" strokeWidth={2} />
        </Heatmap>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad">
          <Slider label={t.lagAngle} value={phi} min={0} max={360} step={1} onChange={setPhi} format={(v) => `${v}°`} accent="#fbbf24" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.lagF} value={fmt(LAG_F(P[0], P[1]), 3)} />
          <Readout
            label={t.lagAlign}
            value={fmt(angleBetween, 1)}
            unit="°"
            accent={angleBetween < 4 ? '#4ade80' : undefined}
          />
        </div>
        <div className="card px-4 py-2.5 text-[13px] text-muted">{t.lagOpt}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- application: PID auto-tune

const TUNE_PLANT: PidOptions = { m: 1, c: 1.2, k: 3, dt: 0.02, T: 6, delay: 0.05, setpoint: 1 }
const KP_R: [number, number] = [0.5, 30]
const KI_R: [number, number] = [0.05, 15]

function pidIse(kp: number, ki: number): number {
  const r = simulatePid(kp, ki, 0.8, TUNE_PLANT)
  if (r.metrics.unstable) return 1e4
  let s = 0
  for (const y of r.y) s += (TUNE_PLANT.setpoint - y) ** 2 * TUNE_PLANT.dt
  return s
}

function tuneDescent(kp0: number, ki0: number): { path: Vec2[]; ise: number } {
  let p: Vec2 = [kp0, ki0]
  let cost = pidIse(p[0], p[1])
  const path: Vec2[] = [p]
  let lr = 1.2
  for (let it = 0; it < 60; it++) {
    const h: Vec2 = [0.25, 0.12]
    const gx = (pidIse(p[0] + h[0], p[1]) - pidIse(p[0] - h[0], p[1])) / (2 * h[0])
    const gy = (pidIse(p[0], p[1] + h[1]) - pidIse(p[0], p[1] - h[1])) / (2 * h[1])
    const norm = Math.hypot(gx, gy)
    if (norm < 1e-5) break
    let stepped = false
    for (let tries = 0; tries < 5; tries++) {
      const cand: Vec2 = [
        Math.min(KP_R[1], Math.max(KP_R[0], p[0] - (lr * gx) / norm)),
        Math.min(KI_R[1], Math.max(KI_R[0], p[1] - (lr * gy) / norm)),
      ]
      const cCost = pidIse(cand[0], cand[1])
      if (cCost < cost) {
        p = cand
        cost = cCost
        path.push(p)
        lr = Math.min(lr * 1.3, 2.5)
        stepped = true
        break
      }
      lr /= 2
    }
    if (!stepped) break
  }
  return { path, ise: cost }
}

function PidTuneLab() {
  const t = useT(T)
  const [start, setStart] = useState<Vec2>([26, 1])

  const { path, ise } = useMemo(() => tuneDescent(start[0], start[1]), [start])
  const tuned = path[path.length - 1]
  const respStart = useMemo(() => simulatePid(start[0], start[1], 0.8, TUNE_PLANT), [start])
  const respTuned = useMemo(() => simulatePid(tuned[0], tuned[1], 0.8, TUNE_PLANT), [tuned])

  const W2 = 460
  const H2 = 340
  const sx = (kp: number) => ((kp - KP_R[0]) / (KP_R[1] - KP_R[0])) * W2
  const sy = (ki: number) => H2 - ((ki - KI_R[0]) / (KI_R[1] - KI_R[0])) * H2

  const RW = 460
  const RH = 170
  const rx = (time: number) => (time / TUNE_PLANT.T) * RW
  const ry = (y: number) => RH - 14 - (y / 1.6) * (RH - 28)
  const respLine = (r: PidResult) =>
    r.t
      .filter((_, i) => i % 4 === 0)
      .map((time, i) => `${rx(time)},${ry(Math.max(-0.1, Math.min(1.7, r.y[i * 4])))}`)
      .join(' ')

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Heatmap
          w={W2}
          h={H2}
          xr={KP_R}
          yr={KI_R}
          cost={(kp, ki) => Math.log10(pidIse(kp, ki) + 1e-3)}
          ckey="pid-tune"
          onPick={(kp, ki) => setStart([kp, ki])}
          title={t.appMapTitle}
        >
          <polyline points={path.map((p) => `${sx(p[0])},${sy(p[1])}`).join(' ')} fill="none" stroke="#fbbf24" strokeWidth={2} />
          <circle cx={sx(start[0])} cy={sy(start[1])} r={5} fill="#f87171" />
          <circle cx={sx(tuned[0])} cy={sy(tuned[1])} r={6} fill="#4ade80" stroke="#0a0e17" strokeWidth={1.5} />
        </Heatmap>
        <p className="mt-2 text-[12px] text-muted">{t.appHint}</p>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card overflow-hidden">
          <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.appResp}</div>
          <svg viewBox={`0 0 ${RW} ${RH}`} className="block w-full">
            <line x1={0} y1={ry(1)} x2={RW} y2={ry(1)} stroke="#8b93a744" strokeDasharray="4 4" />
            <polyline points={respLine(respStart)} fill="none" stroke="#f87171" strokeWidth={1.8} strokeDasharray="6 4" />
            <polyline points={respLine(respTuned)} fill="none" stroke="#4ade80" strokeWidth={2.2} />
            <text x={RW - 8} y={16} textAnchor="end" fill="#4ade80" fontSize={11} fontFamily="JetBrains Mono, monospace">
              {t.appTuned}
            </text>
            <text x={RW - 8} y={30} textAnchor="end" fill="#f87171" fontSize={11} fontFamily="JetBrains Mono, monospace">
              {t.appStart}
            </text>
          </svg>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.appGains} value={`${fmt(tuned[0], 1)} / ${fmt(tuned[1], 1)}`} accent="#4ade80" />
          <Readout label={t.appIse} value={fmt(ise, 3)} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function OptAdvancedPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'recap', label: t.recapTitle },
          { id: 'sgd', label: t.sgdTitle },
          { id: 'race', label: t.raceTitle },
          { id: 'schedules', label: t.schedTitle },
          { id: 'anneal', label: t.annealTitle },
          { id: 'lagrange', label: t.lagTitle },
          { id: 'table', label: t.tableTitle },
          { id: 'application', label: t.appTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="recap" title={t.recapTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.recap1}</p>
          <ul>
            {t.recapList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <TeX block>{String.raw`\nabla L(\theta) = \frac{1}{n}\sum_{i=1}^{n} \nabla \ell_i(\theta) \;\;\approx\;\; \frac{1}{|B|}\sum_{i\in B} \nabla \ell_i(\theta), \qquad |B| \ll n`}</TeX>
        </div>
      </Section>

      <Section id="sgd" title={t.sgdTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.sgd1}</p>
          <p>{t.sgd2}</p>
        </div>
        <div className="mt-4">
          <SgdLab />
        </div>
        <InfoBox title="⚡ Try it">
          <ul className="my-1 list-disc space-y-1 pl-5">
            {t.sgdTry.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </InfoBox>
      </Section>

      <Section id="race" title={t.raceTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.race1}</p>
          <TeX block>{String.raw`\text{Adam:}\quad \mathbf{m}_t = \beta_1 \mathbf{m}_{t-1} + (1{-}\beta_1)\mathbf{g}_t,\quad \mathbf{v}_t = \beta_2 \mathbf{v}_{t-1} + (1{-}\beta_2)\mathbf{g}_t^2,\quad \theta_{t+1} = \theta_t - \alpha\,\frac{\hat{\mathbf{m}}_t}{\sqrt{\hat{\mathbf{v}}_t}+\varepsilon}`}</TeX>
        </div>
        <div className="mt-4">
          <RaceLab />
        </div>
      </Section>

      <Section id="schedules" title={t.schedTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.sched1}</p>
        </div>
      </Section>

      <Section id="anneal" title={t.annealTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.anneal1}</p>
          <TeX block>{String.raw`p(\text{accept}) = \begin{cases} 1 & \Delta C \le 0 \\ e^{-\Delta C / T} & \Delta C > 0 \end{cases}\qquad T_{k+1} = \gamma\, T_k`}</TeX>
        </div>
        <div className="mt-4">
          <AnnealLab />
        </div>
      </Section>

      <Section id="lagrange" title={t.lagTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.lag1}</p>
          <TeX block>{String.raw`\nabla f(\mathbf{x}^\star) = \lambda\, \nabla g(\mathbf{x}^\star), \qquad g(\mathbf{x}^\star) = 0 \qquad\Longleftrightarrow\qquad \nabla_{\mathbf{x},\lambda}\, \mathcal{L}(\mathbf{x},\lambda) = 0,\;\; \mathcal{L} = f - \lambda g`}</TeX>
        </div>
        <div className="mt-4">
          <LagrangeLab />
        </div>
      </Section>

      <Section id="table" title={t.tableTitle}>
        <div className="card max-w-3xl overflow-hidden">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-muted">
                {t.tableHead.map((h, i) => (
                  <th key={i} className="px-4 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.tableRows.map((row, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 text-ink/85">{row[0]}</td>
                  <td className="px-4 py-2.5 text-accent">{row[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">{t.codeTitle}</h3>
          <pre className="card overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-ink/85">{SNIPPET}</pre>
        </div>
      </Section>

      <Section id="application" title={t.appTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.appIntro}</p>
        </div>
        <div className="mt-4">
          <PidTuneLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
