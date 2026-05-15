import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { lazy, Suspense, useEffect } from 'react'

import { BarberAuthProvider } from './context/BarberAuthContext'
import { ClientAuthProvider } from './context/ClientAuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { useBarberAuth } from './hooks/useBarberAuth'
import { useClientAuth } from './hooks/useClientAuth'
import { BarberDataProvider } from './hooks/useBarberData'

export const BARBER_SLUG = 'amadoblends'
const APP_MODE = import.meta.env.VITE_APP_MODE || 'client'

function PageLoader() {
  return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0D0D0D' }}>
      <div style={{ width:24, height:24, border:'2.5px solid #2A2A2A', borderTopColor:'#FF6B1A', borderRadius:'50%', animation:'spin 0.65s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Lazy — BARBER ─────────────────────────────────────────────────────────
const BarberLoginPage    = lazy(() => import('./pages/auth/BarberLoginPage'))
const BarberSignupPage   = lazy(() => import('./pages/auth/BarberSignupPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const BarberDashboard    = lazy(() => import('./pages/barber/BarberDashboard'))
const BarberCalendar     = lazy(() => import('./pages/barber/BarberCalendar'))
const BarberServices     = lazy(() => import('./pages/barber/BarberServices'))
const BarberAvailability = lazy(() => import('./pages/barber/BarberAvailability'))
const BarberReports      = lazy(() => import('./pages/barber/BarberReports'))
const BarberBroadcast    = lazy(() => import('./pages/barber/BarberBroadcast'))
const BarberAppointments = lazy(() => import('./pages/barber/BarberAppointments'))
const BarberClientList   = lazy(() => import('./pages/barber/BarberClientList'))
const BarberClientDetail = lazy(() => import('./pages/barber/BarberClientDetail'))
const BarberReportDetail = lazy(() => import('./pages/barber/BarberReportDetail'))
const AddEditService     = lazy(() => import('./pages/barber/AddEditService'))
const BarberSettings     = lazy(() => import('./pages/barber/BarberSettings'))
const BarberProfilePage  = lazy(() => import('./pages/barber/BarberProfile').then(m => ({ default: m.BarberProfile || m.default })))

// ── Lazy — CLIENT ─────────────────────────────────────────────────────────
const SplashPage           = lazy(() => import('./pages/client/SplashPage'))
const ClientLoginPage      = lazy(() => import('./pages/client/ClientLoginPage'))
const ClientRegisterPage   = lazy(() => import('./pages/client/ClientRegisterPage'))
const BookingPage          = lazy(() => import('./pages/client/BookingPage'))
const BookingConfirmedPage = lazy(() => import('./pages/client/BookingConfirmedPage'))
const ClientDashboard      = lazy(() => import('./pages/client/ClientDashboard'))
const MyAppointmentsPage   = lazy(() => import('./pages/client/MyAppointmentsPage').then(m => ({ default: m.MyAppointmentsPage || m.default })))
const HistoryPage          = lazy(() => import('./pages/client/HistoryPage').then(m => ({ default: m.HistoryPage || m.default })))
const PortfolioPage        = lazy(() => import('./pages/client/PortfolioPage').then(m => ({ default: m.PortfolioPage || m.default })))
const ReferralsPage        = lazy(() => import('./pages/client/ReferralsPage').then(m => ({ default: m.ReferralsPage || m.default })))
const ClientProfilePage    = lazy(() => import('./pages/client/ClientProfilePage').then(m => ({ default: m.ClientProfilePage || m.default })))

const TOAST = {
  position: 'top-center',
  toastOptions: {
    style: { background:'#1a1a1a', color:'#F5F5F5', border:'1px solid #2a2a2a', borderRadius:'12px', fontSize:'13px', fontFamily:"'DM Sans',system-ui,sans-serif" },
    success: { iconTheme: { primary:'#22C55E', secondary:'#fff' } },
    error:   { iconTheme: { primary:'#EF4444', secondary:'#fff' } },
  }
}

// ── Guards ────────────────────────────────────────────────────────────────
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

// ── Theme sync ────────────────────────────────────────────────────────────
function BarberThemeSync() {
  const { user, userData } = useBarberAuth()
  const { loadPrefs, resetToDefaults, setRole } = useTheme()
  useEffect(() => {
    if (user && userData?.role === 'barber') { setRole('barber'); loadPrefs(user.uid, 'barber') }
    else resetToDefaults()
  }, [user?.uid])
  return null
}

function ClientThemeSync() {
  const { user } = useClientAuth()
  const { loadPrefs, resetToDefaults, setRole } = useTheme()
  useEffect(() => {
    if (user) { setRole('client'); loadPrefs(user.uid, 'client') }
    else resetToDefaults()
  }, [user?.uid])
  return null
}

// ══════════════════════════════════════════════════════════════════════════
// BARBER APP — amadobarber.vercel.app
// ✅ FIX: All routes flat (no nested Routes) — BarberDataProvider wraps all
// ══════════════════════════════════════════════════════════════════════════
function BarberApp() {
  return (
    <BarberAuthProvider>
      <ThemeProvider>
        <BarberThemeSync />
        <Toaster {...TOAST} />
        <BarberDataProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public */}
              <Route path="/"                          element={<Navigate to="/barber/login" replace />} />
              <Route path="/barber/login"              element={<BarberLoginPage />} />
              <Route path="/barber/signup"             element={<BarberSignupPage />} />
              <Route path="/barber/forgot-password"    element={<ForgotPasswordPage />} />

              {/* Protected — all use BarberDataProvider above */}
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
              <Route path="/barber/profile"            element={<BarberRoute><BarberProfilePage /></BarberRoute>} />
              <Route path="/barber/settings"           element={<BarberRoute><BarberSettings /></BarberRoute>} />

              <Route path="*"                          element={<Navigate to="/barber/login" replace />} />
            </Routes>
          </Suspense>
        </BarberDataProvider>
      </ThemeProvider>
    </BarberAuthProvider>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// CLIENT APP — amadobook.vercel.app
// ══════════════════════════════════════════════════════════════════════════
function ClientApp() {
  return (
    <ClientAuthProvider>
      <ThemeProvider>
        <ClientThemeSync />
        <Toaster {...TOAST} />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"                  element={<SplashPage />} />
            <Route path="/login"             element={<ClientLoginPage />} />
            <Route path="/register"          element={<ClientRegisterPage />} />
            <Route path="/forgot-password"   element={<ForgotPasswordPage />} />
            <Route path="/book"              element={<BookingPage />} />
            <Route path="/confirmed"         element={<BookingConfirmedPage />} />
            <Route path="/dashboard"         element={<ClientRoute><ClientDashboard /></ClientRoute>} />
            <Route path="/appointments"      element={<ClientRoute><MyAppointmentsPage /></ClientRoute>} />
            <Route path="/history"           element={<ClientRoute><HistoryPage /></ClientRoute>} />
            <Route path="/portfolio"         element={<ClientRoute><PortfolioPage /></ClientRoute>} />
            <Route path="/referrals"         element={<ClientRoute><ReferralsPage /></ClientRoute>} />
            <Route path="/profile"           element={<ClientRoute><ClientProfilePage /></ClientRoute>} />
            <Route path="/b/:s"              element={<Navigate to="/" replace />} />
            <Route path="/b/:s/*"            element={<Navigate to="/" replace />} />
            <Route path="*"                  element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ThemeProvider>
    </ClientAuthProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      {APP_MODE === 'barber' ? <BarberApp /> : <ClientApp />}
    </BrowserRouter>
  )
}