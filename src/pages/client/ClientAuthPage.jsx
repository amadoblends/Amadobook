/**
 * After any successful login/signup → navigate to /dashboard, NEVER back to landing.
 * Auth state persists via Firebase's browserLocalPersistence (set in firebase.js).
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'

const F = { fontFamily: 'Monda, system-ui, sans-serif' }
const STATIC = { bg: '#0a0a0a', surface: '#141414', border: '#252525', text: '#E5E5E5', muted: '#666', accent: '#FF5C00' }

export default function ClientAuthPage() {
  const { barberSlug } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, userData, loading: authLoading, signIn, signUpClient, signInWithGoogle } = useAuth()

  const [mode, setMode]     = useState(params.get('mode') === 'signup' ? 'signup' : 'login')
  const [busy, setBusy]     = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [phone, setPhone]         = useState('')

  // Already logged in → go to dashboard, not landing
  useEffect(() => {
    if (!authLoading && user && userData?.role === 'client') {
      navigate(`/b/${barberSlug}/dashboard`, { replace: true })
    }
  }, [authLoading, user, userData])

  async function handleLogin(e) {
    e.preventDefault()
    if (!email.trim() || !password) return toast.error('Enter email and password')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      // Go directly to dashboard — no landing, no intermediate screen
      navigate(`/b/${barberSlug}/dashboard`, { replace: true })
    } catch {
      toast.error('Invalid email or password')
    } finally { setBusy(false) }
  }

  async function handleSignup(e) {
    e.preventDefault()
    if (!firstName || !lastName || !email || !password || !confirm) return toast.error('Fill in all required fields')
    if (password !== confirm) return toast.error('Passwords do not match')
    if (password.length < 6) return toast.error('Password must be at least 6 characters')
    setBusy(true)
    try {
      await signUpClient({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim(), password })
      toast.success('Account created! 🎉')
      navigate(`/b/${barberSlug}/dashboard`, { replace: true })
    } catch (err) {
      toast.error(err.code === 'auth/email-already-in-use' ? 'Email already in use' : err.message)
    } finally { setBusy(false) }
  }

  async function handleGoogle() {
    setBusy(true)
    try {
      await signInWithGoogle('client')
      navigate(`/b/${barberSlug}/dashboard`, { replace: true })
    } catch { toast.error('Google sign-in failed') }
    finally { setBusy(false) }
  }

  if (authLoading) return <Spinner />

  const Input = ({ label, type = 'text', value, onChange, placeholder, right }) => (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, color: STATIC.muted, letterSpacing: '0.1em', marginBottom: 8 }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1.5px solid ${STATIC.border}`, paddingBottom: 10 }}>
        <input type={type} value={value} onChange={onChange} placeholder={placeholder}
          autoCapitalize="off" autoCorrect="off"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: STATIC.text, fontSize: 16, ...F }} />
        {right}
      </div>
    </div>
  )

  const PwToggle = (
    <button type="button" onClick={() => setShowPw(v => !v)}
      style={{ background: 'none', border: 'none', color: STATIC.muted, cursor: 'pointer', padding: 0, flexShrink: 0 }}>
      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', background: STATIC.bg, display: 'flex', flexDirection: 'column', ...F }}>
      {/* Static header — never uses theme vars */}
      <div style={{ background: 'linear-gradient(160deg,#0d0500,#3d1500 55%,#FF5C00)', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'radial-gradient(circle,#FF5C00 1px,transparent 1px)', backgroundSize: '22px 22px' }} />
        <button onClick={() => navigate(`/b/${barberSlug}`)}
          style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.25)', border: 'none', borderRadius: 10, padding: '8px 14px', color: 'white', cursor: 'pointer', margin: '16px 16px 0', fontSize: 13, fontWeight: 700, ...F }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ position: 'relative', zIndex: 1, padding: '14px 24px 28px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, color: '#fff', fontSize: 20, margin: '0 0 2px' }}>AmadoBook</p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0 }}>Your barber, your schedule</p>
        </div>
        <svg viewBox="0 0 390 22" preserveAspectRatio="none" style={{ display: 'block', height: 22, width: '100%' }}>
          <path d="M0 0 Q195 32 390 0 L390 22 L0 22 Z" fill={STATIC.bg} />
        </svg>
      </div>

      <div style={{ flex: 1, padding: '16px 24px 48px', maxWidth: 440, margin: '0 auto', width: '100%', overflowY: 'auto' }}>
        {/* Tab toggle */}
        <div style={{ display: 'flex', background: STATIC.surface, borderRadius: 14, padding: 4, marginBottom: 24, border: `1px solid ${STATIC.border}` }}>
          {[['login', 'Log In'], ['signup', 'Create Account']].map(([m, lbl]) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex: 1, padding: '11px', borderRadius: 11, fontWeight: 700, fontSize: 14, background: mode === m ? '#fff' : 'transparent', color: mode === m ? '#000' : STATIC.muted, border: 'none', cursor: 'pointer', ...F, transition: 'background 0.15s, color 0.15s' }}>
              {lbl}
            </button>
          ))}
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, color: '#fff', fontSize: 22, margin: '0 0 4px' }}>Welcome back 👋</h2>
            <Input label="EMAIL" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
            <Input label="PASSWORD" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" right={PwToggle} />
            <button type="submit" disabled={busy} style={btnStyle(busy)}>
              {busy && <Spin />} {busy ? 'Signing in…' : 'Log In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, color: '#fff', fontSize: 22, margin: '0 0 4px' }}>Create account ✨</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Input label="FIRST NAME *" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Angelo" />
              <Input label="LAST NAME *"  value={lastName}  onChange={e => setLastName(e.target.value)}  placeholder="Ferreras" />
            </div>
            <Input label="PHONE" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(315) 000-0000" />
            <Input label="EMAIL *" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
            <Input label="PASSWORD *" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" right={PwToggle} />
            <Input label="CONFIRM PASSWORD *" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" />
            <button type="submit" disabled={busy} style={{ ...btnStyle(busy), marginTop: 4 }}>
              {busy && <Spin />} {busy ? 'Creating…' : 'Create Account'}
            </button>
          </form>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
          <span style={{ color: '#333', fontSize: 12 }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
        </div>

        <button onClick={handleGoogle} disabled={busy}
          style={{ width: '100%', background: STATIC.surface, border: `1px solid ${STATIC.border}`, borderRadius: 14, padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', color: STATIC.text, fontWeight: 600, fontSize: 15, ...F, marginBottom: 20 }}>
          <img src="https://www.google.com/favicon.ico" style={{ width: 18, height: 18 }} alt="" />
          Continue with Google
        </button>

        <p style={{ textAlign: 'center', color: STATIC.muted, fontSize: 13, margin: 0 }}>
          {mode === 'login' ? "No account? " : "Have an account? "}
          <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            style={{ color: STATIC.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', ...F }}>
            {mode === 'login' ? 'Create Account' : 'Log In'}
          </button>
        </p>
        <p style={{ textAlign: 'center', margin: '10px 0 0' }}>
          <button onClick={() => navigate(`/b/${barberSlug}/book`)}
            style={{ color: '#333', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', ...F }}>
            Skip — Continue as guest →
          </button>
        </p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const btnStyle = busy => ({
  width: '100%', background: 'linear-gradient(135deg,#FF5C00,#FF9000)', border: 'none',
  borderRadius: 16, padding: '17px', color: '#fff', fontWeight: 700, fontSize: 16,
  cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', gap: 8, boxShadow: '0 8px 24px rgba(255,92,0,0.35)',
  opacity: busy ? 0.7 : 1, fontFamily: 'Monda, sans-serif',
})

const Spin = () => <div style={{ width: 18, height: 18, border: '2.5px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
const Spinner = () => (
  <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 28, height: 28, border: '3px solid #FF5C00', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
)
