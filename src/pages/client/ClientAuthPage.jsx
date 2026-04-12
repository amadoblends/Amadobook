/**
 * ClientAuthPage
 * - Input components defined OUTSIDE to prevent keyboard closing on re-render
 * - Single screen: tab toggle between Log In / Create Account
 * - After success → dashboard directly
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'

const F = { fontFamily:'Monda,system-ui,sans-serif' }

// ── Stable field — defined OUTSIDE parent so it never re-mounts on keystroke ──
function Field({ label, type, value, onChange, placeholder, right }) {
  return (
    <div>
      <p style={{ fontSize:10, fontWeight:700, color:'#888', letterSpacing:'0.1em', marginBottom:8 }}>{label}</p>
      <div style={{ display:'flex', alignItems:'center', borderBottom:'1.5px solid #252525', paddingBottom:10 }}>
        <input
          type={type || 'text'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'off'}
          style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:16, fontFamily:'Monda,sans-serif' }}
        />
        {right}
      </div>
    </div>
  )
}

// ── Login form — isolated component ────────────────────────────────────────
function LoginForm({ onSuccess, onSwitchMode, onGuest, barberSlug }) {
  const { signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [busy, setBusy]         = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!email.trim() || !password) return toast.error('Enter email and password')
    setBusy(true)
    try { await signIn(email.trim(), password); onSuccess() }
    catch { toast.error('Invalid email or password') }
    finally { setBusy(false) }
  }

  async function google() {
    setBusy(true)
    try { await signInWithGoogle('client'); onSuccess() }
    catch { toast.error('Google sign-in failed') }
    finally { setBusy(false) }
  }

  const PwEye = (
    <button type="button" onClick={() => setShowPw(v => !v)}
      style={{ background:'none', border:'none', color:'#555', cursor:'pointer', padding:0, flexShrink:0 }}>
      {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
    </button>
  )

  return (
    <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <h2 style={{ fontFamily:'Monda,sans-serif', fontWeight:900, color:'#fff', fontSize:22, margin:'0 0 4px' }}>Welcome back 👋</h2>
      <Field label="EMAIL" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com"/>
      <Field label="PASSWORD" type={showPw?'text':'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" right={PwEye}/>
      <button type="submit" disabled={busy} style={btnStyle(busy)}>
        {busy && <Spin/>} {busy?'Signing in…':'Log In'}
      </button>
      <Divider/>
      <button type="button" onClick={google} disabled={busy} style={googleStyle}>
        <img src="https://www.google.com/favicon.ico" style={{width:18,height:18}} alt=""/>
        Continue with Google
      </button>
      <p style={{ textAlign:'center', color:'#555', fontSize:13, margin:0 }}>
        No account?{' '}
        <button type="button" onClick={onSwitchMode} style={{ color:'#FF5C00', fontWeight:700, background:'none', border:'none', cursor:'pointer', ...F }}>Create Account</button>
      </p>
      <p style={{ textAlign:'center', margin:0 }}>
        <button type="button" onClick={onGuest} style={{ color:'#444', fontSize:12, background:'none', border:'none', cursor:'pointer', ...F }}>
          Skip — Continue as guest →
        </button>
      </p>
    </form>
  )
}

// ── Signup form — isolated component ───────────────────────────────────────
function SignupForm({ onSuccess, onSwitchMode, onGuest }) {
  const { signUpClient, signInWithGoogle } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [busy,      setBusy]      = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!firstName||!lastName||!email||!password||!confirm) return toast.error('Fill in all required fields')
    if (password !== confirm) return toast.error('Passwords do not match')
    if (password.length < 6)  return toast.error('Password must be at least 6 characters')
    setBusy(true)
    try { await signUpClient({ firstName:firstName.trim(), lastName:lastName.trim(), email:email.trim(), phone:phone.trim(), password }); toast.success('Account created! 🎉'); onSuccess() }
    catch(err) { toast.error(err.code==='auth/email-already-in-use'?'Email already in use':err.message) }
    finally { setBusy(false) }
  }

  async function google() {
    setBusy(true)
    try { await signInWithGoogle('client'); onSuccess() }
    catch { toast.error('Google sign-in failed') }
    finally { setBusy(false) }
  }

  const PwEye = (
    <button type="button" onClick={() => setShowPw(v => !v)}
      style={{ background:'none', border:'none', color:'#555', cursor:'pointer', padding:0, flexShrink:0 }}>
      {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
    </button>
  )

  return (
    <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <h2 style={{ fontFamily:'Monda,sans-serif', fontWeight:900, color:'#fff', fontSize:22, margin:'0 0 4px' }}>Create account ✨</h2>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Field label="FIRST NAME *" value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Angelo"/>
        <Field label="LAST NAME *"  value={lastName}  onChange={e=>setLastName(e.target.value)}  placeholder="Ferreras"/>
      </div>
      <Field label="PHONE"        type="tel"      value={phone}    onChange={e=>setPhone(e.target.value)}    placeholder="(315) 000-0000"/>
      <Field label="EMAIL *"      type="email"    value={email}    onChange={e=>setEmail(e.target.value)}    placeholder="you@email.com"/>
      <Field label="PASSWORD *"   type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min. 6 characters" right={PwEye}/>
      <Field label="CONFIRM *"    type="password" value={confirm}  onChange={e=>setConfirm(e.target.value)}  placeholder="••••••••"/>
      <button type="submit" disabled={busy} style={{...btnStyle(busy),marginTop:4}}>
        {busy && <Spin/>} {busy?'Creating…':'Create Account'}
      </button>
      <Divider/>
      <button type="button" onClick={google} disabled={busy} style={googleStyle}>
        <img src="https://www.google.com/favicon.ico" style={{width:18,height:18}} alt=""/>
        Continue with Google
      </button>
      <p style={{ textAlign:'center', color:'#555', fontSize:13, margin:0 }}>
        Have an account?{' '}
        <button type="button" onClick={onSwitchMode} style={{ color:'#FF5C00', fontWeight:700, background:'none', border:'none', cursor:'pointer', ...F }}>Log In</button>
      </p>
      <p style={{ textAlign:'center', margin:0 }}>
        <button type="button" onClick={onGuest} style={{ color:'#444', fontSize:12, background:'none', border:'none', cursor:'pointer', ...F }}>
          Skip — Continue as guest →
        </button>
      </p>
    </form>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ClientAuthPage() {
  const { barberSlug } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, userData, loading: authLoading } = useAuth()
  const [mode, setMode] = useState(params.get('mode') === 'signup' ? 'signup' : 'login')

  // Already logged in → go straight to dashboard
  useEffect(() => {
    if (!authLoading && user && userData?.role === 'client') {
      navigate(`/b/${barberSlug}/dashboard`, { replace:true })
    }
  }, [authLoading, user, userData])

  if (authLoading) return <Spinner/>

  function goToDashboard() { navigate(`/b/${barberSlug}/dashboard`, { replace:true }) }
  function goToGuest()     { navigate(`/b/${barberSlug}/book`) }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', display:'flex', flexDirection:'column', ...F }}>
      {/* Static header */}
      <div style={{ background:'linear-gradient(160deg,#0d0500,#3d1500 55%,#FF5C00)', position:'relative', overflow:'hidden', flexShrink:0 }}>
        <div style={{ position:'absolute', inset:0, opacity:0.08, backgroundImage:'radial-gradient(circle,#FF5C00 1px,transparent 1px)', backgroundSize:'22px 22px' }}/>
        <button onClick={() => navigate(`/b/${barberSlug}`)}
          style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:6, background:'rgba(0,0,0,0.25)', border:'none', borderRadius:10, padding:'8px 14px', color:'white', cursor:'pointer', margin:'16px 16px 0', fontSize:13, fontWeight:700, ...F }}>
          <ArrowLeft size={14}/> Back
        </button>
        <div style={{ position:'relative', zIndex:1, padding:'14px 24px 28px', textAlign:'center' }}>
          <p style={{ fontFamily:'Monda,sans-serif', fontWeight:900, color:'#fff', fontSize:20, margin:'0 0 2px' }}>AmadoBook</p>
          <p style={{ color:'rgba(255,255,255,0.45)', fontSize:12, margin:0 }}>Your barber, your schedule</p>
        </div>
        <svg viewBox="0 0 390 22" preserveAspectRatio="none" style={{ display:'block', height:22, width:'100%' }}>
          <path d="M0 0 Q195 32 390 0 L390 22 L0 22 Z" fill="#0a0a0a"/>
        </svg>
      </div>

      <div style={{ flex:1, padding:'16px 24px 48px', maxWidth:440, margin:'0 auto', width:'100%', overflowY:'auto' }}>
        {/* Tab toggle */}
        <div style={{ display:'flex', background:'#141414', borderRadius:14, padding:4, marginBottom:24, border:'1px solid #252525' }}>
          {[['login','Log In'],['signup','Create Account']].map(([m,lbl]) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              style={{ flex:1, padding:'11px', borderRadius:11, fontWeight:700, fontSize:14, background:mode===m?'#fff':'transparent', color:mode===m?'#000':'#555', border:'none', cursor:'pointer', ...F, transition:'background 0.15s, color 0.15s' }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Forms — each is a stable isolated component */}
        {mode === 'login'
          ? <LoginForm  onSuccess={goToDashboard} onSwitchMode={() => setMode('signup')} onGuest={goToGuest} barberSlug={barberSlug}/>
          : <SignupForm onSuccess={goToDashboard} onSwitchMode={() => setMode('login')}  onGuest={goToGuest}/>
        }
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Shared helpers ─────────────────────────────────────────────────────────
const btnStyle = busy => ({
  width:'100%', background:'linear-gradient(135deg,#FF5C00,#FF9000)', border:'none',
  borderRadius:16, padding:'17px', color:'#fff', fontWeight:700, fontSize:16,
  cursor:busy?'not-allowed':'pointer', display:'flex', alignItems:'center',
  justifyContent:'center', gap:8, boxShadow:'0 8px 24px rgba(255,92,0,0.35)',
  opacity:busy?0.7:1, fontFamily:'Monda,sans-serif',
})
const googleStyle = {
  width:'100%', background:'#141414', border:'1px solid #252525', borderRadius:14,
  padding:'15px', display:'flex', alignItems:'center', justifyContent:'center',
  gap:12, cursor:'pointer', color:'#E5E5E5', fontWeight:600, fontSize:15,
  fontFamily:'Monda,sans-serif',
}
const Spin = () => <div style={{ width:18, height:18, border:'2.5px solid white', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }}/>
const Spinner = () => (
  <div style={{ minHeight:'100vh', background:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center' }}>
    <div style={{ width:28, height:28, border:'3px solid #FF5C00', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
)
const Divider = () => (
  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
    <div style={{ flex:1, height:1, background:'#1a1a1a' }}/><span style={{ color:'#333', fontSize:12 }}>or</span><div style={{ flex:1, height:1, background:'#1a1a1a' }}/>
  </div>
)
