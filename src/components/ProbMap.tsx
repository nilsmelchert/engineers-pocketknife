import { useEffect, useRef, type ReactNode } from 'react'

/** class-0 color (cyan), class-1 color (amber), neutral dark at p = 0.5 */
const C0 = [34, 211, 238]
const C1 = [251, 191, 36]
const BG = [13, 17, 27]

interface ProbMapProps {
  w: number
  h: number
  xr: [number, number]
  yr: [number, number]
  /** predicted probability of class 1 at (x, y) */
  prob: (x: number, y: number) => number
  /** recompute the canvas only when this key changes */
  ckey: string
  children?: ReactNode
  title?: ReactNode
}

/** Diverging probability shading for 2D classifiers, with an SVG overlay for data points. */
export function ProbMap({ w, h, xr, yr, prob, ckey, children, title }: ProbMapProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const NX = 110
  const NY = Math.round((NX * h) / w)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const img = ctx.createImageData(NX, NY)
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const x = xr[0] + ((i + 0.5) / NX) * (xr[1] - xr[0])
        const y = yr[1] - ((j + 0.5) / NY) * (yr[1] - yr[0])
        const p = Math.min(1, Math.max(0, prob(x, y)))
        const s = Math.abs(p - 0.5) * 2 // 0 at the boundary, 1 at confident
        const C = p < 0.5 ? C0 : C1
        const idx = (j * NX + i) * 4
        img.data[idx] = BG[0] + (C[0] - BG[0]) * s * 0.55
        img.data[idx + 1] = BG[1] + (C[1] - BG[1]) * s * 0.55
        img.data[idx + 2] = BG[2] + (C[2] - BG[2]) * s * 0.55
        img.data[idx + 3] = 255
      }
    ctx.putImageData(img, 0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ckey])

  return (
    <div className="card overflow-hidden">
      {title && (
        <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">
          {title}
        </div>
      )}
      <div className="relative">
        <canvas ref={ref} width={NX} height={NY} className="block w-full" style={{ aspectRatio: `${w}/${h}` }} />
        <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 h-full w-full">
          {children}
        </svg>
      </div>
    </div>
  )
}
