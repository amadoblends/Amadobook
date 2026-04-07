import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { useAuth } from './hooks/useAuth'
import { useEffect } from 'react'
import { useTheme } from './context/ThemeContext'
import { PageLoader } from './components/ui/Spinner'

// Barber auth + dashboard pages
import BarberLoginPage    from './pages/auth/BarberLoginPage'
import BarberSignupPage   from './pages/auth/BarberSignupPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import BarberDashboard    from './pages/barber/BarberDashboard'
import BarberServices     from './pages/barber/BarberServices'
import BarberAvailability from './pages/barber/BarberAvailability'
import BarberCalendar     from './pages/barber/BarberCalendar'
import BarberReports      from './pages/barber/BarberReports'
import BarberSuggestions  from './pages/barber/BarberSuggestions'

// Client public pages - open to everyone via barber link
import BarberLandingPage  from './pages/client/BarberLandingPage'
import ClientAuthPage     from './pages/client/ClientAuthPage'
import BookingPage        from './pages/client/BookingPage'
import BookingConfirmedPage from './pages/client/BookingConfirmedPage'
import ClientDashboard    from './pages/client/ClientDashboard'

function ThemeSync() {
  const { user } = useAuth()
  const { setUid, loadPrefs } = useTheme()
  useEffect(() => {
    if (user) { setUid(user.uid); loadPrefs(user.uid) }
    else setUid(null)
  }, [user?.uid])
  return null
}

function BarberRoute({ children }) {
  const { user, userData, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/barber/login" replace />
  if (userData?.role !== 'barber') return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <>
      <ThemeSync />
      <Routes>
        {/* ── Barber login/signup ── */}
        <Route path="/barber/login"           element={<BarberLoginPage />} />
        <Route path="/barber/signup"          element={<BarberSignupPage />} />
        <Route path="/barber/forgot-password" element={<ForgotPasswordPage backTo="/barber/login" />} />

        {/* ── Barber dashboard (protected) ── */}
        <Route path="/barber/dashboard"    element={<BarberRoute><BarberDashboard /></BarberRoute>} />
        <Route path="/barber/services"     element={<BarberRoute><BarberServices /></BarberRoute>} />
        <Route path="/barber/availability" element={<BarberRoute><BarberAvailability /></BarberRoute>} />
        <Route path="/barber/calendar"     element={<BarberRoute><BarberCalendar /></BarberRoute>} />
        <Route path="/barber/reports"      element={<BarberRoute><BarberReports /></BarberRoute>} />
        <Route path="/barber/suggestions"  element={<BarberRoute><BarberSuggestions /></BarberRoute>} />

        {/* ── Public client routes ── anyone with the link */}
        <Route path="/b/:barberSlug"              element={<BarberLandingPage />} />
        <Route path="/b/:barberSlug/auth"         element={<ClientAuthPage />} />
        <Route path="/b/:barberSlug/book"         element={<BookingPage />} />
        <Route path="/b/:barberSlug/confirmed"    element={<BookingConfirmedPage />} />
        <Route path="/b/:barberSlug/dashboard"    element={<ClientDashboard />} />

        {/* Legacy redirects */}
        <Route path="/b/:barberSlug/login"    element={<Navigate to="/b/:barberSlug/auth" replace />} />
        <Route path="/b/:barberSlug/signup"   element={<Navigate to="/b/:barberSlug/auth" replace />} />
        <Route path="/client/dashboard"       element={<Navigate to="/" replace />} />

        <Route path="/" element={<Navigate to="/barber/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Toaster position="top-center" toastOptions={{
            style: { background:'#1a1a1a', color:'#E5E5E5', border:'1px solid #2a2a2a', borderRadius:'14px', fontSize:'14px' },
            success: { iconTheme: { primary:'#16A34A', secondary:'#fff' } },
            error:   { iconTheme: { primary:'#ef4444', secondary:'#fff' } },
          }}/>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
