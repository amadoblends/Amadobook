import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Scissors } from 'lucide-react'

export default function BarberLoginPage() {
  // Asegúrate de tener signInWithGoogle en tu useAuth si vas a usar Firebase Google Auth
  const { signIn, signInWithGoogle } = useAuth() 
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

  async function handleGoogle() {
    if (!signInWithGoogle) return toast.error('Google Auth no configurado aún')
    setLoading(true)
    try {
      await signInWithGoogle()
      navigate('/barber/dashboard')
    } catch (error) {
      toast.error('Error con Google Sign In')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ backgroundColor: '#000' }}>
      
      {/* Fondo Degradado Premium estilo AmadoBook */}
      <div className="absolute top-0 left-0 w-full h-96 opacity-40 pointer-events-none" 
           style={{ background: 'radial-gradient(circle at top, var(--accent) 0%, transparent 60%)' }} />

      <div className="w-full max-w-md relative z-10">
        
        {/* Header Logo */}
        <div className="flex flex-col items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 20px rgba(234,88,12,0.4)' }}>
            <Scissors size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: 'Syne,sans-serif' }}>AmadoBook</h1>
          <p className="text-sm text-gray-400">Your barber, your schedule</p>
        </div>

        {/* Login Card */}
        <div className="bg-[#111] border border-gray-800 rounded-3xl p-6 md:p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            Welcome back <span className="text-2xl">👋</span>
          </h2>
          
          <form onSubmit={handle} className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" 
                     className="w-full bg-[#1a1a1a] border border-gray-800 text-white rounded-xl p-3.5 focus:border-orange-500 focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" 
                       className="w-full bg-[#1a1a1a] border border-gray-800 text-white rounded-xl p-3.5 pr-11 focus:border-orange-500 focus:outline-none transition-colors" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <div className="flex justify-end pt-1">
              <Link to="/barber/forgot-password" className="text-sm text-orange-500 hover:text-orange-400 font-medium transition-colors">Forgot password?</Link>
            </div>
            
            <button type="submit" disabled={loading} 
                    className="w-full flex items-center justify-center gap-2 text-white font-bold rounded-xl p-3.5 transition-all transform hover:scale-[1.02]"
                    style={{ background: 'var(--accent)', boxShadow: '0 4px 15px rgba(234,88,12,0.3)' }}>
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divisor "or" */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-800"></div>
            <span className="text-xs text-gray-500 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-800"></div>
          </div>

          {/* Botón de Google */}
          <button onClick={handleGoogle} type="button" disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-[#1a1a1a] border border-gray-700 hover:bg-[#222] text-white font-medium rounded-xl p-3.5 transition-colors">
            {/* SVG Logo de Google simple */}
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.419 L -8.284 53.419 C -8.554 54.819 -9.414 55.939 -10.534 56.699 L -10.534 59.339 L -6.644 59.339 C -4.364 57.229 -3.264 54.629 -3.264 51.509 Z"/>
                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.534 57.689 C -11.614 58.429 -13.044 58.879 -14.754 58.879 C -18.064 58.879 -20.874 56.639 -21.864 53.609 L -25.864 53.609 L -25.864 56.709 C -23.794 60.829 -19.594 63.239 -14.754 63.239 Z"/>
                <path fill="#FBBC05" d="M -21.864 53.609 C -22.124 52.829 -22.274 52.009 -22.274 51.159 C -22.274 50.309 -22.124 49.489 -21.864 48.709 L -21.864 45.609 L -25.864 45.609 C -26.704 47.289 -27.184 49.169 -27.184 51.159 C -27.184 53.149 -26.704 55.029 -25.864 56.709 L -21.864 53.609 Z"/>
                <path fill="#EA4335" d="M -14.754 43.439 C -12.984 43.439 -11.404 44.049 -10.154 45.239 L -6.744 41.829 C -8.804 39.909 -11.514 38.779 -14.754 38.779 C -19.594 38.779 -23.794 41.189 -25.864 45.309 L -21.864 48.409 C -20.874 45.379 -18.064 43.439 -14.754 43.439 Z"/>
              </g>
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-sm text-gray-500 mt-6">
            New barber?{' '}
            <Link to="/barber/signup" className="text-orange-500 hover:text-orange-400 font-medium transition-colors">Request access</Link>
          </p>
        </div>
      </div>
    </div>
  )
}