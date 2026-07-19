import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Slider } from '../components/ui'
import { fmt } from '../lib/math'
import { simulatePid, type PidResult } from '../lib/signal'

const T = {
  en: {
    kicker: 'Signals · Module 2',
    title: 'Control Theory',
    intro:
      'A motor with friction, a heater with lag, a drone in wind - physical systems never simply do what you tell them. Control theory’s answer is feedback: measure the output, compare with the goal, correct. The PID controller - three terms, three knobs - runs the overwhelming majority of the world’s control loops, from CNC axes to chemical plants.',
    loopTitle: 'Open loop vs. closed loop',
    loop1: 'Open loop is a shower with a memorized faucet position: any disturbance (someone flushes) and the temperature drifts, and you never notice. Closed loop feels the water and adjusts continuously. Feedback trades a modest requirement (a sensor) for a superpower: precision from imprecise parts, and disturbance rejection for free.',
    diagram: { r: 'setpoint r', e: 'error e', pid: 'PID', u: 'input u', plant: 'plant', y: 'output y', minus: '−' },
    pidTitle: 'Interactive: the PID playground',
    pid1: 'The plant is a simulated mass on a spring with damping - sluggish and oscillation-prone, like most real hardware. Command a step from 0 to 1 and tune the three gains. The animated cart replays the response; the metrics quantify it. Work through the presets and you will have re-derived a century of control practice:',
    pidList: [
      'P - proportional: push harder the farther you are. Fast, but it must leave a permanent error: with zero error it pushes with zero force, and the spring wins. Watch the cart settle short of the target.',
      'PI - the integral accumulates the leftover error until it is gone. Steady-state error: eliminated. Price: the accumulated push overshoots, and with actuator limits it can wind up.',
      'PID - the derivative brakes proportionally to the approach speed, damping the overshoot. The full controller: fast, accurate, calm.',
    ],
    kp: 'Kp - proportional',
    ki: 'Ki - integral',
    kd: 'Kd - derivative',
    presets: 'Presets',
    presetNames: ['P only', 'PI', 'PID'],
    kick: 'Disturbance kick at t = 5 s',
    rise: 'rise time',
    overshoot: 'overshoot',
    settle: 'settling time',
    sse: 'steady-state error',
    unstableFlag: 'UNSTABLE',
    replay: 'cart replay',
    stabTitle: 'Interactive: the road to instability',
    stab1: 'Real actuators and sensors are not instant - here the plant reacts with a 0.25 s transport delay. Now cranking Kp is dangerous: your correction arrives late, pushes when it should already brake, feeds the oscillation instead of fighting it. Slide Kp up and watch the response go sluggish → crisp → ringing → divergent. The margin between "crisp" and "divergent" is what gain and phase margins measure - every delay in a loop eats stability.',
    stabKp: 'Kp (with 0.25 s delay)',
    rolesTitle: 'What each knob does',
    rolesHead: ['increase…', 'speed', 'steady-state error', 'overshoot', 'watch out for'],
    rolesRows: [
      ['Kp ↑', '↑', '↓ (never 0)', '↑', 'instability with delays'],
      ['Ki ↑', '→', 'eliminated', '↑', 'integrator windup at actuator limits'],
      ['Kd ↑', '→', '→', '↓', 'amplifies sensor noise'],
    ],
    roles2: 'Classical recipes like Ziegler-Nichols start from exactly the experiment you just did: raise Kp to the edge of oscillation, then back off with tabulated factors. Modern loops add feedforward (use the model, let feedback handle only the residual) - the same philosophy as the Kalman filter of the next module.',
    mathTitle: 'The controller in one line',
    codeTitle: 'In practice',
    appTitle: '🏭 In the real world: cruise control on a hill',
    appIntro:
      'Set your cruise control to 100 km/h and hit a 5 % grade: the hill is a sustained disturbance force, and what happens next is the P-vs-PI story made physical. A pure P controller needs a nonzero error to produce throttle - so on the hill it settles a few km/h BELOW the setpoint, forever. That permanent sag is the steady-state error from the theory above; you have felt it in old cars. The integral term accumulates the error second by second and quietly adds throttle until the error is exactly zero - the car sags briefly, then climbs back to 100 while still on the hill. Steepen the grade and watch the amber P-only car lose more speed while the cyan PI car always comes home.',
    appGrade: 'hill grade (from t = 20 s)',
    appKp: 'proportional gain Kp',
    appSagP: 'speed loss on hill (P only)',
    appSagPi: 'speed loss on hill (PI)',
    appLegend: 'amber dashed = P only · cyan = PI · gray = hill profile',
    appWhere:
      'The same integral action holds oven temperatures against door openings, quadcopter altitude against battery droop, generator frequency against load steps and dialysis flow against filter clogging - every “holds the value under load” claim hides an integrator.',
  },
  de: {
    kicker: 'Signale · Modul 2',
    title: 'Regelungstechnik',
    intro:
      'Ein Motor mit Reibung, eine Heizung mit Trägheit, eine Drohne im Wind - physikalische Systeme tun nie einfach, was man ihnen sagt. Die Antwort der Regelungstechnik ist Rückkopplung: Ausgang messen, mit dem Ziel vergleichen, korrigieren. Der PID-Regler - drei Terme, drei Knöpfe - betreibt die überwältigende Mehrheit aller Regelkreise der Welt, von CNC-Achsen bis zu Chemieanlagen.',
    loopTitle: 'Steuern vs. Regeln (offener vs. geschlossener Kreis)',
    loop1: 'Steuern ist eine Dusche mit auswendig gelernter Hahnstellung: Jede Störung (jemand spült) lässt die Temperatur driften, und man merkt es nie. Regeln fühlt das Wasser und justiert kontinuierlich nach. Rückkopplung tauscht eine bescheidene Voraussetzung (einen Sensor) gegen eine Superkraft: Präzision aus unpräzisen Teilen und Störunterdrückung gratis.',
    diagram: { r: 'Sollwert r', e: 'Fehler e', pid: 'PID', u: 'Stellgröße u', plant: 'Strecke', y: 'Istwert y', minus: '−' },
    pidTitle: 'Interaktiv: der PID-Spielplatz',
    pid1: 'Die Strecke ist eine simulierte Masse an einer Feder mit Dämpfung - träge und schwingfreudig, wie die meiste echte Hardware. Kommandiere einen Sprung von 0 auf 1 und stimme die drei Verstärkungen ab. Der animierte Wagen spielt die Antwort ab; die Kennwerte quantifizieren sie. Arbeite die Voreinstellungen durch, und du hast ein Jahrhundert Regelungspraxis nachvollzogen:',
    pidList: [
      'P - proportional: drücke stärker, je weiter du weg bist. Schnell, aber es muss ein bleibender Fehler übrig bleiben: Bei Fehler null drückt es mit Kraft null, und die Feder gewinnt. Sieh zu, wie der Wagen vor dem Ziel liegen bleibt.',
      'PI - der Integralanteil sammelt den Restfehler auf, bis er verschwunden ist. Bleibende Regelabweichung: eliminiert. Preis: Der aufgestaute Schub überschwingt, und bei Stellgrößenbegrenzung kann er sich aufziehen (Windup).',
      'PID - der Differenzialanteil bremst proportional zur Annäherungsgeschwindigkeit und dämpft das Überschwingen. Der volle Regler: schnell, genau, ruhig.',
    ],
    kp: 'Kp - Proportional',
    ki: 'Ki - Integral',
    kd: 'Kd - Differenzial',
    presets: 'Voreinstellungen',
    presetNames: ['nur P', 'PI', 'PID'],
    kick: 'Störstoß bei t = 5 s',
    rise: 'Anstiegszeit',
    overshoot: 'Überschwingen',
    settle: 'Ausregelzeit',
    sse: 'bleibende Abweichung',
    unstableFlag: 'INSTABIL',
    replay: 'Wagen-Replay',
    stabTitle: 'Interaktiv: der Weg in die Instabilität',
    stab1: 'Echte Aktoren und Sensoren sind nicht augenblicklich - hier reagiert die Strecke mit 0,25 s Totzeit. Jetzt ist hohes Kp gefährlich: Die Korrektur kommt zu spät, drückt, wenn sie längst bremsen müsste, und füttert die Schwingung, statt sie zu bekämpfen. Schiebe Kp hoch und sieh die Antwort träge → knackig → klingelnd → divergent werden. Der Abstand zwischen „knackig“ und „divergent“ ist genau das, was Amplituden- und Phasenreserve messen - jede Totzeit im Kreis frisst Stabilität.',
    stabKp: 'Kp (mit 0,25 s Totzeit)',
    rolesTitle: 'Was jeder Knopf bewirkt',
    rolesHead: ['erhöhe…', 'Tempo', 'bleibende Abweichung', 'Überschwingen', 'Vorsicht bei'],
    rolesRows: [
      ['Kp ↑', '↑', '↓ (nie 0)', '↑', 'Instabilität bei Totzeiten'],
      ['Ki ↑', '→', 'eliminiert', '↑', 'Integrator-Windup an Stellgrenzen'],
      ['Kd ↑', '→', '→', '↓', 'verstärkt Sensorrauschen'],
    ],
    roles2: 'Klassische Rezepte wie Ziegler-Nichols starten mit genau dem Experiment von eben: Kp bis an die Schwinggrenze erhöhen, dann mit tabellierten Faktoren zurücknehmen. Moderne Kreise ergänzen Vorsteuerung (nutze das Modell, lass die Rückkopplung nur den Rest erledigen) - dieselbe Philosophie wie beim Kalman-Filter im nächsten Modul.',
    mathTitle: 'Der Regler in einer Zeile',
    codeTitle: 'In der Praxis',
    appTitle: '🏭 In der echten Welt: Tempomat am Berg',
    appIntro:
      'Stell den Tempomat auf 100 km/h und triff auf eine 5-%-Steigung: Der Berg ist eine anhaltende Störkraft, und was dann passiert, ist die P-gegen-PI-Geschichte in physischer Form. Ein reiner P-Regler braucht einen Fehler ungleich null, um Gas zu geben - am Berg pendelt er sich also ein paar km/h UNTER dem Sollwert ein, für immer. Dieses dauerhafte Absacken ist die bleibende Regelabweichung aus der Theorie oben; in alten Autos hast du sie gespürt. Der Integralanteil summiert den Fehler Sekunde für Sekunde und gibt leise mehr Gas, bis der Fehler exakt null ist - das Auto sackt kurz ab und klettert dann noch am Berg zurück auf 100. Mach die Steigung steiler und sieh zu, wie das bernsteinfarbene P-Auto mehr Tempo verliert, während das cyanfarbene PI-Auto immer heimkommt.',
    appGrade: 'Steigung (ab t = 20 s)',
    appKp: 'Proportionalverstärkung Kp',
    appSagP: 'Tempoverlust am Berg (nur P)',
    appSagPi: 'Tempoverlust am Berg (PI)',
    appLegend: 'bernstein gestrichelt = nur P · cyan = PI · grau = Bergprofil',
    appWhere:
      'Dieselbe Integralwirkung hält Ofentemperaturen gegen Türöffnungen, Quadrocopter-Höhe gegen Batterieschwund, Generatorfrequenz gegen Lastsprünge und Dialyse-Durchfluss gegen zusetzende Filter - hinter jedem „hält den Wert unter Last“ steckt ein Integrierer.',
  },
}

const SNIPPET = `import numpy as np

dt, T = 0.005, 8.0
Kp, Ki, Kd = 16.0, 8.0, 6.0
x = v = integral = prev = 0.0
for t in np.arange(0, T, dt):
    err = 1.0 - x
    integral += err * dt
    u = Kp*err + Ki*integral - Kd*(x - prev)/dt
    prev = x
    a = (u - 2.2*v - 3.0*x) / 1.0        # m·x'' = u − c·x' − k·x
    v += a * dt
    x += v * dt`

const PLANT = { m: 1, c: 2.2, k: 3, dt: 0.005, T: 8, delay: 0, setpoint: 1 }

// ---------------------------------------------------------------- block diagram

function BlockDiagram() {
  const t = useT(T)
  const d = t.diagram
  return (
    <svg viewBox="0 0 640 150" className="mx-auto my-4 w-full max-w-2xl">
      <defs>
        <marker id="ctlArr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,1 L7,4 L0,7 z" fill="#8b93a7" />
        </marker>
      </defs>
      <g stroke="#8b93a7" strokeWidth={1.6} fill="none">
        <line x1={20} y1={60} x2={100} y2={60} markerEnd="url(#ctlArr)" />
        <circle cx={120} cy={60} r={16} />
        <line x1={136} y1={60} x2={205} y2={60} markerEnd="url(#ctlArr)" />
        <rect x={210} y={38} width={100} height={44} rx={8} />
        <line x1={310} y1={60} x2={380} y2={60} markerEnd="url(#ctlArr)" />
        <rect x={385} y={38} width={110} height={44} rx={8} />
        <line x1={495} y1={60} x2={600} y2={60} markerEnd="url(#ctlArr)" />
        <polyline points="550,60 550,125 120,125 120,80" markerEnd="url(#ctlArr)" />
      </g>
      <g fill="#e6eaf2" fontSize={13} fontFamily="Inter, sans-serif">
        <text x={20} y={50}>{d.r}</text>
        <text x={150} y={50} fill="#8b93a7" fontSize={12}>{d.e}</text>
        <text x={260} y={65} textAnchor="middle" fill="#22d3ee" fontWeight={700}>{d.pid}</text>
        <text x={330} y={50} fill="#8b93a7" fontSize={12}>{d.u}</text>
        <text x={440} y={65} textAnchor="middle" fill="#a78bfa" fontWeight={700}>{d.plant}</text>
        <text x={560} y={50}>{d.y}</text>
        <text x={104} y={84} fill="#f87171" fontSize={15}>{d.minus}</text>
        <text x={124} y={54} fill="#4ade80" fontSize={14}>+</text>
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------- response plot + cart

function ResponsePlot({ res, animT, setpoint }: { res: PidResult; animT: number | null; setpoint: number }) {
  const PW = 560
  const PH = 270
  const yMin = -0.3
  const yMax = 2.2
  const px = (tt: number) => (tt / PLANT.T) * PW
  const py = (v: number) => PH - 24 - ((Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * (PH - 40)
  const curAnimY = animT !== null ? res.y[Math.min(Math.floor(animT / PLANT.dt), res.y.length - 1)] : null
  return (
    <div className="card overflow-hidden">
      <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
        <line x1={0} y1={py(setpoint)} x2={PW} y2={py(setpoint)} stroke="rgba(74,222,128,0.5)" strokeWidth={1.2} strokeDasharray="6 4" />
        <line x1={0} y1={py(0)} x2={PW} y2={py(0)} stroke="rgba(255,255,255,0.15)" />
        <polyline
          points={res.t.filter((_, i) => i % 4 === 0).map((tt, i) => `${px(tt)},${py(res.y[i * 4])}`).join(' ')}
          fill="none"
          stroke="#22d3ee"
          strokeWidth={2.2}
        />
        {animT !== null && curAnimY !== null && (
          <>
            <line x1={px(animT)} y1={12} x2={px(animT)} y2={PH - 24} stroke="rgba(251,191,36,0.4)" strokeWidth={1} />
            <circle cx={px(animT)} cy={py(curAnimY)} r={5.5} fill="#fbbf24" stroke="#0a0e17" strokeWidth={1.5} />
          </>
        )}
      </svg>
    </div>
  )
}

function CartTrack({ res, animT, label }: { res: PidResult; animT: number; label: string }) {
  const y = res.y[Math.min(Math.floor(animT / PLANT.dt), res.y.length - 1)]
  const pct = Math.min(Math.max((y + 0.3) / 2.0, 0), 1) * 84
  const targetPct = ((1 + 0.3) / 2.0) * 84
  return (
    <div className="card px-4 py-3">
      <div className="mb-2 text-[11px] font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className="relative h-9">
        <div className="absolute top-6 right-0 left-0 h-1 rounded bg-white/10" />
        <div className="absolute top-1 bottom-0 w-0.5 bg-green-400/60" style={{ left: `${targetPct + 4}%` }} />
        <div
          className="absolute top-1.5 h-5 w-8 rounded-md border border-accent/60 bg-accent/30"
          style={{ left: `${pct}%`, transition: 'left 40ms linear' }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- PID lab

function PidLab() {
  const t = useT(T)
  const [kp, setKp] = useState(8)
  const [ki, setKi] = useState(0)
  const [kd, setKd] = useState(0)
  const [kick, setKick] = useState(false)
  const [animT, setAnimT] = useState(0)

  const res = useMemo(
    () => simulatePid(kp, ki, kd, { ...PLANT, kick: kick ? { t: 5, f: -10 } : undefined }),
    [kp, ki, kd, kick],
  )

  useEffect(() => {
    const iv = setInterval(() => setAnimT((prev) => (prev + 0.04 > PLANT.T ? 0 : prev + 0.04)), 40)
    return () => clearInterval(iv)
  }, [])

  const m = res.metrics
  const presets = [
    { kp: 8, ki: 0, kd: 0 },
    { kp: 8, ki: 6, kd: 0 },
    { kp: 16, ki: 8, kd: 6 },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="flex flex-col gap-3 lg:col-span-3">
        <ResponsePlot res={res} animT={animT} setpoint={1} />
        <CartTrack res={res} animT={animT} label={t.replay} />
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <div className="flex flex-wrap gap-2">
            {t.presetNames.map((name, i) => (
              <button
                key={i}
                className="btn text-xs"
                onClick={() => {
                  setKp(presets[i].kp)
                  setKi(presets[i].ki)
                  setKd(presets[i].kd)
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <Slider label={t.kp} value={kp} min={0} max={40} step={0.5} onChange={setKp} format={(v) => fmt(v, 1)} />
          <Slider label={t.ki} value={ki} min={0} max={20} step={0.5} onChange={setKi} format={(v) => fmt(v, 1)} accent="#a78bfa" />
          <Slider label={t.kd} value={kd} min={0} max={15} step={0.5} onChange={setKd} format={(v) => fmt(v, 1)} accent="#4ade80" />
          <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-[13px] font-medium text-muted select-none">
            <input type="checkbox" checked={kick} onChange={(e) => setKick(e.target.checked)} className="h-4 w-4 accent-red-400" />
            {t.kick}
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.rise} value={m.rise !== null ? fmt(m.rise, 2) : '-'} unit="s" />
          <Readout label={t.overshoot} value={fmt(m.overshoot, 1)} unit="%" accent={m.overshoot > 25 ? '#f87171' : undefined} />
          <Readout label={t.settle} value={m.settle !== null && !m.unstable ? fmt(m.settle, 2) : '-'} unit="s" />
          <Readout label={t.sse} value={fmt(m.sse, 3)} accent={m.sse < 0.01 ? '#4ade80' : '#fbbf24'} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- stability lab

function StabilityLab() {
  const t = useT(T)
  const [kp, setKp] = useState(6)
  const res = useMemo(
    () => simulatePid(kp, 3, 0, { ...PLANT, delay: 0.25 }),
    [kp],
  )
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <ResponsePlot res={res} animT={null} setpoint={1} />
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad">
          <Slider label={t.stabKp} value={kp} min={1} max={40} step={0.5} onChange={setKp} format={(v) => fmt(v, 1)} accent="#f87171" />
        </div>
        {res.metrics.unstable && (
          <div className="card border-red-400/50 bg-red-400/10 px-4 py-3 text-center font-mono text-lg font-bold text-red-400">
            ⚠ {t.unstableFlag}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- application: cruise control

const CAR_M = 1500 // kg
const CAR_C = 60 // N·s/m linearized drag+rolling
const V_SET = 27.78 // 100 km/h in m/s
const HILL_T = 20 // s
const CRUISE_T = 60 // s

function simulateCruise(kp: number, ki: number, gradePct: number): number[] {
  const dt = 0.05
  const n = Math.round(CRUISE_T / dt)
  let v = V_SET
  let integ = 0
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const time = i * dt
    const e = V_SET - v
    integ += e * dt
    integ = Math.max(-800 / Math.max(ki, 1e-9), Math.min(800 / Math.max(ki, 1e-9), integ))
    let u = kp * e + ki * integ + CAR_C * V_SET // feedforward for flat-road cruise
    u = Math.max(0, Math.min(7000, u))
    const hill = time >= HILL_T ? CAR_M * 9.81 * (gradePct / 100) : 0
    const acc = (u - CAR_C * v - hill) / CAR_M
    v += acc * dt
    out.push(v)
  }
  return out
}

function CruiseLab() {
  const t = useT(T)
  const [grade, setGrade] = useState(5)
  const [kp, setKp] = useState(300)

  const vP = useMemo(() => simulateCruise(kp, 0, grade), [kp, grade])
  const vPi = useMemo(() => simulateCruise(kp, 25, grade), [kp, grade])
  const sagP = (V_SET - Math.min(...vP.slice(Math.floor(vP.length * 0.9)))) * 3.6
  const sagPi = (V_SET - vPi[vPi.length - 1]) * 3.6

  const PW = 560
  const PH = 250
  const sx = (i: number) => (i / (vP.length - 1)) * PW
  const sy = (v: number) => 40 + (V_SET + 1.5 - v) * 3.6 * 14

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          {/* hill profile strip at the bottom */}
          <polygon
            points={`${(HILL_T / CRUISE_T) * PW},${PH - 8} ${PW},${PH - 8 - grade * 3.5} ${PW},${PH - 8} `}
            fill="#5b627055"
          />
          <line x1={0} y1={sy(V_SET)} x2={PW} y2={sy(V_SET)} stroke="#8b93a755" strokeDasharray="5 4" />
          <text x={6} y={sy(V_SET) - 5} fill="#8b93a7" fontSize={10.5} fontFamily="JetBrains Mono, monospace">
            100 km/h
          </text>
          <polyline points={vP.map((v, i) => `${sx(i)},${sy(v)}`).join(' ')} fill="none" stroke="#fbbf24" strokeWidth={1.8} strokeDasharray="6 4" />
          <polyline points={vPi.map((v, i) => `${sx(i)},${sy(v)}`).join(' ')} fill="none" stroke="#22d3ee" strokeWidth={2.2} />
        </svg>
        <div className="border-t border-white/10 px-4 py-2 text-[12px] text-muted">{t.appLegend}</div>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.appGrade} value={grade} min={0} max={8} step={0.5} onChange={setGrade} format={(v) => `${fmt(v, 1)} %`} />
          <Slider label={t.appKp} value={kp} min={100} max={900} step={20} onChange={setKp} accent="#a78bfa" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.appSagP} value={fmt(sagP, 1)} unit="km/h" accent={sagP > 1 ? '#fbbf24' : '#4ade80'} />
          <Readout label={t.appSagPi} value={fmt(Math.max(sagPi, 0), 1)} unit="km/h" accent={Math.abs(sagPi) < 0.5 ? '#4ade80' : '#fbbf24'} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function ControlPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'loop', label: t.loopTitle },
          { id: 'pid', label: t.pidTitle },
          { id: 'stability', label: t.stabTitle },
          { id: 'roles', label: t.rolesTitle },
          { id: 'math', label: t.mathTitle },
          { id: 'application', label: t.appTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="loop" title={t.loopTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.loop1}</p>
        </div>
        <div className="card-pad my-4">
          <BlockDiagram />
        </div>
      </Section>

      <Section id="pid" title={t.pidTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.pid1}</p>
          <ul>
            {t.pidList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="mt-4">
          <PidLab />
        </div>
      </Section>

      <Section id="stability" title={t.stabTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.stab1}</p>
        </div>
        <div className="mt-4">
          <StabilityLab />
        </div>
      </Section>

      <Section id="roles" title={t.rolesTitle}>
        <div className="card max-w-3xl overflow-hidden">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-muted">
                {t.rolesHead.map((h, i) => (
                  <th key={i} className="px-3.5 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rolesRows.map((row, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className={`px-3.5 py-2.5 ${j === 0 ? 'font-mono text-accent' : 'text-ink/85'}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="prose-cv mt-4 max-w-3xl">
          <p>{t.roles2}</p>
        </div>
      </Section>

      <Section id="math" title={t.mathTitle}>
        <div className="prose-cv max-w-3xl">
          <TeX block>{String.raw`u(t) \;=\; K_p\, e(t) \;+\; K_i \int_0^t e(\tau)\, d\tau \;+\; K_d\, \frac{de(t)}{dt}, \qquad e = r - y`}</TeX>
        </div>
        <pre className="card mt-4 overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-ink/85">{SNIPPET}</pre>
      </Section>

      <Section id="application" title={t.appTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.appIntro}</p>
        </div>
        <div className="mt-4">
          <CruiseLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
