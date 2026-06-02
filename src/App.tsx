import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthGuard from './components/AuthGuard'
import NotificationListener from './components/NotificationListener'
import ToastBanner from './components/ToastBanner'
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/onboarding'
import Discover from './pages/Discover'
import Matches from './pages/Matches'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import ProfileEdit from './pages/ProfileEdit'

export default function App() {
  return (
    <BrowserRouter>
      <NotificationListener />
      <ToastBanner />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />
        <Route path="/" element={<AuthGuard><Discover /></AuthGuard>} />
        <Route path="/matches" element={<AuthGuard><Matches /></AuthGuard>} />
        <Route path="/chat/:matchId" element={<AuthGuard><Chat /></AuthGuard>} />
        <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
        <Route path="/profile/edit" element={<AuthGuard><ProfileEdit /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
