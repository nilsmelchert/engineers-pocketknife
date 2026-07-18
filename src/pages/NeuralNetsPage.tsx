import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { PageToc } from '../components/PageToc'
import { ProbMap } from '../components/ProbMap'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import { fmt, mulberry32 } from '../lib/math'
import {
  ACT,
  applyAdam,
  applySgd,
  createAdamState,
  createMlp,
  mlpEval,
  mlpGrad,
  mlpNeuron,
  mlpPredict,
  type ActKey,
  type AdamState,
  type Mlp,
} from '../lib/ml'
import { circlesData, moons, spirals, xorData, type LabeledPoint } from '../lib/stats'

const T = {
  en: {
    kicker: 'ML · Module 3',
    title: 'Neural Networks & Deep Learning',
    intro:
      'Logistic regression ended on a cliffhanger: its decision boundary is forever a straight line. The fix sounds almost too cheap — stack several logistic regressions and put a nonlinearity between them. That stack is a neural network, and on this page you will train real ones, live, on problems a line could never solve.',
    whyTitle: 'Why stacking works',
    why1: 'A single layer computes a weighted sum — a linear function. Stacking linear functions is pointless: the composition is still linear. The magic ingredient is the activation function squashed between layers: with it, each hidden neuron carves the plane with its own soft line, and the next layer combines those pieces into curves, islands, spirals — any shape, given enough neurons (the universal approximation theorem). XOR, the classic counterexample to linear models, needs exactly one hidden layer.',
    neuronTitle: 'Interactive: anatomy of one neuron',
    neuron1: 'One neuron = weighted sum + bias, pushed through an activation. The two weights tilt its response surface, the bias shifts it, the activation shapes the transition. Every hidden unit in the playground below is exactly this, nothing more.',
    actLabel: 'activation',
    playTitle: 'Interactive: the playground — train a network live',
    play1: 'A real multilayer perceptron, trained in your browser with mini-batch gradients and backprop — no library, the exact math of this module. Choose a dataset, shape the architecture, press play. The shading is the network’s current decision function; the diagram shows every weight (thickness = magnitude, cyan = positive, red = negative). Hover any hidden neuron to see the feature it has learned to detect.',
    dsNames: { xor: 'XOR', circles: 'circles', moons: 'moons', spiral: 'spiral' },
    arch: 'hidden layers',
    addLayer: '+ layer',
    rmLayer: '− layer',
    optLabel: 'optimizer',
    train: 'Train',
    pause: 'Pause',
    step: 'Step',
    reset: 'Reset',
    loss: 'loss',
    acc: 'accuracy',
    steps: 'steps',
    lossCurve: 'training loss (log scale)',
    hoverHint: 'hover a hidden neuron in the diagram to see its learned feature',
    playTry: [
      'XOR with NO hidden layer is impossible — but you cannot even build that here; try the next best thing: 1 layer × 1 neuron. It fails. Two neurons: solved. That is the whole point of depth.',
      'Spiral, 2 × 8 tanh, Adam: watch the boundary curl itself around the arms within seconds. Switch to plain SGD and feel the difference.',
      'Train the spiral with ReLU and look at the boundary: piecewise-straight facets — you are literally seeing the folded linear pieces.',
      'Set the learning rate to maximum: the loss curve spikes and jumps — the overshooting you know from the optimization modules, now in 100 dimensions.',
    ],
    backTitle: 'Backpropagation: the chain rule, industrialized',
    back1: 'Training needs ∂L/∂w for every weight. Backprop computes all of them in one backward sweep: run the network forward, then propagate the error signal δ backward through the same connections, multiplying by local derivatives along the way — the chain rule, applied systematically:',
    back2: 'The cost of all gradients is about twice a forward pass — independent of the parameter count. This is the algorithmic miracle that makes deep learning affordable, and the same trick your autograd framework performs when you call loss.backward().',
    checkTitle: 'Interactive: trust but verify — gradient checking',
    check1: 'Is the backward pass right? Compare it against the definition of the derivative: nudge one weight by ±ε and difference the loss. The two numbers below come from a small fixed network: one via backprop, one via finite differences. Slide ε: too large and the truncation error of the approximation shows; too small and floating-point cancellation takes over. The sweet spot around 10⁻⁴ – 10⁻⁵ is where implementers of every deep-learning framework live.',
    checkEps: 'finite-difference ε',
    checkBp: '∂L/∂w (backprop)',
    checkFd: '∂L/∂w (finite diff.)',
    checkDiff: 'difference',
    pathTitle: 'Training pathologies — a field guide',
    pathList: [
      'Learning rate too high: loss oscillates or explodes (you saw it live above). Too low: loss creeps. The loss curve is your dashboard — read it.',
      'Overfitting: small data + big net memorizes. Weight decay (L2), early stopping, dropout and above all more data are the remedies; the diagnosis is module ML·1’s train/test gap.',
      'Dead ReLUs: a neuron pushed into the flat zero region stops learning forever (its gradient is 0). Leaky ReLU or smaller learning rates prevent it.',
      'Unscaled inputs: features on wildly different scales create the ill-conditioned valleys of module Vision·3. Normalize inputs; batch normalization extends the idea inside the network.',
    ],
    outTitle: 'From here to deep learning',
    out1: 'Everything past this page is architecture, not new principles. CNNs are MLPs with weight sharing across space (the right prior for images); transformers wire layers with attention (the right prior for sequences); billions of parameters change the engineering, not the math. Training is still: mini-batch, forward, backprop, Adam step — the exact loop running in the playground above, on more silicon.',
    codeTitle: 'The same network in PyTorch',
  },
  de: {
    kicker: 'ML · Modul 3',
    title: 'Neuronale Netze & Deep Learning',
    intro:
      'Die logistische Regression endete mit einem Cliffhanger: Ihre Entscheidungsgrenze ist für immer eine Gerade. Die Lösung klingt fast zu billig — staple mehrere logistische Regressionen und setze eine Nichtlinearität dazwischen. Dieser Stapel ist ein neuronales Netz, und auf dieser Seite trainierst du echte davon, live, an Problemen, die keine Gerade je lösen könnte.',
    whyTitle: 'Warum Stapeln funktioniert',
    why1: 'Eine einzelne Schicht berechnet eine gewichtete Summe — eine lineare Funktion. Lineare Funktionen zu stapeln ist sinnlos: Die Komposition bleibt linear. Die magische Zutat ist die Aktivierungsfunktion zwischen den Schichten: Mit ihr schneidet jedes verborgene Neuron die Ebene mit seiner eigenen weichen Linie, und die nächste Schicht kombiniert diese Stücke zu Kurven, Inseln, Spiralen — jeder Form, bei genug Neuronen (Universal Approximation Theorem). XOR, das klassische Gegenbeispiel zu linearen Modellen, braucht genau eine verborgene Schicht.',
    neuronTitle: 'Interaktiv: Anatomie eines Neurons',
    neuron1: 'Ein Neuron = gewichtete Summe + Bias, durch eine Aktivierung gedrückt. Die beiden Gewichte kippen seine Antwortfläche, der Bias verschiebt sie, die Aktivierung formt den Übergang. Jede verborgene Einheit im Spielplatz unten ist exakt das, nicht mehr.',
    actLabel: 'Aktivierung',
    playTitle: 'Interaktiv: der Spielplatz — ein Netz live trainieren',
    play1: 'Ein echtes mehrschichtiges Perzeptron, in deinem Browser mit Mini-Batch-Gradienten und Backprop trainiert — keine Bibliothek, exakt die Mathematik dieses Moduls. Wähle einen Datensatz, forme die Architektur, drücke Play. Die Schattierung ist die aktuelle Entscheidungsfunktion des Netzes; das Diagramm zeigt jedes Gewicht (Dicke = Betrag, cyan = positiv, rot = negativ). Fahre über ein verborgenes Neuron, um das Merkmal zu sehen, das es zu erkennen gelernt hat.',
    dsNames: { xor: 'XOR', circles: 'Kreise', moons: 'Monde', spiral: 'Spirale' },
    arch: 'verborgene Schichten',
    addLayer: '+ Schicht',
    rmLayer: '− Schicht',
    optLabel: 'Optimierer',
    train: 'Trainieren',
    pause: 'Pause',
    step: 'Schritt',
    reset: 'Zurücksetzen',
    loss: 'Verlust',
    acc: 'Trefferquote',
    steps: 'Schritte',
    lossCurve: 'Trainingsverlust (log-Skala)',
    hoverHint: 'über ein verborgenes Neuron im Diagramm fahren, um sein gelerntes Merkmal zu sehen',
    playTry: [
      'XOR ganz ohne verborgene Schicht ist unmöglich — das lässt sich hier nicht einmal bauen; probiere das Nächstbeste: 1 Schicht × 1 Neuron. Es scheitert. Zwei Neuronen: gelöst. Genau das ist der Sinn der Tiefe.',
      'Spirale, 2 × 8 tanh, Adam: Sieh zu, wie sich die Grenze binnen Sekunden um die Arme wickelt. Wechsle zu reinem SGD und spüre den Unterschied.',
      'Trainiere die Spirale mit ReLU und betrachte die Grenze: stückweise gerade Facetten — du siehst buchstäblich die gefalteten linearen Teile.',
      'Stelle die Lernrate auf Maximum: Die Verlustkurve zackt und springt — das Überschießen aus den Optimierungsmodulen, jetzt in 100 Dimensionen.',
    ],
    backTitle: 'Backpropagation: die Kettenregel, industrialisiert',
    back1: 'Training braucht ∂L/∂w für jedes Gewicht. Backprop berechnet alle in einem Rückwärtsdurchlauf: Netz vorwärts auswerten, dann das Fehlersignal δ rückwärts durch dieselben Verbindungen propagieren und unterwegs mit lokalen Ableitungen multiplizieren — die Kettenregel, systematisch angewandt:',
    back2: 'Alle Gradienten kosten etwa das Doppelte eines Vorwärtsdurchlaufs — unabhängig von der Parameterzahl. Das ist das algorithmische Wunder, das Deep Learning bezahlbar macht, und derselbe Trick, den dein Autograd-Framework bei loss.backward() ausführt.',
    checkTitle: 'Interaktiv: Vertrauen ist gut — Gradient Checking',
    check1: 'Stimmt der Rückwärtsdurchlauf? Vergleiche ihn mit der Definition der Ableitung: Stupse ein Gewicht um ±ε an und differenziere den Verlust. Die beiden Zahlen unten stammen aus einem kleinen festen Netz: eine per Backprop, eine per finiter Differenz. Schiebe ε: zu groß, und der Abschneidefehler der Näherung zeigt sich; zu klein, und die Gleitkomma-Auslöschung übernimmt. Der Sweet Spot um 10⁻⁴ – 10⁻⁵ ist das Zuhause aller Framework-Entwickler.',
    checkEps: 'Finite-Differenzen-ε',
    checkBp: '∂L/∂w (Backprop)',
    checkFd: '∂L/∂w (finite Diff.)',
    checkDiff: 'Differenz',
    pathTitle: 'Trainingspathologien — ein Feldführer',
    pathList: [
      'Lernrate zu hoch: Der Verlust oszilliert oder explodiert (oben live zu sehen). Zu niedrig: Er kriecht. Die Verlustkurve ist dein Armaturenbrett — lies sie.',
      'Überanpassung: Wenig Daten + großes Netz lernt auswendig. Weight Decay (L2), Early Stopping, Dropout und vor allem mehr Daten helfen; die Diagnose ist die Train/Test-Lücke aus Modul ML·1.',
      'Tote ReLUs: Ein Neuron, das in die flache Nullzone gedrückt wurde, lernt nie wieder (sein Gradient ist 0). Leaky ReLU oder kleinere Lernraten verhindern das.',
      'Unskalierte Eingaben: Merkmale auf wild verschiedenen Skalen erzeugen die schlecht konditionierten Täler aus Modul Vision·3. Normalisiere die Eingaben; Batch-Normalisierung trägt die Idee ins Netzinnere.',
    ],
    outTitle: 'Von hier zu Deep Learning',
    out1: 'Alles jenseits dieser Seite ist Architektur, kein neues Prinzip. CNNs sind MLPs mit räumlich geteilten Gewichten (der richtige Prior für Bilder); Transformer verdrahten Schichten mit Attention (der richtige Prior für Sequenzen); Milliarden Parameter ändern das Engineering, nicht die Mathematik. Training bleibt: Mini-Batch, vorwärts, Backprop, Adam-Schritt — exakt die Schleife aus dem Spielplatz oben, auf mehr Silizium.',
    codeTitle: 'Dasselbe Netz in PyTorch',
  },
}

const SNIPPET = `import torch, torch.nn as nn

model = nn.Sequential(
    nn.Linear(2, 8), nn.Tanh(),
    nn.Linear(8, 8), nn.Tanh(),
    nn.Linear(8, 1), nn.Sigmoid())

opt = torch.optim.Adam(model.parameters(), lr=1e-2)
loss_fn = nn.BCELoss()

for step in range(2000):
    idx = torch.randint(0, len(X), (32,))
    loss = loss_fn(model(X[idx]).squeeze(-1), y[idx])
    opt.zero_grad()
    loss.backward()          # ← backprop
    opt.step()`

const DOMAIN = 1.5

// ---------------------------------------------------------------- neuron anatomy

function NeuronLab() {
  const [w1, setW1] = useState(1.8)
  const [w2, setW2] = useState(-1.0)
  const [b, setB] = useState(0.2)
  const [act, setAct] = useState<ActKey>('tanh')

  const out = (x: number, y: number) => {
    const z = w1 * x + w2 * y + b
    const a = ACT[act].f(z)
    return act === 'sigmoid' ? a : act === 'tanh' ? (a + 1) / 2 : Math.min(a, 1)
  }

  const PW = 380
  const PH = 340
  // activation curve plot
  const AW = 300
  const AH = 150
  const curve = Array.from({ length: 100 }, (_, i) => {
    const z = -4 + (i / 99) * 8
    const a = ACT[act].f(z)
    return `${(i / 99) * (AW - 20) + 10},${AH - 20 - ((a - (act === 'tanh' ? -1 : 0)) / (act === 'tanh' ? 2 : act === 'relu' ? 4 : 1)) * (AH - 40)}`
  }).join(' ')

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <ProbMap w={PW} h={PH} xr={[-DOMAIN, DOMAIN]} yr={[-DOMAIN, DOMAIN]} prob={out} ckey={`${w1}-${w2}-${b}-${act}`} />
      </div>
      <div className="card-pad space-y-3.5 self-start lg:col-span-3">
        <Segmented<ActKey>
          options={(['tanh', 'relu', 'sigmoid'] as ActKey[]).map((a) => ({ value: a, label: a }))}
          value={act}
          onChange={setAct}
        />
        <div className="grid gap-x-6 gap-y-3.5 md:grid-cols-2">
          <Slider label={<TeX>w_1</TeX>} value={w1} min={-3} max={3} step={0.05} onChange={setW1} format={(v) => fmt(v, 2)} />
          <Slider label={<TeX>w_2</TeX>} value={w2} min={-3} max={3} step={0.05} onChange={setW2} format={(v) => fmt(v, 2)} />
          <Slider label={<TeX>b</TeX>} value={b} min={-2} max={2} step={0.05} onChange={setB} format={(v) => fmt(v, 2)} accent="#fbbf24" />
        </div>
        <svg viewBox={`0 0 ${AW} ${AH}`} className="w-full max-w-xs">
          <line x1={10} y1={AH - 20} x2={AW - 10} y2={AH - 20} stroke="rgba(255,255,255,0.15)" />
          <polyline points={curve} fill="none" stroke="#22d3ee" strokeWidth={2} />
          <text x={AW - 12} y={16} fill="#8b93a7" fontSize={11} textAnchor="end" fontFamily="JetBrains Mono, monospace">
            {act}(z)
          </text>
        </svg>
        <TeX block>{String.raw`a = \varphi(w_1 x_1 + w_2 x_2 + b)`}</TeX>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- playground

type DsKey = 'xor' | 'circles' | 'moons' | 'spiral'

function makeData(key: DsKey, seed: number): LabeledPoint[] {
  switch (key) {
    case 'xor':
      return xorData(30, 0.02, seed)
    case 'circles':
      return circlesData(60, 0.06, seed)
    case 'moons':
      return moons(60, 0.08, seed).map((d) => ({ p: [d.p[0] * 1.1, d.p[1] * 1.4] as [number, number], label: d.label }))
    case 'spiral':
      return spirals(55, 0.03, seed)
  }
}

function Playground() {
  const t = useT(T)
  const [dsKey, setDsKey] = useState<DsKey>('circles')
  const [hidden, setHidden] = useState<number[]>([6, 6])
  const [act, setAct] = useState<ActKey>('tanh')
  const [opt, setOpt] = useState<'sgd' | 'adam'>('adam')
  const [lrExp, setLrExp] = useState(-2)
  const [running, setRunning] = useState(false)
  const [tick, setTick] = useState(0)
  const [seed, setSeed] = useState(1)
  const [hoverNeuron, setHoverNeuron] = useState<{ layer: number; idx: number } | null>(null)

  const data = useMemo(
    () => makeData(dsKey, 3).map((d) => ({ x: [d.p[0], d.p[1]], y: d.label })),
    [dsKey],
  )

  const modelRef = useRef<Mlp>(createMlp([2, 6, 6, 1], 'tanh', 1))
  const adamRef = useRef<AdamState>(createAdamState(modelRef.current))
  const stepsRef = useRef(0)
  const lossHistRef = useRef<number[]>([])
  const batchRng = useRef(mulberry32(11))

  const rebuild = () => {
    modelRef.current = createMlp([2, ...hidden, 1], act, seed * 37 + 5)
    adamRef.current = createAdamState(modelRef.current)
    stepsRef.current = 0
    lossHistRef.current = []
    batchRng.current = mulberry32(seed * 7 + 3)
    setHoverNeuron(null)
    setTick((x) => x + 1)
  }

  // reset on any structural change
  useEffect(() => {
    setRunning(false)
    rebuild()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsKey, hidden, act, seed])

  const lr = 10 ** lrExp

  const trainSteps = (nSteps: number) => {
    const m = modelRef.current
    const rand = batchRng.current
    for (let s = 0; s < nSteps; s++) {
      const batch = Array.from({ length: 32 }, () => data[Math.floor(rand() * data.length)])
      const g = mlpGrad(m, batch)
      if (opt === 'adam') applyAdam(m, g, adamRef.current, lr)
      else applySgd(m, g, lr * 3)
      stepsRef.current++
    }
    lossHistRef.current = [...lossHistRef.current, mlpEval(m, data).loss].slice(-300)
    setTick((x) => x + 1)
  }

  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => trainSteps(10), 50)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, opt, lrExp, dsKey])

  const m = modelRef.current
  const { loss, acc } = useMemo(() => mlpEval(m, data), [tick, data]) // eslint-disable-line react-hooks/exhaustive-deps

  const probFn = useMemo(() => {
    if (hoverNeuron) {
      const { layer, idx } = hoverNeuron
      return (x: number, y: number) => {
        const a = mlpNeuron(m, [x, y], layer, idx)
        return m.act === 'sigmoid' ? a : m.act === 'tanh' ? (a + 1) / 2 : Math.min(a, 1)
      }
    }
    return (x: number, y: number) => mlpPredict(m, [x, y])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverNeuron, Math.floor(tick / 2)])

  const PW = 440
  const PH = 420
  const px = (x: number) => ((x + DOMAIN) / (2 * DOMAIN)) * PW
  const py = (y: number) => PH - ((y + DOMAIN) / (2 * DOMAIN)) * PH

  // ---- network diagram geometry
  const DW = 360
  const DH = 300
  const layers = m.sizes
  const nodeX = (l: number) => 34 + (l / (layers.length - 1)) * (DW - 68)
  const nodeY = (l: number, i: number) => {
    const n = layers[l]
    return DH / 2 + (i - (n - 1) / 2) * Math.min(40, (DH - 40) / Math.max(n - 1, 1))
  }

  const setLayerSize = (li: number, delta: number) => {
    const next = [...hidden]
    next[li] = Math.min(8, Math.max(1, next[li] + delta))
    setHidden(next)
  }

  const lossHist = lossHistRef.current
  const CVW = 300
  const CVH = 110
  const logs = lossHist.map((l) => Math.log10(Math.max(l, 1e-4)))
  const lmin = Math.min(...logs, -2)
  const lmax = Math.max(...logs, 0)

  return (
    <div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ProbMap
          w={PW}
          h={PH}
          xr={[-DOMAIN, DOMAIN]}
          yr={[-DOMAIN, DOMAIN]}
          prob={probFn}
          ckey={`${dsKey}-${tick >> 1}-${hoverNeuron ? `${hoverNeuron.layer}.${hoverNeuron.idx}` : 'out'}`}
          title={hoverNeuron ? `hidden ${hoverNeuron.layer + 1}.${hoverNeuron.idx + 1}` : undefined}
        >
          {data.map((d, i) => (
            <circle
              key={i}
              cx={px(d.x[0])}
              cy={py(d.x[1])}
              r={3.4}
              fill={d.y === 0 ? '#22d3ee' : '#fbbf24'}
              stroke="#0a0e17"
              strokeWidth={1}
            />
          ))}
        </ProbMap>

        <div className="flex flex-col gap-3">
          <div className="card overflow-hidden">
            <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">
              {t.hoverHint}
            </div>
            <svg viewBox={`0 0 ${DW} ${DH}`} className="block w-full" onMouseLeave={() => setHoverNeuron(null)}>
              {m.W.map((Wl, l) =>
                Wl.map((row, j) =>
                  row.map((w, i) => (
                    <line
                      key={`${l}-${j}-${i}`}
                      x1={nodeX(l)}
                      y1={nodeY(l, i)}
                      x2={nodeX(l + 1)}
                      y2={nodeY(l + 1, j)}
                      stroke={w >= 0 ? '#22d3ee' : '#f87171'}
                      strokeWidth={Math.min(Math.abs(w) * 1.6 + 0.2, 5)}
                      opacity={Math.min(0.15 + Math.abs(w) * 0.3, 0.85)}
                    />
                  )),
                ),
              )}
              {layers.map((n, l) =>
                Array.from({ length: n }, (_, i) => {
                  const isHidden = l > 0 && l < layers.length - 1
                  const hovered = hoverNeuron && hoverNeuron.layer === l - 1 && hoverNeuron.idx === i
                  return (
                    <circle
                      key={`${l}-${i}`}
                      cx={nodeX(l)}
                      cy={nodeY(l, i)}
                      r={hovered ? 12 : 9}
                      fill={hovered ? '#a78bfa' : l === 0 ? '#28334a' : l === layers.length - 1 ? '#fbbf24' : '#10141f'}
                      stroke={hovered ? '#e6eaf2' : 'rgba(255,255,255,0.35)'}
                      strokeWidth={1.5}
                      className={isHidden ? 'cursor-pointer' : ''}
                      onMouseEnter={isHidden ? () => setHoverNeuron({ layer: l - 1, idx: i }) : undefined}
                    />
                  )
                }),
              )}
            </svg>
          </div>
          <div className="card overflow-hidden">
            <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.lossCurve}</div>
            <svg viewBox={`0 0 ${CVW} ${CVH}`} className="block w-full">
              {lossHist.length > 1 && (
                <polyline
                  points={logs
                    .map((l, i) => `${8 + (i / Math.max(logs.length - 1, 1)) * (CVW - 16)},${8 + ((lmax - l) / Math.max(lmax - lmin, 0.1)) * (CVH - 16)}`)
                    .join(' ')}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth={1.8}
                />
              )}
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card-pad space-y-3.5">
          <Segmented<DsKey>
            options={(Object.keys(t.dsNames) as DsKey[]).map((k) => ({ value: k, label: t.dsNames[k] }))}
            value={dsKey}
            onChange={setDsKey}
          />
          <Segmented<ActKey>
            options={(['tanh', 'relu', 'sigmoid'] as ActKey[]).map((a) => ({ value: a, label: a }))}
            value={act}
            onChange={setAct}
          />
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-muted">{t.optLabel}</div>
            <Segmented<'sgd' | 'adam'>
              options={[
                { value: 'sgd', label: 'SGD' },
                { value: 'adam', label: 'Adam' },
              ]}
              value={opt}
              onChange={setOpt}
            />
          </div>
          <Slider label="lr" value={lrExp} min={-3.2} max={-0.8} step={0.05} onChange={setLrExp} format={() => lr.toPrecision(2)} />
        </div>

        <div className="card-pad">
          <div className="mb-2 text-[13px] font-medium text-muted">{t.arch}</div>
          <div className="flex flex-wrap items-center gap-3">
            {hidden.map((n, li) => (
              <div key={li} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <button className="cursor-pointer text-accent hover:text-ink" onClick={() => setLayerSize(li, 1)}>
                  +
                </button>
                <span className="font-mono text-lg font-bold">{n}</span>
                <button className="cursor-pointer text-accent hover:text-ink" onClick={() => setLayerSize(li, -1)}>
                  −
                </button>
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <button className="btn text-xs" onClick={() => hidden.length < 3 && setHidden([...hidden, 4])}>
                {t.addLayer}
              </button>
              <button className="btn text-xs" onClick={() => hidden.length > 1 && setHidden(hidden.slice(0, -1))}>
                {t.rmLayer}
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setRunning(!running)}>
              {running ? `⏸ ${t.pause}` : `▶ ${t.train}`}
            </button>
            <button className="btn" onClick={() => trainSteps(6)}>
              {t.step}
            </button>
            <button
              className="btn"
              onClick={() => {
                setRunning(false)
                setSeed((s) => s + 1)
              }}
            >
              ↺ {t.reset}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 content-start gap-3">
          <Readout label={t.loss} value={fmt(loss, 3)} />
          <Readout label={t.acc} value={fmt(acc * 100, 1)} unit="%" accent={acc > 0.9 ? '#4ade80' : undefined} />
          <Readout label={t.steps} value={`${stepsRef.current}`} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- gradient check

function GradCheck() {
  const t = useT(T)
  const [epsExp, setEpsExp] = useState(-4)
  const eps = 10 ** epsExp

  const { bp, fd } = useMemo(() => {
    const model = createMlp([2, 3, 1], 'tanh', 42)
    const sample = { x: [0.6, -0.4], y: 1 }
    const bp = mlpGrad(model, [sample]).dW[0][0][0]
    const lossAt = (delta: number) => {
      const m2: Mlp = JSON.parse(JSON.stringify(model))
      m2.W[0][0][0] += delta
      const p = mlpPredict(m2, sample.x)
      return -Math.log(p + 1e-12)
    }
    const fd = (lossAt(eps) - lossAt(-eps)) / (2 * eps)
    return { bp, fd }
  }, [eps])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card-pad">
        <Slider label={t.checkEps} value={epsExp} min={-9} max={-1} step={0.1} onChange={setEpsExp} format={() => eps.toExponential(1)} accent="#fbbf24" />
      </div>
      <div className="grid grid-cols-3 gap-3 self-start">
        <Readout label={t.checkBp} value={bp.toPrecision(6)} />
        <Readout label={t.checkFd} value={fd.toPrecision(6)} accent="#fbbf24" />
        <Readout
          label={t.checkDiff}
          value={Math.abs(bp - fd).toExponential(1)}
          accent={Math.abs(bp - fd) < 1e-6 ? '#4ade80' : '#f87171'}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function NeuralNetsPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'why', label: t.whyTitle },
          { id: 'neuron', label: t.neuronTitle },
          { id: 'playground', label: t.playTitle },
          { id: 'backprop', label: t.backTitle },
          { id: 'gradcheck', label: t.checkTitle },
          { id: 'pathologies', label: t.pathTitle },
          { id: 'outlook', label: t.outTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="why" title={t.whyTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.why1}</p>
        </div>
      </Section>

      <Section id="neuron" title={t.neuronTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.neuron1}</p>
        </div>
        <div className="mt-4">
          <NeuronLab />
        </div>
      </Section>

      <Section id="playground" title={t.playTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.play1}</p>
        </div>
        <div className="mt-4">
          <Playground />
        </div>
        <InfoBox title="⚡ Try it">
          <ul className="my-1 list-disc space-y-1 pl-5">
            {t.playTry.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </InfoBox>
      </Section>

      <Section id="backprop" title={t.backTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.back1}</p>
          <TeX block>{String.raw`\delta^{(L)} = \hat{y} - y, \qquad \delta^{(l)} = \big(W^{(l+1)\mathsf T}\, \delta^{(l+1)}\big) \odot \varphi'\!\big(z^{(l)}\big), \qquad \frac{\partial L}{\partial W^{(l)}} = \delta^{(l)}\, a^{(l-1)\mathsf T}`}</TeX>
          <p>{t.back2}</p>
        </div>
      </Section>

      <Section id="gradcheck" title={t.checkTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.check1}</p>
        </div>
        <div className="mt-4">
          <GradCheck />
        </div>
      </Section>

      <Section id="pathologies" title={t.pathTitle}>
        <div className="prose-cv max-w-3xl">
          <ul>
            {t.pathList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="outlook" title={t.outTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.out1}</p>
        </div>
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">{t.codeTitle}</h3>
          <pre className="card overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-ink/85">{SNIPPET}</pre>
        </div>
      </Section>
    </div>
  )
}
