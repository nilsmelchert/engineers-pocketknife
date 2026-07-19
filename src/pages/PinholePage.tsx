import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { MatrixView } from '../components/MatrixView'
import { ImageView, type ImagePoint } from '../components/ImageView'
import { PageToc } from '../components/PageToc'
import { Derivation } from '../components/Derivation'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import { AxesTriad, CameraFrustumViz, Polyline, Scene3D } from '../components/three/helpers'
import {
  add,
  cameraCenter,
  deg2rad,
  fmt,
  fmtSci,
  lookAtCV,
  m3Inv,
  m3Mul,
  m3MulV,
  m3T,
  norm,
  pMat,
  projectPoint,
  rad2deg,
  scale,
  sub,
  type Intrinsics,
  type M3,
  type Pose,
  type V3,
} from '../lib/math'
import { makeGauss } from '../lib/stats'
import { applyH, homographyDLT, homographyRms, pnpRefine, poseFromHomography, type P2 } from '../lib/homography'

const W = 640
const H = 480

const HOUSE_PTS: { p: V3; color: string }[] = [
  { p: [-0.5, 0.02, -0.5], color: '#f87171' },
  { p: [0.5, 0.02, -0.5], color: '#fb923c' },
  { p: [0.5, 0.02, 0.5], color: '#fbbf24' },
  { p: [-0.5, 0.02, 0.5], color: '#a3e635' },
  { p: [-0.5, 0.82, -0.5], color: '#4ade80' },
  { p: [0.5, 0.82, -0.5], color: '#2dd4bf' },
  { p: [0.5, 0.82, 0.5], color: '#38bdf8' },
  { p: [-0.5, 0.82, 0.5], color: '#818cf8' },
  { p: [0, 1.25, -0.5], color: '#c084fc' },
  { p: [0, 1.25, 0.5], color: '#f472b6' },
]

const HOUSE_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
  [4, 8], [5, 8], [6, 9], [7, 9],
  [8, 9],
]

const TARGET: V3 = [0, 0.6, 0]

const T = {
  en: {
    kicker: 'Vision · Module 1',
    title: 'The Pinhole Camera & the Camera Matrix',
    intro:
      'Every camera answers one question: which pixel does a 3D point land on? This module builds that answer step by step - from a ray of light through a pinhole to the famous 3×4 projection matrix P = K[R|t].',
    s1Title: 'From the world to an image',
    s1a: 'A camera maps points from the 3D world onto a 2D sensor. That mapping loses one dimension - depth - and everything in these modules revolves around describing, calibrating and finally inverting parts of this projection.',
    s1b: 'The full pipeline consists of two independent stages:',
    s1Steps: [
      ['World point', 'X_w = (X, Y, Z)'],
      ['Extrinsics [R|t]', 'rigid motion into the camera frame'],
      ['Projection ÷Z', 'perspective division onto the image plane'],
      ['Intrinsics K', 'from metric image plane to pixels'],
      ['Pixel', '(u, v)'],
    ],
    s2Title: 'The pinhole model',
    s2a: 'Imagine a lightproof box with an infinitely small hole. Every world point sends exactly one ray through that hole and marks one spot on the back wall - a perfectly sharp, inverted image. Real lenses only approximate this ideal, but the geometry is the same.',
    s2b: 'By similar triangles, a point at lateral offset X and depth Z (in the camera frame) hits the image plane at distance f behind the pinhole at:',
    s2c: 'In practice we use the virtual image plane in front of the pinhole - same geometry, but the image is upright. Note what the division by Z does: it is the entire reason far objects look small, and it is nonlinear. All depth information collapses.',
    diagram: {
      pinhole: 'pinhole',
      imagePlane: 'virtual image plane',
      sensor: 'sensor (inverted)',
      object: 'object',
      axis: 'optical axis',
    },
    s3Title: 'Interactive: projection lab',
    s3a: 'A camera observes a small house of colored points. The left view shows the 3D setup - the image plane is drawn at its true size given the intrinsics. The right view is the image the sensor actually records. Every slider immediately updates the matrices below.',
    s3Try: [
      'Increase the focal length f - the frustum narrows and the image zooms in (a telephoto lens).',
      'Move the principal point cx, cy - the whole image shifts, because it moves the sensor origin relative to the optical axis.',
      'Add skew s - the image shears. Modern sensors have s ≈ 0; it is kept in K mostly for historical generality.',
      'Orbit the camera (azimuth / elevation / distance) - only [R|t] changes, K stays fixed. Intrinsics belong to the camera, extrinsics to its pose.',
    ],
    labScene: '3D scene - drag to orbit, scroll to zoom',
    labImage: 'Sensor image (what the camera sees)',
    intrTitle: 'Intrinsics (camera-internal)',
    extrTitle: 'Extrinsics (camera pose)',
    focal: 'focal length f',
    aspect: 'aspect fy / fx',
    skew: 'skew s',
    ppx: 'principal point cx',
    ppy: 'principal point cy',
    az: 'azimuth',
    el: 'elevation',
    dist: 'distance',
    hfov: 'horizontal FOV',
    vfov: 'vertical FOV',
    dolly: 'lock subject size (dolly zoom)',
    dollyText:
      'With the lock on, pulling the camera back automatically raises f so the house keeps its size in the image - and yet the image still changes: perspective (how much bigger near parts look than far parts) depends on the camera position, while f only magnifies. Filmmakers call this the dolly zoom or “Vertigo effect”. It also previews a calibration pitfall: for a flat, frontal subject, f and distance are almost interchangeable - module 2 shows how tilted views break that ambiguity.',
    stepTitle: 'Follow one point through the pipeline',
    stepIntro:
      'Numbers make the pipeline concrete. Pick a house point and watch its coordinates transform stage by stage - every slider in the lab above updates these numbers live. Notice that exactly one arrow is nonlinear: the division by the depth Z꜀.',
    stepPick: 'Pick a point:',
    stWorld: 'world point',
    stWorldSub: 'Xw  (m)',
    stCam: 'camera frame',
    stCamSub: 'Xc = R·Xw + t  (m)',
    stNorm: 'image plane',
    stNormSub: '(xn, yn) = (Xc/Zc, Yc/Zc)',
    stPix: 'pixel',
    stPixSub: '(u, v)  (px)',
    depthTitle: 'What projection destroys: depth',
    depthText:
      'Slide the orange point along its viewing ray. In 3D it clearly moves - closer to the camera, farther away. But its pixel does not change at all: every point on the ray produces exactly the same image. A single camera cannot tell these points apart; the division by Z has collapsed the depth dimension. Recovering it needs extra knowledge: a known object size, structured light - or a second camera.',
    depthSlider: 'position along the ray',
    depthDist: 'distance from camera',
    depthPixel: 'pixel (u, v)',
    depthNote:
      'This ambiguity is the reason stereo vision exists - and the viewing ray you are sliding along will return in module 4 as the epipolar line of this pixel.',
    tipK: 'A way to remember the split: [R|t] is the tripod (where the camera stands and points), the division by Z paints the world onto a canvas one unit in front of the lens, and K is the ruler that measures this canvas in pixels. Everything camera-specific lives in K; everything about the viewpoint in [R|t].',
    appTitle: '🏭 In the real world: how far is that car?',
    appIntro:
      'Every driver-assistance system with a mono camera answers a distance question dozens of times per second - with exactly the formula of this module, run backwards. A car is about 1.5 m tall; if its image is h pixels tall, then Z = f·H/h. The catch: the sensor measures h only to about ±1 pixel. Slide the car away and watch the estimate wobble - at long range one pixel is worth many meters, which is why mono ADAS systems fuse with radar.',
    appZ: 'true distance',
    appF: 'focal length f',
    appHpx: 'car height in image',
    appZest: 'estimated distance (±1 px)',
    appErr: 'worst-case error',
    appWhere:
      'The same inverse projection meters distances in football broadcast graphics, estimates crowd sizes from drone photos, and sizes craters on Mars from orbiter images - anywhere one known dimension turns pixels into meters.',
    matricesTitle: 'The matrices, live',
    matricesNote:
      'P projects homogeneous world points to homogeneous pixels: λ·(u,v,1)ᵀ = P·(X,Y,Z,1)ᵀ. The λ that gets divided away is exactly the depth in the camera frame.',
    s4Title: 'Anatomy of the intrinsic matrix K',
    s4a: 'K converts metric coordinates on the image plane into pixel coordinates. It contains everything that is internal to the camera - lens and sensor, independent of where the camera stands:',
    s4list: [
      'fx, fy - focal length in pixels: the metric focal length divided by the pixel size. fx ≠ fy iff pixels are not square.',
      'cx, cy - the principal point: the pixel where the optical axis pierces the sensor. Usually near the image center, rarely exactly.',
      's - skew between the pixel axes. For virtually all modern cameras s = 0.',
    ],
    s4b: 'A useful consequence: focal length and field of view are two views of the same thing.',
    s5Title: 'Extrinsics: where the camera stands',
    s5a: 'The extrinsic parameters are a rigid transform that expresses world points in the camera frame: rotation R (3×3, orthonormal, 3 degrees of freedom) and translation t (3 DoF). Note that t is not the camera position - the camera center is C = −Rᵀt.',
    s5b: 'The camera frame follows the computer-vision convention: x right, y down, z forward through the lens. That is why the y axis in pixel coordinates points downward.',
    s6Title: 'Putting it together: P = K[R|t]',
    s6a: 'Chaining both stages gives a single 3×4 matrix acting on homogeneous coordinates. Homogeneous coordinates are the trick that turns the nonlinear division by Z into linear algebra - the division is postponed to the very last step:',
    s6b: 'Count the degrees of freedom: 5 in K (or 4 with s = 0) + 3 rotation + 3 translation = 11 - matching a 3×4 matrix up to scale. Camera calibration (module 2) is precisely the task of estimating these numbers.',
    dofChips: ['K: 5 DoF', 'R: 3 DoF', 't: 3 DoF', 'P: 11 DoF (up to scale)'],
    homTitle: 'When the world is flat: the homography',
    hom1: 'Set Z = 0 in the projection and something remarkable happens: the 3×4 matrix P loses a column and collapses into an invertible 3×3 matrix H - the homography. For any planar scene (a floor, a wall, a calibration board), the mapping between plane and image is a plain matrix, and unlike P it can be run BACKWARDS: H⁻¹ turns pixels back into meters. Below, a camera looks obliquely at a floor grid. From a handful of point correspondences the homography is estimated live (with the same least-squares machinery as everything else on this site) - and the right panel uses H⁻¹ to un-warp the perspective view into a metric top-down map.',
    hom2: 'Play with the noise and the number of correspondences: 4 points determine H exactly (8 equations, 8 unknowns) but inherit every pixel of noise; more points average it away. This exact estimate-H-then-invert loop is how sports broadcasts paint lines on the pitch, how parking cameras compute bird’s-eye views - and how camera calibration begins (module 2).',
    homNPts: 'correspondences',
    homNoise: 'detection noise σ',
    homRms: 'warp RMS',
    homRecon: 'top-down error',
    homLeft: 'camera view - detected plane points',
    homRight: 'metric top-down view - H⁻¹ applied to the detections',
    homTry: [
      'Set 4 correspondences and σ = 1.5 px: the reconstruction visibly shears - with zero redundancy, H chases the noise.',
      'Switch to 35 correspondences: same noise, but the grid snaps back - least squares averages 70 equations over 8 unknowns.',
      'Steepen the tilt: pixels near the horizon cover more meters, so the same pixel noise costs more metric accuracy at the far edge.',
    ],
    homDerivTitle: 'From P to H, step by step',
    homDeriv: [
      { tex: String.raw`\lambda\tilde{\mathbf{x}} = K[R\,|\,\mathbf{t}]\begin{bmatrix}X\\Y\\0\\1\end{bmatrix} = K[\mathbf{r}_1\;\mathbf{r}_2\;\mathbf{t}]\begin{bmatrix}X\\Y\\1\end{bmatrix}`, note: 'Points on the plane Z = 0 never touch the third rotation column r₃ - the 3×4 projection collapses to a 3×3 matrix.' },
      { tex: String.raw`H = K[\mathbf{r}_1\;\mathbf{r}_2\;\mathbf{t}], \qquad \tilde{\mathbf{x}} \sim H\begin{bmatrix}X\\Y\\1\end{bmatrix}`, note: 'H has 9 entries but only 8 degrees of freedom - the overall scale cancels in the homogeneous division.' },
      { tex: String.raw`u = \frac{h_1 X + h_2 Y + h_3}{h_7 X + h_8 Y + h_9}, \quad v = \frac{h_4 X + h_5 Y + h_6}{h_7 X + h_8 Y + h_9}`, note: 'Cross-multiplying each equation makes it LINEAR in the entries of H: every correspondence contributes two linear equations.' },
      { tex: String.raw`\mathbf{h}^\star = \arg\min_{\|\mathbf{h}\|=1} \|A\mathbf{h}\|^2 \;=\; \text{smallest eigenvector of } A^{\mathsf T}A`, note: 'Stack ≥4 correspondences into A (2N×9) and take the least-squares null vector - the classic Direct Linear Transform (DLT).' },
      { tex: String.raw`\hat{\mathbf{x}} = T'\tilde{\mathbf{x}}, \quad \hat{\mathbf{X}} = T\tilde{\mathbf{X}} \quad\text{(center + scale to } \sqrt{2}\text{)}`, note: 'One practical trap: at raw pixel scale AᵀA is numerically ill-conditioned. Normalizing both point sets first (Hartley) fixes it - this lab does exactly that.' },
    ],
    pnpTitle: 'Where am I? Pose from one image (PnP)',
    pnp1: 'Flip the question of this module on its head: the intrinsics K are known, the 3D shape of the house is known - but where does the camera stand? That is the Perspective-n-Point problem, and it is how AR headsets anchor content, how robots localize against known parts, and how every marker tracker works. Watch it solve live: the amber reprojections of the current pose guess are pulled onto the cyan detections, and in the 3D view the estimated camera glides into the true one.',
    pnp2: 'The solver is the Gauss-Newton loop from module 3, run over just 6 numbers (3 rotation, 3 translation): linearize the reprojection error about the current pose, solve the normal equations, step, repeat. The starting guess comes from the homography of the house’s floor square - planar geometry bootstraps full 3D pose.',
    pnpInit: 'Init from homography',
    pnpStep: 'Iterate',
    pnpRun: 'Auto-run',
    pnpReset: 'Reset',
    pnpNoise: 'detection noise σ',
    pnpNPts: 'points used',
    pnpRms: 'reprojection RMS',
    pnpPosErr: 'position error',
    pnpRotErr: 'rotation error',
    pnpIter: 'iteration',
    pnpLeft: 'camera image - detections (cyan) vs. current-pose reprojections (amber)',
    pnpRight: '3D - true camera (gray) vs. estimated camera (cyan)',
    pnpDerivTitle: 'The PnP normal equations',
    pnpDeriv: [
      { tex: String.raw`\text{unknowns: } (R, \mathbf{t}) \;\;\hat{=}\;\; 6 \text{ DoF}, \qquad \text{each point} \Rightarrow 2 \text{ equations}`, note: 'Three points already suffice in principle (P3P has closed-form solutions); real systems use more points plus least squares.' },
      { tex: String.raw`\mathbf{r}_i(\boldsymbol{\theta}) = \pi\big(K(R\mathbf{X}_i + \mathbf{t})\big) - \mathbf{x}_i`, note: 'The residual is the reprojection error of point i - exactly the quantity module 2 minimizes, but now over the pose instead of over K.' },
      { tex: String.raw`R \leftarrow R\,\exp([\boldsymbol{\omega}]_\times), \qquad \mathbf{t} \leftarrow \mathbf{t} + \delta\mathbf{t}`, note: 'Rotations are updated multiplicatively with a small axis-angle vector ω - the standard trick to optimize on the rotation group without breaking orthonormality.' },
      { tex: String.raw`(J^{\mathsf T}J)\,\boldsymbol{\delta} = -J^{\mathsf T}\mathbf{r}`, note: 'Linearize, form the 6×6 normal equations, solve, step - the Gauss-Newton core of module Vision·3, in its smallest natural habitat.' },
      { tex: String.raw`\text{AR anchors} \cdot \text{robot picking} \cdot \text{marker tracking} \cdot \text{camera relocalization}`, note: 'cv2.solvePnP ships exactly this (plus P3P/EPnP initializers and RANSAC wrappers for outliers - module Data·4).' },
    ],
  },
  de: {
    kicker: 'Vision · Modul 1',
    title: 'Die Lochkamera & die Kameramatrix',
    intro:
      'Jede Kamera beantwortet eine Frage: Auf welchem Pixel landet ein 3D-Punkt? Dieses Modul baut die Antwort Schritt für Schritt auf - vom Lichtstrahl durch eine Lochblende bis zur berühmten 3×4-Projektionsmatrix P = K[R|t].',
    s1Title: 'Von der Welt zum Bild',
    s1a: 'Eine Kamera bildet Punkte der 3D-Welt auf einen 2D-Sensor ab. Dabei geht eine Dimension verloren - die Tiefe - und alles in diesen Modulen dreht sich darum, diese Projektion zu beschreiben, zu kalibrieren und teilweise wieder umzukehren.',
    s1b: 'Die gesamte Pipeline besteht aus zwei unabhängigen Stufen:',
    s1Steps: [
      ['Weltpunkt', 'X_w = (X, Y, Z)'],
      ['Extrinsik [R|t]', 'Starrkörpertransformation ins Kamerasystem'],
      ['Projektion ÷Z', 'perspektivische Division auf die Bildebene'],
      ['Intrinsik K', 'von der metrischen Bildebene zu Pixeln'],
      ['Pixel', '(u, v)'],
    ],
    s2Title: 'Das Lochkameramodell',
    s2a: 'Man stelle sich eine lichtdichte Box mit einem unendlich kleinen Loch vor. Jeder Weltpunkt schickt genau einen Strahl durch dieses Loch und markiert einen Punkt auf der Rückwand - ein perfekt scharfes, auf dem Kopf stehendes Bild. Echte Objektive nähern dieses Ideal nur an, die Geometrie ist aber dieselbe.',
    s2b: 'Über ähnliche Dreiecke trifft ein Punkt mit seitlichem Versatz X und Tiefe Z (im Kamerasystem) die Bildebene im Abstand f hinter der Lochblende bei:',
    s2c: 'In der Praxis rechnet man mit der virtuellen Bildebene vor der Lochblende - gleiche Geometrie, aber aufrechtes Bild. Wichtig ist, was die Division durch Z bewirkt: Sie ist der Grund, warum ferne Objekte klein erscheinen, und sie ist nichtlinear. Die gesamte Tiefeninformation kollabiert.',
    diagram: {
      pinhole: 'Lochblende',
      imagePlane: 'virtuelle Bildebene',
      sensor: 'Sensor (invertiert)',
      object: 'Objekt',
      axis: 'optische Achse',
    },
    s3Title: 'Interaktiv: Projektionslabor',
    s3a: 'Eine Kamera beobachtet ein kleines Haus aus farbigen Punkten. Links die 3D-Szene - die Bildebene ist in ihrer echten, durch die Intrinsik bestimmten Größe gezeichnet. Rechts das Bild, das der Sensor tatsächlich aufnimmt. Jeder Slider aktualisiert sofort die Matrizen darunter.',
    s3Try: [
      'Brennweite f erhöhen - das Frustum wird schmaler und das Bild zoomt hinein (Teleobjektiv).',
      'Hauptpunkt cx, cy verschieben - das ganze Bild wandert, weil sich der Sensorursprung relativ zur optischen Achse verschiebt.',
      'Scherung s hinzufügen - das Bild wird geschert. Moderne Sensoren haben s ≈ 0; der Parameter steht vor allem aus historischen Gründen in K.',
      'Kamera orbitieren (Azimut / Elevation / Abstand) - nur [R|t] ändert sich, K bleibt fest. Intrinsik gehört zur Kamera, Extrinsik zu ihrer Pose.',
    ],
    labScene: '3D-Szene - ziehen zum Orbiten, scrollen zum Zoomen',
    labImage: 'Sensorbild (was die Kamera sieht)',
    intrTitle: 'Intrinsik (kameraintern)',
    extrTitle: 'Extrinsik (Kamerapose)',
    focal: 'Brennweite f',
    aspect: 'Seitenverhältnis fy / fx',
    skew: 'Scherung s',
    ppx: 'Hauptpunkt cx',
    ppy: 'Hauptpunkt cy',
    az: 'Azimut',
    el: 'Elevation',
    dist: 'Abstand',
    hfov: 'horizontales Sichtfeld',
    vfov: 'vertikales Sichtfeld',
    dolly: 'Motivgröße fixieren (Dolly-Zoom)',
    dollyText:
      'Mit aktivierter Fixierung erhöht das Zurückziehen der Kamera automatisch f, sodass das Haus seine Bildgröße behält - und trotzdem ändert sich das Bild: Die Perspektive (wie viel größer nahe Teile gegenüber fernen wirken) hängt von der Kameraposition ab, während f nur vergrößert. Im Film heißt das Dolly-Zoom oder „Vertigo-Effekt“. Er deutet zugleich eine Kalibrierfalle an: Bei einem flachen, frontalen Motiv sind f und Abstand fast austauschbar - Modul 2 zeigt, wie gekippte Ansichten diese Mehrdeutigkeit brechen.',
    stepTitle: 'Einen Punkt durch die Pipeline verfolgen',
    stepIntro:
      'Zahlen machen die Pipeline konkret. Wähle einen Hauspunkt und beobachte, wie sich seine Koordinaten Stufe für Stufe transformieren - jeder Slider im Labor oben aktualisiert diese Zahlen live. Beachte: Genau ein Pfeil ist nichtlinear - die Division durch die Tiefe Z꜀.',
    stepPick: 'Punkt wählen:',
    stWorld: 'Weltpunkt',
    stWorldSub: 'Xw  (m)',
    stCam: 'Kamerasystem',
    stCamSub: 'Xc = R·Xw + t  (m)',
    stNorm: 'Bildebene',
    stNormSub: '(xn, yn) = (Xc/Zc, Yc/Zc)',
    stPix: 'Pixel',
    stPixSub: '(u, v)  (px)',
    depthTitle: 'Was die Projektion zerstört: Tiefe',
    depthText:
      'Verschiebe den orangen Punkt entlang seines Sehstrahls. In 3D bewegt er sich deutlich - näher zur Kamera, weiter weg. Aber sein Pixel ändert sich überhaupt nicht: Jeder Punkt auf dem Strahl erzeugt exakt dasselbe Bild. Eine einzelne Kamera kann diese Punkte nicht unterscheiden; die Division durch Z hat die Tiefendimension kollabieren lassen. Sie zurückzugewinnen braucht Zusatzwissen: eine bekannte Objektgröße, strukturiertes Licht - oder eine zweite Kamera.',
    depthSlider: 'Position entlang des Strahls',
    depthDist: 'Abstand zur Kamera',
    depthPixel: 'Pixel (u, v)',
    depthNote:
      'Diese Mehrdeutigkeit ist der Grund, warum es Stereosehen gibt - und der Sehstrahl, den du hier verschiebst, kehrt in Modul 4 als Epipolarlinie dieses Pixels zurück.',
    tipK: 'Eine Merkhilfe für die Aufteilung: [R|t] ist das Stativ (wo die Kamera steht und wohin sie schaut), die Division durch Z malt die Welt auf eine Leinwand eine Einheit vor dem Objektiv, und K ist das Lineal, das diese Leinwand in Pixeln vermisst. Alles Kameraspezifische steckt in K, alles über den Standpunkt in [R|t].',
    appTitle: '🏭 In der echten Welt: Wie weit ist das Auto weg?',
    appIntro:
      'Jedes Fahrerassistenzsystem mit Monokamera beantwortet dutzende Male pro Sekunde eine Abstandsfrage - mit exakt der Formel dieses Moduls, rückwärts gerechnet. Ein Auto ist etwa 1,5 m hoch; ist sein Bild h Pixel hoch, gilt Z = f·H/h. Der Haken: Der Sensor misst h nur auf etwa ±1 Pixel genau. Schiebe das Auto weg und sieh die Schätzung wackeln - auf große Distanz ist ein Pixel viele Meter wert, weshalb Mono-ADAS mit Radar fusioniert.',
    appZ: 'wahrer Abstand',
    appF: 'Brennweite f',
    appHpx: 'Autohöhe im Bild',
    appZest: 'geschätzter Abstand (±1 px)',
    appErr: 'Worst-Case-Fehler',
    appWhere:
      'Dieselbe inverse Projektion vermisst Distanzen in Fußball-TV-Grafiken, schätzt Menschenmengen aus Drohnenfotos und Kratergrößen auf dem Mars aus Orbiterbildern - überall, wo eine bekannte Dimension Pixel in Meter verwandelt.',
    matricesTitle: 'Die Matrizen, live',
    matricesNote:
      'P projiziert homogene Weltpunkte auf homogene Pixel: λ·(u,v,1)ᵀ = P·(X,Y,Z,1)ᵀ. Das λ, durch das dividiert wird, ist genau die Tiefe im Kamerasystem.',
    s4Title: 'Anatomie der intrinsischen Matrix K',
    s4a: 'K rechnet metrische Koordinaten der Bildebene in Pixelkoordinaten um. Sie enthält alles, was kameraintern ist - Objektiv und Sensor, unabhängig vom Standort der Kamera:',
    s4list: [
      'fx, fy - Brennweite in Pixeln: metrische Brennweite geteilt durch die Pixelgröße. fx ≠ fy genau dann, wenn die Pixel nicht quadratisch sind.',
      'cx, cy - der Hauptpunkt: das Pixel, in dem die optische Achse den Sensor durchstößt. Meist nahe der Bildmitte, selten exakt.',
      's - Scherung zwischen den Pixelachsen. Bei praktisch allen modernen Kameras ist s = 0.',
    ],
    s4b: 'Eine nützliche Konsequenz: Brennweite und Sichtfeld sind zwei Sichtweisen derselben Größe.',
    s5Title: 'Extrinsik: wo die Kamera steht',
    s5a: 'Die extrinsischen Parameter sind eine Starrkörpertransformation, die Weltpunkte im Kamerasystem ausdrückt: Rotation R (3×3, orthonormal, 3 Freiheitsgrade) und Translation t (3 FG). Achtung: t ist nicht die Kameraposition - das Kamerazentrum ist C = −Rᵀt.',
    s5b: 'Das Kamerasystem folgt der Computer-Vision-Konvention: x nach rechts, y nach unten, z nach vorn durchs Objektiv. Deshalb zeigt die y-Achse in Pixelkoordinaten nach unten.',
    s6Title: 'Alles zusammen: P = K[R|t]',
    s6a: 'Die Verkettung beider Stufen ergibt eine einzige 3×4-Matrix auf homogenen Koordinaten. Homogene Koordinaten sind der Trick, der die nichtlineare Division durch Z in lineare Algebra verwandelt - die Division wird auf den allerletzten Schritt verschoben:',
    s6b: 'Zählen wir die Freiheitsgrade: 5 in K (bzw. 4 mit s = 0) + 3 Rotation + 3 Translation = 11 - passend zu einer 3×4-Matrix bis auf Skalierung. Kamerakalibrierung (Modul 2) ist genau die Aufgabe, diese Zahlen zu schätzen.',
    dofChips: ['K: 5 FG', 'R: 3 FG', 't: 3 FG', 'P: 11 FG (bis auf Skalierung)'],
    homTitle: 'Wenn die Welt flach ist: die Homographie',
    hom1: 'Setze Z = 0 in der Projektion, und etwas Bemerkenswertes passiert: Die 3×4-Matrix P verliert eine Spalte und kollabiert zu einer invertierbaren 3×3-Matrix H - der Homographie. Für jede ebene Szene (ein Boden, eine Wand, ein Kalibrierbrett) ist die Abbildung zwischen Ebene und Bild eine schlichte Matrix, und anders als P lässt sie sich RÜCKWÄRTS ausführen: H⁻¹ verwandelt Pixel zurück in Meter. Unten blickt eine Kamera schräg auf ein Bodenraster. Aus einer Handvoll Punktkorrespondenzen wird die Homographie live geschätzt (mit derselben Kleinste-Quadrate-Maschinerie wie alles auf dieser Seite) - und das rechte Panel entzerrt mit H⁻¹ die Perspektivansicht in eine metrische Draufsicht.',
    hom2: 'Spiele mit dem Rauschen und der Anzahl der Korrespondenzen: 4 Punkte bestimmen H exakt (8 Gleichungen, 8 Unbekannte), erben aber jedes Pixel Rauschen; mehr Punkte mitteln es weg. Genau diese Schleife aus H-Schätzen und Invertieren malt in Sportübertragungen Linien aufs Spielfeld, berechnet in Einparkkameras die Vogelperspektive - und eröffnet die Kamerakalibrierung (Modul 2).',
    homNPts: 'Korrespondenzen',
    homNoise: 'Detektionsrauschen σ',
    homRms: 'Warp-RMS',
    homRecon: 'Draufsicht-Fehler',
    homLeft: 'Kamerabild - detektierte Ebenenpunkte',
    homRight: 'metrische Draufsicht - H⁻¹ auf die Detektionen angewandt',
    homTry: [
      'Stelle 4 Korrespondenzen und σ = 1,5 px ein: Die Rekonstruktion schert sichtbar - ohne Redundanz jagt H dem Rauschen hinterher.',
      'Wechsle auf 35 Korrespondenzen: gleiches Rauschen, aber das Raster rastet ein - kleinste Quadrate mitteln 70 Gleichungen über 8 Unbekannte.',
      'Kippe die Kamera steiler: Pixel nahe dem Horizont decken mehr Meter ab, also kostet dasselbe Pixelrauschen am fernen Rand mehr metrische Genauigkeit.',
    ],
    homDerivTitle: 'Von P zu H, Schritt für Schritt',
    homDeriv: [
      { tex: String.raw`\lambda\tilde{\mathbf{x}} = K[R\,|\,\mathbf{t}]\begin{bmatrix}X\\Y\\0\\1\end{bmatrix} = K[\mathbf{r}_1\;\mathbf{r}_2\;\mathbf{t}]\begin{bmatrix}X\\Y\\1\end{bmatrix}`, note: 'Punkte auf der Ebene Z = 0 berühren die dritte Rotationsspalte r₃ nie - die 3×4-Projektion kollabiert zu einer 3×3-Matrix.' },
      { tex: String.raw`H = K[\mathbf{r}_1\;\mathbf{r}_2\;\mathbf{t}], \qquad \tilde{\mathbf{x}} \sim H\begin{bmatrix}X\\Y\\1\end{bmatrix}`, note: 'H hat 9 Einträge, aber nur 8 Freiheitsgrade - die Gesamtskalierung kürzt sich in der homogenen Division heraus.' },
      { tex: String.raw`u = \frac{h_1 X + h_2 Y + h_3}{h_7 X + h_8 Y + h_9}, \quad v = \frac{h_4 X + h_5 Y + h_6}{h_7 X + h_8 Y + h_9}`, note: 'Kreuzmultiplizieren macht jede Gleichung LINEAR in den Einträgen von H: Jede Korrespondenz liefert zwei lineare Gleichungen.' },
      { tex: String.raw`\mathbf{h}^\star = \arg\min_{\|\mathbf{h}\|=1} \|A\mathbf{h}\|^2 \;=\; \text{kleinster Eigenvektor von } A^{\mathsf T}A`, note: 'Staple ≥4 Korrespondenzen in A (2N×9) und nimm den Kleinste-Quadrate-Nullvektor - die klassische Direct Linear Transform (DLT).' },
      { tex: String.raw`\hat{\mathbf{x}} = T'\tilde{\mathbf{x}}, \quad \hat{\mathbf{X}} = T\tilde{\mathbf{X}} \quad\text{(zentrieren + auf } \sqrt{2}\text{ skalieren)}`, note: 'Eine praktische Falle: Auf roher Pixelskala ist AᵀA numerisch schlecht konditioniert. Beide Punktmengen vorher zu normalisieren (Hartley) behebt das - genau das tut dieses Labor.' },
    ],
    pnpTitle: 'Wo bin ich? Pose aus einem Bild (PnP)',
    pnp1: 'Dreh die Frage dieses Moduls um: Die Intrinsik K ist bekannt, die 3D-Form des Hauses ist bekannt - aber wo steht die Kamera? Das ist das Perspective-n-Point-Problem, und es ist der Kern davon, wie AR-Headsets Inhalte verankern, wie Roboter sich an bekannten Bauteilen lokalisieren und wie jeder Marker-Tracker funktioniert. Sieh zu, wie es live gelöst wird: Die bernsteinfarbenen Reprojektionen der aktuellen Posen-Schätzung werden auf die cyanfarbenen Detektionen gezogen, und in der 3D-Ansicht gleitet die geschätzte Kamera in die wahre hinein.',
    pnp2: 'Der Löser ist die Gauß-Newton-Schleife aus Modul 3, ausgeführt über nur 6 Zahlen (3 Rotation, 3 Translation): Reprojektionsfehler um die aktuelle Pose linearisieren, Normalengleichungen lösen, Schritt machen, wiederholen. Der Startwert kommt aus der Homographie des Bodenquadrats des Hauses - ebene Geometrie bootstrappt die volle 3D-Pose.',
    pnpInit: 'Init aus Homographie',
    pnpStep: 'Iterieren',
    pnpRun: 'Auto-Lauf',
    pnpReset: 'Zurücksetzen',
    pnpNoise: 'Detektionsrauschen σ',
    pnpNPts: 'verwendete Punkte',
    pnpRms: 'Reprojektions-RMS',
    pnpPosErr: 'Positionsfehler',
    pnpRotErr: 'Rotationsfehler',
    pnpIter: 'Iteration',
    pnpLeft: 'Kamerabild - Detektionen (cyan) vs. Reprojektionen der aktuellen Pose (bernstein)',
    pnpRight: '3D - wahre Kamera (grau) vs. geschätzte Kamera (cyan)',
    pnpDerivTitle: 'Die PnP-Normalengleichungen',
    pnpDeriv: [
      { tex: String.raw`\text{Unbekannte: } (R, \mathbf{t}) \;\;\hat{=}\;\; 6 \text{ FG}, \qquad \text{jeder Punkt} \Rightarrow 2 \text{ Gleichungen}`, note: 'Drei Punkte genügen im Prinzip (P3P hat geschlossene Lösungen); echte Systeme nutzen mehr Punkte plus kleinste Quadrate.' },
      { tex: String.raw`\mathbf{r}_i(\boldsymbol{\theta}) = \pi\big(K(R\mathbf{X}_i + \mathbf{t})\big) - \mathbf{x}_i`, note: 'Das Residuum ist der Reprojektionsfehler von Punkt i - exakt die Größe, die Modul 2 minimiert, nur über die Pose statt über K.' },
      { tex: String.raw`R \leftarrow R\,\exp([\boldsymbol{\omega}]_\times), \qquad \mathbf{t} \leftarrow \mathbf{t} + \delta\mathbf{t}`, note: 'Rotationen werden multiplikativ mit einem kleinen Achse-Winkel-Vektor ω aktualisiert - der Standardtrick, um auf der Rotationsgruppe zu optimieren, ohne die Orthonormalität zu zerstören.' },
      { tex: String.raw`(J^{\mathsf T}J)\,\boldsymbol{\delta} = -J^{\mathsf T}\mathbf{r}`, note: 'Linearisieren, die 6×6-Normalengleichungen aufstellen, lösen, Schritt machen - der Gauß-Newton-Kern von Modul Vision·3, in seinem kleinsten natürlichen Habitat.' },
      { tex: String.raw`\text{AR-Anker} \cdot \text{Roboter-Greifen} \cdot \text{Marker-Tracking} \cdot \text{Kamera-Relokalisierung}`, note: 'cv2.solvePnP liefert genau das (plus P3P/EPnP-Initialisierer und RANSAC-Wrapper gegen Ausreißer - Modul Daten·4).' },
    ],
  },
}

function PinholeDiagram({ labels }: { labels: (typeof T)['en']['diagram'] }) {
  // side view: pinhole at x=200, virtual plane at x=320, object at x=480, sensor at x=80
  return (
    <svg viewBox="0 0 560 250" className="mx-auto my-4 w-full max-w-xl">
      <line x1={20} y1={140} x2={540} y2={140} stroke="rgba(255,255,255,0.25)" strokeDasharray="5 5" />
      <text x={538} y={132} fill="rgba(255,255,255,0.4)" fontSize={11} textAnchor="end">
        {labels.axis}
      </text>
      {/* pinhole wall */}
      <line x1={200} y1={60} x2={200} y2={133} stroke="#8b93a7" strokeWidth={3} />
      <line x1={200} y1={147} x2={200} y2={220} stroke="#8b93a7" strokeWidth={3} />
      <circle cx={200} cy={140} r={3.5} fill="#fbbf24" />
      <text x={200} y={238} fill="#fbbf24" fontSize={12} textAnchor="middle">
        {labels.pinhole}
      </text>
      {/* object */}
      <line x1={480} y1={140} x2={480} y2={44} stroke="#4ade80" strokeWidth={2.5} markerEnd="url(#arrG)" />
      <text x={490} y={40} fill="#4ade80" fontSize={12}>
        {labels.object}
      </text>
      {/* virtual image plane */}
      <line x1={320} y1={70} x2={320} y2={210} stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="4 3" />
      <line x1={320} y1={140} x2={320} y2={99} stroke="#22d3ee" strokeWidth={2.5} markerEnd="url(#arrC)" />
      <text x={320} y={62} fill="#22d3ee" fontSize={12} textAnchor="middle">
        {labels.imagePlane}
      </text>
      {/* sensor plane behind pinhole */}
      <line x1={80} y1={70} x2={80} y2={210} stroke="rgba(167,139,250,0.7)" strokeWidth={1.5} />
      <line x1={80} y1={140} x2={80} y2={183} stroke="#a78bfa" strokeWidth={2.5} markerEnd="url(#arrV)" />
      <text x={80} y={62} fill="#a78bfa" fontSize={12} textAnchor="middle">
        {labels.sensor}
      </text>
      {/* ray */}
      <line x1={480} y1={44} x2={80} y2={183} stroke="rgba(255,255,255,0.6)" strokeWidth={1.2} />
      {/* dimension annotations */}
      <g fill="rgba(255,255,255,0.55)" fontSize={12} fontFamily="JetBrains Mono, monospace">
        <line x1={200} y1={200} x2={320} y2={200} stroke="rgba(255,255,255,0.35)" markerEnd="url(#arrW)" markerStart="url(#arrW)" />
        <text x={260} y={194} textAnchor="middle">f</text>
        <line x1={200} y1={222} x2={480} y2={222} stroke="rgba(255,255,255,0.35)" markerEnd="url(#arrW)" markerStart="url(#arrW)" />
        <text x={340} y={216} textAnchor="middle">Z</text>
        <text x={496} y={96}>Y</text>
        <text x={328} y={122}>y</text>
      </g>
      <defs>
        <marker id="arrG" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,1 L7,4 L0,7 z" fill="#4ade80" />
        </marker>
        <marker id="arrC" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,1 L7,4 L0,7 z" fill="#22d3ee" />
        </marker>
        <marker id="arrV" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,1 L7,4 L0,7 z" fill="#a78bfa" />
        </marker>
        <marker id="arrW" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <circle cx="3" cy="3" r="1.2" fill="rgba(255,255,255,0.35)" />
        </marker>
      </defs>
    </svg>
  )
}

function AdasLab() {
  const t = useT(T)
  const [z, setZ] = useState(20)
  const [f2, setF2] = useState(800)
  const H_CAR = 1.5
  const W_CAR = 1.8
  const CAM_H = 1.2
  const IW2 = 640
  const IH2 = 360
  const cy2 = IH2 / 2

  const hPx = (f2 * H_CAR) / z
  const wPx = (f2 * W_CAR) / z
  const vBottom = cy2 + (f2 * CAM_H) / z
  const hMeasured = Math.max(Math.round(hPx), 1)
  const zEst = (f2 * H_CAR) / hMeasured
  const zWorst = (f2 * H_CAR) / Math.max(hMeasured - 1, 1)
  const errPct = ((zWorst - z) / z) * 100

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${IW2} ${IH2}`} className="block w-full" style={{ background: 'linear-gradient(#141a28 0%, #141a28 49%, #0f1520 51%, #0a0e17 100%)' }}>
          {/* road */}
          <polygon points={`${IW2 / 2 - 240},${IH2} ${IW2 / 2 - 12},${cy2} ${IW2 / 2 + 12},${cy2} ${IW2 / 2 + 240},${IH2}`} fill="rgba(139,147,167,0.12)" />
          <line x1={0} y1={cy2} x2={IW2} y2={cy2} stroke="rgba(255,255,255,0.15)" strokeDasharray="6 5" />
          {/* car silhouette */}
          <g>
            <rect x={IW2 / 2 - wPx / 2} y={vBottom - hPx} width={wPx} height={hPx * 0.62} rx={hPx * 0.08} fill="#22d3ee" opacity={0.75} />
            <rect x={IW2 / 2 - wPx * 0.36} y={vBottom - hPx * 0.98} width={wPx * 0.72} height={hPx * 0.42} rx={hPx * 0.1} fill="#22d3ee" opacity={0.55} />
          </g>
          {/* measured height bracket */}
          <line x1={IW2 / 2 + wPx / 2 + 10} y1={vBottom} x2={IW2 / 2 + wPx / 2 + 10} y2={vBottom - hPx} stroke="#fbbf24" strokeWidth={2} />
          <text x={IW2 / 2 + wPx / 2 + 16} y={vBottom - hPx / 2} fill="#fbbf24" fontSize={13} fontFamily="JetBrains Mono, monospace">
            {hMeasured}px
          </text>
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.appZ} value={z} min={5} max={80} step={0.5} onChange={setZ} format={(v) => `${fmt(v, 1)} m`} accent="#fbbf24" />
          <Slider label={t.appF} value={f2} min={400} max={1400} step={10} onChange={setF2} format={(v) => `${v} px`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.appHpx} value={`${hMeasured}`} unit="px" />
          <Readout label={t.appZest} value={fmt(zEst, 1)} unit="m" accent="#fbbf24" />
          <Readout label={t.appErr} value={`+${fmt(errPct, 1)}`} unit="%" accent={errPct > 10 ? '#f87171' : '#4ade80'} />
        </div>
        <TeX block>{String.raw`Z = \frac{f \cdot H}{h_{px}} = \frac{${f2} \cdot 1.5}{${hMeasured}} = ${fmt(zEst, 1)}\text{ m}`}</TeX>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- homography lab

const HOM_K: Intrinsics = { fx: 640, fy: 640, s: 0, cx: 320, cy: 240 }
const HOM_COLS = 7
const HOM_ROWS = 5
const HOM_SP = 0.5
// floor-plane points (X, Z) in meters, centered on the origin
const HOM_PLANE: P2[] = (() => {
  const pts: P2[] = []
  for (let r = 0; r < HOM_ROWS; r++)
    for (let c = 0; c < HOM_COLS; c++)
      pts.push([(c - (HOM_COLS - 1) / 2) * HOM_SP, (r - (HOM_ROWS - 1) / 2) * HOM_SP])
  return pts
})()
const HOM_SUBSETS: Record<string, number[]> = {
  '4': [0, HOM_COLS - 1, HOM_COLS * (HOM_ROWS - 1), HOM_COLS * HOM_ROWS - 1],
  '12': [0, 3, 6, 14, 17, 20, 28, 31, 34, 8, 12, 26],
  '35': Array.from({ length: 35 }, (_, i) => i),
}

function HomographyLab() {
  const t = useT(T)
  const [nSel, setNSel] = useState<'4' | '12' | '35'>('12')
  const [noise, setNoise] = useState(0.5)
  const [tilt, setTilt] = useState(32)

  const pose = useMemo(() => {
    const el = deg2rad(tilt)
    const r = 3.4
    const eye: V3 = [0.4, r * Math.sin(el), -r * Math.cos(el)]
    return lookAtCV(eye, [0, 0, 0.2])
  }, [tilt])

  const det = useMemo(() => {
    const g = makeGauss(Math.round(noise * 100) * 7 + Math.round(tilt) + 5)
    const tp = HOM_PLANE.map(([X, Z]) => projectPoint(HOM_K, pose, [X, 0, Z]))
    return tp.map((p) => [p.u + g() * noise, p.v + g() * noise] as P2)
  }, [pose, noise, tilt])

  const sel = HOM_SUBSETS[nSel]
  const { H, rms, recon, reconErr } = useMemo(() => {
    const src = sel.map((i) => HOM_PLANE[i])
    const dst = sel.map((i) => det[i])
    const H2 = homographyDLT(src, dst)
    if (!H2) return { H: null, rms: 0, recon: [] as P2[], reconErr: 0 }
    const Hi = m3Inv(H2)
    const rec = det.map((d) => applyH(Hi, d))
    const err =
      (rec.reduce((s, p, i) => s + Math.hypot(p[0] - HOM_PLANE[i][0], p[1] - HOM_PLANE[i][1]), 0) /
        rec.length) *
      1000
    return { H: H2, rms: homographyRms(H2, src, dst), recon: rec, reconErr: err }
  }, [det, sel])

  // top-down view scaling: world meters → SVG px
  const TW = 460
  const TH = 320
  const tx = (X: number) => TW / 2 + X * 120
  const tz = (Z: number) => TH / 2 - Z * 100

  const imgPts: ImagePoint[] = det.map((d, i) => ({
    u: d[0],
    v: d[1],
    color: sel.includes(i) ? '#fbbf24' : '#22d3ee',
    r: sel.includes(i) ? 4.5 : 3,
  }))
  // orientation marker: arrow along +X at the grid origin, projected
  const arrowPix = ([0, 0.35] as const).map((s2) => projectPoint(HOM_K, pose, [s2, 0, -HOM_SP]))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ImageView
        w={640}
        h={480}
        title={t.homLeft}
        points={imgPts}
        polylines={[
          {
            pts: arrowPix.map((p) => [p.u, p.v] as [number, number]),
            color: '#f87171',
            width: 2,
          },
        ]}
      />
      <div className="card overflow-hidden">
        <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.homRight}</div>
        <svg viewBox={`0 0 ${TW} ${TH}`} className="block w-full">
          {/* true metric grid */}
          {HOM_PLANE.map(([X, Z], i) => (
            <circle key={`t${i}`} cx={tx(X)} cy={tz(Z)} r={2.5} fill="rgba(255,255,255,0.25)" />
          ))}
          {/* error whiskers + reconstructed points */}
          {recon.map((p, i) => (
            <g key={`r${i}`}>
              <line x1={tx(HOM_PLANE[i][0])} y1={tz(HOM_PLANE[i][1])} x2={tx(p[0])} y2={tz(p[1])} stroke="#f87171" strokeWidth={1.4} />
              <circle cx={tx(p[0])} cy={tz(p[1])} r={3} fill="#22d3ee" />
            </g>
          ))}
          <line x1={tx(0)} y1={tz(-HOM_SP)} x2={tx(0.35)} y2={tz(-HOM_SP)} stroke="#f87171" strokeWidth={2} />
        </svg>
      </div>
      <div className="card-pad space-y-3.5">
        <div>
          <div className="mb-1.5 text-[12px] text-muted">{t.homNPts}</div>
          <Segmented
            options={(['4', '12', '35'] as const).map((v) => ({ value: v, label: v }))}
            value={nSel}
            onChange={setNSel}
          />
        </div>
        <Slider label={t.homNoise} value={noise} min={0} max={2} step={0.1} onChange={setNoise} format={(v) => `${fmt(v, 1)} px`} />
        <Slider label="⦩" value={tilt} min={18} max={55} step={1} onChange={setTilt} format={(v) => `${v}°`} accent="#a78bfa" />
      </div>
      <div className="flex flex-col gap-3 self-start">
        {H && (
          <MatrixView
            label={<TeX>{String.raw`H =`}</TeX>}
            values={[0, 1, 2].map((r) => [0, 1, 2].map((c) => fmtSci(H[r * 3 + c])))}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.homRms} value={fmt(rms, 2)} unit="px" accent={rms < 1 ? '#4ade80' : '#fbbf24'} />
          <Readout label={t.homRecon} value={fmt(reconErr, 1)} unit="mm" accent={reconErr < 10 ? '#4ade80' : '#fbbf24'} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- PnP lab

const PNP_TRUE_POSE: Pose = (() => {
  const az = deg2rad(42)
  const el = deg2rad(26)
  const r = 3.4
  const eye = add(TARGET, [r * Math.cos(el) * Math.sin(az), r * Math.sin(el), r * Math.cos(el) * Math.cos(az)])
  return lookAtCV(eye, TARGET)
})()
// floor square of the house (y = 0.02) - coplanar, used for the homography init
const PNP_BASE_IDX = [0, 1, 2, 3]
// plane frame (X, Z) → world rotation: columns e1=(1,0,0), e2=(0,0,1), e3=(0,−1,0)
const PNP_RP: M3 = [1, 0, 0, 0, 0, -1, 0, 1, 0]

function PnpLab() {
  const t = useT(T)
  const [noise, setNoise] = useState(0.5)
  const [nPts, setNPts] = useState<'4' | '6' | '10'>('10')
  const [traceIdx, setTraceIdx] = useState(0)
  const [running, setRunning] = useState(false)

  const detections = useMemo(() => {
    const g = makeGauss(Math.round(noise * 100) * 3 + 17)
    return HOUSE_PTS.map((hp) => {
      const p = projectPoint(HOM_K, PNP_TRUE_POSE, hp.p)
      return [p.u + g() * noise, p.v + g() * noise] as P2
    })
  }, [noise])

  const result = useMemo(() => {
    const src: P2[] = PNP_BASE_IDX.map((i) => [HOUSE_PTS[i].p[0], HOUSE_PTS[i].p[2]])
    const dst = PNP_BASE_IDX.map((i) => detections[i])
    const Hb = homographyDLT(src, dst)
    if (!Hb) return null
    const cp = poseFromHomography(HOM_K, Hb)
    const R0 = m3Mul(cp.R, m3T(PNP_RP))
    const init: Pose = { R: R0, t: sub(cp.t, m3MulV(R0, [0, 0.02, 0])) }
    const n = Number(nPts)
    return pnpRefine(
      HOM_K,
      HOUSE_PTS.slice(0, n).map((h) => h.p),
      detections.slice(0, n),
      init,
    )
  }, [detections, nPts])

  useEffect(() => {
    setTraceIdx(0)
    setRunning(false)
  }, [detections, nPts])

  useEffect(() => {
    if (!running || !result) return
    const iv = setInterval(() => {
      setTraceIdx((i) => {
        if (i >= result.trace.length - 1) {
          setRunning(false)
          return i
        }
        return i + 1
      })
    }, 350)
    return () => clearInterval(iv)
  }, [running, result])

  if (!result) return null
  const idx = Math.min(traceIdx, result.trace.length - 1)
  const cur = result.trace[idx]
  const n = Number(nPts)

  const reproj = HOUSE_PTS.slice(0, n).map((hp) => projectPoint(HOM_K, cur.pose, hp.p))
  const posErr = norm(sub(cameraCenter(cur.pose), cameraCenter(PNP_TRUE_POSE))) * 100
  const rel = m3Mul(m3T(cur.pose.R), PNP_TRUE_POSE.R)
  const rotErr = rad2deg(Math.acos(Math.min(1, Math.max(-1, (rel[0] + rel[4] + rel[8] - 1) / 2))))

  const imgPts: ImagePoint[] = [
    ...detections.slice(0, n).map((d) => ({ u: d[0], v: d[1], color: '#22d3ee', r: 4 })),
    ...reproj.map((p) => ({ u: p.u, v: p.v, color: '#fbbf24', r: 3 })),
  ]
  const whiskers = reproj.map((p, i) => ({
    pts: [
      [p.u, p.v],
      [detections[i][0], detections[i][1]],
    ] as [number, number][],
    color: 'rgba(248,113,113,0.8)',
    width: 1.3,
  }))
  const houseEdges3d = HOUSE_EDGES.map(([a, b]) => [HOUSE_PTS[a].p, HOUSE_PTS[b].p] as V3[])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ImageView w={640} h={480} title={t.pnpLeft} points={imgPts} polylines={whiskers} />
      <div className="card overflow-hidden">
        <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.pnpRight}</div>
        <Scene3D height={330} target={[0, 0.6, 0]} camera={{ position: [4.2, 3.2, -4.6], fov: 42 }}>
          {houseEdges3d.map((pts, i) => (
            <Polyline key={i} points={pts} color="rgba(255,255,255,0.4)" lineWidth={1.2} />
          ))}
          <CameraFrustumViz k={HOM_K} w={W} h={H} pose={PNP_TRUE_POSE} color="#8b93a7" depth={0.5} rays={false} />
          <CameraFrustumViz k={HOM_K} w={W} h={H} pose={cur.pose} color="#22d3ee" depth={0.5} rays={false} />
        </Scene3D>
      </div>
      <div className="card-pad space-y-3.5">
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => { setTraceIdx(0); setRunning(false) }}>
            ↺ {t.pnpReset}
          </button>
          <button className="btn" onClick={() => setTraceIdx((i) => Math.min(i + 1, result.trace.length - 1))}>
            {t.pnpStep}
          </button>
          <button className="btn-primary" onClick={() => { setTraceIdx(0); setRunning(true) }}>
            ▶ {t.pnpRun}
          </button>
        </div>
        <Slider label={t.pnpNoise} value={noise} min={0} max={2} step={0.1} onChange={setNoise} format={(v) => `${fmt(v, 1)} px`} />
        <div>
          <div className="mb-1.5 text-[12px] text-muted">{t.pnpNPts}</div>
          <Segmented
            options={(['4', '6', '10'] as const).map((v) => ({ value: v, label: v }))}
            value={nPts}
            onChange={setNPts}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 self-start">
        <Readout label={t.pnpIter} value={`${idx} / ${result.trace.length - 1}`} />
        <Readout label={t.pnpRms} value={fmt(cur.rms, 2)} unit="px" accent={cur.rms < 1 ? '#4ade80' : '#fbbf24'} />
        <Readout label={t.pnpPosErr} value={fmt(posErr, 1)} unit="cm" accent={posErr < 2 ? '#4ade80' : '#fbbf24'} />
        <Readout label={t.pnpRotErr} value={fmt(rotErr, 2)} unit="°" accent={rotErr < 0.5 ? '#4ade80' : '#fbbf24'} />
      </div>
    </div>
  )
}

function StageCard({
  label,
  sub,
  vals,
  color,
  digits = 2,
}: {
  label: string
  sub: string
  vals: number[]
  color: string
  digits?: number
}) {
  return (
    <div className="card px-3.5 py-2.5 text-center">
      <div className="text-[12px] font-semibold">{label}</div>
      <div className="font-mono text-[10.5px] text-muted">{sub}</div>
      <div className="mt-1 font-mono text-[13px] font-semibold tabular-nums" style={{ color }}>
        ({vals.map((v) => fmt(v, digits)).join(', ')})
      </div>
    </div>
  )
}

function StageArrow({ tex, accent = false }: { tex: string; accent?: boolean }) {
  return (
    <div className={`px-0.5 text-center ${accent ? 'text-warn' : 'text-accent'}`}>
      <div className="text-[13px]">
        <TeX>{tex}</TeX>
      </div>
      <div className="text-lg leading-4">→</div>
    </div>
  )
}

export function PinholePage() {
  const t = useT(T)

  const [f, setF] = useState(640)
  const [aspect, setAspect] = useState(1)
  const [skew, setSkew] = useState(0)
  const [cx, setCx] = useState(320)
  const [cy, setCy] = useState(240)
  const [azDeg, setAzDeg] = useState(35)
  const [elDeg, setElDeg] = useState(22)
  const [radius, setRadius] = useState(3.6)
  const [dolly, setDolly] = useState(false)
  const [selIdx, setSelIdx] = useState(6)
  const [rayS, setRayS] = useState(1)

  const onDistance = (v: number) => {
    if (dolly) setF((prev) => Math.round(Math.min(1400, Math.max(220, prev * (v / radius)))))
    setRadius(v)
  }

  const k: Intrinsics = useMemo(
    () => ({ fx: f, fy: f * aspect, s: skew, cx, cy }),
    [f, aspect, skew, cx, cy],
  )

  const pose = useMemo(() => {
    const az = deg2rad(azDeg)
    const el = deg2rad(elDeg)
    const eye = add(TARGET, [
      radius * Math.cos(el) * Math.sin(az),
      radius * Math.sin(el),
      radius * Math.cos(el) * Math.cos(az),
    ])
    return lookAtCV(eye, TARGET)
  }, [azDeg, elDeg, radius])

  const projections = useMemo(
    () => HOUSE_PTS.map((hp) => ({ ...projectPoint(k, pose, hp.p), color: hp.color })),
    [k, pose],
  )

  const imagePoints: ImagePoint[] = projections
    .filter((p) => p.z > 0)
    .map((p) => ({ u: p.u, v: p.v, color: p.color }))

  const imageEdges = HOUSE_EDGES.flatMap(([a, b]) => {
    const pa = projections[a]
    const pb = projections[b]
    if (pa.z <= 0 || pb.z <= 0) return []
    return [
      {
        pts: [
          [pa.u, pa.v],
          [pb.u, pb.v],
        ] as [number, number][],
        color: 'rgba(255,255,255,0.25)',
        width: 1.2,
      },
    ]
  })

  const P = pMat(k, pose)
  const hfov = rad2deg(2 * Math.atan(W / (2 * k.fx)))
  const vfov = rad2deg(2 * Math.atan(H / (2 * k.fy)))

  // pipeline stepper: intermediate values for the selected point
  const selPt = HOUSE_PTS[selIdx]
  const selXc = add(m3MulV(pose.R, selPt.p), pose.t)
  const selXn = selXc[0] / selXc[2]
  const selYn = selXc[1] / selXc[2]
  const selU = k.fx * selXn + k.s * selYn + k.cx
  const selV = k.fy * selYn + k.cy

  // depth-ambiguity demo: point sliding along the viewing ray of house point 6
  const camC = cameraCenter(pose)
  const rayBase = HOUSE_PTS[6].p
  const rayPoint = add(camC, scale(sub(rayBase, camC), rayS))
  const rayFar = add(camC, scale(sub(rayBase, camC), 2.6))
  const rayProj = projectPoint(k, pose, rayBase)

  const cyan = '#22d3ee'
  const violet = '#a78bfa'
  const amber = '#fbbf24'

  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'pipeline', label: t.s1Title },
          { id: 'pinhole', label: t.s2Title },
          { id: 'lab', label: t.s3Title },
          { id: 'stepper', label: t.stepTitle },
          { id: 'depth', label: t.depthTitle },
          { id: 'intrinsics', label: t.s4Title },
          { id: 'extrinsics', label: t.s5Title },
          { id: 'projection-matrix', label: t.s6Title },
          { id: 'homography', label: t.homTitle },
          { id: 'pnp', label: t.pnpTitle },
          { id: 'application', label: t.appTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="pipeline" title={t.s1Title}>
        <div className="prose-cv max-w-3xl">
          <p>{t.s1a}</p>
          <p>{t.s1b}</p>
        </div>
        <div className="my-5 flex flex-wrap items-center gap-2">
          {t.s1Steps.map(([name, sub], i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="card px-3 py-2 text-center">
                <div className="text-[13px] font-semibold">{name}</div>
                <div className="font-mono text-[11px] text-muted">{sub}</div>
              </div>
              {i < t.s1Steps.length - 1 && <span className="text-accent">→</span>}
            </div>
          ))}
        </div>
      </Section>

      <Section id="pinhole" title={t.s2Title}>
        <div className="prose-cv max-w-3xl">
          <p>{t.s2a}</p>
        </div>
        <div className="card-pad my-4">
          <PinholeDiagram labels={t.diagram} />
        </div>
        <div className="prose-cv max-w-3xl">
          <p>{t.s2b}</p>
          <TeX block>{String.raw`x = f\,\frac{X}{Z}, \qquad y = f\,\frac{Y}{Z}`}</TeX>
          <p>{t.s2c}</p>
        </div>
      </Section>

      <Section id="lab" title={t.s3Title}>
        <div className="prose-cv max-w-3xl">
          <p>{t.s3a}</p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <Scene3D
            className="lg:col-span-3"
            height={440}
            camera={{ position: [4.2, 2.6, 5.2], fov: 40 }}
            target={[0.3, 0.7, 0.6]}
            hint={t.labScene}
          >
            {HOUSE_PTS.map((hp, i) => (
              <mesh key={i} position={hp.p}>
                <sphereGeometry args={[0.045, 20, 20]} />
                <meshStandardMaterial color={hp.color} />
              </mesh>
            ))}
            {HOUSE_EDGES.map(([a, b], i) => (
              <Polyline
                key={i}
                points={[HOUSE_PTS[a].p, HOUSE_PTS[b].p]}
                color="#ffffff"
                opacity={0.18}
                lineWidth={1}
              />
            ))}
            <AxesTriad pose={[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]} label="world" size={0.3} />
            <CameraFrustumViz k={k} w={W} h={H} pose={pose} depth={0.9} points={HOUSE_PTS} />
          </Scene3D>
          <div className="flex flex-col gap-4 lg:col-span-2">
            <ImageView
              title={t.labImage}
              points={imagePoints}
              polylines={imageEdges}
              principal={{ cx: k.cx, cy: k.cy }}
            />
            <div className="grid grid-cols-2 gap-3">
              <Readout label={t.hfov} value={fmt(hfov, 1)} unit="°" />
              <Readout label={t.vfov} value={fmt(vfov, 1)} unit="°" />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="card-pad">
            <h3 className="mb-4 text-sm font-bold tracking-wide text-accent uppercase">{t.intrTitle}</h3>
            <div className="space-y-4">
              <Slider label={t.focal} value={f} min={220} max={1400} step={5} onChange={setF} format={(v) => `${v} px`} />
              <Slider label={t.aspect} value={aspect} min={0.7} max={1.3} step={0.01} onChange={setAspect} format={(v) => fmt(v, 2)} />
              <Slider label={t.ppx} value={cx} min={0} max={W} step={2} onChange={setCx} format={(v) => `${v} px`} accent={amber} />
              <Slider label={t.ppy} value={cy} min={0} max={H} step={2} onChange={setCy} format={(v) => `${v} px`} accent={amber} />
              <Slider label={t.skew} value={skew} min={-300} max={300} step={5} onChange={setSkew} format={(v) => `${v}`} accent={violet} />
            </div>
          </div>
          <div className="card-pad">
            <h3 className="mb-4 text-sm font-bold tracking-wide text-accent2 uppercase">{t.extrTitle}</h3>
            <div className="space-y-4">
              <Slider label={t.az} value={azDeg} min={-180} max={180} step={1} onChange={setAzDeg} format={(v) => `${v}°`} accent="#a78bfa" />
              <Slider label={t.el} value={elDeg} min={4} max={75} step={1} onChange={setElDeg} format={(v) => `${v}°`} accent="#a78bfa" />
              <Slider label={t.dist} value={radius} min={2.2} max={7} step={0.05} onChange={onDistance} format={(v) => `${fmt(v, 2)} m`} accent="#a78bfa" />
              <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-[13px] font-medium text-muted select-none">
                <input
                  type="checkbox"
                  checked={dolly}
                  onChange={(e) => setDolly(e.target.checked)}
                  className="h-4 w-4 accent-cyan-400"
                />
                {t.dolly}
              </label>
              {dolly && <p className="text-[12.5px] leading-5 text-muted/80">{t.dollyText}</p>}
            </div>
          </div>
        </div>

        <div className="card-pad mt-4">
          <h3 className="mb-3 text-sm font-bold tracking-wide text-muted uppercase">{t.matricesTitle}</h3>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <MatrixView
              label={<TeX>{String.raw`K =`}</TeX>}
              values={[
                [k.fx, k.s, k.cx],
                [0, k.fy, k.cy],
                [0, 0, 1],
              ]}
              digits={0}
              highlight={{
                '0,0': cyan,
                '1,1': cyan,
                '0,1': violet,
                '0,2': amber,
                '1,2': amber,
              }}
            />
            <MatrixView
              label={<TeX>{String.raw`[\,R \mid t\,] =`}</TeX>}
              values={[
                [pose.R[0], pose.R[1], pose.R[2], pose.t[0]],
                [pose.R[3], pose.R[4], pose.R[5], pose.t[1]],
                [pose.R[6], pose.R[7], pose.R[8], pose.t[2]],
              ]}
              digits={2}
            />
            <MatrixView
              label={<TeX>{String.raw`P = K[R|t] =`}</TeX>}
              values={[
                [P[0], P[1], P[2], P[3]],
                [P[4], P[5], P[6], P[7]],
                [P[8], P[9], P[10], P[11]],
              ]}
              digits={0}
            />
          </div>
          <p className="mt-3 text-[13px] text-muted">{t.matricesNote}</p>
        </div>

        <InfoBox title="⚡ Try it">
          <ul className="my-1 list-disc space-y-1 pl-5">
            {t.s3Try.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </InfoBox>
      </Section>

      <Section id="stepper" title={t.stepTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.stepIntro}</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-muted">{t.stepPick}</span>
          {HOUSE_PTS.map((hp, i) => (
            <button
              key={i}
              onClick={() => setSelIdx(i)}
              className="h-6 w-6 cursor-pointer rounded-full border-2 transition"
              style={{
                background: hp.color,
                borderColor: i === selIdx ? '#ffffff' : 'transparent',
                opacity: i === selIdx ? 1 : 0.5,
                transform: i === selIdx ? 'scale(1.2)' : undefined,
              }}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-4">
          <StageCard label={t.stWorld} sub={t.stWorldSub} vals={[selPt.p[0], selPt.p[1], selPt.p[2]]} color={selPt.color} />
          <StageArrow tex={String.raw`[R\mid \mathbf{t}]`} />
          <StageCard label={t.stCam} sub={t.stCamSub} vals={selXc} color={selPt.color} />
          <StageArrow tex={String.raw`\div\, Z_c`} accent />
          <StageCard label={t.stNorm} sub={t.stNormSub} vals={[selXn, selYn]} digits={3} color={selPt.color} />
          <StageArrow tex="K" />
          <StageCard label={t.stPix} sub={t.stPixSub} vals={[selU, selV]} digits={1} color={selPt.color} />
        </div>
      </Section>

      <Section id="depth" title={t.depthTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.depthText}</p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <Scene3D
            className="lg:col-span-3"
            height={380}
            camera={{ position: [4.2, 2.6, 5.2], fov: 40 }}
            target={[0.3, 0.7, 0.6]}
            hint={t.labScene}
          >
            {HOUSE_EDGES.map(([a, b], i) => (
              <Polyline key={i} points={[HOUSE_PTS[a].p, HOUSE_PTS[b].p]} color="#ffffff" opacity={0.1} lineWidth={1} />
            ))}
            <Polyline points={[camC, rayFar]} color="#fb923c" dashed opacity={0.7} lineWidth={1.5} />
            <mesh position={rayPoint}>
              <sphereGeometry args={[0.055, 20, 20]} />
              <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.35} />
            </mesh>
            <CameraFrustumViz k={k} w={W} h={H} pose={pose} depth={0.9} points={[{ p: rayPoint, color: '#fb923c' }]} rays={false} />
          </Scene3D>
          <div className="flex flex-col gap-4 lg:col-span-2">
            <ImageView
              title={t.labImage}
              points={rayProj.z > 0 ? [{ u: rayProj.u, v: rayProj.v, color: '#fb923c', r: 6 }] : []}
              polylines={imageEdges}
            />
            <div className="card-pad">
              <Slider label={t.depthSlider} value={rayS} min={0.4} max={2.3} step={0.01} onChange={setRayS} format={(v) => fmt(v, 2)} accent="#fb923c" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Readout label={t.depthDist} value={fmt(norm(sub(rayPoint, camC)), 2)} unit="m" accent="#fb923c" />
              <Readout label={t.depthPixel} value={`(${fmt(rayProj.u, 1)}, ${fmt(rayProj.v, 1)})`} />
            </div>
          </div>
        </div>
        <InfoBox tone="tip" title="💡">
          {t.depthNote}
        </InfoBox>
      </Section>

      <Section id="intrinsics" title={t.s4Title}>
        <div className="prose-cv max-w-3xl">
          <p>{t.s4a}</p>
          <TeX block>{String.raw`K = \begin{bmatrix} \textcolor{#22d3ee}{f_x} & \textcolor{#a78bfa}{s} & \textcolor{#fbbf24}{c_x} \\ 0 & \textcolor{#22d3ee}{f_y} & \textcolor{#fbbf24}{c_y} \\ 0 & 0 & 1 \end{bmatrix}`}</TeX>
          <ul>
            {t.s4list.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p>{t.s4b}</p>
          <TeX block>{String.raw`\text{FOV}_x = 2\arctan\!\frac{W}{2 f_x}, \qquad \text{FOV}_y = 2\arctan\!\frac{H}{2 f_y}`}</TeX>
        </div>
        <InfoBox tone="tip" title="💡">
          {t.tipK}
        </InfoBox>
      </Section>

      <Section id="extrinsics" title={t.s5Title}>
        <div className="prose-cv max-w-3xl">
          <p>{t.s5a}</p>
          <TeX block>{String.raw`\mathbf{x}_c = R\,\mathbf{X}_w + \mathbf{t}, \qquad C = -R^{\mathsf T}\mathbf{t}`}</TeX>
          <p>{t.s5b}</p>
        </div>
      </Section>

      <Section id="projection-matrix" title={t.s6Title}>
        <div className="prose-cv max-w-3xl">
          <p>{t.s6a}</p>
          <TeX block>{String.raw`\lambda \begin{bmatrix} u \\ v \\ 1 \end{bmatrix} = \underbrace{K \begin{bmatrix} R \mid \mathbf{t} \end{bmatrix}}_{P\;(3\times4)} \begin{bmatrix} X \\ Y \\ Z \\ 1 \end{bmatrix}, \qquad \lambda = Z_{\text{cam}}`}</TeX>
          <p>{t.s6b}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {t.dofChips.map((c, i) => (
              <span key={i} className="chip">
                {c}
              </span>
            ))}
          </div>
        </div>
      </Section>

      <Section id="homography" title={t.homTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.hom1}</p>
        </div>
        <Derivation title={t.homDerivTitle} steps={t.homDeriv} />
        <div className="mt-4">
          <HomographyLab />
        </div>
        <div className="prose-cv mt-4 max-w-3xl">
          <p>{t.hom2}</p>
        </div>
        <InfoBox title="⚡ Try it">
          <ul className="my-1 list-disc space-y-1 pl-5">
            {t.homTry.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </InfoBox>
      </Section>

      <Section id="pnp" title={t.pnpTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.pnp1}</p>
        </div>
        <div className="mt-4">
          <PnpLab />
        </div>
        <div className="prose-cv mt-4 max-w-3xl">
          <p>{t.pnp2}</p>
        </div>
        <Derivation title={t.pnpDerivTitle} steps={t.pnpDeriv} />
      </Section>

      <Section id="application" title={t.appTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.appIntro}</p>
        </div>
        <div className="mt-4">
          <AdasLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
