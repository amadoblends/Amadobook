import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration, getInitials, generateTimeSlots } from '../../utils/helpers'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay,
         startOfWeek, endOfWeek, isToday, addMonths, subMonths } from 'date-fns'
import toast from 'react-hot-toast'
import BarberLayout from '../../components/layout/BarberLayout'
import Modal from '../../components/ui/Modal'
import { ChevronLeft, ChevronRight, CheckCircle, DollarSign, XCircle, Calendar, RefreshCw, RotateCcw } from 'lucide-react'
import { PageLoader } from '../../components/ui/Spinner'

export default function BarberCalendar() {
  const { user } = useAuth()
  const [barber, setBarber]             = useState(null)
  const [appointments, setAppointments] = useState([])
  const [availability, setAvailability] = useState(null)
  const [loading, setLoading]           = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay]   = useState(new Date())
  const [detailAppt, setDetailAppt]     = useState(null)
  const [cancelModal, setCancelModal]   = useState(false)
  const [reschedModal, setReschedModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [reschedDate, setReschedDate]   = useState('')
  const [reschedSlot, setReschedSlot]   = useState('')
  const [availableSlots, setAvailableSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [updating, setUpdating]         = useState(false)

  useEffect(() => {
    if (!barber) return
    const interval = setInterval(() => loadAppointments(barber.id), 20000)
    return () => clearInterval(interval)
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
        const [_, aSnap] = await Promise.all([
          loadAppointments(b.id),
          getDocs(query(collection(db, 'availability'), where('barberId', '==', b.id)))
        ])
        if (!aSnap.empty) setAvailability(aSnap.docs[0].data())
      } catch (e) { console.error(e); toast.error('Could not load calendar') }
      finally { setLoading(false) }
    }
    load()
  }, [user])

  // Load available slots when reschedule date changes
  useEffect(() => {
    if (!reschedDate || !detailAppt || !availability) return
    setSlotsLoading(true)
    setReschedSlot('')

    const dayIndex = new Date(reschedDate + 'T12:00').getDay()
    const daySchedule = availability.schedule?.[dayIndex] || {
      enabled: (availability.workingDays || [1,2,3,4,5,6]).includes(dayIndex),
      startTime: availability.startTime || '09:00',
      endTime: availability.endTime || '18:00',
      breaks: availability.breaks || [],
    }

    if (!daySchedule.enabled) {
      setAvailableSlots([])
      setSlotsLoading(false)
      return
    }

    // Existing bookings on that date (exclude current appt)
    const existing = appointments
      .filter(a => a.date === reschedDate && a.bookingStatus !== 'cancelled' && a.id !== detailAppt.id)
      .map(a => ({ startTime: a.startTime, endTime: a.endTime }))

    const slots = generateTimeSlots(
      daySchedule.startTime,
      daySchedule.endTime,
      detailAppt.totalDuration || 30,
      daySchedule.breaks || [],
      existing
    )
    setAvailableSlots(slots)
    setSlotsLoading(false)
  }, [reschedDate, detailAppt, availability, appointments])

  const calDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end:   endOfWeek(endOfMonth(currentMonth)),
  })

  const countForDay = d => appointments.filter(a => a.date === format(d,'yyyy-MM-dd') && a.bookingStatus !== 'cancelled').length
  const apptsForDay = d => appointments
    .filter(a => a.date === format(d,'yyyy-MM-dd'))
    .sort((a,b) => a.startTime.localeCompare(b.startTime))
  const dayAppointments = apptsForDay(selectedDay)

  async function handleCancel() {
    if (!cancelReason.trim()) return toast.error('Please provide a reason')
    setUpdating(true)
    try {
      await updateDoc(doc(db,'appointments',detailAppt.id), {
        bookingStatus: 'cancelled', paymentStatus: 'cancelled',
        cancelReason: cancelReason.trim(),
      })
      setAppointments(p => p.map(a => a.id===detailAppt.id
        ? {...a,bookingStatus:'cancelled',paymentStatus:'cancelled',cancelReason:cancelReason.trim()} : a))
      toast.success('Appointment cancelled')
      setCancelModal(false); setDetailAppt(null); setCancelReason('')
    } catch { toast.error('Could not cancel') }
    finally { setUpdating(false) }
  }

  async function handleReschedule() {
    if (!reschedDate) return toast.error('Select a date')
    if (!reschedSlot)  return toast.error('Select a time slot')
    const slot = availableSlots.find(s => s.startTime === reschedSlot)
    if (!slot) return toast.error('Invalid slot')
    setUpdating(true)
    try {
      await updateDoc(doc(db,'appointments',detailAppt.id), {
        date: reschedDate, startTime: slot.startTime, endTime: slot.endTime
      })
      setAppointments(p => p.map(a => a.id===detailAppt.id
        ? {...a, date:reschedDate, startTime:slot.startTime, endTime:slot.endTime} : a))
      toast.success('Rescheduled!')
      setReschedModal(false); setDetailAppt(null)
    } catch { toast.error('Could not reschedule') }
    finally { setUpdating(false) }
  }

  async function togglePaid(appt) {
    const s = appt.paymentStatus === 'paid' ? 'pending' : 'paid'
    await updateDoc(doc(db,'appointments',appt.id), { paymentStatus: s })
    setAppointments(p => p.map(a => a.id===appt.id ? {...a,paymentStatus:s} : a))
    setDetailAppt(p => p ? {...p,paymentStatus:s} : null)
    toast.success(s === 'paid' ? 'Marked as paid' : 'Marked as unpaid')
  }

  async function toggleCompleted(appt) {
    const s = appt.bookingStatus === 'completed' ? 'confirmed' : 'completed'
    await updateDoc(doc(db,'appointments',appt.id), { bookingStatus: s })
    setAppointments(p => p.map(a => a.id===appt.id ? {...a,bookingStatus:s} : a))
    setDetailAppt(p => p ? {...p,bookingStatus:s} : null)
    toast.success(s === 'completed' ? 'Marked as completed' : 'Marked as confirmed')
  }

  if (loading) return <BarberLayout><PageLoader /></BarberLayout>

  return (
    <BarberLayout>
      <div className="p-4 max-w-xl mx-auto w-full overflow-x-hidden">

        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentMonth(m => subMonths(m,1))} className="btn-ghost p-2" style={{minHeight:'auto'}}>
            <ChevronLeft size={20}/>
          </button>
          <h2 className="text-lg font-bold" style={{fontFamily:'Syne,sans-serif',color:'var(--text-pri)'}}>
            {format(currentMonth,'MMMM yyyy')}
          </h2>
          <button onClick={() => setCurrentMonth(m => addMonths(m,1))} className="btn-ghost p-2" style={{minHeight:'auto'}}>
            <ChevronRight size={20}/>
          </button>
        </div>

        {/* Calendar */}
        <div className="card mb-5 p-3">
          <div className="grid grid-cols-7 mb-1">
            {['S','M','T','W','T','F','S'].map((d,i) => (
              <div key={i} className="text-center text-xs font-bold py-1" style={{color:'var(--text-sec)'}}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {calDays.map((date,i) => {
              const count    = countForDay(date)
              const inMonth  = isSameMonth(date, currentMonth)
              const selected = isSameDay(date, selectedDay)
              const today    = isToday(date)
              return (
                <button key={i} onClick={() => setSelectedDay(date)}
                  className="flex flex-col items-center rounded-xl py-1.5 transition-all"
                  style={{
                    opacity: inMonth ? 1 : 0.2,
                    background: selected ? 'var(--accent)' : today ? 'var(--accent)18' : 'transparent',
                  }}>
                  <span className="text-sm font-bold" style={{color: selected ? 'white' : today ? 'var(--accent)' : 'var(--text-pri)'}}>
                    {date.getDate()}
                  </span>
                  {count > 0 && (
                    <span className="text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
                      style={{background: selected ? 'rgba(255,255,255,0.3)' : 'var(--accent)22', color: selected ? 'white' : 'var(--accent)'}}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Day appointments */}
        <h3 className="font-bold mb-3" style={{fontFamily:'Syne,sans-serif',color:'var(--text-pri)'}}>
          {isToday(selectedDay) ? 'Today' : format(selectedDay,'EEE, MMM d')}
          {dayAppointments.filter(a=>a.bookingStatus!=='cancelled').length > 0 && (
            <span className="text-sm font-normal ml-2" style={{color:'var(--accent)'}}>
              · {dayAppointments.filter(a=>a.bookingStatus!=='cancelled').length} appts
            </span>
          )}
        </h3>

        {dayAppointments.length === 0 ? (
          <div className="card text-center py-8">
            <Calendar size={24} className="mx-auto mb-2 opacity-30" style={{color:'var(--text-sec)'}}/>
            <p className="text-sm" style={{color:'var(--text-sec)'}}>No appointments</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dayAppointments.map(appt => {
              const isGuest     = appt.isGuest
              const isCancelled = appt.bookingStatus === 'cancelled'
              const isPaid      = appt.paymentStatus === 'paid'
              const isCompleted = appt.bookingStatus === 'completed'
              const accent      = isCancelled ? '#ef4444' : isGuest ? '#8b5cf6' : 'var(--accent)'
              return (
                <button key={appt.id} onClick={() => setDetailAppt(appt)}
                  className="w-full text-left card transition-all active:scale-98"
                  style={{opacity: isCancelled ? 0.5 : 1, borderLeft:`3px solid ${accent}`, padding:'12px 14px'}}>
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 text-left" style={{minWidth:48}}>
                      <p className="text-sm font-bold" style={{color:'var(--accent)'}}>{appt.startTime}</p>
                      <p className="text-xs" style={{color:'var(--text-sec)'}}>{appt.endTime}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-sm truncate" style={{color:'var(--text-pri)'}}>{appt.clientName}</p>
                        {isGuest     && <span className="badge-guest text-[10px] px-1.5 py-0.5">Guest</span>}
                        {isCancelled && <span className="badge-danger text-[10px] px-1.5 py-0.5">Cancelled</span>}
                        {isPaid && !isCancelled && <span className="badge-success text-[10px] px-1.5 py-0.5">Paid</span>}
                        {isCompleted && !isCancelled && <span className="badge-success text-[10px] px-1.5 py-0.5">Done</span>}
                      </div>
                      <p className="text-xs truncate" style={{color:'var(--text-sec)'}}>{appt.services?.map(s=>s.name).join(', ').substring(0,35) + (appt.services?.map(s=>s.name).join(', ').length > 35 ? '...' : '')}</p>
                    </div>
                    <p className="font-bold text-sm flex-shrink-0" style={{color:'var(--accent)'}}>{formatCurrency(appt.totalPrice)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!detailAppt && !cancelModal && !reschedModal} onClose={() => setDetailAppt(null)} title="Appointment" size="sm">
        {detailAppt && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
                style={{background: detailAppt.isGuest ? '#8b5cf6' : 'var(--accent)'}}>
                {getInitials(detailAppt.clientName)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold truncate" style={{color:'var(--text-pri)'}}>{detailAppt.clientName}</p>
                  {detailAppt.isGuest && <span className="badge-guest flex-shrink-0">Guest</span>}
                </div>
                <p className="text-xs truncate" style={{color:'var(--text-sec)'}}>{detailAppt.clientEmail}</p>
              </div>
            </div>

            <div className="rounded-2xl p-3 space-y-1.5" style={{background:'var(--surface)'}}>
              {[
                ['Date', format(new Date(detailAppt.date+'T12:00'),'MMM d, yyyy')],
                ['Time', `${detailAppt.startTime} – ${detailAppt.endTime}`],
                ['Duration', formatDuration(detailAppt.totalDuration)],
                ['Total', formatCurrency(detailAppt.totalPrice)],
                ['Payment', detailAppt.paymentStatus],
                ['Method', detailAppt.paymentMethod],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span style={{color:'var(--text-sec)'}}>{label}</span>
                  <span style={{color: label==='Total'?'var(--accent)': label==='Payment'? (detailAppt.paymentStatus==='paid'?'#4ade80':'#fbbf24') :'var(--text-pri)',fontWeight:600}}>{value}</span>
                </div>
              ))}
            </div>

            <div>
              {detailAppt.services?.map((s,i) => (
                <div key={i} className="flex justify-between text-sm py-0.5">
                  <span style={{color:'var(--text-pri)'}}>{s.name}</span>
                  <span style={{color:'var(--text-sec)'}}>{formatCurrency(s.price)}</span>
                </div>
              ))}
            </div>

            {detailAppt.cancelReason && (
              <div className="px-3 py-2 rounded-xl text-sm" style={{background:'#ef444415',color:'#f87171'}}>
                {detailAppt.cancelReason}
              </div>
            )}

            {detailAppt.bookingStatus !== 'cancelled' && (
              <div className="space-y-2 pt-2" style={{borderTop:'1px solid var(--border)'}}>
                <button onClick={() => toggleCompleted(detailAppt)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl font-semibold text-sm"
                  style={{background:'#16A34A15',color:'#4ade80',border:'1px solid #16A34A33'}}>
                  {detailAppt.bookingStatus==='completed' ? <RotateCcw size={15}/> : <CheckCircle size={15}/>}
                  {detailAppt.bookingStatus==='completed' ? 'Unmark Completed' : 'Mark Completed'}
                </button>
                <button onClick={() => togglePaid(detailAppt)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl font-semibold text-sm"
                  style={{background:'#3b82f615',color:'#60a5fa',border:'1px solid #3b82f633'}}>
                  {detailAppt.paymentStatus==='paid' ? <RotateCcw size={15}/> : <DollarSign size={15}/>}
                  {detailAppt.paymentStatus==='paid' ? 'Mark as Unpaid' : 'Mark as Paid'}
                </button>
                <button onClick={() => { setReschedDate(detailAppt.date); setReschedSlot(''); setAvailableSlots([]); setReschedModal(true) }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl font-semibold text-sm"
                  style={{background:'#f59e0b15',color:'#fbbf24',border:'1px solid #f59e0b33'}}>
                  <RefreshCw size={15}/> Reschedule
                </button>
                <button onClick={() => setCancelModal(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl font-semibold text-sm"
                  style={{background:'#ef444415',color:'#f87171',border:'1px solid #ef444433'}}>
                  <XCircle size={15}/> Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Cancel Modal */}
      <Modal isOpen={cancelModal} onClose={() => setCancelModal(false)} title="Cancel Appointment">
        <p className="text-sm mb-3" style={{color:'var(--text-sec)'}}>
          Reason for cancelling <span style={{color:'var(--text-pri)',fontWeight:600}}>{detailAppt?.clientName}</span>'s appointment:
        </p>
        <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
          placeholder="e.g. Emergency, closing early..." rows={3} className="input resize-none mb-4"/>
        <div className="flex gap-3">
          <button onClick={() => setCancelModal(false)} className="btn-secondary flex-1">Back</button>
          <button onClick={handleCancel} disabled={updating}
            className="flex-1 flex items-center justify-center gap-2 p-3 rounded-2xl font-semibold text-sm"
            style={{background:'#ef444415',color:'#f87171',border:'1px solid #ef444433'}}>
            {updating && <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"/>}
            {updating ? 'Cancelling...' : 'Confirm'}
          </button>
        </div>
      </Modal>

      {/* Reschedule Modal */}
      <Modal isOpen={reschedModal} onClose={() => setReschedModal(false)} title={`Reschedule — ${detailAppt?.clientName}`}>
        <div className="space-y-4">
          {/* Date picker */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{color:'var(--text-sec)'}}>New Date</label>
            <input
              type="date"
              value={reschedDate}
              min={format(new Date(),'yyyy-MM-dd')}
              onChange={e => setReschedDate(e.target.value)}
              className="input"
              style={{
                fontSize:16,
                colorScheme:'dark',
                WebkitAppearance:'none',
                appearance:'none',
              }}/>
            {reschedDate && (
              <p className="text-xs mt-1.5 font-semibold" style={{color:'var(--accent)'}}>
                {format(new Date(reschedDate+'T12:00'),'EEEE, MMMM d, yyyy')}
              </p>
            )}
          </div>

          {/* Available slots */}
          {reschedDate && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{color:'var(--text-sec)'}}>
                Available Times ({formatDuration(detailAppt?.totalDuration || 0)})
              </label>
              {slotsLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:'var(--accent)'}}/>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="p-3 rounded-xl text-sm text-center" style={{background:'#f59e0b15',color:'#fbbf24'}}>
                  No available slots on this day
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {availableSlots.map(slot => (
                    <button key={slot.startTime} onClick={() => setReschedSlot(slot.startTime)}
                      className="p-3 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: reschedSlot===slot.startTime ? 'var(--accent)' : 'var(--surface)',
                        color: reschedSlot===slot.startTime ? 'white' : 'var(--text-pri)',
                        border: `1.5px solid ${reschedSlot===slot.startTime ? 'var(--accent)' : 'var(--border)'}`,
                      }}>
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {reschedSlot && (
            <div className="p-3 rounded-xl text-sm" style={{background:'var(--accent)15',border:'1px solid var(--accent)33'}}>
              <p className="font-semibold" style={{color:'var(--accent)'}}>
                New time: {reschedSlot} – {availableSlots.find(s=>s.startTime===reschedSlot)?.endTime}
              </p>
              <p className="text-xs mt-0.5" style={{color:'var(--text-sec)'}}>
                {format(new Date(reschedDate+'T12:00'),'MMMM d, yyyy')}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setReschedModal(false)} className="btn-secondary flex-1">Back</button>
            <button onClick={handleReschedule} disabled={updating || !reschedSlot} className="btn-primary flex-1 gap-2">
              {updating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
              {updating ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    </BarberLayout>
  )
}
