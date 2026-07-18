import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { Derivation } from '../components/Derivation'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import { fmt, mulberry32 } from '../lib/math'
import {
  attentionMatrix,
  conv2d,
  KERNELS,
  makeTestImage,
  maxPool2,
  reluImg,
  TOKENS,
} from '../lib/dl'

const T = {
  en: {
    kicker: 'ML · Module 4',
    title: 'Modern Deep Learning: CNNs & Transformers',
    intro:
      'The MLP playground of the previous module could learn any 2D boundary — but feed it a megapixel image and it drowns: it has no idea that pixel (10,10) and pixel (11,10) are neighbors. Modern deep learning is the art of building knowledge about the data into the wiring itself. Two architectures carried the field: convolutional networks for grids, transformers for sequences — and by now, for nearly everything.',
    biasTitle: 'Inductive bias: knowledge in the wiring',
    bias1: 'A fully connected layer from a 48×48 image to a 48×48 feature map needs 2304² ≈ 5.3 million weights — and after learning, most of them would rediscover the same fact over and over: nearby pixels matter, far ones rarely do, and a cat in the top-left corner is the same cat as in the bottom-right. An architecture that hard-codes these facts needs radically fewer parameters and radically less data. That is inductive bias — the central design idea of this module.',
    cnnTitle: 'Interactive: the convolution layer',
    cnn1: 'A convolution slides one tiny weight grid — here 3×3, nine numbers — across the whole image (the 1D version of this sliding lives in the Fourier module). Every output pixel is the same weighted sum of its neighborhood. Pick a kernel and watch what those nine numbers detect: vertical edges, horizontal edges, texture. Then switch to custom and design your own with the sliders. ReLU keeps only positive evidence; max-pooling summarizes 2×2 blocks, making the representation smaller and more tolerant to small shifts.',
    kernelLabel: 'kernel',
    kernelNames: { edgeX: 'edge ↕', edgeY: 'edge ↔', sharpen: 'sharpen', blur: 'blur', emboss: 'emboss', custom: 'custom' },
    reluLabel: 'apply ReLU',
    input: 'input 48×48',
    convOut: 'after convolution',
    poolOut: 'after 2×2 max-pool',
    cnnDerivTitle: 'Convolution as a shared-weight layer',
    cnnDeriv: [
      { tex: String.raw`y_{ij} \;=\; \varphi\Big(\sum_{u=-1}^{1}\sum_{v=-1}^{1} w_{uv}\, x_{i+u,\,j+v} \;+\; b\Big)`, note: 'The nine wᵤᵥ are exactly the nine sliders of the custom kernel — the SAME nine numbers for every output position (i, j).' },
      { tex: String.raw`\text{dense: } 2304 \times 2304 \approx 5.3\text{M weights} \qquad \text{conv: } 9 + 1`, note: 'Weight sharing slashes parameters by six orders of magnitude and guarantees translation equivariance: shift the input, the feature map shifts along.' },
      { tex: String.raw`\text{receptive field grows with depth: } 3 \to 5 \to 7 \to \dots`, note: 'Stacked small kernels see ever larger neighborhoods — which is why deep CNNs can recognize whole objects with only 3×3 kernels.' },
    ],
    hierTitle: 'Feature hierarchies: what depth buys',
    hier1: 'One layer detects edges. The next layer sees edge maps as its input — so its kernels detect combinations of edges: corners, bars, blobs. Below, a fixed two-stage pipeline: four oriented edge detectors, ReLU, pooling, then two hand-built second-layer combinations. In a trained CNN nothing here is hand-built: backprop (module ML·3) learns every kernel, and visualizing them shows exactly this hierarchy — edges → textures → parts → objects.',
    l1Label: 'layer 1: oriented edges (after ReLU + pool)',
    l2Label: 'layer 2: combinations',
    l2Names: ['edge energy', 'corner response'],
    attTitle: 'Interactive: self-attention',
    att1: 'Transformers process sequences of tokens — words, image patches, audio frames. Their core operation lets every token look at every other token and decide, per pair, how relevant it is: attention. Each token emits a query ("what am I looking for?") and a key ("what do I offer?"); the dot product of query and key becomes a relevance score, softmax turns each row of scores into weights, and every token rebuilds itself as a weighted mix of value vectors. Hover the tokens: "picks" attends to its subject and object, "red" leans toward "cube".',
    att2: 'Two controls to build intuition: the causal mask (used in language models) forbids looking at future tokens — the upper triangle dies. The sharpness slider scales the logits: this is exactly the 1/√d factor of the formula, and the derivation below explains why it must be there.',
    causal: 'causal mask (GPT-style)',
    sharp: 'logit scale (·1/√d)',
    rowSum: 'row sum (softmax)',
    attDerivTitle: 'The attention formula, piece by piece',
    attDeriv: [
      { tex: String.raw`\mathbf{q}_i = W_Q \mathbf{x}_i, \qquad \mathbf{k}_j = W_K \mathbf{x}_j, \qquad \mathbf{v}_j = W_V \mathbf{x}_j`, note: 'Three learned projections of the same embeddings — the only trainable parts. In the demo they are fixed matrices.' },
      { tex: String.raw`A_{ij} \;=\; \operatorname{softmax}_j\!\left(\frac{\mathbf{q}_i \cdot \mathbf{k}_j}{\sqrt{d}}\right)`, note: 'Each row of the heatmap: how much token i attends to token j. Rows sum to 1 — check the readout.' },
      { tex: String.raw`\operatorname{Var}(\mathbf{q}\cdot\mathbf{k}) \propto d \quad\Rightarrow\quad \text{divide by } \sqrt{d}`, note: 'Dot products grow with dimension; without the √d the softmax saturates into one-hot rows and gradients vanish. The sharpness slider IS this factor — push it up and watch the rows harden.' },
      { tex: String.raw`\mathbf{z}_i \;=\; \sum_j A_{ij}\, \mathbf{v}_j`, note: 'The output: every token becomes a relevance-weighted mixture of all value vectors — content-dependent routing, computed fresh for every input.' },
    ],
    anatomyTitle: 'Anatomy of a transformer block',
    anatomy1: 'A full transformer stacks a simple block many times: attention (tokens exchange information) followed by a small MLP (each token thinks alone), both wrapped in residual connections and normalization to keep hundreds of layers trainable. Since attention itself is order-blind, position is injected explicitly — classically with sinusoids of different frequencies (below), a direct cousin of the Fourier module.',
    diagram: { tokens: 'tokens', embed: 'embedding + position', attn: 'multi-head attention', norm1: 'add & norm', mlp: 'MLP', norm2: 'add & norm', out: 'output', repeat: '× L layers' },
    posencLabel: 'sinusoidal positional encoding (4 of d dimensions)',
    compTitle: 'Choosing an architecture',
    compHead: ['', 'MLP', 'CNN', 'Transformer'],
    compRows: [
      ['inductive bias', 'none', 'locality + translation', 'none about order (added via positions)'],
      ['weight sharing', 'no', 'across space', 'across sequence positions'],
      ['data appetite', 'high per parameter', 'modest — bias helps', 'huge — bias must be learned'],
      ['shines at', 'small tabular problems', 'images, audio, sensor grids', 'language, long-range structure, everything at scale'],
    ],
    scaleTitle: 'Scale, transfer, and where this meets the rest of the site',
    scaleList: [
      'Training has not changed: mini-batch SGD/Adam (module ML·2) plus backprop (ML·3) — just on billions of parameters, which is precisely why the second-order methods of the Vision track are absent here.',
      'Transfer learning is the practical superpower: a network pretrained on huge data is fine-tuned on your small dataset. For most engineering vision tasks you should start from a pretrained backbone, never from scratch.',
      'Vision transformers (ViT) cut images into patch tokens and apply exactly the attention above — CNNs and transformers have converged into one toolbox.',
      'Scaling laws: loss falls predictably with parameters, data and compute — the empirical engine behind today’s foundation models.',
    ],
    codeTitle: 'In practice',
    appTitle: '🏭 In the real world: scratch detection on brushed metal',
    appIntro:
      'A surface-inspection camera stares at brushed stainless steel all day. The brushing texture is pure horizontal structure — and the defects are faint diagonal scratches hiding inside it. This is why convolution kernels are the right prior for images: an oriented edge filter responds to gradients in ONE direction, so the right kernel sees the scratches and is blind to the texture, exactly like the first layer of a trained CNN (which learns these filters by itself). Try the wrong orientation: the horizontal-edge kernel drowns in the brushing and floods the image with false positives — no threshold can save it. Then switch to the diagonal kernel and watch the scratches pop out of a quiet background.',
    appKernel: 'filter orientation',
    appKernelNames: ['horizontal edges', 'diagonal edges', 'vertical edges'],
    appThresh: 'detection threshold',
    appInput: 'camera image (brushed metal + 2 scratches)',
    appResp: 'conv → ReLU → threshold',
    appHits: 'scratch pixels found',
    appFp: 'false positives',
    appWhere:
      'The same conv-ReLU-threshold pipeline (with learned kernels) inspects textile weave, battery-foil coating, glass panels and solar wafers at full line speed — and its learned big brother is the first layer of every vision model in production.',
  },
  de: {
    kicker: 'ML · Modul 4',
    title: 'Modernes Deep Learning: CNNs & Transformer',
    intro:
      'Der MLP-Spielplatz des vorigen Moduls konnte jede 2D-Grenze lernen — aber gib ihm ein Megapixelbild, und er ertrinkt: Er hat keine Ahnung, dass Pixel (10,10) und Pixel (11,10) Nachbarn sind. Modernes Deep Learning ist die Kunst, Wissen über die Daten in die Verdrahtung selbst einzubauen. Zwei Architekturen trugen das Feld: Faltungsnetze für Gitter, Transformer für Sequenzen — und inzwischen für fast alles.',
    biasTitle: 'Induktiver Bias: Wissen in der Verdrahtung',
    bias1: 'Eine vollverbundene Schicht von einem 48×48-Bild zu einer 48×48-Merkmalskarte braucht 2304² ≈ 5,3 Millionen Gewichte — und nach dem Lernen hätten die meisten dieselbe Tatsache immer wieder neu entdeckt: Nahe Pixel zählen, ferne selten, und eine Katze oben links ist dieselbe Katze wie unten rechts. Eine Architektur, die diese Fakten fest verdrahtet, braucht radikal weniger Parameter und radikal weniger Daten. Das ist induktiver Bias — die zentrale Entwurfsidee dieses Moduls.',
    cnnTitle: 'Interaktiv: die Faltungsschicht',
    cnn1: 'Eine Faltung schiebt ein winziges Gewichtsgitter — hier 3×3, neun Zahlen — über das ganze Bild (die 1D-Version dieses Schiebens wohnt im Fourier-Modul). Jedes Ausgabepixel ist dieselbe gewichtete Summe seiner Nachbarschaft. Wähle einen Kern und sieh, was diese neun Zahlen detektieren: vertikale Kanten, horizontale Kanten, Textur. Wechsle dann auf „eigen“ und entwirf mit den Slidern deinen eigenen. ReLU behält nur positive Evidenz; Max-Pooling fasst 2×2-Blöcke zusammen — kleiner und toleranter gegen kleine Verschiebungen.',
    kernelLabel: 'Kern',
    kernelNames: { edgeX: 'Kante ↕', edgeY: 'Kante ↔', sharpen: 'Schärfen', blur: 'Weichzeichnen', emboss: 'Relief', custom: 'eigen' },
    reluLabel: 'ReLU anwenden',
    input: 'Eingabe 48×48',
    convOut: 'nach Faltung',
    poolOut: 'nach 2×2-Max-Pooling',
    cnnDerivTitle: 'Faltung als Schicht mit geteilten Gewichten',
    cnnDeriv: [
      { tex: String.raw`y_{ij} \;=\; \varphi\Big(\sum_{u=-1}^{1}\sum_{v=-1}^{1} w_{uv}\, x_{i+u,\,j+v} \;+\; b\Big)`, note: 'Die neun wᵤᵥ sind exakt die neun Slider des eigenen Kerns — DIESELBEN neun Zahlen für jede Ausgabeposition (i, j).' },
      { tex: String.raw`\text{dicht: } 2304 \times 2304 \approx 5{,}3\text{M Gewichte} \qquad \text{Faltung: } 9 + 1`, note: 'Gewichtsteilung spart sechs Größenordnungen an Parametern und garantiert Translationsäquivarianz: Verschiebt man die Eingabe, verschiebt sich die Merkmalskarte mit.' },
      { tex: String.raw`\text{rezeptives Feld wächst mit der Tiefe: } 3 \to 5 \to 7 \to \dots`, note: 'Gestapelte kleine Kerne sehen immer größere Nachbarschaften — deshalb erkennen tiefe CNNs ganze Objekte mit nur 3×3-Kernen.' },
    ],
    hierTitle: 'Merkmalshierarchien: was Tiefe kauft',
    hier1: 'Eine Schicht detektiert Kanten. Die nächste Schicht sieht Kantenkarten als Eingabe — ihre Kerne detektieren also Kombinationen von Kanten: Ecken, Balken, Kleckse. Unten eine feste zweistufige Pipeline: vier orientierte Kantendetektoren, ReLU, Pooling, dann zwei handgebaute Kombinationen der zweiten Schicht. In einem trainierten CNN ist hier nichts handgebaut: Backprop (Modul ML·3) lernt jeden Kern, und ihre Visualisierung zeigt genau diese Hierarchie — Kanten → Texturen → Teile → Objekte.',
    l1Label: 'Schicht 1: orientierte Kanten (nach ReLU + Pooling)',
    l2Label: 'Schicht 2: Kombinationen',
    l2Names: ['Kantenenergie', 'Eckenantwort'],
    attTitle: 'Interaktiv: Self-Attention',
    att1: 'Transformer verarbeiten Sequenzen von Tokens — Wörter, Bildkacheln, Audiofenster. Ihre Kernoperation lässt jedes Token auf jedes andere blicken und pro Paar entscheiden, wie relevant es ist: Attention. Jedes Token sendet eine Query („wonach suche ich?“) und einen Key („was biete ich?“); das Skalarprodukt von Query und Key wird ein Relevanzwert, Softmax macht aus jeder Zeile Gewichte, und jedes Token baut sich als gewichtete Mischung der Value-Vektoren neu zusammen. Fahre über die Tokens: „picks“ achtet auf Subjekt und Objekt, „red“ neigt zu „cube“.',
    att2: 'Zwei Regler für die Intuition: Die kausale Maske (in Sprachmodellen) verbietet den Blick auf zukünftige Tokens — das obere Dreieck stirbt. Der Schärfe-Slider skaliert die Logits: Das ist exakt der 1/√d-Faktor der Formel, und die Herleitung unten erklärt, warum er dort stehen muss.',
    causal: 'kausale Maske (GPT-Stil)',
    sharp: 'Logit-Skala (·1/√d)',
    rowSum: 'Zeilensumme (Softmax)',
    attDerivTitle: 'Die Attention-Formel, Stück für Stück',
    attDeriv: [
      { tex: String.raw`\mathbf{q}_i = W_Q \mathbf{x}_i, \qquad \mathbf{k}_j = W_K \mathbf{x}_j, \qquad \mathbf{v}_j = W_V \mathbf{x}_j`, note: 'Drei gelernte Projektionen derselben Embeddings — die einzigen trainierbaren Teile. In der Demo sind sie feste Matrizen.' },
      { tex: String.raw`A_{ij} \;=\; \operatorname{softmax}_j\!\left(\frac{\mathbf{q}_i \cdot \mathbf{k}_j}{\sqrt{d}}\right)`, note: 'Jede Zeile der Heatmap: wie stark Token i auf Token j achtet. Zeilen summieren zu 1 — prüfe das Readout.' },
      { tex: String.raw`\operatorname{Var}(\mathbf{q}\cdot\mathbf{k}) \propto d \quad\Rightarrow\quad \text{Division durch } \sqrt{d}`, note: 'Skalarprodukte wachsen mit der Dimension; ohne das √d sättigt die Softmax zu One-Hot-Zeilen und die Gradienten verschwinden. Der Schärfe-Slider IST dieser Faktor — dreh ihn hoch und sieh die Zeilen verhärten.' },
      { tex: String.raw`\mathbf{z}_i \;=\; \sum_j A_{ij}\, \mathbf{v}_j`, note: 'Die Ausgabe: Jedes Token wird eine relevanzgewichtete Mischung aller Value-Vektoren — inhaltsabhängiges Routing, für jede Eingabe neu berechnet.' },
    ],
    anatomyTitle: 'Anatomie eines Transformer-Blocks',
    anatomy1: 'Ein voller Transformer stapelt einen einfachen Block viele Male: Attention (Tokens tauschen Information aus), gefolgt von einem kleinen MLP (jedes Token denkt allein), beides in Residualverbindungen und Normalisierung verpackt, damit hunderte Schichten trainierbar bleiben. Da Attention selbst reihenfolgeblind ist, wird Position explizit injiziert — klassisch mit Sinuskurven verschiedener Frequenzen (unten), ein direkter Verwandter des Fourier-Moduls.',
    diagram: { tokens: 'Tokens', embed: 'Embedding + Position', attn: 'Multi-Head-Attention', norm1: 'Add & Norm', mlp: 'MLP', norm2: 'Add & Norm', out: 'Ausgabe', repeat: '× L Schichten' },
    posencLabel: 'sinusförmige Positionskodierung (4 von d Dimensionen)',
    compTitle: 'Die Architekturwahl',
    compHead: ['', 'MLP', 'CNN', 'Transformer'],
    compRows: [
      ['induktiver Bias', 'keiner', 'Lokalität + Translation', 'keiner über Reihenfolge (Position wird addiert)'],
      ['Gewichtsteilung', 'nein', 'über den Raum', 'über Sequenzpositionen'],
      ['Datenhunger', 'hoch pro Parameter', 'moderat — der Bias hilft', 'riesig — der Bias muss gelernt werden'],
      ['glänzt bei', 'kleinen tabellarischen Problemen', 'Bildern, Audio, Sensorgittern', 'Sprache, weitreichender Struktur, allem im großen Maßstab'],
    ],
    scaleTitle: 'Skalierung, Transfer und die Verbindung zum Rest der Seite',
    scaleList: [
      'Das Training hat sich nicht geändert: Mini-Batch-SGD/Adam (Modul ML·2) plus Backprop (ML·3) — nur auf Milliarden Parametern, was genau der Grund ist, warum die Verfahren zweiter Ordnung des Vision-Tracks hier fehlen.',
      'Transferlernen ist die praktische Superkraft: Ein auf riesigen Daten vortrainiertes Netz wird auf deinem kleinen Datensatz feinjustiert. Für die meisten Vision-Aufgaben im Ingenieuralltag startet man von einem vortrainierten Backbone, nie bei null.',
      'Vision Transformer (ViT) schneiden Bilder in Kachel-Tokens und wenden exakt die obige Attention an — CNNs und Transformer sind zu einem Werkzeugkasten verschmolzen.',
      'Skalierungsgesetze: Der Verlust fällt vorhersagbar mit Parametern, Daten und Rechenleistung — der empirische Motor hinter den heutigen Foundation-Modellen.',
    ],
    codeTitle: 'In der Praxis',
    appTitle: '🏭 In der echten Welt: Kratzererkennung auf gebürstetem Metall',
    appIntro:
      'Eine Oberflächeninspektionskamera starrt den ganzen Tag auf gebürsteten Edelstahl. Die Bürsttextur ist reine Horizontalstruktur — und die Defekte sind schwache diagonale Kratzer, die sich darin verstecken. Genau deshalb sind Faltungskerne der richtige Prior für Bilder: Ein orientierter Kantenfilter reagiert auf Gradienten in EINER Richtung, also sieht der richtige Kern die Kratzer und ist blind für die Textur — exakt wie die erste Schicht eines trainierten CNN (das diese Filter von selbst lernt). Probiere die falsche Orientierung: Der Horizontalkanten-Kern ertrinkt in der Bürstung und flutet das Bild mit Fehlalarmen — keine Schwelle rettet ihn. Wechsle dann zum Diagonalkern und sieh die Kratzer aus einem ruhigen Hintergrund springen.',
    appKernel: 'Filterorientierung',
    appKernelNames: ['horizontale Kanten', 'diagonale Kanten', 'vertikale Kanten'],
    appThresh: 'Detektionsschwelle',
    appInput: 'Kamerabild (gebürstetes Metall + 2 Kratzer)',
    appResp: 'Conv → ReLU → Schwelle',
    appHits: 'gefundene Kratzerpixel',
    appFp: 'Fehlalarme',
    appWhere:
      'Dieselbe Conv-ReLU-Schwellen-Pipeline (mit gelernten Kernen) inspiziert Textilgewebe, Batteriefolien-Beschichtung, Glasscheiben und Solarwafer bei voller Liniengeschwindigkeit — und ihr gelernter großer Bruder ist die erste Schicht jedes Vision-Modells in Produktion.',
  },
}

const SNIPPET = `import torch.nn as nn

cnn = nn.Sequential(                     # images: convolution stack
    nn.Conv2d(3, 32, kernel_size=3, padding=1), nn.ReLU(),
    nn.MaxPool2d(2),
    nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(),
    nn.AdaptiveAvgPool2d(1), nn.Flatten(),
    nn.Linear(64, 10))

block = nn.TransformerEncoderLayer(      # sequences: attention block
    d_model=256, nhead=8, dim_feedforward=1024, batch_first=True)
encoder = nn.TransformerEncoder(block, num_layers=6)`

// ---------------------------------------------------------------- canvases

function MapCanvas({ img, title, signed = false }: { img: number[][]; title?: string; signed?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const H = img.length
    const W = img[0].length
    let mx = 1e-9
    for (const row of img) for (const v of row) mx = Math.max(mx, Math.abs(v))
    const data = ctx.createImageData(W, H)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const p = (y * W + x) * 4
        if (signed) {
          const v = img[y][x] / mx
          data.data[p] = v < 0 ? Math.round(-v * 240) : 0
          data.data[p + 1] = Math.round(Math.abs(v) * 60)
          data.data[p + 2] = v > 0 ? Math.round(v * 240) : 0
        } else {
          const v = Math.round(Math.min(1, Math.max(0, img[y][x] / (mx > 1 ? mx : 1))) * 255)
          data.data[p] = v
          data.data[p + 1] = v
          data.data[p + 2] = v
        }
        data.data[p + 3] = 255
      }
    ctx.putImageData(data, 0, 0)
  }, [img, signed])
  return (
    <div className="card overflow-hidden">
      {title && (
        <div className="border-b border-white/10 px-2.5 py-1 text-[11px] font-medium text-muted">{title}</div>
      )}
      <canvas ref={ref} width={img[0].length} height={img.length} className="block w-full" style={{ imageRendering: 'pixelated' }} />
    </div>
  )
}

// ---------------------------------------------------------------- CNN lab

type KKey = 'edgeX' | 'edgeY' | 'sharpen' | 'blur' | 'emboss' | 'custom'

function CnnLab() {
  const t = useT(T)
  const [kkey, setKkey] = useState<KKey>('edgeX')
  const [custom, setCustom] = useState<number[]>([0, -1, 0, -1, 4, -1, 0, -1, 0])
  const [relu, setRelu] = useState(true)

  const input = useMemo(makeTestImage, [])
  const kernel = useMemo(() => {
    if (kkey === 'custom')
      return [custom.slice(0, 3), custom.slice(3, 6), custom.slice(6, 9)]
    return KERNELS[kkey]
  }, [kkey, custom])

  const conv = useMemo(() => {
    const c = conv2d(input, kernel)
    return relu ? reluImg(c) : c
  }, [input, kernel, relu])
  const pooled = useMemo(() => maxPool2(conv), [conv])

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        <MapCanvas img={input} title={t.input} />
        <MapCanvas img={conv} title={t.convOut} signed={!relu} />
        <MapCanvas img={pooled} title={t.poolOut} signed={!relu} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card-pad space-y-3.5">
          <Segmented<KKey>
            options={(['edgeX', 'edgeY', 'sharpen', 'blur', 'emboss', 'custom'] as KKey[]).map((k) => ({
              value: k,
              label: t.kernelNames[k],
            }))}
            value={kkey}
            onChange={setKkey}
          />
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-muted select-none">
            <input type="checkbox" checked={relu} onChange={(e) => setRelu(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
            {t.reluLabel}
          </label>
        </div>
        <div className="card-pad">
          {kkey === 'custom' ? (
            <div className="grid max-w-xs grid-cols-3 gap-2">
              {custom.map((v, i) => (
                <div key={i}>
                  <input
                    type="range"
                    min={-2}
                    max={2}
                    step={0.1}
                    value={v}
                    onChange={(e) => {
                      const next = [...custom]
                      next[i] = Number(e.target.value)
                      setCustom(next)
                    }}
                  />
                  <div className="text-center font-mono text-[11px] text-accent">{fmt(v, 1)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid max-w-[180px] grid-cols-3 gap-1.5">
              {kernel.flat().map((v, i) => (
                <div key={i} className="rounded-md border border-white/10 bg-black/30 py-1.5 text-center font-mono text-[13px] text-accent">
                  {fmt(v, 2)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- feature hierarchy

function HierarchyLab() {
  const t = useT(T)
  const input = useMemo(makeTestImage, [])
  const { l1, l2 } = useMemo(() => {
    const ks = [KERNELS.edgeX, KERNELS.edgeY, KERNELS.diag1, KERNELS.diag1.map((r) => [...r].reverse())]
    const l1 = ks.map((k) => maxPool2(reluImg(conv2d(input, k))))
    const energy = l1[0].map((row, y) => row.map((v, x) => v + l1[1][y][x]))
    const corner = l1[0].map((row, y) => row.map((v, x) => Math.sqrt(Math.abs(v * l1[1][y][x]))))
    const l2 = [maxPool2(energy), maxPool2(corner)]
    return { l1, l2 }
  }, [input])

  return (
    <div className="grid gap-4 lg:grid-cols-7">
      <div className="lg:col-span-1">
        <MapCanvas img={input} title={t.input} />
      </div>
      <div className="lg:col-span-4">
        <div className="mb-1.5 text-[12px] font-medium text-muted">{t.l1Label}</div>
        <div className="grid grid-cols-4 gap-2">
          {l1.map((m, i) => (
            <MapCanvas key={i} img={m} />
          ))}
        </div>
      </div>
      <div className="lg:col-span-2">
        <div className="mb-1.5 text-[12px] font-medium text-muted">{t.l2Label}</div>
        <div className="grid grid-cols-2 gap-2">
          {l2.map((m, i) => (
            <MapCanvas key={i} img={m} title={t.l2Names[i]} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- attention lab

function AttentionLab() {
  const t = useT(T)
  const [causal, setCausal] = useState(false)
  const [sharp, setSharp] = useState(1)
  const [hover, setHover] = useState<number | null>(null)

  const A = useMemo(() => attentionMatrix(sharp, causal), [sharp, causal])
  const n = TOKENS.length

  const AW = 560
  const arcY = 70
  const tokX = (i: number) => 60 + (i / (n - 1)) * (AW - 120)

  const CELL = 54
  const HX = 120
  const HY = 30

  const rowSum = hover !== null ? A[hover].reduce((a, b) => a + b, 0) : 1

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="flex flex-col gap-3 lg:col-span-3">
        {/* sentence with attention arcs for the hovered token */}
        <div className="card overflow-hidden">
          <svg viewBox={`0 0 ${AW} 120`} className="block w-full">
            {hover !== null &&
              A[hover].map((w, j) => {
                if (j === hover || w < 0.01) return null
                const x1 = tokX(hover)
                const x2 = tokX(j)
                return (
                  <path
                    key={j}
                    d={`M ${x1} ${arcY} Q ${(x1 + x2) / 2} ${arcY - 55 - Math.abs(x2 - x1) * 0.1} ${x2} ${arcY}`}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth={Math.max(w * 9, 0.6)}
                    opacity={Math.min(0.25 + w * 1.6, 1)}
                  />
                )
              })}
            {TOKENS.map((tok, i) => (
              <g key={i} onMouseEnter={() => setHover(i)} className="cursor-pointer">
                <rect
                  x={tokX(i) - 26}
                  y={arcY}
                  width={52}
                  height={26}
                  rx={7}
                  fill={hover === i ? 'rgba(34,211,238,0.25)' : 'rgba(255,255,255,0.06)'}
                  stroke={hover === i ? '#22d3ee' : 'rgba(255,255,255,0.2)'}
                />
                <text x={tokX(i)} y={arcY + 17} textAnchor="middle" fill="#e6eaf2" fontSize={13} fontFamily="JetBrains Mono, monospace">
                  {tok}
                </text>
              </g>
            ))}
          </svg>
        </div>
        {/* attention matrix heatmap */}
        <div className="card overflow-hidden p-2">
          <svg viewBox={`0 0 ${HX + n * CELL + 10} ${HY + n * CELL + 10}`} className="mx-auto block max-w-md" onMouseLeave={() => setHover(null)}>
            {TOKENS.map((tok, j) => (
              <text key={`c${j}`} x={HX + j * CELL + CELL / 2} y={HY - 8} textAnchor="middle" fill="#8b93a7" fontSize={12} fontFamily="JetBrains Mono, monospace">
                {tok}
              </text>
            ))}
            {TOKENS.map((tok, i) => (
              <text key={`r${i}`} x={HX - 8} y={HY + i * CELL + CELL / 2 + 4} textAnchor="end" fill={hover === i ? '#22d3ee' : '#8b93a7'} fontSize={12} fontFamily="JetBrains Mono, monospace">
                {tok}
              </text>
            ))}
            {A.map((row, i) =>
              row.map((w, j) => (
                <g key={`${i}-${j}`} onMouseEnter={() => setHover(i)}>
                  <rect
                    x={HX + j * CELL + 2}
                    y={HY + i * CELL + 2}
                    width={CELL - 4}
                    height={CELL - 4}
                    rx={5}
                    fill={`rgba(34,211,238,${w * 0.85})`}
                    stroke={hover === i ? 'rgba(34,211,238,0.6)' : 'rgba(255,255,255,0.08)'}
                  />
                  <text x={HX + j * CELL + CELL / 2} y={HY + i * CELL + CELL / 2 + 4} textAnchor="middle" fill={w > 0.45 ? '#0a0e17' : '#8b93a7'} fontSize={11} fontFamily="JetBrains Mono, monospace">
                    {w < 0.005 ? '·' : fmt(w, 2)}
                  </text>
                </g>
              )),
            )}
          </svg>
        </div>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-muted select-none">
            <input type="checkbox" checked={causal} onChange={(e) => setCausal(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
            {t.causal}
          </label>
          <Slider label={t.sharp} value={sharp} min={0.2} max={4} step={0.05} onChange={setSharp} format={(v) => `×${fmt(v, 2)}`} accent="#fbbf24" />
        </div>
        <Readout label={t.rowSum} value={fmt(rowSum, 3)} accent="#4ade80" />
        <TeX block>{String.raw`\operatorname{Attention}(Q,K,V) = \operatorname{softmax}\!\left(\frac{QK^{\mathsf T}}{\sqrt{d}}\right) V`}</TeX>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- transformer diagram + posenc

function TransformerDiagram() {
  const t = useT(T)
  const d = t.diagram
  const box = (y: number, label: string, color: string, w = 200) => (
    <g key={label}>
      <rect x={(420 - w) / 2} y={y} width={w} height={34} rx={9} fill="rgba(255,255,255,0.04)" stroke={color} strokeWidth={1.4} />
      <text x={210} y={y + 22} textAnchor="middle" fill="#e6eaf2" fontSize={13}>
        {label}
      </text>
    </g>
  )
  return (
    <svg viewBox="0 0 420 360" className="mx-auto block w-full max-w-sm">
      <defs>
        <marker id="tdArr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,1 L6,3.5 L0,6 z" fill="#8b93a7" />
        </marker>
      </defs>
      {[52, 104, 156, 208, 260, 312].map((y) => (
        <line key={y} x1={210} y1={y - 18} x2={210} y2={y - 2} stroke="#8b93a7" strokeWidth={1.4} markerEnd="url(#tdArr)" />
      ))}
      {box(0, d.tokens, '#8b93a7')}
      {box(52, d.embed, '#4ade80')}
      {box(104, d.attn, '#22d3ee')}
      {box(156, d.norm1, '#8b93a7', 140)}
      {box(208, d.mlp, '#a78bfa')}
      {box(260, d.norm2, '#8b93a7', 140)}
      {box(312, d.out, '#fbbf24')}
      {/* residual arrows */}
      <path d="M 96 96 C 60 120 60 150 96 172" fill="none" stroke="rgba(74,222,128,0.6)" strokeWidth={1.4} markerEnd="url(#tdArr)" />
      <path d="M 96 200 C 60 224 60 254 96 276" fill="none" stroke="rgba(74,222,128,0.6)" strokeWidth={1.4} markerEnd="url(#tdArr)" />
      <rect x={40} y={94} width={340} height={214} rx={12} fill="none" stroke="rgba(255,255,255,0.15)" strokeDasharray="6 5" />
      <text x={372} y={110} textAnchor="end" fill="#8b93a7" fontSize={11} fontFamily="JetBrains Mono, monospace">
        {d.repeat}
      </text>
    </svg>
  )
}

function PosEncPlot() {
  const t = useT(T)
  const PW = 520
  const PH = 150
  const colors = ['#22d3ee', '#a78bfa', '#4ade80', '#fbbf24']
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.posencLabel}</div>
      <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
        {colors.map((c, dim) => (
          <polyline
            key={dim}
            points={Array.from({ length: 160 }, (_, i) => {
              const pos = (i / 159) * 40
              const freq = 1 / Math.pow(80, dim / 4)
              return `${(i / 159) * PW},${PH / 2 - Math.sin(pos * freq * 2) * (PH / 2.6)}`
            }).join(' ')}
            fill="none"
            stroke={c}
            strokeWidth={1.6}
            opacity={0.85}
          />
        ))}
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------- application: scratch detection

const SCR_N = 64

// brushed metal with two faint diagonal scratches; mask marks true scratch pixels
const SCRATCH_IMG: { img: number[][]; mask: boolean[][] } = (() => {
  const rand = mulberry32(321)
  const img: number[][] = []
  const mask: boolean[][] = Array.from({ length: SCR_N }, () => new Array<boolean>(SCR_N).fill(false))
  for (let y = 0; y < SCR_N; y++) {
    const row: number[] = []
    const streak = 0.08 * Math.sin(y * 2.1) + 0.05 * Math.sin(y * 5.7 + 1)
    for (let x = 0; x < SCR_N; x++) row.push(0.45 + streak + (rand() - 0.5) * 0.06)
    img.push(row)
  }
  const drawScratch = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n)
      const y = Math.round(y0 + ((y1 - y0) * i) / n)
      if (x >= 0 && x < SCR_N && y >= 0 && y < SCR_N) {
        img[y][x] = Math.min(1, img[y][x] + 0.35)
        mask[y][x] = true
      }
    }
  }
  drawScratch(10, 52, 42, 14)
  drawScratch(46, 56, 59, 39)
  return { img, mask }
})()

const SCRATCH_KERNELS = [KERNELS.edgeY, KERNELS.diag1, KERNELS.edgeX]

function ScratchCanvas({ img, hits }: { img: number[][]; hits?: boolean[][] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const data = ctx.createImageData(SCR_N, SCR_N)
    for (let y = 0; y < SCR_N; y++)
      for (let x = 0; x < SCR_N; x++) {
        const i = (y * SCR_N + x) * 4
        if (hits?.[y][x]) {
          data.data[i] = 248
          data.data[i + 1] = 113
          data.data[i + 2] = 113
        } else {
          const v = Math.round(Math.min(1, Math.max(0, img[y][x])) * 255)
          data.data[i] = v
          data.data[i + 1] = v
          data.data[i + 2] = v
        }
        data.data[i + 3] = 255
      }
    ctx.putImageData(data, 0, 0)
  }, [img, hits])
  return <canvas ref={ref} width={SCR_N} height={SCR_N} className="block w-full" style={{ imageRendering: 'pixelated' }} />
}

function ScratchLab() {
  const t = useT(T)
  const [kIdx, setKIdx] = useState(1)
  const [thresh, setThresh] = useState(0.6)

  const { hits, tp, fp } = useMemo(() => {
    const resp = reluImg(conv2d(SCRATCH_IMG.img, SCRATCH_KERNELS[kIdx]))
    const hits2: boolean[][] = resp.map((row) => row.map((v) => v > thresh))
    let tp2 = 0
    let fp2 = 0
    for (let y = 0; y < SCR_N; y++)
      for (let x = 0; x < SCR_N; x++)
        if (hits2[y][x]) {
          // count hits within 1 px of a true scratch pixel as correct
          let near = false
          for (let dy = -1; dy <= 1 && !near; dy++)
            for (let dx = -1; dx <= 1 && !near; dx++)
              if (SCRATCH_IMG.mask[y + dy]?.[x + dx]) near = true
          if (near) tp2++
          else fp2++
        }
    return { hits: hits2, tp: tp2, fp: fp2 }
  }, [kIdx, thresh])

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="grid grid-cols-2 gap-3 lg:col-span-3">
        <div className="card overflow-hidden">
          <ScratchCanvas img={SCRATCH_IMG.img} />
          <div className="border-t border-white/10 px-3 py-1.5 text-[12px] text-muted">{t.appInput}</div>
        </div>
        <div className="card overflow-hidden">
          <ScratchCanvas img={SCRATCH_IMG.img} hits={hits} />
          <div className="border-t border-white/10 px-3 py-1.5 text-[12px] text-muted">{t.appResp}</div>
        </div>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <div>
            <div className="mb-1.5 text-[12px] text-muted">{t.appKernel}</div>
            <Segmented
              options={t.appKernelNames.map((n, i) => ({ value: `${i}`, label: n }))}
              value={`${kIdx}`}
              onChange={(v) => setKIdx(Number(v))}
            />
          </div>
          <Slider label={t.appThresh} value={thresh} min={0.15} max={1.4} step={0.01} onChange={setThresh} format={(v) => fmt(v, 2)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.appHits} value={`${tp}`} accent={tp > 40 ? '#4ade80' : '#fbbf24'} />
          <Readout label={t.appFp} value={`${fp}`} accent={fp === 0 ? '#4ade80' : '#f87171'} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function DeepLearningPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'bias', label: t.biasTitle },
          { id: 'cnn', label: t.cnnTitle },
          { id: 'hierarchy', label: t.hierTitle },
          { id: 'attention', label: t.attTitle },
          { id: 'anatomy', label: t.anatomyTitle },
          { id: 'compare', label: t.compTitle },
          { id: 'scale', label: t.scaleTitle },
          { id: 'code', label: t.codeTitle },
          { id: 'application', label: t.appTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="bias" title={t.biasTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.bias1}</p>
        </div>
      </Section>

      <Section id="cnn" title={t.cnnTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.cnn1}</p>
        </div>
        <div className="mt-4">
          <CnnLab />
        </div>
        <Derivation title={t.cnnDerivTitle} steps={t.cnnDeriv} />
      </Section>

      <Section id="hierarchy" title={t.hierTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.hier1}</p>
        </div>
        <div className="mt-4">
          <HierarchyLab />
        </div>
      </Section>

      <Section id="attention" title={t.attTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.att1}</p>
          <p>{t.att2}</p>
        </div>
        <div className="mt-4">
          <AttentionLab />
        </div>
        <Derivation title={t.attDerivTitle} steps={t.attDeriv} />
      </Section>

      <Section id="anatomy" title={t.anatomyTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.anatomy1}</p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="card-pad">
            <TransformerDiagram />
          </div>
          <div className="self-center">
            <PosEncPlot />
          </div>
        </div>
      </Section>

      <Section id="compare" title={t.compTitle}>
        <div className="card max-w-4xl overflow-hidden">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-muted">
                {t.compHead.map((h, i) => (
                  <th key={i} className="px-3.5 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.compRows.map((row, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className={`px-3.5 py-2.5 ${j === 0 ? 'text-muted' : 'text-ink/85'}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="scale" title={t.scaleTitle}>
        <div className="prose-cv max-w-3xl">
          <ul>
            {t.scaleList.map((s, i) => (
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
          <ScratchLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
