import { useEffect, useRef, type ReactNode } from 'react'

const STOPS: [number, [number, number, number]][] = [
  [0.0, [8, 11, 22]],
  [0.35, [23, 49, 94]],
  [0.65, [14, 116, 144]],
  [0.85, [34, 211, 238]],
  [1.0, [224, 242, 254]],
]

function colormap(t: number): [number, number, number] {
  const tt = Math.min(1, Math.max(0, t))
  for (let i = 1; i < STOPS.length; i++) {
    if (tt <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1]
      const [t1, c1] = STOPS[i]
      const u = (tt - t0) / (t1 - t0)
      return [0, 1, 2].map((k) => Math.round(c0[k] + u * (c1[k] - c0[k]))) as [number, number, number]
    }
  }
  return STOPS[STOPS.length - 1][1]
}

interface HeatmapProps {
  w: number
  h: number
  xr: [number, number]
  yr: [number, number]
  cost: (x: number, y: number) => number
  /** recompute the canvas only when this key changes */
  ckey: string
  onPick?: (x: number, y: number) => void
  onHover?: (x: number, y: number) => void
  onLeave?: () => void
  children?: ReactNode
  title?: ReactNode
}

/** Canvas cost-landscape heatmap (posterized → contour bands) with an SVG overlay. */
export function Heatmap({ w, h, xr, yr, cost, ckey, onPick, onHover, onLeave, children, title }: HeatmapProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const NX = 150
  const NY = Math.round((NX * h) / w)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const vals = new Float64Array(NX * NY)
    let mn = Infinity
    let mx = -Infinity
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const x = xr[0] + ((i + 0.5) / NX) * (xr[1] - xr[0])
        const y = yr[0] + ((j + 0.5) / NY) * (yr[1] - yr[0])
        const v = cost(x, y)
        vals[j * NX + i] = v
        if (v < mn) mn = v
        if (v > mx) mx = v
      }
    const img = ctx.createImageData(NX, NY)
    for (let p = 0; p < NX * NY; p++) {
      let t = Math.log1p(vals[p] - mn) / Math.log1p(mx - mn)
      t = Math.floor(t * 16) / 16 // posterize → contour-band look
      const [r, g, b] = colormap(t)
      img.data[p * 4] = r
      img.data[p * 4 + 1] = g
      img.data[p * 4 + 2] = b
      img.data[p * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ckey])

  const toDomain = (e: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * w
    const py = ((e.clientY - rect.top) / rect.height) * h
    return [xr[0] + (px / w) * (xr[1] - xr[0]), yr[0] + (py / h) * (yr[1] - yr[0])]
  }

  return (
    <div className="card overflow-hidden">
      {title && (
        <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">
          {title}
        </div>
      )}
      <div className="relative">
        <canvas ref={ref} width={NX} height={NY} className="block w-full" style={{ aspectRatio: `${w}/${h}` }} />
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className={`absolute inset-0 h-full w-full ${onPick ? 'cursor-crosshair' : ''}`}
          onPointerDown={(e) => onPick?.(...toDomain(e))}
          onPointerMove={(e) => onHover?.(...toDomain(e))}
          onPointerLeave={() => onLeave?.()}
        >
          {children}
        </svg>
      </div>
    </div>
  )
}
