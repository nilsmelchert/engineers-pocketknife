import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'

const PinholePage = lazy(() => import('./pages/PinholePage').then((m) => ({ default: m.PinholePage })))
const CalibrationPage = lazy(() => import('./pages/CalibrationPage').then((m) => ({ default: m.CalibrationPage })))
const OptimizationPage = lazy(() => import('./pages/OptimizationPage').then((m) => ({ default: m.OptimizationPage })))
const StereoPage = lazy(() => import('./pages/StereoPage').then((m) => ({ default: m.StereoPage })))
const HandEyePage = lazy(() => import('./pages/HandEyePage').then((m) => ({ default: m.HandEyePage })))
const PcaPage = lazy(() => import('./pages/PcaPage').then((m) => ({ default: m.PcaPage })))
const KmeansPage = lazy(() => import('./pages/KmeansPage').then((m) => ({ default: m.KmeansPage })))
const MlBasicsPage = lazy(() => import('./pages/MlBasicsPage').then((m) => ({ default: m.MlBasicsPage })))
const OptAdvancedPage = lazy(() => import('./pages/OptAdvancedPage').then((m) => ({ default: m.OptAdvancedPage })))
const NeuralNetsPage = lazy(() => import('./pages/NeuralNetsPage').then((m) => ({ default: m.NeuralNetsPage })))
const ProbabilityPage = lazy(() => import('./pages/ProbabilityPage').then((m) => ({ default: m.ProbabilityPage })))
const SvdPage = lazy(() => import('./pages/SvdPage').then((m) => ({ default: m.SvdPage })))
const FourierPage = lazy(() => import('./pages/FourierPage').then((m) => ({ default: m.FourierPage })))
const ControlPage = lazy(() => import('./pages/ControlPage').then((m) => ({ default: m.ControlPage })))
const KalmanPage = lazy(() => import('./pages/KalmanPage').then((m) => ({ default: m.KalmanPage })))
const MeasurementPage = lazy(() => import('./pages/MeasurementPage').then((m) => ({ default: m.MeasurementPage })))
const Metrology3dPage = lazy(() => import('./pages/Metrology3dPage').then((m) => ({ default: m.Metrology3dPage })))
const DeepLearningPage = lazy(() => import('./pages/DeepLearningPage').then((m) => ({ default: m.DeepLearningPage })))
const VisionTransformersPage = lazy(() => import('./pages/VisionTransformersPage').then((m) => ({ default: m.VisionTransformersPage })))
const KinematicsPage = lazy(() => import('./pages/KinematicsPage').then((m) => ({ default: m.KinematicsPage })))
const RansacPage = lazy(() => import('./pages/RansacPage').then((m) => ({ default: m.RansacPage })))
const OdePage = lazy(() => import('./pages/OdePage').then((m) => ({ default: m.OdePage })))
const Clustering2Page = lazy(() => import('./pages/Clustering2Page').then((m) => ({ default: m.Clustering2Page })))
const SlamPage = lazy(() => import('./pages/SlamPage').then((m) => ({ default: m.SlamPage })))
const LabsPage = lazy(() => import('./pages/LabsPage').then((m) => ({ default: m.LabsPage })))
const GlossaryPage = lazy(() => import('./pages/GlossaryPage').then((m) => ({ default: m.GlossaryPage })))
const FormulasPage = lazy(() => import('./pages/FormulasPage').then((m) => ({ default: m.FormulasPage })))

function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-3 text-muted">
        <span className="inline-block h-3 w-3 animate-pulse rounded-sm bg-gradient-to-br from-accent to-accent2" />
        <span className="text-sm font-semibold tracking-tight">
          pocket<span className="text-accent">·</span>knife
        </span>
      </div>
    </div>
  )
}

export function App() {
  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/camera-matrix" element={<PinholePage />} />
          <Route path="/calibration" element={<CalibrationPage />} />
          <Route path="/optimization" element={<OptimizationPage />} />
          <Route path="/stereo" element={<StereoPage />} />
          <Route path="/hand-eye" element={<HandEyePage />} />
          <Route path="/pca" element={<PcaPage />} />
          <Route path="/kmeans" element={<KmeansPage />} />
          <Route path="/ml-basics" element={<MlBasicsPage />} />
          <Route path="/optimization-advanced" element={<OptAdvancedPage />} />
          <Route path="/neural-networks" element={<NeuralNetsPage />} />
          <Route path="/probability" element={<ProbabilityPage />} />
          <Route path="/svd" element={<SvdPage />} />
          <Route path="/fourier" element={<FourierPage />} />
          <Route path="/control" element={<ControlPage />} />
          <Route path="/kalman" element={<KalmanPage />} />
          <Route path="/measurement" element={<MeasurementPage />} />
          <Route path="/metrology-3d" element={<Metrology3dPage />} />
          <Route path="/deep-learning" element={<DeepLearningPage />} />
          <Route path="/vision-transformers" element={<VisionTransformersPage />} />
          <Route path="/kinematics" element={<KinematicsPage />} />
          <Route path="/ransac" element={<RansacPage />} />
          <Route path="/ode" element={<OdePage />} />
          <Route path="/clustering-2" element={<Clustering2Page />} />
          <Route path="/slam" element={<SlamPage />} />
          <Route path="/labs" element={<LabsPage />} />
          <Route path="/glossary" element={<GlossaryPage />} />
          <Route path="/formulas" element={<FormulasPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
