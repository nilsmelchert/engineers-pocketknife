import type { ReactNode } from 'react'

interface MatrixViewProps {
  /** rows of numbers (or pre-formatted strings) */
  values: (number | string)[][]
  label?: ReactNode
  digits?: number
  /** optional CSS color per cell, keyed "row,col" */
  highlight?: Record<string, string>
  className?: string
}

/** A live numeric matrix with CSS brackets, monospaced and color-highlightable. */
export function MatrixView({ values, label, digits = 2, highlight, className = '' }: MatrixViewProps) {
  const cols = values[0]?.length ?? 0
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {label != null && <div className="text-ink/90">{label}</div>}
      <div className="flex items-stretch">
        <div className="w-1.5 rounded-l border-y-2 border-l-2 border-white/40" />
        <div
          className="grid gap-x-3 gap-y-0.5 px-2 py-1.5 font-mono text-[13px] leading-5"
          style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}
        >
          {values.flatMap((row, r) =>
            row.map((v, c) => (
              <div
                key={`${r},${c}`}
                className="text-right tabular-nums"
                style={{ color: highlight?.[`${r},${c}`] ?? 'rgba(230,234,242,0.85)' }}
              >
                {typeof v === 'number' ? formatEntry(v, digits) : v}
              </div>
            )),
          )}
        </div>
        <div className="w-1.5 rounded-r border-y-2 border-r-2 border-white/40" />
      </div>
    </div>
  )
}

function formatEntry(v: number, digits: number): string {
  const s = v.toFixed(digits)
  return s === (-0).toFixed(digits) ? (0).toFixed(digits) : s
}
