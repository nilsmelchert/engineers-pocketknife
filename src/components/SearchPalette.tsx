import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLangState, useT } from '../i18n'
import { TRACKS } from './Layout'
import { LAB_INDEX } from '../lib/labIndex'

const UI = {
  en: { placeholder: 'Search modules and labs…', empty: 'No results', module: 'module', lab: 'lab' },
  de: { placeholder: 'Module und Labore durchsuchen…', empty: 'Keine Treffer', module: 'Modul', lab: 'Labor' },
}

interface Candidate {
  type: 'module' | 'lab'
  path: string
  sectionId?: string
  label: { en: string; de: string }
  sub: { en: string; de: string }
  haystacks: string[]
  titleHay: string[]
}

function buildIndex(): Candidate[] {
  const out: Candidate[] = []
  for (const track of TRACKS) {
    for (const m of track.modules) {
      out.push({
        type: 'module',
        path: m.path,
        label: m.title,
        sub: track.title,
        titleHay: [m.title.en, m.title.de, m.short.en, m.short.de].map((s) => s.toLowerCase()),
        haystacks: [
          ...m.topics.en,
          ...m.topics.de,
          m.desc.en,
          m.desc.de,
        ].map((s) => s.toLowerCase()),
      })
    }
  }
  for (const lab of LAB_INDEX) {
    const track = TRACKS.find((tr) => tr.modules.some((m) => m.path === lab.path))
    const mod = track?.modules.find((m) => m.path === lab.path)
    out.push({
      type: 'lab',
      path: lab.path,
      sectionId: lab.sectionId,
      label: lab.title,
      sub: mod?.title ?? { en: '', de: '' },
      titleHay: [lab.title.en, lab.title.de].map((s) => s.toLowerCase()),
      haystacks: [],
    })
  }
  return out
}

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT(UI)
  const { lang } = useLangState()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const index = useMemo(buildIndex, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSel(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return index.filter((c) => c.type === 'module').slice(0, 10)
    return index
      .map((c) => {
        let score = 0
        for (const h of c.titleHay) {
          if (h.includes(q)) score = Math.max(score, h.startsWith(q) ? 40 : 30)
        }
        for (const h of c.haystacks) {
          if (h.includes(q)) score = Math.max(score, h.split(/\s+/).some((w) => w.startsWith(q)) ? 18 : 8)
        }
        return { c, score }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || (a.c.type === 'module' ? -1 : 1))
      .slice(0, 12)
      .map((r) => r.c)
  }, [query, index])

  const go = (c: Candidate) => {
    onClose()
    navigate(c.path, c.sectionId ? { state: { scrollTo: c.sectionId } } : undefined)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-24 backdrop-blur-sm" onPointerDown={onClose}>
      <div
        className="card w-full max-w-xl overflow-hidden bg-[#10141f]/95 shadow-2xl shadow-black/50"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
          <span className="text-muted">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSel(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSel((s) => Math.min(s + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSel((s) => Math.max(s - 1, 0))
              } else if (e.key === 'Enter' && results[sel]) {
                go(results[sel])
              } else if (e.key === 'Escape') {
                onClose()
              }
            }}
            placeholder={t.placeholder}
            className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted/60"
          />
          <kbd className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] text-muted">esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 && <div className="px-3 py-6 text-center text-[13px] text-muted">{t.empty}</div>}
          {results.map((c, i) => (
            <button
              key={`${c.path}-${c.sectionId ?? 'm'}`}
              onClick={() => go(c)}
              onMouseEnter={() => setSel(i)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                i === sel ? 'bg-accent/15' : ''
              }`}
            >
              <span className={`chip shrink-0 text-[10px] uppercase ${c.type === 'lab' ? 'text-accent' : ''}`}>
                {c.type === 'lab' ? t.lab : t.module}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[14px] font-medium ${i === sel ? 'text-accent' : 'text-ink'}`}>
                  {c.label[lang]}
                </span>
                <span className="block truncate text-[11.5px] text-muted">{c.sub[lang]}</span>
              </span>
              {i === sel && <span className="text-[11px] text-muted">↵</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
