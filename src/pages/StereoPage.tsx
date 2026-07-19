import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { MatrixView } from '../components/MatrixView'
import { ImageView } from '../components/ImageView'
import { PageToc } from '../components/PageToc'
import { Derivation } from '../components/Derivation'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import { CameraFrustumViz, Polyline, Quad, Scene3D } from '../components/three/helpers'
import {
  add,
  cameraCenter,
  epipolarSegment,
  essential,
  fmt,
  fmtSci,
  fundamental,
  lookAtCV,
  m3MulV,
  m3T,
  normalize,
  pixelToWorld,
  projectPoint,
  relativePose,
  scale,
  sub,
  type Intrinsics,
  type V3,
} from '../lib/math'
import { blockMatch, costCurve, dispStats, makeStereoPair, SM_MAXD, SM_W, SM_H } from '../lib/stereoMatch'

const W = 640
const H = 480

const T = {
  en: {
    kicker: 'Vision · Module 4',
    title: 'Stereo Calibration & Stereo Vision',
    intro:
      'A single camera destroys depth: every point on a viewing ray lands on the same pixel. A second camera breaks that ambiguity. This module covers the geometry of two views - from stereo extrinsics through epipolar lines to metric depth from disparity.',
    bridgeTitle: 'The second camera sees the difference',
    bridge1:
      'Module 1 ended with an unsolvable puzzle: sliding a point along its viewing ray leaves the left image completely unchanged. Here is the same experiment with one camera added. The left dot still refuses to move - but the right camera watches the point from the side, and its dot slides as the depth changes. The information that camera one destroys is exactly what camera two records.',
    bridge2:
      'Note where the right dot slides: always along the same faint line. That is no accident - it is the epipolar line, and it gets its own section below.',
    bridgeDepth: 'depth along the left ray',
    bridgeLeftU: 'left pixel',
    bridgeRightU: 'right pixel uR',
    tipParallax:
      'You own a stereo rig: hold a finger in front of your face and wink your left and right eye alternately. The finger jumps against the background, and the closer it is, the bigger the jump. That jump is disparity - your visual system triangulates with a ~6.5 cm baseline all day long.',
    triTitle: 'Interactive: triangulation with two cameras',
    tri1: 'Two identical, perfectly parallel cameras (the rectified case) observe one point. Each camera alone only knows a ray - but the two rays intersect in exactly one place. That intersection is triangulation, and the whole depth signal is the horizontal shift between the two image positions: the disparity d = uL − uR.',
    triTry: [
      'Push the point away (Z ↑) - both image dots crawl toward each other: disparity shrinks hyperbolically.',
      'Widen the baseline b - disparity grows: a wider rig can see depth farther away.',
      'Increase f - same effect: telephoto stereo has more depth signal but a narrower view.',
    ],
    leftImg: 'Left image',
    rightImg: 'Right image',
    scene: '3D scene - drag to orbit',
    baseline: 'baseline b',
    focal: 'focal length f',
    px: 'point X',
    py: 'point Y',
    pz: 'point depth Z',
    disparity: 'disparity d',
    estDepth: 'Z from d',
    uncToggle: 'show ±1 px matching error',
    uncRange: 'depth interval for ±1 px',
    uncText:
      'Real matchers locate correspondences with roughly pixel accuracy. Toggle the error wedge: the two thin red rays show where the point would be if the right camera had matched one pixel early or late. Near the cameras the wedge is razor thin; push the point away and watch the same ±1 px open into a huge depth interval.',
    depthFormula: 'The rectified geometry gives the fundamental relation of stereo vision:',
    calibTitle: 'Stereo calibration: the extrinsics between two cameras',
    calib1:
      'Stereo calibration (e.g. cv2.stereoCalibrate) estimates the fixed rigid transform between the two cameras - the rotation R and translation t that map points from the left camera frame into the right one - alongside both K matrices. It uses the same checkerboard captures as single-camera calibration, seen by both cameras simultaneously.',
    calib2:
      'From R and t follow the two workhorse matrices of two-view geometry: the essential matrix E (normalized coordinates) and the fundamental matrix F (pixels). Both encode the same constraint - a point in one image confines its partner to a line in the other:',
    epiTitle: 'Interactive: epipolar geometry',
    epi1: 'Here the two cameras are verged (rotated toward each other), like your eyes. Drag the point in the left image: its epipolar line appears in the right image. The matching point can only lie on this line - this is why stereo matching is a 1D search, not a 2D one.',
    epi2: 'The depth slider moves a candidate 3D point along the left viewing ray. Watch its projection in the right image: it slides along the epipolar line but never leaves it, no matter the depth.',
    epiDrag: 'drag the point!',
    epiDepth: 'depth along left ray',
    epiF: 'Current fundamental matrix (computed from K, R, t of this rig):',
    epi3d: 'And here is the 3D reason for the line. The left pixel fixes a viewing ray (dashed). This ray together with the two camera centers spans a plane - the epipolar plane (translucent). Whatever the depth, the candidate point stays inside this plane; the right camera sees the plane edge-on, and a plane seen edge-on is… a line on the sensor. Drag the point in the left image above and watch the plane tilt with it.',
    epi3dScene: '3D scene - the epipolar plane, synced with the images above',
    efTitle: 'Essential vs. fundamental - a quick comparison',
    efHead: ['', 'Essential E', 'Fundamental F'],
    efRows: [
      ['acts on', 'normalized coordinates (K removed)', 'raw pixel coordinates'],
      ['requires K', 'yes - calibrated cameras', 'no - works uncalibrated'],
      ['degrees of freedom', '5', '7'],
      ['can be decomposed into', 'R and t (t up to scale)', 'epipolar lines only'],
    ],
    rectTitle: 'Rectification: making epipolar lines horizontal',
    rect1:
      'General epipolar lines are slanted - searching along them is awkward. Rectification warps both images with homographies so that both virtual cameras are parallel again: all epipolar lines become horizontal, and corresponding points share the same image row. Every practical stereo matcher runs on rectified images.',
    rectBefore: 'Before: verged rig - lines converge toward the epipole',
    rectAfter: 'After: rectified - lines are horizontal rows',
    depthTitle: 'Interactive: from disparity to depth',
    depth1: 'Depth is inversely proportional to disparity - with dramatic consequences. One pixel of disparity is worth centimeters up close, but meters far away. The depth resolution of a stereo rig degrades quadratically with distance:',
    depthCurve: 'depth Z over disparity d',
    depthAt: 'depth at current d',
    depthRes: 'ΔZ per 1 px at current d',
    dSlider: 'disparity d',
    matchTitle: 'Finding correspondences in practice',
    match1: 'Geometry tells us where to search - a matcher must still decide which pixel corresponds. Block-matching algorithms (e.g. OpenCV’s StereoSGBM) compare local patches along each rectified row, pick the disparity with the best matching cost, and produce a disparity map, which the Q matrix from stereoRectify turns into a 3D point cloud.',
    matchList: [
      'Textureless surfaces (white walls) give no matching signal → holes in the map.',
      'Repetitive patterns cause ambiguous matches.',
      'Occlusions: some pixels are visible in only one camera and have no valid disparity.',
      'Active stereo (projected IR texture, e.g. RealSense) fights the first two problems.',
    ],
    matchLab1:
      'Enough theory - here is an actual stereo matcher running in your browser. The left/right pair below is synthetic (a slanted wall, two boxes and a disk, so the true disparity of every pixel is known), and the algorithm is the honest classic: for every left pixel, slide a window along the same row of the right image, score each candidate shift with SAD or SSD, keep the best. The result map is color-coded near-to-far; switch to ground truth or |error| to grade it. Then click any pixel in the disparity map: the cost curve below shows exactly what the matcher saw at that pixel - and why it chose what it chose.',
    matchLab2:
      'The three failure modes from the list above are all in this scene. Turn texture down and watch the wall dissolve into noise while its cost curves go flat - no texture, no signal. Look right of each box edge: a band of wrong disparity that no window size fixes - those background pixels are occluded in the right view, there IS no correct match. And sweep the window size: small windows are noisy but sharp, large windows are clean but fatten every object boundary. Forty years of stereo research lives inside these three trade-offs.',
    matchWin: 'window size',
    matchTex: 'surface texture',
    matchNoise: 'sensor noise σ',
    matchMetric: 'cost metric',
    matchView: 'map view',
    matchViewNames: [
      { value: 'est', label: 'estimated' },
      { value: 'gt', label: 'ground truth' },
      { value: 'err', label: '|error|' },
    ],
    matchLeftT: 'left image',
    matchRightT: 'right image',
    matchDispT: 'disparity map - click a pixel to probe its cost curve',
    matchMed: 'median error',
    matchBad: 'bad pixels (>1 px)',
    matchMs: 'compute time',
    matchProbe: 'cost curve at the clicked pixel - amber = chosen minimum, green dashed = true disparity',
    matchProbeHint: 'click the disparity map to probe a pixel',
    matchOccNote: 'hatched = occluded in the right view (excluded from the statistics)',
    depthDerivTitle: 'The depth formula, derived',
    depthDeriv: [
      { tex: String.raw`\frac{u_L - c_x}{f} = \frac{X}{Z}, \qquad \frac{u_R - c_x}{f} = \frac{X - b}{Z}`, note: 'Two similar-triangle relations: each camera sees the same point, the right one from a viewpoint shifted by the baseline b.' },
      { tex: String.raw`d \;=\; u_L - u_R \;=\; \frac{f\,b}{Z}`, note: 'Subtract - X cancels. The disparity depends only on depth, baseline and focal length.' },
      { tex: String.raw`Z = \frac{f\,b}{d}`, note: 'Invert: metric depth from a pixel offset. This one line is the entire business model of every stereo camera.' },
      { tex: String.raw`\left|\frac{\partial Z}{\partial d}\right| = \frac{f\,b}{d^2} = \frac{Z^2}{f\,b} \;\;\Rightarrow\;\; \Delta Z \approx \frac{Z^2}{f\,b}\,\Delta d`, note: 'Differentiate: a fixed matching error Δd costs depth accuracy growing with Z² - the quadratic degradation the wedge demo above makes visible.' },
    ],
    essDerivTitle: 'E = [t]×R from coplanarity',
    essDeriv: [
      { tex: String.raw`\hat{\mathbf{x}}_2 \;\sim\; R\,\hat{\mathbf{x}}_1\text{-ray}, \quad \mathbf{t}: \text{ baseline between the centers}`, note: 'Work in normalized coordinates (K removed). The two viewing rays of one 3D point and the baseline vector all lie in one plane - the epipolar plane.' },
      { tex: String.raw`\hat{\mathbf{x}}_2 \cdot \big(\mathbf{t} \times R\,\hat{\mathbf{x}}_1\big) = 0`, note: 'Coplanarity of three vectors = vanishing triple product. This single scalar equation is the entire epipolar constraint.' },
      { tex: String.raw`\mathbf{t} \times \mathbf{v} = [\mathbf{t}]_\times \mathbf{v}, \qquad [\mathbf{t}]_\times = \begin{bmatrix} 0 & -t_3 & t_2 \\ t_3 & 0 & -t_1 \\ -t_2 & t_1 & 0 \end{bmatrix}`, note: 'The cross product is a linear map - write it as the skew-symmetric matrix [t]ₓ.' },
      { tex: String.raw`\hat{\mathbf{x}}_2^{\mathsf T}\, \underbrace{[\mathbf{t}]_\times R}_{E} \,\hat{\mathbf{x}}_1 = 0`, note: 'And the essential matrix falls out. Watch the live readout in the lab above: it stays at machine zero no matter where you drag the point.' },
      { tex: String.raw`E = U\,\mathrm{diag}(1,1,0)\,V^{\mathsf T} \;\Rightarrow\; 4 \text{ candidate } (R, \mathbf{t}) \text{ pairs}`, note: 'Going backwards (E → R, t) needs an SVD and yields four candidates; the real one is picked by cheirality - reconstructed points must lie in front of both cameras. cv2.recoverPose does exactly this.' },
    ],
    epiConstraint: 'x̂₂ᵀ E x̂₁ (live)',
    appTitle: '🏭 In the real world: designing a forklift safety camera',
    appIntro:
      'An autonomous forklift must stop for a 5 cm obstacle - a dropped bolt bin, a pallet corner - before it gets dangerously close. You are the system designer: pick the baseline and the lens, then check the rig against the spec at the required detection range. Two things must hold at that range: the depth error from ±0.5 px of disparity noise must stay below ±5 cm, and the disparity itself must be at least 5 px so the obstacle stands out from matching noise at all. Widen the baseline or lengthen the lens and watch the badge flip - this exact trade-off (baseline vs. housing size vs. range) is fought over in every stereo product meeting.',
    appBase: 'baseline b',
    appFocal: 'focal length f',
    appRange: 'detection range Z',
    appDisp: 'disparity at range',
    appRes: 'depth error (±0.5 px)',
    appPass: 'DESIGN PASSES',
    appFail: 'DESIGN FAILS',
    appPassWhy: 'disparity ≥ 5 px and depth error ≤ 5 cm at the detection range',
    appFailDisp: 'disparity below 5 px - the obstacle drowns in matching noise',
    appFailRes: 'depth error above 5 cm - obstacle and floor become indistinguishable',
    appWhere:
      'The same sizing calculation shapes the stereo rigs in cars (Subaru EyeSight), autonomous drones (Skydio), warehouse AMRs and planetary rovers - and it explains why phones, with millimeter baselines, only measure depth at arm’s length.',
  },
  de: {
    kicker: 'Vision · Modul 4',
    title: 'Stereokalibrierung & Stereosehen',
    intro:
      'Eine einzelne Kamera zerstört Tiefe: Jeder Punkt auf einem Sehstrahl landet auf demselben Pixel. Eine zweite Kamera bricht diese Mehrdeutigkeit. Dieses Modul behandelt die Geometrie zweier Ansichten - von der Stereo-Extrinsik über Epipolarlinien bis zur metrischen Tiefe aus Disparität.',
    bridgeTitle: 'Die zweite Kamera sieht den Unterschied',
    bridge1:
      'Modul 1 endete mit einem unlösbaren Rätsel: Verschiebt man einen Punkt entlang seines Sehstrahls, bleibt das linke Bild völlig unverändert. Hier ist dasselbe Experiment mit einer zusätzlichen Kamera. Der linke Punkt weigert sich weiterhin, sich zu bewegen - aber die rechte Kamera beobachtet den Punkt von der Seite, und ihr Punkt wandert mit der Tiefe. Genau die Information, die Kamera eins zerstört, zeichnet Kamera zwei auf.',
    bridge2:
      'Beachte, wo der rechte Punkt entlangwandert: immer auf derselben blassen Linie. Das ist kein Zufall - es ist die Epipolarlinie, und sie bekommt unten ihren eigenen Abschnitt.',
    bridgeDepth: 'Tiefe entlang des linken Strahls',
    bridgeLeftU: 'linkes Pixel',
    bridgeRightU: 'rechtes Pixel uR',
    tipParallax:
      'Du besitzt ein Stereo-Rig: Halte einen Finger vors Gesicht und blinzle abwechselnd mit dem linken und rechten Auge. Der Finger springt vor dem Hintergrund - je näher, desto größer der Sprung. Dieser Sprung ist Disparität; dein Sehsystem trianguliert den ganzen Tag mit ~6,5 cm Basislinie.',
    triTitle: 'Interaktiv: Triangulation mit zwei Kameras',
    tri1: 'Zwei identische, perfekt parallele Kameras (der rektifizierte Fall) beobachten einen Punkt. Jede Kamera allein kennt nur einen Strahl - aber die beiden Strahlen schneiden sich an genau einer Stelle. Dieser Schnitt ist die Triangulation, und das gesamte Tiefensignal steckt im horizontalen Versatz der beiden Bildpositionen: der Disparität d = uL − uR.',
    triTry: [
      'Schiebe den Punkt weiter weg (Z ↑) - beide Bildpunkte kriechen aufeinander zu: Die Disparität schrumpft hyperbolisch.',
      'Vergrößere die Basislinie b - die Disparität wächst: Ein breiteres Rig sieht Tiefe auf größere Entfernung.',
      'Erhöhe f - gleicher Effekt: Tele-Stereo hat mehr Tiefensignal, aber ein engeres Sichtfeld.',
    ],
    leftImg: 'Linkes Bild',
    rightImg: 'Rechtes Bild',
    scene: '3D-Szene - ziehen zum Orbiten',
    baseline: 'Basislinie b',
    focal: 'Brennweite f',
    px: 'Punkt X',
    py: 'Punkt Y',
    pz: 'Punkttiefe Z',
    disparity: 'Disparität d',
    estDepth: 'Z aus d',
    uncToggle: '±1 px Matchingfehler anzeigen',
    uncRange: 'Tiefenintervall für ±1 px',
    uncText:
      'Echte Matcher finden Korrespondenzen ungefähr pixelgenau. Schalte den Fehlerkeil ein: Die beiden dünnen roten Strahlen zeigen, wo der Punkt läge, wenn die rechte Kamera ein Pixel zu früh oder zu spät gematcht hätte. Nahe den Kameras ist der Keil hauchdünn; schiebe den Punkt weiter weg und sieh zu, wie dasselbe ±1 px zu einem riesigen Tiefenintervall aufklappt.',
    depthFormula: 'Aus der rektifizierten Geometrie folgt die Grundgleichung des Stereosehens:',
    calibTitle: 'Stereokalibrierung: die Extrinsik zwischen zwei Kameras',
    calib1:
      'Die Stereokalibrierung (z. B. cv2.stereoCalibrate) schätzt die feste Starrkörpertransformation zwischen den beiden Kameras - Rotation R und Translation t, die Punkte vom linken ins rechte Kamerasystem abbilden - zusammen mit beiden K-Matrizen. Sie nutzt dieselben Schachbrettaufnahmen wie die Einzelkamera-Kalibrierung, von beiden Kameras gleichzeitig gesehen.',
    calib2:
      'Aus R und t folgen die beiden Arbeitspferde der Zwei-Ansichten-Geometrie: die essentielle Matrix E (normierte Koordinaten) und die Fundamentalmatrix F (Pixel). Beide kodieren dieselbe Bedingung - ein Punkt in einem Bild zwingt seinen Partner im anderen auf eine Linie:',
    epiTitle: 'Interaktiv: Epipolargeometrie',
    epi1: 'Hier sind die beiden Kameras konvergent (zueinander gedreht), wie deine Augen. Ziehe den Punkt im linken Bild: Seine Epipolarlinie erscheint im rechten Bild. Der korrespondierende Punkt kann nur auf dieser Linie liegen - deshalb ist Stereo-Matching eine 1D-Suche, keine 2D-Suche.',
    epi2: 'Der Tiefen-Slider verschiebt einen 3D-Kandidatenpunkt entlang des linken Sehstrahls. Beobachte seine Projektion im rechten Bild: Sie gleitet die Epipolarlinie entlang, verlässt sie aber nie - egal bei welcher Tiefe.',
    epiDrag: 'Punkt ziehen!',
    epiDepth: 'Tiefe entlang des linken Strahls',
    epiF: 'Aktuelle Fundamentalmatrix (berechnet aus K, R, t dieses Rigs):',
    epi3d: 'Und hier der 3D-Grund für die Linie. Das linke Pixel legt einen Sehstrahl fest (gestrichelt). Dieser Strahl spannt zusammen mit den beiden Kamerazentren eine Ebene auf - die Epipolarebene (transparent). Egal bei welcher Tiefe: Der Kandidatenpunkt bleibt in dieser Ebene; die rechte Kamera sieht die Ebene von der Kante, und eine Ebene von der Kante gesehen ist… eine Linie auf dem Sensor. Ziehe den Punkt im linken Bild oben und beobachte, wie die Ebene mitkippt.',
    epi3dScene: '3D-Szene - die Epipolarebene, synchron zu den Bildern oben',
    efTitle: 'Essentiell vs. fundamental - der schnelle Vergleich',
    efHead: ['', 'Essentielle E', 'Fundamentale F'],
    efRows: [
      ['wirkt auf', 'normierte Koordinaten (K entfernt)', 'rohe Pixelkoordinaten'],
      ['braucht K', 'ja - kalibrierte Kameras', 'nein - funktioniert unkalibriert'],
      ['Freiheitsgrade', '5', '7'],
      ['zerlegbar in', 'R und t (t bis auf Skalierung)', 'nur Epipolarlinien'],
    ],
    rectTitle: 'Rektifizierung: Epipolarlinien horizontal machen',
    rect1:
      'Allgemeine Epipolarlinien verlaufen schräg - entlang ihnen zu suchen ist unpraktisch. Die Rektifizierung entzerrt beide Bilder mit Homographien, sodass beide virtuellen Kameras wieder parallel stehen: Alle Epipolarlinien werden horizontal, und korrespondierende Punkte teilen dieselbe Bildzeile. Jeder praktische Stereo-Matcher arbeitet auf rektifizierten Bildern.',
    rectBefore: 'Vorher: konvergentes Rig - Linien laufen zum Epipol',
    rectAfter: 'Nachher: rektifiziert - Linien sind horizontale Zeilen',
    depthTitle: 'Interaktiv: von der Disparität zur Tiefe',
    depth1: 'Tiefe ist umgekehrt proportional zur Disparität - mit dramatischen Folgen. Ein Pixel Disparität entspricht in der Nähe Zentimetern, in der Ferne Metern. Die Tiefenauflösung eines Stereo-Rigs verschlechtert sich quadratisch mit der Entfernung:',
    depthCurve: 'Tiefe Z über Disparität d',
    depthAt: 'Tiefe bei aktuellem d',
    depthRes: 'ΔZ pro 1 px bei aktuellem d',
    dSlider: 'Disparität d',
    matchTitle: 'Korrespondenzsuche in der Praxis',
    match1: 'Die Geometrie sagt, wo zu suchen ist - ein Matcher muss trotzdem entscheiden, welches Pixel korrespondiert. Blockmatching-Verfahren (z. B. OpenCVs StereoSGBM) vergleichen lokale Bildausschnitte entlang jeder rektifizierten Zeile, wählen die Disparität mit den besten Matchingkosten und erzeugen eine Disparitätskarte, die die Q-Matrix aus stereoRectify in eine 3D-Punktwolke verwandelt.',
    matchList: [
      'Texturlose Flächen (weiße Wände) liefern kein Matchingsignal → Löcher in der Karte.',
      'Sich wiederholende Muster erzeugen mehrdeutige Matches.',
      'Verdeckungen: Manche Pixel sieht nur eine Kamera - sie haben keine gültige Disparität.',
      'Aktives Stereo (projizierte IR-Textur, z. B. RealSense) bekämpft die ersten beiden Probleme.',
    ],
    matchLab1:
      'Genug Theorie - hier läuft ein echter Stereo-Matcher in deinem Browser. Das Links/Rechts-Paar unten ist synthetisch (eine schräge Wand, zwei Kisten und eine Scheibe, sodass die wahre Disparität jedes Pixels bekannt ist), und der Algorithmus ist der ehrliche Klassiker: Schiebe für jedes linke Pixel ein Fenster entlang derselben Zeile des rechten Bildes, bewerte jeden Kandidaten-Versatz mit SAD oder SSD, behalte den besten. Die Ergebniskarte ist nah-bis-fern farbcodiert; schalte auf Ground Truth oder |Fehler| um, um sie zu benoten. Klicke dann irgendein Pixel in der Disparitätskarte: Die Kostenkurve darunter zeigt exakt, was der Matcher an diesem Pixel gesehen hat - und warum er wählte, was er wählte.',
    matchLab2:
      'Die drei Fehlermodi aus der Liste oben stecken alle in dieser Szene. Dreh die Textur herunter und sieh zu, wie die Wand in Rauschen zerfällt, während ihre Kostenkurven flach werden - keine Textur, kein Signal. Schau rechts neben jede Kistenkante: ein Band falscher Disparität, das keine Fenstergröße repariert - diese Hintergrundpixel sind im rechten Bild verdeckt, es GIBT keinen richtigen Match. Und fahre die Fenstergröße durch: Kleine Fenster sind verrauscht, aber scharf; große Fenster sind sauber, aber mästen jede Objektkante. Vierzig Jahre Stereo-Forschung wohnen in diesen drei Zielkonflikten.',
    matchWin: 'Fenstergröße',
    matchTex: 'Oberflächentextur',
    matchNoise: 'Sensorrauschen σ',
    matchMetric: 'Kostenmetrik',
    matchView: 'Kartenansicht',
    matchViewNames: [
      { value: 'est', label: 'geschätzt' },
      { value: 'gt', label: 'Ground Truth' },
      { value: 'err', label: '|Fehler|' },
    ],
    matchLeftT: 'linkes Bild',
    matchRightT: 'rechtes Bild',
    matchDispT: 'Disparitätskarte - Pixel anklicken, um seine Kostenkurve zu sondieren',
    matchMed: 'Medianfehler',
    matchBad: 'schlechte Pixel (>1 px)',
    matchMs: 'Rechenzeit',
    matchProbe: 'Kostenkurve am angeklickten Pixel - bernstein = gewähltes Minimum, grün gestrichelt = wahre Disparität',
    matchProbeHint: 'in die Disparitätskarte klicken, um ein Pixel zu sondieren',
    matchOccNote: 'schraffiert = im rechten Bild verdeckt (aus der Statistik ausgeschlossen)',
    depthDerivTitle: 'Die Tiefenformel, hergeleitet',
    depthDeriv: [
      { tex: String.raw`\frac{u_L - c_x}{f} = \frac{X}{Z}, \qquad \frac{u_R - c_x}{f} = \frac{X - b}{Z}`, note: 'Zwei Ähnliche-Dreiecke-Beziehungen: Beide Kameras sehen denselben Punkt, die rechte von einem um die Basislinie b verschobenen Standpunkt.' },
      { tex: String.raw`d \;=\; u_L - u_R \;=\; \frac{f\,b}{Z}`, note: 'Subtrahieren - X kürzt sich. Die Disparität hängt nur von Tiefe, Basislinie und Brennweite ab.' },
      { tex: String.raw`Z = \frac{f\,b}{d}`, note: 'Invertieren: metrische Tiefe aus einem Pixelversatz. Diese eine Zeile ist das gesamte Geschäftsmodell jeder Stereokamera.' },
      { tex: String.raw`\left|\frac{\partial Z}{\partial d}\right| = \frac{f\,b}{d^2} = \frac{Z^2}{f\,b} \;\;\Rightarrow\;\; \Delta Z \approx \frac{Z^2}{f\,b}\,\Delta d`, note: 'Differenzieren: Ein fester Matchingfehler Δd kostet Tiefengenauigkeit, die mit Z² wächst - die quadratische Verschlechterung, die der Fehlerkeil oben sichtbar macht.' },
    ],
    essDerivTitle: 'E = [t]×R aus Koplanarität',
    essDeriv: [
      { tex: String.raw`\hat{\mathbf{x}}_2 \;\sim\; R\,\hat{\mathbf{x}}_1\text{-Strahl}, \quad \mathbf{t}: \text{ Basislinie zwischen den Zentren}`, note: 'Arbeite in normierten Koordinaten (K entfernt). Die beiden Sehstrahlen eines 3D-Punkts und der Basislinienvektor liegen in einer Ebene - der Epipolarebene.' },
      { tex: String.raw`\hat{\mathbf{x}}_2 \cdot \big(\mathbf{t} \times R\,\hat{\mathbf{x}}_1\big) = 0`, note: 'Koplanarität dreier Vektoren = verschwindendes Spatprodukt. Diese eine skalare Gleichung ist die gesamte Epipolarbedingung.' },
      { tex: String.raw`\mathbf{t} \times \mathbf{v} = [\mathbf{t}]_\times \mathbf{v}, \qquad [\mathbf{t}]_\times = \begin{bmatrix} 0 & -t_3 & t_2 \\ t_3 & 0 & -t_1 \\ -t_2 & t_1 & 0 \end{bmatrix}`, note: 'Das Kreuzprodukt ist eine lineare Abbildung - schreibe es als schiefsymmetrische Matrix [t]ₓ.' },
      { tex: String.raw`\hat{\mathbf{x}}_2^{\mathsf T}\, \underbrace{[\mathbf{t}]_\times R}_{E} \,\hat{\mathbf{x}}_1 = 0`, note: 'Und die essentielle Matrix fällt heraus. Beobachte den Live-Messwert im Labor oben: Er bleibt auf Maschinen-Null, egal wohin du den Punkt ziehst.' },
      { tex: String.raw`E = U\,\mathrm{diag}(1,1,0)\,V^{\mathsf T} \;\Rightarrow\; 4 \text{ Kandidaten } (R, \mathbf{t})`, note: 'Der Rückweg (E → R, t) braucht eine SVD und liefert vier Kandidaten; den echten wählt die Cheiralität - rekonstruierte Punkte müssen vor beiden Kameras liegen. cv2.recoverPose tut genau das.' },
    ],
    epiConstraint: 'x̂₂ᵀ E x̂₁ (live)',
    appTitle: '🏭 In der echten Welt: eine Stapler-Sicherheitskamera auslegen',
    appIntro:
      'Ein autonomer Stapler muss vor einem 5-cm-Hindernis stoppen - eine heruntergefallene Schraubenkiste, eine Palettenecke - bevor er gefährlich nah ist. Du bist der Systemdesigner: Wähle Basislinie und Objektiv und prüfe das Rig gegen die Spezifikation bei der geforderten Detektionsreichweite. Zwei Dinge müssen dort gelten: Der Tiefenfehler aus ±0,5 px Disparitätsrauschen muss unter ±5 cm bleiben, und die Disparität selbst muss mindestens 5 px betragen, damit sich das Hindernis überhaupt vom Matchingrauschen abhebt. Verbreitere die Basislinie oder verlängere das Objektiv und sieh das Badge umschlagen - genau dieser Zielkonflikt (Basislinie vs. Gehäusegröße vs. Reichweite) wird in jedem Stereo-Produktmeeting ausgefochten.',
    appBase: 'Basislinie b',
    appFocal: 'Brennweite f',
    appRange: 'Detektionsreichweite Z',
    appDisp: 'Disparität bei Reichweite',
    appRes: 'Tiefenfehler (±0,5 px)',
    appPass: 'DESIGN BESTEHT',
    appFail: 'DESIGN FÄLLT DURCH',
    appPassWhy: 'Disparität ≥ 5 px und Tiefenfehler ≤ 5 cm bei der Detektionsreichweite',
    appFailDisp: 'Disparität unter 5 px - das Hindernis geht im Matchingrauschen unter',
    appFailRes: 'Tiefenfehler über 5 cm - Hindernis und Boden sind nicht mehr unterscheidbar',
    appWhere:
      'Dieselbe Auslegungsrechnung formt die Stereo-Rigs in Autos (Subaru EyeSight), autonomen Drohnen (Skydio), Lager-AMRs und Planetenrovern - und sie erklärt, warum Handys mit Millimeter-Basislinien Tiefe nur auf Armlänge messen.',
  },
}

// ---------------------------------------------------------------- triangulation lab

function TriangulationLab() {
  const t = useT(T)
  const [b, setB] = useState(0.24)
  const [f, setF] = useState(520)
  const [px, setPx] = useState(0.15)
  const [py, setPy] = useState(1.0)
  const [pz, setPz] = useState(2.4)

  const k: Intrinsics = useMemo(() => ({ fx: f, fy: f, s: 0, cx: W / 2, cy: H / 2 }), [f])
  const camY = 0.9
  // CV camera frames have x pointing toward world -X here, so the LEFT camera of the
  // stereo pair sits at world +x: its x-axis then runs along the baseline toward the right camera.
  const poseL = useMemo(() => lookAtCV([b / 2, camY, 0], [b / 2, camY, 1]), [b])
  const poseR = useMemo(() => lookAtCV([-b / 2, camY, 0], [-b / 2, camY, 1]), [b])
  const P: V3 = [px, py, pz]

  const pL = projectPoint(k, poseL, P)
  const pR = projectPoint(k, poseR, P)
  const d = pL.u - pR.u
  const zEst = (f * b) / d

  const CL = cameraCenter(poseL)
  const CR = cameraCenter(poseR)

  // ±1 px matching-error wedge: depths if the right match were one pixel off
  const [showUnc, setShowUnc] = useState(false)
  const zPlus = d > 1.001 ? (f * b) / (d - 1) : Infinity
  const zMinus = (f * b) / (d + 1)
  const Pplus = add(CL, scale(sub(P, CL), zPlus / pz))
  const Pminus = add(CL, scale(sub(P, CL), zMinus / pz))
  const wedgeOk = showUnc && isFinite(zPlus)

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Scene3D
          className="lg:col-span-3"
          height={430}
          camera={{ position: [2.8, 2.2, -2.6], fov: 42 }}
          target={[0, 0.9, 1.4]}
          hint={t.scene}
        >
          <CameraFrustumViz k={k} w={W} h={H} pose={poseL} depth={0.5} color="#22d3ee" label="L" points={[{ p: P, color: '#fbbf24' }]} />
          <CameraFrustumViz k={k} w={W} h={H} pose={poseR} depth={0.5} color="#a78bfa" label="R" points={[{ p: P, color: '#fbbf24' }]} />
          <Polyline points={[CL, CR]} color="#4ade80" lineWidth={3} />
          <mesh position={P}>
            <sphereGeometry args={[0.05, 24, 24]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.4} />
          </mesh>
          {wedgeOk && (
            <group>
              <Polyline points={[CR, Pplus]} color="#f87171" lineWidth={1} opacity={0.85} />
              <Polyline points={[CR, Pminus]} color="#f87171" lineWidth={1} opacity={0.85} />
              <Polyline points={[Pminus, Pplus]} color="#fbbf24" lineWidth={4} />
              <Quad corners={[CR, Pminus, Pplus, Pplus]} color="#f87171" opacity={0.12} />
            </group>
          )}
        </Scene3D>
        <div className="card-pad space-y-3.5 lg:col-span-2">
          <Slider label={t.baseline} value={b} min={0.06} max={0.5} step={0.005} onChange={setB} format={(v) => `${fmt(v * 100, 1)} cm`} accent="#4ade80" />
          <Slider label={t.focal} value={f} min={300} max={900} step={5} onChange={setF} format={(v) => `${v} px`} />
          <Slider label={t.px} value={px} min={-0.8} max={0.8} step={0.01} onChange={setPx} format={(v) => `${fmt(v, 2)} m`} accent="#fbbf24" />
          <Slider label={t.py} value={py} min={0.3} max={1.6} step={0.01} onChange={setPy} format={(v) => `${fmt(v, 2)} m`} accent="#fbbf24" />
          <Slider label={t.pz} value={pz} min={1.2} max={5} step={0.02} onChange={setPz} format={(v) => `${fmt(v, 2)} m`} accent="#fbbf24" />
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Readout label={t.disparity} value={fmt(d, 1)} unit="px" />
            <Readout label={t.estDepth} value={fmt(zEst, 2)} unit="m" accent="#4ade80" />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-[13px] font-medium text-muted select-none">
            <input
              type="checkbox"
              checked={showUnc}
              onChange={(e) => setShowUnc(e.target.checked)}
              className="h-4 w-4 accent-red-400"
            />
            {t.uncToggle}
          </label>
          {showUnc && (
            <Readout
              label={t.uncRange}
              value={isFinite(zPlus) ? `${fmt(zMinus, 2)} … ${fmt(zPlus, 2)}` : `${fmt(zMinus, 2)} … ∞`}
              unit="m"
              accent="#f87171"
            />
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ImageView
          title={`${t.leftImg} - uL = ${fmt(pL.u, 0)}`}
          points={pL.z > 0 ? [{ u: pL.u, v: pL.v, color: '#fbbf24' }] : []}
          polylines={[{ pts: [[0, pL.v], [W, pL.v]], color: 'rgba(34,211,238,0.35)', width: 1, dash: '6 4' }]}
          principal={{ cx: W / 2, cy: H / 2 }}
        />
        <ImageView
          title={`${t.rightImg} - uR = ${fmt(pR.u, 0)}`}
          points={pR.z > 0 ? [{ u: pR.u, v: pR.v, color: '#fbbf24' }] : []}
          polylines={[{ pts: [[0, pR.v], [W, pR.v]], color: 'rgba(167,139,250,0.35)', width: 1, dash: '6 4' }]}
          principal={{ cx: W / 2, cy: H / 2 }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- epipolar lab

const EPI_K: Intrinsics = { fx: 520, fy: 520, s: 0, cx: W / 2, cy: H / 2 }
const EPI_TARGET: V3 = [0, 0, 2.2]
const EPI_POSE_L = lookAtCV([-0.3, 0, 0], EPI_TARGET)
const EPI_POSE_R = lookAtCV([0.3, 0, 0], EPI_TARGET)
const EPI_REL = relativePose(EPI_POSE_L, EPI_POSE_R)
const EPI_F = fundamental(EPI_K, EPI_K, EPI_REL.R, EPI_REL.t)
const EPI_E = essential(EPI_REL.R, EPI_REL.t)

/** 3D point on the LEFT camera's viewing ray of pixel (u, v), at camera-z `depth`. */
function leftRayPoint(u: number, v: number, depth: number): V3 {
  const yn = (v - EPI_K.cy) / EPI_K.fy
  const xn = (u - EPI_K.cx) / EPI_K.fx
  const CL = cameraCenter(EPI_POSE_L)
  return add(CL, scale(m3MulV(m3T(EPI_POSE_L.R), [xn, yn, 1]), depth))
}

// ---------------------------------------------------------------- bridge demo

const BRIDGE_PT = { u: 250, v: 205 }

function BridgeDemo() {
  const t = useT(T)
  const [depth, setDepth] = useState(2.2)
  const X = leftRayPoint(BRIDGE_PT.u, BRIDGE_PT.v, depth)
  const pl = projectPoint(EPI_K, EPI_POSE_L, X)
  const pr = projectPoint(EPI_K, EPI_POSE_R, X)
  const seg = useMemo(() => epipolarSegment(EPI_F, BRIDGE_PT.u, BRIDGE_PT.v, W, H), [])
  const prVisible = pr.z > 0 && pr.u >= 0 && pr.u <= W && pr.v >= 0 && pr.v <= H
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <ImageView title={t.leftImg} points={[{ u: pl.u, v: pl.v, color: '#22d3ee', r: 6 }]} />
        <ImageView
          title={t.rightImg}
          points={prVisible ? [{ u: pr.u, v: pr.v, color: '#fbbf24', r: 6 }] : []}
          polylines={seg ? [{ pts: seg, color: 'rgba(34,211,238,0.3)', width: 1.5, dash: '5 4' }] : []}
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card-pad lg:col-span-2">
          <Slider
            label={t.bridgeDepth}
            value={depth}
            min={0.9}
            max={7}
            step={0.02}
            onChange={setDepth}
            format={(v) => `${fmt(v, 2)} m`}
            accent="#fbbf24"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.bridgeLeftU} value={`(${fmt(pl.u, 0)}, ${fmt(pl.v, 0)})`} />
          <Readout label={t.bridgeRightU} value={prVisible ? fmt(pr.u, 1) : '-'} unit="px" accent="#fbbf24" />
        </div>
      </div>
    </div>
  )
}

function EpipolarLab() {
  const t = useT(T)
  const [pt, setPt] = useState<{ u: number; v: number }>({ u: 240, v: 190 })
  const [depth, setDepth] = useState(2.2)

  const seg = useMemo(() => epipolarSegment(EPI_F, pt.u, pt.v, W, H), [pt])

  const rightPt = useMemo(
    () => projectPoint(EPI_K, EPI_POSE_R, leftRayPoint(pt.u, pt.v, depth)),
    [pt, depth],
  )

  // geometry for the synced 3D epipolar-plane scene
  const X = leftRayPoint(pt.u, pt.v, depth)
  const XfarL = leftRayPoint(pt.u, pt.v, 8)
  const CL = cameraCenter(EPI_POSE_L)
  const CR = cameraCenter(EPI_POSE_R)
  const XfarR = add(CR, scale(normalize(sub(X, CR)), 8))
  const seg3d = seg
    ? seg.map(([u, v]) => pixelToWorld(EPI_K, EPI_POSE_R, u, v, 0.42))
    : null

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <ImageView
          title={`${t.leftImg} - ${t.epiDrag}`}
          points={[{ u: pt.u, v: pt.v, color: '#22d3ee', r: 7 }]}
          onDragImage={(u, v) => setPt({ u, v })}
        />
        <ImageView
          title={t.rightImg}
          points={
            rightPt.z > 0 && rightPt.u >= 0 && rightPt.u <= W && rightPt.v >= 0 && rightPt.v <= H
              ? [{ u: rightPt.u, v: rightPt.v, color: '#fbbf24', r: 6 }]
              : []
          }
          polylines={seg ? [{ pts: seg, color: '#22d3ee', width: 2 }] : []}
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card-pad">
          <Slider
            label={t.epiDepth}
            value={depth}
            min={0.9}
            max={8}
            step={0.02}
            onChange={setDepth}
            format={(v) => `${fmt(v, 2)} m`}
            accent="#fbbf24"
          />
        </div>
        <div className="card-pad">
          <div className="mb-2 text-[13px] text-muted">{t.epiF}</div>
          <MatrixView
            label={<TeX>{String.raw`F =`}</TeX>}
            values={[0, 1, 2].map((r) => [0, 1, 2].map((c) => fmtSci(EPI_F[r * 3 + c])))}
          />
          <div className="mt-3">
            <Readout
              label={t.epiConstraint}
              value={fmtSci(
                (() => {
                  const xh1: V3 = [(pt.u - EPI_K.cx) / EPI_K.fx, (pt.v - EPI_K.cy) / EPI_K.fy, 1]
                  const xh2: V3 = [(rightPt.u - EPI_K.cx) / EPI_K.fx, (rightPt.v - EPI_K.cy) / EPI_K.fy, 1]
                  const Ex = m3MulV(EPI_E, xh1)
                  return xh2[0] * Ex[0] + xh2[1] * Ex[1] + xh2[2] * Ex[2]
                })(),
              )}
              accent="#4ade80"
            />
          </div>
        </div>
      </div>
      <div className="prose-cv mt-6 max-w-3xl">
        <p>{t.epi3d}</p>
      </div>
      <Scene3D
        className="mt-4"
        height={400}
        camera={{ position: [1.7, 1.5, -1.8], fov: 45 }}
        target={[0, 0, 1.6]}
        ground={false}
        hint={t.epi3dScene}
      >
        <CameraFrustumViz k={EPI_K} w={W} h={H} pose={EPI_POSE_L} depth={0.42} color="#22d3ee" label="L" rays={false} points={[{ p: X, color: '#fbbf24' }]} />
        <CameraFrustumViz k={EPI_K} w={W} h={H} pose={EPI_POSE_R} depth={0.42} color="#a78bfa" label="R" rays={false} points={[{ p: X, color: '#fbbf24' }]} />
        <Polyline points={[CL, CR]} color="#4ade80" lineWidth={2.5} />
        <Polyline points={[CL, XfarL]} color="#22d3ee" dashed lineWidth={1.5} opacity={0.9} />
        <Polyline points={[CR, X]} color="#a78bfa" lineWidth={1.2} opacity={0.7} />
        <Quad corners={[CL, XfarL, XfarR, CR]} color="#22d3ee" opacity={0.08} />
        {seg3d && <Polyline points={[seg3d[0], seg3d[1]]} color="#22d3ee" lineWidth={3} />}
        <mesh position={X}>
          <sphereGeometry args={[0.045, 20, 20]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.4} />
        </mesh>
      </Scene3D>
    </div>
  )
}

// ---------------------------------------------------------------- rectification figure

function RectificationFigure() {
  const t = useT(T)
  const samplePts: [number, number][] = [
    [120, 90],
    [300, 150],
    [480, 100],
    [200, 300],
    [420, 360],
    [90, 420],
  ]
  const before = samplePts
    .map((p) => epipolarSegment(EPI_F, p[0], p[1], W, H))
    .filter((s): s is [[number, number], [number, number]] => s !== null)
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ImageView
        title={t.rectBefore}
        grid={false}
        polylines={before.map((pts, i) => ({
          pts,
          color: `hsl(${190 + i * 24}, 80%, 65%)`,
          width: 1.5,
        }))}
      />
      <ImageView
        title={t.rectAfter}
        grid={false}
        polylines={samplePts.map((p, i) => ({
          pts: [
            [0, p[1]],
            [W, p[1]],
          ] as [number, number][],
          color: `hsl(${190 + i * 24}, 80%, 65%)`,
          width: 1.5,
        }))}
      />
    </div>
  )
}

// ---------------------------------------------------------------- disparity → depth plot

function DepthPlot() {
  const t = useT(T)
  const [b, setB] = useState(0.12)
  const [f, setF] = useState(520)
  const [d, setD] = useState(16)

  const dMin = 4
  const dMax = 80
  const zMax = (f * b) / dMin
  const PW = 560
  const PH = 300
  const mx = (dd: number) => 56 + ((dd - dMin) / (dMax - dMin)) * (PW - 76)
  const my = (z: number) => PH - 36 - (z / zMax) * (PH - 56)

  const curve = Array.from({ length: 120 }, (_, i) => {
    const dd = dMin + (i / 119) * (dMax - dMin)
    return `${mx(dd)},${my((f * b) / dd)}`
  }).join(' ')

  const zCur = (f * b) / d
  const dz = (f * b) / (d * d)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">
          {t.depthCurve} - Z = f·b / d
        </div>
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          {/* axes */}
          <line x1={56} y1={PH - 36} x2={PW - 16} y2={PH - 36} stroke="rgba(255,255,255,0.3)" />
          <line x1={56} y1={20} x2={56} y2={PH - 36} stroke="rgba(255,255,255,0.3)" />
          {[20, 40, 60, 80].map((dd) => (
            <g key={dd}>
              <line x1={mx(dd)} y1={PH - 36} x2={mx(dd)} y2={PH - 32} stroke="rgba(255,255,255,0.4)" />
              <text x={mx(dd)} y={PH - 18} fill="#8b93a7" fontSize={11} textAnchor="middle">
                {dd}px
              </text>
            </g>
          ))}
          {[0.25, 0.5, 0.75, 1].map((fr) => (
            <g key={fr}>
              <line x1={52} y1={my(zMax * fr)} x2={56} y2={my(zMax * fr)} stroke="rgba(255,255,255,0.4)" />
              <text x={46} y={my(zMax * fr) + 4} fill="#8b93a7" fontSize={11} textAnchor="end">
                {fmt(zMax * fr, 1)}m
              </text>
            </g>
          ))}
          <polyline points={curve} fill="none" stroke="#22d3ee" strokeWidth={2.5} />
          {/* marker */}
          <line x1={mx(d)} y1={PH - 36} x2={mx(d)} y2={my(zCur)} stroke="rgba(251,191,36,0.5)" strokeDasharray="4 3" />
          <line x1={56} y1={my(zCur)} x2={mx(d)} y2={my(zCur)} stroke="rgba(251,191,36,0.5)" strokeDasharray="4 3" />
          <circle cx={mx(d)} cy={my(zCur)} r={6} fill="#fbbf24" stroke="#0a0e17" strokeWidth={2} />
        </svg>
      </div>
      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.baseline} value={b} min={0.04} max={0.4} step={0.005} onChange={setB} format={(v) => `${fmt(v * 100, 1)} cm`} accent="#4ade80" />
          <Slider label={t.focal} value={f} min={300} max={900} step={5} onChange={setF} format={(v) => `${v} px`} />
          <Slider label={t.dSlider} value={d} min={dMin} max={dMax} step={0.5} onChange={setD} format={(v) => `${fmt(v, 1)} px`} accent="#fbbf24" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.depthAt} value={fmt(zCur, 2)} unit="m" />
          <Readout label={t.depthRes} value={`±${fmt(dz * 100, 1)}`} unit="cm" accent={dz < 0.05 ? '#4ade80' : dz < 0.2 ? '#fbbf24' : '#f87171'} />
        </div>
        <TeX block>{String.raw`Z = \frac{f\,b}{d}, \qquad \Delta Z \approx \frac{Z^2}{f\,b}\,\Delta d`}</TeX>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- disparity lab

const DISP_COLORS: [number, [number, number, number]][] = [
  [0.0, [16, 24, 48]],
  [0.3, [23, 90, 130]],
  [0.55, [34, 211, 238]],
  [0.8, [251, 191, 36]],
  [1.0, [248, 113, 113]],
]

function dispColor(t2: number): [number, number, number] {
  const tt = Math.min(1, Math.max(0, t2))
  for (let i = 1; i < DISP_COLORS.length; i++) {
    if (tt <= DISP_COLORS[i][0]) {
      const [t0, c0] = DISP_COLORS[i - 1]
      const [t1, c1] = DISP_COLORS[i]
      const u = (tt - t0) / (t1 - t0)
      return [0, 1, 2].map((k) => Math.round(c0[k] + u * (c1[k] - c0[k]))) as [number, number, number]
    }
  }
  return DISP_COLORS[DISP_COLORS.length - 1][1]
}

function StereoCanvas({
  pixels,
  title,
  onPick,
}: {
  pixels: (i: number) => [number, number, number]
  title: string
  onPick?: (x: number, y: number) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(SM_W, SM_H)
    for (let i = 0; i < SM_W * SM_H; i++) {
      const [r, g, b] = pixels(i)
      img.data[i * 4] = r
      img.data[i * 4 + 1] = g
      img.data[i * 4 + 2] = b
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [pixels])
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{title}</div>
      <canvas
        ref={ref}
        width={SM_W}
        height={SM_H}
        className="block w-full"
        style={{ imageRendering: 'pixelated', cursor: onPick ? 'crosshair' : undefined, aspectRatio: `${SM_W}/${SM_H}` }}
        onPointerDown={(e) => {
          if (!onPick) return
          const rect = (e.target as HTMLElement).getBoundingClientRect()
          onPick(
            Math.floor(((e.clientX - rect.left) / rect.width) * SM_W),
            Math.floor(((e.clientY - rect.top) / rect.height) * SM_H),
          )
        }}
      />
    </div>
  )
}

function DisparityLab() {
  const t = useT(T)
  const [win, setWin] = useState(9)
  const [texture, setTexture] = useState(0.8)
  const [noise, setNoise] = useState(0)
  const [metric, setMetric] = useState<'sad' | 'ssd'>('sad')
  const [view, setView] = useState<'est' | 'gt' | 'err'>('est')
  const [probe, setProbe] = useState<{ x: number; y: number } | null>({ x: 24, y: 32 })

  const scene = useMemo(() => makeStereoPair(texture, noise, 42), [texture, noise])
  const match = useMemo(() => blockMatch(scene, win, metric), [scene, win, metric])
  const stats = useMemo(() => dispStats(match.disp, scene, win), [match, scene, win])
  const curve = useMemo(
    () => (probe ? costCurve(scene, probe.x, probe.y, win, metric) : null),
    [scene, probe, win, metric],
  )

  const grayPix = (src: Float32Array) => (i: number): [number, number, number] => {
    const v = Math.round(src[i] * 255)
    return [v, v, v]
  }
  const dispPix = (i: number): [number, number, number] => {
    if (view === 'err') {
      const e = Math.min(Math.abs(match.disp[i] - scene.trueDisp[i]) / 6, 1)
      return [Math.round(40 + e * 208), 40, 48]
    }
    const d = view === 'gt' ? scene.trueDisp[i] : match.disp[i]
    let c = dispColor(d / SM_MAXD)
    if (scene.occluded[i] && (Math.floor(i / SM_W) + (i % SM_W)) % 4 === 0) c = [90, 90, 110]
    return c
  }

  const chosen = probe ? match.disp[probe.y * SM_W + probe.x] : 0
  const trueD = probe ? scene.trueDisp[probe.y * SM_W + probe.x] : 0

  const CW = 460
  const CH = 170
  const cmax = curve ? Math.max(...curve, 1e-6) : 1
  const cx2 = (d: number) => 10 + (d / SM_MAXD) * (CW - 20)
  const cy2 = (c: number) => CH - 22 - (c / cmax) * (CH - 40)

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-3">
        <StereoCanvas pixels={grayPix(scene.left)} title={t.matchLeftT} />
        <StereoCanvas pixels={grayPix(scene.right)} title={t.matchRightT} />
        <StereoCanvas pixels={dispPix} title={t.matchDispT} onPick={(x, y) => setProbe({ x, y })} />
      </div>
      <div className="mt-1 text-[12px] text-muted">{t.matchOccNote}</div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.matchWin} value={win} min={3} max={15} step={2} onChange={setWin} format={(v) => `${v}×${v}`} />
          <Slider label={t.matchTex} value={texture} min={0} max={1} step={0.05} onChange={setTexture} format={(v) => `${fmt(v * 100, 0)} %`} accent="#a78bfa" />
          <Slider label={t.matchNoise} value={noise} min={0} max={0.1} step={0.005} onChange={setNoise} format={(v) => fmt(v, 3)} accent="#fbbf24" />
          <div className="flex flex-wrap gap-4">
            <div>
              <div className="mb-1.5 text-[12px] text-muted">{t.matchMetric}</div>
              <Segmented
                options={[
                  { value: 'sad', label: 'SAD' },
                  { value: 'ssd', label: 'SSD' },
                ]}
                value={metric}
                onChange={setMetric}
              />
            </div>
            <div>
              <div className="mb-1.5 text-[12px] text-muted">{t.matchView}</div>
              <Segmented options={t.matchViewNames} value={view} onChange={(v) => setView(v as 'est' | 'gt' | 'err')} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Readout label={t.matchMed} value={fmt(stats.medianErr, 2)} unit="px" accent={stats.medianErr < 1 ? '#4ade80' : '#f87171'} />
            <Readout label={t.matchBad} value={fmt(stats.badPct, 1)} unit="%" accent={stats.badPct < 10 ? '#4ade80' : '#fbbf24'} />
            <Readout label={t.matchMs} value={fmt(match.ms, 1)} unit="ms" accent={match.ms < 20 ? '#4ade80' : undefined} />
          </div>
        </div>
        <div className="card overflow-hidden self-start">
          <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">
            {probe ? `${t.matchProbe} · (${probe.x}, ${probe.y})` : t.matchProbeHint}
          </div>
          {curve && (
            <svg viewBox={`0 0 ${CW} ${CH}`} className="block w-full">
              <polyline points={curve.map((c, d) => `${cx2(d)},${cy2(c)}`).join(' ')} fill="none" stroke="#22d3ee" strokeWidth={1.8} />
              <line x1={cx2(trueD)} y1={12} x2={cx2(trueD)} y2={CH - 22} stroke="#4ade80" strokeDasharray="4 3" strokeWidth={1.5} />
              <circle cx={cx2(chosen)} cy={cy2(curve[Math.round(chosen)])} r={5} fill="#fbbf24" />
              <text x={CW - 8} y={CH - 6} textAnchor="end" fill="#8b93a7" fontSize={10.5} fontFamily="JetBrains Mono, monospace">
                d →
              </text>
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- application: forklift rig designer

const DISP_MIN = 5 // px
const ZERR_MAX = 0.05 // m

function StereoRigLab() {
  const t = useT(T)
  const [b, setB] = useState(0.12)
  const [f, setF] = useState(700)
  const [range, setRange] = useState(6)

  const d = (f * b) / range // disparity at range (px)
  // depth error for ±0.5 px disparity noise
  const zNear = (f * b) / (d + 0.5)
  const zFar = d > 0.5 ? (f * b) / (d - 0.5) : Infinity
  const zErr = Math.max(zFar - range, range - zNear)
  const okDisp = d >= DISP_MIN
  const okRes = zErr <= ZERR_MAX
  const pass = okDisp && okRes

  const PW = 560
  const PH = 210
  const groundY = PH - 42
  const sx = (z: number) => 60 + (z / 12) * (PW - 90)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          {/* floor */}
          <line x1={0} y1={groundY} x2={PW} y2={groundY} stroke="#2a3245" strokeWidth={2} />
          {/* forklift body */}
          <rect x={8} y={groundY - 58} width={44} height={58} rx={5} fill="#1c2333" stroke="#38445c" />
          <rect x={50} y={groundY - 34} width={8} height={34} fill="#38445c" />
          <circle cx={22} cy={groundY} r={9} fill="#0a0e17" stroke="#38445c" strokeWidth={2} />
          <circle cx={44} cy={groundY} r={9} fill="#0a0e17" stroke="#38445c" strokeWidth={2} />
          {/* stereo head: two cameras separated by baseline (exaggerated vertically for visibility) */}
          <rect x={26 - Math.max(b * 90, 10) / 2} y={groundY - 74} width={Math.max(b * 90, 10)} height={12} rx={3} fill="#22d3ee22" stroke="#22d3ee" />
          <circle cx={26 - Math.max(b * 90, 10) / 2 + 3} cy={groundY - 68} r={2.5} fill="#22d3ee" />
          <circle cx={26 + Math.max(b * 90, 10) / 2 - 3} cy={groundY - 68} r={2.5} fill="#22d3ee" />
          {/* FOV wedge to obstacle */}
          <path
            d={`M 30 ${groundY - 68} L ${sx(range)} ${groundY - 26} L ${sx(range)} ${groundY} Z`}
            fill={pass ? '#4ade8011' : '#f8717111'}
            stroke={pass ? '#4ade8055' : '#f8717155'}
            strokeDasharray="4 4"
          />
          {/* obstacle at range */}
          <rect x={sx(range) - 7} y={groundY - 14} width={14} height={14} rx={2} fill={pass ? '#4ade80' : '#f87171'} />
          <text x={sx(range)} y={groundY + 16} textAnchor="middle" fill="#8b93a7" fontSize={10.5} fontFamily="JetBrains Mono, monospace">
            {fmt(range, 1)} m
          </text>
          {/* depth uncertainty bracket */}
          {Number.isFinite(zFar) && (
            <>
              <line x1={sx(Math.max(zNear, 0))} y1={groundY - 26} x2={sx(Math.min(zFar, 12))} y2={groundY - 26} stroke="#fbbf24" strokeWidth={3} strokeLinecap="round" />
              <text x={sx(range)} y={groundY - 33} textAnchor="middle" fill="#fbbf24" fontSize={10.5} fontFamily="JetBrains Mono, monospace">
                ±{fmt(zErr * 100, 1)} cm
              </text>
            </>
          )}
          <text x={PW - 10} y={16} textAnchor="end" fill={pass ? '#4ade80' : '#f87171'} fontSize={13} fontWeight={700} fontFamily="JetBrains Mono, monospace">
            {pass ? `✓ ${t.appPass}` : `✗ ${t.appFail}`}
          </text>
        </svg>
        <div className="border-t border-white/10 px-4 py-2.5 text-[12.5px] text-muted">
          {pass ? t.appPassWhy : !okDisp ? t.appFailDisp : t.appFailRes}
        </div>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.appBase} value={b} min={0.03} max={0.4} step={0.01} onChange={setB} format={(v) => `${fmt(v * 100, 0)} cm`} />
          <Slider label={t.appFocal} value={f} min={300} max={1600} step={25} onChange={setF} format={(v) => `${v} px`} accent="#a78bfa" />
          <Slider label={t.appRange} value={range} min={2} max={11} step={0.5} onChange={setRange} format={(v) => `${fmt(v, 1)} m`} accent="#fbbf24" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.appDisp} value={fmt(d, 1)} unit="px" accent={okDisp ? '#4ade80' : '#f87171'} />
          <Readout label={t.appRes} value={`±${fmt(zErr * 100, 1)}`} unit="cm" accent={okRes ? '#4ade80' : '#f87171'} />
        </div>
        <div className="card-pad">
          <TeX block>{`d = \\frac{f\\,b}{Z} = \\frac{${fmt(f, 0)}\\cdot${fmt(b, 2)}}{${fmt(range, 1)}} = ${fmt(d, 1)}\\,\\text{px}`}</TeX>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function StereoPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'bridge', label: t.bridgeTitle },
          { id: 'triangulation', label: t.triTitle },
          { id: 'stereo-calib', label: t.calibTitle },
          { id: 'epipolar', label: t.epiTitle },
          { id: 'rectification', label: t.rectTitle },
          { id: 'depth', label: t.depthTitle },
          { id: 'matching', label: t.matchTitle },
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
        <div className="mt-4">
          <BridgeDemo />
        </div>
        <div className="prose-cv mt-4 max-w-3xl">
          <p>{t.bridge2}</p>
        </div>
        <InfoBox tone="tip" title="💡">
          {t.tipParallax}
        </InfoBox>
      </Section>

      <Section id="triangulation" title={t.triTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.tri1}</p>
        </div>
        <div className="mt-4">
          <TriangulationLab />
        </div>
        <div className="prose-cv mt-4 max-w-3xl">
          <p>{t.uncText}</p>
          <p>{t.depthFormula}</p>
          <TeX block>{String.raw`d = u_L - u_R = \frac{f\,b}{Z} \quad\Longleftrightarrow\quad Z = \frac{f\,b}{d}`}</TeX>
        </div>
        <Derivation title={t.depthDerivTitle} steps={t.depthDeriv} />
        <InfoBox title="⚡ Try it">
          <ul className="my-1 list-disc space-y-1 pl-5">
            {t.triTry.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </InfoBox>
      </Section>

      <Section id="stereo-calib" title={t.calibTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.calib1}</p>
          <p>{t.calib2}</p>
          <TeX block>{String.raw`E = [\mathbf{t}]_\times R, \qquad F = K_2^{-\mathsf T} E\, K_1^{-1}, \qquad \tilde{\mathbf{x}}_2^{\mathsf T} F\, \tilde{\mathbf{x}}_1 = 0`}</TeX>
        </div>
        <Derivation title={t.essDerivTitle} steps={t.essDeriv} />
        <div className="card mt-4 max-w-2xl overflow-hidden">
          <div className="border-b border-white/10 px-4 py-2 text-[13px] font-semibold">{t.efTitle}</div>
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-muted">
                {t.efHead.map((h, i) => (
                  <th key={i} className="px-4 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.efRows.map((row, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2 text-muted">{row[0]}</td>
                  <td className="px-4 py-2 text-accent">{row[1]}</td>
                  <td className="px-4 py-2 text-accent2">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="epipolar" title={t.epiTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.epi1}</p>
          <p>{t.epi2}</p>
        </div>
        <div className="mt-4">
          <EpipolarLab />
        </div>
      </Section>

      <Section id="rectification" title={t.rectTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.rect1}</p>
        </div>
        <div className="mt-4">
          <RectificationFigure />
        </div>
      </Section>

      <Section id="depth" title={t.depthTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.depth1}</p>
        </div>
        <div className="mt-4">
          <DepthPlot />
        </div>
      </Section>

      <Section id="matching" title={t.matchTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.match1}</p>
          <ul>
            {t.matchList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p>{t.matchLab1}</p>
        </div>
        <div className="mt-4">
          <DisparityLab />
        </div>
        <div className="prose-cv mt-4 max-w-3xl">
          <p>{t.matchLab2}</p>
        </div>
      </Section>

      <Section id="application" title={t.appTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.appIntro}</p>
        </div>
        <div className="mt-4">
          <StereoRigLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
