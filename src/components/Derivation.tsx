import { useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import { TeX } from './TeX'

export interface DerivationStep {
  /** KaTeX source for this step */
  tex: string
  /** one plain-language line explaining the step */
  note: string
}

const UI = {
  en: { show: 'Show derivation', hide: 'Hide derivation' },
  de: { show: 'Herleitung zeigen', hide: 'Herleitung verbergen' },
}

/**
 * Collapsible step-by-step derivation: numbered KaTeX steps, each with a short
 * explanation. Depth on demand — beginners can skip it, curious students expand it.
 */
export function Derivation({ title, steps }: { title: ReactNode; steps: DerivationStep[] }) {
  const t = useT(UI)
  const [open, setOpen] = useState(false)
  return (
    <div className="my-4 max-w-3xl overflow-hidden rounded-xl border border-accent2/40 bg-accent2/[0.05]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-[14px] font-semibold transition hover:bg-accent2/10"
      >
        <span>
          <span className="mr-2 text-accent2">∴</span>
          {title}
        </span>
        <span className="text-[12px] text-accent2">{open ? `▾ ${t.hide}` : `▸ ${t.show}`}</span>
      </button>
      {open && (
        <div className="border-t border-accent2/20 px-4 py-3">
          {steps.map((s, i) => (
            <div key={i} className="mb-3 last:mb-0">
              <div className="flex items-start gap-3">
                <span className="mt-3 font-mono text-[11px] text-accent2/70">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <TeX block>{s.tex}</TeX>
                  <div className="mt-0.5 text-[13px] leading-5 text-muted">{s.note}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
