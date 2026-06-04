import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthGuard from './components/AuthGuard'
import NotificationListener from './components/NotificationListener'
import OfflineBanner from './components/OfflineBanner'
import ToastBanner from './components/ToastBanner'
import { useSpotifyCallback } from './hooks/useSpotifyCallback'
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/onboarding'
import Discover from './pages/Discover'
import Matches from './pages/Matches'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import ProfileEdit from './pages/ProfileEdit'
import Library from './pages/Library'

function AppInner() {
  useSpotifyCallback()
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
      <NotificationListener />
      <OfflineBanner />
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
        <Route path="/library" element={<AuthGuard><Library /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
