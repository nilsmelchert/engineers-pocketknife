/**
 * Machine-learning toolkit for the ML track: a tiny dense MLP with manual
 * backprop (binary classification, sigmoid output + BCE loss), SGD/Adam
 * optimizers, polynomial ridge regression, logistic regression, simulated
 * annealing and stochastic 2D-landscape steppers.
 */

import { mulberry32 } from './math'
import { solveN, type Fn2D, type Vec2 } from './optim'
import { makeGauss } from './stats'

// ---------------------------------------------------------------- activations

export type ActKey = 'tanh' | 'relu' | 'sigmoid'

export const ACT: Record<ActKey, { f: (x: number) => number; df: (x: number) => number }> = {
  tanh: { f: Math.tanh, df: (x) => 1 - Math.tanh(x) ** 2 },
  relu: { f: (x) => Math.max(0, x), df: (x) => (x > 0 ? 1 : 0) },
  sigmoid: {
    f: (x) => 1 / (1 + Math.exp(-x)),
    df: (x) => {
      const s = 1 / (1 + Math.exp(-x))
      return s * (1 - s)
    },
  },
}

export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x))

// ---------------------------------------------------------------- MLP

export interface Mlp {
  /** layer sizes, e.g. [2, 6, 6, 1] */
  sizes: number[]
  /** W[l][j][i]: weight from neuron i of layer l to neuron j of layer l+1 */
  W: number[][][]
  b: number[][]
  act: ActKey
}

export interface MlpGrads {
  dW: number[][][]
  db: number[][]
  loss: number
}

export function createMlp(sizes: number[], act: ActKey, seed: number): Mlp {
  const g = makeGauss(seed)
  const W = sizes.slice(0, -1).map((nIn, l) => {
    const nOut = sizes[l + 1]
    const scale = Math.sqrt(2 / nIn) // He-style init, fine for tanh/relu at this scale
    return Array.from({ length: nOut }, () => Array.from({ length: nIn }, () => g() * scale))
  })
  const b = sizes.slice(1).map((nOut) => new Array(nOut).fill(0))
  return { sizes, W, b, act }
}

/** Forward pass; returns pre-activations zs and activations as (as[0] = input). */
export function mlpForward(m: Mlp, x: number[]): { zs: number[][]; as: number[][] } {
  const L = m.W.length
  const as: number[][] = [x]
  const zs: number[][] = []
  for (let l = 0; l < L; l++) {
    const prev = as[l]
    const z = m.W[l].map((row, j) => row.reduce((s, w, i) => s + w * prev[i], m.b[l][j]))
    zs.push(z)
    const isOut = l === L - 1
    as.push(z.map((v) => (isOut ? sigmoid(v) : ACT[m.act].f(v))))
  }
  return { zs, as }
}

export const mlpPredict = (m: Mlp, x: number[]): number => mlpForward(m, x).as[m.W.length][0]

/** Activation of hidden neuron `idx` in hidden layer `layer` (0-based) for input x. */
export function mlpNeuron(m: Mlp, x: number[], layer: number, idx: number): number {
  return mlpForward(m, x).as[layer + 1][idx]
}

const EPS = 1e-9

/** Average BCE loss + gradients over a batch (binary labels 0/1). */
export function mlpGrad(m: Mlp, batch: { x: number[]; y: number }[]): MlpGrads {
  const L = m.W.length
  const dW = m.W.map((Wl) => Wl.map((row) => row.map(() => 0)))
  const db = m.b.map((bl) => bl.map(() => 0))
  let loss = 0
  for (const { x, y } of batch) {
    const { zs, as } = mlpForward(m, x)
    const p = as[L][0]
    loss += -(y * Math.log(p + EPS) + (1 - y) * Math.log(1 - p + EPS))
    // output delta for sigmoid + BCE simplifies to (p − y)
    let delta = [p - y]
    for (let l = L - 1; l >= 0; l--) {
      for (let j = 0; j < m.W[l].length; j++) {
        db[l][j] += delta[j]
        for (let i = 0; i < m.W[l][j].length; i++) dW[l][j][i] += delta[j] * as[l][i]
      }
      if (l > 0) {
        const next = new Array(m.sizes[l]).fill(0)
        for (let i = 0; i < m.sizes[l]; i++) {
          let s = 0
          for (let j = 0; j < m.W[l].length; j++) s += m.W[l][j][i] * delta[j]
          next[i] = s * ACT[m.act].df(zs[l - 1][i])
        }
        delta = next
      }
    }
  }
  const n = batch.length
  for (let l = 0; l < L; l++) {
    for (let j = 0; j < dW[l].length; j++) {
      db[l][j] /= n
      for (let i = 0; i < dW[l][j].length; i++) dW[l][j][i] /= n
    }
  }
  return { dW, db, loss: loss / n }
}

export function mlpEval(m: Mlp, data: { x: number[]; y: number }[]): { loss: number; acc: number } {
  let loss = 0
  let correct = 0
  for (const { x, y } of data) {
    const p = mlpPredict(m, x)
    loss += -(y * Math.log(p + EPS) + (1 - y) * Math.log(1 - p + EPS))
    if ((p > 0.5 ? 1 : 0) === y) correct++
  }
  return { loss: loss / data.length, acc: correct / data.length }
}

// ---------------------------------------------------------------- optimizers (mutate the model)

export function applySgd(m: Mlp, g: MlpGrads, lr: number, l2 = 0): void {
  for (let l = 0; l < m.W.length; l++)
    for (let j = 0; j < m.W[l].length; j++) {
      m.b[l][j] -= lr * g.db[l][j]
      for (let i = 0; i < m.W[l][j].length; i++)
        m.W[l][j][i] -= lr * (g.dW[l][j][i] + l2 * m.W[l][j][i])
    }
}

export interface AdamState {
  mW: number[][][]
  vW: number[][][]
  mb: number[][]
  vb: number[][]
  t: number
}

export function createAdamState(m: Mlp): AdamState {
  return {
    mW: m.W.map((Wl) => Wl.map((r) => r.map(() => 0))),
    vW: m.W.map((Wl) => Wl.map((r) => r.map(() => 0))),
    mb: m.b.map((bl) => bl.map(() => 0)),
    vb: m.b.map((bl) => bl.map(() => 0)),
    t: 0,
  }
}

export function applyAdam(m: Mlp, g: MlpGrads, st: AdamState, lr: number, l2 = 0): void {
  const b1 = 0.9
  const b2 = 0.999
  const eps = 1e-8
  st.t++
  const c1 = 1 - b1 ** st.t
  const c2 = 1 - b2 ** st.t
  for (let l = 0; l < m.W.length; l++)
    for (let j = 0; j < m.W[l].length; j++) {
      const gb = g.db[l][j]
      st.mb[l][j] = b1 * st.mb[l][j] + (1 - b1) * gb
      st.vb[l][j] = b2 * st.vb[l][j] + (1 - b2) * gb * gb
      m.b[l][j] -= (lr * (st.mb[l][j] / c1)) / (Math.sqrt(st.vb[l][j] / c2) + eps)
      for (let i = 0; i < m.W[l][j].length; i++) {
        const gw = g.dW[l][j][i] + l2 * m.W[l][j][i]
        st.mW[l][j][i] = b1 * st.mW[l][j][i] + (1 - b1) * gw
        st.vW[l][j][i] = b2 * st.vW[l][j][i] + (1 - b2) * gw * gw
        m.W[l][j][i] -= (lr * (st.mW[l][j][i] / c1)) / (Math.sqrt(st.vW[l][j][i] / c2) + eps)
      }
    }
}

// ---------------------------------------------------------------- polynomial ridge regression

/** Fit y ≈ Σ cᵢ xⁱ by ridge-regularized normal equations (bias unregularized). */
export function ridgeFit(
  xs: number[],
  ys: number[],
  degree: number,
  lambda: number,
): number[] | null {
  const d = degree + 1
  const A: number[][] = Array.from({ length: d }, () => new Array(d).fill(0))
  const b = new Array(d).fill(0)
  for (let n = 0; n < xs.length; n++) {
    const phi = new Array(d)
    phi[0] = 1
    for (let i = 1; i < d; i++) phi[i] = phi[i - 1] * xs[n]
    for (let i = 0; i < d; i++) {
      b[i] += phi[i] * ys[n]
      for (let j = i; j < d; j++) A[i][j] += phi[i] * phi[j]
    }
  }
  for (let i = 0; i < d; i++)
    for (let j = 0; j < i; j++) A[i][j] = A[j][i]
  for (let i = 1; i < d; i++) A[i][i] += lambda * xs.length
  return solveN(A, b)
}

export function polyEval(coef: number[], x: number): number {
  let v = 0
  for (let i = coef.length - 1; i >= 0; i--) v = v * x + coef[i]
  return v
}

// ---------------------------------------------------------------- logistic regression (2D)

export type LogregW = [number, number, number] // w1, w2, bias

export function logregStep(
  w: LogregW,
  data: { x: [number, number]; y: number }[],
  lr: number,
): { w: LogregW; loss: number } {
  let g0 = 0
  let g1 = 0
  let gb = 0
  let loss = 0
  for (const { x, y } of data) {
    const p = sigmoid(w[0] * x[0] + w[1] * x[1] + w[2])
    const e = p - y
    g0 += e * x[0]
    g1 += e * x[1]
    gb += e
    loss += -(y * Math.log(p + EPS) + (1 - y) * Math.log(1 - p + EPS))
  }
  const n = data.length
  return {
    w: [w[0] - (lr * g0) / n, w[1] - (lr * g1) / n, w[2] - (lr * gb) / n],
    loss: loss / n,
  }
}

// ---------------------------------------------------------------- 2D-landscape steppers

/** Gradient step with gaussian gradient noise — a stand-in for mini-batch sampling. */
export function sgdNoisyStep2D(
  fn: Fn2D,
  p: Vec2,
  lr: number,
  sigma: number,
  gauss: () => number,
): Vec2 {
  const g = fn.grad(p[0], p[1])
  return [p[0] - lr * (g[0] + sigma * gauss()), p[1] - lr * (g[1] + sigma * gauss())]
}

export interface Adam2DState {
  m: Vec2
  v: Vec2
  t: number
}

export function adam2DInit(): Adam2DState {
  return { m: [0, 0], v: [0, 0], t: 0 }
}

export function adamStep2D(
  fn: Fn2D,
  p: Vec2,
  st: Adam2DState,
  lr: number,
): { p: Vec2; st: Adam2DState } {
  const b1 = 0.9
  const b2 = 0.999
  const eps = 1e-8
  const g = fn.grad(p[0], p[1])
  const t = st.t + 1
  const m: Vec2 = [b1 * st.m[0] + (1 - b1) * g[0], b1 * st.m[1] + (1 - b1) * g[1]]
  const v: Vec2 = [b2 * st.v[0] + (1 - b2) * g[0] * g[0], b2 * st.v[1] + (1 - b2) * g[1] * g[1]]
  const c1 = 1 - b1 ** t
  const c2 = 1 - b2 ** t
  return {
    p: [
      p[0] - (lr * (m[0] / c1)) / (Math.sqrt(v[0] / c2) + eps),
      p[1] - (lr * (m[1] / c1)) / (Math.sqrt(v[1] / c2) + eps),
    ],
    st: { m, v, t },
  }
}

// ---------------------------------------------------------------- simulated annealing (1D)

export function annealStep(
  f: (x: number) => number,
  x: number,
  T: number,
  stepSigma: number,
  rand: () => number,
  gauss: () => number,
): { x: number; accepted: boolean; dC: number; pAccept: number } {
  const cand = x + gauss() * stepSigma
  const dC = f(cand) - f(x)
  const pAccept = dC <= 0 ? 1 : Math.exp(-dC / Math.max(T, 1e-9))
  const accepted = rand() < pAccept
  return { x: accepted ? cand : x, accepted, dC, pAccept }
}

// ---------------------------------------------------------------- misc

export function shuffled<T>(arr: T[], seed: number): T[] {
  const rand = mulberry32(seed)
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
