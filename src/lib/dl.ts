/**
 * Deep-learning demo toolkit: a procedural test image, 2D convolution and
 * pooling, and the toy self-attention computation for the transformer lab.
 */

import { makeGauss } from './stats'

// ---------------------------------------------------------------- test image

export const IMG_N = 48

/** Procedural 48×48 grayscale test image (gradient + disk + square + diagonal line). */
export function makeTestImage(): number[][] {
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

// ---------------------------------------------------------------- conv / pool

/** Valid-ish 2D convolution (zero padding, same size). Kernel is k×k, k odd. */
export function conv2d(img: number[][], kernel: number[][]): number[][] {
  const H = img.length
  const W = img[0].length
  const k = kernel.length
  const half = Math.floor(k / 2)
  const out: number[][] = Array.from({ length: H }, () => new Array(W).fill(0))
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0
      for (let dy = 0; dy < k; dy++)
        for (let dx = 0; dx < k; dx++) {
          const yy = y + dy - half
          const xx = x + dx - half
          if (yy >= 0 && yy < H && xx >= 0 && xx < W) s += img[yy][xx] * kernel[dy][dx]
        }
      out[y][x] = s
    }
  return out
}

export const reluImg = (img: number[][]): number[][] => img.map((row) => row.map((v) => Math.max(0, v)))

/** 2×2 max pooling (halves the resolution). */
export function maxPool2(img: number[][]): number[][] {
  const H = Math.floor(img.length / 2)
  const W = Math.floor(img[0].length / 2)
  return Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) =>
      Math.max(img[2 * y][2 * x], img[2 * y][2 * x + 1], img[2 * y + 1][2 * x], img[2 * y + 1][2 * x + 1]),
    ),
  )
}

export const KERNELS: Record<string, number[][]> = {
  edgeX: [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ],
  edgeY: [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ],
  sharpen: [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0],
  ],
  blur: [
    [1 / 9, 1 / 9, 1 / 9],
    [1 / 9, 1 / 9, 1 / 9],
    [1 / 9, 1 / 9, 1 / 9],
  ],
  emboss: [
    [-2, -1, 0],
    [-1, 1, 1],
    [0, 1, 2],
  ],
  diag1: [
    [0, 1, 2],
    [-1, 0, 1],
    [-2, -1, 0],
  ],
}

// ---------------------------------------------------------------- toy attention

export const TOKENS = ['the', 'robot', 'picks', 'the', 'red', 'cube']

const D_EMB = 6
const D_HEAD = 4

/** Fixed toy embeddings + seeded projection matrices, computed once. */
function buildToy() {
  const g = makeGauss(1234)
  // hand-shaped embeddings: give related tokens correlated directions
  const base: Record<string, number[]> = {
    the: [0.1, 0.05, -0.1, 0.02, 0.0, 0.08],
    robot: [0.9, 0.2, 0.1, -0.3, 0.5, 0.1],
    picks: [0.1, 0.95, -0.2, 0.4, -0.1, 0.3],
    red: [-0.2, 0.1, 0.9, 0.5, 0.2, -0.1],
    cube: [0.3, -0.1, 0.6, 0.9, -0.2, 0.2],
  }
  const E = TOKENS.map((tok) => base[tok])
  const mat = (rows: number, cols: number) =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => g() * 0.55))
  return { E, Wq: mat(D_EMB, D_HEAD), Wk: mat(D_EMB, D_HEAD), Wv: mat(D_EMB, D_HEAD) }
}

const TOY = buildToy()

const matVec = (M: number[][], v: number[]): number[] =>
  M[0].map((_, j) => v.reduce((s, vi, i) => s + vi * M[i][j], 0))

/**
 * Toy scaled-dot-product self-attention.
 * `scale` multiplies the logits (1 = standard 1/√d); `causal` masks the future.
 * Returns the row-stochastic attention matrix.
 */
export function attentionMatrix(scale: number, causal: boolean): number[][] {
  const Q = TOY.E.map((e) => matVec(TOY.Wq, e))
  const K = TOY.E.map((e) => matVec(TOY.Wk, e))
  const n = TOKENS.length
  const A: number[][] = []
  for (let i = 0; i < n; i++) {
    const logits = K.map((k, j) => {
      if (causal && j > i) return -Infinity
      const dot = Q[i].reduce((s, qv, d) => s + qv * k[d], 0)
      return (dot / Math.sqrt(D_HEAD)) * scale
    })
    const mx = Math.max(...logits.filter((l) => isFinite(l)))
    const exps = logits.map((l) => (isFinite(l) ? Math.exp(l - mx) : 0))
    const sum = exps.reduce((a, b) => a + b, 0)
    A.push(exps.map((e) => e / sum))
  }
  return A
}
