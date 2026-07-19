import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { ImageView } from '../components/ImageView'
import { Heatmap } from '../components/Heatmap'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import { fmt } from '../lib/math'
import { makeGauss } from '../lib/stats'
import {
  CALIB_START,
  CALIB_TRUE,
  FN2D,
  calibReprojections,
  calibRms,
  gdCalibStep,
  gdStep2D,
  lmCalibStep,
  lmStep2D,
  makeObservations,
  momentumStep2D,
  type CalibTheta,
  type Fn2D,
  type Vec2,
} from '../lib/optim'

// ================================================================ texts

const T = {
  en: {
    kicker: 'Vision · Module 3',
    title: 'Numerical Optimization',
    intro:
      'Module 2 ended with a sentence that deserves a whole module: “refine everything by minimizing the reprojection error”. This is how nearly every geometric parameter in computer vision - camera intrinsics, distortion, stereo extrinsics, hand-eye transforms - is actually found: as the minimum of a cost function, located numerically.',
    costTitle: 'Calibration is optimization in disguise',
    cost1:
      'Collect every unknown into one parameter vector θ. For camera calibration θ contains the intrinsics, the distortion coefficients and the pose of the board in every view. The model π(θ, X) predicts where board corner X should appear in the image; the detection x̂ says where it actually is. Their disagreement, summed over all corners of all views, is the cost:',
    cost2:
      'Calibration means: find the θ that makes this number as small as possible. C is a function of a dozen or more variables - you cannot solve ∇C = 0 by hand. But you can evaluate C and its slope at any point, and walk downhill. Picture C as a landscape over the parameter space: valleys are good explanations of the data, and the deepest valley is the calibration you want.',
    gdTitle: 'Walking downhill: gradient descent',
    gd1: 'The gradient ∇C points in the direction of steepest ascent - so its negative is the locally best downhill direction. Gradient descent repeats one tiny idea: take a small step downhill, re-measure the slope, repeat.',
    gd2: 'The step size α (the learning rate) is the method’s Achilles heel: too small and you crawl for thousands of iterations; too large and you overshoot the valley floor and oscillate - or explode.',
    gd1dTitle: 'Interactive: gradient descent on a single parameter',
    gd1dIntro:
      'Before landscapes, one dimension - where you can see everything. The red dashed line is the tangent at the ball; its slope C′(θ) is the entire information gradient descent uses. Each step moves θ by −α·C′(θ) (the amber arrow at the bottom). Click anywhere to set a new start point.',
    gd1dHint: 'click to place the start',
    gd1dReset: 'Reset',
    gd1dSlope: 'slope C′(θ)',
    gd1dStep: 'next step −α·C′(θ)',
    gd1dTry: [
      'Small α: safe but slow - and notice the steps shrink by themselves near the minimum, because the slope does.',
      'Large α (≈ 0.3 and up): the ball overshoots the valley floor and bounces between the walls; past the stability limit it flies out of the picture.',
      'Start left vs. right of the hump: two different minima. Gradient descent has no idea that the left one is deeper - it only ever sees the local slope.',
    ],
    playTitle: 'Interactive: descent playground',
    play1: 'The same game in two dimensions - now the gradient is a direction. Move the mouse over the landscape to feel the downhill field (amber arrow = −∇C), then click to drop a start point, choose a method, and run. Paths stay on screen so you can compare methods and settings. The dark basins are minima; ✕ marks the true minimizers.',
    playTry: [
      'Bowl, GD, α ≈ 0.1 - smooth convergence. Now set α ≈ 1.1: each step overshoots the center and the path explodes. The stability limit is α < 2/λmax, set by the curvature.',
      'Narrow valley, GD - the classic failure: it zigzags across the steep direction while barely moving along the flat one. This is exactly what ill-conditioned (differently scaled) parameters do to calibration.',
      'Narrow valley, momentum β ≈ 0.9 - the zigzag averages out and progress along the valley accumulates.',
      'Rosenbrock, GD vs. damped Newton - GD needs thousands of steps in the curved valley; Newton with small λ jumps to the minimum in a handful, because it uses curvature, not just slope.',
      'Two pits - start left vs. right of the ridge: descent methods only find the nearest minimum. This is why calibration needs a good initial guess (Zhang’s closed form!).',
    ],
    fnNames: { bowl: 'bowl', valley: 'narrow valley', rosenbrock: 'Rosenbrock', twopits: 'two pits' },
    mNames: { gd: 'Gradient descent', mom: '+ momentum', lm: 'Damped Newton (LM)' },
    lr: 'learning rate α',
    beta: 'momentum β',
    lambda: 'damping λ',
    run: 'Run',
    pause: 'Pause',
    step: 'Step',
    clear: 'Clear paths',
    iter: 'iterations',
    fval: 'current cost',
    statusDone: 'converged',
    statusDiv: 'diverged 💥',
    statusRun: 'running…',
    statusIdle: 'click the landscape to start',
    condTitle: 'Why plain gradient descent struggles',
    cond1: 'Two lessons from the playground carry directly over to camera calibration:',
    condList: [
      'Conditioning. If the cost is much steeper in one parameter than another, the gradient points mostly across the valley, not along it. In calibration this is guaranteed: changing f by 1 changes pixels by ~0.3, changing k1 by 1 changes them by hundreds. Descent methods need per-parameter scaling (preconditioning) to survive.',
      'Local minima and initialization. Descent finds the nearest valley. A cost as nonlinear as reprojection error has spurious valleys - which is why real calibration first computes a closed-form starting point (Zhang) and only then optimizes.',
    ],
    cond2: 'Momentum is the cheapest fix for zigzagging: accumulate a velocity so that components that keep flipping sign cancel, and components that persist add up:',
    newtonTitle: 'Using curvature: Newton, Gauss-Newton, Levenberg-Marquardt',
    newton1: 'The gradient knows only the slope. The Hessian H (second derivatives) also knows the curvature - how quickly the slope changes. Newton’s method fits a quadratic bowl to the local landscape and jumps straight to that bowl’s minimum:',
    newton2: 'For least-squares costs - ours! - there is a beautiful shortcut. With residuals r(θ) and their Jacobian J = ∂r/∂θ, the Hessian is approximately JᵀJ: curvature for free, using only first derivatives. That is the Gauss-Newton method.',
    newton3: 'Far from the minimum the quadratic model can be nonsense (or JᵀJ nearly singular). Levenberg-Marquardt fixes this with a damping term λ that blends between the two worlds - and adapts λ automatically: after a good step trust the model more (λ↓), after a rejected step trust it less (λ↑):',
    newton4: 'Play with λ in the playground: large λ makes LM behave like small-step gradient descent, small λ like pure Newton. This one dial is why LM is the workhorse of geometric vision: OpenCV’s calibrateCamera, stereoCalibrate and friends all run LM at their core.',
    solverTitle: 'Interactive: watch a calibration converge',
    solver1: 'This is a real solver running in your browser. Ground truth: a camera with f = 560, c = (331, 246), k1 = −0.18 observed a checkerboard in 6 known poses; the “detected” corners carry Gaussian pixel noise. Starting from a deliberately bad guess, gradient descent or Levenberg-Marquardt must recover the four parameters θ = (f, cx, cy, k1) by minimizing reprojection error.',
    solver2: 'The amber points are where the current estimate reprojects the board corners; the red whiskers connect them to the detections. Watch them snap onto the cyan detections as the cost drops.',
    solverTry: [
      'Run LM: convergence in ~5-10 iterations, RMS drops to the noise floor.',
      'Reset and run GD (even generously preconditioned): hundreds of iterations, and the coupled parameters f ↔ k1 make it crawl along a curved valley - visible in the landscape slice.',
      'Raise the noise σ and re-run: the estimate still converges, but the final RMS settles at the noise level (≈ √2·σ, since it is a 2-D distance) and the recovered parameters wobble around the truth. You cannot fit better than your measurements.',
      'Perturb the start until GD diverges or stalls - then note that LM still recovers. Robustness to a mediocre start is part of its power.',
    ],
    obsImage: 'Sensor image - view',
    detected: 'detected (with noise)',
    reprojected: 'reprojected (current θ)',
    landscape: 'Cost landscape - slice through (f, k1), with cx, cy at their optimal values',
    conv: 'RMS error over iterations (log scale)',
    params: 'Parameters',
    pEst: 'estimate',
    pTrue: 'truth',
    pErr: 'error',
    noise: 'pixel noise σ',
    rms: 'RMS error',
    perturb: 'Perturb start',
    reset: 'Reset',
    lmLambda: 'current λ',
    lmLambdaHist: 'λ per iteration (log scale) - it drops after every accepted step',
    bigTitle: 'The real thing: full bundle adjustment',
    big1: 'The solver above fixed the board poses to keep θ four-dimensional. Real calibration estimates everything jointly: intrinsics (4), distortion (5) and one 6-DoF pose per view - for 20 views, 129 unknowns against ~14,000 residuals. The same LM machinery handles it, thanks to structure:',
    bigList: [
      'Sparsity: each residual depends on the shared intrinsics and only its own view’s pose. JᵀJ becomes arrow-shaped and can be factorized view-by-view (the Schur complement) - this is what makes bundle adjustment with thousands of images feasible.',
      'Initialization: Zhang’s closed form supplies the starting point; LM then typically converges in under 20 iterations.',
      'Robustness: real corner detections contain outliers. Replacing the square by a Huber or Cauchy kernel keeps a single bad corner from dragging the whole solution.',
      'Stopping: iterate until the cost decrease, the gradient norm or the step size falls below tolerance - machine precision is pointless when the data has σ ≈ 0.1 px.',
    ],
    big2: 'And it is everywhere: stereoCalibrate refines R, t between cameras the same way; hand-eye calibration polishes its closed-form X with the same LM; structure-from-motion and SLAM are bundle adjustment at scale; photogrammetry has run it since before computers were digital.',
    whenTitle: 'Choosing the right tool',
    when1: 'The full potential of numerical optimization comes from matching the method to the problem structure:',
    whenList: [
      'Small-to-medium smooth least squares (calibration, PnP, bundle adjustment, hand-eye): Gauss-Newton / Levenberg-Marquardt. Curvature is cheap (JᵀJ), convergence is quadratic near the optimum.',
      'Millions of parameters, cost as a sum over huge datasets (training neural networks): JᵀJ is unthinkable. First-order methods rule - stochastic gradient descent on mini-batches, stabilized by momentum and per-parameter step scaling (Adam is exactly “momentum + automatic preconditioning”).',
      'Non-smooth or gradient-free problems: subgradient, proximal or direct-search methods - outside our scope, but the landscape picture still applies.',
    ],
    when2: 'One mental model unifies all of it: define a cost, get a slope, exploit whatever structure the problem offers to descend fast. Whether the parameters are four camera numbers or a billion network weights, it is the same walk downhill.',
    codeTitle: 'Try it on real data',
    appTitle: '🏭 In the real world: fitting a sensor characteristic',
    appIntro:
      'Every thermistor datasheet gives the exponential law R(T) = R₀·exp(B(1/T − 1/T₀)) - but for YOUR sensor batch, R₀ and B must be identified from a handful of measured (T, R) points. That identification is a two-parameter nonlinear least-squares problem, solved with exactly this module’s Levenberg-Marquardt. Set a starting guess with the sliders, then let LM iterate: the curve locks onto the points in a handful of steps. Sensor vendors run this fit millions of times a year.',
    appR0: 'start guess R₀',
    appB: 'start guess B',
    appFit: 'LM step',
    appRun: 'Fit',
    appReset: 'Reset',
    appRms: 'fit RMS',
    appParams: 'identified R₀ / B',
    appWhere:
      'The same nonlinear fit identifies load-cell polynomials, pump curves, battery-discharge models, camera response curves and PID plant models - parameter identification is the daily bread of every test engineer.',
  },
  de: {
    kicker: 'Vision · Modul 3',
    title: 'Numerische Optimierung',
    intro:
      'Modul 2 endete mit einem Satz, der ein eigenes Modul verdient: „alles gemeinsam verfeinern durch Minimierung des Reprojektionsfehlers“. Genau so werden fast alle geometrischen Parameter der Computer Vision - Intrinsik, Verzeichnung, Stereo-Extrinsik, Hand-Auge-Transformationen - tatsächlich gefunden: als Minimum einer Kostenfunktion, numerisch aufgespürt.',
    costTitle: 'Kalibrierung ist verkleidete Optimierung',
    cost1:
      'Alle Unbekannten wandern in einen Parametervektor θ. Bei der Kamerakalibrierung enthält θ die Intrinsik, die Verzeichnungskoeffizienten und die Pose des Bretts in jeder Ansicht. Das Modell π(θ, X) sagt vorher, wo Brettecke X im Bild erscheinen sollte; die Detektion x̂ sagt, wo sie wirklich ist. Die Abweichung, summiert über alle Ecken aller Ansichten, ist die Kostenfunktion:',
    cost2:
      'Kalibrieren heißt: das θ finden, das diese Zahl so klein wie möglich macht. C hängt von einem Dutzend oder mehr Variablen ab - ∇C = 0 lässt sich nicht von Hand lösen. Aber man kann C und seine Steigung an jedem Punkt auswerten und bergab laufen. Man stelle sich C als Landschaft über dem Parameterraum vor: Täler sind gute Erklärungen der Daten, und das tiefste Tal ist die gesuchte Kalibrierung.',
    gdTitle: 'Bergab laufen: Gradientenabstieg',
    gd1: 'Der Gradient ∇C zeigt in Richtung des steilsten Anstiegs - sein Negatives ist also lokal die beste Abstiegsrichtung. Gradientenabstieg wiederholt eine einzige kleine Idee: einen kleinen Schritt bergab gehen, die Steigung neu messen, wiederholen.',
    gd2: 'Die Schrittweite α (Lernrate) ist die Achillesferse des Verfahrens: zu klein, und man kriecht tausende Iterationen; zu groß, und man schießt über den Talboden hinaus und oszilliert - oder explodiert.',
    gd1dTitle: 'Interaktiv: Gradientenabstieg mit einem einzigen Parameter',
    gd1dIntro:
      'Vor den Landschaften eine Dimension - hier sieht man alles. Die rot gestrichelte Linie ist die Tangente am Ball; ihre Steigung C′(θ) ist die gesamte Information, die der Gradientenabstieg nutzt. Jeder Schritt bewegt θ um −α·C′(θ) (der bernsteinfarbene Pfeil unten). Klicke irgendwo hin, um einen neuen Start zu setzen.',
    gd1dHint: 'klicken, um den Start zu setzen',
    gd1dReset: 'Zurücksetzen',
    gd1dSlope: 'Steigung C′(θ)',
    gd1dStep: 'nächster Schritt −α·C′(θ)',
    gd1dTry: [
      'Kleines α: sicher, aber langsam - und beachte, dass die Schritte nahe dem Minimum von selbst kleiner werden, weil die Steigung es tut.',
      'Großes α (ab ≈ 0,3): Der Ball schießt über den Talboden hinaus und springt zwischen den Wänden hin und her; jenseits der Stabilitätsgrenze fliegt er aus dem Bild.',
      'Start links vs. rechts des Buckels: zwei verschiedene Minima. Der Gradientenabstieg ahnt nicht, dass das linke tiefer ist - er sieht immer nur die lokale Steigung.',
    ],
    playTitle: 'Interaktiv: Abstiegs-Spielplatz',
    play1: 'Dasselbe Spiel in zwei Dimensionen - jetzt ist der Gradient eine Richtung. Bewege die Maus über die Landschaft, um das Bergab-Feld zu spüren (bernsteinfarbener Pfeil = −∇C), klicke dann, um einen Startpunkt zu setzen, wähle ein Verfahren und starte. Pfade bleiben stehen, damit sich Verfahren und Einstellungen vergleichen lassen. Dunkle Becken sind Minima; ✕ markiert die wahren Minimalstellen.',
    playTry: [
      'Schüssel, GD, α ≈ 0,1 - glatte Konvergenz. Nun α ≈ 1,1: Jeder Schritt schießt über das Zentrum hinaus, der Pfad explodiert. Die Stabilitätsgrenze α < 2/λmax setzt die Krümmung.',
      'Enges Tal, GD - der klassische Fehlschlag: Zickzack quer zur steilen Richtung, kaum Fortschritt entlang der flachen. Genau das machen schlecht skalierte Parameter bei der Kalibrierung.',
      'Enges Tal, Momentum β ≈ 0,9 - das Zickzack mittelt sich heraus, der Fortschritt entlang des Tals akkumuliert.',
      'Rosenbrock, GD vs. gedämpftes Newton - GD braucht tausende Schritte im gekrümmten Tal; Newton mit kleinem λ springt in einer Handvoll zum Minimum, weil es die Krümmung nutzt, nicht nur die Steigung.',
      'Zwei Gruben - Start links vs. rechts des Rückens: Abstiegsverfahren finden nur das nächstgelegene Minimum. Deshalb braucht Kalibrierung einen guten Startwert (Zhangs geschlossene Lösung!).',
    ],
    fnNames: { bowl: 'Schüssel', valley: 'enges Tal', rosenbrock: 'Rosenbrock', twopits: 'zwei Gruben' },
    mNames: { gd: 'Gradientenabstieg', mom: '+ Momentum', lm: 'Gedämpftes Newton (LM)' },
    lr: 'Lernrate α',
    beta: 'Momentum β',
    lambda: 'Dämpfung λ',
    run: 'Start',
    pause: 'Pause',
    step: 'Schritt',
    clear: 'Pfade löschen',
    iter: 'Iterationen',
    fval: 'aktuelle Kosten',
    statusDone: 'konvergiert',
    statusDiv: 'divergiert 💥',
    statusRun: 'läuft…',
    statusIdle: 'in die Landschaft klicken zum Starten',
    condTitle: 'Warum reiner Gradientenabstieg kämpft',
    cond1: 'Zwei Lektionen aus dem Spielplatz übertragen sich direkt auf die Kamerakalibrierung:',
    condList: [
      'Konditionierung. Ist die Kostenfunktion in einem Parameter viel steiler als in einem anderen, zeigt der Gradient hauptsächlich quer zum Tal statt hindurch. Bei der Kalibrierung ist das garantiert: f um 1 zu ändern verschiebt Pixel um ~0,3, k1 um 1 zu ändern um Hunderte. Abstiegsverfahren brauchen parameterweise Skalierung (Präkonditionierung), um zu überleben.',
      'Lokale Minima und Initialisierung. Der Abstieg findet das nächstgelegene Tal. Eine so nichtlineare Kostenfunktion wie der Reprojektionsfehler hat Scheintäler - deshalb berechnet echte Kalibrierung zuerst einen geschlossenen Startwert (Zhang) und optimiert erst dann.',
    ],
    cond2: 'Momentum ist die billigste Abhilfe gegen das Zickzack: Man akkumuliert eine Geschwindigkeit, sodass Komponenten mit wechselndem Vorzeichen sich aufheben und beständige Komponenten sich aufsummieren:',
    newtonTitle: 'Krümmung nutzen: Newton, Gauß-Newton, Levenberg-Marquardt',
    newton1: 'Der Gradient kennt nur die Steigung. Die Hesse-Matrix H (zweite Ableitungen) kennt auch die Krümmung - wie schnell sich die Steigung ändert. Das Newton-Verfahren passt lokal eine quadratische Schüssel an die Landschaft an und springt direkt zu deren Minimum:',
    newton2: 'Für Kleinste-Quadrate-Kosten - unsere! - gibt es eine wunderbare Abkürzung. Mit Residuen r(θ) und ihrer Jacobimatrix J = ∂r/∂θ ist die Hesse-Matrix näherungsweise JᵀJ: Krümmung gratis, nur aus ersten Ableitungen. Das ist das Gauß-Newton-Verfahren.',
    newton3: 'Weit weg vom Minimum kann das quadratische Modell Unsinn sein (oder JᵀJ fast singulär). Levenberg-Marquardt repariert das mit einem Dämpfungsterm λ, der zwischen beiden Welten überblendet - und λ automatisch anpasst: nach einem guten Schritt dem Modell mehr vertrauen (λ↓), nach einem verworfenen weniger (λ↑):',
    newton4: 'Spiele im Spielplatz mit λ: Großes λ lässt LM wie kleinschrittigen Gradientenabstieg laufen, kleines λ wie reines Newton. Dieser eine Drehknopf ist der Grund, warum LM das Arbeitspferd der geometrischen Vision ist: OpenCVs calibrateCamera, stereoCalibrate & Co. laufen im Kern alle auf LM.',
    solverTitle: 'Interaktiv: einer Kalibrierung beim Konvergieren zusehen',
    solver1: 'Hier läuft ein echter Löser in deinem Browser. Grundwahrheit: Eine Kamera mit f = 560, c = (331, 246), k1 = −0,18 hat ein Schachbrett in 6 bekannten Posen beobachtet; die „detektierten“ Ecken tragen gaußsches Pixelrauschen. Von einem absichtlich schlechten Startwert aus müssen Gradientenabstieg oder Levenberg-Marquardt die vier Parameter θ = (f, cx, cy, k1) durch Minimierung des Reprojektionsfehlers rekonstruieren.',
    solver2: 'Die bernsteinfarbenen Punkte zeigen, wohin die aktuelle Schätzung die Brettecken reprojiziert; die roten Fäden verbinden sie mit den Detektionen. Beobachte, wie sie auf die cyanfarbenen Detektionen einrasten, während die Kosten fallen.',
    solverTry: [
      'LM starten: Konvergenz in ~5-10 Iterationen, der RMS fällt bis auf das Rauschniveau.',
      'Zurücksetzen und GD starten (sogar großzügig präkonditioniert): hunderte Iterationen, und die gekoppelten Parameter f ↔ k1 lassen es durch ein gekrümmtes Tal kriechen - sichtbar im Landschaftsschnitt.',
      'Rauschen σ erhöhen und neu starten: Die Schätzung konvergiert weiterhin, aber der finale RMS bleibt auf dem Rauschniveau stehen (≈ √2·σ, weil er ein 2D-Abstand ist) und die Parameter wackeln um die Wahrheit. Besser als die Messungen kann man nicht fitten.',
      'Den Start verschieben, bis GD divergiert oder stehen bleibt - LM erholt sich trotzdem. Robustheit gegen mittelmäßige Startwerte ist Teil seiner Stärke.',
    ],
    obsImage: 'Sensorbild - Ansicht',
    detected: 'detektiert (mit Rauschen)',
    reprojected: 'reprojiziert (aktuelles θ)',
    landscape: 'Kostenlandschaft - Schnitt durch (f, k1), cx und cy auf ihren Optimalwerten',
    conv: 'RMS-Fehler über Iterationen (log-Skala)',
    params: 'Parameter',
    pEst: 'Schätzung',
    pTrue: 'Wahrheit',
    pErr: 'Fehler',
    noise: 'Pixelrauschen σ',
    rms: 'RMS-Fehler',
    perturb: 'Start verschieben',
    reset: 'Zurücksetzen',
    lmLambda: 'aktuelles λ',
    lmLambdaHist: 'λ pro Iteration (log-Skala) - nach jedem akzeptierten Schritt fällt es',
    bigTitle: 'Das echte Ding: vollständiger Bündelausgleich',
    big1: 'Der Löser oben hielt die Brettposen fest, damit θ vierdimensional bleibt. Echte Kalibrierung schätzt alles gemeinsam: Intrinsik (4), Verzeichnung (5) und eine 6-FG-Pose pro Ansicht - bei 20 Ansichten 129 Unbekannte gegen ~14.000 Residuen. Dieselbe LM-Maschinerie schafft das dank Struktur:',
    bigList: [
      'Dünnbesetztheit: Jedes Residuum hängt von der gemeinsamen Intrinsik und nur der Pose seiner eigenen Ansicht ab. JᵀJ bekommt Pfeilform und lässt sich ansichtsweise faktorisieren (Schur-Komplement) - das macht Bündelausgleich mit tausenden Bildern überhaupt machbar.',
      'Initialisierung: Zhangs geschlossene Lösung liefert den Startpunkt; LM konvergiert dann typischerweise in unter 20 Iterationen.',
      'Robustheit: Echte Eckendetektionen enthalten Ausreißer. Ersetzt man das Quadrat durch einen Huber- oder Cauchy-Kernel, kann eine einzelne schlechte Ecke nicht mehr die ganze Lösung verziehen.',
      'Abbruch: iterieren, bis Kostenabnahme, Gradientennorm oder Schrittweite unter die Toleranz fallen - Maschinengenauigkeit ist sinnlos, wenn die Daten σ ≈ 0,1 px haben.',
    ],
    big2: 'Und es steckt überall: stereoCalibrate verfeinert R, t zwischen den Kameras genauso; die Hand-Auge-Kalibrierung poliert ihr geschlossenes X mit demselben LM; Structure-from-Motion und SLAM sind Bündelausgleich im Großformat; die Photogrammetrie rechnet ihn, seit es Computer gibt.',
    whenTitle: 'Das richtige Werkzeug wählen',
    when1: 'Das volle Potenzial numerischer Optimierung entfaltet sich, wenn das Verfahren zur Problemstruktur passt:',
    whenList: [
      'Kleine bis mittlere glatte Kleinste-Quadrate-Probleme (Kalibrierung, PnP, Bündelausgleich, Hand-Auge): Gauß-Newton / Levenberg-Marquardt. Krümmung ist billig (JᵀJ), Konvergenz nahe dem Optimum quadratisch.',
      'Millionen Parameter, Kosten als Summe über riesige Datensätze (Training neuronaler Netze): JᵀJ ist undenkbar. Verfahren erster Ordnung dominieren - stochastischer Gradientenabstieg auf Mini-Batches, stabilisiert durch Momentum und parameterweise Schrittskalierung (Adam ist genau „Momentum + automatische Präkonditionierung“).',
      'Nicht-glatte oder ableitungsfreie Probleme: Subgradienten-, Proximal- oder Direktsuchverfahren - außerhalb unseres Rahmens, aber das Landschaftsbild gilt weiter.',
    ],
    when2: 'Ein gedankliches Modell vereint alles: Kosten definieren, Steigung besorgen, jede Struktur des Problems ausnutzen, um schnell abzusteigen. Ob die Parameter vier Kamerazahlen sind oder eine Milliarde Netzgewichte - es ist derselbe Weg bergab.',
    codeTitle: 'Am echten Problem ausprobieren',
    appTitle: '🏭 In der echten Welt: eine Sensorkennlinie fitten',
    appIntro:
      'Jedes Thermistor-Datenblatt nennt das Exponentialgesetz R(T) = R₀·exp(B(1/T − 1/T₀)) - aber für DEINE Sensorcharge müssen R₀ und B aus einer Handvoll gemessener (T, R)-Punkte identifiziert werden. Diese Identifikation ist ein nichtlineares Kleinste-Quadrate-Problem mit zwei Parametern, gelöst mit dem Levenberg-Marquardt dieses Moduls. Setze mit den Slidern einen Startwert und lass LM iterieren: Die Kurve rastet in wenigen Schritten auf den Punkten ein. Sensorhersteller rechnen diesen Fit millionenfach pro Jahr.',
    appR0: 'Startwert R₀',
    appB: 'Startwert B',
    appFit: 'LM-Schritt',
    appRun: 'Fitten',
    appReset: 'Zurücksetzen',
    appRms: 'Fit-RMS',
    appParams: 'identifiziert R₀ / B',
    appWhere:
      'Derselbe nichtlineare Fit identifiziert Wägezellen-Polynome, Pumpenkennlinien, Batterie-Entlademodelle, Kamerakennlinien und PID-Streckenmodelle - Parameteridentifikation ist das tägliche Brot jedes Versuchsingenieurs.',
  },
}

const SNIPPET = `import numpy as np
from scipy.optimize import least_squares

def residuals(theta, cam_pts, detected):        # theta = [f, cx, cy, k1]
    f, cx, cy, k1 = theta
    xn = cam_pts[:, 0] / cam_pts[:, 2]
    yn = cam_pts[:, 1] / cam_pts[:, 2]
    r2 = xn**2 + yn**2
    u = f * xn * (1 + k1 * r2) + cx
    v = f * yn * (1 + k1 * r2) + cy
    return np.concatenate([u - detected[:, 0], v - detected[:, 1]])

sol = least_squares(residuals, x0=[400, 300, 265, 0.0],
                    args=(cam_pts, detected), method="lm")
print(sol.x, "RMS:", np.sqrt(np.mean(sol.fun**2)))   # ≈ ground truth, ≈ noise σ`

// ================================================================ 1D gradient descent intro

const F1D = (x: number) => 0.3 * x ** 4 - 1.5 * x * x + 0.4 * x + 2.6
const G1D = (x: number) => 1.2 * x ** 3 - 3 * x + 0.4

const G1_W = 560
const G1_H = 300
const G1_XR: Vec2 = [-2.35, 2.35]

function Gd1D() {
  const t = useT(T)
  const [theta, setTheta] = useState(-0.35)
  const [trail, setTrail] = useState<number[]>([-0.35])
  const [lr, setLr] = useState(0.08)
  const [running, setRunning] = useState(false)
  const trailRef = useRef(trail)
  trailRef.current = trail

  const yRange = useMemo(() => {
    let mn = Infinity
    let mx = -Infinity
    for (let i = 0; i <= 200; i++) {
      const v = F1D(G1_XR[0] + (i / 200) * (G1_XR[1] - G1_XR[0]))
      mn = Math.min(mn, v)
      mx = Math.max(mx, v)
    }
    return [mn - 0.4, mx + 0.4] as Vec2
  }, [])

  const mx = (x: number) => ((x - G1_XR[0]) / (G1_XR[1] - G1_XR[0])) * G1_W
  const my = (y: number) => G1_H - 24 - ((y - yRange[0]) / (yRange[1] - yRange[0])) * (G1_H - 40)

  const curve = Array.from({ length: 160 }, (_, i) => {
    const x = G1_XR[0] + (i / 159) * (G1_XR[1] - G1_XR[0])
    return `${mx(x)},${my(F1D(x))}`
  }).join(' ')

  const step = (): boolean => {
    const cur = trailRef.current
    const th = cur[cur.length - 1]
    const next = th - lr * G1D(th)
    setTrail([...cur, next])
    setTheta(next)
    if (!isFinite(next) || Math.abs(next) > 6 || Math.abs(G1D(next)) < 1e-4 || cur.length > 200) {
      setRunning(false)
      return false
    }
    return true
  }

  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => {
      if (!step()) clearInterval(iv)
    }, 160)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, lr])

  const setStart = (x: number) => {
    setRunning(false)
    setTheta(x)
    setTrail([x])
  }

  const g = G1D(theta)
  const inView = Math.abs(theta) <= G1_XR[1]
  // tangent endpoints in domain space: y = C(θ) + C'(θ)·(x − θ)
  const tangent = inView
    ? {
        p1: [theta - 0.55, F1D(theta) - 0.55 * g] as Vec2,
        p2: [theta + 0.55, F1D(theta) + 0.55 * g] as Vec2,
      }
    : null
  const nextTheta = theta - lr * g

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">
          C(θ) - {t.gd1dHint}
        </div>
        <svg
          viewBox={`0 0 ${G1_W} ${G1_H}`}
          className="block w-full cursor-crosshair touch-none"
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = G1_XR[0] + ((e.clientX - rect.left) / rect.width) * (G1_XR[1] - G1_XR[0])
            setStart(x)
          }}
        >
          <defs>
            <marker id="gd1dArr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,1 L7,4 L0,7 z" fill="#fbbf24" />
            </marker>
          </defs>
          <polyline points={curve} fill="none" stroke="#22d3ee" strokeWidth={2.5} />
          {trail.map(
            (x, i) =>
              Math.abs(x) <= G1_XR[1] && (
                <circle key={i} cx={mx(x)} cy={my(F1D(x))} r={3} fill="#a78bfa" opacity={0.25 + (0.75 * i) / trail.length} />
              ),
          )}
          {tangent && (
            <line
              x1={mx(tangent.p1[0])}
              y1={my(tangent.p1[1])}
              x2={mx(tangent.p2[0])}
              y2={my(tangent.p2[1])}
              stroke="rgba(248,113,113,0.85)"
              strokeWidth={1.8}
              strokeDasharray="5 4"
            />
          )}
          {inView && Math.abs(nextTheta) <= G1_XR[1] && (
            <line
              x1={mx(theta)}
              y1={G1_H - 12}
              x2={mx(nextTheta)}
              y2={G1_H - 12}
              stroke="#fbbf24"
              strokeWidth={2}
              markerEnd="url(#gd1dArr)"
            />
          )}
          {inView && (
            <circle cx={mx(theta)} cy={my(F1D(theta))} r={7} fill="#fbbf24" stroke="#0a0e17" strokeWidth={2} />
          )}
        </svg>
      </div>
      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="card-pad space-y-4">
          <Slider label={t.lr} value={lr} min={0.005} max={0.5} step={0.005} onChange={setLr} format={(v) => fmt(v, 3)} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => (running ? setRunning(false) : setRunning(true))}>
              {running ? `⏸ ${t.pause}` : `▶ ${t.run}`}
            </button>
            <button className="btn" onClick={step}>
              {t.step}
            </button>
            <button className="btn" onClick={() => setStart(-0.35)}>
              ↺ {t.gd1dReset}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.gd1dSlope} value={fmt(g, 2)} accent="#f87171" />
          <Readout label={t.gd1dStep} value={fmt(-lr * g, 3)} accent="#fbbf24" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label="θ" value={fmt(theta, 3)} />
          <Readout label={t.fval} value={fmt(F1D(theta), 3)} />
        </div>
      </div>
    </div>
  )
}

// ================================================================ descent playground

type FnKey = keyof typeof FN2D
type Method = 'gd' | 'mom' | 'lm'
const METHOD_COLORS: Record<Method, string> = { gd: '#22d3ee', mom: '#a78bfa', lm: '#4ade80' }

interface Run {
  method: Method
  pts: Vec2[]
  vel: Vec2
  status: 'running' | 'done' | 'diverged'
}

const PW = 560
const PH = 440

function DescentPlayground() {
  const t = useT(T)
  const [fnKey, setFnKey] = useState<FnKey>('valley')
  const [method, setMethod] = useState<Method>('gd')
  const [lrExp, setLrExp] = useState(-1)
  const [beta, setBeta] = useState(0.9)
  const [lamExp, setLamExp] = useState(-1.5)
  const [runs, setRuns] = useState<Run[]>([])
  const [running, setRunning] = useState(false)
  const [hoverArrow, setHoverArrow] = useState<{ p1: Vec2; p2: Vec2 } | null>(null)
  const runsRef = useRef(runs)
  runsRef.current = runs

  const fn: Fn2D = FN2D[fnKey]
  const lr = 10 ** lrExp
  const lambda = 10 ** lamExp

  const toPx = (p: Vec2): Vec2 => [
    ((p[0] - fn.domain.x[0]) / (fn.domain.x[1] - fn.domain.x[0])) * PW,
    ((p[1] - fn.domain.y[0]) / (fn.domain.y[1] - fn.domain.y[0])) * PH,
  ]

  const spanX = fn.domain.x[1] - fn.domain.x[0]

  const advance = (run: Run): Run => {
    const p = run.pts[run.pts.length - 1]
    let np: Vec2 = p
    let vel = run.vel
    if (method === 'gd') np = gdStep2D(fn, p, lr)
    else if (method === 'mom') {
      const r = momentumStep2D(fn, p, run.vel, lr, beta)
      np = r.p
      vel = r.v
    } else np = lmStep2D(fn, p, lambda)
    if (!isFinite(np[0]) || !isFinite(np[1]) || Math.abs(np[0]) + Math.abs(np[1]) > spanX * 6)
      return { ...run, pts: [...run.pts, np], status: 'diverged' }
    const g = fn.grad(np[0], np[1])
    const done = Math.hypot(g[0], g[1]) < 1e-3 || run.pts.length > 500
    return { ...run, pts: [...run.pts, np], vel, status: done ? 'done' : 'running' }
  }

  const stepOnce = () => {
    const cur = runsRef.current
    const last = cur[cur.length - 1]
    if (!last || last.status !== 'running') return false
    const next = advance(last)
    setRuns([...cur.slice(0, -1), next])
    if (next.status !== 'running') {
      setRunning(false)
      return false
    }
    return true
  }

  useEffect(() => {
    if (!running) return
    const perTick = method === 'lm' ? 1 : 4
    const iv = setInterval(
      () => {
        for (let i = 0; i < perTick; i++) if (!stepOnce()) break
      },
      method === 'lm' ? 220 : 40,
    )
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, method, lrExp, beta, lamExp, fnKey])

  const startAt = (x: number, y: number) => {
    setRuns([...runsRef.current, { method, pts: [[x, y]], vel: [0, 0], status: 'running' }])
    setRunning(true)
  }

  const last = runs[runs.length - 1]
  const curP = last?.pts[last.pts.length - 1]
  const status = !last
    ? t.statusIdle
    : last.status === 'diverged'
      ? t.statusDiv
      : last.status === 'done'
        ? t.statusDone
        : running
          ? t.statusRun
          : '⏸'

  const switchFn = (k: FnKey) => {
    setFnKey(k)
    setRuns([])
    setRunning(false)
    setHoverArrow(null)
  }

  const handleHover = (x: number, y: number) => {
    const g = fn.grad(x, y)
    const n = Math.hypot(g[0], g[1])
    if (n < 1e-9) return setHoverArrow(null)
    // small downhill move in domain space, then normalized to a fixed pixel length
    const a = toPx([x, y])
    const b = toPx([x - (g[0] / n) * 0.05, y - (g[1] / n) * 0.05])
    const bn = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (bn < 1e-9) return setHoverArrow(null)
    const L = 38
    setHoverArrow({
      p1: a,
      p2: [a[0] + ((b[0] - a[0]) / bn) * L, a[1] + ((b[1] - a[1]) / bn) * L],
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Heatmap
          w={PW}
          h={PH}
          xr={fn.domain.x}
          yr={fn.domain.y}
          cost={fn.f}
          ckey={fnKey}
          onPick={startAt}
          onHover={handleHover}
          onLeave={() => setHoverArrow(null)}
          title={`C(θ₁, θ₂) - ${t.fnNames[fnKey]}`}
        >
          <defs>
            <marker id="negGrad" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,1 L7,4 L0,7 z" fill="#fbbf24" />
            </marker>
          </defs>
          {hoverArrow && (
            <g pointerEvents="none">
              <circle cx={hoverArrow.p1[0]} cy={hoverArrow.p1[1]} r={3} fill="#fbbf24" />
              <line
                x1={hoverArrow.p1[0]}
                y1={hoverArrow.p1[1]}
                x2={hoverArrow.p2[0]}
                y2={hoverArrow.p2[1]}
                stroke="#fbbf24"
                strokeWidth={2}
                markerEnd="url(#negGrad)"
              />
            </g>
          )}
          {fn.minima.map((m, i) => {
            const [mx, my] = toPx(m)
            return (
              <g key={i} stroke="#4ade80" strokeWidth={2}>
                <line x1={mx - 7} y1={my - 7} x2={mx + 7} y2={my + 7} />
                <line x1={mx - 7} y1={my + 7} x2={mx + 7} y2={my - 7} />
              </g>
            )
          })}
          {runs.map((run, ri) => {
            const col = METHOD_COLORS[run.method]
            const pts = run.pts.map(toPx)
            return (
              <g key={ri}>
                <polyline
                  points={pts.map(([a, b]) => `${a},${b}`).join(' ')}
                  fill="none"
                  stroke={col}
                  strokeWidth={ri === runs.length - 1 ? 2.2 : 1.4}
                  opacity={ri === runs.length - 1 ? 1 : 0.55}
                />
                <circle cx={pts[0][0]} cy={pts[0][1]} r={5} fill={col} stroke="#0a0e17" strokeWidth={1.5} />
                {run.status !== 'diverged' && (
                  <circle
                    cx={pts[pts.length - 1][0]}
                    cy={pts[pts.length - 1][1]}
                    r={4}
                    fill="#fff"
                    stroke={col}
                    strokeWidth={2}
                  />
                )}
              </g>
            )
          })}
        </Heatmap>
      </div>
      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="card-pad space-y-4">
          <Segmented<FnKey>
            options={(Object.keys(FN2D) as FnKey[]).map((k) => ({ value: k, label: t.fnNames[k] }))}
            value={fnKey}
            onChange={switchFn}
          />
          <Segmented<Method>
            options={(['gd', 'mom', 'lm'] as Method[]).map((m) => ({ value: m, label: t.mNames[m] }))}
            value={method}
            onChange={setMethod}
          />
          {method !== 'lm' && (
            <Slider label={t.lr} value={lrExp} min={-3} max={0.2} step={0.02} onChange={setLrExp} format={() => lr.toPrecision(2)} />
          )}
          {method === 'mom' && (
            <Slider label={t.beta} value={beta} min={0} max={0.97} step={0.01} onChange={setBeta} format={(v) => fmt(v, 2)} accent="#a78bfa" />
          )}
          {method === 'lm' && (
            <Slider label={t.lambda} value={lamExp} min={-3} max={2} step={0.05} onChange={setLamExp} format={() => lambda.toPrecision(2)} accent="#4ade80" />
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => (running ? setRunning(false) : last?.status === 'running' ? setRunning(true) : startAt(...fn.start))}>
              {running ? `⏸ ${t.pause}` : `▶ ${t.run}`}
            </button>
            <button className="btn" onClick={stepOnce}>
              {t.step}
            </button>
            <button className="btn" onClick={() => { setRuns([]); setRunning(false) }}>
              {t.clear}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.iter} value={last ? `${last.pts.length - 1}` : '0'} />
          <Readout
            label={t.fval}
            value={curP && isFinite(fn.f(curP[0], curP[1])) ? fn.f(curP[0], curP[1]).toPrecision(3) : '-'}
          />
        </div>
        <div className="card px-4 py-2.5 text-[13px] text-muted">
          <span className="mr-2 font-semibold text-ink">Status:</span>
          {status}
        </div>
      </div>
    </div>
  )
}

// ================================================================ calibration solver lab

interface SolverState {
  th: CalibTheta
  lambda: number
  history: number[]
  lamHist: number[]
  status: 'idle' | 'running' | 'done' | 'diverged'
}

const LAND_F: Vec2 = [300, 820]
const LAND_K1: Vec2 = [-0.5, 0.25]

function CalibSolverLab() {
  const t = useT(T)
  const [method, setMethod] = useState<'gd' | 'lm'>('lm')
  const [lrExp, setLrExp] = useState(-0.7)
  const [sigma, setSigma] = useState(0.3)
  const [viewIdx, setViewIdx] = useState(1)
  const obs = useMemo(() => makeObservations(sigma, 42), [sigma])
  const makeInit = (th: CalibTheta): SolverState => ({
    th,
    lambda: 1e-2,
    history: [calibRms(th, obs)],
    lamHist: [1e-2],
    status: 'idle',
  })
  const [st, setSt] = useState<SolverState>(() => makeInit(CALIB_START))
  const [running, setRunning] = useState(false)
  const stRef = useRef(st)
  stRef.current = st

  // reset when the observations change
  useEffect(() => {
    setRunning(false)
    setSt(makeInit(stRef.current.th ? CALIB_START : CALIB_START))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obs])

  const lr = 10 ** lrExp

  const stepOnce = (): boolean => {
    const cur = stRef.current
    let next: SolverState
    if (method === 'gd') {
      const th = gdCalibStep(cur.th, obs, lr)
      const rms = calibRms(th, obs)
      const status = !isFinite(rms) || rms > 5e3 ? 'diverged' : cur.history.length > 800 ? 'done' : 'running'
      next = { ...cur, th, history: [...cur.history, rms], status }
    } else {
      const r = lmCalibStep(cur.th, obs, cur.lambda)
      const rms = calibRms(r.th, obs)
      const prev = cur.history[cur.history.length - 1]
      const status = !r.accepted || Math.abs(prev - rms) < 1e-7 ? 'done' : 'running'
      next = {
        th: r.th,
        lambda: r.lambda,
        history: [...cur.history, rms],
        lamHist: [...cur.lamHist, r.lambda],
        status,
      }
    }
    setSt(next)
    if (next.status !== 'running') {
      setRunning(false)
      return false
    }
    return true
  }

  useEffect(() => {
    if (!running) return
    const perTick = method === 'gd' ? 4 : 1
    const iv = setInterval(
      () => {
        for (let i = 0; i < perTick; i++) if (!stepOnce()) break
      },
      method === 'gd' ? 40 : 300,
    )
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, method, lrExp, obs])

  const reset = () => {
    setRunning(false)
    setSt(makeInit(CALIB_START))
  }
  const perturb = () => {
    setRunning(false)
    setSt(
      makeInit({
        f: 320 + Math.random() * 460,
        cx: 270 + Math.random() * 120,
        cy: 190 + Math.random() * 110,
        k1: -0.45 + Math.random() * 0.6,
      }),
    )
  }

  const reproj = useMemo(() => calibReprojections(st.th), [st.th])
  const vi = viewIdx - 1
  const rms = st.history[st.history.length - 1]

  const landCost = useMemo(
    () => (f: number, k1: number) => calibRms({ f, cx: CALIB_TRUE.cx, cy: CALIB_TRUE.cy, k1 }, obs),
    [obs],
  )
  const LW = 460
  const LH = 340
  const landPx = (thv: CalibTheta): Vec2 => [
    ((thv.f - LAND_F[0]) / (LAND_F[1] - LAND_F[0])) * LW,
    ((thv.k1 - LAND_K1[0]) / (LAND_K1[1] - LAND_K1[0])) * LH,
  ]

  // convergence sparkline
  const CVW = 300
  const CVH = 130
  const logs = st.history.map((r) => Math.log10(Math.max(r, 1e-3)))
  const lmin = Math.min(...logs, -0.7)
  const lmax = Math.max(...logs, 2)
  const convPts = logs
    .map((l, i) => `${8 + (i / Math.max(st.history.length - 1, 1)) * (CVW - 16)},${8 + ((lmax - l) / (lmax - lmin)) * (CVH - 16)}`)
    .join(' ')

  const rows: { name: string; est: number; tru: number; digits: number }[] = [
    { name: 'f', est: st.th.f, tru: CALIB_TRUE.f, digits: 1 },
    { name: 'cx', est: st.th.cx, tru: CALIB_TRUE.cx, digits: 1 },
    { name: 'cy', est: st.th.cy, tru: CALIB_TRUE.cy, digits: 1 },
    { name: 'k1', est: st.th.k1, tru: CALIB_TRUE.k1, digits: 3 },
  ]

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <ImageView
            title={`${t.obsImage} ${viewIdx}/6`}
            points={obs[vi].map(([u, v]) => ({ u, v, color: '#22d3ee', r: 3 }))}
          >
            {reproj[vi].map(([u, v], i) => (
              <g key={i}>
                <line x1={u} y1={v} x2={obs[vi][i][0]} y2={obs[vi][i][1]} stroke="#f87171" strokeWidth={1} />
                <circle cx={u} cy={v} r={3.5} fill="none" stroke="#fbbf24" strokeWidth={1.6} />
              </g>
            ))}
          </ImageView>
          <div className="mt-2 flex items-center gap-4 text-[12px] text-muted">
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#22d3ee]" /> {t.detected}
            </span>
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-[#fbbf24]" /> {t.reprojected}
            </span>
          </div>
        </div>
        <Heatmap w={LW} h={LH} xr={LAND_F} yr={LAND_K1} cost={landCost} ckey={`land-${sigma}`} title={t.landscape}>
          {(() => {
            const [mx, my] = landPx(CALIB_TRUE)
            return (
              <g stroke="#4ade80" strokeWidth={2}>
                <line x1={mx - 7} y1={my - 7} x2={mx + 7} y2={my + 7} />
                <line x1={mx - 7} y1={my + 7} x2={mx + 7} y2={my - 7} />
              </g>
            )
          })()}
          <circle cx={landPx(st.th)[0]} cy={landPx(st.th)[1]} r={5} fill="#fbbf24" stroke="#0a0e17" strokeWidth={1.5} />
          <text x={8} y={LH - 8} fill="#8b93a7" fontSize={11} fontFamily="JetBrains Mono, monospace">
            f →
          </text>
          <text x={8} y={16} fill="#8b93a7" fontSize={11} fontFamily="JetBrains Mono, monospace">
            k1 ↓
          </text>
        </Heatmap>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card-pad space-y-4">
          <Segmented<'gd' | 'lm'>
            options={[
              { value: 'gd', label: t.mNames.gd },
              { value: 'lm', label: 'Levenberg-Marquardt' },
            ]}
            value={method}
            onChange={(m) => {
              setMethod(m)
              setRunning(false)
            }}
          />
          {method === 'gd' && (
            <Slider label={t.lr} value={lrExp} min={-2.5} max={0.4} step={0.02} onChange={setLrExp} format={() => lr.toPrecision(2)} />
          )}
          <Slider label={t.noise} value={sigma} min={0} max={1.5} step={0.05} onChange={setSigma} format={(v) => `${fmt(v, 2)} px`} accent="#fbbf24" />
          <Slider label={`${t.obsImage}`} value={viewIdx} min={1} max={6} step={1} onChange={setViewIdx} format={(v) => `${v}/6`} accent="#8b93a7" />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => (running ? setRunning(false) : (stRef.current.status === 'idle' || stRef.current.status === 'running') && setRunning(true))}>
              {running ? `⏸ ${t.pause}` : `▶ ${t.run}`}
            </button>
            <button className="btn" onClick={stepOnce}>
              {t.step}
            </button>
            <button className="btn" onClick={reset}>
              ↺ {t.reset}
            </button>
            <button className="btn" onClick={perturb}>
              🎲 {t.perturb}
            </button>
          </div>
        </div>

        <div className="card-pad">
          <h4 className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">{t.params}</h4>
          <table className="w-full font-mono text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-muted uppercase">
                <th className="pb-1 font-medium">θ</th>
                <th className="pb-1 font-medium">{t.pEst}</th>
                <th className="pb-1 font-medium">{t.pTrue}</th>
                <th className="pb-1 font-medium">{t.pErr}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t border-white/5">
                  <td className="py-1 text-muted">{r.name}</td>
                  <td className="py-1 text-accent">{fmt(r.est, r.digits)}</td>
                  <td className="py-1 text-ink/60">{fmt(r.tru, r.digits)}</td>
                  <td className="py-1" style={{ color: Math.abs(r.est - r.tru) < (r.name === 'k1' ? 0.01 : 2) ? '#4ade80' : '#f87171' }}>
                    {fmt(Math.abs(r.est - r.tru), r.digits)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Readout label={t.rms} value={isFinite(rms) ? (rms < 10 ? fmt(rms, 3) : fmt(rms, 1)) : '∞'} unit="px" accent={rms < Math.max(sigma * 1.3, 0.05) + 0.05 ? '#4ade80' : undefined} />
            <Readout label={t.iter} value={`${st.history.length - 1}`} />
          </div>
          {method === 'lm' && (
            <div className="mt-2">
              <div className="text-[12px] text-muted">
                {t.lmLambda}: <span className="font-mono text-accent2">{st.lambda.toExponential(1)}</span>
              </div>
              {st.lamHist.length > 1 && (
                <>
                  <svg viewBox="0 0 150 30" className="mt-1 w-full max-w-[220px]">
                    {st.lamHist.map((l, i) => {
                      const bw = 150 / st.lamHist.length
                      const h = Math.max(2, ((Math.log10(l) + 9) / 11) * 28)
                      return (
                        <rect
                          key={i}
                          x={i * bw}
                          y={30 - h}
                          width={Math.max(bw - 1.5, 1.5)}
                          height={h}
                          fill="#a78bfa"
                          opacity={0.85}
                        />
                      )
                    })}
                  </svg>
                  <div className="mt-0.5 text-[10.5px] text-muted">{t.lmLambdaHist}</div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-white/10 px-3 py-1.5 text-[12px] font-medium text-muted">{t.conv}</div>
          <svg viewBox={`0 0 ${CVW} ${CVH}`} className="block w-full">
            {[0, 1, 2].map((d) => {
              const y = 8 + ((lmax - d) / (lmax - lmin)) * (CVH - 16)
              if (y < 4 || y > CVH - 4) return null
              return (
                <g key={d}>
                  <line x1={8} y1={y} x2={CVW - 8} y2={y} stroke="rgba(255,255,255,0.07)" />
                  <text x={CVW - 10} y={y - 3} fill="#8b93a7" fontSize={9} textAnchor="end" fontFamily="JetBrains Mono, monospace">
                    {d === 0 ? '1' : d === 1 ? '10' : '100'}px
                  </text>
                </g>
              )
            })}
            <polyline points={convPts} fill="none" stroke="#22d3ee" strokeWidth={2} strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  )
}

// ================================================================ application: thermistor fit

const THERM_T0 = 298
const THERM_TRUE = { r0: 10, b: 3950 } // R in kΩ
const thermModel = (r0: number, b: number, T: number) =>
  r0 * Math.exp(b * (1 / T - 1 / THERM_T0))

const THERM_DATA: { T: number; R: number }[] = (() => {
  const g = makeGauss(77)
  return Array.from({ length: 10 }, (_, i) => {
    const T = 280 + i * 9
    return { T, R: thermModel(THERM_TRUE.r0, THERM_TRUE.b, T) * (1 + g() * 0.03) }
  })
})()

function thermLmStep(r0: number, b: number, lambda: number): { r0: number; b: number; lambda: number } {
  const res = (p: [number, number]) => THERM_DATA.map((d) => thermModel(p[0], p[1], d.T) - d.R)
  const p0: [number, number] = [r0, b]
  const r = res(p0)
  const steps = [1e-4, 1e-2]
  const J = [0, 1].map((k) => {
    const pp: [number, number] = [...p0]
    pp[k] += steps[k]
    const rp = res(pp)
    return rp.map((v, i) => (v - r[i]) / steps[k])
  })
  const A = [
    [0, 0],
    [0, 0],
  ]
  const g2 = [0, 0]
  for (let a = 0; a < 2; a++) {
    for (let bb = 0; bb < 2; bb++) A[a][bb] = J[a].reduce((s, v, i) => s + v * J[bb][i], 0)
    g2[a] = J[a].reduce((s, v, i) => s + v * r[i], 0)
  }
  const cost = r.reduce((s, v) => s + v * v, 0)
  let lam = lambda
  for (let tries = 0; tries < 6; tries++) {
    const a00 = A[0][0] * (1 + lam)
    const a11 = A[1][1] * (1 + lam)
    const det = a00 * a11 - A[0][1] * A[1][0]
    if (Math.abs(det) > 1e-12) {
      const dx = (-g2[0] * a11 + g2[1] * A[0][1]) / det
      const dy = (g2[0] * A[1][0] - g2[1] * a00) / det
      const cand: [number, number] = [p0[0] + dx, p0[1] + dy]
      const cCost = res(cand).reduce((s, v) => s + v * v, 0)
      if (cCost < cost) return { r0: cand[0], b: cand[1], lambda: Math.max(lam / 3, 1e-8) }
    }
    lam *= 5
  }
  return { r0, b, lambda: lam }
}

function ThermistorLab() {
  const t = useT(T)
  const [start, setStart] = useState({ r0: 4, b: 2000 })
  const [fit, setFit] = useState<{ r0: number; b: number; lambda: number } | null>(null)

  const cur = fit ?? { ...start, lambda: 1e-2 }
  const rms = Math.sqrt(
    THERM_DATA.reduce((s, d) => s + (thermModel(cur.r0, cur.b, d.T) - d.R) ** 2, 0) / THERM_DATA.length,
  )

  const runFit = () => {
    let st = { ...start, lambda: 1e-2 }
    for (let i = 0; i < 25; i++) st = thermLmStep(st.r0, st.b, st.lambda)
    setFit(st)
  }

  const PW = 520
  const PH = 300
  const tx = (T2: number) => ((T2 - 275) / 95) * PW
  const ty = (R: number) => PH - 20 - (Math.min(R, 26) / 26) * (PH - 40)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          <polyline
            points={Array.from({ length: 100 }, (_, i) => {
              const T2 = 278 + (i / 99) * 88
              return `${tx(T2)},${ty(thermModel(cur.r0, cur.b, T2))}`
            }).join(' ')}
            fill="none"
            stroke={fit ? '#4ade80' : '#a78bfa'}
            strokeWidth={2.2}
          />
          {THERM_DATA.map((d, i) => (
            <circle key={i} cx={tx(d.T)} cy={ty(d.R)} r={4.5} fill="#22d3ee" stroke="#0a0e17" strokeWidth={1.2} />
          ))}
          <text x={PW - 10} y={PH - 8} textAnchor="end" fill="#8b93a7" fontSize={11} fontFamily="JetBrains Mono, monospace">
            T (K) →
          </text>
          <text x={10} y={18} fill="#8b93a7" fontSize={11} fontFamily="JetBrains Mono, monospace">
            R (kΩ)
          </text>
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.appR0} value={start.r0} min={2} max={30} step={0.5} onChange={(v) => { setStart({ ...start, r0: v }); setFit(null) }} format={(v) => `${fmt(v, 1)} kΩ`} />
          <Slider label={t.appB} value={start.b} min={1500} max={8000} step={50} onChange={(v) => { setStart({ ...start, b: v }); setFit(null) }} format={(v) => `${v} K`} accent="#a78bfa" />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={runFit}>
              🔧 {t.appRun}
            </button>
            <button className="btn" onClick={() => setFit(fit ? thermLmStep(fit.r0, fit.b, fit.lambda) : thermLmStep(start.r0, start.b, 1e-2))}>
              {t.appFit}
            </button>
            <button className="btn" onClick={() => setFit(null)}>
              ↺ {t.appReset}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.appRms} value={fmt(rms, 3)} unit="kΩ" accent={rms < 0.3 ? '#4ade80' : undefined} />
          <Readout label={t.appParams} value={`${fmt(cur.r0, 2)} / ${fmt(cur.b, 0)}`} />
        </div>
      </div>
    </div>
  )
}

// ================================================================ page

export function OptimizationPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'cost', label: t.costTitle },
          { id: 'gd', label: t.gdTitle },
          { id: 'gd1d', label: t.gd1dTitle },
          { id: 'playground', label: t.playTitle },
          { id: 'conditioning', label: t.condTitle },
          { id: 'newton', label: t.newtonTitle },
          { id: 'solver', label: t.solverTitle },
          { id: 'bundle', label: t.bigTitle },
          { id: 'choosing', label: t.whenTitle },
          { id: 'code', label: t.codeTitle },
          { id: 'application', label: t.appTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="cost" title={t.costTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.cost1}</p>
          <TeX block>{String.raw`C(\theta) \;=\; \sum_{i=1}^{\text{views}} \sum_{j=1}^{\text{corners}} \big\lVert\, \hat{\mathbf{x}}_{ij} - \pi(\theta,\, \mathbf{X}_j) \,\big\rVert^2`}</TeX>
          <p>{t.cost2}</p>
        </div>
      </Section>

      <Section id="gd" title={t.gdTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.gd1}</p>
          <TeX block>{String.raw`\theta_{t+1} \;=\; \theta_t \;-\; \alpha\, \nabla C(\theta_t)`}</TeX>
          <p>{t.gd2}</p>
        </div>
      </Section>

      <Section id="gd1d" title={t.gd1dTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.gd1dIntro}</p>
        </div>
        <div className="mt-4">
          <Gd1D />
        </div>
        <InfoBox title="⚡ Try it">
          <ul className="my-1 list-disc space-y-1 pl-5">
            {t.gd1dTry.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </InfoBox>
      </Section>

      <Section id="playground" title={t.playTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.play1}</p>
        </div>
        <div className="mt-4">
          <DescentPlayground />
        </div>
        <InfoBox title="⚡ Try it">
          <ul className="my-1 list-disc space-y-1 pl-5">
            {t.playTry.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </InfoBox>
      </Section>

      <Section id="conditioning" title={t.condTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.cond1}</p>
          <ul>
            {t.condList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p>{t.cond2}</p>
          <TeX block>{String.raw`\mathbf{v}_{t+1} = \beta\,\mathbf{v}_t - \alpha \nabla C(\theta_t), \qquad \theta_{t+1} = \theta_t + \mathbf{v}_{t+1}`}</TeX>
        </div>
      </Section>

      <Section id="newton" title={t.newtonTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.newton1}</p>
          <TeX block>{String.raw`\theta_{t+1} = \theta_t - H^{-1}\,\nabla C(\theta_t), \qquad H = \nabla^2 C(\theta_t)`}</TeX>
          <p>{t.newton2}</p>
          <TeX block>{String.raw`C = \tfrac12\,\lVert \mathbf{r}(\theta)\rVert^2,\qquad \nabla C = J^{\mathsf T}\mathbf{r}, \qquad H \approx J^{\mathsf T} J`}</TeX>
          <p>{t.newton3}</p>
          <TeX block>{String.raw`\big(J^{\mathsf T} J + \lambda\,\mathrm{diag}(J^{\mathsf T} J)\big)\,\boldsymbol{\delta} = -\,J^{\mathsf T}\mathbf{r}, \qquad \theta_{t+1} = \theta_t + \boldsymbol{\delta}`}</TeX>
          <p>{t.newton4}</p>
        </div>
      </Section>

      <Section id="solver" title={t.solverTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.solver1}</p>
          <p>{t.solver2}</p>
        </div>
        <div className="mt-4">
          <CalibSolverLab />
        </div>
        <InfoBox title="⚡ Try it">
          <ul className="my-1 list-disc space-y-1 pl-5">
            {t.solverTry.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </InfoBox>
      </Section>

      <Section id="bundle" title={t.bigTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.big1}</p>
          <ul>
            {t.bigList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p>{t.big2}</p>
        </div>
      </Section>

      <Section id="choosing" title={t.whenTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.when1}</p>
          <ul>
            {t.whenList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p>{t.when2}</p>
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
          <ThermistorLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
