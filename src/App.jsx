import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'

import { BarberAuthProvider } from './context/BarberAuthContext'
import { ClientAuthProvider } from './context/ClientAuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { useBarberAuth } from './hooks/useBarberAuth'
import { useClientAuth } from './hooks/useClientAuth'
import { PageLoader } from './components/ui/Spinner'

// ── Single barber config ───────────────────────────────────────────────────
export const BARBER_SLUG = 'amadoblends'

// ── App mode ──────────────────────────────────────────────────────────────
// amadobook.vercel.app   → VITE_APP_MODE=client  (default)
// amadobarber.vercel.app → VITE_APP_MODE=barber
const APP_MODE = import.meta.env.VITE_APP_MODE || 'client'

// ── Auth pages ─────────────────────────────────────────────────────────────
import BarberLoginPage    from './pages/auth/BarberLoginPage'
import BarberSignupPage   from './pages/auth/BarberSignupPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'

// ── Barber pages ───────────────────────────────────────────────────────────
import BarberDashboard    from './pages/barber/BarberDashboard'
import BarberCalendar     from './pages/barber/BarberCalendar'
import BarberServices     from './pages/barber/BarberServices'
import BarberAvailability from './pages/barber/BarberAvailability'
import BarberReports      from './pages/barber/BarberReports'
import BarberBroadcast    from './pages/barber/BarberBroadcast'
import BarberAppointments from './pages/barber/BarberAppointments'
import BarberClientList   from './pages/barber/BarberClientList'
import BarberClientDetail from './pages/barber/BarberClientDetail'
import BarberReportDetail from './pages/barber/BarberReportDetail'
import AddEditService     from './pages/barber/AddEditService'
import BarberSettings     from './pages/barber/BarberSettings'
import { BarberProfile }  from './pages/barber/BarberProfile'

// ── Client pages ───────────────────────────────────────────────────────────
import SplashPage             from './pages/client/SplashPage'
import ClientLoginPage        from './pages/client/ClientLoginPage'
import ClientRegisterPage     from './pages/client/ClientRegisterPage'
import BookingPage            from './pages/client/BookingPage'
import BookingConfirmedPage   from './pages/client/BookingConfirmedPage'
import ClientDashboard        from './pages/client/ClientDashboard'
import { MyAppointmentsPage } from './pages/client/MyAppointmentsPage'
import { HistoryPage }        from './pages/client/HistoryPage'
import { PortfolioPage }      from './pages/client/PortfolioPage'
import { ReferralsPage }      from './pages/client/ReferralsPage'
import { ClientProfilePage }  from './pages/client/ClientProfilePage'

// ── ThemeSync ──────────────────────────────────────────────────────────────
function ThemeSync() {
  const barber = useBarberAuth()
  const client = useClientAuth()
  const { loadPrefs, resetToDefaults, setRole } = useTheme()
  useEffect(() => {
    if (barber.user && barber.userData?.role === 'barber') {
      setRole('barber'); loadPrefs(barber.user.uid, 'barber')
    } else if (client.user) {
      setRole('client'); loadPrefs(client.user.uid, 'client')
    } else {
      resetToDefaults()
    }
  }, [barber.user?.uid, client.user?.uid])
  return null
}

// ── Guards ─────────────────────────────────────────────────────────────────
function BarberRoute({ children }) {
  const { user, userData, loading } = useBarberAuth()
  if (loading) return <PageLoader />
  if (!user || userData?.role !== 'barber') return <Navigate to="/barber/login" replace />
  return children
}

function ClientRoute({ children }) {
  const { user, loading } = useClientAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

// ── BARBER APP — amadobarber.vercel.app ────────────────────────────────────
function BarberAppRoutes() {
  return (
    <Routes>
      <Route path="/"                          element={<Navigate to="/barber/login" replace />} />
      <Route path="/barber/login"              element={<BarberLoginPage />} />
      <Route path="/barber/signup"             element={<BarberSignupPage />} />
      <Route path="/barber/forgot-password"    element={<ForgotPasswordPage role="barber" />} />
      <Route path="/barber/dashboard"          element={<BarberRoute><BarberDashboard /></BarberRoute>} />
      <Route path="/barber/calendar"           element={<BarberRoute><BarberCalendar /></BarberRoute>} />
      <Route path="/barber/appointments"       element={<BarberRoute><BarberAppointments /></BarberRoute>} />
      <Route path="/barber/clients"            element={<BarberRoute><BarberClientList /></BarberRoute>} />
      <Route path="/barber/clients/:clientKey" element={<BarberRoute><BarberClientDetail /></BarberRoute>} />
      <Route path="/barber/services"           element={<BarberRoute><BarberServices /></BarberRoute>} />
      <Route path="/barber/services/add"       element={<BarberRoute><AddEditService /></BarberRoute>} />
      <Route path="/barber/services/edit"      element={<BarberRoute><AddEditService /></BarberRoute>} />
      <Route path="/barber/availability"       element={<BarberRoute><BarberAvailability /></BarberRoute>} />
      <Route path="/barber/reports"            element={<BarberRoute><BarberReports /></BarberRoute>} />
      <Route path="/barber/reports/detail"     element={<BarberRoute><BarberReportDetail /></BarberRoute>} />
      <Route path="/barber/broadcast"          element={<BarberRoute><BarberBroadcast /></BarberRoute>} />
      <Route path="/barber/profile"            element={<BarberRoute><BarberProfile /></BarberRoute>} />
      <Route path="/barber/settings"           element={<BarberRoute><BarberSettings /></BarberRoute>} />
      <Route path="*"                          element={<Navigate to="/barber/login" replace />} />
    </Routes>
  )
}

// ── CLIENT APP — amadobook.vercel.app ──────────────────────────────────────
function ClientAppRoutes() {
  return (
    <Routes>
      <Route path="/"                 element={<SplashPage />} />
      <Route path="/login"            element={<ClientLoginPage />} />
      <Route path="/register"         element={<ClientRegisterPage />} />
      <Route path="/forgot-password"  element={<ForgotPasswordPage role="client" />} />
      <Route path="/book"             element={<BookingPage />} />
      <Route path="/confirmed"        element={<BookingConfirmedPage />} />
      <Route path="/dashboard"        element={<ClientRoute><ClientDashboard /></ClientRoute>} />
      <Route path="/appointments"     element={<ClientRoute><MyAppointmentsPage /></ClientRoute>} />
      <Route path="/history"          element={<ClientRoute><HistoryPage /></ClientRoute>} />
      <Route path="/portfolio"        element={<ClientRoute><PortfolioPage /></ClientRoute>} />
      <Route path="/referrals"        element={<ClientRoute><ReferralsPage /></ClientRoute>} />
      <Route path="/profile"          element={<ClientRoute><ClientProfilePage /></ClientRoute>} />
      {/* Legacy slug redirects */}
      <Route path="/b/:s"              element={<Navigate to="/" replace />} />
      <Route path="/b/:s/login"        element={<Navigate to="/login" replace />} />
      <Route path="/b/:s/register"     element={<Navigate to="/register" replace />} />
      <Route path="/b/:s/book"         element={<Navigate to="/book" replace />} />
      <Route path="/b/:s/confirmed"    element={<Navigate to="/confirmed" replace />} />
      <Route path="/b/:s/dashboard"    element={<Navigate to="/dashboard" replace />} />
      <Route path="/b/:s/appointments" element={<Navigate to="/appointments" replace />} />
      <Route path="/b/:s/history"      element={<Navigate to="/history" replace />} />
      <Route path="/b/:s/portfolio"    element={<Navigate to="/portfolio" replace />} />
      <Route path="/b/:s/referrals"    element={<Navigate to="/referrals" replace />} />
      <Route path="/b/:s/profile"      element={<Navigate to="/profile" replace />} />
      <Route path="*"                  element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function AppRoutes() {
  return (
    <>
      <ThemeSync />
      {APP_MODE === 'barber' ? <BarberAppRoutes /> : <ClientAppRoutes />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <BarberAuthProvider>
          <ClientAuthProvider>
            <Toaster position="top-center" toastOptions={{
              style: { background:'#1a1a1a', color:'#F5F5F5', border:'1px solid #2a2a2a', borderRadius:'12px', fontSize:'14px', fontFamily:"'DM Sans',system-ui,sans-serif" },
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