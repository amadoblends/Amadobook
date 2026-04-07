import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import { Scissors, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage({ backTo = '/barber/login' }) {
  const { resetPassword } = useAuth()
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)

  async function handle(e) {
    e.preventDefault()
    if (!email) return toast.error('Enter your email')
    setLoading(true)
    try { await resetPassword(email); setSent(true) }
    catch { toast.error('Could not send reset email') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center"><Scissors size={20} className="text-white" /></div>
          <h1 className="text-2xl font-bold text-light" style={{ fontFamily: 'Syne,sans-serif' }}>AmadoBook</h1>
        </div>
        <div className="card">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle size={48} className="text-success mx-auto mb-4" />
              <h2 className="text-xl font-bold text-light mb-2">Check your inbox</h2>
              <p className="text-muted text-sm mb-6">Reset link sent to <span className="text-light">{email}</span></p>
              <Link to={backTo} className="btn-primary inline-block">Back to Login</Link>
            </div>
          ) : (
            <>
              <Link to={backTo} className="flex items-center gap-1.5 text-muted hover:text-light text-sm mb-5 transition-colors w-fit"><ArrowLeft size={14} /> Back</Link>
              <h2 className="text-xl font-bold text-light mb-1">Forgot password?</h2>
              <p className="text-muted text-sm mb-6">Enter your email to get a reset link.</p>
              <form onSubmit={handle} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" className="input" />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
