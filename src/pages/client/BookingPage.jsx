/**
 * BookingPage — Futuristic UX with fluid animations
 * Steps: Service → Date & Time → Info → Confirm
 */
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration, generateTimeSlots } from '../../utils/helpers'
import { format, addDays, startOfDay, isSameDay, isToday } from 'date-fns'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Check, Scissors, Clock, UserX } from 'lucide-react'
import PhoneInput from '../../components/ui/PhoneInput'

const F = { fontFamily:'Monda,system-ui,sans-serif' }

// ── Animated step progress ─────────────────────────────────────────────────
function StepProgress({ step, total }) {
  return (
    <div style={{ display:'flex', gap:4, padding:'0 4px' }}>
      {Array.from({length:total}).map((_,i) => (
        <div key={i} style={{ flex:1, height:3, borderRadius:2, background:i<=step?'var(--accent)':'rgba(255,255,255,0.15)', transition:'background 0.4s ease, flex 0.3s ease', overflow:'hidden', position:'relative' }}>
          {i===step && <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)', animation:'shimmer 1.5s infinite' }}/>}
        </div>
      ))}
    </div>
  )
}

// ── Service card with hover effect ─────────────────────────────────────────
function SvcCard({ svc, selected, onClick, disabled }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        width:'100%', textAlign:'left', cursor:disabled?'not-allowed':'pointer', ...F,
        background: selected?'rgba(245,158,11,0.12)':'rgba(255,255,255,0.04)',
        border: `1.5px solid ${selected?'var(--accent)':hov?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.08)'}`,
        borderRadius:16, padding:'14px 16px', marginBottom:8,
        opacity: disabled?0.3:1,
        transform: hov&&!disabled?'translateY(-1px)':'none',
        boxShadow: selected?'0 0 0 1px var(--accent), 0 8px 24px rgba(245,158,11,0.2)': hov?'0 4px 16px rgba(0,0,0,0.3)':'none',
        transition:'all 0.2s ease',
      }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ color:'#fff', fontWeight:700, fontSize:15, margin:'0 0 4px' }}>{svc.name}</p>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:12, margin:0, display:'flex', alignItems:'center', gap:4 }}>
            <Clock size={10}/>{formatDuration(svc.duration)}
            {svc.description && ` · ${svc.description}`}
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <p style={{ color:'var(--accent)', fontWeight:900, fontSize:16 }}>{formatCurrency(svc.price)}</p>
          <div style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${selected?'var(--accent)':'rgba(255,255,255,0.2)'}`, background:selected?'var(--accent)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}>
            {selected && <Check size={12} color="white"/>}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Date strip ─────────────────────────────────────────────────────────────
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
      const nowM=new Date().getHours()*60+new Date().getMinutes()+15
      s=s.filter(sl=>{const[h,m]=sl.startTime.split(':').map(Number);return h*60+m>nowM})
    }
    return s.length
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <button onClick={()=>setOffset(o=>Math.max(0,o-1))} disabled={offset===0}
          style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:10, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:offset===0?'not-allowed':'pointer', color:'rgba(255,255,255,0.5)', opacity:offset===0?0.3:1 }}>
          <ChevronLeft size={16}/>
        </button>
        <span style={{ color:'rgba(255,255,255,0.5)', fontSize:12, fontWeight:600 }}>
          {format(visible[0],'MMM d')} – {format(visible[visible.length-1],'MMM d')}
        </span>
        <button onClick={()=>setOffset(o=>(o+1)*perPage<advance?o+1:o)} disabled={(offset+1)*perPage>=advance}
          style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:10, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:(offset+1)*perPage>=advance?'not-allowed':'pointer', color:'rgba(255,255,255,0.5)', opacity:(offset+1)*perPage>=advance?0.3:1 }}>
          <ChevronRight size={16}/>
        </button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
        {visible.map((date,i)=>{
          const count=slotCount(date)
          const isSel=selected&&isSameDay(date,selected)
          const full=count===0
          return (
            <button key={i} onClick={()=>!full&&onSelect(date)} disabled={full}
              style={{ padding:'10px 3px', borderRadius:14, border:'none', cursor:full?'not-allowed':'pointer',
                background:isSel?'var(--accent)':'rgba(255,255,255,0.06)', opacity:full?0.25:1,
                display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                transform:isSel?'scale(1.05)':'scale(1)', transition:'all 0.2s',
                boxShadow:isSel?'0 4px 16px rgba(245,158,11,0.4)':'none',
              }}>
              <span style={{ color:isSel?'#fff':'rgba(255,255,255,0.5)', fontSize:9, fontWeight:700 }}>{format(date,'EEE').toUpperCase()}</span>
              <span style={{ color:isSel?'#fff':isToday(date)?'var(--accent)':'#fff', fontSize:14, fontWeight:800 }}>{format(date,'d')}</span>
              <span style={{ fontSize:9, fontWeight:700, color:isSel?'rgba(255,255,255,0.8)':count>0?'#4ade80':'#f87171' }}>
                {full?'—':`${count}`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main BookingPage ───────────────────────────────────────────────────────
export default function BookingPage() {
  const { barberSlug } = useParams()
  const navigate = useNavigate()
  const { user, userData } = useAuth()

  const [step, setStep]       = useState(0)
  const [barber, setBarber]   = useState(null)
  const [services, setServices] = useState([])
  const [availability, setAvailability] = useState(null)
  const [barberAppts, setBarberAppts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [direction, setDirection] = useState(1) // 1=forward, -1=back

  const [selectedServices, setSelectedServices] = useState([])
  const [selectedDate, setSelectedDate]         = useState(null)
  const [selectedSlot, setSelectedSlot]         = useState(null)
  const [availableSlots, setAvailableSlots]     = useState([])
  const [name, setName]   = useState('')
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
      const bd={id:active.id,...active.data()}; setBarber(bd)
      const [sSnap,aSnap,apSnap]=await Promise.all([
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
    const dayIdx=selectedDate.getDay()
    const ds=availability.schedule?.[dayIdx]||{enabled:(availability.workingDays||[1,2,3,4,5,6]).includes(dayIdx),startTime:availability.startTime||'09:00',endTime:availability.endTime||'18:00',breaks:availability.breaks||[]}
    if (!ds.enabled) { setAvailableSlots([]); return }
    const dateStr=format(selectedDate,'yyyy-MM-dd')
    const existing=barberAppts.filter(a=>a.date===dateStr&&a.bookingStatus!=='cancelled').map(a=>({startTime:a.startTime,endTime:a.endTime}))
    let slots=generateTimeSlots(ds.startTime,ds.endTime,totalDuration,ds.breaks||[],existing)
    if (isToday(selectedDate)) { const nm=new Date().getHours()*60+new Date().getMinutes()+15; slots=slots.filter(sl=>{const[h,m]=sl.startTime.split(':').map(Number);return h*60+m>nm}) }
    setAvailableSlots(slots); setSelectedSlot(null)
  },[selectedDate,totalDuration,availability,barberAppts])

  function toggleService(svc) {
    if (svc.serviceType==='combo') { setSelectedServices(p=>p.find(s=>s.id===svc.id)?[]:[svc]) }
    else { if (selectedServices.some(s=>s.serviceType==='combo')) return; setSelectedServices(p=>p.find(s=>s.id===svc.id)?p.filter(s=>s.id!==svc.id):[...p,svc]) }
  }

  function go(dir) {
    setDirection(dir)
    setStep(s=>s+dir)
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
    <div style={{ minHeight:'100vh', background:'#0A0A0F', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, border:'3px solid var(--accent)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const combos  = services.filter(s=>s.serviceType==='combo')
  const singles = services.filter(s=>s.serviceType==='single')
  const extras  = services.filter(s=>s.serviceType==='extra')
  const hasCombo= selectedServices.some(s=>s.serviceType==='combo')

  const STEPS = ['Service','Date & Time','Info','Confirm']

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0A0A0F 0%,#0F0D1A 50%,#0A0A0F 100%)', ...F, position:'relative', overflow:'hidden' }}>
      {/* Background glow */}
      <div style={{ position:'fixed', top:'-20%', left:'50%', transform:'translateX(-50%)', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle,rgba(245,158,11,0.08) 0%,transparent 70%)', pointerEvents:'none' }}/>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:20, background:'rgba(10,10,15,0.85)', backdropFilter:'blur(16px)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'12px 20px' }}>
        <div style={{ maxWidth:640, margin:'0 auto', display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={()=>step>0?go(-1):navigate(`/b/${barberSlug}`)}
            style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff', flexShrink:0, transition:'all 0.2s' }}>
            <ChevronLeft size={18}/>
          </button>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <p style={{ color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:700, letterSpacing:'0.1em', margin:0 }}>{STEPS[step].toUpperCase()}</p>
              {totalPrice>0 && <p style={{ color:'var(--accent)', fontWeight:900, fontSize:16, margin:0 }}>{formatCurrency(totalPrice)}</p>}
            </div>
            <StepProgress step={step} total={STEPS.length}/>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 20px 120px', animation:'fadeInUp 0.3s ease' }}>

        {/* STEP 0: Services */}
        {step===0 && (
          <div>
            <div style={{ marginBottom:24 }}>
              <h2 style={{ color:'#fff', fontWeight:900, fontSize:26, margin:'0 0 6px' }}>Choose your service</h2>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, margin:0 }}>Select a combo or individual services</p>
            </div>
            {combos.length>0 && <div style={{ marginBottom:20 }}>
              <p style={{ color:'var(--accent)', fontSize:10, fontWeight:800, letterSpacing:'0.12em', marginBottom:10 }}>COMBOS</p>
              {combos.map(s=><SvcCard key={s.id} svc={s} selected={!!selectedServices.find(sv=>sv.id===s.id)} onClick={()=>toggleService(s)}/>)}
            </div>}
            {singles.length>0 && <div style={{ marginBottom:20 }}>
              <p style={{ color:'rgba(255,255,255,0.35)', fontSize:10, fontWeight:800, letterSpacing:'0.12em', marginBottom:10 }}>SERVICES</p>
              {singles.map(s=><SvcCard key={s.id} svc={s} selected={!!selectedServices.find(sv=>sv.id===s.id)} onClick={()=>toggleService(s)} disabled={hasCombo}/>)}
            </div>}
            {extras.length>0&&selectedServices.length>0&&!selectedServices.every(s=>s.serviceType==='extra')&&<div style={{ marginBottom:20 }}>
              <p style={{ color:'rgba(255,255,255,0.35)', fontSize:10, fontWeight:800, letterSpacing:'0.12em', marginBottom:10 }}>ADD-ONS</p>
              {extras.map(s=><SvcCard key={s.id} svc={s} selected={!!selectedServices.find(sv=>sv.id===s.id)} onClick={()=>toggleService(s)}/>)}
            </div>}
          </div>
        )}

        {/* STEP 1: Date & Time */}
        {step===1 && (
          <div>
            <div style={{ marginBottom:24 }}>
              <h2 style={{ color:'#fff', fontWeight:900, fontSize:26, margin:'0 0 6px' }}>Pick your time</h2>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, margin:0 }}>Numbers show available slots for {formatDuration(totalDuration)}</p>
            </div>
            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:16, marginBottom:20 }}>
              <DateStrip availability={availability} barberAppts={barberAppts} duration={totalDuration} selected={selectedDate} onSelect={d=>{setSelectedDate(d);setSelectedSlot(null)}}/>
            </div>
            {selectedDate&&(
              <div>
                <p style={{ color:'var(--accent)', fontSize:11, fontWeight:700, letterSpacing:'0.1em', marginBottom:12 }}>{format(selectedDate,'EEEE, MMMM d').toUpperCase()}</p>
                {availableSlots.length===0
                  ? <p style={{ color:'rgba(255,255,255,0.4)', textAlign:'center', padding:24 }}>No available times this day</p>
                  : <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                    {availableSlots.map(slot=>{
                      const isSel=selectedSlot?.startTime===slot.startTime
                      return (
                        <button key={slot.startTime} onClick={()=>setSelectedSlot(slot)}
                          style={{ padding:'13px 4px', borderRadius:14, border:`1.5px solid ${isSel?'var(--accent)':'rgba(255,255,255,0.1)'}`, background:isSel?'var(--accent)':'rgba(255,255,255,0.04)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.2s', transform:isSel?'scale(1.05)':'scale(1)', boxShadow:isSel?'0 4px 16px rgba(245,158,11,0.4)':'none' }}>
                          {slot.startTime}
                        </button>
                      )
                    })}
                  </div>
                }
                {selectedSlot&&(
                  <div style={{ marginTop:14, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:14, padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
                    <Clock size={16} color="var(--accent)"/>
                    <div>
                      <p style={{ color:'var(--accent)', fontWeight:800, fontSize:15, margin:0 }}>{selectedSlot.startTime} – {selectedSlot.endTime}</p>
                      <p style={{ color:'rgba(255,255,255,0.4)', fontSize:12, margin:0 }}>{format(selectedDate,'MMMM d, yyyy')}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Info */}
        {step===2 && (
          <div>
            <div style={{ marginBottom:24 }}>
              <h2 style={{ color:'#fff', fontWeight:900, fontSize:26, margin:'0 0 6px' }}>Your info</h2>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, margin:0 }}>No account needed</p>
            </div>
            {user ? (
              <div style={{ background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.3)', borderRadius:16, padding:'14px 16px', marginBottom:20 }}>
                <p style={{ color:'#4ade80', fontWeight:800, fontSize:14, margin:'0 0 2px' }}>Signed in ✓</p>
                <p style={{ color:'rgba(255,255,255,0.5)', fontSize:13, margin:0 }}>{userData?.firstName} {userData?.lastName} · {user.email}</p>
              </div>
            ) : !guestMode ? (
              <div>
                <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:'18px', marginBottom:16 }}>
                  <p style={{ color:'#fff', fontWeight:800, fontSize:16, margin:'0 0 6px' }}>Save your booking?</p>
                  <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, margin:'0 0 16px' }}>Create an account to track history & get reminders.</p>
                  <div style={{ display:'flex', gap:10, marginBottom:12 }}>
                    <button onClick={()=>navigate(`/b/${barberSlug}/auth?mode=login`)} style={{ flex:1, background:'var(--accent)', border:'none', borderRadius:14, padding:'14px', color:'#000', fontWeight:800, fontSize:14, cursor:'pointer', ...F }}>Sign In</button>
                    <button onClick={()=>navigate(`/b/${barberSlug}/auth?mode=signup`)} style={{ flex:1, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:14, padding:'14px', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', ...F }}>Sign Up</button>
                  </div>
                  <button onClick={()=>setGuestMode(true)} style={{ width:'100%', background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:13, cursor:'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <UserX size={13}/> Continue as guest
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:20 }}>
                <p style={{ color:'rgba(255,255,255,0.4)', fontSize:12, margin:0, display:'flex', alignItems:'center', gap:5 }}><UserX size={12}/> Guest — used for this appointment only</p>
                {[['FULL NAME','text',name,setName,'Your full name'],['EMAIL','email',email,setEmail,'you@email.com']].map(([lbl,type,val,set,ph])=>(
                  <div key={lbl}>
                    <p style={{ color:'rgba(255,255,255,0.35)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>{lbl}</p>
                    <div style={{ borderBottom:'1.5px solid rgba(255,255,255,0.1)', paddingBottom:10 }}>
                      <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph} autoComplete="off"
                        style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:16, ...F }}/>
                    </div>
                  </div>
                ))}
                <div>
                  <p style={{ color:'rgba(255,255,255,0.35)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>PHONE</p>
                  <div style={{ '--border':'rgba(255,255,255,0.1)', '--text-pri':'#fff', '--text-sec':'rgba(255,255,255,0.4)', '--accent':'#F59E0B', '--card':'rgba(255,255,255,0.06)', '--bg':'rgba(255,255,255,0.04)' }}>
                    <PhoneInput value={phone} onChange={setPhone}/>
                  </div>
                </div>
              </div>
            )}
            {(user||guestMode) && (
              <div>
                <p style={{ color:'rgba(255,255,255,0.35)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>PAYMENT METHOD</p>
                <div style={{ display:'flex', gap:8 }}>
                  {[['cash','Cash'],['card','Card'],['zelle','Zelle']].map(([id,lbl])=>(
                    <button key={id} onClick={()=>setPayMethod(id)}
                      style={{ flex:1, padding:'12px', borderRadius:25, border:`1.5px solid ${payMethod===id?'var(--accent)':'rgba(255,255,255,0.1)'}`, background:payMethod===id?'rgba(245,158,11,0.15)':'transparent', color:payMethod===id?'var(--accent)':'rgba(255,255,255,0.5)', fontWeight:700, fontSize:14, cursor:'pointer', ...F, transition:'all 0.2s' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Confirm */}
        {step===3 && (
          <div>
            <div style={{ marginBottom:24 }}>
              <h2 style={{ color:'#fff', fontWeight:900, fontSize:26, margin:'0 0 6px' }}>Confirm</h2>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, margin:0 }}>Review before confirming</p>
            </div>
            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'16px', marginBottom:12 }}>
              {[['Date',selectedDate&&format(selectedDate,'EEE, MMM d, yyyy')],['Time',`${selectedSlot?.startTime} – ${selectedSlot?.endTime}`],['Duration',formatDuration(totalDuration)]].map(([l,v])=>(
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color:'rgba(255,255,255,0.4)', fontSize:14 }}>{l}</span>
                  <span style={{ color:'#fff', fontWeight:600 }}>{v}</span>
                </div>
              ))}
              <div style={{ height:1, background:'rgba(255,255,255,0.1)', margin:'8px 0' }}/>
              {selectedServices.map(s=>(
                <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0' }}>
                  <span style={{ color:'rgba(255,255,255,0.8)', fontSize:14 }}>{s.name}</span>
                  <span style={{ color:'var(--accent)', fontWeight:700 }}>{formatCurrency(s.price)}</span>
                </div>
              ))}
              <div style={{ height:1, background:'rgba(255,255,255,0.1)', margin:'8px 0' }}/>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0' }}>
                <span style={{ color:'#fff', fontWeight:800, fontSize:16 }}>Total</span>
                <span style={{ color:'var(--accent)', fontWeight:900, fontSize:20 }}>{formatCurrency(totalPrice)}</span>
              </div>
            </div>
            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:'14px 16px' }}>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:12, margin:'0 0 4px' }}>Client</p>
              <p style={{ color:'#fff', fontWeight:700, margin:'0 0 2px' }}>{user?`${userData?.firstName} ${userData?.lastName}`:name}</p>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:13, margin:0 }}>{user?user.email:email} · {payMethod}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'16px 20px 28px', background:'linear-gradient(to top,rgba(10,10,15,0.97) 70%,transparent)', backdropFilter:'blur(8px)' }}>
        <div style={{ maxWidth:640, margin:'0 auto' }}>
          {step<3 ? (
            <button onClick={()=>{ if (!canNext()) { if(step===0)toast.error('Select a service'); else if(step===1)toast.error('Select a time slot'); else toast.error('Enter your info or sign in'); return } go(1) }}
              style={{ width:'100%', background:canNext()?'var(--accent)':'rgba(255,255,255,0.1)', border:'none', borderRadius:18, padding:'18px', color:canNext()?'#000':'rgba(255,255,255,0.3)', fontWeight:900, fontSize:17, cursor:canNext()?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:10, transition:'all 0.3s', boxShadow:canNext()?'0 8px 32px rgba(245,158,11,0.5)':'none', ...F }}>
              Continue
              <ChevronRight size={20}/>
            </button>
          ) : (
            <button onClick={submit} disabled={submitting}
              style={{ width:'100%', background:'var(--accent)', border:'none', borderRadius:18, padding:'18px', color:'#000', fontWeight:900, fontSize:17, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, boxShadow:'0 8px 32px rgba(245,158,11,0.5)', opacity:submitting?0.7:1, ...F }}>
              {submitting?<div style={{width:20,height:20,border:'2.5px solid #000',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>:<Check size={20}/>}
              {submitting?'Booking…':'Confirm Booking'}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        button{touch-action:manipulation}
        input::placeholder{color:rgba(255,255,255,0.2)}
      `}</style>
    </div>
  )
}
