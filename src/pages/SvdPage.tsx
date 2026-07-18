import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Slider } from '../components/ui'
import { fmt } from '../lib/math'
import { jacobiEigen } from '../lib/stats'

const T = {
  en: {
    kicker: 'Math · Module 2',
    title: 'SVD & Linear Algebra',
    intro:
      'The singular value decomposition is the master theorem of applied linear algebra: every matrix — every linear map, every dataset, every image — is a rotation, followed by axis-aligned stretching, followed by another rotation. Once you see it, half the tricks of this site (PCA, least squares, homographies, compression) become one trick.',
    transTitle: 'Interactive: a matrix is rotate → stretch → rotate',
    trans1: 'Set the four entries of a 2×2 matrix A and watch what it does to the unit circle: always an ellipse. The dashed input directions v₁, v₂ are special — they are the only orthogonal pair that stays orthogonal, landing on the ellipse axes σ₁u₁, σ₂u₂. Now pull the animation slider: the same total transformation, performed as the SVD stages it — first rotate (Vᵀ), then stretch along the axes (Σ), then rotate again (U). Any A, always these three steps.',
    trans2: 'Push the determinant toward zero (make the rows nearly parallel): σ₂ collapses, the ellipse flattens to a line — the matrix loses a dimension. That is rank deficiency, and σ₂ ≈ 0 is how software detects it.',
    anim: 'animation: I → Vᵀ → ΣVᵀ → UΣVᵀ',
    detLabel: 'det A',
    rankLabel: 'rank',
    mathTitle: 'The decomposition',
    math1: 'Formally, any real matrix factors as',
    math2: 'with orthogonal U, V and non-negative singular values σ₁ ≥ σ₂ ≥ … on the diagonal of Σ. The σᵢ are the stretch factors, the columns of V the input directions, the columns of U the output directions. Connection to eigenvalues: V holds the eigenvectors of AᵀA, and σᵢ² its eigenvalues — which is exactly how the demos on this page compute it.',
    compTitle: 'Interactive: low-rank approximation — compressing an image',
    comp1: 'An image is a matrix of gray values. The SVD sorts its "patterns" by importance: keeping only the k strongest rank-1 layers gives the best possible rank-k approximation (Eckart–Young theorem). Slide k: a handful of layers already carries the picture; the rest is detail and noise. This is the essence of every compression and denoising trick based on SVD.',
    rank: 'rank k',
    storage: 'storage',
    rms: 'reconstruction RMS',
    original: 'original (48×48)',
    reconstructed: 'rank-k reconstruction',
    spectrum: 'singular values σᵢ',
    whereTitle: 'Where the SVD hides in this site',
    whereList: [
      'PCA (Data track) is the SVD of the centered data matrix: principal axes = right singular vectors, variances = σᵢ²/(n−1).',
      'Least squares and the pseudoinverse: A⁺ = VΣ⁺Uᵀ solves min‖Ax−b‖ even for singular A — the numerically sound way to solve the normal equations of the ML track.',
      'Homography and fundamental-matrix estimation (Vision track) solve Ah = 0 by taking the right singular vector of the smallest σ.',
      'Condition number = σ₁/σₙ — the ill-conditioning that tortured gradient descent in the optimization modules, quantified in one ratio.',
    ],
    codeTitle: 'In practice',
  },
  de: {
    kicker: 'Mathe · Modul 2',
    title: 'SVD & Lineare Algebra',
    intro:
      'Die Singulärwertzerlegung ist der Meistersatz der angewandten linearen Algebra: Jede Matrix — jede lineare Abbildung, jeder Datensatz, jedes Bild — ist eine Drehung, gefolgt von achsparallelem Strecken, gefolgt von einer weiteren Drehung. Hat man das einmal gesehen, werden die halben Tricks dieser Seite (PCA, Ausgleichsrechnung, Homographien, Kompression) zu einem einzigen Trick.',
    transTitle: 'Interaktiv: eine Matrix ist Drehen → Strecken → Drehen',
    trans1: 'Stelle die vier Einträge einer 2×2-Matrix A ein und beobachte, was sie mit dem Einheitskreis macht: immer eine Ellipse. Die gestrichelten Eingaberichtungen v₁, v₂ sind besonders — sie sind das einzige orthogonale Paar, das orthogonal bleibt und auf den Ellipsenachsen σ₁u₁, σ₂u₂ landet. Ziehe nun den Animations-Slider: dieselbe Gesamttransformation, ausgeführt wie die SVD sie zerlegt — erst drehen (Vᵀ), dann entlang der Achsen strecken (Σ), dann wieder drehen (U). Jedes A, immer diese drei Schritte.',
    trans2: 'Schiebe die Determinante gegen null (mache die Zeilen fast parallel): σ₂ kollabiert, die Ellipse plättet sich zu einer Linie — die Matrix verliert eine Dimension. Das ist Rangdefizit, und σ₂ ≈ 0 ist, wie Software es erkennt.',
    anim: 'Animation: I → Vᵀ → ΣVᵀ → UΣVᵀ',
    detLabel: 'det A',
    rankLabel: 'Rang',
    mathTitle: 'Die Zerlegung',
    math1: 'Formal faktorisiert jede reelle Matrix als',
    math2: 'mit orthogonalen U, V und nichtnegativen Singulärwerten σ₁ ≥ σ₂ ≥ … auf der Diagonale von Σ. Die σᵢ sind die Streckfaktoren, die Spalten von V die Eingaberichtungen, die Spalten von U die Ausgaberichtungen. Verbindung zu Eigenwerten: V enthält die Eigenvektoren von AᵀA, und σᵢ² dessen Eigenwerte — genau so rechnen die Demos dieser Seite.',
    compTitle: 'Interaktiv: Niedrigrang-Approximation — ein Bild komprimieren',
    comp1: 'Ein Bild ist eine Matrix aus Grauwerten. Die SVD sortiert seine „Muster“ nach Wichtigkeit: Nur die k stärksten Rang-1-Schichten zu behalten liefert die bestmögliche Rang-k-Approximation (Satz von Eckart–Young). Schiebe k: Eine Handvoll Schichten trägt bereits das Bild; der Rest ist Detail und Rauschen. Das ist die Essenz jedes SVD-basierten Kompressions- und Entrauschungstricks.',
    rank: 'Rang k',
    storage: 'Speicher',
    rms: 'Rekonstruktions-RMS',
    original: 'Original (48×48)',
    reconstructed: 'Rang-k-Rekonstruktion',
    spectrum: 'Singulärwerte σᵢ',
    whereTitle: 'Wo sich die SVD auf dieser Seite versteckt',
    whereList: [
      'PCA (Daten-Track) ist die SVD der zentrierten Datenmatrix: Hauptachsen = rechte Singulärvektoren, Varianzen = σᵢ²/(n−1).',
      'Ausgleichsrechnung und Pseudoinverse: A⁺ = VΣ⁺Uᵀ löst min‖Ax−b‖ selbst für singuläres A — der numerisch saubere Weg für die Normalengleichungen des ML-Tracks.',
      'Homographie- und Fundamentalmatrix-Schätzung (Vision-Track) lösen Ah = 0 über den rechten Singulärvektor zum kleinsten σ.',
      'Konditionszahl = σ₁/σₙ — die schlechte Konditionierung, die den Gradientenabstieg in den Optimierungsmodulen quälte, in einem Verhältnis quantifiziert.',
    ],
    codeTitle: 'In der Praxis',
  },
}

const SNIPPET = `import numpy as np

U, s, Vt = np.linalg.svd(A, full_matrices=False)
print(s)                                  # singular values, sorted

k = 8                                     # best rank-k approximation
A_k = U[:, :k] @ np.diag(s[:k]) @ Vt[:k]

x = np.linalg.pinv(A) @ b                 # least squares via SVD
print(s[0] / s[-1])                       # condition number`

// ---------------------------------------------------------------- 2x2 SVD helpers

interface Svd2 {
  thetaV: number
  thetaU: number
  s1: number
  s2: number // signed: reflection folded in
  v1: [number, number]
  v2: [number, number]
  u1: [number, number]
  u2: [number, number]
}

function svd2(a: number, b: number, c: number, d: number): Svd2 {
  const det = a * d - b * c
  const eig = jacobiEigen([
    [a * a + c * c, a * b + c * d],
    [a * b + c * d, b * b + d * d],
  ])
  let v1 = eig.vectors[0] as [number, number]
  const s1 = Math.sqrt(Math.max(eig.values[0], 0))
  const s2raw = Math.sqrt(Math.max(eig.values[1], 0))
  // force det(V) = +1: v2 = perp(v1)
  const v2: [number, number] = [-v1[1], v1[0]]
  const s2 = s2raw * (det >= 0 ? 1 : -1)
  const apply = (v: [number, number]): [number, number] => [a * v[0] + b * v[1], c * v[0] + d * v[1]]
  const Av1 = apply(v1)
  const Av2 = apply(v2)
  const u1: [number, number] = s1 > 1e-9 ? [Av1[0] / s1, Av1[1] / s1] : [1, 0]
  const u2: [number, number] =
    Math.abs(s2) > 1e-9 ? [Av2[0] / s2, Av2[1] / s2] : [-u1[1], u1[0]]
  return {
    thetaV: Math.atan2(v1[1], v1[0]),
    thetaU: Math.atan2(u1[1], u1[0]),
    s1,
    s2,
    v1,
    v2,
    u1,
    u2,
  }
}

// ---------------------------------------------------------------- transformer lab

const TW = 480
const TH = 440
const TR = 3.0
const tx = (x: number) => ((x + TR) / (2 * TR)) * TW
const ty = (y: number) => TH - ((y + TR) / (2 * TR)) * TH

function TransformerLab() {
  const t = useT(T)
  const [a, setA] = useState(1.4)
  const [b, setB] = useState(0.7)
  const [c, setC] = useState(-0.3)
  const [d, setD] = useState(0.9)
  const [anim, setAnim] = useState(3)

  const s = useMemo(() => svd2(a, b, c, d), [a, b, c, d])
  const det = a * d - b * c

  // staged transform: rotate by -thetaV (stage 1), scale (stage 2), rotate by thetaU (stage 3)
  const stage = (p: [number, number]): [number, number] => {
    const t1 = Math.min(anim, 1)
    const t2 = Math.min(Math.max(anim - 1, 0), 1)
    const t3 = Math.min(Math.max(anim - 2, 0), 1)
    const r1 = -s.thetaV * t1
    let x = p[0] * Math.cos(r1) - p[1] * Math.sin(r1)
    let y = p[0] * Math.sin(r1) + p[1] * Math.cos(r1)
    const sx = 1 + (s.s1 - 1) * t2
    const sy = 1 + (s.s2 - 1) * t2
    x *= sx
    y *= sy
    const r3 = s.thetaU * t3
    return [x * Math.cos(r3) - y * Math.sin(r3), x * Math.sin(r3) + y * Math.cos(r3)]
  }

  const circle = Array.from({ length: 73 }, (_, i) => {
    const ang = (i / 72) * 2 * Math.PI
    return stage([Math.cos(ang), Math.sin(ang)])
  })
  const gridLines: [number, number][][] = []
  for (let g = -2; g <= 2; g++) {
    gridLines.push(Array.from({ length: 25 }, (_, i) => stage([g * 0.5, -1.5 + (i / 24) * 3])))
    gridLines.push(Array.from({ length: 25 }, (_, i) => stage([-1.5 + (i / 24) * 3, g * 0.5])))
  }
  const axisEnd1 = stage(s.v1)
  const axisEnd2 = stage(s.v2)

  const rank = Math.abs(s.s2) < 0.04 ? (s.s1 < 0.04 ? 0 : 1) : 2

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${TW} ${TH}`} className="block w-full" style={{ background: 'radial-gradient(120% 120% at 50% 40%, #141a28 0%, #0a0e17 100%)' }}>
          {gridLines.map((line, i) => (
            <polyline key={i} points={line.map((p) => `${tx(p[0])},${ty(p[1])}`).join(' ')} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          ))}
          <polyline points={circle.map((p) => `${tx(p[0])},${ty(p[1])}`).join(' ')} fill="rgba(34,211,238,0.08)" stroke="#22d3ee" strokeWidth={2.2} />
          {/* input singular directions (dashed, at unit length) */}
          <line x1={tx(0)} y1={ty(0)} x2={tx(s.v1[0])} y2={ty(s.v1[1])} stroke="rgba(167,139,250,0.5)" strokeWidth={1.5} strokeDasharray="4 3" />
          <line x1={tx(0)} y1={ty(0)} x2={tx(s.v2[0])} y2={ty(s.v2[1])} stroke="rgba(74,222,128,0.5)" strokeWidth={1.5} strokeDasharray="4 3" />
          {/* transformed axes */}
          <line x1={tx(0)} y1={ty(0)} x2={tx(axisEnd1[0])} y2={ty(axisEnd1[1])} stroke="#a78bfa" strokeWidth={3} />
          <line x1={tx(0)} y1={ty(0)} x2={tx(axisEnd2[0])} y2={ty(axisEnd2[1])} stroke="#4ade80" strokeWidth={2.5} />
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3">
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            <Slider label="a" value={a} min={-2} max={2} step={0.05} onChange={setA} format={(v) => fmt(v, 2)} />
            <Slider label="b" value={b} min={-2} max={2} step={0.05} onChange={setB} format={(v) => fmt(v, 2)} />
            <Slider label="c" value={c} min={-2} max={2} step={0.05} onChange={setC} format={(v) => fmt(v, 2)} />
            <Slider label="d" value={d} min={-2} max={2} step={0.05} onChange={setD} format={(v) => fmt(v, 2)} />
          </div>
          <Slider label={t.anim} value={anim} min={0} max={3} step={0.01} onChange={setAnim} format={(v) => fmt(v, 2)} accent="#fbbf24" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label="σ₁" value={fmt(s.s1, 2)} accent="#a78bfa" />
          <Readout label="σ₂" value={fmt(Math.abs(s.s2), 2)} accent="#4ade80" />
          <Readout label={t.detLabel} value={fmt(det, 2)} />
          <Readout label={t.rankLabel} value={`${rank}`} accent={rank < 2 ? '#f87171' : undefined} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- compression lab

const IMG_N = 48

function makeImage(): number[][] {
  const I: number[][] = Array.from({ length: IMG_N }, (_, y) =>
    Array.from({ length: IMG_N }, (_, x) => 0.25 + (0.35 * (x + y)) / (2 * IMG_N)),
  )
  const disk = (cx: number, cy: number, r: number, v: number) => {
    for (let y = 0; y < IMG_N; y++)
      for (let x = 0; x < IMG_N; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) I[y][x] = v
  }
  const rect = (x0: number, y0: number, w: number, h: number, v: number) => {
    for (let y = y0; y < Math.min(y0 + h, IMG_N); y++)
      for (let x = x0; x < Math.min(x0 + w, IMG_N); x++) I[y][x] = v
  }
  disk(16, 15, 9, 0.95)
  disk(16, 15, 4, 0.15)
  rect(28, 26, 14, 14, 0.85)
  rect(31, 29, 8, 8, 0.3)
  for (let i = 0; i < IMG_N; i++) {
    const y = IMG_N - 6 - Math.round(i * 0.25)
    if (y >= 0 && y < IMG_N) {
      I[y][i] = 0.9
      if (y + 1 < IMG_N) I[y + 1][i] = 0.9
    }
  }
  return I
}

interface ImgSvd {
  U: number[][] // columns u_i as U[i] (each length N)
  V: number[][] // columns v_i as V[i]
  s: number[]
}

function svdImage(A: number[][]): ImgSvd {
  const N = A.length
  // AtA
  const AtA: number[][] = Array.from({ length: N }, () => new Array(N).fill(0))
  for (let i = 0; i < N; i++)
    for (let j = i; j < N; j++) {
      let sum = 0
      for (let k = 0; k < N; k++) sum += A[k][i] * A[k][j]
      AtA[i][j] = sum
      AtA[j][i] = sum
    }
  const eig = jacobiEigen(AtA)
  const s = eig.values.map((v) => Math.sqrt(Math.max(v, 0)))
  const V = eig.vectors
  const U = V.map((v, i) => {
    const u = new Array(N).fill(0)
    if (s[i] > 1e-9)
      for (let r = 0; r < N; r++) {
        let sum = 0
        for (let k = 0; k < N; k++) sum += A[r][k] * v[k]
        u[r] = sum / s[i]
      }
    return u
  })
  return { U, V, s }
}

function reconstruct(svd: ImgSvd, k: number): number[][] {
  const N = svd.V[0].length
  const R: number[][] = Array.from({ length: N }, () => new Array(N).fill(0))
  for (let i = 0; i < k; i++) {
    const { s } = svd
    if (s[i] < 1e-9) break
    const u = svd.U[i]
    const v = svd.V[i]
    for (let r = 0; r < N; r++) for (let cIdx = 0; cIdx < N; cIdx++) R[r][cIdx] += s[i] * u[r] * v[cIdx]
  }
  return R
}

function GrayCanvas({ img, title }: { img: number[][]; title: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const N = img.length
    const data = ctx.createImageData(N, N)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const v = Math.round(Math.min(1, Math.max(0, img[y][x])) * 255)
        const p = (y * N + x) * 4
        data.data[p] = v
        data.data[p + 1] = v
        data.data[p + 2] = v
        data.data[p + 3] = 255
      }
    ctx.putImageData(data, 0, 0)
  }, [img])
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{title}</div>
      <canvas ref={ref} width={IMG_N} height={IMG_N} className="block w-full" style={{ imageRendering: 'pixelated' }} />
    </div>
  )
}

function CompressionLab() {
  const t = useT(T)
  const [k, setK] = useState(6)
  const original = useMemo(makeImage, [])
  const svd = useMemo(() => svdImage(original), [original])
  const recon = useMemo(() => reconstruct(svd, k), [svd, k])

  const rms = useMemo(() => {
    let s = 0
    for (let y = 0; y < IMG_N; y++)
      for (let x = 0; x < IMG_N; x++) s += (original[y][x] - recon[y][x]) ** 2
    return Math.sqrt(s / (IMG_N * IMG_N))
  }, [original, recon])

  const storagePct = (k * (2 * IMG_N + 1)) / (IMG_N * IMG_N)
  const SW = 400
  const SH = 160
  const maxS = svd.s[0]

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GrayCanvas img={original} title={t.original} />
        <GrayCanvas img={recon} title={`${t.reconstructed} (k = ${k})`} />
        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.spectrum}</div>
          <svg viewBox={`0 0 ${SW} ${SH}`} className="block h-full w-full">
            {svd.s.map((v, i) => (
              <rect
                key={i}
                x={8 + i * ((SW - 16) / IMG_N)}
                y={SH - 12 - (v / maxS) * (SH - 26)}
                width={(SW - 16) / IMG_N - 1.5}
                height={(v / maxS) * (SH - 26)}
                fill={i < k ? '#a78bfa' : 'rgba(139,147,167,0.3)'}
              />
            ))}
          </svg>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card-pad">
          <Slider label={t.rank} value={k} min={1} max={48} step={1} onChange={setK} format={(v) => `${v} / 48`} accent="#a78bfa" />
        </div>
        <div className="grid grid-cols-2 gap-3 self-start">
          <Readout label={t.storage} value={fmt(storagePct * 100, 1)} unit="%" accent={storagePct < 0.35 ? '#4ade80' : undefined} />
          <Readout label={t.rms} value={fmt(rms, 3)} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function SvdPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'transformer', label: t.transTitle },
          { id: 'math', label: t.mathTitle },
          { id: 'compression', label: t.compTitle },
          { id: 'where', label: t.whereTitle },
          { id: 'code', label: t.codeTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="transformer" title={t.transTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.trans1}</p>
        </div>
        <div className="mt-4">
          <TransformerLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.trans2}
        </InfoBox>
      </Section>

      <Section id="math" title={t.mathTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.math1}</p>
          <TeX block>{String.raw`A \;=\; U\,\Sigma\,V^{\mathsf T}, \qquad \Sigma = \mathrm{diag}(\sigma_1, \sigma_2, \dots), \quad \sigma_1 \ge \sigma_2 \ge \dots \ge 0`}</TeX>
          <p>{t.math2}</p>
        </div>
      </Section>

      <Section id="compression" title={t.compTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.comp1}</p>
        </div>
        <div className="mt-4">
          <CompressionLab />
        </div>
      </Section>

      <Section id="where" title={t.whereTitle}>
        <div className="prose-cv max-w-3xl">
          <ul>
            {t.whereList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="code" title={t.codeTitle}>
        <pre className="card overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-ink/85">{SNIPPET}</pre>
      </Section>
    </div>
  )
}
