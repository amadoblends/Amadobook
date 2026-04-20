import { useEffect, useState, useMemo } from 'react'
// ✅ UNIFICADO: Solo una línea para firestore con todo lo que necesitas
import { 
  collection, query, where, getDocs, 
  doc, updateDoc, onSnapshot 
} from 'firebase/firestore'

import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
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
import Modal from '../../components/ui/Modal'
import {
  ChevronLeft, ChevronRight, CheckCircle, DollarSign,
  XCircle, Calendar, RefreshCw, RotateCcw
} from 'lucide-react'
import { PageLoader } from '../../components/ui/Spinner'
const F = { fontFamily: 'Monda, sans-serif' }
const SC = { pending:'#f59e0b', confirmed:'#16A34A', completed:'#3b82f6', cancelled:'#ef4444' }

// ── Smart reschedule picker ────────────────────────────────────────────────
function RescheduleModal({ appt, appointments, availability, onClose, onSave, updating }) {
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [note, setNote]                 = useState('')
  const [weekOffset, setWeekOffset]     = useState(0)

  const today     = startOfDay(new Date())
  const advance   = availability?.advanceDays || 30
  const duration  = appt?.totalDuration || 30

  // 7-day window for current week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(today, weekOffset * 7 + i))
    .filter(d => !isAfter(d, addDays(today, advance)))

  // Available slots for selected date
  const slots = useMemo(() => {
    if (!selectedDate || !availability) return []
    const dayIdx = selectedDate.getDay()
    const ds = availability.schedule?.[dayIdx] || {
      enabled: (availability.workingDays || [1,2,3,4,5,6]).includes(dayIdx),
      startTime: availability.startTime || '09:00',
      endTime:   availability.endTime   || '18:00',
      breaks:    availability.breaks    || [],
    }
    if (!ds.enabled) return []

    const dateStr  = format(selectedDate, 'yyyy-MM-dd')
    // Existing bookings on that day — exclude the appointment being rescheduled
    const existing = (appointments || [])
      .filter(a => a.date === dateStr && a.bookingStatus !== 'cancelled' && a.id !== appt?.id)
      .map(a => ({ startTime: a.startTime, endTime: a.endTime }))

    let allSlots = generateTimeSlots(ds.startTime, ds.endTime, duration, ds.breaks || [], existing)

    // Remove past times if today
    if (isSameDay(selectedDate, today)) {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes() + 15
      allSlots = allSlots.filter(s => {
        const [h, m] = s.startTime.split(':').map(Number)
        return h * 60 + m > nowMin
      })
    }
    return allSlots
  }, [selectedDate, availability, appointments, appt])

  // Slot count per day (for the dot indicator)
  function daySlotCount(date) {
    if (!availability) return 0
    const dayIdx = date.getDay()
    const ds = availability.schedule?.[dayIdx] || {
      enabled: (availability.workingDays || [1,2,3,4,5,6]).includes(dayIdx),
      startTime: availability.startTime || '09:00',
      endTime:   availability.endTime   || '18:00',
      breaks:    availability.breaks    || [],
    }
    if (!ds.enabled) return 0
    const dateStr  = format(date, 'yyyy-MM-dd')
    const existing = (appointments || [])
      .filter(a => a.date === dateStr && a.bookingStatus !== 'cancelled' && a.id !== appt?.id)
      .map(a => ({ startTime: a.startTime, endTime: a.endTime }))
    const s = generateTimeSlots(ds.startTime, ds.endTime, duration, ds.breaks || [], existing)
    if (isSameDay(date, today)) {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes() + 15
      return s.filter(sl => { const [h,m]=sl.startTime.split(':').map(Number); return h*60+m>nowMin }).length
    }
    return s.length
  }

  function isDayDisabled(date) {
    if (date < today) return true
    if (isAfter(date, addDays(today, advance))) return true
    return daySlotCount(date) === 0
  }

  async function confirm() {
    if (!selectedSlot) return toast.error('Select a time slot')
    await onSave({
      date:      format(selectedDate, 'yyyy-MM-dd'),
      startTime: selectedSlot.startTime,
      endTime:   selectedSlot.endTime,
      note:      note.trim(),
    })
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={`Reschedule — ${appt?.clientName}`}>
      <div style={{ ...F, display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 14px' }}>
          <p style={{ color:'var(--text-sec)', fontSize:11, margin:'0 0 2px' }}>Current appointment</p>
          <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:0 }}>
            {appt?.date ? format(parseLocalDate(appt.date), 'EEE, MMM d') : '—'} · {appt?.startTime} – {appt?.endTime}
          </p>
          <p style={{ color:'var(--text-sec)', fontSize:12, margin:'2px 0 0' }}>{formatDuration(duration)}</p>
        </div>

        {/* Day picker — 7-day scrollable window */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <button onClick={() => { setWeekOffset(w => Math.max(0, w-1)); setSelectedDate(null); setSelectedSlot(null) }}
              disabled={weekOffset === 0}
              style={{ background:'none', border:'none', color: weekOffset===0?'var(--border)':'var(--text-pri)', cursor: weekOffset===0?'not-allowed':'pointer', padding:4 }}>
              <ChevronLeft size={18}/>
            </button>
            <span style={{ color:'var(--text-sec)', fontSize:12, fontWeight:700 }}>
              {weekDays[0] && format(weekDays[0], 'MMM d')} – {weekDays[weekDays.length-1] && format(weekDays[weekDays.length-1], 'MMM d')}
            </span>
            <button onClick={() => { setWeekOffset(w => w+1); setSelectedDate(null); setSelectedSlot(null) }}
              disabled={weekDays.length < 7}
              style={{ background:'none', border:'none', color: weekDays.length<7?'var(--border)':'var(--text-pri)', cursor: weekDays.length<7?'not-allowed':'pointer', padding:4 }}>
              <ChevronRight size={18}/>
            </button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:`repeat(${weekDays.length},1fr)`, gap:6 }}>
            {weekDays.map((date, i) => {
              const disabled = isDayDisabled(date)
              const sel      = selectedDate && isSameDay(date, selectedDate)
              const count    = !disabled ? daySlotCount(date) : 0
              return (
                <button key={i} onClick={() => { if (disabled) return; setSelectedDate(date); setSelectedSlot(null) }} disabled={disabled}
                  style={{
                    padding:'8px 2px', borderRadius:12, border:'none',
                    background: sel ? 'var(--accent)' : 'transparent',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.3 : 1,
                    display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                  }}>
                  <span style={{ fontSize:9, fontWeight:700, color: sel?'rgba(255,255,255,0.8)':'var(--text-sec)' }}>
                    {format(date, 'EEE').toUpperCase()}
                  </span>
                  <span style={{ fontSize:14, fontWeight:800, color: sel?'white': isToday(date)?'var(--accent)':'var(--text-pri)' }}>
                    {format(date, 'd')}
                  </span>
                  <span style={{ fontSize:9, fontWeight:700, color: sel?'rgba(255,255,255,0.7)':'#4ade80' }}>
                    {count > 0 ? `${count}` : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Time slots */}
        {selectedDate && (
          <div>
            <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>
              {format(selectedDate, 'EEEE, MMMM d').toUpperCase()} — AVAILABLE SLOTS
            </p>
            {slots.length === 0 ? (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'16px', textAlign:'center' }}>
                <p style={{ color:'var(--text-sec)', fontSize:13, margin:0 }}>No available times this day</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                {slots.map(slot => {
                  const isSel = selectedSlot?.startTime === slot.startTime
                  return (
                    <button key={slot.startTime} onClick={() => setSelectedSlot(slot)}
                      style={{
                        padding:'11px 4px', borderRadius:10, fontFamily:'Monda,sans-serif',
                        border:`1.5px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
                        background: isSel ? 'var(--accent)' : 'var(--surface)',
                        color: isSel ? 'white' : 'var(--text-pri)',
                        fontWeight:700, fontSize:13, cursor:'pointer',
                      }}>
                      {slot.startTime}
                    </button>
                  )
                })}
              </div>
            )}

            {selectedSlot && (
              <div style={{ background:'var(--accent)15', border:'1px solid var(--accent)33', borderRadius:12, padding:'10px 14px', marginTop:10 }}>
                <p style={{ color:'var(--accent)', fontWeight:700, fontSize:14, margin:0 }}>
                  {selectedSlot.startTime} – {selectedSlot.endTime} · {format(selectedDate, 'MMM d')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Note */}
        <div>
          <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:6 }}>NOTE (optional)</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="Reason for rescheduling..."
            style={{ width:'100%', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:12, padding:'12px 14px', color:'var(--text-pri)', fontSize:14, resize:'none', outline:'none', ...F, boxSizing:'border-box' }}/>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose}
            style={{ flex:1, padding:'13px', borderRadius:12, background:'var(--surface)', color:'var(--text-sec)', fontWeight:600, border:'1px solid var(--border)', cursor:'pointer', ...F }}>
            Cancel
          </button>
          <button onClick={confirm} disabled={updating || !selectedSlot}
            style={{ flex:1, padding:'13px', borderRadius:12, background: selectedSlot?'var(--accent)':'var(--border)', color:'white', fontWeight:700, border:'none', cursor: selectedSlot?'pointer':'not-allowed', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            {updating && <div style={{ width:14, height:14, border:'2px solid white', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>}
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Calendar ──────────────────────────────────────────────────────────
export default function BarberCalendar() {
  const { user } = useAuth()
  const { formatTime } = useTheme()
  const [barber, setBarber]             = useState(null)
  const [appointments, setAppointments] = useState([])
  const [availability, setAvailability] = useState(null)
  const [loading, setLoading]           = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay]   = useState(new Date())
  const [detailAppt, setDetailAppt]     = useState(null)
  const [cancelModal, setCancelModal]   = useState(false)
  const [reschedAppt, setReschedAppt]   = useState(null)
  const [tipModal, setTipModal]         = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [tipAmount, setTipAmount]       = useState('')
  const [updating, setUpdating]         = useState(false)

useEffect(() => {
    if (!user) return

    let unsubAppointments;
    let unsubAvailability;

    async function setupListeners() {
      try {
        // 1. Obtenemos el perfil del barbero (esto solo se necesita 1 vez para sacar el ID)
        const bSnap = await getDocs(query(collection(db, 'barbers'), where('userId', '==', user.uid)))
        if (bSnap.empty) { 
          setLoading(false); 
          return; 
        }
        
        const b = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() }
        setBarber(b)

        // 2. Escuchar CITAS en tiempo real
        const qAppts = query(collection(db, 'appointments'), where('barberId', '==', b.id))
        unsubAppointments = onSnapshot(qAppts, (snap) => {
          const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          setAppointments(all)
        })

        // 3. Escuchar DISPONIBILIDAD en tiempo real
        const qAvail = query(collection(db, 'availability'), where('barberId', '==', b.id))
        unsubAvailability = onSnapshot(qAvail, (snap) => {
          if (!snap.empty) {
            setAvailability(snap.docs[0].data())
          }
        })

      } catch (e) {
        console.error("Error cargando datos:", e)
      } finally {
        setLoading(false)
      }
    }

    setupListeners()

    // 4. Limpieza: Apagar los "escuchadores" cuando el usuario cierre el calendario
    return () => {
      if (unsubAppointments) unsubAppointments()
      if (unsubAvailability) unsubAvailability()
    }
  }, [user])

  const calDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end:   endOfWeek(endOfMonth(currentMonth)),
  })

  const countForDay = d => appointments.filter(a =>
    a.date === format(d,'yyyy-MM-dd') && a.bookingStatus !== 'cancelled'
  ).length

  const apptsForDay = d => appointments
    .filter(a => a.date === format(d,'yyyy-MM-dd') && a.bookingStatus !== 'cancelled')
    .sort((a,b) => a.startTime.localeCompare(b.startTime))

  async function handleCancel() {
    if (!cancelReason.trim()) return toast.error('Provide a reason')
    setUpdating(true)
    try {
      await updateDoc(doc(db,'appointments',detailAppt.id), {
        bookingStatus:'cancelled', paymentStatus:'cancelled', cancelReason: cancelReason.trim(),
      })
      setAppointments(p => p.map(a => a.id===detailAppt.id ? {...a,bookingStatus:'cancelled',paymentStatus:'cancelled',cancelReason:cancelReason.trim()} : a))
      // Notify client
      if (detailAppt.clientId) {
        await createNotification({ userId:detailAppt.clientId, type:'cancel', title:'Appointment Cancelled', message:`Your ${detailAppt.date} appointment was cancelled. Reason: ${cancelReason.trim()}`, data:{ appointmentId:detailAppt.id } })
      }
      toast.success('Cancelled')
      setCancelModal(false); setDetailAppt(null); setCancelReason('')
    } catch { toast.error('Failed') }
    finally { setUpdating(false) }
  }

  async function handleReschedule({ date, startTime, endTime, note }) {
    setUpdating(true)
    try {
      await updateDoc(doc(db,'appointments',reschedAppt.id), {
        date, startTime, endTime, rescheduleNote: note || null,
      })
      setAppointments(p => p.map(a => a.id===reschedAppt.id ? {...a,date,startTime,endTime,rescheduleNote:note||null} : a))
      // Notify client
      if (reschedAppt.clientId) {
        await createNotification({ userId:reschedAppt.clientId, type:'reschedule', title:'Appointment Rescheduled', message:`Your appointment was moved to ${date} at ${startTime}.${note?' Note: '+note:''}`, data:{ appointmentId:reschedAppt.id } })
      }
      toast.success('Rescheduled!')
      setReschedAppt(null); setDetailAppt(null)
    } catch { toast.error('Failed') }
    finally { setUpdating(false) }
  }

  async function handleComplete(addTip = false) {
    const tip = addTip ? (parseFloat(tipAmount) || 0) : 0
    setUpdating(true)
    try {
      await updateDoc(doc(db,'appointments',detailAppt.id), {
        bookingStatus:'completed', tip, totalWithTip:(detailAppt.totalPrice||0)+tip,
      })
      if (detailAppt.clientId) {
        const uSnap = await getDocs(query(collection(db,'users'), where('__name__','==',detailAppt.clientId)))
        if (!uSnap.empty) {
          const u = uSnap.docs[0].data()
          await updateDoc(doc(db,'users',detailAppt.clientId), {
            totalVisits: (u.totalVisits||0)+1,
            totalSpent:  (u.totalSpent||0)+(detailAppt.totalPrice||0)+tip,
          })
        }
      }
      setAppointments(p => p.map(a => a.id===detailAppt.id ? {...a,bookingStatus:'completed',tip,totalWithTip:(a.totalPrice||0)+tip} : a))
      toast.success('Marked completed ✓')
      setTipModal(false); setDetailAppt(null); setTipAmount('')
    } catch { toast.error('Failed') }
    finally { setUpdating(false) }
  }

  async function togglePaid(appt) {
    const s = appt.paymentStatus==='paid'?'pending':'paid'
    await updateDoc(doc(db,'appointments',appt.id), { paymentStatus:s })
    setAppointments(p => p.map(a => a.id===appt.id?{...a,paymentStatus:s}:a))
    setDetailAppt(p => p?{...p,paymentStatus:s}:null)
    toast.success(s==='paid'?'Marked paid':'Marked unpaid')
  }

  if (loading) return <BarberLayout><PageLoader/></BarberLayout>

  const dayAppointments = apptsForDay(selectedDay)

  return (
    <BarberLayout>
      <div style={{ padding:'16px', maxWidth:560, margin:'0 auto', ...F }}>
        {/* Month nav */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <button onClick={() => setCurrentMonth(m => subMonths(m,1))}
            style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text-pri)' }}>
            <ChevronLeft size={18}/>
          </button>
          <h2 style={{ color:'var(--text-pri)', fontSize:18, fontWeight:800, margin:0 }}>
            {format(currentMonth,'MMMM yyyy')}
          </h2>
          <button onClick={() => setCurrentMonth(m => addMonths(m,1))}
            style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text-pri)' }}>
            <ChevronRight size={18}/>
          </button>
        </div>

        {/* Calendar grid */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:14, marginBottom:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:6 }}>
            {['S','M','T','W','T','F','S'].map((d,i) => (
              <div key={i} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:'var(--text-sec)', padding:'4px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
            {calDays.map((date,i) => {
              const count   = countForDay(date)
              const inMonth = isSameMonth(date, currentMonth)
              const sel     = isSameDay(date, selectedDay)
              const tod     = isToday(date)
              const isPast  = date < startOfDay(new Date())
              return (
                <button key={i} onClick={() => setSelectedDay(date)}
                  style={{
                    padding:'8px 2px', borderRadius:10, border:'none', cursor:'pointer',
                    opacity: !inMonth ? 0.15 : isPast ? 0.4 : 1,
                    background: sel ? 'var(--accent)' : tod ? 'var(--accent)22' : 'transparent',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                    filter: isPast && !sel ? 'grayscale(0.7)' : 'none',
                  }}>
                  <span style={{ fontSize:13, fontWeight:700, color: sel?'white': tod?'var(--accent)': isPast?'var(--text-sec)':'var(--text-pri)' }}>
                    {date.getDate()}
                  </span>
                  {count > 0 && inMonth && (
                    <span style={{ fontSize:9, fontWeight:700, color: sel?'rgba(255,255,255,0.8)': isPast?'var(--text-sec)':'var(--accent)' }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Day list */}
        <h3 style={{ color:'var(--text-pri)', fontSize:16, fontWeight:800, marginBottom:12 }}>
          {isToday(selectedDay) ? 'Today' : format(selectedDay,'EEE, MMM d')}
          {dayAppointments.length > 0 && <span style={{ color:'var(--accent)', fontSize:13, fontWeight:600, marginLeft:8 }}>· {dayAppointments.length}</span>}
        </h3>

        {dayAppointments.length === 0 ? (
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:32, textAlign:'center' }}>
            <Calendar size={24} style={{ color:'var(--text-sec)', opacity:0.4, margin:'0 auto 8px', display:'block' }}/>
            <p style={{ color:'var(--text-sec)', margin:0 }}>No appointments</p>
          </div>
        ) : dayAppointments.map(appt => (
          <button key={appt.id} onClick={() => setDetailAppt(appt)}
            style={{
              width:'100%', background: appt.bookingStatus==='completed'?'#16A34A12':'var(--card)',
              border: appt.bookingStatus==='completed'?'1px solid #16A34A33':'1px solid var(--border)',
              borderLeft:`3px solid ${appt.bookingStatus==='completed'?'#16A34A': appt.isGuest?'#8b5cf6':'var(--accent)'}`,
              borderRadius:14, padding:'12px 14px', cursor:'pointer',
              display:'flex', alignItems:'center', gap:12, textAlign:'left', marginBottom:8, ...F,
            }}>
            <div style={{ flexShrink:0, minWidth:44 }}>
              <p style={{ color:'var(--accent)', fontWeight:700, fontSize:13, margin:0 }}>{formatTime(appt.startTime)}</p>
              <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{formatTime(appt.endTime)}</p>
            </div>
            <div style={{ width:1, height:36, background:'var(--border)', flexShrink:0 }}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:0 }}>{appt.clientName}</p>
                {appt.isGuest && <span style={{ background:'#8b5cf622', color:'#7c3aed', fontSize:10, padding:'1px 6px', borderRadius:10, fontWeight:700 }}>Guest</span>}
                {appt.bookingStatus==='completed' && <span style={{ width:8, height:8, borderRadius:'50%', background:'#16A34A', display:'inline-block' }}/>}
                {appt.paymentStatus==='paid' && <span style={{ background:'#3b82f622', color:'#2563eb', fontSize:10, padding:'1px 6px', borderRadius:10, fontWeight:700 }}>Paid</span>}
              </div>
              <p style={{ color:'var(--text-sec)', fontSize:12, margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {appt.services?.map(s=>s.name).join(', ')}
              </p>
            </div>
            <p style={{ color:'var(--accent)', fontWeight:800, fontSize:14, flexShrink:0 }}>{formatCurrency(appt.totalPrice)}</p>
          </button>
        ))}
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!detailAppt && !cancelModal && !reschedAppt && !tipModal} onClose={() => setDetailAppt(null)} title="Appointment">
        {detailAppt && (
          <div style={{ ...F, display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--accent)22', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:15, color:'var(--accent)', flexShrink:0 }}>
                {getInitials(detailAppt.clientName)}
              </div>
              <div>
                <p style={{ color:'var(--text-pri)', fontWeight:700, margin:0 }}>{detailAppt.clientName}</p>
                <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{detailAppt.clientEmail}</p>
                {detailAppt.clientPhone && <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{detailAppt.clientPhone}</p>}
              </div>
            </div>

            <div style={{ background:'var(--surface)', borderRadius:12, padding:12 }}>
              {[
                ['Date',    format(parseLocalDate(detailAppt.date),'MMM d, yyyy')],
                ['Time',    `${formatTime(detailAppt.startTime)} – ${formatTime(detailAppt.endTime)}`],
                ['Duration',formatDuration(detailAppt.totalDuration)],
                ['Total',   formatCurrency(detailAppt.totalPrice)],
                ['Payment', detailAppt.paymentStatus],
              ].map(([l,v]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ color:'var(--text-sec)' }}>{l}</span>
                  <span style={{ color: l==='Total'?'var(--accent)': l==='Payment'?(detailAppt.paymentStatus==='paid'?'#16A34A':'#f59e0b'):'var(--text-pri)', fontWeight:600 }}>{v}</span>
                </div>
              ))}
              {detailAppt.tip > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'4px 0' }}>
                  <span style={{ color:'var(--text-sec)' }}>Tip</span>
                  <span style={{ color:'#16A34A', fontWeight:600 }}>+{formatCurrency(detailAppt.tip)}</span>
                </div>
              )}
            </div>

            <div style={{ fontSize:12, color:'var(--text-sec)' }}>
              {detailAppt.services?.map((s,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0' }}>
                  <span style={{ color:'var(--text-pri)' }}>{s.name}</span>
                  <span>{formatCurrency(s.price)}</span>
                </div>
              ))}
            </div>

            {detailAppt.rescheduleNote && <div style={{ background:'#f59e0b15', border:'1px solid #f59e0b33', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#d97706' }}>Note: {detailAppt.rescheduleNote}</div>}
            {detailAppt.cancelReason   && <div style={{ background:'#ef444415', border:'1px solid #ef444433', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#dc2626' }}>Cancelled: {detailAppt.cancelReason}</div>}

            {detailAppt.bookingStatus !== 'cancelled' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8, paddingTop:8, borderTop:'1px solid var(--border)' }}>
                {detailAppt.bookingStatus !== 'completed' && (
                  <button onClick={() => setTipModal(true)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, background:'#16A34A15', color:'#16A34A', border:'1px solid #16A34A33', cursor:'pointer', fontWeight:700, fontSize:13, ...F }}>
                    <CheckCircle size={15}/> Mark Completed
                  </button>
                )}
                <button onClick={() => togglePaid(detailAppt)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, background:'#3b82f615', color:'#2563eb', border:'1px solid #3b82f633', cursor:'pointer', fontWeight:700, fontSize:13, ...F }}>
                  <DollarSign size={15}/> {detailAppt.paymentStatus==='paid'?'Mark Unpaid':'Mark Paid'}
                </button>
                <button onClick={() => setReschedAppt(detailAppt)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, background:'#f59e0b15', color:'#d97706', border:'1px solid #f59e0b33', cursor:'pointer', fontWeight:700, fontSize:13, ...F }}>
                  <RefreshCw size={15}/> Reschedule
                </button>
                <button onClick={() => setCancelModal(true)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, background:'#ef444415', color:'#dc2626', border:'1px solid #ef444433', cursor:'pointer', fontWeight:700, fontSize:13, ...F }}>
                  <XCircle size={15}/> Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Tip Modal */}
      <Modal isOpen={tipModal} onClose={() => setTipModal(false)} title="Complete Appointment">
        <div style={F}>
          <p style={{ color:'var(--text-sec)', fontSize:14, marginBottom:14 }}>Add a tip before completing?</p>
          <div style={{ marginBottom:16 }}>
            <label style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', display:'block', marginBottom:6 }}>TIP AMOUNT (optional)</label>
            <div style={{ display:'flex', alignItems:'center', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:12, padding:'12px 14px', gap:6 }}>
              <span style={{ color:'var(--text-sec)' }}>$</span>
              <input type="number" inputMode="decimal" value={tipAmount} onChange={e => setTipAmount(e.target.value)} placeholder="0.00"
                style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text-pri)', fontSize:16 }}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => handleComplete(false)} disabled={updating}
              style={{ flex:1, padding:'13px', borderRadius:12, background:'var(--surface)', color:'var(--text-sec)', fontWeight:600, border:'1px solid var(--border)', cursor:'pointer', ...F }}>
              No Tip
            </button>
            <button onClick={() => handleComplete(true)} disabled={updating}
              style={{ flex:1, padding:'13px', borderRadius:12, background:'#16A34A', color:'white', fontWeight:700, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, ...F }}>
              {updating && <div style={{ width:14, height:14, border:'2px solid white', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>}
              {tipAmount ? `Add $${tipAmount}` : 'Complete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal isOpen={cancelModal} onClose={() => setCancelModal(false)} title="Cancel Appointment">
        <div style={F}>
          <p style={{ color:'var(--text-sec)', fontSize:14, marginBottom:14 }}>
            Are you sure you want to cancel <strong style={{ color:'var(--text-pri)' }}>{detailAppt?.clientName}</strong>'s appointment?
          </p>
          <label style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', display:'block', marginBottom:6 }}>REASON *</label>
          <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3}
            placeholder="e.g. Emergency, shop closing early..."
            style={{ width:'100%', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:12, padding:'12px 14px', color:'var(--text-pri)', fontSize:14, resize:'none', outline:'none', ...F, boxSizing:'border-box', marginBottom:14 }}/>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setCancelModal(false)} style={{ flex:1, padding:'13px', borderRadius:12, background:'var(--surface)', color:'var(--text-sec)', fontWeight:600, border:'1px solid var(--border)', cursor:'pointer', ...F }}>Back</button>
            <button onClick={handleCancel} disabled={updating}
              style={{ flex:1, padding:'13px', borderRadius:12, background:'#ef444415', color:'#dc2626', fontWeight:700, border:'1px solid #ef444433', cursor:'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              {updating && <div style={{ width:14, height:14, border:'2px solid #dc2626', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>}
              Confirm Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Smart Reschedule Modal */}
      {reschedAppt && (
        <RescheduleModal
          appt={reschedAppt}
          appointments={appointments}
          availability={availability}
          onClose={() => setReschedAppt(null)}
          onSave={handleReschedule}
          updating={updating}
        />
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </BarberLayout>
  )
}
