import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { ImageView } from '../components/ImageView'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import { Derivation } from '../components/Derivation'
import {
  boardCorners,
  distortNormalized,
  equidistantRadius,
  fisheyeProjectCamPoint,
  fmt,
  m4MulChain,
  m4MulP,
  m4RotX,
  m4RotY,
  m4RotZ,
  m4Trans,
  mulberry32,
  pinholeRadius,
  projectCamPoint,
  undistortNormalized,
  deg2rad,
  type Distortion,
  type Intrinsics,
  type V3,
} from '../lib/math'
import { makeGauss, jacobiEigen } from '../lib/stats'
import { homographyDLT, zhangIntrinsics, type P2 as HP2 } from '../lib/homography'
import { calibCovariance, lmSolve, makeObservationsN } from '../lib/optim'

const W = 640
const H = 480

// ---------------------------------------------------------------- texts

const T = {
  en: {
    kicker: 'Vision · Module 2',
    title: 'Camera Calibration',
    intro:
      'Module 1 assumed we know K. In reality every camera-lens combination is unique: focal length, principal point and lens distortion must be measured. Calibration estimates them from images of a known pattern - usually a checkerboard.',
    whyTitle: 'What calibration estimates - and why it matters',
    why1: 'Calibration recovers two groups of parameters from a handful of checkerboard photos:',
    whyList: [
      'Intrinsics K (fx, fy, cx, cy) - needed to turn pixels into metric viewing rays. Without them, no measurement, no 3D reconstruction, no augmented reality.',
      'Distortion coefficients (k1, k2, k3, p1, p2) - real lenses bend straight lines. Any geometric algorithm downstream assumes these bends have been removed.',
      'As a by-product, the pose [R|t] of the board in every image - proof that the model explains the observations.',
    ],
    why2:
      'The quality metric is the reprojection error: project the known board corners through the estimated model and measure the pixel distance to the detected corners.',
    distTitle: 'Interactive: lens distortion',
    dist1:
      'The pinhole model maps straight lines to straight lines. Real lenses do not. The standard Brown-Conrady model describes the deviation in normalized image coordinates - radial terms (k1, k2, k3) that grow with distance from the center, plus tangential terms (p1, p2) from lens-sensor misalignment:',
    dist2:
      'Drag the sliders and watch a perfect grid deform. Barrel distortion (k1 < 0) is typical for wide-angle lenses, pincushion (k1 > 0) for telephoto. If k1 and k2 have opposite signs you get the wavy “mustache” shape.',
    presets: 'Presets',
    presetNames: ['none', 'barrel', 'pincushion', 'mustache', 'tangential'],
    distGrid: 'Distorted view of a perfectly straight grid',
    undistGrid: 'Undistorted image - note the bulging border',
    undistToggle: ['distorted image', 'after undistortion'],
    undistText:
      'The switch shows the cure: undistortion warps the image with the inverse mapping, so lines become straight again. The price is visible at the amber border - the image bulges outward (or inward) and no longer fills a rectangle, which is why undistorted images are usually cropped (OpenCV: getOptimalNewCameraMatrix with its alpha parameter).',
    tipStraight:
      'Quick field test for any calibration: photograph a door frame or building edge, undistort the image, and look at the line. Any remaining curvature is uncorrected distortion - human eyes are extremely good at spotting it.',
    zhangTitle: "Zhang's method in a nutshell",
    zhang1:
      'The classic algorithm (Zhang, 2000) needs only a flat pattern with precisely known geometry, viewed from several orientations. The key insight: because all board points lie in a plane, each image is related to the board by a 3×3 homography H, and each H constrains the intrinsics:',
    zhangSteps: [
      'Detect the inner corners of the checkerboard in every image (sub-pixel accurate).',
      'Estimate a homography H per view from the known board coordinates ↔ detected pixels.',
      'Each H gives two linear constraints on the image of the absolute conic ω = K⁻ᵀK⁻¹; with ≥ 3 views, solve for K in closed form.',
      'Recover each view’s [R|t] from H and K.',
      'Refine everything - K, distortion, all poses - jointly by minimizing the reprojection error (bundle adjustment, Levenberg-Marquardt).',
    ],
    zhang2:
      'The closed-form solution only provides the starting point; the numbers you actually use come from the final nonlinear refinement.',
    zhangLink: 'How does that minimization actually work - and why Levenberg-Marquardt?',
    zhangLinkBtn: 'Module 3: Numerical Optimization →',
    zhangLabTitle: 'Zhang, live on synthetic views',
    zhangLab1:
      'Theory is cheap - here is the closed form actually running. Six virtual checkerboard views are generated with a hidden ground-truth camera (fx = fy = 560, cx = 320, cy = 240); per view a homography is estimated from the corners, and Zhang’s linear system recovers K. Watch it need at least 3 views - and watch it collapse when all views are frontal, no matter how many there are: exactly the degeneracy the tilt lab below makes visceral.',
    zhangViews: 'views used',
    zhangNoise: 'corner noise σ',
    zhangSet: 'view poses',
    zhangSetNames: [
      { value: 'varied', label: 'varied tilts' },
      { value: 'frontal', label: 'frontal only' },
    ],
    zhangFx: 'estimated fx (true 560)',
    zhangC: 'estimated cx / cy (true 320 / 240)',
    zhangCond: 'conditioning',
    zhangOk: 'CONSTRAINED',
    zhangBad: 'UNDER-CONSTRAINED',
    zhangBadHint: 'needs ≥ 3 views with real tilt - the linear system has no unique solution',
    zhangDerivTitle: 'Zhang’s method, step by step',
    zhangDeriv: [
      { tex: String.raw`H_i = K\,[\mathbf{r}_1\;\mathbf{r}_2\;\mathbf{t}]_i`, note: 'Each board view is a plane, so module 1’s homography applies: H mixes the intrinsics with the first two rotation columns of that view.' },
      { tex: String.raw`\mathbf{r}_1^{\mathsf T}\mathbf{r}_2 = 0, \qquad \mathbf{r}_1^{\mathsf T}\mathbf{r}_1 = \mathbf{r}_2^{\mathsf T}\mathbf{r}_2`, note: 'R is orthonormal - two facts per view that do not depend on where the board stood. This is the entire leverage of the method.' },
      { tex: String.raw`\omega = K^{-\mathsf T}K^{-1} \quad\Rightarrow\quad \mathbf{h}_1^{\mathsf T}\omega\,\mathbf{h}_2 = 0, \;\; \mathbf{h}_1^{\mathsf T}\omega\,\mathbf{h}_1 = \mathbf{h}_2^{\mathsf T}\omega\,\mathbf{h}_2`, note: 'Substituting rᵢ = K⁻¹hᵢ turns both facts into constraints on ω, the “image of the absolute conic” - a symmetric 3×3 that contains only intrinsics.' },
      { tex: String.raw`\mathbf{v}_{12}^{\mathsf T}\mathbf{b} = 0, \qquad (\mathbf{v}_{11}-\mathbf{v}_{22})^{\mathsf T}\mathbf{b} = 0`, note: 'ω has 6 free entries b = (B₁₁,B₁₂,B₂₂,B₁₃,B₂₃,B₃₃). Each view contributes two LINEAR equations in b - nonlinear geometry became linear algebra.' },
      { tex: String.raw`V\mathbf{b} = 0, \quad \geq 3 \text{ views} \;\Rightarrow\; \mathbf{b} = \text{smallest eigenvector of } V^{\mathsf T}V`, note: 'Two equations per view, five unknowns up to scale: three genuinely different views make the system solvable - the same null-vector trick as the DLT.' },
      { tex: String.raw`\omega \;\xrightarrow{\text{closed form}}\; f_x, f_y, s, c_x, c_y`, note: 'K falls out of b with a few divisions and square roots (Zhang 2000, App. B). Frontal-only views make those square roots meaningless - the badge in the lab.' },
      { tex: String.raw`\min_{K, d, \{R_i, \mathbf{t}_i\}} \sum \| \mathbf{x}_{ij} - \pi(K, d, R_i, \mathbf{t}_i, \mathbf{X}_j) \|^2`, note: 'The closed form is only the launchpad: the reported calibration comes from joint nonlinear refinement over everything - module 3’s Levenberg-Marquardt.' },
    ],
    fishTitle: 'When tan θ explodes: fisheye lenses',
    fish1:
      'The pinhole model hides a bomb: the image radius grows with tan θ, and tan θ → ∞ as a ray approaches 90° off-axis. No finite sensor can hold a 180° pinhole image - wide-angle optics need a different projection law. Fisheye lenses use (approximately) the equidistant model r = f·θ: image height LINEAR in the angle. The curve plot shows the two laws racing; the dot panels show a hemisphere of directions (rings of constant θ) under each model - watch the pinhole panel run out of sensor while the fisheye calmly keeps stacking rings.',
    fish2:
      'The price of the fisheye law: straight world lines are no longer straight in the image (only rays through the center are), and the Brown-Conrady polynomial above cannot express the difference - fisheye calibration uses its own model (OpenCV: cv2.fisheye, a polynomial in θ). Choosing the wrong model family is one of the classic ways calibrations silently fail.',
    fishFov: 'lens field of view',
    fishCurve: 'image radius r(θ) - pinhole vs. equidistant, sensor half-width marked',
    fishPin: 'pinhole r = f·tanθ',
    fishEqui: 'equidistant r = f·θ',
    fishPinNeed: 'sensor needed (pinhole)',
    fishEquiNeed: 'sensor needed (fisheye)',
    fishImpossible: 'impossible ≥ 180°',
    fishDerivTitle: 'Projection laws in one family',
    fishDeriv: [
      { tex: String.raw`r_{\text{pinhole}} = f\tan\theta \;\xrightarrow{\theta\to90^\circ}\; \infty`, note: 'Perspective projection: preserves straight lines, but the sensor cost per degree explodes toward the edge.' },
      { tex: String.raw`r_{\text{equidistant}} = f\,\theta`, note: 'Every degree of view costs the same millimeters of sensor - the natural choice for surveillance domes, robot navigation, automotive surround view.' },
      { tex: String.raw`r = f\sin\theta \quad\big|\quad r = 2f\sin(\tfrac{\theta}{2}) \quad\big|\quad r = 2f\tan(\tfrac{\theta}{2})`, note: 'Orthographic, equisolid-angle and stereographic siblings - real lenses approximate one of these, and calibration fits a polynomial in θ on top (cv2.fisheye).' },
    ],
    uncTitle: 'How sure is the calibration?',
    unc1:
      'A calibration is a measurement, and module Metrology·1 taught the rule: a measurement without an uncertainty is not a result. Here the module-3 solver is run on 40 independently re-noised datasets - each cyan dot is one full calibration’s answer for (f, k1). On top, the amber 2σ ellipse is computed WITHOUT any repetition, analytically from a single run: Cov(θ) ≈ σ²(JᵀJ)⁻¹, the GUM-style linear propagation. The two views agree - and the tilted ellipse exposes a secret: f and k1 are correlated, because extra barrel distortion can partially imitate a shorter focal length.',
    unc2:
      'Slide the number of views: the ellipse shrinks like 1/√n - the statistical payoff of the capture checklist. This JᵀJ⁻¹ trick is not calibration-specific: it prices the uncertainty of every least-squares fit on this site, from the thermistor lab to bundle adjustment.',
    uncNoise: 'corner noise σ',
    uncViews: 'views used',
    uncPlot: '40 Monte-Carlo calibrations (cyan) vs. analytic 2σ ellipse (amber) · green ✕ = truth',
    uncSigmaF: 'σ(f)',
    uncSigmaK1: 'σ(k1)',
    uncRho: 'correlation ρ(f, k1)',
    capTitle: 'Interactive: capture good calibration views',
    cap1: 'This is a virtual calibration session. Pose the checkerboard in front of the camera and capture views. The checklist tells you when your dataset would produce a trustworthy calibration - try to make it fully green.',
    capWhy:
      'Why these rules? Corner coverage constrains the distortion polynomial where it is largest (image borders). Tilted views constrain the focal length (a frontal board is nearly scale-ambiguous). Many views average out detection noise.',
    capScene: 'Virtual camera view',
    capPose: 'Board pose',
    capDist: 'distance',
    capOx: 'offset x',
    capOy: 'offset y',
    capTiltX: 'tilt around x',
    capTiltY: 'tilt around y',
    capRotZ: 'in-plane rotation',
    capBtn: 'Capture view',
    capRandom: 'Random pose',
    capReset: 'Reset session',
    capNotVisible: 'Board partially outside the image - corners could not be detected.',
    capViews: 'views',
    capCoverage: 'coverage',
    capTilted: 'tilted views',
    checklist: 'Dataset checklist',
    checks: [
      'at least 10 views',
      'image coverage ≥ 70 %',
      'at least 3 strongly tilted views (≥ 20°)',
      'borders & corners of the image covered (≥ 60 %)',
    ],
    capDistNote:
      'One more realism detail: this virtual lens has mild barrel distortion (k1 = −0.15). Watch the green board outline near the image corners - it bows. Real detections curve exactly like this, and the calibration must explain that bending.',
    tiltTitle: 'Interactive: why tilted views reveal the focal length',
    tiltIntro:
      'The deepest of the capture rules, isolated. Both panels show the same board, and in both the board distance is automatically adjusted as you change f, so the board keeps its image size (the dolly zoom of module 1). Frontal board: the corner pattern stays exactly identical for every f - from such views alone, f is unknowable. Tilted board: near and far edge sit at different depths, one distance cannot compensate both, and the pattern measurably deforms. Foreshortening is the signature that betrays f. Faint dots show the reference at f = 560; red whiskers show how far each corner moved (drawn ×8 to be visible).',
    tiltF: 'focal length f',
    tiltFrontal: 'frontal board - distance compensated',
    tiltTilted: 'board tilted 40° - distance compensated',
    tiltShift: 'mean corner shift',
    tiltNote:
      'This is why the checklist demands tilted views: a dataset of only frontal boards leaves f and the board distances mutually unconstrained - the optimizer of module 3 would face a perfectly flat valley and return an arbitrary answer.',
    reprojTitle: 'Interactive: reprojection error',
    reproj1:
      'After optimization, the calibration reports its residual: the RMS distance between detected corners (cyan) and corners reprojected through the model (amber). Error vectors are drawn ×15. Two effects mix in practice:',
    reprojList: [
      'Detection noise - random, irreducible; sub-pixel corner detectors reach ~0.1 px.',
      'Model error - systematic, e.g. a wrong focal length pushes corners radially outward/inward. If arrows form a pattern instead of random directions, your model (or dataset) is bad.',
    ],
    noiseLbl: 'detection noise σ',
    modelLbl: 'focal length error',
    rms: 'RMS error',
    reproj2:
      'Rule of thumb: a good calibration of a normal camera lands well below 0.5 px RMS - but a low RMS with a badly covered dataset proves nothing: the model can overfit where you did look, and be wrong where you did not.',
    tipsTitle: 'Practice: doing it with OpenCV',
    tipsList: [
      'Print the board on stiff, flat material - a bent board violates the planarity assumption.',
      'Fill the whole image over the session, tilt up to ~45°, avoid motion blur (short exposure).',
      'Fix the focus (and zoom!) - changing either changes K.',
      'Check the residual pattern per image, not only the global RMS; drop bad frames.',
      'For wide-angle / fisheye lenses use the appropriate model (cv2.fisheye or a rational model).',
    ],
    appTitle: '🏭 In the real world: measuring a part in millimeters',
    appIntro:
      'A camera above a conveyor measures every bolt that passes: length spec 42.00 ± 0.10 mm. The pixels-to-millimeters scale comes entirely from the calibration (f and working distance). Now let the calibration silently age - the lens was bumped, the camera mount warmed up - and watch a perfectly good bolt fail inspection, or worse, a bad one pass. This is why measurement cameras are recalibrated on a schedule, and why a calibration certificate has an expiry date.',
    appDecal: 'calibration drift (effective f)',
    appNoiseA: 'edge-detection noise',
    appMeasured: 'measured length',
    appTrue: 'true length',
    appVerdict: 'inspection verdict',
    appPass: 'PASS',
    appFail: 'FAIL',
    appWhere:
      'Identical setups gauge brake discs, pizza diameters, lumber widths and pill sizes - every "vision gauge" on every production line is a calibrated camera doing pixels-to-millimeters.',
  },
  de: {
    kicker: 'Vision · Modul 2',
    title: 'Kamerakalibrierung',
    intro:
      'Modul 1 hat K als bekannt vorausgesetzt. In Wirklichkeit ist jede Kamera-Objektiv-Kombination einzigartig: Brennweite, Hauptpunkt und Verzeichnung müssen gemessen werden. Die Kalibrierung schätzt sie aus Bildern eines bekannten Musters - meist eines Schachbretts.',
    whyTitle: 'Was die Kalibrierung schätzt - und warum es wichtig ist',
    why1: 'Die Kalibrierung rekonstruiert aus einer Handvoll Schachbrettfotos zwei Gruppen von Parametern:',
    whyList: [
      'Intrinsik K (fx, fy, cx, cy) - nötig, um Pixel in metrische Sehstrahlen zu verwandeln. Ohne sie keine Messung, keine 3D-Rekonstruktion, kein Augmented Reality.',
      'Verzeichnungskoeffizienten (k1, k2, k3, p1, p2) - echte Objektive krümmen Geraden. Jeder geometrische Algorithmus danach setzt voraus, dass diese Krümmung entfernt wurde.',
      'Als Nebenprodukt die Pose [R|t] des Bretts in jedem Bild - der Beleg, dass das Modell die Beobachtungen erklärt.',
    ],
    why2:
      'Das Qualitätsmaß ist der Reprojektionsfehler: Man projiziert die bekannten Brettecken durch das geschätzte Modell und misst den Pixelabstand zu den detektierten Ecken.',
    distTitle: 'Interaktiv: Objektivverzeichnung',
    dist1:
      'Das Lochkameramodell bildet Geraden auf Geraden ab. Echte Objektive nicht. Das Standard-Modell nach Brown-Conrady beschreibt die Abweichung in normierten Bildkoordinaten - radiale Terme (k1, k2, k3), die mit dem Abstand vom Zentrum wachsen, plus tangentiale Terme (p1, p2) durch Dejustage von Linse und Sensor:',
    dist2:
      'Bewege die Slider und beobachte, wie sich ein perfektes Gitter verformt. Tonnenverzeichnung (k1 < 0) ist typisch für Weitwinkel, Kissenverzeichnung (k1 > 0) für Tele. Haben k1 und k2 entgegengesetzte Vorzeichen, entsteht die wellige „Schnurrbart“-Form.',
    presets: 'Voreinstellungen',
    presetNames: ['keine', 'Tonne', 'Kissen', 'Schnurrbart', 'tangential'],
    distGrid: 'Verzerrte Ansicht eines perfekt geraden Gitters',
    undistGrid: 'Entzerrtes Bild - beachte den gewölbten Rand',
    undistToggle: ['verzerrtes Bild', 'nach Entzerrung'],
    undistText:
      'Der Schalter zeigt die Kur: Die Entzerrung verformt das Bild mit der inversen Abbildung, sodass Linien wieder gerade werden. Der Preis ist am bernsteinfarbenen Rand sichtbar - das Bild wölbt sich nach außen (oder innen) und füllt kein Rechteck mehr; deshalb werden entzerrte Bilder meist beschnitten (OpenCV: getOptimalNewCameraMatrix mit dem Alpha-Parameter).',
    tipStraight:
      'Schneller Feldtest für jede Kalibrierung: Türrahmen oder Gebäudekante fotografieren, Bild entzerren und die Linie ansehen. Jede verbleibende Krümmung ist unkorrigierte Verzeichnung - menschliche Augen erkennen so etwas extrem gut.',
    zhangTitle: 'Zhangs Methode in Kürze',
    zhang1:
      'Der klassische Algorithmus (Zhang, 2000) braucht nur ein ebenes Muster mit exakt bekannter Geometrie, aus mehreren Richtungen betrachtet. Die Kernidee: Weil alle Brettpunkte in einer Ebene liegen, ist jedes Bild über eine 3×3-Homographie H mit dem Brett verknüpft, und jede H liefert Bedingungen an die Intrinsik:',
    zhangSteps: [
      'Innere Ecken des Schachbretts in jedem Bild detektieren (subpixelgenau).',
      'Pro Ansicht eine Homographie H aus bekannten Brettkoordinaten ↔ detektierten Pixeln schätzen.',
      'Jede H liefert zwei lineare Bedingungen an ω = K⁻ᵀK⁻¹; mit ≥ 3 Ansichten lässt sich K geschlossen lösen.',
      'Aus H und K die Pose [R|t] jeder Ansicht rekonstruieren.',
      'Alles gemeinsam verfeinern - K, Verzeichnung, alle Posen - durch Minimierung des Reprojektionsfehlers (Bündelausgleich, Levenberg-Marquardt).',
    ],
    zhang2:
      'Die geschlossene Lösung liefert nur den Startwert; die Zahlen, mit denen man wirklich arbeitet, stammen aus der finalen nichtlinearen Optimierung.',
    zhangLink: 'Wie funktioniert diese Minimierung eigentlich - und warum Levenberg-Marquardt?',
    zhangLinkBtn: 'Modul 3: Numerische Optimierung →',
    zhangLabTitle: 'Zhang, live auf synthetischen Ansichten',
    zhangLab1:
      'Theorie ist billig - hier läuft die geschlossene Lösung wirklich. Sechs virtuelle Schachbrettansichten werden mit einer versteckten Ground-Truth-Kamera erzeugt (fx = fy = 560, cx = 320, cy = 240); pro Ansicht wird eine Homographie aus den Ecken geschätzt, und Zhangs lineares System rekonstruiert K. Sieh zu, wie es mindestens 3 Ansichten braucht - und wie es kollabiert, wenn alle Ansichten frontal sind, egal wie viele: exakt die Degeneration, die das Kipp-Labor unten fühlbar macht.',
    zhangViews: 'verwendete Ansichten',
    zhangNoise: 'Eckenrauschen σ',
    zhangSet: 'Ansichtsposen',
    zhangSetNames: [
      { value: 'varied', label: 'variierte Kippungen' },
      { value: 'frontal', label: 'nur frontal' },
    ],
    zhangFx: 'geschätztes fx (wahr 560)',
    zhangC: 'geschätztes cx / cy (wahr 320 / 240)',
    zhangCond: 'Konditionierung',
    zhangOk: 'BESTIMMT',
    zhangBad: 'UNTERBESTIMMT',
    zhangBadHint: 'braucht ≥ 3 Ansichten mit echter Kippung - das lineare System hat keine eindeutige Lösung',
    zhangDerivTitle: 'Zhangs Methode, Schritt für Schritt',
    zhangDeriv: [
      { tex: String.raw`H_i = K\,[\mathbf{r}_1\;\mathbf{r}_2\;\mathbf{t}]_i`, note: 'Jede Brettansicht ist eine Ebene, also greift die Homographie aus Modul 1: H mischt die Intrinsik mit den ersten beiden Rotationsspalten dieser Ansicht.' },
      { tex: String.raw`\mathbf{r}_1^{\mathsf T}\mathbf{r}_2 = 0, \qquad \mathbf{r}_1^{\mathsf T}\mathbf{r}_1 = \mathbf{r}_2^{\mathsf T}\mathbf{r}_2`, note: 'R ist orthonormal - zwei Fakten pro Ansicht, die nicht davon abhängen, wo das Brett stand. Das ist der gesamte Hebel der Methode.' },
      { tex: String.raw`\omega = K^{-\mathsf T}K^{-1} \quad\Rightarrow\quad \mathbf{h}_1^{\mathsf T}\omega\,\mathbf{h}_2 = 0, \;\; \mathbf{h}_1^{\mathsf T}\omega\,\mathbf{h}_1 = \mathbf{h}_2^{\mathsf T}\omega\,\mathbf{h}_2`, note: 'Einsetzen von rᵢ = K⁻¹hᵢ verwandelt beide Fakten in Bedingungen an ω, das „Bild des absoluten Kegelschnitts“ - eine symmetrische 3×3, die nur Intrinsik enthält.' },
      { tex: String.raw`\mathbf{v}_{12}^{\mathsf T}\mathbf{b} = 0, \qquad (\mathbf{v}_{11}-\mathbf{v}_{22})^{\mathsf T}\mathbf{b} = 0`, note: 'ω hat 6 freie Einträge b = (B₁₁,B₁₂,B₂₂,B₁₃,B₂₃,B₃₃). Jede Ansicht liefert zwei LINEARE Gleichungen in b - nichtlineare Geometrie wurde lineare Algebra.' },
      { tex: String.raw`V\mathbf{b} = 0, \quad \geq 3 \text{ Ansichten} \;\Rightarrow\; \mathbf{b} = \text{kleinster Eigenvektor von } V^{\mathsf T}V`, note: 'Zwei Gleichungen pro Ansicht, fünf Unbekannte bis auf Skalierung: drei wirklich verschiedene Ansichten machen das System lösbar - derselbe Nullvektor-Trick wie bei der DLT.' },
      { tex: String.raw`\omega \;\xrightarrow{\text{geschlossene Form}}\; f_x, f_y, s, c_x, c_y`, note: 'K fällt mit ein paar Divisionen und Quadratwurzeln aus b heraus (Zhang 2000, App. B). Nur-frontale Ansichten machen diese Wurzeln bedeutungslos - das Badge im Labor.' },
      { tex: String.raw`\min_{K, d, \{R_i, \mathbf{t}_i\}} \sum \| \mathbf{x}_{ij} - \pi(K, d, R_i, \mathbf{t}_i, \mathbf{X}_j) \|^2`, note: 'Die geschlossene Form ist nur die Startrampe: Die berichtete Kalibrierung stammt aus der gemeinsamen nichtlinearen Verfeinerung über alles - Modul 3s Levenberg-Marquardt.' },
    ],
    fishTitle: 'Wenn tan θ explodiert: Fisheye-Objektive',
    fish1:
      'Das Lochkameramodell versteckt eine Bombe: Der Bildradius wächst mit tan θ, und tan θ → ∞, wenn ein Strahl sich 90° zur Achse nähert. Kein endlicher Sensor kann ein 180°-Lochkamerabild fassen - Weitwinkeloptik braucht ein anderes Projektionsgesetz. Fisheye-Objektive nutzen (näherungsweise) das äquidistante Modell r = f·θ: Bildhöhe LINEAR im Winkel. Der Kurvenplot zeigt die beiden Gesetze im Wettrennen; die Punktepanels zeigen eine Hemisphäre von Richtungen (Ringe konstanten θs) unter jedem Modell - sieh zu, wie dem Lochkamera-Panel der Sensor ausgeht, während das Fisheye ruhig weiter Ringe stapelt.',
    fish2:
      'Der Preis des Fisheye-Gesetzes: Gerade Weltlinien sind im Bild nicht mehr gerade (nur Strahlen durchs Zentrum), und das Brown-Conrady-Polynom oben kann den Unterschied nicht ausdrücken - Fisheye-Kalibrierung nutzt ihr eigenes Modell (OpenCV: cv2.fisheye, ein Polynom in θ). Die falsche Modellfamilie zu wählen ist einer der Klassiker, mit denen Kalibrierungen leise scheitern.',
    fishFov: 'Sichtfeld des Objektivs',
    fishCurve: 'Bildradius r(θ) - Lochkamera vs. äquidistant, halbe Sensorbreite markiert',
    fishPin: 'Lochkamera r = f·tanθ',
    fishEqui: 'äquidistant r = f·θ',
    fishPinNeed: 'benötigter Sensor (Lochkamera)',
    fishEquiNeed: 'benötigter Sensor (Fisheye)',
    fishImpossible: 'unmöglich ≥ 180°',
    fishDerivTitle: 'Projektionsgesetze als Familie',
    fishDeriv: [
      { tex: String.raw`r_{\text{Lochkamera}} = f\tan\theta \;\xrightarrow{\theta\to90^\circ}\; \infty`, note: 'Perspektivische Projektion: erhält Geraden, aber die Sensorkosten pro Grad explodieren zum Rand hin.' },
      { tex: String.raw`r_{\text{äquidistant}} = f\,\theta`, note: 'Jedes Grad Sichtfeld kostet dieselben Millimeter Sensor - die natürliche Wahl für Überwachungskuppeln, Roboternavigation, Automotive-Rundumsicht.' },
      { tex: String.raw`r = f\sin\theta \quad\big|\quad r = 2f\sin(\tfrac{\theta}{2}) \quad\big|\quad r = 2f\tan(\tfrac{\theta}{2})`, note: 'Die Geschwister: orthographisch, flächentreu und stereographisch - echte Objektive nähern eines davon an, und die Kalibrierung fittet obendrauf ein Polynom in θ (cv2.fisheye).' },
    ],
    uncTitle: 'Wie sicher ist die Kalibrierung?',
    unc1:
      'Eine Kalibrierung ist eine Messung, und Modul Messtechnik·1 hat die Regel gelehrt: Eine Messung ohne Unsicherheit ist kein Ergebnis. Hier läuft der Löser aus Modul 3 auf 40 unabhängig neu verrauschten Datensätzen - jeder cyanfarbene Punkt ist die Antwort einer kompletten Kalibrierung für (f, k1). Darüber liegt die bernsteinfarbene 2σ-Ellipse, berechnet OHNE jede Wiederholung, analytisch aus einem einzigen Lauf: Cov(θ) ≈ σ²(JᵀJ)⁻¹, die lineare GUM-Fortpflanzung. Beide Sichten stimmen überein - und die gekippte Ellipse verrät ein Geheimnis: f und k1 sind korreliert, weil zusätzliche Tonnenverzeichnung eine kürzere Brennweite teilweise imitieren kann.',
    unc2:
      'Schiebe die Anzahl der Ansichten: Die Ellipse schrumpft wie 1/√n - der statistische Lohn der Aufnahme-Checkliste. Der JᵀJ⁻¹-Trick ist nicht kalibrierspezifisch: Er bepreist die Unsicherheit jedes Kleinste-Quadrate-Fits auf dieser Seite, vom Thermistor-Labor bis zum Bündelausgleich.',
    uncNoise: 'Eckenrauschen σ',
    uncViews: 'verwendete Ansichten',
    uncPlot: '40 Monte-Carlo-Kalibrierungen (cyan) vs. analytische 2σ-Ellipse (bernstein) · grünes ✕ = Wahrheit',
    uncSigmaF: 'σ(f)',
    uncSigmaK1: 'σ(k1)',
    uncRho: 'Korrelation ρ(f, k1)',
    capTitle: 'Interaktiv: gute Kalibrieransichten aufnehmen',
    cap1: 'Eine virtuelle Kalibriersitzung: Positioniere das Schachbrett vor der Kamera und nimm Ansichten auf. Die Checkliste zeigt, wann der Datensatz eine vertrauenswürdige Kalibrierung ergäbe - versuche, alles grün zu bekommen.',
    capWhy:
      'Warum diese Regeln? Abdeckung bis in die Ecken verankert das Verzeichnungspolynom dort, wo es am größten ist (Bildrand). Gekippte Ansichten bestimmen die Brennweite (ein frontales Brett ist nahezu skalenmehrdeutig). Viele Ansichten mitteln das Detektionsrauschen heraus.',
    capScene: 'Virtuelle Kameraansicht',
    capPose: 'Brettpose',
    capDist: 'Abstand',
    capOx: 'Versatz x',
    capOy: 'Versatz y',
    capTiltX: 'Kippung um x',
    capTiltY: 'Kippung um y',
    capRotZ: 'Drehung in der Ebene',
    capBtn: 'Ansicht aufnehmen',
    capRandom: 'Zufällige Pose',
    capReset: 'Sitzung zurücksetzen',
    capNotVisible: 'Brett teilweise außerhalb des Bildes - Ecken nicht detektierbar.',
    capViews: 'Ansichten',
    capCoverage: 'Abdeckung',
    capTilted: 'gekippte Ansichten',
    checklist: 'Datensatz-Checkliste',
    checks: [
      'mindestens 10 Ansichten',
      'Bildabdeckung ≥ 70 %',
      'mindestens 3 stark gekippte Ansichten (≥ 20°)',
      'Ränder & Ecken des Bildes abgedeckt (≥ 60 %)',
    ],
    capDistNote:
      'Noch ein Realismus-Detail: Dieses virtuelle Objektiv hat leichte Tonnenverzeichnung (k1 = −0,15). Beobachte den grünen Brettumriss nahe der Bildecken - er wölbt sich. Echte Detektionen krümmen sich genauso, und die Kalibrierung muss diese Biegung erklären.',
    tiltTitle: 'Interaktiv: Warum gekippte Ansichten die Brennweite verraten',
    tiltIntro:
      'Die tiefste der Aufnahmeregeln, isoliert. Beide Panels zeigen dasselbe Brett, und in beiden wird der Brettabstand beim Ändern von f automatisch nachgeführt, sodass das Brett seine Bildgröße behält (der Dolly-Zoom aus Modul 1). Frontales Brett: Das Eckenmuster bleibt für jedes f exakt identisch - aus solchen Ansichten allein ist f unbestimmbar. Gekipptes Brett: Nahe und ferne Kante liegen auf verschiedenen Tiefen, ein Abstand kann nicht beide kompensieren, das Muster verformt sich messbar. Die perspektivische Verkürzung ist die Signatur, die f verrät. Blasse Punkte zeigen die Referenz bei f = 560; rote Fäden, wie weit jede Ecke gewandert ist (×8 gezeichnet, damit es sichtbar wird).',
    tiltF: 'Brennweite f',
    tiltFrontal: 'frontales Brett - Abstand kompensiert',
    tiltTilted: 'Brett um 40° gekippt - Abstand kompensiert',
    tiltShift: 'mittlere Eckenverschiebung',
    tiltNote:
      'Deshalb verlangt die Checkliste gekippte Ansichten: Ein Datensatz aus nur frontalen Brettern lässt f und die Brettabstände gegenseitig unbestimmt - der Optimierer aus Modul 3 sähe ein völlig flaches Tal und lieferte eine beliebige Antwort.',
    reprojTitle: 'Interaktiv: Reprojektionsfehler',
    reproj1:
      'Nach der Optimierung meldet die Kalibrierung ihr Residuum: den RMS-Abstand zwischen detektierten Ecken (cyan) und durch das Modell reprojizierten Ecken (bernstein). Fehlervektoren sind ×15 gezeichnet. In der Praxis mischen sich zwei Effekte:',
    reprojList: [
      'Detektionsrauschen - zufällig, nicht vermeidbar; Subpixel-Detektoren erreichen ~0,1 px.',
      'Modellfehler - systematisch, z. B. schiebt eine falsche Brennweite die Ecken radial nach außen/innen. Bilden die Pfeile ein Muster statt zufälliger Richtungen, ist Modell (oder Datensatz) schlecht.',
    ],
    noiseLbl: 'Detektionsrauschen σ',
    modelLbl: 'Brennweitenfehler',
    rms: 'RMS-Fehler',
    reproj2:
      'Faustregel: Eine gute Kalibrierung einer normalen Kamera liegt deutlich unter 0,5 px RMS - aber ein niedriger RMS mit schlecht abgedecktem Datensatz beweist nichts: Das Modell kann dort überangepasst sein, wo man hingeschaut hat, und falsch, wo nicht.',
    tipsTitle: 'Praxis: Umsetzung mit OpenCV',
    tipsList: [
      'Das Brett auf steifes, ebenes Material drucken - ein gewölbtes Brett verletzt die Ebenheitsannahme.',
      'Über die Sitzung das ganze Bild füllen, bis ~45° kippen, Bewegungsunschärfe vermeiden (kurze Belichtung).',
      'Fokus (und Zoom!) fixieren - beides ändert K.',
      'Das Residuenmuster pro Bild prüfen, nicht nur den globalen RMS; schlechte Aufnahmen verwerfen.',
      'Für Weitwinkel/Fisheye das passende Modell verwenden (cv2.fisheye oder rationales Modell).',
    ],
    appTitle: '🏭 In der echten Welt: ein Teil in Millimetern vermessen',
    appIntro:
      'Eine Kamera über einem Förderband vermisst jede vorbeilaufende Schraube: Längenspezifikation 42,00 ± 0,10 mm. Der Pixel-zu-Millimeter-Maßstab kommt vollständig aus der Kalibrierung (f und Arbeitsabstand). Lass die Kalibrierung nun stillschweigend altern - das Objektiv wurde angestoßen, die Halterung hat sich erwärmt - und sieh zu, wie eine einwandfreie Schraube durchfällt oder, schlimmer, eine schlechte durchgeht. Deshalb werden Messkameras nach Plan rekalibriert, und deshalb hat ein Kalibrierschein ein Ablaufdatum.',
    appDecal: 'Kalibrierdrift (effektives f)',
    appNoiseA: 'Kantendetektions-Rauschen',
    appMeasured: 'gemessene Länge',
    appTrue: 'wahre Länge',
    appVerdict: 'Prüfurteil',
    appPass: 'GUT',
    appFail: 'AUSSCHUSS',
    appWhere:
      'Identische Aufbauten vermessen Bremsscheiben, Pizzadurchmesser, Brettbreiten und Tablettengrößen - jede „Vision-Lehre“ auf jeder Produktionslinie ist eine kalibrierte Kamera, die Pixel in Millimeter übersetzt.',
  },
}

const OPENCV_SNIPPET = `import cv2, numpy as np, glob

objp = np.zeros((5 * 7, 3), np.float32)
objp[:, :2] = np.mgrid[0:7, 0:5].T.reshape(-1, 2) * 0.03   # 30 mm squares

objpoints, imgpoints = [], []
for path in glob.glob("calib/*.png"):
    gray = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    ok, corners = cv2.findChessboardCorners(gray, (7, 5))
    if ok:
        corners = cv2.cornerSubPix(gray, corners, (11, 11), (-1, -1),
            (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 1e-3))
        objpoints.append(objp)
        imgpoints.append(corners)

rms, K, dist, rvecs, tvecs = cv2.calibrateCamera(
    objpoints, imgpoints, gray.shape[::-1], None, None)
print("RMS reprojection error:", rms)   # aim for < 0.5 px`

// ---------------------------------------------------------------- distortion playground

const DIST_PRESETS: Distortion[] = [
  { k1: 0, k2: 0, k3: 0, p1: 0, p2: 0 },
  { k1: -0.28, k2: 0.04, k3: 0, p1: 0, p2: 0 },
  { k1: 0.25, k2: 0.05, k3: 0, p1: 0, p2: 0 },
  { k1: -0.42, k2: 0.38, k3: 0, p1: 0, p2: 0 },
  { k1: 0, k2: 0, k3: 0, p1: 0.04, p2: -0.03 },
]

function DistortionPlayground() {
  const t = useT(T)
  const [d, setD] = useState<Distortion>(DIST_PRESETS[1])
  const [view, setView] = useState<'dist' | 'undist'>('dist')

  const { curves, straight, border } = useMemo(() => {
    const f = 400
    const cx = W / 2
    const cy = H / 2
    const nx = 13
    const ny = 10
    const px = (i: number) => 25 + (i * (W - 50)) / (nx - 1)
    const py = (j: number) => 20 + (j * (H - 40)) / (ny - 1)
    const mapDist = (u: number, v: number): [number, number] => {
      const [xd, yd] = distortNormalized((u - cx) / f, (v - cy) / f, d)
      return [cx + f * xd, cy + f * yd]
    }
    const mapUndist = (u: number, v: number): [number, number] => {
      const [x, y] = undistortNormalized((u - cx) / f, (v - cy) / f, d)
      return [cx + f * x, cy + f * y]
    }
    // 'dist': how the sensor records a straight grid. 'undist': the corrected image -
    // the recorded (distorted) lines become straight again, the image frame warps instead.
    const map =
      view === 'dist' ? mapDist : (u: number, v: number) => mapUndist(...mapDist(u, v))
    const curves: [number, number][][] = []
    const straight: [number, number][][] = []
    for (let j = 0; j < ny; j++) {
      curves.push(Array.from({ length: 40 }, (_, s) => map(25 + (s * (W - 50)) / 39, py(j))))
      straight.push([
        [px(0), py(j)],
        [px(nx - 1), py(j)],
      ])
    }
    for (let i = 0; i < nx; i++) {
      curves.push(Array.from({ length: 40 }, (_, s) => map(px(i), 20 + (s * (H - 40)) / 39)))
      straight.push([
        [px(i), py(0)],
        [px(i), py(ny - 1)],
      ])
    }
    const border: [number, number][] = []
    if (view === 'undist') {
      const S = 32
      for (let s = 0; s <= S; s++) border.push(mapUndist((s / S) * W, 0))
      for (let s = 1; s <= S; s++) border.push(mapUndist(W, (s / S) * H))
      for (let s = 1; s <= S; s++) border.push(mapUndist(W - (s / S) * W, H))
      for (let s = 1; s <= S; s++) border.push(mapUndist(0, H - (s / S) * H))
    }
    return { curves, straight, border }
  }, [d, view])

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <ImageView
          title={view === 'dist' ? t.distGrid : t.undistGrid}
          grid={false}
          polylines={[
            ...straight.map((pts) => ({ pts, color: 'rgba(255,255,255,0.10)', width: 1 })),
            ...curves.map((pts) => ({ pts, color: 'rgba(34,211,238,0.85)', width: 1.4 })),
            ...(border.length
              ? [{ pts: border, color: 'rgba(251,191,36,0.9)', width: 2 }]
              : []),
          ]}
        />
      </div>
      <div className="card-pad space-y-4 lg:col-span-2">
        <Segmented<'dist' | 'undist'>
          options={[
            { value: 'dist', label: t.undistToggle[0] },
            { value: 'undist', label: t.undistToggle[1] },
          ]}
          value={view}
          onChange={setView}
        />
        <div>
          <div className="mb-2 text-[13px] font-medium text-muted">{t.presets}</div>
          <div className="flex flex-wrap gap-2">
            {t.presetNames.map((name, i) => (
              <button key={i} className="btn text-xs" onClick={() => setD(DIST_PRESETS[i])}>
                {name}
              </button>
            ))}
          </div>
        </div>
        <Slider label={<TeX>k_1</TeX>} value={d.k1} min={-0.6} max={0.6} step={0.01} onChange={(v) => setD({ ...d, k1: v })} format={(v) => fmt(v, 2)} />
        <Slider label={<TeX>k_2</TeX>} value={d.k2} min={-0.6} max={0.6} step={0.01} onChange={(v) => setD({ ...d, k2: v })} format={(v) => fmt(v, 2)} />
        <Slider label={<TeX>k_3</TeX>} value={d.k3} min={-0.6} max={0.6} step={0.01} onChange={(v) => setD({ ...d, k3: v })} format={(v) => fmt(v, 2)} />
        <Slider label={<TeX>p_1</TeX>} value={d.p1} min={-0.08} max={0.08} step={0.002} onChange={(v) => setD({ ...d, p1: v })} format={(v) => fmt(v, 3)} accent="#a78bfa" />
        <Slider label={<TeX>p_2</TeX>} value={d.p2} min={-0.08} max={0.08} step={0.002} onChange={(v) => setD({ ...d, p2: v })} format={(v) => fmt(v, 3)} accent="#a78bfa" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- capture lab

const CAP_K: Intrinsics = { fx: 560, fy: 560, s: 0, cx: 320, cy: 240 }
// the virtual lens of the capture lab has mild barrel distortion - board edges bow near the borders
const CAP_DIST: Distortion = { k1: -0.15, k2: 0, k3: 0, p1: 0, p2: 0 }

function capProject(p: V3): { u: number; v: number; z: number } {
  const [xd, yd] = distortNormalized(p[0] / p[2], p[1] / p[2], CAP_DIST)
  return { u: CAP_K.fx * xd + CAP_K.cx, v: CAP_K.fy * yd + CAP_K.cy, z: p[2] }
}

const BOARD_COLS = 8
const BOARD_ROWS = 6
const SQ = 0.04
const INNER = boardCorners(BOARD_COLS - 1, BOARD_ROWS - 1, SQ)
const GRID_NX = 10
const GRID_NY = 8

interface Capture {
  quad: [number, number][]
  tilt: number
}

function pointInQuad(p: [number, number], quad: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
    const [xi, yi] = quad[i]
    const [xj, yj] = quad[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function cellCenters(): [number, number][] {
  const out: [number, number][] = []
  for (let r = 0; r < GRID_NY; r++)
    for (let c = 0; c < GRID_NX; c++)
      out.push([((c + 0.5) * W) / GRID_NX, ((r + 0.5) * H) / GRID_NY])
  return out
}
const CELLS = cellCenters()
const BORDER_CELL_IDX = CELLS.map((_, i) => i).filter((i) => {
  const r = Math.floor(i / GRID_NX)
  const c = i % GRID_NX
  return r === 0 || r === GRID_NY - 1 || c === 0 || c === GRID_NX - 1
})

function CaptureLab() {
  const t = useT(T)
  const [dist, setDist] = useState(0.45)
  const [ox, setOx] = useState(0)
  const [oy, setOy] = useState(0)
  const [tiltX, setTiltX] = useState(0)
  const [tiltY, setTiltY] = useState(0)
  const [rotZ, setRotZ] = useState(0)
  const [captures, setCaptures] = useState<Capture[]>([])

  const { corners, quad, allVisible } = useMemo(() => {
    const pose = m4MulChain(
      m4Trans(ox, oy, dist),
      m4RotX(deg2rad(tiltX)),
      m4RotY(deg2rad(tiltY)),
      m4RotZ(deg2rad(rotZ)),
    )
    const corners = INNER.map((p) => capProject(m4MulP(pose, p)))
    const bw = (BOARD_COLS / 2 + 0.35) * SQ
    const bh = (BOARD_ROWS / 2 + 0.35) * SQ
    const rim: V3[] = [
      [-bw, -bh, 0],
      [bw, -bh, 0],
      [bw, bh, 0],
      [-bw, bh, 0],
    ]
    // sample the outline densely so the lens distortion visibly bends the board edges
    const quad: [number, number][] = []
    for (let e = 0; e < 4; e++) {
      const a = rim[e]
      const b = rim[(e + 1) % 4]
      for (let s = 0; s < 8; s++) {
        const u = s / 8
        const pr = capProject(
          m4MulP(pose, [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1]), 0]),
        )
        quad.push([pr.u, pr.v])
      }
    }
    const allVisible = corners.every((c) => c.z > 0.05 && c.u >= 0 && c.u <= W && c.v >= 0 && c.v <= H)
    return { corners, quad, allVisible }
  }, [dist, ox, oy, tiltX, tiltY, rotZ])

  const coverage = useMemo(() => {
    const counts = CELLS.map(() => 0)
    for (const cap of captures)
      CELLS.forEach((c, i) => {
        if (pointInQuad(c, cap.quad)) counts[i]++
      })
    const covered = counts.filter((c) => c > 0).length / CELLS.length
    const borderCovered =
      BORDER_CELL_IDX.filter((i) => counts[i] > 0).length / BORDER_CELL_IDX.length
    return { counts, covered, borderCovered }
  }, [captures])

  const tilted = captures.filter((c) => c.tilt >= 20).length
  const checks = [
    captures.length >= 10,
    coverage.covered >= 0.7,
    tilted >= 3,
    coverage.borderCovered >= 0.6,
  ]

  const capture = () => {
    if (!allVisible) return
    const shot: Capture = { quad, tilt: Math.max(Math.abs(tiltX), Math.abs(tiltY)) }
    setCaptures((prev) => [...prev, shot])
  }

  const randomPose = () => {
    setDist(0.3 + Math.random() * 0.55)
    setOx((Math.random() - 0.5) * 0.5)
    setOy((Math.random() - 0.5) * 0.36)
    setTiltX((Math.random() - 0.5) * 90)
    setTiltY((Math.random() - 0.5) * 90)
    setRotZ((Math.random() - 0.5) * 140)
  }

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ImageView
            title={t.capScene}
            points={corners.filter((c) => c.z > 0).map((c) => ({ u: c.u, v: c.v, color: '#22d3ee', r: 3 }))}
            polylines={[
              // coverage heatmap of past captures
              ...coverage.counts
                .map((n, i) => ({ n, i }))
                .filter(({ n }) => n > 0)
                .map(({ n, i }) => {
                  const r = Math.floor(i / GRID_NX)
                  const c = i % GRID_NX
                  const x0 = (c * W) / GRID_NX
                  const y0 = (r * H) / GRID_NY
                  return {
                    pts: [
                      [x0, y0],
                      [x0 + W / GRID_NX, y0],
                      [x0 + W / GRID_NX, y0 + H / GRID_NY],
                      [x0, y0 + H / GRID_NY],
                      [x0, y0],
                    ] as [number, number][],
                    color: 'rgba(74,222,128,0)',
                    fill: `rgba(74,222,128,${Math.min(0.08 + n * 0.05, 0.3)})`,
                    width: 0,
                  }
                }),
              ...captures.map((cap) => ({
                pts: [...cap.quad, cap.quad[0]],
                color: 'rgba(255,255,255,0.14)',
                width: 1,
              })),
              { pts: [...quad, quad[0]], color: allVisible ? '#4ade80' : '#f87171', width: 2 },
            ]}
          />
          {!allVisible && <div className="mt-2 text-[13px] text-warn">{t.capNotVisible}</div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={capture} disabled={!allVisible} style={{ opacity: allVisible ? 1 : 0.4 }}>
              📸 {t.capBtn}
            </button>
            <button className="btn" onClick={randomPose}>
              🎲 {t.capRandom}
            </button>
            <button className="btn" onClick={() => setCaptures([])}>
              ↺ {t.capReset}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="card-pad">
            <h3 className="mb-3 text-sm font-bold tracking-wide text-accent uppercase">{t.capPose}</h3>
            <div className="space-y-3">
              <Slider label={t.capDist} value={dist} min={0.25} max={1.0} step={0.01} onChange={setDist} format={(v) => `${fmt(v, 2)} m`} />
              <Slider label={t.capOx} value={ox} min={-0.3} max={0.3} step={0.005} onChange={setOx} format={(v) => `${fmt(v * 100, 0)} cm`} />
              <Slider label={t.capOy} value={oy} min={-0.22} max={0.22} step={0.005} onChange={setOy} format={(v) => `${fmt(v * 100, 0)} cm`} />
              <Slider label={t.capTiltX} value={tiltX} min={-55} max={55} step={1} onChange={setTiltX} format={(v) => `${v}°`} accent="#a78bfa" />
              <Slider label={t.capTiltY} value={tiltY} min={-55} max={55} step={1} onChange={setTiltY} format={(v) => `${v}°`} accent="#a78bfa" />
              <Slider label={t.capRotZ} value={rotZ} min={-90} max={90} step={1} onChange={setRotZ} format={(v) => `${v}°`} accent="#a78bfa" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Readout label={t.capViews} value={`${captures.length}`} />
            <Readout label={t.capCoverage} value={fmt(coverage.covered * 100, 0)} unit="%" />
            <Readout label={t.capTilted} value={`${tilted}`} />
          </div>
          <div className="card-pad">
            <h3 className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">{t.checklist}</h3>
            <ul className="space-y-1.5 text-[14px]">
              {t.checks.map((c, i) => (
                <li key={i} className={checks[i] ? 'text-green-400' : 'text-muted'}>
                  {checks[i] ? '✓' : '○'} {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- tilt mini-lab

const TILT_F0 = 560
const TILT_D0 = 0.5

function tiltProject(fv: number, tiltDeg: number) {
  // board distance auto-compensates with f so the board keeps its image size
  const dComp = TILT_D0 * (fv / TILT_F0)
  const pose = m4MulChain(m4Trans(0, 0, dComp), m4RotY(deg2rad(tiltDeg)))
  const kk: Intrinsics = { fx: fv, fy: fv, s: 0, cx: 320, cy: 240 }
  return INNER.map((p) => projectCamPoint(kk, m4MulP(pose, p)))
}

function TiltLab() {
  const t = useT(T)
  const [f, setF] = useState(700)
  const frontRef = useMemo(() => tiltProject(TILT_F0, 0), [])
  const tiltRef = useMemo(() => tiltProject(TILT_F0, 40), [])
  const frontCur = useMemo(() => tiltProject(f, 0), [f])
  const tiltCur = useMemo(() => tiltProject(f, 40), [f])

  const meanShift = (cur: typeof frontRef, ref: typeof frontRef) =>
    cur.reduce((s, p, i) => s + Math.hypot(p.u - ref[i].u, p.v - ref[i].v), 0) / cur.length

  // corner displacements are a few pixels at most - draw them magnified so they are visible
  const MAG = 8
  const panel = (
    title: string,
    cur: typeof frontRef,
    ref: typeof frontRef,
  ) => (
    <ImageView title={title} points={cur.map((p) => ({ u: p.u, v: p.v, color: '#22d3ee', r: 3 }))}>
      {ref.map((p, i) => {
        const gu = cur[i].u + (p.u - cur[i].u) * MAG
        const gv = cur[i].v + (p.v - cur[i].v) * MAG
        return (
          <g key={i}>
            <line x1={gu} y1={gv} x2={cur[i].u} y2={cur[i].v} stroke="#f87171" strokeWidth={1.2} />
            <circle cx={gu} cy={gv} r={2.5} fill="rgba(255,255,255,0.45)" />
          </g>
        )
      })}
    </ImageView>
  )

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          {panel(t.tiltFrontal, frontCur, frontRef)}
          <div className="mt-2">
            <Readout label={t.tiltShift} value={fmt(meanShift(frontCur, frontRef), 2)} unit="px" accent="#4ade80" />
          </div>
        </div>
        <div>
          {panel(t.tiltTilted, tiltCur, tiltRef)}
          <div className="mt-2">
            <Readout
              label={t.tiltShift}
              value={fmt(meanShift(tiltCur, tiltRef), 2)}
              unit="px"
              accent="#f87171"
            />
          </div>
        </div>
      </div>
      <div className="card-pad mt-4 max-w-xl">
        <Slider label={t.tiltF} value={f} min={380} max={800} step={5} onChange={setF} format={(v) => `${v} px`} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- reprojection error

function ReprojectionDemo() {
  const t = useT(T)
  const [sigma, setSigma] = useState(0.8)
  const [focalErr, setFocalErr] = useState(0.5)

  const { pairs, rms } = useMemo(() => {
    const rand = mulberry32(1234)
    const gauss = () => rand() + rand() + rand() - 1.5 // approx N(0, 0.5²)·... good enough visually
    const pairs: { det: [number, number]; rep: [number, number] }[] = []
    let se = 0
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 7; c++) {
        const u = 80 + c * 80
        const v = 80 + r * 80
        const det: [number, number] = [u + gauss() * sigma * 2, v + gauss() * sigma * 2]
        const rep: [number, number] = [
          320 + (u - 320) * (1 + focalErr / 100),
          240 + (v - 240) * (1 + focalErr / 100),
        ]
        se += (det[0] - rep[0]) ** 2 + (det[1] - rep[1]) ** 2
        pairs.push({ det, rep })
      }
    return { pairs, rms: Math.sqrt(se / pairs.length) }
  }, [sigma, focalErr])

  const SCALE = 15
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <ImageView grid={false}>
          {pairs.map((p, i) => {
            const dx = (p.det[0] - p.rep[0]) * SCALE
            const dy = (p.det[1] - p.rep[1]) * SCALE
            return (
              <g key={i}>
                <line
                  x1={p.rep[0]}
                  y1={p.rep[1]}
                  x2={p.rep[0] + dx}
                  y2={p.rep[1] + dy}
                  stroke="#f87171"
                  strokeWidth={1.5}
                />
                <circle cx={p.det[0]} cy={p.det[1]} r={4} fill="#22d3ee" />
                <circle cx={p.rep[0]} cy={p.rep[1]} r={3} fill="none" stroke="#fbbf24" strokeWidth={1.5} />
              </g>
            )
          })}
        </ImageView>
      </div>
      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="card-pad space-y-4">
          <Slider label={t.noiseLbl} value={sigma} min={0} max={3} step={0.05} onChange={setSigma} format={(v) => `${fmt(v, 2)} px`} />
          <Slider label={t.modelLbl} value={focalErr} min={-2} max={2} step={0.05} onChange={setFocalErr} format={(v) => `${fmt(v, 2)} %`} accent="#fbbf24" />
        </div>
        <Readout label={t.rms} value={fmt(rms, 2)} unit="px" accent={rms < 0.5 ? '#4ade80' : rms < 1.5 ? '#fbbf24' : '#f87171'} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- application: vision gauge

const BOLT_TRUE_MM = 42.0
const GAUGE_SCALE_TRUE = 11.0 // px per mm at nominal calibration

function GaugeLab() {
  const t = useT(T)
  const [decal, setDecal] = useState(0) // percent f drift
  const [noise, setNoise] = useState(0.3) // px edge noise

  const boltPx = BOLT_TRUE_MM * GAUGE_SCALE_TRUE
  // deterministic "noise" sample so the display is stable per slider setting
  const rand = mulberry32(Math.round(noise * 1000) + 7)
  const noisyPx = boltPx + (rand() - 0.5) * 2 * noise * 2
  const assumedScale = GAUGE_SCALE_TRUE * (1 + decal / 100)
  const measured = noisyPx / assumedScale
  const pass = Math.abs(measured - BOLT_TRUE_MM) <= 0.1

  const GW2 = 620
  const GH2 = 200
  const x0 = (GW2 - boltPx) / 2
  const yMid = GH2 / 2

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${GW2} ${GH2}`} className="block w-full" style={{ background: 'radial-gradient(120% 120% at 50% 40%, #141a28 0%, #0a0e17 100%)' }}>
          {/* bolt: head + shaft + thread lines */}
          <rect x={x0} y={yMid - 26} width={52} height={52} rx={6} fill="#4a5670" />
          <rect x={x0 + 52} y={yMid - 13} width={boltPx - 52} height={26} rx={4} fill="#8b93a7" />
          {Array.from({ length: 14 }, (_, i) => (
            <line key={i} x1={x0 + 110 + i * 22} y1={yMid - 13} x2={x0 + 102 + i * 22} y2={yMid + 13} stroke="#5b6478" strokeWidth={2.5} />
          ))}
          {/* measurement overlay */}
          <line x1={x0} y1={yMid + 44} x2={x0 + noisyPx} y2={yMid + 44} stroke="#22d3ee" strokeWidth={2} />
          <line x1={x0} y1={yMid + 36} x2={x0} y2={yMid + 52} stroke="#22d3ee" strokeWidth={2} />
          <line x1={x0 + noisyPx} y1={yMid + 36} x2={x0 + noisyPx} y2={yMid + 52} stroke="#22d3ee" strokeWidth={2} />
          <text x={GW2 / 2} y={yMid + 68} textAnchor="middle" fill="#22d3ee" fontSize={13} fontFamily="JetBrains Mono, monospace">
            {fmt(noisyPx, 1)} px ÷ {fmt(assumedScale, 2)} px/mm = {fmt(measured, 2)} mm
          </text>
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.appDecal} value={decal} min={-3} max={3} step={0.05} onChange={setDecal} format={(v) => `${fmt(v, 2)} %`} accent="#f87171" />
          <Slider label={t.appNoiseA} value={noise} min={0} max={2} step={0.05} onChange={setNoise} format={(v) => `${fmt(v, 2)} px`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.appMeasured} value={fmt(measured, 2)} unit="mm" accent="#22d3ee" />
          <Readout label={t.appTrue} value={fmt(BOLT_TRUE_MM, 2)} unit="mm" />
          <Readout label={t.appVerdict} value={pass ? `✓ ${t.appPass}` : `✗ ${t.appFail}`} accent={pass ? '#4ade80' : '#f87171'} unit="±0.10 mm" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Zhang mini-solver

const ZK_TRUE: Intrinsics = { fx: 560, fy: 560, s: 0, cx: 320, cy: 240 }
const Z_CORNERS = boardCorners(7, 5, 0.04)
const zPose = ([ox, oy, d, rx, ry, rz]: number[]) =>
  m4MulChain(m4Trans(ox, oy, d), m4RotX(deg2rad(rx)), m4RotY(deg2rad(ry)), m4RotZ(deg2rad(rz)))
const Z_POSES_VARIED = [
  [0.0, 0.02, 0.55, 8, -6, 0],
  [-0.1, -0.05, 0.42, -28, 14, 12],
  [0.12, 0.06, 0.5, 20, 26, -18],
  [-0.13, 0.07, 0.62, 12, -30, 30],
  [0.1, -0.08, 0.47, -18, -22, -35],
  [0.0, 0.0, 0.38, 32, 8, 60],
].map(zPose)
const Z_POSES_FRONTAL = [
  [0.0, 0.0, 0.5, 0, 0, 0],
  [-0.08, 0.04, 0.42, 0, 0, 25],
  [0.09, -0.05, 0.56, 0, 0, -40],
  [-0.1, -0.06, 0.62, 0, 0, 60],
  [0.06, 0.07, 0.46, 0, 0, 110],
  [0.0, 0.0, 0.38, 0, 0, 150],
].map(zPose)

function ZhangLab() {
  const t = useT(T)
  const [nViews, setNViews] = useState(6)
  const [noise, setNoise] = useState(0.3)
  const [poseSet, setPoseSet] = useState<'varied' | 'frontal'>('varied')

  const res = useMemo(() => {
    const poses = (poseSet === 'varied' ? Z_POSES_VARIED : Z_POSES_FRONTAL).slice(0, nViews)
    const g = makeGauss(Math.round(noise * 100) * 13 + nViews + (poseSet === 'varied' ? 0 : 500))
    const Hs = poses.flatMap((P) => {
      const src: HP2[] = []
      const dst: HP2[] = []
      for (const c of Z_CORNERS) {
        const p = projectCamPoint(ZK_TRUE, m4MulP(P, c))
        src.push([c[0], c[1]])
        dst.push([p.u + g() * noise, p.v + g() * noise])
      }
      const Hh = homographyDLT(src, dst)
      return Hh ? [Hh] : []
    })
    return zhangIntrinsics(Hs)
  }, [nViews, noise, poseSet])

  const good = res.ok
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card-pad space-y-3.5">
        <Slider label={t.zhangViews} value={nViews} min={1} max={6} step={1} onChange={setNViews} />
        <Slider label={t.zhangNoise} value={noise} min={0} max={1.5} step={0.1} onChange={setNoise} format={(v) => `${fmt(v, 1)} px`} />
        <div>
          <div className="mb-1.5 text-[12px] text-muted">{t.zhangSet}</div>
          <Segmented options={t.zhangSetNames} value={poseSet} onChange={(v) => setPoseSet(v as 'varied' | 'frontal')} />
        </div>
      </div>
      <div className="flex flex-col gap-3 self-start">
        <div
          className="rounded-lg border px-3 py-2 text-[13px] font-bold tracking-wide"
          style={{ borderColor: good ? '#4ade8066' : '#f8717166', color: good ? '#4ade80' : '#f87171' }}
        >
          {good ? `✓ ${t.zhangOk}` : `✗ ${t.zhangBad}`}
          {!good && <div className="mt-0.5 text-[12px] font-normal text-muted">{t.zhangBadHint}</div>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout
            label={t.zhangFx}
            value={good ? fmt(res.k.fx, 1) : '-'}
            accent={good && Math.abs(res.k.fx - 560) < 5 ? '#4ade80' : undefined}
          />
          <Readout label={t.zhangC} value={good ? `${fmt(res.k.cx, 0)} / ${fmt(res.k.cy, 0)}` : '-'} />
        </div>
        <Readout
          label={t.zhangCond}
          value={!good ? '-' : res.conditioning > 1e6 ? '> 10⁶' : fmt(res.conditioning, 0)}
          accent={good ? '#4ade80' : '#f87171'}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- fisheye lab

const FISH_F = 300 // px, both models
const FISH_K: Intrinsics = { fx: FISH_F, fy: FISH_F, s: 0, cx: 320, cy: 240 }

function FisheyeLab() {
  const t = useT(T)
  const [fovDeg, setFovDeg] = useState(140)
  const thMax = deg2rad(fovDeg / 2)

  const PW = 520
  const PH = 260
  const sx = (thDeg: number) => (thDeg / 110) * PW
  const sy = (r: number) => PH - 18 - Math.min(r / 1100, 1) * (PH - 36)

  const pinCurve = Array.from({ length: 110 }, (_, i) => {
    const th = deg2rad(i * 0.8)
    return th < deg2rad(88) ? `${sx(i * 0.8)},${sy(pinholeRadius(FISH_F, th))}` : null
  })
    .filter(Boolean)
    .join(' ')
  const equiCurve = Array.from({ length: 138 }, (_, i) => `${sx(i * 0.8)},${sy(equidistantRadius(FISH_F, deg2rad(i * 0.8)))}`).join(' ')

  const rings = useMemo(() => {
    const out: { pin: { u: number; v: number }[]; fish: { u: number; v: number }[]; color: string }[] = []
    const colors = ['#22d3ee', '#4ade80', '#fbbf24', '#f87171', '#a78bfa', '#38bdf8', '#f472b6', '#a3e635']
    for (let ti = 0; ti < 8; ti++) {
      const th = deg2rad(((ti + 1) * fovDeg) / 2 / 8)
      const pin: { u: number; v: number }[] = []
      const fish: { u: number; v: number }[] = []
      for (let a = 0; a < 28; a++) {
        const phi = (a / 28) * Math.PI * 2
        const c: V3 = [Math.sin(th) * Math.cos(phi), Math.sin(th) * Math.sin(phi), Math.cos(th)]
        if (th < deg2rad(88)) {
          const p = projectCamPoint(FISH_K, c)
          if (p.u >= 0 && p.u <= 640 && p.v >= 0 && p.v <= 480) pin.push({ u: p.u, v: p.v })
        }
        const q = fisheyeProjectCamPoint(FISH_K, c)
        if (q.u >= 0 && q.u <= 640 && q.v >= 0 && q.v <= 480) fish.push({ u: q.u, v: q.v })
      }
      out.push({ pin, fish, color: colors[ti % colors.length] })
    }
    return out
  }, [fovDeg])

  const pinNeed = fovDeg < 178 ? 2 * pinholeRadius(FISH_F, thMax) : Infinity
  const equiNeed = 2 * equidistantRadius(FISH_F, thMax)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card overflow-hidden lg:col-span-2">
        <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.fishCurve}</div>
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          <line x1={0} y1={sy(320)} x2={PW} y2={sy(320)} stroke="#8b93a766" strokeDasharray="5 4" />
          <line x1={sx(fovDeg / 2)} y1={10} x2={sx(fovDeg / 2)} y2={PH - 18} stroke="#ffffff33" strokeDasharray="3 4" />
          <polyline points={pinCurve} fill="none" stroke="#f87171" strokeWidth={2} />
          <polyline points={equiCurve} fill="none" stroke="#22d3ee" strokeWidth={2} />
          <text x={8} y={sy(320) - 5} fill="#8b93a7" fontSize={10.5} fontFamily="JetBrains Mono, monospace">
            320 px
          </text>
          <text x={PW - 8} y={PH - 5} textAnchor="end" fill="#8b93a7" fontSize={10.5} fontFamily="JetBrains Mono, monospace">
            θ →
          </text>
          <text x={sx(45)} y={22} fill="#f87171" fontSize={11.5} fontFamily="JetBrains Mono, monospace">
            {t.fishPin}
          </text>
          <text x={sx(72)} y={sy(equidistantRadius(FISH_F, deg2rad(74))) - 8} fill="#22d3ee" fontSize={11.5} fontFamily="JetBrains Mono, monospace">
            {t.fishEqui}
          </text>
        </svg>
      </div>
      <ImageView
        w={640}
        h={480}
        title={t.fishPin}
        grid={false}
        points={rings.flatMap((r) => r.pin.map((p) => ({ u: p.u, v: p.v, color: r.color, r: 2.5 })))}
      />
      <ImageView
        w={640}
        h={480}
        title={t.fishEqui}
        grid={false}
        points={rings.flatMap((r) => r.fish.map((p) => ({ u: p.u, v: p.v, color: r.color, r: 2.5 })))}
      />
      <div className="card-pad">
        <Slider label={t.fishFov} value={fovDeg} min={60} max={220} step={2} onChange={setFovDeg} format={(v) => `${v}°`} />
      </div>
      <div className="grid grid-cols-2 gap-3 self-start">
        <Readout
          label={t.fishPinNeed}
          value={Number.isFinite(pinNeed) ? fmt(pinNeed, 0) : t.fishImpossible}
          unit={Number.isFinite(pinNeed) ? 'px' : undefined}
          accent={Number.isFinite(pinNeed) && pinNeed < 700 ? '#4ade80' : '#f87171'}
        />
        <Readout label={t.fishEquiNeed} value={fmt(equiNeed, 0)} unit="px" accent="#22d3ee" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- uncertainty lab

function UncertaintyLab() {
  const t = useT(T)
  const [noise, setNoise] = useState(0.6)
  const [nViews, setNViews] = useState(6)

  const { runs, thRef, cov } = useMemo(() => {
    const rs: [number, number][] = []
    for (let i = 0; i < 40; i++) {
      const obs = makeObservationsN(noise, 1000 + i * 17, nViews)
      const th = lmSolve(obs)
      rs.push([th.f, th.k1])
    }
    const obsRef = makeObservationsN(noise, 999, nViews)
    const ref = lmSolve(obsRef)
    return { runs: rs, thRef: ref, cov: calibCovariance(ref, obsRef) }
  }, [noise, nViews])

  const sf = Math.sqrt(Math.max(cov[0][0], 0))
  const sk = Math.sqrt(Math.max(cov[3][3], 0))
  const rho = sf > 0 && sk > 0 ? cov[0][3] / (sf * sk) : 0

  // plot: x = f, y = k1, ranges from scatter + ellipse
  const PW = 520
  const PH = 340
  const xr: [number, number] = [560 - Math.max(4 * sf, 1.2), 560 + Math.max(4 * sf, 1.2)]
  const yr: [number, number] = [-0.18 - Math.max(4 * sk, 0.004), -0.18 + Math.max(4 * sk, 0.004)]
  const px = (f: number) => ((f - xr[0]) / (xr[1] - xr[0])) * PW
  const py = (k1: number) => PH - ((k1 - yr[0]) / (yr[1] - yr[0])) * PH

  // parametric 2σ ellipse from the (f, k1) marginal covariance
  const ellipse = useMemo(() => {
    const eig = jacobiEigen([
      [cov[0][0], cov[0][3]],
      [cov[3][0], cov[3][3]],
    ])
    const a = 2 * Math.sqrt(Math.max(eig.values[0], 0))
    const b = 2 * Math.sqrt(Math.max(eig.values[1], 0))
    const v1 = eig.vectors[0]
    const v2 = eig.vectors[1]
    return Array.from({ length: 49 }, (_, i) => {
      const phi = (i / 48) * Math.PI * 2
      const f = thRef.f + a * Math.cos(phi) * v1[0] + b * Math.sin(phi) * v2[0]
      const k1 = thRef.k1 + a * Math.cos(phi) * v1[1] + b * Math.sin(phi) * v2[1]
      return `${px(f)},${py(k1)}`
    }).join(' ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cov, thRef, xr[0], xr[1], yr[0], yr[1]])

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.uncPlot}</div>
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          <polyline points={ellipse} fill="none" stroke="#fbbf24" strokeWidth={1.8} />
          {runs.map(([f, k1], i) => (
            <circle key={i} cx={px(f)} cy={py(k1)} r={3} fill="#22d3ee99" />
          ))}
          <text x={px(560)} y={py(-0.18) + 4} textAnchor="middle" fill="#4ade80" fontSize={14}>
            ✕
          </text>
          <text x={PW - 8} y={PH - 6} textAnchor="end" fill="#8b93a7" fontSize={10.5} fontFamily="JetBrains Mono, monospace">
            f (px) →
          </text>
          <text x={8} y={14} fill="#8b93a7" fontSize={10.5} fontFamily="JetBrains Mono, monospace">
            k₁ ↑
          </text>
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.uncNoise} value={noise} min={0.1} max={1.5} step={0.1} onChange={setNoise} format={(v) => `${fmt(v, 1)} px`} />
          <Slider label={t.uncViews} value={nViews} min={2} max={6} step={1} onChange={setNViews} accent="#a78bfa" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Readout label={t.uncSigmaF} value={fmt(sf, 2)} unit="px" />
          <Readout label={t.uncSigmaK1} value={fmt(sk * 1000, 2)} unit="·10⁻³" />
          <Readout label={t.uncRho} value={fmt(rho, 2)} accent={Math.abs(rho) > 0.4 ? '#fbbf24' : undefined} />
        </div>
        <div className="card-pad">
          <TeX block>{String.raw`\mathrm{Cov}(\hat{\boldsymbol{\theta}}) \;\approx\; \hat{\sigma}^2\,(J^{\mathsf T}J)^{-1}`}</TeX>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function CalibrationPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'why', label: t.whyTitle },
          { id: 'distortion', label: t.distTitle },
          { id: 'fisheye', label: t.fishTitle },
          { id: 'zhang', label: t.zhangTitle },
          { id: 'capture', label: t.capTitle },
          { id: 'tilt', label: t.tiltTitle },
          { id: 'reprojection', label: t.reprojTitle },
          { id: 'uncertainty', label: t.uncTitle },
          { id: 'opencv', label: t.tipsTitle },
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
          <ul>
            {t.whyList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p>{t.why2}</p>
        </div>
      </Section>

      <Section id="distortion" title={t.distTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.dist1}</p>
          <TeX block>{String.raw`\begin{aligned} x_d &= x\,(1 + k_1 r^2 + k_2 r^4 + k_3 r^6) + 2p_1 xy + p_2(r^2 + 2x^2) \\ y_d &= y\,(1 + k_1 r^2 + k_2 r^4 + k_3 r^6) + p_1(r^2 + 2y^2) + 2p_2 xy \end{aligned} \qquad r^2 = x^2 + y^2`}</TeX>
          <p>{t.dist2}</p>
        </div>
        <div className="mt-4">
          <DistortionPlayground />
        </div>
        <div className="prose-cv mt-4 max-w-3xl">
          <p>{t.undistText}</p>
        </div>
        <InfoBox tone="tip" title="💡">
          {t.tipStraight}
        </InfoBox>
      </Section>

      <Section id="fisheye" title={t.fishTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.fish1}</p>
        </div>
        <div className="mt-4">
          <FisheyeLab />
        </div>
        <div className="prose-cv mt-4 max-w-3xl">
          <p>{t.fish2}</p>
        </div>
        <Derivation title={t.fishDerivTitle} steps={t.fishDeriv} />
      </Section>

      <Section id="zhang" title={t.zhangTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.zhang1}</p>
          <TeX block>{String.raw`\lambda\,\tilde{\mathbf{x}} = H\,\begin{bmatrix} X \\ Y \\ 1 \end{bmatrix}, \qquad H = K\,[\,\mathbf{r}_1\;\;\mathbf{r}_2\;\;\mathbf{t}\,]`}</TeX>
          <ol className="my-3 list-decimal space-y-2 pl-6">
            {t.zhangSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <p>{t.zhang2}</p>
        </div>
        <Derivation title={t.zhangDerivTitle} steps={t.zhangDeriv} />
        <div className="prose-cv mt-4 max-w-3xl">
          <h3 className="text-[16px] font-bold">{t.zhangLabTitle}</h3>
          <p>{t.zhangLab1}</p>
        </div>
        <div className="mt-4">
          <ZhangLab />
        </div>
        <InfoBox>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t.zhangLink}</span>
            <Link to="/optimization" className="btn-primary text-[13px]">
              {t.zhangLinkBtn}
            </Link>
          </div>
        </InfoBox>
      </Section>

      <Section id="capture" title={t.capTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.cap1}</p>
          <p>{t.capDistNote}</p>
        </div>
        <div className="mt-4">
          <CaptureLab />
        </div>
        <InfoBox>{t.capWhy}</InfoBox>
      </Section>

      <Section id="tilt" title={t.tiltTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.tiltIntro}</p>
        </div>
        <div className="mt-4">
          <TiltLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.tiltNote}
        </InfoBox>
      </Section>

      <Section id="reprojection" title={t.reprojTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.reproj1}</p>
          <ul>
            {t.reprojList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="mt-4">
          <ReprojectionDemo />
        </div>
        <InfoBox tone="warn">{t.reproj2}</InfoBox>
      </Section>

      <Section id="uncertainty" title={t.uncTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.unc1}</p>
        </div>
        <div className="mt-4">
          <UncertaintyLab />
        </div>
        <div className="prose-cv mt-4 max-w-3xl">
          <p>{t.unc2}</p>
        </div>
      </Section>

      <Section id="opencv" title={t.tipsTitle}>
        <div className="prose-cv max-w-3xl">
          <ul>
            {t.tipsList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <pre className="card mt-4 overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-ink/85">
          {OPENCV_SNIPPET}
        </pre>
      </Section>

      <Section id="application" title={t.appTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.appIntro}</p>
        </div>
        <div className="mt-4">
          <GaugeLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
