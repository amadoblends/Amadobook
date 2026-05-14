import { useEffect, useState, useMemo } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency, formatDuration } from '../../utils/helpers'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { useTheme } from '../../context/ThemeContext'
import { Search, Plus, ChevronRight, Filter, X } from 'lucide-react'

// ── Design tokens (same as BarberDashboard) ────────────────────────────────
const BG     = '#0D0D0D'
const CARD   = '#171717'
const CARD2  = '#1F1F1F'
const BORDER = '#2A2A2A'
const ORANGE = '#FF6B1A'
const TXT    = '#F5F5F5'
const TXT2   = '#888888'
const TXT3   = '#555555'
const F      = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
  @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .fade-up { animation: fadeUp 0.22s cubic-bezier(0.22,1,0.36,1) both; }
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 0; }
`

const STATUS_MAP = {
  confirmed: { bg:'rgba(34,197,94,0.12)',  color:'#22C55E',  label:'Confirmed' },
  pending:   { bg:`${ORANGE}18`,           color:ORANGE,     label:'Pending'   },
  completed: { bg:'rgba(255,255,255,0.06)',color:TXT2,       label:'Completed' },
  cancelled: { bg:'rgba(239,68,68,0.12)',  color:'#EF4444',  label:'Cancelled' },
}

function parseLocalDate(dateStr) {
  if (!dateStr) return new Date()
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 10, fontWeight: 800, padding: '3px 9px',
      borderRadius: 20, letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>{s.label}</span>
  )
}

function Avatar({ name, photoURL, size = 40, fontSize = 14 }) {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      background: CARD2, border: `1.5px solid ${BORDER}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize, color: TXT2, flexShrink: 0,
    }}>
      {photoURL
        ? <img src={photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        : initials}
    </div>
  )
}

function DateLabel({ dateStr }) {
  const d = parseLocalDate(dateStr)
  if (isToday(d))    return <span style={{ color: ORANGE, fontWeight: 700 }}>Today</span>
  if (isTomorrow(d)) return <span style={{ color: '#22C55E', fontWeight: 700 }}>Tomorrow</span>
  return <span>{format(d, 'MMM d, yyyy')}</span>
}

// ── Appointment Card ───────────────────────────────────────────────────────
function ApptCard({ appt, onClick, formatTime }) {
  const borderColor = STATUS_MAP[appt.bookingStatus]?.color || BORDER
  return (
    <button onClick={onClick} className="fade-up"
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer', ...F,
        background: CARD, border: `1px solid ${BORDER}`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 14, padding: '14px 14px 14px 16px',
        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12,
        transition: 'background 0.15s',
      }}>
      <Avatar name={appt.clientName} photoURL={appt.clientPhotoURL} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <p style={{ color: TXT, fontWeight: 700, fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {appt.clientName}
          </p>
        </div>
        <p style={{ color: TXT2, fontSize: 12, margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {appt.services?.map(s => s.name).join(', ')}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: TXT3, fontSize: 11, fontWeight: 600 }}>
            <DateLabel dateStr={appt.date} />
          </span>
          <span style={{ color: TXT3, fontSize: 11 }}>·</span>
          <span style={{ color: TXT3, fontSize: 11 }}>
            {formatTime ? formatTime(appt.startTime) : appt.startTime} – {formatTime ? formatTime(appt.endTime) : appt.endTime}
          </span>
          {appt.totalDuration && (
            <>
              <span style={{ color: TXT3, fontSize: 11 }}>·</span>
              <span style={{ color: TXT3, fontSize: 11 }}>{formatDuration(appt.totalDuration)}</span>
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <p style={{ color: ORANGE, fontWeight: 800, fontSize: 14, margin: 0 }}>
          {formatCurrency(appt.totalWithTip || appt.totalPrice)}
        </p>
        <StatusBadge status={appt.bookingStatus} />
      </div>
      <ChevronRight size={14} color={TXT3} style={{ flexShrink: 0 }} />
    </button>
  )
}

// ── Date Group Header ──────────────────────────────────────────────────────
function DateGroup({ dateStr, children }) {
  const d = parseLocalDate(dateStr)
  let label = format(d, 'MMMM d, yyyy')
  if (isToday(d))    label = `Today · ${format(d, 'MMMM d')}`
  if (isTomorrow(d)) label = `Tomorrow · ${format(d, 'MMMM d')}`
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ color: TXT3, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8, paddingLeft: 2 }}>
        {label.toUpperCase()}
      </p>
      {children}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function BarberAppointments() {
  const { user }        = useAuth()
  const { formatTime }  = useTheme()
  const navigate        = useNavigate()

  const [barberId, setBarberId] = useState(null)
  const [allAppts, setAllAppts] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('upcoming') // upcoming | past | cancelled
  const [search,   setSearch]   = useState('')
  const [showSearch, setShowSearch] = useState(false)

  // Load barberId
  useEffect(() => {
    if (!user) return
    import('firebase/firestore').then(({ collection, query, where, getDocs }) => {
      getDocs(query(collection(db, 'barbers'), where('userId', '==', user.uid))).then(snap => {
        if (!snap.empty) setBarberId(snap.docs[0].id)
        else setLoading(false)
      })
    })
  }, [user])

  // Listen to appointments
  useEffect(() => {
    if (!barberId) return
    const q = query(collection(db, 'appointments'), where('barberId', '==', barberId))
    const unsub = onSnapshot(q, snap => {
      setAllAppts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [barberId])

  const today = format(new Date(), 'yyyy-MM-dd')

  const filtered = useMemo(() => {
    let list = []
    if (tab === 'upcoming') {
      list = allAppts.filter(a =>
        a.bookingStatus !== 'cancelled' &&
        a.bookingStatus !== 'completed' &&
        a.date >= today
      )
      list.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    } else if (tab === 'past') {
      list = allAppts.filter(a =>
        a.bookingStatus === 'completed' || (a.date < today && a.bookingStatus !== 'cancelled')
      )
      list.sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
    } else {
      list = allAppts.filter(a => a.bookingStatus === 'cancelled')
      list.sort((a, b) => b.date.localeCompare(a.date))
    }

    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(a =>
        a.clientName?.toLowerCase().includes(s) ||
        a.services?.some(sv => sv.name?.toLowerCase().includes(s))
      )
    }
    return list
  }, [allAppts, tab, today, search])

  // Group by date for upcoming
  const grouped = useMemo(() => {
    if (tab !== 'upcoming') return null
    const map = {}
    filtered.forEach(a => {
      if (!map[a.date]) map[a.date] = []
      map[a.date].push(a)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered, tab])

  const TABS = [
    { key: 'upcoming',  label: 'Upcoming',  count: allAppts.filter(a => a.bookingStatus !== 'cancelled' && a.bookingStatus !== 'completed' && a.date >= today).length },
    { key: 'past',      label: 'Past',      count: allAppts.filter(a => a.bookingStatus === 'completed' || (a.date < today && a.bookingStatus !== 'cancelled')).length },
    { key: 'cancelled', label: 'Cancelled', count: allAppts.filter(a => a.bookingStatus === 'cancelled').length },
  ]

  if (loading) return <BarberLayout><PageLoader /></BarberLayout>

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{ background: BG, minHeight: '100vh', paddingBottom: 100, ...F }}>
        <div style={{ padding: '16px 18px', maxWidth: 640, margin: '0 auto' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h1 style={{ color: TXT, fontWeight: 800, fontSize: 22, margin: 0, letterSpacing: '-0.4px' }}>
              Appointments
            </h1>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowSearch(p => !p)}
                style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 9px', color: showSearch ? ORANGE : TXT2, cursor: 'pointer', display: 'flex' }}>
                <Search size={16} />
              </button>
              <button onClick={() => navigate('/barber/calendar')}
                style={{ background: ORANGE, border: 'none', borderRadius: 10, padding: '8px 12px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 13, ...F }}>
                <Plus size={15} /> New
              </button>
            </div>
          </div>

          {/* ── Search bar ── */}
          {showSearch && (
            <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 14px' }}>
              <Search size={14} color={TXT3} />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by client or service…"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: TXT, fontSize: 14, ...F }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: TXT3, cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 4 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  flex: 1, padding: '9px 6px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: tab === t.key ? ORANGE : 'transparent',
                  color: tab === t.key ? '#fff' : TXT2,
                  fontWeight: 700, fontSize: 13, ...F,
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>
                {t.label}
                {t.count > 0 && (
                  <span style={{
                    background: tab === t.key ? 'rgba(255,255,255,0.25)' : CARD2,
                    color: tab === t.key ? '#fff' : TXT3,
                    fontSize: 10, fontWeight: 800, borderRadius: 10, padding: '1px 6px', minWidth: 18, textAlign: 'center',
                  }}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Content ── */}
          {filtered.length === 0 ? (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>
                {tab === 'upcoming' ? '📅' : tab === 'past' ? '✅' : '❌'}
              </div>
              <p style={{ color: TXT2, fontWeight: 600, fontSize: 15, margin: '0 0 6px' }}>
                {search ? 'No results found' : tab === 'upcoming' ? 'No upcoming appointments' : tab === 'past' ? 'No past appointments' : 'No cancelled appointments'}
              </p>
              <p style={{ color: TXT3, fontSize: 13, margin: 0 }}>
                {search ? 'Try a different search' : tab === 'upcoming' ? 'New bookings will appear here' : ''}
              </p>
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
            <div>
              {filtered.map(a => (
                <ApptCard key={a.id} appt={a} formatTime={formatTime}
                  onClick={() => navigate('/barber/calendar', { state: { selectedId: a.id } })} />
              ))}
            </div>
          )}

        </div>
      </div>
    </BarberLayout>
  )
}
