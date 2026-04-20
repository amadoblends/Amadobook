import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Scissors } from 'lucide-react'

export default function BarberLoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
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
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center"><Scissors size={20} className="text-white" /></div>
          <h1 className="text-2xl font-bold text-light" style={{ fontFamily: 'Syne,sans-serif' }}>AmadoBook</h1>
        </div>
        <div className="card">
          <h2 className="text-xl font-bold text-light mb-1">Barber Login</h2>
          <p className="text-muted text-sm mb-6">Access your barber dashboard</p>
          <form onSubmit={handle} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" className="input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="input pr-11" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-light">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <Link to="/barber/forgot-password" className="text-xs text-primary hover:text-primary-hover">Forgot password?</Link>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-sm text-muted mt-5">
            New barber?{' '}
            <Link to="/barber/signup" className="text-primary hover:text-primary-hover font-medium">Request access</Link>
          </p>
        </div>
      </div>
    </div>
  )
}