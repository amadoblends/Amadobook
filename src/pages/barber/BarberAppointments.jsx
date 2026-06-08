/**
 * BarberAppointments — Migrated to Design System
 * ✓ CSS Variables for Light/Dark mode
 * ✓ "New" button opens walk-in modal (same as Dashboard)
 * ✓ No navigation to calendar for new appts
 * ✓ Client list redesigned, no floating "New" button
 */
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { format, isToday, isTomorrow, startOfDay, addDays, isSameDay } from 'date-fns'
import { useBarberData } from '../../hooks/useBarberData'
import { formatCurrency, formatDuration, generateTimeSlots } from '../../utils/helpers'
import { useTheme } from '../../context/ThemeContext'
import BarberLayout from '../../components/layout/BarberLayout'
import { Search, Plus, ChevronRight, X, Scissors, User, Check, ChevronLeft, CalendarPlus } from 'lucide-react'
import toast from 'react-hot-toast'

const F = { fontFamily: "'Plus Jakarta Sans','DM Sans',system-ui,sans-serif" }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
.fu{animation:fadeUp 0.2s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
input{font-size:16px!important}
`

const STATUS = {
  confirmed: { bg: 'var(--green-soft)', c: 'var(--green)', l: 'Confirmed' },
  pending: { bg: 'var(--accent-soft)', c: 'var(--accent)', l: 'Pending' },
  completed: { bg: 'var(--card3)', c: 'var(--text-sec)', l: 'Done' },
  cancelled: { bg: 'var(--red-soft)', c: 'var(--red)', l: 'Cancelled' },
}

function parseD(s) { if(!s)return new Date(); const[y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d) }

function StatusBadge({ status, isWalkIn }) {
  if (isWalkIn && status !== 'cancelled' && status !== 'completed')
    return <span style={{ background: 'var(--purple-soft)', color: 'var(--purple)', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 20, whiteSpace: 'nowrap' }}>Walk-in</span>
  
  const s = STATUS[status] || STATUS.pending
  return <span style={{ background: s.bg, color: s.c, fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 20, whiteSpace: 'nowrap' }}>{s.l}</span>
}

function Avatar({ name, photoURL, size = 36, fontSize = 11 }) {
  const i = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: 'var(--card2)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize, color: 'var(--text-sec)', flexShrink: 0 }}>
      {photoURL ? <img src={photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : i}
    </div>
  )
}

// ── New Appt Modal (same flow as dashboard) ──────────────────────────────────
function NewApptModal({ onClose, barber, activeServices, availability, appointments }) {
  const [mode, setMode] = useState(null)
  const [step, setStep] = useState(1)
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [email, setEmail] = useState(''), [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [selSvc, setSelSvc] = useState(null)
  const [selDate, setSelDate] = useState(new Date()), [selSlot, setSelSlot] = useState(null)
  const [weekOff, setWeekOff] = useState(0), [saving, setSaving] = useState(false)

  const today = startOfDay(new Date()), advance = availability?.advanceDays || 30
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(today, weekOff * 7 + i)).filter(d => d <= addDays(today, advance))

  // Build client list from appointments
  const clients = useMemo(() => {
    const map = {}
    appointments.forEach(a => {
      const key = a.clientId || a.clientEmail || a.clientName; if (!key) return
      if (!map[key]) map[key] = { id: key, clientId: a.clientId, name: a.clientName, email: a.clientEmail, phone: a.clientPhone, visits: 0, services: {} }
      map[key].visits++; a.services?.forEach(s => { map[key].services[s.name] = (map[key].services[s.name] || 0) + 1 })
    })
    return Object.values(map).sort((a, b) => b.visits - a.visits)
  }, [appointments])

  const filteredClients = clients.filter(c => {
    const s = search.toLowerCase()
    return c.name?.toLowerCase().includes(s) || c.phone?.includes(s)
  }).slice(0, 8)

  const [selClient, setSelClient] = useState(null)

  const slots = useMemo(() => {
    if (!selSvc || !selDate || !availability) return []
    const di = selDate.getDay()
    const ds = availability.schedule?.[di] || { enabled: true, startTime: '09:00', endTime: '18:00', breaks: [] }
    if (!ds.enabled) return []
    const dateStr = format(selDate, 'yyyy-MM-dd')
    const existing = appointments.filter(a => a.date === dateStr && a.bookingStatus !== 'cancelled').map(a => ({ startTime: a.startTime, endTime: a.endTime }))
    let sl = generateTimeSlots(ds.startTime, ds.endTime, selSvc.duration, ds.breaks || [], existing)
    if (isToday(selDate)) { const nm = new Date().getHours() * 60 + new Date().getMinutes(); sl = sl.filter(s => { const [h, m] = s.startTime.split(':').map(Number); return h * 60 + m > nm }) }
    return sl
  }, [selSvc, selDate, availability, appointments])

  function isDayOff(date) {
    if (date < today || date > addDays(today, advance)) return true
    const di = date.getDay()
    const ds = availability?.schedule?.[di]
    return (ds && !ds.enabled) || (availability?.blockedDates?.includes(format(date, 'yyyy-MM-dd')))
  }

  async function create() {
    if (!selSvc || !selSlot) return
    setSaving(true)
    try {
      const clientName = mode === 'existing' && selClient ? selClient.name : name.trim()
      const clientPhone = mode === 'existing' && selClient ? selClient.phone || '' : phone.trim()
      const clientId = mode === 'existing' && selClient ? selClient.clientId || null : null
      await addDoc(collection(db, 'appointments'), {
        barberId: barber.id, barberName: barber.name,
        clientId, clientName, clientPhone, clientEmail: email.trim() || null,
        isGuest: !clientId, isWalkIn: true,
        services: [{ id: selSvc.id, name: selSvc.name, price: selSvc.price, duration: selSvc.duration }],
        date: format(selDate, 'yyyy-MM-dd'), startTime: selSlot.startTime, endTime: selSlot.endTime,
        totalDuration: selSvc.duration, totalPrice: selSvc.price,
        paymentMethod: 'cash', paymentStatus: 'pending', bookingStatus: 'confirmed',
        notes: notes.trim() || null, createdAt: serverTimestamp(),
      })
      toast.success('Appointment created ✂️'); onClose()
    } catch { toast.error('Could not create') }
    finally { setSaving(false) }
  }

  const canNext = !mode ? false : step === 1 ? (mode === 'walkin' ? name.trim().length > 0 : !!selClient) : step === 2 ? !!selSvc : !!selSlot
  const stepLabel = !mode ? 'Choose Type' : step === 1 ? (mode === 'walkin' ? 'Client Info' : 'Select Client') : step === 2 ? 'Service' : 'Date & Time'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'fadeIn 0.15s ease' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', maxHeight: '88dvh', overflowY: 'auto', animation: 'slideUp 0.2s ease', ...F }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {mode && <button onClick={() => { if (step > 1) setStep(s => s - 1); else setMode(null) }} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', display: 'flex', padding: 0 }}><ChevronLeft size={17} /></button>}
            <div>
              <p style={{ color: 'var(--text-pri)', fontWeight: 700, fontSize: 14, margin: '0 0 2px' }}>{stepLabel}</p>
              {mode && <div style={{ display: 'flex', gap: 4 }}>{[1, 2, 3].map(s => <div key={s} style={{ width: s === step ? 12 : 4, height: 4, borderRadius: 2, background: s <= step ? 'var(--accent)' : 'var(--border)', transition: 'all 0.2s' }} />)}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 6px', color: 'var(--text-sec)', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
        </div>

        <div style={{ padding: '13px 15px 20px' }}>
          {/* Mode selector */}
          {!mode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ color: 'var(--text-sec)', fontSize: 12, margin: '0 0 6px', textAlign: 'center' }}>How do you want to add this appointment?</p>
              <button onClick={() => { setMode('walkin'); setStep(1) }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 12, background: 'var(--purple-soft)', border: '1.5px solid var(--purple)', cursor: 'pointer', textAlign: 'left', ...F, width: '100%' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={17} color="var(--purple)" /></div>
                <div><p style={{ color: 'var(--text-pri)', fontWeight: 700, fontSize: 13, margin: '0 0 2px' }}>Walk-in / New Client</p><p style={{ color: 'var(--text-sec)', fontSize: 11, margin: 0 }}>Enter client info manually</p></div>
              </button>
              <button onClick={() => { setMode('existing'); setStep(1) }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 12, background: 'var(--accent-soft)', border: '1.5px solid var(--accent)', cursor: 'pointer', textAlign: 'left', ...F, width: '100%' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><User size={17} color="var(--accent)" /></div>
                <div><p style={{ color: 'var(--text-pri)', fontWeight: 700, fontSize: 13, margin: '0 0 2px' }}>Existing Client</p><p style={{ color: 'var(--text-sec)', fontSize: 11, margin: 0 }}>Pick from your client history</p></div>
              </button>
            </div>
          )}

          {/* Walk-in info */}
          {mode === 'walkin' && step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[{ l: 'Name *', v: name, s: setName, t: 'text', p: 'Client name' }, { l: 'Phone', v: phone, s: setPhone, t: 'tel', p: '(305) 000-0000' }, { l: 'Email', v: email, s: setEmail, t: 'email', p: 'optional' }].map(f => (
                <div key={f.l}>
                  <label style={{ display: 'block', color: 'var(--text-ter)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>{f.l.toUpperCase()}</label>
                  <input type={f.t} value={f.v} onChange={e => f.s(e.target.value)} placeholder={f.p}
                    style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 11px', color: 'var(--text-pri)', fontSize: 14, outline: 'none', ...F }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', color: 'var(--text-ter)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>NOTES</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Style notes…" rows={2}
                  style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 11px', color: 'var(--text-pri)', fontSize: 13, outline: 'none', resize: 'none', ...F }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'} onBlur={e => e.target.style.borderColor = 'var(--border)'}/>
              </div>
            </div>
          )}

          {/* Existing client search */}
          {mode === 'existing' && step === 1 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px', marginBottom: 10 }}>
                <Search size={13} color="var(--text-ter)" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone…" autoFocus
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-pri)', fontSize: 14, ...F }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredClients.length === 0 ? <p style={{ color: 'var(--text-sec)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>No clients found</p>
                  : filteredClients.map(c => {
                    const sel = selClient?.id === c.id
                    const topSvc = Object.entries(c.services || {}).sort((a, b) => b[1] - a[1])[0]?.[0]
                    return (
                      <button key={c.id} onClick={() => setSelClient(c)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11, background: sel ? 'var(--accent-soft)' : 'var(--card2)', border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', textAlign: 'left', ...F, width: '100%' }}>
                        <Avatar name={c.name} size={32} fontSize={10} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: 'var(--text-pri)', fontWeight: 700, fontSize: 13, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                          <p style={{ color: 'var(--text-sec)', fontSize: 10, margin: 0 }}>{c.visits} visit{c.visits !== 1 ? 's' : ''}{topSvc ? ` · Fav: ${topSvc}` : ''}</p>
                        </div>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {sel && <Check size={9} color="#fff" />}
                        </div>
                      </button>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Service selection */}
          {mode && step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {activeServices.map(svc => {
                const sel = selSvc?.id === svc.id
                return (
                  <button key={svc.id} onClick={() => setSelSvc(svc)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11, background: sel ? 'var(--accent-soft)' : 'var(--card2)', border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', textAlign: 'left', ...F, width: '100%' }}>
                    <Scissors size={14} color={sel ? 'var(--accent)' : 'var(--text-ter)'} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: 'var(--text-pri)', fontWeight: 700, fontSize: 13, margin: '0 0 1px' }}>{svc.name}</p>
                      <p style={{ color: 'var(--text-sec)', fontSize: 11, margin: 0 }}>{formatDuration(svc.duration)}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 13 }}>{formatCurrency(svc.price)}</span>
                      <div style={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {sel && <Check size={8} color="#fff" />}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Date & Time */}
          {mode && step === 3 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                <button onClick={() => { setWeekOff(w => Math.max(0, w - 1)); setSelSlot(null) }} disabled={weekOff === 0}
                  style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: weekOff === 0 ? 'not-allowed' : 'pointer', opacity: weekOff === 0 ? 0.3 : 1, color: 'var(--text-pri)' }}>
                  <ChevronLeft size={13} />
                </button>
                <span style={{ color: 'var(--text-sec)', fontSize: 11, fontWeight: 600 }}>{weekDays[0] && format(weekDays[0], 'MMM d')} – {weekDays[weekDays.length - 1] && format(weekDays[weekDays.length - 1], 'MMM d')}</span>
                <button onClick={() => { setWeekOff(w => w + 1); setSelSlot(null) }} disabled={weekDays.length < 7}
                  style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: weekDays.length < 7 ? 'not-allowed' : 'pointer', opacity: weekDays.length < 7 ? 0.3 : 1, color: 'var(--text-pri)' }}>
                  <ChevronRight size={13} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weekDays.length},1fr)`, gap: 4, marginBottom: 12 }}>
                {weekDays.map((date, i) => {
                  const disabled = isDayOff(date), sel = isSameDay(date, selDate)
                  return (
                    <button key={i} onClick={() => { if (!disabled) { setSelDate(date); setSelSlot(null) } }} disabled={disabled}
                      style={{ padding: '7px 2px', borderRadius: 9, border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--accent)' : 'var(--card2)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.2 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ color: sel ? 'rgba(255,255,255,0.7)' : 'var(--text-ter)', fontSize: 8, fontWeight: 700 }}>{format(date, 'EEE').toUpperCase()}</span>
                      <span style={{ color: sel ? '#fff' : isToday(date) ? 'var(--accent)' : 'var(--text-pri)', fontSize: 13, fontWeight: 800 }}>{format(date, 'd')}</span>
                    </button>
                  )
                })}
              </div>
              <p style={{ color: 'var(--text-ter)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>{format(selDate, 'EEE, MMM d').toUpperCase()}</p>
              {slots.length === 0 ? <p style={{ color: 'var(--text-sec)', fontSize: 12, textAlign: 'center', padding: '10px 0' }}>No available times</p>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, marginBottom: 10 }}>
                  {slots.map(slot => {
                    const sel = selSlot?.startTime === slot.startTime
                    return <button key={slot.startTime} onClick={() => setSelSlot(slot)}
                      style={{ padding: '9px 3px', borderRadius: 9, border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--accent)' : 'var(--card2)', color: sel ? '#fff' : 'var(--text-sec)', fontWeight: 700, fontSize: 11, cursor: 'pointer', ...F }}>
                      {slot.startTime}
                    </button>
                  })}
                </div>}
              {selSlot && <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 9, padding: '9px 11px' }}>
                <p style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 12, margin: 0 }}>{format(selDate, 'MMM d')} · {selSlot.startTime}–{selSlot.endTime}</p>
                <p style={{ color: 'var(--text-sec)', fontSize: 10, margin: '2px 0 0' }}>{selSvc?.name} · {formatCurrency(selSvc?.price)}</p>
              </div>}
            </div>
          )}

          {mode && (
            <button onClick={step < 3 ? () => canNext && setStep(s => s + 1) : create} disabled={!canNext || saving}
              style={{ width: '100%', marginTop: 14, background: canNext ? 'var(--accent)' : 'var(--border)', border: 'none', borderRadius: 20, padding: '13px', color: canNext ? '#fff' : 'var(--text-ter)', fontWeight: 700, fontSize: 14, cursor: canNext ? 'pointer' : 'not-allowed', ...F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: canNext ? 'var(--shadow-accent)' : 'none' }}>
              {saving && <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />}
              {step < 3 ? 'Continue →' : saving ? 'Booking…' : '✓ Confirm'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Appt card ─────────────────────────────────────────────────────────────────
function ApptCard({ appt, onClick, formatTime }) {
  const s = STATUS[appt.bookingStatus] || STATUS.pending
  return (
    <button onClick={onClick} className="fu"
      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', ...F, background: appt.isWalkIn ? 'var(--purple-soft)' : 'var(--card)', border: `1px solid ${appt.isWalkIn ? 'var(--purple)' : 'var(--border)'}`, borderLeft: `3px solid ${appt.isWalkIn ? 'var(--purple)' : s.c}`, borderRadius: 12, padding: '10px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.12s', boxShadow: 'var(--shadow-sm)' }}>
      <Avatar name={appt.clientName} photoURL={appt.clientPhotoURL} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          <p style={{ color: 'var(--text-pri)', fontWeight: 700, fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.clientName}</p>
          {appt.isWalkIn && <span style={{ background: 'var(--purple-soft)', color: 'var(--purple)', fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 8, flexShrink: 0 }}>W</span>}
        </div>
        <p style={{ color: 'var(--text-sec)', fontSize: 11, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.services?.map(s => s.name).join(', ')}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-ter)', fontSize: 10 }}>{isToday(parseD(appt.date)) ? 'Today' : isTomorrow(parseD(appt.date)) ? 'Tomorrow' : format(parseD(appt.date), 'MMM d, yyyy')}</span>
          <span style={{ color: 'var(--text-ter)', fontSize: 10 }}>·</span>
          <span style={{ color: 'var(--text-ter)', fontSize: 10 }}>{formatTime ? formatTime(appt.startTime) : appt.startTime}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <p style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 13, margin: 0 }}>{formatCurrency(appt.totalWithTip || appt.totalPrice)}</p>
        <StatusBadge status={appt.bookingStatus} isWalkIn={appt.isWalkIn} />
      </div>
      <ChevronRight size={13} color="var(--text-ter)" style={{ flexShrink: 0 }} />
    </button>
  )
}

function DateGroup({ dateStr, children }) {
  const d = parseD(dateStr)
  let label = format(d, 'MMMM d, yyyy')
  if (isToday(d)) label = `Today · ${format(d, 'MMM d')}`
  if (isTomorrow(d)) label = `Tomorrow · ${format(d, 'MMM d')}`
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ color: 'var(--text-ter)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6, paddingLeft: 2 }}>{label.toUpperCase()}</p>
      {children}
    </div>
  )
}

export default function BarberAppointments() {
  const { appointments, loading, today, barber, activeServices, availability } = useBarberData()
  const { formatTime } = useTheme()
  const navigate = useNavigate()
  const [tab, setTab] = useState('upcoming')
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)

  const filtered = useMemo(() => {
    let list = []
    if (tab === 'upcoming') {
      list = appointments.filter(a => a.bookingStatus !== 'cancelled' && a.bookingStatus !== 'completed' && a.date >= today)
      list.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    } else if (tab === 'past') {
      list = appointments.filter(a => a.bookingStatus === 'completed' || (a.date < today && a.bookingStatus !== 'cancelled'))
      list.sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
    } else {
      list = appointments.filter(a => a.bookingStatus === 'cancelled')
      list.sort((a, b) => b.date.localeCompare(a.date))
    }
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(a => a.clientName?.toLowerCase().includes(s) || a.services?.some(sv => sv.name?.toLowerCase().includes(s)))
    }
    return list
  }, [appointments, tab, today, search])

  const grouped = useMemo(() => {
    if (tab !== 'upcoming') return null
    const map = {}
    filtered.forEach(a => { if (!map[a.date]) map[a.date] = []; map[a.date].push(a) })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered, tab])

  const TABS = [
    { key: 'upcoming', label: 'Upcoming', count: appointments.filter(a => a.bookingStatus !== 'cancelled' && a.bookingStatus !== 'completed' && a.date >= today).length },
    { key: 'past', label: 'Past', count: appointments.filter(a => a.bookingStatus === 'completed' || (a.date < today && a.bookingStatus !== 'cancelled')).length },
    { key: 'cancelled', label: 'Cancelled', count: appointments.filter(a => a.bookingStatus === 'cancelled').length },
  ]

  if (loading) return (
    <BarberLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ width: 22, height: 22, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.65s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </BarberLayout>
  )

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{ background: 'var(--bg)', minHeight: '100%', paddingBottom: 16, ...F }}>
        <div style={{ padding: '12px 14px', maxWidth: 540, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h1 style={{ color: 'var(--text-pri)', fontWeight: 800, fontSize: 18, margin: 0, letterSpacing: '-0.3px' }}>Appointments</h1>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowSearch(p => !p)}
                style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 7px', color: showSearch ? 'var(--accent)' : 'var(--text-sec)', cursor: 'pointer', display: 'flex' }}>
                <Search size={15} />
              </button>
              {/* ✅ Opens modal — same flow as dashboard */}
              <button onClick={() => setShowNewModal(true)}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 12, ...F, boxShadow: 'var(--shadow-accent)' }}>
                <CalendarPlus size={13} /> New
              </button>
            </div>
          </div>

          {/* Search */}
          {showSearch && (
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', boxShadow: 'var(--shadow-sm)' }}>
              <Search size={13} color="var(--text-ter)" />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client or service…"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-pri)', fontSize: 14, ...F }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'var(--text-ter)', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={13} /></button>}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 3, boxShadow: 'var(--shadow-sm)' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', cursor: 'pointer', background: tab === t.key ? 'var(--accent)' : 'transparent', color: tab === t.key ? '#fff' : 'var(--text-sec)', fontWeight: 700, fontSize: 11, ...F, transition: 'all 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {t.label}
                {t.count > 0 && <span style={{ background: tab === t.key ? 'rgba(255,255,255,0.25)' : 'var(--card2)', color: tab === t.key ? '#fff' : 'var(--text-ter)', fontSize: 9, fontWeight: 800, borderRadius: 8, padding: '1px 5px' }}>{t.count}</span>}
              </button>
            ))}
          </div>

          {/* Content */}
          {filtered.length === 0 ? (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '32px 16px', textAlign: 'center', boxShadow: 'var(--shadow)' }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>{tab === 'upcoming' ? '📅' : tab === 'past' ? '✅' : '❌'}</div>
              <p style={{ color: 'var(--text-sec)', fontWeight: 600, fontSize: 13, margin: '0 0 4px' }}>{search ? 'No results' : tab === 'upcoming' ? 'No upcoming appointments' : tab === 'past' ? 'No past appointments' : 'No cancelled'}</p>
              {tab === 'upcoming' && !search && (
                <button onClick={() => setShowNewModal(true)}
                  style={{ marginTop: 12, background: 'var(--accent)', border: 'none', borderRadius: 20, padding: '9px 20px', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', boxShadow: 'var(--shadow-accent)', ...F }}>
                  + New Appointment
                </button>
              )}
            </div>
          ) : tab === 'upcoming' && grouped ? (
            grouped.map(([dateStr, appts]) => (
              <DateGroup key={dateStr} dateStr={dateStr}>
                {appts.map(a => (
                  <ApptCard key={a.id} appt={a} formatTime={formatTime}
                    onClick={() => navigate('/barber/calendar', { state: { selectedId: a.id } })} />
                ))}
              </DateGroup>
            ))
          ) : (
            filtered.map(a => (
              <ApptCard key={a.id} appt={a} formatTime={formatTime}
                onClick={() => navigate('/barber/calendar', { state: { selectedId: a.id } })} />
            ))
          )}
        </div>
      </div>

      {showNewModal && barber && (
        <NewApptModal
          onClose={() => setShowNewModal(false)}
          barber={barber}
          activeServices={activeServices}
          availability={availability}
          appointments={appointments}
        />
      )}
    </BarberLayout>
  )
}