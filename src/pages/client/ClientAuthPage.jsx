/**
 * ClientAuthPage — 3 tabs: Sign In | Sign Up | Guest — no double welcome screen
 */
import { useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'
import { signInAnonymously } from 'firebase/auth'
import { auth, db } from '../../lib/firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'

const F = { fontFamily:"'Monda',system-ui,sans-serif" }
const PATTERN = `repeating-linear-gradient(45deg,transparent,transparent 14px,rgba(255,255,255,0.04) 14px,rgba(255,255,255,0.04) 15px),repeating-linear-gradient(-45deg,transparent,transparent 14px,rgba(255,255,255,0.04) 14px,rgba(255,255,255,0.04) 15px)`

const CSS = `
  @keyframes spin  { to { transform:rotate(360deg); } }
  @keyframes fadeUp{ from{ opacity:0; transform:translateY(10px); } to{ opacity:1; transform:none; } }
  .fade-up { animation: fadeUp 0.22s ease both; }
  .cl-input {
    width:100%; background:transparent; border:none;
    border-bottom:1.5px solid #E0E0E0; color:#0A0A0A;
    padding:11px 0 9px; font-size:16px; outline:none;
    font-family:'Monda',system-ui,sans-serif; box-sizing:border-box;
    transition:border-color 0.2s;
  }
  .cl-input:focus { border-bottom-color:#0A0A0A; }
  .cl-input::placeholder { color:#C0C0C0; }
  .cl-label { display:block; font-size:10px; color:#9A9A9A; letter-spacing:0.09em; text-transform:uppercase; margin-bottom:3px; }
  .cl-field { margin-bottom:18px; }
  .btn-black { width:100%; background:#0A0A0A; color:#fff; border:none; border-radius:14px; padding:16px; font-size:15px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:'Monda',system-ui,sans-serif; transition:opacity 0.15s; }
  .btn-black:disabled { opacity:0.4; cursor:not-allowed; }
  .btn-outline { width:100%; background:transparent; color:#0A0A0A; border:1.5px solid #E0E0E0; border-radius:14px; padding:15px; font-size:14px; font-weight:500; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:'Monda',system-ui,sans-serif; }
  .err { background:#FEE2E2; border:1px solid #FECACA; border-radius:10px; padding:10px 14px; color:#DC2626; font-size:13px; margin-bottom:14px; }
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

function TabBar({ tab, onChange }) {
  return (
    <div style={{ display:'flex', background:'#F0F0F0', borderRadius:12, padding:3, marginBottom:22 }}>
      {[['login','Sign In'],['signup','Sign Up'],['guest','Guest']].map(([id,lbl])=>(
        <button key={id} onClick={()=>onChange(id)}
          style={{ flex:1, padding:'9px 4px', borderRadius:10, fontWeight:700, fontSize:13, background:tab===id?'#0A0A0A':'transparent', color:tab===id?'#fff':'#888', border:'none', cursor:'pointer', ...F, transition:'all 0.18s' }}>
          {lbl}
        </button>
      ))}
    </div>
  )
}

function LoginForm({ onSuccess, barberSlug }) {
  const { signIn }    = useAuth()
  const navigate      = useNavigate()
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('')
  const [err, setErr]     = useState('')
  const [loading, setL]   = useState(false)

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
      <div className="cl-field" style={{ marginBottom:6 }}><label className="cl-label">Password</label><input className="cl-input" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required autoComplete="current-password"/></div>
      <div style={{ textAlign:'right', marginBottom:20 }}>
        <button type="button" onClick={()=>navigate(`/b/${barberSlug}/forgot-password`)} style={{ background:'none',border:'none',color:'#999',fontSize:12,cursor:'pointer',...F }}>Forgot password?</button>
      </div>
      <button className="btn-black" type="submit" disabled={loading}>{loading&&<Spin/>} {loading?'Signing in…':'Sign In'}</button>
    </form>
  )
}

function SignupForm({ onSuccess }) {
  const { signUpClient } = useAuth()
  const [f, setF]   = useState({ firstName:'',lastName:'',email:'',password:'',confirm:'' })
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
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:18 }}>
        <div><label className="cl-label">First</label><input className="cl-input" value={f.firstName} onChange={set('firstName')} placeholder="Angelo" required autoComplete="given-name"/></div>
        <div><label className="cl-label">Last</label><input className="cl-input" value={f.lastName} onChange={set('lastName')} placeholder="Ferreras" required autoComplete="family-name"/></div>
      </div>
      <div className="cl-field"><label className="cl-label">Email</label><input className="cl-input" type="email" value={f.email} onChange={set('email')} placeholder="you@email.com" required autoComplete="email"/></div>
      <div className="cl-field"><label className="cl-label">Password</label><input className="cl-input" type="password" value={f.password} onChange={set('password')} placeholder="Min 6 characters" required autoComplete="new-password"/></div>
      <div className="cl-field" style={{ marginBottom:20 }}><label className="cl-label">Confirm</label><input className="cl-input" type="password" value={f.confirm} onChange={set('confirm')} placeholder="Repeat password" required autoComplete="new-password"/></div>
      <button className="btn-black" type="submit" disabled={loading}>{loading&&<Spin/>} {loading?'Creating…':'Create Account'}</button>
    </form>
  )
}

function GuestForm({ onGuestSuccess }) {
  const [f, setF]     = useState({ firstName:'',lastName:'',email:'',phone:'' })
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
      <p style={{ color:'#999',fontSize:12,margin:'0 0 14px' }}>Your info is used only for this booking.</p>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:18 }}>
        <div><label className="cl-label">First name</label><input className="cl-input" value={f.firstName} onChange={set('firstName')} placeholder="Angelo" required autoComplete="given-name"/></div>
        <div><label className="cl-label">Last name</label><input className="cl-input" value={f.lastName} onChange={set('lastName')} placeholder="Ferreras" required autoComplete="family-name"/></div>
      </div>
      <div className="cl-field"><label className="cl-label">Email (optional)</label><input className="cl-input" type="email" value={f.email} onChange={set('email')} placeholder="you@email.com" autoComplete="email"/></div>
      <div className="cl-field" style={{ marginBottom:20 }}><label className="cl-label">Phone (optional)</label><input className="cl-input" type="tel" value={f.phone} onChange={set('phone')} placeholder="(315) 000-0000" autoComplete="tel"/></div>
      <button className="btn-black" type="submit" disabled={loading}>{loading&&<Spin/>} {loading?'Continuing…':'Continue as Guest'}</button>
    </form>
  )
}

export default function ClientAuthPage() {
  const { barberSlug } = useParams()
  const navigate       = useNavigate()
  const location       = useLocation()
  const { signInWithGoogle, user } = useAuth()

  const startTab = location.state?.startAtGuest ? 'guest' : 'login'
  const [tab, setTab]       = useState(startTab)
  const [googleL, setGL]    = useState(false)
  const [googleErr, setGErr] = useState('')

  // Already logged in → go to dashboard
  if (user) { navigate(`/b/${barberSlug}/dashboard`,{replace:true}); return null }

  function onSuccess()      { navigate(`/b/${barberSlug}/dashboard`,{replace:true}) }
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
      <div style={{ minHeight:'100dvh', background:'#0A0A0A', display:'flex', flexDirection:'column', ...F, overflowX:'hidden' }}>

        {/* Black top */}
        <div style={{ flexShrink:0, minHeight:'26vh', background:`${PATTERN}, #0A0A0A`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 24px 40px' }}>
          <div style={{ width:58, height:58, borderRadius:15, background:'rgba(255,255,255,0.08)', border:'1.5px solid rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
            <img src="/logo.png" alt="" onError={e=>e.target.style.display='none'} style={{ width:36, height:36, objectFit:'contain' }}/>
          </div>
          <p style={{ color:'rgba(255,255,255,0.4)', fontSize:13, margin:0, letterSpacing:'0.05em' }}>AmadoBlends</p>
        </div>

        {/* White card */}
        <div style={{ flex:1, background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-24, padding:'24px 24px 52px', maxWidth:480, width:'100%', alignSelf:'center', boxSizing:'border-box', overflowY:'auto' }}>

          {/* Google — only for login/signup */}
          {tab !== 'guest' && (
            <>
              {googleErr && <div className="err">{googleErr}</div>}
              <button className="btn-outline" onClick={handleGoogle} disabled={googleL} style={{ marginBottom:14 }}>
                <GoogleIcon/> {googleL?'Signing in…':'Continue with Google'}
              </button>
              <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:14 }}>
                <div style={{ flex:1,height:1,background:'#EBEBEB' }}/><span style={{ color:'#CCC',fontSize:12 }}>or</span><div style={{ flex:1,height:1,background:'#EBEBEB' }}/>
              </div>
            </>
          )}

          <TabBar tab={tab} onChange={setTab}/>

          {tab==='login'  && <LoginForm  onSuccess={onSuccess}      barberSlug={barberSlug}/>}
          {tab==='signup' && <SignupForm onSuccess={onSuccess}/>}
          {tab==='guest'  && <GuestForm  onGuestSuccess={onGuestSuccess}/>}

          <button onClick={()=>navigate(`/b/${barberSlug}`)}
            style={{ width:'100%',background:'none',border:'none',color:'#AAA',fontSize:13,cursor:'pointer',marginTop:18,...F }}>
            ← Back to barber page
          </button>
        </div>
      </div>
    </>
  )
}