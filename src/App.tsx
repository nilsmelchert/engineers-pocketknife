import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { PinholePage } from './pages/PinholePage'
import { CalibrationPage } from './pages/CalibrationPage'
import { OptimizationPage } from './pages/OptimizationPage'
import { StereoPage } from './pages/StereoPage'
import { HandEyePage } from './pages/HandEyePage'
import { PcaPage } from './pages/PcaPage'
import { KmeansPage } from './pages/KmeansPage'
import { MlBasicsPage } from './pages/MlBasicsPage'
import { OptAdvancedPage } from './pages/OptAdvancedPage'
import { NeuralNetsPage } from './pages/NeuralNetsPage'
import { ProbabilityPage } from './pages/ProbabilityPage'
import { SvdPage } from './pages/SvdPage'
import { FourierPage } from './pages/FourierPage'
import { ControlPage } from './pages/ControlPage'
import { KalmanPage } from './pages/KalmanPage'
import { MeasurementPage } from './pages/MeasurementPage'
import { Metrology3dPage } from './pages/Metrology3dPage'
import { DeepLearningPage } from './pages/DeepLearningPage'
import { KinematicsPage } from './pages/KinematicsPage'
import { RansacPage } from './pages/RansacPage'
import { OdePage } from './pages/OdePage'
import { Clustering2Page } from './pages/Clustering2Page'

export function App() {
  return (
    <Layout>
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
        <Route path="/kinematics" element={<KinematicsPage />} />
        <Route path="/ransac" element={<RansacPage />} />
        <Route path="/ode" element={<OdePage />} />
        <Route path="/clustering-2" element={<Clustering2Page />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </Layout>
  )
}
