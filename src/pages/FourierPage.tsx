import { useMemo, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import { fmt } from '../lib/math'
import { convolve, dftMag, lowpass, seriesCoef } from '../lib/signal'
import { makeGauss } from '../lib/stats'

const T = {
  en: {
    kicker: 'Signals · Module 1',
    title: 'Fourier & Signals',
    intro:
      'A microphone signal, a vibration log, a scanline of an image - every signal can be rewritten as a sum of pure sine waves. That change of viewpoint, from time to frequency, is the single most useful trick in signal processing: it turns filtering into deleting, convolution into multiplication, and hidden periodicity into visible peaks.',
    seriesTitle: 'Interactive: building signals from sines',
    series1: 'A square wave contains no sines - visually. Yet adding its odd harmonics with amplitudes 4/(πk) reproduces it. Raise the number of terms: the sum snuggles against the square, but at every jump a stubborn overshoot remains (the Gibbs phenomenon - about 9 %, no matter how many terms). Sharp edges need many high frequencies; that single fact explains most of filtering.',
    preset: 'waveform',
    presetNames: { square: 'square', saw: 'sawtooth', triangle: 'triangle' },
    harmonics: 'harmonics k',
    spectrumTitle: 'harmonic amplitudes',
    aliasTitle: 'Interactive: sampling and aliasing',
    alias1: 'Computers only see samples. The Nyquist rule says: to represent a frequency f you must sample faster than 2f. Slide the signal frequency past half the sample rate and watch the disaster: the samples are perfectly consistent with a much slower sine - the alias (amber, dashed). The samples cannot tell the two apart; information is irreversibly lost. This is the wagon-wheel effect, and the reason every ADC has a low-pass filter in front of it.',
    fSignal: 'signal frequency f',
    fSample: 'sample rate fs',
    nyquist: 'Nyquist limit fs/2',
    apparent: 'apparent frequency',
    aliased: 'ALIASED!',
    ok: 'ok',
    dftTitle: 'Interactive: the DFT - X-raying a signal',
    dft1: 'The discrete Fourier transform computes, for every frequency bin, how much of that sine is in the signal. Below: two sines buried in noise. In time they are a mess; in the spectrum they are two clean peaks. Now filter: keep only bins below the cutoff and transform back - the high-frequency sine and most of the noise vanish. You have just built a low-pass filter by deleting numbers.',
    f1: 'frequency 1',
    f2: 'frequency 2',
    noise: 'noise σ',
    cutoff: 'low-pass cutoff',
    timeIn: 'time domain - input',
    timeOut: 'time domain - after low-pass',
    spec: 'magnitude spectrum |X(f)|',
    convTitle: 'Interactive: convolution - the sliding dot product',
    conv1: 'Convolution slides a small kernel across the signal, computing a weighted sum at every position. A box kernel averages (blurs), a Gaussian averages gently, a derivative kernel responds to change (edges). Drag the position slider to watch the output build up sample by sample. The punchline of the chapter: convolution in time = multiplication in frequency - and the kernels here are exactly what CNNs (ML track) learn for themselves, in 2D.',
    kernel: 'kernel',
    kernelNames: { box: 'box (blur)', gauss: 'gaussian', edge: 'derivative (edge)' },
    pos: 'position',
    mathTitle: 'The transform itself',
    math1: 'The DFT projects the signal onto N complex sinusoids; the inverse sums them back. Nothing is lost - it is a change of basis:',
    math2: 'Computed naively this costs O(N²); the FFT algorithm reorganizes it to O(N log N), which is why real-time spectral processing exists at all - from your equalizer to OFDM radio to the phase unwrapping of the metrology track.',
    codeTitle: 'In practice',
    appTitle: '🏭 In the real world: hearing a bearing die',
    appIntro:
      'A worn ball bearing announces its death weeks in advance - but not in the time signal, where a small periodic click drowns in the machine’s hum. It talks in the spectrum: every time a ball rolls over a spall in the outer ring, it makes one click, so the clicks arrive at the Ball-Pass Frequency Outer race (BPFO) - a frequency you can CALCULATE from the geometry and shaft speed. Raise the fault severity: the time trace barely changes, but in the spectrum a needle grows exactly at the predicted BPFO, with harmonics in tow. Every vibration analyst plays this game daily: compute the fault frequencies, then look up whether anything lives there.',
    appRpm: 'shaft speed',
    appSev: 'fault severity',
    appBpfo: 'computed BPFO',
    appPeak: 'spectrum peak at BPFO',
    appTime: 'accelerometer signal (time domain)',
    appSpec: 'spectrum |X(f)| - red marker = predicted BPFO',
    appHealthy: 'no fault signature',
    appAlarmSmall: 'early damage',
    appAlarmBig: 'REPLACE BEARING',
    appState: 'diagnosis',
    appWhere:
      'The same compute-the-frequency-then-look trick finds gear-mesh damage, unbalanced fans (1× RPM), misalignment (2× RPM), cavitating pumps and loose electrical stators (2× line frequency) - the frequency axis is the machine’s medical chart.',
  },
  de: {
    kicker: 'Signale · Modul 1',
    title: 'Fourier & Signale',
    intro:
      'Ein Mikrofonsignal, ein Schwingungsprotokoll, eine Bildzeile - jedes Signal lässt sich als Summe reiner Sinuswellen umschreiben. Dieser Perspektivwechsel, von der Zeit zur Frequenz, ist der nützlichste Trick der Signalverarbeitung: Er macht aus Filtern Löschen, aus Faltung Multiplikation und aus versteckter Periodizität sichtbare Spitzen.',
    seriesTitle: 'Interaktiv: Signale aus Sinussen bauen',
    series1: 'Eine Rechteckwelle enthält keine Sinusse - optisch. Und doch reproduziert die Summe ihrer ungeraden Harmonischen mit Amplituden 4/(πk) genau sie. Erhöhe die Zahl der Terme: Die Summe schmiegt sich ans Rechteck, aber an jedem Sprung bleibt ein sturer Überschwinger (das Gibbs-Phänomen - etwa 9 %, egal wie viele Terme). Scharfe Kanten brauchen viele hohe Frequenzen; diese eine Tatsache erklärt das meiste übers Filtern.',
    preset: 'Wellenform',
    presetNames: { square: 'Rechteck', saw: 'Sägezahn', triangle: 'Dreieck' },
    harmonics: 'Harmonische k',
    spectrumTitle: 'Amplituden der Harmonischen',
    aliasTitle: 'Interaktiv: Abtastung und Aliasing',
    alias1: 'Computer sehen nur Abtastwerte. Die Nyquist-Regel sagt: Um eine Frequenz f darzustellen, muss man schneller als 2f abtasten. Schiebe die Signalfrequenz über die halbe Abtastrate und beobachte das Desaster: Die Abtastwerte passen perfekt zu einem viel langsameren Sinus - dem Alias (bernstein, gestrichelt). Die Abtastwerte können beide nicht unterscheiden; Information ist unwiederbringlich verloren. Das ist der Wagenrad-Effekt und der Grund, warum vor jedem ADC ein Tiefpass sitzt.',
    fSignal: 'Signalfrequenz f',
    fSample: 'Abtastrate fs',
    nyquist: 'Nyquist-Grenze fs/2',
    apparent: 'scheinbare Frequenz',
    aliased: 'ALIASING!',
    ok: 'ok',
    dftTitle: 'Interaktiv: die DFT - ein Signal röntgen',
    dft1: 'Die diskrete Fouriertransformation berechnet für jedes Frequenz-Bin, wie viel von diesem Sinus im Signal steckt. Unten: zwei Sinusse im Rauschen vergraben. In der Zeit sind sie ein Durcheinander; im Spektrum zwei saubere Spitzen. Jetzt filtern: Nur Bins unterhalb der Grenzfrequenz behalten und zurücktransformieren - der hochfrequente Sinus und das meiste Rauschen verschwinden. Du hast gerade einen Tiefpass gebaut, indem du Zahlen gelöscht hast.',
    f1: 'Frequenz 1',
    f2: 'Frequenz 2',
    noise: 'Rauschen σ',
    cutoff: 'Tiefpass-Grenze',
    timeIn: 'Zeitbereich - Eingang',
    timeOut: 'Zeitbereich - nach Tiefpass',
    spec: 'Betragsspektrum |X(f)|',
    convTitle: 'Interaktiv: Faltung - das gleitende Skalarprodukt',
    conv1: 'Die Faltung schiebt einen kleinen Kern über das Signal und berechnet an jeder Position eine gewichtete Summe. Ein Rechteckkern mittelt (verwischt), ein Gaußkern mittelt sanft, ein Ableitungskern reagiert auf Änderung (Kanten). Ziehe den Positions-Slider und sieh zu, wie der Ausgang Abtastwert für Abtastwert entsteht. Die Pointe des Kapitels: Faltung in der Zeit = Multiplikation in der Frequenz - und die Kerne hier sind exakt das, was CNNs (ML-Track) sich selbst beibringen, in 2D.',
    kernel: 'Kern',
    kernelNames: { box: 'Rechteck (Weichzeichner)', gauss: 'Gauß', edge: 'Ableitung (Kante)' },
    pos: 'Position',
    mathTitle: 'Die Transformation selbst',
    math1: 'Die DFT projiziert das Signal auf N komplexe Sinusschwingungen; die Inverse summiert sie zurück. Nichts geht verloren - es ist ein Basiswechsel:',
    math2: 'Naiv gerechnet kostet das O(N²); der FFT-Algorithmus organisiert es zu O(N log N) um - deshalb gibt es Echtzeit-Spektralverarbeitung überhaupt: vom Equalizer über OFDM-Funk bis zur Phasenauswertung im Messtechnik-Track.',
    codeTitle: 'In der Praxis',
    appTitle: '🏭 In der echten Welt: ein Lager sterben hören',
    appIntro:
      'Ein verschlissenes Kugellager kündigt seinen Tod Wochen im Voraus an - aber nicht im Zeitsignal, wo ein kleines periodisches Klicken im Brummen der Maschine untergeht. Es spricht im Spektrum: Jedes Mal, wenn eine Kugel über eine Ausbruchstelle im Außenring rollt, gibt es ein Klicken, also kommen die Klicks mit der Ball-Pass-Frequenz des Außenrings (BPFO) - einer Frequenz, die man aus Geometrie und Drehzahl BERECHNEN kann. Erhöhe den Schadensgrad: Die Zeitspur ändert sich kaum, aber im Spektrum wächst eine Nadel exakt bei der vorhergesagten BPFO, mit Harmonischen im Schlepptau. Jeder Schwingungsanalytiker spielt dieses Spiel täglich: Fehlerfrequenzen ausrechnen, dann nachsehen, ob dort etwas wohnt.',
    appRpm: 'Wellendrehzahl',
    appSev: 'Schadensgrad',
    appBpfo: 'berechnete BPFO',
    appPeak: 'Spektrumspitze bei BPFO',
    appTime: 'Beschleunigungssignal (Zeitbereich)',
    appSpec: 'Spektrum |X(f)| - rote Marke = vorhergesagte BPFO',
    appHealthy: 'keine Fehlersignatur',
    appAlarmSmall: 'beginnender Schaden',
    appAlarmBig: 'LAGER TAUSCHEN',
    appState: 'Diagnose',
    appWhere:
      'Derselbe Frequenz-berechnen-dann-nachsehen-Trick findet Zahneingriffschäden, unwuchtige Lüfter (1× Drehzahl), Ausrichtfehler (2× Drehzahl), kavitierende Pumpen und lose Statoren (2× Netzfrequenz) - die Frequenzachse ist die Krankenakte der Maschine.',
  },
}

const SNIPPET = `import numpy as np

X = np.fft.rfft(x)                     # spectrum (FFT: O(N log N))
freqs = np.fft.rfftfreq(len(x), d=1/fs)

X[freqs > f_cutoff] = 0                # low-pass = deleting bins
x_filtered = np.fft.irfft(X, n=len(x))`

// ---------------------------------------------------------------- series builder

type Wave = 'square' | 'saw' | 'triangle'

const targetWave = (w: Wave, t: number): number => {
  const p = ((t % 1) + 1) % 1
  if (w === 'square') return p < 0.5 ? 1 : -1
  if (w === 'saw') return 2 * p - 1
  return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4
}

function SeriesLab() {
  const t = useT(T)
  const [wave, setWave] = useState<Wave>('square')
  const [k, setK] = useState(5)

  const PW = 560
  const PH = 300
  const px = (tt: number) => (tt / 2) * PW
  const py = (v: number) => PH / 2 - v * (PH / 3.4)

  const partial = (tt: number) => {
    let s = 0
    for (let h = 1; h <= k; h++) s += seriesCoef(wave, h) * Math.sin(2 * Math.PI * h * tt)
    return s
  }

  const target = Array.from({ length: 300 }, (_, i) => {
    const tt = (i / 299) * 2
    return `${px(tt)},${py(targetWave(wave, tt))}`
  }).join(' ')
  const sum = Array.from({ length: 300 }, (_, i) => {
    const tt = (i / 299) * 2
    return `${px(tt)},${py(partial(tt))}`
  }).join(' ')

  const BW = 460
  const BH = 130
  const coefs = Array.from({ length: 25 }, (_, i) => Math.abs(seriesCoef(wave, i + 1)))
  const maxC = Math.max(...coefs)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="flex flex-col gap-3 lg:col-span-3">
        <div className="card overflow-hidden">
          <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
            <polyline points={target} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeDasharray="5 4" />
            <polyline points={sum} fill="none" stroke="#22d3ee" strokeWidth={2.2} />
          </svg>
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.spectrumTitle}</div>
          <svg viewBox={`0 0 ${BW} ${BH}`} className="block w-full">
            {coefs.map((c, i) => (
              <rect
                key={i}
                x={10 + i * ((BW - 20) / 25)}
                y={BH - 14 - (c / maxC) * (BH - 28)}
                width={(BW - 20) / 25 - 2.5}
                height={(c / maxC) * (BH - 28)}
                fill={i < k ? '#22d3ee' : 'rgba(139,147,167,0.3)'}
              />
            ))}
          </svg>
        </div>
      </div>
      <div className="card-pad space-y-3.5 self-start lg:col-span-2">
        <Segmented<Wave>
          options={(['square', 'saw', 'triangle'] as Wave[]).map((w) => ({ value: w, label: t.presetNames[w] }))}
          value={wave}
          onChange={setWave}
        />
        <Slider label={t.harmonics} value={k} min={1} max={25} step={1} onChange={setK} format={(v) => `${v}`} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- aliasing lab

function AliasLab() {
  const t = useT(T)
  const [f, setF] = useState(2)
  const [fs, setFs] = useState(10)

  const PW = 560
  const PH = 280
  const DUR = 2
  const px = (tt: number) => (tt / DUR) * PW
  const py = (v: number) => PH / 2 - v * (PH / 2.8)

  const fApparent = Math.abs(f - fs * Math.round(f / fs))
  const aliased = f > fs / 2

  const sig = Array.from({ length: 400 }, (_, i) => {
    const tt = (i / 399) * DUR
    return `${px(tt)},${py(Math.sin(2 * Math.PI * f * tt))}`
  }).join(' ')
  const nSamples = Math.floor(DUR * fs)
  const samples = Array.from({ length: nSamples + 1 }, (_, n) => {
    const tt = n / fs
    return [px(tt), py(Math.sin(2 * Math.PI * f * tt))]
  })
  // the alias sine that passes through the same samples (signed folded frequency)
  const fFold = f - fs * Math.round(f / fs)
  const alias = Array.from({ length: 400 }, (_, i) => {
    const tt = (i / 399) * DUR
    return `${px(tt)},${py(Math.sin(2 * Math.PI * fFold * tt))}`
  }).join(' ')

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          <polyline points={sig} fill="none" stroke="rgba(34,211,238,0.7)" strokeWidth={1.6} />
          {aliased && <polyline points={alias} fill="none" stroke="#fbbf24" strokeWidth={2.2} strokeDasharray="7 5" />}
          {samples.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4} fill="#e6eaf2" stroke="#0a0e17" strokeWidth={1.2} />
          ))}
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.fSignal} value={f} min={0.5} max={12} step={0.1} onChange={setF} format={(v) => `${fmt(v, 1)} Hz`} />
          <Slider label={t.fSample} value={fs} min={3} max={30} step={0.5} onChange={setFs} format={(v) => `${fmt(v, 1)} Hz`} accent="#a78bfa" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.nyquist} value={fmt(fs / 2, 1)} unit="Hz" />
          <Readout
            label={t.apparent}
            value={fmt(fApparent, 2)}
            unit={`Hz ${aliased ? `· ${t.aliased}` : `· ${t.ok}`}`}
            accent={aliased ? '#f87171' : '#4ade80'}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- DFT lab

const DFT_N = 128

function DftLab() {
  const t = useT(T)
  const [f1, setF1] = useState(5)
  const [f2, setF2] = useState(26)
  const [noise, setNoise] = useState(0.4)
  const [cutoff, setCutoff] = useState(14)

  const { x, mag, filtered } = useMemo(() => {
    const g = makeGauss(55)
    const x = Array.from(
      { length: DFT_N },
      (_, n) =>
        Math.sin((2 * Math.PI * f1 * n) / DFT_N) + 0.7 * Math.sin((2 * Math.PI * f2 * n) / DFT_N) + noise * g(),
    )
    return { x, mag: dftMag(x), filtered: lowpass(x, cutoff) }
  }, [f1, f2, noise, cutoff])

  const PW = 540
  const PH = 150
  const wave = (data: number[], color: string, key: string) => (
    <div className="card overflow-hidden" key={key}>
      <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
        <polyline
          points={data.map((v, i) => `${(i / (DFT_N - 1)) * PW},${PH / 2 - v * (PH / 5.4)}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
        />
      </svg>
    </div>
  )

  const SW = 540
  const SH = 170
  const maxM = Math.max(...mag, 0.1)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="flex flex-col gap-3 lg:col-span-3">
        <div>
          <div className="mb-1 text-[12px] font-medium text-muted">{t.timeIn}</div>
          {wave(x, '#22d3ee', 'in')}
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.spec}</div>
          <svg viewBox={`0 0 ${SW} ${SH}`} className="block w-full">
            {mag.map((m, k) => (
              <rect
                key={k}
                x={6 + k * ((SW - 12) / mag.length)}
                y={SH - 12 - (m / maxM) * (SH - 26)}
                width={(SW - 12) / mag.length - 1}
                height={(m / maxM) * (SH - 26)}
                fill={k <= cutoff ? '#22d3ee' : 'rgba(248,113,113,0.55)'}
              />
            ))}
            <line
              x1={6 + (cutoff + 0.5) * ((SW - 12) / mag.length)}
              y1={8}
              x2={6 + (cutoff + 0.5) * ((SW - 12) / mag.length)}
              y2={SH - 12}
              stroke="#fbbf24"
              strokeWidth={1.8}
              strokeDasharray="5 4"
            />
          </svg>
        </div>
        <div>
          <div className="mb-1 text-[12px] font-medium text-muted">{t.timeOut}</div>
          {wave(filtered, '#4ade80', 'out')}
        </div>
      </div>
      <div className="card-pad space-y-3.5 self-start lg:col-span-2">
        <Slider label={t.f1} value={f1} min={2} max={20} step={1} onChange={setF1} format={(v) => `bin ${v}`} />
        <Slider label={t.f2} value={f2} min={10} max={60} step={1} onChange={setF2} format={(v) => `bin ${v}`} />
        <Slider label={t.noise} value={noise} min={0} max={1.2} step={0.05} onChange={setNoise} format={(v) => fmt(v, 2)} accent="#a78bfa" />
        <Slider label={t.cutoff} value={cutoff} min={2} max={64} step={1} onChange={setCutoff} format={(v) => `bin ${v}`} accent="#fbbf24" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- convolution lab

type KernelKey = 'box' | 'gauss' | 'edge'
const KERNELS: Record<KernelKey, number[]> = {
  box: new Array(9).fill(1 / 9),
  gauss: [0.028, 0.066, 0.124, 0.18, 0.204, 0.18, 0.124, 0.066, 0.028],
  edge: [-0.125, -0.25, 0, 0.25, 0.125].map((v) => v * 4),
}

const CONV_N = 160

function ConvLab() {
  const t = useT(T)
  const [kk, setKk] = useState<KernelKey>('box')
  const [pos, setPos] = useState(60)

  const signal = useMemo(() => {
    const g = makeGauss(66)
    return Array.from({ length: CONV_N }, (_, i) => {
      let v = 0
      if (i > 25 && i < 60) v = 0.9
      if (i > 85 && i < 95) v = -0.6
      if (i >= 110) v = 0.5 * Math.sin((i - 110) * 0.35)
      return v + g() * 0.05
    })
  }, [])

  const out = useMemo(() => convolve(signal, KERNELS[kk]), [signal, kk])

  const PW = 560
  const PH = 300
  const px = (i: number) => (i / (CONV_N - 1)) * PW
  const py = (v: number, base: number) => base - v * 52

  const kern = KERNELS[kk]
  const kHalf = Math.floor(kern.length / 2)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          {/* input */}
          <polyline points={signal.map((v, i) => `${px(i)},${py(v, 90)}`).join(' ')} fill="none" stroke="rgba(34,211,238,0.8)" strokeWidth={1.5} />
          {/* kernel window */}
          <rect x={px(pos - kHalf)} y={16} width={px(pos + kHalf) - px(pos - kHalf)} height={130} fill="rgba(251,191,36,0.1)" stroke="rgba(251,191,36,0.5)" strokeWidth={1} />
          {kern.map((v, j) => (
            <line key={j} x1={px(pos - kHalf + j)} y1={py(0, 90)} x2={px(pos - kHalf + j)} y2={py(v * 2.2, 90)} stroke="#fbbf24" strokeWidth={2.4} />
          ))}
          {/* output built up to pos */}
          <polyline
            points={out.slice(0, pos + 1).map((v, i) => `${px(i)},${py(v, 230)}`).join(' ')}
            fill="none"
            stroke="#4ade80"
            strokeWidth={2}
          />
          <polyline
            points={out.map((v, i) => `${px(i)},${py(v, 230)}`).join(' ')}
            fill="none"
            stroke="rgba(74,222,128,0.2)"
            strokeWidth={1.2}
          />
          <circle cx={px(pos)} cy={py(out[pos], 230)} r={5} fill="#4ade80" stroke="#0a0e17" strokeWidth={1.5} />
        </svg>
      </div>
      <div className="card-pad space-y-3.5 self-start lg:col-span-2">
        <Segmented<KernelKey>
          options={(['box', 'gauss', 'edge'] as KernelKey[]).map((k2) => ({ value: k2, label: t.kernelNames[k2] }))}
          value={kk}
          onChange={setKk}
        />
        <Slider label={t.pos} value={pos} min={0} max={CONV_N - 1} step={1} onChange={setPos} format={(v) => `${v}`} accent="#fbbf24" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- application: bearing diagnosis

const BRG_N = 512
const BRG_FS = 2048 // Hz
const BRG_BALLS = 9
const BRG_GEO = 0.8 // 1 − d/D·cosφ
const BRG_NOISE: number[] = (() => {
  const g = makeGauss(88)
  return Array.from({ length: BRG_N }, () => g())
})()

function BearingLab() {
  const t = useT(T)
  const [rpm, setRpm] = useState(1800)
  const [sev, setSev] = useState(0)

  const fShaft = rpm / 60
  const bpfo = (BRG_BALLS / 2) * fShaft * BRG_GEO

  const { sig, spec, peak } = useMemo(() => {
    const x = Array.from({ length: BRG_N }, (_, i) => {
      const time = i / BRG_FS
      let v = 0.6 * Math.sin(2 * Math.PI * fShaft * time) + 0.18 * Math.sin(2 * Math.PI * 2 * fShaft * time + 0.7)
      v += 0.12 * BRG_NOISE[i]
      // fault: periodic clicking = truncated harmonic comb at BPFO
      for (let h = 1; h <= 4; h++) v += sev * 0.28 * Math.pow(0.75, h - 1) * Math.cos(2 * Math.PI * h * bpfo * time)
      return v
    })
    const m = dftMag(x)
    const bin = Math.round((bpfo * BRG_N) / BRG_FS)
    const pk = Math.max(m[bin - 1] ?? 0, m[bin] ?? 0, m[bin + 1] ?? 0)
    return { sig: x, spec: m, peak: pk }
  }, [fShaft, sev, bpfo])

  const state = peak < 0.05 ? 0 : peak < 0.2 ? 1 : 2
  const stateLabel = [t.appHealthy, t.appAlarmSmall, t.appAlarmBig][state]
  const stateColor = ['#4ade80', '#fbbf24', '#f87171'][state]

  const PW = 560
  const TH = 120
  const SH = 170
  const FMAX = 900 // Hz shown
  const binHz = BRG_FS / BRG_N
  const nBins = Math.min(spec.length, Math.floor(FMAX / binHz))
  const sxT = (i: number) => (i / (BRG_N - 1)) * PW
  const syT = (v: number) => TH / 2 - v * (TH / 4.2)
  const sxF = (b: number) => (b / nBins) * PW
  const syF = (v: number) => SH - 16 - Math.min(v / 0.7, 1) * (SH - 34)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="flex flex-col gap-3 lg:col-span-3">
        <div className="card overflow-hidden">
          <div className="border-b border-white/10 px-3 py-1.5 text-[12px] text-muted">{t.appTime}</div>
          <svg viewBox={`0 0 ${PW} ${TH}`} className="block w-full">
            <polyline points={sig.map((v, i) => `${sxT(i)},${syT(v)}`).join(' ')} fill="none" stroke="#22d3ee" strokeWidth={1} />
          </svg>
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-white/10 px-3 py-1.5 text-[12px] text-muted">{t.appSpec}</div>
          <svg viewBox={`0 0 ${PW} ${SH}`} className="block w-full">
            <line x1={sxF(bpfo / binHz)} y1={8} x2={sxF(bpfo / binHz)} y2={SH - 16} stroke="#f87171" strokeWidth={1.5} strokeDasharray="4 3" />
            <text x={sxF(bpfo / binHz) + 4} y={16} fill="#f87171" fontSize={10} fontFamily="JetBrains Mono, monospace">
              BPFO
            </text>
            {Array.from({ length: nBins }, (_, b) => (
              <line key={b} x1={sxF(b)} y1={SH - 16} x2={sxF(b)} y2={syF(spec[b])} stroke="#22d3ee" strokeWidth={PW / nBins - 0.4} />
            ))}
            <text x={PW - 8} y={SH - 4} textAnchor="end" fill="#8b93a7" fontSize={10} fontFamily="JetBrains Mono, monospace">
              f (Hz) → {FMAX}
            </text>
          </svg>
        </div>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.appRpm} value={rpm} min={600} max={3600} step={60} onChange={setRpm} format={(v) => `${v} rpm`} />
          <Slider label={t.appSev} value={sev} min={0} max={1} step={0.02} onChange={setSev} format={(v) => `${fmt(v * 100, 0)} %`} accent="#f87171" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.appBpfo} value={fmt(bpfo, 1)} unit="Hz" />
          <Readout label={t.appPeak} value={fmt(peak, 3)} />
        </div>
        <Readout label={t.appState} value={stateLabel} accent={stateColor} />
        <div className="card-pad">
          <TeX block>{String.raw`f_{\text{BPFO}} = \frac{n}{2} f_s \left(1 - \frac{d}{D}\cos\varphi\right)`}</TeX>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function FourierPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'series', label: t.seriesTitle },
          { id: 'sampling', label: t.aliasTitle },
          { id: 'dft', label: t.dftTitle },
          { id: 'convolution', label: t.convTitle },
          { id: 'math', label: t.mathTitle },
          { id: 'code', label: t.codeTitle },
          { id: 'application', label: t.appTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="series" title={t.seriesTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.series1}</p>
        </div>
        <div className="mt-4">
          <SeriesLab />
        </div>
      </Section>

      <Section id="sampling" title={t.aliasTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.alias1}</p>
        </div>
        <div className="mt-4">
          <AliasLab />
        </div>
      </Section>

      <Section id="dft" title={t.dftTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.dft1}</p>
        </div>
        <div className="mt-4">
          <DftLab />
        </div>
      </Section>

      <Section id="convolution" title={t.convTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.conv1}</p>
        </div>
        <div className="mt-4">
          <ConvLab />
        </div>
      </Section>

      <Section id="math" title={t.mathTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.math1}</p>
          <TeX block>{String.raw`X_k = \sum_{n=0}^{N-1} x_n\, e^{-\,i\,2\pi k n / N}, \qquad x_n = \frac{1}{N}\sum_{k=0}^{N-1} X_k\, e^{\,i\,2\pi k n / N}`}</TeX>
          <p>{t.math2}</p>
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
          <BearingLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
