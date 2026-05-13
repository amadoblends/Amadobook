import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Scissors } from 'lucide-react'

const BG     = '#0D0D0D'
const CARD   = '#171717'
const BORDER = '#2A2A2A'
const ORANGE = '#FF6B1A'
const TXT    = '#F5F5F5'
const TXT2   = '#888888'
const TXT3   = '#555555'
const F      = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  * { box-sizing: border-box; }
  input { font-size: 16px !important; }
`

export default function BarberLoginPage() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)

  async function handle(e) {
    e.preventDefault()
    if (!email || !password) return toast.error('Fill in all fields')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/barber/dashboard')
    } catch {
      toast.error('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100dvh', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 20px', ...F }}>
      <style>{CSS}</style>

      <div style={{ width:'100%', maxWidth:400, animation:'fadeUp 0.3s ease both' }}>

        {/* Logo */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:40 }}>
          <div style={{
            width:64, height:64, borderRadius:20,
            background:`linear-gradient(135deg, ${ORANGE}, #FF8C42)`,
            display:'flex', alignItems:'center', justifyContent:'center',
            marginBottom:16, boxShadow:`0 8px 32px ${ORANGE}44`,
          }}>
            <Scissors size={28} color="#fff" strokeWidth={2}/>
          </div>
          <h1 style={{ color:TXT, fontWeight:900, fontSize:26, margin:'0 0 4px', letterSpacing:'-0.5px' }}>AmadoBook</h1>
          <p style={{ color:TXT3, fontSize:13, margin:0 }}>Barber Management Platform</p>
        </div>

        {/* Card */}
        <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:24, padding:'28px 24px' }}>
          <h2 style={{ color:TXT, fontWeight:800, fontSize:22, margin:'0 0 6px', letterSpacing:'-0.3px' }}>Welcome back.</h2>
          <p style={{ color:TXT2, fontSize:14, margin:'0 0 28px' }}>Sign in to your barber dashboard</p>

          <form onSubmit={handle}>
            {/* Email */}
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>EMAIL</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com" autoComplete="email"
                style={{
                  width:'100%', background:'transparent', border:'none',
                  borderBottom:`1.5px solid ${BORDER}`, color:TXT,
                  padding:'10px 0', fontSize:16, outline:'none', ...F,
                  transition:'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderBottomColor=ORANGE}
                onBlur={e  => e.target.style.borderBottomColor=BORDER}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>PASSWORD</label>
              <div style={{ position:'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  style={{
                    width:'100%', background:'transparent', border:'none',
                    borderBottom:`1.5px solid ${BORDER}`, color:TXT,
                    padding:'10px 36px 10px 0', fontSize:16, outline:'none', ...F,
                    transition:'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderBottomColor=ORANGE}
                  onBlur={e  => e.target.style.borderBottomColor=BORDER}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:TXT3, cursor:'pointer', padding:4, display:'flex' }}>
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {/* Forgot */}
            <div style={{ textAlign:'right', marginBottom:28 }}>
              <Link to="/barber/forgot-password" style={{ color:ORANGE, fontSize:13, fontWeight:600, textDecoration:'none' }}>
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              style={{
                width:'100%', background:ORANGE, color:'#fff',
                border:'none', borderRadius:22, padding:'17px',
                fontWeight:700, fontSize:16, cursor: loading ? 'not-allowed' : 'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                ...F, boxShadow:`0 4px 24px ${ORANGE}44`,
                opacity: loading ? 0.7 : 1, transition:'opacity 0.15s',
              }}>
              {loading && <div style={{ width:18, height:18, border:`2.5px solid rgba(255,255,255,0.4)`, borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign:'center', color:TXT2, fontSize:14, marginTop:24 }}>
            New barber?{' '}
            <Link to="/barber/signup" style={{ color:ORANGE, fontWeight:700, textDecoration:'none' }}>
              Request access
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}