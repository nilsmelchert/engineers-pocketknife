import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { TeX } from '../components/TeX'
import { Derivation } from '../components/Derivation'
import { PageToc } from '../components/PageToc'
import { InfoBox, Readout, Section, Segmented, Slider } from '../components/ui'
import { AxesTriad, Scene3D, SegmentMesh } from '../components/three/helpers'
import { deg2rad, fmt, m4Mul, m4RotX, m4RotY, m4Trans, m4t, rad2deg, type M4, type V3 } from '../lib/math'
import { covEllipse } from '../lib/signal'

const L1 = 1.0
const L2 = 0.7

const T = {
  en: {
    kicker: 'Robotics · Module 1',
    title: 'Robot Kinematics',
    intro:
      'Before a robot can do anything useful it must answer two questions: given my joint angles, where is my hand (forward kinematics)? And given where I want my hand, what should my joints do (inverse kinematics)? The hand-eye module used the answers; this module derives them — and shows the dragon lurking between them: the singularity.',
    fkTitle: 'Interactive: forward kinematics',
    fk1: 'The workhorse example of all robotics: a planar arm with two revolute joints. Each link rotates relative to the previous one — angles chain by addition, positions by trigonometry. Move the joints and follow the numbers through the formula: this is a transform chain, the 2D sibling of the 4×4 matrix chains in the hand-eye module.',
    theta1: 'joint θ₁',
    theta2: 'joint θ₂ (relative)',
    eePos: 'end effector (x, y)',
    ikTitle: 'Interactive: inverse kinematics — and the singularity',
    ik1: 'Now the harder direction: drag the target and let the math find the angles. For two links there is a closed-form answer via the law of cosines — with two solutions (elbow-up / elbow-down) and a hard boundary: targets outside the ring are unreachable, no math can help. The shaded ring is the reachable workspace.',
    ik2: 'The amber ellipse shows how easily the tip can move in each direction (the manipulability ellipse, computed from the Jacobian). Drag the target toward the outer boundary: the arm straightens, the ellipse collapses to a line, and the joint speed needed for even slow tip motion explodes — det J → 0. That is a singularity, and it is why real robots slow down or refuse paths that pass too close to full extension.',
    elbow: 'solution branch',
    elbowNames: ['elbow up', 'elbow down'],
    unreachable: 'target unreachable — outside the workspace ring',
    detJ: 'det J = l₁l₂ sin θ₂',
    jointSpeed: 'joint speed for 1 m/s tip speed',
    showEllipse: 'show manipulability ellipse',
    ikDerivTitle: 'The closed-form IK, via the law of cosines',
    ikDeriv: [
      { tex: String.raw`r^2 = x^2 + y^2 \;=\; l_1^2 + l_2^2 + 2\,l_1 l_2 \cos\theta_2`, note: 'Law of cosines in the triangle base–elbow–target: the target distance fixes the elbow angle — independent of θ₁.' },
      { tex: String.raw`\cos\theta_2 = \frac{x^2+y^2-l_1^2-l_2^2}{2\,l_1 l_2}, \qquad \theta_2 = \pm\arccos(\dots)`, note: 'The ± is the elbow-up/elbow-down toggle: two mirror configurations reach the same point. |cos θ₂| > 1 ⇔ the target lies outside the ring.' },
      { tex: String.raw`\theta_1 = \operatorname{atan2}(y, x) \;-\; \operatorname{atan2}\!\big(l_2 \sin\theta_2,\; l_1 + l_2\cos\theta_2\big)`, note: 'Aim at the target, then subtract the angle by which the bent elbow rotates the reach direction.' },
    ],
    jacDerivTitle: 'The Jacobian and why the ellipse collapses',
    jacDeriv: [
      { tex: String.raw`\begin{bmatrix}\dot{x}\\ \dot{y}\end{bmatrix} = J(\theta)\begin{bmatrix}\dot{\theta}_1\\ \dot{\theta}_2\end{bmatrix}, \qquad J = \begin{bmatrix} -l_1 s_1 - l_2 s_{12} & -l_2 s_{12} \\ \;\;\,l_1 c_1 + l_2 c_{12} & \;\;l_2 c_{12} \end{bmatrix}`, note: 'Differentiate the FK: J maps joint speeds to tip velocity. The amber ellipse is the image of a unit circle of joint speeds under J — literally the SVD picture from the Math track.' },
      { tex: String.raw`\det J \;=\; l_1 l_2 \sin\theta_2`, note: 'Zero exactly when θ₂ = 0° or 180° — arm fully stretched or folded. The live readout below turns red as you approach it.' },
      { tex: String.raw`\dot{\theta} = J^{-1}\dot{x} \quad\Rightarrow\quad \lVert\dot{\theta}\rVert \le \frac{\lVert\dot{x}\rVert}{\sigma_{\min}(J)}`, note: 'Inverting J divides by its smallest singular value: as the ellipse flattens, σmin → 0 and the required joint speeds blow up — the readout you can watch explode.' },
    ],
    wsTitle: 'Interactive: the workspace',
    ws1: 'The set of all reachable points is the arm’s workspace — for the unconstrained 2-link arm, a ring with outer radius l₁+l₂ and inner radius |l₁−l₂|. Real joints have limits: tighten them and watch the workspace crumble into a crescent. Workspace analysis is the first question of every robot-cell design — can the tool even get there?',
    lim1: 'θ₁ range',
    lim2: 'θ₂ range',
    fk3dTitle: 'Interactive: the same idea in 3D',
    fk3d1: 'Three revolute joints in 3D — the arm from the hand-eye module, stripped to its kinematics. Every joint contributes one rotation matrix, links contribute translations; the gripper pose is the matrix product of the chain. Real industrial arms simply continue to six joints (enough for arbitrary position and orientation) and standardize the bookkeeping with Denavit–Hartenberg parameters.',
    q: 'joint',
    gripPos: 'gripper position',
    practTitle: 'From here to real robots',
    practList: [
      'Six joints, arbitrary pose: 3 position + 3 orientation DoF. IK still has closed forms for most industrial geometries (spherical wrists) — and multiple branches, like the elbow toggle, that the controller must choose between.',
      'Numerical IK for anything else: iterate θ ← θ + J⁺·Δx with the pseudo-inverse (SVD module!) — this is Gauss-Newton from the optimization modules, applied to kinematics.',
      'Singularity handling in practice: damped least squares (J⁺ with a λ floor — Levenberg–Marquardt again!), path planning that avoids det J ≈ 0 regions, or redundant 7-joint arms that steer around them.',
      'The kinematic chain is exactly what the hand-eye module calibrated: base→gripper is this module, gripper→camera was the X of AX = XB. Together they let a camera-guided robot act in the world.',
    ],
    appTitle: '🏭 In the real world: can the arm reach the whole pallet?',
    appIntro:
      'Before buying a robot, a cell designer must answer one brutally concrete question: can this arm, mounted here, reach every position on the pallet — without stretching into its singular full-extension pose? That is a workspace calculation, pure forward kinematics. Below, a 2-link arm stands at a fixed base beside a pallet with 24 pick positions. Choose the link lengths: every cell is checked against the annulus |L₁−L₂| ≤ r ≤ L₁+L₂ (with a 5 % margin off full stretch, where the Jacobian degenerates). Green cells are reachable, red are not. Find the cheapest arm (shortest links) that still turns the whole pallet green — that is literally the trade study behind every robot purchase order.',
    appL1: 'link length L₁',
    appL2: 'link length L₂',
    appReach: 'pallet coverage',
    appVerdict: 'cell design',
    appOk: 'ALL POSITIONS REACHED',
    appFail: 'UNREACHABLE CELLS',
    appLegend: 'green = reachable · red = out of reach · shaded ring = arm workspace (with 5 % singularity margin)',
    appWhere:
      'The same reachability sweep sizes cobots over conveyor belts, surgical arms over patient tables, gantry pickers over shelf racks — and in reverse, it places the part where the robot is strongest.',
  },
  de: {
    kicker: 'Robotik · Modul 1',
    title: 'Roboterkinematik',
    intro:
      'Bevor ein Roboter irgendetwas Nützliches tun kann, muss er zwei Fragen beantworten: Wo ist meine Hand bei gegebenen Gelenkwinkeln (Vorwärtskinematik)? Und was müssen meine Gelenke tun, damit die Hand dorthin kommt, wo ich sie haben will (Rückwärtskinematik)? Das Hand-Auge-Modul hat die Antworten benutzt; dieses Modul leitet sie her — und zeigt den Drachen, der zwischen ihnen lauert: die Singularität.',
    fkTitle: 'Interaktiv: Vorwärtskinematik',
    fk1: 'Das Arbeitspferd-Beispiel der Robotik: ein ebener Arm mit zwei Drehgelenken. Jedes Glied dreht relativ zum vorherigen — Winkel verketten sich durch Addition, Positionen durch Trigonometrie. Bewege die Gelenke und verfolge die Zahlen durch die Formel: Das ist eine Transformationskette, das 2D-Geschwister der 4×4-Matrixketten aus dem Hand-Auge-Modul.',
    theta1: 'Gelenk θ₁',
    theta2: 'Gelenk θ₂ (relativ)',
    eePos: 'Endeffektor (x, y)',
    ikTitle: 'Interaktiv: Rückwärtskinematik — und die Singularität',
    ik1: 'Nun die schwerere Richtung: Ziehe das Ziel, und die Mathematik findet die Winkel. Für zwei Glieder gibt es eine geschlossene Lösung über den Kosinussatz — mit zwei Lösungen (Ellbogen oben/unten) und einer harten Grenze: Ziele außerhalb des Rings sind unerreichbar, da hilft keine Mathematik. Der schattierte Ring ist der erreichbare Arbeitsraum.',
    ik2: 'Die bernsteinfarbene Ellipse zeigt, wie leicht sich die Spitze in jede Richtung bewegen kann (die Manipulierbarkeitsellipse, aus der Jacobimatrix berechnet). Ziehe das Ziel zum Außenrand: Der Arm streckt sich, die Ellipse kollabiert zu einer Linie, und die für selbst langsame Spitzenbewegung nötige Gelenkgeschwindigkeit explodiert — det J → 0. Das ist eine Singularität, und deshalb bremsen echte Roboter ab oder verweigern Bahnen, die der vollen Streckung zu nahe kommen.',
    elbow: 'Lösungszweig',
    elbowNames: ['Ellbogen oben', 'Ellbogen unten'],
    unreachable: 'Ziel unerreichbar — außerhalb des Arbeitsraumrings',
    detJ: 'det J = l₁l₂ sin θ₂',
    jointSpeed: 'Gelenktempo für 1 m/s Spitzentempo',
    showEllipse: 'Manipulierbarkeitsellipse zeigen',
    ikDerivTitle: 'Die geschlossene IK, über den Kosinussatz',
    ikDeriv: [
      { tex: String.raw`r^2 = x^2 + y^2 \;=\; l_1^2 + l_2^2 + 2\,l_1 l_2 \cos\theta_2`, note: 'Kosinussatz im Dreieck Basis–Ellbogen–Ziel: Die Zieldistanz legt den Ellbogenwinkel fest — unabhängig von θ₁.' },
      { tex: String.raw`\cos\theta_2 = \frac{x^2+y^2-l_1^2-l_2^2}{2\,l_1 l_2}, \qquad \theta_2 = \pm\arccos(\dots)`, note: 'Das ± ist der Ellbogen-oben/unten-Schalter: Zwei Spiegelkonfigurationen erreichen denselben Punkt. |cos θ₂| > 1 ⇔ das Ziel liegt außerhalb des Rings.' },
      { tex: String.raw`\theta_1 = \operatorname{atan2}(y, x) \;-\; \operatorname{atan2}\!\big(l_2 \sin\theta_2,\; l_1 + l_2\cos\theta_2\big)`, note: 'Aufs Ziel zielen, dann den Winkel abziehen, um den der gebeugte Ellbogen die Greifrichtung dreht.' },
    ],
    jacDerivTitle: 'Die Jacobimatrix — und warum die Ellipse kollabiert',
    jacDeriv: [
      { tex: String.raw`\begin{bmatrix}\dot{x}\\ \dot{y}\end{bmatrix} = J(\theta)\begin{bmatrix}\dot{\theta}_1\\ \dot{\theta}_2\end{bmatrix}, \qquad J = \begin{bmatrix} -l_1 s_1 - l_2 s_{12} & -l_2 s_{12} \\ \;\;\,l_1 c_1 + l_2 c_{12} & \;\;l_2 c_{12} \end{bmatrix}`, note: 'FK ableiten: J bildet Gelenkgeschwindigkeiten auf Spitzengeschwindigkeit ab. Die bernsteinfarbene Ellipse ist das Bild eines Einheitskreises von Gelenkgeschwindigkeiten unter J — buchstäblich das SVD-Bild aus dem Mathe-Track.' },
      { tex: String.raw`\det J \;=\; l_1 l_2 \sin\theta_2`, note: 'Null genau bei θ₂ = 0° oder 180° — Arm voll gestreckt oder gefaltet. Das Live-Readout unten wird rot, wenn du dich näherst.' },
      { tex: String.raw`\dot{\theta} = J^{-1}\dot{x} \quad\Rightarrow\quad \lVert\dot{\theta}\rVert \le \frac{\lVert\dot{x}\rVert}{\sigma_{\min}(J)}`, note: 'J zu invertieren heißt durch den kleinsten Singulärwert zu teilen: Plättet sich die Ellipse, geht σmin → 0, und die nötigen Gelenkgeschwindigkeiten explodieren — das Readout, dem du beim Explodieren zusehen kannst.' },
    ],
    wsTitle: 'Interaktiv: der Arbeitsraum',
    ws1: 'Die Menge aller erreichbaren Punkte ist der Arbeitsraum des Arms — für den unbeschränkten 2-Gelenk-Arm ein Ring mit Außenradius l₁+l₂ und Innenradius |l₁−l₂|. Echte Gelenke haben Grenzen: Ziehe sie enger, und der Arbeitsraum zerbröselt zu einer Sichel. Arbeitsraumanalyse ist die erste Frage jeder Roboterzellen-Planung — kommt das Werkzeug überhaupt hin?',
    lim1: 'θ₁-Bereich',
    lim2: 'θ₂-Bereich',
    fk3dTitle: 'Interaktiv: dieselbe Idee in 3D',
    fk3d1: 'Drei Drehgelenke in 3D — der Arm aus dem Hand-Auge-Modul, auf seine Kinematik reduziert. Jedes Gelenk steuert eine Rotationsmatrix bei, Glieder steuern Translationen bei; die Greiferpose ist das Matrixprodukt der Kette. Echte Industriearme machen einfach mit sechs Gelenken weiter (genug für beliebige Position und Orientierung) und standardisieren die Buchführung mit Denavit-Hartenberg-Parametern.',
    q: 'Gelenk',
    gripPos: 'Greiferposition',
    practTitle: 'Von hier zu echten Robotern',
    practList: [
      'Sechs Gelenke, beliebige Pose: 3 Positions- + 3 Orientierungs-Freiheitsgrade. Die IK hat für die meisten Industriegeometrien (sphärische Handgelenke) weiter geschlossene Lösungen — und mehrere Zweige, wie der Ellbogenschalter, zwischen denen die Steuerung wählen muss.',
      'Numerische IK für alles andere: iteriere θ ← θ + J⁺·Δx mit der Pseudoinversen (SVD-Modul!) — das ist Gauß-Newton aus den Optimierungsmodulen, angewandt auf Kinematik.',
      'Singularitätsbehandlung in der Praxis: gedämpfte kleinste Quadrate (J⁺ mit λ-Boden — wieder Levenberg-Marquardt!), Bahnplanung, die Regionen mit det J ≈ 0 meidet, oder redundante 7-Gelenk-Arme, die darum herumsteuern.',
      'Die kinematische Kette ist genau das, was das Hand-Auge-Modul kalibriert hat: Basis→Greifer ist dieses Modul, Greifer→Kamera war das X aus AX = XB. Zusammen lassen sie einen kamerageführten Roboter in der Welt handeln.',
    ],
    appTitle: '🏭 In der echten Welt: erreicht der Arm die ganze Palette?',
    appIntro:
      'Vor dem Roboterkauf muss ein Zellenplaner eine brutal konkrete Frage beantworten: Erreicht dieser Arm, hier montiert, jede Position auf der Palette — ohne sich in seine singuläre Vollstreckungslage zu recken? Das ist eine Arbeitsraumrechnung, reine Vorwärtskinematik. Unten steht ein 2-Gelenk-Arm an fester Basis neben einer Palette mit 24 Greifpositionen. Wähle die Gliedlängen: Jede Zelle wird gegen den Kreisring |L₁−L₂| ≤ r ≤ L₁+L₂ geprüft (mit 5 % Abstand zur Vollstreckung, wo die Jacobi-Matrix degeneriert). Grüne Zellen sind erreichbar, rote nicht. Finde den günstigsten Arm (kürzeste Glieder), der die ganze Palette grün macht — das ist wortwörtlich die Studie hinter jeder Roboter-Bestellung.',
    appL1: 'Gliedlänge L₁',
    appL2: 'Gliedlänge L₂',
    appReach: 'Palettenabdeckung',
    appVerdict: 'Zellendesign',
    appOk: 'ALLE POSITIONEN ERREICHT',
    appFail: 'UNERREICHBARE ZELLEN',
    appLegend: 'grün = erreichbar · rot = außer Reichweite · schattierter Ring = Arbeitsraum (mit 5 % Singularitätsabstand)',
    appWhere:
      'Derselbe Erreichbarkeits-Sweep dimensioniert Cobots über Förderbändern, OP-Arme über Patiententischen, Portal-Picker über Regalen — und umgekehrt platziert er das Bauteil dort, wo der Roboter am stärksten ist.',
  },
}

// ---------------------------------------------------------------- shared 2D helpers

const SW = 480
const SH = 440
const R2D = 2.0
const px = (x: number) => ((x + R2D) / (2 * R2D)) * SW
const py = (y: number) => SH - ((y + R2D) / (2 * R2D)) * SH

function fk2(t1: number, t2: number) {
  const elbow: [number, number] = [L1 * Math.cos(t1), L1 * Math.sin(t1)]
  const ee: [number, number] = [
    elbow[0] + L2 * Math.cos(t1 + t2),
    elbow[1] + L2 * Math.sin(t1 + t2),
  ]
  return { elbow, ee }
}

function Arm2D({ t1, t2, ghost = false }: { t1: number; t2: number; ghost?: boolean }) {
  const { elbow, ee } = fk2(t1, t2)
  const op = ghost ? 0.35 : 1
  return (
    <g opacity={op}>
      <line x1={px(0)} y1={py(0)} x2={px(elbow[0])} y2={py(elbow[1])} stroke="#8b93a7" strokeWidth={7} strokeLinecap="round" />
      <line x1={px(elbow[0])} y1={py(elbow[1])} x2={px(ee[0])} y2={py(ee[1])} stroke="#aab3c5" strokeWidth={5.5} strokeLinecap="round" />
      <circle cx={px(0)} cy={py(0)} r={9} fill="#28334a" stroke="#4a5670" strokeWidth={2} />
      <circle cx={px(elbow[0])} cy={py(elbow[1])} r={7} fill="#28334a" stroke="#4a5670" strokeWidth={2} />
      <circle cx={px(ee[0])} cy={py(ee[1])} r={6} fill="#22d3ee" stroke="#0a0e17" strokeWidth={1.5} />
    </g>
  )
}

// ---------------------------------------------------------------- FK lab

function FkLab() {
  const t = useT(T)
  const [d1, setD1] = useState(40)
  const [d2, setD2] = useState(55)
  const t1 = deg2rad(d1)
  const t2 = deg2rad(d2)
  const { ee } = fk2(t1, t2)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${SW} ${SH}`} className="block w-full" style={{ background: 'radial-gradient(120% 120% at 50% 40%, #141a28 0%, #0a0e17 100%)' }}>
          <line x1={0} y1={py(0)} x2={SW} y2={py(0)} stroke="rgba(255,255,255,0.08)" />
          <line x1={px(0)} y1={0} x2={px(0)} y2={SH} stroke="rgba(255,255,255,0.08)" />
          <Arm2D t1={t1} t2={t2} />
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.theta1} value={d1} min={-180} max={180} step={1} onChange={setD1} format={(v) => `${v}°`} />
          <Slider label={t.theta2} value={d2} min={-160} max={160} step={1} onChange={setD2} format={(v) => `${v}°`} accent="#a78bfa" />
        </div>
        <Readout label={t.eePos} value={`(${fmt(ee[0], 3)}, ${fmt(ee[1], 3)})`} accent="#22d3ee" />
        <TeX block>{String.raw`\begin{aligned} x &= l_1\cos\theta_1 + l_2\cos(\theta_1{+}\theta_2) = ${fmt(ee[0], 3)} \\ y &= l_1\sin\theta_1 + l_2\sin(\theta_1{+}\theta_2) = ${fmt(ee[1], 3)} \end{aligned}`}</TeX>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- IK + singularity lab

function IkLab() {
  const t = useT(T)
  const [target, setTarget] = useState<[number, number]>([1.15, 0.7])
  const [branch, setBranch] = useState<'up' | 'down'>('up')
  const [showEll, setShowEll] = useState(true)

  const r = Math.hypot(target[0], target[1])
  const rOut = L1 + L2
  const rIn = Math.abs(L1 - L2)
  const reachable = r <= rOut && r >= rIn

  const sol = useMemo(() => {
    const rr = Math.min(Math.max(r, rIn + 1e-9), rOut - 1e-9)
    const scaledTarget: [number, number] =
      r > 0 ? [(target[0] * rr) / r, (target[1] * rr) / r] : [rIn, 0]
    const c2 = (rr * rr - L1 * L1 - L2 * L2) / (2 * L1 * L2)
    const t2 = (branch === 'up' ? 1 : -1) * Math.acos(Math.min(1, Math.max(-1, c2)))
    const t1 =
      Math.atan2(scaledTarget[1], scaledTarget[0]) -
      Math.atan2(L2 * Math.sin(t2), L1 + L2 * Math.cos(t2))
    return { t1, t2 }
  }, [target, branch, r])

  const { ee } = fk2(sol.t1, sol.t2)
  const s1 = Math.sin(sol.t1)
  const c1 = Math.cos(sol.t1)
  const s12 = Math.sin(sol.t1 + sol.t2)
  const c12 = Math.cos(sol.t1 + sol.t2)
  const J = [
    [-L1 * s1 - L2 * s12, -L2 * s12],
    [L1 * c1 + L2 * c12, L2 * c12],
  ]
  const detJ = J[0][0] * J[1][1] - J[0][1] * J[1][0]
  // manipulability ellipse from J Jᵀ
  const JJt = {
    a: J[0][0] ** 2 + J[0][1] ** 2,
    b: J[0][0] * J[1][0] + J[0][1] * J[1][1],
    c: J[1][0] ** 2 + J[1][1] ** 2,
  }
  const ell = covEllipse(JJt.a, JJt.b, JJt.c)
  const sigMin = Math.sqrt(Math.max(Math.min(JJt.a + JJt.c - Math.sqrt((JJt.a - JJt.c) ** 2 + 4 * JJt.b ** 2), JJt.a + JJt.c + Math.sqrt((JJt.a - JJt.c) ** 2 + 4 * JJt.b ** 2)) / 2, 1e-12))
  const jointSpeed = 1 / Math.max(sigMin, 1e-6)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg
          viewBox={`0 0 ${SW} ${SH}`}
          className="block w-full cursor-crosshair touch-none"
          style={{ background: 'radial-gradient(120% 120% at 50% 40%, #141a28 0%, #0a0e17 100%)' }}
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setTarget([
              ((e.clientX - rect.left) / rect.width) * 2 * R2D - R2D,
              R2D - ((e.clientY - rect.top) / rect.height) * 2 * R2D,
            ])
          }}
          onPointerMove={(e) => {
            if (e.buttons !== 1) return
            const rect = e.currentTarget.getBoundingClientRect()
            setTarget([
              ((e.clientX - rect.left) / rect.width) * 2 * R2D - R2D,
              R2D - ((e.clientY - rect.top) / rect.height) * 2 * R2D,
            ])
          }}
        >
          {/* workspace ring */}
          <circle cx={px(0)} cy={py(0)} r={(rOut / (2 * R2D)) * SW} fill="rgba(34,211,238,0.06)" stroke="rgba(34,211,238,0.3)" strokeWidth={1.2} />
          <circle cx={px(0)} cy={py(0)} r={(rIn / (2 * R2D)) * SW} fill="#0d1117" stroke="rgba(34,211,238,0.3)" strokeWidth={1.2} />
          <Arm2D t1={sol.t1} t2={sol.t2} />
          {/* manipulability ellipse at the EE (scaled 0.35) */}
          {showEll && (
            <ellipse
              cx={px(ee[0])}
              cy={py(ee[1])}
              rx={Math.max((ell.a * 0.35) / (2 * R2D) * SW * 0.5, 1)}
              ry={Math.max((ell.b * 0.35) / (2 * R2D) * SW * 0.5, 1)}
              transform={`rotate(${-ell.angleDeg} ${px(ee[0])} ${py(ee[1])})`}
              fill="rgba(251,191,36,0.12)"
              stroke="#fbbf24"
              strokeWidth={1.6}
            />
          )}
          {/* target */}
          <g stroke={reachable ? '#4ade80' : '#f87171'} strokeWidth={2.2}>
            <line x1={px(target[0]) - 8} y1={py(target[1]) - 8} x2={px(target[0]) + 8} y2={py(target[1]) + 8} />
            <line x1={px(target[0]) - 8} y1={py(target[1]) + 8} x2={px(target[0]) + 8} y2={py(target[1]) - 8} />
          </g>
        </svg>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Segmented<'up' | 'down'>
            options={[
              { value: 'up', label: t.elbowNames[0] },
              { value: 'down', label: t.elbowNames[1] },
            ]}
            value={branch}
            onChange={setBranch}
          />
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-muted select-none">
            <input type="checkbox" checked={showEll} onChange={(e) => setShowEll(e.target.checked)} className="h-4 w-4 accent-yellow-400" />
            {t.showEllipse}
          </label>
        </div>
        {!reachable && <div className="card border-red-400/50 bg-red-400/10 px-4 py-2.5 text-[13px] text-red-300">⚠ {t.unreachable}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Readout label="θ₁ / θ₂" value={`${fmt(rad2deg(sol.t1), 1)}° / ${fmt(rad2deg(sol.t2), 1)}°`} />
          <Readout label={t.detJ} value={fmt(detJ, 3)} accent={Math.abs(detJ) < 0.12 ? '#f87171' : '#4ade80'} />
          <Readout label={t.jointSpeed} value={jointSpeed > 100 ? '∞' : fmt(jointSpeed, 1)} unit="rad/s" accent={jointSpeed > 6 ? '#f87171' : undefined} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- workspace lab

function WorkspaceLab() {
  const t = useT(T)
  const [lim1, setLim1] = useState(140)
  const [lim2, setLim2] = useState(120)
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const N = 240
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, N, N)
    ctx.fillStyle = 'rgba(34,211,238,0.25)'
    const steps = 90
    for (let i = 0; i <= steps; i++)
      for (let j = 0; j <= steps; j++) {
        const th1 = deg2rad(-lim1 + (i / steps) * 2 * lim1)
        const th2 = deg2rad(-lim2 + (j / steps) * 2 * lim2)
        const { ee } = fk2(th1, th2)
        const cx = ((ee[0] + R2D) / (2 * R2D)) * N
        const cy = N - ((ee[1] + R2D) / (2 * R2D)) * N
        ctx.fillRect(cx - 1, cy - 1, 2.4, 2.4)
      }
    // base marker
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.arc(N / 2, N / 2, 4, 0, 2 * Math.PI)
    ctx.fill()
  }, [lim1, lim2])

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden p-2 lg:col-span-3">
        <canvas ref={ref} width={240} height={240} className="mx-auto block w-full max-w-md rounded-lg" />
      </div>
      <div className="card-pad space-y-3.5 self-start lg:col-span-2">
        <Slider label={t.lim1} value={lim1} min={20} max={180} step={5} onChange={setLim1} format={(v) => `±${v}°`} />
        <Slider label={t.lim2} value={lim2} min={20} max={160} step={5} onChange={setLim2} format={(v) => `±${v}°`} accent="#a78bfa" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 3D FK

function Fk3dLab() {
  const t = useT(T)
  const [q1, setQ1] = useState(25)
  const [q2, setQ2] = useState(45)
  const [q3, setQ3] = useState(60)

  const { shoulder, elbow, G } = useMemo(() => {
    const A1: M4 = m4Mul(m4RotY(deg2rad(q1)), m4Trans(0, 0.35, 0))
    const A2 = m4Mul(A1, m4Mul(m4RotX(deg2rad(q2)), m4Trans(0, 0.4, 0)))
    const A3 = m4Mul(A2, m4Mul(m4RotX(deg2rad(q3)), m4Trans(0, 0.35, 0)))
    return { shoulder: m4t(A1), elbow: m4t(A2), G: A3 }
  }, [q1, q2, q3])

  const grip = m4t(G)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Scene3D className="lg:col-span-3" height={380} camera={{ position: [1.8, 1.4, 2.0], fov: 42 }} target={[0, 0.45, 0.2]}>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.11, 0.13, 0.12, 32]} />
          <meshStandardMaterial color="#2d3748" metalness={0.4} roughness={0.4} />
        </mesh>
        <SegmentMesh from={[0, 0.1, 0] as V3} to={shoulder} radius={0.045} color="#8b93a7" />
        <SegmentMesh from={shoulder} to={elbow} radius={0.04} color="#aab3c5" />
        <SegmentMesh from={elbow} to={grip} radius={0.035} color="#8b93a7" />
        {[shoulder, elbow].map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.05, 20, 20]} />
            <meshStandardMaterial color="#4a5670" metalness={0.5} roughness={0.35} />
          </mesh>
        ))}
        <AxesTriad pose={[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]} size={0.22} label="base" />
        <AxesTriad pose={G} size={0.15} label="gripper" />
      </Scene3D>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={`${t.q} 1 (yaw)`} value={q1} min={-90} max={90} step={1} onChange={setQ1} format={(v) => `${v}°`} />
          <Slider label={`${t.q} 2`} value={q2} min={-30} max={90} step={1} onChange={setQ2} format={(v) => `${v}°`} accent="#a78bfa" />
          <Slider label={`${t.q} 3`} value={q3} min={-30} max={110} step={1} onChange={setQ3} format={(v) => `${v}°`} accent="#4ade80" />
        </div>
        <Readout label={t.gripPos} value={`(${fmt(grip[0], 2)}, ${fmt(grip[1], 2)}, ${fmt(grip[2], 2)})`} accent="#22d3ee" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- application: pallet reach

// pallet: 6×4 grid of pick positions, in meters, base at origin
const PALLET_X0 = 0.55
const PALLET_Y0 = -0.65
const PALLET_W = 1.0
const PALLET_H = 0.7
const PALLET_NX = 6
const PALLET_NY = 4

function PalletLab() {
  const t = useT(T)
  const [l1, setL1] = useState(0.8)
  const [l2, setL2] = useState(0.55)

  const rMax = (l1 + l2) * 0.95 // singularity margin
  const rMin = Math.abs(l1 - l2)

  const cells = useMemo(() => {
    const out: { x: number; y: number; ok: boolean }[] = []
    for (let i = 0; i < PALLET_NX; i++)
      for (let j = 0; j < PALLET_NY; j++) {
        const x = PALLET_X0 + (i + 0.5) * (PALLET_W / PALLET_NX)
        const y = PALLET_Y0 + (j + 0.5) * (PALLET_H / PALLET_NY)
        const r = Math.hypot(x, y)
        out.push({ x, y, ok: r >= rMin && r <= rMax })
      }
    return out
  }, [rMin, rMax])

  const reached = cells.filter((c) => c.ok).length
  const all = reached === cells.length

  const PW = 520
  const PH = 340
  const S = 150 // px per meter
  const cx2 = 130
  const cy2 = PH / 2
  const sx = (x: number) => cx2 + x * S
  const sy = (y: number) => cy2 - y * S

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block w-full">
          {/* workspace annulus */}
          <circle cx={cx2} cy={cy2} r={rMax * S} fill="#22d3ee11" stroke="#22d3ee44" />
          <circle cx={cx2} cy={cy2} r={Math.max(rMin * S, 0.1)} fill="#0d1120" stroke="#22d3ee33" />
          {/* pallet outline */}
          <rect
            x={sx(PALLET_X0)}
            y={sy(PALLET_Y0 + PALLET_H)}
            width={PALLET_W * S}
            height={PALLET_H * S}
            fill="none"
            stroke="#8b93a766"
            strokeWidth={1.5}
          />
          {/* cells */}
          {cells.map((c, i) => (
            <rect
              key={i}
              x={sx(c.x) - (PALLET_W / PALLET_NX) * S * 0.42}
              y={sy(c.y) - (PALLET_H / PALLET_NY) * S * 0.42}
              width={(PALLET_W / PALLET_NX) * S * 0.84}
              height={(PALLET_H / PALLET_NY) * S * 0.84}
              rx={3}
              fill={c.ok ? '#4ade8033' : '#f8717133'}
              stroke={c.ok ? '#4ade80' : '#f87171'}
              strokeWidth={1.2}
            />
          ))}
          {/* arm drawn at a nominal pose pointing at pallet center */}
          {(() => {
            const tx = PALLET_X0 + PALLET_W / 2
            const ty = PALLET_Y0 + PALLET_H / 2
            const r = Math.min(Math.max(Math.hypot(tx, ty), rMin + 0.01), rMax - 0.01)
            const phi = Math.atan2(ty, tx)
            const c2 = (r * r - l1 * l1 - l2 * l2) / (2 * l1 * l2)
            const q2 = Math.acos(Math.min(1, Math.max(-1, c2)))
            const q1 = phi - Math.atan2(l2 * Math.sin(q2), l1 + l2 * Math.cos(q2))
            const ex = l1 * Math.cos(q1)
            const ey = l1 * Math.sin(q1)
            const wx = ex + l2 * Math.cos(q1 + q2)
            const wy = ey + l2 * Math.sin(q1 + q2)
            return (
              <g>
                <line x1={cx2} y1={cy2} x2={sx(ex)} y2={sy(ey)} stroke="#a78bfa" strokeWidth={5} strokeLinecap="round" />
                <line x1={sx(ex)} y1={sy(ey)} x2={sx(wx)} y2={sy(wy)} stroke="#22d3ee" strokeWidth={4} strokeLinecap="round" />
                <circle cx={cx2} cy={cy2} r={7} fill="#1c2333" stroke="#8b93a7" strokeWidth={2} />
                <circle cx={sx(ex)} cy={sy(ey)} r={4.5} fill="#a78bfa" />
                <circle cx={sx(wx)} cy={sy(wy)} r={4} fill="#22d3ee" />
              </g>
            )
          })()}
        </svg>
        <div className="border-t border-white/10 px-4 py-2 text-[12px] text-muted">{t.appLegend}</div>
      </div>
      <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <div className="card-pad space-y-3.5">
          <Slider label={t.appL1} value={l1} min={0.4} max={1.2} step={0.05} onChange={setL1} format={(v) => `${fmt(v, 2)} m`} accent="#a78bfa" />
          <Slider label={t.appL2} value={l2} min={0.3} max={1.0} step={0.05} onChange={setL2} format={(v) => `${fmt(v, 2)} m`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout label={t.appReach} value={`${reached} / ${cells.length}`} accent={all ? '#4ade80' : '#f87171'} />
          <Readout label={t.appVerdict} value={all ? t.appOk : t.appFail} accent={all ? '#4ade80' : '#f87171'} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function KinematicsPage() {
  const t = useT(T)
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageToc
        items={[
          { id: 'fk', label: t.fkTitle },
          { id: 'ik', label: t.ikTitle },
          { id: 'workspace', label: t.wsTitle },
          { id: 'fk3d', label: t.fk3dTitle },
          { id: 'practice', label: t.practTitle },
          { id: 'application', label: t.appTitle },
        ]}
      />
      <header className="pt-10 pb-2">
        <div className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{t.kicker}</div>
        <h1 className="mt-1 mb-3 text-3xl font-extrabold tracking-tight md:text-4xl">{t.title}</h1>
        <p className="prose-cv max-w-3xl text-muted">{t.intro}</p>
      </header>

      <Section id="fk" title={t.fkTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.fk1}</p>
        </div>
        <div className="mt-4">
          <FkLab />
        </div>
      </Section>

      <Section id="ik" title={t.ikTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.ik1}</p>
          <p>{t.ik2}</p>
        </div>
        <div className="mt-4">
          <IkLab />
        </div>
        <Derivation title={t.ikDerivTitle} steps={t.ikDeriv} />
        <Derivation title={t.jacDerivTitle} steps={t.jacDeriv} />
      </Section>

      <Section id="workspace" title={t.wsTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.ws1}</p>
        </div>
        <div className="mt-4">
          <WorkspaceLab />
        </div>
      </Section>

      <Section id="fk3d" title={t.fk3dTitle}>
        <div className="prose-cv max-w-3xl">
          <p>{t.fk3d1}</p>
        </div>
        <div className="mt-4">
          <Fk3dLab />
        </div>
      </Section>

      <Section id="practice" title={t.practTitle}>
        <div className="prose-cv max-w-3xl">
          <ul>
            {t.practList.map((s, i) => (
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
          <PalletLab />
        </div>
        <InfoBox tone="tip" title="💡">
          {t.appWhere}
        </InfoBox>
      </Section>
    </div>
  )
}
