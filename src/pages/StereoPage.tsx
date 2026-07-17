import { useMemo, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { MatrixView } from '../components/MatrixView'
import { ImageView } from '../components/ImageView'
import { InfoBox, Readout, Section, Slider } from '../components/ui'
import { CameraFrustumViz, Polyline, Scene3D } from '../components/three/helpers'
import {
  add,
  cameraCenter,
  epipolarSegment,
  fmt,
  fmtSci,
  fundamental,
  lookAtCV,
  m3MulV,
  m3T,
  projectPoint,
  relativePose,
  scale,
  type Intrinsics,
  type V3,
} from '../lib/math'

const W = 640
const H = 480

const T = {
  en: {
    kicker: 'Module 3',
    title: 'Stereo Calibration & Stereo Vision',
    intro:
      'A single camera destroys depth: every point on a viewing ray lands on the same pixel. A second camera breaks that ambiguity. This module covers the geometry of two views — from stereo extrinsics through epipolar lines to metric depth from disparity.',
    triTitle: 'Interactive: triangulation with two cameras',
    tri1: 'Two identical, perfectly parallel cameras (the rectified case) observe one point. Each camera alone only knows a ray — but the two rays intersect in exactly one place. That intersection is triangulation, and the whole depth signal is the horizontal shift between the two image positions: the disparity d = uL − uR.',
    triTry: [
      'Push the point away (Z ↑) — both image dots crawl toward each other: disparity shrinks hyperbolically.',
      'Widen the baseline b — disparity grows: a wider rig can see depth farther away.',
      'Increase f — same effect: telephoto stereo has more depth signal but a narrower view.',
    ],
    leftImg: 'Left image',
    rightImg: 'Right image',
    scene: '3D scene — drag to orbit',
    baseline: 'baseline b',
    focal: 'focal length f',
    px: 'point X',
    py: 'point Y',
    pz: 'point depth Z',
    disparity: 'disparity d',
    estDepth: 'Z from d',
    depthFormula: 'The rectified geometry gives the fundamental relation of stereo vision:',
    calibTitle: 'Stereo calibration: the extrinsics between two cameras',
    calib1:
      'Stereo calibration (e.g. cv2.stereoCalibrate) estimates the fixed rigid transform between the two cameras — the rotation R and translation t that map points from the left camera frame into the right one — alongside both K matrices. It uses the same checkerboard captures as single-camera calibration, seen by both cameras simultaneously.',
    calib2:
      'From R and t follow the two workhorse matrices of two-view geometry: the essential matrix E (normalized coordinates) and the fundamental matrix F (pixels). Both encode the same constraint — a point in one image confines its partner to a line in the other:',
    epiTitle: 'Interactive: epipolar geometry',
    epi1: 'Here the two cameras are verged (rotated toward each other), like your eyes. Drag the point in the left image: its epipolar line appears in the right image. The matching point can only lie on this line — this is why stereo matching is a 1D search, not a 2D one.',
    epi2: 'The depth slider moves a candidate 3D point along the left viewing ray. Watch its projection in the right image: it slides along the epipolar line but never leaves it, no matter the depth.',
    epiDrag: 'drag the point!',
    epiDepth: 'depth along left ray',
    epiF: 'Current fundamental matrix (computed from K, R, t of this rig):',
    rectTitle: 'Rectification: making epipolar lines horizontal',
    rect1:
      'General epipolar lines are slanted — searching along them is awkward. Rectification warps both images with homographies so that both virtual cameras are parallel again: all epipolar lines become horizontal, and corresponding points share the same image row. Every practical stereo matcher runs on rectified images.',
    rectBefore: 'Before: verged rig — lines converge toward the epipole',
    rectAfter: 'After: rectified — lines are horizontal rows',
    depthTitle: 'Interactive: from disparity to depth',
    depth1: 'Depth is inversely proportional to disparity — with dramatic consequences. One pixel of disparity is worth centimeters up close, but meters far away. The depth resolution of a stereo rig degrades quadratically with distance:',
    depthCurve: 'depth Z over disparity d',
    depthAt: 'depth at current d',
    depthRes: 'ΔZ per 1 px at current d',
    dSlider: 'disparity d',
    matchTitle: 'Finding correspondences in practice',
    match1: 'Geometry tells us where to search — a matcher must still decide which pixel corresponds. Block-matching algorithms (e.g. OpenCV’s StereoSGBM) compare local patches along each rectified row, pick the disparity with the best matching cost, and produce a disparity map, which the Q matrix from stereoRectify turns into a 3D point cloud.',
    matchList: [
      'Textureless surfaces (white walls) give no matching signal → holes in the map.',
      'Repetitive patterns cause ambiguous matches.',
      'Occlusions: some pixels are visible in only one camera and have no valid disparity.',
      'Active stereo (projected IR texture, e.g. RealSense) fights the first two problems.',
    ],
  },
  de: {
    kicker: 'Modul 3',
    title: 'Stereokalibrierung & Stereosehen',
    intro:
      'Eine einzelne Kamera zerstört Tiefe: Jeder Punkt auf einem Sehstrahl landet auf demselben Pixel. Eine zweite Kamera bricht diese Mehrdeutigkeit. Dieses Modul behandelt die Geometrie zweier Ansichten — von der Stereo-Extrinsik über Epipolarlinien bis zur metrischen Tiefe aus Disparität.',
    triTitle: 'Interaktiv: Triangulation mit zwei Kameras',
    tri1: 'Zwei identische, perfekt parallele Kameras (der rektifizierte Fall) beobachten einen Punkt. Jede Kamera allein kennt nur einen Strahl — aber die beiden Strahlen schneiden sich an genau einer Stelle. Dieser Schnitt ist die Triangulation, und das gesamte Tiefensignal steckt im horizontalen Versatz der beiden Bildpositionen: der Disparität d = uL − uR.',
    triTry: [
      'Schiebe den Punkt weiter weg (Z ↑) — beide Bildpunkte kriechen aufeinander zu: Die Disparität schrumpft hyperbolisch.',
      'Vergrößere die Basislinie b — die Disparität wächst: Ein breiteres Rig sieht Tiefe auf größere Entfernung.',
      'Erhöhe f — gleicher Effekt: Tele-Stereo hat mehr Tiefensignal, aber ein engeres Sichtfeld.',
    ],
    leftImg: 'Linkes Bild',
    rightImg: 'Rechtes Bild',
    scene: '3D-Szene — ziehen zum Orbiten',
    baseline: 'Basislinie b',
    focal: 'Brennweite f',
    px: 'Punkt X',
    py: 'Punkt Y',
    pz: 'Punkttiefe Z',
    disparity: 'Disparität d',
    estDepth: 'Z aus d',
    depthFormula: 'Aus der rektifizierten Geometrie folgt die Grundgleichung des Stereosehens:',
    calibTitle: 'Stereokalibrierung: die Extrinsik zwischen zwei Kameras',
    calib1:
      'Die Stereokalibrierung (z. B. cv2.stereoCalibrate) schätzt die feste Starrkörpertransformation zwischen den beiden Kameras — Rotation R und Translation t, die Punkte vom linken ins rechte Kamerasystem abbilden — zusammen mit beiden K-Matrizen. Sie nutzt dieselben Schachbrettaufnahmen wie die Einzelkamera-Kalibrierung, von beiden Kameras gleichzeitig gesehen.',
    calib2:
      'Aus R und t folgen die beiden Arbeitspferde der Zwei-Ansichten-Geometrie: die essentielle Matrix E (normierte Koordinaten) und die Fundamentalmatrix F (Pixel). Beide kodieren dieselbe Bedingung — ein Punkt in einem Bild zwingt seinen Partner im anderen auf eine Linie:',
    epiTitle: 'Interaktiv: Epipolargeometrie',
    epi1: 'Hier sind die beiden Kameras konvergent (zueinander gedreht), wie deine Augen. Ziehe den Punkt im linken Bild: Seine Epipolarlinie erscheint im rechten Bild. Der korrespondierende Punkt kann nur auf dieser Linie liegen — deshalb ist Stereo-Matching eine 1D-Suche, keine 2D-Suche.',
    epi2: 'Der Tiefen-Slider verschiebt einen 3D-Kandidatenpunkt entlang des linken Sehstrahls. Beobachte seine Projektion im rechten Bild: Sie gleitet die Epipolarlinie entlang, verlässt sie aber nie — egal bei welcher Tiefe.',
    epiDrag: 'Punkt ziehen!',
    epiDepth: 'Tiefe entlang des linken Strahls',
    epiF: 'Aktuelle Fundamentalmatrix (berechnet aus K, R, t dieses Rigs):',
    rectTitle: 'Rektifizierung: Epipolarlinien horizontal machen',
    rect1:
      'Allgemeine Epipolarlinien verlaufen schräg — entlang ihnen zu suchen ist unpraktisch. Die Rektifizierung entzerrt beide Bilder mit Homographien, sodass beide virtuellen Kameras wieder parallel stehen: Alle Epipolarlinien werden horizontal, und korrespondierende Punkte teilen dieselbe Bildzeile. Jeder praktische Stereo-Matcher arbeitet auf rektifizierten Bildern.',
    rectBefore: 'Vorher: konvergentes Rig — Linien laufen zum Epipol',
    rectAfter: 'Nachher: rektifiziert — Linien sind horizontale Zeilen',
    depthTitle: 'Interaktiv: von der Disparität zur Tiefe',
    depth1: 'Tiefe ist umgekehrt proportional zur Disparität — mit dramatischen Folgen. Ein Pixel Disparität entspricht in der Nähe Zentimetern, in der Ferne Metern. Die Tiefenauflösung eines Stereo-Rigs verschlechtert sich quadratisch mit der Entfernung:',
    depthCurve: 'Tiefe Z über Disparität d',
    depthAt: 'Tiefe bei aktuellem d',
    depthRes: 'ΔZ pro 1 px bei aktuellem d',
    dSlider: 'Disparität d',
    matchTitle: 'Korrespondenzsuche in der Praxis',
    match1: 'Die Geometrie sagt, wo zu suchen ist — ein Matcher muss trotzdem entscheiden, welches Pixel korrespondiert. Blockmatching-Verfahren (z. B. OpenCVs StereoSGBM) vergleichen lokale Bildausschnitte entlang jeder rektifizierten Zeile, wählen die Disparität mit den besten Matchingkosten und erzeugen eine Disparitätskarte, die die Q-Matrix aus stereoRectify in eine 3D-Punktwolke verwandelt.',
    matchList: [
      'Texturlose Flächen (weiße Wände) liefern kein Matchingsignal → Löcher in der Karte.',
      'Sich wiederholende Muster erzeugen mehrdeutige Matches.',
      'Verdeckungen: Manche Pixel sieht nur eine Kamera — sie haben keine gültige Disparität.',
      'Aktives Stereo (projizierte IR-Textur, z. B. RealSense) bekämpft die ersten beiden Probleme.',
    ],
  },
}

// ---------------------------------------------------------------- triangulation lab

function TriangulationLab() {
  const t = useT(T)
  const [b, setB] = useState(0.24)
  const [f, setF] = useState(520)
  const [px, setPx] = useState(0.15)
  const [py, setPy] = useState(1.0)
  const [pz, setPz] = useState(2.4)

  const k: Intrinsics = useMemo(() => ({ fx: f, fy: f, s: 0, cx: W / 2, cy: H / 2 }), [f])
  const camY = 0.9
  // CV camera frames have x pointing toward world -X here, so the LEFT camera of the
  // stereo pair sits at world +x: its x-axis then runs along the baseline toward the right camera.
  const poseL = useMemo(() => lookAtCV([b / 2, camY, 0], [b / 2, camY, 1]), [b])
  const poseR = useMemo(() => lookAtCV([-b / 2, camY, 0], [-b / 2, camY, 1]), [b])
  const P: V3 = [px, py, pz]

  const pL = projectPoint(k, poseL, P)
  const pR = projectPoint(k, poseR, P)
  const d = pL.u - pR.u
  const zEst = (f * b) / d

  const CL = cameraCenter(poseL)
  const CR = cameraCenter(poseR)

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Scene3D
          className="lg:col-span-3"
          height={430}
          camera={{ position: [2.8, 2.2, -2.6], fov: 42 }}
          target={[0, 0.9, 1.4]}
          hint={t.scene}
        >
          <CameraFrustumViz k={k} w={W} h={H} pose={poseL} depth={0.5} color="#22d3ee" label="L" points={[{ p: P, color: '#fbbf24' }]} />
          <CameraFrustumViz k={k} w={W} h={H} pose={poseR} depth={0.5} color="#a78bfa" label="R" points={[{ p: P, color: '#fbbf24' }]} />
          <Polyline points={[CL, CR]} color="#4ade80" lineWidth={3} />
          <mesh position={P}>
            <sphereGeometry args={[0.05, 24, 24]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.4} />
          </mesh>
        </Scene3D>
        <div className="card-pad space-y-3.5 lg:col-span-2">
          <Slider label={t.baseline} value={b} min={0.06} max={0.5} step={0.005} onChange={setB} format={(v) => `${fmt(v * 100, 1)} cm`} accent="#4ade80" />
          <Slider label={t.focal} value={f} min={300} max={900} step={5} onChange={setF} format={(v) => `${v} px`} />
          <Slider label={t.px} value={px} min={-0.8} max={0.8} step={0.01} onChange={setPx} format={(v) => `${fmt(v, 2)} m`} accent="#fbbf24" />
          <Slider label={t.py} value={py} min={0.3} max={1.6} step={0.01} onChange={setPy} format={(v) => `${fmt(v, 2)} m`} accent="#fbbf24" />
          <Slider label={t.pz} value={pz} min={1.2} max={5} step={0.02} onChange={setPz} format={(v) => `${fmt(v, 2)} m`} accent="#fbbf24" />
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Readout label={t.disparity} value={fmt(d, 1)} unit="px" />
            <Readout label={t.estDepth} value={fmt(zEst, 2)} unit="m" accent="#4ade80" />
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ImageView
          title={`${t.leftImg} — uL = ${fmt(pL.u, 0)}`}
          points={pL.z > 0 ? [{ u: pL.u, v: pL.v, color: '#fbbf24' }] : []}
          polylines={[{ pts: [[0, pL.v], [W, pL.v]], color: 'rgba(34,211,238,0.35)', width: 1, dash: '6 4' }]}
          principal={{ cx: W / 2, cy: H / 2 }}
        />
        <ImageView
          title={`${t.rightImg} — uR = ${fmt(pR.u, 0)}`}
          points={pR.z > 0 ? [{ u: pR.u, v: pR.v, color: '#fbbf24' }] : []}
          polylines={[{ pts: [[0, pR.v], [W, pR.v]], color: 'rgba(167,139,250,0.35)', width: 1, dash: '6 4' }]}
          principal={{ cx: W / 2, cy: H / 2 }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- epipolar lab

const EPI_K: Intrinsics = { fx: 520, fy: 520, s: 0, cx: W / 2, cy: H / 2 }
const EPI_TARGET: V3 = [0, 0, 2.2]
const EPI_POSE_L = lookAtCV([-0.3, 0, 0], EPI_TARGET)
const EPI_POSE_R = lookAtCV([0.3, 0, 0], EPI_TARGET)
const EPI_REL = relativePose(EPI_POSE_L, EPI_POSE_R)
const EPI_F = fundamental(EPI_K, EPI_K, EPI_REL.R, EPI_REL.t)

function EpipolarLab() {
  const t = useT(T)
  const [pt, setPt] = useState<{ u: number; v: number }>({ u: 240, v: 190 })
  const [depth, setDepth] = useState(2.2)

  const seg = useMemo(() => epipolarSegment(EPI_F, pt.u, pt.v, W, H), [pt])

  const rightPt = useMemo(() => {
    // point on the left viewing ray at camera-z `depth`, projected into the right image
    const yn = (pt.v - EPI_K.cy) / EPI_K.fy
    const xn = (pt.u - EPI_K.cx) / EPI_K.fx
    const CL = cameraCenter(EPI_POSE_L)
    const dirWorld = m3MulV(m3T(EPI_POSE_L.R), [xn, yn, 1])
    const X = add(CL, scale(dirWorld, depth))
    return projectPoint(EPI_K, EPI_POSE_R, X)
  }, [pt, depth])

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <ImageView
          title={`${t.leftImg} — ${t.epiDrag}`}
          points={[{ u: pt.u, v: pt.v, color: '#22d3ee', r: 7 }]}
          onDragImage={(u, v) => setPt({ u, v })}
        />
        <ImageView
          title={t.rightImg}
          points={
            rightPt.z > 0 && rightPt.u >= 0 && rightPt.u <= W && rightPt.v >= 0 && rightPt.v <= H
              ? [{ u: rightPt.u, v: rightPt.v, color: '#fbbf24', r: 6 }]
              : []
          }
          polylines={seg ? [{ pts: seg, color: '#22d3ee', width: 2 }] : []}
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card-pad">
          <Slider
            label={t.epiDepth}
            value={depth}
            min={0.9}
            max={8}
            step={0.02}
            onChange={setDepth}
            format={(v) => `${fmt(v, 2)} m`}
            accent="#fbbf24"
          />
        </div>
        <div className="card-pad">
          <div className="mb-2 text-[13px] text-muted">{t.epiF}</div>
          <MatrixView
            label={<TeX>{String.raw`F =`}</TeX>}
            values={[0, 1, 2].map((r) => [0, 1, 2].map((c) => fmtSci(EPI_F[r * 3 + c])))}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- rectification figure

function RectificationFigure() {
  const t = useT(T)
  const samplePts: [number, number][] = [
    [120, 90],
    [300, 150],
    [480, 100],
    [200, 300],
    [420, 360],
    [90, 420],
  ]
  const before = samplePts
    .map((p) => epipolarSegment(EPI_F, p[0], p[1], W, H))
    .filter((s): s is [[number, number], [number, number]] => s !== null)
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ImageView
        title={t.rectBefore}
        grid={false}
        polylines={before.map((pts, i) => ({
          pts,
          color: `hsl(${190 + i * 24}, 80%, 65%)`,
          width: 1.5,
        }))}
      />
      <ImageView
        title={t.rectAfter}
        grid={false}
        polylines={samplePts.map((p, i) => ({
          pts: [
            [0, p[1]],
            [W, p[1]],
          ] as [number, number][],
          color: `hsl(${190 + i * 24}, 80%, 65%)`,
          width: 1.5,
        }))}
      />
    </div>
  )
}

// ---------------------------------------------------------------- disparity → depth plot

function DepthPlot() {
  const t = useT(T)
  const [b, setB] = useState(0.12)
  const [f, setF] = useState(520)
  const [d, setD] = useState(16)

  const dMin = 4
  const dMax = 80
  const zMax = (f * b) / dMin
  const PW = 560
  const PH = 300
  const mx = (dd: number) => 56 + ((dd - dMin) / (dMax - dMin)) * (PW - 76)
  const my = (z: number) => PH - 36 - (z / zMax) * (PH - 56)

  const curve = Array.from({ length: 120 }, (_, i) => {
    const dd = dMin + (i / 119) * (dMax - dMin)
    return `${mx(dd)},${my((f * b) / dd)}`
  }).join(' ')

  const zCur = (f * b) / d
  const dz = (f * b) / (d * d)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">
          {t.depthCurve} — Z = f·b / d
        </div>
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          {/* axes */}
          <line x1={56} y1={PH - 36} x2={PW - 16} y2={PH - 36} stroke="rgba(255,255,255,0.3)" />
          <line x1={56} y1={20} x2={56} y2={PH - 36} stroke="rgba(255,255,255,0.3)" />
          {[20, 40, 60, 80].map((dd) => (
            <g key={dd}>
              <line x1={mx(dd)} y1={PH - 36} x2={mx(dd)} y2={PH - 32} stroke="rgba(255,255,255,0.4)" />
              <text x={mx(dd)} y={PH - 18} fill="#8b93a7" fontSize={11} textAnchor="middle">
                {dd}px
              </text>
            </g>
          ))}
          {[0.25, 0.5, 0.75, 1].map((fr) => (
            <g key={fr}>
              <line x1={52} y1={my(zMax * fr)} x2={56} y2={my(zMax * fr)} stroke="rgba(255,255,255,0.4)" />
              <text x={46} y={my(zMax * fr) + 4} fill="#8b93a7" fontSize={11} textAnchor="end">
                {fmt(zMax * fr, 1)}m
              </text>
            </g>
          ))}
          <polyline points={curve} fill="none" stroke="#22d3ee" strokeWidth={2.5} />
          {/* marker */}
          <line x1={mx(d)} y1={PH - 36} x2={mx(d)} y2={my(zCur)} stroke="rgba(251,191,36,0.5)" strokeDasharray="4 3" />
          <line x1={56} y1={my(zCur)} x2={mx(d)} y2={my(zCur)} stroke="rgba(251,191,36,0.5)" strokeDasharray="4 3" />
          <circle cx={mx(d)} cy={my(zCur)} r={6} fill="#fbbf24" stroke="#0a0e17" strokeWidth={2} />
        </svg>
      </div>
      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.baseline} value={b} min={0.04} max={0.4} step={0.005} onChange={setB} format={(v) => `${fmt(v * 100, 1)} cm`} accent="#4ade80" />
          <Slider label={t.focal} value={f} min={300} max={900} step={5} onChange={setF} format={(v) => `${v} px`} />
          <Slider label={t.dSlider} value={d} min={dMin} max={dMax} step={0.5} onChange={setD} format={(v) => `${fmt(v, 1)} px`} accent="#fbbf24" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.depthAt} value={fmt(zCur, 2)} unit="m" />
          <Readout label={t.depthRes} value={`±${fmt(dz * 100, 1)}`} unit="cm" accent={dz < 0.05 ? '#4ade80' : dz < 0.2 ? '#fbbf24' : '#f87171'} />
        </div>
        <TeX block>{String.raw`Z = \frac{f\,b}{d}, \qquad \Delta Z \approx \frac{Z^2}{f\,b}\,\Delta d`}</TeX>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function StereoPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="triangulation" title={t.triTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.tri1}</p>
        </div>
        <div className="mt-4">
          <TriangulationLab />
        </div>
        <div className="prose-cv mt-4 max-w-3xl">
          <p>{t.depthFormula}</p>
          <TeX block>{String.raw`d = u_L - u_R = \frac{f\,b}{Z} \quad\Longleftrightarrow\quad Z = \frac{f\,b}{d}`}</TeX>
        </div>
        <InfoBox title="⚡ Try it">
          <ul className="my-1 list-disc space-y-1 pl-5">
            {t.triTry.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </InfoBox>
      </Section>

      <Section id="stereo-calib" title={t.calibTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.calib1}</p>
          <p>{t.calib2}</p>
          <TeX block>{String.raw`E = [\mathbf{t}]_\times R, \qquad F = K_2^{-\mathsf T} E\, K_1^{-1}, \qquad \tilde{\mathbf{x}}_2^{\mathsf T} F\, \tilde{\mathbf{x}}_1 = 0`}</TeX>
        </div>
      </Section>

      <Section id="epipolar" title={t.epiTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.epi1}</p>
          <p>{t.epi2}</p>
        </div>
        <div className="mt-4">
          <EpipolarLab />
        </div>
      </Section>

      <Section id="rectification" title={t.rectTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.rect1}</p>
        </div>
        <div className="mt-4">
          <RectificationFigure />
        </div>
      </Section>

      <Section id="depth" title={t.depthTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.depth1}</p>
        </div>
        <div className="mt-4">
          <DepthPlot />
        </div>
      </Section>

      <Section id="matching" title={t.matchTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.match1}</p>
          <ul>
            {t.matchList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  )
}
