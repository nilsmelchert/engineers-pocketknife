/**
 * Toy Vision-Transformer and CLIP machinery for module ML·5.
 *
 * Design choice: the patch embeddings are hand-crafted, interpretable content
 * statistics (not random projections). Random Wq/Wk on image patches produce
 * arbitrary-looking attention; interpretable embeddings make "this head attends
 * to similar texture / to neighbors" honest and legible. Everything here is a
 * legible stand-in for what a trained ViT/CLIP learns, and the UI says so.
 */

import { conv2d, KERNELS } from './dl'
import { mulberry32 } from './math'

// ---------------------------------------------------------------- patchify

/** Cut an N×N image into (N/P)² row-major patches, each flattened to P² values. */
export function patchify(img: number[][], P: number): number[][] {
  const N = img.length
  const g = N / P
  const patches: number[][] = []
  for (let py = 0; py < g; py++)
    for (let px = 0; px < g; px++) {
      const patch: number[] = []
      for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) patch.push(img[py * P + y][px * P + x])
      patches.push(patch)
    }
  return patches
}

export interface PatchEmbedding {
  /** grid side length (N/P) */
  g: number
  P: number
  /** content features per patch: [mean, std, edgeX, edgeY, diag], z-scored */
  content: number[][]
  /** position features per patch: [sin row, cos row, sin col, cos col] */
  pos: number[][]
  /** raw pixel strips (for the click-a-patch inspector) */
  raw: number[][]
}

/** Content-statistic + sinusoidal-position embedding of every patch. */
export function patchEmbed(img: number[][], P: number): PatchEmbedding {
  const N = img.length
  const g = N / P
  const ex = conv2d(img, KERNELS.edgeX)
  const ey = conv2d(img, KERNELS.edgeY)
  const ed = conv2d(img, KERNELS.diag1)
  const raw = patchify(img, P)
  const rawStat: number[][] = []
  for (let py = 0; py < g; py++)
    for (let px = 0; px < g; px++) {
      let sum = 0
      let sum2 = 0
      let eX = 0
      let eY = 0
      let eD = 0
      for (let y = 0; y < P; y++)
        for (let x = 0; x < P; x++) {
          const iy = py * P + y
          const ix = px * P + x
          const v = img[iy][ix]
          sum += v
          sum2 += v * v
          eX += Math.abs(ex[iy][ix])
          eY += Math.abs(ey[iy][ix])
          eD += Math.abs(ed[iy][ix])
        }
      const n = P * P
      const mean = sum / n
      const std = Math.sqrt(Math.max(sum2 / n - mean * mean, 0))
      rawStat.push([mean, std, eX / n, eY / n, eD / n])
    }
  // z-score each of the 5 features across patches
  const D = 5
  const mu = new Array<number>(D).fill(0)
  const sd = new Array<number>(D).fill(0)
  for (const r of rawStat) for (let d = 0; d < D; d++) mu[d] += r[d] / rawStat.length
  for (const r of rawStat) for (let d = 0; d < D; d++) sd[d] += (r[d] - mu[d]) ** 2 / rawStat.length
  const content = rawStat.map((r) => r.map((v, d) => (v - mu[d]) / Math.max(Math.sqrt(sd[d]), 1e-6)))

  const pos: number[][] = []
  for (let py = 0; py < g; py++)
    for (let px = 0; px < g; px++)
      pos.push([
        Math.sin((py / g) * Math.PI * 2),
        Math.cos((py / g) * Math.PI * 2),
        Math.sin((px / g) * Math.PI * 2),
        Math.cos((px / g) * Math.PI * 2),
      ])

  return { g, P, content, pos, raw }
}

export type HeadKey = 'content' | 'hneighbor' | 'vneighbor' | 'global'

/**
 * Patch-to-patch attention for one interpretable head.
 * `content` head: softmax of content-embedding similarity (blended with
 * position by `posWeight`). The other three are fixed spatial heads that a
 * real ViT rediscovers: attend to horizontal neighbors, vertical neighbors,
 * or everything (global average).
 */
export function patchAttention(
  emb: PatchEmbedding,
  posWeight: number,
  scale: number,
  head: HeadKey,
): number[][] {
  const n = emb.content.length
  const g = emb.g
  const A: number[][] = []
  for (let i = 0; i < n; i++) {
    const ri = Math.floor(i / g)
    const ci = i % g
    const logits: number[] = []
    for (let j = 0; j < n; j++) {
      const rj = Math.floor(j / g)
      const cj = j % g
      let l: number
      if (head === 'content') {
        const dotC = emb.content[i].reduce((s, v, d) => s + v * emb.content[j][d], 0)
        const dotP = emb.pos[i].reduce((s, v, d) => s + v * emb.pos[j][d], 0)
        l = ((1 - posWeight) * dotC + posWeight * dotP * 2.5) * scale
      } else if (head === 'hneighbor') {
        l = (rj === ri ? 2 : -2) - Math.abs(cj - ci) * 0.6
      } else if (head === 'vneighbor') {
        l = (cj === ci ? 2 : -2) - Math.abs(rj - ri) * 0.6
      } else {
        l = 0
      }
      logits.push(l * (head === 'content' ? 1 : scale))
    }
    const mx = Math.max(...logits)
    const exps = logits.map((v) => Math.exp(v - mx))
    const sum = exps.reduce((a, b) => a + b, 0)
    A.push(exps.map((e) => e / sum))
  }
  return A
}

/** Shannon entropy of an attention row (nats) - "how focused is this query?". */
export function attnEntropy(row: number[]): number {
  return -row.reduce((s, p) => s + (p > 1e-9 ? p * Math.log(p) : 0), 0)
}

// ---------------------------------------------------------------- CLIP toy

export interface ClipItem {
  key: string
  emb: [number, number]
  label: { en: string; de: string }
}

// eight shape/brightness concepts placed on the unit circle; texts sit near
// their image with a small angular offset (an imperfect but aligned encoder)
const CLIP_DEFS: { key: string; angle: number; en: string; de: string }[] = [
  { key: 'disk-bright', angle: 0, en: 'a bright circle', de: 'ein heller Kreis' },
  { key: 'disk-dark', angle: 45, en: 'a dark circle', de: 'ein dunkler Kreis' },
  { key: 'square-bright', angle: 90, en: 'a bright square', de: 'ein helles Quadrat' },
  { key: 'square-dark', angle: 135, en: 'a dark square', de: 'ein dunkles Quadrat' },
  { key: 'line-bright', angle: 180, en: 'a bright line', de: 'eine helle Linie' },
  { key: 'line-dark', angle: 225, en: 'a dark line', de: 'eine dunkle Linie' },
  { key: 'cross-bright', angle: 270, en: 'a bright cross', de: 'ein helles Kreuz' },
  { key: 'cross-dark', angle: 315, en: 'a dark cross', de: 'ein dunkles Kreuz' },
]

const unit = (deg: number): [number, number] => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)]

export const CLIP_IMAGES: ClipItem[] = CLIP_DEFS.map((d) => ({
  key: d.key,
  emb: unit(d.angle),
  label: { en: d.en, de: d.de },
}))

export const CLIP_TEXTS: ClipItem[] = CLIP_DEFS.map((d, i) => {
  const rand = mulberry32(100 + i)
  return { key: d.key, emb: unit(d.angle + (rand() - 0.5) * 22), label: { en: d.en, de: d.de } }
})

export const cosSim = (a: [number, number], b: [number, number]): number => {
  const na = Math.hypot(a[0], a[1])
  const nb = Math.hypot(b[0], b[1])
  return (a[0] * b[0] + a[1] * b[1]) / Math.max(na * nb, 1e-9)
}

export function simMatrix(A: [number, number][], B: [number, number][]): number[][] {
  return A.map((a) => B.map((b) => cosSim(a, b)))
}

export function rowSoftmax(S: number[][], temp: number): number[][] {
  return S.map((row) => {
    const scaled = row.map((v) => v / temp)
    const mx = Math.max(...scaled)
    const exps = scaled.map((v) => Math.exp(v - mx))
    const sum = exps.reduce((a, b) => a + b, 0)
    return exps.map((e) => e / sum)
  })
}

/** Symmetric InfoNCE loss (image→text and text→image), matching the diagonal. */
export function infoNCE(S: number[][], temp: number): number {
  const n = S.length
  const rows = rowSoftmax(S, temp)
  const cols = rowSoftmax(
    S[0].map((_, j) => S.map((row) => row[j])),
    temp,
  )
  let loss = 0
  for (let i = 0; i < n; i++) loss += -Math.log(rows[i][i] + 1e-9) - Math.log(cols[i][i] + 1e-9)
  return loss / (2 * n)
}

/**
 * Gradient of the (image→text) InfoNCE term w.r.t. image embedding i, on the
 * unit circle - drives the drag-to-train button.
 */
export function infoNCEGradImage(
  imgEmb: [number, number][],
  txtEmb: [number, number][],
  temp: number,
  i: number,
): [number, number] {
  const sims = txtEmb.map((t) => cosSim(imgEmb[i], t))
  const p = rowSoftmax([sims], temp)[0]
  // dL/d(img_i) = (1/temp) Σ_j (p_j − 1{j=i}) · t_j   (cosine ≈ dot on unit circle)
  let gx = 0
  let gy = 0
  for (let j = 0; j < txtEmb.length; j++) {
    const c = (p[j] - (j === i ? 1 : 0)) / temp
    gx += c * txtEmb[j][0]
    gy += c * txtEmb[j][1]
  }
  return [gx, gy]
}

/** Zero-shot classification: cosine sim of a feature to class prompts → softmax. */
export function zeroShotClassify(
  feat: [number, number],
  prompts: [number, number][],
  temp: number,
): { probs: number[]; best: number } {
  const sims = prompts.map((p) => cosSim(feat, p))
  const probs = rowSoftmax([sims], temp)[0]
  let best = 0
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i
  return { probs, best }
}
