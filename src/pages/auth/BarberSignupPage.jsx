import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { generateSlug } from '../../utils/helpers'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Scissors, Lock } from 'lucide-react'

export default function BarberSignupPage() {
  const { signUpBarber } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '', code: '', shopName: '', address: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  async function handle(e) {
    e.preventDefault()
    const { firstName, lastName, email, phone, password, confirm, code, shopName, address } = form
    if (!firstName || !lastName || !email || !phone || !password || !confirm || !code || !shopName)
      return toast.error('Fill in all fields')
    if (password !== confirm) return toast.error('Passwords do not match')
    if (password.length < 6) return toast.error('Password must be at least 6 characters')

    setLoading(true)
    try {
      const user = await signUpBarber({ firstName, lastName, email, phone, password, code })
      // Create barber profile
      const slug = generateSlug(shopName)
      await setDoc(doc(db, 'barbers', user.uid), {
        userId:   user.uid,
        name:     shopName,
        slug,
        bio:      '',
        address:  address || '',
        phone,
        email,
        photoURL: '',
        isActive: true,
        createdAt: serverTimestamp(),
      })
      // Create default availability
      await setDoc(doc(db, 'availability', user.uid), {
        barberId:    user.uid,
        workingDays: [1, 2, 3, 4, 5, 6],
        startTime:   '09:00',
        endTime:     '18:00',
        slotDuration: 15,
        breaks:      [{ startTime: '12:00', endTime: '13:00' }],
        blockedDates: [],
      })
      toast.success('Account created! Welcome to AmadoBook 🎉')
      navigate('/barber/dashboard')
    } catch (err) {
      toast.error(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center"><Scissors size={20} className="text-white" /></div>
          <h1 className="text-2xl font-bold text-light" style={{ fontFamily: 'Syne,sans-serif' }}>AmadoBook</h1>
        </div>
        <div className="card">
          <h2 className="text-xl font-bold text-light mb-1">Barber Registration</h2>
          <p className="text-muted text-sm mb-6">You need an access code to register as a barber.</p>

          <form onSubmit={handle} className="space-y-4">
            {/* Access code */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <label className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 mb-1.5"><Lock size={11} /> Access Code</label>
              <input value={form.code} onChange={set('code')} placeholder="Enter your access code" className="input" />
              <p className="text-xs text-muted mt-1">Contact AmadoBook to get your code.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">First Name</label>
                <input value={form.firstName} onChange={set('firstName')} placeholder="Angelo" className="input" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Last Name</label>
                <input value={form.lastName} onChange={set('lastName')} placeholder="Ferreras" className="input" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Shop / Business Name</label>
              <input value={form.shopName} onChange={set('shopName')} placeholder="AmadoBlends" className="input" />
              <p className="text-xs text-muted mt-1">This becomes your booking link: /b/amadoblends</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Address (optional)</label>
              <input value={form.address} onChange={set('address')} placeholder="647 Bleecker St, Utica, NY" className="input" />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Phone</label>
              <input value={form.phone} onChange={set('phone')} placeholder="(315) 000-0000" className="input" type="tel" />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Email</label>
              <input value={form.email} onChange={set('email')} placeholder="you@email.com" className="input" type="email" />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Min 6 characters" className="input pr-11" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-light">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Confirm Password</label>
              <input type="password" value={form.confirm} onChange={set('confirm')} placeholder="••••••••" className="input" />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Creating account...' : 'Create Barber Account'}
            </button>
          </form>

          <p className="text-center text-sm text-muted mt-5">
            Already have an account?{' '}
            <Link to="/barber/login" className="text-primary hover:text-primary-hover font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}