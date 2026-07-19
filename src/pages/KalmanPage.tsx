import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Slider } from '../components/ui'
import { fmt } from '../lib/math'
import { covEllipse, fuseGauss, kf1dSim, kf2dInit, kf2dPredict, kf2dUpdate, type Kf2d } from '../lib/signal'
import { makeGauss } from '../lib/stats'

const T = {
  en: {
    kicker: 'Signals · Module 3',
    title: 'The Kalman Filter',
    intro:
      'You have a motion model (imperfect) and a sensor (noisy). Trusting either alone is bad engineering; the Kalman filter combines both, weighted by how much each deserves to be trusted - and updates that trust every step. It guides spacecraft, fuses GPS with IMUs, tracks objects in video, and by the end of this page it will be chasing your mouse.',
    fuseTitle: 'Interactive: fusing two uncertain opinions',
    fuse1: 'The atomic operation first. Two sensors measure the same quantity, each reporting a value and an uncertainty. The optimal fusion is a precision-weighted average - pulled toward the more certain sensor - and its uncertainty is smaller than either input. Information only adds up. The Kalman filter is nothing but this operation, applied every tick between "what my model predicts" and "what my sensor says".',
    s1: 'sensor A: value',
    s1sig: 'sensor A: σ',
    s2: 'sensor B: value',
    s2sig: 'sensor B: σ',
    fusedM: 'fused value',
    fusedS: 'fused σ',
    trackTitle: 'Interactive: tracking a moving target in 1D',
    track1: 'A target drifts with roughly constant velocity; you receive noisy position measurements (dots). The filter alternates predict (advance the state with the motion model, uncertainty grows) and update (fuse with the measurement, uncertainty shrinks). The amber line is its estimate, the band its ±2σ confidence. Two knobs rule its character:',
    trackList: [
      'R - how noisy you declare the sensor. Large R: measurements are distrusted → buttery smooth but laggy.',
      'Q - how much you allow the model to be wrong. Large Q: the filter stays alert → responsive but jittery.',
    ],
    track2: 'Press "maneuver": the target suddenly reverses. A filter tuned too smooth (small Q) lags painfully behind - the fundamental smoothness-vs-agility trade-off of every tracker.',
    rLabel: 'measurement noise R (σ)',
    qLabel: 'process noise Q (σ)',
    maneuver: 'target maneuvers at mid-run',
    estErr: 'estimate RMS error',
    measErr: 'raw measurement RMS',
    gain: 'Kalman gain (final)',
    play: 'Play',
    pause: 'Pause',
    restart: 'Restart',
    mouseTitle: 'Interactive: it chases your mouse',
    mouse1: 'Move your cursor inside the box. The filter never sees it - it only receives noisy samples (cyan flashes) and runs a constant-velocity model. The amber dot is its estimate; the ellipse is its 2σ position uncertainty, computed from the covariance it maintains about itself. Two things to try: move smoothly, then change direction sharply - watch the estimate overshoot (the model believed in the old velocity). And leave the box: with no measurements the filter free-runs on its model and the ellipse balloons - uncertainty growing honestly with every unobserved step.',
    mouseNoise: 'sensor noise σ',
    mouseQ: 'process noise Q',
    mathTitle: 'The two-step dance, formally',
    math1: 'State estimate x̂ with covariance P; motion model F, process noise Q; measurement z with model H and noise R. Predict, then update:',
    math2: 'The Kalman gain K is exactly the precision weighting of the fusion lab - the whole filter is Bayes’ rule (Math track) applied sequentially with Gaussians, which is why it is provably optimal for linear systems with Gaussian noise. And the least-squares spirit is no accident: the filter is recursive least squares with a forgetting mechanism.',
    practTitle: 'Practice & where to go next',
    practList: [
      'Tuning is the craft: R from sensor datasheets or logged statistics; Q by admitting how wrong the constant-velocity (or other) model can be. The maneuver test above is the honest benchmark.',
      'Innovation monitoring: if measurements consistently fall outside the predicted band, your model or noise assumptions are wrong - the filter can self-diagnose.',
      'Nonlinear systems (a camera measuring pixels of a 3D object - the Vision track!) need the extended (EKF) or unscented (UKF) variants: same dance, linearized locally.',
      'Fuse many sensors by stacking measurement models: GPS + IMU + wheel odometry + the calibrated camera from the hand-eye module. That road leads to SLAM (roadmap).',
    ],
    codeTitle: 'In practice',
    appTitle: '🏭 In the real world: navigating through a tunnel',
    appIntro:
      'Your car’s navigation keeps showing a confident position inside a tunnel - with zero GPS. This lab shows the machinery: a vehicle drives a curved route while a Kalman filter fuses noisy GPS fixes with its motion model. In the gray tunnel segment the GPS drops out entirely, and the filter does the only honest thing: it keeps predicting from its velocity state while its uncertainty ellipse balloons step by step - no measurements, no confidence. At the tunnel exit one single GPS fix snaps the estimate back and collapses the ellipse. Lengthen the tunnel and watch how prediction quality decays with time - this graceful degradation, not magic accuracy, is what makes the filter trustworthy.',
    appTunnel: 'tunnel length',
    appGpsR: 'GPS noise σ',
    appErrExit: 'position error at tunnel exit',
    appEllipse: 'ellipse area: tunnel end vs. before',
    appLegend: 'gray band = tunnel (no GPS) · dots = GPS fixes · cyan = fused estimate with 2σ ellipses · white dashes = truth',
    appWhere:
      'The same predict-through-the-gap pattern bridges GPS outages in drones between buildings, ultrasound dropouts in surgical tracking, barcode gaps on warehouse conveyors and radar shadows in air-traffic control.',
  },
  de: {
    kicker: 'Signale · Modul 3',
    title: 'Das Kalman-Filter',
    intro:
      'Du hast ein Bewegungsmodell (unvollkommen) und einen Sensor (verrauscht). Nur einem von beiden zu vertrauen ist schlechtes Engineering; das Kalman-Filter kombiniert beide, gewichtet danach, wie viel Vertrauen jeder verdient - und aktualisiert dieses Vertrauen in jedem Schritt. Es lenkt Raumfahrzeuge, fusioniert GPS mit IMUs, verfolgt Objekte in Videos, und am Ende dieser Seite jagt es deiner Maus hinterher.',
    fuseTitle: 'Interaktiv: zwei unsichere Meinungen verschmelzen',
    fuse1: 'Zuerst die atomare Operation. Zwei Sensoren messen dieselbe Größe, jeder meldet Wert und Unsicherheit. Die optimale Fusion ist ein präzisionsgewichteter Mittelwert - zum sichereren Sensor hingezogen - und ihre Unsicherheit ist kleiner als jede der beiden Eingaben. Information addiert sich nur. Das Kalman-Filter ist nichts als diese Operation, in jedem Takt angewandt zwischen „was mein Modell vorhersagt“ und „was mein Sensor sagt“.',
    s1: 'Sensor A: Wert',
    s1sig: 'Sensor A: σ',
    s2: 'Sensor B: Wert',
    s2sig: 'Sensor B: σ',
    fusedM: 'fusionierter Wert',
    fusedS: 'fusioniertes σ',
    trackTitle: 'Interaktiv: ein bewegtes Ziel in 1D verfolgen',
    track1: 'Ein Ziel driftet mit ungefähr konstanter Geschwindigkeit; du erhältst verrauschte Positionsmessungen (Punkte). Das Filter wechselt zwischen Prädiktion (Zustand mit dem Bewegungsmodell fortschreiben, Unsicherheit wächst) und Korrektur (mit der Messung verschmelzen, Unsicherheit schrumpft). Die bernsteinfarbene Linie ist seine Schätzung, das Band sein ±2σ-Vertrauen. Zwei Knöpfe bestimmen seinen Charakter:',
    trackList: [
      'R - für wie verrauscht du den Sensor erklärst. Großes R: Messungen wird misstraut → butterweich, aber träge.',
      'Q - wie viel Irrtum du dem Modell zugestehst. Großes Q: das Filter bleibt wachsam → reaktionsschnell, aber zappelig.',
    ],
    track2: 'Drücke „Manöver“: Das Ziel kehrt plötzlich um. Ein zu glatt abgestimmtes Filter (kleines Q) hinkt schmerzhaft hinterher - der fundamentale Kompromiss zwischen Glätte und Agilität jedes Trackers.',
    rLabel: 'Messrauschen R (σ)',
    qLabel: 'Prozessrauschen Q (σ)',
    maneuver: 'Ziel manövriert in der Mitte',
    estErr: 'RMS-Fehler der Schätzung',
    measErr: 'RMS der Rohmessung',
    gain: 'Kalman-Gain (final)',
    play: 'Start',
    pause: 'Pause',
    restart: 'Neu starten',
    mouseTitle: 'Interaktiv: es jagt deine Maus',
    mouse1: 'Bewege den Cursor in der Box. Das Filter sieht ihn nie - es erhält nur verrauschte Stichproben (cyan aufblitzend) und rechnet mit einem Konstantgeschwindigkeitsmodell. Der bernsteinfarbene Punkt ist seine Schätzung; die Ellipse seine 2σ-Positionsunsicherheit, berechnet aus der Kovarianz, die es über sich selbst führt. Zwei Experimente: Bewege dich glatt und wechsle dann scharf die Richtung - die Schätzung schießt über (das Modell glaubte an die alte Geschwindigkeit). Und verlasse die Box: Ohne Messungen läuft das Filter frei auf seinem Modell, und die Ellipse bläht sich auf - Unsicherheit, die mit jedem unbeobachteten Schritt ehrlich wächst.',
    mouseNoise: 'Sensorrauschen σ',
    mouseQ: 'Prozessrauschen Q',
    mathTitle: 'Der Zweischritt, formal',
    math1: 'Zustandsschätzung x̂ mit Kovarianz P; Bewegungsmodell F, Prozessrauschen Q; Messung z mit Modell H und Rauschen R. Prädiktion, dann Korrektur:',
    math2: 'Das Kalman-Gain K ist exakt die Präzisionsgewichtung aus dem Fusionslabor - das ganze Filter ist der Satz von Bayes (Mathe-Track), sequenziell mit Gauß-Verteilungen angewandt. Deshalb ist es für lineare Systeme mit Gauß-Rauschen beweisbar optimal. Und der Geist der kleinsten Quadrate ist kein Zufall: Das Filter ist rekursive Ausgleichsrechnung mit Vergessensmechanismus.',
    practTitle: 'Praxis & Ausblick',
    practList: [
      'Tuning ist das Handwerk: R aus Sensordatenblättern oder geloggten Statistiken; Q durch das Eingeständnis, wie falsch das Konstantgeschwindigkeits- (oder andere) Modell sein kann. Der Manövertest oben ist der ehrliche Maßstab.',
      'Innovationsüberwachung: Fallen Messungen dauerhaft aus dem vorhergesagten Band, stimmen Modell- oder Rauschannahmen nicht - das Filter kann sich selbst diagnostizieren.',
      'Nichtlineare Systeme (eine Kamera, die Pixel eines 3D-Objekts misst - der Vision-Track!) brauchen die erweiterten Varianten EKF oder UKF: derselbe Tanz, lokal linearisiert.',
      'Viele Sensoren fusioniert man durch Stapeln der Messmodelle: GPS + IMU + Radodometrie + die kalibrierte Kamera aus dem Hand-Auge-Modul. Dieser Weg führt zu SLAM (Roadmap).',
    ],
    codeTitle: 'In der Praxis',
    appTitle: '🏭 In der echten Welt: Navigation durch einen Tunnel',
    appIntro:
      'Das Navi deines Autos zeigt im Tunnel weiter selbstbewusst eine Position - ganz ohne GPS. Dieses Labor zeigt die Maschinerie: Ein Fahrzeug fährt eine kurvige Route, während ein Kalman-Filter verrauschte GPS-Fixes mit seinem Bewegungsmodell fusioniert. Im grauen Tunnelabschnitt fällt das GPS komplett aus, und das Filter tut das einzig Ehrliche: Es prädiziert aus seinem Geschwindigkeitszustand weiter, während seine Unsicherheitsellipse Schritt für Schritt aufbläht - keine Messungen, kein Vertrauen. Am Tunnelausgang lässt ein einziger GPS-Fix die Schätzung zurückschnappen und die Ellipse kollabieren. Verlängere den Tunnel und beobachte, wie die Prädiktionsqualität mit der Zeit zerfällt - dieses würdevolle Degradieren, nicht magische Genauigkeit, macht das Filter vertrauenswürdig.',
    appTunnel: 'Tunnellänge',
    appGpsR: 'GPS-Rauschen σ',
    appErrExit: 'Positionsfehler am Tunnelausgang',
    appEllipse: 'Ellipsenfläche: Tunnelende vs. davor',
    appLegend: 'graues Band = Tunnel (kein GPS) · Punkte = GPS-Fixes · cyan = fusionierte Schätzung mit 2σ-Ellipsen · weiß gestrichelt = Wahrheit',
    appWhere:
      'Dasselbe Durch-die-Lücke-Prädizieren überbrückt GPS-Ausfälle von Drohnen zwischen Gebäuden, Ultraschall-Aussetzer im OP-Tracking, Barcode-Lücken auf Förderbändern und Radarschatten in der Flugsicherung.',
  },
}

const SNIPPET = `import numpy as np

F = np.array([[1, dt], [0, 1]]);  H = np.array([[1, 0]])
x = np.zeros(2);  P = np.eye(2) * 10

for z in measurements:
    x = F @ x                                # predict
    P = F @ P @ F.T + Q
    S = H @ P @ H.T + R                      # update
    K = P @ H.T @ np.linalg.inv(S)
    x = x + K @ (z - H @ x)
    P = (np.eye(2) - K @ H) @ P`

// ---------------------------------------------------------------- fusion lab

function FusionLab() {
  const t = useT(T)
  const [m1, setM1] = useState(-0.8)
  const [s1, setS1] = useState(0.8)
  const [m2, setM2] = useState(0.9)
  const [s2, setS2] = useState(0.45)
  const fused = fuseGauss(m1, s1, m2, s2)

  const PW = 560
  const PH = 260
  const XR = 3.2
  const px = (x: number) => ((x + XR) / (2 * XR)) * PW
  const gauss = (m: number, s: number, x: number) =>
    Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI))
  const maxY = gauss(0, Math.min(s1, s2, fused.s), 0) * 1.12
  const curve = (m: number, s: number) =>
    Array.from({ length: 160 }, (_, i) => {
      const x = -XR + (i / 159) * 2 * XR
      return `${px(x)},${PH - 18 - (gauss(m, s, x) / maxY) * (PH - 34)}`
    }).join(' ')

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          <polyline points={curve(m1, s1)} fill="none" stroke="#22d3ee" strokeWidth={2} opacity={0.8} />
          <polyline points={curve(m2, s2)} fill="none" stroke="#a78bfa" strokeWidth={2} opacity={0.8} />
          <polyline points={curve(fused.m, fused.s)} fill="none" stroke="#fbbf24" strokeWidth={2.8} />
          <line x1={0} y1={PH - 18} x2={PW} y2={PH - 18} stroke="rgba(255,255,255,0.2)" />
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad grid grid-cols-2 gap-x-5 gap-y-3">
          <Slider label={t.s1} value={m1} min={-2} max={2} step={0.05} onChange={setM1} format={(v) => fmt(v, 2)} />
          <Slider label={t.s1sig} value={s1} min={0.15} max={1.5} step={0.05} onChange={setS1} format={(v) => fmt(v, 2)} />
          <Slider label={t.s2} value={m2} min={-2} max={2} step={0.05} onChange={setM2} format={(v) => fmt(v, 2)} accent="#a78bfa" />
          <Slider label={t.s2sig} value={s2} min={0.15} max={1.5} step={0.05} onChange={setS2} format={(v) => fmt(v, 2)} accent="#a78bfa" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.fusedM} value={fmt(fused.m, 3)} accent="#fbbf24" />
          <Readout label={t.fusedS} value={fmt(fused.s, 3)} accent="#4ade80" />
        </div>
        <TeX block>{String.raw`\mu = \frac{\mu_1/\sigma_1^2 + \mu_2/\sigma_2^2}{1/\sigma_1^2 + 1/\sigma_2^2}, \qquad \frac{1}{\sigma^2} = \frac{1}{\sigma_1^2} + \frac{1}{\sigma_2^2}`}</TeX>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 1D tracking lab

const TRACK_N = 130

function Track1dLab() {
  const t = useT(T)
  const [r, setR] = useState(1.2)
  const [q, setQ] = useState(0.3)
  const [maneuver, setManeuver] = useState(false)
  const [animIdx, setAnimIdx] = useState(TRACK_N)
  const [playing, setPlaying] = useState(false)

  const sim = useMemo(
    () =>
      kf1dSim({
        n: TRACK_N,
        dt: 0.1,
        qTrue: 0.5,
        q,
        r,
        seed: 7,
        maneuverAt: maneuver ? 62 : undefined,
      }),
    [r, q, maneuver],
  )

  useEffect(() => {
    if (!playing) return
    const iv = setInterval(
      () =>
        setAnimIdx((i) => {
          if (i >= TRACK_N) return 1
          return i + 1
        }),
      45,
    )
    return () => clearInterval(iv)
  }, [playing])

  const upto = Math.min(animIdx, TRACK_N)
  const all = [...sim.truth, ...sim.meas]
  const yMin = Math.min(...all) - 1
  const yMax = Math.max(...all) + 1
  const PW = 560
  const PH = 320
  const px = (i: number) => (i / (TRACK_N - 1)) * PW
  const py = (v: number) => PH - 16 - ((v - yMin) / (yMax - yMin)) * (PH - 32)

  const rms = (a: number[], b: number[]) =>
    Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length)

  const band = [
    ...sim.est.slice(0, upto).map((v, i) => `${px(i)},${py(v + 2 * sim.sigma[i])}`),
    ...sim.est
      .slice(0, upto)
      .map((v, i) => `${px(upto - 1 - i)},${py(sim.est[upto - 1 - i] - 2 * sim.sigma[upto - 1 - i])}`),
  ].join(' ')

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          <polygon points={band} fill="rgba(251,191,36,0.12)" />
          <polyline
            points={sim.truth.slice(0, upto).map((v, i) => `${px(i)},${py(v)}`).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          {sim.meas.slice(0, upto).map((v, i) => (
            <circle key={i} cx={px(i)} cy={py(v)} r={2.3} fill="#22d3ee" opacity={0.6} />
          ))}
          <polyline
            points={sim.est.slice(0, upto).map((v, i) => `${px(i)},${py(v)}`).join(' ')}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={2.4}
          />
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.rLabel} value={r} min={0.2} max={3} step={0.05} onChange={setR} format={(v) => fmt(v, 2)} />
          <Slider label={t.qLabel} value={q} min={0.02} max={2} step={0.02} onChange={setQ} format={(v) => fmt(v, 2)} accent="#a78bfa" />
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-muted select-none">
            <input type="checkbox" checked={maneuver} onChange={(e) => setManeuver(e.target.checked)} className="h-4 w-4 accent-red-400" />
            {t.maneuver}
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => { setPlaying(!playing); if (!playing) setAnimIdx(1) }}>
              {playing ? `⏸ ${t.pause}` : `▶ ${t.play}`}
            </button>
            <button className="btn" onClick={() => { setAnimIdx(TRACK_N); setPlaying(false) }}>
              ↺ {t.restart}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.estErr} value={fmt(rms(sim.est, sim.truth), 3)} accent="#fbbf24" />
          <Readout label={t.measErr} value={fmt(rms(sim.meas, sim.truth), 3)} accent="#22d3ee" />
          <Readout label={t.gain} value={fmt(sim.gain[TRACK_N - 1], 3)} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 2D mouse chase

const MW = 560
const MH = 380

function MouseChaseLab() {
  const t = useT(T)
  const [noise, setNoise] = useState(18)
  const [q, setQ] = useState(60)
  const [tick, setTick] = useState(0)

  const kfRef = useRef<Kf2d>(kf2dInit(MW / 2, MH / 2))
  const cursorRef = useRef<{ x: number; y: number; inside: boolean }>({ x: MW / 2, y: MH / 2, inside: false })
  const measRef = useRef<{ x: number; y: number; age: number }[]>([])
  const trailRef = useRef<{ x: number; y: number }[]>([])
  const gaussRef = useRef(makeGauss(31))

  useEffect(() => {
    const iv = setInterval(() => {
      const kf = kfRef.current
      kf2dPredict(kf, 0.05, q)
      if (cursorRef.current.inside) {
        const zx = cursorRef.current.x + gaussRef.current() * noise
        const zy = cursorRef.current.y + gaussRef.current() * noise
        kf2dUpdate(kf, zx, zy, noise)
        measRef.current = [...measRef.current, { x: zx, y: zy, age: 0 }].slice(-8)
      }
      measRef.current = measRef.current.map((m) => ({ ...m, age: m.age + 1 }))
      trailRef.current = [...trailRef.current, { x: kf.x[0], y: kf.x[1] }].slice(-60)
      setTick((x) => x + 1)
    }, 50)
    return () => clearInterval(iv)
  }, [noise, q])

  const kf = kfRef.current
  const ell = covEllipse(kf.P[0][0], kf.P[0][1], kf.P[1][1])
  void tick

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg
          viewBox={`0 0 ${MW} ${MH}`}
          className="block w-full cursor-crosshair touch-none"
          style={{ background: 'radial-gradient(120% 120% at 50% 40%, #141a28 0%, #0a0e17 100%)' }}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            cursorRef.current = {
              x: ((e.clientX - rect.left) / rect.width) * MW,
              y: ((e.clientY - rect.top) / rect.height) * MH,
              inside: true,
            }
          }}
          onPointerLeave={() => (cursorRef.current = { ...cursorRef.current, inside: false })}
        >
          {/* true cursor */}
          {cursorRef.current.inside && (
            <g stroke="rgba(255,255,255,0.35)" strokeWidth={1.2}>
              <line x1={cursorRef.current.x - 8} y1={cursorRef.current.y} x2={cursorRef.current.x + 8} y2={cursorRef.current.y} />
              <line x1={cursorRef.current.x} y1={cursorRef.current.y - 8} x2={cursorRef.current.x} y2={cursorRef.current.y + 8} />
            </g>
          )}
          {/* measurements */}
          {measRef.current.map((m, i) => (
            <circle key={i} cx={m.x} cy={m.y} r={3.4} fill="#22d3ee" opacity={Math.max(0, 0.9 - m.age * 0.12)} />
          ))}
          {/* estimate trail */}
          <polyline
            points={trailRef.current.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="rgba(251,191,36,0.4)"
            strokeWidth={1.5}
          />
          {/* covariance ellipse + estimate */}
          <ellipse
            cx={kf.x[0]}
            cy={kf.x[1]}
            rx={Math.min(ell.a, MW)}
            ry={Math.min(ell.b, MH)}
            transform={`rotate(${ell.angleDeg} ${kf.x[0]} ${kf.x[1]})`}
            fill="rgba(251,191,36,0.08)"
            stroke="rgba(251,191,36,0.55)"
            strokeWidth={1.5}
          />
          <circle cx={kf.x[0]} cy={kf.x[1]} r={6} fill="#fbbf24" stroke="#0a0e17" strokeWidth={2} />
        </svg>
      </div>
      <div className="card-pad space-y-3.5 self-start lg:col-span-2">
        <Slider label={t.mouseNoise} value={noise} min={4} max={50} step={1} onChange={setNoise} format={(v) => `${v} px`} />
        <Slider label={t.mouseQ} value={q} min={5} max={300} step={5} onChange={setQ} format={(v) => `${v}`} accent="#a78bfa" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- application: tunnel

const TUN_N = 110
const TUN_DT = 0.5
const TUN_START = 40
const TUN_NOISE: [number, number][] = (() => {
  const g = makeGauss(2027)
  return Array.from({ length: TUN_N }, () => [g(), g()] as [number, number])
})()

function tunnelTruth(i: number): [number, number] {
  const x = (i / (TUN_N - 1)) * 100
  return [x, 18 * Math.sin(x / 24)]
}

function TunnelLab() {
  const t = useT(T)
  const [tunLen, setTunLen] = useState(25)
  const [gpsR, setGpsR] = useState(2.5)

  const { est, ellipses, gps, errExit, areaRatio } = useMemo(() => {
    const kf = kf2dInit(0, 0)
    const est2: [number, number][] = []
    const ell: { x: number; y: number; a: number; b: number; ang: number; inTunnel: boolean }[] = []
    const gps2: ([number, number] | null)[] = []
    let areaBefore = 0
    let areaEnd = 0
    let err = 0
    for (let i = 0; i < TUN_N; i++) {
      const [tx, ty] = tunnelTruth(i)
      const inTunnel = tx >= TUN_START && tx <= TUN_START + tunLen
      kf2dPredict(kf, TUN_DT, 0.6)
      if (!inTunnel) {
        const z: [number, number] = [tx + TUN_NOISE[i][0] * gpsR, ty + TUN_NOISE[i][1] * gpsR]
        kf2dUpdate(kf, z[0], z[1], gpsR)
        gps2.push(z)
      } else {
        gps2.push(null)
      }
      est2.push([kf.x[0], kf.x[1]])
      const e = covEllipse(kf.P[0][0], kf.P[0][1], kf.P[1][1])
      if (i % 5 === 0 || inTunnel) ell.push({ x: kf.x[0], y: kf.x[1], a: e.a, b: e.b, ang: e.angleDeg, inTunnel })
      const nextInTunnel = i + 1 < TUN_N && tunnelTruth(i + 1)[0] >= TUN_START && tunnelTruth(i + 1)[0] <= TUN_START + tunLen
      if (!inTunnel && nextInTunnel) areaBefore = Math.PI * e.a * e.b
      if (inTunnel) {
        areaEnd = Math.PI * e.a * e.b
        err = Math.hypot(kf.x[0] - tx, kf.x[1] - ty)
      }
    }
    return { est: est2, ellipses: ell, gps: gps2, errExit: err, areaRatio: areaBefore > 0 ? areaEnd / areaBefore : 1 }
  }, [tunLen, gpsR])

  const PW = 560
  const PH = 260
  const sx = (x: number) => 8 + (x / 100) * (PW - 16)
  const sy = (y: number) => PH / 2 - y * 4.2

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          {/* tunnel band */}
          <rect x={sx(TUN_START)} y={0} width={sx(TUN_START + tunLen) - sx(TUN_START)} height={PH} fill="#5b627026" />
          <text x={(sx(TUN_START) + sx(TUN_START + tunLen)) / 2} y={16} textAnchor="middle" fill="#8b93a7" fontSize={10.5} fontFamily="JetBrains Mono, monospace">
            🚇
          </text>
          {/* truth */}
          <polyline
            points={Array.from({ length: TUN_N }, (_, i) => `${sx(tunnelTruth(i)[0])},${sy(tunnelTruth(i)[1])}`).join(' ')}
            fill="none"
            stroke="#e2e8f088"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
          {/* ellipses */}
          {ellipses.map((e, i) => (
            <ellipse
              key={i}
              cx={sx(e.x)}
              cy={sy(e.y)}
              rx={Math.min(e.a * 4.2, 200)}
              ry={Math.min(e.b * 4.2, 200)}
              transform={`rotate(${-e.ang} ${sx(e.x)} ${sy(e.y)})`}
              fill="none"
              stroke={e.inTunnel ? '#fbbf2466' : '#22d3ee44'}
              strokeWidth={1}
            />
          ))}
          {/* gps fixes */}
          {gps.map((z, i) => (z ? <circle key={i} cx={sx(z[0])} cy={sy(z[1])} r={1.8} fill="#a78bfa88" /> : null))}
          {/* estimate */}
          <polyline points={est.map((p) => `${sx(p[0])},${sy(p[1])}`).join(' ')} fill="none" stroke="#22d3ee" strokeWidth={2} />
        </svg>
        <div className="border-t border-white/10 px-4 py-2 text-[12px] text-muted">{t.appLegend}</div>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.appTunnel} value={tunLen} min={8} max={45} step={1} onChange={setTunLen} format={(v) => `${v} %`} />
          <Slider label={t.appGpsR} value={gpsR} min={0.8} max={6} step={0.1} onChange={setGpsR} format={(v) => `${fmt(v, 1)} m`} accent="#a78bfa" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.appErrExit} value={fmt(errExit, 1)} unit="m" accent={errExit < 3 ? '#4ade80' : '#fbbf24'} />
          <Readout label={t.appEllipse} value={`×${fmt(areaRatio, 1)}`} accent={areaRatio > 2 ? '#fbbf24' : '#4ade80'} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function KalmanPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'fusion', label: t.fuseTitle },
          { id: 'tracking', label: t.trackTitle },
          { id: 'mouse', label: t.mouseTitle },
          { id: 'math', label: t.mathTitle },
          { id: 'practice', label: t.practTitle },
          { id: 'code', label: t.codeTitle },
          { id: 'application', label: t.appTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="fusion" title={t.fuseTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.fuse1}</p>
        </div>
        <div className="mt-4">
          <FusionLab />
        </div>
      </Section>

      <Section id="tracking" title={t.trackTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.track1}</p>
          <ul>
            {t.trackList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p>{t.track2}</p>
        </div>
        <div className="mt-4">
          <Track1dLab />
        </div>
      </Section>

      <Section id="mouse" title={t.mouseTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.mouse1}</p>
        </div>
        <div className="mt-4">
          <MouseChaseLab />
        </div>
      </Section>

      <Section id="math" title={t.mathTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.math1}</p>
          <TeX block>{String.raw`\begin{aligned} \textbf{predict:}\quad & \hat{\mathbf{x}}^- = F\,\hat{\mathbf{x}}, \qquad P^- = F P F^{\mathsf T} + Q \\[2pt] \textbf{update:}\quad & K = P^- H^{\mathsf T}\big(H P^- H^{\mathsf T} + R\big)^{-1} \\ & \hat{\mathbf{x}} = \hat{\mathbf{x}}^- + K\big(\mathbf{z} - H\hat{\mathbf{x}}^-\big), \qquad P = (I - KH)\,P^- \end{aligned}`}</TeX>
          <p>{t.math2}</p>
        </div>
      </Section>

      <Section id="practice" title={t.practTitle}>
        <div className="prose-cv max-w-3xl">
          <ul>
            {t.practList.map((s, i) => (
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
          <TunnelLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
