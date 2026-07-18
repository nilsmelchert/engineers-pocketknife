import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { PageToc } from '../components/PageToc'
import { ImageView } from '../components/ImageView'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import { CameraFrustumViz, Polyline, Quad, Scene3D } from '../components/three/helpers'
import { deg2rad, fmt, lookAtCV, mulberry32, projectPoint, type Intrinsics, type V3 } from '../lib/math'
import { phaseFromShifts, unwrap1d } from '../lib/signal'

const T = {
  en: {
    kicker: 'Metrology · Module 2',
    title: '3D Optical Metrology',
    intro:
      'How do you measure a turbine blade to micrometers, a car body to tenths of a millimeter, a mirror to nanometers — without touching them? With light, three different ways. Laser-line triangulation and fringe projection are the calibrated camera of the Vision track put to metrological work; interferometry swaps the camera model for an even better ruler: the wavelength of light itself.',
    laserTitle: 'Interactive: laser-line triangulation',
    laser1: 'A laser fans into a sheet of light and paints a line across the part. A camera — calibrated, of course — looks at that line from an angle: wherever the surface is higher, the line appears shifted in the image. Since laser plane and camera geometry are known, every bent pixel of the line converts to a 3D point. Raise the step height and watch the line break in the camera view; press "scan" to sweep the part and collect a full 3D profile cloud, exactly like industrial sheet-of-light scanners on conveyor belts.',
    laser2: 'The triangulation angle is the fundamental trade-off knob: a steeper angle shifts the line more per millimeter of height (better resolution) but shadows more of the part (occlusion) — the same geometry lesson as the stereo baseline in the Vision track.',
    stepH: 'step height',
    angle: 'triangulation angle',
    scanPos: 'scan position',
    scanBtn: 'Scan the part',
    scanStop: 'Stop',
    clearCloud: 'Clear cloud',
    sens: 'sensitivity',
    camView: 'camera image — the bent laser line',
    scene: '3D scene — drag to orbit',
    cloudPts: 'cloud points',
    fringeTitle: 'Interactive: fringe projection (structured light)',
    fringe1: 'Instead of one line, project a whole family of sinusoidal stripes and photograph how the surface bends them. The elegant part is how the deformation is decoded: project the pattern four times, shifted by 90° each, and the arctangent of the four intensities returns the phase at every pixel — sub-fringe accurate, robust against surface brightness. The phase comes out wrapped into (−π, π]; unwrapping stitches the sawtooth into a continuous map, and subtracting the flat-reference carrier leaves pure height.',
    fringe2: 'Step through the four shifts and follow the pipeline below: wrapped sawtooth → unwrapped phase → height profile. Higher fringe frequency measures finer detail but wraps more often — push it up with noise and the unwrapping eventually fails: the classic ambiguity that multi-frequency (hierarchical) codes resolve in practice.',
    shift: 'phase shift',
    freq: 'fringe frequency',
    noise: 'camera noise',
    fringeImg: 'camera image — fringes on the dome',
    wrappedImg: 'wrapped phase φw',
    profile: 'center row: wrapped phase → reconstructed height (amber) vs. truth (dashed)',
    interTitle: 'Interactive: interferometry — measuring with the wavelength',
    inter1: 'Split a laser beam, bounce one half off a reference mirror and the other off the measurement mirror, recombine: the two waves interfere. Move the measurement mirror by half a wavelength and the pattern cycles through one full fringe — bright, dark, bright. Counting fringes therefore measures displacement in units of λ/2 ≈ 316 nm (HeNe), and interpolating within a fringe reaches single nanometers. Slide the mirror displacement — at the nanometer scale — and watch the bull’s-eye breathe.',
    disp: 'mirror displacement',
    lambda: 'wavelength λ',
    fringeCount: 'fringes passed (2Δ/λ)',
    perFringe: 'one fringe =',
    inter2: 'The price of this staggering resolution: it only measures changes (you count fringes, you do not read absolute distance), it needs optically smooth surfaces, and vibrations of a fraction of a micrometer wreck the pattern — which is why interferometers live on damped optical tables.',
    compTitle: 'Choosing the method',
    compHead: ['method', 'typical range', 'resolution', 'requirements'],
    compRows: [
      ['laser-line triangulation', 'mm … m', '≈ 5–100 µm', 'diffuse surface; profile-by-profile (fast on moving parts)'],
      ['fringe projection', 'cm … m fields', '≈ 1–50 µm', 'diffuse surface; full-field snapshot; static during capture'],
      ['interferometry', 'nm … mm', '≈ 0.1–10 nm', 'optically smooth; vibration isolation; measures change'],
    ],
    calibTitle: 'It all stands on calibration',
    calibList: [
      'Laser triangulation = the Vision track literally: a calibrated camera (module 2) plus a calibrated laser plane; every image point is intersected with that plane — triangulation with one camera replaced by a light source.',
      'Fringe projection treats the projector as an inverse camera: it gets its own intrinsics and pose, calibrated with the very same checkerboard machinery. Phase ↔ projector column takes the role of the second image in stereo.',
      'Interferometry needs no camera model — its ruler is λ, traceable to the definition of the meter. That is why it sits at the top of the calibration chain from the Measurement Theory module, calibrating the very gauges that calibrate everything else.',
      'And every one of these instruments reports its result the metrologist’s way: value ± uncertainty, budgeted exactly as in the previous module.',
    ],
  },
  de: {
    kicker: 'Messtechnik · Modul 2',
    title: 'Optische 3D-Messtechnik',
    intro:
      'Wie vermisst man eine Turbinenschaufel auf Mikrometer, eine Karosserie auf Zehntelmillimeter, einen Spiegel auf Nanometer — ohne sie zu berühren? Mit Licht, auf drei verschiedene Arten. Laserlinien-Triangulation und Streifenprojektion sind die kalibrierte Kamera des Vision-Tracks bei metrologischer Arbeit; die Interferometrie ersetzt das Kameramodell durch ein noch besseres Lineal: die Wellenlänge des Lichts selbst.',
    laserTitle: 'Interaktiv: Laserlinien-Triangulation',
    laser1: 'Ein Laser wird zu einem Lichtblatt aufgefächert und malt eine Linie über das Bauteil. Eine — natürlich kalibrierte — Kamera blickt aus einem Winkel auf diese Linie: Wo die Oberfläche höher ist, erscheint die Linie im Bild verschoben. Da Laserebene und Kamerageometrie bekannt sind, wird jedes gebogene Pixel der Linie zu einem 3D-Punkt. Erhöhe die Stufenhöhe und beobachte den Sprung der Linie im Kamerabild; drücke „Scannen“, um das Teil zu überstreichen und eine volle 3D-Profilwolke zu sammeln — genau wie industrielle Lichtschnittsensoren am Förderband.',
    laser2: 'Der Triangulationswinkel ist der fundamentale Kompromissknopf: Ein steilerer Winkel verschiebt die Linie stärker pro Millimeter Höhe (bessere Auflösung), wirft aber mehr Schatten (Abschattung) — dieselbe Geometrielektion wie die Stereo-Basislinie im Vision-Track.',
    stepH: 'Stufenhöhe',
    angle: 'Triangulationswinkel',
    scanPos: 'Scanposition',
    scanBtn: 'Teil scannen',
    scanStop: 'Stopp',
    clearCloud: 'Wolke löschen',
    sens: 'Empfindlichkeit',
    camView: 'Kamerabild — die gebogene Laserlinie',
    scene: '3D-Szene — ziehen zum Orbiten',
    cloudPts: 'Wolkenpunkte',
    fringeTitle: 'Interaktiv: Streifenprojektion (strukturiertes Licht)',
    fringe1: 'Statt einer Linie projiziert man eine ganze Familie sinusförmiger Streifen und fotografiert, wie die Oberfläche sie verbiegt. Elegant ist die Dekodierung der Verformung: Man projiziert das Muster viermal, jeweils um 90° verschoben, und der Arkustangens der vier Intensitäten liefert die Phase an jedem Pixel — sub-streifengenau, robust gegen Oberflächenhelligkeit. Die Phase kommt in (−π, π] eingewickelt heraus; das Unwrapping näht den Sägezahn zu einer stetigen Karte zusammen, und das Abziehen des ebenen Referenzträgers lässt reine Höhe übrig.',
    fringe2: 'Schalte durch die vier Verschiebungen und folge der Pipeline unten: eingewickelter Sägezahn → entfaltete Phase → Höhenprofil. Höhere Streifenfrequenz misst feinere Details, wickelt aber öfter — treibe sie zusammen mit dem Rauschen hoch, und das Unwrapping versagt irgendwann: die klassische Mehrdeutigkeit, die in der Praxis Mehrfrequenz-Codes auflösen.',
    shift: 'Phasenschub',
    freq: 'Streifenfrequenz',
    noise: 'Kamerarauschen',
    fringeImg: 'Kamerabild — Streifen auf der Kuppel',
    wrappedImg: 'eingewickelte Phase φw',
    profile: 'Mittelzeile: eingewickelte Phase → rekonstruierte Höhe (bernstein) vs. Wahrheit (gestrichelt)',
    interTitle: 'Interaktiv: Interferometrie — Messen mit der Wellenlänge',
    inter1: 'Teile einen Laserstrahl, wirf eine Hälfte auf einen Referenzspiegel und die andere auf den Messspiegel, führe beide zusammen: Die Wellen interferieren. Bewege den Messspiegel um eine halbe Wellenlänge, und das Muster durchläuft genau einen Streifen — hell, dunkel, hell. Streifen zählen misst also Verschiebung in Einheiten von λ/2 ≈ 316 nm (HeNe), und die Interpolation innerhalb eines Streifens erreicht einzelne Nanometer. Schiebe die Spiegelverschiebung — auf der Nanometerskala — und sieh das Ringmuster atmen.',
    disp: 'Spiegelverschiebung',
    lambda: 'Wellenlänge λ',
    fringeCount: 'durchlaufene Streifen (2Δ/λ)',
    perFringe: 'ein Streifen =',
    inter2: 'Der Preis dieser atemberaubenden Auflösung: Sie misst nur Änderungen (man zählt Streifen, liest keine absolute Distanz), braucht optisch glatte Oberflächen, und Vibrationen von Bruchteilen eines Mikrometers zerstören das Muster — weshalb Interferometer auf gedämpften optischen Tischen wohnen.',
    compTitle: 'Die Methodenwahl',
    compHead: ['Methode', 'typischer Bereich', 'Auflösung', 'Voraussetzungen'],
    compRows: [
      ['Laserlinien-Triangulation', 'mm … m', '≈ 5–100 µm', 'diffuse Oberfläche; Profil für Profil (schnell auf bewegten Teilen)'],
      ['Streifenprojektion', 'cm … m Felder', '≈ 1–50 µm', 'diffuse Oberfläche; Vollfeld-Aufnahme; statisch während der Messung'],
      ['Interferometrie', 'nm … mm', '≈ 0,1–10 nm', 'optisch glatt; Schwingungsisolierung; misst Änderungen'],
    ],
    calibTitle: 'Alles steht auf Kalibrierung',
    calibList: [
      'Lasertriangulation = der Vision-Track wörtlich: eine kalibrierte Kamera (Modul 2) plus eine kalibrierte Laserebene; jeder Bildpunkt wird mit dieser Ebene geschnitten — Triangulation, bei der eine Kamera durch eine Lichtquelle ersetzt ist.',
      'Die Streifenprojektion behandelt den Projektor als inverse Kamera: Er bekommt eigene Intrinsik und Pose, kalibriert mit exakt derselben Schachbrett-Maschinerie. Phase ↔ Projektorspalte übernimmt die Rolle des zweiten Bildes im Stereo.',
      'Die Interferometrie braucht kein Kameramodell — ihr Lineal ist λ, rückführbar auf die Definition des Meters. Deshalb sitzt sie an der Spitze der Kalibrierkette aus dem Messtheorie-Modul und kalibriert genau die Normale, die alles andere kalibrieren.',
      'Und jedes dieser Instrumente berichtet sein Ergebnis nach Art der Metrologen: Wert ± Unsicherheit, budgetiert exakt wie im vorigen Modul.',
    ],
  },
}

// ---------------------------------------------------------------- laser-line lab

const LASER_K: Intrinsics = { fx: 650, fy: 650, s: 0, cx: 320, cy: 240 }
const IW = 640
const IH = 480
const FOOT_X = 0.35
const FOOT_Z = 0.22
const H1 = 0.05

function objectHeight(x: number, z: number, h2: number): number {
  if (Math.abs(x) > FOOT_X || Math.abs(z) > FOOT_Z) return 0
  return x < 0 ? H1 : h2
}

function LaserLab() {
  const t = useT(T)
  const [h2, setH2] = useState(0.12)
  const [angle, setAngle] = useState(35)
  const [scanZ, setScanZ] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [cloud, setCloud] = useState<V3[]>([])
  const scanRef = useRef({ z: -FOOT_Z, cloud: [] as V3[] })

  const pose = useMemo(() => {
    const th = deg2rad(angle)
    const D = 0.55
    return lookAtCV([0, 0.05 + D * Math.cos(th), scanZ + D * Math.sin(th)], [0, 0.05, scanZ])
  }, [angle, scanZ])

  const linePts = useMemo(
    () =>
      Array.from({ length: 37 }, (_, i) => {
        const x = -0.45 + (i / 36) * 0.9
        return [x, objectHeight(x, scanZ, h2) + 0.003, scanZ] as V3
      }),
    [scanZ, h2],
  )

  const imgLine = useMemo(
    () =>
      linePts
        .map((p) => projectPoint(LASER_K, pose, p))
        .filter((p) => p.z > 0)
        .map((p) => [p.u, p.v] as [number, number]),
    [linePts, pose],
  )

  // sensitivity: image shift per mm of height at the line center
  const sens = useMemo(() => {
    const p1 = projectPoint(LASER_K, pose, [0.1, H1, scanZ])
    const p2 = projectPoint(LASER_K, pose, [0.1, H1 + 0.001, scanZ])
    return Math.hypot(p2.u - p1.u, p2.v - p1.v)
  }, [pose, scanZ])

  useEffect(() => {
    if (!scanning) return
    scanRef.current = { z: -FOOT_Z, cloud: [...cloud] }
    const iv = setInterval(() => {
      const st = scanRef.current
      st.z += 0.011
      if (st.z > FOOT_Z) {
        setScanning(false)
        return
      }
      for (let i = 0; i < 11; i++) {
        const x = -0.42 + (i / 10) * 0.84
        st.cloud.push([x, objectHeight(x, st.z, h2) + 0.004, st.z])
      }
      setScanZ(st.z)
      setCloud([...st.cloud])
    }, 60)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning])

  const sheet: V3[] = [
    [-0.45, 0, scanZ],
    [0.45, 0, scanZ],
    [0.45, 0.42, scanZ],
    [-0.45, 0.42, scanZ],
  ]

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Scene3D
          className="lg:col-span-3"
          height={440}
          camera={{ position: [0.9, 0.75, -0.95], fov: 42 }}
          target={[0, 0.08, 0]}
          hint={t.scene}
        >
          {/* part: two boxes forming a step */}
          <mesh position={[-FOOT_X / 2, H1 / 2, 0]}>
            <boxGeometry args={[FOOT_X, H1, 2 * FOOT_Z]} />
            <meshStandardMaterial color="#3b4763" roughness={0.7} />
          </mesh>
          <mesh position={[FOOT_X / 2, h2 / 2, 0]}>
            <boxGeometry args={[FOOT_X, h2, 2 * FOOT_Z]} />
            <meshStandardMaterial color="#4a5878" roughness={0.7} />
          </mesh>
          {/* laser emitter + sheet + line */}
          <mesh position={[0, 0.47, scanZ]}>
            <boxGeometry args={[0.9, 0.05, 0.03]} />
            <meshStandardMaterial color="#28334a" metalness={0.4} roughness={0.4} />
          </mesh>
          <Quad corners={sheet} color="#ff5555" opacity={0.1} />
          <Polyline points={linePts} color="#ff4d4d" lineWidth={3.5} />
          {/* accumulated cloud */}
          {cloud.map((p, i) => (
            <mesh key={i} position={p}>
              <sphereGeometry args={[0.0045, 6, 6]} />
              <meshBasicMaterial color="#4ade80" />
            </mesh>
          ))}
          <CameraFrustumViz k={LASER_K} w={IW} h={IH} pose={pose} depth={0.16} color="#22d3ee" label="cam" rays={false} />
        </Scene3D>
        <div className="flex flex-col gap-4 lg:col-span-2">
          <ImageView
            title={t.camView}
            w={IW}
            h={IH}
            polylines={[{ pts: imgLine, color: '#ff5555', width: 3 }]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Readout label={t.sens} value={fmt(sens, 1)} unit="px/mm" accent="#22d3ee" />
            <Readout label={t.cloudPts} value={`${cloud.length}`} accent="#4ade80" />
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.stepH} value={h2} min={0.02} max={0.2} step={0.002} onChange={setH2} format={(v) => `${fmt(v * 1000, 0)} mm`} />
          <Slider label={t.angle} value={angle} min={15} max={65} step={1} onChange={setAngle} format={(v) => `${v}°`} accent="#a78bfa" />
          <Slider label={t.scanPos} value={scanZ} min={-FOOT_Z} max={FOOT_Z} step={0.005} onChange={setScanZ} format={(v) => `${fmt(v * 100, 1)} cm`} accent="#f87171" />
        </div>
        <div className="card-pad flex flex-wrap items-start gap-2">
          <button className="btn-primary" onClick={() => setScanning(!scanning)}>
            {scanning ? `⏸ ${t.scanStop}` : `📡 ${t.scanBtn}`}
          </button>
          <button className="btn" onClick={() => { setCloud([]); setScanning(false) }}>
            🗑 {t.clearCloud}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- fringe projection lab

const FW = 260
const FH = 190
const KH = 26 // phase (rad) per unit height
const DOME = (x: number, y: number): number => {
  const r2 = ((x - FW / 2) / (FW * 0.32)) ** 2 + ((y - FH / 2) / (FH * 0.36)) ** 2
  return r2 < 1 ? Math.pow(1 - r2, 1.5) : 0
}

function FringeLab() {
  const t = useT(T)
  const [shiftIdx, setShiftIdx] = useState(0)
  const [freq, setFreq] = useState(11)
  const [noise, setNoise] = useState(0.02)
  const fringeRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLCanvasElement>(null)

  // 4 phase-shifted images (rows only computed for canvas + center row for profile)
  const frames = useMemo(() => {
    const rand = mulberry32(Math.round(freq * 100 + noise * 10000))
    const mk = (s: number) => {
      const img = new Float32Array(FW * FH)
      for (let y = 0; y < FH; y++)
        for (let x = 0; x < FW; x++) {
          const phi = (2 * Math.PI * freq * x) / FW + (s * Math.PI) / 2 + KH * DOME(x, y)
          img[y * FW + x] = 0.5 + 0.45 * Math.cos(phi) + (rand() - 0.5) * 2 * noise
        }
      return img
    }
    return [mk(0), mk(1), mk(2), mk(3)]
  }, [freq, noise])

  const wrapped = useMemo(() => {
    const w = new Float32Array(FW * FH)
    for (let i = 0; i < FW * FH; i++)
      w[i] = phaseFromShifts(frames[0][i], frames[1][i], frames[2][i], frames[3][i])
    return w
  }, [frames])

  useEffect(() => {
    const ctx = fringeRef.current?.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(FW, FH)
    const f = frames[shiftIdx]
    for (let i = 0; i < FW * FH; i++) {
      const v = Math.round(Math.min(1, Math.max(0, f[i])) * 255)
      img.data[i * 4] = v
      img.data[i * 4 + 1] = v
      img.data[i * 4 + 2] = Math.round(v * 0.75)
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [frames, shiftIdx])

  useEffect(() => {
    const ctx = wrapRef.current?.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(FW, FH)
    for (let i = 0; i < FW * FH; i++) {
      const v = Math.round(((wrapped[i] + Math.PI) / (2 * Math.PI)) * 255)
      img.data[i * 4] = Math.round(v * 0.35)
      img.data[i * 4 + 1] = Math.round(v * 0.85)
      img.data[i * 4 + 2] = v
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [wrapped])

  // center-row pipeline
  const { rowWrapped, height, truth } = useMemo(() => {
    const y = Math.floor(FH / 2)
    const rowWrapped = Array.from({ length: FW }, (_, x) => wrapped[y * FW + x])
    const un = unwrap1d(rowWrapped)
    const carrier = Array.from({ length: FW }, (_, x) => (2 * Math.PI * freq * x) / FW)
    // align offset using the flat border region (first 8 px)
    let off = 0
    for (let x = 0; x < 8; x++) off += un[x] - carrier[x]
    off /= 8
    const height = un.map((v, x) => (v - carrier[x] - off) / KH)
    const truth = Array.from({ length: FW }, (_, x) => DOME(x, y))
    return { rowWrapped, height, truth }
  }, [wrapped, freq])

  const PW = 540
  const PH = 240
  const px = (x: number) => (x / (FW - 1)) * PW
  const pyW = (v: number) => 60 - (v / Math.PI) * 45
  const pyH = (v: number) => PH - 18 - v * 95

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="card overflow-hidden">
          <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">
            {t.fringeImg}
          </div>
          <canvas ref={fringeRef} width={FW} height={FH} className="block w-full" />
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">
            {t.wrappedImg}
          </div>
          <canvas ref={wrapRef} width={FW} height={FH} className="block w-full" />
        </div>
        <div className="card-pad space-y-3.5 self-start md:col-span-2 lg:col-span-1">
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-muted">{t.shift}</div>
            <Segmented<'0' | '1' | '2' | '3'>
              options={['0°', '90°', '180°', '270°'].map((l, i) => ({ value: `${i}` as '0', label: l }))}
              value={`${shiftIdx}` as '0'}
              onChange={(v) => setShiftIdx(Number(v))}
            />
          </div>
          <Slider label={t.freq} value={freq} min={5} max={26} step={1} onChange={setFreq} format={(v) => `${v}`} />
          <Slider label={t.noise} value={noise} min={0} max={0.09} step={0.005} onChange={setNoise} format={(v) => fmt(v, 3)} accent="#f87171" />
        </div>
      </div>
      <div className="card mt-4 overflow-hidden">
        <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.profile}</div>
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          {/* wrapped sawtooth */}
          <polyline
            points={rowWrapped.map((v, x) => `${px(x)},${pyW(v)}`).join(' ')}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={1.6}
          />
          <line x1={0} y1={118} x2={PW} y2={118} stroke="rgba(255,255,255,0.12)" />
          {/* reconstructed height vs truth */}
          <polyline
            points={truth.map((v, x) => `${px(x)},${pyH(v)}`).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <polyline
            points={height.map((v, x) => `${px(x)},${pyH(Math.min(Math.max(v, -0.3), 1.4))}`).join(' ')}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={2.2}
          />
        </svg>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- interferometry lab

const IN = 220

function InterferometryLab() {
  const t = useT(T)
  const [disp, setDisp] = useState(300)
  const [lambda, setLambda] = useState(633)
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(IN, IN)
    const phase0 = (4 * Math.PI * disp) / lambda
    for (let y = 0; y < IN; y++)
      for (let x = 0; x < IN; x++) {
        const r2 = ((x - IN / 2) ** 2 + (y - IN / 2) ** 2) / ((IN / 2) ** 2)
        const I = 0.5 + 0.5 * Math.cos(phase0 + r2 * 7 * Math.PI)
        const p = (y * IN + x) * 4
        const hue = lambda < 500 ? [0.35, 0.55, 1] : lambda < 580 ? [0.35, 1, 0.4] : [1, 0.28, 0.24]
        img.data[p] = Math.round(I * 255 * hue[0])
        img.data[p + 1] = Math.round(I * 255 * hue[1])
        img.data[p + 2] = Math.round(I * 255 * hue[2])
        img.data[p + 3] = 255
      }
    ctx.putImageData(img, 0, 0)
  }, [disp, lambda])

  const fringes = (2 * disp) / lambda

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden p-3 lg:col-span-2">
        <canvas ref={ref} width={IN} height={IN} className="mx-auto block w-full max-w-xs rounded-full" />
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-3">
        <div className="card-pad space-y-3.5">
          <Slider label={t.disp} value={disp} min={0} max={2000} step={1} onChange={setDisp} format={(v) => `${v} nm`} accent="#f87171" />
          <Slider label={t.lambda} value={lambda} min={450} max={650} step={1} onChange={setLambda} format={(v) => `${v} nm`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.fringeCount} value={fmt(fringes, 2)} accent="#fbbf24" />
          <Readout label={t.perFringe} value={fmt(lambda / 2, 0)} unit="nm" accent="#4ade80" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function Metrology3dPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'laser', label: t.laserTitle },
          { id: 'fringe', label: t.fringeTitle },
          { id: 'interferometry', label: t.interTitle },
          { id: 'compare', label: t.compTitle },
          { id: 'calibration', label: t.calibTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="laser" title={t.laserTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.laser1}</p>
        </div>
        <div className="mt-4">
          <LaserLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.laser2}
        </InfoBox>
      </Section>

      <Section id="fringe" title={t.fringeTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.fringe1}</p>
          <p>{t.fringe2}</p>
        </div>
        <div className="mt-4">
          <FringeLab />
        </div>
      </Section>

      <Section id="interferometry" title={t.interTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.inter1}</p>
        </div>
        <div className="mt-4">
          <InterferometryLab />
        </div>
        <InfoBox tone="warn">{t.inter2}</InfoBox>
      </Section>

      <Section id="compare" title={t.compTitle}>
        <div className="card max-w-4xl overflow-hidden">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-muted">
                {t.compHead.map((h, i) => (
                  <th key={i} className="px-3.5 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.compRows.map((row, i) => (
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
      </Section>

      <Section id="calibration" title={t.calibTitle}>
        <div className="prose-cv max-w-3xl">
          <ul>
            {t.calibList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  )
}
