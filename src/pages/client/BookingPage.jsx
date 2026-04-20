/**
 * BookingPage — iPhone optimized, B&W, working date+time picker
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'
import { formatCurrency, formatDuration, generateTimeSlots } from '../../utils/helpers'
import { format, addDays, startOfDay, isSameDay, isToday } from 'date-fns'
import toast from 'react-hot-toast'

const F = { fontFamily:"'Monda',system-ui,sans-serif" }

const CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .fade-up { animation: fadeUp 0.25s ease both; }

  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  button { touch-action:manipulation; }

  /* iPhone: font-size ≥16px prevents zoom on input focus */
  input, select, textarea { font-size:16px !important; font-family:'Monda',system-ui,sans-serif; }

  .field-label {
    display:block; font-size:11px; color:#888;
    letter-spacing:0.08em; text-transform:uppercase; margin-bottom:4px;
  }
  .field-input {
    width:100%; background:transparent; border:none;
    border-bottom:1.5px solid #E0E0E0; color:#0A0A0A;
    padding:10px 0 8px; font-size:16px; outline:none;
    transition:border-color 0.2s;
  }
  .field-input:focus { border-bottom-color:#0A0A0A; }
  .field-input::placeholder { color:#C0C0C0; }
  .field-wrap { margin-bottom:20px; }

  .btn-primary {
    width:100%; background:#0A0A0A; color:#fff;
    border:none; border-radius:22px; padding:18px 24px;
    font-size:16px; font-weight:700; cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:8px;
    font-family:'Monda',system-ui,sans-serif; transition:opacity 0.15s;
    -webkit-appearance:none;
  }
  .btn-primary:disabled { opacity:0.35; cursor:not-allowed; }
  .btn-primary:active { opacity:0.85; }
  .btn-outline {
    width:100%; background:transparent; color:#0A0A0A;
    border:1.5px solid #E0E0E0; border-radius:22px; padding:16px 24px;
    font-size:15px; font-weight:600; cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:8px;
    font-family:'Monda',system-ui,sans-serif;
  }
`

// ── Icons ─────────────────────────────────────────────────────────────────
const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M15 18l-6-6 6-6"/>
  </svg>
)
const ChevR = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
)
const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
)
const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
  </svg>
)

// ── Step dots ─────────────────────────────────────────────────────────────
function StepDots({ step, total = 4 }) {
  return (
    <div style={{ display:'flex', gap:5 }}>
      {Array.from({length:total}).map((_,i) => (
        <div key={i} style={{ height:3, borderRadius:2, flex:1, background:i<=step?'#fff':'rgba(255,255,255,0.2)', transition:'background 0.3s' }}/>
      ))}
    </div>
  )
}

// ── Service card ──────────────────────────────────────────────────────────
function SvcCard({ svc, selected, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:'100%', textAlign:'left', cursor:disabled?'not-allowed':'pointer',
      background: selected ? '#0A0A0A' : '#F7F7F7',
      border: `1.5px solid ${selected?'#0A0A0A':'#E8E8E8'}`,
      borderRadius:16, padding:'14px 16px', marginBottom:10,
      opacity:disabled?0.3:1, display:'flex', alignItems:'center',
      justifyContent:'space-between', transition:'all 0.15s', ...F,
    }}>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ color:selected?'#fff':'#0A0A0A', fontWeight:700, fontSize:15, margin:'0 0 3px' }}>{svc.name}</p>
        <p style={{ color:selected?'rgba(255,255,255,0.6)':'#888', fontSize:12, margin:0, display:'flex', alignItems:'center', gap:4 }}>
          <ClockIcon/>{formatDuration(svc.duration)}
          {svc.description && ` · ${svc.description}`}
        </p>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0, marginLeft:12 }}>
        <p style={{ color:selected?'#fff':'#0A0A0A', fontWeight:900, fontSize:16 }}>{formatCurrency(svc.price)}</p>
        <div style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${selected?'rgba(255,255,255,0.6)':'#CCC'}`, background:selected?'rgba(255,255,255,0.2)':'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {selected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
        </div>
      </div>
    </button>
  )
}

// ── Date strip ────────────────────────────────────────────────────────────
function DateStrip({ availability, barberAppts, duration, selected, onSelect }) {
  const [page, setPage] = useState(0)
  const today    = startOfDay(new Date())
  const advance  = availability?.advanceDays || 30
  const allDays  = Array.from({length:advance}, (_,i) => addDays(today,i))
  const perPage  = 7
  const maxPage  = Math.ceil(allDays.length / perPage) - 1
  const visible  = allDays.slice(page*perPage, (page+1)*perPage)

  function slotCount(date) {
    const dayIdx = date.getDay()
    const ds = availability?.schedule?.[dayIdx] ?? {
      enabled: (availability?.workingDays||[1,2,3,4,5,6]).includes(dayIdx),
      startTime: availability?.startTime||'09:00',
      endTime:   availability?.endTime  ||'18:00',
      breaks:    availability?.breaks   ||[],
    }
    if (!ds.enabled) return 0
    const dateStr = format(date,'yyyy-MM-dd')
    if (availability?.blockedDates?.includes(dateStr)) return 0
    const existing = (barberAppts||[])
      .filter(a => a.date===dateStr && a.bookingStatus!=='cancelled')
      .map(a => ({ startTime:a.startTime, endTime:a.endTime }))
    let slots = generateTimeSlots(ds.startTime, ds.endTime, duration, ds.breaks||[], existing)
    if (isSameDay(date, new Date())) {
      const nm = new Date().getHours()*60 + new Date().getMinutes() + 15
      slots = slots.filter(sl => {
        const [h,m] = sl.startTime.split(':').map(Number)
        return h*60+m > nm
      })
    }
    return slots.length
  }

  return (
    <div>
      {/* Week nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
          style={{ background:page===0?'#F0F0F0':'#0A0A0A', border:'none', borderRadius:9, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:page===0?'not-allowed':'pointer', color:page===0?'#CCC':'#fff', opacity:page===0?0.4:1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span style={{ color:'#555', fontSize:13, fontWeight:700 }}>
          {format(visible[0],'MMM d')} – {format(visible[visible.length-1],'MMM d')}
        </span>
        <button onClick={()=>setPage(p=>Math.min(maxPage,p+1))} disabled={page===maxPage}
          style={{ background:page===maxPage?'#F0F0F0':'#0A0A0A', border:'none', borderRadius:9, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:page===maxPage?'not-allowed':'pointer', color:page===maxPage?'#CCC':'#fff', opacity:page===maxPage?0.4:1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Day buttons */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5 }}>
        {visible.map((date,i) => {
          const count = slotCount(date)
          const isSel = selected && isSameDay(date,selected)
          const full  = count === 0
          return (
            <button key={i} onClick={()=>!full&&onSelect(date)} disabled={full}
              style={{ padding:'10px 2px', borderRadius:14, border:`1.5px solid ${isSel?'#0A0A0A':'#E8E8E8'}`, cursor:full?'not-allowed':'pointer', background:isSel?'#0A0A0A':'#fff', opacity:full?0.3:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, transition:'all 0.15s' }}>
              <span style={{ color:isSel?'rgba(255,255,255,0.6)':'#888', fontSize:9, fontWeight:700 }}>{format(date,'EEE').toUpperCase()}</span>
              <span style={{ color:isSel?'#fff':isToday(date)?'#0A0A0A':'#333', fontSize:15, fontWeight:800 }}>{format(date,'d')}</span>
              <span style={{ fontSize:9, fontWeight:700, color:isSel?'rgba(255,255,255,0.7)':count>0?'#22C55E':'#EF4444' }}>
                {full?'—':`${count}`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function BookingPage() {
  const { barberSlug } = useParams()
  const navigate       = useNavigate()
  const { user, userData } = useAuth()

  const [step, setStep]         = useState(0)
  const [barber, setBarber]     = useState(null)
  const [services, setServices] = useState([])
  const [availability, setAvailability] = useState(null)
  const [barberAppts, setBarberAppts]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [selectedServices, setSelectedServices] = useState([])
  const [selectedDate, setSelectedDate]         = useState(null)
  const [selectedSlot, setSelectedSlot]         = useState(null)
  const [availableSlots, setAvailableSlots]     = useState([])
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [guestMode, setGuestMode] = useState(!!user) // if logged in, skip guest prompt

  const totalDuration = selectedServices.reduce((s,v)=>s+(v.duration||0),0)
  const totalPrice    = selectedServices.reduce((s,v)=>s+(v.price||0),0)

  // Load barber data once
  useEffect(() => {
    async function load() {
      try {
        const bSnap = await getDocs(query(collection(db,'barbers'),where('slug','==',barberSlug)))
        const active = bSnap.docs.find(d=>d.data().isActive!==false)
        if (!active) { navigate(`/b/${barberSlug}`); return }
        const bd = {id:active.id,...active.data()}
        setBarber(bd)
        const [sSnap,aSnap,apSnap] = await Promise.all([
          getDocs(query(collection(db,'services'),where('barberId','==',bd.id))),
          getDocs(query(collection(db,'availability'),where('barberId','==',bd.id))),
          getDocs(query(collection(db,'appointments'),where('barberId','==',bd.id))),
        ])
        setServices(sSnap.docs.map(d=>({id:d.id,...d.data()})).filter(s=>s.isActive!==false))
        if (!aSnap.empty) setAvailability(aSnap.docs[0].data())
        setBarberAppts(apSnap.docs.map(d=>d.data()))
      } catch(e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [barberSlug])

  // Prefill user info
  useEffect(() => {
    if (user && userData) {
      setName(`${userData.firstName||''} ${userData.lastName||''}`.trim())
      setEmail(userData.email||user.email||'')
      setPhone(userData.phone||'')
      setGuestMode(true)
    }
  }, [user?.uid])

  // Compute slots when date changes
  useEffect(() => {
    if (!selectedDate || !availability || totalDuration===0) { setAvailableSlots([]); return }
    const dayIdx = selectedDate.getDay()
    const ds = availability.schedule?.[dayIdx] ?? {
      enabled: (availability.workingDays||[1,2,3,4,5,6]).includes(dayIdx),
      startTime: availability.startTime||'09:00',
      endTime:   availability.endTime  ||'18:00',
      breaks:    availability.breaks   ||[],
    }
    if (!ds.enabled) { setAvailableSlots([]); return }
    const dateStr = format(selectedDate,'yyyy-MM-dd')
    const existing = barberAppts
      .filter(a=>a.date===dateStr&&a.bookingStatus!=='cancelled')
      .map(a=>({startTime:a.startTime,endTime:a.endTime}))
    let slots = generateTimeSlots(ds.startTime,ds.endTime,totalDuration,ds.breaks||[],existing)
    if (isToday(selectedDate)) {
      const nm = new Date().getHours()*60+new Date().getMinutes()+15
      slots = slots.filter(sl=>{const[h,m]=sl.startTime.split(':').map(Number);return h*60+m>nm})
    }
    setAvailableSlots(slots)
    setSelectedSlot(null)
  }, [selectedDate, totalDuration, availability, barberAppts])

  function toggleService(svc) {
    if (svc.serviceType==='combo') {
      setSelectedServices(p=>p.find(s=>s.id===svc.id)?[]:[svc])
    } else {
      if (selectedServices.some(s=>s.serviceType==='combo')) return
      setSelectedServices(p=>p.find(s=>s.id===svc.id)?p.filter(s=>s.id!==svc.id):[...p,svc])
    }
  }

  function canNext() {
    if (step===0) return selectedServices.length>0
    if (step===1) return !!selectedDate && !!selectedSlot
    if (step===2) return guestMode ? (name.trim()&&(email.trim()||phone.trim())) : !!user
    return true
  }

  async function submit() {
    setSubmitting(true)
    try {
      const clientName  = user&&userData ? `${userData.firstName} ${userData.lastName}`.trim() : name
      const clientEmail = user ? (user.email||email) : email
      const clientPhone = user&&userData ? (userData.phone||phone) : phone
      await addDoc(collection(db,'appointments'),{
        barberId:barber.id, barberName:barber.name, barberSlug,
        clientId:user?.uid||null, clientName:clientName.trim(),
        clientEmail:clientEmail.trim(), clientPhone:clientPhone.trim(),
        isGuest:!user,
        services:selectedServices.map(sv=>({id:sv.id,name:sv.name,price:sv.price,duration:sv.duration})),
        date:format(selectedDate,'yyyy-MM-dd'),
        startTime:selectedSlot.startTime, endTime:selectedSlot.endTime,
        totalDuration, totalPrice, paymentMethod:payMethod,
        paymentStatus:'pending', bookingStatus:'confirmed',
        createdAt:serverTimestamp(),
      })
      navigate(`/b/${barberSlug}/confirmed?name=${encodeURIComponent(clientName)}&date=${format(selectedDate,'yyyy-MM-dd')}&time=${selectedSlot.startTime}`)
    } catch(e) { console.error(e); toast.error('Could not save booking') }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div style={{ minHeight:'100dvh', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:26, height:26, border:'2.5px solid #0A0A0A', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const combos  = services.filter(s=>s.serviceType==='combo')
  const singles = services.filter(s=>s.serviceType==='single')
  const extras  = services.filter(s=>s.serviceType==='extra')

  return (
    <div style={{ minHeight:'100dvh', background:'#fff', display:'flex', flexDirection:'column', ...F }}>
      <style>{CSS}</style>

      {/* ── Header ── always black ── */}
      <div style={{ position:'sticky', top:0, zIndex:20, background:'#0A0A0A', padding:'14px 20px', paddingTop:'max(14px, env(safe-area-inset-top))' }}>
        <div style={{ maxWidth:480, margin:'0 auto', display:'flex', alignItems:'center', gap:14 }}>
          <button
            onClick={() => step>0 ? setStep(s=>s-1) : navigate(user?`/b/${barberSlug}/dashboard`:`/b/${barberSlug}`)}
            style={{ background:'rgba(255,255,255,0.12)', border:'none', borderRadius:10, width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff', flexShrink:0 }}>
            <BackIcon/>
          </button>
          <div style={{ flex:1 }}>
            <p style={{ color:'rgba(255,255,255,0.45)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', margin:'0 0 6px' }}>
              {['SELECT SERVICE','PICK DATE & TIME','YOUR INFO','CONFIRM'][step]}
            </p>
            <StepDots step={step}/>
          </div>
          {totalPrice>0 && (
            <p style={{ color:'#fff', fontWeight:900, fontSize:17, flexShrink:0 }}>{formatCurrency(totalPrice)}</p>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="fade-up" style={{ flex:1, padding:'28px 20px 140px', maxWidth:480, width:'100%', alignSelf:'center', boxSizing:'border-box' }}>

        {/* STEP 0 — Services */}
        {step===0 && (
          <div>
            <h2 style={{ color:'#0A0A0A', fontSize:24, fontWeight:800, margin:'0 0 4px', letterSpacing:'-0.3px' }}>
              Choose a service
            </h2>
            <p style={{ color:'#888', fontSize:14, margin:'0 0 22px' }}>Select what you need</p>

            {combos.length>0 && (
              <div style={{ marginBottom:16 }}>
                <p style={{ color:'#888', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>COMBOS</p>
                {combos.map(s=><SvcCard key={s.id} svc={s} selected={!!selectedServices.find(sv=>sv.id===s.id)} onClick={()=>toggleService(s)}/>)}
              </div>
            )}
            {singles.length>0 && (
              <div style={{ marginBottom:16 }}>
                {combos.length>0 && <p style={{ color:'#888', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>SERVICES</p>}
                {singles.map(s=><SvcCard key={s.id} svc={s} selected={!!selectedServices.find(sv=>sv.id===s.id)} onClick={()=>toggleService(s)} disabled={selectedServices.some(x=>x.serviceType==='combo')}/>)}
              </div>
            )}
            {extras.length>0 && selectedServices.length>0 && (
              <div>
                <p style={{ color:'#888', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>ADD-ONS</p>
                {extras.map(s=><SvcCard key={s.id} svc={s} selected={!!selectedServices.find(sv=>sv.id===s.id)} onClick={()=>toggleService(s)}/>)}
              </div>
            )}
          </div>
        )}

        {/* STEP 1 — Date & Time */}
        {step===1 && (
          <div>
            <h2 style={{ color:'#0A0A0A', fontSize:24, fontWeight:800, margin:'0 0 4px', letterSpacing:'-0.3px' }}>
              Pick a date & time
            </h2>
            <p style={{ color:'#888', fontSize:14, margin:'0 0 22px' }}>
              Numbers = available slots for {formatDuration(totalDuration)}
            </p>

            {/* Date strip */}
            <div style={{ background:'#F7F7F7', borderRadius:18, padding:16, marginBottom:20 }}>
              <DateStrip
                availability={availability}
                barberAppts={barberAppts}
                duration={totalDuration}
                selected={selectedDate}
                onSelect={d=>{ setSelectedDate(d); setSelectedSlot(null) }}
              />
            </div>

            {/* Time slots */}
            {selectedDate ? (
              <div>
                <p style={{ color:'#0A0A0A', fontSize:11, fontWeight:700, letterSpacing:'0.09em', marginBottom:14 }}>
                  {format(selectedDate,'EEEE, MMMM d').toUpperCase()}
                </p>
                {availableSlots.length===0 ? (
                  <div style={{ background:'#F7F7F7', borderRadius:14, padding:'24px', textAlign:'center' }}>
                    <p style={{ color:'#888', fontWeight:600, margin:'0 0 4px' }}>No available times</p>
                    <p style={{ color:'#BBB', fontSize:13, margin:0 }}>Pick a different day</p>
                  </div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                    {availableSlots.map(slot => {
                      const isSel = selectedSlot?.startTime===slot.startTime
                      return (
                        <button key={slot.startTime} onClick={()=>setSelectedSlot(slot)}
                          style={{ padding:'14px 2px', borderRadius:13, border:`1.5px solid ${isSel?'#0A0A0A':'#E5E5E5'}`, background:isSel?'#0A0A0A':'#fff', color:isSel?'#fff':'#333', fontWeight:700, fontSize:13, cursor:'pointer', ...F, transition:'all 0.15s' }}>
                          {slot.startTime}
                        </button>
                      )
                    })}
                  </div>
                )}

                {selectedSlot && (
                  <div style={{ marginTop:14, background:'#F0F0F0', borderRadius:13, padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
                    <ClockIcon/>
                    <div>
                      <p style={{ color:'#0A0A0A', fontWeight:800, fontSize:15, margin:0 }}>{selectedSlot.startTime} – {selectedSlot.endTime}</p>
                      <p style={{ color:'#888', fontSize:12, margin:0 }}>{format(selectedDate,'MMMM d, yyyy')}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'32px 0', color:'#CCC' }}>
                <p style={{ fontSize:14 }}>Select a date above to see available times</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — Info */}
        {step===2 && (
          <div>
            <h2 style={{ color:'#0A0A0A', fontSize:24, fontWeight:800, margin:'0 0 4px', letterSpacing:'-0.3px' }}>Your info</h2>
            <p style={{ color:'#888', fontSize:14, margin:'0 0 24px' }}>How we'll confirm your appointment</p>

            {user ? (
              /* Logged in */
              <div style={{ background:'#F0FFF4', border:'1px solid #BBF7D0', borderRadius:14, padding:'14px 16px', marginBottom:20 }}>
                <p style={{ color:'#16A34A', fontWeight:800, fontSize:14, margin:'0 0 2px' }}>Signed in ✓</p>
                <p style={{ color:'#555', fontSize:13, margin:0 }}>{userData?.firstName} {userData?.lastName}</p>
              </div>
            ) : !guestMode ? (
              /* Choose auth or guest */
              <div style={{ background:'#F7F7F7', border:'1px solid #E5E5E5', borderRadius:18, padding:'20px', marginBottom:16 }}>
                <p style={{ color:'#0A0A0A', fontWeight:700, fontSize:16, margin:'0 0 6px' }}>Want reminders?</p>
                <p style={{ color:'#888', fontSize:14, margin:'0 0 18px' }}>Sign in to track history and get booking reminders.</p>
                <button className="btn-primary" onClick={()=>navigate(`/b/${barberSlug}/auth`)} style={{ marginBottom:10 }}>
                  Sign In / Sign Up
                </button>
                <button className="btn-outline" onClick={()=>setGuestMode(true)}>
                  Continue as Guest
                </button>
              </div>
            ) : (
              /* Guest / user form */
              <div>
                {!user && (
                  <p style={{ color:'#888', fontSize:12, margin:'0 0 18px', display:'flex', alignItems:'center', gap:5 }}>
                    Guest — info used for this booking only
                  </p>
                )}
                <div className="field-wrap">
                  <label className="field-label">Full Name</label>
                  <input className="field-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Angelo Ferreras" autoComplete="name"/>
                </div>
                <div className="field-wrap">
                  <label className="field-label">Email</label>
                  <input className="field-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email"/>
                </div>
                <div className="field-wrap" style={{ marginBottom:0 }}>
                  <label className="field-label">Phone (optional)</label>
                  <input className="field-input" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(315) 000-0000" autoComplete="tel"/>
                </div>
              </div>
            )}

            {/* Payment */}
            {(user || guestMode) && (
              <div style={{ marginTop:24 }}>
                <p style={{ color:'#888', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:12 }}>PAYMENT METHOD</p>
                <div style={{ display:'flex', gap:8 }}>
                  {[['cash','Cash'],['card','Card'],['zelle','Zelle']].map(([id,lbl])=>(
                    <button key={id} onClick={()=>setPayMethod(id)}
                      style={{ flex:1, padding:'12px', borderRadius:22, border:`1.5px solid ${payMethod===id?'#0A0A0A':'#E5E5E5'}`, background:payMethod===id?'#0A0A0A':'#fff', color:payMethod===id?'#fff':'#888', fontWeight:700, fontSize:14, cursor:'pointer', ...F, transition:'all 0.15s' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3 — Confirm */}
        {step===3 && (
          <div>
            <h2 style={{ color:'#0A0A0A', fontSize:24, fontWeight:800, margin:'0 0 4px', letterSpacing:'-0.3px' }}>Confirm</h2>
            <p style={{ color:'#888', fontSize:14, margin:'0 0 22px' }}>Review your appointment</p>

            <div style={{ background:'#F7F7F7', border:'1px solid #E5E5E5', borderRadius:18, padding:'18px', marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #E8E8E8' }}>
                <span style={{ color:'#888', fontSize:14 }}>Date</span>
                <span style={{ color:'#0A0A0A', fontWeight:700 }}>{selectedDate && format(selectedDate,'EEE, MMM d, yyyy')}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #E8E8E8' }}>
                <span style={{ color:'#888', fontSize:14 }}>Time</span>
                <span style={{ color:'#0A0A0A', fontWeight:700 }}>{selectedSlot?.startTime} – {selectedSlot?.endTime}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #E8E8E8' }}>
                <span style={{ color:'#888', fontSize:14 }}>Duration</span>
                <span style={{ color:'#0A0A0A', fontWeight:700 }}>{formatDuration(totalDuration)}</span>
              </div>
              <div style={{ height:1, background:'#E0E0E0', margin:'8px 0' }}/>
              {selectedServices.map(s=>(
                <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0' }}>
                  <span style={{ color:'#333', fontSize:14 }}>{s.name}</span>
                  <span style={{ color:'#0A0A0A', fontWeight:700 }}>{formatCurrency(s.price)}</span>
                </div>
              ))}
              <div style={{ height:1, background:'#E0E0E0', margin:'8px 0' }}/>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0' }}>
                <span style={{ color:'#0A0A0A', fontWeight:800, fontSize:17 }}>Total</span>
                <span style={{ color:'#0A0A0A', fontWeight:900, fontSize:20 }}>{formatCurrency(totalPrice)}</span>
              </div>
            </div>

            <div style={{ background:'#F7F7F7', border:'1px solid #E5E5E5', borderRadius:14, padding:'12px 16px', marginBottom:12 }}>
              <p style={{ color:'#888', fontSize:11, margin:'0 0 3px' }}>CLIENT</p>
              <p style={{ color:'#0A0A0A', fontWeight:700, margin:'0 0 2px' }}>
                {user ? `${userData?.firstName} ${userData?.lastName}` : name}
              </p>
              <p style={{ color:'#888', fontSize:13, margin:0 }}>{user ? user.email : email} · {payMethod}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Fixed bottom button ── */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'16px 20px', paddingBottom:'max(24px,env(safe-area-inset-bottom))', background:'linear-gradient(to top,#fff 75%,transparent)', zIndex:30 }}>
        <div style={{ maxWidth:480, margin:'0 auto' }}>
          {step<3 ? (
            <button className="btn-primary"
              onClick={()=> canNext() ? setStep(s=>s+1) : toast.error(
                step===0?'Select a service':
                step===1?'Select a date and time':
                'Enter your name and email'
              )}
              disabled={!canNext()}>
              Continue <ChevR/>
            </button>
          ) : (
            <button className="btn-primary" onClick={submit} disabled={submitting}>
              {submitting
                ? <div style={{width:18,height:18,border:'2.5px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/>
                : <CheckIcon/>}
              {submitting?'Booking…':'Confirm Appointment'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}