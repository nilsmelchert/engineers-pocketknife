import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import { fmt, mulberry32 } from '../lib/math'
import {
  assignClusters,
  blobs,
  kmeansRun,
  kppInit,
  moons,
  randomInit,
  rings,
  uniform2D,
  updateCentroids,
  wcss,
  type P2,
} from '../lib/stats'

const CLUSTER_COLORS = ['#22d3ee', '#a78bfa', '#4ade80', '#fbbf24', '#f87171', '#38bdf8']

const T = {
  en: {
    kicker: 'Data · Module 2',
    title: 'K-Means Clustering',
    intro:
      'PCA found directions; clustering finds groups. K-means is the workhorse of unsupervised grouping: given only points and a number k, it carves the data into k clusters - no labels, no teacher. It is beautifully simple, surprisingly subtle, and it fails in instructive ways.',
    ideaTitle: 'Grouping without labels',
    idea1: 'The algorithm needs just two alternating moves, each one embarrassingly intuitive:',
    ideaList: [
      'Assign: give every point to its nearest centroid (the colored ✕).',
      'Update: move every centroid to the mean of the points it owns.',
    ],
    idea2: 'Repeat until nothing changes. That is Lloyd’s algorithm, published in 1957 and still everywhere - image compression, customer segmentation, vector quantization, initializing fancier models.',
    labTitle: 'Interactive: Lloyd’s algorithm step by step',
    lab1: 'Pick a dataset and press the phases yourself: Assign colors the points, Move shifts each ✕ to its cluster mean (trails show the paths). Watch the objective - the summed squared distance WCSS - drop with every phase and freeze when the algorithm converges.',
    dsNames: { blobs: '3 blobs', blobs4: '4 blobs', moons: 'moons', rings: 'rings', uniform: 'uniform' },
    kLabel: 'clusters k',
    initLabel: 'initialization',
    initNames: ['random points', 'k-means++'],
    assignBtn: 'Assign',
    updateBtn: 'Move centroids',
    stepBtn: 'Full step',
    runBtn: 'Run',
    pauseBtn: 'Pause',
    reinitBtn: 'Re-initialize',
    unluckyBtn: 'Unlucky init',
    converged: 'converged',
    iter: 'iterations',
    wcssLabel: 'objective (WCSS)',
    labTry: [
      'Step through 3 blobs manually: usually 3-5 iterations to convergence. The Voronoi shading shows each centroid’s territory.',
      'Press "Unlucky init": all centroids start inside one blob - k-means converges, but to a visibly wrong local minimum. The WCSS is higher, and no further step can fix it.',
      'Compare random vs. k-means++ over several re-initializations: k-means++ spreads the seeds and lands in the good solution far more often.',
    ],
    initTitle: 'Initialization decides the ending',
    init1: 'Lloyd’s algorithm is a descent method: every phase provably lowers (or keeps) the WCSS - assign is optimal for fixed centroids, update is optimal for fixed assignments. This is exactly the alternating (coordinate) descent pattern from the optimization modules, applied to a nonconvex objective. And as always with descent on nonconvex landscapes: it stops at the nearest local minimum. Where you start decides where you end.',
    init2: 'k-means++ (2007) fixes most of it with one clever idea: pick seeds one by one, each new one with probability proportional to its squared distance from the nearest existing seed. Spread-out seeds → good basins. It is the default in every serious library, and in practice you additionally restart a few times and keep the best result (n_init in scikit-learn).',
    elbowTitle: 'Interactive: choosing k - the elbow',
    elbow1: 'K-means never complains about a wrong k: it will happily split one blob or merge two. The classic diagnostic runs k-means for every k and plots the final WCSS. Adding a cluster always lowers the objective - but after the true number of groups, the improvement collapses: the curve bends like an elbow. On the 3-blob dataset the bend at k = 3 is unmistakable; on uniform noise there is no elbow, because there are no clusters.',
    elbowK: 'k in the lab above',
    failTitle: 'Where k-means fails - and what to reach for',
    fail1: 'The assign step draws straight Voronoi walls, so k-means can only ever produce convex, roughly ball-shaped clusters of similar size. Switch the lab to moons or rings and watch it slice straight through the obvious structure - the algorithm converges happily, the WCSS is fine, the answer is wrong.',
    failList: [
      'Elongated or curved clusters (moons, rings): the metric is wrong, not the optimizer. Use density-based clustering (DBSCAN) or spectral clustering.',
      'Clusters of very different sizes/densities: k-means steals points from big sparse clusters for small dense ones. Gaussian mixture models (GMM) with full covariances handle this.',
      'Unknown k with hierarchy in the data: agglomerative clustering gives you the whole merge tree instead of one cut.',
    ],
    failLink: 'Both failure modes are solved in the next module:',
    failLinkBtn: 'Clustering II: GMM & DBSCAN →',
    mathTitle: 'The math in one breath',
    math1: 'K-means minimizes the within-cluster sum of squares over both the assignments and the centroids:',
    math2: 'Fix μ → the optimal assignment is the nearest centroid. Fix the assignments → the optimal μⱼ is the cluster mean (set the gradient to zero). Alternating the two exact minimizations makes the objective monotonically non-increasing - convergence is guaranteed, global optimality is not (the problem is NP-hard in general).',
    codeTitle: 'In practice',
    appTitle: '🏭 In the real world: color quantization',
    appIntro:
      'Every GIF you have ever seen, every embedded display with a 256-color palette, every print job that reduces a photo to a handful of inks solves the same problem: replace millions of RGB values by k representative colors with minimal visible damage. That is k-means, verbatim - the pixels are points in 3D RGB space, the palette entries are the centroids, and “assign each pixel to its nearest palette color” is Lloyd’s assignment step. Slide k and watch the sunset image degrade gracefully - and check what happens to the storage cost.',
    appK: 'palette size k',
    appOrig: 'original (24-bit)',
    appQuant: 'quantized',
    appPalette: 'the k centroids = the palette',
    appMse: 'color error (RMS)',
    appSize: 'bits per pixel',
    appWhere:
      'The identical machinery builds visual-word vocabularies for image retrieval, compresses neural-network weights (weight sharing), picks warehouse locations from delivery coordinates, and segments customers from purchasing features.',
  },
  de: {
    kicker: 'Daten · Modul 2',
    title: 'K-Means-Clustering',
    intro:
      'PCA fand Richtungen; Clustering findet Gruppen. K-Means ist das Arbeitspferd des unüberwachten Gruppierens: Gegeben nur Punkte und eine Zahl k zerlegt es die Daten in k Cluster - ohne Labels, ohne Lehrer. Es ist wunderbar einfach, überraschend subtil, und es scheitert auf lehrreiche Weise.',
    ideaTitle: 'Gruppieren ohne Labels',
    idea1: 'Der Algorithmus braucht nur zwei alternierende Züge, jeder für sich verblüffend intuitiv:',
    ideaList: [
      'Zuweisen: Gib jeden Punkt seinem nächstgelegenen Zentroid (dem farbigen ✕).',
      'Aktualisieren: Verschiebe jeden Zentroid in den Mittelwert seiner Punkte.',
    ],
    idea2: 'Wiederholen, bis sich nichts mehr ändert. Das ist Lloyds Algorithmus, publiziert 1957 und noch immer überall - Bildkompression, Kundensegmentierung, Vektorquantisierung, Initialisierung feinerer Modelle.',
    labTitle: 'Interaktiv: Lloyds Algorithmus Schritt für Schritt',
    lab1: 'Wähle einen Datensatz und drücke die Phasen selbst: Zuweisen färbt die Punkte, Verschieben zieht jedes ✕ in seinen Clustermittelwert (Spuren zeigen die Wege). Beobachte die Zielfunktion - die summierte quadrierte Distanz WCSS - mit jeder Phase fallen und beim Konvergieren einfrieren.',
    dsNames: { blobs: '3 Blobs', blobs4: '4 Blobs', moons: 'Monde', rings: 'Ringe', uniform: 'uniform' },
    kLabel: 'Cluster k',
    initLabel: 'Initialisierung',
    initNames: ['zufällige Punkte', 'k-means++'],
    assignBtn: 'Zuweisen',
    updateBtn: 'Zentroide verschieben',
    stepBtn: 'Ganzer Schritt',
    runBtn: 'Start',
    pauseBtn: 'Pause',
    reinitBtn: 'Neu initialisieren',
    unluckyBtn: 'Pech-Initialisierung',
    converged: 'konvergiert',
    iter: 'Iterationen',
    wcssLabel: 'Zielfunktion (WCSS)',
    labTry: [
      'Gehe die 3 Blobs manuell durch: meist 3-5 Iterationen bis zur Konvergenz. Die Voronoi-Schattierung zeigt das Revier jedes Zentroids.',
      'Drücke „Pech-Initialisierung“: Alle Zentroide starten in einem Blob - K-Means konvergiert, aber in ein sichtbar falsches lokales Minimum. Die WCSS ist höher, und kein weiterer Schritt kann das reparieren.',
      'Vergleiche zufällig vs. k-means++ über mehrere Neuinitialisierungen: k-means++ verteilt die Saatpunkte und landet weit öfter in der guten Lösung.',
    ],
    initTitle: 'Die Initialisierung entscheidet das Ende',
    init1: 'Lloyds Algorithmus ist ein Abstiegsverfahren: Jede Phase senkt (oder hält) die WCSS beweisbar - Zuweisen ist optimal bei festen Zentroiden, Aktualisieren optimal bei fester Zuweisung. Das ist genau das alternierende (Koordinaten-)Abstiegsmuster aus den Optimierungsmodulen, angewandt auf eine nichtkonvexe Zielfunktion. Und wie immer beim Abstieg auf nichtkonvexen Landschaften gilt: Er hält im nächstgelegenen lokalen Minimum. Wo man startet, entscheidet, wo man endet.',
    init2: 'k-means++ (2007) behebt das meiste mit einer cleveren Idee: Wähle die Saatpunkte nacheinander, jeden neuen mit Wahrscheinlichkeit proportional zur quadrierten Distanz zum nächsten vorhandenen. Verteilte Saat → gute Becken. Es ist der Standard in jeder ernsthaften Bibliothek, und in der Praxis startet man zusätzlich mehrfach neu und behält das beste Ergebnis (n_init in scikit-learn).',
    elbowTitle: 'Interaktiv: k wählen - der Ellbogen',
    elbow1: 'K-Means beschwert sich nie über ein falsches k: Es teilt klaglos einen Blob oder verschmilzt zwei. Die klassische Diagnose lässt K-Means für jedes k laufen und plottet die finale WCSS. Ein zusätzlicher Cluster senkt die Zielfunktion immer - aber nach der wahren Gruppenzahl bricht die Verbesserung ein: Die Kurve knickt wie ein Ellbogen. Beim 3-Blob-Datensatz ist der Knick bei k = 3 unverkennbar; bei uniformem Rauschen gibt es keinen Ellbogen, weil es keine Cluster gibt.',
    elbowK: 'k im Labor oben',
    failTitle: 'Wo K-Means scheitert - und was dann hilft',
    fail1: 'Der Zuweisungsschritt zieht gerade Voronoi-Wände, also kann K-Means immer nur konvexe, grob kugelförmige Cluster ähnlicher Größe erzeugen. Stelle das Labor auf Monde oder Ringe und sieh zu, wie es mitten durch die offensichtliche Struktur schneidet - der Algorithmus konvergiert zufrieden, die WCSS ist gut, die Antwort ist falsch.',
    failList: [
      'Langgestreckte oder gekrümmte Cluster (Monde, Ringe): Die Metrik ist falsch, nicht der Optimierer. Nutze dichtebasiertes Clustering (DBSCAN) oder spektrales Clustering.',
      'Cluster sehr unterschiedlicher Größe/Dichte: K-Means stiehlt großen dünnen Clustern Punkte für kleine dichte. Gaußsche Mischmodelle (GMM) mit vollen Kovarianzen können das.',
      'Unbekanntes k mit Hierarchie in den Daten: Agglomeratives Clustering liefert den ganzen Verschmelzungsbaum statt eines einzelnen Schnitts.',
    ],
    failLink: 'Beide Grenzfälle löst das nächste Modul:',
    failLinkBtn: 'Clustering II: GMM & DBSCAN →',
    mathTitle: 'Die Mathematik in einem Atemzug',
    math1: 'K-Means minimiert die Summe der quadrierten Abstände innerhalb der Cluster über Zuweisungen und Zentroide gemeinsam:',
    math2: 'Fixiere μ → die optimale Zuweisung ist der nächste Zentroid. Fixiere die Zuweisungen → das optimale μⱼ ist der Clustermittelwert (Gradient null setzen). Das Abwechseln der beiden exakten Minimierungen macht die Zielfunktion monoton nicht-steigend - Konvergenz ist garantiert, globale Optimalität nicht (das Problem ist im Allgemeinen NP-schwer).',
    codeTitle: 'In der Praxis',
    appTitle: '🏭 In der echten Welt: Farbquantisierung',
    appIntro:
      'Jedes GIF, das du je gesehen hast, jedes Embedded-Display mit 256-Farben-Palette, jeder Druckauftrag, der ein Foto auf eine Handvoll Druckfarben reduziert, löst dasselbe Problem: Millionen RGB-Werte durch k repräsentative Farben ersetzen - mit minimalem sichtbarem Schaden. Das ist wortwörtlich K-Means: Die Pixel sind Punkte im 3D-RGB-Raum, die Paletteneinträge sind die Zentroide, und „weise jedem Pixel die nächste Palettenfarbe zu“ ist Lloyds Zuweisungsschritt. Schiebe k und beobachte, wie das Sonnenuntergangsbild würdevoll degradiert - und was mit den Speicherkosten passiert.',
    appK: 'Palettengröße k',
    appOrig: 'Original (24 Bit)',
    appQuant: 'quantisiert',
    appPalette: 'die k Zentroide = die Palette',
    appMse: 'Farbfehler (RMS)',
    appSize: 'Bits pro Pixel',
    appWhere:
      'Dieselbe Maschinerie baut Visual-Word-Vokabulare für die Bildsuche, komprimiert Netzgewichte (Weight Sharing), wählt Lagerstandorte aus Lieferkoordinaten und segmentiert Kunden aus Kaufmerkmalen.',
  },
}

// ---------------------------------------------------------------- application: color quantization

const QIMG = 48

// procedural sunset image, RGB 0..255
const QUANT_PIXELS: number[][] = (() => {
  const px: number[][] = []
  const rand = mulberry32(9)
  for (let y = 0; y < QIMG; y++) {
    for (let x = 0; x < QIMG; x++) {
      const fy = y / (QIMG - 1)
      const fx = x / (QIMG - 1)
      let r: number, g: number, b: number
      if (fy < 0.55) {
        // sky: deep violet high up → orange at the horizon
        const s = fy / 0.55
        r = 60 + 195 * s
        g = 30 + 110 * s
        b = 110 - 60 * s
        // sun disk
        const d = Math.hypot(fx - 0.62, (fy - 0.42) * 1.4)
        if (d < 0.09) {
          r = 255
          g = 235 - 400 * d
          b = 160 - 800 * d
        }
      } else {
        // sea: dark blue with a sun reflection column
        const s = (fy - 0.55) / 0.45
        r = 40 - 15 * s
        g = 45 + 10 * s
        b = 95 + 25 * s
        if (Math.abs(fx - 0.62) < 0.06 * (1 - s) + 0.015) {
          r += 160 * (1 - s)
          g += 90 * (1 - s)
        }
      }
      const n = (rand() - 0.5) * 14
      px.push([
        Math.min(255, Math.max(0, r + n)),
        Math.min(255, Math.max(0, g + n)),
        Math.min(255, Math.max(0, b + n)),
      ])
    }
  }
  return px
})()

function kmeansRgb(pixels: number[][], k: number): { palette: number[][]; labels: number[] } {
  const rand = mulberry32(1234 + k)
  // k-means++ seeding
  const palette: number[][] = [pixels[Math.floor(rand() * pixels.length)].slice()]
  const d2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  while (palette.length < k) {
    const dists = pixels.map((p) => Math.min(...palette.map((c) => d2(p, c))))
    const sum = dists.reduce((s, v) => s + v, 0)
    let r = rand() * sum
    let idx = 0
    for (; idx < dists.length - 1 && r > dists[idx]; idx++) r -= dists[idx]
    palette.push(pixels[idx].slice())
  }
  let labels = new Array<number>(pixels.length).fill(0)
  for (let it = 0; it < 12; it++) {
    labels = pixels.map((p) => {
      let best = 0
      let bd = Infinity
      for (let j = 0; j < k; j++) {
        const dd = d2(p, palette[j])
        if (dd < bd) {
          bd = dd
          best = j
        }
      }
      return best
    })
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0])
    labels.forEach((l, i) => {
      sums[l][0] += pixels[i][0]
      sums[l][1] += pixels[i][1]
      sums[l][2] += pixels[i][2]
      sums[l][3]++
    })
    for (let j = 0; j < k; j++)
      if (sums[j][3] > 0) palette[j] = [sums[j][0] / sums[j][3], sums[j][1] / sums[j][3], sums[j][2] / sums[j][3]]
  }
  return { palette, labels }
}

function QuantCanvas({ pixels }: { pixels: number[][] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(QIMG, QIMG)
    pixels.forEach((p, i) => {
      img.data[i * 4] = p[0]
      img.data[i * 4 + 1] = p[1]
      img.data[i * 4 + 2] = p[2]
      img.data[i * 4 + 3] = 255
    })
    ctx.putImageData(img, 0, 0)
  }, [pixels])
  return <canvas ref={ref} width={QIMG} height={QIMG} className="block w-full" style={{ imageRendering: 'pixelated' }} />
}

function QuantizeLab() {
  const t = useT(T)
  const [k, setK] = useState(4)

  const { palette, labels } = useMemo(() => kmeansRgb(QUANT_PIXELS, k), [k])
  const quantized = useMemo(() => labels.map((l) => palette[l]), [labels, palette])
  const rms = Math.sqrt(
    QUANT_PIXELS.reduce((s, p, i) => s + (p[0] - quantized[i][0]) ** 2 + (p[1] - quantized[i][1]) ** 2 + (p[2] - quantized[i][2]) ** 2, 0) /
      (QUANT_PIXELS.length * 3),
  )
  const bpp = Math.ceil(Math.log2(k))

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="grid grid-cols-2 gap-3 lg:col-span-3">
        <div className="card overflow-hidden">
          <QuantCanvas pixels={QUANT_PIXELS} />
          <div className="border-t border-white/10 px-3 py-1.5 text-[12px] text-muted">{t.appOrig}</div>
        </div>
        <div className="card overflow-hidden">
          <QuantCanvas pixels={quantized} />
          <div className="border-t border-white/10 px-3 py-1.5 text-[12px] text-muted">{t.appQuant}</div>
        </div>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad">
          <Slider label={t.appK} value={k} min={2} max={16} step={1} onChange={setK} />
        </div>
        <div className="card-pad">
          <div className="mb-2 text-[12px] text-muted">{t.appPalette}</div>
          <div className="flex flex-wrap gap-1.5">
            {palette.map((c, i) => (
              <span
                key={i}
                className="inline-block h-7 w-7 rounded border border-white/15"
                style={{ background: `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` }}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.appMse} value={fmt(rms, 1)} />
          <Readout label={t.appSize} value={`${bpp} / 24`} accent="#4ade80" />
        </div>
      </div>
    </div>
  )
}

const SNIPPET = `from sklearn.cluster import KMeans

km = KMeans(n_clusters=3, init="k-means++", n_init=10)
labels = km.fit_predict(X)
print(km.inertia_)          # final WCSS
print(km.cluster_centers_)`

// ---------------------------------------------------------------- data / drawing helpers

type DsKey = 'blobs' | 'blobs4' | 'moons' | 'rings' | 'uniform'

function makeDataset(key: DsKey, seed: number): P2[] {
  switch (key) {
    case 'blobs':
      return blobs(50, [[-0.8, -0.5], [0.75, -0.55], [0, 0.75]], 0.2, seed).map((d) => d.p)
    case 'blobs4':
      return blobs(40, [[-0.8, -0.6], [0.8, -0.6], [-0.7, 0.7], [0.75, 0.65]], 0.18, seed).map((d) => d.p)
    case 'moons':
      return moons(75, 0.07, seed).map((d) => d.p)
    case 'rings':
      return rings(75, 0.05, seed).map((d) => d.p)
    case 'uniform':
      return uniform2D(150, seed)
  }
}

const SW = 480
const SH = 440
const RANGE = 1.6
const px = (x: number) => ((x + RANGE) / (2 * RANGE)) * SW
const py = (y: number) => SH - ((y + RANGE) / (2 * RANGE)) * SH

function VoronoiBg({ centroids }: { centroids: P2[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const NX = 120
  const NY = Math.round((NX * SH) / SW)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const img = ctx.createImageData(NX, NY)
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const x = -RANGE + ((i + 0.5) / NX) * 2 * RANGE
        const y = RANGE - ((j + 0.5) / NY) * 2 * RANGE
        let best = 0
        let bd = Infinity
        centroids.forEach((c, ci) => {
          const d = (x - c[0]) ** 2 + (y - c[1]) ** 2
          if (d < bd) {
            bd = d
            best = ci
          }
        })
        const col = CLUSTER_COLORS[best % CLUSTER_COLORS.length]
        const r = parseInt(col.slice(1, 3), 16)
        const g = parseInt(col.slice(3, 5), 16)
        const b = parseInt(col.slice(5, 7), 16)
        const p = (j * NX + i) * 4
        img.data[p] = r
        img.data[p + 1] = g
        img.data[p + 2] = b
        img.data[p + 3] = 26
      }
    ctx.putImageData(img, 0, 0)
  }, [centroids])
  return (
    <canvas
      ref={ref}
      width={NX}
      height={NY}
      className="absolute inset-0 h-full w-full"
      style={{ imageRendering: 'auto' }}
    />
  )
}

// ---------------------------------------------------------------- Lloyd stepper lab

interface KmState {
  centroids: P2[]
  labels: number[] | null
  trails: P2[][]
  wcssHist: number[]
  phase: 'init' | 'assigned'
  converged: boolean
}

function KmeansLab() {
  const t = useT(T)
  const [dsKey, setDsKey] = useState<DsKey>('blobs')
  const [k, setK] = useState(3)
  const [initMethod, setInitMethod] = useState<'random' | 'kpp'>('kpp')
  const [seed, setSeed] = useState(1)
  const [running, setRunning] = useState(false)

  const pts = useMemo(() => makeDataset(dsKey, 7), [dsKey])

  const makeInit = (unlucky = false): KmState => {
    const rand = mulberry32(seed * 977 + 13)
    let centroids: P2[]
    if (unlucky) {
      const anchor = pts[Math.floor(rand() * pts.length)]
      centroids = Array.from({ length: k }, () => [
        anchor[0] + (rand() - 0.5) * 0.15,
        anchor[1] + (rand() - 0.5) * 0.15,
      ])
    } else {
      centroids = initMethod === 'kpp' ? kppInit(pts, k, rand) : randomInit(pts, k, rand)
    }
    return {
      centroids,
      labels: null,
      trails: centroids.map((c) => [c]),
      wcssHist: [],
      phase: 'init',
      converged: false,
    }
  }

  const [st, setSt] = useState<KmState>(makeInit)
  const stRef = useRef(st)
  stRef.current = st

  // re-init when the setup changes
  useEffect(() => {
    setRunning(false)
    setSt(makeInit())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsKey, k, initMethod, seed])

  const doAssign = (s: KmState): KmState => {
    const labels = assignClusters(pts, s.centroids)
    const w = wcss(pts, labels, s.centroids)
    const converged = s.labels !== null && labels.every((l, i) => l === s.labels![i])
    return { ...s, labels, wcssHist: [...s.wcssHist, w], phase: 'assigned', converged }
  }

  const doUpdate = (s: KmState): KmState => {
    if (!s.labels) return s
    const centroids = updateCentroids(pts, s.labels, s.centroids)
    const moved = centroids.some((c, i) => Math.hypot(c[0] - s.centroids[i][0], c[1] - s.centroids[i][1]) > 1e-9)
    return {
      ...s,
      centroids,
      trails: s.trails.map((tr, i) => [...tr, centroids[i]]),
      phase: 'init',
      converged: s.converged || !moved,
    }
  }

  const fullStep = (): boolean => {
    let s = stRef.current
    if (s.converged) {
      setRunning(false)
      return false
    }
    s = s.phase === 'init' ? doAssign(s) : s
    s = doUpdate(s)
    setSt(s)
    if (s.converged) {
      setRunning(false)
      return false
    }
    return true
  }

  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => {
      if (!fullStep()) return
    }, 450)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const curWcss = st.wcssHist.length ? st.wcssHist[st.wcssHist.length - 1] : null
  const maxW = st.wcssHist.length ? Math.max(...st.wcssHist) : 1

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card relative overflow-hidden lg:col-span-3">
        <VoronoiBg centroids={st.centroids} />
        <svg viewBox={`0 0 ${SW} ${SH}`} className="relative block w-full">
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={px(p[0])}
              cy={py(p[1])}
              r={3.4}
              fill={st.labels ? CLUSTER_COLORS[st.labels[i] % CLUSTER_COLORS.length] : 'rgba(230,234,242,0.6)'}
              opacity={0.85}
            />
          ))}
          {st.trails.map((tr, i) => (
            <polyline
              key={i}
              points={tr.map((c) => `${px(c[0])},${py(c[1])}`).join(' ')}
              fill="none"
              stroke={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
              strokeWidth={1.2}
              strokeDasharray="3 3"
              opacity={0.7}
            />
          ))}
          {st.centroids.map((c, i) => (
            <g key={i} stroke={CLUSTER_COLORS[i % CLUSTER_COLORS.length]} strokeWidth={3}>
              <line x1={px(c[0]) - 7} y1={py(c[1]) - 7} x2={px(c[0]) + 7} y2={py(c[1]) + 7} />
              <line x1={px(c[0]) - 7} y1={py(c[1]) + 7} x2={px(c[0]) + 7} y2={py(c[1]) - 7} />
            </g>
          ))}
          <rect x={0.5} y={0.5} width={SW - 1} height={SH - 1} fill="none" stroke="rgba(255,255,255,0.15)" />
        </svg>
      </div>

      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Segmented<DsKey>
            options={(Object.keys(t.dsNames) as DsKey[]).map((kk) => ({ value: kk, label: t.dsNames[kk] }))}
            value={dsKey}
            onChange={setDsKey}
          />
          <Slider label={t.kLabel} value={k} min={2} max={6} step={1} onChange={setK} format={(v) => `${v}`} />
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-muted">{t.initLabel}</div>
            <Segmented<'random' | 'kpp'>
              options={[
                { value: 'random', label: t.initNames[0] },
                { value: 'kpp', label: t.initNames[1] },
              ]}
              value={initMethod}
              onChange={setInitMethod}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn" onClick={() => setSt(doAssign(stRef.current))} disabled={st.phase !== 'init'} style={{ opacity: st.phase === 'init' ? 1 : 0.4 }}>
              1️⃣ {t.assignBtn}
            </button>
            <button className="btn" onClick={() => setSt(doUpdate(stRef.current))} disabled={st.phase !== 'assigned'} style={{ opacity: st.phase === 'assigned' ? 1 : 0.4 }}>
              2️⃣ {t.updateBtn}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => (running ? setRunning(false) : setRunning(true))}>
              {running ? `⏸ ${t.pauseBtn}` : `▶ ${t.runBtn}`}
            </button>
            <button className="btn" onClick={fullStep}>
              {t.stepBtn}
            </button>
            <button className="btn" onClick={() => { setRunning(false); setSeed((s) => s + 1) }}>
              🎲 {t.reinitBtn}
            </button>
            <button className="btn" onClick={() => { setRunning(false); setSt(makeInit(true)) }}>
              🙈 {t.unluckyBtn}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout
            label={t.wcssLabel}
            value={curWcss === null ? '-' : fmt(curWcss, 2)}
            accent={st.converged ? '#4ade80' : undefined}
            unit={st.converged ? `✓ ${t.converged}` : ''}
          />
          <Readout label={t.iter} value={`${st.wcssHist.length}`} />
        </div>
        {st.wcssHist.length > 1 && (
          <div className="card overflow-hidden">
            <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">
              {t.wcssLabel} ↓
            </div>
            <svg viewBox="0 0 300 90" className="block w-full">
              <polyline
                points={st.wcssHist
                  .map((w, i) => `${14 + (i / Math.max(st.wcssHist.length - 1, 1)) * 272},${12 + (1 - w / maxW) * 66}`)
                  .join(' ')}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={2}
              />
              {st.wcssHist.map((w, i) => (
                <circle key={i} cx={14 + (i / Math.max(st.wcssHist.length - 1, 1)) * 272} cy={12 + (1 - w / maxW) * 66} r={3} fill="#22d3ee" />
              ))}
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- elbow plot

function ElbowPlot({ dsKey }: { dsKey: DsKey }) {
  const t = useT(T)
  const [k, setK] = useState(3)
  const pts = useMemo(() => makeDataset(dsKey, 7), [dsKey])
  const curve = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const kk = i + 1
        return Math.min(...[1, 2, 3].map((s) => kmeansRun(pts, kk, s * 131 + kk)))
      }),
    [pts],
  )
  const maxW = curve[0]
  const PW = 520
  const PH = 240
  const mx = (kk: number) => 46 + ((kk - 1) / 7) * (PW - 70)
  const my = (w: number) => 16 + (1 - w / maxW) * (PH - 56)
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          <polyline points={curve.map((w, i) => `${mx(i + 1)},${my(w)}`).join(' ')} fill="none" stroke="#22d3ee" strokeWidth={2.5} />
          {curve.map((w, i) => (
            <g key={i}>
              <circle cx={mx(i + 1)} cy={my(w)} r={i + 1 === k ? 7 : 4} fill={i + 1 === k ? '#fbbf24' : '#22d3ee'} stroke="#0a0e17" strokeWidth={1.5} />
              <text x={mx(i + 1)} y={PH - 12} fill="#8b93a7" fontSize={12} textAnchor="middle">
                {i + 1}
              </text>
            </g>
          ))}
          <text x={PW - 12} y={22} fill="#8b93a7" fontSize={11} textAnchor="end" fontFamily="JetBrains Mono, monospace">
            WCSS(k)
          </text>
        </svg>
      </div>
      <div className="card-pad self-start lg:col-span-2">
        <Slider label={t.elbowK} value={k} min={1} max={8} step={1} onChange={setK} format={(v) => `${v}`} accent="#fbbf24" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function KmeansPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'idea', label: t.ideaTitle },
          { id: 'lab', label: t.labTitle },
          { id: 'init', label: t.initTitle },
          { id: 'elbow', label: t.elbowTitle },
          { id: 'failures', label: t.failTitle },
          { id: 'math', label: t.mathTitle },
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
          <ul>
            {t.ideaList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p>{t.idea2}</p>
        </div>
      </Section>

      <Section id="lab" title={t.labTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.lab1}</p>
        </div>
        <div className="mt-4">
          <KmeansLab />
        </div>
        <InfoBox title="⚡ Try it">
          <ul className="my-1 list-disc space-y-1 pl-5">
            {t.labTry.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </InfoBox>
      </Section>

      <Section id="init" title={t.initTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.init1}</p>
          <p>{t.init2}</p>
        </div>
      </Section>

      <Section id="elbow" title={t.elbowTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.elbow1}</p>
        </div>
        <div className="mt-4">
          <ElbowPlot dsKey="blobs" />
        </div>
      </Section>

      <Section id="failures" title={t.failTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.fail1}</p>
          <ul>
            {t.failList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <InfoBox tone="tip">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t.failLink}</span>
            <Link to="/clustering-2" className="btn-primary text-[13px]">
              {t.failLinkBtn}
            </Link>
          </div>
        </InfoBox>
      </Section>

      <Section id="math" title={t.mathTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.math1}</p>
          <TeX block>{String.raw`\min_{\;\mu_1,\dots,\mu_k,\; c}\;\; \sum_{i=1}^{n} \big\lVert \mathbf{x}_i - \mu_{c(i)} \big\rVert^2, \qquad c(i) \in \{1,\dots,k\}`}</TeX>
          <p>{t.math2}</p>
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
          <QuantizeLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
