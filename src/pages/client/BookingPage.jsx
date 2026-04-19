/**
 * BookingPage — Black & White
 * Steps: Service → Date & Time → Info → Confirm
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration, generateTimeSlots } from '../../utils/helpers'
import { format, addDays, startOfDay, isSameDay, isToday } from 'date-fns'
import toast from 'react-hot-toast'

const F = { fontFamily:"'Monda', system-ui, sans-serif" }

// ── CSS ───────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  .step-slide { animation: slideUp 0.3s ease both; }

  .b-input {
    width:100%; background:transparent; border:none;
    border-bottom:1.5px solid #E0E0E0; color:#0A0A0A;
    padding:12px 0 10px; font-size:15px; outline:none;
    transition:border-color 0.2s; font-family:'Monda',system-ui,sans-serif;
    box-sizing:border-box;
  }
  .b-input:focus { border-bottom-color:#0A0A0A; }
  .b-input::placeholder { color:#C4C4C4; }

  .b-label {
    display:block; font-size:10px; color:#9A9A9A;
    letter-spacing:0.09em; text-transform:uppercase;
    margin-bottom:2px; font-family:'Monda',system-ui,sans-serif;
  }
  .b-field { margin-bottom:22px; }

  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  button { touch-action:manipulation; }
`

// ── Icons ─────────────────────────────────────────────────────────────────
const ChevL = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
const ChevR = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
const CheckIco = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
const ClockIco = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
const UserXIco = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="23" y2="14"/><line x1="23" y1="8" x2="17" y2="14"/></svg>
const Spinner = () => <div style={{ width:18, height:18, border:'2.5px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>

// ── Step dots ─────────────────────────────────────────────────────────────
function StepDots({ step, total }) {
  return (
    <div style={{ display:'flex', gap:5 }}>
      {Array.from({length:total}).map((_,i) => (
        <div key={i} style={{ height:3, borderRadius:2, background:i<=step?'#fff':'rgba(255,255,255,0.2)', width:i===step?18:6, transition:'width 0.3s, background 0.3s' }}/>
      ))}
    </div>
  )
}

// ── Service card ──────────────────────────────────────────────────────────
function SvcCard({ svc, selected, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:'100%', textAlign:'left', cursor:disabled?'not-allowed':'pointer', ...F,
      background: selected ? '#0A0A0A' : '#F7F7F7',
      border: `1.5px solid ${selected ? '#0A0A0A' : '#E5E5E5'}`,
      borderRadius:14, padding:'14px 16px', marginBottom:8,
      opacity:disabled?0.35:1, transition:'all 0.18s',
      display:'flex', alignItems:'center', justifyContent:'space-between',
    }}>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ color:selected?'#fff':'#0A0A0A', fontWeight:700, fontSize:15, margin:'0 0 3px' }}>{svc.name}</p>
        <p style={{ color:selected?'rgba(255,255,255,0.55)':'#888', fontSize:12, margin:0, display:'flex', alignItems:'center', gap:4 }}>
          <ClockIco/>{formatDuration(svc.duration)}{svc.description&&` · ${svc.description}`}
        </p>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0, marginLeft:12 }}>
        <p style={{ color:selected?'#fff':'#0A0A0A', fontWeight:900, fontSize:15 }}>{formatCurrency(svc.price)}</p>
        <div style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${selected?'rgba(255,255,255,0.5)':'#CCC'}`, background:selected?'rgba(255,255,255,0.25)':'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {selected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
        </div>
      </div>
    </button>
  )
}

// ── Date strip ────────────────────────────────────────────────────────────
function DateStrip({ availability, barberAppts, duration, selected, onSelect }) {
  const [offset, setOffset] = useState(0)
  const today   = startOfDay(new Date())
  const advance = availability?.advanceDays || 30
  const days    = Array.from({length:advance},(_,i)=>addDays(today,i))
  const perPage = 7
  const visible = days.slice(offset*perPage,(offset+1)*perPage)

  function slotCount(date) {
    const dayIdx = date.getDay()
    const ds = availability?.schedule?.[dayIdx] || {
      enabled:(availability?.workingDays||[1,2,3,4,5,6]).includes(dayIdx),
      startTime:availability?.startTime||'09:00', endTime:availability?.endTime||'18:00', breaks:availability?.breaks||[],
    }
    if (!ds.enabled) return 0
    const dateStr = format(date,'yyyy-MM-dd')
    if (availability?.blockedDates?.includes(dateStr)) return 0
    const existing = (barberAppts||[]).filter(a=>a.date===dateStr&&a.bookingStatus!=='cancelled').map(a=>({startTime:a.startTime,endTime:a.endTime}))
    let s = generateTimeSlots(ds.startTime,ds.endTime,duration,ds.breaks||[],existing)
    if (isSameDay(date,new Date())) {
      const nm = new Date().getHours()*60+new Date().getMinutes()+15
      s = s.filter(sl=>{const[h,m]=sl.startTime.split(':').map(Number);return h*60+m>nm})
    }
    return s.length
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <button onClick={()=>setOffset(o=>Math.max(0,o-1))} disabled={offset===0}
          style={{ background:'#F0F0F0', border:'none', borderRadius:9, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:offset===0?'not-allowed':'pointer', color:'#888', opacity:offset===0?0.35:1 }}>
          <ChevL/>
        </button>
        <span style={{ color:'#888', fontSize:12, fontWeight:600 }}>
          {format(visible[0],'MMM d')} – {format(visible[visible.length-1],'MMM d')}
        </span>
        <button onClick={()=>setOffset(o=>(o+1)*perPage<advance?o+1:o)} disabled={(offset+1)*perPage>=advance}
          style={{ background:'#F0F0F0', border:'none', borderRadius:9, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:(offset+1)*perPage>=advance?'not-allowed':'pointer', color:'#888', opacity:(offset+1)*perPage>=advance?0.35:1 }}>
          <ChevR/>
        </button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5 }}>
        {visible.map((date,i)=>{
          const count = slotCount(date)
          const isSel = selected && isSameDay(date,selected)
          const full  = count === 0
          return (
            <button key={i} onClick={()=>!full&&onSelect(date)} disabled={full}
              style={{ padding:'10px 2px', borderRadius:12, border:`1.5px solid ${isSel?'#0A0A0A':'#E8E8E8'}`, cursor:full?'not-allowed':'pointer',
                background:isSel?'#0A0A0A':'#fff', opacity:full?0.25:1,
                display:'flex', flexDirection:'column', alignItems:'center', gap:4, transition:'all 0.15s',
              }}>
              <span style={{ color:isSel?'rgba(255,255,255,0.6)':'#888', fontSize:9, fontWeight:700 }}>{format(date,'EEE').toUpperCase()}</span>
              <span style={{ color:isSel?'#fff':isToday(date)?'#0A0A0A':'#333', fontSize:14, fontWeight:800 }}>{format(date,'d')}</span>
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
  const navigate = useNavigate()
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
  const [name, setName]     = useState('')
  const [email, setEmail]   = useState('')
  const [phone, setPhone]   = useState('')
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
    if (user&&userData) { setName(`${userData.firstName||''} ${userData.lastName||''}`.trim()); setEmail(userData.email||user.email||''); setPhone(userData.phone||'') }
  },[barberSlug])

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

  function canNext() {
    if (step===0) return selectedServices.length>0
    if (step===1) return !!selectedSlot
    if (step===2) { if (user) return true; if (guestMode) return name.trim()&&(email.trim()||phone.trim()); return false }
    return true
  }

  async function submit() {
    const clientName  = user&&userData?`${userData.firstName} ${userData.lastName}`.trim():name
    const clientEmail = user?(user.email||email):email
    const clientPhone = user&&userData?(userData.phone||phone):phone
    setSubmitting(true)
    try {
      await addDoc(collection(db,'appointments'),{
        barberId:barber.id, barberName:barber.name, barberSlug,
        clientId:user?.uid||null, clientName:clientName.trim(), clientEmail:clientEmail.trim(), clientPhone:clientPhone.trim(),
        isGuest:!user,
        services:selectedServices.map(sv=>({id:sv.id,name:sv.name,price:sv.price,duration:sv.duration})),
        date:format(selectedDate,'yyyy-MM-dd'), startTime:selectedSlot.startTime, endTime:selectedSlot.endTime,
        totalDuration, totalPrice, paymentMethod:payMethod, paymentStatus:'pending', bookingStatus:'confirmed',
        createdAt:serverTimestamp(),
      })
      navigate(`/b/${barberSlug}/confirmed?name=${encodeURIComponent(clientName)}&date=${format(selectedDate,'yyyy-MM-dd')}&time=${selectedSlot.startTime}`)
    } catch(e) { console.error(e); toast.error('Something went wrong') }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0A0A0A', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:26, height:26, border:'2.5px solid #fff', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const combos  = services.filter(s=>s.serviceType==='combo')
  const singles = services.filter(s=>s.serviceType==='single')
  const extras  = services.filter(s=>s.serviceType==='extra')
  const hasCombo = selectedServices.some(s=>s.serviceType==='combo')
  const STEPS = ['Service','Date & Time','Info','Confirm']

  return (
    <div style={{ minHeight:'100dvh', background:'#0A0A0A', display:'flex', flexDirection:'column', ...F }}>
      <style>{CSS}</style>

      {/* ── Black header ── */}
      <div style={{ position:'sticky', top:0, zIndex:20, background:'#0A0A0A', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'12px 20px' }}>
        <div style={{ maxWidth:560, margin:'0 auto', display:'flex', alignItems:'center', gap:14 }}>
          <button onClick={()=>step>0?setStep(s=>s-1):navigate(`/b/${barberSlug}`)}
            style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:10, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff', flexShrink:0 }}>
            <ChevL/>
          </button>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', margin:0 }}>{STEPS[step].toUpperCase()}</p>
              {totalPrice>0 && <p style={{ color:'#fff', fontWeight:900, fontSize:15, margin:0 }}>{formatCurrency(totalPrice)}</p>}
            </div>
            <StepDots step={step} total={STEPS.length}/>
          </div>
        </div>
      </div>

      {/* ── White card (scrollable content) ── */}
      <div style={{ flex:1, background:'#fff', borderRadius:'24px 24px 0 0', marginTop:16, overflowY:'auto', display:'flex', flexDirection:'column' }}>
        <div className="step-slide" style={{ flex:1, padding:'28px 24px 140px', maxWidth:560, width:'100%', alignSelf:'center', boxSizing:'border-box' }}>

          {/* STEP 0 — Services */}
          {step===0 && (
            <div>
              <h2 style={{ color:'#0A0A0A', fontSize:24, fontWeight:800, margin:'0 0 4px', letterSpacing:'-0.3px' }}>Choose your service</h2>
              <p style={{ color:'#888', fontSize:14, margin:'0 0 24px' }}>Select a combo or individual services</p>
              {combos.length>0 && <div style={{ marginBottom:20 }}>
                <p style={{ color:'#888', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>COMBOS</p>
                {combos.map(s=><SvcCard key={s.id} svc={s} selected={!!selectedServices.find(sv=>sv.id===s.id)} onClick={()=>toggleService(s)}/>)}
              </div>}
              {singles.length>0 && <div style={{ marginBottom:20 }}>
                <p style={{ color:'#888', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>SERVICES</p>
                {singles.map(s=><SvcCard key={s.id} svc={s} selected={!!selectedServices.find(sv=>sv.id===s.id)} onClick={()=>toggleService(s)} disabled={hasCombo}/>)}
              </div>}
              {extras.length>0&&selectedServices.length>0&&!selectedServices.every(s=>s.serviceType==='extra')&&<div style={{ marginBottom:20 }}>
                <p style={{ color:'#888', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>ADD-ONS</p>
                {extras.map(s=><SvcCard key={s.id} svc={s} selected={!!selectedServices.find(sv=>sv.id===s.id)} onClick={()=>toggleService(s)}/>)}
              </div>}
            </div>
          )}

          {/* STEP 1 — Date & Time */}
          {step===1 && (
            <div>
              <h2 style={{ color:'#0A0A0A', fontSize:24, fontWeight:800, margin:'0 0 4px', letterSpacing:'-0.3px' }}>Pick your time</h2>
              <p style={{ color:'#888', fontSize:14, margin:'0 0 20px' }}>Numbers show available slots for {formatDuration(totalDuration)}</p>

              <div style={{ background:'#F7F7F7', borderRadius:18, padding:16, marginBottom:20 }}>
                <DateStrip availability={availability} barberAppts={barberAppts} duration={totalDuration} selected={selectedDate} onSelect={d=>{setSelectedDate(d);setSelectedSlot(null)}}/>
              </div>

              {selectedDate && (
                <div>
                  <p style={{ color:'#0A0A0A', fontSize:11, fontWeight:700, letterSpacing:'0.09em', marginBottom:12 }}>
                    {format(selectedDate,'EEEE, MMMM d').toUpperCase()}
                  </p>
                  {availableSlots.length===0
                    ? <p style={{ color:'#888', textAlign:'center', padding:24 }}>No available times this day</p>
                    : <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7 }}>
                      {availableSlots.map(slot=>{
                        const isSel = selectedSlot?.startTime===slot.startTime
                        return (
                          <button key={slot.startTime} onClick={()=>setSelectedSlot(slot)}
                            style={{ padding:'13px 4px', borderRadius:12, border:`1.5px solid ${isSel?'#0A0A0A':'#E5E5E5'}`, background:isSel?'#0A0A0A':'#fff', color:isSel?'#fff':'#333', fontWeight:700, fontSize:13, cursor:'pointer', ...F, transition:'all 0.15s' }}>
                            {slot.startTime}
                          </button>
                        )
                      })}
                    </div>
                  }
                  {selectedSlot && (
                    <div style={{ marginTop:14, background:'#F7F7F7', border:'1px solid #E5E5E5', borderRadius:14, padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
                      <ClockIco/>
                      <div>
                        <p style={{ color:'#0A0A0A', fontWeight:800, fontSize:15, margin:0 }}>{selectedSlot.startTime} – {selectedSlot.endTime}</p>
                        <p style={{ color:'#888', fontSize:12, margin:0 }}>{format(selectedDate,'MMMM d, yyyy')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — Info */}
          {step===2 && (
            <div>
              <h2 style={{ color:'#0A0A0A', fontSize:24, fontWeight:800, margin:'0 0 4px', letterSpacing:'-0.3px' }}>Your info</h2>
              <p style={{ color:'#888', fontSize:14, margin:'0 0 24px' }}>We'll use this to confirm your appointment</p>

              {user ? (
                <div style={{ background:'#F0F9F0', border:'1px solid #BBF7D0', borderRadius:14, padding:'14px 16px', marginBottom:20 }}>
                  <p style={{ color:'#16A34A', fontWeight:800, fontSize:14, margin:'0 0 2px' }}>Signed in ✓</p>
                  <p style={{ color:'#555', fontSize:13, margin:0 }}>{userData?.firstName} {userData?.lastName} · {user.email}</p>
                </div>
              ) : !guestMode ? (
                <div style={{ background:'#F7F7F7', border:'1px solid #E5E5E5', borderRadius:16, padding:'18px', marginBottom:16 }}>
                  <p style={{ color:'#0A0A0A', fontWeight:800, fontSize:16, margin:'0 0 6px' }}>Save your booking?</p>
                  <p style={{ color:'#888', fontSize:14, margin:'0 0 16px' }}>Create an account for reminders & history.</p>
                  <div style={{ display:'flex', gap:10, marginBottom:12 }}>
                    <button onClick={()=>navigate(`/b/${barberSlug}/auth`)} style={{ flex:1, background:'#0A0A0A', border:'none', borderRadius:12, padding:'13px', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', ...F }}>Sign In</button>
                    <button onClick={()=>navigate(`/b/${barberSlug}/auth`)} style={{ flex:1, background:'transparent', border:'1.5px solid #E0E0E0', borderRadius:12, padding:'13px', color:'#333', fontWeight:600, fontSize:14, cursor:'pointer', ...F }}>Sign Up</button>
                  </div>
                  <button onClick={()=>setGuestMode(true)} style={{ width:'100%', background:'none', border:'none', color:'#888', fontSize:13, cursor:'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <UserXIco/> Continue as guest
                  </button>
                </div>
              ) : (
                <div style={{ marginBottom:20 }}>
                  <p style={{ color:'#888', fontSize:12, margin:'0 0 20px', display:'flex', alignItems:'center', gap:5 }}><UserXIco/> Guest — for this appointment only</p>
                  <div className="b-field">
                    <label className="b-label">Full Name</label>
                    <input className="b-input" type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name"/>
                  </div>
                  <div className="b-field">
                    <label className="b-label">Email</label>
                    <input className="b-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"/>
                  </div>
                  <div className="b-field">
                    <label className="b-label">Phone (optional)</label>
                    <input className="b-input" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(315) 000-0000"/>
                  </div>
                </div>
              )}

              {(user||guestMode) && (
                <div>
                  <p style={{ color:'#9A9A9A', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:10 }}>PAYMENT METHOD</p>
                  <div style={{ display:'flex', gap:8 }}>
                    {[['cash','Cash'],['card','Card'],['zelle','Zelle']].map(([id,lbl])=>(
                      <button key={id} onClick={()=>setPayMethod(id)}
                        style={{ flex:1, padding:'12px', borderRadius:25, border:`1.5px solid ${payMethod===id?'#0A0A0A':'#E5E5E5'}`, background:payMethod===id?'#0A0A0A':'#fff', color:payMethod===id?'#fff':'#888', fontWeight:700, fontSize:14, cursor:'pointer', ...F, transition:'all 0.15s' }}>
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
              <p style={{ color:'#888', fontSize:14, margin:'0 0 24px' }}>Review before confirming</p>

              <div style={{ background:'#F7F7F7', border:'1px solid #EBEBEB', borderRadius:18, padding:16, marginBottom:12 }}>
                {[['Date',selectedDate&&format(selectedDate,'EEE, MMM d, yyyy')],['Time',`${selectedSlot?.startTime} – ${selectedSlot?.endTime}`],['Duration',formatDuration(totalDuration)]].map(([l,v])=>(
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #E8E8E8' }}>
                    <span style={{ color:'#888', fontSize:14 }}>{l}</span>
                    <span style={{ color:'#0A0A0A', fontWeight:600 }}>{v}</span>
                  </div>
                ))}
                <div style={{ height:1, background:'#E0E0E0', margin:'8px 0' }}/>
                {selectedServices.map(s=>(
                  <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0' }}>
                    <span style={{ color:'#333', fontSize:14 }}>{s.name}</span>
                    <span style={{ color:'#0A0A0A', fontWeight:700 }}>{formatCurrency(s.price)}</span>
                  </div>
                ))}
                <div style={{ height:1, background:'#E0E0E0', margin:'8px 0' }}/>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0' }}>
                  <span style={{ color:'#0A0A0A', fontWeight:800, fontSize:16 }}>Total</span>
                  <span style={{ color:'#0A0A0A', fontWeight:900, fontSize:20 }}>{formatCurrency(totalPrice)}</span>
                </div>
              </div>

              <div style={{ background:'#F7F7F7', border:'1px solid #EBEBEB', borderRadius:14, padding:'14px 16px' }}>
                <p style={{ color:'#888', fontSize:11, margin:'0 0 4px' }}>CLIENT</p>
                <p style={{ color:'#0A0A0A', fontWeight:700, margin:'0 0 2px' }}>{user?`${userData?.firstName} ${userData?.lastName}`:name}</p>
                <p style={{ color:'#888', fontSize:13, margin:0 }}>{user?user.email:email} · {payMethod}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Fixed bottom button ── */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'14px 20px 28px', background:'linear-gradient(to top,#fff 70%,transparent)', zIndex:30 }}>
        <div style={{ maxWidth:560, margin:'0 auto' }}>
          {step<3 ? (
            <button onClick={()=>{ if(!canNext()){if(step===0)toast.error('Select a service');else if(step===1)toast.error('Select a time slot');else toast.error('Enter your info or sign in');return} setStep(s=>s+1) }}
              style={{ width:'100%', background:canNext()?'#0A0A0A':'#E0E0E0', color:canNext()?'#fff':'#AAA', border:'none', borderRadius:14, padding:'16px', fontSize:15, fontWeight:700, cursor:canNext()?'pointer':'not-allowed', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all 0.2s' }}>
              Continue <ChevR/>
            </button>
          ) : (
            <button onClick={submit} disabled={submitting}
              style={{ width:'100%', background:'#0A0A0A', color:'#fff', border:'none', borderRadius:14, padding:'16px', fontSize:15, fontWeight:700, cursor:'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:submitting?0.7:1 }}>
              {submitting?<Spinner/>:<CheckIco/>}
              {submitting?'Booking…':'Confirm Booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}