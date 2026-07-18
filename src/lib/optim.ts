/**
 * Numerical optimization toolkit for the interactive demos:
 *  - 2D test functions with gradients (descent playground)
 *  - a real (small) camera-calibration least-squares problem solved by
 *    gradient descent or Levenberg–Marquardt, entirely in the browser.
 */

import {
  boardCorners,
  deg2rad,
  distortNormalized,
  m4MulChain,
  m4MulP,
  m4RotX,
  m4RotY,
  m4RotZ,
  m4Trans,
  mulberry32,
  type M4,
  type V3,
} from './math'

// ================================================================ 2D playground

export type Vec2 = [number, number]

export interface Fn2D {
  f: (x: number, y: number) => number
  grad: (x: number, y: number) => Vec2
  domain: { x: Vec2; y: Vec2 }
  minima: Vec2[]
  /** sensible starting point */
  start: Vec2
}

const twoPitsTerms = [
  { a: 1.6, x0: -1.0, y0: -0.4, s: 0.55 },
  { a: 1.1, x0: 1.15, y0: 0.75, s: 0.35 },
]

export const FN2D: Record<'bowl' | 'valley' | 'rosenbrock' | 'twopits', Fn2D> = {
  bowl: {
    f: (x, y) => 0.5 * (x * x + y * y),
    grad: (x, y) => [x, y],
    domain: { x: [-2.1, 2.1], y: [-2.1, 2.1] },
    minima: [[0, 0]],
    start: [-1.7, 1.4],
  },
  valley: {
    f: (x, y) => 0.5 * (x * x + 16 * y * y),
    grad: (x, y) => [x, 16 * y],
    domain: { x: [-2.1, 2.1], y: [-2.1, 2.1] },
    minima: [[0, 0]],
    start: [-1.9, 1.0],
  },
  rosenbrock: {
    f: (x, y) => (1 - x) ** 2 + 10 * (y - x * x) ** 2,
    grad: (x, y) => [-2 * (1 - x) - 40 * x * (y - x * x), 20 * (y - x * x)],
    domain: { x: [-1.6, 1.9], y: [-0.8, 2.4] },
    minima: [[1, 1]],
    start: [-1.2, 2.0],
  },
  twopits: {
    f: (x, y) => {
      let v = 0.06 * (x * x + y * y) + 2.2
      for (const t of twoPitsTerms)
        v -= t.a * Math.exp(-((x - t.x0) ** 2 + (y - t.y0) ** 2) / t.s)
      return v
    },
    grad: (x, y) => {
      let gx = 0.12 * x
      let gy = 0.12 * y
      for (const t of twoPitsTerms) {
        const e = t.a * Math.exp(-((x - t.x0) ** 2 + (y - t.y0) ** 2) / t.s)
        gx += (2 * (x - t.x0) / t.s) * e
        gy += (2 * (y - t.y0) / t.s) * e
      }
      return [gx, gy]
    },
    domain: { x: [-2.4, 2.4], y: [-2.0, 2.2] },
    minima: [
      [-1.0, -0.4],
      [1.15, 0.75],
    ],
    start: [0.15, 1.9],
  },
}

/** Numeric 2x2 Hessian via central differences of the gradient. */
export function numHess(fn: Fn2D, x: number, y: number): [number, number, number, number] {
  const h = 1e-4
  const gxp = fn.grad(x + h, y)
  const gxm = fn.grad(x - h, y)
  const gyp = fn.grad(x, y + h)
  const gym = fn.grad(x, y - h)
  const hxx = (gxp[0] - gxm[0]) / (2 * h)
  const hxy = ((gyp[0] - gym[0]) / (2 * h) + (gxp[1] - gxm[1]) / (2 * h)) / 2
  const hyy = (gyp[1] - gym[1]) / (2 * h)
  return [hxx, hxy, hxy, hyy]
}

export function gdStep2D(fn: Fn2D, p: Vec2, lr: number): Vec2 {
  const g = fn.grad(p[0], p[1])
  return [p[0] - lr * g[0], p[1] - lr * g[1]]
}

export function momentumStep2D(
  fn: Fn2D,
  p: Vec2,
  v: Vec2,
  lr: number,
  beta: number,
): { p: Vec2; v: Vec2 } {
  const g = fn.grad(p[0], p[1])
  const nv: Vec2 = [beta * v[0] - lr * g[0], beta * v[1] - lr * g[1]]
  return { p: [p[0] + nv[0], p[1] + nv[1]], v: nv }
}

/** Damped Newton step: (H + λI)·δ = −∇f. λ→∞ behaves like (scaled) GD, λ→0 like Newton. */
export function lmStep2D(fn: Fn2D, p: Vec2, lambda: number): Vec2 {
  const g = fn.grad(p[0], p[1])
  const [a, b, , d] = numHess(fn, p[0], p[1])
  const h00 = a + lambda
  const h11 = d + lambda
  const det = h00 * h11 - b * b
  if (Math.abs(det) < 1e-12) return gdStep2D(fn, p, 0.01)
  const dx = (-g[0] * h11 + g[1] * b) / det
  const dy = (g[0] * b - g[1] * h00) / det
  return [p[0] + dx, p[1] + dy]
}

// ================================================================ calibration problem
//
// A real least-squares problem: estimate θ = (f, cx, cy, k1) from checkerboard
// corners observed in NV views with KNOWN board poses. "Detected" corners are
// generated with the ground-truth camera plus Gaussian pixel noise.

export interface CalibTheta {
  f: number
  cx: number
  cy: number
  k1: number
}

export const CALIB_TRUE: CalibTheta = { f: 560, cx: 331, cy: 246, k1: -0.18 }
export const CALIB_START: CalibTheta = { f: 400, cx: 300, cy: 265, k1: 0.05 }
export const CALIB_W = 640
export const CALIB_H = 480

const CORNERS = boardCorners(7, 5, 0.04)

const POSES: M4[] = [
  [0.0, 0.02, 0.55, 8, -6, 0],
  [-0.1, -0.05, 0.42, -28, 14, 12],
  [0.12, 0.06, 0.5, 20, 26, -18],
  [-0.13, 0.07, 0.62, 12, -30, 30],
  [0.1, -0.08, 0.47, -18, -22, -35],
  [0.0, 0.0, 0.38, 32, 8, 60],
].map(([ox, oy, d, rx, ry, rz]) =>
  m4MulChain(m4Trans(ox, oy, d), m4RotX(deg2rad(rx)), m4RotY(deg2rad(ry)), m4RotZ(deg2rad(rz))),
)

export const CALIB_NV = POSES.length

/** All corner positions in the camera frame, per view (poses are known and fixed). */
const CAM_POINTS: V3[][] = POSES.map((T) => CORNERS.map((c) => m4MulP(T, c)))

/** Project a camera-frame point with focal f, principal point (cx, cy) and radial k1. */
export function calibProject(th: CalibTheta, p: V3): Vec2 {
  const xn = p[0] / p[2]
  const yn = p[1] / p[2]
  const [xd, yd] = distortNormalized(xn, yn, { k1: th.k1, k2: 0, k3: 0, p1: 0, p2: 0 })
  return [th.f * xd + th.cx, th.f * yd + th.cy]
}

export type Observations = Vec2[][] // [view][corner] detected pixel

export function makeObservations(noiseSigma: number, seed: number): Observations {
  return makeObservationsN(noiseSigma, seed, CAM_POINTS.length)
}

/** Like makeObservations, but only the first `nViews` views (for the uncertainty lab). */
export function makeObservationsN(noiseSigma: number, seed: number, nViews: number): Observations {
  const rand = mulberry32(seed)
  const gauss = () => (rand() + rand() + rand() + rand() - 2) * 1.732 // ≈ N(0,1): sum of 4 U(0,1) has σ = 1/√3
  return CAM_POINTS.slice(0, nViews).map((view) =>
    view.map((p) => {
      const [u, v] = calibProject(CALIB_TRUE, p)
      return [u + gauss() * noiseSigma, v + gauss() * noiseSigma] as Vec2
    }),
  )
}

export function calibReprojections(th: CalibTheta): Vec2[][] {
  return CAM_POINTS.map((view) => view.map((p) => calibProject(th, p)))
}

/** Root-mean-square reprojection error over all corners of the observed views. */
export function calibRms(th: CalibTheta, obs: Observations): number {
  let se = 0
  let n = 0
  for (let i = 0; i < obs.length; i++)
    for (let j = 0; j < obs[i].length; j++) {
      const [u, v] = calibProject(th, CAM_POINTS[i][j])
      se += (u - obs[i][j][0]) ** 2 + (v - obs[i][j][1]) ** 2
      n++
    }
  return Math.sqrt(se / n)
}

const thVec = (t: CalibTheta): number[] => [t.f, t.cx, t.cy, t.k1]
const vecTh = (v: number[]): CalibTheta => ({ f: v[0], cx: v[1], cy: v[2], k1: v[3] })

function residuals(v: number[], obs: Observations): number[] {
  const th = vecTh(v)
  const r: number[] = []
  for (let i = 0; i < obs.length; i++)
    for (let j = 0; j < obs[i].length; j++) {
      const [u, vv] = calibProject(th, CAM_POINTS[i][j])
      r.push(u - obs[i][j][0], vv - obs[i][j][1])
    }
  return r
}

/** Numeric Jacobian ∂r/∂θ via central differences (2N × 4, stored column-wise). */
function jacobian(v: number[], obs: Observations): number[][] {
  const steps = [0.5, 0.5, 0.5, 1e-4]
  return v.map((_, k) => {
    const vp = [...v]
    const vm = [...v]
    vp[k] += steps[k]
    vm[k] -= steps[k]
    const rp = residuals(vp, obs)
    const rm = residuals(vm, obs)
    return rp.map((x, i) => (x - rm[i]) / (2 * steps[k]))
  })
}

/**
 * Plain gradient descent on C(θ) = ½‖r‖². Parameters live on wildly different
 * scales (f ≈ 500 px vs. k1 ≈ 0.2), so even to make GD move at all the update
 * is preconditioned with per-parameter scales S: θ ← θ − lr·S²·∇C.
 */
export function gdCalibStep(th: CalibTheta, obs: Observations, lr: number): CalibTheta {
  const v = thVec(th)
  const r = residuals(v, obs)
  const J = jacobian(v, obs)
  // rough 1/diag(JᵀJ) magnitudes — without this per-parameter scaling GD is unusable,
  // because ∂r/∂f ≈ 0.3 while ∂r/∂k1 ≈ 20: the raw gradient points almost entirely along k1
  const S2 = [0.02, 0.0024, 0.0024, 4.5e-6]
  const out = v.map((x, k) => {
    let g = 0
    for (let i = 0; i < r.length; i++) g += J[k][i] * r[i]
    return x - lr * S2[k] * g
  })
  return vecTh(out)
}

/** Solve a small dense system A·x = b by Gaussian elimination with partial pivoting. */
export function solveN(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let rIdx = c + 1; rIdx < n; rIdx++)
      if (Math.abs(M[rIdx][c]) > Math.abs(M[piv][c])) piv = rIdx
    if (Math.abs(M[piv][c]) < 1e-14) return null
    ;[M[c], M[piv]] = [M[piv], M[c]]
    for (let rIdx = 0; rIdx < n; rIdx++) {
      if (rIdx === c) continue
      const fac = M[rIdx][c] / M[c][c]
      for (let k = c; k <= n; k++) M[rIdx][k] -= fac * M[c][k]
    }
  }
  return M.map((row, i) => row[n] / M[i][i])
}

export interface LmState {
  th: CalibTheta
  lambda: number
  accepted: boolean
}

/**
 * One Levenberg–Marquardt iteration with Marquardt scaling:
 * (JᵀJ + λ·diag(JᵀJ))·δ = −Jᵀr, adaptive λ (accept → λ/3, reject → λ×4).
 */
export function lmCalibStep(th: CalibTheta, obs: Observations, lambda: number): LmState {
  const v = thVec(th)
  const r = residuals(v, obs)
  const J = jacobian(v, obs)
  const n = v.length
  const JtJ: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  const g = new Array(n).fill(0)
  for (let a = 0; a < n; a++) {
    for (let b = a; b < n; b++) {
      let s = 0
      for (let i = 0; i < r.length; i++) s += J[a][i] * J[b][i]
      JtJ[a][b] = s
      JtJ[b][a] = s
    }
    for (let i = 0; i < r.length; i++) g[a] += J[a][i] * r[i]
  }
  const cost = r.reduce((s, x) => s + x * x, 0)
  let lam = lambda
  for (let tries = 0; tries < 8; tries++) {
    const A = JtJ.map((row, i) => row.map((x, j) => (i === j ? x + lam * JtJ[i][i] : x)))
    const delta = solveN(A, g.map((x) => -x))
    if (delta) {
      const cand = v.map((x, k) => x + delta[k])
      const candCost = residuals(cand, obs).reduce((s, x) => s + x * x, 0)
      if (candCost < cost) return { th: vecTh(cand), lambda: Math.max(lam / 3, 1e-9), accepted: true }
    }
    lam *= 4
  }
  return { th, lambda: lam, accepted: false }
}

/** Run LM to convergence — the workhorse of the calibration-uncertainty lab. */
export function lmSolve(obs: Observations, maxIter = 15, start: CalibTheta = CALIB_START): CalibTheta {
  let th = start
  let lambda = 1e-3
  for (let i = 0; i < maxIter; i++) {
    const st = lmCalibStep(th, obs, lambda)
    th = st.th
    lambda = st.lambda
    if (!st.accepted && lambda > 1e6) break
  }
  return th
}

/**
 * First-order parameter covariance at the LM solution: Cov(θ) ≈ s²·(JᵀJ)⁻¹
 * with s² = ‖r‖²/(m − 4). The GUM-style analytic counterpart of the
 * Monte-Carlo scatter in the uncertainty lab.
 */
export function calibCovariance(th: CalibTheta, obs: Observations): number[][] {
  const v = thVec(th)
  const r = residuals(v, obs)
  const J = jacobian(v, obs)
  const n = 4
  const JtJ: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let a = 0; a < n; a++)
    for (let b = a; b < n; b++) {
      let s = 0
      for (let i = 0; i < r.length; i++) s += J[a][i] * J[b][i]
      JtJ[a][b] = s
      JtJ[b][a] = s
    }
  const s2 = r.reduce((s, x) => s + x * x, 0) / Math.max(r.length - n, 1)
  // invert via solveN column by column
  const inv: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let c = 0; c < n; c++) {
    const e = new Array<number>(n).fill(0)
    e[c] = 1
    const col = solveN(JtJ, e)
    if (!col) return inv
    for (let rIdx = 0; rIdx < n; rIdx++) inv[rIdx][c] = col[rIdx] * s2
  }
  return inv
}
