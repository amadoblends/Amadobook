import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { generateSlug } from '../../utils/helpers'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Scissors, Lock, ChevronRight } from 'lucide-react'

const BG     = '#0D0D0D'
const CARD   = '#171717'
const CARD2  = '#1F1F1F'
const BORDER = '#2A2A2A'
const ORANGE = '#FF6B1A'
const TXT    = '#F5F5F5'
const TXT2   = '#888888'
const TXT3   = '#555555'
const F      = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  * { box-sizing: border-box; }
  input { font-size: 16px !important; }
`

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <label style={{ display:'block', color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ type='text', value, onChange, placeholder, autoComplete, onFocus, onBlur, style={}, right }) {
  return (
    <div style={{ position:'relative' }}>
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete}
        style={{
          width:'100%', background:'transparent', border:'none',
          borderBottom:`1.5px solid ${BORDER}`, color:TXT,
          padding: right ? '10px 36px 10px 0' : '10px 0',
          fontSize:16, outline:'none', ...F,
          transition:'border-color 0.2s', ...style,
        }}
        onFocus={e => { e.target.style.borderBottomColor=ORANGE; onFocus?.(e) }}
        onBlur={e  => { e.target.style.borderBottomColor=BORDER; onBlur?.(e) }}
      />
      {right && <div style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)' }}>{right}</div>}
    </div>
  )
}

export default function BarberSignupPage() {
  const { signUpBarber } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'', password:'', confirm:'', code:'', shopName:'', address:'' })
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  async function handle(e) {
    e.preventDefault()
    const { firstName, lastName, email, phone, password, confirm, code, shopName, address } = form
    if (!firstName || !lastName || !email || !phone || !password || !confirm || !code || !shopName)
      return toast.error('Fill in all fields')
    if (password !== confirm) return toast.error('Passwords do not match')
    if (password.length < 6)  return toast.error('Password must be at least 6 characters')

    setLoading(true)
    try {
      const user = await signUpBarber({ firstName, lastName, email, phone, password, code })
      const slug = generateSlug(shopName)
      await setDoc(doc(db,'barbers',user.uid), {
        userId:user.uid, name:shopName, slug, bio:'', address:address||'',
        phone, email, photoURL:'', isActive:true, createdAt:serverTimestamp(),
      })
      await setDoc(doc(db,'availability',user.uid), {
        barberId:user.uid, workingDays:[1,2,3,4,5,6],
        startTime:'09:00', endTime:'18:00', slotDuration:15,
        breaks:[{startTime:'12:00',endTime:'13:00'}], blockedDates:[],
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
    <div style={{ minHeight:'100dvh', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 20px 60px', ...F }}>
      <style>{CSS}</style>

      <div style={{ width:'100%', maxWidth:440, animation:'fadeUp 0.3s ease both' }}>

        {/* Logo */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:36 }}>
          <div style={{ width:60, height:60, borderRadius:18, background:`linear-gradient(135deg,${ORANGE},#FF8C42)`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14, boxShadow:`0 8px 32px ${ORANGE}44` }}>
            <Scissors size={26} color="#fff" strokeWidth={2}/>
          </div>
          <h1 style={{ color:TXT, fontWeight:900, fontSize:24, margin:'0 0 4px', letterSpacing:'-0.5px' }}>AmadoBook</h1>
          <p style={{ color:TXT3, fontSize:13, margin:0 }}>Barber Management Platform</p>
        </div>

        {/* Card */}
        <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:24, padding:'28px 24px' }}>
          <h2 style={{ color:TXT, fontWeight:800, fontSize:22, margin:'0 0 6px', letterSpacing:'-0.3px' }}>Create account.</h2>
          <p style={{ color:TXT2, fontSize:14, margin:'0 0 28px' }}>You need an access code to register.</p>

          <form onSubmit={handle}>

            {/* Access code — highlighted */}
            <div style={{ background:`${ORANGE}10`, border:`1px solid ${ORANGE}33`, borderRadius:16, padding:'14px 16px', marginBottom:24 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <Lock size={13} color={ORANGE}/>
                <label style={{ color:ORANGE, fontSize:10, fontWeight:800, letterSpacing:'0.1em' }}>ACCESS CODE</label>
              </div>
              <Input value={form.code} onChange={set('code')} placeholder="Enter your access code" autoComplete="off"/>
              <p style={{ color:TXT3, fontSize:11, marginTop:8 }}>Contact AmadoBook to get your code.</p>
            </div>

            {/* Name row */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
              <div>
                <label style={{ display:'block', color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>FIRST NAME</label>
                <Input value={form.firstName} onChange={set('firstName')} placeholder="Angelo" autoComplete="given-name"/>
              </div>
              <div>
                <label style={{ display:'block', color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>LAST NAME</label>
                <Input value={form.lastName} onChange={set('lastName')} placeholder="Ferreras" autoComplete="family-name"/>
              </div>
            </div>

            <Field label="SHOP / BUSINESS NAME">
              <Input value={form.shopName} onChange={set('shopName')} placeholder="AmadoBlends" autoComplete="organization"/>
              <p style={{ color:TXT3, fontSize:11, marginTop:6 }}>Your booking link: /b/{form.shopName ? generateSlug(form.shopName) : 'amadoblends'}</p>
            </Field>

            <Field label="ADDRESS (OPTIONAL)">
              <Input value={form.address} onChange={set('address')} placeholder="647 Bleecker St, Utica, NY" autoComplete="street-address"/>
            </Field>

            <Field label="PHONE">
              <Input type="tel" value={form.phone} onChange={set('phone')} placeholder="(315) 000-0000" autoComplete="tel"/>
            </Field>

            <Field label="EMAIL">
              <Input type="email" value={form.email} onChange={set('email')} placeholder="you@email.com" autoComplete="email"/>
            </Field>

            <Field label="PASSWORD">
              <Input
                type={showPw ? 'text' : 'password'} value={form.password}
                onChange={set('password')} placeholder="Min 6 characters" autoComplete="new-password"
                right={
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    style={{ background:'none', border:'none', color:TXT3, cursor:'pointer', padding:4, display:'flex' }}>
                    {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                }
              />
            </Field>

            <Field label="CONFIRM PASSWORD">
              <Input type="password" value={form.confirm} onChange={set('confirm')} placeholder="••••••••" autoComplete="new-password"/>
            </Field>

            <button type="submit" disabled={loading}
              style={{
                width:'100%', background:ORANGE, color:'#fff',
                border:'none', borderRadius:22, padding:'17px',
                fontWeight:700, fontSize:16, cursor: loading ? 'not-allowed' : 'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                ...F, boxShadow:`0 4px 24px ${ORANGE}44`,
                opacity: loading ? 0.7 : 1, transition:'opacity 0.15s',
                marginTop:8,
              }}>
              {loading && <div style={{ width:18, height:18, border:`2.5px solid rgba(255,255,255,0.4)`, borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>}
              {loading ? 'Creating account…' : 'Create Barber Account'}
            </button>
          </form>

          <p style={{ textAlign:'center', color:TXT2, fontSize:14, marginTop:24 }}>
            Already have an account?{' '}
            <Link to="/barber/login" style={{ color:ORANGE, fontWeight:700, textDecoration:'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}