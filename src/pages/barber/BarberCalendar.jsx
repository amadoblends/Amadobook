import { useEffect, useState, useMemo } from 'react'
import {
  collection, query, where, getDocs,
  doc, updateDoc, onSnapshot
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import {
  formatCurrency, formatDuration, getInitials,
  parseLocalDate, generateTimeSlots
} from '../../utils/helpers'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isSameDay, startOfWeek, endOfWeek, isToday, addMonths, subMonths,
  startOfDay, addDays, isAfter
} from 'date-fns'
import toast from 'react-hot-toast'
import BarberLayout from '../../components/layout/BarberLayout'
import { useTheme } from '../../context/ThemeContext'
import { createNotification } from '../../utils/notifications'
import {
  ChevronLeft, ChevronRight, CheckCircle, DollarSign,
  XCircle, RefreshCw, Plus, Clock, X, Phone, Mail,
  Scissors, Calendar, ZoomIn, ZoomOut
} from 'lucide-react'
import { PageLoader } from '../../components/ui/Spinner'

// ── Design tokens ─────────────────────────────────────────────────────────
const BG     = '#0D0D0D'
const CARD   = '#171717'
const CARD2  = '#1F1F1F'
const BORDER = '#2A2A2A'
const ORANGE = '#FF6B1A'
const TXT    = '#F5F5F5'
const TXT2   = '#888888'
const TXT3   = '#555555'
const F      = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const SC = {
  pending:   ORANGE,
  confirmed: '#22C55E',
  completed: TXT3,
  cancelled: '#EF4444',
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
  * { box-sizing: border-box; }
  input, textarea { font-size: 16px !important; }
  ::-webkit-scrollbar { display: none; }
`

// ── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const MAP = {
    confirmed: { bg:'rgba(34,197,94,0.12)',  color:'#22C55E',  label:'Confirmed' },
    pending:   { bg:`${ORANGE}18`,           color:ORANGE,     label:'Pending'   },
    completed: { bg:'rgba(255,255,255,0.06)',color:TXT2,       label:'Completed' },
    cancelled: { bg:'rgba(239,68,68,0.12)',  color:'#EF4444',  label:'Cancelled' },
  }
  const s = MAP[status] || MAP.pending
  return (
    <span style={{ background:s.bg, color:s.color, fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:20, letterSpacing:'0.04em', whiteSpace:'nowrap' }}>
      {s.label}
    </span>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────
function Avatar({ name, photoURL, size=38, fontSize=12 }) {
  const initials = name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) || '?'
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:CARD2, border:`1.5px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize, color:TXT2, flexShrink:0, overflow:'hidden' }}>
      {photoURL ? <img src={photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : initials}
    </div>
  )
}

// ── Bottom sheet wrapper ──────────────────────────────────────────────────
function Sheet({ open, onClose, children }) {
  if (!open) return null
  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ width:'100%', maxWidth:560, background:CARD, borderRadius:'22px 22px 0 0', border:`1px solid ${BORDER}`, maxHeight:'90vh', overflowY:'auto', animation:'slideUp 0.25s ease', ...F }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:40, height:4, borderRadius:2, background:BORDER, margin:'12px auto 0' }}/>
        {children}
      </div>
    </div>
  )
}

// ── Reschedule modal ──────────────────────────────────────────────────────
function RescheduleModal({ appt, appointments, availability, onClose, onSave, updating }) {
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [note, setNote]       = useState('')
  const [weekOffset, setWeekOffset] = useState(0)

  const today    = startOfDay(new Date())
  const advance  = availability?.advanceDays || 30
  const duration = appt?.totalDuration || 30
  const weekDays = Array.from({length:7},(_,i)=>addDays(today,weekOffset*7+i)).filter(d=>!isAfter(d,addDays(today,advance)))

  const slots = useMemo(() => {
    if (!selectedDate||!availability) return []
    const dayIdx = selectedDate.getDay()
    const ds = availability.schedule?.[dayIdx]||{ enabled:(availability.workingDays||[1,2,3,4,5,6]).includes(dayIdx), startTime:availability.startTime||'09:00', endTime:availability.endTime||'18:00', breaks:availability.breaks||[] }
    if (!ds.enabled) return []
    const dateStr  = format(selectedDate,'yyyy-MM-dd')
    const existing = (appointments||[]).filter(a=>a.date===dateStr&&a.bookingStatus!=='cancelled'&&a.id!==appt?.id).map(a=>({startTime:a.startTime,endTime:a.endTime}))
    let s = generateTimeSlots(ds.startTime,ds.endTime,duration,ds.breaks||[],existing)
    if (isSameDay(selectedDate,today)) { const nm=new Date().getHours()*60+new Date().getMinutes()+15; s=s.filter(sl=>{const[h,m]=sl.startTime.split(':').map(Number);return h*60+m>nm}) }
    return s
  },[selectedDate,availability,appointments,appt])

  function slotCount(date) {
    if (!availability) return 0
    const dayIdx=date.getDay()
    const ds=availability.schedule?.[dayIdx]||{enabled:(availability.workingDays||[1,2,3,4,5,6]).includes(dayIdx),startTime:availability.startTime||'09:00',endTime:availability.endTime||'18:00',breaks:availability.breaks||[]}
    if (!ds.enabled) return 0
    const dateStr=format(date,'yyyy-MM-dd')
    const existing=(appointments||[]).filter(a=>a.date===dateStr&&a.bookingStatus!=='cancelled'&&a.id!==appt?.id).map(a=>({startTime:a.startTime,endTime:a.endTime}))
    let s=generateTimeSlots(ds.startTime,ds.endTime,duration,ds.breaks||[],existing)
    if (isSameDay(date,today)){const nm=new Date().getHours()*60+new Date().getMinutes()+15;s=s.filter(sl=>{const[h,m]=sl.startTime.split(':').map(Number);return h*60+m>nm})}
    return s.length
  }

  function isDayDisabled(date) { return date<today||isAfter(date,addDays(today,advance))||slotCount(date)===0 }

  async function confirm() {
    if (!selectedSlot) return toast.error('Select a time slot')
    await onSave({ date:format(selectedDate,'yyyy-MM-dd'), startTime:selectedSlot.startTime, endTime:selectedSlot.endTime, note:note.trim() })
  }

  return (
    <Sheet open onClose={onClose}>
      <div style={{ padding:'16px 20px 40px' }}>
        <p style={{ color:TXT, fontWeight:800, fontSize:18, margin:'0 0 4px' }}>Reschedule</p>
        <p style={{ color:TXT2, fontSize:13, margin:'0 0 20px' }}>{appt?.clientName} · {formatDuration(duration)}</p>

        {/* Current appt */}
        <div style={{ background:BG, border:`1px solid ${BORDER}`, borderRadius:14, padding:'12px 14px', marginBottom:16 }}>
          <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', margin:'0 0 4px' }}>CURRENT</p>
          <p style={{ color:TXT, fontWeight:700, fontSize:14, margin:0 }}>
            {appt?.date?format(parseLocalDate(appt.date),'EEE, MMM d'):'—'} · {appt?.startTime} – {appt?.endTime}
          </p>
        </div>

        {/* Week nav */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <button onClick={()=>{setWeekOffset(w=>Math.max(0,w-1));setSelectedDate(null);setSelectedSlot(null)}} disabled={weekOffset===0}
            style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:weekOffset===0?'not-allowed':'pointer', color:weekOffset===0?BORDER:TXT, opacity:weekOffset===0?0.3:1 }}>
            <ChevronLeft size={16}/>
          </button>
          <span style={{ color:TXT2, fontSize:12, fontWeight:600 }}>
            {weekDays[0]&&format(weekDays[0],'MMM d')} – {weekDays[weekDays.length-1]&&format(weekDays[weekDays.length-1],'MMM d')}
          </span>
          <button onClick={()=>{setWeekOffset(w=>w+1);setSelectedDate(null);setSelectedSlot(null)}} disabled={weekDays.length<7}
            style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:weekDays.length<7?'not-allowed':'pointer', color:weekDays.length<7?BORDER:TXT, opacity:weekDays.length<7?0.3:1 }}>
            <ChevronRight size={16}/>
          </button>
        </div>

        {/* Day pills */}
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${weekDays.length},1fr)`, gap:6, marginBottom:16 }}>
          {weekDays.map((date,i)=>{
            const disabled=isDayDisabled(date)
            const sel=selectedDate&&isSameDay(date,selectedDate)
            const count=!disabled?slotCount(date):0
            return (
              <button key={i} onClick={()=>{if(disabled)return;setSelectedDate(date);setSelectedSlot(null)}} disabled={disabled}
                style={{ padding:'10px 3px', borderRadius:14, border:`1.5px solid ${sel?ORANGE:BORDER}`, background:sel?ORANGE:BG, cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.25:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, transition:'all 0.15s', boxShadow:sel?`0 4px 14px ${ORANGE}44`:'none' }}>
                <span style={{ color:sel?'rgba(255,255,255,0.7)':TXT3, fontSize:9, fontWeight:700 }}>{format(date,'EEE').toUpperCase()}</span>
                <span style={{ color:sel?'#fff':isToday(date)?ORANGE:TXT, fontSize:15, fontWeight:800 }}>{format(date,'d')}</span>
                <span style={{ fontSize:9, fontWeight:700, color:sel?'rgba(255,255,255,0.6)':count>0?'#22C55E':'transparent' }}>{count>0?count:'-'}</span>
              </button>
            )
          })}
        </div>

        {/* Time slots */}
        {selectedDate && (
          <div style={{ marginBottom:16 }}>
            <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>
              {format(selectedDate,'EEEE, MMMM d').toUpperCase()}
            </p>
            {slots.length===0 ? (
              <div style={{ background:BG, border:`1px solid ${BORDER}`, borderRadius:12, padding:16, textAlign:'center' }}>
                <p style={{ color:TXT2, fontSize:13, margin:0 }}>No available times</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                {slots.map(slot=>{
                  const isSel=selectedSlot?.startTime===slot.startTime
                  return (
                    <button key={slot.startTime} onClick={()=>setSelectedSlot(slot)}
                      style={{ padding:'12px 4px', borderRadius:12, border:`1.5px solid ${isSel?ORANGE:BORDER}`, background:isSel?ORANGE:CARD2, color:isSel?'#fff':TXT2, fontWeight:700, fontSize:13, cursor:'pointer', ...F, transition:'all 0.15s', boxShadow:isSel?`0 4px 12px ${ORANGE}33`:'none' }}>
                      {slot.startTime}
                    </button>
                  )
                })}
              </div>
            )}
            {selectedSlot && (
              <div style={{ background:`${ORANGE}12`, border:`1px solid ${ORANGE}33`, borderRadius:12, padding:'12px 14px', marginTop:10 }}>
                <p style={{ color:ORANGE, fontWeight:700, fontSize:14, margin:0 }}>
                  {selectedSlot.startTime} – {selectedSlot.endTime} · {format(selectedDate,'MMM d')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Note */}
        <div style={{ marginBottom:20 }}>
          <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>NOTE (optional)</p>
          <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder="Reason for rescheduling..."
            style={{ width:'100%', background:BG, border:`1px solid ${BORDER}`, borderRadius:12, padding:'12px 14px', color:TXT, fontSize:14, resize:'none', outline:'none', ...F, boxSizing:'border-box' }}/>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:'14px', borderRadius:14, background:'transparent', border:`1px solid ${BORDER}`, color:TXT2, fontWeight:600, cursor:'pointer', ...F }}>Cancel</button>
          <button onClick={confirm} disabled={updating||!selectedSlot}
            style={{ flex:1, padding:'14px', borderRadius:14, background:selectedSlot?ORANGE:BORDER, color:'#fff', fontWeight:700, border:'none', cursor:selectedSlot?'pointer':'not-allowed', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:6, boxShadow:selectedSlot?`0 4px 16px ${ORANGE}44`:'none' }}>
            {updating&&<div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>}
            Confirm
          </button>
        </div>
      </div>
    </Sheet>
  )
}

// ── Appointment detail sheet ───────────────────────────────────────────────
function ApptSheet({ appt, onClose, onComplete, onTogglePaid, onReschedule, onCancel, formatTime, updating }) {
  if (!appt) return null
  return (
    <Sheet open onClose={onClose}>
      <div style={{ padding:'16px 20px 40px' }}>
        {/* Client header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:`${ORANGE}18`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:16, color:ORANGE }}>
              {getInitials(appt.clientName)}
            </div>
            <div>
              <p style={{ color:TXT, fontWeight:800, fontSize:17, margin:'0 0 3px' }}>{appt.clientName}</p>
              <StatusBadge status={appt.bookingStatus}/>
            </div>
          </div>
          <button onClick={onClose} style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:10, padding:'6px 7px', color:TXT2, cursor:'pointer', display:'flex' }}><X size={16}/></button>
        </div>

        {/* Contact */}
        {appt.clientEmail && (
          <div style={{ display:'flex', alignItems:'center', gap:10, background:CARD2, borderRadius:12, padding:'10px 14px', marginBottom:8 }}>
            <Mail size={13} color={TXT3}/><span style={{ color:TXT2, fontSize:13 }}>{appt.clientEmail}</span>
          </div>
        )}
        {appt.clientPhone && (
          <div style={{ display:'flex', alignItems:'center', gap:10, background:CARD2, borderRadius:12, padding:'10px 14px', marginBottom:16 }}>
            <Phone size={13} color={TXT3}/>
            <a href={`tel:${appt.clientPhone}`} style={{ color:ORANGE, fontSize:13, textDecoration:'none', fontWeight:600 }}>{appt.clientPhone}</a>
          </div>
        )}

        {/* Details card */}
        <div style={{ background:BG, border:`1px solid ${BORDER}`, borderRadius:16, padding:14, marginBottom:14 }}>
          {[
            ['Service', appt.services?.map(s=>s.name).join(', ')],
            ['Date',    appt.date?format(parseLocalDate(appt.date),'MMM d, yyyy'):'—'],
            ['Time',    `${formatTime(appt.startTime)} – ${formatTime(appt.endTime)}`],
            ['Duration',formatDuration(appt.totalDuration)],
            ['Price',   formatCurrency(appt.totalPrice)],
          ].map(([l,v])=>(
            <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${BORDER}` }}>
              <span style={{ color:TXT2, fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
                {l==='Service'&&<Scissors size={13} color={TXT3}/>}
                {l==='Date'&&<Calendar size={13} color={TXT3}/>}
                {l==='Time'&&<Clock size={13} color={TXT3}/>}
                {l}
              </span>
              <span style={{ color:l==='Price'?ORANGE:TXT, fontWeight:l==='Price'?800:600, fontSize:14 }}>{v}</span>
            </div>
          ))}
          {appt.tip>0 && (
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0' }}>
              <span style={{ color:TXT2, fontSize:13 }}>Tip</span>
              <span style={{ color:'#22C55E', fontWeight:700, fontSize:14 }}>+{formatCurrency(appt.tip)}</span>
            </div>
          )}
        </div>

        {appt.rescheduleNote && <div style={{ background:`${ORANGE}10`, border:`1px solid ${ORANGE}30`, borderRadius:10, padding:'8px 12px', fontSize:12, color:ORANGE, marginBottom:10 }}>Note: {appt.rescheduleNote}</div>}
        {appt.cancelReason   && <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#EF4444', marginBottom:10 }}>Cancelled: {appt.cancelReason}</div>}

        {/* Actions */}
        {appt.bookingStatus!=='cancelled' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {appt.bookingStatus!=='completed' && (
              <button onClick={onComplete}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 16px', borderRadius:14, background:'rgba(34,197,94,0.1)', color:'#22C55E', border:'1px solid rgba(34,197,94,0.2)', cursor:'pointer', fontWeight:700, fontSize:14, ...F }}>
                <CheckCircle size={16}/> Mark Completed
              </button>
            )}
            <button onClick={onTogglePaid}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 16px', borderRadius:14, background:`${ORANGE}10`, color:ORANGE, border:`1px solid ${ORANGE}30`, cursor:'pointer', fontWeight:700, fontSize:14, ...F }}>
              <DollarSign size={16}/> {appt.paymentStatus==='paid'?'Mark Unpaid':'Mark Paid'}
            </button>
            <button onClick={onReschedule}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 16px', borderRadius:14, background:CARD2, color:TXT, border:`1px solid ${BORDER}`, cursor:'pointer', fontWeight:700, fontSize:14, ...F }}>
              <RefreshCw size={16}/> Reschedule
            </button>
            <button onClick={onCancel}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 16px', borderRadius:14, background:'rgba(239,68,68,0.08)', color:'#EF4444', border:'1px solid rgba(239,68,68,0.18)', cursor:'pointer', fontWeight:700, fontSize:14, ...F }}>
              <XCircle size={16}/> Cancel Appointment
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}

// ── Tip sheet ─────────────────────────────────────────────────────────────
function TipSheet({ open, appt, tipAmount, setTipAmount, onComplete, onClose, updating }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ padding:'16px 20px 40px' }}>
        <p style={{ color:TXT, fontWeight:800, fontSize:18, margin:'0 0 4px' }}>Complete Appointment</p>
        <p style={{ color:TXT2, fontSize:13, margin:'0 0 20px' }}>Add a tip before completing?</p>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          {['0','5','10','15','20'].map(a=>(
            <button key={a} onClick={()=>setTipAmount(a)}
              style={{ padding:'10px 18px', borderRadius:22, border:`1.5px solid ${tipAmount===a?ORANGE:BORDER}`, background:tipAmount===a?ORANGE:'transparent', color:tipAmount===a?'#fff':TXT2, fontWeight:700, fontSize:13, cursor:'pointer', ...F, transition:'all 0.15s' }}>
              {a==='0'?'No tip':`$${a}`}
            </button>
          ))}
        </div>

        <div style={{ background:BG, border:`1px solid ${BORDER}`, borderRadius:14, padding:'12px 16px', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ color:TXT3, fontSize:18 }}>$</span>
            <input type="number" value={tipAmount} onChange={e=>setTipAmount(e.target.value)} placeholder="Custom amount"
              style={{ flex:1, background:'transparent', border:'none', outline:'none', color:TXT, fontSize:22, fontWeight:800, ...F }}/>
          </div>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={()=>onComplete(false)} disabled={updating}
            style={{ flex:1, padding:'14px', borderRadius:14, background:'transparent', border:`1px solid ${BORDER}`, color:TXT2, fontWeight:600, cursor:'pointer', ...F }}>
            No Tip
          </button>
          <button onClick={()=>onComplete(true)} disabled={updating}
            style={{ flex:1, padding:'14px', borderRadius:14, background:'#22C55E', color:'#fff', fontWeight:700, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, ...F }}>
            {updating&&<div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>}
            {tipAmount&&tipAmount!=='0'?`Add $${tipAmount}`:'Complete'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

// ── Cancel sheet ──────────────────────────────────────────────────────────
function CancelSheet({ open, appt, cancelReason, setCancelReason, onCancel, onClose, updating }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ padding:'16px 20px 40px' }}>
        <p style={{ color:TXT, fontWeight:800, fontSize:18, margin:'0 0 6px' }}>Cancel Appointment?</p>
        <p style={{ color:TXT2, fontSize:14, margin:'0 0 20px' }}>{appt?.clientName} · {appt?.startTime}</p>
        <div style={{ marginBottom:20 }}>
          <label style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', display:'block', marginBottom:8 }}>REASON *</label>
          <textarea value={cancelReason} onChange={e=>setCancelReason(e.target.value)} rows={3}
            placeholder="e.g. Emergency, shop closing early..."
            style={{ width:'100%', background:BG, border:`1px solid ${BORDER}`, borderRadius:12, padding:'12px 14px', color:TXT, fontSize:14, resize:'none', outline:'none', ...F, boxSizing:'border-box' }}/>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:'14px', borderRadius:14, background:'transparent', border:`1px solid ${BORDER}`, color:TXT2, fontWeight:600, cursor:'pointer', ...F }}>Back</button>
          <button onClick={onCancel} disabled={updating}
            style={{ flex:1, padding:'14px', borderRadius:14, background:'rgba(239,68,68,0.1)', color:'#EF4444', fontWeight:700, border:'1px solid rgba(239,68,68,0.25)', cursor:'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            {updating&&<div style={{width:14,height:14,border:'2px solid #EF4444',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>}
            Confirm Cancel
          </button>
        </div>
      </div>
    </Sheet>
  )
}

// ── Weekly calendar view ──────────────────────────────────────────────────
function WeekView({ currentMonth, setCurrentMonth, selectedDay, setSelectedDay, countForDay, appointments, formatTime, onApptClick }) {
  const calDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end:   endOfWeek(endOfMonth(currentMonth)),
  })

  const dayAppts = appointments
    .filter(a => a.date===format(selectedDay,'yyyy-MM-dd') && a.bookingStatus!=='cancelled')
    .sort((a,b)=>a.startTime.localeCompare(b.startTime))

  return (
    <div>
      {/* Month nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={()=>setCurrentMonth(m=>subMonths(m,1))}
            style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:TXT }}>
            <ChevronLeft size={16}/>
          </button>
          <button onClick={()=>setCurrentMonth(m=>addMonths(m,1))}
            style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:TXT }}>
            <ChevronRight size={16}/>
          </button>
        </div>
        <h2 style={{ color:TXT, fontWeight:800, fontSize:18, margin:0, letterSpacing:'-0.3px' }}>{format(currentMonth,'MMMM yyyy')}</h2>
        <div style={{ width:76 }}/>
      </div>

      {/* Calendar grid */}
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:18, padding:14, marginBottom:16 }}>
        {/* Day headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:6 }}>
          {['SUN','MON','TUE','WED','THU','FRI','SAT'].map((d,i)=>(
            <div key={i} style={{ textAlign:'center', fontSize:9, fontWeight:700, color:TXT3, padding:'4px 0', letterSpacing:'0.06em' }}>{d}</div>
          ))}
        </div>
        {/* Days */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
          {calDays.map((date,i)=>{
            const count   = countForDay(date)
            const inMonth = isSameMonth(date,currentMonth)
            const sel     = isSameDay(date,selectedDay)
            const tod     = isToday(date)
            const isPast  = date < startOfDay(new Date())
            return (
              <button key={i} onClick={()=>setSelectedDay(date)}
                style={{
                  padding:'8px 2px', borderRadius:10, border:'none', cursor:'pointer',
                  opacity: !inMonth?0.12: isPast?0.35:1,
                  background: sel?ORANGE: tod?`${ORANGE}18`:'transparent',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                  transition:'all 0.15s',
                  boxShadow: sel?`0 4px 14px ${ORANGE}44`:'none',
                }}>
                <span style={{ fontSize:13, fontWeight:800, color: sel?'#fff': tod?ORANGE: isPast?TXT3:TXT }}>
                  {date.getDate()}
                </span>
                {count>0&&inMonth && (
                  <span style={{ width:5, height:5, borderRadius:'50%', background:sel?'rgba(255,255,255,0.7)':ORANGE, display:'block' }}/>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Day appointments list */}
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <p style={{ color:TXT, fontWeight:700, fontSize:15, margin:0 }}>
            {isToday(selectedDay)?'Today':format(selectedDay,'EEE, MMM d')}
          </p>
          {dayAppts.length>0 && (
            <span style={{ background:`${ORANGE}18`, color:ORANGE, fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:20 }}>
              {dayAppts.length} appt{dayAppts.length!==1?'s':''}
            </span>
          )}
        </div>

        {dayAppts.length===0 ? (
          <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:'28px', textAlign:'center' }}>
            <Scissors size={24} style={{ color:TXT3, display:'block', margin:'0 auto 10px' }} strokeWidth={1.5}/>
            <p style={{ color:TXT2, fontWeight:600, fontSize:14, margin:'0 0 4px' }}>No appointments</p>
            <p style={{ color:TXT3, fontSize:13, margin:0 }}>Select another day or add a walk-in</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {dayAppts.map(a=>{
              const isCur = isToday(selectedDay)&&new Date()>=new Date(`${a.date}T${a.startTime}`)&&new Date()<=new Date(`${a.date}T${a.endTime}`)
              return (
                <button key={a.id} onClick={()=>onApptClick(a)}
                  style={{
                    display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                    borderRadius:14, background:isCur?`${ORANGE}10`:CARD2,
                    border:`1px solid ${isCur?`${ORANGE}44`:BORDER}`,
                    cursor:'pointer', textAlign:'left', ...F, width:'100%',
                    opacity: a.bookingStatus==='completed'?0.55:1,
                    transition:'all 0.15s',
                  }}>
                  <Avatar name={a.clientName} photoURL={a.clientPhotoURL} size={40} fontSize={13}/>
                  <div style={{ display:'flex', flexDirection:'column', minWidth:48, flexShrink:0 }}>
                    <p style={{ color:isCur?ORANGE:TXT2, fontWeight:700, fontSize:12, margin:0 }}>{formatTime(a.startTime)}</p>
                    <p style={{ color:TXT3, fontSize:11, margin:0 }}>{formatTime(a.endTime)}</p>
                  </div>
                  <div style={{ width:1, height:28, background:BORDER, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ color:TXT, fontWeight:700, fontSize:14, margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.clientName}</p>
                    <p style={{ color:TXT2, fontSize:12, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.services?.map(s=>s.name).join(', ')}</p>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
                    <p style={{ color:ORANGE, fontWeight:800, fontSize:13, margin:0 }}>{formatCurrency(a.totalWithTip||a.totalPrice)}</p>
                    <StatusBadge status={a.bookingStatus}/>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function BarberCalendar() {
  const { user }       = useAuth()
  const { formatTime } = useTheme()
  useEffect(()=>{ window.scrollTo(0,0) },[])

  const [barber, setBarber]             = useState(null)
  const [appointments, setAppointments] = useState([])
  const [availability, setAvailability] = useState(null)
  const [loading, setLoading]           = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay]   = useState(new Date())
  const [detailAppt, setDetailAppt]     = useState(null)
  const [cancelSheet, setCancelSheet]   = useState(false)
  const [reschedAppt, setReschedAppt]   = useState(null)
  const [tipSheet, setTipSheet]         = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [tipAmount, setTipAmount]       = useState('')
  const [updating, setUpdating]         = useState(false)

  useEffect(()=>{
    if (!user) return
    let unsubA, unsubAv
    async function setup() {
      try {
        const bSnap = await getDocs(query(collection(db,'barbers'),where('userId','==',user.uid)))
        if (bSnap.empty) { setLoading(false); return }
        const b = { id:bSnap.docs[0].id,...bSnap.docs[0].data() }
        setBarber(b)
        unsubA  = onSnapshot(query(collection(db,'appointments'),where('barberId','==',b.id)), snap=>setAppointments(snap.docs.map(d=>({id:d.id,...d.data()}))))
        unsubAv = onSnapshot(query(collection(db,'availability'),where('barberId','==',b.id)), snap=>{ if(!snap.empty)setAvailability(snap.docs[0].data()) })
      } catch(e){ console.error(e) }
      finally { setLoading(false) }
    }
    setup()
    return ()=>{ unsubA?.(); unsubAv?.() }
  },[user])

  const countForDay = d => appointments.filter(a=>a.date===format(d,'yyyy-MM-dd')&&a.bookingStatus!=='cancelled').length

  async function handleCancel() {
    if (!cancelReason.trim()) return toast.error('Provide a reason')
    setUpdating(true)
    try {
      await updateDoc(doc(db,'appointments',detailAppt.id),{ bookingStatus:'cancelled', paymentStatus:'cancelled', cancelReason:cancelReason.trim() })
      setAppointments(p=>p.map(a=>a.id===detailAppt.id?{...a,bookingStatus:'cancelled',paymentStatus:'cancelled',cancelReason:cancelReason.trim()}:a))
      if (detailAppt.clientId) await createNotification({ userId:detailAppt.clientId, type:'cancel', title:'Appointment Cancelled', message:`Your ${detailAppt.date} appointment was cancelled. Reason: ${cancelReason.trim()}`, data:{ appointmentId:detailAppt.id } })
      toast.success('Cancelled')
      setCancelSheet(false); setDetailAppt(null); setCancelReason('')
    } catch { toast.error('Failed') }
    finally { setUpdating(false) }
  }

  async function handleReschedule({ date, startTime, endTime, note }) {
    setUpdating(true)
    try {
      await updateDoc(doc(db,'appointments',reschedAppt.id),{ date, startTime, endTime, rescheduleNote:note||null })
      setAppointments(p=>p.map(a=>a.id===reschedAppt.id?{...a,date,startTime,endTime,rescheduleNote:note||null}:a))
      if (reschedAppt.clientId) await createNotification({ userId:reschedAppt.clientId, type:'reschedule', title:'Appointment Rescheduled', message:`Your appointment was moved to ${date} at ${startTime}.${note?' Note: '+note:''}`, data:{ appointmentId:reschedAppt.id } })
      toast.success('Rescheduled!'); setReschedAppt(null); setDetailAppt(null)
    } catch { toast.error('Failed') }
    finally { setUpdating(false) }
  }

  async function handleComplete(addTip=false) {
    const tip = addTip?(parseFloat(tipAmount)||0):0
    setUpdating(true)
    try {
      await updateDoc(doc(db,'appointments',detailAppt.id),{ bookingStatus:'completed', tip, totalWithTip:(detailAppt.totalPrice||0)+tip })
      if (detailAppt.clientId) {
        const uSnap = await getDocs(query(collection(db,'users'),where('__name__','==',detailAppt.clientId)))
        if (!uSnap.empty) { const u=uSnap.docs[0].data(); await updateDoc(doc(db,'users',detailAppt.clientId),{ totalVisits:(u.totalVisits||0)+1, totalSpent:(u.totalSpent||0)+(detailAppt.totalPrice||0)+tip }) }
      }
      setAppointments(p=>p.map(a=>a.id===detailAppt.id?{...a,bookingStatus:'completed',tip,totalWithTip:(a.totalPrice||0)+tip}:a))
      toast.success('Marked completed ✓'); setTipSheet(false); setDetailAppt(null); setTipAmount('')
    } catch { toast.error('Failed') }
    finally { setUpdating(false) }
  }

  async function togglePaid(appt) {
    const s = appt.paymentStatus==='paid'?'pending':'paid'
    await updateDoc(doc(db,'appointments',appt.id),{ paymentStatus:s })
    setAppointments(p=>p.map(a=>a.id===appt.id?{...a,paymentStatus:s}:a))
    setDetailAppt(p=>p?{...p,paymentStatus:s}:null)
    toast.success(s==='paid'?'Marked paid':'Marked unpaid')
  }

  if (loading) return <BarberLayout><PageLoader/></BarberLayout>

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{ background:BG, minHeight:'100vh', paddingBottom:100, ...F }}>
        <div style={{ padding:'16px 18px', maxWidth:600, margin:'0 auto' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <h1 style={{ color:TXT, fontWeight:800, fontSize:22, margin:0, letterSpacing:'-0.3px' }}>Calendar</h1>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:12, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:TXT2 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
              </button>
              <button style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:12, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:TXT2 }}>
                <Calendar size={16}/>
              </button>
            </div>
          </div>

          <WeekView
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            countForDay={countForDay}
            appointments={appointments}
            formatTime={formatTime}
            onApptClick={setDetailAppt}
          />
        </div>
      </div>

      {/* Appointment detail sheet */}
      <ApptSheet
        appt={detailAppt}
        onClose={()=>setDetailAppt(null)}
        onComplete={()=>setTipSheet(true)}
        onTogglePaid={()=>togglePaid(detailAppt)}
        onReschedule={()=>setReschedAppt(detailAppt)}
        onCancel={()=>setCancelSheet(true)}
        formatTime={formatTime}
        updating={updating}
      />

      {/* Tip sheet */}
      <TipSheet
        open={tipSheet} appt={detailAppt}
        tipAmount={tipAmount} setTipAmount={setTipAmount}
        onComplete={handleComplete} onClose={()=>setTipSheet(false)} updating={updating}
      />

      {/* Cancel sheet */}
      <CancelSheet
        open={cancelSheet} appt={detailAppt}
        cancelReason={cancelReason} setCancelReason={setCancelReason}
        onCancel={handleCancel} onClose={()=>setCancelSheet(false)} updating={updating}
      />

      {/* Reschedule modal */}
      {reschedAppt && (
        <RescheduleModal
          appt={reschedAppt} appointments={appointments} availability={availability}
          onClose={()=>setReschedAppt(null)} onSave={handleReschedule} updating={updating}
        />
      )}
    </BarberLayout>
  )
}