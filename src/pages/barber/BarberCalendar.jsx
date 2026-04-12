import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration, getInitials, parseLocalDate } from '../../utils/helpers'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isSameDay, startOfWeek, endOfWeek, isToday, addMonths, subMonths
} from 'date-fns'
import toast from 'react-hot-toast'
import BarberLayout from '../../components/layout/BarberLayout'
import Modal from '../../components/ui/Modal'
import {
  ChevronLeft, ChevronRight, CheckCircle, DollarSign,
  XCircle, Calendar, RefreshCw, RotateCcw, Plus
} from 'lucide-react'
import { PageLoader } from '../../components/ui/Spinner'

const F = { fontFamily: 'Monda, sans-serif' }

export default function BarberCalendar() {
  const { user } = useAuth()
  const [barber, setBarber]             = useState(null)
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]           = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay]   = useState(new Date())
  const [detailAppt, setDetailAppt]     = useState(null)
  const [cancelModal, setCancelModal]   = useState(false)
  const [reschedModal, setReschedModal] = useState(false)
  const [tipModal, setTipModal]         = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [reschedData, setReschedData]   = useState({ date: '', startTime: '', endTime: '' })
  const [reschedNote, setReschedNote]   = useState('')
  const [tipAmount, setTipAmount]       = useState('')
  const [updating, setUpdating]         = useState(false)

  useEffect(() => {
    if (!barber) return
    const iv = setInterval(() => loadAppointments(barber.id), 20000)
    return () => clearInterval(iv)
  }, [barber])

  async function loadAppointments(barberId) {
    const snap = await getDocs(query(collection(db, 'appointments'), where('barberId', '==', barberId)))
    setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const bSnap = await getDocs(query(collection(db, 'barbers'), where('userId', '==', user.uid)))
        if (bSnap.empty) { setLoading(false); return }
        const b = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() }
        setBarber(b)
        await loadAppointments(b.id)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [user])

  const calDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end:   endOfWeek(endOfMonth(currentMonth)),
  })

  // Only active (non-cancelled) appointments count for calendar dots
  const countForDay = d => appointments.filter(a =>
    a.date === format(d, 'yyyy-MM-dd') && a.bookingStatus !== 'cancelled'
  ).length

  // Only non-cancelled in main list
  const apptsForDay = d => appointments
    .filter(a => a.date === format(d, 'yyyy-MM-dd') && a.bookingStatus !== 'cancelled')
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const dayAppointments = apptsForDay(selectedDay)

  async function handleCancel() {
    if (!cancelReason.trim()) return toast.error('Provide a reason')
    setUpdating(true)
    try {
      await updateDoc(doc(db, 'appointments', detailAppt.id), {
        bookingStatus: 'cancelled', paymentStatus: 'cancelled',
        cancelReason: cancelReason.trim(),
      })
      setAppointments(p => p.map(a => a.id === detailAppt.id
        ? { ...a, bookingStatus: 'cancelled', paymentStatus: 'cancelled', cancelReason: cancelReason.trim() }
        : a))
      toast.success('Cancelled')
      setCancelModal(false); setDetailAppt(null); setCancelReason('')
    } catch { toast.error('Failed') }
    finally { setUpdating(false) }
  }

  async function handleReschedule() {
    const { date, startTime, endTime } = reschedData
    if (!date || !startTime || !endTime) return toast.error('Fill all fields')
    setUpdating(true)
    try {
      await updateDoc(doc(db, 'appointments', detailAppt.id), {
        date, startTime, endTime,
        rescheduleNote: reschedNote.trim() || null,
      })
      setAppointments(p => p.map(a => a.id === detailAppt.id
        ? { ...a, date, startTime, endTime, rescheduleNote: reschedNote.trim() || null }
        : a))
      toast.success('Rescheduled')
      setReschedModal(false); setDetailAppt(null); setReschedNote('')
    } catch { toast.error('Failed') }
    finally { setUpdating(false) }
  }

  async function handleComplete(addTip = false) {
    const tip = addTip ? (parseFloat(tipAmount) || 0) : 0
    setUpdating(true)
    try {
      await updateDoc(doc(db, 'appointments', detailAppt.id), {
        bookingStatus: 'completed',
        tip,
        totalWithTip: (detailAppt.totalPrice || 0) + tip,
      })
      // Update client stats if clientId exists
      if (detailAppt.clientId) {
        const uSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', detailAppt.clientId)))
        if (!uSnap.empty) {
          const u = uSnap.docs[0].data()
          await updateDoc(doc(db, 'users', detailAppt.clientId), {
            totalVisits: (u.totalVisits || 0) + 1,
            totalSpent:  (u.totalSpent  || 0) + (detailAppt.totalPrice || 0) + tip,
          })
        }
      }
      setAppointments(p => p.map(a => a.id === detailAppt.id
        ? { ...a, bookingStatus: 'completed', tip, totalWithTip: (a.totalPrice || 0) + tip }
        : a))
      toast.success('Marked as completed ✓')
      setTipModal(false); setDetailAppt(null); setTipAmount('')
    } catch { toast.error('Failed') }
    finally { setUpdating(false) }
  }

  async function togglePaid(appt) {
    const s = appt.paymentStatus === 'paid' ? 'pending' : 'paid'
    await updateDoc(doc(db, 'appointments', appt.id), { paymentStatus: s })
    setAppointments(p => p.map(a => a.id === appt.id ? { ...a, paymentStatus: s } : a))
    setDetailAppt(p => p ? { ...p, paymentStatus: s } : null)
    toast.success(s === 'paid' ? 'Marked paid' : 'Marked unpaid')
  }

  if (loading) return <BarberLayout><PageLoader /></BarberLayout>

  return (
    <BarberLayout>
      <div style={{ padding: '16px', maxWidth: 560, margin: '0 auto', ...F }}>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-pri)' }}>
            <ChevronLeft size={18} />
          </button>
          <h2 style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-pri)', fontSize: 18, fontWeight: 800, margin: 0 }}>
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-pri)' }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Calendar grid */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 14, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 6 }}>
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-sec)', padding: '4px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
            {calDays.map((date, i) => {
              const count   = countForDay(date)
              const inMonth = isSameMonth(date, currentMonth)
              const sel     = isSameDay(date, selectedDay)
              const tod     = isToday(date)
              const isPast = date < startOfDay(new Date())
              const isDisabled = !inMonth
              return (
                <button key={i} onClick={() => setSelectedDay(date)}
                  style={{
                    padding: '8px 2px', borderRadius: 10, border: 'none',
                    cursor: isDisabled ? 'default' : 'pointer',
                    opacity: isDisabled ? 0.15 : isPast ? 0.35 : 1,
                    background: sel ? 'var(--accent)' : tod ? 'var(--accent)22' : 'transparent',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    filter: isPast && !sel ? 'grayscale(0.8)' : 'none',
                  }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: sel ? 'white' : tod ? 'var(--accent)' : isPast ? 'var(--text-sec)' : 'var(--text-pri)' }}>
                    {date.getDate()}
                  </span>
                  {count > 0 && inMonth && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: sel ? 'rgba(255,255,255,0.8)' : isPast ? 'var(--text-sec)' : 'var(--accent)' }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Day appointments */}
        <h3 style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-pri)', fontSize: 16, marginBottom: 12 }}>
          {isToday(selectedDay) ? 'Today' : format(selectedDay, 'EEE, MMM d')}
          {dayAppointments.length > 0 && (
            <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13, marginLeft: 8 }}>
              · {dayAppointments.length} appt{dayAppointments.length !== 1 ? 's' : ''}
            </span>
          )}
        </h3>

        {dayAppointments.length === 0 ? (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
            <Calendar size={24} style={{ color: 'var(--text-sec)', opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
            <p style={{ color: 'var(--text-sec)', margin: 0 }}>No appointments</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dayAppointments.map(appt => (
              <button key={appt.id} onClick={() => setDetailAppt(appt)}
                style={{
                  background: appt.bookingStatus === 'completed' ? '#16A34A12' : 'var(--card)',
                  border: appt.bookingStatus === 'completed' ? '1px solid #16A34A33' : '1px solid var(--border)',
                  borderLeft: `3px solid ${appt.bookingStatus === 'completed' ? '#16A34A' : appt.isGuest ? '#8b5cf6' : 'var(--accent)'}`,
                  borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', ...F,
                }}>
                <div style={{ flexShrink: 0, minWidth: 48 }}>
                  <p style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 13, margin: 0 }}>{appt.startTime}</p>
                  <p style={{ color: 'var(--text-sec)', fontSize: 11, margin: 0 }}>{appt.endTime}</p>
                </div>
                <div style={{ width: 1, height: 36, background: 'var(--border)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <p style={{ color: 'var(--text-pri)', fontWeight: 700, fontSize: 14, margin: 0 }}>{appt.clientName}</p>
                    {appt.isGuest && <span style={{ background: '#8b5cf622', color: '#a78bfa', fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>Guest</span>}
                    {appt.bookingStatus === 'completed' && <span style={{ width:8, height:8, borderRadius:'50%', background:'#16A34A', display:'inline-block', flexShrink:0 }}/>}
                    {appt.paymentStatus === 'paid' && <span style={{ background: '#3b82f622', color: '#60a5fa', fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>Paid</span>}
                  </div>
                  <p style={{ color: 'var(--text-sec)', fontSize: 12, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {appt.services?.map(s => s.name).join(', ')}
                  </p>
                </div>
                <p style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{formatCurrency(appt.totalPrice)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!detailAppt && !cancelModal && !reschedModal && !tipModal} onClose={() => setDetailAppt(null)} title="Appointment">
        {detailAppt && (
          <div style={{ ...F, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: detailAppt.isGuest ? '#8b5cf622' : 'var(--accent)22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: detailAppt.isGuest ? '#a78bfa' : 'var(--accent)', flexShrink: 0 }}>
                {getInitials(detailAppt.clientName)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <p style={{ color: 'var(--text-pri)', fontWeight: 700, margin: 0 }}>{detailAppt.clientName}</p>
                  {detailAppt.isGuest && <span style={{ background: '#8b5cf622', color: '#a78bfa', fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>Guest</span>}
                </div>
                <p style={{ color: 'var(--text-sec)', fontSize: 12, margin: 0 }}>{detailAppt.clientEmail}</p>
                {detailAppt.clientPhone && <p style={{ color: 'var(--text-sec)', fontSize: 12, margin: 0 }}>{detailAppt.clientPhone}</p>}
              </div>
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                ['Date', format(parseLocalDate(detailAppt.date), 'MMM d, yyyy')],
                ['Time', `${detailAppt.startTime} – ${detailAppt.endTime}`],
                ['Duration', formatDuration(detailAppt.totalDuration)],
                ['Total', formatCurrency(detailAppt.totalPrice)],
                ['Payment', detailAppt.paymentStatus],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-sec)' }}>{l}</span>
                  <span style={{ color: l === 'Total' ? 'var(--accent)' : l === 'Payment' ? (detailAppt.paymentStatus === 'paid' ? '#4ade80' : '#fbbf24') : 'var(--text-pri)', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              {detailAppt.tip > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-sec)' }}>Tip</span>
                  <span style={{ color: '#4ade80', fontWeight: 600 }}>+{formatCurrency(detailAppt.tip)}</span>
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-sec)' }}>
              {detailAppt.services?.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span style={{ color: 'var(--text-pri)' }}>{s.name}</span>
                  <span>{formatCurrency(s.price)}</span>
                </div>
              ))}
            </div>

            {detailAppt.rescheduleNote && (
              <div style={{ background: '#f59e0b15', border: '1px solid #f59e0b33', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#fbbf24' }}>
                Note: {detailAppt.rescheduleNote}
              </div>
            )}

            {detailAppt.cancelReason && (
              <div style={{ background: '#ef444415', border: '1px solid #ef444433', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#f87171' }}>
                Cancelled: {detailAppt.cancelReason}
              </div>
            )}

            {detailAppt.bookingStatus !== 'cancelled' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                {detailAppt.bookingStatus !== 'completed' && (
                  <button onClick={() => setTipModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: '#16A34A15', color: '#4ade80', border: '1px solid #16A34A33', cursor: 'pointer', fontWeight: 700, fontSize: 13, ...F }}>
                    <CheckCircle size={15} /> Mark Completed
                  </button>
                )}
                {detailAppt.bookingStatus === 'completed' && (
                  <button onClick={() => { updateDoc(doc(db,'appointments',detailAppt.id),{bookingStatus:'confirmed'}); setAppointments(p=>p.map(a=>a.id===detailAppt.id?{...a,bookingStatus:'confirmed'}:a)); setDetailAppt(p=>({...p,bookingStatus:'confirmed'})); toast.success('Reverted') }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: '#16A34A15', color: '#4ade80', border: '1px solid #16A34A33', cursor: 'pointer', fontWeight: 700, fontSize: 13, ...F }}>
                    <RotateCcw size={15} /> Unmark Completed
                  </button>
                )}
                <button onClick={() => togglePaid(detailAppt)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: detailAppt.paymentStatus === 'paid' ? '#3b82f633' : '#3b82f615', color: '#60a5fa', border: '1px solid #3b82f633', cursor: 'pointer', fontWeight: 700, fontSize: 13, ...F }}>
                  {detailAppt.paymentStatus === 'paid' ? <RotateCcw size={15} /> : <DollarSign size={15} />}
                  {detailAppt.paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                </button>
                <button onClick={() => { setReschedData({ date: detailAppt.date, startTime: detailAppt.startTime, endTime: detailAppt.endTime }); setReschedModal(true) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: '#f59e0b15', color: '#fbbf24', border: '1px solid #f59e0b33', cursor: 'pointer', fontWeight: 700, fontSize: 13, ...F }}>
                  <RefreshCw size={15} /> Reschedule
                </button>
                <button onClick={() => setCancelModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: '#ef444415', color: '#f87171', border: '1px solid #ef444433', cursor: 'pointer', fontWeight: 700, fontSize: 13, ...F }}>
                  <XCircle size={15} /> Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Tip Modal */}
      <Modal isOpen={tipModal} onClose={() => setTipModal(false)} title="Complete Appointment">
        <div style={F}>
          <p style={{ color: 'var(--text-sec)', fontSize: 14, marginBottom: 16 }}>Add a tip before completing?</p>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: 'var(--text-sec)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>TIP AMOUNT (optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 14px', gap: 6 }}>
              <span style={{ color: 'var(--text-sec)' }}>$</span>
              <input type="number" inputMode="decimal" value={tipAmount} onChange={e => setTipAmount(e.target.value)}
                placeholder="0.00"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-pri)', fontSize: 16 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => handleComplete(false)} disabled={updating}
              style={{ flex: 1, padding: '13px', borderRadius: 12, background: 'var(--surface)', color: 'var(--text-sec)', fontWeight: 600, border: '1px solid var(--border)', cursor: 'pointer', ...F }}>
              No Tip
            </button>
            <button onClick={() => handleComplete(true)} disabled={updating}
              style={{ flex: 1, padding: '13px', borderRadius: 12, background: '#16A34A', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...F }}>
              {updating && <div style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
              {tipAmount ? `Add $${tipAmount} Tip` : 'Complete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal isOpen={cancelModal} onClose={() => setCancelModal(false)} title="Cancel Appointment">
        <div style={F}>
          <p style={{ color: 'var(--text-sec)', fontSize: 14, marginBottom: 4 }}>
            Are you sure you want to cancel <strong style={{ color: 'var(--text-pri)' }}>{detailAppt?.clientName}</strong>'s appointment?
          </p>
          <p style={{ color: 'var(--text-sec)', fontSize: 12, marginBottom: 14 }}>This cannot be undone.</p>
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: 'var(--text-sec)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>REASON *</label>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3}
              placeholder="e.g. Emergency, closing early..."
              style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 14px', color: 'var(--text-pri)', fontSize: 14, resize: 'none', outline: 'none', ...F, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setCancelModal(false)} style={{ flex: 1, padding: '13px', borderRadius: 12, background: 'var(--surface)', color: 'var(--text-sec)', fontWeight: 600, border: '1px solid var(--border)', cursor: 'pointer', ...F }}>Back</button>
            <button onClick={handleCancel} disabled={updating}
              style={{ flex: 1, padding: '13px', borderRadius: 12, background: '#ef444415', color: '#f87171', fontWeight: 700, border: '1px solid #ef444433', cursor: 'pointer', ...F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {updating && <div style={{ width: 14, height: 14, border: '2px solid #f87171', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
              Confirm Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Reschedule Modal */}
      <Modal isOpen={reschedModal} onClose={() => setReschedModal(false)} title={`Reschedule — ${detailAppt?.clientName}`}>
        <div style={{ ...F, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ color: 'var(--text-sec)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>NEW DATE</label>
            <input type="date" value={reschedData.date}
              min={format(new Date(), 'yyyy-MM-dd')}
              onChange={e => setReschedData(p => ({ ...p, date: e.target.value }))}
              style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 14px', color: 'var(--text-pri)', fontSize: 16, outline: 'none', colorScheme: 'dark', boxSizing: 'border-box' }} />
            {reschedData.date && (
              <p style={{ color: 'var(--accent)', fontSize: 12, marginTop: 4, fontWeight: 600 }}>
                {format(parseLocalDate(reschedData.date), 'EEEE, MMMM d, yyyy')}
              </p>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ color: 'var(--text-sec)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>START</label>
              <input type="time" value={reschedData.startTime}
                onChange={e => setReschedData(p => ({ ...p, startTime: e.target.value }))}
                style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 14px', color: 'var(--text-pri)', fontSize: 16, outline: 'none', colorScheme: 'dark', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ color: 'var(--text-sec)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>END</label>
              <input type="time" value={reschedData.endTime}
                onChange={e => setReschedData(p => ({ ...p, endTime: e.target.value }))}
                style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 14px', color: 'var(--text-pri)', fontSize: 16, outline: 'none', colorScheme: 'dark', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <label style={{ color: 'var(--text-sec)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>NOTE (optional)</label>
            <textarea value={reschedNote} onChange={e => setReschedNote(e.target.value)} rows={2}
              placeholder="Reason for rescheduling..."
              style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 14px', color: 'var(--text-pri)', fontSize: 14, resize: 'none', outline: 'none', ...F, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setReschedModal(false)} style={{ flex: 1, padding: '13px', borderRadius: 12, background: 'var(--surface)', color: 'var(--text-sec)', fontWeight: 600, border: '1px solid var(--border)', cursor: 'pointer', ...F }}>Back</button>
            <button onClick={handleReschedule} disabled={updating}
              style={{ flex: 1, padding: '13px', borderRadius: 12, background: 'var(--accent)', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer', ...F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {updating && <div style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </BarberLayout>
  )
}