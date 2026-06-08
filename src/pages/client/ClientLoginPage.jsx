/**
 * ClientLoginPage — Migrated to Design System
 * ✓ CSS Variables for Light/Dark mode
 * ✓ Removed redundant styles & colors
 * ✓ Cleaned up structure
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'
import { googleProvider } from '../../lib/firebase'
import toast from 'react-hot-toast'

const F = { fontFamily: "'Plus Jakarta Sans','DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  .field {
    width: 100%; background: transparent; border: none;
    border-bottom: 1.5px solid var(--border); outline: none;
    color: var(--text-pri); padding: 10px 0; font-size: 16px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    transition: border-color 0.2s;
  }
  .field:focus { border-bottom-color: var(--accent); }
  .field::placeholder { color: var(--text-ter); }
`

export default function ClientLoginPage() {
  const navigate              = useNavigate()
  const { signIn, signInWithGoogle } = useAuth()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [gLoading, setGLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) { toast.error('Fill in all fields'); return }
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg = err.code === 'auth/invalid-credential' ? 'Wrong email or password'
        : err.code === 'auth/too-many-requests' ? 'Too many attempts. Try later.'
        : 'Login failed'
      toast.error(msg)
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setGLoading(true)
    try {
      await signInWithGoogle(googleProvider)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') toast.error('Google sign-in failed')
    }
    setGLoading(false)
  }

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 20px', ...F }}>
      <style>{CSS}</style>

      <div style={{ width:'100%', maxWidth:400, animation:'fadeUp 0.28s ease both' }}>

        {/* Back */}
        <button onClick={() => navigate('/')}
          style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, ...F, marginBottom:32 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          Back
        </button>

        {/* Header */}
        <p style={{ color:'var(--text-sec)', fontSize:12, fontWeight:600, margin:'0 0 6px', letterSpacing:'0.06em' }}>WELCOME BACK</p>
        <h1 style={{ color:'var(--text-pri)', fontWeight:800, fontSize:28, margin:'0 0 32px', letterSpacing:'-0.5px', lineHeight:1.1 }}>
          Sign in to<br/><span style={{ color:'var(--accent)' }}>your account.</span>
        </h1>

        {/* Google */}
        <button onClick={handleGoogle} disabled={gLoading}
          style={{ width:'100%', background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'14px', display:'flex', alignItems:'center', justifyContent:'center', gap:10, cursor:'pointer', marginBottom:20, ...F, transition:'border-color 0.15s', boxShadow:'var(--shadow-sm)' }}>
          {gLoading
            ? <div style={{ width:18, height:18, border:'2px solid var(--border)', borderTopColor:'var(--text-pri)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
            : <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span style={{ color:'var(--text-pri)', fontWeight:600, fontSize:14 }}>Continue with Google</span>
              </>
          }
        </button>

        {/* Divider */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{ flex:1, height:1, background:'var(--border)' }}/>
          <span style={{ color:'var(--text-ter)', fontSize:12 }}>or</span>
          <div style={{ flex:1, height:1, background:'var(--border)' }}/>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:20 }}>
            <label style={{ color:'var(--text-ter)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', display:'block', marginBottom:8 }}>EMAIL</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="you@email.com" autoComplete="email" className="field"/>
          </div>

          <div style={{ marginBottom:10 }}>
            <label style={{ color:'var(--text-ter)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', display:'block', marginBottom:8 }}>PASSWORD</label>
            <div style={{ position:'relative' }}>
              <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" className="field" style={{ paddingRight:36 }}/>
              <button type="button" onClick={()=>setShowPass(p=>!p)}
                style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-ter)', cursor:'pointer', padding:4 }}>
                {showPass
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          {/* Forgot */}
          <div style={{ textAlign:'right', marginBottom:28 }}>
            <Link to="/forgot-password" style={{ color:'var(--text-sec)', fontSize:12, fontWeight:600, textDecoration:'none' }}>
              Forgot password?
            </Link>
          </div>

          <button type="submit" disabled={loading}
            style={{ width:'100%', background:'var(--accent)', border:'none', borderRadius:22, padding:'16px', color:'#fff', fontWeight:700, fontSize:16, cursor:loading?'not-allowed':'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'var(--shadow-accent)', opacity:loading?0.8:1, marginBottom:20 }}>
            {loading && <div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Register link */}
        <p style={{ textAlign:'center', color:'var(--text-sec)', fontSize:14, margin:0 }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color:'var(--accent)', fontWeight:700, textDecoration:'none' }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}