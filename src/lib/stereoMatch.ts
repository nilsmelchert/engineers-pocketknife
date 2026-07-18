/**
 * Synthetic stereo pair + block matching for the live disparity lab.
 *
 * The scene is rendered analytically into BOTH views from a depth model
 * (no image warping → no sampling holes): a slanted background wall plus
 * three foreground objects, textured with procedural value noise. Ground-truth
 * disparity is known per pixel, and left-image pixels whose background is
 * occluded in the right view are marked (excluded from error statistics).
 */

import { mulberry32 } from './math'
import { makeGauss } from './stats'

export const SM_W = 96
export const SM_H = 64
export const SM_MAXD = 28

export interface StereoScene {
  left: Float32Array
  right: Float32Array
  /** ground-truth disparity on the LEFT image */
  trueDisp: Float32Array
  /** 1 = this left pixel's surface is hidden in the right view */
  occluded: Uint8Array
}

// ---------------------------------------------------------------- scene model

interface SceneObj {
  x0: number
  x1: number
  y0: number
  y1: number
  d: number
  disk?: boolean
}

const OBJS: SceneObj[] = [
  { x0: 14, x1: 34, y0: 18, y1: 46, d: 18 }, // left box
  { x0: 58, x1: 82, y0: 26, y1: 56, d: 24 }, // right box (nearer)
  { x0: 38, x1: 56, y0: 8, y1: 26, d: 14, disk: true }, // disk
]

/** disparity of the surface visible at left-image pixel (x, y) */
function dispAt(x: number, y: number): number {
  let d = 4 + (6 * x) / SM_W // slanted background wall, d = 4 → 10
  for (const o of OBJS) {
    if (o.disk) {
      const cx = (o.x0 + o.x1) / 2
      const cy = (o.y0 + o.y1) / 2
      const r = (o.x1 - o.x0) / 2
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) d = Math.max(d, o.d)
    } else if (x >= o.x0 && x < o.x1 && y >= o.y0 && y < o.y1) {
      d = Math.max(d, o.d)
    }
  }
  return d
}

// procedural value-noise texture, sampled in "world" coordinates so both views
// see the same surface pattern shifted by its disparity
function makeTexture(seed: number): (wx: number, y: number, objId: number) => number {
  const rand = mulberry32(seed)
  const N = 64
  const lattice = new Float32Array(N * N)
  for (let i = 0; i < N * N; i++) lattice[i] = rand()
  const at = (ix: number, iy: number) => lattice[((iy % N) + N) % N * N + (((ix % N) + N) % N)]
  return (wx, y, objId) => {
    // per-object offset so surfaces have distinct texture patches
    const ox = wx * 0.9 + objId * 17.3
    const oy = y * 0.9 + objId * 9.1
    const ix = Math.floor(ox)
    const iy = Math.floor(oy)
    const fx = ox - ix
    const fy = oy - iy
    const v00 = at(ix, iy)
    const v10 = at(ix + 1, iy)
    const v01 = at(ix, iy + 1)
    const v11 = at(ix + 1, iy + 1)
    const bil = v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy
    return 0.55 * bil + 0.25 * Math.sin(wx * 0.55 + objId) * Math.sin(y * 0.4) + 0.2
  }
}

/** which object id is visible at left pixel (x, y): 0 = wall, 1.. = OBJS index+1 */
function objIdAt(x: number, y: number): number {
  let id = 0
  let best = 4 + (6 * x) / SM_W
  OBJS.forEach((o, i) => {
    const inside = o.disk
      ? (x - (o.x0 + o.x1) / 2) ** 2 + (y - (o.y0 + o.y1) / 2) ** 2 <= ((o.x1 - o.x0) / 2) ** 2
      : x >= o.x0 && x < o.x1 && y >= o.y0 && y < o.y1
    if (inside && o.d > best) {
      best = o.d
      id = i + 1
    }
  })
  return id
}

export function makeStereoPair(texture: number, noise: number, seed: number): StereoScene {
  const tex = makeTexture(seed)
  const gL = makeGauss(seed + 1)
  const gR = makeGauss(seed + 2)
  const left = new Float32Array(SM_W * SM_H)
  const right = new Float32Array(SM_W * SM_H)
  const trueDisp = new Float32Array(SM_W * SM_H)
  const occluded = new Uint8Array(SM_W * SM_H)

  const base = 0.5

  // left view: surface at (x, y) has world-x = x + d/2 (midpoint convention)
  for (let y = 0; y < SM_H; y++)
    for (let x = 0; x < SM_W; x++) {
      const d = dispAt(x, y)
      const id = objIdAt(x, y)
      const v = base + texture * (tex(x + d / 2, y, id) - 0.5)
      left[y * SM_W + x] = Math.min(1, Math.max(0, v + gL() * noise))
      trueDisp[y * SM_W + x] = d
    }

  // right view: the surface visible at RIGHT pixel x is the one whose left
  // pixel is x + d — resolve with a z-buffer over left pixels
  const rightD = new Float32Array(SM_W * SM_H).fill(-1)
  for (let y = 0; y < SM_H; y++)
    for (let x = 0; x < SM_W; x++) {
      const d = dispAt(x, y)
      const xr = Math.round(x - d)
      if (xr >= 0 && xr < SM_W && d > rightD[y * SM_W + xr]) rightD[y * SM_W + xr] = d
    }
  for (let y = 0; y < SM_H; y++)
    for (let xr = 0; xr < SM_W; xr++) {
      let d = rightD[y * SM_W + xr]
      if (d < 0) d = 4 + (6 * xr) / SM_W // fell off the left edge: extend the wall
      const xl = xr + d // the left pixel seeing the same surface point
      const id = objIdAt(Math.min(SM_W - 1, Math.round(xl)), y)
      right[y * SM_W + xr] = Math.min(1, Math.max(0, base + texture * (tex(xl + d / 2, y, id) - 0.5) + gR() * noise))
    }

  // occlusion on the left image: a left pixel is occluded-in-right if some
  // other left pixel with larger disparity maps to the same right pixel
  for (let y = 0; y < SM_H; y++)
    for (let x = 0; x < SM_W; x++) {
      const d = trueDisp[y * SM_W + x]
      const xr = Math.round(x - d)
      if (xr < 0 || xr >= SM_W) {
        occluded[y * SM_W + x] = 1
        continue
      }
      if (rightD[y * SM_W + xr] > d + 0.5) occluded[y * SM_W + x] = 1
    }

  return { left, right, trueDisp, occluded }
}

// ---------------------------------------------------------------- block matching

export type MatchMetric = 'sad' | 'ssd'

/**
 * Winner-take-all block matching with the standard fast structure:
 * for each candidate disparity build the pixelwise difference image and
 * box-filter it with two running-sum passes — O(W·H·D) instead of the naive
 * O(W·H·D·win²).
 */
export function blockMatch(
  s: StereoScene,
  win: number,
  metric: MatchMetric,
): { disp: Float32Array; ms: number } {
  const t0 = performance.now()
  const half = Math.floor(win / 2)
  const n = SM_W * SM_H
  const best = new Float32Array(n).fill(Infinity)
  const disp = new Float32Array(n)

  const diff = new Float32Array(n)
  const rowAcc = new Float32Array(n)
  const boxAcc = new Float32Array(n)

  for (let d = 0; d <= SM_MAXD; d++) {
    // pixelwise cost at disparity d
    for (let y = 0; y < SM_H; y++)
      for (let x = 0; x < SM_W; x++) {
        const xr = x - d
        const e = xr >= 0 ? s.left[y * SM_W + x] - s.right[y * SM_W + xr] : 1
        diff[y * SM_W + x] = metric === 'sad' ? Math.abs(e) : e * e
      }
    // horizontal running sum
    for (let y = 0; y < SM_H; y++) {
      let acc = 0
      const row = y * SM_W
      for (let x = 0; x < SM_W; x++) {
        acc += diff[row + x]
        if (x - win >= 0) acc -= diff[row + x - win]
        rowAcc[row + x] = acc
      }
    }
    // vertical running sum of the horizontal sums
    for (let x = 0; x < SM_W; x++) {
      let acc = 0
      for (let y = 0; y < SM_H; y++) {
        acc += rowAcc[y * SM_W + x]
        if (y - win >= 0) acc -= rowAcc[(y - win) * SM_W + x]
        boxAcc[y * SM_W + x] = acc
      }
    }
    // boxAcc at (x, y) covers the window [x-win+1..x] × [y-win+1..y];
    // recenter so it corresponds to the window around (x-half, y-half)
    for (let y = half; y < SM_H - half; y++)
      for (let x = half; x < SM_W - half; x++) {
        const c = boxAcc[(y + half) * SM_W + (x + half)]
        const i = y * SM_W + x
        if (c < best[i]) {
          best[i] = c
          disp[i] = d
        }
      }
  }
  return { disp, ms: performance.now() - t0 }
}

/** Full cost curve cost(d) for one pixel — powers the click-a-pixel probe. */
export function costCurve(s: StereoScene, x: number, y: number, win: number, metric: MatchMetric): number[] {
  const half = Math.floor(win / 2)
  const out: number[] = []
  for (let d = 0; d <= SM_MAXD; d++) {
    let c = 0
    let cnt = 0
    for (let dy = -half; dy <= half; dy++)
      for (let dx = -half; dx <= half; dx++) {
        const yy = y + dy
        const xx = x + dx
        if (yy < 0 || yy >= SM_H || xx < 0 || xx >= SM_W) continue
        const xr = xx - d
        const e = xr >= 0 ? s.left[yy * SM_W + xx] - s.right[yy * SM_W + xr] : 1
        c += metric === 'sad' ? Math.abs(e) : e * e
        cnt++
      }
    out.push(c / Math.max(cnt, 1))
  }
  return out
}

/** Median |error| and bad-pixel rate (>1 px), excluding occluded pixels and the border. */
export function dispStats(disp: Float32Array, s: StereoScene, win: number): { medianErr: number; badPct: number } {
  const half = Math.floor(win / 2)
  const errs: number[] = []
  let bad = 0
  for (let y = half; y < SM_H - half; y++)
    for (let x = half; x < SM_W - half; x++) {
      const i = y * SM_W + x
      if (s.occluded[i]) continue
      const e = Math.abs(disp[i] - s.trueDisp[i])
      errs.push(e)
      if (e > 1) bad++
    }
  errs.sort((a, b) => a - b)
  return {
    medianErr: errs.length ? errs[Math.floor(errs.length / 2)] : 0,
    badPct: errs.length ? (100 * bad) / errs.length : 0,
  }
}
