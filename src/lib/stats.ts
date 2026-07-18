/**
 * Statistics toolkit for the Data & Patterns track: seeded dataset generators,
 * covariance + Jacobi eigendecomposition (→ PCA), and k-means primitives.
 */

import { mulberry32 } from './math'

export type P2 = [number, number]

export interface LabeledPoint {
  p: P2
  label: number
}

// ---------------------------------------------------------------- random sampling

/** Standard-normal sampler (Box–Muller) on top of a seeded uniform generator. */
export function makeGauss(seed: number): () => number {
  const rand = mulberry32(seed)
  let spare: number | null = null
  return () => {
    if (spare !== null) {
      const v = spare
      spare = null
      return v
    }
    const u = Math.max(rand(), 1e-12)
    const v = rand()
    const r = Math.sqrt(-2 * Math.log(u))
    spare = r * Math.sin(2 * Math.PI * v)
    return r * Math.cos(2 * Math.PI * v)
  }
}

// ---------------------------------------------------------------- 2D dataset generators

/** Rotated anisotropic gaussian cloud centered at (cx, cy). */
export function cloud2D(
  n: number,
  sx: number,
  sy: number,
  thetaDeg: number,
  seed: number,
  cx = 0,
  cy = 0,
): P2[] {
  const g = makeGauss(seed)
  const th = (thetaDeg * Math.PI) / 180
  const c = Math.cos(th)
  const s = Math.sin(th)
  return Array.from({ length: n }, () => {
    const x = g() * sx
    const y = g() * sy
    return [cx + c * x - s * y, cy + s * x + c * y] as P2
  })
}

export function blobs(nPer: number, centers: P2[], sigma: number, seed: number): LabeledPoint[] {
  const g = makeGauss(seed)
  const out: LabeledPoint[] = []
  centers.forEach((cen, label) => {
    for (let i = 0; i < nPer; i++)
      out.push({ p: [cen[0] + g() * sigma, cen[1] + g() * sigma], label })
  })
  return out
}

export function moons(nPer: number, noise: number, seed: number): LabeledPoint[] {
  const rand = mulberry32(seed)
  const g = makeGauss(seed + 1)
  const out: LabeledPoint[] = []
  for (let i = 0; i < nPer; i++) {
    const t = Math.PI * rand()
    out.push({ p: [Math.cos(t) - 0.5 + g() * noise, Math.sin(t) - 0.25 + g() * noise], label: 0 })
    const t2 = Math.PI * rand()
    out.push({ p: [0.5 - Math.cos(t2) + g() * noise, 0.25 - Math.sin(t2) + g() * noise], label: 1 })
  }
  return out
}

export function rings(nPer: number, noise: number, seed: number): LabeledPoint[] {
  const rand = mulberry32(seed)
  const g = makeGauss(seed + 1)
  const out: LabeledPoint[] = []
  for (let i = 0; i < nPer; i++) {
    const t = 2 * Math.PI * rand()
    out.push({ p: [0.45 * Math.cos(t) + g() * noise, 0.45 * Math.sin(t) + g() * noise], label: 0 })
    const t2 = 2 * Math.PI * rand()
    out.push({ p: [1.05 * Math.cos(t2) + g() * noise, 1.05 * Math.sin(t2) + g() * noise], label: 1 })
  }
  return out
}

/** Two interleaved spirals (classic hard 2-class problem). */
export function spirals(nPer: number, noise: number, seed: number): LabeledPoint[] {
  const g = makeGauss(seed)
  const out: LabeledPoint[] = []
  for (let cls = 0; cls < 2; cls++) {
    for (let i = 0; i < nPer; i++) {
      const r = (i / nPer) * 1.1 + 0.05
      const t = 1.75 * (i / nPer) * 2 * Math.PI + cls * Math.PI
      out.push({
        p: [r * Math.sin(t) + g() * noise, r * Math.cos(t) + g() * noise],
        label: cls,
      })
    }
  }
  return out
}

export function xorData(nPer: number, noise: number, seed: number): LabeledPoint[] {
  const rand = mulberry32(seed)
  const g = makeGauss(seed + 1)
  const out: LabeledPoint[] = []
  for (let i = 0; i < nPer * 4; i++) {
    const x = rand() > 0.5 ? 1 : -1
    const y = rand() > 0.5 ? 1 : -1
    out.push({
      p: [x * 0.55 + g() * (0.18 + noise), y * 0.55 + g() * (0.18 + noise)],
      label: x * y > 0 ? 0 : 1,
    })
  }
  return out
}

export function circlesData(nPer: number, noise: number, seed: number): LabeledPoint[] {
  const rand = mulberry32(seed)
  const g = makeGauss(seed + 1)
  const out: LabeledPoint[] = []
  for (let i = 0; i < nPer; i++) {
    const t = 2 * Math.PI * rand()
    const r1 = 0.35 * Math.sqrt(rand())
    out.push({ p: [r1 * Math.cos(t) + g() * noise, r1 * Math.sin(t) + g() * noise], label: 0 })
    const t2 = 2 * Math.PI * rand()
    const r2 = 0.75 + 0.3 * rand()
    out.push({ p: [r2 * Math.cos(t2) + g() * noise, r2 * Math.sin(t2) + g() * noise], label: 1 })
  }
  return out
}

export function uniform2D(n: number, seed: number, half = 1.2): P2[] {
  const rand = mulberry32(seed)
  return Array.from({ length: n }, () => [(rand() * 2 - 1) * half, (rand() * 2 - 1) * half] as P2)
}

// ---------------------------------------------------------------- covariance & eigen

export function meanVec(X: number[][]): number[] {
  const d = X[0].length
  const m = new Array(d).fill(0)
  for (const x of X) for (let j = 0; j < d; j++) m[j] += x[j]
  return m.map((v) => v / X.length)
}

/** Sample covariance matrix (d×d). */
export function covariance(X: number[][]): number[][] {
  const d = X[0].length
  const m = meanVec(X)
  const C = Array.from({ length: d }, () => new Array(d).fill(0))
  for (const x of X)
    for (let i = 0; i < d; i++)
      for (let j = i; j < d; j++) C[i][j] += (x[i] - m[i]) * (x[j] - m[j])
  const denom = Math.max(X.length - 1, 1)
  for (let i = 0; i < d; i++)
    for (let j = i; j < d; j++) {
      C[i][j] /= denom
      C[j][i] = C[i][j]
    }
  return C
}

export interface EigenResult {
  /** eigenvalues, sorted descending */
  values: number[]
  /** vectors[i] is the unit eigenvector for values[i] */
  vectors: number[][]
}

/** Cyclic Jacobi eigendecomposition for small symmetric matrices. */
export function jacobiEigen(Ain: number[][]): EigenResult {
  const n = Ain.length
  const A = Ain.map((row) => [...row])
  const V: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  )
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q]
    if (off < 1e-18) break
    for (let p = 0; p < n - 1; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q])
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < n; k++) {
          const akp = A[k][p]
          const akq = A[k][q]
          A[k][p] = c * akp - s * akq
          A[k][q] = s * akp + c * akq
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k]
          const aqk = A[q][k]
          A[p][k] = c * apk - s * aqk
          A[q][k] = s * apk + c * aqk
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p]
          const vkq = V[k][q]
          V[k][p] = c * vkp - s * vkq
          V[k][q] = s * vkp + c * vkq
        }
      }
  }
  const pairs = Array.from({ length: n }, (_, i) => ({
    value: A[i][i],
    vector: V.map((row) => row[i]),
  }))
  pairs.sort((a, b) => b.value - a.value)
  return { values: pairs.map((p) => p.value), vectors: pairs.map((p) => p.vector) }
}

// ---------------------------------------------------------------- PCA

export interface PcaModel {
  mean: number[]
  values: number[]
  vectors: number[][]
}

export function pcaFit(X: number[][]): PcaModel {
  const eig = jacobiEigen(covariance(X))
  return { mean: meanVec(X), values: eig.values, vectors: eig.vectors }
}

/** Coordinates of x in the PCA basis (first k components). */
export function pcaProject(m: PcaModel, x: number[], k: number): number[] {
  const c = x.map((v, i) => v - m.mean[i])
  return m.vectors.slice(0, k).map((v) => v.reduce((s, vi, i) => s + vi * c[i], 0))
}

/** Reconstruct x from its first k PCA coordinates. */
export function pcaReconstruct(m: PcaModel, x: number[], k: number): number[] {
  const coords = pcaProject(m, x, k)
  const out = [...m.mean]
  for (let j = 0; j < k; j++)
    for (let i = 0; i < out.length; i++) out[i] += coords[j] * m.vectors[j][i]
  return out
}

// ---------------------------------------------------------------- k-means

export const dist2 = (a: P2, b: P2): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2

export function assignClusters(pts: P2[], centroids: P2[]): number[] {
  return pts.map((p) => {
    let best = 0
    let bd = Infinity
    centroids.forEach((c, i) => {
      const d = dist2(p, c)
      if (d < bd) {
        bd = d
        best = i
      }
    })
    return best
  })
}

/** Mean of each cluster; empty clusters keep their previous centroid. */
export function updateCentroids(pts: P2[], labels: number[], prev: P2[]): P2[] {
  const k = prev.length
  const sums: [number, number, number][] = Array.from({ length: k }, () => [0, 0, 0])
  pts.forEach((p, i) => {
    const s = sums[labels[i]]
    s[0] += p[0]
    s[1] += p[1]
    s[2]++
  })
  return sums.map((s, i) => (s[2] > 0 ? ([s[0] / s[2], s[1] / s[2]] as P2) : prev[i]))
}

export function wcss(pts: P2[], labels: number[], centroids: P2[]): number {
  let s = 0
  pts.forEach((p, i) => (s += dist2(p, centroids[labels[i]])))
  return s
}

export function randomInit(pts: P2[], k: number, rand: () => number): P2[] {
  const idx = new Set<number>()
  while (idx.size < Math.min(k, pts.length)) idx.add(Math.floor(rand() * pts.length))
  return [...idx].map((i) => [...pts[i]] as P2)
}

/** k-means++ seeding: each new centroid is sampled ∝ squared distance to the nearest existing one. */
export function kppInit(pts: P2[], k: number, rand: () => number): P2[] {
  const centroids: P2[] = [[...pts[Math.floor(rand() * pts.length)]] as P2]
  while (centroids.length < k) {
    const d2 = pts.map((p) => Math.min(...centroids.map((c) => dist2(p, c))))
    const total = d2.reduce((a, b) => a + b, 0)
    let r = rand() * total
    let pick = 0
    for (let i = 0; i < pts.length; i++) {
      r -= d2[i]
      if (r <= 0) {
        pick = i
        break
      }
    }
    centroids.push([...pts[pick]] as P2)
  }
  return centroids
}

// ---------------------------------------------------------------- Gaussian mixture (2D, full covariance)

export interface Gmm2 {
  weights: number[]
  means: P2[]
  /** per-component covariance as [σxx, σxy, σyy] */
  covs: [number, number, number][]
}

const REG = 1e-4

function gauss2pdf(p: P2, m: P2, c: [number, number, number]): number {
  const [sxx, sxy, syy] = [c[0] + REG, c[1], c[2] + REG]
  const det = sxx * syy - sxy * sxy
  const dx = p[0] - m[0]
  const dy = p[1] - m[1]
  const q = (syy * dx * dx - 2 * sxy * dx * dy + sxx * dy * dy) / det
  return Math.exp(-0.5 * q) / (2 * Math.PI * Math.sqrt(det))
}

export function gmmInit(pts: P2[], k: number, rand: () => number): Gmm2 {
  const means = kppInit(pts, k, rand)
  const varAll =
    pts.reduce((s, p) => s + p[0] * p[0] + p[1] * p[1], 0) / pts.length / 4 + 0.05
  return {
    weights: new Array(k).fill(1 / k),
    means,
    covs: Array.from({ length: k }, () => [varAll, 0, varAll] as [number, number, number]),
  }
}

/** E-step: responsibilities γ[i][k] = P(component k | point i). */
export function gmmEStep(pts: P2[], m: Gmm2): number[][] {
  return pts.map((p) => {
    const raw = m.means.map((mu, k) => m.weights[k] * gauss2pdf(p, mu, m.covs[k]))
    const sum = raw.reduce((a, b) => a + b, 0) || 1e-300
    return raw.map((r) => r / sum)
  })
}

/** M-step: re-estimate weights, means and covariances from responsibilities. */
export function gmmMStep(pts: P2[], resp: number[][], k: number): Gmm2 {
  const n = pts.length
  const Nk = Array.from({ length: k }, (_, kk) => resp.reduce((s, r) => s + r[kk], 0))
  const means = Array.from({ length: k }, (_, kk) => {
    let mx = 0
    let my = 0
    pts.forEach((p, i) => {
      mx += resp[i][kk] * p[0]
      my += resp[i][kk] * p[1]
    })
    return [mx / Nk[kk], my / Nk[kk]] as P2
  })
  const covs = Array.from({ length: k }, (_, kk) => {
    let sxx = 0
    let sxy = 0
    let syy = 0
    pts.forEach((p, i) => {
      const dx = p[0] - means[kk][0]
      const dy = p[1] - means[kk][1]
      sxx += resp[i][kk] * dx * dx
      sxy += resp[i][kk] * dx * dy
      syy += resp[i][kk] * dy * dy
    })
    return [sxx / Nk[kk], sxy / Nk[kk], syy / Nk[kk]] as [number, number, number]
  })
  return { weights: Nk.map((v) => v / n), means, covs }
}

export function gmmLogLik(pts: P2[], m: Gmm2): number {
  return pts.reduce((s, p) => {
    const lik = m.means.reduce((a, mu, k) => a + m.weights[k] * gauss2pdf(p, mu, m.covs[k]), 0)
    return s + Math.log(Math.max(lik, 1e-300))
  }, 0)
}

// ---------------------------------------------------------------- DBSCAN

/** Density-based clustering. Returns labels (−1 = noise) and the core-point mask. */
export function dbscan(
  pts: P2[],
  eps: number,
  minPts: number,
): { labels: number[]; core: boolean[] } {
  const n = pts.length
  const eps2 = eps * eps
  const neighbors = pts.map((p, i) => {
    const list: number[] = []
    for (let j = 0; j < n; j++) if (j !== i && dist2(p, pts[j]) <= eps2) list.push(j)
    return list
  })
  const core = neighbors.map((nb) => nb.length + 1 >= minPts)
  const labels = new Array(n).fill(-2) // -2 unvisited, -1 noise
  let cluster = 0
  for (let i = 0; i < n; i++) {
    if (labels[i] !== -2) continue
    if (!core[i]) {
      labels[i] = -1
      continue
    }
    labels[i] = cluster
    const queue = [...neighbors[i]]
    while (queue.length) {
      const j = queue.pop()!
      if (labels[j] === -1) labels[j] = cluster // border point
      if (labels[j] !== -2) continue
      labels[j] = cluster
      if (core[j]) queue.push(...neighbors[j])
    }
    cluster++
  }
  return { labels, core }
}

/** Run k-means to convergence (for elbow plots); returns the final WCSS. */
export function kmeansRun(pts: P2[], k: number, seed: number, maxIter = 50): number {
  const rand = mulberry32(seed)
  let centroids = kppInit(pts, k, rand)
  let labels = assignClusters(pts, centroids)
  for (let it = 0; it < maxIter; it++) {
    const next = updateCentroids(pts, labels, centroids)
    const nextLabels = assignClusters(pts, next)
    const done = nextLabels.every((l, i) => l === labels[i])
    centroids = next
    labels = nextLabels
    if (done) break
  }
  return wcss(pts, labels, centroids)
}
