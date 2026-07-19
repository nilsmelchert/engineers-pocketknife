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
  mlpBackpropTrace,
  mlpEval,
  mlpGrad,
  mlpNeuron,
  mlpPredict,
  type ActKey,
  type AdamState,
  type Mlp,
} from '../lib/ml'
import { circlesData, makeGauss, moons, spirals, xorData, type LabeledPoint } from '../lib/stats'

const T = {
  en: {
    kicker: 'ML · Module 3',
    title: 'Neural Networks & Deep Learning',
    intro:
      'Logistic regression ended on a cliffhanger: its decision boundary is forever a straight line. The fix sounds almost too cheap - stack several logistic regressions and put a nonlinearity between them. That stack is a neural network, and on this page you will train real ones, live, on problems a line could never solve.',
    whyTitle: 'Why stacking works',
    why1: 'A single layer computes a weighted sum - a linear function. Stacking linear functions is pointless: the composition is still linear. The magic ingredient is the activation function squashed between layers: with it, each hidden neuron carves the plane with its own soft line, and the next layer combines those pieces into curves, islands, spirals - any shape, given enough neurons (the universal approximation theorem). XOR, the classic counterexample to linear models, needs exactly one hidden layer.',
    neuronTitle: 'Interactive: anatomy of one neuron',
    neuron1: 'One neuron = weighted sum + bias, pushed through an activation. The two weights tilt its response surface, the bias shifts it, the activation shapes the transition. Every hidden unit in the playground below is exactly this, nothing more.',
    actLabel: 'activation',
    playTitle: 'Interactive: the playground - train a network live',
    play1: 'A real multilayer perceptron, trained in your browser with mini-batch gradients and backprop - no library, the exact math of this module. Choose a dataset, shape the architecture, press play. The shading is the network’s current decision function; the diagram shows every weight (thickness = magnitude, cyan = positive, red = negative). Hover any hidden neuron to see the feature it has learned to detect.',
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
      'XOR with NO hidden layer is impossible - but you cannot even build that here; try the next best thing: 1 layer × 1 neuron. It fails. Two neurons: solved. That is the whole point of depth.',
      'Spiral, 2 × 8 tanh, Adam: watch the boundary curl itself around the arms within seconds. Switch to plain SGD and feel the difference.',
      'Train the spiral with ReLU and look at the boundary: piecewise-straight facets - you are literally seeing the folded linear pieces.',
      'Set the learning rate to maximum: the loss curve spikes and jumps - the overshooting you know from the optimization modules, now in 100 dimensions.',
    ],
    backTitle: 'Backpropagation: the chain rule, industrialized',
    back1: 'Training needs ∂L/∂w for every weight. Backprop computes all of them in one backward sweep: run the network forward, then propagate the error signal δ backward through the same connections, multiplying by local derivatives along the way - the chain rule, applied systematically:',
    back2: 'The cost of all gradients is about twice a forward pass - independent of the parameter count. This is the algorithmic miracle that makes deep learning affordable, and the same trick your autograd framework performs when you call loss.backward().',
    bpLabIntro: 'Watch every number. This tiny 2-3-2-1 network runs one training sample; step through the phases and see the forward pass fill the neurons left-to-right, then the error signal δ flow right-to-left, thickening each wire by the gradient it carries. Every formula above is shown here with its actual numbers substituted - the chain rule stops being abstract.',
    bpForward: 'Forward',
    bpBackward: 'Backward',
    bpPrev: 'Back',
    bpNext: 'Next',
    bpReset: 'Reset',
    bpShuffle: 'New weights',
    bpSample: 'sample',
    bpModeSweep: 'full sweep',
    bpModeChain: 'one weight',
    bpMode: 'mode',
    bpChainHint: 'Click any wire to trace one weight’s gradient through the chain rule.',
    bpChainPick: 'pick a weight',
    bpPhaseNames: {
      input: 'input x',
      z1: 'pre-activation z⁽¹⁾',
      a1: 'activation a⁽¹⁾',
      z2: 'pre-activation z⁽²⁾',
      a2: 'activation a⁽²⁾',
      z3: 'output logit z⁽³⁾',
      p: 'prediction ŷ',
      loss: 'loss L',
      d3: 'output error δ⁽³⁾',
      d2: 'hidden error δ⁽²⁾',
      d1: 'hidden error δ⁽¹⁾',
      grad: 'gradients ∂L/∂W',
    },
    bpLoss: 'loss L',
    bpPred: 'prediction ŷ',
    bpChainVal: '∂L/∂w for the picked weight',
    bpChainEq: 'chain rule at this weight',
    bpBpVal: 'backprop',
    bpFdVal: 'finite difference',
    bpMatch: 'match',
    bpMatchYes: '✓ identical',
    bpLegend: 'node fill = activation · red/cyan tint = δ sign · wire width = |∂L/∂w|',
    checkTitle: 'Interactive: trust but verify - gradient checking',
    check1: 'Is the backward pass right? Compare it against the definition of the derivative: nudge one weight by ±ε and difference the loss. The two numbers below come from a small fixed network: one via backprop, one via finite differences. Slide ε: too large and the truncation error of the approximation shows; too small and floating-point cancellation takes over. The sweet spot around 10⁻⁴ - 10⁻⁵ is where implementers of every deep-learning framework live.',
    checkEps: 'finite-difference ε',
    checkBp: '∂L/∂w (backprop)',
    checkFd: '∂L/∂w (finite diff.)',
    checkDiff: 'difference',
    pathTitle: 'Training pathologies - a field guide',
    pathList: [
      'Learning rate too high: loss oscillates or explodes (you saw it live above). Too low: loss creeps. The loss curve is your dashboard - read it.',
      'Overfitting: small data + big net memorizes. Weight decay (L2), early stopping, dropout and above all more data are the remedies; the diagnosis is module ML·1’s train/test gap.',
      'Dead ReLUs: a neuron pushed into the flat zero region stops learning forever (its gradient is 0). Leaky ReLU or smaller learning rates prevent it.',
      'Unscaled inputs: features on wildly different scales create the ill-conditioned valleys of module Vision·3. Normalize inputs; batch normalization extends the idea inside the network.',
    ],
    outTitle: 'From here to deep learning',
    out1: 'Everything past this page is architecture, not new principles. CNNs are MLPs with weight sharing across space (the right prior for images); transformers wire layers with attention (the right prior for sequences); billions of parameters change the engineering, not the math. Training is still: mini-batch, forward, backprop, Adam step - the exact loop running in the playground above, on more silicon.',
    codeTitle: 'The same network in PyTorch',
    appTitle: '🏭 In the real world: an end-of-line defect gate',
    appIntro:
      'At the end of a gearbox assembly line, every unit gets a 3-second test run while two sensors listen: vibration RMS and an acoustic peak level. Good units and three distinct defect types (imbalance, bearing damage, gear whine) form a pattern no straight line can separate - exactly the limitation that killed logistic regression one module ago. A small MLP trains live on 240 logged test runs and bends its boundary around the defect islands. But the plot managers look at is not the boundary - it is the two numbers on the right: false rejects (good units scrapped, pure cost) and false accepts (defects shipped, warranty claims). Move the gate threshold and feel the trade-off every quality engineer negotiates.',
    appTrain: 'Train',
    appPause: 'Pause',
    appReset: 'Reset',
    appThresh: 'gate threshold',
    appAcc: 'accuracy',
    appFa: 'false accepts (shipped defects)',
    appFr: 'false rejects (scrapped good)',
    appMapTitle: 'defect gate: amber = reject region, cyan = accept region · dots = 240 logged test runs',
    appWhere:
      'The same learned gate scores solder joints from AOI images, battery cells from formation curves, engine knock from ion currents, and credit-card swipes from purchase features - any accept/reject decision with nonlinear structure.',
  },
  de: {
    kicker: 'ML · Modul 3',
    title: 'Neuronale Netze & Deep Learning',
    intro:
      'Die logistische Regression endete mit einem Cliffhanger: Ihre Entscheidungsgrenze ist für immer eine Gerade. Die Lösung klingt fast zu billig - staple mehrere logistische Regressionen und setze eine Nichtlinearität dazwischen. Dieser Stapel ist ein neuronales Netz, und auf dieser Seite trainierst du echte davon, live, an Problemen, die keine Gerade je lösen könnte.',
    whyTitle: 'Warum Stapeln funktioniert',
    why1: 'Eine einzelne Schicht berechnet eine gewichtete Summe - eine lineare Funktion. Lineare Funktionen zu stapeln ist sinnlos: Die Komposition bleibt linear. Die magische Zutat ist die Aktivierungsfunktion zwischen den Schichten: Mit ihr schneidet jedes verborgene Neuron die Ebene mit seiner eigenen weichen Linie, und die nächste Schicht kombiniert diese Stücke zu Kurven, Inseln, Spiralen - jeder Form, bei genug Neuronen (Universal Approximation Theorem). XOR, das klassische Gegenbeispiel zu linearen Modellen, braucht genau eine verborgene Schicht.',
    neuronTitle: 'Interaktiv: Anatomie eines Neurons',
    neuron1: 'Ein Neuron = gewichtete Summe + Bias, durch eine Aktivierung gedrückt. Die beiden Gewichte kippen seine Antwortfläche, der Bias verschiebt sie, die Aktivierung formt den Übergang. Jede verborgene Einheit im Spielplatz unten ist exakt das, nicht mehr.',
    actLabel: 'Aktivierung',
    playTitle: 'Interaktiv: der Spielplatz - ein Netz live trainieren',
    play1: 'Ein echtes mehrschichtiges Perzeptron, in deinem Browser mit Mini-Batch-Gradienten und Backprop trainiert - keine Bibliothek, exakt die Mathematik dieses Moduls. Wähle einen Datensatz, forme die Architektur, drücke Play. Die Schattierung ist die aktuelle Entscheidungsfunktion des Netzes; das Diagramm zeigt jedes Gewicht (Dicke = Betrag, cyan = positiv, rot = negativ). Fahre über ein verborgenes Neuron, um das Merkmal zu sehen, das es zu erkennen gelernt hat.',
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
      'XOR ganz ohne verborgene Schicht ist unmöglich - das lässt sich hier nicht einmal bauen; probiere das Nächstbeste: 1 Schicht × 1 Neuron. Es scheitert. Zwei Neuronen: gelöst. Genau das ist der Sinn der Tiefe.',
      'Spirale, 2 × 8 tanh, Adam: Sieh zu, wie sich die Grenze binnen Sekunden um die Arme wickelt. Wechsle zu reinem SGD und spüre den Unterschied.',
      'Trainiere die Spirale mit ReLU und betrachte die Grenze: stückweise gerade Facetten - du siehst buchstäblich die gefalteten linearen Teile.',
      'Stelle die Lernrate auf Maximum: Die Verlustkurve zackt und springt - das Überschießen aus den Optimierungsmodulen, jetzt in 100 Dimensionen.',
    ],
    backTitle: 'Backpropagation: die Kettenregel, industrialisiert',
    back1: 'Training braucht ∂L/∂w für jedes Gewicht. Backprop berechnet alle in einem Rückwärtsdurchlauf: Netz vorwärts auswerten, dann das Fehlersignal δ rückwärts durch dieselben Verbindungen propagieren und unterwegs mit lokalen Ableitungen multiplizieren - die Kettenregel, systematisch angewandt:',
    back2: 'Alle Gradienten kosten etwa das Doppelte eines Vorwärtsdurchlaufs - unabhängig von der Parameterzahl. Das ist das algorithmische Wunder, das Deep Learning bezahlbar macht, und derselbe Trick, den dein Autograd-Framework bei loss.backward() ausführt.',
    bpLabIntro: 'Beobachte jede Zahl. Dieses winzige 2-3-2-1-Netz verarbeitet ein Trainingsbeispiel; schreite durch die Phasen und sieh, wie der Vorwärtsdurchlauf die Neuronen von links nach rechts füllt, dann das Fehlersignal δ von rechts nach links fließt und jede Leitung um den Gradienten verdickt, den sie trägt. Jede Formel oben wird hier mit ihren tatsächlichen Zahlen gezeigt - die Kettenregel hört auf, abstrakt zu sein.',
    bpForward: 'Vorwärts',
    bpBackward: 'Rückwärts',
    bpPrev: 'Zurück',
    bpNext: 'Weiter',
    bpReset: 'Zurücksetzen',
    bpShuffle: 'Neue Gewichte',
    bpSample: 'Beispiel',
    bpModeSweep: 'ganzer Durchlauf',
    bpModeChain: 'ein Gewicht',
    bpMode: 'Modus',
    bpChainHint: 'Klicke eine Leitung, um den Gradienten eines Gewichts durch die Kettenregel zu verfolgen.',
    bpChainPick: 'Gewicht wählen',
    bpPhaseNames: {
      input: 'Eingabe x',
      z1: 'Vor-Aktivierung z⁽¹⁾',
      a1: 'Aktivierung a⁽¹⁾',
      z2: 'Vor-Aktivierung z⁽²⁾',
      a2: 'Aktivierung a⁽²⁾',
      z3: 'Ausgabe-Logit z⁽³⁾',
      p: 'Vorhersage ŷ',
      loss: 'Verlust L',
      d3: 'Ausgabefehler δ⁽³⁾',
      d2: 'verdeckter Fehler δ⁽²⁾',
      d1: 'verdeckter Fehler δ⁽¹⁾',
      grad: 'Gradienten ∂L/∂W',
    },
    bpLoss: 'Verlust L',
    bpPred: 'Vorhersage ŷ',
    bpChainVal: '∂L/∂w für das gewählte Gewicht',
    bpChainEq: 'Kettenregel an diesem Gewicht',
    bpBpVal: 'Backprop',
    bpFdVal: 'finite Differenz',
    bpMatch: 'Übereinstimmung',
    bpMatchYes: '✓ identisch',
    bpLegend: 'Knotenfüllung = Aktivierung · rot/cyan = δ-Vorzeichen · Leitungsbreite = |∂L/∂w|',
    checkTitle: 'Interaktiv: Vertrauen ist gut - Gradient Checking',
    check1: 'Stimmt der Rückwärtsdurchlauf? Vergleiche ihn mit der Definition der Ableitung: Stupse ein Gewicht um ±ε an und differenziere den Verlust. Die beiden Zahlen unten stammen aus einem kleinen festen Netz: eine per Backprop, eine per finiter Differenz. Schiebe ε: zu groß, und der Abschneidefehler der Näherung zeigt sich; zu klein, und die Gleitkomma-Auslöschung übernimmt. Der Sweet Spot um 10⁻⁴ - 10⁻⁵ ist das Zuhause aller Framework-Entwickler.',
    checkEps: 'Finite-Differenzen-ε',
    checkBp: '∂L/∂w (Backprop)',
    checkFd: '∂L/∂w (finite Diff.)',
    checkDiff: 'Differenz',
    pathTitle: 'Trainingspathologien - ein Feldführer',
    pathList: [
      'Lernrate zu hoch: Der Verlust oszilliert oder explodiert (oben live zu sehen). Zu niedrig: Er kriecht. Die Verlustkurve ist dein Armaturenbrett - lies sie.',
      'Überanpassung: Wenig Daten + großes Netz lernt auswendig. Weight Decay (L2), Early Stopping, Dropout und vor allem mehr Daten helfen; die Diagnose ist die Train/Test-Lücke aus Modul ML·1.',
      'Tote ReLUs: Ein Neuron, das in die flache Nullzone gedrückt wurde, lernt nie wieder (sein Gradient ist 0). Leaky ReLU oder kleinere Lernraten verhindern das.',
      'Unskalierte Eingaben: Merkmale auf wild verschiedenen Skalen erzeugen die schlecht konditionierten Täler aus Modul Vision·3. Normalisiere die Eingaben; Batch-Normalisierung trägt die Idee ins Netzinnere.',
    ],
    outTitle: 'Von hier zu Deep Learning',
    out1: 'Alles jenseits dieser Seite ist Architektur, kein neues Prinzip. CNNs sind MLPs mit räumlich geteilten Gewichten (der richtige Prior für Bilder); Transformer verdrahten Schichten mit Attention (der richtige Prior für Sequenzen); Milliarden Parameter ändern das Engineering, nicht die Mathematik. Training bleibt: Mini-Batch, vorwärts, Backprop, Adam-Schritt - exakt die Schleife aus dem Spielplatz oben, auf mehr Silizium.',
    codeTitle: 'Dasselbe Netz in PyTorch',
    appTitle: '🏭 In der echten Welt: ein End-of-Line-Prüftor',
    appIntro:
      'Am Ende einer Getriebe-Montagelinie bekommt jede Einheit einen 3-Sekunden-Testlauf, während zwei Sensoren lauschen: Schwingungs-RMS und akustischer Spitzenpegel. Gute Einheiten und drei verschiedene Fehlerbilder (Unwucht, Lagerschaden, Zahneingriffspfeifen) bilden ein Muster, das keine Gerade trennen kann - genau die Grenze, an der die logistische Regression ein Modul zuvor gescheitert ist. Ein kleines MLP trainiert live auf 240 protokollierten Testläufen und biegt seine Grenze um die Fehlerinseln. Aber der Plot, auf den das Management schaut, ist nicht die Grenze - es sind die zwei Zahlen rechts: Falsch-Ausschuss (gute Einheiten verschrottet, reine Kosten) und Falsch-Durchlass (Defekte ausgeliefert, Garantiefälle). Verschiebe die Torschwelle und spüre den Kompromiss, den jeder Qualitätsingenieur aushandelt.',
    appTrain: 'Trainieren',
    appPause: 'Pause',
    appReset: 'Zurücksetzen',
    appThresh: 'Torschwelle',
    appAcc: 'Trefferquote',
    appFa: 'Falsch-Durchlass (ausgelieferte Defekte)',
    appFr: 'Falsch-Ausschuss (verschrottete gute)',
    appMapTitle: 'Prüftor: bernstein = Ausschuss-Region, cyan = Gut-Region · Punkte = 240 protokollierte Testläufe',
    appWhere:
      'Dasselbe gelernte Tor bewertet Lötstellen aus AOI-Bildern, Batteriezellen aus Formierungskurven, Motorklopfen aus Ionenströmen und Kreditkarten-Transaktionen aus Kaufmerkmalen - jede Gut/Schlecht-Entscheidung mit nichtlinearer Struktur.',
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

// ---------------------------------------------------------------- backprop visualizer

const BP_SIZES = [2, 3, 2, 1]
const BP_SAMPLES: { x: number[]; y: number }[] = [
  { x: [0.7, -0.5], y: 1 },
  { x: [-0.8, 0.4], y: 0 },
  { x: [0.3, 0.85], y: 1 },
]
type BpPhaseKey = 'input' | 'z1' | 'a1' | 'z2' | 'a2' | 'z3' | 'p' | 'loss' | 'd3' | 'd2' | 'd1' | 'grad'
const BP_PHASES: BpPhaseKey[] = ['input', 'z1', 'a1', 'z2', 'a2', 'z3', 'p', 'loss', 'd3', 'd2', 'd1', 'grad']
// which weight-layer's output activation each forward phase reveals (as index), and delta index for backward
const FWD_REVEAL: Partial<Record<BpPhaseKey, number>> = { input: 0, a1: 1, a2: 2, p: 3 }
const DELTA_REVEAL: Partial<Record<BpPhaseKey, number>> = { d3: 2, d2: 1, d1: 0 }

function BackpropLab() {
  const t = useT(T)
  const [seed, setSeed] = useState(3)
  const [sampleIdx, setSampleIdx] = useState(0)
  const [phase, setPhase] = useState(0)
  const [mode, setMode] = useState<'sweep' | 'chain'>('sweep')
  const [pick, setPick] = useState<{ l: number; i: number; j: number } | null>(null)

  const model = useMemo(() => createMlp(BP_SIZES, 'tanh', seed), [seed])
  const sample = BP_SAMPLES[sampleIdx]
  const tr = useMemo(() => mlpBackpropTrace(model, sample.x, sample.y), [model, sample])

  const ph = BP_PHASES[phase]
  const phaseNames = t.bpPhaseNames as Record<BpPhaseKey, string>
  const isBackward = phase >= 8
  // how far forward activations are revealed
  const revealAs = (() => {
    let r = -1
    for (let p = 0; p <= phase; p++) {
      const rv = FWD_REVEAL[BP_PHASES[p]]
      if (rv !== undefined) r = Math.max(r, rv)
    }
    return r
  })()
  const deltaShown = (l: number) => {
    for (let p = 8; p <= Math.min(phase, 10); p++) {
      if (DELTA_REVEAL[BP_PHASES[p]] === l) return true
    }
    return phase === 11
  }

  const DW = 520
  const DH = 300
  const nodeX = (l: number) => 40 + (l / (BP_SIZES.length - 1)) * (DW - 100)
  const nodeY = (l: number, i: number) => DH / 2 + (i - (BP_SIZES[l] - 1) / 2) * 56

  const maxGrad = Math.max(...tr.dW.flat(2).map(Math.abs), 1e-6)

  // finite-difference check for the picked weight
  const fdCheck = useMemo(() => {
    if (!pick) return null
    const bp = tr.dW[pick.l][pick.j][pick.i]
    const eps = 1e-4
    const perturbed = (d: number) => {
      const m2 = createMlp(BP_SIZES, 'tanh', seed)
      m2.W[pick.l][pick.j][pick.i] += d
      const p = mlpPredict(m2, sample.x)
      return -(sample.y * Math.log(p + 1e-9) + (1 - sample.y) * Math.log(1 - p + 1e-9))
    }
    const fd = (perturbed(eps) - perturbed(-eps)) / (2 * eps)
    return { bp, fd, deltaJ: tr.deltas[pick.l][pick.j], aI: tr.as[pick.l][pick.i] }
  }, [pick, tr, seed, sample])

  // formula panel with substituted numbers
  const formula = (() => {
    const f = (x: number) => fmt(x, 2)
    switch (ph) {
      case 'input':
        return String.raw`\mathbf{x} = (${f(sample.x[0])},\; ${f(sample.x[1])}), \qquad y = ${sample.y}`
      case 'z1':
      case 'z2':
      case 'z3': {
        const l = ph === 'z1' ? 0 : ph === 'z2' ? 1 : 2
        return String.raw`z^{(${l + 1})} = W^{(${l + 1})} a^{(${l})} + b = (${tr.zs[l].map(f).join(',\\; ')})`
      }
      case 'a1':
      case 'a2': {
        const l = ph === 'a1' ? 1 : 2
        return String.raw`a^{(${l})} = \tanh\!\big(z^{(${l})}\big) = (${tr.as[l].map(f).join(',\\; ')})`
      }
      case 'p':
        return String.raw`\hat{y} = \sigma\!\big(z^{(3)}\big) = ${f(tr.p)}`
      case 'loss':
        return String.raw`L = -\big[y\log\hat{y} + (1-y)\log(1-\hat{y})\big] = ${f(tr.loss)}`
      case 'd3':
        return String.raw`\delta^{(3)} = \hat{y} - y = ${f(tr.p)} - ${sample.y} = ${f(tr.deltas[2][0])}`
      case 'd2':
        return String.raw`\delta^{(2)} = \big(W^{(3)\mathsf T}\delta^{(3)}\big)\odot\tanh'\!\big(z^{(2)}\big) = (${tr.deltas[1].map(f).join(',\\; ')})`
      case 'd1':
        return String.raw`\delta^{(1)} = \big(W^{(2)\mathsf T}\delta^{(2)}\big)\odot\tanh'\!\big(z^{(1)}\big) = (${tr.deltas[0].map(f).join(',\\; ')})`
      case 'grad':
        return String.raw`\frac{\partial L}{\partial W^{(l)}_{ji}} = \delta^{(l)}_j\, a^{(l-1)}_i \quad\text{- every wire now carries its gradient}`
    }
  })()

  const nodeFill = (l: number, i: number): { fill: string; text: string } => {
    if (isBackward && l >= 1 && deltaShown(l - 1)) {
      const d = tr.deltas[l - 1][i]
      const mag = Math.min(Math.abs(d) * 2.5, 0.85)
      return { fill: d >= 0 ? `rgba(34,211,238,${mag})` : `rgba(248,113,113,${mag})`, text: fmt(d, 2) }
    }
    if (l <= revealAs) {
      const a = tr.as[l][i]
      const mag = Math.min(Math.abs(a) * 0.7, 0.8)
      return { fill: `rgba(167,139,250,${mag})`, text: fmt(a, 2) }
    }
    return { fill: 'rgba(255,255,255,0.05)', text: '' }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${DW} ${DH}`} className="block w-full">
          {/* edges */}
          {model.W.map((Wl, l) =>
            Wl.map((row, j) =>
              row.map((_, i) => {
                const g = tr.dW[l][j][i]
                const showGrad = phase === 11 || (mode === 'chain' && pick && pick.l === l && pick.i === i && pick.j === j)
                const picked = mode === 'chain' && pick && pick.l === l && pick.i === i && pick.j === j
                const width = showGrad ? 0.6 + (Math.abs(g) / maxGrad) * 5 : 1
                const color = picked ? '#fbbf24' : showGrad ? (g >= 0 ? 'rgba(34,211,238,0.7)' : 'rgba(248,113,113,0.7)') : 'rgba(255,255,255,0.12)'
                return (
                  <line
                    key={`${l}-${j}-${i}`}
                    x1={nodeX(l)}
                    y1={nodeY(l, i)}
                    x2={nodeX(l + 1)}
                    y2={nodeY(l + 1, j)}
                    stroke={color}
                    strokeWidth={width}
                    style={{ cursor: mode === 'chain' ? 'pointer' : 'default' }}
                    onClick={() => mode === 'chain' && setPick({ l, i, j })}
                  />
                )
              }),
            ),
          )}
          {/* nodes */}
          {BP_SIZES.map((n, l) =>
            Array.from({ length: n }, (_, i) => {
              const { fill, text } = nodeFill(l, i)
              return (
                <g key={`${l}-${i}`}>
                  <circle cx={nodeX(l)} cy={nodeY(l, i)} r={16} fill={fill} stroke="rgba(255,255,255,0.3)" strokeWidth={1.2} />
                  {text && (
                    <text x={nodeX(l)} y={nodeY(l, i) + 4} textAnchor="middle" fill="#e6eaf2" fontSize={11} fontFamily="JetBrains Mono, monospace">
                      {text}
                    </text>
                  )}
                </g>
              )
            }),
          )}
        </svg>
        <div className="border-t border-white/10 px-4 py-2 text-[12px] text-muted">{t.bpLegend}</div>
      </div>

      <div className="flex flex-col gap-3 self-start lg:col-span-2">
        {/* phase chips */}
        <div className="flex flex-wrap gap-1.5">
          {BP_PHASES.map((p, i) => (
            <button
              key={p}
              onClick={() => setPhase(i)}
              className={`rounded px-1.5 py-0.5 text-[10.5px] font-mono transition ${
                i === phase
                  ? 'bg-accent/25 text-accent'
                  : i < 8
                    ? 'bg-white/[0.04] text-muted hover:text-ink'
                    : 'bg-white/[0.04] text-muted hover:text-ink'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="text-[13px] font-semibold" style={{ color: isBackward ? '#22d3ee' : '#a78bfa' }}>
          {isBackward ? `◀ ${t.bpBackward}` : `${t.bpForward} ▶`} · {phaseNames[ph]}
        </div>
        <div className="card-pad overflow-x-auto">
          <TeX block>{formula ?? ''}</TeX>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => setPhase((p) => Math.max(0, p - 1))}>
            ◀ {t.bpPrev}
          </button>
          <button className="btn-primary" onClick={() => setPhase((p) => Math.min(BP_PHASES.length - 1, p + 1))}>
            {t.bpNext} ▶
          </button>
          <button className="btn" onClick={() => { setPhase(0); setPick(null) }}>
            ↺ {t.bpReset}
          </button>
          <button className="btn" onClick={() => { setSeed((s) => s + 1); setPhase(0); setPick(null) }}>
            🎲 {t.bpShuffle}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="mb-1 text-[11px] text-muted">{t.bpSample}</div>
            <Segmented
              options={BP_SAMPLES.map((_, i) => ({ value: `${i}`, label: `#${i + 1}` }))}
              value={`${sampleIdx}`}
              onChange={(v) => { setSampleIdx(Number(v)); setPhase(0); setPick(null) }}
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] text-muted">{t.bpMode}</div>
            <Segmented
              options={[
                { value: 'sweep', label: t.bpModeSweep },
                { value: 'chain', label: t.bpModeChain },
              ]}
              value={mode}
              onChange={(v) => setMode(v as 'sweep' | 'chain')}
            />
          </div>
        </div>
        {mode === 'chain' && (
          <div className="card-pad">
            {!fdCheck ? (
              <div className="text-[13px] text-muted">{t.bpChainHint}</div>
            ) : (
              <div className="space-y-2">
                <TeX block>{String.raw`\frac{\partial L}{\partial w} = \delta_j\, a_i = ${fmt(fdCheck.deltaJ, 3)}\cdot ${fmt(fdCheck.aI, 3)} = ${fmt(fdCheck.bp, 4)}`}</TeX>
                <div className="grid grid-cols-2 gap-2">
                  <Readout label={t.bpBpVal} value={fmt(fdCheck.bp, 4)} />
                  <Readout
                    label={t.bpFdVal}
                    value={fmt(fdCheck.fd, 4)}
                    accent={Math.abs(fdCheck.bp - fdCheck.fd) < 1e-4 ? '#4ade80' : '#fbbf24'}
                  />
                </div>
                <div className="text-[12px]" style={{ color: Math.abs(fdCheck.bp - fdCheck.fd) < 1e-4 ? '#4ade80' : '#fbbf24' }}>
                  {t.bpMatch}: {Math.abs(fdCheck.bp - fdCheck.fd) < 1e-4 ? t.bpMatchYes : `Δ ${fmt(Math.abs(fdCheck.bp - fdCheck.fd), 6)}`}
                </div>
              </div>
            )}
          </div>
        )}
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

// ---------------------------------------------------------------- application: defect gate

// features normalized to [-1.2, 1.2]: x = vibration RMS, y = acoustic peak. y-label 1 = defect
const GATE_DATA: { x: number[]; y: number }[] = (() => {
  const g = makeGauss(55)
  const pts: { x: number[]; y: number }[] = []
  for (let i = 0; i < 180; i++) pts.push({ x: [-0.25 + g() * 0.42, -0.25 + g() * 0.4], y: 0 })
  const islands: [number, number][] = [
    [0.75, 0.55], // imbalance
    [-0.7, 0.75], // bearing damage
    [0.65, -0.75], // gear whine
  ]
  for (const [cx2, cy2] of islands)
    for (let i = 0; i < 20; i++) pts.push({ x: [cx2 + g() * 0.12, cy2 + g() * 0.12], y: 1 })
  return pts
})()

function DefectGateLab() {
  const t = useT(T)
  const modelRef = useRef<Mlp>(createMlp([2, 8, 8, 1], 'tanh', 7))
  const adamRef = useRef<AdamState>(createAdamState(modelRef.current))
  const rngRef = useRef(mulberry32(99))
  const [running, setRunning] = useState(false)
  const [thresh, setThresh] = useState(0.5)
  const [tick, setTick] = useState(0)

  const reset = () => {
    setRunning(false)
    modelRef.current = createMlp([2, 8, 8, 1], 'tanh', 7)
    adamRef.current = createAdamState(modelRef.current)
    rngRef.current = mulberry32(99)
    setTick((x) => x + 1)
  }

  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => {
      const m = modelRef.current
      const rand = rngRef.current
      for (let s = 0; s < 12; s++) {
        const batch = Array.from({ length: 32 }, () => GATE_DATA[Math.floor(rand() * GATE_DATA.length)])
        applyAdam(m, mlpGrad(m, batch), adamRef.current, 0.01)
      }
      setTick((x) => x + 1)
    }, 50)
    return () => clearInterval(iv)
  }, [running])

  const m = modelRef.current
  const { fa, fr, acc } = useMemo(() => {
    let fa2 = 0
    let fr2 = 0
    let ok = 0
    for (const d of GATE_DATA) {
      const reject = mlpPredict(m, d.x) >= thresh
      if (d.y === 1 && !reject) fa2++
      if (d.y === 0 && reject) fr2++
      if ((d.y === 1) === reject) ok++
    }
    return { fa: fa2, fr: fr2, acc: ok / GATE_DATA.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, thresh])

  const GW = 440
  const GH = 400
  const D2 = 1.2
  const gx = (x: number) => ((x + D2) / (2 * D2)) * GW
  const gy = (y: number) => GH - ((y + D2) / (2 * D2)) * GH

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <ProbMap
          w={GW}
          h={GH}
          xr={[-D2, D2]}
          yr={[-D2, D2]}
          prob={(x, y) => mlpPredict(m, [x, y])}
          ckey={`gate-${tick}`}
          title={t.appMapTitle}
        >
          {GATE_DATA.map((d, i) => (
            <circle
              key={i}
              cx={gx(d.x[0])}
              cy={gy(d.x[1])}
              r={2.6}
              fill={d.y === 1 ? '#fbbf24cc' : '#22d3eecc'}
              stroke="#0a0e17"
              strokeWidth={0.7}
            />
          ))}
        </ProbMap>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setRunning((r) => !r)}>
              {running ? `⏸ ${t.appPause}` : `▶ ${t.appTrain}`}
            </button>
            <button className="btn" onClick={reset}>
              ↺ {t.appReset}
            </button>
          </div>
          <Slider label={t.appThresh} value={thresh} min={0.1} max={0.9} step={0.01} onChange={setThresh} format={(v) => fmt(v, 2)} />
        </div>
        <div className="grid grid-cols-1 gap-3">
          <Readout label={t.appAcc} value={`${fmt(acc * 100, 1)} %`} accent={acc > 0.95 ? '#4ade80' : undefined} />
          <Readout label={t.appFa} value={`${fa} / 60`} accent={fa === 0 ? '#4ade80' : '#f87171'} />
          <Readout label={t.appFr} value={`${fr} / 180`} accent={fr === 0 ? '#4ade80' : '#fbbf24'} />
        </div>
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
          { id: 'application', label: t.appTitle },
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
          <p>{t.bpLabIntro}</p>
        </div>
        <div className="mt-4">
          <BackpropLab />
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

      <Section id="application" title={t.appTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.appIntro}</p>
        </div>
        <div className="mt-4">
          <DefectGateLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
