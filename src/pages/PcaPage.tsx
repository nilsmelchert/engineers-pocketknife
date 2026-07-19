import { useMemo, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { MatrixView } from '../components/MatrixView'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import { Polyline, Quad, Scene3D } from '../components/three/helpers'
import { fmt, m3Mul, m3MulV, rotX, rotY, type V3 } from '../lib/math'
import { cloud2D, makeGauss, pcaFit, pcaReconstruct, type P2 } from '../lib/stats'

const T = {
  en: {
    kicker: 'Data · Module 1',
    title: 'Principal Component Analysis',
    intro:
      'Real measurements rarely vary in every direction equally - they stretch along a few meaningful axes and merely jitter along the rest. PCA finds those axes. It is the engineer’s standard tool for compressing, denoising and visualizing high-dimensional data, and it falls out of one eigendecomposition.',
    whyTitle: 'The best flat shadow of your data',
    why1: 'Imagine holding a flat wooden board (your data cloud) in sunlight and rotating it: some orientations cast a long, informative shadow, others collapse it to a thin sliver. PCA rotates the coordinate system so that:',
    whyList: [
      'the 1st axis (PC1) points along the direction of largest variance - the longest shadow,',
      'the 2nd axis (PC2) is perpendicular to PC1 and catches the largest remaining variance,',
      'and so on. Keeping only the first k axes is dimensionality reduction: you drop the directions that carry mostly noise.',
    ],
    why2: 'Three classic uses: compression (store k numbers per sample instead of d), visualization (project to 2D you can plot), decorrelation/denoising (small components are often noise).',
    labTitle: 'Interactive: PCA in 2D',
    lab1: 'Shape a data cloud with the generator sliders. The violet arrow is PC1 (scaled by √λ₁), the green one PC2. The covariance matrix and eigenvalues update live. Then pull the compression slider: every point slides along its perpendicular onto the PC1 line - this is what "keeping 1 of 2 components" does to your data.',
    genSx: 'spread σ₁',
    genSy: 'spread σ₂',
    genTheta: 'cloud rotation',
    genN: 'points',
    recon: 'compress → 1 component',
    varExplained: 'variance explained',
    cov: 'Covariance matrix and its eigenvalues:',
    labTry: [
      'Set σ₂ ≈ σ₁: the cloud becomes round, the eigenvalues equal - PCA finds no preferred direction (the axes become arbitrary).',
      'Rotate the cloud: the principal axes follow. PCA does not care about your coordinate system - that is the point.',
      'Compress with a thin cloud (σ₂ small): points barely move - 1 component preserves almost everything. With a round cloud, compression destroys half the structure.',
    ],
    vsTitle: 'PCA is not regression',
    vs1: 'A common confusion: the PC1 line looks like a regression line, but it is not. Least squares predicts y from x and therefore minimizes vertical distances. PCA treats x and y as equals and minimizes perpendicular distances. The two lines only coincide for perfectly correlated data.',
    vsToggle: ['least squares (vertical)', 'PCA (perpendicular)'],
    mathTitle: 'The math: covariance and eigenvectors',
    math1: 'Center the data, then form the covariance matrix - the table of how every dimension co-varies with every other:',
    math2: 'The direction w of maximal variance solves a constrained maximization (‖w‖ = 1, otherwise variance grows without bound). The Lagrange condition (module "SGD & Adam" covers the technique) turns it into an eigenvalue problem:',
    math3: 'So the principal axes are the eigenvectors of C, and each eigenvalue λᵢ is exactly the variance of the data along that axis. Variance explained by the first k components: (λ₁+…+λk)/(λ₁+…+λd). In practice PCA is computed via the SVD of the centered data matrix - numerically more stable, mathematically the same thing (see the roadmap module).',
    lab3dTitle: 'Interactive: PCA in 3D - projecting onto a plane',
    lab3d1: 'The same idea one dimension up: a pancake-shaped cloud in 3D. PC1 and PC2 span the translucent plane - the best 2D screen for this data. Pull the slider to project every point onto it: the flattened cloud is what a 2D scatter plot of the data would show, losing as little as possible.',
    lab3dSlider: 'project onto the PC1-PC2 plane',
    lab3dHint: 'drag to orbit',
    chooseTitle: 'Interactive: how many components?',
    choose1: 'An 8-dimensional dataset with only 3 real degrees of freedom (plus sensor noise). The scree plot shows the eigenvalue of each component; the curve is the cumulative variance explained. The knee - after component 3 the bars collapse - tells you the true dimensionality. Choose k there and reconstruction loses almost nothing.',
    chooseK: 'components kept k',
    chooseCum: 'variance explained',
    chooseErr: 'reconstruction RMS',
    tipScale:
      'PCA is unit-sensitive: variance depends on units, so a feature measured in millimeters dominates one measured in meters ×1000. Standardize features (zero mean, unit variance) before PCA unless they share a physical scale. Every PCA horror story starts with someone skipping this step.',
    codeTitle: 'In practice',
    appTitle: '🏭 In the real world: machine-health monitoring',
    appIntro:
      'A pump’s vibration sensor delivers two features per hour: RMS level and crest factor. Months of healthy operation form a cloud - and PCA turns that cloud into a statistical fence. The trick: measure the distance to the healthy mean in PCA coordinates, where each axis is scaled by its own variance (the Mahalanobis distance). A new reading that is 3σ outside the fence raises an alarm - even though neither feature alone has crossed any fixed limit. Advance the bearing wear and watch the operating point creep out of the ellipse long before it would trip a naive threshold.',
    appWear: 'bearing wear',
    appScore: 'anomaly score (σ)',
    appState: 'machine state',
    appOk: 'HEALTHY',
    appWarn: 'WATCH',
    appAlarm: 'ALARM',
    appLegendHealthy: 'healthy history',
    appLegendNow: 'live reading',
    appWhere:
      'The same PCA fence guards gas turbines, wind-turbine gearboxes, semiconductor etch chambers and credit-card fraud scores - anywhere “normal” is a correlated cloud and trouble is a direction nobody hard-coded.',
  },
  de: {
    kicker: 'Daten · Modul 1',
    title: 'Hauptkomponentenanalyse (PCA)',
    intro:
      'Echte Messungen variieren selten in alle Richtungen gleich - sie strecken sich entlang weniger bedeutsamer Achsen und zittern entlang der übrigen nur. PCA findet diese Achsen. Sie ist das Standardwerkzeug zum Komprimieren, Entrauschen und Visualisieren hochdimensionaler Daten - und fällt aus einer einzigen Eigenzerlegung heraus.',
    whyTitle: 'Der beste flache Schatten deiner Daten',
    why1: 'Stell dir vor, du hältst ein flaches Brett (deine Datenwolke) ins Sonnenlicht und drehst es: Manche Orientierungen werfen einen langen, informativen Schatten, andere lassen ihn zu einem schmalen Streifen kollabieren. PCA dreht das Koordinatensystem so, dass:',
    whyList: [
      'die 1. Achse (PC1) entlang der Richtung größter Varianz zeigt - der längste Schatten,',
      'die 2. Achse (PC2) senkrecht auf PC1 steht und die größte verbleibende Varianz einfängt,',
      'und so weiter. Nur die ersten k Achsen zu behalten ist Dimensionsreduktion: Man verwirft die Richtungen, die überwiegend Rauschen tragen.',
    ],
    why2: 'Drei klassische Anwendungen: Kompression (k Zahlen pro Messung statt d), Visualisierung (Projektion auf plottbare 2D), Dekorrelation/Entrauschen (kleine Komponenten sind oft Rauschen).',
    labTitle: 'Interaktiv: PCA in 2D',
    lab1: 'Forme eine Datenwolke mit den Generator-Slidern. Der violette Pfeil ist PC1 (skaliert mit √λ₁), der grüne PC2. Kovarianzmatrix und Eigenwerte aktualisieren sich live. Ziehe dann den Kompressions-Slider: Jeder Punkt gleitet senkrecht auf die PC1-Gerade - genau das macht „1 von 2 Komponenten behalten“ mit deinen Daten.',
    genSx: 'Streuung σ₁',
    genSy: 'Streuung σ₂',
    genTheta: 'Drehung der Wolke',
    genN: 'Punkte',
    recon: 'komprimieren → 1 Komponente',
    varExplained: 'erklärte Varianz',
    cov: 'Kovarianzmatrix und ihre Eigenwerte:',
    labTry: [
      'Setze σ₂ ≈ σ₁: Die Wolke wird rund, die Eigenwerte gleich - PCA findet keine bevorzugte Richtung mehr (die Achsen werden beliebig).',
      'Drehe die Wolke: Die Hauptachsen drehen mit. PCA schert sich nicht um dein Koordinatensystem - das ist der Punkt.',
      'Komprimiere bei dünner Wolke (σ₂ klein): Die Punkte bewegen sich kaum - 1 Komponente erhält fast alles. Bei runder Wolke zerstört die Kompression die halbe Struktur.',
    ],
    vsTitle: 'PCA ist keine Regression',
    vs1: 'Eine häufige Verwechslung: Die PC1-Gerade sieht aus wie eine Regressionsgerade, ist aber keine. Kleinste Quadrate sagen y aus x vorher und minimieren deshalb vertikale Abstände. PCA behandelt x und y gleichberechtigt und minimiert senkrechte Abstände. Beide Geraden fallen nur bei perfekt korrelierten Daten zusammen.',
    vsToggle: ['Kleinste Quadrate (vertikal)', 'PCA (senkrecht)'],
    mathTitle: 'Die Mathematik: Kovarianz und Eigenvektoren',
    math1: 'Zentriere die Daten und bilde die Kovarianzmatrix - die Tabelle, wie jede Dimension mit jeder anderen kovariiert:',
    math2: 'Die Richtung w maximaler Varianz löst eine Maximierung mit Nebenbedingung (‖w‖ = 1, sonst wächst die Varianz unbeschränkt). Die Lagrange-Bedingung (die Technik behandelt das Modul „SGD & Adam“) macht daraus ein Eigenwertproblem:',
    math3: 'Die Hauptachsen sind also die Eigenvektoren von C, und jeder Eigenwert λᵢ ist exakt die Varianz der Daten entlang dieser Achse. Erklärte Varianz der ersten k Komponenten: (λ₁+…+λk)/(λ₁+…+λd). In der Praxis rechnet man PCA über die SVD der zentrierten Datenmatrix - numerisch stabiler, mathematisch dasselbe (siehe Roadmap-Modul).',
    lab3dTitle: 'Interaktiv: PCA in 3D - Projektion auf eine Ebene',
    lab3d1: 'Dieselbe Idee eine Dimension höher: eine pfannkuchenförmige Wolke in 3D. PC1 und PC2 spannen die transparente Ebene auf - die beste 2D-Leinwand für diese Daten. Ziehe den Slider, um jeden Punkt darauf zu projizieren: Die plattgedrückte Wolke ist genau das, was ein 2D-Streudiagramm der Daten zeigen würde - mit minimalem Verlust.',
    lab3dSlider: 'auf die PC1-PC2-Ebene projizieren',
    lab3dHint: 'ziehen zum Orbiten',
    chooseTitle: 'Interaktiv: Wie viele Komponenten?',
    choose1: 'Ein 8-dimensionaler Datensatz mit nur 3 echten Freiheitsgraden (plus Sensorrauschen). Der Scree-Plot zeigt den Eigenwert jeder Komponente; die Kurve ist die kumulierte erklärte Varianz. Das Knie - nach Komponente 3 brechen die Balken ein - verrät die wahre Dimensionalität. Wähle k dort, und die Rekonstruktion verliert fast nichts.',
    chooseK: 'behaltene Komponenten k',
    chooseCum: 'erklärte Varianz',
    chooseErr: 'Rekonstruktions-RMS',
    tipScale:
      'PCA ist einheitenempfindlich: Varianz hängt von Einheiten ab, also dominiert ein in Millimetern gemessenes Merkmal eines in Metern um den Faktor 1000. Standardisiere Merkmale (Mittelwert 0, Varianz 1) vor der PCA, sofern sie keine gemeinsame physikalische Skala teilen. Jede PCA-Horrorgeschichte beginnt damit, dass jemand diesen Schritt ausgelassen hat.',
    codeTitle: 'In der Praxis',
    appTitle: '🏭 In der echten Welt: Maschinenzustandsüberwachung',
    appIntro:
      'Der Schwingungssensor einer Pumpe liefert stündlich zwei Merkmale: RMS-Pegel und Crest-Faktor. Monate gesunden Betriebs bilden eine Wolke - und PCA macht aus dieser Wolke einen statistischen Zaun. Der Trick: Man misst den Abstand zum gesunden Mittelwert in PCA-Koordinaten, wo jede Achse mit ihrer eigenen Varianz skaliert ist (die Mahalanobis-Distanz). Ein neuer Messwert, der 3σ außerhalb des Zauns liegt, löst Alarm aus - obwohl keines der Merkmale allein eine feste Grenze überschritten hat. Erhöhe den Lagerverschleiß und sieh zu, wie der Betriebspunkt aus der Ellipse kriecht, lange bevor ein naiver Schwellwert anschlagen würde.',
    appWear: 'Lagerverschleiß',
    appScore: 'Anomalie-Score (σ)',
    appState: 'Maschinenzustand',
    appOk: 'GESUND',
    appWarn: 'BEOBACHTEN',
    appAlarm: 'ALARM',
    appLegendHealthy: 'gesunde Historie',
    appLegendNow: 'Live-Messwert',
    appWhere:
      'Derselbe PCA-Zaun bewacht Gasturbinen, Windkraft-Getriebe, Ätzkammern in der Halbleiterfertigung und Kreditkarten-Betrugsscores - überall dort, wo „normal“ eine korrelierte Wolke ist und Ärger eine Richtung, die niemand fest einprogrammiert hat.',
  },
}

const SNIPPET = `from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

X = StandardScaler().fit_transform(X_raw)   # PCA is unit-sensitive!
pca = PCA(n_components=0.95)                # keep 95 % of the variance
Z = pca.fit_transform(X)                    # compressed representation
X_hat = pca.inverse_transform(Z)            # reconstruction
print(pca.explained_variance_ratio_)`

// ---------------------------------------------------------------- 2D scatter helpers

const SW = 480
const SH = 440
const RANGE = 3.2
const sx2px = (x: number) => ((x + RANGE) / (2 * RANGE)) * SW
const sy2px = (y: number) => SH - ((y + RANGE) / (2 * RANGE)) * SH

function ScatterFrame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${SW} ${SH}`} className="block w-full" style={{ background: 'radial-gradient(120% 120% at 50% 40%, #141a28 0%, #0a0e17 100%)' }}>
      <line x1={sx2px(-RANGE)} y1={sy2px(0)} x2={sx2px(RANGE)} y2={sy2px(0)} stroke="rgba(255,255,255,0.08)" />
      <line x1={sx2px(0)} y1={sy2px(-RANGE)} x2={sx2px(0)} y2={sy2px(RANGE)} stroke="rgba(255,255,255,0.08)" />
      {children}
      <rect x={0.5} y={0.5} width={SW - 1} height={SH - 1} fill="none" stroke="rgba(255,255,255,0.15)" />
    </svg>
  )
}

// ---------------------------------------------------------------- 2D lab

function Pca2DLab() {
  const t = useT(T)
  const [sxv, setSx] = useState(1.1)
  const [syv, setSy] = useState(0.35)
  const [theta, setTheta] = useState(25)
  const [n, setN] = useState(120)
  const [tt, setTt] = useState(0)

  const pts = useMemo(() => cloud2D(n, sxv, syv, theta, 17), [n, sxv, syv, theta])
  const model = useMemo(() => pcaFit(pts as number[][]), [pts])
  const recon = useMemo(() => pts.map((p) => pcaReconstruct(model, p as number[], 1)), [pts, model])

  const shown = pts.map((p, i) => [
    p[0] + (recon[i][0] - p[0]) * tt,
    p[1] + (recon[i][1] - p[1]) * tt,
  ])

  const mu = model.mean
  const axis = (i: number, scale: number) =>
    [
      [mu[0] - model.vectors[i][0] * scale, mu[1] - model.vectors[i][1] * scale],
      [mu[0] + model.vectors[i][0] * scale, mu[1] + model.vectors[i][1] * scale],
    ] as [number, number][]
  const s1 = 2 * Math.sqrt(Math.max(model.values[0], 0))
  const s2 = 2 * Math.sqrt(Math.max(model.values[1], 0))
  const total = model.values[0] + model.values[1]
  const pc1Share = total > 0 ? model.values[0] / total : 0.5

  const a1 = axis(0, s1)
  const a2 = axis(1, s2)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <ScatterFrame>
          {tt > 0.02 &&
            pts.map((p, i) => (
              <line
                key={i}
                x1={sx2px(p[0])}
                y1={sy2px(p[1])}
                x2={sx2px(shown[i][0])}
                y2={sy2px(shown[i][1])}
                stroke="rgba(167,139,250,0.25)"
                strokeWidth={1}
              />
            ))}
          {shown.map((p, i) => (
            <circle key={i} cx={sx2px(p[0])} cy={sy2px(p[1])} r={3.2} fill="#22d3ee" opacity={0.8} />
          ))}
          <line x1={sx2px(a1[0][0])} y1={sy2px(a1[0][1])} x2={sx2px(a1[1][0])} y2={sy2px(a1[1][1])} stroke="#a78bfa" strokeWidth={3} />
          <line x1={sx2px(a2[0][0])} y1={sy2px(a2[0][1])} x2={sx2px(a2[1][0])} y2={sy2px(a2[1][1])} stroke="#4ade80" strokeWidth={2} />
          <circle cx={sx2px(mu[0])} cy={sy2px(mu[1])} r={5} fill="#fbbf24" stroke="#0a0e17" strokeWidth={1.5} />
          <text x={sx2px(a1[1][0]) + 6} y={sy2px(a1[1][1])} fill="#a78bfa" fontSize={13} fontFamily="JetBrains Mono, monospace">PC1</text>
          <text x={sx2px(a2[1][0]) + 6} y={sy2px(a2[1][1])} fill="#4ade80" fontSize={13} fontFamily="JetBrains Mono, monospace">PC2</text>
        </ScatterFrame>
      </div>
      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.genSx} value={sxv} min={0.15} max={1.5} step={0.01} onChange={setSx} format={(v) => fmt(v, 2)} />
          <Slider label={t.genSy} value={syv} min={0.1} max={1.5} step={0.01} onChange={setSy} format={(v) => fmt(v, 2)} />
          <Slider label={t.genTheta} value={theta} min={-90} max={90} step={1} onChange={setTheta} format={(v) => `${v}°`} />
          <Slider label={t.genN} value={n} min={30} max={300} step={10} onChange={setN} format={(v) => `${v}`} />
          <Slider label={t.recon} value={tt} min={0} max={1} step={0.01} onChange={setTt} format={(v) => `${fmt(v * 100, 0)} %`} accent="#a78bfa" />
        </div>
        <div className="card-pad">
          <div className="mb-2 text-[13px] text-muted">{t.cov}</div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <MatrixView
              label={<TeX>{String.raw`C =`}</TeX>}
              values={[
                [model.values.length ? covOf(pts, 0, 0) : 0, covOf(pts, 0, 1)],
                [covOf(pts, 0, 1), covOf(pts, 1, 1)],
              ]}
              digits={2}
            />
            <div className="font-mono text-[13px]">
              <div style={{ color: '#a78bfa' }}>λ₁ = {fmt(model.values[0], 2)}</div>
              <div style={{ color: '#4ade80' }}>λ₂ = {fmt(model.values[1], 2)}</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 text-[11px] font-medium tracking-wide text-muted uppercase">{t.varExplained}</div>
            <div className="flex h-3 overflow-hidden rounded-full">
              <div className="bg-accent2" style={{ width: `${pc1Share * 100}%` }} />
              <div className="bg-green-400" style={{ width: `${(1 - pc1Share) * 100}%` }} />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[11px] text-muted">
              <span style={{ color: '#a78bfa' }}>PC1 {fmt(pc1Share * 100, 1)} %</span>
              <span style={{ color: '#4ade80' }}>PC2 {fmt((1 - pc1Share) * 100, 1)} %</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function covOf(pts: P2[], i: number, j: number): number {
  const mi = pts.reduce((s, p) => s + p[i], 0) / pts.length
  const mj = pts.reduce((s, p) => s + p[j], 0) / pts.length
  return pts.reduce((s, p) => s + (p[i] - mi) * (p[j] - mj), 0) / Math.max(pts.length - 1, 1)
}

// ---------------------------------------------------------------- PCA vs regression

function VsRegression() {
  const t = useT(T)
  const [mode, setMode] = useState<'ls' | 'pca'>('ls')
  const pts = useMemo(() => cloud2D(70, 1.1, 0.45, 28, 41), [])
  const model = useMemo(() => pcaFit(pts as number[][]), [pts])

  // least squares y = a + b x
  const { a, b } = useMemo(() => {
    const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length
    const my = pts.reduce((s, p) => s + p[1], 0) / pts.length
    let num = 0
    let den = 0
    for (const p of pts) {
      num += (p[0] - mx) * (p[1] - my)
      den += (p[0] - mx) ** 2
    }
    const b = num / den
    return { a: my - b * mx, b }
  }, [pts])

  const mu = model.mean
  const v1 = model.vectors[0]

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <ScatterFrame>
          {pts.map((p, i) => {
            if (mode === 'ls') {
              const yLine = a + b * p[0]
              return (
                <line key={i} x1={sx2px(p[0])} y1={sy2px(p[1])} x2={sx2px(p[0])} y2={sy2px(yLine)} stroke="rgba(251,191,36,0.45)" strokeWidth={1} />
              )
            }
            const c = [p[0] - mu[0], p[1] - mu[1]]
            const proj = c[0] * v1[0] + c[1] * v1[1]
            const q = [mu[0] + proj * v1[0], mu[1] + proj * v1[1]]
            return (
              <line key={i} x1={sx2px(p[0])} y1={sy2px(p[1])} x2={sx2px(q[0])} y2={sy2px(q[1])} stroke="rgba(167,139,250,0.5)" strokeWidth={1} />
            )
          })}
          {pts.map((p, i) => (
            <circle key={i} cx={sx2px(p[0])} cy={sy2px(p[1])} r={3.2} fill="#22d3ee" opacity={0.85} />
          ))}
          {mode === 'ls' ? (
            <line x1={sx2px(-3)} y1={sy2px(a + b * -3)} x2={sx2px(3)} y2={sy2px(a + b * 3)} stroke="#fbbf24" strokeWidth={2.5} />
          ) : (
            <line
              x1={sx2px(mu[0] - v1[0] * 4)}
              y1={sy2px(mu[1] - v1[1] * 4)}
              x2={sx2px(mu[0] + v1[0] * 4)}
              y2={sy2px(mu[1] + v1[1] * 4)}
              stroke="#a78bfa"
              strokeWidth={2.5}
            />
          )}
        </ScatterFrame>
      </div>
      <div className="card-pad self-start lg:col-span-2">
        <Segmented<'ls' | 'pca'>
          options={[
            { value: 'ls', label: t.vsToggle[0] },
            { value: 'pca', label: t.vsToggle[1] },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 3D lab

function Pca3DLab() {
  const t = useT(T)
  const [tt, setTt] = useState(0)

  const { pts3, model } = useMemo(() => {
    const g = makeGauss(23)
    const R = m3Mul(rotY(0.6), rotX(0.35))
    const scales = [1.15, 0.55, 0.16]
    const center: V3 = [0, 1.1, 0]
    const pts3: V3[] = Array.from({ length: 130 }, () => {
      const local: V3 = [g() * scales[0], g() * scales[1], g() * scales[2]]
      const w = m3MulV(R, local)
      return [w[0] + center[0], w[1] + center[1], w[2] + center[2]]
    })
    const model = pcaFit(pts3 as unknown as number[][])
    return { pts3, model }
  }, [])

  const recon = useMemo(
    () => pts3.map((p) => pcaReconstruct(model, p as unknown as number[], 2) as V3),
    [pts3, model],
  )
  const shown: V3[] = pts3.map((p, i) => [
    p[0] + (recon[i][0] - p[0]) * tt,
    p[1] + (recon[i][1] - p[1]) * tt,
    p[2] + (recon[i][2] - p[2]) * tt,
  ])

  const mu = model.mean as V3
  const ax = (i: number, s: number): [V3, V3] => [
    [mu[0] - model.vectors[i][0] * s, mu[1] - model.vectors[i][1] * s, mu[2] - model.vectors[i][2] * s],
    [mu[0] + model.vectors[i][0] * s, mu[1] + model.vectors[i][1] * s, mu[2] + model.vectors[i][2] * s],
  ]
  const s1 = 2.2 * Math.sqrt(model.values[0])
  const s2 = 2.2 * Math.sqrt(model.values[1])
  const s3 = 2.2 * Math.sqrt(Math.max(model.values[2], 1e-6))
  const [p1a, p1b] = ax(0, s1)
  const [p2a, p2b] = ax(1, s2)
  const [p3a, p3b] = ax(2, s3)
  const planeCorners: V3[] = [
    [mu[0] - model.vectors[0][0] * s1 - model.vectors[1][0] * s2, mu[1] - model.vectors[0][1] * s1 - model.vectors[1][1] * s2, mu[2] - model.vectors[0][2] * s1 - model.vectors[1][2] * s2],
    [mu[0] + model.vectors[0][0] * s1 - model.vectors[1][0] * s2, mu[1] + model.vectors[0][1] * s1 - model.vectors[1][1] * s2, mu[2] + model.vectors[0][2] * s1 - model.vectors[1][2] * s2],
    [mu[0] + model.vectors[0][0] * s1 + model.vectors[1][0] * s2, mu[1] + model.vectors[0][1] * s1 + model.vectors[1][1] * s2, mu[2] + model.vectors[0][2] * s1 + model.vectors[1][2] * s2],
    [mu[0] - model.vectors[0][0] * s1 + model.vectors[1][0] * s2, mu[1] - model.vectors[0][1] * s1 + model.vectors[1][1] * s2, mu[2] - model.vectors[0][2] * s1 + model.vectors[1][2] * s2],
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Scene3D
        className="lg:col-span-3"
        height={430}
        camera={{ position: [2.6, 2.2, 2.8], fov: 42 }}
        target={[0, 1.1, 0]}
        hint={t.lab3dHint}
      >
        {shown.map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.028, 10, 10]} />
            <meshStandardMaterial color="#22d3ee" />
          </mesh>
        ))}
        <Polyline points={[p1a, p1b]} color="#a78bfa" lineWidth={3} />
        <Polyline points={[p2a, p2b]} color="#4ade80" lineWidth={2.5} />
        <Polyline points={[p3a, p3b]} color="#f87171" lineWidth={2} />
        <Quad corners={planeCorners} color="#a78bfa" opacity={0.1} />
      </Scene3D>
      <div className="card-pad self-start lg:col-span-2">
        <Slider label={t.lab3dSlider} value={tt} min={0} max={1} step={0.01} onChange={setTt} format={(v) => `${fmt(v * 100, 0)} %`} accent="#a78bfa" />
        <div className="mt-4 space-y-1 font-mono text-[13px]">
          <div style={{ color: '#a78bfa' }}>λ₁ = {fmt(model.values[0], 3)}</div>
          <div style={{ color: '#4ade80' }}>λ₂ = {fmt(model.values[1], 3)}</div>
          <div style={{ color: '#f87171' }}>λ₃ = {fmt(model.values[2], 3)}</div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- choosing k

const DIM8 = 8

function ChooseK() {
  const t = useT(T)
  const [k, setK] = useState(3)

  const model = useMemo(() => {
    const g = makeGauss(99)
    // random orthonormal mixing matrix via Gram-Schmidt
    const B: number[][] = Array.from({ length: DIM8 }, () =>
      Array.from({ length: DIM8 }, () => g()),
    )
    for (let i = 0; i < DIM8; i++) {
      for (let j = 0; j < i; j++) {
        const d = B[i].reduce((s, v, kk) => s + v * B[j][kk], 0)
        B[i] = B[i].map((v, kk) => v - d * B[j][kk])
      }
      const nrm = Math.sqrt(B[i].reduce((s, v) => s + v * v, 0))
      B[i] = B[i].map((v) => v / nrm)
    }
    const stds = [2.0, 1.25, 0.8, 0.16, 0.15, 0.14, 0.13, 0.12]
    const X: number[][] = Array.from({ length: 240 }, () => {
      const latent = stds.map((s) => g() * s)
      return Array.from({ length: DIM8 }, (_, d) =>
        latent.reduce((s, l, j) => s + l * B[j][d], 0),
      )
    })
    return pcaFit(X)
  }, [])

  const total = model.values.reduce((a, b) => a + b, 0)
  const cum = model.values.reduce<number[]>((acc, v) => {
    acc.push((acc.length ? acc[acc.length - 1] : 0) + v)
    return acc
  }, [])
  const cumShare = cum.map((c) => c / total)
  const reconRms = Math.sqrt(model.values.slice(k).reduce((a, b) => a + b, 0))

  const PW = 520
  const PH = 260
  const bw = (PW - 70) / DIM8
  const maxV = model.values[0]

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          {model.values.map((v, i) => {
            const h = (v / maxV) * (PH - 70)
            return (
              <g key={i}>
                <rect
                  x={40 + i * bw + 4}
                  y={PH - 40 - h}
                  width={bw - 8}
                  height={h}
                  rx={3}
                  fill={i < k ? '#a78bfa' : 'rgba(139,147,167,0.35)'}
                />
                <text x={40 + i * bw + bw / 2} y={PH - 24} fill="#8b93a7" fontSize={11} textAnchor="middle">
                  {i + 1}
                </text>
              </g>
            )
          })}
          <polyline
            points={cumShare.map((c, i) => `${40 + i * bw + bw / 2},${PH - 40 - c * (PH - 70)}`).join(' ')}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={2}
          />
          {cumShare.map((c, i) => (
            <circle key={i} cx={40 + i * bw + bw / 2} cy={PH - 40 - c * (PH - 70)} r={3.5} fill="#22d3ee" />
          ))}
          <text x={PW - 12} y={20} fill="#22d3ee" fontSize={11} textAnchor="end" fontFamily="JetBrains Mono, monospace">
            Σλ cumulative
          </text>
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad">
          <Slider label={t.chooseK} value={k} min={1} max={8} step={1} onChange={setK} format={(v) => `${v} / 8`} accent="#a78bfa" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.chooseCum} value={fmt(cumShare[k - 1] * 100, 1)} unit="%" accent={cumShare[k - 1] > 0.95 ? '#4ade80' : undefined} />
          <Readout label={t.chooseErr} value={fmt(reconRms, 2)} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- application: machine health

// healthy history: correlated cloud in (RMS mm/s, crest factor)
const HEALTH_DATA: number[][] = (() => {
  const g = makeGauss(42)
  return Array.from({ length: 90 }, () => {
    const a = g()
    const b = g()
    return [2.2 + 0.45 * a, 3.1 + 0.28 * a + 0.18 * b]
  })
})()
const HEALTH_PCA = pcaFit(HEALTH_DATA)

function mahalanobis(m: { mean: number[]; values: number[]; vectors: number[][] }, x: number[]): number {
  const c = x.map((v, i) => v - m.mean[i])
  let s = 0
  for (let j = 0; j < m.vectors.length; j++) {
    const proj = m.vectors[j].reduce((acc, vi, i) => acc + vi * c[i], 0)
    s += (proj * proj) / Math.max(m.values[j], 1e-9)
  }
  return Math.sqrt(s)
}

function HealthLab() {
  const t = useT(T)
  const [wear, setWear] = useState(0)

  // wear pushes the operating point along a fault direction: RMS up, crest up faster
  const live = [2.2 + wear * 1.6, 3.1 + wear * 2.4]
  const score = mahalanobis(HEALTH_PCA, live)
  const state = score < 3 ? 0 : score < 5 ? 1 : 2
  const color = state === 0 ? '#4ade80' : state === 1 ? '#fbbf24' : '#f87171'

  const PW = 520
  const PH = 320
  const sx = (v: number) => ((v - 1) / 4) * PW
  const sy = (v: number) => PH - ((v - 2) / 3.6) * PH

  const angle = (Math.atan2(HEALTH_PCA.vectors[0][1], HEALTH_PCA.vectors[0][0]) * 180) / Math.PI
  const r1 = Math.sqrt(HEALTH_PCA.values[0])
  const r2 = Math.sqrt(HEALTH_PCA.values[1])

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          {[1, 2, 3].map((k) => (
            <ellipse
              key={k}
              cx={sx(HEALTH_PCA.mean[0])}
              cy={sy(HEALTH_PCA.mean[1])}
              rx={((k * r1) / 4) * PW}
              ry={((k * r2) / 3.6) * PH}
              transform={`rotate(${-angle} ${sx(HEALTH_PCA.mean[0])} ${sy(HEALTH_PCA.mean[1])})`}
              fill="none"
              stroke={k === 3 ? '#f8717155' : '#22d3ee33'}
              strokeWidth={k === 3 ? 2 : 1.2}
              strokeDasharray={k === 3 ? '6 4' : undefined}
            />
          ))}
          {HEALTH_DATA.map((p, i) => (
            <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={2.6} fill="#22d3ee88" />
          ))}
          <circle cx={sx(live[0])} cy={sy(live[1])} r={7} fill={color} stroke="#0a0e17" strokeWidth={2} />
          <text x={10} y={18} fill="#8b93a7" fontSize={11} fontFamily="JetBrains Mono, monospace">
            crest factor ↑
          </text>
          <text x={PW - 10} y={PH - 8} textAnchor="end" fill="#8b93a7" fontSize={11} fontFamily="JetBrains Mono, monospace">
            RMS (mm/s) →
          </text>
        </svg>
        <div className="flex items-center gap-4 border-t border-white/10 px-4 py-2 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[#22d3ee88]" /> {t.appLegendHealthy}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} /> {t.appLegendNow}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad">
          <Slider label={t.appWear} value={wear} min={0} max={1} step={0.01} onChange={setWear} format={(v) => `${fmt(v * 100, 0)} %`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.appScore} value={fmt(score, 2)} accent={color} />
          <Readout label={t.appState} value={state === 0 ? t.appOk : state === 1 ? t.appWarn : t.appAlarm} accent={color} />
        </div>
        <div className="card-pad">
          <TeX block>{String.raw`d_M(\mathbf{x}) = \sqrt{\sum_j \frac{\big(\mathbf{w}_j^{\mathsf T}(\mathbf{x}-\boldsymbol{\mu})\big)^2}{\lambda_j}}`}</TeX>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function PcaPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'why', label: t.whyTitle },
          { id: 'lab2d', label: t.labTitle },
          { id: 'vsreg', label: t.vsTitle },
          { id: 'math', label: t.mathTitle },
          { id: 'lab3d', label: t.lab3dTitle },
          { id: 'choosek', label: t.chooseTitle },
          { id: 'code', label: t.codeTitle },
          { id: 'application', label: t.appTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="why" title={t.whyTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.why1}</p>
          <ul>
            {t.whyList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p>{t.why2}</p>
        </div>
      </Section>

      <Section id="lab2d" title={t.labTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.lab1}</p>
        </div>
        <div className="mt-4">
          <Pca2DLab />
        </div>
        <InfoBox title="⚡ Try it">
          <ul className="my-1 list-disc space-y-1 pl-5">
            {t.labTry.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </InfoBox>
      </Section>

      <Section id="vsreg" title={t.vsTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.vs1}</p>
        </div>
        <div className="mt-4">
          <VsRegression />
        </div>
      </Section>

      <Section id="math" title={t.mathTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.math1}</p>
          <TeX block>{String.raw`C \;=\; \frac{1}{n-1}\sum_{i=1}^{n} (\mathbf{x}_i - \boldsymbol{\mu})(\mathbf{x}_i - \boldsymbol{\mu})^{\mathsf T}`}</TeX>
          <p>{t.math2}</p>
          <TeX block>{String.raw`\max_{\lVert \mathbf{w}\rVert = 1} \; \mathbf{w}^{\mathsf T} C\, \mathbf{w} \qquad\Longrightarrow\qquad C\,\mathbf{w} = \lambda\,\mathbf{w}`}</TeX>
          <p>{t.math3}</p>
        </div>
      </Section>

      <Section id="lab3d" title={t.lab3dTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.lab3d1}</p>
        </div>
        <div className="mt-4">
          <Pca3DLab />
        </div>
      </Section>

      <Section id="choosek" title={t.chooseTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.choose1}</p>
        </div>
        <div className="mt-4">
          <ChooseK />
        </div>
        <InfoBox tone="warn">{t.tipScale}</InfoBox>
      </Section>

      <Section id="code" title={t.codeTitle}>
        <pre className="card overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-ink/85">{SNIPPET}</pre>
      </Section>

      <Section id="application" title={t.appTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.appIntro}</p>
        </div>
        <div className="mt-4">
          <HealthLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
