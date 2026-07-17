import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { PinholePage } from './pages/PinholePage'
import { CalibrationPage } from './pages/CalibrationPage'
import { StereoPage } from './pages/StereoPage'
import { HandEyePage } from './pages/HandEyePage'

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/camera-matrix" element={<PinholePage />} />
        <Route path="/calibration" element={<CalibrationPage />} />
        <Route path="/stereo" element={<StereoPage />} />
        <Route path="/hand-eye" element={<HandEyePage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </Layout>
  )
}
