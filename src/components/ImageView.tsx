import type { PointerEvent, ReactNode } from 'react'
import { useRef } from 'react'

export interface ImagePoint {
  u: number
  v: number
  color: string
  label?: string
  r?: number
}

interface ImageViewProps {
  w?: number
  h?: number
  title?: ReactNode
  points?: ImagePoint[]
  /** faint polylines in pixel coords, e.g. projected object edges */
  polylines?: { pts: [number, number][]; color?: string; width?: number; dash?: string; fill?: string; opacity?: number }[]
  principal?: { cx: number; cy: number }
  grid?: boolean
  onDragImage?: (u: number, v: number) => void
  children?: ReactNode
  className?: string
}

/**
 * A stylized camera sensor image: SVG in pixel coordinates (origin top-left),
 * with optional pixel grid, principal-point marker and draggable interaction.
 */
export function ImageView({
  w = 640,
  h = 480,
  title,
  points = [],
  polylines = [],
  principal,
  grid = true,
  onDragImage,
  children,
  className = '',
}: ImageViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)

  const toImage = (e: PointerEvent): [number, number] => {
    const svg = svgRef.current!
    const rect = svg.getBoundingClientRect()
    return [((e.clientX - rect.left) / rect.width) * w, ((e.clientY - rect.top) / rect.height) * h]
  }

  const handleDown = (e: PointerEvent) => {
    if (!onDragImage) return
    dragging.current = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const [u, v] = toImage(e)
    onDragImage(u, v)
  }
  const handleMove = (e: PointerEvent) => {
    if (!onDragImage || !dragging.current) return
    const [u, v] = toImage(e)
    onDragImage(u, v)
  }

  return (
    <div className={`card overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">
          <span>{title}</span>
          <span className="font-mono">
            {w}×{h}px
          </span>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className={`block w-full ${onDragImage ? 'cursor-crosshair touch-none' : ''}`}
        style={{ background: 'radial-gradient(120% 120% at 50% 40%, #141a28 0%, #0a0e17 100%)' }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={() => (dragging.current = false)}
      >
        <clipPath id="imgclip">
          <rect x={0} y={0} width={w} height={h} />
        </clipPath>
        <g clipPath="url(#imgclip)">
          {grid && (
            <g stroke="rgba(255,255,255,0.05)" strokeWidth={1}>
              {Array.from({ length: Math.floor(w / 80) }, (_, i) => (
                <line key={`v${i}`} x1={(i + 1) * 80} y1={0} x2={(i + 1) * 80} y2={h} />
              ))}
              {Array.from({ length: Math.floor(h / 80) }, (_, i) => (
                <line key={`h${i}`} x1={0} y1={(i + 1) * 80} x2={w} y2={(i + 1) * 80} />
              ))}
            </g>
          )}
          {principal && (
            <g stroke="rgba(251,191,36,0.6)" strokeWidth={1.5}>
              <line x1={principal.cx - 10} y1={principal.cy} x2={principal.cx + 10} y2={principal.cy} />
              <line x1={principal.cx} y1={principal.cy - 10} x2={principal.cx} y2={principal.cy + 10} />
              <circle cx={principal.cx} cy={principal.cy} r={5} fill="none" strokeWidth={1} />
            </g>
          )}
          {polylines.map((pl, i) => (
            <polyline
              key={i}
              points={pl.pts.map(([x, y]) => `${x},${y}`).join(' ')}
              fill={pl.fill ?? 'none'}
              stroke={pl.color ?? 'rgba(255,255,255,0.35)'}
              strokeWidth={pl.width ?? 1.5}
              strokeDasharray={pl.dash}
              opacity={pl.opacity ?? 1}
              strokeLinejoin="round"
            />
          ))}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.u} cy={p.v} r={(p.r ?? 5) + 3} fill={p.color} opacity={0.25} />
              <circle cx={p.u} cy={p.v} r={p.r ?? 5} fill={p.color} stroke="#0a0e17" strokeWidth={1.5} />
              {p.label && (
                <text x={p.u + 9} y={p.v - 7} fill={p.color} fontSize={13} fontFamily="JetBrains Mono, monospace">
                  {p.label}
                </text>
              )}
            </g>
          ))}
          {children}
        </g>
        <rect x={0.5} y={0.5} width={w - 1} height={h - 1} fill="none" stroke="rgba(255,255,255,0.15)" />
      </svg>
    </div>
  )
}
