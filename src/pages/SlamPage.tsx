import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { Derivation } from '../components/Derivation'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Slider } from '../components/ui'
import { fmt } from '../lib/math'
import { covEllipse } from '../lib/signal'
import { makeGauss } from '../lib/stats'
import {
  control,
  deadReckoning,
  LANDMARKS,
  slamInit,
  slamPredict,
  slamUpdate,
  traceP,
  trueStep,
  wrapAngle,
  type RobotSim,
  type Slam,
} from '../lib/slam'

const T = {
  en: {
    kicker: 'Robotics · Module 2',
    title: 'SLAM & the Extended Kalman Filter',
    intro:
      'A robot in an unknown building faces a paradox: to know where it is, it needs a map; to build a map, it must know where it is. SLAM - simultaneous localization and mapping - solves both at once, and the classic solution is the Kalman filter of the Signals track, extended to nonlinear models and a state that grows as the world is discovered.',
    drTitle: 'Interactive: why odometry alone is doomed',
    dr1: 'First, the honest baseline. The robot drives a rectangular patrol using only its wheel odometry - every step slightly wrong, errors compounding. Each cyan thread is one possible trajectory consistent with the odometry noise; the fan of spaghetti is the robot’s actual uncertainty. It grows without bound: after a few laps the robot could be anywhere. No amount of clever filtering fixes this - it needs external references: landmarks.',
    sigV: 'odometry noise (speed)',
    sigOm: 'odometry noise (turn)',
    slamTitle: 'Interactive: EKF-SLAM - mapping while localizing',
    slam1: 'Now the full loop. The robot (amber) still drives on noisy odometry, but it also measures range and bearing to landmarks within sensor reach (rays). Each first sighting adds the landmark to the state - the map is being built. Every re-sighting is a Kalman update that corrects robot AND map. Watch the ellipses: the robot’s grows between observations and shrinks at each measurement; young landmarks inherit the robot’s uncertainty at their birth.',
    slam2: 'The magic moment is the loop closure: when the robot comes back around and re-observes the first landmarks - whose positions it once knew well - the accumulated drift is suddenly explained, and every ellipse on the map snaps tight at once. Turn measurements off to feel the difference: the filter falls back to dead reckoning and the ellipse balloons.',
    measOn: 'landmark measurements',
    range: 'sensor range',
    sigMeas: 'measurement noise',
    play: 'Drive',
    pause: 'Pause',
    reset: 'Reset',
    loopBanner: '🔗 Loop closed - the whole map just snapped tight!',
    trace: 'total uncertainty (trace P)',
    posErr: 'robot position error',
    steps: 'steps',
    tracePlot: 'total uncertainty over time',
    corrTitle: 'The secret: everything is correlated',
    corr1: 'Why does re-observing one landmark improve all the others? Because every landmark was measured from the robot, and the robot’s error at that moment leaked into the landmark estimate. Those shared errors live in the off-diagonal entries of the covariance matrix - the heatmap below, updated live. The map is not a list of independent pins; it is one connected web of belief. Pull one thread (a good observation) and the whole web tightens. This correlation bookkeeping is exactly what the EKF maintains - and what makes it O(N²) in the number of landmarks.',
    corrMap: 'covariance |correlation| heatmap - state = [robot x, y, θ, landmarks…]',
    mathTitle: 'The EKF: Kalman + linearization',
    math1: 'The motion and measurement models are nonlinear (rotations, ranges, bearings), so the plain Kalman filter of the Signals track does not apply directly. The extended Kalman filter linearizes both models around the current estimate with Jacobians and then runs the identical predict-update dance:',
    mathDerivTitle: 'The Jacobians that make it work',
    mathDeriv: [
      { tex: String.raw`\mathbf{x}_r' = \begin{bmatrix} x + v\Delta t\cos\theta \\ y + v\Delta t\sin\theta \\ \theta + \omega\Delta t \end{bmatrix}, \qquad F_r = \begin{bmatrix} 1 & 0 & -v\Delta t\sin\theta \\ 0 & 1 & \;\;v\Delta t\cos\theta \\ 0 & 0 & 1 \end{bmatrix}`, note: 'Unicycle motion model and its Jacobian - the θ-column says: heading error turns into position error proportional to distance driven. That is why the spaghetti fans out sideways.' },
      { tex: String.raw`z = \begin{bmatrix} r \\ \varphi \end{bmatrix} = \begin{bmatrix} \sqrt{(l_x - x)^2 + (l_y - y)^2} \\ \operatorname{atan2}(l_y - y,\, l_x - x) - \theta \end{bmatrix} + \mathbf{v}`, note: 'Range-bearing measurement model - what the sensor rays in the lab report, plus noise.' },
      { tex: String.raw`H = \frac{\partial h}{\partial [\mathbf{x}_r, \mathbf{l}]} \quad\text{(nonzero only at the robot and the observed landmark)}`, note: 'The measurement Jacobian touches only 5 state entries - but through P, the update still reaches every correlated landmark. That sparsity-through-correlation is the heart of EKF-SLAM.' },
      { tex: String.raw`\mathbf{l}_{\text{new}} = \begin{bmatrix} x + r\cos(\varphi + \theta) \\ y + r\sin(\varphi + \theta) \end{bmatrix}`, note: 'State augmentation: a first-seen landmark is initialized from the current pose estimate - inheriting its uncertainty, which is why young landmarks start with big ellipses.' },
    ],
    practTitle: 'From EKF-SLAM to modern SLAM',
    practList: [
      'EKF-SLAM scales as O(N²) (the dense covariance) and suffers when linearization is poor - fine for dozens of landmarks, painful for thousands.',
      'Modern systems use graph/factor-graph SLAM: keep all poses, optimize the whole trajectory with sparse nonlinear least squares - which is literally the bundle adjustment of the Vision track with an odometry twist.',
      'Visual SLAM uses a calibrated camera (Vision track) as the landmark sensor; lidar SLAM matches scans; loop-closure detection becomes a recognition problem.',
      'The Kalman-family intuition transfers unchanged: predict with a model, correct with measurements, and let the covariance decide the weights.',
    ],
    codeTitle: 'In practice',
    appTitle: '🏭 In the real world: will the vacuum find its dock?',
    appIntro:
      'A robot vacuum must end every mission the same way: back on its charging dock, within about ±10 cm, or the charging contacts miss. Below, the same robot drives one identical lap twice - with the same noisy wheel odometry. The red run navigates by odometry alone: by lap end its position belief has drifted, and it docks blind by that amount. The cyan run additionally watches the room’s landmarks (chair legs, walls) with EKF-SLAM and comes home tight. Crank up the odometry noise - carpet slip, in vacuum terms - and watch dead reckoning blow the docking tolerance while SLAM barely notices. This picture is why even cheap vacuums grew lidar turrets.',
    appNoise: 'wheel-odometry noise',
    appDrErr: 'dock error: odometry only',
    appSlamErr: 'dock error: EKF-SLAM',
    appTol: 'docking tolerance ±10 cm',
    appPass: 'DOCKS',
    appFail: 'MISSES DOCK',
    appLegend: 'white dashed = true lap · red = odometry-only belief · cyan = SLAM belief · ◆ = landmarks · ⌂ = dock',
    appWhere:
      'The same odometry-vs-landmarks budget decides how warehouse AMRs hit their charging pads, how AGVs align with conveyor hand-off stations, and how drones land back on the takeoff “H” without RTK GPS.',
  },
  de: {
    kicker: 'Robotik · Modul 2',
    title: 'SLAM & das erweiterte Kalman-Filter',
    intro:
      'Ein Roboter in einem unbekannten Gebäude steht vor einem Paradox: Um zu wissen, wo er ist, braucht er eine Karte; um eine Karte zu bauen, muss er wissen, wo er ist. SLAM - simultane Lokalisierung und Kartierung - löst beides zugleich, und die klassische Lösung ist das Kalman-Filter aus dem Signale-Track, erweitert auf nichtlineare Modelle und einen Zustand, der mit der entdeckten Welt wächst.',
    drTitle: 'Interaktiv: Warum Odometrie allein verloren ist',
    dr1: 'Zuerst die ehrliche Basislinie. Der Roboter fährt eine rechteckige Patrouille nur mit seiner Radodometrie - jeder Schritt leicht falsch, Fehler verzinsen sich. Jeder cyanfarbene Faden ist eine mögliche Trajektorie, die mit dem Odometrierauschen verträglich ist; der Spaghetti-Fächer ist die tatsächliche Unsicherheit des Roboters. Sie wächst unbeschränkt: Nach ein paar Runden könnte der Roboter überall sein. Kein noch so kluges Filtern behebt das - es braucht externe Referenzen: Landmarken.',
    sigV: 'Odometrierauschen (Tempo)',
    sigOm: 'Odometrierauschen (Drehung)',
    slamTitle: 'Interaktiv: EKF-SLAM - kartieren beim Lokalisieren',
    slam1: 'Nun die volle Schleife. Der Roboter (bernstein) fährt weiter auf verrauschter Odometrie, misst aber zusätzlich Entfernung und Peilwinkel zu Landmarken in Sensorreichweite (Strahlen). Jede Erstsichtung fügt die Landmarke dem Zustand hinzu - die Karte entsteht. Jede Wiedersichtung ist ein Kalman-Update, das Roboter UND Karte korrigiert. Beobachte die Ellipsen: Die des Roboters wächst zwischen Beobachtungen und schrumpft bei jeder Messung; junge Landmarken erben bei ihrer Geburt die Unsicherheit des Roboters.',
    slam2: 'Der magische Moment ist der Schleifenschluss: Wenn der Roboter herumkommt und die ersten Landmarken wiedersieht - deren Positionen er einst gut kannte -, ist die aufgelaufene Drift plötzlich erklärt, und jede Ellipse der Karte zieht sich auf einen Schlag zusammen. Schalte die Messungen aus, um den Unterschied zu spüren: Das Filter fällt auf Koppelnavigation zurück, und die Ellipse bläht sich auf.',
    measOn: 'Landmarkenmessungen',
    range: 'Sensorreichweite',
    sigMeas: 'Messrauschen',
    play: 'Fahren',
    pause: 'Pause',
    reset: 'Zurücksetzen',
    loopBanner: '🔗 Schleife geschlossen - die ganze Karte hat sich gestrafft!',
    trace: 'Gesamtunsicherheit (Spur P)',
    posErr: 'Positionsfehler des Roboters',
    steps: 'Schritte',
    tracePlot: 'Gesamtunsicherheit über der Zeit',
    corrTitle: 'Das Geheimnis: Alles ist korreliert',
    corr1: 'Warum verbessert das Wiedersehen einer Landmarke alle anderen? Weil jede Landmarke vom Roboter aus gemessen wurde und der damalige Roboterfehler in die Landmarkenschätzung eingesickert ist. Diese geteilten Fehler wohnen in den Nebendiagonalelementen der Kovarianzmatrix - der Heatmap unten, live aktualisiert. Die Karte ist keine Liste unabhängiger Stecknadeln, sondern ein zusammenhängendes Netz aus Überzeugung. Zieh an einem Faden (eine gute Beobachtung), und das ganze Netz strafft sich. Genau diese Korrelationsbuchführung leistet das EKF - und macht es O(N²) in der Landmarkenzahl.',
    corrMap: 'Kovarianz-|Korrelations|-Heatmap - Zustand = [Roboter x, y, θ, Landmarken…]',
    mathTitle: 'Das EKF: Kalman + Linearisierung',
    math1: 'Bewegungs- und Messmodell sind nichtlinear (Rotationen, Entfernungen, Peilwinkel), also greift das schlichte Kalman-Filter des Signale-Tracks nicht direkt. Das erweiterte Kalman-Filter linearisiert beide Modelle an der aktuellen Schätzung mit Jacobimatrizen und tanzt dann den identischen Prädiktions-Korrektur-Tanz:',
    mathDerivTitle: 'Die Jacobimatrizen, die es möglich machen',
    mathDeriv: [
      { tex: String.raw`\mathbf{x}_r' = \begin{bmatrix} x + v\Delta t\cos\theta \\ y + v\Delta t\sin\theta \\ \theta + \omega\Delta t \end{bmatrix}, \qquad F_r = \begin{bmatrix} 1 & 0 & -v\Delta t\sin\theta \\ 0 & 1 & \;\;v\Delta t\cos\theta \\ 0 & 0 & 1 \end{bmatrix}`, note: 'Einspurmodell und seine Jacobimatrix - die θ-Spalte sagt: Richtungsfehler wird zu Positionsfehler proportional zur gefahrenen Strecke. Deshalb fächern die Spaghetti seitlich auf.' },
      { tex: String.raw`z = \begin{bmatrix} r \\ \varphi \end{bmatrix} = \begin{bmatrix} \sqrt{(l_x - x)^2 + (l_y - y)^2} \\ \operatorname{atan2}(l_y - y,\, l_x - x) - \theta \end{bmatrix} + \mathbf{v}`, note: 'Entfernungs-Peilwinkel-Messmodell - das, was die Sensorstrahlen im Labor melden, plus Rauschen.' },
      { tex: String.raw`H = \frac{\partial h}{\partial [\mathbf{x}_r, \mathbf{l}]} \quad\text{(nur am Roboter und der beobachteten Landmarke ungleich null)}`, note: 'Die Mess-Jacobimatrix berührt nur 5 Zustandseinträge - aber über P erreicht das Update trotzdem jede korrelierte Landmarke. Diese Sparsamkeit-durch-Korrelation ist das Herz von EKF-SLAM.' },
      { tex: String.raw`\mathbf{l}_{\text{neu}} = \begin{bmatrix} x + r\cos(\varphi + \theta) \\ y + r\sin(\varphi + \theta) \end{bmatrix}`, note: 'Zustandserweiterung: Eine erstmals gesehene Landmarke wird aus der aktuellen Posenschätzung initialisiert - und erbt deren Unsicherheit, weshalb junge Landmarken mit großen Ellipsen starten.' },
    ],
    practTitle: 'Von EKF-SLAM zu modernem SLAM',
    practList: [
      'EKF-SLAM skaliert O(N²) (dichte Kovarianz) und leidet bei schlechter Linearisierung - gut für Dutzende Landmarken, schmerzhaft für Tausende.',
      'Moderne Systeme nutzen Graph-/Faktorgraph-SLAM: alle Posen behalten, die ganze Trajektorie mit dünnbesetzten nichtlinearen kleinsten Quadraten optimieren - buchstäblich der Bündelausgleich des Vision-Tracks mit Odometrie-Dreh.',
      'Visuelles SLAM nutzt eine kalibrierte Kamera (Vision-Track) als Landmarkensensor; Lidar-SLAM matcht Scans; Schleifenschluss-Erkennung wird ein Wiedererkennungsproblem.',
      'Die Kalman-Intuition überträgt sich unverändert: mit einem Modell prädizieren, mit Messungen korrigieren, und die Kovarianz die Gewichte wählen lassen.',
    ],
    codeTitle: 'In der Praxis',
    appTitle: '🏭 In der echten Welt: findet der Staubsauger seine Ladestation?',
    appIntro:
      'Ein Saugroboter muss jede Mission gleich beenden: zurück auf seiner Ladestation, auf etwa ±10 cm genau, sonst verfehlen die Ladekontakte. Unten fährt derselbe Roboter zweimal dieselbe Runde - mit derselben verrauschten Radodometrie. Der rote Lauf navigiert nur nach Odometrie: Am Rundenende ist seine Positionsschätzung weggedriftet, und um genau diesen Betrag dockt er blind daneben an. Der cyanfarbene Lauf beobachtet zusätzlich die Landmarken des Raums (Stuhlbeine, Wände) mit EKF-SLAM und kommt eng nach Hause. Dreh das Odometrierauschen hoch - Teppichschlupf, in Staubsaugersprache - und sieh zu, wie die Koppelnavigation die Docking-Toleranz sprengt, während SLAM es kaum bemerkt. Dieses Bild ist der Grund, warum selbst billige Staubsauger Lidar-Türmchen bekommen haben.',
    appNoise: 'Radodometrie-Rauschen',
    appDrErr: 'Dock-Fehler: nur Odometrie',
    appSlamErr: 'Dock-Fehler: EKF-SLAM',
    appTol: 'Docking-Toleranz ±10 cm',
    appPass: 'DOCKT AN',
    appFail: 'VERFEHLT DOCK',
    appLegend: 'weiß gestrichelt = wahre Runde · rot = Nur-Odometrie-Schätzung · cyan = SLAM-Schätzung · ◆ = Landmarken · ⌂ = Ladestation',
    appWhere:
      'Dasselbe Odometrie-gegen-Landmarken-Budget entscheidet, wie Lager-AMRs ihre Ladeplatten treffen, wie FTS an Übergabestationen andocken und wie Drohnen ohne RTK-GPS wieder auf dem Start-„H“ landen.',
  },
}

const SNIPPET = `# GTSAM-style factor-graph SLAM (the modern successor)
import gtsam

graph = gtsam.NonlinearFactorGraph()
graph.add(gtsam.PriorFactorPose2(X(0), start, prior_noise))
for i, odom in enumerate(odometry):
    graph.add(gtsam.BetweenFactorPose2(X(i), X(i+1), odom, odo_noise))
for i, (pose_i, lm_j, rng, brg) in enumerate(observations):
    graph.add(gtsam.BearingRangeFactor2D(X(pose_i), L(lm_j),
                                         brg, rng, meas_noise))
result = gtsam.LevenbergMarquardtOptimizer(graph, initial).optimize()`

// ---------------------------------------------------------------- drawing helpers

const SW = 560
const SH = 440
const RNG = 2.1
const px = (x: number) => ((x + RNG) / (2 * RNG)) * SW
const py = (y: number) => SH - ((y + RNG) / (2 * RNG)) * SH

function RobotGlyph({ x, y, th, color, faint = false }: { x: number; y: number; th: number; color: string; faint?: boolean }) {
  const s = 0.09
  const p1 = [x + s * Math.cos(th), y + s * Math.sin(th)]
  const p2 = [x + s * 0.6 * Math.cos(th + 2.5), y + s * 0.6 * Math.sin(th + 2.5)]
  const p3 = [x + s * 0.6 * Math.cos(th - 2.5), y + s * 0.6 * Math.sin(th - 2.5)]
  return (
    <polygon
      points={`${px(p1[0])},${py(p1[1])} ${px(p2[0])},${py(p2[1])} ${px(p3[0])},${py(p3[1])}`}
      fill={color}
      opacity={faint ? 0.35 : 1}
      stroke="#0a0e17"
      strokeWidth={1}
    />
  )
}

// ---------------------------------------------------------------- dead reckoning lab

function DeadReckLab() {
  const t = useT(T)
  const [sigV, setSigV] = useState(0.06)
  const [sigOm, setSigOm] = useState(0.1)

  const { trajs, truth } = useMemo(() => {
    const trajs = deadReckoning(30, 700, 0.05, sigV, sigOm, 5)
    const truth = deadReckoning(1, 700, 0.05, 0, 0, 1)[0]
    return { trajs, truth }
  }, [sigV, sigOm])

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${SW} ${SH}`} className="block w-full" style={{ background: 'radial-gradient(120% 120% at 50% 40%, #141a28 0%, #0a0e17 100%)' }}>
          {LANDMARKS.map(([lx, ly], i) => (
            <g key={i} stroke="rgba(139,147,167,0.5)" strokeWidth={1.5}>
              <line x1={px(lx) - 5} y1={py(ly) - 5} x2={px(lx) + 5} y2={py(ly) + 5} />
              <line x1={px(lx) - 5} y1={py(ly) + 5} x2={px(lx) + 5} y2={py(ly) - 5} />
            </g>
          ))}
          {trajs.map((traj, i) => (
            <polyline
              key={i}
              points={traj.filter((_, j) => j % 3 === 0).map(([x, y]) => `${px(x)},${py(y)}`).join(' ')}
              fill="none"
              stroke="#22d3ee"
              strokeWidth={1}
              opacity={0.28}
            />
          ))}
          <polyline
            points={truth.filter((_, j) => j % 3 === 0).map(([x, y]) => `${px(x)},${py(y)}`).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.65)"
            strokeWidth={1.8}
            strokeDasharray="6 5"
          />
        </svg>
      </div>
      <div className="card-pad space-y-3.5 self-start lg:col-span-2">
        <Slider label={t.sigV} value={sigV} min={0.01} max={0.2} step={0.005} onChange={setSigV} format={(v) => fmt(v, 3)} />
        <Slider label={t.sigOm} value={sigOm} min={0.01} max={0.3} step={0.005} onChange={setSigOm} format={(v) => fmt(v, 3)} accent="#a78bfa" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- EKF-SLAM lab

const LM_COLORS = ['#22d3ee', '#a78bfa', '#4ade80', '#fbbf24', '#f87171', '#38bdf8', '#e879f9', '#a3e635']

function EkfSlamLab() {
  const t = useT(T)
  const [running, setRunning] = useState(false)
  const [measOn, setMeasOn] = useState(true)
  const [range, setRange] = useState(1.1)
  const [sigOdo, setSigOdo] = useState(0.1)
  const [sigMeas, setSigMeas] = useState(0.08)
  const [tick, setTick] = useState(0)
  const [seed, setSeed] = useState(1)

  const worldRef = useRef<{
    truth: RobotSim
    slam: Slam
    trail: [number, number][]
    gauss: () => number
    steps: number
    lastSeen: Map<number, number>
    bannerUntil: number
    traceHist: number[]
    visible: number[]
  }>(null as never)

  const resetWorld = () => {
    worldRef.current = {
      truth: { x: 1.1, y: 0, th: Math.PI / 2, wp: 0 },
      slam: slamInit(1.1, 0, Math.PI / 2),
      trail: [],
      gauss: makeGauss(seed * 91 + 7),
      steps: 0,
      lastSeen: new Map(),
      bannerUntil: -1,
      traceHist: [],
      visible: [],
    }
  }
  if (!worldRef.current) resetWorld()

  useEffect(() => {
    resetWorld()
    setTick((x) => x + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => {
      const w = worldRef.current
      const dt = 0.06
      for (let s = 0; s < 2; s++) {
        const { v, om } = control(w.truth)
        trueStep(w.truth, v, om, dt)
        // EKF predicts with the NOISY odometry reading
        const vRead = v + w.gauss() * sigOdo
        const omRead = om + w.gauss() * sigOdo * 1.4
        slamPredict(w.slam, vRead, omRead, dt, sigOdo * 1.6, sigOdo * 2.2)
        w.visible = []
        if (measOn) {
          LANDMARKS.forEach(([lx, ly], id) => {
            const dx = lx - w.truth.x
            const dy = ly - w.truth.y
            const r = Math.hypot(dx, dy)
            if (r > range) return
            const phi = wrapAngle(Math.atan2(dy, dx) - w.truth.th)
            slamUpdate(
              w.slam,
              id,
              r + w.gauss() * sigMeas,
              phi + w.gauss() * sigMeas,
              sigMeas,
              sigMeas,
            )
            w.visible.push(id)
            const last = w.lastSeen.get(id)
            if (last !== undefined && w.steps - last > 180) w.bannerUntil = w.steps + 50
            w.lastSeen.set(id, w.steps)
          })
        }
        w.steps++
        w.trail.push([w.slam.x[0], w.slam.x[1]])
        if (w.trail.length > 500) w.trail.shift()
      }
      w.traceHist = [...w.traceHist, traceP(w.slam)].slice(-400)
      setTick((x) => x + 1)
    }, 50)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, measOn, range, sigOdo, sigMeas])

  const w = worldRef.current
  void tick
  const s = w.slam
  const robotEll = covEllipse(s.P[0][0], s.P[0][1], s.P[1][1])
  const posErr = Math.hypot(s.x[0] - w.truth.x, s.x[1] - w.truth.y)
  const trace = traceP(s)
  const showBanner = w.steps < w.bannerUntil

  // covariance |correlation| heatmap
  const covRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = covRef.current?.getContext('2d')
    if (!ctx) return
    const n = s.P.length
    const img = ctx.createImageData(n, n)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const denom = Math.sqrt(Math.max(s.P[i][i] * s.P[j][j], 1e-12))
        const c = Math.min(Math.abs(s.P[i][j]) / denom, 1)
        const p = (i * n + j) * 4
        img.data[p] = Math.round(13 + c * 21)
        img.data[p + 1] = Math.round(17 + c * 194)
        img.data[p + 2] = Math.round(27 + c * 211)
        img.data[p + 3] = 255
      }
    ctx.canvas.width = n
    ctx.canvas.height = n
    ctx.putImageData(img, 0, 0)
  }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps

  const maxTrace = Math.max(...w.traceHist, 0.1)

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="relative lg:col-span-3">
          <div className="card overflow-hidden">
            <svg viewBox={`0 0 ${SW} ${SH}`} className="block w-full" style={{ background: 'radial-gradient(120% 120% at 50% 40%, #141a28 0%, #0a0e17 100%)' }}>
              {/* sensor range around the true robot */}
              <circle cx={px(w.truth.x)} cy={py(w.truth.y)} r={(range / (2 * RNG)) * SW} fill="rgba(251,191,36,0.04)" stroke="rgba(251,191,36,0.25)" strokeDasharray="4 4" />
              {/* true landmarks */}
              {LANDMARKS.map(([lx, ly], i) => (
                <g key={i} stroke="rgba(139,147,167,0.45)" strokeWidth={1.5}>
                  <line x1={px(lx) - 5} y1={py(ly) - 5} x2={px(lx) + 5} y2={py(ly) + 5} />
                  <line x1={px(lx) - 5} y1={py(ly) + 5} x2={px(lx) + 5} y2={py(ly) - 5} />
                </g>
              ))}
              {/* measurement rays */}
              {w.visible.map((id) => {
                const li = s.seen.get(id)
                if (li === undefined) return null
                return (
                  <line
                    key={id}
                    x1={px(s.x[0])}
                    y1={py(s.x[1])}
                    x2={px(s.x[li])}
                    y2={py(s.x[li + 1])}
                    stroke="rgba(251,191,36,0.35)"
                    strokeWidth={1}
                  />
                )
              })}
              {/* estimated landmarks + ellipses */}
              {[...s.seen.entries()].map(([id, li]) => {
                const ell = covEllipse(s.P[li][li], s.P[li][li + 1], s.P[li + 1][li + 1])
                const col = LM_COLORS[id % LM_COLORS.length]
                return (
                  <g key={id}>
                    <ellipse
                      cx={px(s.x[li])}
                      cy={py(s.x[li + 1])}
                      rx={Math.min((ell.a / (2 * RNG)) * SW, SW)}
                      ry={Math.min((ell.b / (2 * RNG)) * SW, SH)}
                      transform={`rotate(${-ell.angleDeg} ${px(s.x[li])} ${py(s.x[li + 1])})`}
                      fill="none"
                      stroke={col}
                      strokeWidth={1.4}
                      opacity={0.8}
                    />
                    <circle cx={px(s.x[li])} cy={py(s.x[li + 1])} r={3.5} fill={col} />
                  </g>
                )
              })}
              {/* estimate trail */}
              <polyline
                points={w.trail.filter((_, i) => i % 2 === 0).map(([x, y]) => `${px(x)},${py(y)}`).join(' ')}
                fill="none"
                stroke="rgba(251,191,36,0.35)"
                strokeWidth={1.2}
              />
              {/* robot pose ellipse + glyphs */}
              <ellipse
                cx={px(s.x[0])}
                cy={py(s.x[1])}
                rx={Math.min((robotEll.a / (2 * RNG)) * SW, SW)}
                ry={Math.min((robotEll.b / (2 * RNG)) * SW, SH)}
                transform={`rotate(${-robotEll.angleDeg} ${px(s.x[0])} ${py(s.x[1])})`}
                fill="rgba(251,191,36,0.1)"
                stroke="#fbbf24"
                strokeWidth={1.6}
              />
              <RobotGlyph x={w.truth.x} y={w.truth.y} th={w.truth.th} color="#e6eaf2" faint />
              <RobotGlyph x={s.x[0]} y={s.x[1]} th={s.x[2]} color="#fbbf24" />
            </svg>
          </div>
          {showBanner && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-xl border border-green-400/60 bg-green-400/15 px-4 py-1.5 text-[13px] font-bold text-green-400 backdrop-blur-sm">
              {t.loopBanner}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="card-pad space-y-3.5">
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => setRunning(!running)}>
                {running ? `⏸ ${t.pause}` : `▶ ${t.play}`}
              </button>
              <button
                className="btn"
                onClick={() => {
                  setRunning(false)
                  setSeed((x) => x + 1)
                }}
              >
                ↺ {t.reset}
              </button>
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-muted select-none">
              <input type="checkbox" checked={measOn} onChange={(e) => setMeasOn(e.target.checked)} className="h-4 w-4 accent-yellow-400" />
              {t.measOn}
            </label>
            <Slider label={t.range} value={range} min={0.5} max={2} step={0.05} onChange={setRange} format={(v) => fmt(v, 2)} accent="#fbbf24" />
            <Slider label={t.sigV} value={sigOdo} min={0.02} max={0.25} step={0.005} onChange={setSigOdo} format={(v) => fmt(v, 3)} />
            <Slider label={t.sigMeas} value={sigMeas} min={0.02} max={0.3} step={0.005} onChange={setSigMeas} format={(v) => fmt(v, 3)} accent="#a78bfa" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Readout label={t.trace} value={fmt(trace, 3)} accent="#fbbf24" />
            <Readout label={t.posErr} value={fmt(posErr, 3)} />
            <Readout label={t.steps} value={`${w.steps}`} />
          </div>
          {w.traceHist.length > 1 && (
            <div className="card overflow-hidden">
              <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.tracePlot}</div>
              <svg viewBox="0 0 300 90" className="block w-full">
                <polyline
                  points={w.traceHist
                    .map((v, i) => `${8 + (i / Math.max(w.traceHist.length - 1, 1)) * 284},${82 - (Math.min(v, maxTrace) / maxTrace) * 72}`)
                    .join(' ')}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={1.8}
                />
              </svg>
            </div>
          )}
          <div className="card overflow-hidden">
            <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">
              {t.corrMap}
            </div>
            <canvas ref={covRef} className="mx-auto block w-full max-w-[220px] p-2" style={{ imageRendering: 'pixelated' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- application: return to dock

const DOCK_STEPS = 230
const DOCK_DT = 0.06
const DOCK_TOL = 0.1 // m

function runDockLap(noiseScale: number): {
  truth: [number, number][]
  dr: [number, number][]
  slam: [number, number][]
  drErr: number
  slamErr: number
} {
  // same noise regime as the EKF lab above (proven consistent filter tuning)
  const sigOdo = 0.1 * noiseScale
  const sigMeas = 0.08
  const g = makeGauss(4242)
  const gm = makeGauss(4343)
  const robot: RobotSim = { x: 1.1, y: 0, th: Math.PI / 2, wp: 0 }
  const drPose = { x: 1.1, y: 0, th: Math.PI / 2 }
  const s = slamInit(1.1, 0, Math.PI / 2)
  const truth: [number, number][] = []
  const dr: [number, number][] = []
  const slamTraj: [number, number][] = []
  for (let i = 0; i < DOCK_STEPS; i++) {
    const { v, om } = control(robot)
    trueStep(robot, v, om, DOCK_DT)
    // both estimators see the same noisy odometry
    const vN = v + g() * sigOdo
    const omN = om + g() * sigOdo * 1.4
    drPose.x += vN * DOCK_DT * Math.cos(drPose.th)
    drPose.y += vN * DOCK_DT * Math.sin(drPose.th)
    drPose.th = wrapAngle(drPose.th + omN * DOCK_DT)
    slamPredict(s, vN, omN, DOCK_DT, sigOdo * 1.6, sigOdo * 2.2)
    // range-bearing measurements to nearby landmarks
    LANDMARKS.forEach(([lx, ly], id) => {
      const dxm = lx - robot.x
      const dym = ly - robot.y
      const r = Math.hypot(dxm, dym)
      if (r < 1.1) {
        const phi = wrapAngle(Math.atan2(dym, dxm) - robot.th)
        slamUpdate(s, id, r + gm() * sigMeas, wrapAngle(phi + gm() * sigMeas), sigMeas, sigMeas)
      }
    })
    truth.push([robot.x, robot.y])
    dr.push([drPose.x, drPose.y])
    slamTraj.push([s.x[0], s.x[1]])
  }
  const last = truth.length - 1
  return {
    truth,
    dr,
    slam: slamTraj,
    drErr: Math.hypot(dr[last][0] - truth[last][0], dr[last][1] - truth[last][1]),
    slamErr: Math.hypot(slamTraj[last][0] - truth[last][0], slamTraj[last][1] - truth[last][1]),
  }
}

function DockLab() {
  const t = useT(T)
  const [noise, setNoise] = useState(1)

  const { truth, dr, slam, drErr, slamErr } = useMemo(() => runDockLap(noise), [noise])

  const PW = 520
  const PH = 340
  const sx = (x: number) => PW / 2 + x * 150
  const sy = (y: number) => PH / 2 - y * 130

  const line = (pts: [number, number][]) => pts.map((p) => `${sx(p[0])},${sy(p[1])}`).join(' ')

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          {LANDMARKS.map(([lx, ly], i) => (
            <text key={i} x={sx(lx)} y={sy(ly) + 4} textAnchor="middle" fill="#a78bfa" fontSize={11}>
              ◆
            </text>
          ))}
          <text x={sx(1.1)} y={sy(0) + 5} textAnchor="middle" fill="#4ade80" fontSize={14}>
            ⌂
          </text>
          <polyline points={line(truth)} fill="none" stroke="#e2e8f077" strokeWidth={1} strokeDasharray="3 4" />
          <polyline points={line(dr)} fill="none" stroke="#f87171" strokeWidth={1.8} />
          <polyline points={line(slam)} fill="none" stroke="#22d3ee" strokeWidth={1.8} />
          <circle cx={sx(dr[dr.length - 1][0])} cy={sy(dr[dr.length - 1][1])} r={4.5} fill="#f87171" />
          <circle cx={sx(slam[slam.length - 1][0])} cy={sy(slam[slam.length - 1][1])} r={4.5} fill="#22d3ee" />
        </svg>
        <div className="border-t border-white/10 px-4 py-2 text-[12px] text-muted">{t.appLegend}</div>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad">
          <Slider label={t.appNoise} value={noise} min={0.3} max={2.5} step={0.1} onChange={setNoise} format={(v) => `×${fmt(v, 1)}`} />
        </div>
        <div className="grid grid-cols-1 gap-3">
          <Readout
            label={t.appDrErr}
            value={`${fmt(drErr * 100, 0)} cm - ${drErr <= DOCK_TOL ? t.appPass : t.appFail}`}
            accent={drErr <= DOCK_TOL ? '#4ade80' : '#f87171'}
          />
          <Readout
            label={t.appSlamErr}
            value={`${fmt(slamErr * 100, 0)} cm - ${slamErr <= DOCK_TOL ? t.appPass : t.appFail}`}
            accent={slamErr <= DOCK_TOL ? '#4ade80' : '#f87171'}
          />
          <div className="text-[12px] text-muted">{t.appTol}</div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function SlamPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'deadreck', label: t.drTitle },
          { id: 'ekfslam', label: t.slamTitle },
          { id: 'correlation', label: t.corrTitle },
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

      <Section id="deadreck" title={t.drTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.dr1}</p>
        </div>
        <div className="mt-4">
          <DeadReckLab />
        </div>
      </Section>

      <Section id="ekfslam" title={t.slamTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.slam1}</p>
          <p>{t.slam2}</p>
        </div>
        <div className="mt-4">
          <EkfSlamLab />
        </div>
      </Section>

      <Section id="correlation" title={t.corrTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.corr1}</p>
        </div>
        <CorrHeatmapNote />
      </Section>

      <Section id="math" title={t.mathTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.math1}</p>
          <TeX block>{String.raw`P^- = F P F^{\mathsf T} + Q, \qquad K = P^- H^{\mathsf T}(H P^- H^{\mathsf T} + R)^{-1}, \qquad P = (I - KH)P^-`}</TeX>
        </div>
        <Derivation title={t.mathDerivTitle} steps={t.mathDeriv} />
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
          <DockLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}

/** Standalone note pointing back to the live heatmap inside the EKF lab card above. */
function CorrHeatmapNote() {
  const t = useT(T)
  return (
    <InfoBox tone="tip" title="💡">
      {t.corrMap}
    </InfoBox>
  )
}
