import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { PageToc } from '../components/PageToc'
import { ProbMap } from '../components/ProbMap'
import { InfoBox, Readout, Section, Slider } from '../components/ui'
import { fmt, mulberry32 } from '../lib/math'
import { logregStep, polyEval, ridgeFit, sigmoid, type LogregW } from '../lib/ml'
import { blobs, makeGauss, type P2 } from '../lib/stats'

const T = {
  en: {
    kicker: 'ML · Module 1',
    title: 'Machine Learning Fundamentals',
    intro:
      'Strip away the buzzwords and machine learning is something you already know from this site: define a model with free parameters, define a cost that measures disagreement with data, and walk downhill. What is genuinely new is the question that decides success in practice: does the fitted model work on data it has never seen?',
    fitTitle: 'Learning = fitting = optimization',
    fit1: 'In the vision track you fitted a camera model to corner detections. Machine learning generalizes the recipe: a model f(x; θ), a dataset of examples, a loss L(θ), an optimizer. Linear regression is the smallest instance — and everything scary later (deep networks included) keeps exactly this shape, just with a bigger f and more θ.',
    linTitle: 'Interactive: linear regression',
    lin1: 'Click anywhere to add data points. The line is the closed-form least-squares fit — the same normal equations you met in the calibration solver. Amber whiskers are the residuals; the loss is their mean squared length. Or press the button and watch plain gradient descent find the same line, step by step.',
    linAdd: 'click into the plot to add points',
    linFitGd: 'Fit by gradient descent',
    linReset: 'Reset points',
    linStop: 'Stop',
    linMse: 'MSE',
    linParams: 'model',
    overTitle: 'Interactive: overfitting and the U-curve',
    over1: 'A hidden truth (dashed) was sampled with noise; only the cyan points are for training, the amber ones are held out for testing. Now raise the polynomial degree: the training error falls forever — the model can always wiggle a bit more. The test error falls, bottoms out, and then rises: the model starts memorizing noise. That rising branch is overfitting, and the resulting U-shape of the test curve is the single most important plot in machine learning.',
    over2: 'Regularization tames it: ridge adds λ·‖θ‖² to the loss, penalizing wild coefficients. Crank the degree to 15, then raise λ — the wiggles flatten and the test error comes back down without touching the data.',
    degree: 'polynomial degree',
    lambda: 'ridge λ',
    trainErr: 'train RMS',
    testErr: 'test RMS',
    uTitle: 'train vs. test error over degree',
    biasTitle: 'Bias, variance and honest evaluation',
    bias1: 'The U-curve is the bias-variance trade-off made visible: a too-simple model is systematically wrong everywhere (high bias, both errors high), a too-flexible model reproduces the accidents of its particular training sample (high variance, errors diverge). The sweet spot minimizes test error — never train error.',
    biasList: [
      'Always evaluate on data the model never saw. Split train / validation / test; tune on validation, report on test — once.',
      'Small datasets: cross-validation reuses every point for both training and validation without cheating.',
      'The gap between train and test error is your overfitting gauge — watch it, not just the absolute numbers.',
      'More (clean) data beats cleverer regularization. Variance shrinks with sample size.',
    ],
    logTitle: 'Interactive: classification with logistic regression',
    log1: 'Regression predicts numbers; classification predicts categories. Logistic regression squeezes a linear score through the sigmoid to get a probability, trained by gradient descent on the cross-entropy loss (both familiar from the optimization modules — this is the same machinery). The shading shows the predicted probability; the sharp line is the decision boundary at p = 0.5.',
    log2: 'Notice what the model can and cannot do: the boundary is a straight line, always. Two blobs — fine. Anything curved or nested — impossible, no matter how long you train. That limitation is the cliffhanger that the neural-networks module resolves.',
    logTrain: 'Train',
    logStop: 'Pause',
    logReset: 'Reset',
    logLoss: 'cross-entropy loss',
    logAcc: 'accuracy',
    codeTitle: 'In practice',
    appTitle: '🏭 In the real world: the process window of a molding machine',
    appIntro:
      'An injection-molding machine produced 90 logged shots: melt temperature, holding pressure, and whether the part came out OK or scrap (short shots, sink marks). Logistic regression turns that log into a process window — the shaded map below is the model’s scrap probability, trained on exactly the cross-entropy machinery from this module. Now place the operating point with the sliders: the model predicts the scrap rate before you waste a single shot. Process engineers call this a “process window”; data scientists call it a linear classifier. Same thing.',
    appTemp: 'melt temperature',
    appPress: 'holding pressure',
    appScrapP: 'predicted scrap rate',
    appVerdict: 'operating point',
    appSafe: 'SAFE',
    appRisky: 'RISKY',
    appMapTitle: 'process window learned from 90 logged shots (amber = OK region, cyan = scrap region)',
    appWhere:
      'The same learned windows guard wave-soldering profiles, CNC feeds-and-speeds, semiconductor recipes and beer-brewing fermentation — anywhere “good” is a region in parameter space that nobody wrote down explicitly.',
  },
  de: {
    kicker: 'ML · Modul 1',
    title: 'Grundlagen des Maschinellen Lernens',
    intro:
      'Ohne die Schlagworte ist maschinelles Lernen etwas, das du von dieser Seite bereits kennst: ein Modell mit freien Parametern definieren, eine Kostenfunktion für die Abweichung von den Daten definieren, bergab laufen. Wirklich neu ist die Frage, die in der Praxis über Erfolg entscheidet: Funktioniert das angepasste Modell auf Daten, die es nie gesehen hat?',
    fitTitle: 'Lernen = Anpassen = Optimieren',
    fit1: 'Im Vision-Track hast du ein Kameramodell an Eckendetektionen angepasst. Maschinelles Lernen verallgemeinert das Rezept: ein Modell f(x; θ), ein Datensatz aus Beispielen, ein Verlust L(θ), ein Optimierer. Lineare Regression ist die kleinste Ausprägung — und alles Furchteinflößende später (tiefe Netze eingeschlossen) behält exakt diese Form, nur mit größerem f und mehr θ.',
    linTitle: 'Interaktiv: lineare Regression',
    lin1: 'Klicke irgendwohin, um Datenpunkte hinzuzufügen. Die Gerade ist die geschlossene Kleinste-Quadrate-Lösung — dieselben Normalengleichungen wie im Kalibrierlöser. Bernsteinfarbene Fäden sind die Residuen; der Verlust ist ihre mittlere quadrierte Länge. Oder drücke den Knopf und sieh zu, wie schlichter Gradientenabstieg dieselbe Gerade findet, Schritt für Schritt.',
    linAdd: 'in den Plot klicken, um Punkte hinzuzufügen',
    linFitGd: 'Per Gradientenabstieg fitten',
    linReset: 'Punkte zurücksetzen',
    linStop: 'Stopp',
    linMse: 'MSE',
    linParams: 'Modell',
    overTitle: 'Interaktiv: Überanpassung und die U-Kurve',
    over1: 'Eine verborgene Wahrheit (gestrichelt) wurde verrauscht abgetastet; nur die cyanfarbenen Punkte dienen dem Training, die bernsteinfarbenen sind zum Testen zurückgehalten. Erhöhe nun den Polynomgrad: Der Trainingsfehler fällt immer weiter — das Modell kann stets noch etwas mehr wackeln. Der Testfehler fällt, erreicht ein Minimum und steigt dann: Das Modell beginnt, Rauschen auswendig zu lernen. Dieser steigende Ast ist Überanpassung, und die U-Form der Testkurve ist der wichtigste Plot des maschinellen Lernens.',
    over2: 'Regularisierung zähmt sie: Ridge addiert λ·‖θ‖² zum Verlust und bestraft wilde Koeffizienten. Stelle Grad 15 ein und erhöhe dann λ — die Wellen glätten sich, und der Testfehler kommt zurück, ohne dass die Daten angefasst werden.',
    degree: 'Polynomgrad',
    lambda: 'Ridge λ',
    trainErr: 'Trainings-RMS',
    testErr: 'Test-RMS',
    uTitle: 'Trainings- vs. Testfehler über dem Grad',
    biasTitle: 'Bias, Varianz und ehrliche Bewertung',
    bias1: 'Die U-Kurve ist der sichtbar gemachte Bias-Varianz-Kompromiss: Ein zu einfaches Modell ist überall systematisch falsch (hoher Bias, beide Fehler hoch), ein zu flexibles Modell reproduziert die Zufälle seiner konkreten Trainingsstichprobe (hohe Varianz, die Fehler laufen auseinander). Das Optimum minimiert den Testfehler — nie den Trainingsfehler.',
    biasList: [
      'Bewerte immer auf Daten, die das Modell nie gesehen hat. Teile in Training / Validierung / Test; stimme auf der Validierung ab, berichte auf dem Test — einmal.',
      'Kleine Datensätze: Kreuzvalidierung nutzt jeden Punkt für Training und Validierung, ohne zu schummeln.',
      'Die Lücke zwischen Trainings- und Testfehler ist dein Überanpassungsmesser — beobachte sie, nicht nur die absoluten Zahlen.',
      'Mehr (saubere) Daten schlagen cleverere Regularisierung. Varianz schrumpft mit der Stichprobengröße.',
    ],
    logTitle: 'Interaktiv: Klassifikation mit logistischer Regression',
    log1: 'Regression sagt Zahlen vorher, Klassifikation Kategorien. Die logistische Regression drückt einen linearen Score durch die Sigmoidfunktion und erhält eine Wahrscheinlichkeit, trainiert per Gradientenabstieg auf dem Kreuzentropie-Verlust (beides vertraut aus den Optimierungsmodulen — es ist dieselbe Maschinerie). Die Schattierung zeigt die vorhergesagte Wahrscheinlichkeit; die scharfe Linie ist die Entscheidungsgrenze bei p = 0,5.',
    log2: 'Beachte, was das Modell kann und was nicht: Die Grenze ist eine Gerade, immer. Zwei Blobs — kein Problem. Alles Gekrümmte oder Verschachtelte — unmöglich, egal wie lange man trainiert. Diese Grenze ist der Cliffhanger, den das Modul über neuronale Netze auflöst.',
    logTrain: 'Trainieren',
    logStop: 'Pause',
    logReset: 'Zurücksetzen',
    logLoss: 'Kreuzentropie-Verlust',
    logAcc: 'Trefferquote',
    codeTitle: 'In der Praxis',
    appTitle: '🏭 In der echten Welt: das Prozessfenster einer Spritzgussmaschine',
    appIntro:
      'Eine Spritzgussmaschine hat 90 protokollierte Schüsse geliefert: Massetemperatur, Nachdruck, und ob das Teil gut oder Ausschuss war (Füllfehler, Einfallstellen). Logistische Regression macht aus diesem Protokoll ein Prozessfenster — die schattierte Karte unten ist die Ausschusswahrscheinlichkeit des Modells, trainiert mit exakt der Kreuzentropie-Maschinerie dieses Moduls. Setze nun den Betriebspunkt mit den Slidern: Das Modell sagt die Ausschussrate voraus, bevor du einen einzigen Schuss verschwendest. Prozessingenieure nennen das „Prozessfenster“, Data Scientists „linearer Klassifikator“. Dasselbe Ding.',
    appTemp: 'Massetemperatur',
    appPress: 'Nachdruck',
    appScrapP: 'vorhergesagte Ausschussrate',
    appVerdict: 'Betriebspunkt',
    appSafe: 'SICHER',
    appRisky: 'RISKANT',
    appMapTitle: 'Prozessfenster aus 90 protokollierten Schüssen (bernstein = Gut-Region, cyan = Ausschuss-Region)',
    appWhere:
      'Dieselben gelernten Fenster bewachen Wellenlöt-Profile, CNC-Vorschübe und -Drehzahlen, Halbleiter-Rezepte und Bierbrau-Fermentationen — überall dort, wo „gut“ eine Region im Parameterraum ist, die niemand explizit aufgeschrieben hat.',
  },
}

const SNIPPET = `from sklearn.linear_model import Ridge, LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import make_pipeline

X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25)

model = make_pipeline(PolynomialFeatures(degree=4), Ridge(alpha=1e-3))
model.fit(X_tr, y_tr)
print("test R²:", model.score(X_te, y_te))          # evaluate on UNSEEN data
print(cross_val_score(model, X, y, cv=5).mean())    # or cross-validate`

// ---------------------------------------------------------------- linear regression lab

const LW = 480
const LH = 380

function LinRegLab() {
  const t = useT(T)
  const initial = useMemo(() => {
    const g = makeGauss(5)
    const rand = mulberry32(6)
    return Array.from({ length: 14 }, () => {
      const x = 0.08 + rand() * 0.84
      return [x, 1.5 * x - 0.75 + g() * 0.16] as P2
    })
  }, [])
  const [pts, setPts] = useState<P2[]>(initial)
  const [gdLine, setGdLine] = useState<{ a: number; b: number } | null>(null)
  const [gdRunning, setGdRunning] = useState(false)
  const gdRef = useRef({ a: 0, b: 0, iter: 0 })

  const fit = useMemo(() => {
    const n = pts.length
    if (n < 2) return { a: 0, b: 0 }
    const mx = pts.reduce((s, p) => s + p[0], 0) / n
    const my = pts.reduce((s, p) => s + p[1], 0) / n
    let num = 0
    let den = 0
    for (const p of pts) {
      num += (p[0] - mx) * (p[1] - my)
      den += (p[0] - mx) ** 2
    }
    const b = den > 1e-12 ? num / den : 0
    return { a: my - b * mx, b }
  }, [pts])

  const line = gdLine ?? fit
  const mse = pts.reduce((s, p) => s + (p[1] - (line.a + line.b * p[0])) ** 2, 0) / Math.max(pts.length, 1)

  useEffect(() => {
    if (!gdRunning) return
    gdRef.current = { a: 0, b: 0, iter: 0 }
    const iv = setInterval(() => {
      const st = gdRef.current
      for (let s = 0; s < 3; s++) {
        let ga = 0
        let gb = 0
        for (const p of pts) {
          const e = st.a + st.b * p[0] - p[1]
          ga += e
          gb += e * p[0]
        }
        st.a -= (0.5 * ga) / pts.length
        st.b -= (0.5 * gb) / pts.length
        st.iter++
      }
      setGdLine({ a: st.a, b: st.b })
      if (st.iter > 220) setGdRunning(false)
    }, 50)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gdRunning])

  const mx = (x: number) => x * LW
  const my = (y: number) => LH / 2 - y * (LH / 3.2)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">
          {t.linAdd}
        </div>
        <svg
          viewBox={`0 0 ${LW} ${LH}`}
          className="block w-full cursor-crosshair touch-none"
          style={{ background: 'radial-gradient(120% 120% at 50% 40%, #141a28 0%, #0a0e17 100%)' }}
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = (e.clientX - rect.left) / rect.width
            const y = ((LH / 2 - ((e.clientY - rect.top) / rect.height) * LH) / LH) * 3.2
            setPts([...pts, [x, y]])
            setGdLine(null)
            setGdRunning(false)
          }}
        >
          {pts.map((p, i) => (
            <g key={i}>
              <line x1={mx(p[0])} y1={my(p[1])} x2={mx(p[0])} y2={my(line.a + line.b * p[0])} stroke="rgba(251,191,36,0.45)" strokeWidth={1.2} />
              <circle cx={mx(p[0])} cy={my(p[1])} r={4.5} fill="#22d3ee" stroke="#0a0e17" strokeWidth={1.5} />
            </g>
          ))}
          <line x1={mx(0)} y1={my(line.a)} x2={mx(1)} y2={my(line.a + line.b)} stroke={gdLine ? '#a78bfa' : '#4ade80'} strokeWidth={2.5} />
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => (gdRunning ? setGdRunning(false) : (setGdLine({ a: 0, b: 0 }), setGdRunning(true)))}>
            {gdRunning ? `⏸ ${t.linStop}` : `▶ ${t.linFitGd}`}
          </button>
          <button
            className="btn"
            onClick={() => {
              setPts(initial)
              setGdLine(null)
              setGdRunning(false)
            }}
          >
            ↺ {t.linReset}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.linMse} value={fmt(mse, 4)} />
          <Readout label={t.linParams} value={`y = ${fmt(line.b, 2)}·x ${line.a >= 0 ? '+' : '−'} ${fmt(Math.abs(line.a), 2)}`} />
        </div>
        <TeX block>{String.raw`L(a,b) = \frac{1}{n}\sum_i \big(y_i - (a + b\,x_i)\big)^2`}</TeX>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- overfitting lab

const TRUE_FN = (x: number) => 0.75 * Math.sin(2.4 * Math.PI * x) + 0.1

function OverfitLab() {
  const t = useT(T)
  const [degree, setDegree] = useState(3)
  const [lamExp, setLamExp] = useState(-8)
  const lambda = 10 ** lamExp

  const { train, test } = useMemo(() => {
    const g = makeGauss(31)
    const rand = mulberry32(32)
    const all = Array.from({ length: 28 }, () => {
      const x = 0.03 + rand() * 0.94
      return [x, TRUE_FN(x) + g() * 0.18] as P2
    })
    return { train: all.filter((_, i) => i % 3 !== 2), test: all.filter((_, i) => i % 3 === 2) }
  }, [])

  // x mapped to [-1, 1] for conditioning
  const u = (x: number) => 2 * x - 1
  const fitFor = (deg: number, lam: number) =>
    ridgeFit(train.map((p) => u(p[0])), train.map((p) => p[1]), deg, lam)

  const coef = useMemo(() => fitFor(degree, lambda), [degree, lambda]) // eslint-disable-line react-hooks/exhaustive-deps

  const rms = (coefs: number[] | null, data: P2[]) =>
    coefs
      ? Math.sqrt(data.reduce((s, p) => s + (polyEval(coefs, u(p[0])) - p[1]) ** 2, 0) / data.length)
      : NaN

  const curveErrs = useMemo(
    () =>
      Array.from({ length: 15 }, (_, i) => {
        const c = fitFor(i + 1, lambda)
        return { deg: i + 1, tr: rms(c, train), te: rms(c, test) }
      }),
    [lambda], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const mx = (x: number) => x * LW
  const my = (y: number) => LH / 2 - y * (LH / 3.0)
  const clampY = (y: number) => Math.max(-1.7, Math.min(1.7, y))

  const UW = 460
  const UH = 260
  const maxErr = Math.min(Math.max(...curveErrs.map((e) => Math.max(e.tr, e.te))), 1.2)
  const ux = (deg: number) => 40 + ((deg - 1) / 14) * (UW - 60)
  const uy = (e: number) => 14 + (1 - Math.min(e, maxErr) / maxErr) * (UH - 50)

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <svg viewBox={`0 0 ${LW} ${LH}`} className="block w-full" style={{ background: 'radial-gradient(120% 120% at 50% 40%, #141a28 0%, #0a0e17 100%)' }}>
            <polyline
              points={Array.from({ length: 100 }, (_, i) => {
                const x = i / 99
                return `${mx(x)},${my(TRUE_FN(x))}`
              }).join(' ')}
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            {coef && (
              <polyline
                points={Array.from({ length: 140 }, (_, i) => {
                  const x = i / 139
                  return `${mx(x)},${my(clampY(polyEval(coef, u(x))))}`
                }).join(' ')}
                fill="none"
                stroke="#a78bfa"
                strokeWidth={2.5}
              />
            )}
            {train.map((p, i) => (
              <circle key={`tr${i}`} cx={mx(p[0])} cy={my(p[1])} r={4} fill="#22d3ee" stroke="#0a0e17" strokeWidth={1.2} />
            ))}
            {test.map((p, i) => (
              <circle key={`te${i}`} cx={mx(p[0])} cy={my(p[1])} r={4} fill="#fbbf24" stroke="#0a0e17" strokeWidth={1.2} />
            ))}
          </svg>
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.uTitle}</div>
          <svg viewBox={`0 0 ${UW} ${UH}`} className="block w-full">
            <polyline points={curveErrs.map((e) => `${ux(e.deg)},${uy(e.tr)}`).join(' ')} fill="none" stroke="#22d3ee" strokeWidth={2} />
            <polyline points={curveErrs.map((e) => `${ux(e.deg)},${uy(e.te)}`).join(' ')} fill="none" stroke="#fbbf24" strokeWidth={2.5} />
            <line x1={ux(degree)} y1={12} x2={ux(degree)} y2={UH - 34} stroke="rgba(167,139,250,0.6)" strokeDasharray="4 3" strokeWidth={1.5} />
            {curveErrs.map((e) => (
              <text key={e.deg} x={ux(e.deg)} y={UH - 16} fill="#8b93a7" fontSize={10} textAnchor="middle">
                {e.deg}
              </text>
            ))}
            <text x={UW - 10} y={20} fill="#22d3ee" fontSize={11} textAnchor="end" fontFamily="JetBrains Mono, monospace">
              train
            </text>
            <text x={UW - 10} y={34} fill="#fbbf24" fontSize={11} textAnchor="end" fontFamily="JetBrains Mono, monospace">
              test
            </text>
          </svg>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.degree} value={degree} min={1} max={15} step={1} onChange={setDegree} format={(v) => `${v}`} accent="#a78bfa" />
          <Slider label={t.lambda} value={lamExp} min={-8} max={-0.5} step={0.1} onChange={setLamExp} format={() => lambda.toExponential(1)} accent="#4ade80" />
        </div>
        <div className="grid grid-cols-2 gap-3 self-start">
          <Readout label={t.trainErr} value={fmt(rms(coef, train), 3)} />
          <Readout label={t.testErr} value={fmt(rms(coef, test), 3)} accent="#fbbf24" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- logistic regression lab

const LOG_RANGE = 1.6

function LogRegLab() {
  const t = useT(T)
  const data = useMemo(
    () =>
      blobs(55, [[-0.55, -0.35], [0.55, 0.4]], 0.34, 71).map((d) => ({
        x: d.p as [number, number],
        y: d.label,
      })),
    [],
  )
  const [w, setW] = useState<LogregW>([0.3, -0.2, 0])
  const [tick, setTick] = useState(0)
  const [running, setRunning] = useState(false)
  const wRef = useRef(w)
  wRef.current = w

  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => {
      let cur = wRef.current
      for (let i = 0; i < 8; i++) cur = logregStep(cur, data, 1.2).w
      setW(cur)
      setTick((x) => x + 1)
    }, 60)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const loss = useMemo(() => logregStep(w, data, 0).loss, [w, data])
  const acc =
    data.filter(({ x, y }) => (sigmoid(w[0] * x[0] + w[1] * x[1] + w[2]) > 0.5 ? 1 : 0) === y).length /
    data.length

  const PW = 480
  const PH = 420
  const mx = (x: number) => ((x + LOG_RANGE) / (2 * LOG_RANGE)) * PW
  const my = (y: number) => PH - ((y + LOG_RANGE) / (2 * LOG_RANGE)) * PH

  // decision line w0 x + w1 y + b = 0 clipped to the box
  const linePts = useMemo(() => {
    const pts: [number, number][] = []
    if (Math.abs(w[1]) > 1e-9) {
      for (const x of [-LOG_RANGE, LOG_RANGE]) {
        const y = -(w[0] * x + w[2]) / w[1]
        if (Math.abs(y) <= LOG_RANGE) pts.push([x, y])
      }
    }
    if (Math.abs(w[0]) > 1e-9) {
      for (const y of [-LOG_RANGE, LOG_RANGE]) {
        const x = -(w[1] * y + w[2]) / w[0]
        if (Math.abs(x) <= LOG_RANGE) pts.push([x, y])
      }
    }
    return pts.slice(0, 2)
  }, [w])

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <ProbMap
          w={PW}
          h={PH}
          xr={[-LOG_RANGE, LOG_RANGE]}
          yr={[-LOG_RANGE, LOG_RANGE]}
          prob={(x, y) => sigmoid(w[0] * x + w[1] * y + w[2])}
          ckey={`${tick}-${running}`}
        >
          {data.map((d, i) => (
            <circle
              key={i}
              cx={mx(d.x[0])}
              cy={my(d.x[1])}
              r={4}
              fill={d.y === 0 ? '#22d3ee' : '#fbbf24'}
              stroke="#0a0e17"
              strokeWidth={1.2}
            />
          ))}
          {linePts.length === 2 && (
            <line
              x1={mx(linePts[0][0])}
              y1={my(linePts[0][1])}
              x2={mx(linePts[1][0])}
              y2={my(linePts[1][1])}
              stroke="#e6eaf2"
              strokeWidth={2}
            />
          )}
        </ProbMap>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setRunning(!running)}>
            {running ? `⏸ ${t.logStop}` : `▶ ${t.logTrain}`}
          </button>
          <button
            className="btn"
            onClick={() => {
              setRunning(false)
              setW([0.3, -0.2, 0])
              setTick((x) => x + 1)
            }}
          >
            ↺ {t.logReset}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.logLoss} value={fmt(loss, 3)} />
          <Readout label={t.logAcc} value={fmt(acc * 100, 1)} unit="%" accent={acc > 0.95 ? '#4ade80' : undefined} />
        </div>
        <TeX block>{String.raw`p(y{=}1\mid \mathbf{x}) = \sigma(\mathbf{w}^{\mathsf T}\mathbf{x} + b), \qquad \sigma(z) = \frac{1}{1+e^{-z}}`}</TeX>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- application: process window

// normalized coords: x1 = (T − 240)/40, x2 = (P − 700)/300
const SHOTS: { x: [number, number]; y: number }[] = (() => {
  const rand = mulberry32(31)
  const g = makeGauss(32)
  return Array.from({ length: 90 }, () => {
    const x1 = (rand() - 0.5) * 2
    const x2 = (rand() - 0.5) * 2
    // true physics: hot melt or high pressure fills the mold; y = 1 means OK
    const y = 0.9 * x1 + 1.2 * x2 + 0.25 + g() * 0.35 > 0 ? 1 : 0
    return { x: [x1, x2] as [number, number], y }
  })
})()

const WINDOW_W: LogregW = (() => {
  let w: LogregW = [0, 0, 0]
  for (let i = 0; i < 4000; i++) w = logregStep(w, SHOTS, 0.5).w
  return w
})()

const toT = (x1: number) => 240 + 40 * x1
const toP = (x2: number) => 700 + 300 * x2

function ProcessWindowLab() {
  const t = useT(T)
  const [temp, setTemp] = useState(235)
  const [press, setPress] = useState(650)

  const x1 = (temp - 240) / 40
  const x2 = (press - 700) / 300
  const pOk = sigmoid(WINDOW_W[0] * x1 + WINDOW_W[1] * x2 + WINDOW_W[2])
  const scrap = 1 - pOk
  const safe = scrap < 0.02

  const W2 = 480
  const H2 = 360
  const sx = (v1: number) => ((v1 + 1) / 2) * W2
  const sy = (v2: number) => H2 - ((v2 + 1) / 2) * H2

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <ProbMap
          w={W2}
          h={H2}
          xr={[-1, 1]}
          yr={[-1, 1]}
          prob={(a, b) => sigmoid(WINDOW_W[0] * a + WINDOW_W[1] * b + WINDOW_W[2])}
          ckey="process-window"
          title={t.appMapTitle}
        >
          {SHOTS.map((s, i) => (
            <circle
              key={i}
              cx={sx(s.x[0])}
              cy={sy(s.x[1])}
              r={3}
              fill={s.y === 1 ? '#fbbf24cc' : '#22d3eecc'}
              stroke="#0a0e17"
              strokeWidth={0.8}
            />
          ))}
          <circle cx={sx(x1)} cy={sy(x2)} r={9} fill="none" stroke={safe ? '#4ade80' : '#f87171'} strokeWidth={2.5} />
          <line x1={sx(x1) - 14} y1={sy(x2)} x2={sx(x1) + 14} y2={sy(x2)} stroke={safe ? '#4ade80' : '#f87171'} strokeWidth={1} />
          <line x1={sx(x1)} y1={sy(x2) - 14} x2={sx(x1)} y2={sy(x2) + 14} stroke={safe ? '#4ade80' : '#f87171'} strokeWidth={1} />
        </ProbMap>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.appTemp} value={temp} min={toT(-1)} max={toT(1)} step={1} onChange={setTemp} format={(v) => `${v} °C`} />
          <Slider label={t.appPress} value={press} min={toP(-1)} max={toP(1)} step={5} onChange={setPress} format={(v) => `${v} bar`} accent="#a78bfa" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.appScrapP} value={`${fmt(scrap * 100, 1)} %`} accent={safe ? '#4ade80' : '#f87171'} />
          <Readout label={t.appVerdict} value={safe ? t.appSafe : t.appRisky} accent={safe ? '#4ade80' : '#f87171'} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function MlBasicsPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'fit', label: t.fitTitle },
          { id: 'linreg', label: t.linTitle },
          { id: 'overfit', label: t.overTitle },
          { id: 'biasvar', label: t.biasTitle },
          { id: 'logreg', label: t.logTitle },
          { id: 'code', label: t.codeTitle },
          { id: 'application', label: t.appTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="fit" title={t.fitTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.fit1}</p>
          <TeX block>{String.raw`\theta^\star = \arg\min_\theta\; \frac{1}{n}\sum_{i=1}^{n} \ell\big(f(\mathbf{x}_i;\theta),\, y_i\big) \;+\; \lambda\,\Omega(\theta)`}</TeX>
        </div>
      </Section>

      <Section id="linreg" title={t.linTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.lin1}</p>
        </div>
        <div className="mt-4">
          <LinRegLab />
        </div>
      </Section>

      <Section id="overfit" title={t.overTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.over1}</p>
          <p>{t.over2}</p>
        </div>
        <div className="mt-4">
          <OverfitLab />
        </div>
      </Section>

      <Section id="biasvar" title={t.biasTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.bias1}</p>
          <ul>
            {t.biasList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="logreg" title={t.logTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.log1}</p>
        </div>
        <div className="mt-4">
          <LogRegLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.log2}
        </InfoBox>
      </Section>

      <Section id="code" title={t.codeTitle}>
        <pre className="card overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-ink/85">{SNIPPET}</pre>
      </Section>

      <Section id="application" title={t.appTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.appIntro}</p>
        </div>
        <div className="mt-4">
          <ProcessWindowLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
