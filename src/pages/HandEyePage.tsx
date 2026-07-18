import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { ImageView } from '../components/ImageView'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import {
  AxesTriad,
  CameraFrustumViz,
  Checkerboard3D,
  FrameLink,
  Polyline,
  Quad,
  Scene3D,
  SegmentMesh,
} from '../components/three/helpers'
import {
  boardCorners,
  deg2rad,
  fmt,
  lookAtCV,
  m4,
  m4Diff,
  m4Inv,
  m4Mul,
  m4MulChain,
  m4MulP,
  m4R,
  m4RotX,
  m4RotY,
  m4Trans,
  m4t,
  norm,
  projectPoint,
  rotX,
  sub,
  type Intrinsics,
  type M4,
  type Pose,
  type V3,
} from '../lib/math'

const W = 640
const H = 480
const CAM_K: Intrinsics = { fx: 500, fy: 500, s: 0, cx: 320, cy: 240 }

const m4ToPose = (m: M4): Pose => ({ R: m4R(m), t: m4t(m) })

// gripper→camera mount (the unknown X in eye-in-hand): camera looks along the tool axis
const X_MOUNT = m4Mul(m4Trans(0.1, 0.05, 0), m4(rotX(-Math.PI / 2), [0, 0, 0]))
// gripper→board mount for eye-to-hand
const XB_MOUNT = m4Mul(m4Trans(0, 0.09, 0), m4(rotX(-Math.PI / 2), [0, 0, 0]))
// board lying flat on the floor (z up)
const BOARD_WORLD = m4Mul(m4Trans(0.1, 0.002, 0.82), m4(rotX(-Math.PI / 2), [0, 0, 0]))
// fixed tripod camera for eye-to-hand
const TRIPOD_POS: V3 = [0.35, 0.35, 1.55]

const BOARD_SQ = 0.03
const INNER = boardCorners(7, 5, BOARD_SQ)

interface FK {
  shoulder: V3
  elbow: V3
  wrist: V3
  G: M4
}

function forwardKinematics(q1: number, q2: number, q3: number, q4: number): FK {
  const T1 = m4Mul(m4RotY(q1), m4Trans(0, 0.35, 0))
  const T2 = m4Mul(m4RotX(q2), m4Trans(0, 0.4, 0))
  const T3 = m4Mul(m4RotX(q3), m4Trans(0, 0.35, 0))
  const T4 = m4Mul(m4RotX(q4), m4Trans(0, 0.12, 0))
  const A1 = T1
  const A2 = m4Mul(A1, T2)
  const A3 = m4Mul(A2, T3)
  const G = m4Mul(A3, T4)
  return { shoulder: m4t(A1), elbow: m4t(A2), wrist: m4t(A3), G }
}

const T = {
  en: {
    kicker: 'Vision · Module 5',
    title: 'Hand-Eye Calibration',
    intro:
      'A calibrated camera can measure poses — but in its own frame. A robot moves in its base frame. Before "the part is at pixel (412, 210)" can become "move the gripper to x = 0.31 m", one missing transform must be found: that is hand-eye calibration.',
    setupTitle: 'Two ways to mount a camera',
    setup1: 'Everything depends on where the camera is fixed:',
    setupCards: [
      {
        name: 'Eye-in-hand',
        desc: 'The camera rides on the robot flange. The unknown X is the gripper→camera transform. It is rigid — it never changes, no matter how the robot moves.',
      },
      {
        name: 'Eye-to-hand',
        desc: 'The camera stands next to the robot and watches the workspace; the calibration board is bolted to the gripper. Now the unknowns are gripper→board and base→camera.',
      },
    ],
    setup2:
      'In both cases the calibration data is the same: a set of robot poses A (from the robot controller — forward kinematics) paired with board poses B (from the camera, via the PnP / board-pose estimation of module 2).',
    labTitle: 'Interactive: the kinematic loop',
    lab1: 'Move the robot joints and watch the frames: base (b), gripper (g), camera (c) and calibration board (t). The dashed links show the transform chain. The key observation — the whole trick of hand-eye calibration — is which transforms change and which stay fixed.',
    labObs: [
      'A = ᵇT_g (base→gripper) changes with every joint — the robot reports it.',
      'B = ᶜT_t (camera→board) changes too — the camera measures it.',
      'X (the mount) and the board’s pose in the world never change.',
      'Therefore A·X·B is the same, no matter where the robot stands: the loop closes.',
    ],
    mode: 'Configuration',
    modeInHand: 'Eye-in-hand',
    modeToHand: 'Eye-to-hand',
    joints: 'Robot joints',
    j: 'joint',
    wave: 'Wave the robot',
    waveStop: 'Stop waving',
    waveHint: 'Let the robot move by itself and watch the chain below: B spins, A·X·B does not.',
    ghostTitle: 'The X-detector: a wrong hand-eye reveals itself through motion',
    ghostText:
      'The red ghost frame is where the system believes the board to be — computed through the chain A·X̃·B with a deliberately perturbed mount X̃. At ε = 0 the ghost sits exactly on the real board, for every robot pose: a correct X closes the loop always. Now perturb ε and move the joints (or let the robot wave): the ghost drifts, and it drifts differently for every pose. This inconsistency across poses is exactly the signal a hand-eye solver exploits — and the reason it needs diverse motions.',
    ghostEps: 'perturbation ε of X',
    ghostErr: 'ghost vs. real board',
    ghostOnlyInhand: 'The ghost demo runs in the eye-in-hand configuration — switch above.',
    camView: 'Camera view (board-pose measurement B)',
    notVisible: 'Board not (fully) in view — move the robot until the camera sees it.',
    chainTitle: 'Live transform chain',
    chainConst: 'constant — the loop closes',
    chainB: 'changes with the robot pose',
    tBase: 'base→board via A·X·B',
    tCamBoard: 'camera→board ‖t_B‖',
    capTitle: 'Pose capture — verifying AX = XB',
    capText:
      'Capture the current pose pair (A, B), then move the robot and capture another. For the two most recent captures, the relative motions Ã = A₂⁻¹A₁ and B̃ = B₂B₁⁻¹ satisfy the hand-eye equation — the residual ‖ÃX − XB̃‖ is zero up to floating point. With real, noisy measurements this residual is exactly what a solver minimizes over many pairs.',
    capBtn: 'Capture pose pair',
    capReset: 'Reset',
    capCount: 'captured pairs',
    capResidual: 'residual ‖ÃX − XB̃‖',
    capNeed: 'capture at least 2 poses',
    mathTitle: 'The math: AX = XB',
    math1: 'Write the loop for two robot poses i and j (eye-in-hand). The board never moves, so:',
    math2: 'Rearranging pulls the two unknowns to the middle — and everything measurable to known relative motions:',
    math3: 'One motion pair constrains X but does not fix it; two motions with non-parallel rotation axes determine X uniquely. Classical solvers split the problem: first the rotation (Tsai–Lenz, Park–Martin, quaternion methods), then the translation from a linear system — or solve both jointly with dual quaternions (Daniilidis) or nonlinear optimization.',
    axzbTitle: 'The robot-world variant: AX = ZB',
    axzb1: 'Instead of relative motions, one can keep the absolute poses and introduce the second constant transform explicitly as an unknown Z. For eye-to-hand (board on the gripper, camera fixed) the loop from base to board can be closed two ways:',
    axzb2: 'This is the robot-world hand-eye problem: it solves both unknowns simultaneously — the mount X and the camera’s (or board’s) place in the world Z. OpenCV ships both: cv2.calibrateHandEye for AX = XB and cv2.calibrateRobotWorldHandEye for AX = ZB.',
    practTitle: 'Practice: getting a good hand-eye calibration',
    practList: [
      'Degenerate motion sets exist: if all rotation axes of your movements are parallel, a whole family of X explains the data equally well — translation along that axis stays undetermined. The ghost demo above shows the flip side: only diverse motion exposes a wrong X.',
      'Rotate! Pure translations contribute nothing to the rotation part of X. Use large, diverse rotations (≥ 30°) about different axes.',
      'Collect 15–30 pose pairs with the board well spread in the camera image.',
      'The robot poses must be accurate — flex, backlash and un-synchronized capture times corrupt A.',
      'The board-pose estimates must be good: calibrate intrinsics first (module 2), then hold them fixed.',
      'Validate: move to an unused pose, predict the board position via A·X·B, compare with the measurement.',
    ],
  },
  de: {
    kicker: 'Vision · Modul 5',
    title: 'Hand-Auge-Kalibrierung',
    intro:
      'Eine kalibrierte Kamera kann Posen messen — aber in ihrem eigenen System. Ein Roboter bewegt sich im Basissystem. Bevor aus „das Teil ist bei Pixel (412, 210)“ ein „fahre den Greifer nach x = 0,31 m“ werden kann, fehlt genau eine Transformation: Das ist die Hand-Auge-Kalibrierung.',
    setupTitle: 'Zwei Arten, eine Kamera zu montieren',
    setup1: 'Alles hängt davon ab, wo die Kamera befestigt ist:',
    setupCards: [
      {
        name: 'Eye-in-Hand',
        desc: 'Die Kamera fährt auf dem Roboterflansch mit. Das unbekannte X ist die Transformation Greifer→Kamera. Sie ist starr — sie ändert sich nie, egal wie sich der Roboter bewegt.',
      },
      {
        name: 'Eye-to-Hand',
        desc: 'Die Kamera steht neben dem Roboter und blickt auf den Arbeitsraum; das Kalibrierbrett ist am Greifer montiert. Jetzt sind Greifer→Brett und Basis→Kamera unbekannt.',
      },
    ],
    setup2:
      'In beiden Fällen sind die Kalibrierdaten dieselben: eine Menge von Roboterposen A (aus der Robotersteuerung — Vorwärtskinematik), gepaart mit Brettposen B (aus der Kamera, über die PnP-/Brettposen-Schätzung aus Modul 2).',
    labTitle: 'Interaktiv: die kinematische Schleife',
    lab1: 'Bewege die Robotergelenke und beobachte die Koordinatensysteme: Basis (b), Greifer (g), Kamera (c) und Kalibrierbrett (t). Die gestrichelten Verbindungen zeigen die Transformationskette. Die Schlüsselbeobachtung — der ganze Trick der Hand-Auge-Kalibrierung — ist, welche Transformationen sich ändern und welche fest bleiben.',
    labObs: [
      'A = ᵇT_g (Basis→Greifer) ändert sich mit jedem Gelenk — der Roboter meldet sie.',
      'B = ᶜT_t (Kamera→Brett) ändert sich ebenfalls — die Kamera misst sie.',
      'X (die Montage) und die Pose des Bretts in der Welt ändern sich nie.',
      'Also ist A·X·B immer gleich, egal wo der Roboter steht: Die Schleife schließt sich.',
    ],
    mode: 'Konfiguration',
    modeInHand: 'Eye-in-Hand',
    modeToHand: 'Eye-to-Hand',
    joints: 'Robotergelenke',
    j: 'Gelenk',
    wave: 'Roboter winken lassen',
    waveStop: 'Stopp',
    waveHint: 'Lass den Roboter selbst fahren und beobachte die Kette unten: B rotiert, A·X·B nicht.',
    ghostTitle: 'Der X-Detektor: Ein falsches Hand-Auge verrät sich durch Bewegung',
    ghostText:
      'Der rote Geisterrahmen zeigt, wo das System das Brett vermutet — berechnet über die Kette A·X̃·B mit einer absichtlich gestörten Montage X̃. Bei ε = 0 sitzt der Geist exakt auf dem echten Brett, für jede Roboterpose: Ein korrektes X schließt die Schleife immer. Störe nun ε und bewege die Gelenke (oder lass den Roboter winken): Der Geist driftet — und zwar für jede Pose anders. Genau diese Inkonsistenz über die Posen ist das Signal, das ein Hand-Auge-Löser ausnutzt — und der Grund, warum er vielfältige Bewegungen braucht.',
    ghostEps: 'Störung ε von X',
    ghostErr: 'Geist vs. echtes Brett',
    ghostOnlyInhand: 'Die Geist-Demo läuft in der Eye-in-Hand-Konfiguration — oben umschalten.',
    camView: 'Kamerabild (Brettposen-Messung B)',
    notVisible: 'Brett nicht (vollständig) im Bild — bewege den Roboter, bis die Kamera es sieht.',
    chainTitle: 'Transformationskette, live',
    chainConst: 'konstant — die Schleife schließt sich',
    chainB: 'ändert sich mit der Roboterpose',
    tBase: 'Basis→Brett über A·X·B',
    tCamBoard: 'Kamera→Brett ‖t_B‖',
    capTitle: 'Posen aufnehmen — AX = XB überprüfen',
    capText:
      'Nimm das aktuelle Posenpaar (A, B) auf, bewege den Roboter und nimm ein weiteres auf. Für die zwei letzten Aufnahmen erfüllen die Relativbewegungen Ã = A₂⁻¹A₁ und B̃ = B₂B₁⁻¹ die Hand-Auge-Gleichung — das Residuum ‖ÃX − XB̃‖ ist bis auf Gleitkommagenauigkeit null. Mit echten, verrauschten Messungen ist genau dieses Residuum das, was ein Löser über viele Paare minimiert.',
    capBtn: 'Posenpaar aufnehmen',
    capReset: 'Zurücksetzen',
    capCount: 'aufgenommene Paare',
    capResidual: 'Residuum ‖ÃX − XB̃‖',
    capNeed: 'mindestens 2 Posen aufnehmen',
    mathTitle: 'Die Mathematik: AX = XB',
    math1: 'Schreibe die Schleife für zwei Roboterposen i und j (Eye-in-Hand). Das Brett bewegt sich nie, also:',
    math2: 'Umstellen bringt die Unbekannten in die Mitte — und alles Messbare in bekannte Relativbewegungen:',
    math3: 'Ein Bewegungspaar schränkt X ein, legt es aber nicht fest; zwei Bewegungen mit nicht-parallelen Rotationsachsen bestimmen X eindeutig. Klassische Löser zerlegen das Problem: erst die Rotation (Tsai–Lenz, Park–Martin, Quaternion-Methoden), dann die Translation aus einem linearen System — oder beides gemeinsam mit dualen Quaternionen (Daniilidis) bzw. nichtlinearer Optimierung.',
    axzbTitle: 'Die Robot-World-Variante: AX = ZB',
    axzb1: 'Statt Relativbewegungen kann man die Absolutposen behalten und die zweite konstante Transformation explizit als Unbekannte Z einführen. Für Eye-to-Hand (Brett am Greifer, Kamera fest) lässt sich die Schleife von der Basis zum Brett auf zwei Wegen schließen:',
    axzb2: 'Das ist das Robot-World-Hand-Auge-Problem: Es löst beide Unbekannte gleichzeitig — die Montage X und den Ort der Kamera (bzw. des Bretts) in der Welt Z. OpenCV bietet beides: cv2.calibrateHandEye für AX = XB und cv2.calibrateRobotWorldHandEye für AX = ZB.',
    practTitle: 'Praxis: eine gute Hand-Auge-Kalibrierung',
    practList: [
      'Es gibt degenerierte Bewegungsmengen: Sind alle Rotationsachsen der Bewegungen parallel, erklärt eine ganze Familie von X die Daten gleich gut — die Translation entlang dieser Achse bleibt unbestimmt. Die Geist-Demo oben zeigt die Kehrseite: Nur vielfältige Bewegung entlarvt ein falsches X.',
      'Rotieren! Reine Translationen tragen nichts zum Rotationsanteil von X bei. Nutze große, vielfältige Rotationen (≥ 30°) um verschiedene Achsen.',
      '15–30 Posenpaare sammeln, mit dem Brett gut über das Kamerabild verteilt.',
      'Die Roboterposen müssen stimmen — Nachgiebigkeit, Spiel und unsynchronisierte Aufnahmezeitpunkte verfälschen A.',
      'Die Brettposen-Schätzungen müssen gut sein: erst die Intrinsik kalibrieren (Modul 2), dann festhalten.',
      'Validieren: eine unbenutzte Pose anfahren, die Brettposition über A·X·B vorhersagen und mit der Messung vergleichen.',
    ],
  },
}

const OPENCV_SNIPPET = `import cv2

# R_gripper2base / t_gripper2base : robot poses A   (from the controller)
# R_target2cam  / t_target2cam    : board poses B   (from calibrateCamera / solvePnP)

R_cam2gripper, t_cam2gripper = cv2.calibrateHandEye(
    R_gripper2base, t_gripper2base,
    R_target2cam, t_target2cam,
    method=cv2.CALIB_HAND_EYE_PARK)          # X  (eye-in-hand)

R_base2world, t_base2world, R_gripper2cam, t_gripper2cam = \\
    cv2.calibrateRobotWorldHandEye(
        R_world2cam, t_world2cam,
        R_base2gripper, t_base2gripper)      # Z and X  (AX = ZB)`

type Mode = 'inhand' | 'tohand'

interface CapturedPair {
  A: M4
  B: M4
}

export function HandEyePage() {
  const t = useT(T)
  const [mode, setMode] = useState<Mode>('inhand')
  const [q1, setQ1] = useState(0)
  const [q2, setQ2] = useState(45)
  const [q3, setQ3] = useState(60)
  const [q4, setQ4] = useState(55)
  const [captures, setCaptures] = useState<CapturedPair[]>([])
  const [waving, setWaving] = useState(false)
  const [eps, setEps] = useState(0)
  const waveRef = useRef({ q1: 0, q2: 45, q4: 55, t: 0 })

  useEffect(() => {
    if (!waving) return
    waveRef.current = { q1, q2, q4, t: 0 }
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)))
    const iv = setInterval(() => {
      const b = waveRef.current
      b.t += 0.05
      setQ1(clamp(b.q1 + 20 * Math.sin(b.t), -50, 50))
      setQ2(clamp(b.q2 + 8 * Math.sin(b.t * 1.7 + 1), 15, 75))
      setQ4(clamp(b.q4 + 12 * Math.sin(b.t * 2.3 + 2), 15, 85))
    }, 40)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waving])

  const fk = useMemo(
    () => forwardKinematics(deg2rad(q1), deg2rad(q2), deg2rad(q3), deg2rad(q4)),
    [q1, q2, q3, q4],
  )

  const tripodPose = useMemo(() => lookAtCV(TRIPOD_POS, m4t(fk.G)), [fk])
  const tripodM4 = useMemo(() => m4Inv(m4(tripodPose.R, tripodPose.t)), [tripodPose])

  // world poses of camera and board depending on the mode
  const camWorld = mode === 'inhand' ? m4Mul(fk.G, X_MOUNT) : tripodM4
  const boardWorld = mode === 'inhand' ? BOARD_WORLD : m4Mul(fk.G, XB_MOUNT)

  const camPose = m4ToPose(m4Inv(camWorld)) // world→camera
  const A = fk.G
  const B = m4Mul(m4Inv(camWorld), boardWorld) // camera→board (what the camera measures)
  const baseBoard = m4MulChain(A, mode === 'inhand' ? X_MOUNT : XB_MOUNT, mode === 'inhand' ? B : m4Identity4())

  // camera view of the board
  const corners = useMemo(
    () => INNER.map((p) => projectPoint(CAM_K, camPose, m4MulP(boardWorld, p))),
    [camPose, boardWorld],
  )
  const outline = useMemo(() => {
    const bw = 4.35 * BOARD_SQ
    const bh = 3.35 * BOARD_SQ
    return (
      [
        [-bw, -bh, 0],
        [bw, -bh, 0],
        [bw, bh, 0],
        [-bw, bh, 0],
      ] as V3[]
    ).map((p) => {
      const pr = projectPoint(CAM_K, camPose, m4MulP(boardWorld, p))
      return [pr.u, pr.v] as [number, number]
    })
  }, [camPose, boardWorld])
  const allVisible = corners.every((c) => c.z > 0.05 && c.u >= 0 && c.u <= W && c.v >= 0 && c.v <= H)

  // residual of the hand-eye equation for the two most recent captures
  const residual = useMemo(() => {
    if (captures.length < 2) return null
    const [pi, pj] = captures.slice(-2)
    const X = mode === 'inhand' ? X_MOUNT : XB_MOUNT
    const Arel = m4Mul(m4Inv(pj.A), pi.A)
    const Brel = m4Mul(pj.B, m4Inv(pi.B))
    return m4Diff(m4Mul(Arel, X), m4Mul(X, Brel))
  }, [captures, mode])

  // ghost board: the loop closed with a deliberately wrong mount X̃ (eye-in-hand only)
  const ghostActive = mode === 'inhand' && Math.abs(eps) > 1e-6
  const XTil = useMemo(
    () => m4MulChain(X_MOUNT, m4RotX(deg2rad(eps * 15)), m4Trans(eps * 0.05, 0, eps * 0.03)),
    [eps],
  )
  const ghostPose = m4MulChain(A, XTil, B)
  const ghostErrV = norm(sub(m4t(ghostPose), m4t(boardWorld)))
  const GW = ((8 + 1.2) * BOARD_SQ) / 2
  const GH = ((6 + 1.2) * BOARD_SQ) / 2
  const ghostCorners: V3[] = (
    [
      [-GW, -GH, 0],
      [GW, -GH, 0],
      [GW, GH, 0],
      [-GW, GH, 0],
    ] as V3[]
  ).map((p) => m4MulP(ghostPose, p))

  const camC = m4t(camWorld)
  const gripC = m4t(fk.G)
  const boardC = m4t(boardWorld)
  const bb = m4t(baseBoard)
  const tB = m4t(B)
  const normTB = Math.hypot(tB[0], tB[1], tB[2])

  const switchMode = (m: Mode) => {
    setMode(m)
    setCaptures([])
  }

  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'setups', label: t.setupTitle },
          { id: 'lab', label: t.labTitle },
          { id: 'capture', label: t.capTitle },
          { id: 'axxb', label: t.mathTitle },
          { id: 'axzb', label: t.axzbTitle },
          { id: 'practice', label: t.practTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="setups" title={t.setupTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.setup1}</p>
        </div>
        <div className="my-4 grid gap-4 md:grid-cols-2">
          {t.setupCards.map((c, i) => (
            <div key={i} className="card-pad">
              <div className="mb-1 font-mono text-sm font-semibold text-accent">{c.name}</div>
              <p className="text-[14px] leading-6 text-ink/85">{c.desc}</p>
            </div>
          ))}
        </div>
        <div className="prose-cv max-w-3xl">
          <p>{t.setup2}</p>
        </div>
      </Section>

      <Section id="lab" title={t.labTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.lab1}</p>
        </div>
        <div className="my-4">
          <Segmented<Mode>
            options={[
              { value: 'inhand', label: t.modeInHand },
              { value: 'tohand', label: t.modeToHand },
            ]}
            value={mode}
            onChange={switchMode}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <Scene3D
            className="lg:col-span-3"
            height={480}
            camera={{ position: [2.1, 1.5, 2.5], fov: 42 }}
            target={[0.1, 0.4, 0.45]}
          >
            {/* robot */}
            <mesh position={[0, 0.06, 0]}>
              <cylinderGeometry args={[0.11, 0.13, 0.12, 32]} />
              <meshStandardMaterial color="#2d3748" metalness={0.4} roughness={0.4} />
            </mesh>
            <SegmentMesh from={[0, 0.1, 0]} to={fk.shoulder} radius={0.045} color="#8b93a7" />
            <SegmentMesh from={fk.shoulder} to={fk.elbow} radius={0.04} color="#aab3c5" />
            <SegmentMesh from={fk.elbow} to={fk.wrist} radius={0.035} color="#8b93a7" />
            <SegmentMesh from={fk.wrist} to={gripC} radius={0.03} color="#aab3c5" />
            {[fk.shoulder, fk.elbow, fk.wrist].map((p, i) => (
              <mesh key={i} position={p}>
                <sphereGeometry args={[0.05, 20, 20]} />
                <meshStandardMaterial color="#4a5670" metalness={0.5} roughness={0.35} />
              </mesh>
            ))}

            {/* frames */}
            <AxesTriad pose={m4Identity4()} size={0.24} label="base" />
            <AxesTriad pose={fk.G} size={0.16} label="gripper" />
            <AxesTriad pose={boardWorld} size={0.14} label="board" />

            {/* camera + board */}
            <CameraFrustumViz k={CAM_K} w={W} h={H} pose={camPose} depth={0.18} color="#fbbf24" label="cam" />
            <Checkerboard3D pose={boardWorld} cols={8} rows={6} square={BOARD_SQ} />
            {ghostActive && (
              <group>
                <Polyline points={[...ghostCorners, ghostCorners[0]]} color="#f87171" lineWidth={2.5} />
                <Quad corners={ghostCorners} color="#f87171" opacity={0.16} />
              </group>
            )}
            {mode === 'tohand' && (
              <SegmentMesh from={[TRIPOD_POS[0], 0, TRIPOD_POS[2]]} to={TRIPOD_POS} radius={0.02} color="#5b6478" />
            )}

            {/* transform links */}
            <FrameLink from={[0, 0, 0]} to={gripC} color="#22d3ee" label="A" />
            <FrameLink from={gripC} to={mode === 'inhand' ? camC : boardC} color="#fbbf24" label="X" />
            <FrameLink from={camC} to={boardC} color="#a78bfa" label="B" />
            <FrameLink
              from={[0, 0, 0]}
              to={mode === 'inhand' ? boardC : camC}
              color="#4ade80"
              label="Z"
            />
          </Scene3D>

          <div className="flex flex-col gap-4 lg:col-span-2">
            <div className="card-pad">
              <h3 className="mb-3 text-sm font-bold tracking-wide text-accent uppercase">{t.joints}</h3>
              <div className="space-y-3">
                <Slider label={`${t.j} 1 (yaw)`} value={q1} min={-50} max={50} step={1} onChange={setQ1} format={(v) => `${v}°`} />
                <Slider label={`${t.j} 2`} value={q2} min={15} max={75} step={1} onChange={setQ2} format={(v) => `${v}°`} />
                <Slider label={`${t.j} 3`} value={q3} min={20} max={95} step={1} onChange={setQ3} format={(v) => `${v}°`} />
                <Slider label={`${t.j} 4`} value={q4} min={15} max={85} step={1} onChange={setQ4} format={(v) => `${v}°`} />
              </div>
              <button className="btn mt-4" onClick={() => setWaving(!waving)}>
                {waving ? `⏸ ${t.waveStop}` : `🤖 ${t.wave}`}
              </button>
              <p className="mt-2 text-[12px] leading-5 text-muted">{t.waveHint}</p>
            </div>
            <ImageView
              title={t.camView}
              points={corners.filter((c) => c.z > 0).map((c) => ({ u: c.u, v: c.v, color: '#22d3ee', r: 3 }))}
              polylines={[{ pts: [...outline, outline[0]], color: allVisible ? '#4ade80' : '#f87171', width: 1.5 }]}
            />
            {!allVisible && <div className="text-[13px] text-warn">{t.notVisible}</div>}
          </div>
        </div>

        <div className="card-pad mt-4">
          <h3 className="mb-3 text-sm font-bold tracking-wide text-muted uppercase">{t.chainTitle}</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <Readout label={t.tCamBoard} value={fmt(normTB, 3)} unit={`m — ${t.chainB}`} accent="#a78bfa" />
            <Readout
              label={t.tBase}
              value={`(${fmt(bb[0], 3)}, ${fmt(bb[1], 3)}, ${fmt(bb[2], 3)})`}
              unit={mode === 'inhand' ? `m — ${t.chainConst}` : 'm'}
              accent="#4ade80"
            />
            <Readout
              label="X"
              value={
                mode === 'inhand'
                  ? `(${fmt(m4t(X_MOUNT)[0], 2)}, ${fmt(m4t(X_MOUNT)[1], 2)}, ${fmt(m4t(X_MOUNT)[2], 2)})`
                  : `(${fmt(m4t(XB_MOUNT)[0], 2)}, ${fmt(m4t(XB_MOUNT)[1], 2)}, ${fmt(m4t(XB_MOUNT)[2], 2)})`
              }
              unit="m — const"
              accent="#fbbf24"
            />
          </div>
        </div>

        <div className="card-pad mt-4">
          <h3 className="mb-2 text-sm font-bold tracking-wide text-red-400 uppercase">{t.ghostTitle}</h3>
          <p className="mb-4 max-w-3xl text-[14px] leading-6 text-ink/85">{t.ghostText}</p>
          {mode === 'inhand' ? (
            <div className="grid items-center gap-4 md:grid-cols-2">
              <Slider
                label={t.ghostEps}
                value={eps}
                min={-1}
                max={1}
                step={0.01}
                onChange={setEps}
                format={(v) => fmt(v, 2)}
                accent="#f87171"
              />
              <Readout
                label={t.ghostErr}
                value={fmt(ghostErrV * 100, 1)}
                unit="cm"
                accent={ghostErrV < 0.005 ? '#4ade80' : '#f87171'}
              />
            </div>
          ) : (
            <div className="text-[13px] text-warn">{t.ghostOnlyInhand}</div>
          )}
        </div>

        <InfoBox title="🔍">
          <ul className="my-1 list-disc space-y-1 pl-5">
            {t.labObs.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </InfoBox>
      </Section>

      <Section id="capture" title={t.capTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.capText}</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button className="btn-primary" onClick={() => setCaptures((prev) => [...prev, { A, B }])}>
            🤖 {t.capBtn}
          </button>
          <button className="btn" onClick={() => setCaptures([])}>
            ↺ {t.capReset}
          </button>
          <Readout label={t.capCount} value={`${captures.length}`} />
          <Readout
            label={t.capResidual}
            value={residual === null ? '—' : residual.toExponential(1)}
            unit={residual === null ? t.capNeed : ''}
            accent="#4ade80"
          />
        </div>
      </Section>

      <Section id="axxb" title={t.mathTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.math1}</p>
          <TeX block>{String.raw`{}^{b}T_{t} \;=\; \underbrace{{}^{b}T_{g}^{(i)}}_{A_i}\;\underbrace{{}^{g}T_{c}}_{X}\;\underbrace{{}^{c}T_{t}^{(i)}}_{B_i} \;=\; A_j\,X\,B_j \qquad \forall\, i,j`}</TeX>
          <p>{t.math2}</p>
          <TeX block>{String.raw`\big(A_j^{-1}A_i\big)\,X \;=\; X\,\big(B_j B_i^{-1}\big) \qquad\Longrightarrow\qquad \tilde{A}X = X\tilde{B}`}</TeX>
          <p>{t.math3}</p>
        </div>
      </Section>

      <Section id="axzb" title={t.axzbTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.axzb1}</p>
          <TeX block>{String.raw`\underbrace{{}^{b}T_{g}^{(i)}}_{A_i}\;\underbrace{{}^{g}T_{t}}_{X} \;=\; \underbrace{{}^{b}T_{c}}_{Z}\;\underbrace{{}^{c}T_{t}^{(i)}}_{B_i} \qquad\Longrightarrow\qquad A_iX = ZB_i`}</TeX>
          <p>{t.axzb2}</p>
        </div>
        <pre className="card mt-4 overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-ink/85">
          {OPENCV_SNIPPET}
        </pre>
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
    </div>
  )
}

function m4Identity4(): M4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}
