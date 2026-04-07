import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'

const Logo = ({ size = 36, color = '#FF5C00' }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <polygon points="18,88 42,14 56,88" fill={color} opacity="0.95"/>
    <polygon points="50,88 74,38 88,88" fill={color} opacity="0.70"/>
  </svg>
)

const Field = ({ label, type='text', value, onChange, placeholder, right }) => (
  <div>
    <p style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',color:'#555',marginBottom:8}}>{label}</p>
    <div style={{display:'flex',alignItems:'center',borderBottom:'1.5px solid #222',paddingBottom:10,gap:8}}>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        autoCapitalize="off" autoCorrect="off"
        style={{flex:1,background:'transparent',border:'none',outline:'none',color:'#fff',fontSize:16,fontFamily:'inherit'}}/>
      {right}
    </div>
  </div>
)

export default function ClientAuthPage() {
  const { barberSlug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn, signUpClient, signInWithGoogle } = useAuth()

  const [mode, setMode] = useState(searchParams.get('mode') || 'login')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [phone, setPhone]         = useState('')
  const [confirm, setConfirm]     = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) return toast.error('Fill in all fields')
    setLoading(true)
    try {
      await signIn(email, password)
      toast.success('Welcome back!')
      navigate(`/b/${barberSlug}`)
    } catch { toast.error('Invalid email or password') }
    finally { setLoading(false) }
  }

  async function handleSignup(e) {
    e.preventDefault()
    if (!firstName||!lastName||!phone||!email||!password||!confirm) return toast.error('Fill in all fields')
    if (password !== confirm) return toast.error('Passwords do not match')
    if (password.length < 6) return toast.error('Minimum 6 characters')
    setLoading(true)
    try {
      await signUpClient({ firstName, lastName, email, phone, password })
      toast.success('Account created! 🎉')
      navigate(`/b/${barberSlug}`)
    } catch (err) {
      toast.error(err.code === 'auth/email-already-in-use' ? 'Email already registered' : err.message)
    } finally { setLoading(false) }
  }

  async function handleGoogle() {
    setLoading(true)
    try {
      await signInWithGoogle('client')
      navigate(`/b/${barberSlug}`)
    } catch { toast.error('Google sign-in failed') }
    finally { setLoading(false) }
  }

  const pwToggle = (
    <button type="button" onClick={() => setShowPw(!showPw)}
      style={{background:'none',border:'none',color:'#555',cursor:'pointer',padding:0}}>
      {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
    </button>
  )

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',display:'flex',flexDirection:'column',fontFamily:'DM Sans,system-ui,sans-serif'}}>

      {/* Hero top */}
      <div style={{position:'relative',background:'linear-gradient(160deg,#0d0500,#3d1500 55%,#FF5C00)',overflow:'hidden',flexShrink:0}}>
        <div style={{position:'absolute',inset:0,opacity:0.08,backgroundImage:'radial-gradient(circle,#FF5C00 1px,transparent 1px)',backgroundSize:'22px 22px'}}/>
        <div style={{position:'relative',zIndex:1,padding:'16px 20px 0',display:'flex',alignItems:'center',gap:10}}>
          <button onClick={() => navigate(`/b/${barberSlug}`)}
            style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:10,padding:'7px 12px',color:'white',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:12,fontWeight:700}}>
            <ArrowLeft size={14}/> Back
          </button>
        </div>
        <div style={{position:'relative',zIndex:1,padding:'20px 24px 36px',display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center'}}>
          <Logo size={44} color="white"/>
          <h1 style={{fontFamily:'Syne,sans-serif',fontWeight:900,color:'#fff',fontSize:24,marginTop:8,marginBottom:4}}>AmadoBook</h1>
          <p style={{color:'rgba(255,255,255,0.6)',fontSize:13}}>Your barber, your schedule</p>
        </div>
        {/* Wave */}
        <svg viewBox="0 0 390 28" preserveAspectRatio="none" style={{display:'block',height:28,width:'100%'}}>
          <path d="M0 0 Q195 42 390 0 L390 28 L0 28 Z" fill="#0a0a0a"/>
        </svg>
      </div>

      {/* Content */}
      <div style={{flex:1,padding:'8px 24px 50px',maxWidth:480,margin:'0 auto',width:'100%',overflowY:'auto'}}>

        {/* Toggle */}
        <div style={{display:'flex',background:'#141414',borderRadius:18,padding:4,marginBottom:28}}>
          {['login','signup'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{
                flex:1,padding:'12px 0',borderRadius:14,fontWeight:800,fontSize:14,
                background: mode===m ? '#fff' : 'transparent',
                color: mode===m ? '#000' : '#555',
                border:'none',cursor:'pointer',transition:'all 0.2s',
                fontFamily:'Syne,sans-serif',
              }}>
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:22}}>
            <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:900,color:'#fff',fontSize:26,margin:0}}>Welcome back 👋</h2>
            <Field label="EMAIL" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com"/>
            <Field label="PASSWORD" type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" right={pwToggle}/>
            <div style={{textAlign:'right',marginTop:-10}}>
              <button type="button" style={{color:'#FF5C00',fontWeight:700,fontSize:13,background:'none',border:'none',cursor:'pointer'}}>Forgot password?</button>
            </div>
            <button type="submit" disabled={loading}
              style={{background:'linear-gradient(135deg,#FF5C00,#FF9000)',border:'none',borderRadius:18,padding:'17px 0',color:'#fff',fontWeight:900,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 8px 28px rgba(255,92,0,0.4)',fontFamily:'Syne,sans-serif'}}>
              {loading && <div style={{width:18,height:18,border:'2.5px solid white',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} style={{display:'flex',flexDirection:'column',gap:20}}>
            <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:900,color:'#fff',fontSize:26,margin:0}}>Create account ✨</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <Field label="FIRST NAME" value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Angelo"/>
              <Field label="LAST NAME"  value={lastName}  onChange={e=>setLastName(e.target.value)}  placeholder="Ferreras"/>
            </div>
            <Field label="PHONE" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(315) 000-0000"/>
            <Field label="EMAIL" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com"/>
            <Field label="PASSWORD" type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min 6 characters" right={pwToggle}/>
            <Field label="CONFIRM PASSWORD" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="••••••••"/>
            <button type="submit" disabled={loading}
              style={{background:'linear-gradient(135deg,#FF5C00,#FF9000)',border:'none',borderRadius:18,padding:'17px 0',color:'#fff',fontWeight:900,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 8px 28px rgba(255,92,0,0.4)',fontFamily:'Syne,sans-serif',marginTop:4}}>
              {loading && <div style={{width:18,height:18,border:'2.5px solid white',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>}
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Divider */}
        <div style={{display:'flex',alignItems:'center',gap:12,margin:'22px 0'}}>
          <div style={{flex:1,height:1,background:'#1a1a1a'}}/><span style={{color:'#333',fontSize:12}}>or</span><div style={{flex:1,height:1,background:'#1a1a1a'}}/>
        </div>

        {/* Google */}
        <button onClick={handleGoogle} disabled={loading}
          style={{width:'100%',background:'#141414',border:'1px solid #1e1e1e',borderRadius:16,padding:'15px 0',display:'flex',alignItems:'center',justifyContent:'center',gap:12,cursor:'pointer',color:'#fff',fontWeight:700,fontSize:15}}>
          <img src="https://www.google.com/favicon.ico" style={{width:18,height:18}} alt=""/>
          Continue with Google
        </button>

        {/* Switch mode */}
        <p style={{textAlign:'center',color:'#555',fontSize:14,marginTop:20}}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => setMode(mode==='login'?'signup':'login')}
            style={{color:'#FF5C00',fontWeight:800,background:'none',border:'none',cursor:'pointer'}}>
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>

        {/* Guest */}
        <p style={{textAlign:'center',marginTop:12}}>
          <button onClick={() => navigate(`/b/${barberSlug}/book`)}
            style={{color:'#333',fontSize:13,background:'none',border:'none',cursor:'pointer'}}>
            Skip — Continue as guest →
          </button>
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
