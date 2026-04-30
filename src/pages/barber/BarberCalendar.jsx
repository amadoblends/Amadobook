import { useEffect, useState, useMemo, useRef } from 'react'
// ✅ UNIFICADO: Solo una línea para firestore con todo lo que necesitas
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
import Modal from '../../components/ui/Modal'
import {
  ChevronLeft, ChevronRight, CheckCircle, DollarSign,
  XCircle, Calendar, RefreshCw, RotateCcw, ChevronDown, Clock, ZoomIn, ZoomOut
} from 'lucide-react'
import { PageLoader } from '../../components/ui/Spinner'
const F = { fontFamily: 'Monda, sans-serif' }
const SC = { pending:'#EAB308', confirmed:'#22C55E', completed:'var(--text-sec)', cancelled:'#EF4444' }

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
                  <span style={{ fontSize:9, fontWeight:700, color: sel?'var(--accent-inv)':'var(--text-sec)' }}>
                    {format(date, 'EEE').toUpperCase()}
                  </span>
                  <span style={{ fontSize:14, fontWeight:800, color: sel?'var(--accent-inv)': isToday(date)?'var(--accent)':'var(--text-pri)' }}>
                    {format(date, 'd')}
                  </span>
                  <span style={{ fontSize:9, fontWeight:700, color: sel?'var(--accent-inv)':'#22C55E' }}>
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
            style={{ flex:1, padding:'13px', borderRadius:12, background: selectedSlot?'var(--accent)':'var(--border)', color:'var(--accent-inv)', fontWeight:700, border:'none', cursor: selectedSlot?'pointer':'not-allowed', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            {updating && <div style={{ width:14, height:14, border:'2px solid white', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>}
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Day Timeline View ──────────────────────────────────────────────────────
function DayTimeline({ appointments, selectedDay, onApptClick, formatTime }) {
  const [pxPerMin, setPxPerMin] = useState(2.5)
  const [nowPct, setNowPct]     = useState(null)

  const MIN_PX = 1.2
  const MAX_PX = 6

  const { startHour, endHour } = useMemo(() => {
    if (!appointments.length) return { startHour: 8, endHour: 20 }
    const mins = appointments.flatMap(a => {
      const [sh, sm] = a.startTime.split(':').map(Number)
      const [eh, em] = a.endTime.split(':').map(Number)
      return [sh * 60 + sm, eh * 60 + em]
    })
    return {
      startHour: Math.max(0,  Math.floor(Math.min(...mins) / 60) - 1),
      endHour:   Math.min(24, Math.ceil(Math.max(...mins)  / 60) + 1),
    }
  }, [appointments])

  const totalMinutes  = (endHour - startHour) * 60
  const totalHeightPx = totalMinutes * pxPerMin

  // Current time line (today only)
  useEffect(() => {
    if (!isToday(selectedDay)) { setNowPct(null); return }
    function tick() {
      const now    = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()
      const pct    = ((nowMin - startHour * 60) / totalMinutes) * 100
      setNowPct(pct >= 0 && pct <= 100 ? pct : null)
    }
    tick()
    const iv = setInterval(tick, 30000)
    return () => clearInterval(iv)
  }, [selectedDay, startHour, totalMinutes])

  function timeToY(timeStr) {
    const [h, m] = timeStr.split(':').map(Number)
    return ((h * 60 + m - startHour * 60) / totalMinutes) * 100
  }

  function apptHeightPct(appt) {
    const [sh, sm] = appt.startTime.split(':').map(Number)
    const [eh, em] = appt.endTime.split(':').map(Number)
    return (((eh * 60 + em) - (sh * 60 + sm)) / totalMinutes) * 100
  }

  const STATUS_COLOR = {
    pending:   '#EAB308',
    confirmed: 'var(--accent)',
    completed: '#22C55E',
    cancelled: '#EF4444',
  }

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)

  if (!appointments.length) return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'32px 16px', textAlign:'center', ...F }}>
      <Calendar size={22} style={{ color:'var(--text-sec)', opacity:0.3, display:'block', margin:'0 auto 8px' }}/>
      <p style={{ color:'var(--text-sec)', fontSize:13, margin:0 }}>No appointments this day</p>
    </div>
  )

  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>

      {/* Zoom controls */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Clock size={13} style={{ color:'var(--accent)' }}/>
          <span style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.06em', ...F }}>
            {isToday(selectedDay) ? 'TODAY' : format(selectedDay,'EEE, MMM d').toUpperCase()}
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <button onClick={() => setPxPerMin(p => Math.max(MIN_PX, +(p - 0.6).toFixed(1)))}
            disabled={pxPerMin <= MIN_PX}
            style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', cursor: pxPerMin<=MIN_PX ? 'not-allowed':'pointer', color: pxPerMin<=MIN_PX ? 'var(--border)':'var(--text-sec)' }}>
            <ZoomOut size={13}/>
          </button>
          <span style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, minWidth:28, textAlign:'center', ...F }}>
            {Math.round(pxPerMin / 2.5 * 100)}%
          </span>
          <button onClick={() => setPxPerMin(p => Math.min(MAX_PX, +(p + 0.6).toFixed(1)))}
            disabled={pxPerMin >= MAX_PX}
            style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', cursor: pxPerMin>=MAX_PX ? 'not-allowed':'pointer', color: pxPerMin>=MAX_PX ? 'var(--border)':'var(--text-sec)' }}>
            <ZoomIn size={13}/>
          </button>
        </div>
      </div>

      {/* Timeline grid — no scroll, full height */}
      <div style={{ position:'relative', height: totalHeightPx, padding:'0 10px 10px 54px' }}>

        {/* Hour lines + labels */}
        {hours.map(h => {
          const topPx = ((h - startHour) / (endHour - startHour)) * totalHeightPx
          return (
            <div key={h} style={{ position:'absolute', left:0, right:0, top: topPx }}>
              <span style={{
                position:'absolute', left:6, top:-8,
                fontSize:9, fontWeight:700, color:'var(--text-sec)',
                fontFamily:'Monda,sans-serif', letterSpacing:'0.04em', whiteSpace:'nowrap',
              }}>
                {h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`}
              </span>
              <div style={{
                position:'absolute', left:48, right:10, top:0,
                height:1, background:'var(--border)', opacity:0.5,
              }}/>
            </div>
          )
        })}

        {/* Appointment blocks */}
        {appointments.map(appt => {
          const topPct = timeToY(appt.startTime)
          const hPct   = apptHeightPct(appt)
          const topPx  = (topPct  / 100) * totalHeightPx
          const hPx    = Math.max(20, (hPct / 100) * totalHeightPx - 2)
          const color  = STATUS_COLOR[appt.bookingStatus] || 'var(--accent)'
          const isDone = appt.bookingStatus === 'completed'

          // Adapt content to available height
          const showServices = hPx >= 44
          const showTime     = hPx >= 28
          const bigName      = hPx >= 60

          return (
            <button
              key={appt.id}
              onClick={() => onApptClick(appt)}
              style={{
                position:'absolute',
                top: topPx + 1,
                left: 54,
                right: 10,
                height: hPx,
                borderRadius: 8,
                border: `1.5px solid ${color}55`,
                borderLeft: `3px solid ${color}`,
                background: isDone
                  ? `${color}14`
                  : `linear-gradient(135deg,${color}1A 0%,${color}08 100%)`,
                cursor:'pointer', textAlign:'left',
                padding: hPx < 28 ? '0 6px' : '4px 7px',
                display:'flex', flexDirection: hPx < 28 ? 'row' : 'column',
                alignItems: hPx < 28 ? 'center' : 'flex-start',
                justifyContent: hPx < 28 ? 'space-between' : 'flex-start',
                gap: 1, overflow:'hidden', ...F,
                transition:'filter 0.12s, opacity 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.filter='brightness(1.12)'}
              onMouseLeave={e => e.currentTarget.style.filter='none'}
            >
              <span style={{
                fontWeight:700,
                fontSize: bigName ? 12 : 10,
                color:'var(--text-pri)',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                maxWidth:'100%', lineHeight:1.2,
              }}>
                {appt.clientName}
              </span>

              {showServices && (
                <span style={{
                  fontSize:9, color:'var(--text-sec)',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  maxWidth:'100%', lineHeight:1.2,
                }}>
                  {appt.services?.map(s => s.name).join(', ')}
                </span>
              )}

              {showTime && (
                <span style={{
                  fontSize:9, color, fontWeight:700, lineHeight:1.2,
                  marginTop: showServices ? 'auto' : undefined,
                }}>
                  {formatTime(appt.startTime)}–{formatTime(appt.endTime)}
                </span>
              )}
            </button>
          )
        })}

        {/* Current time red line */}
        {nowPct !== null && (
          <div style={{
            position:'absolute',
            top: (nowPct / 100) * totalHeightPx,
            left:48, right:10,
            height:2, background:'#EF4444',
            borderRadius:2, zIndex:10,
            boxShadow:'0 0 6px #EF444488',
            pointerEvents:'none',
          }}>
            <div style={{
              position:'absolute', left:-5, top:-4,
              width:10, height:10, borderRadius:'50%',
              background:'#EF4444', boxShadow:'0 0 8px #EF4444AA',
            }}/>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Calendar ──────────────────────────────────────────────────────────
export default function BarberCalendar() {
  const { user } = useAuth()
  useEffect(() => { window.scrollTo(0,0) }, [])
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
  const [calOpen, setCalOpen]           = useState(false)

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

        {/* ── Collapsible Calendar ── */}
        <div style={{ marginBottom:16 }}>

          {/* Calendar toggle header */}
          <button
            onClick={() => setCalOpen(o => !o)}
            style={{
              width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
              background:'var(--card)', border:'1px solid var(--border)',
              borderRadius: calOpen ? '14px 14px 0 0' : 14,
              padding:'12px 16px', cursor:'pointer', ...F,
            }}
          >
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Calendar size={15} style={{ color:'var(--accent)' }}/>
              <span style={{ color:'var(--text-pri)', fontWeight:800, fontSize:15 }}>
                {format(currentMonth,'MMMM yyyy')}
              </span>
              <span style={{ color:'var(--accent)', fontWeight:700, fontSize:13 }}>
                · {isToday(selectedDay) ? 'Today' : format(selectedDay,'MMM d')}
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              {/* Month nav arrows — only visible when open */}
              {calOpen && (
                <>
                  <span onClick={e => { e.stopPropagation(); setCurrentMonth(m => subMonths(m,1)) }}
                    style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text-pri)' }}>
                    <ChevronLeft size={14}/>
                  </span>
                  <span onClick={e => { e.stopPropagation(); setCurrentMonth(m => addMonths(m,1)) }}
                    style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text-pri)' }}>
                    <ChevronRight size={14}/>
                  </span>
                </>
              )}
              <ChevronDown size={16} style={{
                color:'var(--text-sec)',
                transform: calOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition:'transform 0.25s ease',
              }}/>
            </div>
          </button>

          {/* Calendar grid — collapses */}
          {calOpen && (
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderTop:'none', borderRadius:'0 0 14px 14px', padding:'10px 14px 14px' }}>
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
                    <button key={i} onClick={() => { setSelectedDay(date); setCalOpen(false) }}
                      style={{
                        padding:'8px 2px', borderRadius:10, border:'none', cursor:'pointer',
                        opacity: !inMonth ? 0.15 : isPast ? 0.4 : 1,
                        background: sel ? 'var(--accent)' : tod ? 'var(--accent)22' : 'transparent',
                        display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                        filter: isPast && !sel ? 'grayscale(0.7)' : 'none',
                      }}>
                      <span style={{ fontSize:13, fontWeight:700, color: sel?'var(--accent-inv)': tod?'var(--accent)': isPast?'var(--text-sec)':'var(--text-pri)' }}>
                        {date.getDate()}
                      </span>
                      {count > 0 && inMonth && (
                        <span style={{ fontSize:9, fontWeight:700, color: sel?'var(--accent-inv)': isPast?'var(--text-sec)':'#22C55E' }}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Timeline (always visible) ── */}
        <DayTimeline
          appointments={dayAppointments}
          selectedDay={selectedDay}
          onApptClick={setDetailAppt}
          formatTime={formatTime}
        />
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
                  <span style={{ color: l==='Total'?'var(--accent)': l==='Payment'?(detailAppt.paymentStatus==='paid'?'#22C55E':'#EAB308'):'var(--text-pri)', fontWeight:600 }}>{v}</span>
                </div>
              ))}
              {detailAppt.tip > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'4px 0' }}>
                  <span style={{ color:'var(--text-sec)' }}>Tip</span>
                  <span style={{ color:'#22C55E', fontWeight:600 }}>+{formatCurrency(detailAppt.tip)}</span>
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

            {detailAppt.rescheduleNote && <div style={{ background:'rgba(234,179,8,0.1)', border:'1px solid rgba(234,179,8,0.25)', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#EAB308' }}>Note: {detailAppt.rescheduleNote}</div>}
            {detailAppt.cancelReason   && <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#EF4444' }}>Cancelled: {detailAppt.cancelReason}</div>}

            {detailAppt.bookingStatus !== 'cancelled' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8, paddingTop:8, borderTop:'1px solid var(--border)' }}>
                {detailAppt.bookingStatus !== 'completed' && (
                  <button onClick={() => setTipModal(true)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, background:'rgba(34,197,94,0.1)', color:'#22C55E', border:'1px solid rgba(34,197,94,0.25)', cursor:'pointer', fontWeight:700, fontSize:13, ...F }}>
                    <CheckCircle size={15}/> Mark Completed
                  </button>
                )}
                <button onClick={() => togglePaid(detailAppt)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, background:'var(--accent)15', color:'var(--accent)', border:'1px solid var(--accent)33', cursor:'pointer', fontWeight:700, fontSize:13, ...F }}>
                  <DollarSign size={15}/> {detailAppt.paymentStatus==='paid'?'Mark Unpaid':'Mark Paid'}
                </button>
                <button onClick={() => setReschedAppt(detailAppt)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, background:'rgba(234,179,8,0.1)', color:'#EAB308', border:'1px solid rgba(234,179,8,0.25)', cursor:'pointer', fontWeight:700, fontSize:13, ...F }}>
                  <RefreshCw size={15}/> Reschedule
                </button>
                <button onClick={() => setCancelModal(true)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, background:'rgba(239,68,68,0.08)', color:'#EF4444', border:'1px solid rgba(239,68,68,0.25)', cursor:'pointer', fontWeight:700, fontSize:13, ...F }}>
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
              style={{ flex:1, padding:'13px', borderRadius:12, background:'#22C55E', color:'var(--accent-inv)', fontWeight:700, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, ...F }}>
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
              style={{ flex:1, padding:'13px', borderRadius:12, background:'rgba(239,68,68,0.08)', color:'#EF4444', fontWeight:700, border:'1px solid rgba(239,68,68,0.25)', cursor:'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              {updating && <div style={{ width:14, height:14, border:'2px solid #EF4444', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>}
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