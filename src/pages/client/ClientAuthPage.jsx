/**
 * ClientAuthPage — Black/White minimal design
 * Top: black + geometric pattern + logo
 * Bottom: white card with form
 * Screens: welcome | login | signup | guest
 * Colors LOCKED — no theme dependency
 */
import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useClientAuth as useAuth } from "../../hooks/useClientAuth"
import { signInAnonymously } from "firebase/auth"
import { auth, db } from "../../lib/firebase"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"

// ── Colors (locked, no theme) ─────────────────────────────────────────────
const C = {
  black:   '#0A0A0A',
  white:   '#FFFFFF',
  gray:    '#6B6B6B',
  grayL:   '#D4D4D4',
  grayXL:  '#F5F5F5',
  border:  '#E5E5E5',
  red:     '#EF4444',
  redL:    '#FEE2E2',
}

// ── Geometric pattern (CSS) ───────────────────────────────────────────────
const PATTERN = `
  repeating-linear-gradient(
    45deg,
    transparent,
    transparent 14px,
    rgba(255,255,255,0.04) 14px,
    rgba(255,255,255,0.04) 15px
  ),
  repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 14px,
    rgba(255,255,255,0.04) 14px,
    rgba(255,255,255,0.04) 15px
  )
`

// ── Global styles ─────────────────────────────────────────────────────────
const CSS = `
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .auth-slide { animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
  .auth-fade  { animation: fadeIn 0.3s ease both; }

  .f-input {
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1.5px solid #E5E5E5;
    color: #0A0A0A;
    padding: 12px 0 10px;
    font-size: 15px;
    outline: none;
    transition: border-color 0.2s;
    caret-color: #0A0A0A;
    font-family: inherit;
    box-sizing: border-box;
  }
  .f-input:focus { border-bottom-color: #0A0A0A; }
  .f-input::placeholder { color: #C4C4C4; font-size: 14px; }

  .f-label {
    display: block;
    font-size: 10px;
    color: #9A9A9A;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    margin-bottom: 1px;
    font-family: inherit;
  }
  .f-field { margin-bottom: 22px; }

  .btn-black {
    width: 100%;
    background: #0A0A0A;
    color: #FFFFFF;
    border: none;
    border-radius: 14px;
    padding: 16px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    letter-spacing: 0.01em;
    transition: opacity 0.15s, transform 0.1s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .btn-black:hover { opacity: 0.88; }
  .btn-black:active { transform: scale(0.985); }
  .btn-black:disabled { opacity: 0.45; cursor: not-allowed; }

  .btn-outline {
    width: 100%;
    background: transparent;
    color: #0A0A0A;
    border: 1.5px solid #E0E0E0;
    border-radius: 14px;
    padding: 15px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: background 0.15s, border-color 0.15s;
  }
  .btn-outline:hover { background: #F5F5F5; border-color: #CCC; }
  .btn-outline:disabled { opacity: 0.45; cursor: not-allowed; }

  .btn-text {
    background: none; border: none;
    color: #6B6B6B; font-size: 13px;
    cursor: pointer; font-family: inherit;
    padding: 0; display: inline;
  }
  .btn-text:hover { color: #0A0A0A; }

  .err-msg {
    background: #FEE2E2;
    border: 1px solid #FECACA;
    border-radius: 10px;
    padding: 11px 14px;
    color: #DC2626;
    font-size: 13px;
    margin-bottom: 20px;
    line-height: 1.5;
  }

  .name-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 22px;
  }

  .divider-row {
    display: flex; align-items: center; gap: 12px; margin: 16px 0;
  }
  .divider-line { flex: 1; height: 1px; background: #EBEBEB; }
  .divider-txt { color: #BBBBBB; font-size: 12px; }
`

// ── Icons ─────────────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20">
    <path d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.39a4.6 4.6 0 01-2 3.02v2.5h3.24c1.9-1.75 3-4.32 3-7.31z" fill="#4285F4"/>
    <path d="M10 20c2.7 0 4.97-.9 6.62-2.46l-3.24-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.75-5.59-4.1H1.07v2.58A10 10 0 0010 20z" fill="#34A853"/>
    <path d="M4.41 11.9A6.01 6.01 0 014.1 10c0-.66.11-1.3.31-1.9V5.52H1.07A10 10 0 000 10c0 1.61.38 3.14 1.07 4.48l3.34-2.58z" fill="#FBBC04"/>
    <path d="M10 3.96c1.47 0 2.79.5 3.82 1.5l2.86-2.86C14.96.99 12.7 0 10 0A10 10 0 001.07 5.52l3.34 2.58C5.2 5.71 7.4 3.96 10 3.96z" fill="#EA4335"/>
  </svg>
)

const ChevronLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6"/>
  </svg>
)

const Spinner = () => (
  <div style={{ width:18, height:18, border:'2.5px solid rgba(255,255,255,0.35)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>
)
// add spin to CSS above

// ── Layout shell ─────────────────────────────────────────────────────────
function Shell({ topContent, card }) {
  return (
    <div style={{ minHeight:'100dvh', background:C.black, display:'flex', flexDirection:'column', fontFamily:"'Monda', system-ui, sans-serif", overflowX:'hidden' }}>

      {/* Black top with pattern */}
      <div style={{ flexShrink:0, minHeight:'38vh', background:`${PATTERN}, ${C.black}`, position:'relative', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 20px 60px' }}>
        {topContent}
      </div>

      {/* White card */}
      <div style={{ flex:1, background:C.white, borderRadius:'28px 28px 0 0', marginTop:-28, padding:'28px 24px 48px', display:'flex', flexDirection:'column', maxWidth:480, width:'100%', alignSelf:'center', boxSizing:'border-box', overflowY:'auto' }}>
        {card}
      </div>

      <style>{CSS + `@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Logo (white SVG A logo, or PNG) ──────────────────────────────────────
function Logo({ size = 72 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:18, background:'rgba(255,255,255,0.10)', border:'1.5px solid rgba(255,255,255,0.18)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
      <img
        src="/logo.png"
        alt="AmadoBlends"
        onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}
        style={{ width:size*0.65, height:size*0.65, objectFit:'contain' }}
      />
      {/* Fallback SVG scissors */}
      <svg style={{ display:'none', width:size*0.45, height:size*0.45 }} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
        <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// WELCOME SCREEN
// ─────────────────────────────────────────────────────────────────────────
function WelcomeScreen({ onLogin, onSignup, onGuest, onGoogle, loading }) {
  return (
    <Shell
      topContent={
        <div className="auth-fade" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, width:'100%' }}>
          <Logo/>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:13, margin:0, letterSpacing:'0.04em' }}>AmadoBlends</p>
        </div>
      }
      card={
        <div className="auth-slide" style={{ display:'flex', flexDirection:'column', gap:0, width:'100%' }}>
          <h1 style={{ color:C.black, fontSize:28, fontWeight:800, margin:'0 0 6px', letterSpacing:'-0.4px' }}>Welcome</h1>
          <p style={{ color:C.gray, fontSize:14, margin:'0 0 28px' }}>Sign in to book your next cut</p>

          {/* Google — primary quick action */}
          <button className="btn-outline" onClick={onGoogle} disabled={loading} style={{ marginBottom:12 }}>
            <GoogleIcon/> Continue with Google
          </button>

          {/* Email login */}
          <button className="btn-black" onClick={onLogin} disabled={loading} style={{ marginBottom:12 }}>
            Login
          </button>

          {/* Sign up */}
          <button className="btn-outline" onClick={onSignup} disabled={loading} style={{ marginBottom:20 }}>
            Sign Up
          </button>

          <div className="divider-row">
            <div className="divider-line"/>
            <span className="divider-txt">or</span>
            <div className="divider-line"/>
          </div>

          {/* Guest */}
          <button className="btn-text" onClick={onGuest} disabled={loading}
            style={{ color:C.gray, fontSize:13, padding:'10px 0', width:'100%', textAlign:'center' }}>
            Continue as Guest
          </button>
        </div>
      }
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────
// LOGIN SCREEN
// ─────────────────────────────────────────────────────────────────────────
function LoginScreen({ onBack, onSuccess, onSwitchToSignup, onGoogle }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const { barberSlug } = useParams()
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(""); setLoading(true)
    try { await signIn(email, password); onSuccess() }
    catch { setError("Invalid email or password. Please try again.") }
    setLoading(false)
  }

  return (
    <Shell
      topContent={
        <div className="auth-fade" style={{ width:'100%', display:'flex', flexDirection:'column', alignItems:'flex-start', paddingTop:8 }}>
          <button onClick={onBack} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:10, padding:'8px 12px', color:'rgba(255,255,255,0.7)', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13, fontFamily:'inherit', marginBottom:20 }}>
            <ChevronLeft/> Back
          </button>
          <h1 style={{ color:C.white, fontSize:32, fontWeight:800, margin:0, letterSpacing:'-0.5px' }}>Login</h1>
        </div>
      }
      card={
        <div className="auth-slide">
          {error && <div className="err-msg">{error}</div>}

          <form onSubmit={submit}>
            <div className="f-field">
              <label className="f-label">Email</label>
              <input className="f-input" type="email" placeholder="your@email.com"
                value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/>
            </div>
            <div className="f-field" style={{ marginBottom:8 }}>
              <label className="f-label">Password</label>
              <input className="f-input" type="password" placeholder="••••••••"
                value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/>
            </div>

            {/* Forgot */}
            <div style={{ textAlign:'right', marginBottom:28 }}>
              <button type="button" onClick={()=>navigate(`/b/${barberSlug}/forgot-password`)}
                style={{ background:'none', border:'none', color:C.gray, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                Forgot password?
              </button>
            </div>

            <button className="btn-black" type="submit" disabled={loading}>
              {loading ? <Spinner/> : "Login"}
            </button>
          </form>

          <div className="divider-row" style={{ margin:'18px 0' }}>
            <div className="divider-line"/>
            <span className="divider-txt">or</span>
            <div className="divider-line"/>
          </div>

          <button className="btn-outline" onClick={onGoogle} disabled={loading}>
            <GoogleIcon/> Continue with Google
          </button>

          <p style={{ color:C.gray, fontSize:13, textAlign:'center', marginTop:24 }}>
            Don't have an account?{" "}
            <span onClick={onSwitchToSignup} style={{ color:C.black, fontWeight:700, cursor:'pointer' }}>Sign Up</span>
          </p>
        </div>
      }
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────
// SIGNUP SCREEN
// ─────────────────────────────────────────────────────────────────────────
function SignupScreen({ onBack, onSuccess, onSwitchToLogin }) {
  const { signUpClient } = useAuth()
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', password:'', confirm:'' })
  const [error, setError]   = useState("")
  const [loading, setLoading] = useState(false)

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) { setError("Please enter your full name."); return }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return }
    if (form.password !== form.confirm) { setError("Passwords don't match."); return }
    setError(""); setLoading(true)
    try {
      await signUpClient({ email:form.email, password:form.password, firstName:form.firstName.trim(), lastName:form.lastName.trim() })
      onSuccess()
    } catch(err) {
      setError(err.code === "auth/email-already-in-use" ? "Email already registered." : (err.message || "Could not create account."))
    }
    setLoading(false)
  }

  return (
    <Shell
      topContent={
        <div className="auth-fade" style={{ width:'100%', display:'flex', flexDirection:'column', alignItems:'flex-start', paddingTop:8 }}>
          <button onClick={onBack} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:10, padding:'8px 12px', color:'rgba(255,255,255,0.7)', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13, fontFamily:'inherit', marginBottom:20 }}>
            <ChevronLeft/> Back
          </button>
          <h1 style={{ color:C.white, fontSize:32, fontWeight:800, margin:0, letterSpacing:'-0.5px' }}>Sign Up</h1>
        </div>
      }
      card={
        <div className="auth-slide">
          {error && <div className="err-msg">{error}</div>}

          <form onSubmit={submit}>
            <div className="name-row">
              <div>
                <label className="f-label">First name</label>
                <input className="f-input" type="text" placeholder="Angelo"
                  value={form.firstName} onChange={set('firstName')} required autoComplete="given-name"/>
              </div>
              <div>
                <label className="f-label">Last name</label>
                <input className="f-input" type="text" placeholder="Ferreras"
                  value={form.lastName} onChange={set('lastName')} required autoComplete="family-name"/>
              </div>
            </div>

            <div className="f-field">
              <label className="f-label">Email</label>
              <input className="f-input" type="email" placeholder="your@email.com"
                value={form.email} onChange={set('email')} required autoComplete="email"/>
            </div>
            <div className="f-field">
              <label className="f-label">Password</label>
              <input className="f-input" type="password" placeholder="••••••••"
                value={form.password} onChange={set('password')} required autoComplete="new-password"/>
            </div>
            <div className="f-field" style={{ marginBottom:28 }}>
              <label className="f-label">Confirm password</label>
              <input className="f-input" type="password" placeholder="••••••••"
                value={form.confirm} onChange={set('confirm')} required autoComplete="new-password"/>
            </div>

            <button className="btn-black" type="submit" disabled={loading}>
              {loading ? <Spinner/> : "Sign Up"}
            </button>
          </form>

          <p style={{ color:C.gray, fontSize:13, textAlign:'center', marginTop:24 }}>
            Already have an account?{" "}
            <span onClick={onSwitchToLogin} style={{ color:C.black, fontWeight:700, cursor:'pointer' }}>Sign In</span>
          </p>
        </div>
      }
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────
// GUEST SCREEN — collects name + contact, then signs in anonymously
// ─────────────────────────────────────────────────────────────────────────
function GuestScreen({ onBack, onSuccess, barberSlug }) {
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'' })
  const [error, setError]   = useState("")
  const [loading, setLoading] = useState(false)

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) { setError("Please enter your full name."); return }
    if (!form.email.trim() && !form.phone.trim()) { setError("Enter at least an email or phone."); return }
    setError(""); setLoading(true)
    try {
      const cred = await signInAnonymously(auth)
      // Save guest info to Firestore so barber can see it
      await setDoc(doc(db,'users',cred.user.uid), {
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        email:     form.email.trim(),
        phone:     form.phone.trim(),
        role:      'client',
        isGuest:   true,
        createdAt: serverTimestamp(),
      }, { merge: true })
      onSuccess()
    } catch {
      setError("Could not continue. Please try again.")
    }
    setLoading(false)
  }

  return (
    <Shell
      topContent={
        <div className="auth-fade" style={{ width:'100%', display:'flex', flexDirection:'column', alignItems:'flex-start', paddingTop:8 }}>
          <button onClick={onBack} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:10, padding:'8px 12px', color:'rgba(255,255,255,0.7)', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13, fontFamily:'inherit', marginBottom:20 }}>
            <ChevronLeft/> Back
          </button>
          <h1 style={{ color:C.white, fontSize:32, fontWeight:800, margin:0, letterSpacing:'-0.5px' }}>Guest</h1>
          <p style={{ color:'rgba(255,255,255,0.45)', fontSize:14, margin:'6px 0 0' }}>No account needed</p>
        </div>
      }
      card={
        <div className="auth-slide">
          {error && <div className="err-msg">{error}</div>}

          <form onSubmit={submit}>
            <div className="name-row">
              <div>
                <label className="f-label">First name</label>
                <input className="f-input" type="text" placeholder="Angelo"
                  value={form.firstName} onChange={set('firstName')} required autoComplete="given-name"/>
              </div>
              <div>
                <label className="f-label">Last name</label>
                <input className="f-input" type="text" placeholder="Ferreras"
                  value={form.lastName} onChange={set('lastName')} required autoComplete="family-name"/>
              </div>
            </div>

            <div className="f-field">
              <label className="f-label">Email</label>
              <input className="f-input" type="email" placeholder="your@email.com (optional)"
                value={form.email} onChange={set('email')} autoComplete="email"/>
            </div>
            <div className="f-field" style={{ marginBottom:28 }}>
              <label className="f-label">Phone</label>
              <input className="f-input" type="tel" placeholder="(315) 000-0000 (optional)"
                value={form.phone} onChange={set('phone')} autoComplete="tel"/>
            </div>

            <button className="btn-black" type="submit" disabled={loading}>
              {loading ? <Spinner/> : "Continue as Guest"}
            </button>
          </form>

          <p style={{ color:C.grayL, fontSize:12, textAlign:'center', marginTop:18, lineHeight:1.6 }}>
            Your info is only used for this booking and won't create an account.
          </p>
        </div>
      }
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN — router between screens
// ─────────────────────────────────────────────────────────────────────────
export default function ClientAuthPage() {
  const [screen, setScreen] = useState("welcome") // welcome | login | signup | guest
  const [googleLoading, setGoogleLoading] = useState(false)

  const { signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const { barberSlug } = useParams()

  function onSuccess() {
    navigate(`/b/${barberSlug}/dashboard`, { replace: true })
  }
  function onGuestSuccess() {
    navigate(`/b/${barberSlug}/book`)
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    try { await signInWithGoogle("client"); onSuccess() }
    catch {}
    setGoogleLoading(false)
  }

  if (screen === "login") return (
    <LoginScreen
      onBack={() => setScreen("welcome")}
      onSuccess={onSuccess}
      onSwitchToSignup={() => setScreen("signup")}
      onGoogle={handleGoogle}
    />
  )
  if (screen === "signup") return (
    <SignupScreen
      onBack={() => setScreen("welcome")}
      onSuccess={onSuccess}
      onSwitchToLogin={() => setScreen("login")}
    />
  )
  if (screen === "guest") return (
    <GuestScreen
      onBack={() => setScreen("welcome")}
      onSuccess={onGuestSuccess}
      barberSlug={barberSlug}
    />
  )

  return (
    <WelcomeScreen
      onLogin={() => setScreen("login")}
      onSignup={() => setScreen("signup")}
      onGuest={() => setScreen("guest")}
      onGoogle={handleGoogle}
      loading={googleLoading}
    />
  )
}