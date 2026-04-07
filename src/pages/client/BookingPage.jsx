import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration, generateTimeSlots } from '../../utils/helpers'
import { format, addDays, startOfDay, isAfter } from 'date-fns'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'

// ── Styles ──────────────────────────────────────────────────
const s = {
  page:    { minHeight: '100vh', background: '#0a0a0a', color: '#E5E5E5', fontFamily: 'system-ui,sans-serif', paddingBottom: 100 },
  header:  { position: 'sticky', top: 0, background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 },
  back:    { background: '#141414', border: '1px solid #252525', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 },
  body:    { padding: '24px 20px', maxWidth: 520, margin: '0 auto', width: '100%' },
  h2:      { color: '#fff', fontSize: 20, fontWeight: 800, margin: '0 0 6px' },
  sub:     { color: '#666', fontSize: 14, margin: '0 0 20px' },
  label:   { color: '#666', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8, display: 'block' },
  input:   { width: '100%', background: '#141414', border: '1px solid #252525', borderRadius: 12, padding: '14px 16px', color: '#fff', fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  card:    { background: '#141414', border: '1px solid #252525', borderRadius: 14, padding: '14px 16px', marginBottom: 8, cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: 'inherit' },
  primary: { width: '100%', background: '#FF5C00', border: 'none', borderRadius: 14, padding: '16px', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bottom:  { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0a0a0a', borderTop: '1px solid #1a1a1a', padding: '16px 20px calc(28px + env(safe-area-inset-bottom))' },
  section: { marginBottom: 24 },
  row:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a1a' },
  muted:   { color: '#666', fontSize: 14 },
}

// ── Step indicator (simple dots) ───────────────────────────
function StepDots({ step, total }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ width: i === step ? 16 : 6, height: 6, borderRadius: 3, background: i <= step ? '#FF5C00' : '#252525', transition: 'width 0.2s' }} />
      ))}
    </div>
  )
}

// ── Simple calendar ─────────────────────────────────────────
function SimpleCalendar({ availability, barberAppts, duration, selected, onSelect }) {
  const today = startOfDay(new Date())
  const advance = availability?.advanceDays || 30
  const days = Array.from({ length: advance }, (_, i) => addDays(today, i))

  function getSlotsCount(date) {
    const dayIdx = date.getDay()
    const ds = availability?.schedule?.[dayIdx] || {
      enabled: (availability?.workingDays || [1,2,3,4,5,6]).includes(dayIdx),
      startTime: availability?.startTime || '09:00',
      endTime: availability?.endTime || '18:00',
      breaks: availability?.breaks || [],
    }
    if (!ds.enabled) return 0
    const dateStr = format(date, 'yyyy-MM-dd')
    if (availability?.blockedDates?.includes(dateStr)) return 0
    const existing = (barberAppts || [])
      .filter(a => a.date === dateStr && a.bookingStatus !== 'cancelled')
      .map(a => ({ startTime: a.startTime, endTime: a.endTime }))
    return generateTimeSlots(ds.startTime, ds.endTime, duration, ds.breaks || [], existing).length
  }

  const [visibleStart, setVisibleStart] = useState(0)
  const visible = days.slice(visibleStart, visibleStart + 7)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => setVisibleStart(Math.max(0, visibleStart - 7))} disabled={visibleStart === 0}
          style={{ background: 'none', border: 'none', color: visibleStart === 0 ? '#333' : '#fff', cursor: visibleStart === 0 ? 'not-allowed' : 'pointer', padding: 4 }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ color: '#888', fontSize: 13, fontWeight: 700 }}>
          {format(visible[0], 'MMM d')} – {format(visible[visible.length - 1], 'MMM d')}
        </span>
        <button onClick={() => setVisibleStart(Math.min(advance - 7, visibleStart + 7))} disabled={visibleStart + 7 >= advance}
          style={{ background: 'none', border: 'none', color: visibleStart + 7 >= advance ? '#333' : '#fff', cursor: visibleStart + 7 >= advance ? 'not-allowed' : 'pointer', padding: 4 }}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {visible.map((date, i) => {
          const slots = getSlotsCount(date)
          const isSel = selected && format(date, 'yyyy-MM-dd') === format(selected, 'yyyy-MM-dd')
          const full  = slots === 0
          return (
            <button key={i} onClick={() => !full && onSelect(date)} disabled={full}
              style={{
                background: isSel ? '#FF5C00' : '#141414',
                border: `1px solid ${isSel ? '#FF5C00' : '#252525'}`,
                borderRadius: 12, padding: '10px 4px',
                cursor: full ? 'not-allowed' : 'pointer',
                opacity: full ? 0.35 : 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                fontFamily: 'inherit',
              }}>
              <span style={{ color: isSel ? '#fff' : '#888', fontSize: 10, fontWeight: 700 }}>
                {format(date, 'EEE').toUpperCase()}
              </span>
              <span style={{ color: isSel ? '#fff' : '#fff', fontSize: 15, fontWeight: 800 }}>
                {format(date, 'd')}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, color: isSel ? 'rgba(255,255,255,0.8)' : full ? '#f87171' : '#4ade80' }}>
                {full ? '—' : `${slots}`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
export default function BookingPage() {
  const { barberSlug } = useParams()
  const navigate = useNavigate()
  const { user, userData } = useAuth()

  const [step, setStep] = useState(0)  // 0=contact, 1=service, 2=datetime, 3=confirm
  const [barber, setBarber]           = useState(null)
  const [services, setServices]       = useState([])
  const [availability, setAvailability] = useState(null)
  const [barberAppts, setBarberAppts] = useState([])
  const [loading, setLoading]         = useState(true)
  const [submitting, setSubmitting]   = useState(false)

  // Form state
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDate, setSelectedDate]       = useState(null)
  const [selectedSlot, setSelectedSlot]       = useState(null)
  const [availableSlots, setAvailableSlots]   = useState([])
  const [payMethod, setPayMethod]             = useState('cash')

  useEffect(() => {
    async function load() {
      try {
        const bSnap = await getDocs(query(collection(db, 'barbers'), where('slug', '==', barberSlug)))
        const active = bSnap.docs.find(d => d.data().isActive !== false)
        if (!active) { navigate(`/b/${barberSlug}`); return }
        const bd = { id: active.id, ...active.data() }
        setBarber(bd)

        const [sSnap, aSnap, apptSnap] = await Promise.all([
          getDocs(query(collection(db, 'services'), where('barberId', '==', bd.id))),
          getDocs(query(collection(db, 'availability'), where('barberId', '==', bd.id))),
          getDocs(query(collection(db, 'appointments'), where('barberId', '==', bd.id))),
        ])
        setServices(sSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.isActive !== false))
        if (!aSnap.empty) setAvailability(aSnap.docs[0].data())
        setBarberAppts(apptSnap.docs.map(d => d.data()))
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()

    // Prefill if logged in
    if (user && userData) {
      setName(`${userData.firstName || ''} ${userData.lastName || ''}`.trim())
      setEmail(userData.email || user.email || '')
      setPhone(userData.phone || '')
    }
  }, [barberSlug])

  // Compute slots when date or service changes
  useEffect(() => {
    if (!selectedDate || !selectedService || !availability) { setAvailableSlots([]); return }
    const dayIdx = selectedDate.getDay()
    const ds = availability.schedule?.[dayIdx] || {
      enabled: (availability.workingDays || [1,2,3,4,5,6]).includes(dayIdx),
      startTime: availability.startTime || '09:00',
      endTime:   availability.endTime   || '18:00',
      breaks:    availability.breaks    || [],
    }
    if (!ds.enabled) { setAvailableSlots([]); return }
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const existing = barberAppts
      .filter(a => a.date === dateStr && a.bookingStatus !== 'cancelled')
      .map(a => ({ startTime: a.startTime, endTime: a.endTime }))
    setAvailableSlots(generateTimeSlots(ds.startTime, ds.endTime, selectedService.duration, ds.breaks || [], existing))
    setSelectedSlot(null)
  }, [selectedDate, selectedService, availability, barberAppts])

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'appointments'), {
        barberId:      barber.id,
        barberName:    barber.name,
        barberSlug,
        clientId:      user?.uid || null,
        clientName:    name.trim(),
        clientEmail:   email.trim(),
        clientPhone:   phone.trim(),
        isGuest:       !user,
        services:      [{ id: selectedService.id, name: selectedService.name, price: selectedService.price, duration: selectedService.duration }],
        date:          format(selectedDate, 'yyyy-MM-dd'),
        startTime:     selectedSlot.startTime,
        endTime:       selectedSlot.endTime,
        totalDuration: selectedService.duration,
        totalPrice:    selectedService.price,
        paymentMethod: payMethod,
        paymentStatus: 'pending',
        bookingStatus: 'confirmed',
        createdAt:     serverTimestamp(),
      })
      navigate(`/b/${barberSlug}/confirmed?name=${encodeURIComponent(name)}&date=${format(selectedDate, 'yyyy-MM-dd')}&time=${selectedSlot.startTime}`)
    } catch (e) { console.error(e); toast.error('Something went wrong') }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#666' }}>Loading...</p>
    </div>
  )

  const combos  = services.filter(sv => sv.serviceType === 'combo')
  const singles = services.filter(sv => sv.serviceType === 'single')
  const extras  = services.filter(sv => sv.serviceType === 'extra')
  const TOTAL_STEPS = 4

  function canNext() {
    if (step === 0) return name.trim().length > 0 && (email.trim().length > 0 || phone.trim().length > 0)
    if (step === 1) return !!selectedService
    if (step === 2) return !!selectedDate && !!selectedSlot
    return true
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.back} onClick={() => step > 0 ? setStep(step - 1) : navigate(`/b/${barberSlug}`)}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#fff', fontWeight: 800, fontSize: 15, margin: 0 }}>{barber?.name}</p>
        </div>
        <StepDots step={step} total={TOTAL_STEPS} />
      </div>

      <div style={s.body}>

        {/* ── STEP 0: Contact info ── */}
        {step === 0 && (
          <div>
            <h2 style={s.h2}>Your info</h2>
            <p style={s.sub}>
              {user ? 'Confirm your details below.' : 'No account needed. Just enter your info.'}
            </p>

            {user && (
              <div style={{ ...s.card, cursor: 'default', marginBottom: 16, background: '#0d1f0d', borderColor: '#1a5c1a' }}>
                <p style={{ color: '#4ade80', fontWeight: 700, margin: '0 0 2px', fontSize: 14 }}>Signed in ✓</p>
                <p style={{ color: '#666', fontSize: 13, margin: 0 }}>Your info is prefilled from your account.</p>
              </div>
            )}

            <div style={s.section}>
              <label style={s.label}>NAME *</label>
              <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
            </div>

            <div style={s.section}>
              <label style={s.label}>EMAIL</label>
              <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
            </div>

            <div style={s.section}>
              <label style={s.label}>PHONE</label>
              <input style={s.input} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(315) 000-0000" />
            </div>

            <p style={{ color: '#555', fontSize: 12, textAlign: 'center' }}>* Email or phone required</p>
          </div>
        )}

        {/* ── STEP 1: Select service ── */}
        {step === 1 && (
          <div>
            <h2 style={s.h2}>Choose a service</h2>
            <p style={s.sub}>Select one service to book.</p>

            {combos.length > 0 && (
              <div style={s.section}>
                <label style={s.label}>🔥 COMBOS</label>
                {combos.map(sv => (
                  <ServiceRow key={sv.id} svc={sv} selected={selectedService?.id === sv.id} onClick={() => setSelectedService(sv)} />
                ))}
              </div>
            )}

            {singles.length > 0 && (
              <div style={s.section}>
                <label style={s.label}>✂️ SERVICES</label>
                {singles.map(sv => (
                  <ServiceRow key={sv.id} svc={sv} selected={selectedService?.id === sv.id} onClick={() => setSelectedService(sv)} />
                ))}
              </div>
            )}

            {extras.length > 0 && (
              <div style={s.section}>
                <label style={s.label}>➕ ADD-ONS</label>
                {extras.map(sv => (
                  <ServiceRow key={sv.id} svc={sv} selected={selectedService?.id === sv.id} onClick={() => setSelectedService(sv)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Date & time ── */}
        {step === 2 && (
          <div>
            <h2 style={s.h2}>Pick a date</h2>
            <p style={s.sub}>Numbers show available slots for {formatDuration(selectedService?.duration || 0)}.</p>

            <div style={{ marginBottom: 24 }}>
              <SimpleCalendar
                availability={availability}
                barberAppts={barberAppts}
                duration={selectedService?.duration || 30}
                selected={selectedDate}
                onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null) }}
              />
            </div>

            {selectedDate && (
              <div>
                <label style={{ ...s.label, marginBottom: 12 }}>
                  {format(selectedDate, 'EEEE, MMMM d').toUpperCase()}
                </label>

                {availableSlots.length === 0 ? (
                  <p style={s.muted}>No available times this day.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {availableSlots.map(slot => (
                      <button key={slot.startTime} onClick={() => setSelectedSlot(slot)}
                        style={{
                          padding: '12px 4px', borderRadius: 10, fontFamily: 'inherit',
                          border: `1.5px solid ${selectedSlot?.startTime === slot.startTime ? '#FF5C00' : '#252525'}`,
                          background: selectedSlot?.startTime === slot.startTime ? '#FF5C00' : '#141414',
                          color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        }}>
                        {slot.startTime}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 3 && (
          <div>
            <h2 style={s.h2}>Confirm booking</h2>
            <p style={s.sub}>Review your details before confirming.</p>

            <div style={{ ...s.card, cursor: 'default', marginBottom: 16 }}>
              <div style={s.row}><span style={s.muted}>Name</span><span style={{ color: '#fff', fontWeight: 600 }}>{name}</span></div>
              {email && <div style={s.row}><span style={s.muted}>Email</span><span style={{ color: '#fff', fontWeight: 600 }}>{email}</span></div>}
              {phone && <div style={s.row}><span style={s.muted}>Phone</span><span style={{ color: '#fff', fontWeight: 600 }}>{phone}</span></div>}
              <div style={s.row}><span style={s.muted}>Service</span><span style={{ color: '#fff', fontWeight: 600 }}>{selectedService?.name}</span></div>
              <div style={s.row}><span style={s.muted}>Date</span><span style={{ color: '#fff', fontWeight: 600 }}>{selectedDate && format(selectedDate, 'EEE, MMM d')}</span></div>
              <div style={s.row}><span style={s.muted}>Time</span><span style={{ color: '#fff', fontWeight: 600 }}>{selectedSlot?.startTime} – {selectedSlot?.endTime}</span></div>
              <div style={{ ...s.row, border: 'none', paddingBottom: 0 }}>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Total</span>
                <span style={{ color: '#FF5C00', fontWeight: 900, fontSize: 18 }}>{formatCurrency(selectedService?.price)}</span>
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={s.label}>PAYMENT METHOD</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['cash', 'Cash'], ['card', 'Card'], ['zelle', 'Zelle']].map(([id, label]) => (
                  <button key={id} onClick={() => setPayMethod(id)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 10, fontFamily: 'inherit',
                      border: `1.5px solid ${payMethod === id ? '#FF5C00' : '#252525'}`,
                      background: payMethod === id ? '#FF5C0020' : '#141414',
                      color: payMethod === id ? '#FF5C00' : '#888',
                      fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom button */}
      <div style={{ ...s.bottom, maxWidth: 480, left: '50%', transform: 'translateX(-50%)', right: 'auto', width: '100%' }}>
        {step < 3 ? (
          <button style={{ ...s.primary, opacity: canNext() ? 1 : 0.5 }} onClick={() => canNext() && setStep(step + 1)}>
            Continue
          </button>
        ) : (
          <button style={{ ...s.primary, opacity: submitting ? 0.6 : 1 }} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Booking...' : 'Confirm Booking'}
            {!submitting && <Check size={18} />}
          </button>
        )}
      </div>

      <style>{`* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; } input:focus { border-color: #FF5C00 !important; } input::placeholder { color: #333; } button { touch-action: manipulation; }`}</style>
    </div>
  )
}

function ServiceRow({ svc, selected, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', background: selected ? '#FF5C0015' : '#141414',
        border: `1.5px solid ${selected ? '#FF5C00' : '#252525'}`,
        borderRadius: 12, padding: '14px 16px', marginBottom: 8,
        cursor: 'pointer', fontFamily: 'inherit',
      }}>
      <div style={{ textAlign: 'left' }}>
        <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: '0 0 3px' }}>{svc.name}</p>
        <p style={{ color: '#666', fontSize: 12, margin: 0 }}>{formatDuration(svc.duration)}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: '#FF5C00', fontWeight: 800, fontSize: 16 }}>{formatCurrency(svc.price)}</span>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', border: `2px solid ${selected ? '#FF5C00' : '#333'}`,
          background: selected ? '#FF5C00' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {selected && <Check size={12} color="white" />}
        </div>
      </div>
    </button>
  )
}
