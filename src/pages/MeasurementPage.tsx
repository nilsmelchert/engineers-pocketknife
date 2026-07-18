import { useMemo, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { PageToc } from '../components/PageToc'
import { Readout, Section, Segmented, Slider } from '../components/ui'
import { fmt } from '../lib/math'
import { gumPropagate, mcPropagate } from '../lib/signal'
import { makeGauss } from '../lib/stats'

const T = {
  en: {
    kicker: 'Metrology · Module 1',
    title: 'Measurement Theory',
    intro:
      'A measurement without an uncertainty is not a result — it is a rumor. Metrology is the discipline of saying how well you know a number, and it turns out that this second number (the uncertainty) is often harder, and more valuable, than the first. This module is the thinking framework behind every serious datasheet, calibration certificate and test report.',
    targetTitle: 'Interactive: accuracy is not precision',
    target1: 'Two independent virtues, endlessly confused. Precision (repeatability) is how tightly the shots cluster; trueness is how well their center hits the truth. The overall accuracy needs both. Slide the two knobs and watch the four archetypes appear — and note the trap: a precise instrument looks trustworthy, but with a bias it is confidently wrong. Random error is visible from repetition alone; systematic error is invisible without a reference.',
    bias: 'systematic error (bias)',
    spread: 'random error (σ)',
    trueness: 'trueness (offset of mean)',
    precision: 'precision (spread)',
    propTitle: 'Interactive: error propagation — GUM vs. Monte Carlo',
    prop1: 'Derived quantities inherit uncertainty from their inputs. The GUM recipe linearizes: sensitivity coefficients ∂f/∂xᵢ times input uncertainties, summed in quadrature. Monte Carlo just simulates thousands of virtual measurements. Compare them on three classic formulas: for well-behaved cases they agree beautifully — but push the current uncertainty on R = V/I upward and watch the histogram grow a skewed tail that the Gaussian cannot describe: linearization has limits, and MC is the honest referee.',
    presets: { area: 'area A = L·W', density: 'density ρ = m/V', resistance: 'resistance R = V/I' },
    sigma1: 'uncertainty input 1',
    sigma2: 'uncertainty input 2',
    gumS: 'σ (GUM, linearized)',
    mcS: 'σ (Monte Carlo)',
    result: 'result',
    histTitle: 'Monte-Carlo distribution of the result (amber: GUM Gaussian)',
    meanTitle: 'Interactive: the uncertainty of the mean',
    mean1: 'Averaging n repeated measurements shrinks the random uncertainty by √n — the cheapest accuracy upgrade in engineering. But watch the toggle: add a systematic offset and the mean converges ever more confidently to the wrong value. Averaging averages the noise, never the bias. This asymmetry is why calibration (removing bias against a reference) and repetition (removing noise) are two different jobs.',
    nLabel: 'repeated measurements n',
    withBias: 'add systematic bias of 0.5',
    sigmaMean: 'σ of the mean = σ/√n',
    actualErr: 'actual error of the mean',
    conceptTitle: 'The metrologist’s checklist',
    conceptList: [
      'Every uncertainty budget lists contributions — repeatability, calibration of the reference, temperature, resolution — converts them to standard uncertainties, and combines them in quadrature (GUM). The expanded uncertainty U = k·u with k = 2 covers ≈ 95 %.',
      'Resolution is not uncertainty: a display with 0.001 mm digits can be wrong by 0.1 mm. The last digit tells you nothing about trueness.',
      'Calibration is comparison against a better reference — and it forms an unbroken chain to national standards (traceability). Your camera calibration (Vision track) is exactly such a step: the checkerboard is the reference, the reprojection RMS is a repeatability statement.',
      'Report results as value ± U (k = 2) with units — and be suspicious of any number that arrives naked.',
    ],
    budgetTitle: 'A miniature uncertainty budget',
    budgetHead: ['contribution', 'u (µm)'],
    budgetRows: [
      ['repeatability (25 measurements)', '1.2'],
      ['reference gauge calibration', '0.8'],
      ['temperature (±1 K, steel, 100 mm)', '0.7'],
      ['resolution (0.5 µm / √12)', '0.14'],
    ],
    budgetCombined: 'combined u = 1.6 µm → expanded U (k = 2) = 3.2 µm',
    codeTitle: 'In practice',
  },
  de: {
    kicker: 'Messtechnik · Modul 1',
    title: 'Messtheorie',
    intro:
      'Eine Messung ohne Unsicherheit ist kein Ergebnis — sie ist ein Gerücht. Metrologie ist die Disziplin, zu sagen, wie gut man eine Zahl kennt, und es zeigt sich: Diese zweite Zahl (die Unsicherheit) ist oft schwieriger und wertvoller als die erste. Dieses Modul ist das Denkgerüst hinter jedem ernsthaften Datenblatt, Kalibrierschein und Prüfbericht.',
    targetTitle: 'Interaktiv: Richtigkeit ist nicht Präzision',
    target1: 'Zwei unabhängige Tugenden, endlos verwechselt. Präzision (Wiederholbarkeit) ist, wie eng die Schüsse streuen; Richtigkeit, wie gut ihr Zentrum die Wahrheit trifft. Genauigkeit braucht beides. Schiebe die beiden Knöpfe und sieh die vier Archetypen erscheinen — und beachte die Falle: Ein präzises Instrument wirkt vertrauenswürdig, aber mit Bias ist es selbstbewusst falsch. Zufällige Fehler sieht man schon an der Wiederholung; systematische sind ohne Referenz unsichtbar.',
    bias: 'systematischer Fehler (Bias)',
    spread: 'zufälliger Fehler (σ)',
    trueness: 'Richtigkeit (Versatz des Mittels)',
    precision: 'Präzision (Streuung)',
    propTitle: 'Interaktiv: Fehlerfortpflanzung — GUM vs. Monte Carlo',
    prop1: 'Abgeleitete Größen erben die Unsicherheit ihrer Eingänge. Das GUM-Rezept linearisiert: Empfindlichkeitskoeffizienten ∂f/∂xᵢ mal Eingangsunsicherheiten, quadratisch addiert. Monte Carlo simuliert einfach tausende virtuelle Messungen. Vergleiche beide an drei Klassikern: In gutmütigen Fällen stimmen sie wunderbar überein — aber erhöhe die Stromunsicherheit bei R = V/I und sieh zu, wie das Histogramm einen schiefen Schwanz bekommt, den die Gauß-Kurve nicht beschreiben kann: Linearisierung hat Grenzen, und MC ist der ehrliche Schiedsrichter.',
    presets: { area: 'Fläche A = L·W', density: 'Dichte ρ = m/V', resistance: 'Widerstand R = V/I' },
    sigma1: 'Unsicherheit Eingang 1',
    sigma2: 'Unsicherheit Eingang 2',
    gumS: 'σ (GUM, linearisiert)',
    mcS: 'σ (Monte Carlo)',
    result: 'Ergebnis',
    histTitle: 'Monte-Carlo-Verteilung des Ergebnisses (bernstein: GUM-Gauß)',
    meanTitle: 'Interaktiv: die Unsicherheit des Mittelwerts',
    mean1: 'Das Mitteln von n Wiederholmessungen schrumpft die zufällige Unsicherheit um √n — das billigste Genauigkeits-Upgrade des Ingenieurwesens. Aber beachte den Schalter: Füge einen systematischen Versatz hinzu, und der Mittelwert konvergiert immer selbstbewusster gegen den falschen Wert. Mitteln mittelt das Rauschen, nie den Bias. Diese Asymmetrie ist der Grund, warum Kalibrieren (Bias gegen eine Referenz entfernen) und Wiederholen (Rauschen entfernen) zwei verschiedene Jobs sind.',
    nLabel: 'Wiederholmessungen n',
    withBias: 'systematischen Bias von 0,5 hinzufügen',
    sigmaMean: 'σ des Mittelwerts = σ/√n',
    actualErr: 'tatsächlicher Fehler des Mittels',
    conceptTitle: 'Die Checkliste des Metrologen',
    conceptList: [
      'Jedes Unsicherheitsbudget listet Beiträge — Wiederholbarkeit, Kalibrierung der Referenz, Temperatur, Auflösung — rechnet sie in Standardunsicherheiten um und addiert quadratisch (GUM). Die erweiterte Unsicherheit U = k·u mit k = 2 überdeckt ≈ 95 %.',
      'Auflösung ist nicht Unsicherheit: Eine Anzeige mit 0,001-mm-Stellen kann um 0,1 mm falsch liegen. Die letzte Stelle sagt nichts über die Richtigkeit.',
      'Kalibrierung ist Vergleich gegen eine bessere Referenz — und bildet eine ununterbrochene Kette bis zu den nationalen Normalen (Rückführbarkeit). Deine Kamerakalibrierung (Vision-Track) ist genau so ein Schritt: Das Schachbrett ist die Referenz, der Reprojektions-RMS eine Wiederholbarkeitsaussage.',
      'Ergebnisse als Wert ± U (k = 2) mit Einheit angeben — und jeder Zahl misstrauen, die nackt daherkommt.',
    ],
    budgetTitle: 'Ein Miniatur-Unsicherheitsbudget',
    budgetHead: ['Beitrag', 'u (µm)'],
    budgetRows: [
      ['Wiederholbarkeit (25 Messungen)', '1,2'],
      ['Kalibrierung des Referenz-Endmaßes', '0,8'],
      ['Temperatur (±1 K, Stahl, 100 mm)', '0,7'],
      ['Auflösung (0,5 µm / √12)', '0,14'],
    ],
    budgetCombined: 'kombiniert u = 1,6 µm → erweitert U (k = 2) = 3,2 µm',
    codeTitle: 'In der Praxis',
  },
}

const SNIPPET = `from uncertainties import ufloat

L = ufloat(100.00, 0.05)     # mm, value ± standard uncertainty
W = ufloat(50.00, 0.08)

A = L * W                    # propagation happens automatically
print(A)                     # 5000 ± 9 mm² (GUM, linearized)

V = ufloat(5.00, 0.02); I = ufloat(0.100, 0.005)
print(V / I)                 # 50.0 ± 2.5 Ω`

// ---------------------------------------------------------------- accuracy vs precision

function TargetLab() {
  const t = useT(T)
  const [bias, setBias] = useState(0.35)
  const [sig, setSig] = useState(0.12)

  const shots = useMemo(() => {
    const g = makeGauss(13)
    const bx = bias * 0.707
    const by = -bias * 0.707
    return Array.from({ length: 25 }, () => [bx + g() * sig, by + g() * sig] as [number, number])
  }, [bias, sig])

  const mean = shots.reduce((acc, s) => [acc[0] + s[0] / 25, acc[1] + s[1] / 25], [0, 0])
  const trueness = Math.hypot(mean[0], mean[1])
  const prec = Math.sqrt(
    shots.reduce((acc, s) => acc + (s[0] - mean[0]) ** 2 + (s[1] - mean[1]) ** 2, 0) / (2 * 25),
  )

  const SZ = 420
  const px = (v: number) => SZ / 2 + v * (SZ / 2.6)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden p-2 lg:col-span-3">
        <svg viewBox={`0 0 ${SZ} ${SZ}`} className="mx-auto block max-w-md">
          {[1.1, 0.8, 0.5, 0.22].map((r, i) => (
            <circle key={i} cx={SZ / 2} cy={SZ / 2} r={r * (SZ / 2.6)} fill={i === 3 ? 'rgba(251,191,36,0.12)' : 'none'} stroke="rgba(255,255,255,0.18)" strokeWidth={1.2} />
          ))}
          <circle cx={SZ / 2} cy={SZ / 2} r={4} fill="#fbbf24" />
          {shots.map(([x, y], i) => (
            <circle key={i} cx={px(x)} cy={px(y)} r={4.4} fill="#22d3ee" opacity={0.8} stroke="#0a0e17" strokeWidth={1} />
          ))}
          <g stroke="#f87171" strokeWidth={2}>
            <line x1={px(mean[0]) - 7} y1={px(mean[1]) - 7} x2={px(mean[0]) + 7} y2={px(mean[1]) + 7} />
            <line x1={px(mean[0]) - 7} y1={px(mean[1]) + 7} x2={px(mean[0]) + 7} y2={px(mean[1]) - 7} />
          </g>
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.bias} value={bias} min={0} max={0.8} step={0.01} onChange={setBias} format={(v) => fmt(v, 2)} accent="#f87171" />
          <Slider label={t.spread} value={sig} min={0.02} max={0.45} step={0.01} onChange={setSig} format={(v) => fmt(v, 2)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.trueness} value={fmt(trueness, 2)} accent={trueness < 0.1 ? '#4ade80' : '#f87171'} />
          <Readout label={t.precision} value={fmt(prec, 2)} accent={prec < 0.1 ? '#4ade80' : '#fbbf24'} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- propagation lab

type PropKey = 'area' | 'density' | 'resistance'

const PROP_DEFS: Record<
  PropKey,
  { f: (xs: number[]) => number; x0: number[]; relMax: [number, number]; unit: string }
> = {
  area: { f: ([l, w]) => l * w, x0: [100, 50], relMax: [0.05, 0.05], unit: 'mm²' },
  density: { f: ([m, v]) => m / v, x0: [8, 1], relMax: [0.05, 0.05], unit: 'g/cm³' },
  resistance: { f: ([v, i]) => v / i, x0: [5, 0.1], relMax: [0.05, 0.45], unit: 'Ω' },
}

function PropagationLab() {
  const t = useT(T)
  const [key, setKey] = useState<PropKey>('resistance')
  const [r1, setR1] = useState(0.01)
  const [r2, setR2] = useState(0.2)

  const def = PROP_DEFS[key]
  const sigmas = [def.x0[0] * r1, def.x0[1] * r2]
  const y0 = def.f(def.x0)

  const gum = useMemo(() => gumPropagate(def.f, def.x0, sigmas), [key, r1, r2]) // eslint-disable-line react-hooks/exhaustive-deps
  const mc = useMemo(() => mcPropagate(def.f, def.x0, sigmas, 4000, 21), [key, r1, r2]) // eslint-disable-line react-hooks/exhaustive-deps

  const { bars, curve, lo, hi } = useMemo(() => {
    const span = Math.max(gum.sigma, mc.sigma) * 4.5
    const lo = y0 - span
    const hi = y0 + span
    const NB = 45
    const counts = new Array(NB).fill(0)
    for (const s of mc.samples) {
      const b = Math.floor(((s - lo) / (hi - lo)) * NB)
      if (b >= 0 && b < NB) counts[b]++
    }
    const binW = (hi - lo) / NB
    const bars = counts.map((c) => c / (mc.samples.length * binW))
    const curve = Array.from({ length: 130 }, (_, i) => {
      const x = lo + (i / 129) * (hi - lo)
      return [
        x,
        Math.exp(-((x - y0) ** 2) / (2 * gum.sigma * gum.sigma)) / (gum.sigma * Math.sqrt(2 * Math.PI)),
      ] as [number, number]
    })
    return { bars, curve, lo, hi }
  }, [mc, gum, y0])

  const PW = 540
  const PH = 250
  const maxY = Math.max(...bars, ...curve.map((c) => c[1])) * 1.12
  const mismatch = Math.abs(mc.sigma - gum.sigma) / gum.sigma

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.histTitle}</div>
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          {bars.map((v, i) => (
            <rect
              key={i}
              x={(i / bars.length) * PW + 1}
              y={PH - 16 - (v / maxY) * (PH - 32)}
              width={PW / bars.length - 2}
              height={(v / maxY) * (PH - 32)}
              fill="rgba(34,211,238,0.45)"
            />
          ))}
          <polyline
            points={curve.map(([x, y]) => `${((x - lo) / (hi - lo)) * PW},${PH - 16 - (y / maxY) * (PH - 32)}`).join(' ')}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={2.4}
          />
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Segmented<PropKey>
            options={(Object.keys(PROP_DEFS) as PropKey[]).map((k) => ({ value: k, label: t.presets[k] }))}
            value={key}
            onChange={(k) => {
              setKey(k)
              setR1(0.01)
              setR2(k === 'resistance' ? 0.2 : 0.02)
            }}
          />
          <Slider label={t.sigma1} value={r1} min={0.002} max={def.relMax[0]} step={0.002} onChange={setR1} format={(v) => `${fmt(v * 100, 1)} %`} />
          <Slider label={t.sigma2} value={r2} min={0.002} max={def.relMax[1]} step={0.002} onChange={setR2} format={(v) => `${fmt(v * 100, 1)} %`} accent="#a78bfa" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.result} value={fmt(y0, 1)} unit={def.unit} />
          <Readout label={t.gumS} value={fmt(gum.sigma, 2)} accent="#fbbf24" />
          <Readout label={t.mcS} value={fmt(mc.sigma, 2)} accent={mismatch > 0.1 ? '#f87171' : '#4ade80'} />
        </div>
        <TeX block>{String.raw`\sigma_y^2 \;=\; \sum_i \left(\frac{\partial f}{\partial x_i}\right)^{\!2} \sigma_{x_i}^2`}</TeX>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- uncertainty of the mean

function MeanLab() {
  const t = useT(T)
  const [n, setN] = useState(9)
  const [biased, setBiased] = useState(false)

  const { samples, mean } = useMemo(() => {
    const g = makeGauss(77)
    const bias = biased ? 0.5 : 0
    const samples = Array.from({ length: n }, () => bias + g())
    return { samples, mean: samples.reduce((a, b) => a + b, 0) / n }
  }, [n, biased])

  const PW = 540
  const PH = 200
  const XR = 3.2
  const px = (v: number) => ((v + XR) / (2 * XR)) * PW

  const sigmaMean = 1 / Math.sqrt(n)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          <line x1={px(0)} y1={20} x2={px(0)} y2={PH - 40} stroke="#4ade80" strokeWidth={2} strokeDasharray="6 4" />
          {samples.map((s, i) => (
            <circle key={i} cx={px(s)} cy={40 + (i % 12) * 10} r={4} fill="#22d3ee" opacity={0.7} />
          ))}
          {/* mean ± σ/√n */}
          <rect
            x={px(mean - 2 * sigmaMean)}
            y={PH - 34}
            width={px(mean + 2 * sigmaMean) - px(mean - 2 * sigmaMean)}
            height={12}
            rx={4}
            fill="rgba(251,191,36,0.25)"
          />
          <line x1={px(mean)} y1={PH - 40} x2={px(mean)} y2={PH - 16} stroke="#fbbf24" strokeWidth={2.5} />
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.nLabel} value={n} min={1} max={200} step={1} onChange={setN} format={(v) => `${v}`} />
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-muted select-none">
            <input type="checkbox" checked={biased} onChange={(e) => setBiased(e.target.checked)} className="h-4 w-4 accent-red-400" />
            {t.withBias}
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.sigmaMean} value={fmt(sigmaMean, 3)} accent="#fbbf24" />
          <Readout label={t.actualErr} value={fmt(Math.abs(mean), 3)} accent={Math.abs(mean) < 2 * sigmaMean ? '#4ade80' : '#f87171'} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function MeasurementPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'target', label: t.targetTitle },
          { id: 'propagation', label: t.propTitle },
          { id: 'mean', label: t.meanTitle },
          { id: 'concepts', label: t.conceptTitle },
          { id: 'code', label: t.codeTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="target" title={t.targetTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.target1}</p>
        </div>
        <div className="mt-4">
          <TargetLab />
        </div>
      </Section>

      <Section id="propagation" title={t.propTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.prop1}</p>
        </div>
        <div className="mt-4">
          <PropagationLab />
        </div>
      </Section>

      <Section id="mean" title={t.meanTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.mean1}</p>
        </div>
        <div className="mt-4">
          <MeanLab />
        </div>
      </Section>

      <Section id="concepts" title={t.conceptTitle}>
        <div className="prose-cv max-w-3xl">
          <ul>
            {t.conceptList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="card mt-5 max-w-xl overflow-hidden">
          <div className="border-b border-white/10 px-4 py-2 text-[13px] font-semibold">{t.budgetTitle}</div>
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-muted">
                {t.budgetHead.map((h, i) => (
                  <th key={i} className="px-4 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.budgetRows.map((row, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="px-4 py-2 text-ink/85">{row[0]}</td>
                  <td className="px-4 py-2 font-mono text-accent">{row[1]}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} className="px-4 py-2.5 font-mono text-[12.5px] text-green-400">
                  {t.budgetCombined}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="code" title={t.codeTitle}>
        <pre className="card overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-ink/85">{SNIPPET}</pre>
      </Section>
    </div>
  )
}
