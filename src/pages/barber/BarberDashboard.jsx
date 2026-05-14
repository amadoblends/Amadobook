import { useEffect, useState, useMemo } from 'react'
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency, formatDuration, parseLocalDate, generateTimeSlots } from '../../utils/helpers'
import { format, isToday, isTomorrow, differenceInSeconds, startOfDay, addDays, isSameDay } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { useTheme } from '../../context/ThemeContext'
import {
  Clock, X, Scissors, Phone, Mail, Calendar,
  Plus, ChevronRight, TrendingUp, UserPlus, Check,
  ChevronLeft, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'

const BG     = '#0D0D0D'
const CARD   = '#171717'
const CARD2  = '#1C1C1E'
const BORDER = '#2A2A2A'
const ORANGE = '#FF6B1A'
const TXT    = '#F5F5F5'
const TXT2   = '#888888'
const TXT3   = '#555555'
const GREEN  = '#22C55E'
const WALKIN = '#7C3AED' // purple for walk-ins
const F      = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideUp { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
  .fade-up { animation: fadeUp 0.25s cubic-bezier(0.22,1,0.36,1) both; }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  ::-webkit-scrollbar { display: none; }
`

// ── Helpers ───────────────────────────────────────────────────────────────
function apptStart(a) { const [y,m,d]=a.date.split('-').map(Number),[h,mn]=a.startTime.split(':').map(Number); return new Date(y,m-1,d,h,mn) }
function apptEnd(a)   { const [y,m,d]=a.date.split('-').map(Number),[h,mn]=a.endTime.split(':').map(Number);   return new Date(y,m-1,d,h,mn) }

function Avatar({ name, photoURL, size=40, fontSize=14, highlight=false }) {
  const initials = name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) || '?'
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', overflow:'hidden', flexShrink:0, background:CARD2, border:`2px solid ${highlight?ORANGE:BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize, color:highlight?ORANGE:TXT2 }}>
      {photoURL ? <img src={photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : initials}
    </div>
  )
}

function StatusBadge({ status, isWalkIn }) {
  if (isWalkIn && status !== 'cancelled' && status !== 'completed') {
    return <span style={{ background:`${WALKIN}20`, color:WALKIN, fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:20, letterSpacing:'0.04em', whiteSpace:'nowrap' }}>Walk-in</span>
  }
  const MAP = {
    confirmed: { bg:'rgba(34,197,94,0.14)',  color:GREEN,    label:'Confirmed' },
    pending:   { bg:`${ORANGE}18`,           color:ORANGE,   label:'Pending'   },
    completed: { bg:'rgba(255,255,255,0.06)',color:TXT2,     label:'Completed' },
    cancelled: { bg:'rgba(239,68,68,0.12)',  color:'#EF4444',label:'Cancelled' },
  }
  const s = MAP[status] || MAP.pending
  return <span style={{ background:s.bg, color:s.color, fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:20, letterSpacing:'0.04em', whiteSpace:'nowrap' }}>{s.label}</span>
}

function Countdown({ appt }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    function calc() {
      const start=apptStart(appt), end=apptEnd(appt), now=new Date()
      if (now>=start&&now<=end) { const s=differenceInSeconds(end,now),m=Math.floor(s/60),sec=s%60; setLabel(`${m}:${String(sec).padStart(2,'0')} left`); return }
      if (now<start) { const s=differenceInSeconds(start,now),m=Math.floor(s/60); setLabel(m>=60?`in ${Math.floor(m/60)}h ${m%60}m`:`in ${m}m`) }
    }
    calc(); const iv=setInterval(calc,1000); return ()=>clearInterval(iv)
  },[appt])
  return <span style={{fontVariantNumeric:'tabular-nums'}}>{label}</span>
}

// ══════════════════════════════════════════════════════════════════════════
// WALK-IN MODAL — 3-step flow
// ══════════════════════════════════════════════════════════════════════════
function WalkInModal({ onClose, barber, services, availability, appointments, onCreated }) {
  const [step, setStep]         = useState(1) // 1=info, 2=service, 3=time
  const [name,  setName]        = useState('')
  const [phone, setPhone]       = useState('')
  const [email, setEmail]       = useState('')
  const [notes, setNotes]       = useState('')
  const [selSvc, setSelSvc]     = useState(null)
  const [selDate,setSelDate]    = useState(new Date())
  const [selSlot,setSelSlot]    = useState(null)
  const [saving, setSaving]     = useState(false)
  const [weekOff,setWeekOff]    = useState(0)

  const today    = startOfDay(new Date())
  const advance  = availability?.advanceDays || 30
  const weekDays = Array.from({length:7},(_,i)=>addDays(today,weekOff*7+i)).filter(d=>d<=addDays(today,advance))

  const activeServices = services.filter(s => s.isActive !== false)

  const slots = useMemo(() => {
    if (!selSvc || !selDate || !availability) return []
    const dayIdx = selDate.getDay()
    const ds = availability.schedule?.[dayIdx] || { enabled:(availability.workingDays||[1,2,3,4,5,6]).includes(dayIdx), startTime:availability.startTime||'09:00', endTime:availability.endTime||'18:00', breaks:availability.breaks||[] }
    if (!ds.enabled) return []
    const dateStr  = format(selDate,'yyyy-MM-dd')
    const existing = appointments.filter(a=>a.date===dateStr&&a.bookingStatus!=='cancelled').map(a=>({startTime:a.startTime,endTime:a.endTime}))
    let sl = generateTimeSlots(ds.startTime, ds.endTime, selSvc.duration, ds.breaks||[], existing)
    if (isToday(selDate)) { const nm=new Date().getHours()*60+new Date().getMinutes(); sl=sl.filter(s=>{const[h,m]=s.startTime.split(':').map(Number);return h*60+m>nm}) }
    return sl
  }, [selSvc, selDate, availability, appointments])

  function isDayDisabled(date) {
    if (date < today) return true
    const dayIdx = date.getDay()
    const ds = availability?.schedule?.[dayIdx]
    if (ds && !ds.enabled) return true
    if (availability?.blockedDates?.includes(format(date,'yyyy-MM-dd'))) return true
    return false
  }

  async function create() {
    if (!name.trim())  { toast.error('Name required'); return }
    if (!selSvc)       { toast.error('Select a service'); return }
    if (!selSlot)      { toast.error('Select a time'); return }
    setSaving(true)
    try {
      const dateStr = format(selDate,'yyyy-MM-dd')
      await addDoc(collection(db,'appointments'), {
        barberId:      barber.id,
        barberName:    barber.name,
        clientId:      null,
        clientName:    name.trim(),
        clientPhone:   phone.trim(),
        clientEmail:   email.trim(),
        isGuest:       true,
        isWalkIn:      true,
        services:      [{ id:selSvc.id, name:selSvc.name, price:selSvc.price, duration:selSvc.duration }],
        date:          dateStr,
        startTime:     selSlot.startTime,
        endTime:       selSlot.endTime,
        totalDuration: selSvc.duration,
        totalPrice:    selSvc.price,
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        bookingStatus: 'confirmed',
        notes:         notes.trim() || null,
        createdAt:     serverTimestamp(),
      })
      toast.success('Walk-in booked! ✂️')
      onCreated()
      onClose()
    } catch { toast.error('Could not create appointment') }
    finally { setSaving(false) }
  }

  const canProceed = step===1 ? name.trim().length>0 : step===2 ? !!selSvc : !!selSlot

  return (
    <div style={{ position:'fixed', inset:0, zIndex:70, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ width:'100%', maxWidth:500, background:CARD, borderRadius:'24px 24px 0 0', border:`1px solid ${BORDER}`, maxHeight:'92dvh', overflowY:'auto', animation:'slideUp 0.28s cubic-bezier(0.22,1,0.36,1)', ...F }} onClick={e=>e.stopPropagation()}>

        {/* Handle */}
        <div style={{ width:40, height:4, borderRadius:2, background:BORDER, margin:'12px auto 0' }}/>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:`1px solid ${BORDER}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {step > 1 && (
              <button onClick={() => setStep(s=>s-1)} style={{ background:'none', border:'none', color:TXT2, cursor:'pointer', display:'flex', padding:0 }}>
                <ChevronLeft size={20}/>
              </button>
            )}
            <div>
              <p style={{ color:TXT, fontWeight:800, fontSize:17, margin:'0 0 2px' }}>
                {step===1 ? '👤 Client Info' : step===2 ? '✂️ Service' : '🕐 Date & Time'}
              </p>
              <p style={{ color:TXT2, fontSize:12, margin:0 }}>Step {step} of 3</p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* Step dots */}
            <div style={{ display:'flex', gap:5 }}>
              {[1,2,3].map(s => (
                <div key={s} style={{ width: s===step?20:6, height:6, borderRadius:3, background:s<=step?WALKIN:BORDER, transition:'all 0.2s' }}/>
              ))}
            </div>
            <button onClick={onClose} style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:10, padding:'6px 7px', color:TXT2, cursor:'pointer', display:'flex' }}><X size={16}/></button>
          </div>
        </div>

        <div style={{ padding:'20px 20px 40px' }}>

          {/* ── STEP 1: Client Info ── */}
          {step === 1 && (
            <div className="fade-up">
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {[
                  { label:'FULL NAME *', value:name, set:setName, type:'text', placeholder:'Client name', ac:'name' },
                  { label:'PHONE',       value:phone,set:setPhone,type:'tel', placeholder:'(305) 000-0000', ac:'tel' },
                  { label:'EMAIL',       value:email,set:setEmail,type:'email',placeholder:'email@example.com',ac:'email' },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ display:'block', color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>{f.label}</label>
                    <input type={f.type} value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder} autoComplete={f.ac}
                      style={{ width:'100%', background:BG, border:`1px solid ${BORDER}`, borderRadius:12, padding:'13px 14px', color:TXT, fontSize:16, outline:'none', ...F, transition:'border-color 0.2s' }}
                      onFocus={e=>e.target.style.borderColor=WALKIN}
                      onBlur={e=>e.target.style.borderColor=BORDER}
                    />
                  </div>
                ))}
                <div>
                  <label style={{ display:'block', color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>NOTES (OPTIONAL)</label>
                  <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Style preferences, notes…" rows={3}
                    style={{ width:'100%', background:BG, border:`1px solid ${BORDER}`, borderRadius:12, padding:'13px 14px', color:TXT, fontSize:14, outline:'none', resize:'none', ...F }}
                    onFocus={e=>e.target.style.borderColor=WALKIN}
                    onBlur={e=>e.target.style.borderColor=BORDER}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Service ── */}
          {step === 2 && (
            <div className="fade-up">
              {activeServices.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 0' }}>
                  <p style={{ color:TXT2, fontSize:14 }}>No active services. Add services first.</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {activeServices.map(svc => {
                    const sel = selSvc?.id === svc.id
                    return (
                      <button key={svc.id} onClick={() => setSelSvc(svc)}
                        style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:16, background:sel?`${WALKIN}14`:CARD2, border:`1.5px solid ${sel?WALKIN:BORDER}`, cursor:'pointer', textAlign:'left', ...F, width:'100%', transition:'all 0.15s' }}>
                        <div style={{ width:40, height:40, borderRadius:12, background:sel?`${WALKIN}20`:BG, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Scissors size={17} color={sel?WALKIN:TXT3} strokeWidth={1.8}/>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ color:sel?TXT:TXT, fontWeight:700, fontSize:14, margin:'0 0 3px' }}>{svc.name}</p>
                          <p style={{ color:TXT2, fontSize:12, margin:0 }}>{formatDuration(svc.duration)}{svc.description ? ` · ${svc.description}` : ''}</p>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                          <p style={{ color:sel?WALKIN:ORANGE, fontWeight:800, fontSize:15, margin:0 }}>{formatCurrency(svc.price)}</p>
                          <div style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${sel?WALKIN:BORDER}`, background:sel?WALKIN:'transparent', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
                            {sel && <Check size={12} color="#fff"/>}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Date & Time ── */}
          {step === 3 && (
            <div className="fade-up">
              {/* Week nav */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <button onClick={()=>{setWeekOff(w=>Math.max(0,w-1));setSelSlot(null)}} disabled={weekOff===0}
                  style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:weekOff===0?'not-allowed':'pointer', opacity:weekOff===0?0.3:1, color:TXT }}>
                  <ChevronLeft size={16}/>
                </button>
                <span style={{ color:TXT2, fontSize:12, fontWeight:600 }}>
                  {weekDays[0]&&format(weekDays[0],'MMM d')} – {weekDays[weekDays.length-1]&&format(weekDays[weekDays.length-1],'MMM d')}
                </span>
                <button onClick={()=>{setWeekOff(w=>w+1);setSelSlot(null)}} disabled={weekDays.length<7}
                  style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:weekDays.length<7?'not-allowed':'pointer', opacity:weekDays.length<7?0.3:1, color:TXT }}>
                  <ChevronRight size={16}/>
                </button>
              </div>

              {/* Day pills */}
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${weekDays.length},1fr)`, gap:6, marginBottom:18 }}>
                {weekDays.map((date,i) => {
                  const disabled = isDayDisabled(date)
                  const sel      = isSameDay(date,selDate)
                  return (
                    <button key={i} onClick={() => { if(!disabled){setSelDate(date);setSelSlot(null)} }} disabled={disabled}
                      style={{ padding:'10px 2px', borderRadius:14, border:`1.5px solid ${sel?WALKIN:BORDER}`, background:sel?WALKIN:BG, cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.2:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, transition:'all 0.15s' }}>
                      <span style={{ color:sel?'rgba(255,255,255,0.7)':TXT3, fontSize:9, fontWeight:700 }}>{format(date,'EEE').toUpperCase()}</span>
                      <span style={{ color:sel?'#fff':isToday(date)?ORANGE:TXT, fontSize:15, fontWeight:800 }}>{format(date,'d')}</span>
                    </button>
                  )
                })}
              </div>

              {/* Time slots */}
              <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:12 }}>
                AVAILABLE TIMES · {format(selDate,'EEE, MMM d').toUpperCase()}
              </p>
              {slots.length === 0 ? (
                <div style={{ background:BG, border:`1px solid ${BORDER}`, borderRadius:14, padding:'24px', textAlign:'center' }}>
                  <p style={{ color:TXT2, fontSize:13, margin:0 }}>No available times for this day</p>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                  {slots.map(slot => {
                    const sel = selSlot?.startTime === slot.startTime
                    return (
                      <button key={slot.startTime} onClick={() => setSelSlot(slot)}
                        style={{ padding:'12px 4px', borderRadius:12, border:`1.5px solid ${sel?WALKIN:BORDER}`, background:sel?WALKIN:CARD2, color:sel?'#fff':TXT2, fontWeight:700, fontSize:13, cursor:'pointer', ...F, transition:'all 0.15s' }}>
                        {slot.startTime}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Summary */}
              {selSlot && (
                <div style={{ background:`${WALKIN}12`, border:`1px solid ${WALKIN}33`, borderRadius:14, padding:'14px 16px', marginTop:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <p style={{ color:TXT2, fontSize:12, margin:0 }}>{name} · {selSvc?.name}</p>
                    <p style={{ color:WALKIN, fontWeight:800, fontSize:15, margin:0 }}>{formatCurrency(selSvc?.price)}</p>
                  </div>
                  <p style={{ color:WALKIN, fontWeight:700, fontSize:14, margin:0 }}>
                    {format(selDate,'EEE, MMM d')} · {selSlot.startTime} – {selSlot.endTime}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          <div style={{ marginTop:24 }}>
            {step < 3 ? (
              <button onClick={() => canProceed && setStep(s=>s+1)} disabled={!canProceed}
                style={{ width:'100%', background:canProceed?WALKIN:BORDER, border:'none', borderRadius:22, padding:'17px', color:canProceed?'#fff':TXT3, fontWeight:700, fontSize:16, cursor:canProceed?'pointer':'not-allowed', ...F, transition:'all 0.15s', boxShadow:canProceed?`0 6px 24px ${WALKIN}44`:'none' }}>
                Continue →
              </button>
            ) : (
              <button onClick={create} disabled={saving || !canProceed}
                style={{ width:'100%', background:canProceed?WALKIN:BORDER, border:'none', borderRadius:22, padding:'17px', color:'#fff', fontWeight:700, fontSize:16, cursor:canProceed?'pointer':'not-allowed', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:`0 6px 24px ${WALKIN}44` }}>
                {saving && <div style={{ width:18, height:18, border:'2.5px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>}
                {saving ? 'Booking…' : '✓ Confirm Walk-in'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// CLIENT MODAL — appointment detail sheet
// ══════════════════════════════════════════════════════════════════════════
function ClientModal({ appt, allAppts, onClose, onReschedule, onCancel }) {
  const { formatTime } = useTheme()
  if (!appt) return null
  const isNow = new Date()>=apptStart(appt)&&new Date()<=apptEnd(appt)
  const related = allAppts.filter(a=>(appt.clientId&&a.clientId===appt.clientId)||(!appt.clientId&&a.clientPhone&&a.clientPhone===appt.clientPhone&&a.clientPhone)).sort((a,b)=>b.date?.localeCompare(a.date))
  const visits  = related.filter(a=>a.bookingStatus==='completed').length
  const spent   = related.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)

  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ width:'100%', maxWidth:560, background:CARD, borderRadius:'22px 22px 0 0', border:`1px solid ${BORDER}`, maxHeight:'90dvh', overflowY:'auto', animation:'slideUp 0.28s cubic-bezier(0.22,1,0.36,1)', ...F }} onClick={e=>e.stopPropagation()}>

        {isNow && (
          <div style={{ background:`linear-gradient(135deg,${ORANGE},#FF8C42)`, padding:'13px 20px', borderRadius:'22px 22px 0 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'rgba(255,255,255,0.9)', animation:'pulse 1.5s infinite' }}/>
              <span style={{ color:'#fff', fontWeight:800, fontSize:11, letterSpacing:'0.12em' }}>NOW SERVING</span>
            </div>
            <span style={{ color:'rgba(255,255,255,0.85)', fontWeight:700, fontSize:13 }}><Countdown appt={appt}/></span>
          </div>
        )}

        <div style={{ padding:'20px 20px 40px' }}>
          {!isNow && <div style={{ width:40, height:4, borderRadius:2, background:BORDER, margin:'0 auto 16px' }}/>}

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <Avatar name={appt.clientName} photoURL={appt.clientPhotoURL} size={52} fontSize={17} highlight={isNow}/>
              <div>
                <p style={{ color:TXT, fontWeight:800, fontSize:17, margin:'0 0 5px' }}>{appt.clientName}</p>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {appt.isWalkIn && <span style={{ background:`${WALKIN}20`, color:WALKIN, fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:800 }}>✂️ Walk-in</span>}
                  {appt.isGuest  && <span style={{ background:CARD2, color:TXT2, fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:700, border:`1px solid ${BORDER}` }}>Guest</span>}
                  <StatusBadge status={appt.bookingStatus} isWalkIn={appt.isWalkIn}/>
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:10, padding:'6px 7px', color:TXT2, cursor:'pointer', display:'flex' }}><X size={16}/></button>
          </div>

          {/* Contact */}
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
            {appt.clientEmail && (
              <div style={{ display:'flex', alignItems:'center', gap:10, background:CARD2, borderRadius:12, padding:'10px 14px' }}>
                <Mail size={13} color={TXT3}/><span style={{ color:TXT2, fontSize:13 }}>{appt.clientEmail}</span>
              </div>
            )}
            {appt.clientPhone && (
              <div style={{ display:'flex', alignItems:'center', gap:10, background:CARD2, borderRadius:12, padding:'10px 14px' }}>
                <Phone size={13} color={TXT3}/>
                <a href={`tel:${appt.clientPhone}`} style={{ color:ORANGE, fontSize:13, textDecoration:'none', fontWeight:600 }}>{appt.clientPhone}</a>
              </div>
            )}
          </div>

          {/* Details */}
          <div style={{ background:BG, border:`1.5px solid ${isNow?`${ORANGE}44`:BORDER}`, borderRadius:16, padding:14, marginBottom:14 }}>
            <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:12 }}>APPOINTMENT</p>
            {appt.services?.map((s,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:i<appt.services.length-1?10:0 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:CARD2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Scissors size={14} color={TXT3}/>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ color:TXT, fontWeight:700, fontSize:14, margin:'0 0 1px' }}>{s.name}</p>
                  <p style={{ color:TXT2, fontSize:12, margin:0 }}>{formatDuration(s.duration)}</p>
                </div>
                <p style={{ color:ORANGE, fontWeight:800, fontSize:14, flexShrink:0 }}>{formatCurrency(s.price)}</p>
              </div>
            ))}
            <div style={{ height:1, background:BORDER, margin:'12px 0' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ color:TXT2, fontSize:13 }}>{formatTime(appt.startTime)} – {formatTime(appt.endTime)} · {formatDuration(appt.totalDuration)}</span>
              <span style={{ color:ORANGE, fontWeight:900, fontSize:16 }}>{formatCurrency(appt.totalWithTip||appt.totalPrice)}</span>
            </div>
            {appt.tip>0 && <p style={{ color:GREEN, fontSize:12, margin:'6px 0 0' }}>+{formatCurrency(appt.tip)} tip</p>}
            {appt.notes && <p style={{ color:TXT2, fontSize:12, margin:'8px 0 0', fontStyle:'italic' }}>"{appt.notes}"</p>}
          </div>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
            {[{l:'Total Visits',v:visits},{l:'Total Spent',v:formatCurrency(spent)}].map(s=>(
              <div key={s.l} style={{ background:BG, border:`1px solid ${BORDER}`, borderRadius:14, padding:'12px 12px', textAlign:'center' }}>
                <p style={{ color:ORANGE, fontWeight:900, fontSize:20, margin:'0 0 4px', letterSpacing:'-0.5px' }}>{s.v}</p>
                <p style={{ color:TXT3, fontSize:10, margin:0, fontWeight:600 }}>{s.l}</p>
              </div>
            ))}
          </div>

          {appt.bookingStatus!=='completed'&&appt.bookingStatus!=='cancelled' && (
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>onReschedule(appt)} style={{ flex:1, padding:'13px', borderRadius:14, background:CARD2, border:`1px solid ${BORDER}`, color:TXT, fontWeight:600, fontSize:14, cursor:'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <Calendar size={14}/> Reschedule
              </button>
              <button onClick={()=>onCancel(appt)} style={{ flex:1, padding:'13px', borderRadius:14, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#EF4444', fontWeight:600, fontSize:14, cursor:'pointer', ...F }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Cancel modal ──────────────────────────────────────────────────────────
function CancelModal({ appt, onClose, onDone }) {
  const [reason,setReason]=useState(''); const [saving,setSaving]=useState(false)
  async function confirm() {
    setSaving(true)
    try { await updateDoc(doc(db,'appointments',appt.id),{bookingStatus:'cancelled',cancelReason:reason}); onDone() }
    catch {} setSaving(false); onClose()
  }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:70, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div style={{ width:'100%', maxWidth:340, background:CARD, borderRadius:22, border:`1px solid ${BORDER}`, padding:24, ...F }} onClick={e=>e.stopPropagation()}>
        <p style={{ color:TXT, fontWeight:800, fontSize:18, marginBottom:6 }}>Cancel appointment?</p>
        <p style={{ color:TXT2, fontSize:14, marginBottom:18 }}>{appt.clientName} · {appt.startTime}</p>
        <div style={{ borderBottom:`1.5px solid ${BORDER}`, paddingBottom:10, marginBottom:20 }}>
          <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason (optional)"
            style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:TXT, fontSize:16, ...F }}/>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:'13px', borderRadius:14, background:'transparent', border:`1px solid ${BORDER}`, color:TXT2, fontWeight:600, cursor:'pointer', ...F }}>Keep it</button>
          <button onClick={confirm} disabled={saving} style={{ flex:1, padding:'13px', borderRadius:14, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#EF4444', fontWeight:700, cursor:'pointer', ...F }}>
            {saving?'Cancelling…':'Yes, Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Appointment row ───────────────────────────────────────────────────────
function ApptRow({ a, onClick, isCurrent, formatTime }) {
  const isDone = a.bookingStatus==='completed'
  return (
    <button onClick={onClick}
      style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 14px', borderRadius:14, width:'100%', cursor:'pointer', textAlign:'left', ...F, background:isCurrent?`${ORANGE}10`:a.isWalkIn?`${WALKIN}08`:CARD2, border:`1px solid ${isCurrent?`${ORANGE}40`:a.isWalkIn?`${WALKIN}30`:BORDER}`, opacity:isDone?0.5:1, transition:'all 0.15s', marginBottom:8 }}>
      <Avatar name={a.clientName} photoURL={a.clientPhotoURL} size={40} fontSize={13} highlight={isCurrent}/>
      <div style={{ display:'flex', flexDirection:'column', minWidth:46, flexShrink:0 }}>
        <p style={{ color:isCurrent?ORANGE:TXT2, fontWeight:700, fontSize:12, margin:0 }}>{formatTime(a.startTime)}</p>
        <p style={{ color:TXT3, fontSize:11, margin:0 }}>{formatTime(a.endTime)}</p>
      </div>
      <div style={{ width:1, height:26, background:BORDER, flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
          <p style={{ color:TXT, fontWeight:700, fontSize:14, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.clientName}</p>
          {a.isWalkIn && <span style={{ background:`${WALKIN}20`, color:WALKIN, fontSize:8, fontWeight:800, padding:'1px 6px', borderRadius:10, flexShrink:0 }}>WALK-IN</span>}
        </div>
        <p style={{ color:TXT2, fontSize:12, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.services?.map(s=>s.name).join(', ')}</p>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', flexShrink:0, gap:4 }}>
        <p style={{ color:ORANGE, fontWeight:800, fontSize:13, margin:0 }}>{formatCurrency(a.totalWithTip||a.totalPrice)}</p>
        <StatusBadge status={a.bookingStatus} isWalkIn={a.isWalkIn}/>
      </div>
      <ChevronRight size={14} color={TXT3}/>
    </button>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════
export default function BarberDashboard() {
  const { user }       = useAuth()
  const { formatTime } = useTheme()
  const navigate       = useNavigate()

  const [barber,       setBarber]       = useState(null)
  const [allAppts,     setAllAppts]     = useState([])
  const [services,     setServices]     = useState([])
  const [availability, setAvailability] = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [selectedAppt, setSelectedAppt] = useState(null)
  const [cancelAppt,   setCancelAppt]   = useState(null)
  const [showWalkIn,   setShowWalkIn]   = useState(false)

  useEffect(() => { window.scrollTo(0,0) }, [])

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db,'barbers'), where('userId','==',user.uid))).then(s => {
      if (!s.empty) setBarber({id:s.docs[0].id,...s.docs[0].data()})
      else setLoading(false)
    })
  }, [user])

  useEffect(() => {
    if (!barber) return
    // Appointments
    const unsubA = onSnapshot(query(collection(db,'appointments'), where('barberId','==',barber.id)), snap => {
      setAllAppts(snap.docs.map(d=>({id:d.id,...d.data()})))
      setLoading(false)
    })
    // Services
    getDocs(query(collection(db,'services'), where('barberId','==',barber.id))).then(snap => {
      setServices(snap.docs.map(d=>({id:d.id,...d.data()})))
    })
    // Availability
    getDocs(query(collection(db,'availability'), where('barberId','==',barber.id))).then(snap => {
      if (!snap.empty) setAvailability(snap.docs[0].data())
    })
    return () => unsubA()
  }, [barber])

  if (loading) return <BarberLayout><PageLoader/></BarberLayout>

  const now    = new Date()
  const today  = format(now,'yyyy-MM-dd')
  const active = allAppts.filter(a=>a.bookingStatus!=='cancelled')

  const todayAppts     = active.filter(a=>a.date===today).sort((a,b)=>a.startTime.localeCompare(b.startTime))
  const todayEarned    = todayAppts.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)
  const todayProjected = todayAppts.filter(a=>a.paymentStatus!=='paid'&&a.bookingStatus!=='cancelled').reduce((s,a)=>s+(a.totalPrice||0),0)
  const efficiency     = todayAppts.length>0?Math.round((todayAppts.filter(a=>a.bookingStatus==='completed').length/todayAppts.length)*100):0
  const currentAppt    = todayAppts.find(a=>now>=apptStart(a)&&now<=apptEnd(a))
  const nextAppt       = todayAppts.find(a=>apptStart(a)>now)
  const upcoming       = active.filter(a=>a.date>today).sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime)).slice(0,5)

  const greeting = now.getHours()<12?'Good morning,':now.getHours()<17?'Good afternoon,':'Good evening,'

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{ background:BG, minHeight:'100vh', paddingBottom:20, ...F }}>
        <div style={{ padding:'16px 18px', maxWidth:640, margin:'0 auto' }}>

          {/* ── Header ── */}
          <div className="fade-up" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <Avatar name={barber?.name} photoURL={barber?.photoURL} size={48} fontSize={16}/>
              <div>
                <p style={{ color:TXT2, fontSize:12, fontWeight:500, margin:'0 0 1px' }}>{greeting}</p>
                <p style={{ color:TXT, fontWeight:900, fontSize:22, margin:0, letterSpacing:'-0.5px' }}>{barber?.name?.split(' ')[0]||'Barber'}</p>
              </div>
            </div>
            <div style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:12, padding:'8px 10px', textAlign:'right' }}>
              <p style={{ color:TXT3, fontSize:9, fontWeight:700, letterSpacing:'0.08em', margin:'0 0 1px' }}>TODAY</p>
              <p style={{ color:TXT2, fontSize:11, fontWeight:600, margin:0 }}>{format(now,'MMM d, yyyy')}</p>
            </div>
          </div>

          {/* ── Today's Overview ── */}
          <div className="fade-up" style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, padding:'16px 18px', marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <p style={{ color:TXT, fontWeight:700, fontSize:15, margin:0 }}>Today's Overview</p>
              <span style={{ color:ORANGE, fontSize:12, fontWeight:700 }}>{todayAppts.length} appt{todayAppts.length!==1?'s':''}</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom: (todayEarned+todayProjected)>0 ? 14 : 0 }}>
              {[
                {label:'Appointments', value:todayAppts.length,            color:TXT},
                {label:'Earnings',     value:formatCurrency(todayEarned),  color:GREEN},
                {label:'Efficiency',   value:`${efficiency}%`,             color:ORANGE},
              ].map(s=>(
                <div key={s.label} style={{ background:BG, borderRadius:14, padding:'13px 10px', textAlign:'center' }}>
                  <p style={{ color:s.color, fontWeight:900, fontSize:22, margin:'0 0 4px', letterSpacing:'-0.5px' }}>{s.value}</p>
                  <p style={{ color:TXT3, fontSize:10, margin:0, fontWeight:600 }}>{s.label}</p>
                </div>
              ))}
            </div>
            {(todayEarned+todayProjected)>0 && (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ color:TXT3, fontSize:11, fontWeight:600 }}>Earned</span>
                  <span style={{ color:TXT2, fontSize:11, fontWeight:600 }}>Projected {formatCurrency(todayProjected)}</span>
                </div>
                <div style={{ height:4, borderRadius:2, background:BORDER, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:2, background:`linear-gradient(90deg,${ORANGE},#FF8C42)`, width:`${Math.round(todayEarned/(todayEarned+todayProjected)*100)}%`, transition:'width 0.5s' }}/>
                </div>
              </div>
            )}
          </div>

          {/* ── Now Serving ── */}
          {currentAppt && (
            <button className="fade-up" onClick={()=>setSelectedAppt(currentAppt)}
              style={{ width:'100%', background:`linear-gradient(135deg,${ORANGE},#FF8C42)`, borderRadius:20, padding:'18px', marginBottom:12, border:'none', cursor:'pointer', textAlign:'left', ...F, boxShadow:`0 8px 32px ${ORANGE}44` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:'rgba(255,255,255,0.9)', animation:'pulse 1.5s infinite' }}/>
                    <span style={{ color:'rgba(255,255,255,0.85)', fontSize:10, fontWeight:800, letterSpacing:'0.14em' }}>NOW SERVING</span>
                  </div>
                  <p style={{ color:'#fff', fontWeight:900, fontSize:24, margin:'0 0 4px', letterSpacing:'-0.4px' }}>{currentAppt.clientName}</p>
                  <p style={{ color:'rgba(255,255,255,0.7)', fontSize:13, margin:'0 0 10px' }}>{currentAppt.services?.map(s=>s.name).join(', ')}</p>
                  <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:20, padding:'5px 12px', display:'inline-flex', alignItems:'center', gap:6 }}>
                    <Clock size={11} color="rgba(255,255,255,0.85)"/>
                    <span style={{ color:'rgba(255,255,255,0.9)', fontWeight:700, fontSize:12 }}><Countdown appt={currentAppt}/></span>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ color:'#fff', fontWeight:900, fontSize:26, margin:'0 0 4px', letterSpacing:'-0.6px' }}>{formatCurrency(currentAppt.totalPrice)}</p>
                  <p style={{ color:'rgba(255,255,255,0.6)', fontSize:12 }}>{formatTime(currentAppt.startTime)} – {formatTime(currentAppt.endTime)}</p>
                </div>
              </div>
            </button>
          )}

          {/* ── Next Up ── */}
          {!currentAppt && nextAppt && (
            <button className="fade-up" onClick={()=>setSelectedAppt(nextAppt)}
              style={{ width:'100%', background:CARD, border:`1px solid ${BORDER}`, borderLeft:`3px solid ${ORANGE}`, borderRadius:16, padding:'14px 16px', marginBottom:12, cursor:'pointer', textAlign:'left', ...F }}>
              <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:6 }}>NEXT UP</p>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <p style={{ color:TXT, fontWeight:700, fontSize:15, margin:'0 0 3px' }}>{nextAppt.clientName}</p>
                  <p style={{ color:TXT2, fontSize:13, margin:0 }}>{formatTime(nextAppt.startTime)} · {nextAppt.services?.map(s=>s.name).join(', ')}</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ color:ORANGE, fontWeight:800, fontSize:16, margin:'0 0 3px' }}>{formatCurrency(nextAppt.totalPrice)}</p>
                  <p style={{ color:TXT3, fontSize:12, margin:0 }}><Countdown appt={nextAppt}/></p>
                </div>
              </div>
            </button>
          )}

          {/* ── Today's Appointments ── */}
          <div className="fade-up" style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <p style={{ color:TXT, fontWeight:700, fontSize:16, margin:0 }}>Today's Appointments</p>
              <button onClick={()=>navigate('/barber/calendar')}
                style={{ color:ORANGE, fontSize:12, fontWeight:700, background:'none', border:'none', cursor:'pointer', ...F, display:'flex', alignItems:'center', gap:3 }}>
                View all <ChevronRight size={13}/>
              </button>
            </div>

            {todayAppts.length===0 ? (
              <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:'28px', textAlign:'center' }}>
                <Scissors size={26} style={{ color:TXT3, display:'block', margin:'0 auto 10px' }} strokeWidth={1.5}/>
                <p style={{ color:TXT2, fontWeight:600, fontSize:14, margin:'0 0 4px' }}>No appointments today</p>
                <p style={{ color:TXT3, fontSize:13, margin:0 }}>Add a walk-in below</p>
              </div>
            ) : (
              todayAppts.map(a=>(
                <ApptRow key={a.id} a={a} onClick={()=>setSelectedAppt(a)} isCurrent={currentAppt?.id===a.id} formatTime={formatTime}/>
              ))
            )}
          </div>

          {/* ── CTAs ── */}
          <div className="fade-up" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            {/* Walk-in button — purple */}
            <button onClick={() => setShowWalkIn(true)}
              style={{ background:WALKIN, color:'#fff', border:'none', borderRadius:18, padding:'16px 12px', fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, ...F, boxShadow:`0 4px 20px ${WALKIN}44` }}>
              <UserPlus size={17}/> Walk-in
            </button>
            {/* New appointment — orange */}
            <button onClick={()=>navigate('/barber/calendar')}
              style={{ background:ORANGE, color:'#fff', border:'none', borderRadius:18, padding:'16px 12px', fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, ...F, boxShadow:`0 4px 20px ${ORANGE}44` }}>
              <Plus size={17}/> New Appt
            </button>
          </div>

          {/* ── Upcoming ── */}
          {upcoming.length>0 && (
            <div className="fade-up" style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, padding:'16px 18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <p style={{ color:TXT, fontWeight:700, fontSize:15, margin:0 }}>Upcoming</p>
                <TrendingUp size={16} color={TXT3}/>
              </div>
              {upcoming.map((a,i)=>{
                const d     = parseLocalDate(a.date)
                const label = isToday(d)?'Today':isTomorrow(d)?'Tomorrow':format(d,'MMM d')
                return (
                  <button key={a.id} onClick={()=>setSelectedAppt(a)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:i<upcoming.length-1?`1px solid ${BORDER}`:'none', background:'transparent', border:'none', cursor:'pointer', textAlign:'left', ...F, width:'100%' }}>
                    <Avatar name={a.clientName} photoURL={a.clientPhotoURL} size={36} fontSize={12}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                        <p style={{ color:TXT, fontWeight:700, fontSize:13, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.clientName}</p>
                        {a.isWalkIn && <span style={{ background:`${WALKIN}20`, color:WALKIN, fontSize:8, fontWeight:800, padding:'1px 5px', borderRadius:8, flexShrink:0 }}>W</span>}
                      </div>
                      <p style={{ color:TXT2, fontSize:12, margin:0 }}>{label} · {formatTime(a.startTime)}</p>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                      <p style={{ color:ORANGE, fontWeight:800, fontSize:13, margin:0 }}>{formatCurrency(a.totalPrice)}</p>
                      <StatusBadge status={a.bookingStatus} isWalkIn={a.isWalkIn}/>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedAppt && (
        <ClientModal appt={selectedAppt} allAppts={allAppts}
          onClose={()=>setSelectedAppt(null)}
          onReschedule={a=>{setSelectedAppt(null);navigate('/barber/calendar',{state:{rescheduleId:a.id}})}}
          onCancel={a=>{setSelectedAppt(null);setCancelAppt(a)}}/>
      )}
      {cancelAppt && <CancelModal appt={cancelAppt} onClose={()=>setCancelAppt(null)} onDone={()=>setCancelAppt(null)}/>}
      {showWalkIn && (
        <WalkInModal
          onClose={()=>setShowWalkIn(false)}
          barber={barber}
          services={services}
          availability={availability}
          appointments={allAppts}
          onCreated={()=>{}}
        />
      )}
    </BarberLayout>
  )
}