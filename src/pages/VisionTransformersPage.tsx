import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { PageToc } from '../components/PageToc'
import { Derivation } from '../components/Derivation'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import { fmt, mulberry32 } from '../lib/math'
import { makeTestImage } from '../lib/dl'
import {
  attnEntropy,
  CLIP_IMAGES,
  CLIP_TEXTS,
  infoNCE,
  infoNCEGradImage,
  patchAttention,
  patchEmbed,
  rowSoftmax,
  simMatrix,
  zeroShotClassify,
  type HeadKey,
} from '../lib/vit'

const VIT_IMG = makeTestImage()

const T = {
  en: {
    kicker: 'ML · Module 5',
    title: 'Vision Transformers & VLMs',
    intro:
      'The transformer was born for language, then quietly ate computer vision. The trick is disarmingly simple: chop an image into patches, call each patch a token, and run the exact attention of the previous module. From there it is a short road to CLIP - a model that puts images and sentences in one shared space - and to the vision-language models that describe, answer and reason about what they see.',
    bridgeTitle: 'A picture is just a sentence of patches',
    bridge1:
      'The previous module fed the transformer a sentence: six word-tokens, each a vector. A Vision Transformer feeds it a picture the same way - cut into a grid of square patches, each flattened and projected to a vector. The transformer never learns whether its tokens came from words or pixels; the machinery is identical. That single idea, published in 2020 (“An Image is Worth 16×16 Words”), unified the two halves of deep learning.',
    bridgeWords: 'language: word tokens',
    bridgePatches: 'vision: patch tokens',
    bridgeSame: 'same transformer block',
    patchTitle: 'Interactive: the ViT tokenizer',
    patch1:
      'Here is the tokenizer in action. Pick a patch size and the 48×48 image is diced into a grid of tokens; smaller patches mean more tokens and finer detail, but quadratically more attention to compute. Click any patch to open it up: its raw pixels, its content-fingerprint (brightness, contrast and edge energies - a legible stand-in for the learned linear embedding), and its position code. That position code matters enormously - without it, a transformer literally cannot tell a patch in the top-left from one in the bottom-right.',
    patchSize: 'patch size',
    patchTokens: 'tokens',
    patchDim: 'embedding dim',
    patchClickHint: 'click a patch to inspect its embedding',
    patchRaw: 'raw pixels',
    patchContent: 'content fingerprint',
    patchContentLabels: ['brightness', 'contrast', 'edge ↕', 'edge ↔', 'edge ⟋'],
    patchPos: 'position code',
    patchDerivTitle: 'From patch to token',
    patchDeriv: [
      { tex: String.raw`\mathbf{x}_p = \operatorname{flatten}(\text{patch}) \in \mathbb{R}^{P^2}`, note: 'A P×P patch is unrolled into a single vector - here P is 4, 8 or 12 pixels on a side.' },
      { tex: String.raw`\mathbf{z}_p = W_E\,\mathbf{x}_p`, note: 'A single learned linear layer projects every patch to the model dimension. In this demo W_E is replaced by five interpretable content statistics.' },
      { tex: String.raw`\mathbf{z}_p \;\mathrel{+}=\; \mathbf{e}^{\text{pos}}_p`, note: 'A position embedding is added so the otherwise order-blind transformer knows where each patch sat. Sinusoids of the row and column - the Fourier connection again.' },
      { tex: String.raw`[\,\mathbf{z}_{\text{cls}};\, \mathbf{z}_1;\, \dots;\, \mathbf{z}_N\,]`, note: 'Prepend a learnable [CLS] token; its output after the stack becomes the whole-image representation used for classification.' },
    ],
    vitAttnTitle: 'Interactive: attention on an image',
    vitAttn1:
      'This is the heart of a Vision Transformer, made visible. Click a query patch: the overlay shows how strongly it attends to every other patch - where this patch “looks” to gather context. Slide the content↔position blend to change what drives the attention: pure content makes a patch attend to others that look similar (same texture, same edge direction, wherever they are); pure position makes it attend to its spatial neighbors. Real ViT heads discover a whole spectrum between these two extremes. The entropy readout says how focused the attention is - low entropy means the patch has locked onto a few others.',
    vitAttnBlend: 'content ↔ position',
    vitAttnScale: 'attention sharpness',
    vitAttnEntropy: 'attention entropy',
    vitAttnQuery: 'query patch',
    vitAttnHint: 'click a patch to make it the query',
    headsTitle: 'Interactive: many heads, many roles',
    heads1:
      'One attention map is never enough. A transformer runs several attention “heads” in parallel, each free to specialize, then concatenates their outputs. Here are four heads for your chosen query patch, each with a hand-built role a real ViT is known to rediscover on its own: attend to similar content, to the horizontal neighbors, to the vertical neighbors, or globally to everything. The network learns which mixture each layer needs; giving heads distinct jobs is why a single layer can both track local edges and pool global context.',
    headNames: { content: 'similar content', hneighbor: 'horizontal neighbors', vneighbor: 'vertical neighbors', global: 'global average' },
    headsConcat: 'concatenate + project → the layer’s output',
    clipTitle: 'Interactive: CLIP - one space for images and words',
    clip1:
      'CLIP trains two encoders - one for images, one for text - to land matching pairs at the same point of a shared vector space, and mismatched pairs far apart. Below is that space in 2D: eight image concepts (draggable) and their eight captions on a circle. The matrix on the right is the cosine similarity of every image with every caption; the temperature slider sharpens each row toward its best match. A correctly trained CLIP has a bright diagonal - every image nearest its own caption. Drag an image away from its caption and watch the loss climb; press “train step” and watch the gradient pull it back.',
    clipTemp: 'temperature τ',
    clipTrain: 'train step (drag first)',
    clipReset: 'Reset',
    clipLoss: 'InfoNCE loss',
    clipDiag: 'diagonal mean',
    clipSpace: 'shared embedding space - drag the ● image points',
    clipMatrix: 'image ↔ text cosine similarity (after temperature softmax)',
    clipImg: 'images',
    clipTxt: 'texts',
    clipDerivTitle: 'Contrastive learning in four lines',
    clipDeriv: [
      { tex: String.raw`\mathbf{u}_i = \frac{f_{\text{img}}(I_i)}{\|\cdot\|}, \qquad \mathbf{v}_j = \frac{f_{\text{txt}}(T_j)}{\|\cdot\|}`, note: 'Encode image and text, normalize to the unit sphere - only the direction carries meaning.' },
      { tex: String.raw`s_{ij} = \frac{\mathbf{u}_i \cdot \mathbf{v}_j}{\tau}`, note: 'The logit is a cosine similarity divided by a temperature τ - the same softmax-sharpness knob as attention.' },
      { tex: String.raw`\mathcal{L} = -\tfrac12\Big[\textstyle\sum_i \log\frac{e^{s_{ii}}}{\sum_j e^{s_{ij}}} + \sum_j \log\frac{e^{s_{jj}}}{\sum_i e^{s_{ij}}}\Big]`, note: 'Symmetric cross-entropy toward the diagonal: each image must pick its caption out of the batch, and vice-versa. This is InfoNCE.' },
      { tex: String.raw`\text{zero-shot: } \arg\max_c \; \mathbf{u} \cdot \mathbf{v}_{\text{“a photo of a } c\text{”}}`, note: 'After training, classify anything by comparing its image vector to text prompts of candidate labels - no retraining, new classes are just new sentences.' },
    ],
    vlmTitle: 'From CLIP to vision-language models',
    vlm1:
      'A vision-language model bolts a vision encoder onto a language model. The image becomes a handful of tokens (patch features, projected into the LLM’s embedding space by a small “projector”), those visual tokens are prepended to the text prompt, and the language model generates its answer conditioned on both. The toy below runs that pipeline on four images: patchify, read off attributes with the content heads, and assemble a caption. Real VLMs (LLaVA, Qwen-VL, GPT-4V) generate free-form text; this one composes from a template - but the wiring is the same.',
    vlmPick: 'image',
    vlmStageEncode: 'vision encoder → patch tokens',
    vlmStageProject: 'projector → LLM tokens',
    vlmStageGenerate: 'language model → caption',
    vlmCaption: 'generated caption',
    vlmArchImg: 'image',
    vlmArchEnc: 'vision encoder (ViT)',
    vlmArchProj: 'projector',
    vlmArchLLM: 'language model',
    vlmArchText: 'text prompt',
    vlmArchOut: '“a bright circle on a gradient…”',
    vlmNote: 'The projector is the only new part CLIP did not already have - a couple of linear layers that translate image tokens into the LLM’s native language. Everything else is a transformer you have already built.',
    scalingTitle: 'Pretraining, transfer and scale',
    scalingList: [
      'Pretrain once, use everywhere: a ViT or CLIP trained on hundreds of millions of image-text pairs becomes a backbone you fine-tune on your few thousand labelled parts. Starting from scratch is almost always the wrong move.',
      'Zero-shot is the new interface: because CLIP shares a space with language, you classify by writing prompts, not by collecting a training set. A new defect category is a new sentence.',
      'ViTs are hungrier than CNNs: with little data the CNN’s built-in locality wins; past a certain scale the ViT’s freedom to learn any attention pattern pulls ahead. The crossover is why both still coexist.',
      'Scaling laws hold here too: bigger encoders, more pairs, more compute lower the loss predictably - the empirical engine behind every frontier vision-language model.',
    ],
    appTitle: '🏭 In the real world: zero-shot defect triage',
    appIntro:
      'The classic quality-inspection model needs a labelled dataset per defect - retrain for every new failure mode. A CLIP-style model skips that: describe each class in words, embed the part image, and pick the nearest text prompt. Below, a part is imaged and matched against four prompts (“a clean surface”, “a scratched surface”, “a dented surface”, “an oil-stained surface”). Change the part and the defect strength; the confidence bars are cosine similarities through a temperature softmax. Adding a fifth defect class would be one more sentence - not one more training run.',
    appPart: 'part sample',
    appDefect: 'defect strength',
    appTemp: 'temperature τ',
    appVerdict: 'predicted class',
    appConf: 'confidence',
    appMargin: 'margin to 2nd',
    appClasses: ['clean surface', 'scratched surface', 'dented surface', 'oil-stained surface'],
    appWhere:
      'The same zero-shot recipe powers open-vocabulary detection (find “a forklift” with no forklift training images), content moderation, robot instruction-following (“pick up the red cube”) and image search by description - anywhere the set of categories is open-ended.',
  },
  de: {
    kicker: 'ML · Modul 5',
    title: 'Vision Transformer & VLMs',
    intro:
      'Der Transformer wurde für Sprache geboren und verschlang dann leise das maschinelle Sehen. Der Trick ist entwaffnend einfach: Zerhacke ein Bild in Patches, nenne jeden Patch ein Token und lass exakt die Attention des vorigen Moduls laufen. Von dort ist es ein kurzer Weg zu CLIP - einem Modell, das Bilder und Sätze in einen gemeinsamen Raum legt - und zu den Vision-Language-Modellen, die beschreiben, beantworten und über das Gesehene schlussfolgern.',
    bridgeTitle: 'Ein Bild ist nur ein Satz aus Patches',
    bridge1:
      'Das vorige Modul fütterte den Transformer mit einem Satz: sechs Wort-Tokens, jedes ein Vektor. Ein Vision Transformer füttert ihn genauso mit einem Bild - zerschnitten in ein Raster quadratischer Patches, jeder flachgeklopft und auf einen Vektor projiziert. Der Transformer lernt nie, ob seine Tokens aus Wörtern oder Pixeln stammen; die Maschinerie ist identisch. Diese eine Idee, 2020 veröffentlicht („An Image is Worth 16×16 Words“), vereinte die beiden Hälften des Deep Learning.',
    bridgeWords: 'Sprache: Wort-Tokens',
    bridgePatches: 'Vision: Patch-Tokens',
    bridgeSame: 'derselbe Transformer-Block',
    patchTitle: 'Interaktiv: der ViT-Tokenizer',
    patch1:
      'Hier ist der Tokenizer in Aktion. Wähle eine Patch-Größe, und das 48×48-Bild wird in ein Raster von Tokens zerlegt; kleinere Patches bedeuten mehr Tokens und feinere Details, aber quadratisch mehr Attention zu berechnen. Klicke einen Patch, um ihn zu öffnen: seine rohen Pixel, seinen Inhalts-Fingerabdruck (Helligkeit, Kontrast und Kantenenergien - ein lesbarer Stellvertreter des gelernten linearen Embeddings) und seinen Positionscode. Dieser Positionscode ist enorm wichtig - ohne ihn kann ein Transformer einen Patch oben links buchstäblich nicht von einem unten rechts unterscheiden.',
    patchSize: 'Patch-Größe',
    patchTokens: 'Tokens',
    patchDim: 'Embedding-Dim.',
    patchClickHint: 'Patch anklicken, um sein Embedding zu inspizieren',
    patchRaw: 'rohe Pixel',
    patchContent: 'Inhalts-Fingerabdruck',
    patchContentLabels: ['Helligkeit', 'Kontrast', 'Kante ↕', 'Kante ↔', 'Kante ⟋'],
    patchPos: 'Positionscode',
    patchDerivTitle: 'Vom Patch zum Token',
    patchDeriv: [
      { tex: String.raw`\mathbf{x}_p = \operatorname{flatten}(\text{Patch}) \in \mathbb{R}^{P^2}`, note: 'Ein P×P-Patch wird zu einem einzigen Vektor abgerollt - hier ist P 4, 8 oder 12 Pixel Kantenlänge.' },
      { tex: String.raw`\mathbf{z}_p = W_E\,\mathbf{x}_p`, note: 'Eine einzige gelernte lineare Schicht projiziert jeden Patch auf die Modelldimension. In dieser Demo ist W_E durch fünf interpretierbare Inhaltsstatistiken ersetzt.' },
      { tex: String.raw`\mathbf{z}_p \;\mathrel{+}=\; \mathbf{e}^{\text{pos}}_p`, note: 'Ein Positions-Embedding wird addiert, damit der sonst reihenfolgeblinde Transformer weiß, wo jeder Patch saß. Sinuskurven von Zeile und Spalte - wieder die Fourier-Verbindung.' },
      { tex: String.raw`[\,\mathbf{z}_{\text{cls}};\, \mathbf{z}_1;\, \dots;\, \mathbf{z}_N\,]`, note: 'Ein lernbares [CLS]-Token wird vorangestellt; seine Ausgabe nach dem Stapel wird die Ganzbild-Repräsentation für die Klassifikation.' },
    ],
    vitAttnTitle: 'Interaktiv: Attention auf einem Bild',
    vitAttn1:
      'Das ist das Herz eines Vision Transformers, sichtbar gemacht. Klicke einen Query-Patch: Das Overlay zeigt, wie stark er auf jeden anderen Patch achtet - wohin dieser Patch „blickt“, um Kontext zu sammeln. Schiebe die Inhalt↔Position-Mischung, um zu ändern, was die Attention treibt: reiner Inhalt lässt einen Patch auf andere achten, die ähnlich aussehen (gleiche Textur, gleiche Kantenrichtung, egal wo); reine Position lässt ihn auf seine räumlichen Nachbarn achten. Echte ViT-Köpfe entdecken ein ganzes Spektrum zwischen diesen Extremen. Das Entropie-Readout sagt, wie fokussiert die Attention ist - niedrige Entropie heißt, der Patch hat sich auf wenige andere eingerastet.',
    vitAttnBlend: 'Inhalt ↔ Position',
    vitAttnScale: 'Attention-Schärfe',
    vitAttnEntropy: 'Attention-Entropie',
    vitAttnQuery: 'Query-Patch',
    vitAttnHint: 'Patch anklicken, um ihn zum Query zu machen',
    headsTitle: 'Interaktiv: viele Köpfe, viele Rollen',
    heads1:
      'Eine Attention-Karte reicht nie. Ein Transformer lässt mehrere Attention-„Köpfe“ parallel laufen, jeder frei zu spezialisieren, und verkettet dann ihre Ausgaben. Hier sind vier Köpfe für deinen gewählten Query-Patch, jeder mit einer handgebauten Rolle, die ein echter ViT bekanntlich von selbst wiederentdeckt: auf ähnlichen Inhalt achten, auf die horizontalen Nachbarn, auf die vertikalen Nachbarn oder global auf alles. Das Netz lernt, welche Mischung jede Schicht braucht; Köpfen verschiedene Jobs zu geben ist der Grund, warum eine einzige Schicht sowohl lokale Kanten verfolgen als auch globalen Kontext bündeln kann.',
    headNames: { content: 'ähnlicher Inhalt', hneighbor: 'horizontale Nachbarn', vneighbor: 'vertikale Nachbarn', global: 'globaler Durchschnitt' },
    headsConcat: 'verketten + projizieren → Ausgabe der Schicht',
    clipTitle: 'Interaktiv: CLIP - ein Raum für Bilder und Wörter',
    clip1:
      'CLIP trainiert zwei Encoder - einen für Bilder, einen für Text -, damit passende Paare am selben Punkt eines gemeinsamen Vektorraums landen und unpassende Paare weit auseinander. Unten ist dieser Raum in 2D: acht Bildkonzepte (ziehbar) und ihre acht Bildunterschriften auf einem Kreis. Die Matrix rechts ist die Kosinus-Ähnlichkeit jedes Bildes mit jeder Unterschrift; der Temperatur-Slider schärft jede Zeile zu ihrem besten Match. Ein korrekt trainiertes CLIP hat eine helle Diagonale - jedes Bild am nächsten zu seiner eigenen Unterschrift. Zieh ein Bild von seiner Unterschrift weg und sieh den Verlust steigen; drücke „Trainingsschritt“ und sieh, wie der Gradient es zurückzieht.',
    clipTemp: 'Temperatur τ',
    clipTrain: 'Trainingsschritt (erst ziehen)',
    clipReset: 'Zurücksetzen',
    clipLoss: 'InfoNCE-Verlust',
    clipDiag: 'Diagonalen-Mittel',
    clipSpace: 'gemeinsamer Embedding-Raum - die ●-Bildpunkte ziehen',
    clipMatrix: 'Bild ↔ Text Kosinus-Ähnlichkeit (nach Temperatur-Softmax)',
    clipImg: 'Bilder',
    clipTxt: 'Texte',
    clipDerivTitle: 'Kontrastives Lernen in vier Zeilen',
    clipDeriv: [
      { tex: String.raw`\mathbf{u}_i = \frac{f_{\text{img}}(I_i)}{\|\cdot\|}, \qquad \mathbf{v}_j = \frac{f_{\text{txt}}(T_j)}{\|\cdot\|}`, note: 'Bild und Text kodieren, auf die Einheitskugel normieren - nur die Richtung trägt Bedeutung.' },
      { tex: String.raw`s_{ij} = \frac{\mathbf{u}_i \cdot \mathbf{v}_j}{\tau}`, note: 'Das Logit ist eine Kosinus-Ähnlichkeit geteilt durch eine Temperatur τ - derselbe Softmax-Schärfe-Regler wie bei der Attention.' },
      { tex: String.raw`\mathcal{L} = -\tfrac12\Big[\textstyle\sum_i \log\frac{e^{s_{ii}}}{\sum_j e^{s_{ij}}} + \sum_j \log\frac{e^{s_{jj}}}{\sum_i e^{s_{ij}}}\Big]`, note: 'Symmetrische Kreuzentropie zur Diagonale: Jedes Bild muss seine Unterschrift aus dem Batch herauspicken, und umgekehrt. Das ist InfoNCE.' },
      { tex: String.raw`\text{Zero-Shot: } \arg\max_c \; \mathbf{u} \cdot \mathbf{v}_{\text{„ein Foto von } c\text{“}}`, note: 'Nach dem Training klassifiziert man alles, indem man seinen Bildvektor mit Text-Prompts von Kandidaten-Labels vergleicht - kein Nachtrainieren, neue Klassen sind nur neue Sätze.' },
    ],
    vlmTitle: 'Von CLIP zu Vision-Language-Modellen',
    vlm1:
      'Ein Vision-Language-Modell schraubt einen Vision-Encoder an ein Sprachmodell. Das Bild wird zu einer Handvoll Tokens (Patch-Merkmale, von einem kleinen „Projektor“ in den Embedding-Raum des LLM projiziert), diese visuellen Tokens werden dem Text-Prompt vorangestellt, und das Sprachmodell erzeugt seine Antwort bedingt auf beides. Das Spielzeug unten führt diese Pipeline auf vier Bildern aus: patchifizieren, mit den Inhaltsköpfen Attribute ablesen und eine Bildunterschrift zusammensetzen. Echte VLMs (LLaVA, Qwen-VL, GPT-4V) erzeugen freien Text; dieses hier komponiert aus einer Vorlage - aber die Verdrahtung ist dieselbe.',
    vlmPick: 'Bild',
    vlmStageEncode: 'Vision-Encoder → Patch-Tokens',
    vlmStageProject: 'Projektor → LLM-Tokens',
    vlmStageGenerate: 'Sprachmodell → Bildunterschrift',
    vlmCaption: 'erzeugte Bildunterschrift',
    vlmArchImg: 'Bild',
    vlmArchEnc: 'Vision-Encoder (ViT)',
    vlmArchProj: 'Projektor',
    vlmArchLLM: 'Sprachmodell',
    vlmArchText: 'Text-Prompt',
    vlmArchOut: '„ein heller Kreis auf einem Verlauf…“',
    vlmNote: 'Der Projektor ist der einzige neue Teil, den CLIP nicht schon hatte - ein paar lineare Schichten, die Bild-Tokens in die Muttersprache des LLM übersetzen. Alles andere ist ein Transformer, den du bereits gebaut hast.',
    scalingTitle: 'Vortraining, Transfer und Skalierung',
    scalingList: [
      'Einmal vortrainieren, überall nutzen: Ein ViT oder CLIP, trainiert auf Hunderten Millionen Bild-Text-Paaren, wird ein Backbone, das du auf deinen paar tausend gelabelten Bauteilen feinjustierst. Bei null anzufangen ist fast immer der falsche Zug.',
      'Zero-Shot ist die neue Schnittstelle: Weil CLIP einen Raum mit der Sprache teilt, klassifiziert man durch das Schreiben von Prompts, nicht durch das Sammeln eines Trainingssatzes. Eine neue Fehlerkategorie ist ein neuer Satz.',
      'ViTs sind hungriger als CNNs: Bei wenig Daten gewinnt die eingebaute Lokalität des CNN; ab einer gewissen Skala zieht die Freiheit des ViT, jedes Attention-Muster zu lernen, davon. Dieser Übergang ist der Grund, warum beide noch koexistieren.',
      'Skalierungsgesetze gelten auch hier: größere Encoder, mehr Paare, mehr Rechenleistung senken den Verlust vorhersagbar - der empirische Motor hinter jedem Spitzen-Vision-Language-Modell.',
    ],
    appTitle: '🏭 In der echten Welt: Zero-Shot-Fehlertriage',
    appIntro:
      'Das klassische Qualitätsprüfmodell braucht pro Defekt einen gelabelten Datensatz - Nachtrainieren für jeden neuen Fehlermodus. Ein CLIP-artiges Modell überspringt das: Beschreibe jede Klasse in Worten, bette das Bauteilbild ein und wähle den nächsten Text-Prompt. Unten wird ein Bauteil abgebildet und gegen vier Prompts abgeglichen („eine saubere Oberfläche“, „eine zerkratzte Oberfläche“, „eine verbeulte Oberfläche“, „eine ölverschmierte Oberfläche“). Ändere das Bauteil und die Defektstärke; die Konfidenzbalken sind Kosinus-Ähnlichkeiten durch eine Temperatur-Softmax. Eine fünfte Fehlerklasse hinzuzufügen wäre ein weiterer Satz - kein weiterer Trainingslauf.',
    appPart: 'Bauteil-Probe',
    appDefect: 'Defektstärke',
    appTemp: 'Temperatur τ',
    appVerdict: 'vorhergesagte Klasse',
    appConf: 'Konfidenz',
    appMargin: 'Abstand zum 2.',
    appClasses: ['saubere Oberfläche', 'zerkratzte Oberfläche', 'verbeulte Oberfläche', 'ölverschmierte Oberfläche'],
    appWhere:
      'Dasselbe Zero-Shot-Rezept treibt Open-Vocabulary-Detektion (finde „einen Stapler“ ohne Stapler-Trainingsbilder), Content-Moderation, Roboter-Anweisungsbefolgung („nimm den roten Würfel“) und Bildsuche per Beschreibung - überall, wo die Menge der Kategorien offen ist.',
  },
}

// ---------------------------------------------------------------- shared image renderer

function ImgCanvas({ img, size = 240 }: { img: number[][]; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const N = img.length
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const data = ctx.createImageData(N, N)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const v = Math.round(Math.min(1, Math.max(0, img[y][x])) * 255)
        const i = (y * N + x) * 4
        data.data[i] = v
        data.data[i + 1] = v
        data.data[i + 2] = v
        data.data[i + 3] = 255
      }
    ctx.putImageData(data, 0, 0)
  }, [img, N])
  return <canvas ref={ref} width={N} height={N} style={{ width: size, height: size, imageRendering: 'pixelated' }} />
}

// ---------------------------------------------------------------- patchify lab

function PatchifyLab() {
  const t = useT(T)
  const [P, setP] = useState(8)
  const [sel, setSel] = useState(0)
  const emb = useMemo(() => patchEmbed(VIT_IMG, P), [P])
  const g = emb.g
  const nTok = g * g
  const si = Math.min(sel, nTok - 1)

  const S = 300
  const cell = S / g

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="card relative inline-block overflow-hidden">
          <ImgCanvas img={VIT_IMG} size={S} />
          <svg viewBox={`0 0 ${S} ${S}`} className="absolute inset-0" style={{ width: S, height: S }}>
            {Array.from({ length: nTok }, (_, i) => {
              const r = Math.floor(i / g)
              const c = i % g
              return (
                <rect
                  key={i}
                  x={c * cell}
                  y={r * cell}
                  width={cell}
                  height={cell}
                  fill={i === si ? 'rgba(251,191,36,0.3)' : 'transparent'}
                  stroke={i === si ? '#fbbf24' : 'rgba(255,255,255,0.25)'}
                  strokeWidth={i === si ? 2 : 0.6}
                  className="cursor-pointer"
                  onClick={() => setSel(i)}
                />
              )
            })}
          </svg>
        </div>
        <p className="mt-2 text-[12px] text-muted">{t.patchClickHint}</p>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3">
          <div className="mb-1 text-[12px] text-muted">{t.patchSize}</div>
          <Segmented
            options={[4, 8, 12].map((v) => ({ value: `${v}`, label: `${v}×${v}` }))}
            value={`${P}`}
            onChange={(v) => { setP(Number(v)); setSel(0) }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Readout label={t.patchTokens} value={`${nTok}`} />
            <Readout label={t.patchDim} value="5 + 4" />
          </div>
        </div>
        <div className="card-pad space-y-3">
          <div className="text-[12px] font-medium text-muted">{t.patchContent}</div>
          {emb.content[si].map((v, d) => (
            <div key={d} className="flex items-center gap-2">
              <div className="w-20 shrink-0 text-[11px] text-muted">{t.patchContentLabels[d]}</div>
              <div className="relative h-3 flex-1 rounded bg-white/5">
                <div
                  className="absolute top-0 h-3 rounded"
                  style={{
                    left: v >= 0 ? '50%' : `${50 + Math.max(v, -1.5) * 33}%`,
                    width: `${Math.min(Math.abs(v), 1.5) * 33}%`,
                    background: v >= 0 ? '#22d3ee' : '#f87171',
                  }}
                />
              </div>
              <div className="w-10 shrink-0 text-right font-mono text-[11px]">{fmt(v, 1)}</div>
            </div>
          ))}
          <div className="pt-1 text-[12px] font-medium text-muted">{t.patchPos}</div>
          <div className="font-mono text-[11px] text-ink/80">({emb.pos[si].map((v) => fmt(v, 2)).join(', ')})</div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- ViT attention lab

function VitAttnLab() {
  const t = useT(T)
  const [posWeight, setPosWeight] = useState(0.3)
  const [scale, setScale] = useState(1.5)
  const [query, setQuery] = useState(21)
  const P = 8
  const emb = useMemo(() => patchEmbed(VIT_IMG, P), [])
  const g = emb.g
  const A = useMemo(() => patchAttention(emb, posWeight, scale, 'content'), [emb, posWeight, scale])
  const row = A[Math.min(query, A.length - 1)]
  const entropy = attnEntropy(row)

  const S = 320
  const cell = S / g

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="card relative inline-block overflow-hidden">
          <ImgCanvas img={VIT_IMG} size={S} />
          <svg viewBox={`0 0 ${S} ${S}`} className="absolute inset-0" style={{ width: S, height: S }}>
            {row.map((w, i) => {
              const r = Math.floor(i / g)
              const c = i % g
              return (
                <rect
                  key={i}
                  x={c * cell}
                  y={r * cell}
                  width={cell}
                  height={cell}
                  fill={`rgba(34,211,238,${Math.min(w * g * 0.9, 0.85)})`}
                  stroke={i === query ? '#fbbf24' : 'rgba(255,255,255,0.12)'}
                  strokeWidth={i === query ? 2.5 : 0.5}
                  className="cursor-pointer"
                  onClick={() => setQuery(i)}
                />
              )
            })}
          </svg>
        </div>
        <p className="mt-2 text-[12px] text-muted">{t.vitAttnHint}</p>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.vitAttnBlend} value={posWeight} min={0} max={1} step={0.05} onChange={setPosWeight} format={(v) => (v < 0.33 ? 'content' : v > 0.66 ? 'position' : 'mixed')} />
          <Slider label={t.vitAttnScale} value={scale} min={0.3} max={4} step={0.1} onChange={setScale} format={(v) => `×${fmt(v, 1)}`} accent="#a78bfa" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.vitAttnQuery} value={`#${query}`} />
          <Readout label={t.vitAttnEntropy} value={fmt(entropy, 2)} accent={entropy < 2 ? '#4ade80' : undefined} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- multi-head lab

const HEAD_KEYS: HeadKey[] = ['content', 'hneighbor', 'vneighbor', 'global']

function HeadsLab() {
  const t = useT(T)
  const [query, setQuery] = useState(21)
  const P = 8
  const emb = useMemo(() => patchEmbed(VIT_IMG, P), [])
  const g = emb.g
  const headNames = t.headNames as Record<HeadKey, string>
  const maps = HEAD_KEYS.map((h) => patchAttention(emb, 0.3, 1.5, h))
  const S = 150
  const cell = S / g

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {HEAD_KEYS.map((h, hi) => {
          const row = maps[hi][Math.min(query, maps[hi].length - 1)]
          return (
            <div key={h} className="card overflow-hidden">
              <div className="border-b border-white/10 px-3 py-1.5 text-[11.5px] font-medium text-muted">{headNames[h]}</div>
              <div className="relative inline-block">
                <ImgCanvas img={VIT_IMG} size={S} />
                <svg viewBox={`0 0 ${S} ${S}`} className="absolute inset-0" style={{ width: S, height: S }}>
                  {row.map((w, i) => {
                    const r = Math.floor(i / g)
                    const c = i % g
                    return (
                      <rect
                        key={i}
                        x={c * cell}
                        y={r * cell}
                        width={cell}
                        height={cell}
                        fill={`rgba(167,139,250,${Math.min(w * g * 0.9, 0.85)})`}
                        stroke={i === query ? '#fbbf24' : 'transparent'}
                        strokeWidth={i === query ? 2 : 0}
                        className="cursor-pointer"
                        onClick={() => setQuery(i)}
                      />
                    )
                  })}
                </svg>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 text-center text-[12.5px] text-muted">↓ {t.headsConcat}</div>
    </div>
  )
}

// ---------------------------------------------------------------- CLIP lab

function ClipLab() {
  const t = useT(T)
  const lang = (t.clipImg === 'images' ? 'en' : 'de') as 'en' | 'de'
  const [temp, setTemp] = useState(0.3)
  const [imgEmb, setImgEmb] = useState<[number, number][]>(() => CLIP_IMAGES.map((c) => [...c.emb] as [number, number]))
  const [drag, setDrag] = useState<number | null>(null)
  const txtEmb = CLIP_TEXTS.map((c) => c.emb)

  const S = 300
  const R = 120
  const cx = S / 2
  const cy = S / 2
  const toXY = (e: [number, number]) => [cx + e[0] * R, cy - e[1] * R]

  const sim = useMemo(() => simMatrix(imgEmb, txtEmb), [imgEmb, txtEmb])
  const soft = useMemo(() => rowSoftmax(sim, temp), [sim, temp])
  const loss = useMemo(() => infoNCE(sim, temp), [sim, temp])
  const diagMean = soft.reduce((s, row, i) => s + row[i], 0) / soft.length

  const onMove = (e: React.PointerEvent) => {
    if (drag === null) return
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * S - cx
    const y = -(((e.clientY - rect.top) / rect.height) * S - cy)
    const n = Math.hypot(x, y) || 1
    setImgEmb((prev) => prev.map((p, i) => (i === drag ? [x / n, y / n] : p)))
  }

  const trainStep = () => {
    setImgEmb((prev) =>
      prev.map((p, i) => {
        const grad = infoNCEGradImage(prev, txtEmb, temp, i)
        const nx = p[0] - 0.15 * grad[0]
        const ny = p[1] - 0.15 * grad[1]
        const n = Math.hypot(nx, ny) || 1
        return [nx / n, ny / n]
      }),
    )
  }

  const N = CLIP_IMAGES.length
  const MC = 220
  const mcell = MC / N

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card overflow-hidden">
        <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.clipSpace}</div>
        <svg
          viewBox={`0 0 ${S} ${S}`}
          className="mx-auto block w-full max-w-sm touch-none"
          onPointerMove={onMove}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
        >
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.1)" />
          {txtEmb.map((e, i) => {
            const [x, y] = toXY(e)
            return (
              <g key={`t${i}`}>
                <rect x={x - 4} y={y - 4} width={8} height={8} fill="#fbbf24" opacity={0.8} />
                <text x={x} y={y - 8} textAnchor="middle" fill="#fbbf2499" fontSize={8}>
                  {CLIP_TEXTS[i].label[lang].split(' ').slice(-1)[0]}
                </text>
              </g>
            )
          })}
          {imgEmb.map((e, i) => {
            const [x, y] = toXY(e)
            return (
              <circle
                key={`i${i}`}
                cx={x}
                cy={y}
                r={7}
                fill="#22d3ee"
                stroke="#0a0e17"
                strokeWidth={1.5}
                className="cursor-grab"
                onPointerDown={() => setDrag(i)}
              />
            )
          })}
        </svg>
        <div className="flex items-center gap-4 px-3 pb-2 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#22d3ee]" /> {t.clipImg}</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 bg-[#fbbf24]" /> {t.clipTxt}</span>
        </div>
      </div>
      <div className="flex flex-col gap-4 self-start">
        <div className="card overflow-hidden">
          <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.clipMatrix}</div>
          <svg viewBox={`0 0 ${MC + 4} ${MC + 4}`} className="mx-auto block max-w-xs">
            {soft.map((rowv, i) =>
              rowv.map((w, j) => (
                <rect key={`${i}-${j}`} x={j * mcell + 2} y={i * mcell + 2} width={mcell - 1} height={mcell - 1} fill={`rgba(34,211,238,${w * 0.9})`} stroke={i === j ? 'rgba(74,222,128,0.6)' : 'none'} strokeWidth={i === j ? 1.5 : 0} />
              )),
            )}
          </svg>
        </div>
        <div className="card-pad space-y-3.5">
          <Slider label={t.clipTemp} value={temp} min={0.05} max={1} step={0.05} onChange={setTemp} format={(v) => fmt(v, 2)} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={trainStep}>
              ⏬ {t.clipTrain}
            </button>
            <button className="btn" onClick={() => setImgEmb(CLIP_IMAGES.map((c) => [...c.emb] as [number, number]))}>
              ↺ {t.clipReset}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Readout label={t.clipLoss} value={fmt(loss, 3)} accent={loss < 0.5 ? '#4ade80' : '#fbbf24'} />
            <Readout label={t.clipDiag} value={fmt(diagMean, 2)} accent={diagMean > 0.9 ? '#4ade80' : undefined} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- VLM pipeline

const VLM_IMAGES: number[][][] = [
  // 4 procedural scenes with distinct dominant attributes
  makeVlmImg(0),
  makeVlmImg(1),
  makeVlmImg(2),
  makeVlmImg(3),
]

function makeVlmImg(kind: number): number[][] {
  const N = 32
  const rand = mulberry32(kind * 7 + 3)
  const I: number[][] = Array.from({ length: N }, (_, y) =>
    Array.from({ length: N }, (_, x) => 0.2 + (0.3 * (x + y)) / (2 * N) + rand() * 0.05),
  )
  const cx = N / 2
  const cy = N / 2
  if (kind === 0) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x - cx) ** 2 + (y - cy) ** 2 < 90) I[y][x] = 0.9
  if (kind === 1) for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) I[y][x] = 0.85
  if (kind === 2) for (let i = 0; i < N; i++) { const y = Math.round(i * 0.7) + 4; if (y < N) { I[y][i] = 0.9; if (y + 1 < N) I[y + 1][i] = 0.9 } }
  if (kind === 3) { for (let i = 0; i < N; i++) { I[cy][i] = 0.9; I[i][cx] = 0.9 } }
  return I
}

const VLM_CAPTIONS = {
  en: ['a bright circle on a soft gradient', 'a bright square centered on the frame', 'a bright diagonal streak across the scene', 'a bright cross dividing the image'],
  de: ['ein heller Kreis auf einem sanften Verlauf', 'ein helles Quadrat, zentriert im Bild', 'ein heller diagonaler Streifen quer durch die Szene', 'ein helles Kreuz, das das Bild teilt'],
}

function VlmLab() {
  const t = useT(T)
  const lang = (t.clipImg === 'images' ? 'en' : 'de') as 'en' | 'de'
  const [pick, setPick] = useState(0)
  const [typed, setTyped] = useState('')
  const caption = VLM_CAPTIONS[lang][pick]

  useEffect(() => {
    setTyped('')
    let i = 0
    const iv = setInterval(() => {
      i++
      setTyped(caption.slice(0, i))
      if (i >= caption.length) clearInterval(iv)
    }, 28)
    return () => clearInterval(iv)
  }, [caption])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          {VLM_IMAGES.map((img, i) => (
            <button key={i} onClick={() => setPick(i)} className={`card overflow-hidden p-0 ${i === pick ? 'ring-2 ring-accent' : ''}`}>
              <ImgCanvas img={img} size={64} />
            </button>
          ))}
        </div>
        <div className="card overflow-hidden">
          <ImgCanvas img={VLM_IMAGES[pick]} size={220} />
        </div>
      </div>
      <div className="flex flex-col gap-3 self-start">
        {/* pipeline stages */}
        {[t.vlmStageEncode, t.vlmStageProject, t.vlmStageGenerate].map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-[13px] text-accent">{i + 1}</div>
            <div className="text-[13px] text-ink/85">{s}</div>
          </div>
        ))}
        <div className="card-pad mt-1">
          <div className="mb-1 text-[12px] text-muted">{t.vlmCaption}</div>
          <div className="min-h-[3rem] font-mono text-[14px] text-accent">
            “{typed}
            <span className="animate-pulse">▋</span>”
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- application: zero-shot defect triage

// class prompts on the unit circle; part features land near one of them
const DEFECT_PROMPTS: [number, number][] = [
  [Math.cos(0), Math.sin(0)],
  [Math.cos(Math.PI / 2), Math.sin(Math.PI / 2)],
  [Math.cos(Math.PI), Math.sin(Math.PI)],
  [Math.cos((3 * Math.PI) / 2), Math.sin((3 * Math.PI) / 2)],
]

function DefectTriageLab() {
  const t = useT(T)
  const [part, setPart] = useState(1)
  const [strength, setStrength] = useState(0.7)
  const [temp, setTemp] = useState(0.3)

  // part feature: interpolate from "clean" (class 0 direction) toward the part's defect class
  const feat = useMemo((): [number, number] => {
    const cls = part // 0..3
    const target = DEFECT_PROMPTS[cls]
    const clean = DEFECT_PROMPTS[0]
    const fx = clean[0] * (1 - strength) + target[0] * strength
    const fy = clean[1] * (1 - strength) + target[1] * strength
    const n = Math.hypot(fx, fy) || 1
    return [fx / n, fy / n]
  }, [part, strength])

  const { probs, best } = useMemo(() => zeroShotClassify(feat, DEFECT_PROMPTS, temp), [feat, temp])
  const sorted = [...probs].sort((a, b) => b - a)
  const margin = sorted[0] - sorted[1]

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="flex flex-col gap-3 self-start lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((p) => (
            <button key={p} onClick={() => setPart(p)} className={`btn ${p === part ? 'btn-primary' : ''}`}>
              #{p + 1}
            </button>
          ))}
        </div>
        <div className="card-pad space-y-3.5">
          <Slider label={t.appDefect} value={strength} min={0} max={1} step={0.05} onChange={setStrength} format={(v) => `${fmt(v * 100, 0)} %`} />
          <Slider label={t.appTemp} value={temp} min={0.05} max={1} step={0.05} onChange={setTemp} format={(v) => fmt(v, 2)} accent="#a78bfa" />
        </div>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-3">
        <div className="card-pad space-y-2.5">
          {t.appClasses.map((c, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-32 shrink-0 text-[12.5px]" style={{ color: i === best ? '#4ade80' : undefined }}>
                {c}
              </div>
              <div className="relative h-4 flex-1 rounded bg-white/5">
                <div className="absolute top-0 left-0 h-4 rounded" style={{ width: `${probs[i] * 100}%`, background: i === best ? '#4ade80' : '#22d3ee88' }} />
              </div>
              <div className="w-12 shrink-0 text-right font-mono text-[12px]">{fmt(probs[i] * 100, 0)}%</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Readout label={t.appVerdict} value={t.appClasses[best].split(' ')[0]} accent={best === 0 ? '#4ade80' : '#fbbf24'} />
          <Readout label={t.appConf} value={`${fmt(probs[best] * 100, 0)}%`} />
          <Readout label={t.appMargin} value={fmt(margin, 2)} accent={margin > 0.3 ? '#4ade80' : '#fbbf24'} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function VisionTransformersPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'bridge', label: t.bridgeTitle },
          { id: 'patchify', label: t.patchTitle },
          { id: 'vitattn', label: t.vitAttnTitle },
          { id: 'heads', label: t.headsTitle },
          { id: 'clip', label: t.clipTitle },
          { id: 'vlm', label: t.vlmTitle },
          { id: 'scaling', label: t.scalingTitle },
          { id: 'application', label: t.appTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="bridge" title={t.bridgeTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.bridge1}</p>
        </div>
        <div className="card-pad mt-4 max-w-2xl">
          <svg viewBox="0 0 520 160" className="w-full">
            {/* words row */}
            <text x={10} y={30} fill="#8b93a7" fontSize={11} fontFamily="JetBrains Mono, monospace">{t.bridgeWords}</text>
            {['the', 'cat', 'sat'].map((w, i) => (
              <g key={w}>
                <rect x={20 + i * 52} y={38} width={46} height={24} rx={5} fill="rgba(251,191,36,0.15)" stroke="#fbbf24" />
                <text x={43 + i * 52} y={54} textAnchor="middle" fill="#fbbf24" fontSize={11} fontFamily="JetBrains Mono, monospace">{w}</text>
              </g>
            ))}
            {/* patches row */}
            <text x={10} y={95} fill="#8b93a7" fontSize={11} fontFamily="JetBrains Mono, monospace">{t.bridgePatches}</text>
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={20 + i * 30} y={103} width={26} height={26} rx={3} fill={`rgba(34,211,238,${0.15 + i * 0.12})`} stroke="#22d3ee" />
            ))}
            {/* arrows into shared block */}
            <path d="M 180 50 L 330 80" stroke="rgba(255,255,255,0.25)" strokeWidth={1.2} markerEnd="url(#va)" />
            <path d="M 150 116 L 330 90" stroke="rgba(255,255,255,0.25)" strokeWidth={1.2} markerEnd="url(#va)" />
            <rect x={335} y={58} width={170} height={44} rx={8} fill="rgba(167,139,250,0.12)" stroke="#a78bfa" />
            <text x={420} y={84} textAnchor="middle" fill="#a78bfa" fontSize={12} fontFamily="JetBrains Mono, monospace">{t.bridgeSame}</text>
            <defs>
              <marker id="va" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 z" fill="rgba(255,255,255,0.4)" />
              </marker>
            </defs>
          </svg>
        </div>
      </Section>

      <Section id="patchify" title={t.patchTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.patch1}</p>
        </div>
        <div className="mt-4">
          <PatchifyLab />
        </div>
        <Derivation title={t.patchDerivTitle} steps={t.patchDeriv} />
      </Section>

      <Section id="vitattn" title={t.vitAttnTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.vitAttn1}</p>
        </div>
        <div className="mt-4">
          <VitAttnLab />
        </div>
      </Section>

      <Section id="heads" title={t.headsTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.heads1}</p>
        </div>
        <div className="mt-4">
          <HeadsLab />
        </div>
      </Section>

      <Section id="clip" title={t.clipTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.clip1}</p>
        </div>
        <div className="mt-4">
          <ClipLab />
        </div>
        <Derivation title={t.clipDerivTitle} steps={t.clipDeriv} />
      </Section>

      <Section id="vlm" title={t.vlmTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.vlm1}</p>
        </div>
        <div className="card-pad mt-4 max-w-3xl">
          <svg viewBox="0 0 620 90" className="w-full">
            {[
              { x: 10, w: 70, label: t.vlmArchImg, color: '#22d3ee' },
              { x: 100, w: 96, label: t.vlmArchEnc, color: '#22d3ee' },
              { x: 216, w: 74, label: t.vlmArchProj, color: '#fbbf24' },
              { x: 310, w: 110, label: t.vlmArchLLM, color: '#a78bfa' },
              { x: 440, w: 170, label: t.vlmArchOut, color: '#4ade80' },
            ].map((b, i) => (
              <g key={i}>
                <rect x={b.x} y={30} width={b.w} height={34} rx={7} fill={`${b.color}1f`} stroke={b.color} />
                <text x={b.x + b.w / 2} y={51} textAnchor="middle" fill={b.color} fontSize={10.5} fontFamily="JetBrains Mono, monospace">{b.label}</text>
                {i < 4 && <path d={`M ${b.x + b.w} 47 L ${b.x + b.w + 10} 47`} stroke="rgba(255,255,255,0.35)" strokeWidth={1.2} markerEnd="url(#va2)" />}
              </g>
            ))}
            <text x={310 + 55} y={22} textAnchor="middle" fill="#8b93a7" fontSize={9.5}>+ {t.vlmArchText}</text>
            <defs>
              <marker id="va2" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 z" fill="rgba(255,255,255,0.45)" />
              </marker>
            </defs>
          </svg>
        </div>
        <div className="mt-4">
          <VlmLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.vlmNote}
        </InfoBox>
      </Section>

      <Section id="scaling" title={t.scalingTitle}>
        <div className="prose-cv max-w-3xl">
          <ul>
            {t.scalingList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="application" title={t.appTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.appIntro}</p>
        </div>
        <div className="mt-4">
          <DefectTriageLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
