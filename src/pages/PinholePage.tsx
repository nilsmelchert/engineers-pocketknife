import { useMemo, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { MatrixView } from '../components/MatrixView'
import { ImageView, type ImagePoint } from '../components/ImageView'
import { InfoBox, Readout, Section, Slider } from '../components/ui'
import { AxesTriad, CameraFrustumViz, Polyline, Scene3D } from '../components/three/helpers'
import {
  add,
  deg2rad,
  fmt,
  lookAtCV,
  pMat,
  projectPoint,
  rad2deg,
  type Intrinsics,
  type V3,
} from '../lib/math'

const W = 640
const H = 480

const HOUSE_PTS: { p: V3; color: string }[] = [
  { p: [-0.5, 0.02, -0.5], color: '#f87171' },
  { p: [0.5, 0.02, -0.5], color: '#fb923c' },
  { p: [0.5, 0.02, 0.5], color: '#fbbf24' },
  { p: [-0.5, 0.02, 0.5], color: '#a3e635' },
  { p: [-0.5, 0.82, -0.5], color: '#4ade80' },
  { p: [0.5, 0.82, -0.5], color: '#2dd4bf' },
  { p: [0.5, 0.82, 0.5], color: '#38bdf8' },
  { p: [-0.5, 0.82, 0.5], color: '#818cf8' },
  { p: [0, 1.25, -0.5], color: '#c084fc' },
  { p: [0, 1.25, 0.5], color: '#f472b6' },
]

const HOUSE_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
  [4, 8], [5, 8], [6, 9], [7, 9],
  [8, 9],
]

const TARGET: V3 = [0, 0.6, 0]

const T = {
  en: {
    kicker: 'Module 1',
    title: 'The Pinhole Camera & the Camera Matrix',
    intro:
      'Every camera answers one question: which pixel does a 3D point land on? This module builds that answer step by step — from a ray of light through a pinhole to the famous 3×4 projection matrix P = K[R|t].',
    s1Title: 'From the world to an image',
    s1a: 'A camera maps points from the 3D world onto a 2D sensor. That mapping loses one dimension — depth — and everything in these modules revolves around describing, calibrating and finally inverting parts of this projection.',
    s1b: 'The full pipeline consists of two independent stages:',
    s1Steps: [
      ['World point', 'X_w = (X, Y, Z)'],
      ['Extrinsics [R|t]', 'rigid motion into the camera frame'],
      ['Projection ÷Z', 'perspective division onto the image plane'],
      ['Intrinsics K', 'from metric image plane to pixels'],
      ['Pixel', '(u, v)'],
    ],
    s2Title: 'The pinhole model',
    s2a: 'Imagine a lightproof box with an infinitely small hole. Every world point sends exactly one ray through that hole and marks one spot on the back wall — a perfectly sharp, inverted image. Real lenses only approximate this ideal, but the geometry is the same.',
    s2b: 'By similar triangles, a point at lateral offset X and depth Z (in the camera frame) hits the image plane at distance f behind the pinhole at:',
    s2c: 'In practice we use the virtual image plane in front of the pinhole — same geometry, but the image is upright. Note what the division by Z does: it is the entire reason far objects look small, and it is nonlinear. All depth information collapses.',
    diagram: {
      pinhole: 'pinhole',
      imagePlane: 'virtual image plane',
      sensor: 'sensor (inverted)',
      object: 'object',
      axis: 'optical axis',
    },
    s3Title: 'Interactive: projection lab',
    s3a: 'A camera observes a small house of colored points. The left view shows the 3D setup — the image plane is drawn at its true size given the intrinsics. The right view is the image the sensor actually records. Every slider immediately updates the matrices below.',
    s3Try: [
      'Increase the focal length f — the frustum narrows and the image zooms in (a telephoto lens).',
      'Move the principal point cx, cy — the whole image shifts, because it moves the sensor origin relative to the optical axis.',
      'Add skew s — the image shears. Modern sensors have s ≈ 0; it is kept in K mostly for historical generality.',
      'Orbit the camera (azimuth / elevation / distance) — only [R|t] changes, K stays fixed. Intrinsics belong to the camera, extrinsics to its pose.',
    ],
    labScene: '3D scene — drag to orbit, scroll to zoom',
    labImage: 'Sensor image (what the camera sees)',
    intrTitle: 'Intrinsics (camera-internal)',
    extrTitle: 'Extrinsics (camera pose)',
    focal: 'focal length f',
    aspect: 'aspect fy / fx',
    skew: 'skew s',
    ppx: 'principal point cx',
    ppy: 'principal point cy',
    az: 'azimuth',
    el: 'elevation',
    dist: 'distance',
    hfov: 'horizontal FOV',
    vfov: 'vertical FOV',
    matricesTitle: 'The matrices, live',
    matricesNote:
      'P projects homogeneous world points to homogeneous pixels: λ·(u,v,1)ᵀ = P·(X,Y,Z,1)ᵀ. The λ that gets divided away is exactly the depth in the camera frame.',
    s4Title: 'Anatomy of the intrinsic matrix K',
    s4a: 'K converts metric coordinates on the image plane into pixel coordinates. It contains everything that is internal to the camera — lens and sensor, independent of where the camera stands:',
    s4list: [
      'fx, fy — focal length in pixels: the metric focal length divided by the pixel size. fx ≠ fy iff pixels are not square.',
      'cx, cy — the principal point: the pixel where the optical axis pierces the sensor. Usually near the image center, rarely exactly.',
      's — skew between the pixel axes. For virtually all modern cameras s = 0.',
    ],
    s4b: 'A useful consequence: focal length and field of view are two views of the same thing.',
    s5Title: 'Extrinsics: where the camera stands',
    s5a: 'The extrinsic parameters are a rigid transform that expresses world points in the camera frame: rotation R (3×3, orthonormal, 3 degrees of freedom) and translation t (3 DoF). Note that t is not the camera position — the camera center is C = −Rᵀt.',
    s5b: 'The camera frame follows the computer-vision convention: x right, y down, z forward through the lens. That is why the y axis in pixel coordinates points downward.',
    s6Title: 'Putting it together: P = K[R|t]',
    s6a: 'Chaining both stages gives a single 3×4 matrix acting on homogeneous coordinates. Homogeneous coordinates are the trick that turns the nonlinear division by Z into linear algebra — the division is postponed to the very last step:',
    s6b: 'Count the degrees of freedom: 5 in K (or 4 with s = 0) + 3 rotation + 3 translation = 11 — matching a 3×4 matrix up to scale. Camera calibration (module 2) is precisely the task of estimating these numbers.',
    dofChips: ['K: 5 DoF', 'R: 3 DoF', 't: 3 DoF', 'P: 11 DoF (up to scale)'],
  },
  de: {
    kicker: 'Modul 1',
    title: 'Die Lochkamera & die Kameramatrix',
    intro:
      'Jede Kamera beantwortet eine Frage: Auf welchem Pixel landet ein 3D-Punkt? Dieses Modul baut die Antwort Schritt für Schritt auf — vom Lichtstrahl durch eine Lochblende bis zur berühmten 3×4-Projektionsmatrix P = K[R|t].',
    s1Title: 'Von der Welt zum Bild',
    s1a: 'Eine Kamera bildet Punkte der 3D-Welt auf einen 2D-Sensor ab. Dabei geht eine Dimension verloren — die Tiefe — und alles in diesen Modulen dreht sich darum, diese Projektion zu beschreiben, zu kalibrieren und teilweise wieder umzukehren.',
    s1b: 'Die gesamte Pipeline besteht aus zwei unabhängigen Stufen:',
    s1Steps: [
      ['Weltpunkt', 'X_w = (X, Y, Z)'],
      ['Extrinsik [R|t]', 'Starrkörpertransformation ins Kamerasystem'],
      ['Projektion ÷Z', 'perspektivische Division auf die Bildebene'],
      ['Intrinsik K', 'von der metrischen Bildebene zu Pixeln'],
      ['Pixel', '(u, v)'],
    ],
    s2Title: 'Das Lochkameramodell',
    s2a: 'Man stelle sich eine lichtdichte Box mit einem unendlich kleinen Loch vor. Jeder Weltpunkt schickt genau einen Strahl durch dieses Loch und markiert einen Punkt auf der Rückwand — ein perfekt scharfes, auf dem Kopf stehendes Bild. Echte Objektive nähern dieses Ideal nur an, die Geometrie ist aber dieselbe.',
    s2b: 'Über ähnliche Dreiecke trifft ein Punkt mit seitlichem Versatz X und Tiefe Z (im Kamerasystem) die Bildebene im Abstand f hinter der Lochblende bei:',
    s2c: 'In der Praxis rechnet man mit der virtuellen Bildebene vor der Lochblende — gleiche Geometrie, aber aufrechtes Bild. Wichtig ist, was die Division durch Z bewirkt: Sie ist der Grund, warum ferne Objekte klein erscheinen, und sie ist nichtlinear. Die gesamte Tiefeninformation kollabiert.',
    diagram: {
      pinhole: 'Lochblende',
      imagePlane: 'virtuelle Bildebene',
      sensor: 'Sensor (invertiert)',
      object: 'Objekt',
      axis: 'optische Achse',
    },
    s3Title: 'Interaktiv: Projektionslabor',
    s3a: 'Eine Kamera beobachtet ein kleines Haus aus farbigen Punkten. Links die 3D-Szene — die Bildebene ist in ihrer echten, durch die Intrinsik bestimmten Größe gezeichnet. Rechts das Bild, das der Sensor tatsächlich aufnimmt. Jeder Slider aktualisiert sofort die Matrizen darunter.',
    s3Try: [
      'Brennweite f erhöhen — das Frustum wird schmaler und das Bild zoomt hinein (Teleobjektiv).',
      'Hauptpunkt cx, cy verschieben — das ganze Bild wandert, weil sich der Sensorursprung relativ zur optischen Achse verschiebt.',
      'Scherung s hinzufügen — das Bild wird geschert. Moderne Sensoren haben s ≈ 0; der Parameter steht vor allem aus historischen Gründen in K.',
      'Kamera orbitieren (Azimut / Elevation / Abstand) — nur [R|t] ändert sich, K bleibt fest. Intrinsik gehört zur Kamera, Extrinsik zu ihrer Pose.',
    ],
    labScene: '3D-Szene — ziehen zum Orbiten, scrollen zum Zoomen',
    labImage: 'Sensorbild (was die Kamera sieht)',
    intrTitle: 'Intrinsik (kameraintern)',
    extrTitle: 'Extrinsik (Kamerapose)',
    focal: 'Brennweite f',
    aspect: 'Seitenverhältnis fy / fx',
    skew: 'Scherung s',
    ppx: 'Hauptpunkt cx',
    ppy: 'Hauptpunkt cy',
    az: 'Azimut',
    el: 'Elevation',
    dist: 'Abstand',
    hfov: 'horizontales Sichtfeld',
    vfov: 'vertikales Sichtfeld',
    matricesTitle: 'Die Matrizen, live',
    matricesNote:
      'P projiziert homogene Weltpunkte auf homogene Pixel: λ·(u,v,1)ᵀ = P·(X,Y,Z,1)ᵀ. Das λ, durch das dividiert wird, ist genau die Tiefe im Kamerasystem.',
    s4Title: 'Anatomie der intrinsischen Matrix K',
    s4a: 'K rechnet metrische Koordinaten der Bildebene in Pixelkoordinaten um. Sie enthält alles, was kameraintern ist — Objektiv und Sensor, unabhängig vom Standort der Kamera:',
    s4list: [
      'fx, fy — Brennweite in Pixeln: metrische Brennweite geteilt durch die Pixelgröße. fx ≠ fy genau dann, wenn die Pixel nicht quadratisch sind.',
      'cx, cy — der Hauptpunkt: das Pixel, in dem die optische Achse den Sensor durchstößt. Meist nahe der Bildmitte, selten exakt.',
      's — Scherung zwischen den Pixelachsen. Bei praktisch allen modernen Kameras ist s = 0.',
    ],
    s4b: 'Eine nützliche Konsequenz: Brennweite und Sichtfeld sind zwei Sichtweisen derselben Größe.',
    s5Title: 'Extrinsik: wo die Kamera steht',
    s5a: 'Die extrinsischen Parameter sind eine Starrkörpertransformation, die Weltpunkte im Kamerasystem ausdrückt: Rotation R (3×3, orthonormal, 3 Freiheitsgrade) und Translation t (3 FG). Achtung: t ist nicht die Kameraposition — das Kamerazentrum ist C = −Rᵀt.',
    s5b: 'Das Kamerasystem folgt der Computer-Vision-Konvention: x nach rechts, y nach unten, z nach vorn durchs Objektiv. Deshalb zeigt die y-Achse in Pixelkoordinaten nach unten.',
    s6Title: 'Alles zusammen: P = K[R|t]',
    s6a: 'Die Verkettung beider Stufen ergibt eine einzige 3×4-Matrix auf homogenen Koordinaten. Homogene Koordinaten sind der Trick, der die nichtlineare Division durch Z in lineare Algebra verwandelt — die Division wird auf den allerletzten Schritt verschoben:',
    s6b: 'Zählen wir die Freiheitsgrade: 5 in K (bzw. 4 mit s = 0) + 3 Rotation + 3 Translation = 11 — passend zu einer 3×4-Matrix bis auf Skalierung. Kamerakalibrierung (Modul 2) ist genau die Aufgabe, diese Zahlen zu schätzen.',
    dofChips: ['K: 5 FG', 'R: 3 FG', 't: 3 FG', 'P: 11 FG (bis auf Skalierung)'],
  },
}

function PinholeDiagram({ labels }: { labels: (typeof T)['en']['diagram'] }) {
  // side view: pinhole at x=200, virtual plane at x=320, object at x=480, sensor at x=80
  return (
    <svg viewBox="0 0 560 250" className="mx-auto my-4 w-full max-w-xl">
      <line x1={20} y1={140} x2={540} y2={140} stroke="rgba(255,255,255,0.25)" strokeDasharray="5 5" />
      <text x={538} y={132} fill="rgba(255,255,255,0.4)" fontSize={11} textAnchor="end">
        {labels.axis}
      </text>
      {/* pinhole wall */}
      <line x1={200} y1={60} x2={200} y2={133} stroke="#8b93a7" strokeWidth={3} />
      <line x1={200} y1={147} x2={200} y2={220} stroke="#8b93a7" strokeWidth={3} />
      <circle cx={200} cy={140} r={3.5} fill="#fbbf24" />
      <text x={200} y={238} fill="#fbbf24" fontSize={12} textAnchor="middle">
        {labels.pinhole}
      </text>
      {/* object */}
      <line x1={480} y1={140} x2={480} y2={44} stroke="#4ade80" strokeWidth={2.5} markerEnd="url(#arrG)" />
      <text x={490} y={40} fill="#4ade80" fontSize={12}>
        {labels.object}
      </text>
      {/* virtual image plane */}
      <line x1={320} y1={70} x2={320} y2={210} stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="4 3" />
      <line x1={320} y1={140} x2={320} y2={99} stroke="#22d3ee" strokeWidth={2.5} markerEnd="url(#arrC)" />
      <text x={320} y={62} fill="#22d3ee" fontSize={12} textAnchor="middle">
        {labels.imagePlane}
      </text>
      {/* sensor plane behind pinhole */}
      <line x1={80} y1={70} x2={80} y2={210} stroke="rgba(167,139,250,0.7)" strokeWidth={1.5} />
      <line x1={80} y1={140} x2={80} y2={183} stroke="#a78bfa" strokeWidth={2.5} markerEnd="url(#arrV)" />
      <text x={80} y={62} fill="#a78bfa" fontSize={12} textAnchor="middle">
        {labels.sensor}
      </text>
      {/* ray */}
      <line x1={480} y1={44} x2={80} y2={183} stroke="rgba(255,255,255,0.6)" strokeWidth={1.2} />
      {/* dimension annotations */}
      <g fill="rgba(255,255,255,0.55)" fontSize={12} fontFamily="JetBrains Mono, monospace">
        <line x1={200} y1={200} x2={320} y2={200} stroke="rgba(255,255,255,0.35)" markerEnd="url(#arrW)" markerStart="url(#arrW)" />
        <text x={260} y={194} textAnchor="middle">f</text>
        <line x1={200} y1={222} x2={480} y2={222} stroke="rgba(255,255,255,0.35)" markerEnd="url(#arrW)" markerStart="url(#arrW)" />
        <text x={340} y={216} textAnchor="middle">Z</text>
        <text x={496} y={96}>Y</text>
        <text x={328} y={122}>y</text>
      </g>
      <defs>
        <marker id="arrG" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,1 L7,4 L0,7 z" fill="#4ade80" />
        </marker>
        <marker id="arrC" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,1 L7,4 L0,7 z" fill="#22d3ee" />
        </marker>
        <marker id="arrV" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,1 L7,4 L0,7 z" fill="#a78bfa" />
        </marker>
        <marker id="arrW" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <circle cx="3" cy="3" r="1.2" fill="rgba(255,255,255,0.35)" />
        </marker>
      </defs>
    </svg>
  )
}

export function PinholePage() {
  const t = useT(T)

  const [f, setF] = useState(640)
  const [aspect, setAspect] = useState(1)
  const [skew, setSkew] = useState(0)
  const [cx, setCx] = useState(320)
  const [cy, setCy] = useState(240)
  const [azDeg, setAzDeg] = useState(35)
  const [elDeg, setElDeg] = useState(22)
  const [radius, setRadius] = useState(3.6)

  const k: Intrinsics = useMemo(
    () => ({ fx: f, fy: f * aspect, s: skew, cx, cy }),
    [f, aspect, skew, cx, cy],
  )

  const pose = useMemo(() => {
    const az = deg2rad(azDeg)
    const el = deg2rad(elDeg)
    const eye = add(TARGET, [
      radius * Math.cos(el) * Math.sin(az),
      radius * Math.sin(el),
      radius * Math.cos(el) * Math.cos(az),
    ])
    return lookAtCV(eye, TARGET)
  }, [azDeg, elDeg, radius])

  const projections = useMemo(
    () => HOUSE_PTS.map((hp) => ({ ...projectPoint(k, pose, hp.p), color: hp.color })),
    [k, pose],
  )

  const imagePoints: ImagePoint[] = projections
    .filter((p) => p.z > 0)
    .map((p) => ({ u: p.u, v: p.v, color: p.color }))

  const imageEdges = HOUSE_EDGES.flatMap(([a, b]) => {
    const pa = projections[a]
    const pb = projections[b]
    if (pa.z <= 0 || pb.z <= 0) return []
    return [
      {
        pts: [
          [pa.u, pa.v],
          [pb.u, pb.v],
        ] as [number, number][],
        color: 'rgba(255,255,255,0.25)',
        width: 1.2,
      },
    ]
  })

  const P = pMat(k, pose)
  const hfov = rad2deg(2 * Math.atan(W / (2 * k.fx)))
  const vfov = rad2deg(2 * Math.atan(H / (2 * k.fy)))

  const cyan = '#22d3ee'
  const violet = '#a78bfa'
  const amber = '#fbbf24'

  return (
    <div className="mx-auto max-w-6xl px-4">
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="pipeline" title={t.s1Title}>
        <div className="prose-cv max-w-3xl">
          <p>{t.s1a}</p>
          <p>{t.s1b}</p>
        </div>
        <div className="my-5 flex flex-wrap items-center gap-2">
          {t.s1Steps.map(([name, sub], i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="card px-3 py-2 text-center">
                <div className="text-[13px] font-semibold">{name}</div>
                <div className="font-mono text-[11px] text-muted">{sub}</div>
              </div>
              {i < t.s1Steps.length - 1 && <span className="text-accent">→</span>}
            </div>
          ))}
        </div>
      </Section>

      <Section id="pinhole" title={t.s2Title}>
        <div className="prose-cv max-w-3xl">
          <p>{t.s2a}</p>
        </div>
        <div className="card-pad my-4">
          <PinholeDiagram labels={t.diagram} />
        </div>
        <div className="prose-cv max-w-3xl">
          <p>{t.s2b}</p>
          <TeX block>{String.raw`x = f\,\frac{X}{Z}, \qquad y = f\,\frac{Y}{Z}`}</TeX>
          <p>{t.s2c}</p>
        </div>
      </Section>

      <Section id="lab" title={t.s3Title}>
        <div className="prose-cv max-w-3xl">
          <p>{t.s3a}</p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <Scene3D
            className="lg:col-span-3"
            height={440}
            camera={{ position: [4.2, 2.6, 5.2], fov: 40 }}
            target={[0.3, 0.7, 0.6]}
            hint={t.labScene}
          >
            {HOUSE_PTS.map((hp, i) => (
              <mesh key={i} position={hp.p}>
                <sphereGeometry args={[0.045, 20, 20]} />
                <meshStandardMaterial color={hp.color} />
              </mesh>
            ))}
            {HOUSE_EDGES.map(([a, b], i) => (
              <Polyline
                key={i}
                points={[HOUSE_PTS[a].p, HOUSE_PTS[b].p]}
                color="#ffffff"
                opacity={0.18}
                lineWidth={1}
              />
            ))}
            <AxesTriad pose={[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]} label="world" size={0.3} />
            <CameraFrustumViz k={k} w={W} h={H} pose={pose} depth={0.9} points={HOUSE_PTS} />
          </Scene3D>
          <div className="flex flex-col gap-4 lg:col-span-2">
            <ImageView
              title={t.labImage}
              points={imagePoints}
              polylines={imageEdges}
              principal={{ cx: k.cx, cy: k.cy }}
            />
            <div className="grid grid-cols-2 gap-3">
              <Readout label={t.hfov} value={fmt(hfov, 1)} unit="°" />
              <Readout label={t.vfov} value={fmt(vfov, 1)} unit="°" />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="card-pad">
            <h3 className="mb-4 text-sm font-bold tracking-wide text-accent uppercase">{t.intrTitle}</h3>
            <div className="space-y-4">
              <Slider label={t.focal} value={f} min={220} max={1400} step={5} onChange={setF} format={(v) => `${v} px`} />
              <Slider label={t.aspect} value={aspect} min={0.7} max={1.3} step={0.01} onChange={setAspect} format={(v) => fmt(v, 2)} />
              <Slider label={t.ppx} value={cx} min={0} max={W} step={2} onChange={setCx} format={(v) => `${v} px`} accent={amber} />
              <Slider label={t.ppy} value={cy} min={0} max={H} step={2} onChange={setCy} format={(v) => `${v} px`} accent={amber} />
              <Slider label={t.skew} value={skew} min={-300} max={300} step={5} onChange={setSkew} format={(v) => `${v}`} accent={violet} />
            </div>
          </div>
          <div className="card-pad">
            <h3 className="mb-4 text-sm font-bold tracking-wide text-accent2 uppercase">{t.extrTitle}</h3>
            <div className="space-y-4">
              <Slider label={t.az} value={azDeg} min={-180} max={180} step={1} onChange={setAzDeg} format={(v) => `${v}°`} accent="#a78bfa" />
              <Slider label={t.el} value={elDeg} min={4} max={75} step={1} onChange={setElDeg} format={(v) => `${v}°`} accent="#a78bfa" />
              <Slider label={t.dist} value={radius} min={2.2} max={7} step={0.05} onChange={setRadius} format={(v) => `${fmt(v, 2)} m`} accent="#a78bfa" />
            </div>
          </div>
        </div>

        <div className="card-pad mt-4">
          <h3 className="mb-3 text-sm font-bold tracking-wide text-muted uppercase">{t.matricesTitle}</h3>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <MatrixView
              label={<TeX>{String.raw`K =`}</TeX>}
              values={[
                [k.fx, k.s, k.cx],
                [0, k.fy, k.cy],
                [0, 0, 1],
              ]}
              digits={0}
              highlight={{
                '0,0': cyan,
                '1,1': cyan,
                '0,1': violet,
                '0,2': amber,
                '1,2': amber,
              }}
            />
            <MatrixView
              label={<TeX>{String.raw`[\,R \mid t\,] =`}</TeX>}
              values={[
                [pose.R[0], pose.R[1], pose.R[2], pose.t[0]],
                [pose.R[3], pose.R[4], pose.R[5], pose.t[1]],
                [pose.R[6], pose.R[7], pose.R[8], pose.t[2]],
              ]}
              digits={2}
            />
            <MatrixView
              label={<TeX>{String.raw`P = K[R|t] =`}</TeX>}
              values={[
                [P[0], P[1], P[2], P[3]],
                [P[4], P[5], P[6], P[7]],
                [P[8], P[9], P[10], P[11]],
              ]}
              digits={0}
            />
          </div>
          <p className="mt-3 text-[13px] text-muted">{t.matricesNote}</p>
        </div>

        <InfoBox title="⚡ Try it">
          <ul className="my-1 list-disc space-y-1 pl-5">
            {t.s3Try.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </InfoBox>
      </Section>

      <Section id="intrinsics" title={t.s4Title}>
        <div className="prose-cv max-w-3xl">
          <p>{t.s4a}</p>
          <TeX block>{String.raw`K = \begin{bmatrix} \textcolor{#22d3ee}{f_x} & \textcolor{#a78bfa}{s} & \textcolor{#fbbf24}{c_x} \\ 0 & \textcolor{#22d3ee}{f_y} & \textcolor{#fbbf24}{c_y} \\ 0 & 0 & 1 \end{bmatrix}`}</TeX>
          <ul>
            {t.s4list.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p>{t.s4b}</p>
          <TeX block>{String.raw`\text{FOV}_x = 2\arctan\!\frac{W}{2 f_x}, \qquad \text{FOV}_y = 2\arctan\!\frac{H}{2 f_y}`}</TeX>
        </div>
      </Section>

      <Section id="extrinsics" title={t.s5Title}>
        <div className="prose-cv max-w-3xl">
          <p>{t.s5a}</p>
          <TeX block>{String.raw`\mathbf{x}_c = R\,\mathbf{X}_w + \mathbf{t}, \qquad C = -R^{\mathsf T}\mathbf{t}`}</TeX>
          <p>{t.s5b}</p>
        </div>
      </Section>

      <Section id="projection-matrix" title={t.s6Title}>
        <div className="prose-cv max-w-3xl">
          <p>{t.s6a}</p>
          <TeX block>{String.raw`\lambda \begin{bmatrix} u \\ v \\ 1 \end{bmatrix} = \underbrace{K \begin{bmatrix} R \mid \mathbf{t} \end{bmatrix}}_{P\;(3\times4)} \begin{bmatrix} X \\ Y \\ Z \\ 1 \end{bmatrix}, \qquad \lambda = Z_{\text{cam}}`}</TeX>
          <p>{t.s6b}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {t.dofChips.map((c, i) => (
              <span key={i} className="chip">
                {c}
              </span>
            ))}
          </div>
        </div>
      </Section>
    </div>
  )
}
