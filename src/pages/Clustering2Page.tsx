import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Derivation } from '../components/Derivation'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import { fmt, mulberry32 } from '../lib/math'
import { covEllipse } from '../lib/signal'
import {
  blobs,
  cloud2D,
  dbscan,
  gmmEStep,
  gmmInit,
  gmmLogLik,
  gmmMStep,
  moons,
  rings,
  uniform2D,
  type Gmm2,
  type P2,
} from '../lib/stats'

const COLORS: [number, number, number][] = [
  [34, 211, 238],
  [251, 191, 36],
  [74, 222, 128],
  [167, 139, 250],
]
const HEXES = ['#22d3ee', '#fbbf24', '#4ade80', '#a78bfa', '#f87171', '#38bdf8']

const T = {
  en: {
    kicker: 'Data · Module 3',
    title: 'Clustering II: GMM & DBSCAN',
    intro:
      'K-means left two wounds open: it forces every cluster into a circle of the same size, and it forces every point to fully belong to exactly one cluster. This module heals both - Gaussian mixtures make clusters elastic and membership soft; DBSCAN drops the notion of cluster centers entirely and follows the density, solving the moons that k-means butchered.',
    gmmTitle: 'Interactive: Gaussian mixtures and the EM algorithm',
    gmm1: 'A Gaussian mixture model describes the data as k overlapping Gaussian clouds, each with its own center, shape (full covariance - the ellipses) and weight. Fitting it uses expectation-maximization, the soft sibling of Lloyd’s algorithm: the E-step computes for every point its responsibilities - the blended point colors ARE these probabilities; the M-step re-estimates each Gaussian from its weighted points. Step through and watch the ellipses stretch to embrace the elongated blobs that k-means would slice apart.',
    dsNames: { blobs: '3 blobs', elong: 'elongated', moons: 'moons' },
    kLabel: 'components k',
    eBtn: 'E-step',
    mBtn: 'M-step',
    stepBtn: 'Full step',
    runBtn: 'Run',
    pauseBtn: 'Pause',
    reinitBtn: 'Re-initialize',
    llLabel: 'log-likelihood',
    llPlot: 'log-likelihood (monotone ↑)',
    gmmDerivTitle: 'The EM updates',
    gmmDeriv: [
      { tex: String.raw`\gamma_{ik} \;=\; \frac{\pi_k\, \mathcal{N}(\mathbf{x}_i \mid \mu_k, \Sigma_k)}{\sum_j \pi_j\, \mathcal{N}(\mathbf{x}_i \mid \mu_j, \Sigma_j)}`, note: 'E-step: the responsibility of component k for point i - exactly the color mix of each dot in the lab. Bayes’ rule (Math track) in disguise.' },
      { tex: String.raw`\mu_k = \frac{\sum_i \gamma_{ik}\mathbf{x}_i}{\sum_i \gamma_{ik}}, \qquad \Sigma_k = \frac{\sum_i \gamma_{ik} (\mathbf{x}_i-\mu_k)(\mathbf{x}_i-\mu_k)^{\mathsf T}}{\sum_i \gamma_{ik}}, \qquad \pi_k = \frac{\sum_i \gamma_{ik}}{n}`, note: 'M-step: weighted mean, weighted covariance (the ellipse!), weighted share. With hard 0/1 responsibilities these collapse to exactly the k-means updates.' },
      { tex: String.raw`\log p(X) \;\text{never decreases}`, note: 'Each EM cycle provably raises (or keeps) the log-likelihood - the monotone curve in the mini plot, the same alternating-minimization guarantee as WCSS in k-means.' },
    ],
    dbTitle: 'Interactive: DBSCAN - clusters as density regions',
    db1: 'DBSCAN asks a different question: not "which center is closest?" but "where is the data dense?" A point with at least minPts neighbors within radius ε is a core point (large dots); connected core points form a cluster, points reachable from cores join as border points, everything else is declared noise (gray). No k to choose, arbitrary cluster shapes - the moons fall apart effortlessly. The price: two new knobs, and ε has a temper: too small and everything is noise, too large and the clusters fuse.',
    dsNames2: { moons: 'moons', rings: 'rings', noisy: 'blobs + noise' },
    eps: 'radius ε',
    minPts: 'min. neighbors (minPts)',
    found: 'clusters found',
    noiseCt: 'noise points',
    dbDerivTitle: 'The three point types, precisely',
    dbDeriv: [
      { tex: String.raw`\text{core:}\quad |\{\,j : \lVert \mathbf{x}_j - \mathbf{x}_i \rVert \le \varepsilon\,\}| \;\ge\; \text{minPts}`, note: 'The large dots: enough neighbors inside the ε-ball. Core points are the skeleton of a cluster.' },
      { tex: String.raw`\text{border:}\quad \text{not core, but inside the } \varepsilon\text{-ball of a core point}`, note: 'The small colored dots: they join the cluster of a nearby core but cannot extend it.' },
      { tex: String.raw`\text{noise:}\quad \text{neither}`, note: 'The gray dots: too isolated for any cluster - a first-class answer, not a failure. K-means and GMM cannot say "this point belongs nowhere"; DBSCAN can.' },
    ],
    compTitle: 'The clustering toolbox',
    compHead: ['method', 'cluster shape', 'needs k?', 'soft?', 'noise-aware?'],
    compRows: [
      ['k-means', 'convex, similar size', 'yes', 'no', 'no'],
      ['GMM (EM)', 'ellipses', 'yes', 'yes', 'no'],
      ['DBSCAN', 'arbitrary (density)', 'no (ε, minPts)', 'no', 'yes'],
      ['hierarchical', 'arbitrary (linkage)', 'no (cut later)', 'no', 'no'],
    ],
    codeTitle: 'In practice',
    appTitle: '🏭 In the real world: LIDAR obstacle extraction',
    appIntro:
      'The first thing an AGV does with every LIDAR sweep - thousands of times per shift - is exactly this module: turn a ring of raw range points into objects. The scan below shows a warehouse aisle: two walls, a pallet, a person’s legs and speckle noise from dust and reflections. DBSCAN is the industry’s go-to here precisely because of its two superpowers: it does not need to know how many objects there are, and it throws the speckle away as noise instead of assigning it to something. Tune ε: too small and the pallet shatters into fragments, too large and everything fuses with the walls - the AGV would brake for a phantom obstacle ten meters wide.',
    appEps: 'DBSCAN radius ε',
    appClusters: 'objects found',
    appObstacles: 'obstacles (non-wall)',
    appNoise: 'noise points dropped',
    appLegend: 'gray ✕ = classified as noise · long thin clusters = walls · △ = scanner',
    appWhere:
      'The same raw-points-to-objects step runs in robot vacuums, autonomous-driving perception stacks (after ground removal), people counting with ceiling LIDARs, and 3D-scan cleanup in metrology software.',
  },
  de: {
    kicker: 'Daten · Modul 3',
    title: 'Clustering II: GMM & DBSCAN',
    intro:
      'K-Means ließ zwei Wunden offen: Es zwingt jeden Cluster in einen Kreis gleicher Größe, und es zwingt jeden Punkt, vollständig zu genau einem Cluster zu gehören. Dieses Modul heilt beide - Gaußsche Mischmodelle machen Cluster elastisch und Zugehörigkeit weich; DBSCAN verwirft die Idee von Clusterzentren ganz und folgt der Dichte, womit die Monde zerfallen, die K-Means zerstückelt hat.',
    gmmTitle: 'Interaktiv: Gaußsche Mischmodelle und der EM-Algorithmus',
    gmm1: 'Ein Gaußsches Mischmodell beschreibt die Daten als k überlappende Gauß-Wolken, jede mit eigenem Zentrum, eigener Form (volle Kovarianz - die Ellipsen) und eigenem Gewicht. Das Fitten nutzt Expectation-Maximization, das weiche Geschwister von Lloyds Algorithmus: Der E-Schritt berechnet für jeden Punkt seine Verantwortlichkeiten - die gemischten Punktfarben SIND diese Wahrscheinlichkeiten; der M-Schritt schätzt jede Gauß-Komponente aus ihren gewichteten Punkten neu. Schreite durch und sieh die Ellipsen sich strecken, um die langgezogenen Blobs zu umarmen, die K-Means zerschneiden würde.',
    dsNames: { blobs: '3 Blobs', elong: 'langgezogen', moons: 'Monde' },
    kLabel: 'Komponenten k',
    eBtn: 'E-Schritt',
    mBtn: 'M-Schritt',
    stepBtn: 'Ganzer Schritt',
    runBtn: 'Start',
    pauseBtn: 'Pause',
    reinitBtn: 'Neu initialisieren',
    llLabel: 'Log-Likelihood',
    llPlot: 'Log-Likelihood (monoton ↑)',
    gmmDerivTitle: 'Die EM-Updates',
    gmmDeriv: [
      { tex: String.raw`\gamma_{ik} \;=\; \frac{\pi_k\, \mathcal{N}(\mathbf{x}_i \mid \mu_k, \Sigma_k)}{\sum_j \pi_j\, \mathcal{N}(\mathbf{x}_i \mid \mu_j, \Sigma_j)}`, note: 'E-Schritt: die Verantwortlichkeit von Komponente k für Punkt i - exakt die Farbmischung jedes Punkts im Labor. Der Satz von Bayes (Mathe-Track) in Verkleidung.' },
      { tex: String.raw`\mu_k = \frac{\sum_i \gamma_{ik}\mathbf{x}_i}{\sum_i \gamma_{ik}}, \qquad \Sigma_k = \frac{\sum_i \gamma_{ik} (\mathbf{x}_i-\mu_k)(\mathbf{x}_i-\mu_k)^{\mathsf T}}{\sum_i \gamma_{ik}}, \qquad \pi_k = \frac{\sum_i \gamma_{ik}}{n}`, note: 'M-Schritt: gewichteter Mittelwert, gewichtete Kovarianz (die Ellipse!), gewichteter Anteil. Mit harten 0/1-Verantwortlichkeiten kollabieren diese exakt zu den K-Means-Updates.' },
      { tex: String.raw`\log p(X) \;\text{fällt nie}`, note: 'Jeder EM-Zyklus hebt (oder hält) die Log-Likelihood beweisbar - die monotone Kurve im Mini-Plot, dieselbe Garantie alternierender Minimierung wie die WCSS bei K-Means.' },
    ],
    dbTitle: 'Interaktiv: DBSCAN - Cluster als Dichteregionen',
    db1: 'DBSCAN stellt eine andere Frage: nicht „welches Zentrum ist am nächsten?“, sondern „wo sind die Daten dicht?“ Ein Punkt mit mindestens minPts Nachbarn im Radius ε ist ein Kernpunkt (große Punkte); verbundene Kernpunkte bilden einen Cluster, von Kernen erreichbare Punkte schließen sich als Randpunkte an, alles andere wird zu Rauschen erklärt (grau). Kein k zu wählen, beliebige Clusterformen - die Monde zerfallen mühelos. Der Preis: zwei neue Knöpfe, und ε hat Temperament: zu klein, und alles ist Rauschen; zu groß, und die Cluster verschmelzen.',
    dsNames2: { moons: 'Monde', rings: 'Ringe', noisy: 'Blobs + Rauschen' },
    eps: 'Radius ε',
    minPts: 'Min. Nachbarn (minPts)',
    found: 'gefundene Cluster',
    noiseCt: 'Rauschpunkte',
    dbDerivTitle: 'Die drei Punkttypen, präzise',
    dbDeriv: [
      { tex: String.raw`\text{Kern:}\quad |\{\,j : \lVert \mathbf{x}_j - \mathbf{x}_i \rVert \le \varepsilon\,\}| \;\ge\; \text{minPts}`, note: 'Die großen Punkte: genug Nachbarn in der ε-Kugel. Kernpunkte sind das Skelett eines Clusters.' },
      { tex: String.raw`\text{Rand:}\quad \text{kein Kern, aber in der } \varepsilon\text{-Kugel eines Kernpunkts}`, note: 'Die kleinen farbigen Punkte: Sie schließen sich dem Cluster eines nahen Kerns an, können ihn aber nicht erweitern.' },
      { tex: String.raw`\text{Rauschen:}\quad \text{keins von beidem}`, note: 'Die grauen Punkte: zu isoliert für jeden Cluster - eine vollwertige Antwort, kein Versagen. K-Means und GMM können nicht sagen „dieser Punkt gehört nirgends hin“; DBSCAN kann es.' },
    ],
    compTitle: 'Der Clustering-Werkzeugkasten',
    compHead: ['Methode', 'Clusterform', 'braucht k?', 'weich?', 'rauschbewusst?'],
    compRows: [
      ['K-Means', 'konvex, ähnliche Größe', 'ja', 'nein', 'nein'],
      ['GMM (EM)', 'Ellipsen', 'ja', 'ja', 'nein'],
      ['DBSCAN', 'beliebig (Dichte)', 'nein (ε, minPts)', 'nein', 'ja'],
      ['hierarchisch', 'beliebig (Linkage)', 'nein (später schneiden)', 'nein', 'nein'],
    ],
    codeTitle: 'In der Praxis',
    appTitle: '🏭 In der echten Welt: LIDAR-Hinderniserkennung',
    appIntro:
      'Das Erste, was ein FTS mit jedem LIDAR-Sweep macht - tausende Male pro Schicht - ist genau dieses Modul: einen Ring roher Entfernungspunkte in Objekte verwandeln. Der Scan unten zeigt einen Lagergang: zwei Wände, eine Palette, die Beine einer Person und Speckle-Rauschen von Staub und Reflexionen. DBSCAN ist hier der Industriestandard, genau wegen seiner zwei Superkräfte: Es muss nicht wissen, wie viele Objekte es gibt, und es wirft das Speckle als Rauschen weg, statt es irgendetwas zuzuordnen. Stelle ε ein: zu klein, und die Palette zersplittert in Fragmente; zu groß, und alles verschmilzt mit den Wänden - das FTS würde für ein zehn Meter breites Phantomhindernis bremsen.',
    appEps: 'DBSCAN-Radius ε',
    appClusters: 'gefundene Objekte',
    appObstacles: 'Hindernisse (Nicht-Wand)',
    appNoise: 'verworfene Rauschpunkte',
    appLegend: 'graue ✕ = als Rauschen klassifiziert · lange dünne Cluster = Wände · △ = Scanner',
    appWhere:
      'Derselbe Schritt von Rohpunkten zu Objekten läuft in Saugrobotern, Perception-Stacks autonomer Autos (nach der Bodenentfernung), Personenzählung per Decken-LIDAR und der 3D-Scan-Bereinigung in Messtechnik-Software.',
  },
}

const SNIPPET = `from sklearn.mixture import GaussianMixture
from sklearn.cluster import DBSCAN

gmm = GaussianMixture(n_components=3, covariance_type="full").fit(X)
soft = gmm.predict_proba(X)          # responsibilities γ

db = DBSCAN(eps=0.15, min_samples=5).fit(X)
labels = db.labels_                  # -1 = noise`

// ---------------------------------------------------------------- shared drawing

const SW = 480
const SH = 430
const RNG = 1.6
const px = (x: number) => ((x + RNG) / (2 * RNG)) * SW
const py = (y: number) => SH - ((y + RNG) / (2 * RNG)) * SH

// ---------------------------------------------------------------- GMM lab

type GDs = 'blobs' | 'elong' | 'moons'

function gmmData(key: GDs): P2[] {
  switch (key) {
    case 'blobs':
      return blobs(45, [[-0.8, -0.5], [0.75, -0.55], [0, 0.75]], 0.2, 7).map((d) => d.p)
    case 'elong':
      return [
        ...cloud2D(70, 0.55, 0.1, 32, 11, -0.45, -0.35),
        ...cloud2D(70, 0.5, 0.09, -18, 12, 0.55, 0.45),
      ]
    case 'moons':
      return moons(70, 0.06, 7).map((d) => d.p)
  }
}

function GmmLab() {
  const t = useT(T)
  const [dsKey, setDsKey] = useState<GDs>('elong')
  const [k, setK] = useState(2)
  const [seed, setSeed] = useState(1)
  const [running, setRunning] = useState(false)

  const pts = useMemo(() => gmmData(dsKey), [dsKey])

  const init = () => {
    const rand = mulberry32(seed * 71 + 3)
    const model = gmmInit(pts, k, rand)
    return { model, resp: gmmEStep(pts, model), ll: [gmmLogLik(pts, model)] }
  }
  const [st, setSt] = useState<{ model: Gmm2; resp: number[][]; ll: number[] }>(init)
  const stRef = useRef(st)
  stRef.current = st

  useEffect(() => {
    setRunning(false)
    setSt(init())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsKey, k, seed])

  const eStep = () => {
    const cur = stRef.current
    setSt({ ...cur, resp: gmmEStep(pts, cur.model) })
  }
  const mStep = () => {
    const cur = stRef.current
    const model = gmmMStep(pts, cur.resp, k)
    setSt({ model, resp: cur.resp, ll: [...cur.ll, gmmLogLik(pts, model)] })
  }
  const fullStep = (): boolean => {
    const cur = stRef.current
    const resp = gmmEStep(pts, cur.model)
    const model = gmmMStep(pts, resp, k)
    const ll = gmmLogLik(pts, model)
    const prev = cur.ll[cur.ll.length - 1]
    setSt({ model, resp: gmmEStep(pts, model), ll: [...cur.ll, ll] })
    if (Math.abs(ll - prev) < 1e-4 || cur.ll.length > 80) {
      setRunning(false)
      return false
    }
    return true
  }

  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => fullStep(), 400)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const colorOf = (r: number[]): string => {
    let rr = 40
    let gg = 45
    let bb = 60
    r.forEach((g2, kk) => {
      const c = COLORS[kk % COLORS.length]
      rr += g2 * c[0] * 0.8
      gg += g2 * c[1] * 0.8
      bb += g2 * c[2] * 0.8
    })
    return `rgb(${Math.min(255, rr)}, ${Math.min(255, gg)}, ${Math.min(255, bb)})`
  }

  const ll = st.ll[st.ll.length - 1]
  const llMin = Math.min(...st.ll)
  const llMax = Math.max(...st.ll)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${SW} ${SH}`} className="block w-full" style={{ background: 'radial-gradient(120% 120% at 50% 40%, #141a28 0%, #0a0e17 100%)' }}>
          {pts.map((p, i) => (
            <circle key={i} cx={px(p[0])} cy={py(p[1])} r={3.6} fill={colorOf(st.resp[i])} opacity={0.9} />
          ))}
          {st.model.means.map((m, kk) => {
            const ell = covEllipse(st.model.covs[kk][0], st.model.covs[kk][1], st.model.covs[kk][2])
            const hex = HEXES[kk % HEXES.length]
            return (
              <g key={kk}>
                <ellipse
                  cx={px(m[0])}
                  cy={py(m[1])}
                  rx={(ell.a / (2 * RNG)) * SW}
                  ry={(ell.b / (2 * RNG)) * SW}
                  transform={`rotate(${-ell.angleDeg} ${px(m[0])} ${py(m[1])})`}
                  fill="none"
                  stroke={hex}
                  strokeWidth={2}
                />
                <g stroke={hex} strokeWidth={2.6}>
                  <line x1={px(m[0]) - 6} y1={py(m[1]) - 6} x2={px(m[0]) + 6} y2={py(m[1]) + 6} />
                  <line x1={px(m[0]) - 6} y1={py(m[1]) + 6} x2={px(m[0]) + 6} y2={py(m[1]) - 6} />
                </g>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Segmented<GDs>
            options={(Object.keys(t.dsNames) as GDs[]).map((kk) => ({ value: kk, label: t.dsNames[kk] }))}
            value={dsKey}
            onChange={setDsKey}
          />
          <Slider label={t.kLabel} value={k} min={2} max={4} step={1} onChange={setK} format={(v) => `${v}`} />
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={eStep}>
              1️⃣ {t.eBtn}
            </button>
            <button className="btn" onClick={mStep}>
              2️⃣ {t.mBtn}
            </button>
            <button className="btn-primary" onClick={() => setRunning(!running)}>
              {running ? `⏸ ${t.pauseBtn}` : `▶ ${t.runBtn}`}
            </button>
            <button className="btn" onClick={fullStep}>
              {t.stepBtn}
            </button>
            <button className="btn" onClick={() => setSeed((s) => s + 1)}>
              🎲 {t.reinitBtn}
            </button>
          </div>
        </div>
        <Readout label={t.llLabel} value={fmt(ll, 1)} accent="#4ade80" />
        {st.ll.length > 1 && (
          <div className="card overflow-hidden">
            <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.llPlot}</div>
            <svg viewBox="0 0 300 90" className="block w-full">
              <polyline
                points={st.ll
                  .map((v, i) => `${14 + (i / Math.max(st.ll.length - 1, 1)) * 272},${78 - ((v - llMin) / Math.max(llMax - llMin, 1e-9)) * 64}`)
                  .join(' ')}
                fill="none"
                stroke="#4ade80"
                strokeWidth={2}
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- DBSCAN lab

type DDs = 'moons' | 'rings' | 'noisy'

function dbData(key: DDs): P2[] {
  switch (key) {
    case 'moons':
      return moons(130, 0.04, 9).map((d) => d.p)
    case 'rings':
      return rings(180, 0.03, 9).map((d) => d.p)
    case 'noisy':
      return [
        ...blobs(50, [[-0.7, -0.4], [0.7, 0.5]], 0.17, 9).map((d) => d.p),
        ...uniform2D(40, 10),
      ]
  }
}

function DbscanLab() {
  const t = useT(T)
  const [dsKey, setDsKey] = useState<DDs>('moons')
  const [eps, setEps] = useState(0.19)
  const [minPts, setMinPts] = useState(5)

  const pts = useMemo(() => dbData(dsKey), [dsKey])
  const { labels, core } = useMemo(() => dbscan(pts, eps, minPts), [pts, eps, minPts])

  const nClusters = labels.reduce((mx, l) => Math.max(mx, l + 1), 0)
  const nNoise = labels.filter((l) => l === -1).length

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${SW} ${SH}`} className="block w-full" style={{ background: 'radial-gradient(120% 120% at 50% 40%, #141a28 0%, #0a0e17 100%)' }}>
          {pts.map((p, i) => {
            const l = labels[i]
            if (l === -1)
              return <circle key={i} cx={px(p[0])} cy={py(p[1])} r={2.6} fill="rgba(139,147,167,0.5)" />
            return (
              <circle
                key={i}
                cx={px(p[0])}
                cy={py(p[1])}
                r={core[i] ? 4.6 : 3}
                fill={HEXES[l % HEXES.length]}
                opacity={core[i] ? 0.95 : 0.65}
                stroke={core[i] ? '#0a0e17' : 'none'}
                strokeWidth={1}
              />
            )
          })}
          {/* eps radius legend circle */}
          <circle cx={40} cy={SH - 40} r={(eps / (2 * RNG)) * SW} fill="none" stroke="rgba(255,255,255,0.4)" strokeDasharray="4 3" />
          <text x={40} y={SH - 40 - (eps / (2 * RNG)) * SW - 6} textAnchor="middle" fill="#8b93a7" fontSize={11} fontFamily="JetBrains Mono, monospace">
            ε
          </text>
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Segmented<DDs>
            options={(Object.keys(t.dsNames2) as DDs[]).map((kk) => ({ value: kk, label: t.dsNames2[kk] }))}
            value={dsKey}
            onChange={setDsKey}
          />
          <Slider label={t.eps} value={eps} min={0.04} max={0.5} step={0.005} onChange={setEps} format={(v) => fmt(v, 3)} accent="#4ade80" />
          <Slider label={t.minPts} value={minPts} min={2} max={12} step={1} onChange={setMinPts} format={(v) => `${v}`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.found} value={`${nClusters}`} accent="#4ade80" />
          <Readout label={t.noiseCt} value={`${nNoise} / ${pts.length}`} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- application: LIDAR obstacles

// warehouse aisle scan in meters: scanner at (0, 0), aisle 8 m wide, walls at x = ±4
const LIDAR_PTS: P2[] = (() => {
  const rand = mulberry32(2024)
  const pts: P2[] = []
  // left + right wall, 4.5 m of aisle
  for (let i = 0; i < 46; i++) {
    pts.push([-4 + (rand() - 0.5) * 0.08, 0.4 + i * 0.09])
    pts.push([4 + (rand() - 0.5) * 0.08, 0.4 + i * 0.09])
  }
  // pallet at (1.6, 2.6): dense L-shaped face
  for (let i = 0; i < 16; i++) pts.push([0.95 + i * 0.085, 2.6 + (rand() - 0.5) * 0.06])
  for (let i = 0; i < 7; i++) pts.push([0.95 + (rand() - 0.5) * 0.06, 2.6 + i * 0.09])
  // person's legs at (-1.5, 3.4): two tight arcs
  for (let i = 0; i < 8; i++) pts.push([-1.65 + (rand() - 0.5) * 0.09, 3.35 + (rand() - 0.5) * 0.09])
  for (let i = 0; i < 8; i++) pts.push([-1.3 + (rand() - 0.5) * 0.09, 3.45 + (rand() - 0.5) * 0.09])
  // speckle noise
  for (let i = 0; i < 26; i++) pts.push([(rand() - 0.5) * 7.4, 0.3 + rand() * 4.3])
  return pts
})()

function LidarLab() {
  const t = useT(T)
  const [eps, setEps] = useState(0.35)

  const { labels } = useMemo(() => dbscan(LIDAR_PTS, eps, 4), [eps])
  const nClusters = labels.length ? Math.max(...labels) + 1 : 0
  const noiseCount = labels.filter((l) => l < 0).length
  // wall vs obstacle: clusters longer than 2.5 m in either direction are walls
  const obstacles = useMemo(() => {
    let count = 0
    for (let c = 0; c < nClusters; c++) {
      const pts = LIDAR_PTS.filter((_, i) => labels[i] === c)
      const xs = pts.map((p) => p[0])
      const ys = pts.map((p) => p[1])
      const ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
      if (ext < 2.5) count++
    }
    return count
  }, [labels, nClusters])

  const PW = 520
  const PH = 340
  const sx = (x: number) => ((x + 4.6) / 9.2) * PW
  const sy = (y: number) => PH - 16 - (y / 5) * (PH - 32)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          {/* scanner */}
          <path d={`M ${sx(0)} ${sy(0) - 8} l 7 14 l -14 0 Z`} fill="#22d3ee" />
          {LIDAR_PTS.map((p, i) => {
            const l = labels[i]
            if (l < 0)
              return (
                <text key={i} x={sx(p[0])} y={sy(p[1]) + 3} textAnchor="middle" fill="#5b6270" fontSize={9}>
                  ✕
                </text>
              )
            return <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={3} fill={HEXES[l % HEXES.length]} />
          })}
        </svg>
        <div className="border-t border-white/10 px-4 py-2 text-[12px] text-muted">{t.appLegend}</div>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad">
          <Slider label={t.appEps} value={eps} min={0.08} max={1.2} step={0.02} onChange={setEps} format={(v) => `${fmt(v, 2)} m`} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Readout label={t.appClusters} value={`${nClusters}`} />
          <Readout label={t.appObstacles} value={`${obstacles}`} accent={obstacles === 2 ? '#4ade80' : '#fbbf24'} />
          <Readout label={t.appNoise} value={`${noiseCount}`} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function Clustering2Page() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'gmm', label: t.gmmTitle },
          { id: 'dbscan', label: t.dbTitle },
          { id: 'compare', label: t.compTitle },
          { id: 'code', label: t.codeTitle },
          { id: 'application', label: t.appTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="gmm" title={t.gmmTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.gmm1}</p>
        </div>
        <div className="mt-4">
          <GmmLab />
        </div>
        <Derivation title={t.gmmDerivTitle} steps={t.gmmDeriv} />
      </Section>

      <Section id="dbscan" title={t.dbTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.db1}</p>
        </div>
        <div className="mt-4">
          <DbscanLab />
        </div>
        <Derivation title={t.dbDerivTitle} steps={t.dbDeriv} />
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

      <Section id="code" title={t.codeTitle}>
        <pre className="card overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-ink/85">{SNIPPET}</pre>
      </Section>

      <Section id="application" title={t.appTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.appIntro}</p>
        </div>
        <div className="mt-4">
          <LidarLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
