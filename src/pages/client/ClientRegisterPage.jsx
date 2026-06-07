/**
 * ClientRegisterPage — fixed
 * ✅ Calls signUpClient() (correct method from ClientAuthContext)
 * ✅ Was calling signUp() which doesn't exist → caused silent failure
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'
import { googleProvider } from '../../lib/firebase'
import toast from 'react-hot-toast'

const BG     = '#0D0D0D'
const CARD   = '#171717'
const BORDER = '#2A2A2A'
const ORANGE = '#FF6B1A'
const TXT    = '#F5F5F5'
const TXT2   = '#888888'
const TXT3   = '#555555'
const F      = { fontFamily: "'DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  .field {
    width: 100%; background: transparent; border: none;
    border-bottom: 1.5px solid ${BORDER}; outline: none;
    color: ${TXT}; padding: 10px 0; font-size: 16px;
    font-family: 'DM Sans', system-ui, sans-serif;
    transition: border-color 0.2s;
  }
  .field:focus { border-bottom-color: ${ORANGE}; }
  .field::placeholder { color: ${TXT3}; }
`

export default function ClientRegisterPage() {
  const navigate = useNavigate()
  // ✅ signUpClient is the correct method name in ClientAuthContext
  const { signUpClient, signInWithGoogle } = useAuth()

  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'', password:'' })
  const [showPass, setShowPass] = useState(false)
  const [agreed,   setAgreed]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [gLoading, setGLoading] = useState(false)

  function set(k) { return e => setForm(p => ({ ...p, [k]:e.target.value })) }

  async function handleRegister(e) {
    e.preventDefault()
    if (!form.firstName || !form.email || !form.password) { toast.error('Fill in required fields'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (!agreed) { toast.error('Please accept the terms'); return }
    setLoading(true)
    try {
      // ✅ Fixed: was signUp(), now signUpClient()
      await signUpClient({
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        email:     form.email.trim(),
        phone:     form.phone.trim(),
        password:  form.password,
      })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'Email already registered. Sign in instead.'
        : err.code === 'auth/weak-password' ? 'Password too weak'
        : 'Registration failed'
      toast.error(msg)
    }
    setLoading(false)
  }

  async function handleGoogle() {
    if (!agreed) { toast.error('Please accept the terms first'); return }
    setGLoading(true)
    try {
      await signInWithGoogle('client')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') toast.error('Google sign-in failed')
    }
    setGLoading(false)
  }

  return (
    <div style={{ minHeight:'100dvh', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 20px', ...F }}>
      <style>{CSS}</style>

      <div style={{ width:'100%', maxWidth:400, animation:'fadeUp 0.28s ease both' }}>

        {/* Back */}
        <button onClick={() => navigate('/')}
          style={{ background:'none', border:'none', color:TXT2, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, ...F, marginBottom:32 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          Back
        </button>

        {/* Header */}
        <p style={{ color:TXT2, fontSize:12, fontWeight:600, margin:'0 0 6px', letterSpacing:'0.06em' }}>CREATE ACCOUNT</p>
        <h1 style={{ color:TXT, fontWeight:800, fontSize:28, margin:'0 0 32px', letterSpacing:'-0.5px', lineHeight:1.1 }}>
          Your best look<br/><span style={{ color:ORANGE }}>starts here.</span>
        </h1>

        {/* Google */}
        <button onClick={handleGoogle} disabled={gLoading}
          style={{ width:'100%', background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:'14px', display:'flex', alignItems:'center', justifyContent:'center', gap:10, cursor:'pointer', marginBottom:20, ...F }}>
          {gLoading
            ? <div style={{ width:18, height:18, border:`2px solid ${BORDER}`, borderTopColor:TXT, borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
            : <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span style={{ color:TXT, fontWeight:600, fontSize:14 }}>Continue with Google</span>
              </>
          }
        </button>

        {/* Divider */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{ flex:1, height:1, background:BORDER }}/>
          <span style={{ color:TXT3, fontSize:12 }}>or</span>
          <div style={{ flex:1, height:1, background:BORDER }}/>
        </div>

        {/* Form */}
        <form onSubmit={handleRegister}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
            <div>
              <label style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', display:'block', marginBottom:8 }}>FIRST NAME *</label>
              <input type="text" value={form.firstName} onChange={set('firstName')} placeholder="Alex" autoComplete="given-name" className="field"/>
            </div>
            <div>
              <label style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', display:'block', marginBottom:8 }}>LAST NAME</label>
              <input type="text" value={form.lastName} onChange={set('lastName')} placeholder="Rivera" autoComplete="family-name" className="field"/>
            </div>
          </div>

          <div style={{ marginBottom:20 }}>
            <label style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', display:'block', marginBottom:8 }}>EMAIL *</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="you@email.com" autoComplete="email" className="field"/>
          </div>

          <div style={{ marginBottom:20 }}>
            <label style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', display:'block', marginBottom:8 }}>PHONE</label>
            <input type="tel" value={form.phone} onChange={set('phone')} placeholder="(315) 000-0000" autoComplete="tel" className="field"/>
          </div>

          <div style={{ marginBottom:20 }}>
            <label style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', display:'block', marginBottom:8 }}>PASSWORD *</label>
            <div style={{ position:'relative' }}>
              <input type={showPass?'text':'password'} value={form.password} onChange={set('password')} placeholder="Min 6 characters" autoComplete="new-password" className="field" style={{ paddingRight:36 }}/>
              <button type="button" onClick={() => setShowPass(p => !p)}
                style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:TXT3, cursor:'pointer', padding:4 }}>
                {showPass
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          {/* Terms */}
          <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:28, cursor:'pointer' }} onClick={() => setAgreed(p => !p)}>
            <div style={{ width:20, height:20, borderRadius:6, border:`1.5px solid ${agreed?ORANGE:BORDER}`, background:agreed?ORANGE:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1, transition:'all 0.15s' }}>
              {agreed && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
            </div>
            <p style={{ color:TXT2, fontSize:13, margin:0, lineHeight:1.5 }}>
              I accept the <span style={{ color:ORANGE, fontWeight:600 }}>Terms & Conditions</span> and <span style={{ color:ORANGE, fontWeight:600 }}>Privacy Policy</span>
            </p>
          </div>

          <button type="submit" disabled={loading}
            style={{ width:'100%', background:ORANGE, border:'none', borderRadius:22, padding:'16px', color:'#fff', fontWeight:700, fontSize:16, cursor:loading?'not-allowed':'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:`0 4px 24px ${ORANGE}44`, opacity:loading?0.8:1, marginBottom:20 }}>
            {loading && <div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>}
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign:'center', color:TXT2, fontSize:14, margin:0 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color:ORANGE, fontWeight:700, textDecoration:'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
