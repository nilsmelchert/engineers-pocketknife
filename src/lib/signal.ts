/**
 * Signals & Control toolkit: DFT, convolution, PID + plant simulation,
 * Kalman filters (1D tracking + 2D constant-velocity), gaussian fusion,
 * GUM / Monte-Carlo uncertainty propagation and phase-shift fringe math.
 */

import { mulberry32 } from './math'
import { jacobiEigen, makeGauss } from './stats'

// ---------------------------------------------------------------- DFT

export function dft(x: number[]): { re: number[]; im: number[] } {
  const N = x.length
  const re = new Array(N).fill(0)
  const im = new Array(N).fill(0)
  for (let k = 0; k < N; k++)
    for (let n = 0; n < N; n++) {
      const a = (-2 * Math.PI * k * n) / N
      re[k] += x[n] * Math.cos(a)
      im[k] += x[n] * Math.sin(a)
    }
  return { re, im }
}

export function idft(re: number[], im: number[]): number[] {
  const N = re.length
  const out = new Array(N).fill(0)
  for (let n = 0; n < N; n++) {
    for (let k = 0; k < N; k++) {
      const a = (2 * Math.PI * k * n) / N
      out[n] += re[k] * Math.cos(a) - im[k] * Math.sin(a)
    }
    out[n] /= N
  }
  return out
}

/** One-sided magnitude spectrum (bins 0 … N/2), scaled to amplitude. */
export function dftMag(x: number[]): number[] {
  const { re, im } = dft(x)
  const N = x.length
  const half = Math.floor(N / 2)
  const out = new Array(half + 1)
  for (let k = 0; k <= half; k++) {
    const m = Math.hypot(re[k], im[k]) / N
    out[k] = k === 0 || k === half ? m : 2 * m
  }
  return out
}

/** Zero all frequency bins above `cutoffBin` (and their mirror), then invert. */
export function lowpass(x: number[], cutoffBin: number): number[] {
  const { re, im } = dft(x)
  const N = x.length
  for (let k = 0; k < N; k++) {
    const bin = k <= N / 2 ? k : N - k
    if (bin > cutoffBin) {
      re[k] = 0
      im[k] = 0
    }
  }
  return idft(re, im)
}

/** Amplitude of the k-th harmonic (sine series) for the classic waveforms. */
export function seriesCoef(preset: 'square' | 'saw' | 'triangle', k: number): number {
  if (preset === 'square') return k % 2 === 1 ? 4 / (Math.PI * k) : 0
  if (preset === 'saw') return (2 / (Math.PI * k)) * (k % 2 === 0 ? -1 : 1)
  // triangle: odd harmonics, alternating sign, 1/k²
  return k % 2 === 1 ? ((8 / (Math.PI * Math.PI * k * k)) * (k % 4 === 1 ? 1 : -1)) : 0
}

/** Same-length convolution with zero padding (kernel centered). */
export function convolve(x: number[], kernel: number[]): number[] {
  const half = Math.floor(kernel.length / 2)
  return x.map((_, n) => {
    let s = 0
    for (let j = 0; j < kernel.length; j++) {
      const idx = n + j - half
      if (idx >= 0 && idx < x.length) s += x[idx] * kernel[j]
    }
    return s
  })
}

// ---------------------------------------------------------------- PID + plant

export interface PidOptions {
  /** plant: m·x'' = u + d − c·x' − k·x */
  m: number
  c: number
  k: number
  dt: number
  T: number
  /** transport delay on the actuator, seconds */
  delay: number
  setpoint: number
  /** optional disturbance kick: force `f` applied at time `t` for 0.2 s */
  kick?: { t: number; f: number }
}

export interface PidMetrics {
  rise: number | null
  overshoot: number
  settle: number | null
  sse: number
  unstable: boolean
}

export interface PidResult {
  t: number[]
  y: number[]
  u: number[]
  metrics: PidMetrics
}

export function simulatePid(kp: number, ki: number, kd: number, o: PidOptions): PidResult {
  const n = Math.round(o.T / o.dt)
  const delaySteps = Math.max(0, Math.round(o.delay / o.dt))
  const uBuf = new Array(delaySteps + 1).fill(0)
  const t: number[] = []
  const y: number[] = []
  const uHist: number[] = []
  let x = 0
  let v = 0
  let integ = 0
  let prevY = 0
  const uMax = 40
  for (let i = 0; i < n; i++) {
    const time = i * o.dt
    const err = o.setpoint - x
    integ += err * o.dt
    // basic anti-windup clamp
    integ = Math.max(-uMax / Math.max(ki, 1e-9), Math.min(uMax / Math.max(ki, 1e-9), integ))
    const dTerm = -kd * ((x - prevY) / o.dt) // derivative on measurement
    prevY = x
    let u = kp * err + ki * integ + dTerm
    u = Math.max(-uMax, Math.min(uMax, u))
    uBuf.push(u)
    const uEff = uBuf.shift()!
    let d = 0
    if (o.kick && time >= o.kick.t && time < o.kick.t + 0.2) d = o.kick.f
    const acc = (uEff + d - o.c * v - o.k * x) / o.m
    v += acc * o.dt
    x += v * o.dt
    t.push(time)
    y.push(x)
    uHist.push(uEff)
  }

  // metrics
  const r = o.setpoint
  const yEnd = y.slice(Math.floor(n * 0.9))
  const sse = Math.abs(r - yEnd.reduce((a, b) => a + b, 0) / yEnd.length)
  const yMax = Math.max(...y)
  const overshoot = Math.max(0, ((yMax - r) / Math.abs(r)) * 100)
  let rise: number | null = null
  const i10 = y.findIndex((v2) => v2 >= 0.1 * r)
  const i90 = y.findIndex((v2) => v2 >= 0.9 * r)
  if (i10 >= 0 && i90 > i10) rise = (i90 - i10) * o.dt
  let settle: number | null = null
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(y[i] - r) > 0.02 * Math.abs(r)) {
      settle = i < n - 1 ? (i + 1) * o.dt : null
      break
    }
  }
  // unstable: amplitude around the setpoint growing in the last half
  const dev = y.map((v2) => Math.abs(v2 - r))
  const firstHalfMax = Math.max(...dev.slice(Math.floor(n * 0.25), Math.floor(n * 0.5)))
  const lastMax = Math.max(...dev.slice(Math.floor(n * 0.75)))
  const unstable = !isFinite(yMax) || lastMax > 4 * Math.abs(r) || (lastMax > firstHalfMax * 1.6 && lastMax > 0.5 * Math.abs(r))
  return { t, y, u: uHist, metrics: { rise, overshoot, settle, sse, unstable } }
}

// ---------------------------------------------------------------- Kalman 1D (constant velocity)

export interface Kf1dSim {
  truth: number[]
  meas: number[]
  est: number[]
  sigma: number[]
  gain: number[]
}

/** Full simulation: constant-velocity target + noisy measurements + Kalman track. */
export function kf1dSim(opts: {
  n: number
  dt: number
  /** process (acceleration) noise std of the real target */
  qTrue: number
  /** process noise std ASSUMED by the filter */
  q: number
  /** measurement noise std */
  r: number
  seed: number
  /** optional sudden velocity change at step index */
  maneuverAt?: number
}): Kf1dSim {
  const g = makeGauss(opts.seed)
  const gm = makeGauss(opts.seed + 99)
  const { dt } = opts
  // simulate truth
  let x = 0
  let v = 1.2
  const truth: number[] = []
  const meas: number[] = []
  for (let i = 0; i < opts.n; i++) {
    if (opts.maneuverAt !== undefined && i === opts.maneuverAt) v = -1.6
    v += g() * opts.qTrue * dt
    x += v * dt
    truth.push(x)
    meas.push(x + gm() * opts.r)
  }
  // filter: state [x v], F = [[1 dt],[0 1]], H = [1 0]
  let sx = meas[0]
  let sv = 0
  let P00 = opts.r * opts.r
  let P01 = 0
  let P11 = 4
  const est: number[] = []
  const sigma: number[] = []
  const gain: number[] = []
  const q2 = opts.q * opts.q
  const r2 = opts.r * opts.r
  for (let i = 0; i < opts.n; i++) {
    // predict
    sx = sx + sv * dt
    const nP00 = P00 + dt * (P01 + P01) + dt * dt * P11 + (q2 * dt * dt * dt * dt) / 4
    const nP01 = P01 + dt * P11 + (q2 * dt * dt * dt) / 2
    const nP11 = P11 + q2 * dt * dt
    P00 = nP00
    P01 = nP01
    P11 = nP11
    // update
    const S = P00 + r2
    const K0 = P00 / S
    const K1 = P01 / S
    const innov = meas[i] - sx
    sx += K0 * innov
    sv += K1 * innov
    const p00 = (1 - K0) * P00
    const p01 = (1 - K0) * P01
    const p11 = P11 - K1 * P01
    P00 = p00
    P01 = p01
    P11 = p11
    est.push(sx)
    sigma.push(Math.sqrt(Math.max(P00, 0)))
    gain.push(K0)
  }
  return { truth, meas, est, sigma, gain }
}

// ---------------------------------------------------------------- Kalman 2D (mouse chase)

export interface Kf2d {
  /** state [x, y, vx, vy] */
  x: number[]
  /** 4×4 covariance */
  P: number[][]
}

export function kf2dInit(px: number, py: number): Kf2d {
  return {
    x: [px, py, 0, 0],
    P: [
      [50, 0, 0, 0],
      [0, 50, 0, 0],
      [0, 0, 100, 0],
      [0, 0, 0, 100],
    ],
  }
}

const matMul = (A: number[][], B: number[][]): number[][] =>
  A.map((row) => B[0].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)))
const matT = (A: number[][]): number[][] => A[0].map((_, j) => A.map((row) => row[j]))
const matAdd = (A: number[][], B: number[][]): number[][] => A.map((r, i) => r.map((v, j) => v + B[i][j]))

export function kf2dPredict(kf: Kf2d, dt: number, q: number): void {
  const F = [
    [1, 0, dt, 0],
    [0, 1, 0, dt],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ]
  kf.x = [kf.x[0] + kf.x[2] * dt, kf.x[1] + kf.x[3] * dt, kf.x[2], kf.x[3]]
  const q2 = q * q
  const Q = [
    [(q2 * dt ** 4) / 4, 0, (q2 * dt ** 3) / 2, 0],
    [0, (q2 * dt ** 4) / 4, 0, (q2 * dt ** 3) / 2],
    [(q2 * dt ** 3) / 2, 0, q2 * dt * dt, 0],
    [0, (q2 * dt ** 3) / 2, 0, q2 * dt * dt],
  ]
  kf.P = matAdd(matMul(matMul(F, kf.P), matT(F)), Q)
}

export function kf2dUpdate(kf: Kf2d, zx: number, zy: number, r: number): void {
  // H = [I2 0]; S = P[0:2,0:2] + r²I; K = P Hᵀ S⁻¹
  const r2 = r * r
  const S = [
    [kf.P[0][0] + r2, kf.P[0][1]],
    [kf.P[1][0], kf.P[1][1] + r2],
  ]
  const det = S[0][0] * S[1][1] - S[0][1] * S[1][0]
  const Si = [
    [S[1][1] / det, -S[0][1] / det],
    [-S[1][0] / det, S[0][0] / det],
  ]
  const PHt = kf.P.map((row) => [row[0], row[1]])
  const K = matMul(PHt, Si) // 4×2
  const iy = [zx - kf.x[0], zy - kf.x[1]]
  kf.x = kf.x.map((v, i) => v + K[i][0] * iy[0] + K[i][1] * iy[1])
  // P = (I - K H) P
  const KH = K.map((row) => [row[0], row[1], 0, 0])
  const IKH = KH.map((row, i) => row.map((v, j) => (i === j ? 1 - v : -v)))
  kf.P = matMul(IKH, kf.P)
}

/** 2σ covariance ellipse of the position block. */
export function covEllipse(P00: number, P01: number, P11: number): { a: number; b: number; angleDeg: number } {
  const eig = jacobiEigen([
    [P00, P01],
    [P01, P11],
  ])
  return {
    a: 2 * Math.sqrt(Math.max(eig.values[0], 0)),
    b: 2 * Math.sqrt(Math.max(eig.values[1], 0)),
    angleDeg: (Math.atan2(eig.vectors[0][1], eig.vectors[0][0]) * 180) / Math.PI,
  }
}

// ---------------------------------------------------------------- gaussian fusion

export function fuseGauss(m1: number, s1: number, m2: number, s2: number): { m: number; s: number } {
  const w1 = 1 / (s1 * s1)
  const w2 = 1 / (s2 * s2)
  return { m: (m1 * w1 + m2 * w2) / (w1 + w2), s: Math.sqrt(1 / (w1 + w2)) }
}

// ---------------------------------------------------------------- uncertainty propagation

/** GUM linear propagation: σ_y² = Σ (∂f/∂xᵢ)² σᵢ² (uncorrelated inputs). */
export function gumPropagate(
  f: (xs: number[]) => number,
  xs: number[],
  sigmas: number[],
): { sigma: number; sens: number[] } {
  const sens = xs.map((x, i) => {
    const h = Math.max(Math.abs(x) * 1e-6, 1e-9)
    const xp = [...xs]
    const xm = [...xs]
    xp[i] = x + h
    xm[i] = x - h
    return (f(xp) - f(xm)) / (2 * h)
  })
  const sigma = Math.sqrt(sens.reduce((s, c, i) => s + c * c * sigmas[i] * sigmas[i], 0))
  return { sigma, sens }
}

export function mcPropagate(
  f: (xs: number[]) => number,
  xs: number[],
  sigmas: number[],
  n: number,
  seed: number,
): { samples: number[]; mean: number; sigma: number } {
  const g = makeGauss(seed)
  const samples: number[] = []
  for (let i = 0; i < n; i++) {
    const draw = xs.map((x, j) => x + g() * sigmas[j])
    const v = f(draw)
    if (isFinite(v)) samples.push(v)
  }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length
  const sigma = Math.sqrt(samples.reduce((s, v) => s + (v - mean) ** 2, 0) / (samples.length - 1))
  return { samples, mean, sigma }
}

// ---------------------------------------------------------------- fringe projection math

/** 4-step phase shifting: wrapped phase from I(0°), I(90°), I(180°), I(270°). */
export function phaseFromShifts(i0: number, i90: number, i180: number, i270: number): number {
  return Math.atan2(i270 - i90, i0 - i180)
}

/** 1D phase unwrapping: remove 2π jumps along a line. */
export function unwrap1d(phi: number[]): number[] {
  const out = [phi[0]]
  let offset = 0
  for (let i = 1; i < phi.length; i++) {
    const d = phi[i] - phi[i - 1]
    if (d > Math.PI) offset -= 2 * Math.PI
    else if (d < -Math.PI) offset += 2 * Math.PI
    out.push(phi[i] + offset)
  }
  return out
}

// ---------------------------------------------------------------- ODE integrators

export type Deriv = (t: number, y: number[]) => number[]

export function eulerStep(f: Deriv, t: number, y: number[], h: number): number[] {
  const k = f(t, y)
  return y.map((v, i) => v + h * k[i])
}

export function rk4Step(f: Deriv, t: number, y: number[], h: number): number[] {
  const k1 = f(t, y)
  const k2 = f(t + h / 2, y.map((v, i) => v + (h / 2) * k1[i]))
  const k3 = f(t + h / 2, y.map((v, i) => v + (h / 2) * k2[i]))
  const k4 = f(t + h, y.map((v, i) => v + h * k3[i]))
  return y.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
}

/** Deterministic uniform generator passthrough (convenience re-export pattern). */
export const seededRand = mulberry32
