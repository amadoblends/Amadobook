import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'

import { BarberAuthProvider } from './context/BarberAuthContext'
import { ClientAuthProvider } from './context/ClientAuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { useBarberAuth } from './hooks/useBarberAuth'
import { useClientAuth } from './hooks/useClientAuth'
import { PageLoader } from './components/ui/Spinner'

// ── BARBER AUTH ────────────────────────────────────────────────────────────
import BarberLoginPage    from './pages/auth/BarberLoginPage'
import BarberSignupPage   from './pages/auth/BarberSignupPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'

// ── BARBER PAGES ───────────────────────────────────────────────────────────
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

// ── CLIENT PAGES ───────────────────────────────────────────────────────────
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

// ── Guards ─────────────────────────────────────────────────────────────────
function BarberRoute({ children }) {
  const { user, userData, loading } = useBarberAuth()
  if (loading) return <PageLoader />
  if (!user || userData?.role !== 'barber') return <Navigate to="/barber/login" replace />
  return children
}

// ── Routes ─────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <>
      <ThemeSync />
      <Routes>

        {/* ═══ BARBER AUTH ══════════════════════════════════════════════ */}
        <Route path="/barber/login"           element={<BarberLoginPage />} />
        <Route path="/barber/signup"          element={<BarberSignupPage />} />
        <Route path="/barber/forgot-password" element={<ForgotPasswordPage role="barber" />} />

        {/* ═══ BARBER PAGES (protected) ════════════════════════════════ */}
        <Route path="/barber/dashboard"       element={<BarberRoute><BarberDashboard /></BarberRoute>} />
        <Route path="/barber/calendar"        element={<BarberRoute><BarberCalendar /></BarberRoute>} />
        <Route path="/barber/appointments"    element={<BarberRoute><BarberAppointments /></BarberRoute>} />
        <Route path="/barber/clients"         element={<BarberRoute><BarberClientList /></BarberRoute>} />
        <Route path="/barber/clients/:clientKey" element={<BarberRoute><BarberClientDetail /></BarberRoute>} />
        <Route path="/barber/services"        element={<BarberRoute><BarberServices /></BarberRoute>} />
        <Route path="/barber/services/add"    element={<BarberRoute><AddEditService /></BarberRoute>} />
        <Route path="/barber/services/edit"   element={<BarberRoute><AddEditService /></BarberRoute>} />
        <Route path="/barber/availability"    element={<BarberRoute><BarberAvailability /></BarberRoute>} />
        <Route path="/barber/reports"         element={<BarberRoute><BarberReports /></BarberRoute>} />
        <Route path="/barber/reports/detail"  element={<BarberRoute><BarberReportDetail /></BarberRoute>} />
        <Route path="/barber/broadcast"       element={<BarberRoute><BarberBroadcast /></BarberRoute>} />
        <Route path="/barber/profile"         element={<BarberRoute><BarberProfile /></BarberRoute>} />
        <Route path="/barber/settings"        element={<BarberRoute><BarberSettings /></BarberRoute>} />

        {/* ═══ CLIENT PAGES ════════════════════════════════════════════ */}
        <Route path="/b/:barberSlug"                 element={<SplashPage />} />
        <Route path="/b/:barberSlug/login"           element={<ClientLoginPage />} />
        <Route path="/b/:barberSlug/register"        element={<ClientRegisterPage />} />
        <Route path="/b/:barberSlug/forgot-password" element={<ForgotPasswordPage role="client" />} />
        <Route path="/b/:barberSlug/book"            element={<BookingPage />} />
        <Route path="/b/:barberSlug/confirmed"       element={<BookingConfirmedPage />} />
        <Route path="/b/:barberSlug/dashboard"       element={<ClientDashboard />} />
        <Route path="/b/:barberSlug/appointments"    element={<MyAppointmentsPage />} />
        <Route path="/b/:barberSlug/history"         element={<HistoryPage />} />
        <Route path="/b/:barberSlug/portfolio"       element={<PortfolioPage />} />
        <Route path="/b/:barberSlug/referrals"       element={<ReferralsPage />} />
        <Route path="/b/:barberSlug/profile"         element={<ClientProfilePage />} />

        {/* ═══ FALLBACKS ════════════════════════════════════════════════ */}
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
        <BarberAuthProvider>
          <ClientAuthProvider>
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  background: '#1a1a1a', color: '#F5F5F5',
                  border: '1px solid #2a2a2a', borderRadius: '12px',
                  fontSize: '14px', fontFamily: "'Monda',system-ui,sans-serif",
                },
                success: { iconTheme: { primary: '#22C55E', secondary: '#fff' } },
                error:   { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
              }}
            />
            <AppRoutes />
          </ClientAuthProvider>
        </BarberAuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}