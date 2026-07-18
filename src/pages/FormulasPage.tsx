import { Link } from 'react-router-dom'
import { useLangState, useT } from '../i18n'
import { TeX } from '../components/TeX'
import { TRACKS } from '../components/Layout'

const T = {
  en: {
    title: 'Formula cheat sheet',
    intro: 'The load-bearing equations of every module, on one printable page. Each formula links back to the module that derives and demonstrates it.',
    print: '🖨 Print this page',
  },
  de: {
    title: 'Formelsammlung',
    intro: 'Die tragenden Gleichungen jedes Moduls auf einer druckbaren Seite. Jede Formel verlinkt zurück zum Modul, das sie herleitet und demonstriert.',
    print: '🖨 Seite drucken',
  },
}

interface FormulaEntry {
  tex: string
  label: { en: string; de: string }
  path: string
}

const FORMULAS: { track: string; items: FormulaEntry[] }[] = [
  {
    track: 'vision',
    items: [
      { tex: String.raw`\lambda\,\tilde{\mathbf{x}} = K[R\mid\mathbf{t}]\,\tilde{\mathbf{X}}, \qquad K = \begin{bmatrix} f_x & s & c_x \\ 0 & f_y & c_y \\ 0 & 0 & 1 \end{bmatrix}`, label: { en: 'Pinhole projection', de: 'Lochkamera-Projektion' }, path: '/camera-matrix' },
      { tex: String.raw`x_d = x(1 + k_1 r^2 + k_2 r^4 + k_3 r^6) + 2p_1 xy + p_2(r^2 + 2x^2)`, label: { en: 'Brown–Conrady distortion', de: 'Brown–Conrady-Verzeichnung' }, path: '/calibration' },
      { tex: String.raw`(J^{\mathsf T}J + \lambda\,\mathrm{diag}(J^{\mathsf T}J))\,\boldsymbol{\delta} = -J^{\mathsf T}\mathbf{r}`, label: { en: 'Levenberg–Marquardt step', de: 'Levenberg–Marquardt-Schritt' }, path: '/optimization' },
      { tex: String.raw`Z = \frac{f\,b}{d}, \qquad \Delta Z \approx \frac{Z^2}{f\,b}\,\Delta d`, label: { en: 'Disparity → depth', de: 'Disparität → Tiefe' }, path: '/stereo' },
      { tex: String.raw`E = [\mathbf{t}]_\times R, \qquad F = K_2^{-\mathsf T} E K_1^{-1}, \qquad \tilde{\mathbf{x}}_2^{\mathsf T} F \tilde{\mathbf{x}}_1 = 0`, label: { en: 'Essential & fundamental matrix', de: 'Essentielle & Fundamentalmatrix' }, path: '/stereo' },
      { tex: String.raw`\tilde{A}X = X\tilde{B}, \qquad A_i X = Z B_i`, label: { en: 'Hand-eye equations', de: 'Hand-Auge-Gleichungen' }, path: '/hand-eye' },
    ],
  },
  {
    track: 'data',
    items: [
      { tex: String.raw`C\,\mathbf{w} = \lambda\,\mathbf{w}, \qquad C = \tfrac{1}{n-1}\textstyle\sum_i (\mathbf{x}_i - \mu)(\mathbf{x}_i - \mu)^{\mathsf T}`, label: { en: 'PCA eigenproblem', de: 'PCA-Eigenproblem' }, path: '/pca' },
      { tex: String.raw`\min_{\mu, c} \textstyle\sum_i \lVert \mathbf{x}_i - \mu_{c(i)} \rVert^2`, label: { en: 'k-means objective', de: 'K-Means-Zielfunktion' }, path: '/kmeans' },
      { tex: String.raw`\gamma_{ik} = \frac{\pi_k \mathcal{N}(\mathbf{x}_i \mid \mu_k, \Sigma_k)}{\sum_j \pi_j \mathcal{N}(\mathbf{x}_i \mid \mu_j, \Sigma_j)}`, label: { en: 'EM responsibilities (GMM)', de: 'EM-Verantwortlichkeiten (GMM)' }, path: '/clustering-2' },
      { tex: String.raw`N \ge \frac{\log(1-p)}{\log(1 - w^s)}`, label: { en: 'RANSAC iteration count', de: 'RANSAC-Iterationszahl' }, path: '/ransac' },
    ],
  },
  {
    track: 'ml',
    items: [
      { tex: String.raw`\theta^\star = \arg\min_\theta \tfrac{1}{n}\textstyle\sum_i \ell(f(\mathbf{x}_i;\theta), y_i) + \lambda\,\Omega(\theta)`, label: { en: 'The learning problem', de: 'Das Lernproblem' }, path: '/ml-basics' },
      { tex: String.raw`\theta_{t+1} = \theta_t - \alpha\,\frac{\hat{\mathbf{m}}_t}{\sqrt{\hat{\mathbf{v}}_t} + \varepsilon}`, label: { en: 'Adam update', de: 'Adam-Update' }, path: '/optimization-advanced' },
      { tex: String.raw`\delta^{(l)} = (W^{(l+1)\mathsf T}\delta^{(l+1)}) \odot \varphi'(z^{(l)}), \qquad \frac{\partial L}{\partial W^{(l)}} = \delta^{(l)} a^{(l-1)\mathsf T}`, label: { en: 'Backpropagation', de: 'Backpropagation' }, path: '/neural-networks' },
      { tex: String.raw`\operatorname{Attention}(Q,K,V) = \operatorname{softmax}\!\left(\frac{QK^{\mathsf T}}{\sqrt{d}}\right)V`, label: { en: 'Scaled dot-product attention', de: 'Skalierte Dot-Product-Attention' }, path: '/deep-learning' },
    ],
  },
  {
    track: 'math',
    items: [
      { tex: String.raw`P(A\mid B) = \frac{P(B\mid A)\,P(A)}{P(B)}`, label: { en: 'Bayes’ rule', de: 'Satz von Bayes' }, path: '/probability' },
      { tex: String.raw`A = U\,\Sigma\,V^{\mathsf T}`, label: { en: 'Singular value decomposition', de: 'Singulärwertzerlegung' }, path: '/svd' },
      { tex: String.raw`|1 - h\lambda| < 1 \;\Leftrightarrow\; h < \tfrac{2}{\lambda}`, label: { en: 'Euler stability bound', de: 'Euler-Stabilitätsgrenze' }, path: '/ode' },
    ],
  },
  {
    track: 'signals',
    items: [
      { tex: String.raw`X_k = \textstyle\sum_{n=0}^{N-1} x_n e^{-i 2\pi kn/N}, \qquad f_{\max} < \tfrac{f_s}{2}`, label: { en: 'DFT & Nyquist', de: 'DFT & Nyquist' }, path: '/fourier' },
      { tex: String.raw`u(t) = K_p e + K_i \textstyle\int e\,d\tau + K_d \dot{e}`, label: { en: 'PID control law', de: 'PID-Regelgesetz' }, path: '/control' },
      { tex: String.raw`K = P^- H^{\mathsf T}(H P^- H^{\mathsf T} + R)^{-1}, \qquad \hat{\mathbf{x}} = \hat{\mathbf{x}}^- + K(\mathbf{z} - H\hat{\mathbf{x}}^-)`, label: { en: 'Kalman update', de: 'Kalman-Korrektur' }, path: '/kalman' },
    ],
  },
  {
    track: 'robotics',
    items: [
      { tex: String.raw`\cos\theta_2 = \frac{x^2 + y^2 - l_1^2 - l_2^2}{2 l_1 l_2}, \qquad \det J = l_1 l_2 \sin\theta_2`, label: { en: '2-link IK & singularity', de: '2-Gelenk-IK & Singularität' }, path: '/kinematics' },
      { tex: String.raw`\hat{\mathbf{x}} = [\mathbf{x}_r,\; \mathbf{l}_1, \dots, \mathbf{l}_N], \qquad z = (r, \varphi) = h(\mathbf{x}) + v`, label: { en: 'EKF-SLAM state & measurement', de: 'EKF-SLAM-Zustand & Messung' }, path: '/slam' },
    ],
  },
  {
    track: 'metrology',
    items: [
      { tex: String.raw`\sigma_y^2 = \textstyle\sum_i \left(\frac{\partial f}{\partial x_i}\right)^2 \sigma_{x_i}^2, \qquad U = k\,u \;(k=2)`, label: { en: 'GUM propagation', de: 'GUM-Fortpflanzung' }, path: '/measurement' },
      { tex: String.raw`\varphi_w = \operatorname{atan2}(I_{270} - I_{90},\, I_0 - I_{180}), \qquad h = \frac{\Delta\varphi\, p}{2\pi \tan\theta}`, label: { en: 'Phase shifting → height', de: 'Phasenschieben → Höhe' }, path: '/metrology-3d' },
      { tex: String.raw`\Delta = N \cdot \tfrac{\lambda}{2}`, label: { en: 'Interferometric displacement', de: 'Interferometrische Verschiebung' }, path: '/metrology-3d' },
    ],
  },
]

export function FormulasPage() {
  const t = useT(T)
  const { lang } = useLangState()

  return (
    <div className="mx-auto max-w-6xl px-4 print:max-w-none">
      <header className="flex flex-wrap items-end justify-between gap-4 pt-10 pb-6">
        <div>
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight md:text-4xl">🧾 {t.title}</h1>
          <p className="max-w-3xl text-[15px] leading-7 text-muted">{t.intro}</p>
        </div>
        <button className="btn print:hidden" onClick={() => window.print()}>
          {t.print}
        </button>
      </header>

      {FORMULAS.map((group) => {
        const track = TRACKS.find((tr) => tr.id === group.track)!
        return (
          <section key={group.track} className="mb-8 break-inside-avoid">
            <h2 className="mb-3 text-lg font-bold tracking-tight">
              {track.icon} {track.title[lang]}
            </h2>
            <div className="card divide-y divide-white/5 print:divide-gray-300">
              {group.items.map((f, i) => (
                <div key={i} className="flex flex-col gap-1 px-5 py-3 md:flex-row md:items-center md:gap-6">
                  <Link
                    to={f.path}
                    className="w-52 shrink-0 text-[13px] font-semibold text-accent hover:underline print:text-black"
                  >
                    {f.label[lang]}
                  </Link>
                  <div className="min-w-0 overflow-x-auto">
                    <TeX>{f.tex}</TeX>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
