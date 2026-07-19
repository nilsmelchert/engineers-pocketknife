import { useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import { fmt, mulberry32 } from '../lib/math'
import { makeGauss } from '../lib/stats'

const T = {
  en: {
    kicker: 'Math · Module 1',
    title: 'Probability & Bayes',
    intro:
      'Every sensor lies a little, every dataset is a sample, every decision is made under incomplete knowledge. Probability is the calculus for exactly this situation - and Bayes’ rule is its engine for learning from evidence. Half of this site secretly runs on the ideas of this page.',
    distTitle: 'Interactive: distributions and the central limit theorem',
    dist1: 'The Gaussian is the celebrity among distributions - but why does it appear everywhere, from sensor noise to reprojection errors? Draw samples and watch the histogram fill the curve. Then switch to the second tab: add up k independent uniform variables (as un-Gaussian as it gets) and watch their sum become a bell. That is the central limit theorem: sums of many small independent effects end up Gaussian - which is precisely what measurement noise is.',
    modeGauss: 'Gaussian sampling',
    modeClt: 'sum of k uniforms',
    mu: 'mean μ',
    sigma: 'std deviation σ',
    nSamples: 'samples n',
    kSum: 'summands k',
    bayesTitle: 'Interactive: Bayes’ rule and the base-rate trap',
    bayes1: 'A test for a rare defect is "99 % accurate". A part tests positive - how likely is it actually defective? Nearly everyone answers wrong, including professionals. The grid below is a population of 1000 parts: amber = defective, cyan = fine; bright dots test positive. Look at where the positives come from when the defect is rare: the few true positives drown in false alarms from the huge healthy majority.',
    prevalence: 'defect rate (prior)',
    sensitivity: 'sensitivity - P(+ | defect)',
    specificity: 'specificity - P(− | ok)',
    posterior: 'P(defect | positive)',
    tpLabel: 'true positives',
    fpLabel: 'false alarms',
    bayes2: 'The lesson generalizes far beyond testing: a detector, an anomaly alarm, a matching threshold - their usefulness depends on the base rate, not only on their accuracy. Bayes’ rule is the bookkeeping that gets it right:',
    updateTitle: 'Interactive: learning from data - Bayesian updating',
    update1: 'A coin with unknown bias. Your knowledge about it is not a number but a distribution over possible biases - and every flip reshapes it. Flip and watch the posterior sharpen around the truth; more data, less uncertainty. The prior choice matters early on and washes out with evidence - exactly the behavior you want from a learner.',
    flip1: 'flip ×1',
    flip10: 'flip ×10',
    flip100: 'flip ×100',
    resetFlips: 'Reset',
    reveal: 'Reveal true bias',
    hideTruth: 'Hide truth',
    priorLabel: 'prior',
    priorNames: ['uniform - anything goes', 'skeptical - probably fair'],
    headsTails: 'observed',
    estimate: 'posterior mean',
    engTitle: 'Why engineers should care',
    engList: [
      'Noise models: "measurement = truth + Gaussian noise" is the assumption behind least squares - minimizing squared error IS maximum-likelihood estimation under Gaussian noise.',
      'Regularization is a prior: ridge regression (ML track) is exactly Bayesian inference with a Gaussian prior on the parameters. λ encodes how strongly you believe "weights should be small".',
      'The Kalman filter (Signals track) is Bayes’ rule applied sequentially: prior = prediction, evidence = measurement, posterior = your best estimate. Same formula, sixty times per second.',
      'Every uncertainty budget in metrology (Measurement track) is probability bookkeeping in disguise.',
    ],
    codeTitle: 'In practice',
    appTitle: '🏭 In the real world: the SPC control chart',
    appIntro:
      'On every serious production line hangs a control chart: sample the process, plot the values, draw limits at ±kσ around the target. The chart is applied probability - and the choice of k is a probability trade-off you can now compute. Tight limits (k = 2) catch drifts fast but cry wolf: with pure noise, 1 in 22 points falls outside by chance alone. Wide limits (k = 4) almost never false-alarm but let real drifts run for hours. Inject a drift and play with k - you will rediscover why Walter Shewhart’s 1924 choice of ±3σ (false alarm ≈ 1 in 370) is still stamped on every quality handbook.',
    appDrift: 'process drift (from sample 25)',
    appK: 'control limits ±kσ',
    appFa: 'false-alarm rate (in control)',
    appDelay: 'detection delay',
    appDelayNone: 'not detected',
    appSamples: 'samples',
    appLegend: 'cyan = in-control samples · amber = after drift starts · red = outside the limits',
    appWhere:
      'The same ±kσ logic gates server-latency alerts, patient-monitor alarms, seismometer triggers and fraud-detection scores - every alarm threshold anywhere is a false-alarm-vs-delay trade-off.',
  },
  de: {
    kicker: 'Mathe · Modul 1',
    title: 'Wahrscheinlichkeit & Bayes',
    intro:
      'Jeder Sensor lügt ein bisschen, jeder Datensatz ist eine Stichprobe, jede Entscheidung fällt unter unvollständigem Wissen. Wahrscheinlichkeitsrechnung ist der Kalkül für genau diese Situation - und der Satz von Bayes ist ihr Motor zum Lernen aus Evidenz. Die halbe Seite läuft insgeheim auf den Ideen dieser Seite.',
    distTitle: 'Interaktiv: Verteilungen und der zentrale Grenzwertsatz',
    dist1: 'Die Gauß-Verteilung ist die Berühmtheit unter den Verteilungen - aber warum taucht sie überall auf, vom Sensorrauschen bis zum Reprojektionsfehler? Ziehe Stichproben und sieh zu, wie das Histogramm die Kurve füllt. Wechsle dann zum zweiten Reiter: Addiere k unabhängige Gleichverteilungen (un-gaußscher geht es kaum) und beobachte, wie ihre Summe zur Glocke wird. Das ist der zentrale Grenzwertsatz: Summen vieler kleiner unabhängiger Effekte werden gaußsch - und genau das ist Messrauschen.',
    modeGauss: 'Gauß-Stichproben',
    modeClt: 'Summe von k Gleichverteilungen',
    mu: 'Mittelwert μ',
    sigma: 'Standardabweichung σ',
    nSamples: 'Stichproben n',
    kSum: 'Summanden k',
    bayesTitle: 'Interaktiv: Satz von Bayes und die Basisraten-Falle',
    bayes1: 'Ein Test für einen seltenen Defekt ist „99 % genau“. Ein Teil testet positiv - wie wahrscheinlich ist es wirklich defekt? Fast alle antworten falsch, auch Profis. Das Raster unten ist eine Population von 1000 Teilen: bernstein = defekt, cyan = in Ordnung; helle Punkte testen positiv. Sieh, woher die Positiven kommen, wenn der Defekt selten ist: Die wenigen echten Treffer ertrinken in Fehlalarmen der riesigen gesunden Mehrheit.',
    prevalence: 'Defektrate (Prior)',
    sensitivity: 'Sensitivität - P(+ | defekt)',
    specificity: 'Spezifität - P(− | ok)',
    posterior: 'P(defekt | positiv)',
    tpLabel: 'echte Treffer',
    fpLabel: 'Fehlalarme',
    bayes2: 'Die Lektion reicht weit über Tests hinaus: Ein Detektor, ein Anomalie-Alarm, eine Matching-Schwelle - ihr Nutzen hängt von der Basisrate ab, nicht nur von ihrer Genauigkeit. Der Satz von Bayes ist die Buchführung, die es richtig macht:',
    updateTitle: 'Interaktiv: aus Daten lernen - Bayessches Updaten',
    update1: 'Eine Münze mit unbekannter Tendenz. Dein Wissen darüber ist keine Zahl, sondern eine Verteilung über mögliche Tendenzen - und jeder Wurf formt sie um. Wirf und sieh zu, wie sich die Posterior-Verteilung um die Wahrheit schärft; mehr Daten, weniger Unsicherheit. Die Wahl des Priors zählt am Anfang und wäscht sich mit Evidenz heraus - genau das Verhalten, das man von einem Lerner will.',
    flip1: 'werfen ×1',
    flip10: 'werfen ×10',
    flip100: 'werfen ×100',
    resetFlips: 'Zurücksetzen',
    reveal: 'Wahre Tendenz zeigen',
    hideTruth: 'Wahrheit verbergen',
    priorLabel: 'Prior',
    priorNames: ['uniform - alles möglich', 'skeptisch - vermutlich fair'],
    headsTails: 'beobachtet',
    estimate: 'Posterior-Mittelwert',
    engTitle: 'Warum das Ingenieure angeht',
    engList: [
      'Rauschmodelle: „Messung = Wahrheit + Gauß-Rauschen“ ist die Annahme hinter kleinsten Quadraten - quadratische Fehler zu minimieren IST Maximum-Likelihood-Schätzung unter Gauß-Rauschen.',
      'Regularisierung ist ein Prior: Ridge-Regression (ML-Track) ist exakt Bayessche Inferenz mit Gauß-Prior auf den Parametern. λ kodiert, wie stark man an „Gewichte sollen klein sein“ glaubt.',
      'Das Kalman-Filter (Signale-Track) ist der Satz von Bayes in Serie: Prior = Prädiktion, Evidenz = Messung, Posterior = beste Schätzung. Dieselbe Formel, sechzigmal pro Sekunde.',
      'Jedes Messunsicherheitsbudget der Metrologie (Messtechnik-Track) ist verkleidete Wahrscheinlichkeitsbuchführung.',
    ],
    codeTitle: 'In der Praxis',
    appTitle: '🏭 In der echten Welt: die SPC-Regelkarte',
    appIntro:
      'An jeder ernsthaften Produktionslinie hängt eine Regelkarte: Prozess abtasten, Werte plotten, Grenzen bei ±kσ um den Sollwert ziehen. Die Karte ist angewandte Wahrscheinlichkeitsrechnung - und die Wahl von k ist ein Wahrscheinlichkeits-Kompromiss, den du jetzt berechnen kannst. Enge Grenzen (k = 2) fangen Driften schnell, schreien aber ständig Wolf: Bei reinem Rauschen fällt 1 von 22 Punkten allein durch Zufall heraus. Weite Grenzen (k = 4) geben fast nie Fehlalarm, lassen echte Driften aber stundenlang laufen. Injiziere eine Drift und spiele mit k - du wirst wiederentdecken, warum Walter Shewharts Wahl von ±3σ aus dem Jahr 1924 (Fehlalarm ≈ 1 zu 370) noch heute in jedem Qualitätshandbuch steht.',
    appDrift: 'Prozessdrift (ab Stichprobe 25)',
    appK: 'Eingriffsgrenzen ±kσ',
    appFa: 'Fehlalarmrate (beherrscht)',
    appDelay: 'Erkennungsverzögerung',
    appDelayNone: 'nicht erkannt',
    appSamples: 'Stichproben',
    appLegend: 'cyan = beherrschter Prozess · bernstein = nach Driftbeginn · rot = außerhalb der Grenzen',
    appWhere:
      'Dieselbe ±kσ-Logik steuert Server-Latenz-Alarme, Patientenmonitore, Seismometer-Trigger und Betrugs-Scores - jede Alarmschwelle überall ist ein Kompromiss aus Fehlalarm und Verzögerung.',
  },
}

const SNIPPET = `from scipy import stats

# posterior for a rare defect, 99 % sensitive / 96 % specific test
prior, sens, spec = 0.01, 0.99, 0.96
posterior = prior*sens / (prior*sens + (1-prior)*(1-spec))
print(posterior)                     # ≈ 0.20 - not 0.99!

# Bayesian coin: posterior after 7 heads in 10 flips (uniform prior)
posterior = stats.beta(1 + 7, 1 + 3)
print(posterior.mean(), posterior.interval(0.95))`

// ---------------------------------------------------------------- CLT lab

const HW = 520
const HH = 320

function CltLab() {
  const t = useT(T)
  const [mode, setMode] = useState<'gauss' | 'clt'>('gauss')
  const [mu, setMu] = useState(0)
  const [sig, setSig] = useState(1)
  const [n, setN] = useState(400)
  const [k, setK] = useState(1)

  const { bars, curve } = useMemo(() => {
    const g = makeGauss(7)
    const rand = mulberry32(8)
    const samples: number[] = []
    for (let i = 0; i < n; i++) {
      if (mode === 'gauss') samples.push(mu + sig * g())
      else {
        let s = 0
        for (let j = 0; j < k; j++) s += rand()
        samples.push((s - k / 2) / Math.sqrt(k / 12)) // standardized
      }
    }
    const NB = 41
    const lo = -4
    const hi = 4
    const counts = new Array(NB).fill(0)
    for (const s of samples) {
      const b = Math.floor(((s - lo) / (hi - lo)) * NB)
      if (b >= 0 && b < NB) counts[b]++
    }
    const binW = (hi - lo) / NB
    const density = counts.map((c) => c / (n * binW))
    const m = mode === 'gauss' ? mu : 0
    const s2 = mode === 'gauss' ? sig : 1
    const curve = Array.from({ length: 120 }, (_, i) => {
      const x = lo + (i / 119) * (hi - lo)
      const y = Math.exp(-((x - m) ** 2) / (2 * s2 * s2)) / (s2 * Math.sqrt(2 * Math.PI))
      return [x, y] as [number, number]
    })
    return { bars: density, curve }
  }, [mode, mu, sig, n, k])

  const maxY = Math.max(...bars, ...curve.map((c) => c[1]), 0.1) * 1.15
  const bx = (i: number) => (i / bars.length) * HW
  const by = (v: number) => HH - 20 - (v / maxY) * (HH - 40)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${HW} ${HH}`} className="block w-full">
          {bars.map((v, i) => (
            <rect key={i} x={bx(i) + 1} y={by(v)} width={HW / bars.length - 2} height={HH - 20 - by(v)} fill="rgba(34,211,238,0.45)" />
          ))}
          <polyline
            points={curve.map(([x, y]) => `${((x + 4) / 8) * HW},${by(y)}`).join(' ')}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={2.5}
          />
          <line x1={0} y1={HH - 20} x2={HW} y2={HH - 20} stroke="rgba(255,255,255,0.2)" />
        </svg>
      </div>
      <div className="card-pad space-y-3.5 self-start lg:col-span-2">
        <Segmented<'gauss' | 'clt'>
          options={[
            { value: 'gauss', label: t.modeGauss },
            { value: 'clt', label: t.modeClt },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === 'gauss' ? (
          <>
            <Slider label={t.mu} value={mu} min={-2} max={2} step={0.05} onChange={setMu} format={(v) => fmt(v, 2)} />
            <Slider label={t.sigma} value={sig} min={0.3} max={2} step={0.05} onChange={setSig} format={(v) => fmt(v, 2)} />
          </>
        ) : (
          <Slider label={t.kSum} value={k} min={1} max={12} step={1} onChange={setK} format={(v) => `${v}`} accent="#fbbf24" />
        )}
        <Slider label={t.nSamples} value={n} min={50} max={3000} step={50} onChange={setN} format={(v) => `${v}`} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- base-rate lab

const COLS = 40
const ROWS = 25

function BayesLab() {
  const t = useT(T)
  const [prev, setPrev] = useState(0.01)
  const [sens, setSens] = useState(0.99)
  const [spec, setSpec] = useState(0.96)

  const posterior = (prev * sens) / (prev * sens + (1 - prev) * (1 - spec))
  const N = COLS * ROWS
  const nIll = Math.max(1, Math.round(prev * N))
  const nTP = Math.round(nIll * sens)
  const nFP = Math.round((N - nIll) * (1 - spec))

  // deterministic dot layout: shuffle indices once, assign ill to the first nIll
  const order = useMemo(() => {
    const rand = mulberry32(4242)
    const idx = Array.from({ length: N }, (_, i) => i)
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    return idx
  }, [N])

  const DW = 520
  const DH = 330
  const cw = DW / COLS
  const ch = DH / ROWS

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden p-2 lg:col-span-3">
        <svg viewBox={`0 0 ${DW} ${DH}`} className="block w-full">
          {order.map((pos, rank) => {
            const ill = rank < nIll
            const positive = ill ? rank < nTP : rank - nIll < nFP
            const cx = (pos % COLS) * cw + cw / 2
            const cy = Math.floor(pos / COLS) * ch + ch / 2
            return (
              <circle
                key={pos}
                cx={cx}
                cy={cy}
                r={positive ? 4.4 : 3}
                fill={ill ? '#fbbf24' : '#22d3ee'}
                opacity={positive ? 1 : 0.22}
                stroke={positive ? '#f87171' : 'none'}
                strokeWidth={positive ? 1.4 : 0}
              />
            )
          })}
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.prevalence} value={prev} min={0.002} max={0.3} step={0.002} onChange={setPrev} format={(v) => `${fmt(v * 100, 1)} %`} accent="#fbbf24" />
          <Slider label={t.sensitivity} value={sens} min={0.5} max={0.999} step={0.001} onChange={setSens} format={(v) => `${fmt(v * 100, 1)} %`} />
          <Slider label={t.specificity} value={spec} min={0.5} max={0.999} step={0.001} onChange={setSpec} format={(v) => `${fmt(v * 100, 1)} %`} />
        </div>
        <Readout
          label={t.posterior}
          value={fmt(posterior * 100, 1)}
          unit="%"
          accent={posterior < 0.5 ? '#f87171' : '#4ade80'}
        />
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.tpLabel} value={`${nTP}`} accent="#fbbf24" />
          <Readout label={t.fpLabel} value={`${nFP}`} accent="#22d3ee" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Bayesian coin

const TRUE_BIAS = 0.68

function CoinLab() {
  const t = useT(T)
  const [heads, setHeads] = useState(0)
  const [tails, setTails] = useState(0)
  const [prior, setPrior] = useState<'uniform' | 'skeptical'>('uniform')
  const [revealed, setRevealed] = useState(false)
  const rng = useRef(mulberry32(2024))

  const flip = (times: number) => {
    let h = 0
    for (let i = 0; i < times; i++) if (rng.current() < TRUE_BIAS) h++
    setHeads(heads + h)
    setTails(tails + times - h)
  }

  const [a0, b0] = prior === 'uniform' ? [1, 1] : [10, 10]
  const a = a0 + heads
  const b = b0 + tails

  const { curve, mean } = useMemo(() => {
    const NP = 200
    const raw: number[] = []
    for (let i = 0; i <= NP; i++) {
      const p = i / NP
      // log-space to survive large exponents
      const lp =
        (a - 1) * Math.log(Math.max(p, 1e-12)) + (b - 1) * Math.log(Math.max(1 - p, 1e-12))
      raw.push(lp)
    }
    const mx = Math.max(...raw)
    const vals = raw.map((v) => Math.exp(v - mx))
    const sum = vals.reduce((s, v) => s + v, 0) / NP
    const curve = vals.map((v) => v / sum)
    return { curve, mean: a / (a + b) }
  }, [a, b])

  const PW = 520
  const PH = 280
  const maxY = Math.max(...curve) * 1.1
  const px = (i: number) => (i / (curve.length - 1)) * PW
  const py = (v: number) => PH - 24 - (v / maxY) * (PH - 44)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          <polyline points={curve.map((v, i) => `${px(i)},${py(v)}`).join(' ')} fill="none" stroke="#a78bfa" strokeWidth={2.5} />
          {revealed && (
            <line x1={TRUE_BIAS * PW} y1={12} x2={TRUE_BIAS * PW} y2={PH - 24} stroke="#4ade80" strokeWidth={2} strokeDasharray="5 4" />
          )}
          <line x1={mean * PW} y1={12} x2={mean * PW} y2={PH - 24} stroke="rgba(167,139,250,0.5)" strokeWidth={1.2} />
          <line x1={0} y1={PH - 24} x2={PW} y2={PH - 24} stroke="rgba(255,255,255,0.2)" />
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <text key={v} x={v * PW} y={PH - 8} fill="#8b93a7" fontSize={11} textAnchor="middle" fontFamily="JetBrains Mono, monospace">
              {v}
            </text>
          ))}
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Segmented<'uniform' | 'skeptical'>
            options={[
              { value: 'uniform', label: t.priorNames[0] },
              { value: 'skeptical', label: t.priorNames[1] },
            ]}
            value={prior}
            onChange={setPrior}
          />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => flip(1)}>
              🪙 {t.flip1}
            </button>
            <button className="btn" onClick={() => flip(10)}>
              {t.flip10}
            </button>
            <button className="btn" onClick={() => flip(100)}>
              {t.flip100}
            </button>
            <button className="btn" onClick={() => { setHeads(0); setTails(0) }}>
              ↺ {t.resetFlips}
            </button>
            <button className="btn" onClick={() => setRevealed(!revealed)}>
              {revealed ? `🙈 ${t.hideTruth}` : `👁 ${t.reveal}`}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.headsTails} value={`${heads} H / ${tails} T`} />
          <Readout label={t.estimate} value={fmt(mean, 3)} accent="#a78bfa" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- application: SPC chart

const SPC_N = 60
const SPC_DRIFT_AT = 25
const SPC_NOISE = makeGauss(2026)
const SPC_BASE: number[] = Array.from({ length: SPC_N }, () => SPC_NOISE())

function SpcLab() {
  const t = useT(T)
  const [drift, setDrift] = useState(1.2)
  const [k, setK] = useState(3)

  const samples = SPC_BASE.map((v, i) => v + (i >= SPC_DRIFT_AT ? drift : 0))
  const firstOut = samples.findIndex((v, i) => i >= SPC_DRIFT_AT && Math.abs(v) > k)
  const delay = firstOut < 0 ? null : firstOut - SPC_DRIFT_AT
  // theoretical in-control false-alarm probability per sample: 2·Φ(−k)
  const phi = (x: number) => 0.5 * (1 + Math.tanh(Math.sqrt(Math.PI / 8) * x * (1 + 0.044715 * x * x))) // fast Φ approx
  const faP = 2 * (1 - phi(k))

  const PW = 560
  const PH = 260
  const sx = (i: number) => 30 + (i / (SPC_N - 1)) * (PW - 45)
  const sy = (v: number) => PH / 2 - v * (PH / 11)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          <line x1={30} y1={sy(0)} x2={PW - 12} y2={sy(0)} stroke="#8b93a755" />
          {[k, -k].map((lim, j) => (
            <g key={j}>
              <line x1={30} y1={sy(lim)} x2={PW - 12} y2={sy(lim)} stroke="#f87171aa" strokeDasharray="6 4" strokeWidth={1.5} />
              <text x={PW - 8} y={sy(lim) + 4} textAnchor="end" fill="#f87171" fontSize={10} fontFamily="JetBrains Mono, monospace">
                {j === 0 ? `+${fmt(k, 1)}σ` : `−${fmt(k, 1)}σ`}
              </text>
            </g>
          ))}
          <line x1={sx(SPC_DRIFT_AT) - 4} y1={12} x2={sx(SPC_DRIFT_AT) - 4} y2={PH - 12} stroke="#fbbf2455" strokeDasharray="3 4" />
          <polyline points={samples.map((v, i) => `${sx(i)},${sy(v)}`).join(' ')} fill="none" stroke="#8b93a744" strokeWidth={1} />
          {samples.map((v, i) => {
            const out = Math.abs(v) > k
            return (
              <circle
                key={i}
                cx={sx(i)}
                cy={sy(v)}
                r={out ? 4.5 : 3}
                fill={out ? '#f87171' : i >= SPC_DRIFT_AT ? '#fbbf24' : '#22d3ee'}
              />
            )
          })}
        </svg>
        <div className="border-t border-white/10 px-4 py-2 text-[12px] text-muted">{t.appLegend}</div>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.appDrift} value={drift} min={0} max={3} step={0.05} onChange={setDrift} format={(v) => `${fmt(v, 2)} σ`} />
          <Slider label={t.appK} value={k} min={1.5} max={4.5} step={0.1} onChange={setK} format={(v) => `±${fmt(v, 1)} σ`} accent="#f87171" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.appFa} value={`1 : ${fmt(1 / Math.max(faP, 1e-6), 0)}`} accent={faP < 0.01 ? '#4ade80' : '#fbbf24'} />
          <Readout
            label={t.appDelay}
            value={delay === null ? t.appDelayNone : `${delay} ${t.appSamples}`}
            accent={delay === null ? '#f87171' : delay <= 5 ? '#4ade80' : '#fbbf24'}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function ProbabilityPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'distributions', label: t.distTitle },
          { id: 'bayes', label: t.bayesTitle },
          { id: 'updating', label: t.updateTitle },
          { id: 'engineer', label: t.engTitle },
          { id: 'code', label: t.codeTitle },
          { id: 'application', label: t.appTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="distributions" title={t.distTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.dist1}</p>
        </div>
        <div className="mt-4">
          <CltLab />
        </div>
      </Section>

      <Section id="bayes" title={t.bayesTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.bayes1}</p>
        </div>
        <div className="mt-4">
          <BayesLab />
        </div>
        <div className="prose-cv mt-4 max-w-3xl">
          <p>{t.bayes2}</p>
          <TeX block>{String.raw`P(\text{defect}\mid +) \;=\; \frac{P(+\mid \text{defect})\,P(\text{defect})}{P(+\mid \text{defect})\,P(\text{defect}) + P(+\mid \text{ok})\,P(\text{ok})}`}</TeX>
        </div>
      </Section>

      <Section id="updating" title={t.updateTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.update1}</p>
        </div>
        <div className="mt-4">
          <CoinLab />
        </div>
      </Section>

      <Section id="engineer" title={t.engTitle}>
        <div className="prose-cv max-w-3xl">
          <ul>
            {t.engList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="code" title={t.codeTitle}>
        <pre className="card overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-ink/85">{SNIPPET}</pre>
      </Section>

      <Section id="application" title={t.appTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.appIntro}</p>
        </div>
        <div className="mt-4">
          <SpcLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
