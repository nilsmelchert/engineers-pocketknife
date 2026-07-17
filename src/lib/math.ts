/**
 * Minimal linear-algebra toolkit for the interactive demos.
 *
 * Conventions (match the OpenCV / textbook computer-vision convention):
 *  - Camera frame: x right, y down, z forward (right-handed).
 *  - World→camera: x_c = R · X_w + t.
 *  - Matrices are stored row-major as flat number arrays (M3 = 9, M4 = 16 entries).
 */

export type V3 = [number, number, number]
export type M3 = number[]
export type M4 = number[]

// ---------------------------------------------------------------- vectors

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const norm = (a: V3): number => Math.hypot(a[0], a[1], a[2])
export const normalize = (a: V3): V3 => {
  const n = norm(a)
  return n < 1e-12 ? [0, 0, 0] : scale(a, 1 / n)
}

// ---------------------------------------------------------------- 3x3 matrices

export const m3Identity = (): M3 => [1, 0, 0, 0, 1, 0, 0, 0, 1]

export function m3Mul(a: M3, b: M3): M3 {
  const r = new Array<number>(9)
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]
  return r
}

export const m3MulV = (a: M3, v: V3): V3 => [
  a[0] * v[0] + a[1] * v[1] + a[2] * v[2],
  a[3] * v[0] + a[4] * v[1] + a[5] * v[2],
  a[6] * v[0] + a[7] * v[1] + a[8] * v[2],
]

export const m3T = (a: M3): M3 => [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]]

export function m3Inv(a: M3): M3 {
  const [a00, a01, a02, a10, a11, a12, a20, a21, a22] = a
  const c00 = a11 * a22 - a12 * a21
  const c01 = a12 * a20 - a10 * a22
  const c02 = a10 * a21 - a11 * a20
  const det = a00 * c00 + a01 * c01 + a02 * c02
  const d = 1 / det
  return [
    c00 * d,
    (a02 * a21 - a01 * a22) * d,
    (a01 * a12 - a02 * a11) * d,
    c01 * d,
    (a00 * a22 - a02 * a20) * d,
    (a02 * a10 - a00 * a12) * d,
    c02 * d,
    (a01 * a20 - a00 * a21) * d,
    (a00 * a11 - a01 * a10) * d,
  ]
}

export const rotX = (a: number): M3 => {
  const c = Math.cos(a),
    s = Math.sin(a)
  return [1, 0, 0, 0, c, -s, 0, s, c]
}
export const rotY = (a: number): M3 => {
  const c = Math.cos(a),
    s = Math.sin(a)
  return [c, 0, s, 0, 1, 0, -s, 0, c]
}
export const rotZ = (a: number): M3 => {
  const c = Math.cos(a),
    s = Math.sin(a)
  return [c, -s, 0, s, c, 0, 0, 0, 1]
}

export const crossMat = (t: V3): M3 => [0, -t[2], t[1], t[2], 0, -t[0], -t[1], t[0], 0]

// ---------------------------------------------------------------- 4x4 rigid transforms

export const m4Identity = (): M4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

/** Build a 4x4 from rotation R and translation t. */
export const m4 = (R: M3, t: V3): M4 => [
  R[0], R[1], R[2], t[0],
  R[3], R[4], R[5], t[1],
  R[6], R[7], R[8], t[2],
  0, 0, 0, 1,
]

export const m4R = (a: M4): M3 => [a[0], a[1], a[2], a[4], a[5], a[6], a[8], a[9], a[10]]
export const m4t = (a: M4): V3 => [a[3], a[7], a[11]]

export function m4Mul(a: M4, b: M4): M4 {
  const r = new Array<number>(16)
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[i * 4 + k] * b[k * 4 + j]
      r[i * 4 + j] = s
    }
  return r
}

export const m4MulChain = (...ms: M4[]): M4 => ms.reduce(m4Mul)

/** Transform a point (w = 1). */
export const m4MulP = (a: M4, p: V3): V3 => [
  a[0] * p[0] + a[1] * p[1] + a[2] * p[2] + a[3],
  a[4] * p[0] + a[5] * p[1] + a[6] * p[2] + a[7],
  a[8] * p[0] + a[9] * p[1] + a[10] * p[2] + a[11],
]

/** Rigid inverse: [R t]⁻¹ = [Rᵀ  -Rᵀt]. */
export function m4Inv(a: M4): M4 {
  const Rt = m3T(m4R(a))
  const t = m4t(a)
  return m4(Rt, scale(m3MulV(Rt, t), -1))
}

export const m4RotX = (a: number): M4 => m4(rotX(a), [0, 0, 0])
export const m4RotY = (a: number): M4 => m4(rotY(a), [0, 0, 0])
export const m4RotZ = (a: number): M4 => m4(rotZ(a), [0, 0, 0])
export const m4Trans = (x: number, y: number, z: number): M4 => m4(m3Identity(), [x, y, z])

/** Frobenius norm of the difference of two 4x4s. */
export function m4Diff(a: M4, b: M4): number {
  let s = 0
  for (let i = 0; i < 16; i++) s += (a[i] - b[i]) ** 2
  return Math.sqrt(s)
}

// ---------------------------------------------------------------- camera model

export interface Intrinsics {
  fx: number
  fy: number
  s: number
  cx: number
  cy: number
}

export const kMat = (k: Intrinsics): M3 => [k.fx, k.s, k.cx, 0, k.fy, k.cy, 0, 0, 1]

export interface Pose {
  /** world→camera rotation */
  R: M3
  /** world→camera translation */
  t: V3
}

/** Optical center in world coordinates: C = -Rᵀ t. */
export const cameraCenter = (p: Pose): V3 => scale(m3MulV(m3T(p.R), p.t), -1)

/**
 * World→camera pose of a camera at `eye` looking at `target`
 * (CV convention: z forward, y down, x right).
 */
export function lookAtCV(eye: V3, target: V3): Pose {
  const z = normalize(sub(target, eye))
  // approximate "down" in world space; fall back if looking straight up/down
  let yApprox: V3 = [0, -1, 0]
  if (Math.abs(dot(z, yApprox)) > 0.999) yApprox = [0, 0, -1]
  const x = normalize(cross(yApprox, z))
  const y = cross(z, x)
  const R: M3 = [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]]
  return { R, t: scale(m3MulV(R, eye), -1) }
}

export interface ProjectedPoint {
  u: number
  v: number
  /** depth in the camera frame — point is in front of the camera iff z > 0 */
  z: number
}

/** Full pinhole projection of world point X: pixel = K · (R X + t) / z. */
export function projectPoint(k: Intrinsics, pose: Pose, X: V3): ProjectedPoint {
  const c = add(m3MulV(pose.R, X), pose.t)
  const z = c[2]
  const xn = c[0] / z
  const yn = c[1] / z
  return { u: k.fx * xn + k.s * yn + k.cx, v: k.fy * yn + k.cy, z }
}

/** Project a point already given in camera coordinates. */
export function projectCamPoint(k: Intrinsics, c: V3): ProjectedPoint {
  const z = c[2]
  const xn = c[0] / z
  const yn = c[1] / z
  return { u: k.fx * xn + k.s * yn + k.cx, v: k.fy * yn + k.cy, z }
}

/** World position of pixel (u, v) placed at camera-frame depth `depth` (for drawing image planes). */
export function pixelToWorld(k: Intrinsics, pose: Pose, u: number, v: number, depth: number): V3 {
  const yn = (v - k.cy) / k.fy
  const xn = (u - k.cx - k.s * yn) / k.fx
  const cam: V3 = [xn * depth, yn * depth, depth]
  return add(m3MulV(m3T(pose.R), sub(cam, pose.t)), [0, 0, 0])
}

/** 3x4 projection matrix P = K[R|t], row-major (12 entries). */
export function pMat(k: Intrinsics, pose: Pose): number[] {
  const K = kMat(k)
  const out: number[] = []
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++)
      out.push(K[i * 3] * pose.R[j] + K[i * 3 + 1] * pose.R[3 + j] + K[i * 3 + 2] * pose.R[6 + j])
    out.push(K[i * 3] * pose.t[0] + K[i * 3 + 1] * pose.t[1] + K[i * 3 + 2] * pose.t[2])
  }
  return out
}

// ---------------------------------------------------------------- distortion (Brown–Conrady)

export interface Distortion {
  k1: number
  k2: number
  k3: number
  p1: number
  p2: number
}

export const NO_DISTORTION: Distortion = { k1: 0, k2: 0, k3: 0, p1: 0, p2: 0 }

/** Apply radial + tangential distortion to normalized image coordinates. */
export function distortNormalized(x: number, y: number, d: Distortion): [number, number] {
  const r2 = x * x + y * y
  const radial = 1 + d.k1 * r2 + d.k2 * r2 * r2 + d.k3 * r2 * r2 * r2
  const xd = x * radial + 2 * d.p1 * x * y + d.p2 * (r2 + 2 * x * x)
  const yd = y * radial + d.p1 * (r2 + 2 * y * y) + 2 * d.p2 * x * y
  return [xd, yd]
}

/**
 * Invert the Brown–Conrady model by fixed-point iteration: find the undistorted
 * normalized coordinates that distort to (xd, yd). Converges quickly for
 * moderate distortion — the same idea OpenCV's undistortPoints uses.
 */
export function undistortNormalized(
  xd: number,
  yd: number,
  d: Distortion,
  iters = 8,
): [number, number] {
  let x = xd
  let y = yd
  for (let i = 0; i < iters; i++) {
    const r2 = x * x + y * y
    const radial = 1 + d.k1 * r2 + d.k2 * r2 * r2 + d.k3 * r2 * r2 * r2
    const dx = 2 * d.p1 * x * y + d.p2 * (r2 + 2 * x * x)
    const dy = d.p1 * (r2 + 2 * y * y) + 2 * d.p2 * x * y
    x = (xd - dx) / radial
    y = (yd - dy) / radial
  }
  return [x, y]
}

// ---------------------------------------------------------------- two-view geometry

/** Essential matrix for x_c2 = R x_c1 + t (relates normalized coords: x̂2ᵀ E x̂1 = 0). */
export const essential = (R: M3, t: V3): M3 => m3Mul(crossMat(t), R)

/** Fundamental matrix (relates pixel coords: x2ᵀ F x1 = 0): F = K2⁻ᵀ E K1⁻¹. */
export function fundamental(k1: Intrinsics, k2: Intrinsics, R: M3, t: V3): M3 {
  return m3Mul(m3Mul(m3T(m3Inv(kMat(k2))), essential(R, t)), m3Inv(kMat(k1)))
}

/** Relative pose (R, t) mapping camera-1 coords into camera-2 coords. */
export function relativePose(p1: Pose, p2: Pose): Pose {
  const R = m3Mul(p2.R, m3T(p1.R))
  return { R, t: sub(p2.t, m3MulV(R, p1.t)) }
}

/**
 * Epipolar line l = F·x1 clipped against the image rectangle.
 * Returns two endpoints in pixel coords, or null if the line misses the image.
 */
export function epipolarSegment(
  F: M3,
  u1: number,
  v1: number,
  w: number,
  h: number,
): [[number, number], [number, number]] | null {
  const [a, b, c] = m3MulV(F, [u1, v1, 1])
  const pts: [number, number][] = []
  const push = (u: number, v: number) => {
    if (u >= -1e-6 && u <= w + 1e-6 && v >= -1e-6 && v <= h + 1e-6) pts.push([u, v])
  }
  if (Math.abs(b) > 1e-12) {
    push(0, -c / b)
    push(w, -(a * w + c) / b)
  }
  if (Math.abs(a) > 1e-12) {
    push(-(b * 0 + c) / a, 0)
    push(-(b * h + c) / a, h)
  }
  // dedupe near-identical corner hits
  const uniq = pts.filter(
    (p, i) => pts.findIndex((q) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) < 1e-4) === i,
  )
  return uniq.length >= 2 ? [uniq[0], uniq[1]] : null
}

// ---------------------------------------------------------------- misc helpers

export const deg2rad = (d: number): number => (d * Math.PI) / 180
export const rad2deg = (r: number): number => (r * 180) / Math.PI

export const fmt = (x: number, digits = 2): string => {
  const v = x.toFixed(digits)
  return v === (-0).toFixed(digits) ? (0).toFixed(digits) : v
}

/** Compact display for very small/large magnitudes (used for E/F matrix entries). */
export function fmtSci(x: number): string {
  if (x === 0) return '0'
  const ax = Math.abs(x)
  if (ax >= 0.01 && ax < 1000) return x.toPrecision(3)
  return x.toExponential(1)
}

/** Deterministic pseudo-random generator (stable visuals across re-renders). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Grid of inner-corner points of a checkerboard, centered, in the board plane (z = 0). */
export function boardCorners(cols: number, rows: number, square: number): V3[] {
  const pts: V3[] = []
  const x0 = (-(cols - 1) / 2) * square
  const y0 = (-(rows - 1) / 2) * square
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) pts.push([x0 + c * square, y0 + r * square, 0])
  return pts
}
