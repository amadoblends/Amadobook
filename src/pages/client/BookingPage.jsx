import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration, generateTimeSlots } from '../../utils/helpers'
import { format, addDays, startOfDay, isSameDay, isToday } from 'date-fns'
import toast from 'react-hot-toast'

const F = { fontFamily: "'Monda', system-ui, sans-serif" }

// ── CSS DINÁMICO (Soporta Light/Dark) ──────────────────────────────────────
const CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  .step-slide { animation: slideUp 0.3s ease both; }

  .b-input {
    width:100%; background:transparent; border:none;
    border-bottom:1.5px solid var(--border); color:var(--text-pri);
    padding:12px 0 10px; font-size:15px; outline:none;
    transition:border-color 0.2s; font-family:'Monda',system-ui,sans-serif;
    box-sizing:border-box;
  }
  .b-input:focus { border-bottom-color:var(--text-pri); }
  .b-input::placeholder { color:var(--text-sec); opacity: 0.5; }

  .b-label {
    display:block; font-size:10px; color:var(--text-sec);
    letter-spacing:0.09em; text-transform:uppercase;
    margin-bottom:2px; font-family:'Monda',system-ui,sans-serif;
  }
  .b-field { margin-bottom:22px; }

  .btn-bw {
    width:100%; background:var(--text-pri); color:var(--bg);
    border:none; borderRadius:14px; padding:16px; 
    fontSize:15px; fontWeight:700; cursor:pointer;
    display:flex; alignItems:center; justifyContent:center; gap:8px;
    transition: opacity 0.2s;
  }
  .btn-bw:disabled { opacity: 0.3; cursor: not-allowed; }

  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
`

// ── Icons ─────────────────────────────────────────────────────────────────
const ChevL = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
const ChevR = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
const ClockIco = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>

// ── Service card ──────────────────────────────────────────────────────────
function SvcCard({ svc, selected, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:'100%', textAlign:'left', cursor:disabled?'not-allowed':'pointer', ...F,
      background: selected ? 'var(--text-pri)' : 'var(--card)',
      border: `1.5px solid ${selected ? 'var(--text-pri)' : 'var(--border)'}`,
      color: selected ? 'var(--bg)' : 'var(--text-pri)',
      borderRadius:16, padding:'14px 16px', marginBottom:10,
      opacity:disabled?0.3:1, transition:'all 0.2s',
      display:'flex', alignItems:'center', justifyContent:'space-between',
    }}>
      <div style={{ flex:1 }}>
        <p style={{ fontWeight:700, fontSize:15, margin:'0 0 3px' }}>{svc.name}</p>
        <p style={{ color: selected ? 'var(--border)' : 'var(--text-sec)', fontSize:12, margin:0, display:'flex', alignItems:'center', gap:4 }}>
          <ClockIco/>{formatDuration(svc.duration)}
        </p>
      </div>
      <p style={{ fontWeight:900, fontSize:16 }}>{formatCurrency(svc.price)}</p>
    </button>
  )
}

export default function BookingPage() {
  const { barberSlug } = useParams()
  const navigate = useNavigate()
  const { user, userData } = useAuth()

  const [step, setStep] = useState(0)
  const [barber, setBarber] = useState(null)
  const [services, setServices] = useState([])
  const [availability, setAvailability] = useState(null)
  const [barberAppts, setBarberAppts] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [selectedServices, setSelectedServices] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [availableSlots, setAvailableSlots] = useState([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [guestMode, setGuestMode] = useState(false)

  const totalDuration = selectedServices.reduce((s,v)=>s+(v.duration||0),0)
  const totalPrice    = selectedServices.reduce((s,v)=>s+(v.price||0),0)

  useEffect(()=>{
    async function load() {
      const bSnap = await getDocs(query(collection(db,'barbers'),where('slug','==',barberSlug)))
      const active = bSnap.docs.find(d=>d.data().isActive!==false)
      if (!active) { navigate(`/b/${barberSlug}`); return }
      const bd = {id:active.id,...active.data()}; setBarber(bd)
      const [sSnap,aSnap,apSnap] = await Promise.all([
        getDocs(query(collection(db,'services'),where('barberId','==',bd.id))),
        getDocs(query(collection(db,'availability'),where('barberId','==',bd.id))),
        getDocs(query(collection(db,'appointments'),where('barberId','==',bd.id))),
      ])
      setServices(sSnap.docs.map(d=>({id:d.id,...d.data()})).filter(s=>s.isActive!==false))
      if (!aSnap.empty) setAvailability(aSnap.docs[0].data())
      setBarberAppts(apSnap.docs.map(d=>d.data()))
      setLoading(false)
    }
    load()
    if (user && userData) {
      setName(`${userData.firstName||''} ${userData.lastName||''}`.trim())
      setEmail(userData.email || user.email || '')
      setPhone(userData.phone || '')
    }
  },[barberSlug, user, userData])

  // Lógica de slots (idéntica pero limpia)
  useEffect(()=>{
    if (!selectedDate||!availability||totalDuration===0) { setAvailableSlots([]); return }
    const dayIdx = selectedDate.getDay()
    const ds = availability.schedule?.[dayIdx]||{enabled:(availability.workingDays||[1,2,3,4,5,6]).includes(dayIdx),startTime:availability.startTime||'09:00',endTime:availability.endTime||'18:00',breaks:availability.breaks||[]}
    if (!ds.enabled) { setAvailableSlots([]); return }
    const dateStr = format(selectedDate,'yyyy-MM-dd')
    const existing = barberAppts.filter(a=>a.date===dateStr&&a.bookingStatus!=='cancelled').map(a=>({startTime:a.startTime,endTime:a.endTime}))
    let slots = generateTimeSlots(ds.startTime,ds.endTime,totalDuration,ds.breaks||[],existing)
    if (isToday(selectedDate)) { const nm=new Date().getHours()*60+new Date().getMinutes()+15; slots=slots.filter(sl=>{const[h,m]=sl.startTime.split(':').map(Number);return h*60+m>nm}) }
    setAvailableSlots(slots); setSelectedSlot(null)
  },[selectedDate,totalDuration,availability,barberAppts])

  function toggleService(svc) {
    if (svc.serviceType==='combo') { setSelectedServices(p=>p.find(s=>s.id===svc.id)?[]:[svc]) }
    else { if (selectedServices.some(s=>s.serviceType==='combo')) return; setSelectedServices(p=>p.find(s=>s.id===svc.id)?p.filter(s=>s.id!==svc.id):[...p,svc]) }
  }

  const canNext = () => {
    if (step===0) return selectedServices.length > 0
    if (step===1) return !!selectedSlot
    if (step===2) return user || (name.trim() && (email.trim() || phone.trim()))
    return true
  }

  async function submit() {
    setSubmitting(true)
    try {
      const clientName = user && userData ? `${userData.firstName} ${userData.lastName}`.trim() : name
      const clientEmail = user ? (user.email||email) : email
      await addDoc(collection(db,'appointments'),{
        barberId:barber.id, barberName:barber.name, barberSlug,
        clientId:user?.uid||null, clientName:clientName.trim(), clientEmail:clientEmail.trim(), clientPhone:phone.trim(),
        isGuest:!user, services:selectedServices.map(sv=>({id:sv.id,name:sv.name,price:sv.price,duration:sv.duration})),
        date:format(selectedDate,'yyyy-MM-dd'), startTime:selectedSlot.startTime, endTime:selectedSlot.endTime,
        totalDuration, totalPrice, paymentMethod:payMethod, paymentStatus:'pending', bookingStatus:'confirmed',
        createdAt:serverTimestamp(),
      })
      navigate(`/b/${barberSlug}/confirmed?name=${encodeURIComponent(clientName)}&date=${format(selectedDate,'yyyy-MM-dd')}&time=${selectedSlot.startTime}`)
    } catch(e) { toast.error('Error saving booking') }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:26, height:26, border:'2.5px solid var(--text-pri)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>
    </div>
  )

  const combos = services.filter(s=>s.serviceType==='combo')
  const singles = services.filter(s=>s.serviceType==='single')
  const extras = services.filter(s=>s.serviceType==='extra')

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', flexDirection:'column', ...F }}>
      <style>{CSS}</style>

      {/* Header — Fijo arriba, siempre Negro con texto Blanco (Contraste) */}
      <div style={{ position:'sticky', top:0, zIndex:20, background:'var(--text-pri)', padding:'12px 20px' }}>
        <div style={{ maxWidth:560, margin:'0 auto', display:'flex', alignItems:'center', gap:14 }}>
          <button onClick={()=>step>0?setStep(s=>s-1):navigate(`/b/${barberSlug}`)}
            style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:10, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
            <ChevL/>
          </button>
          <div style={{ flex:1 }}>
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', margin:0 }}>STEP {step + 1}</p>
            <div style={{ display:'flex', gap:4, marginTop:4 }}>
              {[0,1,2,3].map(i => <div key={i} style={{ height:3, flex:1, borderRadius:2, background: i <= step ? '#fff' : 'rgba(255,255,255,0.2)' }}/>)}
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div style={{ flex:1, padding:'32px 24px 140px', maxWidth:560, width:'100%', alignSelf:'center' }} className="step-slide">
        
        {step===0 && (
          <div>
            <h2 style={{ color:'var(--text-pri)', fontSize:26, fontWeight:800, marginBottom:8 }}>Select Services</h2>
            <p style={{ color:'var(--text-sec)', fontSize:14, marginBottom:24 }}>Choose your treatment</p>
            {combos.length > 0 && combos.map(s => <SvcCard key={s.id} svc={s} selected={!!selectedServices.find(sv=>sv.id===s.id)} onClick={()=>toggleService(s)}/>)}
            {singles.length > 0 && singles.map(s => <SvcCard key={s.id} svc={s} selected={!!selectedServices.find(sv=>sv.id===s.id)} onClick={()=>toggleService(s)} disabled={selectedServices.some(x=>x.serviceType==='combo')}/>)}
            {extras.length > 0 && selectedServices.length > 0 && (
              <div style={{ marginTop:20 }}>
                <p style={{ fontSize:11, fontWeight:700, color:'var(--text-sec)', marginBottom:10 }}>POPULAR ADD-ONS</p>
                {extras.map(s => <SvcCard key={s.id} svc={s} selected={!!selectedServices.find(sv=>sv.id===s.id)} onClick={()=>toggleService(s)}/>)}
              </div>
            )}
          </div>
        )}

        {step===1 && (
          <div>
            <h2 style={{ color:'var(--text-pri)', fontSize:26, fontWeight:800, marginBottom:24 }}>Pick a time</h2>
            {/* Aquí iría el DateStrip simplificado (puedes mantener el que tenías pero cambiando colores a variables) */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              {availableSlots.map(slot => (
                <button key={slot.startTime} onClick={()=>setSelectedSlot(slot)}
                  style={{ padding:'14px 4px', borderRadius:12, border:`1.5px solid ${selectedSlot?.startTime===slot.startTime?'var(--text-pri)':'var(--border)'}`, background:selectedSlot?.startTime===slot.startTime?'var(--text-pri)':'var(--card)', color:selectedSlot?.startTime===slot.startTime?'var(--bg)':'var(--text-pri)', fontWeight:700, fontSize:13, cursor:'pointer', ...F }}>
                  {slot.startTime}
                </button>
              ))}
            </div>
          </div>
        )}

        {step===2 && (
          <div>
            <h2 style={{ color:'var(--text-pri)', fontSize:26, fontWeight:800, marginBottom:24 }}>Your Info</h2>
            {!user && !guestMode ? (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:24, textAlign:'center' }}>
                <p style={{ fontWeight:700, marginBottom:16 }}>Want to save time next time?</p>
                <button onClick={()=>navigate(`/b/${barberSlug}/auth`)} className="btn-bw" style={{ marginBottom:12 }}>Sign In / Sign Up</button>
                <button onClick={()=>setGuestMode(true)} style={{ background:'none', border:'none', color:'var(--text-sec)', fontSize:13, cursor:'pointer' }}>Continue as Guest →</button>
              </div>
            ) : (
              <div className="animate-fadein">
                <div className="b-field">
                  <label className="b-label">Full Name</label>
                  <input className="b-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Angelo Ferreras"/>
                </div>
                <div className="b-field">
                  <label className="b-label">Email Address</label>
                  <input className="b-input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="angelo@example.com"/>
                </div>
                <div className="b-field">
                  <label className="b-label">Phone (Optional)</label>
                  <input className="b-input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(315) 000-0000"/>
                </div>
              </div>
            )}
          </div>
        )}

        {step===3 && (
          <div>
            <h2 style={{ color:'var(--text-pri)', fontSize:26, fontWeight:800, marginBottom:24 }}>Review</h2>
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', paddingBottom:12, borderBottom:'1px solid var(--border)' }}>
                <span style={{ color:'var(--text-sec)' }}>Date & Time</span>
                <span style={{ fontWeight:700 }}>{format(selectedDate,'MMM d')} @ {selectedSlot.startTime}</span>
              </div>
              <div style={{ paddingTop:12 }}>
                {selectedServices.map(s => (
                  <div key={s.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:14 }}>{s.name}</span>
                    <span style={{ fontWeight:700 }}>{formatCurrency(s.price)}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:16, paddingTop:16, borderTop:'2px solid var(--text-pri)', display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:800, fontSize:18 }}>Total</span>
                <span style={{ fontWeight:900, fontSize:22 }}>{formatCurrency(totalPrice)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botón Flotante Inferior */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'20px 24px 40px', background:'linear-gradient(to top, var(--bg) 80%, transparent)', zIndex:30 }}>
        <div style={{ maxWidth:560, margin:'0 auto' }}>
          {step < 3 ? (
            <button className="btn-bw" onClick={()=>canNext() ? setStep(s=>s+1) : toast.error('Please complete this step')} disabled={!canNext()}>
              Continue <ChevR/>
            </button>
          ) : (
            <button className="btn-bw" onClick={submit} disabled={submitting}>
              {submitting ? 'Confirming...' : 'Confirm Appointment'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}