/**
 * Homography estimation (normalized DLT), Zhang closed-form intrinsics,
 * and pose-only PnP refinement - the linear-algebra backbone of the
 * "flat world" sections in the Vision track.
 *
 * All matrices follow the math.ts convention: flat row-major arrays (M3 = 9).
 */

import { jacobiEigen } from './stats'
import { solveN } from './optim'
import {
  add,
  cross,
  kMat,
  m3Inv,
  m3Mul,
  m3MulV,
  normalize,
  projectPoint,
  type Intrinsics,
  type M3,
  type Pose,
  type V3,
} from './math'

export type P2 = [number, number]

// ---------------------------------------------------------------- normalized DLT

/** Hartley normalization: similarity T with centroid → 0, mean distance → √2. */
function normalizeT(pts: P2[]): M3 {
  const n = pts.length
  const cx = pts.reduce((s, p) => s + p[0], 0) / n
  const cy = pts.reduce((s, p) => s + p[1], 0) / n
  const meanDist = pts.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / n
  const s = Math.SQRT2 / Math.max(meanDist, 1e-12)
  return [s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1]
}

const applyT = (T: M3, p: P2): P2 => [T[0] * p[0] + T[1] * p[1] + T[2], T[3] * p[0] + T[4] * p[1] + T[5]]

/**
 * Estimate the homography mapping src → dst from ≥4 point pairs via the
 * normalized DLT: accumulate the 9×9 AᵀA of the two standard DLT rows per pair
 * and take the eigenvector of the smallest eigenvalue (jacobiEigen).
 * Without the Hartley normalization this is hopelessly ill-conditioned at
 * pixel scale - the normalization is not optional.
 */
export function homographyDLT(src: P2[], dst: P2[]): M3 | null {
  if (src.length < 4 || src.length !== dst.length) return null
  const Ts = normalizeT(src)
  const Td = normalizeT(dst)
  const M: number[][] = Array.from({ length: 9 }, () => new Array<number>(9).fill(0))
  const acc = (row: number[]) => {
    for (let i = 0; i < 9; i++) for (let j = i; j < 9; j++) M[i][j] += row[i] * row[j]
  }
  for (let p = 0; p < src.length; p++) {
    const [x, y] = applyT(Ts, src[p])
    const [u, v] = applyT(Td, dst[p])
    acc([-x, -y, -1, 0, 0, 0, u * x, u * y, u])
    acc([0, 0, 0, -x, -y, -1, v * x, v * y, v])
  }
  for (let i = 0; i < 9; i++) for (let j = 0; j < i; j++) M[i][j] = M[j][i]
  const eig = jacobiEigen(M)
  const h = eig.vectors[8]
  const Hn: M3 = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], h[8]]
  const H = m3Mul(m3Mul(m3Inv(Td), Hn), Ts)
  // fix scale so H[8] = 1 (fall back to unit Frobenius norm if H33 ≈ 0)
  if (Math.abs(H[8]) > 1e-10) {
    const inv = 1 / H[8]
    return H.map((v) => v * inv)
  }
  const fro = Math.sqrt(H.reduce((s, v) => s + v * v, 0))
  return H.map((v) => v / fro)
}

/** Apply a homography to a 2D point (divides by w). */
export function applyH(H: M3, p: P2): P2 {
  const [u, v, w] = m3MulV(H, [p[0], p[1], 1])
  return [u / w, v / w]
}

/** RMS reprojection error of H over the point pairs, in dst units. */
export function homographyRms(H: M3, src: P2[], dst: P2[]): number {
  let s = 0
  for (let i = 0; i < src.length; i++) {
    const [u, v] = applyH(H, src[i])
    s += (u - dst[i][0]) ** 2 + (v - dst[i][1]) ** 2
  }
  return Math.sqrt(s / src.length)
}

// ---------------------------------------------------------------- pose from H

/**
 * Decompose a plane-induced homography H = λ·K[r1 r2 t] into a pose.
 * Orthonormalizes with cross products (no SVD needed) - a good Gauss-Newton
 * initializer, not a final answer.
 */
export function poseFromHomography(k: Intrinsics, H: M3): Pose {
  const A = m3Mul(m3Inv(kMat(k)), H)
  let a1: V3 = [A[0], A[3], A[6]]
  let a2: V3 = [A[1], A[4], A[7]]
  let a3: V3 = [A[2], A[5], A[8]]
  const lam = 2 / (Math.hypot(...a1) + Math.hypot(...a2))
  a1 = a1.map((v) => v * lam) as V3
  a2 = a2.map((v) => v * lam) as V3
  a3 = a3.map((v) => v * lam) as V3
  // board must be in front of the camera
  if (a3[2] < 0) {
    a1 = a1.map((v) => -v) as V3
    a2 = a2.map((v) => -v) as V3
    a3 = a3.map((v) => -v) as V3
  }
  const r1 = normalize(a1)
  const r3 = normalize(cross(r1, a2))
  const r2 = cross(r3, r1)
  const R: M3 = [r1[0], r2[0], r3[0], r1[1], r2[1], r3[1], r1[2], r2[2], r3[2]]
  return { R, t: a3 }
}

// ---------------------------------------------------------------- Zhang closed form

export interface ZhangResult {
  k: Intrinsics
  ok: boolean
  /** eigenvalue-gap ratio - small means the constraint system is degenerate */
  conditioning: number
}

const ZHANG_FAIL: ZhangResult = { k: { fx: 0, fy: 0, s: 0, cx: 0, cy: 0 }, ok: false, conditioning: 1 }

/**
 * Zhang (2000) closed-form intrinsics from ≥3 plane homographies.
 * Each view's H = K[r1 r2 t] gives two linear constraints on the image of the
 * absolute conic ω = K⁻ᵀK⁻¹ (r1 ⊥ r2 and ‖r1‖ = ‖r2‖). Stack, take the
 * smallest eigenvector of VᵀV, extract K in closed form.
 * Every square root is guarded - degenerate view sets (too few views, all
 * frontal) return ok:false instead of NaNs.
 */
export function zhangIntrinsics(Hs: M3[]): ZhangResult {
  if (Hs.length < 2) return ZHANG_FAIL
  const M: number[][] = Array.from({ length: 6 }, () => new Array<number>(6).fill(0))
  const acc = (row: number[]) => {
    for (let i = 0; i < 6; i++) for (let j = i; j < 6; j++) M[i][j] += row[i] * row[j]
  }
  const vij = (H: M3, i: number, j: number): number[] => {
    // columns of H (0-indexed)
    const hi = [H[i], H[3 + i], H[6 + i]]
    const hj = [H[j], H[3 + j], H[6 + j]]
    return [
      hi[0] * hj[0],
      hi[0] * hj[1] + hi[1] * hj[0],
      hi[1] * hj[1],
      hi[2] * hj[0] + hi[0] * hj[2],
      hi[2] * hj[1] + hi[1] * hj[2],
      hi[2] * hj[2],
    ]
  }
  for (const H of Hs) {
    const v12 = vij(H, 0, 1)
    const v11 = vij(H, 0, 0)
    const v22 = vij(H, 1, 1)
    acc(v12)
    acc(v11.map((v, i) => v - v22[i]))
  }
  for (let i = 0; i < 6; i++) for (let j = 0; j < i; j++) M[i][j] = M[j][i]
  const eig = jacobiEigen(M)
  const conditioning = Math.abs(eig.values[4]) / Math.max(Math.abs(eig.values[5]), 1e-18)
  let b = eig.vectors[5]
  if (b[0] < 0) b = b.map((v) => -v)
  const [B11, B12, B22, B13, B23, B33] = b
  const den = B11 * B22 - B12 * B12
  if (B11 < 1e-12 || Math.abs(den) < 1e-16) return { ...ZHANG_FAIL, conditioning }
  const cy = (B12 * B13 - B11 * B23) / den
  const lam = B33 - (B13 * B13 + cy * (B12 * B13 - B11 * B23)) / B11
  if (lam / B11 <= 0 || (lam * B11) / den <= 0) return { ...ZHANG_FAIL, conditioning }
  const fx = Math.sqrt(lam / B11)
  const fy = Math.sqrt((lam * B11) / den)
  const s = (-B12 * fx * fx * fy) / lam
  const cx = (s * cy) / fy - (B13 * fx * fx) / lam
  if (!Number.isFinite(fx) || !Number.isFinite(fy) || !Number.isFinite(cx) || !Number.isFinite(cy))
    return { ...ZHANG_FAIL, conditioning }
  const ok = Hs.length >= 3 && conditioning > 50
  return { k: { fx, fy, s, cx, cy }, ok, conditioning }
}

// ---------------------------------------------------------------- PnP (pose-only Gauss-Newton)

/** Rodrigues rotation from an axis-angle vector. */
function rodrigues(w: V3): M3 {
  const th = Math.hypot(...w)
  if (th < 1e-12) return [1, -w[2], w[1], w[2], 1, -w[0], -w[1], w[0], 1]
  const [kx, ky, kz] = [w[0] / th, w[1] / th, w[2] / th]
  const c = Math.cos(th)
  const s = Math.sin(th)
  const v = 1 - c
  return [
    c + kx * kx * v, kx * ky * v - kz * s, kx * kz * v + ky * s,
    ky * kx * v + kz * s, c + ky * ky * v, ky * kz * v - kx * s,
    kz * kx * v - ky * s, kz * ky * v + kx * s, c + kz * kz * v,
  ]
}

export interface PnpResult {
  pose: Pose
  rms: number
  trace: { pose: Pose; rms: number }[]
}

function pnpResiduals(k: Intrinsics, X: V3[], x: P2[], pose: Pose): number[] {
  const r: number[] = []
  for (let i = 0; i < X.length; i++) {
    const p = projectPoint(k, pose, X[i])
    r.push(p.u - x[i][0], p.v - x[i][1])
  }
  return r
}

const rmsOf = (r: number[]) => Math.sqrt(r.reduce((s, v) => s + v * v, 0) / (r.length / 2))

/**
 * Pose-only damped Gauss-Newton: re-linearize about the current pose with a
 * 6-vector update (ω rotation via Rodrigues on the right, δt translation),
 * numeric central-difference Jacobian, normal equations via solveN,
 * step-halving on rejection. Returns the per-iteration trace so the lab can
 * animate the camera locking into place.
 */
export function pnpRefine(k: Intrinsics, X: V3[], x: P2[], init: Pose, maxIter = 12): PnpResult {
  let pose: Pose = { R: [...init.R], t: [...init.t] as V3 }
  let r = pnpResiduals(k, X, x, pose)
  const trace: { pose: Pose; rms: number }[] = [{ pose, rms: rmsOf(r) }]

  const poseAt = (base: Pose, d: number[]): Pose => ({
    R: m3Mul(base.R, rodrigues([d[0], d[1], d[2]])),
    t: add(base.t, [d[3], d[4], d[5]]),
  })

  for (let iter = 0; iter < maxIter; iter++) {
    const m = r.length
    // numeric Jacobian about δ = 0
    const J: number[][] = Array.from({ length: m }, () => new Array<number>(6).fill(0))
    for (let p = 0; p < 6; p++) {
      const h = p < 3 ? 1e-5 : 1e-4
      const dp = new Array<number>(6).fill(0)
      dp[p] = h
      const rp = pnpResiduals(k, X, x, poseAt(pose, dp))
      dp[p] = -h
      const rm = pnpResiduals(k, X, x, poseAt(pose, dp))
      for (let i = 0; i < m; i++) J[i][p] = (rp[i] - rm[i]) / (2 * h)
    }
    const A: number[][] = Array.from({ length: 6 }, () => new Array<number>(6).fill(0))
    const g = new Array<number>(6).fill(0)
    for (let a = 0; a < 6; a++) {
      for (let b2 = a; b2 < 6; b2++) {
        let s = 0
        for (let i = 0; i < m; i++) s += J[i][a] * J[i][b2]
        A[a][b2] = s
        A[b2][a] = s
      }
      let s = 0
      for (let i = 0; i < m; i++) s += J[i][a] * r[i]
      g[a] = s
    }
    for (let a = 0; a < 6; a++) A[a][a] += 1e-3 * A[a][a] + 1e-9
    const delta = solveN(A, g.map((v) => -v))
    if (!delta) break
    // step-halving line search
    const cost = r.reduce((s, v) => s + v * v, 0)
    let accepted = false
    let stepScale = 1
    for (let tries = 0; tries < 5; tries++) {
      const cand = poseAt(pose, delta.map((v) => v * stepScale))
      const rc = pnpResiduals(k, X, x, cand)
      if (rc.reduce((s, v) => s + v * v, 0) < cost) {
        pose = cand
        r = rc
        accepted = true
        break
      }
      stepScale /= 2
    }
    if (!accepted) break
    trace.push({ pose, rms: rmsOf(r) })
    if (rmsOf(r) < 1e-9) break
  }
  return { pose, rms: rmsOf(r), trace }
}
