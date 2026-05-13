import { useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'
import { signInAnonymously } from 'firebase/auth'
import { auth, db } from '../../lib/firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'

const F = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800;900&display=swap');
  @keyframes spin  { to { transform:rotate(360deg); } }
  @keyframes fadeUp{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:none; } }
  @keyframes glow  { 0%,100%{box-shadow:0 4px 28px rgba(255,107,26,0.44)} 50%{box-shadow:0 4px 28px rgba(255,107,26,0.1)} }
  .fade-up { animation: fadeUp 0.28s cubic-bezier(0.22,1,0.36,1) both; }
  .cl-input {
    width:100%; background:transparent; border:none;
    border-bottom:1.5px solid #2A2A2A; color:#F5F5F5;
    padding:10px 0 8px; font-size:15px; outline:none;
    font-family:'DM Sans',system-ui,sans-serif; box-sizing:border-box;
    transition:border-color 0.2s; font-weight:500;
  }
  .cl-input:focus { border-bottom-color:#FF6B1A; }
  .cl-input::placeholder { color:#555555; }
  .cl-label { display:block; font-size:10px; color:#888888; letter-spacing:0.1em; font-weight:700; text-transform:uppercase; margin-bottom:4px; }
  .cl-field { margin-bottom:20px; }
  .btn-primary { width:100%; background:#FF6B1A; color:#fff; border:none; border-radius:18px; padding:14px; font-size:15px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:'DM Sans',system-ui,sans-serif; transition:opacity 0.15s; animation: glow 3s infinite; }
  .btn-primary:disabled { opacity:0.5; cursor:not-allowed; animation:none; box-shadow:none; }
  .btn-outline { width:100%; background:transparent; color:#888888; border:1.5px solid #2A2A2A; border-radius:18px; padding:14px; font-size:14px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:'DM Sans',system-ui,sans-serif; }
  .err { background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); border-radius:12px; padding:10px 14px; color:#EF4444; font-size:13px; margin-bottom:16px; font-weight:500; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  button { touch-action:manipulation; }
`

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20">
    <path d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.39a4.6 4.6 0 01-2 3.02v2.5h3.24c1.9-1.75 3-4.32 3-7.31z" fill="#4285F4"/>
    <path d="M10 20c2.7 0 4.97-.9 6.62-2.46l-3.24-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.75-5.59-4.1H1.07v2.58A10 10 0 0010 20z" fill="#34A853"/>
    <path d="M4.41 11.9A6.01 6.01 0 014.1 10c0-.66.11-1.3.31-1.9V5.52H1.07A10 10 0 000 10c0 1.61.38 3.14 1.07 4.48l3.34-2.58z" fill="#FBBC04"/>
    <path d="M10 3.96c1.47 0 2.79.5 3.82 1.5l2.86-2.86C14.96.99 12.7 0 10 0A10 10 0 001.07 5.52l3.34 2.58C5.2 5.71 7.4 3.96 10 3.96z" fill="#EA4335"/>
  </svg>
)

const Spin = () => <div style={{ width:16,height:16,border:'2.5px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.75s linear infinite' }}/>

const ScissorsIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FF6B1A" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
    <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>
  </svg>
)

function LoginForm({ onSuccess, barberSlug, toggleSignup }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [loading, setL] = useState(false)

  async function submit(e) {
    e.preventDefault(); setErr(''); setL(true)
    try { await signIn(email, pass); onSuccess() }
    catch { setErr('Wrong email or password.') }
    setL(false)
  }
  return (
    <form onSubmit={submit} className="fade-up">
      {err && <div className="err">{err}</div>}
      <div className="cl-field"><label className="cl-label">Email</label><input className="cl-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" required autoComplete="email"/></div>
      <div className="cl-field" style={{ marginBottom:10 }}><label className="cl-label">Password</label><input className="cl-input" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required autoComplete="current-password"/></div>
      <div style={{ textAlign:'right', marginBottom:24 }}>
        <button type="button" onClick={()=>navigate(`/b/${barberSlug}/forgot-password`)} style={{ background:'none',border:'none',color:'#888',fontSize:12,fontWeight:700,cursor:'pointer',...F }}>Forgot password?</button>
      </div>
      <button className="btn-primary" type="submit" disabled={loading} style={{ marginBottom: 16 }}>{loading&&<Spin/>} {loading?'Signing in…':'Sign In'}</button>
      <p style={{ textAlign: 'center', color: '#888', fontSize: 13, margin: 0 }}>
        Don't have an account? <button type="button" onClick={toggleSignup} style={{ background:'none',border:'none',color:'#FF6B1A',fontSize:13,fontWeight:700,cursor:'pointer',...F }}>Sign up</button>
      </p>
    </form>
  )
}

function SignupForm({ onSuccess, toggleLogin }) {
  const { signUpClient } = useAuth()
  const [f, setF] = useState({ firstName:'',lastName:'',email:'',password:'',confirm:'' })
  const [err, setErr] = useState('')
  const [loading, setL] = useState(false)
  const set = k => e => setF(p=>({...p,[k]:e.target.value}))

  async function submit(e) {
    e.preventDefault(); setErr('')
    if (!f.firstName.trim()||!f.lastName.trim()) { setErr('Enter your full name.'); return }
    if (f.password.length<6) { setErr('Password needs at least 6 characters.'); return }
    if (f.password!==f.confirm) { setErr("Passwords don't match."); return }
    setL(true)
    try { await signUpClient({ firstName:f.firstName.trim(),lastName:f.lastName.trim(),email:f.email,password:f.password }); onSuccess() }
    catch(ex) { setErr(ex.message?.includes('email-already')?'Account already exists. Sign in instead.':'Registration failed.') }
    setL(false)
  }
  return (
    <form onSubmit={submit} className="fade-up">
      {err && <div className="err">{err}</div>}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20 }}>
        <div><label className="cl-label">First</label><input className="cl-input" value={f.firstName} onChange={set('firstName')} placeholder="Angelo" required autoComplete="given-name"/></div>
        <div><label className="cl-label">Last</label><input className="cl-input" value={f.lastName} onChange={set('lastName')} placeholder="Ferreras" required autoComplete="family-name"/></div>
      </div>
      <div className="cl-field"><label className="cl-label">Email</label><input className="cl-input" type="email" value={f.email} onChange={set('email')} placeholder="you@email.com" required autoComplete="email"/></div>
      <div className="cl-field"><label className="cl-label">Password</label><input className="cl-input" type="password" value={f.password} onChange={set('password')} placeholder="Min 6 characters" required autoComplete="new-password"/></div>
      <div className="cl-field" style={{ marginBottom:24 }}><label className="cl-label">Confirm</label><input className="cl-input" type="password" value={f.confirm} onChange={set('confirm')} placeholder="Repeat password" required autoComplete="new-password"/></div>
      <button className="btn-primary" type="submit" disabled={loading} style={{ marginBottom: 16 }}>{loading&&<Spin/>} {loading?'Creating…':'Create Account'}</button>
      <p style={{ textAlign: 'center', color: '#888', fontSize: 13, margin: 0 }}>
        Already have an account? <button type="button" onClick={toggleLogin} style={{ background:'none',border:'none',color:'#FF6B1A',fontSize:13,fontWeight:700,cursor:'pointer',...F }}>Sign in</button>
      </p>
    </form>
  )
}

function GuestForm({ onGuestSuccess }) {
  const [f, setF] = useState({ firstName:'',lastName:'',email:'',phone:'' })
  const [err, setErr] = useState('')
  const [loading, setL] = useState(false)
  const set = k => e => setF(p=>({...p,[k]:e.target.value}))

  async function submit(e) {
    e.preventDefault(); setErr('')
    if (!f.firstName.trim()||!f.lastName.trim()) { setErr('Enter your name.'); return }
    if (!f.email.trim()&&!f.phone.trim()) { setErr('Enter at least email or phone.'); return }
    setL(true)
    try {
      const cred = await signInAnonymously(auth)
      await setDoc(doc(db,'users',cred.user.uid),{ firstName:f.firstName.trim(),lastName:f.lastName.trim(),email:f.email.trim(),phone:f.phone.trim(),role:'client',isGuest:true,createdAt:serverTimestamp() },{ merge:true })
      onGuestSuccess()
    } catch { setErr('Could not continue. Try again.') }
    setL(false)
  }
  return (
    <form onSubmit={submit} className="fade-up">
      {err && <div className="err">{err}</div>}
      <p style={{ color:'#888',fontSize:13,margin:'0 0 20px', fontWeight:500 }}>Your info is used only for this booking.</p>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20 }}>
        <div><label className="cl-label">First name</label><input className="cl-input" value={f.firstName} onChange={set('firstName')} placeholder="Angelo" required autoComplete="given-name"/></div>
        <div><label className="cl-label">Last name</label><input className="cl-input" value={f.lastName} onChange={set('lastName')} placeholder="Ferreras" required autoComplete="family-name"/></div>
      </div>
      <div className="cl-field"><label className="cl-label">Email (optional)</label><input className="cl-input" type="email" value={f.email} onChange={set('email')} placeholder="you@email.com" autoComplete="email"/></div>
      <div className="cl-field" style={{ marginBottom:24 }}><label className="cl-label">Phone (optional)</label><input className="cl-input" type="tel" value={f.phone} onChange={set('phone')} placeholder="(315) 000-0000" autoComplete="tel"/></div>
      <button className="btn-primary" type="submit" disabled={loading}>{loading&&<Spin/>} {loading?'Continuing…':'Continue as Guest'}</button>
    </form>
  )
}

export default function ClientAuthPage() {
  const { barberSlug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { signInWithGoogle, user } = useAuth()

  const startTab = location.state?.startAtGuest ? 'guest' : 'login'
  const [tab, setTab] = useState(startTab)
  const [googleL, setGL] = useState(false)
  const [googleErr, setGErr] = useState('')

  if (user) { navigate(`/b/${barberSlug}/dashboard`,{replace:true}); return null }

  function onSuccess() { navigate(`/b/${barberSlug}/dashboard`,{replace:true}) }
  function onGuestSuccess() { navigate(`/b/${barberSlug}/book`) }

  async function handleGoogle() {
    setGL(true); setGErr('')
    try { await signInWithGoogle('client'); onSuccess() }
    catch { setGErr('Google sign-in failed. Try email.') }
    setGL(false)
  }

  return (
    <>
      <style>{CSS}</style>
      <div style={{ minHeight:'100dvh', background:'#0D0D0D', display:'flex', flexDirection:'column', alignItems: 'center', ...F, overflowX:'hidden', padding: '32px 16px' }}>

        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,107,26,0.1)', border: '1px solid rgba(255,107,26,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, marginTop: '3vh' }}>
          <ScissorsIcon />
        </div>

        <div style={{ width: '100%', maxWidth: 360 }}>
          <h1 style={{ color: '#F5F5F5', fontSize: 28, fontWeight: 900, margin: '0 0 6px', letterSpacing: '-1px' }}>
            {tab === 'guest' ? 'Continue as Guest.' : tab === 'signup' ? 'Create Account.' : 'Welcome back.'}
          </h1>
          <p style={{ color: '#888888', fontSize: 14, margin: '0 0 24px', fontWeight: 500 }}>
            {tab === 'guest' ? 'Quick booking without an account' : tab === 'signup' ? 'Join to manage your appointments' : 'Sign in to your account'}
          </p>

          {tab !== 'guest' && (
            <>
              {googleErr && <div className="err">{googleErr}</div>}
              <button className="btn-outline" onClick={handleGoogle} disabled={googleL} style={{ marginBottom: 20 }}>
                <GoogleIcon/> {googleL ? 'Signing in…' : 'Continue with Google'}
              </button>
              <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:20 }}>
                <div style={{ flex:1,height:1,background:'#2A2A2A' }}/><span style={{ color:'#555555',fontSize:11, fontWeight:700 }}>OR EMAIL</span><div style={{ flex:1,height:1,background:'#2A2A2A' }}/>
              </div>
            </>
          )}

          {tab === 'login'  && <LoginForm onSuccess={onSuccess} barberSlug={barberSlug} toggleSignup={() => setTab('signup')} />}
          {tab === 'signup' && <SignupForm onSuccess={onSuccess} toggleLogin={() => setTab('login')} />}
          {tab === 'guest'  && <GuestForm onGuestSuccess={onGuestSuccess} />}

          {tab === 'login' && (
             <div style={{ marginTop: 20 }}>
               <button className="btn-outline" onClick={() => setTab('guest')}>Continue as Guest</button>
             </div>
          )}
          {tab === 'guest' && (
             <div style={{ marginTop: 20 }}>
               <button className="btn-outline" onClick={() => setTab('login')}>Back to Sign in</button>
             </div>
          )}

          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <button onClick={()=>navigate(`/b/${barberSlug}`)}
              style={{ background:'none',border:'none',color:'#555555',fontSize:13,fontWeight:700,cursor:'pointer',...F }}>
              ← Back to barber page
            </button>
          </div>
        </div>
      </div>
    </>
  )
}