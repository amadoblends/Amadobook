/**
 * BarberCalendar — matches template exactly
 * - Week strip header (Mon-Sun) with selected day circle
 * - Week range label (May 16-22, 2025)
 * - Vertical timeline with hour labels left
 * - Compact appointment cards with left color border
 * - Orange FAB (+) bottom right
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberData } from '../../hooks/useBarberData'
import { formatCurrency, formatDuration, generateTimeSlots } from '../../utils/helpers'
import {
  format, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isToday, addWeeks, subWeeks,
  addDays, startOfDay,
} from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { useTheme } from '../../context/ThemeContext'
import { ChevronLeft, ChevronRight, X, Check, CheckCircle, XCircle, Scissors, Plus, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

const BG=('#0D0D0D'),CARD=('#141414'),CARD2=('#1C1C1E'),BORDER=('#252525'),ORANGE=('#FF6B1A'),TXT=('#F0F0F0'),TXT2=('#666666'),TXT3=('#3A3A3A'),GREEN=('#22C55E'),WALKIN=('#7C3AED')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
input,textarea{font-size:16px!important}
`

// Hours to show on timeline
const HOURS = [8,9,10,11,12,13,14,15,16,17,18,19,20]
const HOUR_H = 60 // px per hour

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToPx(mins, startHour = 8) {
  return ((mins - startHour * 60) / 60) * HOUR_H
}

// ── Status badge ────────────────────────────────────────────────────────────
function Badge({ status, isWalkIn }) {
  if (isWalkIn && status !== 'cancelled' && status !== 'completed')
    return <span style={{ background: `${WALKIN}20`, color: WALKIN, fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 20 }}>W</span>
  const M = {
    confirmed: { bg: `${GREEN}14`, c: GREEN, l: 'Confirmed' },
    pending:   { bg: `${ORANGE}14`, c: ORANGE, l: 'Pending' },
    completed: { bg: 'rgba(255,255,255,0.05)', c: TXT2, l: 'Done' },
    cancelled: { bg: 'rgba(239,68,68,0.1)', c: '#EF4444', l: 'Cancelled' },
  }
  const s = M[status] || M.pending
  return <span style={{ background: s.bg, color: s.c, fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 20 }}>{s.l}</span>
}

// ── Centered modal ───────────────────────────────────────────────────────────
function Modal({ children, onClose, maxWidth = 380 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'fadeIn 0.15s ease' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth, background: CARD, borderRadius: 20, border: `1px solid ${BORDER}`, maxHeight: '88dvh', overflowY: 'auto', animation: 'slideUp 0.2s ease', ...F }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// ── Walk-in / New appointment modal ──────────────────────────────────────────
function NewApptModal({ onClose, barber, activeServices, availability, appointments }) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [email, setEmail] = useState(''), [notes, setNotes] = useState('')
  const [selSvc, setSelSvc] = useState(null)
  const [selDate, setSelDate] = useState(new Date()), [selSlot, setSelSlot] = useState(null)
  const [weekOff, setWeekOff] = useState(0), [saving, setSaving] = useState(false)

  const today = startOfDay(new Date()), advance = availability?.advanceDays || 30
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(today, weekOff * 7 + i)).filter(d => d <= addDays(today, advance))

  const slots = useMemo(() => {
    if (!selSvc || !selDate || !availability) return []
    const di = selDate.getDay()
    const ds = availability.schedule?.[di] || { enabled: (availability.workingDays || [1,2,3,4,5,6]).includes(di), startTime: availability.startTime || '09:00', endTime: availability.endTime || '18:00', breaks: availability.breaks || [] }
    if (!ds.enabled) return []
    const dateStr = format(selDate, 'yyyy-MM-dd')
    const existing = appointments.filter(a => a.date === dateStr && a.bookingStatus !== 'cancelled').map(a => ({ startTime: a.startTime, endTime: a.endTime }))
    let sl = generateTimeSlots(ds.startTime, ds.endTime, selSvc.duration, ds.breaks || [], existing)
    if (isToday(selDate)) { const nm = new Date().getHours() * 60 + new Date().getMinutes(); sl = sl.filter(s => { const [h, m] = s.startTime.split(':').map(Number); return h * 60 + m > nm }) }
    return sl
  }, [selSvc, selDate, availability, appointments])

  function isDayOff(date) {
    if (date < today) return true
    const di = date.getDay()
    const ds = availability?.schedule?.[di]
    return (ds && !ds.enabled) || (availability?.blockedDates?.includes(format(date, 'yyyy-MM-dd')))
  }

  async function create() {
    if (!name.trim() || !selSvc || !selSlot) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'appointments'), {
        barberId: barber.id, barberName: barber.name,
        clientId: null, clientName: name.trim(), clientPhone: phone.trim(), clientEmail: email.trim(),
        isGuest: true, isWalkIn: true,
        services: [{ id: selSvc.id, name: selSvc.name, price: selSvc.price, duration: selSvc.duration }],
        date: format(selDate, 'yyyy-MM-dd'), startTime: selSlot.startTime, endTime: selSlot.endTime,
        totalDuration: selSvc.duration, totalPrice: selSvc.price,
        paymentMethod: 'cash', paymentStatus: 'pending', bookingStatus: 'confirmed',
        notes: notes.trim() || null, createdAt: serverTimestamp(),
      })
      toast.success('Appointment added ✂️'); onClose()
    } catch { toast.error('Could not add') }
    finally { setSaving(false) }
  }

  const canNext = step === 1 ? name.trim().length > 0 : step === 2 ? !!selSvc : !!selSlot

  return (
    <Modal onClose={onClose} maxWidth={400}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {step > 1 && <button onClick={() => setStep(s => s - 1)} style={{ background: 'none', border: 'none', color: TXT2, cursor: 'pointer', display: 'flex', padding: 0 }}><ChevronLeft size={17} /></button>}
          <div>
            <p style={{ color: TXT, fontWeight: 700, fontSize: 14, margin: '0 0 1px' }}>{step === 1 ? 'Client Info' : step === 2 ? 'Service' : 'Date & Time'}</p>
            <div style={{ display: 'flex', gap: 4 }}>{[1, 2, 3].map(s => <div key={s} style={{ width: s === step ? 12 : 4, height: 4, borderRadius: 2, background: s <= step ? ORANGE : BORDER, transition: 'all 0.2s' }} />)}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '5px 6px', color: TXT2, cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
      </div>

      <div style={{ padding: '13px 15px 20px' }}>
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[{ l: 'Name *', v: name, s: setName, t: 'text', p: 'Client name' }, { l: 'Phone', v: phone, s: setPhone, t: 'tel', p: '(305) 000-0000' }, { l: 'Email', v: email, s: setEmail, t: 'email', p: 'optional' }].map(f => (
              <div key={f.l}>
                <label style={{ display: 'block', color: TXT3, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>{f.l.toUpperCase()}</label>
                <input type={f.t} value={f.v} onChange={e => f.s(e.target.value)} placeholder={f.p}
                  style={{ width: '100%', background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '9px 11px', color: TXT, fontSize: 14, outline: 'none', ...F }}
                  onFocus={e => e.target.style.borderColor = ORANGE} onBlur={e => e.target.style.borderColor = BORDER} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', color: TXT3, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>NOTES</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Style notes…" rows={2}
                style={{ width: '100%', background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '9px 11px', color: TXT, fontSize: 13, outline: 'none', resize: 'none', ...F }}
                onFocus={e => e.target.style.borderColor = ORANGE} onBlur={e => e.target.style.borderColor = BORDER} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {activeServices.length === 0
              ? <p style={{ color: TXT2, textAlign: 'center', padding: '20px 0', fontSize: 13 }}>No active services.</p>
              : activeServices.map(svc => {
                const sel = selSvc?.id === svc.id
                return (
                  <button key={svc.id} onClick={() => setSelSvc(svc)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11, background: sel ? `${ORANGE}12` : CARD2, border: `1.5px solid ${sel ? ORANGE : BORDER}`, cursor: 'pointer', textAlign: 'left', ...F, width: '100%' }}>
                    <Scissors size={14} color={sel ? ORANGE : TXT3} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: TXT, fontWeight: 700, fontSize: 13, margin: '0 0 1px' }}>{svc.name}</p>
                      <p style={{ color: TXT2, fontSize: 11, margin: 0 }}>{formatDuration(svc.duration)}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                      <p style={{ color: ORANGE, fontWeight: 800, fontSize: 13, margin: 0 }}>{formatCurrency(svc.price)}</p>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${sel ? ORANGE : BORDER}`, background: sel ? ORANGE : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {sel && <Check size={9} color="#fff" />}
                      </div>
                    </div>
                  </button>
                )
              })}
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              <button onClick={() => { setWeekOff(w => Math.max(0, w - 1)); setSelSlot(null) }} disabled={weekOff === 0}
                style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: weekOff === 0 ? 'not-allowed' : 'pointer', opacity: weekOff === 0 ? 0.3 : 1, color: TXT }}>
                <ChevronLeft size={13} />
              </button>
              <span style={{ color: TXT2, fontSize: 11, fontWeight: 600 }}>{weekDays[0] && format(weekDays[0], 'MMM d')} – {weekDays[weekDays.length - 1] && format(weekDays[weekDays.length - 1], 'MMM d')}</span>
              <button onClick={() => { setWeekOff(w => w + 1); setSelSlot(null) }} disabled={weekDays.length < 7}
                style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: weekDays.length < 7 ? 'not-allowed' : 'pointer', opacity: weekDays.length < 7 ? 0.3 : 1, color: TXT }}>
                <ChevronRight size={13} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weekDays.length},1fr)`, gap: 5, marginBottom: 12 }}>
              {weekDays.map((date, i) => {
                const disabled = isDayOff(date), sel = isSameDay(date, selDate)
                return (
                  <button key={i} onClick={() => { if (!disabled) { setSelDate(date); setSelSlot(null) } }} disabled={disabled}
                    style={{ padding: '7px 2px', borderRadius: 9, border: `1.5px solid ${sel ? ORANGE : BORDER}`, background: sel ? ORANGE : CARD2, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.2 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ color: sel ? 'rgba(255,255,255,0.7)' : TXT3, fontSize: 8, fontWeight: 700 }}>{format(date, 'EEE').toUpperCase()}</span>
                    <span style={{ color: sel ? '#fff' : isToday(date) ? ORANGE : TXT, fontSize: 13, fontWeight: 800 }}>{format(date, 'd')}</span>
                  </button>
                )
              })}
            </div>
            <p style={{ color: TXT3, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>{format(selDate, 'EEE, MMM d').toUpperCase()}</p>
            {slots.length === 0
              ? <p style={{ color: TXT2, fontSize: 12, textAlign: 'center', padding: '10px 0' }}>No available times</p>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
                {slots.map(slot => {
                  const sel = selSlot?.startTime === slot.startTime
                  return (
                    <button key={slot.startTime} onClick={() => setSelSlot(slot)}
                      style={{ padding: '9px 3px', borderRadius: 9, border: `1.5px solid ${sel ? ORANGE : BORDER}`, background: sel ? ORANGE : CARD2, color: sel ? '#fff' : TXT2, fontWeight: 700, fontSize: 11, cursor: 'pointer', ...F }}>
                      {slot.startTime}
                    </button>
                  )
                })}
              </div>}
            {selSlot && (
              <div style={{ background: `${ORANGE}10`, border: `1px solid ${ORANGE}28`, borderRadius: 9, padding: '9px 11px', marginTop: 10 }}>
                <p style={{ color: ORANGE, fontWeight: 700, fontSize: 12, margin: 0 }}>{format(selDate, 'MMM d')} · {selSlot.startTime}–{selSlot.endTime}</p>
                <p style={{ color: TXT2, fontSize: 10, margin: '2px 0 0' }}>{selSvc?.name} · {formatCurrency(selSvc?.price)}</p>
              </div>
            )}
          </div>
        )}

        <button onClick={step < 3 ? () => canNext && setStep(s => s + 1) : create} disabled={!canNext || saving}
          style={{ width: '100%', marginTop: 14, background: canNext ? ORANGE : BORDER, border: 'none', borderRadius: 20, padding: '13px', color: canNext ? '#fff' : TXT3, fontWeight: 700, fontSize: 14, cursor: canNext ? 'pointer' : 'not-allowed', ...F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: canNext ? `0 4px 14px ${ORANGE}38` : 'none' }}>
          {saving && <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />}
          {step < 3 ? 'Continue →' : saving ? 'Adding…' : '✓ Confirm'}
        </button>
      </div>
    </Modal>
  )
}

// ── Appointment detail modal ─────────────────────────────────────────────────
function ApptModal({ appt, onClose, onComplete, onCancel }) {
  const { formatTime } = useTheme()
  if (!appt) return null
  return (
    <Modal onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', borderBottom: `1px solid ${BORDER}` }}>
        <div>
          <p style={{ color: TXT, fontWeight: 700, fontSize: 14, margin: '0 0 3px' }}>{appt.clientName}</p>
          <div style={{ display: 'flex', gap: 5 }}>
            {appt.isWalkIn && <span style={{ background: `${WALKIN}20`, color: WALKIN, fontSize: 9, padding: '2px 6px', borderRadius: 20, fontWeight: 800 }}>WALK-IN</span>}
            <Badge status={appt.bookingStatus} isWalkIn={false} />
          </div>
        </div>
        <button onClick={onClose} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '5px 6px', color: TXT2, cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
      </div>
      <div style={{ padding: '13px 15px 18px' }}>
        {appt.services?.map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${BORDER}` }}>
            <div>
              <p style={{ color: TXT, fontWeight: 600, fontSize: 13, margin: '0 0 1px' }}>{s.name}</p>
              <p style={{ color: TXT2, fontSize: 11, margin: 0 }}>{formatDuration(s.duration)}</p>
            </div>
            <p style={{ color: ORANGE, fontWeight: 800, fontSize: 13, margin: 0 }}>{formatCurrency(s.price)}</p>
          </div>
        ))}
        <div style={{ background: CARD2, borderRadius: 9, padding: '9px 11px', margin: '10px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: TXT2, fontSize: 12, margin: 0 }}>{formatTime(appt.startTime)} – {formatTime(appt.endTime)}</p>
            <p style={{ color: ORANGE, fontWeight: 800, fontSize: 13, margin: 0 }}>{formatCurrency(appt.totalWithTip || appt.totalPrice)}</p>
          </div>
          {appt.clientPhone && <p style={{ color: TXT2, fontSize: 11, margin: '4px 0 0' }}>{appt.clientPhone}</p>}
          {appt.notes && <p style={{ color: TXT2, fontSize: 11, margin: '4px 0 0', fontStyle: 'italic' }}>"{appt.notes}"</p>}
        </div>
        {appt.bookingStatus !== 'completed' && appt.bookingStatus !== 'cancelled' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={onComplete} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 11px', borderRadius: 9, background: `${GREEN}10`, color: GREEN, border: `1px solid ${GREEN}20`, cursor: 'pointer', fontWeight: 600, fontSize: 12, ...F }}>
              <CheckCircle size={13} /> Mark Completed
            </button>
            <button onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 11px', borderRadius: 9, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444', fontWeight: 600, fontSize: 12, cursor: 'pointer', ...F }}>
              <XCircle size={13} /> Cancel Appointment
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN CALENDAR
// ══════════════════════════════════════════════════════════════════════════════
export default function BarberCalendar() {
  const { barber, appointments, activeServices, availability, loading } = useBarberData()
  const { formatTime } = useTheme()

  const [weekBase, setWeekBase] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [detailAppt, setDetailAppt] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [updating, setUpdating] = useState(false)
  const timelineRef = useRef(null)

  // Week days Mon–Sun
  const weekDays = eachDayOfInterval({
    start: weekBase,
    end: endOfWeek(weekBase, { weekStartsOn: 1 }),
  })

  // Week label e.g. "May 16 – 22, 2025"
  const weekLabel = (() => {
    const s = weekDays[0], e = weekDays[6]
    if (s.getMonth() === e.getMonth()) return `${format(s, 'MMM d')} – ${format(e, 'd, yyyy')}`
    return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`
  })()

  // Appointments for selected day
  const dayAppts = appointments
    .filter(a => a.date === format(selectedDay, 'yyyy-MM-dd') && a.bookingStatus !== 'cancelled')
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  // Scroll to first appointment or 9am on day change
  useEffect(() => {
    if (!timelineRef.current) return
    const firstAppt = dayAppts[0]
    const targetMins = firstAppt ? timeToMinutes(firstAppt.startTime) - 30 : 9 * 60
    const targetPx = minutesToPx(targetMins)
    setTimeout(() => timelineRef.current?.scrollTo({ top: Math.max(0, targetPx - 20), behavior: 'smooth' }), 100)
  }, [selectedDay])

  async function handleComplete() {
    if (!detailAppt) return
    setUpdating(true)
    try { await updateDoc(doc(db, 'appointments', detailAppt.id), { bookingStatus: 'completed' }); toast.success('Done ✓'); setDetailAppt(null) }
    catch { toast.error('Failed') }
    setUpdating(false)
  }

  async function handleCancel() {
    if (!detailAppt) return
    setUpdating(true)
    try { await updateDoc(doc(db, 'appointments', detailAppt.id), { bookingStatus: 'cancelled', paymentStatus: 'cancelled' }); toast.success('Cancelled'); setDetailAppt(null) }
    catch { toast.error('Failed') }
    setUpdating(false)
  }

  // Color coding for appointment cards
  function apptColor(a) {
    if (a.isWalkIn) return WALKIN
    if (a.bookingStatus === 'confirmed') return GREEN
    if (a.bookingStatus === 'completed') return TXT3
    if (a.bookingStatus === 'cancelled') return '#EF4444'
    return ORANGE
  }

  if (loading) return (
    <BarberLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ width: 20, height: 20, border: `2px solid #333`, borderTopColor: ORANGE, borderRadius: '50%', animation: 'spin 0.65s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </BarberLayout>
  )

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{ background: BG, display: 'flex', flexDirection: 'column', height: 'calc(100dvh - calc(44px + env(safe-area-inset-top)) - calc(52px + env(safe-area-inset-bottom)))', ...F }}>

        {/* ── WEEK HEADER ── */}
        <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: '10px 14px 0', flexShrink: 0 }}>

          {/* Week nav row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button onClick={() => setWeekBase(w => subWeeks(w, 1))}
              style={{ background: 'none', border: 'none', color: TXT2, cursor: 'pointer', padding: '4px', display: 'flex' }}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ color: TXT, fontWeight: 700, fontSize: 14, letterSpacing: '-0.2px' }}>{weekLabel}</span>
            <button onClick={() => setWeekBase(w => addWeeks(w, 1))}
              style={{ background: 'none', border: 'none', color: TXT2, cursor: 'pointer', padding: '4px', display: 'flex' }}>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day strip Mon–Sun */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, paddingBottom: 10 }}>
            {weekDays.map((date, i) => {
              const sel = isSameDay(date, selectedDay)
              const tod = isToday(date)
              const count = appointments.filter(a => a.date === format(date, 'yyyy-MM-dd') && a.bookingStatus !== 'cancelled').length

              return (
                <button key={i} onClick={() => setSelectedDay(date)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 2px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', position: 'relative' }}>
                  {/* Day label */}
                  <span style={{ color: sel ? ORANGE : TXT3, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em' }}>
                    {format(date, 'EEE').toUpperCase()}
                  </span>
                  {/* Date number in circle if selected */}
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: sel ? ORANGE : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    <span style={{
                      fontSize: 15, fontWeight: sel ? 800 : tod ? 700 : 600,
                      color: sel ? '#fff' : tod ? ORANGE : TXT,
                    }}>
                      {format(date, 'd')}
                    </span>
                  </div>
                  {/* Appt count dot/number */}
                  {count > 0 && (
                    <span style={{
                      fontSize: 9, fontWeight: 800,
                      color: sel ? ORANGE : TXT3,
                    }}>
                      {count}
                    </span>
                  )}
                  {count === 0 && <span style={{ fontSize: 9, color: 'transparent' }}>0</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── TIMELINE ── */}
        <div ref={timelineRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <div style={{ position: 'relative', minHeight: HOURS.length * HOUR_H + 40 }}>

            {/* Hour lines + labels */}
            {HOURS.map(hour => (
              <div key={hour} style={{ position: 'absolute', left: 0, right: 0, top: (hour - 8) * HOUR_H }}>
                {/* Hour label */}
                <div style={{ position: 'absolute', left: 12, top: -7, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: TXT3, fontSize: 10, fontWeight: 600, width: 36, textAlign: 'right', flexShrink: 0 }}>
                    {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </span>
                  {/* Horizontal line */}
                  <div style={{ height: 1, background: BORDER, flex: 1, opacity: 0.5 }} />
                </div>
              </div>
            ))}

            {/* Right side content area */}
            <div style={{ marginLeft: 60, marginRight: 12, position: 'relative', minHeight: HOURS.length * HOUR_H + 40 }}>

              {/* Appointment cards positioned by time */}
              {dayAppts.map((appt, idx) => {
                const startMins = timeToMinutes(appt.startTime)
                const endMins   = timeToMinutes(appt.endTime)
                const topPx     = minutesToPx(startMins)
                const heightPx  = Math.max(((endMins - startMins) / 60) * HOUR_H - 4, 36)
                const color     = apptColor(appt)

                return (
                  <button key={appt.id}
                    onClick={() => setDetailAppt(appt)}
                    style={{
                      position: 'absolute',
                      top: topPx + 2,
                      left: 0,
                      right: 0,
                      height: heightPx,
                      borderRadius: 10,
                      background: CARD2,
                      border: `1px solid ${BORDER}`,
                      borderLeft: `3px solid ${color}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: '6px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      overflow: 'hidden',
                      ...F,
                    }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Name */}
                      <p style={{ color: TXT, fontWeight: 700, fontSize: 12, margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {appt.clientName}
                        {appt.isWalkIn && <span style={{ color: WALKIN, fontSize: 9, fontWeight: 800, marginLeft: 5 }}>W</span>}
                      </p>
                      {/* Services */}
                      <p style={{ color: TXT2, fontSize: 10, margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {appt.services?.map(s => s.name).join(' + ')}
                      </p>
                      {/* Time */}
                      {heightPx > 44 && (
                        <p style={{ color: TXT3, fontSize: 10, margin: 0 }}>
                          {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
                        </p>
                      )}
                    </div>
                    {/* Price on right */}
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <p style={{ color: ORANGE, fontWeight: 800, fontSize: 12, margin: 0 }}>{formatCurrency(appt.totalWithTip || appt.totalPrice)}</p>
                      {heightPx > 44 && <Badge status={appt.bookingStatus} isWalkIn={appt.isWalkIn} />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── FAB + button — bottom right like template ── */}
        <button
          onClick={() => setShowNew(true)}
          style={{
            position: 'fixed',
            bottom: 'calc(64px + env(safe-area-inset-bottom))',
            right: 16,
            width: 50,
            height: 50,
            borderRadius: '50%',
            background: ORANGE,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 20px ${ORANGE}55`,
            zIndex: 30,
          }}>
          <Plus size={22} color="#fff" strokeWidth={2.5} />
        </button>
      </div>

      {detailAppt && (
        <ApptModal appt={detailAppt} onClose={() => setDetailAppt(null)}
          onComplete={handleComplete} onCancel={handleCancel} />
      )}
      {showNew && barber && (
        <NewApptModal onClose={() => setShowNew(false)} barber={barber}
          activeServices={activeServices} availability={availability} appointments={appointments} />
      )}
    </BarberLayout>
  )
}