# The Engineer's Pocketknife

An interactive learning hub for engineering essentials — everything runs live in the browser,
bilingual (English / German, toggle in the navbar).

**Platform features**: ⌘K search across all modules and labs · mobile navigation drawer ·
local progress tracking with curated learning paths · a [labs index](#) for jumping straight
to any of the 100+ interactives · bilingual glossary · printable formula cheat sheet ·
route-based code splitting (initial load ~90 KB gzipped) · installable PWA that works offline.

**🏭 Real-world application labs**: every module ends with an interactive industry scenario —
ADAS mono distance, stereo rig design for a forklift, PID auto-tuning, bearing-fault spectra,
GPS tunnel dropout, LIDAR obstacle extraction, guard-banded part acceptance, inline weld
inspection and 15 more — each one driven by the exact math taught above it.

## Tracks & modules

**📷 Camera & 3D Vision**
1. **The Camera Matrix** — pinhole model, homogeneous coordinates, `K`, `[R|t]`, `P = K[R|t]`, live 3D projection lab, planar homography (bird's-eye warp), PnP pose recovery
2. **Camera Calibration** — Zhang's method (live closed-form solver), lens distortion playground, fisheye vs. pinhole, virtual capture session, reprojection error, calibration uncertainty (Monte-Carlo vs. `(JᵀJ)⁻¹`)
3. **Numerical Optimization** — cost landscapes, gradient descent, Gauss-Newton, Levenberg–Marquardt, live calibration solver
4. **Stereo Vision** — epipolar geometry, triangulation, rectification, disparity–depth, live block-matching disparity map with cost-curve probe
5. **Hand-Eye Calibration** — eye-in-hand/eye-to-hand, `AX = XB`, `AX = ZB`, interactive robot arm

**📊 Data & Patterns**
1. **PCA** — covariance, eigenvectors, variance explained, 2D + 3D projection labs, scree plot
2. **K-Means** — Lloyd's algorithm stepper with Voronoi shading, k-means++, elbow method, failure modes
3. **Clustering II: GMM & DBSCAN** — EM with learning covariance ellipses, density-based clustering that solves the moons
4. **Robust Fitting & RANSAC** — animated hypothesis voting, inlier thresholds, robust losses

**🧠 Machine Learning**
1. **ML Fundamentals** — linear/logistic regression, overfitting U-curve, ridge regularization
2. **Stochastic & Global Optimization** — SGD noise, optimizer race (GD/momentum/Adam), LR schedules, simulated annealing, Lagrange constraints
3. **Neural Networks & Deep Learning** — live-training MLP playground with decision boundaries, interactive backprop visualizer (watch δ flow, chain-rule per weight), gradient checking
4. **Modern Deep Learning: CNNs & Transformers** — convolution kernel lab, stride/padding/receptive-field lab, feature hierarchies, live self-attention with value mixing and causal masking
5. **Vision Transformers & VLMs** — interactive ViT tokenizer, attention-on-an-image, multi-head roles, a draggable CLIP shared image–text space, a vision-language-model pipeline, and zero-shot defect triage

**🧮 Math Foundations**
1. **Probability & Bayes** — distributions, central limit theorem, base-rate fallacy with 1000 dots, Bayesian coin updating
2. **SVD & Linear Algebra** — rotate–stretch–rotate animation, singular values, low-rank image compression
3. **ODE Solvers & Simulation** — Euler vs. RK4 energy drift, the stability cliff, stiffness

**🤖 Robotics**
1. **Robot Kinematics** — draggable FK/IK arm, workspace analysis, Jacobian manipulability ellipse and singularities
2. **SLAM & the EKF** — dead-reckoning spaghetti, EKF-SLAM with landmark ellipses, loop closure that snaps the whole map tight, live covariance heatmap

**🎛️ Signals & Control**
1. **Fourier & Signals** — Fourier series with Gibbs ringing, sampling/aliasing, DFT + low-pass filtering, convolution
2. **Control Theory** — PID playground on a simulated plant, step-response metrics, delay-driven instability
3. **The Kalman Filter** — gaussian fusion, 1D tracking with Q/R tuning, and a 2D filter that chases your mouse

**📏 Measurement & Metrology**
1. **Measurement Theory** — accuracy vs. precision, GUM vs. Monte-Carlo error propagation, uncertainty of the mean, budgets
2. **3D Optical Metrology** — laser-line triangulation (3D scanning scene), fringe projection phase pipeline, Michelson interferometry

All interactive math lives in small dependency-free libraries: [`src/lib/math.ts`](src/lib/math.ts)
(3D/camera geometry), [`src/lib/optim.ts`](src/lib/optim.ts) (optimizers, LM),
[`src/lib/stats.ts`](src/lib/stats.ts) (PCA, k-means, eigen, datasets), [`src/lib/ml.ts`](src/lib/ml.ts)
(MLP + backprop, Adam, regression), [`src/lib/signal.ts`](src/lib/signal.ts) (DFT, PID simulation,
Kalman filters, uncertainty propagation, fringe math). The same numbers drive the 3D scenes
(react-three-fiber), the 2D SVG/canvas views and the live matrix displays.

## Tech stack

- React 19 + TypeScript + Vite
- three.js via @react-three/fiber + @react-three/drei
- Tailwind CSS v4, KaTeX for formulas
- react-router-dom (HashRouter — works on any static host without rewrite rules)

## Development

```bash
npm install
npm run dev        # dev server
npm run build      # type-check + production build → dist/
npm run preview    # serve the production build locally
```

## Deploying to GitHub Pages

The repo ships a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds and
deploys on every push to `main`. One-time setup:

1. Create a GitHub repository and push this project:
   ```bash
   git remote add origin git@github.com:<you>/<repo>.git
   git push -u origin main
   ```
2. In the repository settings, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push (or re-run the workflow). The site appears at `https://<you>.github.io/<repo>/`.

The Vite config uses `base: './'` and the app uses hash-based routing, so the build works at any
sub-path without further configuration.
