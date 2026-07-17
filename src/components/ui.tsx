import type { ReactNode } from 'react'

// ---------------------------------------------------------------- Slider

interface SliderProps {
  label: ReactNode
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  accent?: string
}

export function Slider({ label, value, min, max, step = 1, onChange, format, accent }: SliderProps) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <span
          className="font-mono text-[13px] tabular-nums"
          style={{ color: accent ?? 'var(--color-accent)' }}
        >
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

// ---------------------------------------------------------------- Segmented toggle

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="inline-flex rounded-lg border border-white/15 bg-white/[0.04] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`cursor-pointer rounded-md px-3 py-1 text-sm font-medium transition ${
            o.value === value
              ? 'bg-accent/20 text-accent shadow-[inset_0_0_0_1px_rgba(34,211,238,0.4)]'
              : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- Section / headings

interface SectionProps {
  id?: string
  kicker?: string
  title: ReactNode
  children: ReactNode
}

export function Section({ id, kicker, title, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-24 py-8 md:py-10">
      {kicker && (
        <div className="mb-1 text-xs font-semibold tracking-[0.2em] text-accent uppercase">
          {kicker}
        </div>
      )}
      <h2 className="mb-4 text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------- Info box

export function InfoBox({
  title,
  children,
  tone = 'accent',
}: {
  title?: ReactNode
  children: ReactNode
  tone?: 'accent' | 'warn' | 'tip'
}) {
  const border =
    tone === 'accent' ? 'border-accent/40' : tone === 'warn' ? 'border-warn/40' : 'border-green-400/40'
  const bg =
    tone === 'accent' ? 'bg-accent/[0.06]' : tone === 'warn' ? 'bg-warn/[0.06]' : 'bg-green-400/[0.05]'
  return (
    <div className={`my-4 rounded-xl border ${border} ${bg} px-4 py-3 text-[14px] leading-6`}>
      {title && <div className="mb-1 font-semibold">{title}</div>}
      {children}
    </div>
  )
}

// ---------------------------------------------------------------- Value readout

export function Readout({
  label,
  value,
  unit,
  accent,
}: {
  label: ReactNode
  value: string
  unit?: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <div className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</div>
      <div
        className="font-mono text-lg font-semibold tabular-nums"
        style={{ color: accent ?? 'var(--color-accent)' }}
      >
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted">{unit}</span>}
      </div>
    </div>
  )
}
