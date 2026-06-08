/**
 * BookingPage — Completamente Migrado
 * ✓ Cero truncaciones - Flujo de reserva 100% explícito
 * ✓ Rutas dinámicas y selector inteligente de servicios y fechas
 */
import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'
import { formatCurrency, formatDuration, generateTimeSlots } from '../../utils/helpers'
import { format, addDays, startOfDay, isSameDay, isToday } from 'date-fns'
import toast from 'react-hot-toast'

const BARBER_SLUG = 'amadoblends'
const F = { fontFamily: "'Plus Jakarta Sans','DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes glow    { 0%,100%{box-shadow:0 0 0 0 var(--accent-shadow)} 50%{box-shadow:0 0 0 10px transparent} }
  .fade-up  { animation: fadeUp  0.28s cubic-bezier(0.22,1,0.36,1) both; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  input, textarea { font-size:16px !important; font-family:'Plus Jakarta Sans',system-ui,sans-serif; }
  ::-webkit-scrollbar { display:none; }
  .svc-card { width:100%; text-align:left; cursor:pointer; background:var(--card); border:1.5px solid var(--border); border-radius:20px; padding:16px 18px; margin-bottom:10px; display:flex; align-items:center; gap:14px; transition:all 0.18s; }
  .svc-card.selected { background:var(--accent-soft); border-color:var(--accent); }
  .svc-card.blocked  { opacity:0.25; cursor:not-allowed; pointer-events:none; }
  .time-chip { padding:13px 6px; border-radius:14px; border:1.5px solid var(--border); background:var(--card); color:var(--text-sec); font-weight:600; font-size:13px; cursor:pointer; transition:all 0.15s; text-align:center; }
  .time-chip.active { background:var(--accent); color:#fff; border-color:var(--accent); font-weight:700; box-shadow:var(--shadow-accent); }
  .field-input { width:100%; background:transparent; border:none; border-bottom:1.5px solid var(--border); color:var(--text-pri); padding:10px 0; font-size:16px; outline:none; transition:border-color 0.2s; }
  .field-input:focus { border-bottom-color:var(--accent); }
`

function ScissorsIcon({ size=18, color='var(--text-sec)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
      <line x1="20" y1="4" x2="8.12" y2="15.88"/>
      <line x1="14.47" y1="14.48" x2="20" y2="20"/>
      <line x1="8.12" y1="8.12" x2="12" y2="12"/>
    </svg>
  )
}

function ArrowRight({ color='#fff', size=18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
}

function StepBar({ step }) {
  const labels = ['Service','Date & Time','Info','Confirm']
  return (
    <div style={{ display:'flex', gap:5, alignItems:'center' }}>
      {labels.map((l, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, opacity: i > step ? 0.3 : 1, transition:'opacity 0.3s' }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background: i <= step ? 'var(--accent)' : 'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'#fff', boxShadow: i === step ? 'var(--shadow-accent)' : 'none' }}>
              {i < step ? '✓' : i + 1}
            </div>
            {i === step && <span style={{ color:'var(--accent)', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>{l.toUpperCase()}</span>}
          </div>
          {i < labels.length - 1 && <div style={{ width:14, height:1.5, background: i < step ? 'var(--accent)' : 'var(--border)', borderRadius:2, transition:'background 0.4s' }}/>}
        </div>
      ))}
    </div>
  )
}

function SlideToConfirm({ onConfirm, loading }) {
  const trackRef = useRef(null)
  const [pct, setPct] = useState(0)
  const [done, setDone] = useState(false)
  const dragging = useRef(false)
  const startX = useRef(0)
  const THUMB_W = 62

  const getMax = () => (trackRef.current?.clientWidth || 320) - THUMB_W - 8

  function onStart(e) { if (done || loading) return; dragging.current = true; startX.current = (e.touches?.[0] || e).clientX }
  function onMove(e) { if (!dragging.current) return; const x = (e.touches?.[0] || e).clientX; const max = getMax(); setPct(Math.max(0, Math.min(x - startX.current, max)) / max) }
  function onEnd() { if (!dragging.current) return; dragging.current = false; if (pct > 0.82) { setDone(true); setPct(1); setTimeout(onConfirm, 320) } else { setPct(0) } }

  useEffect(() => {
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onMove, { passive: true }); window.addEventListener('touchend', onEnd)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onEnd); window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd) }
  }, [pct, done])

  const thumbLeft = pct * getMax()
  const textOpacity = Math.max(0, 1 - pct * 2.2)

  return (
    <div ref={trackRef} style={{ position:'relative', width:'100%', height:64, background: done ? 'var(--accent-soft)' : 'var(--card2)', border:`1.5px solid ${done ? 'var(--accent)' : 'var(--border)'}`, borderRadius:32, overflow:'hidden', cursor: done ? 'default' : 'grab', userSelect:'none', touchAction:'none' }}>
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`calc(${pct * 100}% + 32px)`, background:'linear-gradient(90deg, var(--accent-soft), transparent)', borderRadius:32, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', gap:8, pointerEvents:'none', opacity: done ? 0 : textOpacity }}>
        {loading ? <div style={{ width:18, height:18, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/> : <><span style={{ color:'var(--text-sec)', fontSize:14, fontWeight:600 }}>Slide to confirm</span><span style={{ color:'var(--text-ter)', fontSize:16, letterSpacing:'-2px' }}>›››</span></>}
      </div>
      {done && <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ color:'var(--accent)', fontSize:14, fontWeight:700 }}>Booking confirmed ✓</span></div>}
      {!done && (
        <div onMouseDown={onStart} onTouchStart={onStart} style={{ position:'absolute', top:4, left: 4 + thumbLeft, width:THUMB_W, height:56, borderRadius:28, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'grab', boxShadow:'var(--shadow-accent)', animation: pct === 0 ? 'glow 2.2s ease infinite' : 'none' }}>
          <ArrowRight color="#fff" size={22}/>
        </div>
      )}
    </div>
  )
}

function DateStrip({ availability, barberAppts, duration, selected, onSelect }) {
  const [page, setPage] = useState(0)
  const today   = startOfDay(new Date())
  const advance = availability?.advanceDays || 30
  const allDays = Array.from({ length: advance }, (_, i) => addDays(today, i))
  const perPage = 5, maxPage = Math.ceil(allDays.length / perPage) - 1
  const visible = allDays.slice(page * perPage, (page + 1) * perPage)

  function slotCount(date) {
    const dayIdx = date.getDay()
    const ds = availability?.schedule?.[dayIdx] ?? { enabled:(availability?.workingDays||[1,2,3,4,5,6]).includes(dayIdx), startTime:availability?.startTime||'09:00', endTime:availability?.endTime||'18:00', breaks:availability?.breaks||[] }
    if (!ds.enabled) return 0
    const dateStr = format(date, 'yyyy-MM-dd')
    const blocked = (availability?.blockedDates||[]).some(d=>typeof d==='string'?d===dateStr:d.date===dateStr)
    if (blocked) return 0
    const existing = (barberAppts||[]).filter(a=>a.date===dateStr&&a.bookingStatus!=='cancelled').map(a=>({startTime:a.startTime,endTime:a.endTime}))
    let slots = generateTimeSlots(ds.startTime, ds.endTime, duration, ds.breaks||[], existing)
    if (isSameDay(date, new Date())) { const nm=new Date().getHours()*60+new Date().getMinutes()+15; slots=slots.filter(sl=>{const[h,m]=sl.startTime.split(':').map(Number);return h*60+m>nm}) }
    return slots.length
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:page===0?'not-allowed':'pointer', opacity:page===0?0.3:1, color:'var(--text-pri)' }}>
          <ChevronLeft size={16}/>
        </button>
        <span style={{ color:'var(--text-sec)', fontSize:12, fontWeight:600 }}>{format(visible[0],'MMM d')} – {format(visible[visible.length-1],'MMM d')}</span>
        <button onClick={()=>setPage(p=>Math.min(maxPage,p+1))} disabled={page===maxPage} style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:page===maxPage?'not-allowed':'pointer', opacity:page===maxPage?0.3:1, color:'var(--text-pri)' }}>
          <ChevronRight size={16}/>
        </button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
        {visible.map((date, i) => {
          const dateStr2 = format(date,'yyyy-MM-dd')
          const blockEntry = (availability?.blockedDates||[]).find(d=>typeof d==='string'?d===dateStr2:d.date===dateStr2)
          const blockReason = blockEntry ? (typeof blockEntry==='string'?'Closed':blockEntry.reason||'Closed') : null
          const count = slotCount(date), isSel = selected && isSameDay(date, selected), full = count === 0
          return (
            <button key={i} onClick={()=>!full&&onSelect(date)} disabled={full} style={{ padding:'12px 4px', borderRadius:18, border:`1.5px solid ${isSel?'var(--accent)':blockReason?'var(--red)':'var(--border)'}`, cursor:full?'not-allowed':'pointer', background:isSel?'var(--accent)':blockReason?'var(--red-soft)':'var(--card)', opacity:full?0.4:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, boxShadow:isSel?'var(--shadow-accent)':'none' }}>
              <span style={{ color:isSel?'rgba(255,255,255,0.65)':'var(--text-ter)', fontSize:9, fontWeight:700 }}>{format(date,'EEE').toUpperCase()}</span>
              <span style={{ color:isSel?'#fff':isToday(date)?'var(--accent)':'var(--text-pri)', fontSize:19, fontWeight:800, lineHeight:1 }}>{format(date,'d')}</span>
              <span style={{ fontSize:9, fontWeight:700, color:isSel?'rgba(255,255,255,0.6)':blockReason?'var(--red)':count>0?'var(--green)':'var(--red)' }}>{blockReason?'🔒':full?'—':`${count}`}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function BookingPage() {
  const navigate = useNavigate()
  const { user, userData } = useAuth()

  const [step, setStep]             = useState(0)
  const [barber, setBarber]         = useState(null)
  const [services, setServices]     = useState([])
  const [availability, setAvailability] = useState(null)
  const [barberAppts, setBarberAppts]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [selectedServices, setSelectedServices] = useState([])
  const [selectedDate, setSelectedDate]   = useState(null)
  const [selectedSlot, setSelectedSlot]   = useState(null)
  const [availableSlots, setAvailableSlots] = useState([])
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [phone, setPhone]         = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [guestMode, setGuestMode] = useState(false)

  const totalDuration = selectedServices.reduce((s,v)=>s+(v.duration||0),0)
  const totalPrice    = selectedServices.reduce((s,v)=>s+(v.price||0),0)
  const activeCombo   = selectedServices.find(s=>s.serviceType==='combo')||null
  const hasCombo      = !!activeCombo

  useEffect(() => {
    async function load() {
      try {
        const bSnap = await getDocs(query(collection(db,'barbers'), where('slug','==',BARBER_SLUG)))
        const active = bSnap.docs.find(d=>d.data().isActive!==false)
        if (!active) { navigate('/'); return }
        const bd = { id:active.id, ...active.data() }
        setBarber(bd)
        const [sSnap, aSnap, apSnap] = await Promise.all([
          getDocs(query(collection(db,'services'),     where('barberId','==',bd.id))),
          getDocs(query(collection(db,'availability'), where('barberId','==',bd.id))),
          getDocs(query(collection(db,'appointments'), where('barberId','==',bd.id))),
        ])
        setServices(sSnap.docs.map(d=>({id:d.id,...d.data()})).filter(s=>s.isActive!==false))
        if (!aSnap.empty) setAvailability(aSnap.docs[0].data())
        setBarberAppts(apSnap.docs.map(d=>d.data()))
      } catch(e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  useEffect(() => {
    if (user && userData) {
      setName(`${userData.firstName||''} ${userData.lastName||''}`.trim())
      setEmail(userData.email||user.email||'')
      setPhone(userData.phone||'')
      setGuestMode(true)
    }
  }, [user?.uid])

  useEffect(() => {
    if (!selectedDate||!availability||totalDuration===0) { setAvailableSlots([]); return }
    const dayIdx = selectedDate.getDay()
    const ds = availability.schedule?.[dayIdx]??{ enabled:(availability.workingDays||[1,2,3,4,5,6]).includes(dayIdx), startTime:availability.startTime||'09:00', endTime:availability.endTime||'18:00', breaks:availability.breaks||[] }
    if (!ds.enabled) { setAvailableSlots([]); return }
    const dateStr = format(selectedDate,'yyyy-MM-dd')
    const isBlocked = (availability?.blockedDates||[]).some(d=>typeof d==='string'?d===dateStr:d.date===dateStr)
    if (isBlocked) { setAvailableSlots([]); return }
    const existing = barberAppts.filter(a=>a.date===dateStr&&a.bookingStatus!=='cancelled').map(a=>({startTime:a.startTime,endTime:a.endTime}))
    let slots = generateTimeSlots(ds.startTime, ds.endTime, totalDuration, ds.breaks||[], existing)
    if (isToday(selectedDate)) { const nm=new Date().getHours()*60+new Date().getMinutes()+15; slots=slots.filter(sl=>{const[h,m]=sl.startTime.split(':').map(Number);return h*60+m>nm}) }
    setAvailableSlots(slots); setSelectedSlot(null)
  }, [selectedDate, totalDuration, availability, barberAppts])

  function toggleService(svc) {
    if (svc.serviceType==='combo') { setSelectedServices(p=>p.find(s=>s.id===svc.id)?[]:[svc]) }
    else if (svc.serviceType==='extra') { setSelectedServices(p=>p.find(s=>s.id===svc.id)?p.filter(s=>s.id!==svc.id):[...p,svc]) }
    else { if (hasCombo) return; setSelectedServices(p=>p.find(s=>s.id===svc.id)?p.filter(s=>s.id!==svc.id):[...p,svc]) }
  }

  function canNext() {
    if (step===0) return selectedServices.length>0
    if (step===1) return !!selectedDate&&!!selectedSlot
    if (step===2) return guestMode?(name.trim()&&(email.trim()||phone.trim())):!!user
    return true
  }

  async function submit() {
    setSubmitting(true)
    try {
      const clientName  = user&&userData?`${userData.firstName} ${userData.lastName}`.trim():name
      const clientEmail = user?(user.email||email):email
      const clientPhone = user&&userData?(userData.phone||phone):phone
      await addDoc(collection(db,'appointments'), {
        barberId:barber.id, barberName:barber.name, barberSlug:BARBER_SLUG,
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
      if (barber.userId) {
        addDoc(collection(db,'notifications'), {
          userId: barber.userId, barberId: barber.id, type: 'new_booking',
          title: 'New Appointment 🗓',
          message: `${clientName.trim()} booked ${selectedServices.map(s=>s.name).join(' + ')} at ${selectedSlot.startTime} on ${format(selectedDate,'MMM d')}`,
          read: false, createdAt: serverTimestamp(),
        }).catch(()=>{})
      }
      navigate(`/confirmed?name=${encodeURIComponent(clientName)}&date=${format(selectedDate,'yyyy-MM-dd')}&time=${selectedSlot.startTime}`)
    } catch(e) { console.error(e); toast.error('Could not save booking') }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:28, height:28, border:`2.5px solid var(--border)`, borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>
    </div>
  )

  const combos  = services.filter(s=>s.serviceType==='combo')
  const singles = services.filter(s=>s.serviceType==='single')
  const extras  = services.filter(s=>s.serviceType==='extra')

  function comboIncludes(combo, svc) {
    if (!combo) return false
    if (Array.isArray(combo.includesIds)&&combo.includesIds.includes(svc.id)) return true
    const hay=`${combo.name} ${combo.description||''}`.toLowerCase()
    return hay.includes(svc.name.toLowerCase())
  }

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', flexDirection:'column', ...F, color:'var(--text-pri)' }}>
      <style>{CSS}</style>

      {/* Header Fijo */}
      <div style={{ position:'sticky', top:0, zIndex:30, background:`var(--surface)`, borderBottom:`1px solid var(--border)`, padding:'14px 20px', paddingTop:'max(14px, env(safe-area-inset-top))' }}>
        <div style={{ maxWidth:500, margin:'0 auto', display:'flex', alignItems:'center', gap:14 }}>
          <button onClick={()=>step>0?setStep(s=>s-1):navigate(user?'/dashboard':'/')} style={{ background:'var(--card2)', border:`1px solid var(--border)`, borderRadius:12, width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text-pri)', flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ flex:1 }}><StepBar step={step}/></div>
          {totalPrice>0&&(
            <div style={{ background:`var(--accent-soft)`, border:`1px solid var(--accent)`, borderRadius:12, padding:'6px 12px', flexShrink:0 }}>
              <span style={{ color:'var(--accent)', fontWeight:800, fontSize:15 }}>{formatCurrency(totalPrice)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Contenido según el paso activo */}
      <div className="fade-up" key={step} style={{ flex:1, padding:'28px 20px 160px', maxWidth:500, width:'100%', alignSelf:'center', boxSizing:'border-box' }}>
        
        {/* PASO 0 — Servicios */}
        {step===0&&(
          <div>
            <p style={{ color:'var(--accent)', fontSize:11, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>STEP 1 OF 4</p>
            <h1 style={{ color:'var(--text-pri)', fontSize:30, fontWeight:800, letterSpacing:'-0.5px', lineHeight:1.1, marginBottom:28 }}>Select a<br/><span style={{ color:'var(--accent)' }}>service.</span></h1>

            {combos.length>0&&(
              <div style={{ marginBottom:24 }}>
                <p style={{ color:'var(--text-ter)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:12 }}>COMBOS</p>
                {combos.map(s=>{
                  const sel=!!selectedServices.find(sv=>sv.id===s.id)
                  return(
                    <button key={s.id} className={`svc-card${sel?' selected':''}`} onClick={()=>toggleService(s)}>
                      <div style={{ width:44, height:44, borderRadius:14, background:`var(--accent-soft)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <ScissorsIcon size={20} color='var(--accent)'/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                          <p style={{ color:sel?'var(--accent)':'var(--text-pri)', fontWeight:700, fontSize:15, margin:0 }}>{s.name}</p>
                          <span style={{ background:`var(--accent-soft)`, color:'var(--accent)', fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:20 }}>COMBO</span>
                        </div>
                        <p style={{ color:'var(--text-ter)', fontSize:12, margin:0 }}>{formatDuration(s.duration)}{s.description&&` · ${s.description}`}</p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                        <p style={{ color:sel?'var(--accent)':'var(--text-pri)', fontWeight:800, fontSize:17, margin:0 }}>{formatCurrency(s.price)}</p>
                        <div style={{ width:24, height:24, borderRadius:'50%', border:`2px solid ${sel?'var(--accent)':'var(--border)'}`, background:sel?'var(--accent)':'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {sel&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {singles.length>0&&(
              <div style={{ marginBottom:24 }}>
                {combos.length>0&&<p style={{ color:'var(--text-ter)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:12 }}>SERVICES</p>}
                {singles.map(s=>{
                  const included=hasCombo&&comboIncludes(activeCombo,s)
                  const blocked=hasCombo&&!included
                  const sel=!!selectedServices.find(sv=>sv.id===s.id)
                  return(
                    <button key={s.id} className={`svc-card${sel?' selected':''}${blocked?' blocked':''}`} onClick={()=>!blocked&&!included&&toggleService(s)}>
                      <div style={{ width:44, height:44, borderRadius:14, background:'var(--card2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <ScissorsIcon size={20} color='var(--text-sec)'/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ color:sel?'var(--accent)':'var(--text-pri)', fontWeight:700, fontSize:15, margin:'0 0 4px' }}>{s.name}</p>
                        <p style={{ color:'var(--text-ter)', fontSize:12, margin:0 }}>{formatDuration(s.duration)}{s.description&&` · ${s.description}`}</p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                        <p style={{ color:sel?'var(--accent)':'var(--text-pri)', fontWeight:800, fontSize:17, margin:0 }}>{formatCurrency(s.price)}</p>
                        <div style={{ width:24, height:24, borderRadius:'50%', border:`2px solid ${sel?'var(--accent)':'var(--border)'}`, background:sel?'var(--accent)':'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {sel&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {extras.length>0&&selectedServices.length>0&&(
              <div>
                <p style={{ color:'var(--text-ter)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:12 }}>ADD-ONS</p>
                {extras.map(s=>{
                  const sel=!!selectedServices.find(sv=>sv.id===s.id)
                  return(
                    <button key={s.id} className={`svc-card${sel?' selected':''}`} onClick={()=>toggleService(s)}>
                      <div style={{ width:44, height:44, borderRadius:14, background:'var(--card2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <ScissorsIcon size={20} color='var(--text-sec)'/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ color:sel?'var(--accent)':'var(--text-pri)', fontWeight:700, fontSize:15, margin:'0 0 4px' }}>{s.name}</p>
                        <p style={{ color:'var(--text-ter)', fontSize:12, margin:0 }}>{formatDuration(s.duration)}</p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                        <p style={{ color:sel?'var(--accent)':'var(--text-pri)', fontWeight:800, fontSize:17, margin:0 }}>{formatCurrency(s.price)}</p>
                        <div style={{ width:24, height:24, borderRadius:'50%', border:`2px solid ${sel?'var(--accent)':'var(--border)'}`, background:sel?'var(--accent)':'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {sel&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* PASO 1 — Fecha y Horario */}
        {step===1&&(
          <div>
            <p style={{ color:'var(--accent)', fontSize:11, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>STEP 2 OF 4</p>
            <h1 style={{ color:'var(--text-pri)', fontSize:30, fontWeight:800, letterSpacing:'-0.5px', lineHeight:1.1, marginBottom:28 }}>Pick a<br/><span style={{ color:'var(--accent)' }}>date & time.</span></h1>

            {selectedSlot&&selectedDate&&(
              <div style={{ background:'var(--accent-soft)', border:`1px solid var(--accent)`, borderRadius:20, padding:'16px 20px', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <p style={{ color:'var(--text-ter)', fontSize:10, fontWeight:700, marginBottom:5 }}>SELECTED TIME</p>
                  <p style={{ color:'var(--accent)', fontWeight:900, fontSize:24 }}>{selectedSlot.startTime} – {selectedSlot.endTime}</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ color:'var(--text-ter)', fontSize:10, fontWeight:700, marginBottom:5 }}>DATE</p>
                  <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14 }}>{format(selectedDate,'EEE, MMM d')}</p>
                </div>
              </div>
            )}

            <div style={{ background:'var(--card)', border:`1px solid var(--border)`, borderRadius:22, padding:18, marginBottom:24, boxShadow:'var(--shadow-sm)' }}>
              <p style={{ color:'var(--text-ter)', fontSize:10, fontWeight:700, marginBottom:14 }}>SELECT DATE</p>
              <DateStrip availability={availability} barberAppts={barberAppts} duration={totalDuration} selected={selectedDate} onSelect={d=>{setSelectedDate(d);setSelectedSlot(null)}}/>
            </div>

            {selectedDate?(
              <div>
                <p style={{ color:'var(--text-ter)', fontSize:10, fontWeight:700, marginBottom:14 }}>AVAILABLE TIMES · {format(selectedDate,'EEE, MMM d').toUpperCase()}</p>
                {availableSlots.length===0
                  ?<div style={{ background:'var(--card)', border:`1px solid var(--border)`, borderRadius:16, padding:'28px', textAlign:'center' }}><p style={{ color:'var(--text-sec)', fontWeight:600 }}>No available times</p><p style={{ color:'var(--text-ter)', fontSize:13 }}>Try another day</p></div>
                  :<div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                    {availableSlots.map(slot=>(
                      <button key={slot.startTime} className={`time-chip${selectedSlot?.startTime===slot.startTime?' active':''}`} onClick={()=>setSelectedSlot(slot)}>{slot.startTime}</button>
                    ))}
                  </div>}
              </div>
            ):(
              <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-ter)' }}><p style={{ fontSize:14 }}>Select a date above to see times</p></div>
            )}
          </div>
        )}

        {/* PASO 2 — Información de Contacto */}
        {step===2&&(
          <div>
            <p style={{ color:'var(--accent)', fontSize:11, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>STEP 3 OF 4</p>
            <h1 style={{ color:'var(--text-pri)', fontSize:30, fontWeight:800, letterSpacing:'-0.5px', lineHeight:1.1, marginBottom:28 }}>Your<br/><span style={{ color:'var(--accent)' }}>info.</span></h1>

            {user?(
              <div style={{ background:`var(--accent-soft)`, border:`1px solid var(--accent)`, borderRadius:18, padding:'16px 18px', marginBottom:24 }}>
                <p style={{ color:'var(--accent)', fontWeight:800, fontSize:14, marginBottom:3 }}>Signed in ✓</p>
                <p style={{ color:'var(--text-sec)', fontSize:13 }}>{userData?.firstName} {userData?.lastName}</p>
              </div>
            ):!guestMode?(
              <div style={{ background:'var(--card)', border:`1px solid var(--border)`, borderRadius:20, padding:'22px', marginBottom:16, boxShadow:'var(--shadow-sm)' }}>
                <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:17, marginBottom:6 }}>Want reminders?</p>
                <p style={{ color:'var(--text-sec)', fontSize:14, marginBottom:20 }}>Sign in to track your history.</p>
                <button onClick={()=>navigate('/login')} style={{ width:'100%', background:'var(--accent)', border:'none', borderRadius:22, padding:'16px', color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer', ...F, marginBottom:10, boxShadow:'var(--shadow-accent)' }}>Sign In / Sign Up</button>
                <button onClick={()=>setGuestMode(true)} style={{ width:'100%', background:'transparent', border:`1.5px solid var(--border)`, borderRadius:22, padding:'14px', color:'var(--text-sec)', fontWeight:600, fontSize:14, cursor:'pointer', ...F }}>Continue as Guest</button>
              </div>
            ):(
              <div>
                <div style={{ background:'var(--card)', border:`1px solid var(--border)`, borderRadius:20, padding:'20px 18px', marginBottom:20, boxShadow:'var(--shadow-sm)' }}>
                  {[ ['FULL NAME','text',name,setName,'Your name'], ['EMAIL','email',email,setEmail,'you@email.com'], ['PHONE','tel',phone,setPhone,'(305) 000-0000'] ].map(([lbl,type,val,setter,ph],idx,arr)=>(
                    <div key={lbl} style={{ marginBottom:idx<arr.length-1?20:0 }}>
                      <label style={{ display:'block', color:'var(--text-ter)', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:8 }}>{lbl}</label>
                      <input type={type} value={val} onChange={e=>setter(e.target.value)} placeholder={ph} className="field-input"/>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(user||guestMode)&&(
              <div>
                <p style={{ color:'var(--text-ter)', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:12 }}>PAYMENT METHOD</p>
                <div style={{ display:'flex', gap:8 }}>
                  {[ ['cash', 'Cash'], ['card', 'Card'], ['zelle', 'Zelle'] ].map(([id,lbl])=>(
                    <button key={id} onClick={()=>setPayMethod(id)} style={{ flex:1, padding:'13px', borderRadius:22, border:`1.5px solid ${payMethod===id?'var(--accent)':'var(--border)'}`, background:payMethod===id?'var(--accent)':'transparent', color:payMethod===id?'#fff':'var(--text-sec)', fontWeight:700, fontSize:14, cursor:'pointer', ...F, boxShadow:payMethod===id?'var(--shadow-accent)':'none' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASO 3 — Revisión Final */}
        {step===3&&(
          <div>
            <p style={{ color:'var(--accent)', fontSize:11, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>STEP 4 OF 4</p>
            <h1 style={{ color:'var(--text-pri)', fontSize:30, fontWeight:800, letterSpacing:'-0.5px', lineHeight:1.1, marginBottom:28 }}>Review &<br/><span style={{ color:'var(--accent)' }}>confirm.</span></h1>

            {barber&&(
              <div style={{ background:'var(--card)', border:`1px solid var(--border)`, borderRadius:20, padding:'16px 18px', marginBottom:12, display:'flex', alignItems:'center', gap:14, boxShadow:'var(--shadow-sm)' }}>
                <div style={{ width:52, height:52, borderRadius:16, background:'var(--card2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <ScissorsIcon size={22} color='var(--accent)'/>
                </div>
                <div>
                  <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:16, margin:'0 0 2px' }}>{barber.name}</p>
                  {barber.address&&<p style={{ color:'var(--text-ter)', fontSize:12, margin:0 }}>📍 {barber.address}</p>}
                </div>
              </div>
            )}

            <div style={{ background:'var(--accent-soft)', border:`1px solid var(--accent)`, borderRadius:20, padding:'18px 20px', marginBottom:12 }}>
              <p style={{ color:'var(--accent)', fontWeight:900, fontSize:22, marginBottom:2 }}>{selectedSlot?.startTime} – {selectedSlot?.endTime}</p>
              <p style={{ color:'var(--text-sec)', fontSize:13 }}>{selectedDate&&format(selectedDate,'EEEE, MMMM d, yyyy')}</p>
            </div>

            <div style={{ background:'var(--card)', border:`1px solid var(--border)`, borderRadius:20, padding:'16px 18px', marginBottom:12, boxShadow:'var(--shadow-sm)' }}>
              {selectedServices.map(s=>(
                <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid var(--border)` }}>
                  <span style={{ color:'var(--text-sec)', fontSize:14 }}>{s.name}</span>
                  <span style={{ color:'var(--text-pri)', fontWeight:700 }}>{formatCurrency(s.price)}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0 0' }}>
                <span style={{ color:'var(--text-pri)', fontWeight:800, fontSize:18 }}>Total</span>
                <span style={{ color:'var(--accent)', fontWeight:900, fontSize:26 }}>{formatCurrency(totalPrice)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botón de acción inferior */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'16px 20px', paddingBottom:'max(24px, env(safe-area-inset-bottom))', background:`linear-gradient(to top, var(--bg) 60%, transparent)`, zIndex:30 }}>
        <div style={{ maxWidth:500, margin:'0 auto' }}>
          {step<3?(
            <button onClick={()=>canNext()?setStep(s=>s+1):toast.error(step===0?'Select a service':step===1?'Select a date and time':'Enter your info')} disabled={!canNext()} style={{ width:'100%', background:canNext()?'var(--accent)':'transparent', border:`1.5px solid ${canNext()?'var(--accent)':'var(--border)'}`, borderRadius:22, padding:'18px 24px', color:canNext()?'#fff':'var(--text-ter)', fontWeight:700, fontSize:16, cursor:canNext()?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:8, ...F, boxShadow:canNext()?'var(--shadow-accent)':'none' }}>
              Continue <ArrowRight color={canNext()?'#fff':'var(--text-ter)'}/>
            </button>
          ):(
            <SlideToConfirm onConfirm={submit} loading={submitting}/>
          )}
        </div>
      </div>
    </div>
  )
}