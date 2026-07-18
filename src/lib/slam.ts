/**
 * EKF-SLAM toolkit: unicycle motion model, range-bearing landmark updates with
 * on-the-fly state augmentation, plus a dead-reckoning trajectory sampler.
 */

import { makeGauss } from './stats'

// ---------------------------------------------------------------- small dense matrix helpers

const zeros = (r: number, c: number): number[][] =>
  Array.from({ length: r }, () => new Array(c).fill(0))

const matMul = (A: number[][], B: number[][]): number[][] => {
  const out = zeros(A.length, B[0].length)
  for (let i = 0; i < A.length; i++)
    for (let k = 0; k < B.length; k++) {
      const a = A[i][k]
      if (a === 0) continue
      for (let j = 0; j < B[0].length; j++) out[i][j] += a * B[k][j]
    }
  return out
}

const matT = (A: number[][]): number[][] => A[0].map((_, j) => A.map((row) => row[j]))

export const wrapAngle = (a: number): number => {
  let x = a
  while (x > Math.PI) x -= 2 * Math.PI
  while (x < -Math.PI) x += 2 * Math.PI
  return x
}

// ---------------------------------------------------------------- EKF-SLAM state

export interface Slam {
  /** [rx, ry, rθ, l₁x, l₁y, l₂x, l₂y, …] */
  x: number[]
  P: number[][]
  /** landmark id → index of its x-coordinate in the state */
  seen: Map<number, number>
}

export function slamInit(px: number, py: number, th: number): Slam {
  return {
    x: [px, py, th],
    P: [
      [1e-4, 0, 0],
      [0, 1e-4, 0],
      [0, 0, 1e-4],
    ],
    seen: new Map(),
  }
}

/** EKF predict with odometry (v, ω) over dt; noise ∝ commanded motion. */
export function slamPredict(
  s: Slam,
  v: number,
  om: number,
  dt: number,
  sigV: number,
  sigOm: number,
): void {
  const th = s.x[2]
  s.x[0] += v * dt * Math.cos(th)
  s.x[1] += v * dt * Math.sin(th)
  s.x[2] = wrapAngle(s.x[2] + om * dt)

  const n = s.x.length
  // Jacobian F = I except pose block
  const F = zeros(n, n)
  for (let i = 0; i < n; i++) F[i][i] = 1
  F[0][2] = -v * dt * Math.sin(th)
  F[1][2] = v * dt * Math.cos(th)

  s.P = matMul(matMul(F, s.P), matT(F))
  const qxy = (sigV * dt) ** 2 + 1e-8
  const qth = (sigOm * dt) ** 2 + 1e-8
  s.P[0][0] += qxy
  s.P[1][1] += qxy
  s.P[2][2] += qth
}

/** Range-bearing update for landmark `id`; initializes it on first sighting. */
export function slamUpdate(
  s: Slam,
  id: number,
  r: number,
  phi: number,
  sigR: number,
  sigPhi: number,
): void {
  if (!s.seen.has(id)) {
    // initialize landmark from the current estimate
    const th = s.x[2]
    const lx = s.x[0] + r * Math.cos(phi + th)
    const ly = s.x[1] + r * Math.sin(phi + th)
    const idx = s.x.length
    s.seen.set(id, idx)
    s.x.push(lx, ly)
    const n = s.x.length
    const P2 = zeros(n, n)
    for (let i = 0; i < n - 2; i++) for (let j = 0; j < n - 2; j++) P2[i][j] = s.P[i][j]
    P2[n - 2][n - 2] = 0.6
    P2[n - 1][n - 1] = 0.6
    s.P = P2
    return
  }

  const li = s.seen.get(id)!
  const dx = s.x[li] - s.x[0]
  const dy = s.x[li + 1] - s.x[1]
  const q = dx * dx + dy * dy
  const rq = Math.sqrt(q)
  if (rq < 1e-6) return
  const zr = rq
  const zphi = wrapAngle(Math.atan2(dy, dx) - s.x[2])

  const n = s.x.length
  // H: 2×n, nonzero only at pose and this landmark
  const H = zeros(2, n)
  H[0][0] = -dx / rq
  H[0][1] = -dy / rq
  H[0][2] = 0
  H[0][li] = dx / rq
  H[0][li + 1] = dy / rq
  H[1][0] = dy / q
  H[1][1] = -dx / q
  H[1][2] = -1
  H[1][li] = -dy / q
  H[1][li + 1] = dx / q

  const PHt = matMul(s.P, matT(H)) // n×2
  const S = matMul(H, PHt) // 2×2
  S[0][0] += sigR * sigR
  S[1][1] += sigPhi * sigPhi
  const det = S[0][0] * S[1][1] - S[0][1] * S[1][0]
  if (Math.abs(det) < 1e-12) return
  const Si = [
    [S[1][1] / det, -S[0][1] / det],
    [-S[1][0] / det, S[0][0] / det],
  ]
  const K = matMul(PHt, Si) // n×2
  const iy = [r - zr, wrapAngle(phi - zphi)]
  for (let i = 0; i < n; i++) s.x[i] += K[i][0] * iy[0] + K[i][1] * iy[1]
  s.x[2] = wrapAngle(s.x[2])
  // P = (I − K H) P
  const KH = matMul(K, H)
  const IKH = zeros(n, n)
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) IKH[i][j] = (i === j ? 1 : 0) - KH[i][j]
  s.P = matMul(IKH, s.P)
}

/** Sum of position variances (robot + landmarks) — the "total uncertainty" readout. */
export function traceP(s: Slam): number {
  let t = 0
  for (let i = 0; i < s.x.length; i++) if (i !== 2) t += s.P[i][i]
  return t
}

// ---------------------------------------------------------------- world & control

export interface RobotSim {
  x: number
  y: number
  th: number
  wp: number
}

export const WAYPOINTS: [number, number][] = [
  [1.1, 0.75],
  [-1.1, 0.75],
  [-1.1, -0.75],
  [1.1, -0.75],
]

export const LANDMARKS: [number, number][] = [
  [1.45, 0], [1.05, 1.1], [0, 1.05], [-1.15, 1.05],
  [-1.5, -0.1], [-1.0, -1.1], [0.1, -1.05], [1.1, -1.1],
]

/** Steering controller toward the current waypoint; returns (v, ω) and advances waypoints. */
export function control(r: RobotSim): { v: number; om: number } {
  const [wx, wy] = WAYPOINTS[r.wp]
  const dist = Math.hypot(wx - r.x, wy - r.y)
  if (dist < 0.18) r.wp = (r.wp + 1) % WAYPOINTS.length
  const desired = Math.atan2(wy - r.y, wx - r.x)
  const dTh = wrapAngle(desired - r.th)
  return { v: 0.55, om: Math.max(-1.6, Math.min(1.6, 2.4 * dTh)) }
}

export function trueStep(r: RobotSim, v: number, om: number, dt: number): void {
  r.x += v * dt * Math.cos(r.th)
  r.y += v * dt * Math.sin(r.th)
  r.th = wrapAngle(r.th + om * dt)
}

/** Sample M dead-reckoning trajectories under odometry noise (for the spaghetti plot). */
export function deadReckoning(
  m: number,
  steps: number,
  dt: number,
  sigV: number,
  sigOm: number,
  seed: number,
): [number, number][][] {
  const g = makeGauss(seed)
  const out: [number, number][][] = []
  for (let k = 0; k < m; k++) {
    const truth: RobotSim = { x: 1.1, y: 0, th: Math.PI / 2, wp: 0 }
    const est: RobotSim = { x: 1.1, y: 0, th: Math.PI / 2, wp: 0 }
    const traj: [number, number][] = [[est.x, est.y]]
    for (let i = 0; i < steps; i++) {
      const { v, om } = control(truth)
      trueStep(truth, v, om, dt)
      // the estimate integrates the NOISY odometry reading
      trueStep(est, v + g() * sigV, om + g() * sigOm, dt)
      traj.push([est.x, est.y])
    }
    out.push(traj)
  }
  return out
}
