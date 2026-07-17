# Camera Calibration — Interactive Guide

An interactive learning website for students covering the geometry of cameras:

1. **The Camera Matrix** — pinhole model, homogeneous coordinates, intrinsics `K`, extrinsics `[R|t]`, projection matrix `P = K[R|t]`, with a live 3D projection lab.
2. **Camera Calibration** — Zhang's method, Brown–Conrady lens distortion playground, a virtual capture session with coverage checklist, and a reprojection-error demo.
3. **Stereo Vision** — stereo extrinsics, interactive triangulation, epipolar geometry (drag a point, see its epipolar line), rectification, and the disparity–depth relation.
4. **Hand-Eye Calibration** — eye-in-hand vs. eye-to-hand with a movable 3-DOF robot arm, the kinematic loop, `AX = XB` and the robot-world variant `AX = ZB`.

All content is bilingual (English / German, toggle in the navbar). All interactive math is computed in
[`src/lib/math.ts`](src/lib/math.ts) — the same numbers drive the 3D scenes (react-three-fiber),
the 2D sensor views (SVG) and the live matrix displays.

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
