import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'

import { BarberAuthProvider } from './context/BarberAuthContext'
import { ClientAuthProvider } from './context/ClientAuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { useBarberAuth } from './hooks/useBarberAuth'
import { useClientAuth } from './hooks/useClientAuth'
import { PageLoader } from './components/ui/Spinner'

import BarberLoginPage    from './pages/auth/BarberLoginPage'
import BarberSignupPage   from './pages/auth/BarberSignupPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import BarberDashboard    from './pages/barber/BarberDashboard'
import BarberServices     from './pages/barber/BarberServices'
import BarberAvailability from './pages/barber/BarberAvailability'
import BarberCalendar     from './pages/barber/BarberCalendar'
import BarberReports      from './pages/barber/BarberReports'
import BarberSuggestions  from './pages/barber/BarberSuggestions'

import BarberLandingPage    from './pages/client/BarberLandingPage'
import ClientAuthPage       from './pages/client/ClientAuthPage'
import BookingPage          from './pages/client/BookingPage'
import BookingConfirmedPage from './pages/client/BookingConfirmedPage'
import ClientDashboard      from './pages/client/ClientDashboard'

function SlugRedirect({ to }) {
  const { barberSlug } = useParams()
  return <Navigate to={`/b/${barberSlug}/${to}`} replace />
}

// ThemeSync lives inside both providers so it can read user
function ThemeSync() {
  const barber = useBarberAuth()
  const client = useClientAuth()
  const { loadPrefs, resetToDefaults, setRole } = useTheme()

  useEffect(() => {
    // Barber takes priority if logged in on barber routes
    if (barber.user && barber.userData?.role === 'barber') {
      setRole('barber')
      loadPrefs(barber.user.uid, 'barber')
    } else if (client.user) {
      setRole('client')
      loadPrefs(client.user.uid, 'client')
    } else {
      resetToDefaults()
    }
  }, [barber.user?.uid, client.user?.uid])

  return null
}

function BarberRoute({ children }) {
  const { user, userData, loading } = useBarberAuth()
  if (loading) return <PageLoader />
  if (!user || userData?.role !== 'barber') return <Navigate to="/barber/login" replace />
  return children
}

function AppRoutes() {
  return (
    <>
      <ThemeSync />
      <Routes>
        {/* BARBER */}
        <Route path="/barber/login"           element={<BarberLoginPage />} />
        <Route path="/barber/signup"          element={<BarberSignupPage />} />
        <Route path="/barber/forgot-password" element={<ForgotPasswordPage role="barber" />} />
        <Route path="/barber/dashboard"       element={<BarberRoute><BarberDashboard /></BarberRoute>} />
        <Route path="/barber/services"        element={<BarberRoute><BarberServices /></BarberRoute>} />
        <Route path="/barber/availability"    element={<BarberRoute><BarberAvailability /></BarberRoute>} />
        <Route path="/barber/calendar"        element={<BarberRoute><BarberCalendar /></BarberRoute>} />
        <Route path="/barber/reports"         element={<BarberRoute><BarberReports /></BarberRoute>} />
        <Route path="/barber/suggestions"     element={<BarberRoute><BarberSuggestions /></BarberRoute>} />

        {/* CLIENT */}
        <Route path="/b/:barberSlug"                 element={<BarberLandingPage />} />
        <Route path="/b/:barberSlug/auth"            element={<ClientAuthPage />} />
        <Route path="/b/:barberSlug/forgot-password" element={<ForgotPasswordPage role="client" />} />
        <Route path="/b/:barberSlug/book"            element={<BookingPage />} />
        <Route path="/b/:barberSlug/confirmed"       element={<BookingConfirmedPage />} />
        <Route path="/b/:barberSlug/dashboard"       element={<ClientDashboard />} />
        <Route path="/b/:barberSlug/login"           element={<SlugRedirect to="auth" />} />
        <Route path="/b/:barberSlug/signup"          element={<SlugRedirect to="auth" />} />

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
        {/* Both providers always mounted at root — never reset on navigation */}
        <BarberAuthProvider>
          <ClientAuthProvider>
            <Toaster position="top-center" toastOptions={{
              style: { background:'#1a1a1a', color:'#F5F5F5', border:'1px solid #2a2a2a', borderRadius:'12px', fontSize:'14px', fontFamily:"'Monda',system-ui,sans-serif" },
              success: { iconTheme: { primary:'#22C55E', secondary:'#fff' } },
              error:   { iconTheme: { primary:'#EF4444', secondary:'#fff' } },
            }}/>
            <AppRoutes />
          </ClientAuthProvider>
        </BarberAuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}