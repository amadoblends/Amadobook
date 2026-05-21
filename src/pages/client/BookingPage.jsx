/**
 * BookingPage — fixed for no-slug routing
 * Uses BARBER_SLUG constant instead of useParams()
 */
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'
import { formatCurrency, formatDuration, generateTimeSlots } from '../../utils/helpers'
import { format, addDays, startOfDay, isSameDay, isToday } from 'date-fns'
import toast from 'react-hot-toast'

// ✅ FIX: constant instead of useParams()
const BARBER_SLUG = 'amadoblends'

const F      = { fontFamily:"'DM Sans',system-ui,sans-serif" }
const ORANGE  = '#FF6B1A'
const ORANGE2 = '#FF8C42'
const BG      = '#0D0D0D'
const CARD    = '#171717'
const CARD2   = '#1F1F1F'
const BORDER  = '#2A2A2A'
const TXT     = '#F5F5F5'
const TXT2    = '#888'
const TXT3    = '#555'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes glow    { 0%,100%{box-shadow:0 0 0 0 rgba(255,107,26,0.45)} 50%{box-shadow:0 0 0 10px rgba(255,107,26,0)} }
  .fade-up  { animation: fadeUp  0.28s cubic-bezier(0.22,1,0.36,1) both; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  input, textarea { font-size:16px !important; font-family:'DM Sans',system-ui,sans-serif; }
  ::-webkit-scrollbar { display:none; }
  .svc-card { width:100%; text-align:left; cursor:pointer; background:${CARD}; border:1.5px solid ${BORDER}; border-radius:20px; padding:16px 18px; margin-bottom:10px; display:flex; align-items:center; gap:14px; transition:all 0.18s; }
  .svc-card.selected { background:${ORANGE}12; border-color:${ORANGE}55; }
  .svc-card.blocked  { opacity:0.25; cursor:not-allowed; pointer-events:none; }
  .time-chip { padding:13px 6px; border-radius:14px; border:1.5px solid ${BORDER}; background:${CARD}; color:${TXT2}; font-weight:600; font-size:13px; cursor:pointer; font-family:'DM Sans',system-ui,sans-serif; transition:all 0.15s; text-align:center; }
  .time-chip.active { background:${ORANGE}; color:#fff; border-color:${ORANGE}; font-weight:700; box-shadow:0 4px 14px ${ORANGE}44; }
  .field-input { width:100%; background:transparent; border:none; border-bottom:1.5px solid ${BORDER}; color:${TXT}; padding:10px 0; font-size:16px; outline:none; transition:border-color 0.2s; font-family:'DM Sans',system-ui,sans-serif; }
  .field-input:focus { border-bottom-color:${ORANGE}; }
  .field-input::placeholder { color:${TXT3}; }
`

function ScissorsIcon({ size=18, color=TXT2 }) {
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
            <div style={{ width:22, height:22, borderRadius:'50%', background: i <= step ? ORANGE : BORDER, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'#fff', boxShadow: i === step ? `0 0 14px ${ORANGE}66` : 'none' }}>
              {i < step ? '✓' : i + 1}
            </div>
            {i === step && <span style={{ color:ORANGE, fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>{l.toUpperCase()}</span>}
          </div>
          {i < labels.length - 1 && <div style={{ width:14, height:1.5, background: i < step ? ORANGE : BORDER, borderRadius:2, transition:'background 0.4s' }}/>}
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
    <div ref={trackRef} style={{ position:'relative', width:'100%', height:64, background: done ? `${ORANGE}22` : CARD2, border:`1.5px solid ${done ? ORANGE : BORDER}`, borderRadius:32, overflow:'hidden', cursor: done ? 'default' : 'grab', userSelect:'none', touchAction:'none' }}>
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`calc(${pct * 100}% + 32px)`, background:`linear-gradient(90deg, ${ORANGE}22, ${ORANGE}06)`, borderRadius:32, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', gap:8, pointerEvents:'none', opacity: done ? 0 : textOpacity }}>
        {loading ? <div style={{ width:18, height:18, border:`2px solid ${ORANGE}44`, borderTopColor:ORANGE, borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/> : <><span style={{ color:TXT2, fontSize:14, fontWeight:600 }}>Slide to confirm</span><span style={{ color:TXT3, fontSize:16, letterSpacing:'-2px' }}>›››</span></>}
      </div>
      {done && <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ color:ORANGE, fontSize:14, fontWeight:700 }}>Booking confirmed ✓</span></div>}
      {!done && (
        <div onMouseDown={onStart} onTouchStart={onStart}
          style={{ position:'absolute', top:4, left: 4 + thumbLeft, width:THUMB_W, height:56, borderRadius:28, background:`linear-gradient(135deg, ${ORANGE}, ${ORANGE2})`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'grab', boxShadow:`0 4px 22px ${ORANGE}55`, animation: pct === 0 ? 'glow 2.2s ease infinite' : 'none' }}>
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
    // backward compat: blockedDates can be string[] or {date,reason}[]
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
        <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:page===0?'not-allowed':'pointer', opacity:page===0?0.3:1, color:TXT }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span style={{ color:TXT2, fontSize:12, fontWeight:600 }}>{format(visible[0],'MMM d')} – {format(visible[visible.length-1],'MMM d')}</span>
        <button onClick={()=>setPage(p=>Math.min(maxPage,p+1))} disabled={page===maxPage} style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:page===maxPage?'not-allowed':'pointer', opacity:page===maxPage?0.3:1, color:TXT }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
        {visible.map((date, i) => {
          const dateStr2 = format(date,'yyyy-MM-dd')
          const blockEntry = (availability?.blockedDates||[]).find(d=>typeof d==='string'?d===dateStr2:d.date===dateStr2)
          const blockReason = blockEntry ? (typeof blockEntry==='string'?'Closed':blockEntry.reason||'Closed') : null
          const count = slotCount(date), isSel = selected && isSameDay(date, selected), full = count === 0
          return (
            <button key={i} onClick={()=>!full&&onSelect(date)} disabled={full}
              style={{ padding:'12px 4px', borderRadius:18, border:`1.5px solid ${isSel?ORANGE:blockReason?'rgba(239,68,68,0.3)':BORDER}`, cursor:full?'not-allowed':'pointer', background:isSel?ORANGE:blockReason?'rgba(239,68,68,0.05)':CARD, opacity:full?0.4:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, boxShadow:isSel?`0 4px 20px ${ORANGE}44`:'none' }}>
              <span style={{ color:isSel?'rgba(255,255,255,0.65)':TXT3, fontSize:9, fontWeight:700 }}>{format(date,'EEE').toUpperCase()}</span>
              <span style={{ color:isSel?'#fff':isToday(date)?ORANGE:TXT, fontSize:19, fontWeight:800, lineHeight:1 }}>{format(date,'d')}</span>
              <span style={{ fontSize:9, fontWeight:700, color:isSel?'rgba(255,255,255,0.6)':blockReason?'#EF4444':count>0?'#22C55E':'#EF4444' }}>{blockReason?'🔒':full?'—':`${count}`}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function BookingPage() {
  // ✅ FIX: No useParams()
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
        // ✅ FIX: Use BARBER_SLUG constant
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
      // Notify barber of new booking
      if (barber.userId) {
        addDoc(collection(db,'notifications'), {
          userId: barber.userId,
          barberId: barber.id,
          type: 'new_booking',
          title: 'New Appointment 🗓',
          message: `${clientName.trim()} booked ${selectedServices.map(s=>s.name).join(' + ')} at ${selectedSlot.startTime} on ${format(selectedDate,'MMM d')}`,
          read: false,
          createdAt: serverTimestamp(),
        }).catch(()=>{})
      }
      navigate(`/confirmed?name=${encodeURIComponent(clientName)}&date=${format(selectedDate,'yyyy-MM-dd')}&time=${selectedSlot.startTime}`)
    } catch(e) { console.error(e); toast.error('Could not save booking') }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div style={{ minHeight:'100dvh', background:BG, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:28, height:28, border:`2.5px solid ${BORDER}`, borderTopColor:ORANGE, borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
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
    <div style={{ minHeight:'100dvh', background:BG, display:'flex', flexDirection:'column', ...F, color:TXT }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:30, background:`${BG}EE`, backdropFilter:'blur(18px)', borderBottom:`1px solid ${BORDER}`, padding:'14px 20px', paddingTop:'max(14px, env(safe-area-inset-top))' }}>
        <div style={{ maxWidth:500, margin:'0 auto', display:'flex', alignItems:'center', gap:14 }}>
          <button onClick={()=>step>0?setStep(s=>s-1):navigate(user?'/dashboard':'/')}
            style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:12, width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:TXT, flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ flex:1 }}><StepBar step={step}/></div>
          {totalPrice>0&&(
            <div style={{ background:`${ORANGE}18`, border:`1px solid ${ORANGE}33`, borderRadius:12, padding:'6px 12px', flexShrink:0 }}>
              <span style={{ color:ORANGE, fontWeight:800, fontSize:15 }}>{formatCurrency(totalPrice)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="fade-up" key={step} style={{ flex:1, padding:'28px 20px 160px', maxWidth:500, width:'100%', alignSelf:'center', boxSizing:'border-box' }}>

        {/* STEP 0 — Service */}
        {step===0&&(
          <div>
            <p style={{ color:ORANGE, fontSize:11, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>STEP 1 OF 4</p>
            <h1 style={{ color:TXT, fontSize:30, fontWeight:800, letterSpacing:'-0.5px', lineHeight:1.1, marginBottom:28 }}>Select a<br/><span style={{ color:ORANGE }}>service.</span></h1>

            {combos.length>0&&(
              <div style={{ marginBottom:24 }}>
                <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:12 }}>COMBOS</p>
                {combos.map(s=>{
                  const sel=!!selectedServices.find(sv=>sv.id===s.id)
                  return(
                    <button key={s.id} className={`svc-card${sel?' selected':''}`} onClick={()=>toggleService(s)}>
                      <div style={{ width:44, height:44, borderRadius:14, background:`${ORANGE}22`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <ScissorsIcon size={20} color={ORANGE}/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                          <p style={{ color:sel?ORANGE:TXT, fontWeight:700, fontSize:15, margin:0 }}>{s.name}</p>
                          <span style={{ background:`${ORANGE}22`, color:ORANGE, fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:20 }}>COMBO</span>
                        </div>
                        <p style={{ color:TXT3, fontSize:12, margin:0 }}>{formatDuration(s.duration)}{s.description&&` · ${s.description}`}</p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                        <p style={{ color:sel?ORANGE:TXT, fontWeight:800, fontSize:17, margin:0 }}>{formatCurrency(s.price)}</p>
                        <div style={{ width:24, height:24, borderRadius:'50%', border:`2px solid ${sel?ORANGE:BORDER}`, background:sel?ORANGE:'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
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
                {combos.length>0&&<p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:12 }}>SERVICES</p>}
                {singles.map(s=>{
                  const included=hasCombo&&comboIncludes(activeCombo,s)
                  const blocked=hasCombo&&!included
                  const sel=!!selectedServices.find(sv=>sv.id===s.id)
                  return(
                    <button key={s.id} className={`svc-card${sel?' selected':''}${blocked?' blocked':''}`} onClick={()=>!blocked&&!included&&toggleService(s)}>
                      <div style={{ width:44, height:44, borderRadius:14, background:CARD2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <ScissorsIcon size={20} color={TXT2}/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ color:sel?ORANGE:TXT, fontWeight:700, fontSize:15, margin:'0 0 4px' }}>{s.name}</p>
                        <p style={{ color:TXT3, fontSize:12, margin:0 }}>{formatDuration(s.duration)}{s.description&&` · ${s.description}`}</p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                        <p style={{ color:sel?ORANGE:TXT, fontWeight:800, fontSize:17, margin:0 }}>{formatCurrency(s.price)}</p>
                        <div style={{ width:24, height:24, borderRadius:'50%', border:`2px solid ${sel?ORANGE:BORDER}`, background:sel?ORANGE:'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
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
                <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:12 }}>ADD-ONS</p>
                {extras.map(s=>{
                  const sel=!!selectedServices.find(sv=>sv.id===s.id)
                  return(
                    <button key={s.id} className={`svc-card${sel?' selected':''}`} onClick={()=>toggleService(s)}>
                      <div style={{ width:44, height:44, borderRadius:14, background:CARD2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <ScissorsIcon size={20} color={TXT2}/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ color:sel?ORANGE:TXT, fontWeight:700, fontSize:15, margin:'0 0 4px' }}>{s.name}</p>
                        <p style={{ color:TXT3, fontSize:12, margin:0 }}>{formatDuration(s.duration)}</p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                        <p style={{ color:sel?ORANGE:TXT, fontWeight:800, fontSize:17, margin:0 }}>{formatCurrency(s.price)}</p>
                        <div style={{ width:24, height:24, borderRadius:'50%', border:`2px solid ${sel?ORANGE:BORDER}`, background:sel?ORANGE:'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
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

        {/* STEP 1 — Date & Time */}
        {step===1&&(
          <div>
            <p style={{ color:ORANGE, fontSize:11, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>STEP 2 OF 4</p>
            <h1 style={{ color:TXT, fontSize:30, fontWeight:800, letterSpacing:'-0.5px', lineHeight:1.1, marginBottom:28 }}>Pick a<br/><span style={{ color:ORANGE }}>date & time.</span></h1>

            {selectedSlot&&selectedDate&&(
              <div style={{ background:`linear-gradient(135deg, ${ORANGE}18, ${ORANGE}06)`, border:`1px solid ${ORANGE}33`, borderRadius:20, padding:'16px 20px', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <p style={{ color:TXT3, fontSize:10, fontWeight:700, marginBottom:5 }}>SELECTED TIME</p>
                  <p style={{ color:ORANGE, fontWeight:900, fontSize:24 }}>{selectedSlot.startTime} – {selectedSlot.endTime}</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ color:TXT3, fontSize:10, fontWeight:700, marginBottom:5 }}>DATE</p>
                  <p style={{ color:TXT, fontWeight:700, fontSize:14 }}>{format(selectedDate,'EEE, MMM d')}</p>
                </div>
              </div>
            )}

            <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:22, padding:18, marginBottom:24 }}>
              <p style={{ color:TXT3, fontSize:10, fontWeight:700, marginBottom:14 }}>SELECT DATE</p>
              <DateStrip availability={availability} barberAppts={barberAppts} duration={totalDuration} selected={selectedDate} onSelect={d=>{setSelectedDate(d);setSelectedSlot(null)}}/>
            </div>

            {selectedDate?(
              <div>
                <p style={{ color:TXT3, fontSize:10, fontWeight:700, marginBottom:14 }}>AVAILABLE TIMES · {format(selectedDate,'EEE, MMM d').toUpperCase()}</p>
                {availableSlots.length===0
                  ?<div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:'28px', textAlign:'center' }}><p style={{ color:TXT2, fontWeight:600 }}>No available times</p><p style={{ color:TXT3, fontSize:13 }}>Try another day</p></div>
                  :<div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                    {availableSlots.map(slot=>(
                      <button key={slot.startTime} className={`time-chip${selectedSlot?.startTime===slot.startTime?' active':''}`} onClick={()=>setSelectedSlot(slot)}>{slot.startTime}</button>
                    ))}
                  </div>}
              </div>
            ):(
              <div style={{ textAlign:'center', padding:'32px 0', color:TXT3 }}><p style={{ fontSize:14 }}>Select a date above to see times</p></div>
            )}
          </div>
        )}

        {/* STEP 2 — Info */}
        {step===2&&(
          <div>
            <p style={{ color:ORANGE, fontSize:11, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>STEP 3 OF 4</p>
            <h1 style={{ color:TXT, fontSize:30, fontWeight:800, letterSpacing:'-0.5px', lineHeight:1.1, marginBottom:28 }}>Your<br/><span style={{ color:ORANGE }}>info.</span></h1>

            {user?(
              <div style={{ background:`${ORANGE}10`, border:`1px solid ${ORANGE}30`, borderRadius:18, padding:'16px 18px', marginBottom:24 }}>
                <p style={{ color:ORANGE, fontWeight:800, fontSize:14, marginBottom:3 }}>Signed in ✓</p>
                <p style={{ color:TXT2, fontSize:13 }}>{userData?.firstName} {userData?.lastName}</p>
              </div>
            ):!guestMode?(
              <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, padding:'22px', marginBottom:16 }}>
                <p style={{ color:TXT, fontWeight:700, fontSize:17, marginBottom:6 }}>Want reminders?</p>
                <p style={{ color:TXT2, fontSize:14, marginBottom:20 }}>Sign in to track your history.</p>
                <button onClick={()=>navigate('/login')} style={{ width:'100%', background:ORANGE, border:'none', borderRadius:22, padding:'16px', color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer', ...F, marginBottom:10 }}>Sign In / Sign Up</button>
                <button onClick={()=>setGuestMode(true)} style={{ width:'100%', background:'transparent', border:`1.5px solid ${BORDER}`, borderRadius:22, padding:'14px', color:TXT2, fontWeight:600, fontSize:14, cursor:'pointer', ...F }}>Continue as Guest</button>
              </div>
            ):(
              <div>
                {!user&&<p style={{ color:TXT3, fontSize:12, marginBottom:20 }}>Guest booking — used for this reservation only.</p>}
                <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, padding:'20px 18px', marginBottom:20 }}>
                  {[['FULL NAME','text',name,setName,'Your name'],['EMAIL','email',email,setEmail,'you@email.com'],['PHONE','tel',phone,setPhone,'(305) 000-0000']].map(([lbl,type,val,setter,ph],idx,arr)=>(
                    <div key={lbl} style={{ marginBottom:idx<arr.length-1?20:0 }}>
                      <label style={{ display:'block', color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:8 }}>{lbl}</label>
                      <input type={type} value={val} onChange={e=>setter(e.target.value)} placeholder={ph} className="field-input"/>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(user||guestMode)&&(
              <div>
                <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:12 }}>PAYMENT METHOD</p>
                <div style={{ display:'flex', gap:8 }}>
                  {[['cash','Cash'],['card','Card'],['zelle','Zelle']].map(([id,lbl])=>(
                    <button key={id} onClick={()=>setPayMethod(id)} style={{ flex:1, padding:'13px', borderRadius:22, border:`1.5px solid ${payMethod===id?ORANGE:BORDER}`, background:payMethod===id?ORANGE:'transparent', color:payMethod===id?'#fff':TXT2, fontWeight:700, fontSize:14, cursor:'pointer', ...F }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3 — Confirm */}
        {step===3&&(
          <div>
            <p style={{ color:ORANGE, fontSize:11, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>STEP 4 OF 4</p>
            <h1 style={{ color:TXT, fontSize:30, fontWeight:800, letterSpacing:'-0.5px', lineHeight:1.1, marginBottom:28 }}>Review &<br/><span style={{ color:ORANGE }}>confirm.</span></h1>

            {barber&&(
              <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, padding:'16px 18px', marginBottom:12, display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:52, height:52, borderRadius:16, background:CARD2, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <ScissorsIcon size={22} color={ORANGE}/>
                </div>
                <div>
                  <p style={{ color:TXT, fontWeight:800, fontSize:16, margin:'0 0 2px' }}>{barber.name}</p>
                  {barber.address&&<p style={{ color:TXT3, fontSize:12, margin:0 }}>📍 {barber.address}</p>}
                </div>
              </div>
            )}

            <div style={{ background:`linear-gradient(135deg, ${ORANGE}18, ${ORANGE}06)`, border:`1px solid ${ORANGE}33`, borderRadius:20, padding:'18px 20px', marginBottom:12 }}>
              <p style={{ color:ORANGE, fontWeight:900, fontSize:22, marginBottom:2 }}>{selectedSlot?.startTime} – {selectedSlot?.endTime}</p>
              <p style={{ color:TXT2, fontSize:13 }}>{selectedDate&&format(selectedDate,'EEEE, MMMM d, yyyy')}</p>
            </div>

            <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, padding:'16px 18px', marginBottom:12 }}>
              {selectedServices.map(s=>(
                <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${BORDER}` }}>
                  <span style={{ color:TXT2, fontSize:14 }}>{s.name}</span>
                  <span style={{ color:TXT, fontWeight:700 }}>{formatCurrency(s.price)}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0 0' }}>
                <span style={{ color:TXT, fontWeight:800, fontSize:18 }}>Total</span>
                <span style={{ color:ORANGE, fontWeight:900, fontSize:26 }}>{formatCurrency(totalPrice)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'16px 20px', paddingBottom:'max(24px, env(safe-area-inset-bottom))', background:`linear-gradient(to top, ${BG} 60%, transparent)`, zIndex:30 }}>
        <div style={{ maxWidth:500, margin:'0 auto' }}>
          {step<3?(
            <button onClick={()=>canNext()?setStep(s=>s+1):toast.error(step===0?'Select a service':step===1?'Select a date and time':'Enter your name and email')} disabled={!canNext()}
              style={{ width:'100%', background:canNext()?ORANGE:'transparent', border:`1.5px solid ${canNext()?ORANGE:BORDER}`, borderRadius:22, padding:'18px 24px', color:canNext()?'#fff':TXT3, fontWeight:700, fontSize:16, cursor:canNext()?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:8, ...F, boxShadow:canNext()?`0 4px 28px ${ORANGE}44`:'none' }}>
              Continue <ArrowRight color={canNext()?'#fff':TXT3}/>
            </button>
          ):(
            <SlideToConfirm onConfirm={submit} loading={submitting}/>
          )}
        </div>
      </div>
    </div>
  )
}