import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage({ role = 'client' }) {
  const { barberSlug } = useParams()
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleReset = async (e) => {
    e.preventDefault()
    if (!email) return toast.error('Enter your email')
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
    } catch {
      toast.error('Account not found')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:24, padding:32, width:'100%', maxWidth:400, textAlign:'center' }}>
        <Link to={role === 'barber' ? '/barber/login' : `/b/${barberSlug}/auth`} 
              style={{ display:'flex', alignItems:'center', gap:8, color:'var(--text-sec)', textDecoration:'none', fontSize:13, marginBottom:20 }}>
          <ArrowLeft size={16}/> Back
        </Link>

        {sent ? (
          <div>
            <CheckCircle size={48} color="var(--accent)" style={{ marginBottom:16 }} />
            <h2 style={{ color:'var(--text-pri)' }}>Check your email</h2>
            <p style={{ color:'var(--text-sec)', fontSize:14 }}>We sent a reset link to <b>{email}</b>. Follow the link to create a new password.</p>
          </div>
        ) : (
          <form onSubmit={handleReset}>
            <h2 style={{ color:'var(--text-pri)', marginBottom:8 }}>Reset Password</h2>
            <p style={{ color:'var(--text-sec)', fontSize:14, marginBottom:24 }}>Enter your email and we'll send you instructions.</p>
            <input 
              type="email" placeholder="your@email.com" 
              value={email} onChange={e => setEmail(e.target.value)}
              className="input" style={{ marginBottom:16 }}
            />
            <button className="btn-primary" type="submit" disabled={loading} style={{ width:'100%' }}>
              {loading ? 'Sending...' : 'Send Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}