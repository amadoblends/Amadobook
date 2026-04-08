import { useEffect, useState, useRef } from 'react'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration, parseLocalDate } from '../../utils/helpers'
import { format, isFuture, isPast, differenceInDays, subMonths, eachMonthOfInterval } from 'date-fns'
import toast from 'react-hot-toast'
import { useNavigate, useParams } from 'react-router-dom'
import { Scissors, Calendar, History, User, X, Navigation, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { generateTimeSlots } from '../../utils/helpers'
import { addDays, startOfDay, isToday, isSameDay } from 'date-fns'

const F = { fontFamily: 'Monda, sans-serif' }
const SC = { pending: '#fbbf24', confirmed: '#4ade80', completed: '#60a5fa', cancelled: '#f87171' }

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return { text: 'Good morning', emoji: '☀️' }
  if (h < 17) return { text: 'Good afternoon', emoji: '👋' }
  return { text: 'Good evening', emoji: '🌙' }
}

const TABS = [
  { id: 'home',     icon: Scissors, label: 'Home'     },
  { id: 'bookings', icon: Calendar, label: 'Bookings' },
  { id: 'history',  icon: History,  label: 'History'  },
  { id: 'profile',  icon: User,     label: 'Profile'  },
]

export default function ClientDashboard() {
  const { barberSlug } = useParams()
  const { user, userData, signOut, refreshUserData } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab]             = useState('home')
  const [appointments, setAppointments] = useState([])
  const [barberInfo, setBarberInfo]     = useState(null)
  const [availability, setAvailability] = useState(null)
  const [barberAppts, setBarberAppts]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [reschedAppt, setReschedAppt]     = useState(null)
  const [confirmResched, setConfirmResched] = useState(false)
  const [reschedDate, setReschedDate]   = useState(null)
  const [reschedSlot, setReschedSlot]   = useState(null)
  const [reschedSlots, setReschedSlots] = useState([])
  const [reschedNote, setReschedNote]   = useState('')
  const [reschedPage, setReschedPage]   = useState(0)
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', photoURL: '' })
  const [saving, setSaving] = useState(false)
  const refreshRef = useRef(null)

  useEffect(() => {
    if (!user) { navigate(`/b/${barberSlug}/auth`); return }
    if (userData) setForm({ firstName: userData.firstName || '', lastName: userData.lastName || '', phone: userData.phone || '', photoURL: userData.photoURL || '' })
  }, [user, userData])

  async function loadAppts() {
    if (!user) return
    const snap = await getDocs(query(collection(db, 'appointments'), where('clientId', '==', user.uid)))
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    setAppointments(all)
    setLoading(false)
    if (all.length > 0 && !barberInfo) {
      const bSnap = await getDocs(query(collection(db, 'barbers'), where('slug', '==', barberSlug)))
      if (!bSnap.empty) {
        const b = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() }
        setBarberInfo(b)
        const aSnap = await getDocs(query(collection(db, 'availability'), where('barberId', '==', b.id)))
        if (!aSnap.empty) setAvailability(aSnap.docs[0].data())
        const apptSnap = await getDocs(query(collection(db, 'appointments'), where('barberId', '==', b.id)))
        setBarberAppts(apptSnap.docs.map(d => d.data()))
      }
    }
  }

  useEffect(() => {
    loadAppts()
    refreshRef.current = setInterval(loadAppts, 20000)
    return () => clearInterval(refreshRef.current)
  }, [user])

  // Compute reschedule slots
  useEffect(() => {
    if (!reschedDate || !reschedAppt || !availability) { setReschedSlots([]); return }
    const dayIdx = reschedDate.getDay()
    const ds = availability.schedule?.[dayIdx] || {
      enabled: (availability.workingDays || [1,2,3,4,5,6]).includes(dayIdx),
      startTime: availability.startTime || '09:00',
      endTime: availability.endTime || '18:00',
      breaks: availability.breaks || [],
    }
    if (!ds.enabled) { setReschedSlots([]); return }
    const dateStr = format(reschedDate, 'yyyy-MM-dd')
    const existing = barberAppts
      .filter(a => a.date === dateStr && a.bookingStatus !== 'cancelled' && a.id !== reschedAppt.id)
      .map(a => ({ startTime: a.startTime, endTime: a.endTime }))
    let slots = generateTimeSlots(ds.startTime, ds.endTime, reschedAppt.totalDuration || 30, ds.breaks || [], existing)
    if (isToday(reschedDate)) {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
      slots = slots.filter(sl => { const [h, m] = sl.startTime.split(':').map(Number); return h * 60 + m > nowMin + 15 })
    }
    setReschedSlots(slots)
    setReschedSlot(null)
  }, [reschedDate, reschedAppt, availability, barberAppts])

  async function handleCancel() {
    if (!cancelTarget) return
    await updateDoc(doc(db, 'appointments', cancelTarget), { bookingStatus: 'cancelled', paymentStatus: 'cancelled' })
    setAppointments(p => p.map(a => a.id === cancelTarget ? { ...a, bookingStatus: 'cancelled', paymentStatus: 'cancelled' } : a))
    toast.success('Appointment cancelled')
    setCancelTarget(null); setConfirmCancel(false)
  }

  async function handleReschedule() {
    if (!reschedSlot || !reschedDate) return
    await updateDoc(doc(db, 'appointments', reschedAppt.id), {
      date: format(reschedDate, 'yyyy-MM-dd'),
      startTime: reschedSlot.startTime,
      endTime: reschedSlot.endTime,
      rescheduleNote: reschedNote.trim() || null,
    })
    setAppointments(p => p.map(a => a.id === reschedAppt.id
      ? { ...a, date: format(reschedDate, 'yyyy-MM-dd'), startTime: reschedSlot.startTime, endTime: reschedSlot.endTime, rescheduleNote: reschedNote.trim() || null }
      : a))
    toast.success('Rescheduled!')
    setReschedAppt(null); setReschedDate(null); setReschedSlot(null); setReschedNote(''); setConfirmResched(false)
  }

  function openMaps(address) {
    if (!address) return
    const addr = encodeURIComponent(address)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    window.open(isIOS ? `maps://?q=${addr}` : `https://maps.google.com/?q=${addr}`, '_blank')
  }

  async function saveProfile() {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), form)
      await refreshUserData()
      toast.success('Profile updated!')
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  // Upcoming: future date+time, not cancelled
  // History: past date+time OR cancelled
  // Uses local time to avoid timezone date shift
  const upcoming = appointments.filter(a => {
    if (a.bookingStatus === 'cancelled') return false
    const [y, m, d] = (a.date || '').split('-').map(Number)
    const [h, mn] = (a.startTime || '00:00').split(':').map(Number)
    const apptTime = new Date(y, m - 1, d, h, mn, 0, 0)
    return apptTime > new Date()
  })
  const history = appointments.filter(a => {
    if (a.bookingStatus === 'cancelled') return true
    const [y, m, d] = (a.date || '').split('-').map(Number)
    const [h, mn] = (a.startTime || '00:00').split(':').map(Number)
    const apptTime = new Date(y, m - 1, d, h, mn, 0, 0)
    return apptTime <= new Date()
  })
  const next = upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))[0]

  // Monthly spending chart
  const months = eachMonthOfInterval({ start: subMonths(new Date(), 5), end: new Date() })
  const monthlySpend = months.map(m => {
    const key = format(m, 'yyyy-MM')
    const spent = appointments
      .filter(a => a.date?.startsWith(key) && a.paymentStatus === 'paid' && a.bookingStatus === 'completed')
      .reduce((s, a) => s + (a.totalPrice || 0), 0)
    return { label: format(m, 'MMM'), spent }
  })
  const maxSpend = Math.max(...monthlySpend.map(m => m.spent), 1)

  const totalSpent  = userData?.totalSpent  || appointments.filter(a => a.paymentStatus === 'paid').reduce((s, a) => s + (a.totalPrice || 0), 0)
  const totalVisits = userData?.totalVisits || history.filter(a => a.bookingStatus === 'completed').length

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '3px solid #FF5C00', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const { text: greetText, emoji: greetEmoji } = getGreeting()

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', ...F, paddingBottom: 80 }}>

      {/* Tab content */}
      <div style={{ padding: '20px', maxWidth: 520, margin: '0 auto' }}>

        {/* HOME */}
        {tab === 'home' && (
          <div>
            <div style={{ background: 'linear-gradient(135deg,#1a0800,#3d1500,#8B3E16)', borderRadius: 20, padding: '22px 20px', marginBottom: 14, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle,#FF5C00 1px,transparent 1px)', backgroundSize: '18px 18px' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <p style={{ color: '#FF8C00', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{greetText} {greetEmoji}</p>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, color: '#fff', fontSize: 26, lineHeight: 1.1, marginBottom: 8, textTransform: 'lowercase' }}>{userData?.firstName}!</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 14 }}>
                  {upcoming.length > 0 ? `${upcoming.length} upcoming appointment${upcoming.length !== 1 ? 's' : ''}` : 'No upcoming appointments.'}
                </p>
                <button onClick={() => navigate(`/b/${barberSlug}/book`)}
                  style={{ background: 'linear-gradient(135deg,#FF5C00,#FF9000)', border: 'none', borderRadius: 12, padding: '12px 20px', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: '0 6px 20px rgba(255,92,0,0.4)', ...F }}>
                  <Scissors size={15} /> Book Appointment
                </button>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Visits', value: totalVisits },
                { label: 'Upcoming', value: upcoming.length },
                { label: 'Spent', value: `$${(totalSpent || 0).toFixed(0)}` },
              ].map(s => (
                <div key={s.label} style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
                  <p style={{ fontFamily: 'Syne, sans-serif', color: '#FF5C00', fontSize: 20, fontWeight: 900, margin: '0 0 4px' }}>{s.value}</p>
                  <p style={{ color: '#555', fontSize: 11, fontWeight: 600, margin: 0 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Spending chart */}
            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 16, padding: '14px 16px', marginBottom: 14 }}>
              <p style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}>MONTHLY SPENDING</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
                {monthlySpend.map((m, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: '100%', borderRadius: '3px 3px 0 0',
                      background: i === monthlySpend.length - 1 ? '#FF5C00' : '#FF5C0044',
                      height: m.spent > 0 ? `${Math.max((m.spent / maxSpend) * 48, 4)}px` : '4px',
                    }} />
                    <span style={{ color: '#444', fontSize: 9, fontWeight: 700 }}>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Next appointment */}
            {next && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>NEXT APPOINTMENT</p>
                <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderLeft: '3px solid #FF5C00', borderRadius: 16, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                        {barberInfo?.photoURL && <img src={barberInfo.photoURL} style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }} alt="" />}
                        <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: 0 }}>{next.barberName}</p>
                      </div>
                      <p style={{ color: '#FF5C00', fontWeight: 600, fontSize: 13, margin: '0 0 2px' }}>
                        {format(parseLocalDate(next.date), 'EEE, MMM d')} · {next.startTime}
                      </p>
                      <p style={{ color: '#555', fontSize: 12, margin: 0 }}>{formatDuration(next.totalDuration)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontFamily: 'Syne, sans-serif', color: '#FF5C00', fontWeight: 900, fontSize: 17, margin: '0 0 4px' }}>{formatCurrency(next.totalPrice)}</p>
                      <p style={{ color: '#4ade80', fontSize: 11, fontWeight: 700 }}>
                        {differenceInDays(new Date(`${next.date}T${next.startTime}`), new Date()) === 0 ? 'Today!' : `In ${differenceInDays(new Date(`${next.date}T${next.startTime}`), new Date())} day${differenceInDays(new Date(`${next.date}T${next.startTime}`), new Date()) !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                  {next.services?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                      {next.services.map((s, i) => <span key={i} style={{ background: '#1a1a1a', color: '#777', fontSize: 11, padding: '3px 9px', borderRadius: 20, border: '1px solid #252525' }}>{s.name}</span>)}
                    </div>
                  )}
                  {barberInfo?.address && (
                    <button onClick={() => openMaps(barberInfo.address)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: '#FF5C00', fontSize: 12, cursor: 'pointer', padding: '4px 0', marginBottom: 8, ...F }}>
                      <Navigation size={12} /> {barberInfo.address} → Directions
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setReschedAppt(next); setReschedDate(null); setReschedSlot(null); setReschedNote('') }}
                      style={{ background: '#FF5C0015', border: '1px solid #FF5C0025', borderRadius: 8, padding: '7px 12px', color: '#FF8C00', fontSize: 12, fontWeight: 700, cursor: 'pointer', ...F }}>
                      Reschedule
                    </button>
                    <button onClick={() => { setCancelTarget(next.id); setConfirmCancel(true) }}
                      style={{ background: '#ef444410', border: '1px solid #ef444425', borderRadius: 8, padding: '7px 12px', color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, ...F }}>
                      <X size={10} /> Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {history.slice(0, 2).length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <p style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', margin: 0 }}>RECENT</p>
                  <button onClick={() => setTab('history')} style={{ color: '#FF5C00', fontSize: 12, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', ...F }}>See all</button>
                </div>
                {history.slice(0, 2).map(a => <MiniCard key={a.id} appt={a} />)}
              </div>
            )}
          </div>
        )}

        {/* BOOKINGS */}
        {tab === 'bookings' && (
          <div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', color: '#fff', fontSize: 22, fontWeight: 900, marginBottom: 14 }}>Upcoming</h2>
            {upcoming.length === 0
              ? <Empty icon={<Calendar size={30} />} title="No upcoming appointments" desc="Book your next cut!" action={() => navigate(`/b/${barberSlug}/book`)} actionLabel="Book Now" />
              : upcoming.map(a => (
                <ApptCard key={a.id} appt={a} barberInfo={barberInfo}
                  onCancel={() => { setCancelTarget(a.id); setConfirmCancel(true) }}
                  onReschedule={() => { setReschedAppt(a); setReschedDate(null); setReschedSlot(null); setReschedNote('') }}
                  onMap={() => openMaps(barberInfo?.address)} />
              ))
            }
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', color: '#fff', fontSize: 22, fontWeight: 900, marginBottom: 14 }}>History</h2>
            {history.length === 0
              ? <Empty icon={<History size={30} />} title="No history yet" desc="Your past appointments will appear here." />
              : history.map(a => <ApptCard key={a.id} appt={a} barberInfo={barberInfo} muted />)
            }
          </div>
        )}

        {/* PROFILE */}
        {tab === 'profile' && (
          <div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', color: '#fff', fontSize: 22, fontWeight: 900, marginBottom: 14 }}>My Profile</h2>
            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 16, padding: '16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, overflow: 'hidden', background: '#FF5C0022', border: '2px solid #FF5C0033', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, color: '#FF5C00', flexShrink: 0 }}>
                {form.photoURL ? <img src={form.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : `${form.firstName?.[0] || ''}${form.lastName?.[0] || ''}`}
              </div>
              <div>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: '0 0 2px' }}>{form.firstName} {form.lastName}</p>
                <p style={{ color: '#555', fontSize: 13, margin: 0 }}>{user?.email}</p>
              </div>
            </div>
            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
              {/* Photo upload — tap avatar to open camera/gallery */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
                <label htmlFor="photo-upload" style={{ cursor: 'pointer', position: 'relative' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', background: '#FF5C0022', border: '3px solid #FF5C0044', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 26, color: '#FF5C00' }}>
                    {form.photoURL ? <img src={form.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : `${form.firstName?.[0] || ''}${form.lastName?.[0] || ''}`}
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: '#FF5C00', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #141414' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M20 5h-3.2L15 3H9L7.2 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/><circle cx="12" cy="13" r="3" fill="white"/></svg>
                  </div>
                </label>
                <p style={{ color: '#555', fontSize: 12, marginTop: 8, marginBottom: 0 }}>Tap to change photo</p>
                <input id="photo-upload" type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    // Read as data URL for immediate preview (no storage needed)
                    const reader = new FileReader()
                    reader.onload = ev => setForm(p => ({ ...p, photoURL: ev.target.result }))
                    reader.readAsDataURL(file)
                  }} />
              </div>

            {[['FIRST NAME', 'firstName', 'text', 'Angelo'], ['LAST NAME', 'lastName', 'text', 'Ferreras'], ['PHONE', 'phone', 'tel', '(315) 000-0000']].map(([lbl, key, type, ph]) => (
                <div key={key} style={{ marginBottom: 16 }}>
                  <p style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 7 }}>{lbl}</p>
                  <div style={{ borderBottom: '1.5px solid #1e1e1e', paddingBottom: 8 }}>
                    <input type={type} value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={ph}
                      style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 16, fontFamily: 'Monda, sans-serif' }} />
                  </div>
                </div>
              ))}
              <button onClick={saveProfile} disabled={saving}
                style={{ width: '100%', background: 'linear-gradient(135deg,#FF5C00,#FF9000)', border: 'none', borderRadius: 12, padding: '15px', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...F }}>
                {saving && <div style={{ width: 16, height: 16, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
            <button onClick={async () => { await signOut(); navigate(`/b/${barberSlug}`) }}
              style={{ width: '100%', background: 'none', border: '1px solid #1e1e1e', borderRadius: 12, padding: '14px', color: '#f87171', fontWeight: 600, fontSize: 14, cursor: 'pointer', ...F }}>
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(10,10,10,0.97)', borderTop: '1px solid #141414', display: 'flex', paddingBottom: 'max(8px,env(safe-area-inset-bottom))' }}>
        {TABS.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 0', color: tab === id ? '#FF5C00' : '#444', ...F, position: 'relative' }}>
            <Icon size={20} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em' }}>{label.toUpperCase()}</span>
            {id === 'bookings' && upcoming.length > 0 && (
              <div style={{ position: 'absolute', top: 6, right: '25%', width: 7, height: 7, borderRadius: '50%', background: '#FF5C00' }} />
            )}
          </button>
        ))}
      </div>

      {/* Cancel Confirmation Modal */}
      {confirmCancel && (
        <Overlay>
          <p style={{ fontFamily: 'Syne, sans-serif', color: '#fff', fontSize: 17, fontWeight: 900, marginBottom: 8 }}>Cancel appointment?</p>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 6 }}>Are you sure? This cannot be undone.</p>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 18 }}>Would you prefer to reschedule instead?</p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <button onClick={() => { setConfirmCancel(false); const a = appointments.find(a => a.id === cancelTarget); if (a) { setReschedAppt(a); setReschedDate(null); setReschedSlot(null) } }}
              style={{ flex: 1, padding: '13px', borderRadius: 12, background: '#FF5C0015', color: '#FF8C00', fontWeight: 700, border: '1px solid #FF5C0025', cursor: 'pointer', ...F }}>
              Reschedule Instead
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setConfirmCancel(false); setCancelTarget(null) }}
              style={{ flex: 1, padding: '13px', borderRadius: 12, background: '#1a1a1a', color: '#888', fontWeight: 600, border: '1px solid #252525', cursor: 'pointer', ...F }}>
              Keep It
            </button>
            <button onClick={handleCancel}
              style={{ flex: 1, padding: '13px', borderRadius: 12, background: '#ef444415', color: '#f87171', fontWeight: 700, border: '1px solid #ef444433', cursor: 'pointer', ...F }}>
              Yes, Cancel
            </button>
          </div>
        </Overlay>
      )}

      {/* Reschedule Modal */}
      {reschedAppt && !confirmResched && (
        <Overlay onClose={() => setReschedAppt(null)}>
          <p style={{ fontFamily: 'Syne, sans-serif', color: '#fff', fontSize: 17, fontWeight: 900, marginBottom: 6 }}>Reschedule</p>
          <p style={{ color: '#666', fontSize: 13, marginBottom: 14 }}>{reschedAppt.services?.map(s => s.name).join(', ')} · {formatDuration(reschedAppt.totalDuration || 0)}</p>

          {/* Date picker - scrollable 7-day windows */}
          {(() => {
            const today = startOfDay(new Date())
            const advance = availability?.advanceDays || 30
            const days = Array.from({ length: advance }, (_, i) => addDays(today, i))
            const perPage = 7
            const visible = days.slice(reschedPage * perPage, (reschedPage + 1) * perPage)
            return (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <button onClick={() => setReschedPage(p => Math.max(0, p - 1))} disabled={reschedPage === 0}
                    style={{ background: 'none', border: 'none', color: reschedPage === 0 ? '#333' : '#fff', cursor: 'pointer', padding: 4 }}><ChevronLeft size={15} /></button>
                  <span style={{ color: '#888', fontSize: 12 }}>{visible[0] && format(visible[0], 'MMM d')} – {visible[visible.length - 1] && format(visible[visible.length - 1], 'MMM d')}</span>
                  <button onClick={() => setReschedPage(p => (p + 1) * perPage < advance ? p + 1 : p)}
                    style={{ background: 'none', border: 'none', color: (reschedPage + 1) * perPage >= advance ? '#333' : '#fff', cursor: 'pointer', padding: 4 }}><ChevronRight size={15} /></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                  {visible.map((date, i) => {
                    const isSel = reschedDate && isSameDay(date, reschedDate)
                    return (
                      <button key={i} onClick={() => setReschedDate(date)}
                        style={{ background: isSel ? '#FF5C00' : '#1a1a1a', border: `1px solid ${isSel ? '#FF5C00' : '#252525'}`, borderRadius: 10, padding: '8px 2px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, ...F }}>
                        <span style={{ color: isSel ? '#fff' : '#888', fontSize: 9, fontWeight: 700 }}>{format(date, 'EEE').toUpperCase()}</span>
                        <span style={{ color: isSel ? '#fff' : '#fff', fontSize: 13, fontWeight: 800 }}>{format(date, 'd')}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {reschedDate && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>{format(reschedDate, 'EEE, MMM d').toUpperCase()}</p>
              {reschedSlots.length === 0
                ? <p style={{ color: '#555', fontSize: 13 }}>No slots available this day.</p>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {reschedSlots.map(slot => (
                    <button key={slot.startTime} onClick={() => setReschedSlot(slot)}
                      style={{ padding: '10px 3px', borderRadius: 10, border: `1.5px solid ${reschedSlot?.startTime === slot.startTime ? '#FF5C00' : '#252525'}`, background: reschedSlot?.startTime === slot.startTime ? '#FF5C00' : '#141414', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', ...F }}>
                      {slot.startTime}
                    </button>
                  ))}
                </div>}
            </div>
          )}

          {/* Note */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>NOTE (optional)</p>
            <textarea value={reschedNote} onChange={e => setReschedNote(e.target.value)} rows={2} placeholder="Reason for rescheduling..."
              style={{ width: '100%', background: '#1a1a1a', border: '1px solid #252525', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 14, resize: 'none', outline: 'none', ...F, boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setReschedAppt(null)}
              style={{ flex: 1, padding: '13px', borderRadius: 12, background: '#1a1a1a', color: '#888', fontWeight: 600, border: '1px solid #252525', cursor: 'pointer', ...F }}>
              Cancel
            </button>
            <button onClick={() => reschedSlot && setConfirmResched(true)} disabled={!reschedSlot}
              style={{ flex: 1, padding: '13px', borderRadius: 12, background: reschedSlot ? '#FF5C00' : '#333', color: '#fff', fontWeight: 700, border: 'none', cursor: reschedSlot ? 'pointer' : 'not-allowed', ...F }}>
              Review
            </button>
          </div>
        </Overlay>
      )}

      {/* Reschedule Confirmation */}
      {reschedAppt && confirmResched && reschedSlot && (
        <Overlay>
          <p style={{ fontFamily: 'Syne, sans-serif', color: '#fff', fontSize: 17, fontWeight: 900, marginBottom: 12 }}>Confirm Reschedule?</p>
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
            <p style={{ color: '#888', fontSize: 12, margin: '0 0 4px' }}>New date & time</p>
            <p style={{ color: '#FF5C00', fontWeight: 700, fontSize: 15, margin: 0 }}>{reschedDate && format(reschedDate, 'EEE, MMM d')} · {reschedSlot.startTime}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setConfirmResched(false)}
              style={{ flex: 1, padding: '13px', borderRadius: 12, background: '#1a1a1a', color: '#888', fontWeight: 600, border: '1px solid #252525', cursor: 'pointer', ...F }}>
              Back
            </button>
            <button onClick={handleReschedule}
              style={{ flex: 1, padding: '13px', borderRadius: 12, background: '#FF5C00', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', ...F }}>
              Confirm
            </button>
          </div>
        </Overlay>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function Overlay({ children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 20, padding: 22, width: '100%', maxWidth: 380, fontFamily: 'Monda, sans-serif', maxHeight: '80vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

function ApptCard({ appt, barberInfo, onCancel, onReschedule, onMap, muted }) {
  return (
    <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderLeft: `3px solid ${SC[appt.bookingStatus] || '#555'}`, borderRadius: 16, padding: '14px 16px', marginBottom: 10, opacity: muted && appt.bookingStatus === 'cancelled' ? 0.5 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            {barberInfo?.photoURL && <img src={barberInfo.photoURL} style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }} alt="" />}
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0 }}>{appt.barberName}</p>
          </div>
          <p style={{ color: '#888', fontSize: 12, margin: 0 }}>{format(parseLocalDate(appt.date), 'MMM d, yyyy')} · {appt.startTime}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontFamily: 'Syne, sans-serif', color: '#FF5C00', fontWeight: 900, fontSize: 15, margin: '0 0 2px' }}>{formatCurrency(appt.totalPrice)}</p>
          <p style={{ color: SC[appt.bookingStatus], fontSize: 10, fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>{appt.bookingStatus}</p>
        </div>
      </div>
      {appt.services?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {appt.services.map((s, i) => <span key={i} style={{ background: '#1a1a1a', color: '#777', fontSize: 11, padding: '3px 9px', borderRadius: 20, border: '1px solid #252525' }}>{s.name}</span>)}
        </div>
      )}
      {appt.cancelReason && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 6 }}>Reason: {appt.cancelReason}</p>}
      {appt.rescheduleNote && <p style={{ color: '#fbbf24', fontSize: 12, marginBottom: 6 }}>Note: {appt.rescheduleNote}</p>}
      {onMap && barberInfo?.address && (
        <button onClick={onMap} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#FF5C00', fontSize: 11, cursor: 'pointer', padding: '3px 0', marginBottom: 6, fontFamily: 'Monda, sans-serif' }}>
          <Navigation size={10} /> Directions
        </button>
      )}
      {onCancel && appt.bookingStatus !== 'cancelled' && (
        <div style={{ display: 'flex', gap: 8 }}>
          {onReschedule && <button onClick={onReschedule} style={{ background: '#FF5C0015', border: '1px solid #FF5C0025', borderRadius: 8, padding: '6px 12px', color: '#FF8C00', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Monda, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}><RefreshCw size={10} />Reschedule</button>}
          <button onClick={onCancel} style={{ background: '#ef444410', border: '1px solid #ef444425', borderRadius: 8, padding: '6px 12px', color: '#f87171', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Monda, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}><X size={10} />Cancel</button>
        </div>
      )}
    </div>
  )
}

function MiniCard({ appt }) {
  return (
    <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderLeft: `2px solid ${SC[appt.bookingStatus] || '#555'}`, borderRadius: 12, padding: '11px 13px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div><p style={{ color: '#fff', fontWeight: 600, fontSize: 13, margin: '0 0 2px' }}>{format(parseLocalDate(appt.date), 'MMM d, yyyy')}</p>
          <p style={{ color: '#555', fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{appt.services?.map(s => s.name).join(', ')}</p></div>
        <div style={{ textAlign: 'right' }}><p style={{ color: '#FF5C00', fontWeight: 700, fontSize: 14, margin: '0 0 2px' }}>{formatCurrency(appt.totalPrice)}</p>
          <p style={{ color: SC[appt.bookingStatus], fontSize: 10, fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>{appt.bookingStatus}</p></div>
      </div>
    </div>
  )
}

function Empty({ icon, title, desc, action, actionLabel }) {
  return (
    <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 16, padding: 36, textAlign: 'center' }}>
      <div style={{ color: '#333', display: 'flex', justifyContent: 'center', marginBottom: 10 }}>{icon}</div>
      <p style={{ color: '#fff', fontWeight: 700, margin: '0 0 4px' }}>{title}</p>
      <p style={{ color: '#555', fontSize: 13, margin: action ? '0 0 14px' : 0 }}>{desc}</p>
      {action && <button onClick={action} style={{ background: '#FF5C00', border: 'none', borderRadius: 10, padding: '10px 20px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'Monda, sans-serif' }}>{actionLabel}</button>}
    </div>
  )
}
