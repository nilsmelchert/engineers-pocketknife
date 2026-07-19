import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLangState, useT } from '../i18n'
import { TRACKS } from '../components/Layout'

const T = {
  en: {
    title: 'Glossary',
    intro: 'Every load-bearing term on the site, briefly defined and linked to the module that teaches it.',
    filter: 'Filter terms…',
    terms: 'terms',
  },
  de: {
    title: 'Glossar',
    intro: 'Jeder tragende Begriff der Seite, knapp definiert und zum lehrenden Modul verlinkt.',
    filter: 'Begriffe filtern…',
    terms: 'Begriffe',
  },
}

interface Entry {
  term: { en: string; de: string }
  def: { en: string; de: string }
  modules: string[]
}

const G: Entry[] = [
  { term: { en: 'Aliasing', de: 'Aliasing' }, def: { en: 'A high frequency masquerading as a lower one after sampling below the Nyquist rate; the information loss is irreversible.', de: 'Eine hohe Frequenz, die sich nach Abtastung unterhalb der Nyquist-Rate als niedrigere ausgibt; der Informationsverlust ist irreversibel.' }, modules: ['/fourier'] },
  { term: { en: 'Attention (self-)', de: 'Attention (Self-)' }, def: { en: 'The transformer operation where every token weighs every other token via query-key dot products, then mixes their values accordingly.', de: 'Die Transformer-Operation, bei der jedes Token jedes andere über Query-Key-Skalarprodukte gewichtet und deren Values entsprechend mischt.' }, modules: ['/deep-learning', '/vision-transformers'] },
  { term: { en: 'AX = XB', de: 'AX = XB' }, def: { en: 'The hand-eye calibration equation relating robot motions A and camera-observed motions B through the fixed mount transform X.', de: 'Die Hand-Auge-Kalibriergleichung, die Roboterbewegungen A und kamerabeobachtete Bewegungen B über die feste Montagetransformation X verknüpft.' }, modules: ['/hand-eye'] },
  { term: { en: 'Backpropagation', de: 'Backpropagation' }, def: { en: 'Computing all weight gradients of a network in one backward sweep of the chain rule - cost ≈ two forward passes, independent of parameter count.', de: 'Alle Gewichtsgradienten eines Netzes in einem Rückwärtsdurchlauf der Kettenregel berechnen - Kosten ≈ zwei Vorwärtsdurchläufe, unabhängig von der Parameterzahl.' }, modules: ['/neural-networks'] },
  { term: { en: 'Baseline (stereo)', de: 'Basislinie (Stereo)' }, def: { en: 'The distance between the two camera centers; larger baselines give more depth signal but harder matching.', de: 'Der Abstand der beiden Kamerazentren; größere Basislinien geben mehr Tiefensignal, aber schwierigeres Matching.' }, modules: ['/stereo'] },
  { term: { en: 'Bayes’ rule', de: 'Satz von Bayes' }, def: { en: 'The formula for updating beliefs with evidence: posterior ∝ likelihood × prior. The engine behind the Kalman filter and Bayesian learning.', de: 'Die Formel zum Aktualisieren von Überzeugungen mit Evidenz: Posterior ∝ Likelihood × Prior. Der Motor hinter Kalman-Filter und Bayesschem Lernen.' }, modules: ['/probability', '/kalman'] },
  { term: { en: 'Bias-variance trade-off', de: 'Bias-Varianz-Kompromiss' }, def: { en: 'Simple models are systematically wrong (bias), flexible models memorize their sample (variance); the test-error U-curve shows the balance.', de: 'Einfache Modelle sind systematisch falsch (Bias), flexible merken sich ihre Stichprobe (Varianz); die Testfehler-U-Kurve zeigt die Balance.' }, modules: ['/ml-basics'] },
  { term: { en: 'Bundle adjustment', de: 'Bündelausgleich' }, def: { en: 'Joint nonlinear refinement of all camera parameters and 3D points by minimizing total reprojection error; solved with sparse Levenberg-Marquardt.', de: 'Gemeinsame nichtlineare Verfeinerung aller Kameraparameter und 3D-Punkte durch Minimierung des Gesamtreprojektionsfehlers; gelöst mit dünnbesetztem Levenberg-Marquardt.' }, modules: ['/optimization'] },
  { term: { en: 'Central limit theorem', de: 'Zentraler Grenzwertsatz' }, def: { en: 'Sums of many independent random effects tend toward a Gaussian - the reason measurement noise is usually bell-shaped.', de: 'Summen vieler unabhängiger Zufallseffekte streben gegen eine Gauß-Verteilung - der Grund, warum Messrauschen meist glockenförmig ist.' }, modules: ['/probability'] },
  { term: { en: 'Convolution', de: 'Faltung' }, def: { en: 'A sliding weighted sum of a signal with a kernel; multiplication in the frequency domain, and the core operation of CNNs.', de: 'Eine gleitende gewichtete Summe eines Signals mit einem Kern; Multiplikation im Frequenzbereich und Kernoperation von CNNs.' }, modules: ['/fourier', '/deep-learning'] },
  { term: { en: 'Covariance matrix', de: 'Kovarianzmatrix' }, def: { en: 'The table of how dimensions co-vary; its eigenvectors are the principal axes (PCA), and it encodes uncertainty in Kalman filters.', de: 'Die Tabelle, wie Dimensionen kovariieren; ihre Eigenvektoren sind die Hauptachsen (PCA), und sie kodiert Unsicherheit in Kalman-Filtern.' }, modules: ['/pca', '/kalman'] },
  { term: { en: 'DBSCAN', de: 'DBSCAN' }, def: { en: 'Density-based clustering: core points with enough ε-neighbors grow clusters of arbitrary shape; sparse points become noise.', de: 'Dichtebasiertes Clustering: Kernpunkte mit genug ε-Nachbarn lassen Cluster beliebiger Form wachsen; dünne Punkte werden Rauschen.' }, modules: ['/clustering-2'] },
  { term: { en: 'Dead reckoning', de: 'Koppelnavigation' }, def: { en: 'Estimating pose by integrating odometry alone; noise accumulates without bound - the problem SLAM exists to solve.', de: 'Posenschätzung durch reines Aufintegrieren der Odometrie; das Rauschen akkumuliert unbeschränkt - das Problem, für das SLAM existiert.' }, modules: ['/slam'] },
  { term: { en: 'Disparity', de: 'Disparität' }, def: { en: 'The horizontal image shift of a point between rectified stereo views; inversely proportional to depth (Z = f·b/d).', de: 'Die horizontale Bildverschiebung eines Punkts zwischen rektifizierten Stereoansichten; umgekehrt proportional zur Tiefe (Z = f·b/d).' }, modules: ['/stereo'] },
  { term: { en: 'Eigenvector / eigenvalue', de: 'Eigenvektor / Eigenwert' }, def: { en: 'Directions a matrix only stretches, and the stretch factors; for covariance matrices they give the principal components.', de: 'Richtungen, die eine Matrix nur streckt, und die Streckfaktoren; bei Kovarianzmatrizen liefern sie die Hauptkomponenten.' }, modules: ['/pca', '/svd'] },
  { term: { en: 'EKF (extended Kalman filter)', de: 'EKF (erweitertes Kalman-Filter)' }, def: { en: 'The Kalman filter applied to nonlinear systems by linearizing motion and measurement models with Jacobians at the current estimate.', de: 'Das Kalman-Filter für nichtlineare Systeme, indem Bewegungs- und Messmodell per Jacobimatrizen an der aktuellen Schätzung linearisiert werden.' }, modules: ['/slam', '/kalman'] },
  { term: { en: 'Epipolar line', de: 'Epipolarlinie' }, def: { en: 'The line in the second image on which the match of a point must lie - the intersection of the epipolar plane with the image.', de: 'Die Linie im zweiten Bild, auf der die Korrespondenz eines Punkts liegen muss - der Schnitt der Epipolarebene mit dem Bild.' }, modules: ['/stereo'] },
  { term: { en: 'Expectation-maximization (EM)', de: 'Expectation-Maximization (EM)' }, def: { en: 'Alternating soft-assignment (E) and parameter re-estimation (M); fits mixture models and provably never decreases the likelihood.', de: 'Abwechselnd weiche Zuordnung (E) und Parameterschätzung (M); fittet Mischmodelle und senkt die Likelihood beweisbar nie.' }, modules: ['/clustering-2'] },
  { term: { en: 'Extrinsics', de: 'Extrinsik' }, def: { en: 'The rigid transform [R|t] expressing world points in the camera frame - where the camera stands and where it looks.', de: 'Die Starrkörpertransformation [R|t], die Weltpunkte im Kamerasystem ausdrückt - wo die Kamera steht und wohin sie blickt.' }, modules: ['/camera-matrix'] },
  { term: { en: 'Fourier transform', de: 'Fouriertransformation' }, def: { en: 'The change of basis from time to frequency: any signal becomes a sum of sinusoids; filtering becomes deleting coefficients.', de: 'Der Basiswechsel von Zeit zu Frequenz: Jedes Signal wird eine Summe von Sinusschwingungen; Filtern wird zum Löschen von Koeffizienten.' }, modules: ['/fourier'] },
  { term: { en: 'Fringe projection', de: 'Streifenprojektion' }, def: { en: 'Full-field 3D measurement by projecting shifted sinusoidal stripes and decoding surface height from the recovered phase.', de: 'Vollflächige 3D-Messung durch Projektion verschobener Sinusstreifen und Dekodierung der Oberflächenhöhe aus der rekonstruierten Phase.' }, modules: ['/metrology-3d'] },
  { term: { en: 'Fundamental matrix', de: 'Fundamentalmatrix' }, def: { en: 'The 3×3 matrix encoding epipolar geometry in pixel coordinates: x₂ᵀFx₁ = 0; works without knowing K.', de: 'Die 3×3-Matrix der Epipolargeometrie in Pixelkoordinaten: x₂ᵀFx₁ = 0; funktioniert ohne Kenntnis von K.' }, modules: ['/stereo'] },
  { term: { en: 'Gaussian mixture model', de: 'Gaußsches Mischmodell' }, def: { en: 'Data modeled as overlapping Gaussian clouds with own means, covariances and weights; fitted with EM, gives soft cluster membership.', de: 'Daten als überlappende Gauß-Wolken mit eigenen Mitteln, Kovarianzen und Gewichten; per EM gefittet, liefert weiche Clusterzugehörigkeit.' }, modules: ['/clustering-2'] },
  { term: { en: 'Gradient descent', de: 'Gradientenabstieg' }, def: { en: 'Iteratively stepping against the gradient of a cost function; the base algorithm of optimization and learning.', de: 'Iteratives Schreiten entgegen dem Gradienten einer Kostenfunktion; der Basisalgorithmus von Optimierung und Lernen.' }, modules: ['/optimization'] },
  { term: { en: 'GUM', de: 'GUM' }, def: { en: 'The "Guide to the Expression of Uncertainty in Measurement": linearized propagation of input uncertainties, combined in quadrature, expanded with k = 2.', de: 'Der „Guide to the Expression of Uncertainty in Measurement“: linearisierte Fortpflanzung der Eingangsunsicherheiten, quadratisch kombiniert, erweitert mit k = 2.' }, modules: ['/measurement'] },
  { term: { en: 'Homogeneous coordinates', de: 'Homogene Koordinaten' }, def: { en: 'Appending a 1 to vectors so translations and projections become matrix multiplications; the division by depth happens at the very end.', de: 'Vektoren um eine 1 erweitern, sodass Translationen und Projektionen zu Matrixmultiplikationen werden; die Division durch die Tiefe passiert ganz am Ende.' }, modules: ['/camera-matrix'] },
  { term: { en: 'Homography', de: 'Homographie' }, def: { en: 'The 3×3 projective map between two images of a plane; each checkerboard view gives one, and Zhang builds calibration from them.', de: 'Die projektive 3×3-Abbildung zwischen zwei Bildern einer Ebene; jede Schachbrettansicht liefert eine, und Zhang baut daraus die Kalibrierung.' }, modules: ['/calibration'] },
  { term: { en: 'Inductive bias', de: 'Induktiver Bias' }, def: { en: 'Assumptions about the data built into a model’s architecture (e.g. locality in CNNs); buys data efficiency at the cost of generality.', de: 'In die Architektur eingebaute Annahmen über die Daten (z. B. Lokalität bei CNNs); kauft Dateneffizienz auf Kosten der Allgemeinheit.' }, modules: ['/deep-learning'] },
  { term: { en: 'Interferometry', de: 'Interferometrie' }, def: { en: 'Measuring displacement by counting interference fringes of superposed light waves; one fringe corresponds to λ/2.', de: 'Verschiebungsmessung durch Zählen von Interferenzstreifen überlagerter Lichtwellen; ein Streifen entspricht λ/2.' }, modules: ['/metrology-3d'] },
  { term: { en: 'Intrinsics (K)', de: 'Intrinsik (K)' }, def: { en: 'The camera-internal parameters - focal lengths, principal point, skew - converting metric image-plane coordinates to pixels.', de: 'Die kamerainternen Parameter - Brennweiten, Hauptpunkt, Scherung -, die metrische Bildebenenkoordinaten in Pixel umrechnen.' }, modules: ['/camera-matrix', '/calibration'] },
  { term: { en: 'Inverse kinematics', de: 'Rückwärtskinematik' }, def: { en: 'Finding joint angles that place the end effector at a desired pose; closed-form for simple chains, Jacobian iterations otherwise.', de: 'Gelenkwinkel finden, die den Endeffektor in eine gewünschte Pose bringen; geschlossen für einfache Ketten, sonst Jacobi-Iterationen.' }, modules: ['/kinematics'] },
  { term: { en: 'Jacobian', de: 'Jacobimatrix' }, def: { en: 'The matrix of first derivatives of a vector function; maps joint speeds to tip velocity in robotics and linearizes models in EKF and Gauss-Newton.', de: 'Die Matrix der ersten Ableitungen einer Vektorfunktion; bildet Gelenk- auf Spitzengeschwindigkeit ab und linearisiert Modelle in EKF und Gauß-Newton.' }, modules: ['/kinematics', '/optimization', '/slam'] },
  { term: { en: 'k-means++', de: 'k-means++' }, def: { en: 'Seeding strategy that picks initial centroids proportional to squared distance from existing ones - avoiding most bad local minima.', de: 'Saatstrategie, die Startzentroide proportional zur quadrierten Distanz zu vorhandenen wählt - und so die meisten schlechten lokalen Minima vermeidet.' }, modules: ['/kmeans'] },
  { term: { en: 'Kalman gain', de: 'Kalman-Gain' }, def: { en: 'The precision-based weight deciding how much a new measurement corrects the prediction; large when the model is uncertain, small when the sensor is noisy.', de: 'Das präzisionsbasierte Gewicht, wie stark eine neue Messung die Prädiktion korrigiert; groß bei unsicherem Modell, klein bei verrauschtem Sensor.' }, modules: ['/kalman'] },
  { term: { en: 'Least squares', de: 'Kleinste Quadrate' }, def: { en: 'Fitting by minimizing summed squared residuals - optimal under Gaussian noise, catastrophically sensitive to outliers.', de: 'Fitten durch Minimieren summierter quadrierter Residuen - optimal unter Gauß-Rauschen, katastrophal empfindlich gegen Ausreißer.' }, modules: ['/ml-basics', '/ransac'] },
  { term: { en: 'Levenberg-Marquardt', de: 'Levenberg-Marquardt' }, def: { en: 'Damped Gauss-Newton: blends between gradient descent (large λ) and Newton steps (small λ) with adaptive damping; the workhorse of geometric vision.', de: 'Gedämpftes Gauß-Newton: blendet mit adaptiver Dämpfung zwischen Gradientenabstieg (großes λ) und Newton-Schritten (kleines λ); das Arbeitspferd der geometrischen Vision.' }, modules: ['/optimization'] },
  { term: { en: 'Loop closure', de: 'Schleifenschluss' }, def: { en: 'Re-observing a previously mapped landmark in SLAM; the correlations in the covariance let one observation tighten the entire map.', de: 'Das Wiedersehen einer bereits kartierten Landmarke im SLAM; die Korrelationen der Kovarianz lassen eine Beobachtung die ganze Karte straffen.' }, modules: ['/slam'] },
  { term: { en: 'Manipulability ellipse', de: 'Manipulierbarkeitsellipse' }, def: { en: 'The image of a unit ball of joint velocities under the Jacobian; collapses to a line at singularities.', de: 'Das Bild einer Einheitskugel von Gelenkgeschwindigkeiten unter der Jacobimatrix; kollabiert an Singularitäten zu einer Linie.' }, modules: ['/kinematics'] },
  { term: { en: 'Nyquist frequency', de: 'Nyquist-Frequenz' }, def: { en: 'Half the sampling rate - the highest frequency a sampled signal can represent without aliasing.', de: 'Die halbe Abtastrate - die höchste Frequenz, die ein abgetastetes Signal ohne Aliasing darstellen kann.' }, modules: ['/fourier'] },
  { term: { en: 'Overfitting', de: 'Überanpassung' }, def: { en: 'A model memorizing the accidents of its training sample; visible as a growing gap between train and test error.', de: 'Ein Modell, das die Zufälle seiner Trainingsstichprobe auswendig lernt; sichtbar als wachsende Lücke zwischen Trainings- und Testfehler.' }, modules: ['/ml-basics'] },
  { term: { en: 'PID controller', de: 'PID-Regler' }, def: { en: 'Feedback control from three terms - proportional (speed), integral (zero steady-state error), derivative (damping); runs most control loops on earth.', de: 'Regelung aus drei Termen - proportional (Tempo), integral (keine bleibende Abweichung), differenzial (Dämpfung); betreibt die meisten Regelkreise der Welt.' }, modules: ['/control'] },
  { term: { en: 'Pinhole model', de: 'Lochkameramodell' }, def: { en: 'The ideal camera: every world point projects through one center onto the image plane; x = f·X/Z.', de: 'Die ideale Kamera: Jeder Weltpunkt projiziert durch ein Zentrum auf die Bildebene; x = f·X/Z.' }, modules: ['/camera-matrix'] },
  { term: { en: 'Principal component analysis', de: 'Hauptkomponentenanalyse' }, def: { en: 'Rotating the coordinate system onto the directions of largest variance (covariance eigenvectors); the standard tool for dimensionality reduction.', de: 'Drehung des Koordinatensystems auf die Richtungen größter Varianz (Kovarianz-Eigenvektoren); das Standardwerkzeug der Dimensionsreduktion.' }, modules: ['/pca'] },
  { term: { en: 'RANSAC', de: 'RANSAC' }, def: { en: 'Robust fitting by repeatedly fitting minimal random samples and keeping the hypothesis with the largest inlier consensus.', de: 'Robustes Fitten durch wiederholtes Anpassen minimaler Zufallsstichproben und Behalten der Hypothese mit dem größten Inlier-Konsens.' }, modules: ['/ransac'] },
  { term: { en: 'Rectification (stereo)', de: 'Rektifizierung (Stereo)' }, def: { en: 'Warping both stereo images so all epipolar lines become horizontal rows - turning matching into a 1D search.', de: 'Entzerren beider Stereobilder, sodass alle Epipolarlinien horizontale Zeilen werden - Matching wird zur 1D-Suche.' }, modules: ['/stereo'] },
  { term: { en: 'ReLU', de: 'ReLU' }, def: { en: 'The rectified linear activation max(0, x): cheap, non-saturating, and the default nonlinearity of deep networks.', de: 'Die Aktivierung max(0, x): billig, nicht sättigend und die Standard-Nichtlinearität tiefer Netze.' }, modules: ['/neural-networks'] },
  { term: { en: 'Reprojection error', de: 'Reprojektionsfehler' }, def: { en: 'The pixel distance between a detected feature and its position predicted by the current model; the universal quality metric of geometric vision.', de: 'Der Pixelabstand zwischen detektiertem Merkmal und der vom Modell vorhergesagten Position; das universelle Qualitätsmaß der geometrischen Vision.' }, modules: ['/calibration', '/optimization'] },
  { term: { en: 'Runge-Kutta 4 (RK4)', de: 'Runge-Kutta 4 (RK4)' }, def: { en: 'The classic 4th-order ODE integrator: four slope samples per step cancel the error to O(h⁵) locally.', de: 'Der klassische ODE-Integrator 4. Ordnung: Vier Steigungsproben pro Schritt löschen den Fehler lokal bis O(h⁵).' }, modules: ['/ode'] },
  { term: { en: 'Simulated annealing', de: 'Simulated Annealing' }, def: { en: 'Global optimization that sometimes accepts uphill moves with probability exp(−ΔC/T), cooling T over time - escaping local minima.', de: 'Globale Optimierung, die Aufwärtsschritte mit Wahrscheinlichkeit exp(−ΔC/T) akzeptiert und T abkühlt - und so lokalen Minima entkommt.' }, modules: ['/optimization-advanced'] },
  { term: { en: 'Singular value decomposition', de: 'Singulärwertzerlegung' }, def: { en: 'A = UΣVᵀ: every matrix is a rotation, an axis-aligned stretch, and another rotation; behind PCA, pseudo-inverse and compression.', de: 'A = UΣVᵀ: Jede Matrix ist Drehung, achsparalleles Strecken und wieder Drehung; steckt hinter PCA, Pseudoinverser und Kompression.' }, modules: ['/svd'] },
  { term: { en: 'Singularity (robot)', de: 'Singularität (Roboter)' }, def: { en: 'A configuration where the Jacobian loses rank (det J = 0): some tip directions become unreachable and joint speeds explode nearby.', de: 'Eine Konfiguration, in der die Jacobimatrix Rang verliert (det J = 0): Manche Spitzenrichtungen werden unerreichbar, Gelenkgeschwindigkeiten explodieren in der Nähe.' }, modules: ['/kinematics'] },
  { term: { en: 'SLAM', de: 'SLAM' }, def: { en: 'Simultaneous localization and mapping: estimating the robot pose and the map at once from odometry and landmark observations.', de: 'Simultane Lokalisierung und Kartierung: Roboterpose und Karte gleichzeitig aus Odometrie und Landmarkenbeobachtungen schätzen.' }, modules: ['/slam'] },
  { term: { en: 'Softmax', de: 'Softmax' }, def: { en: 'Turns a vector of scores into a probability distribution; temperature/scaling controls how sharply it favors the maximum.', de: 'Macht aus einem Score-Vektor eine Wahrscheinlichkeitsverteilung; Temperatur/Skalierung steuert, wie scharf sie das Maximum bevorzugt.' }, modules: ['/deep-learning'] },
  { term: { en: 'Stochastic gradient descent', de: 'Stochastischer Gradientenabstieg' }, def: { en: 'Gradient descent on mini-batch estimates of the gradient - noisy, cheap, and the only viable option at deep-learning scale.', de: 'Gradientenabstieg auf Mini-Batch-Schätzungen des Gradienten - verrauscht, billig und die einzig gangbare Option im Deep-Learning-Maßstab.' }, modules: ['/optimization-advanced'] },
  { term: { en: 'Traceability', de: 'Rückführbarkeit' }, def: { en: 'An unbroken chain of calibrations linking a measurement to national standards - what makes measurements comparable across labs.', de: 'Eine ununterbrochene Kalibrierkette, die eine Messung mit nationalen Normalen verbindet - das macht Messungen laborübergreifend vergleichbar.' }, modules: ['/measurement'] },
  { term: { en: 'Triangulation', de: 'Triangulation' }, def: { en: 'Recovering a 3D point as the intersection of viewing rays from known poses - the geometric core of stereo and laser scanning.', de: 'Einen 3D-Punkt als Schnitt von Sehstrahlen bekannter Posen rekonstruieren - der geometrische Kern von Stereo und Laserscanning.' }, modules: ['/stereo', '/metrology-3d'] },
  { term: { en: 'Voronoi region', de: 'Voronoi-Region' }, def: { en: 'The set of points closer to one centroid than to any other; k-means’ assign step partitions space into these convex cells.', de: 'Die Punktmenge, die einem Zentroid näher ist als jedem anderen; der Zuweisungsschritt von K-Means zerlegt den Raum in diese konvexen Zellen.' }, modules: ['/kmeans'] },
  { term: { en: 'Zhang’s method', de: 'Zhangs Methode' }, def: { en: 'Camera calibration from several views of a planar pattern: homographies give a closed-form K, then everything is refined nonlinearly.', de: 'Kamerakalibrierung aus mehreren Ansichten eines ebenen Musters: Homographien liefern ein geschlossenes K, dann wird alles nichtlinear verfeinert.' }, modules: ['/calibration'] },
  { term: { en: 'Homography', de: 'Homographie' }, def: { en: 'The invertible 3×3 map between a plane and its image; unlike the full projection it can be run backwards to un-warp perspective.', de: 'Die invertierbare 3×3-Abbildung zwischen einer Ebene und ihrem Bild; anders als die volle Projektion lässt sie sich rückwärts ausführen, um Perspektive zu entzerren.' }, modules: ['/camera-matrix', '/calibration'] },
  { term: { en: 'DLT (Direct Linear Transform)', de: 'DLT (Direct Linear Transform)' }, def: { en: 'Solving a homogeneous system Ah = 0 for a geometric transform by taking the smallest-eigenvalue vector of AᵀA - after normalizing the point coordinates.', de: 'Lösen eines homogenen Systems Ah = 0 für eine geometrische Transformation über den Eigenvektor zum kleinsten Eigenwert von AᵀA - nach Normierung der Punktkoordinaten.' }, modules: ['/camera-matrix'] },
  { term: { en: 'PnP (Perspective-n-Point)', de: 'PnP (Perspective-n-Point)' }, def: { en: 'Recovering a camera’s pose from a known 3D object and its image points, by minimizing reprojection error over the six pose parameters.', de: 'Die Kamerapose aus einem bekannten 3D-Objekt und seinen Bildpunkten rekonstruieren, indem der Reprojektionsfehler über die sechs Posenparameter minimiert wird.' }, modules: ['/camera-matrix'] },
  { term: { en: 'Fisheye (equidistant model)', de: 'Fisheye (äquidistantes Modell)' }, def: { en: 'A wide-angle projection with image radius r = f·θ instead of f·tanθ, so rays past 90° still land on a finite sensor.', de: 'Eine Weitwinkelprojektion mit Bildradius r = f·θ statt f·tanθ, sodass Strahlen jenseits von 90° noch auf einem endlichen Sensor landen.' }, modules: ['/calibration'] },
  { term: { en: 'Block matching', de: 'Blockmatching' }, def: { en: 'Stereo correspondence by sliding a window along the epipolar line and picking the disparity with the lowest SAD/SSD cost.', de: 'Stereo-Korrespondenz durch Verschieben eines Fensters entlang der Epipolarlinie und Wahl der Disparität mit den geringsten SAD-/SSD-Kosten.' }, modules: ['/stereo'] },
  { term: { en: 'Vision Transformer (ViT)', de: 'Vision Transformer (ViT)' }, def: { en: 'A transformer applied to images by cutting them into patch tokens; attention then runs between patches exactly as between words.', de: 'Ein auf Bilder angewandter Transformer, der sie in Patch-Tokens zerschneidet; Attention läuft dann zwischen Patches genau wie zwischen Wörtern.' }, modules: ['/vision-transformers'] },
  { term: { en: 'Patch embedding', de: 'Patch-Embedding' }, def: { en: 'The linear projection turning each flattened image patch into a token vector, plus an added position code so the transformer knows where it sat.', de: 'Die lineare Projektion, die jeden flachgeklopften Bildpatch in einen Token-Vektor verwandelt, plus ein addierter Positionscode, damit der Transformer weiß, wo er saß.' }, modules: ['/vision-transformers'] },
  { term: { en: 'Multi-head attention', de: 'Multi-Head-Attention' }, def: { en: 'Running several attention maps in parallel so each head can specialize (local, global, content-based), then concatenating their outputs.', de: 'Mehrere Attention-Karten parallel laufen lassen, damit jeder Kopf sich spezialisieren kann (lokal, global, inhaltsbasiert), und dann ihre Ausgaben verketten.' }, modules: ['/deep-learning', '/vision-transformers'] },
  { term: { en: 'CLIP / contrastive learning', de: 'CLIP / kontrastives Lernen' }, def: { en: 'Training image and text encoders so matching pairs share a point in one embedding space and mismatched pairs are pushed apart (InfoNCE).', de: 'Bild- und Text-Encoder so trainieren, dass passende Paare einen Punkt in einem Embedding-Raum teilen und unpassende auseinandergedrückt werden (InfoNCE).' }, modules: ['/vision-transformers'] },
  { term: { en: 'Zero-shot classification', de: 'Zero-Shot-Klassifikation' }, def: { en: 'Labelling an image by comparing its CLIP vector to text prompts of candidate classes - no training set, new classes are new sentences.', de: 'Ein Bild etikettieren, indem man seinen CLIP-Vektor mit Text-Prompts von Kandidatenklassen vergleicht - kein Trainingssatz, neue Klassen sind neue Sätze.' }, modules: ['/vision-transformers'] },
  { term: { en: 'Vision-language model (VLM)', de: 'Vision-Language-Modell (VLM)' }, def: { en: 'A language model fed image tokens through a small projector, so it can describe, answer questions about, and reason over pictures.', de: 'Ein Sprachmodell, dem über einen kleinen Projektor Bild-Tokens zugeführt werden, sodass es Bilder beschreiben, Fragen dazu beantworten und über sie schlussfolgern kann.' }, modules: ['/vision-transformers'] },
  { term: { en: 'Temperature (softmax)', de: 'Temperatur (Softmax)' }, def: { en: 'A divisor on the logits that controls how peaked a softmax is - low temperature sharpens toward the top choice, high temperature flattens.', de: 'Ein Divisor auf den Logits, der steuert, wie spitz eine Softmax ist - niedrige Temperatur schärft zur Top-Wahl, hohe Temperatur flacht ab.' }, modules: ['/vision-transformers'] },
]

export function GlossaryPage() {
  const t = useT(T)
  const { lang } = useLangState()
  const [filter, setFilter] = useState('')

  const moduleShort = (path: string) => {
    for (const tr of TRACKS) for (const m of tr.modules) if (m.path === path) return m.short[lang]
    return path
  }

  const entries = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const sorted = [...G].sort((a, b) => a.term[lang].localeCompare(b.term[lang], lang))
    if (!q) return sorted
    return sorted.filter(
      (e) =>
        e.term.en.toLowerCase().includes(q) ||
        e.term.de.toLowerCase().includes(q) ||
        e.def[lang].toLowerCase().includes(q),
    )
  }, [filter, lang])

  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const e of entries) {
      const letter = e.term[lang][0].toUpperCase()
      if (!map.has(letter)) map.set(letter, [])
      map.get(letter)!.push(e)
    }
    return [...map.entries()]
  }, [entries, lang])

  return (
    <div className="mx-auto max-w-4xl px-4">
      <header className="pt-10 pb-6">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight md:text-4xl">📖 {t.title}</h1>
        <p className="mb-4 max-w-3xl text-[15px] leading-7 text-muted">
          {t.intro} <span className="chip ml-1">{G.length} {t.terms}</span>
        </p>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t.filter}
          className="card w-full max-w-md px-4 py-2.5 text-[14px] text-ink outline-none placeholder:text-muted/60 focus:border-accent/50"
        />
      </header>

      {grouped.map(([letter, list]) => (
        <section key={letter} className="mb-6">
          <div className="mb-2 font-mono text-lg font-bold text-accent">{letter}</div>
          <div className="card divide-y divide-white/5">
            {list.map((e, i) => (
              <div key={i} className="px-5 py-3.5">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-bold">{e.term[lang]}</span>
                  {e.modules.map((p) => (
                    <Link key={p} to={p} className="chip text-[11px] transition hover:border-accent/50 hover:text-accent">
                      → {moduleShort(p)}
                    </Link>
                  ))}
                </div>
                <p className="text-[13.5px] leading-6 text-ink/80">{e.def[lang]}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
