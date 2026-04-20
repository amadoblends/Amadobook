/**
 * App.jsx — Two isolated app trees
 *
 * /barber/*  → BarberAuthProvider (barberAuth instance)
 * /b/:slug/* → ClientAuthProvider (clientAuth instance)
 *
 * Sessions are 100% independent — logging into one
 * does NOT affect the other, even in the same browser.
 */
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'

import { BarberAuthProvider }  from './context/BarberAuthContext'
import { ClientAuthProvider }  from './context/ClientAuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { useBarberAuth } from './hooks/useBarberAuth'
import { useClientAuth } from './hooks/useClientAuth'
import { PageLoader } from './components/ui/Spinner'

// ── Barber pages ──────────────────────────────────────────────────────────
import BarberLoginPage    from './pages/auth/BarberLoginPage'
import BarberSignupPage   from './pages/auth/BarberSignupPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import BarberDashboard    from './pages/barber/BarberDashboard'
import BarberServices     from './pages/barber/BarberServices'
import BarberAvailability from './pages/barber/BarberAvailability'
import BarberCalendar     from './pages/barber/BarberCalendar'
import BarberReports      from './pages/barber/BarberReports'
import BarberSuggestions  from './pages/barber/BarberSuggestions'

// ── Client pages ──────────────────────────────────────────────────────────
import BarberLandingPage    from './pages/client/BarberLandingPage'
import ClientAuthPage       from './pages/client/ClientAuthPage'
import BookingPage          from './pages/client/BookingPage'
import BookingConfirmedPage from './pages/client/BookingConfirmedPage'
import ClientDashboard      from './pages/client/ClientDashboard'

// ── Theme sync ────────────────────────────────────────────────────────────
function BarberThemeSync() {
  const { user, userData } = useBarberAuth()
  const { loadPrefs, resetToDefaults, setRole } = useTheme()
  useEffect(() => {
    if (user?.uid) { setRole('barber'); loadPrefs(user.uid, 'barber') }
    else resetToDefaults()
  }, [user?.uid])
  return null
}

function ClientThemeSync() {
  const { user } = useClientAuth()
  const { loadPrefs, resetToDefaults, setRole } = useTheme()
  useEffect(() => {
    if (user?.uid) { setRole('client'); loadPrefs(user.uid, 'client') }
    else resetToDefaults()
  }, [user?.uid])
  return null
}

// ── Route guards ──────────────────────────────────────────────────────────
function BarberRoute({ children }) {
  const { user, userData, loading } = useBarberAuth()
  if (loading) return <PageLoader />
  if (!user)   return <Navigate to="/barber/login" replace />
  if (userData?.role !== 'barber') return <Navigate to="/barber/login" replace />
  return children
}

// ── Slug redirect helper ──────────────────────────────────────────────────
function SlugRedirect({ to }) {
  const { barberSlug } = useParams()
  return <Navigate to={`/b/${barberSlug}/${to}`} replace />
}

// ── BARBER APP subtree ────────────────────────────────────────────────────
function BarberApp() {
  return (
    <BarberAuthProvider>
      <BarberThemeSync />
      <Routes>
        <Route path="login"           element={<BarberLoginPage />} />
        <Route path="signup"          element={<BarberSignupPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage role="barber" />} />
        <Route path="dashboard"       element={<BarberRoute><BarberDashboard /></BarberRoute>} />
        <Route path="services"        element={<BarberRoute><BarberServices /></BarberRoute>} />
        <Route path="availability"    element={<BarberRoute><BarberAvailability /></BarberRoute>} />
        <Route path="calendar"        element={<BarberRoute><BarberCalendar /></BarberRoute>} />
        <Route path="reports"         element={<BarberRoute><BarberReports /></BarberRoute>} />
        <Route path="suggestions"     element={<BarberRoute><BarberSuggestions /></BarberRoute>} />
        <Route index element={<Navigate to="login" replace />} />
      </Routes>
    </BarberAuthProvider>
  )
}

// ── CLIENT APP subtree ────────────────────────────────────────────────────
function ClientApp() {
  return (
    <ClientAuthProvider>
      <ClientThemeSync />
      <Routes>
        <Route index                  element={<BarberLandingPage />} />
        <Route path="auth"            element={<ClientAuthPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage role="client" />} />
        <Route path="book"            element={<BookingPage />} />
        <Route path="confirmed"       element={<BookingConfirmedPage />} />
        <Route path="dashboard"       element={<ClientDashboard />} />
        {/* Legacy redirects */}
        <Route path="login"           element={<SlugRedirect to="auth" />} />
        <Route path="signup"          element={<SlugRedirect to="auth" />} />
      </Routes>
    </ClientAuthProvider>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Toaster position="top-center" toastOptions={{
          style: { background:'#1a1a1a', color:'#F5F5F5', border:'1px solid #2a2a2a', borderRadius:'12px', fontSize:'14px', fontFamily:"'Monda',system-ui,sans-serif" },
          success: { iconTheme: { primary:'#22C55E', secondary:'#fff' } },
          error:   { iconTheme: { primary:'#EF4444', secondary:'#fff' } },
        }}/>
        <Routes>
          {/* ── BARBER APP ── */}
          <Route path="/barber/*" element={<BarberApp />} />

          {/* ── CLIENT APP ── */}
          <Route path="/b/:barberSlug/*" element={<ClientApp />} />

          {/* ── HOME ── redirect to barber login by default ── */}
          <Route path="/" element={<Navigate to="/barber/login" replace />} />
          <Route path="*" element={<Navigate to="/"            replace />} />
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  )
}