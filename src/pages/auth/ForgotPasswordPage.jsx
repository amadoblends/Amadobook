import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sendPasswordResetEmail } from 'firebase/auth'
import { barberAuth, clientAuth } from '../../lib/firebase'

const CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  .fp-input {
    width:100%; background:transparent; border:none;
    border-bottom:1.5px solid currentColor; opacity:0.3;
    color:inherit; padding:12px 0 10px; font-size:15px; outline:none;
    transition:opacity 0.2s; font-family:inherit; box-sizing:border-box;
  }
  .fp-input:focus { opacity:1; }
  .fp-input::placeholder { opacity:0.4; }
`

export default function ForgotPasswordPage({ role = 'client' }) {
  const { barberSlug } = useParams()
  const navigate       = useNavigate()
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const isBarber = role === 'barber'
  const BG       = isBarber ? '#0A0A0A' : '#FFFFFF'
  const CARD     = isBarber ? '#141414' : '#F5F5F5'
  const BDR      = isBarber ? '#2A2A2A' : '#E5E5E5'
  const TXT      = isBarber ? '#F5F5F5' : '#0A0A0A'
  const TXT2     = '#777777'

  async function submit(e) {
    e.preventDefault()
    if (!email) return
    setLoading(true); setError('')
    try {
      const authInstance = isBarber ? barberAuth : clientAuth
      await sendPasswordResetEmail(authInstance, email)
      setSent(true)
    } catch {
      setError('No account found with that email.')
    }
    setLoading(false)
  }

  const back = isBarber ? '/barber/login' : `/b/${barberSlug}/auth`

  return (
    <div style={{ minHeight:'100dvh', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:"'Monda',system-ui,sans-serif" }}>
      <style>{CSS}</style>
      <div style={{ width:'100%', maxWidth:400 }}>
        <button onClick={()=>navigate(back)}
          style={{ background:'none', border:'none', color:TXT2, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:6, marginBottom:28, fontFamily:'inherit' }}>
          ← Back
        </button>

        {sent ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:isBarber?'#1A1A1A':'#F0F0F0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={TXT} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <h2 style={{ color:TXT, fontWeight:800, fontSize:22, marginBottom:8 }}>Check your email</h2>
            <p style={{ color:TXT2, fontSize:14, lineHeight:1.6 }}>
              We sent a reset link to <strong style={{color:TXT}}>{email}</strong>.<br/>
              Follow the link to set a new password.
            </p>
            <button onClick={()=>navigate(back)}
              style={{ marginTop:28, width:'100%', background:TXT, color:BG, border:'none', borderRadius:13, padding:'15px', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              Back to Sign In
            </button>
          </div>
        ) : (
          <div>
            <h2 style={{ color:TXT, fontWeight:800, fontSize:26, marginBottom:6, letterSpacing:'-0.3px' }}>Reset Password</h2>
            <p style={{ color:TXT2, fontSize:14, marginBottom:32, lineHeight:1.6 }}>
              Enter your email and we'll send you a reset link.
            </p>

            {error && (
              <div style={{ background:'#FEE2E2', border:'1px solid #FECACA', borderRadius:10, padding:'10px 14px', color:'#DC2626', fontSize:13, marginBottom:18 }}>
                {error}
              </div>
            )}

            <form onSubmit={submit}>
              <div style={{ marginBottom:28 }}>
                <p style={{ color:TXT2, fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:4 }}>EMAIL</p>
                <div style={{ borderBottom:`1.5px solid ${BDR}`, paddingBottom:8 }}>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                    placeholder="your@email.com" required
                    style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:TXT, fontSize:16, fontFamily:'inherit' }}/>
                </div>
              </div>
              <button type="submit" disabled={loading}
                style={{ width:'100%', background:TXT, color:BG, border:'none', borderRadius:13, padding:'15px', fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:'inherit', opacity:loading?0.7:1 }}>
                {loading && <div style={{width:16,height:16,border:`2px solid ${BG}44`,borderTopColor:BG,borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/>}
                {loading?'Sending…':'Send Reset Link'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}