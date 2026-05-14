import { useEffect, useState, useMemo } from 'react'
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency, formatDuration } from '../../utils/helpers'
import { format } from 'date-fns'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { useTheme } from '../../context/ThemeContext'
import { ChevronLeft, Phone, Mail, Calendar, Edit2, Plus, Scissors, Star } from 'lucide-react'
import toast from 'react-hot-toast'

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
    <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function Avatar({ name, photoURL, size = 64, fontSize = 22 }) {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      background: CARD2, border: `2px solid ${BORDER}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize, color: TXT2, flexShrink: 0,
    }}>
      {photoURL
        ? <img src={photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        : initials}
    </div>
  )
}

// Note editor modal
function NoteModal({ note, onSave, onClose }) {
  const [val, setVal] = useState(note || '')
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 480, background: CARD, borderRadius: '22px 22px 0 0', border: `1px solid ${BORDER}`, padding: '24px 20px 40px', ...F }} onClick={e => e.stopPropagation()}>
        <p style={{ color: TXT, fontWeight: 800, fontSize: 16, marginBottom: 16 }}>Client Notes</p>
        <textarea value={val} onChange={e => setVal(e.target.value)} rows={5}
          placeholder="Add notes about this client…"
          style={{ width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, color: TXT, fontSize: 14, resize: 'none', outline: 'none', ...F }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: 14, background: 'transparent', border: `1px solid ${BORDER}`, color: TXT2, fontWeight: 600, cursor: 'pointer', ...F }}>Cancel</button>
          <button onClick={() => { onSave(val); onClose() }} style={{ flex: 1, padding: '13px', borderRadius: 14, background: ORANGE, border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', ...F }}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default function BarberClientDetail() {
  const { user }       = useAuth()
  const { formatTime } = useTheme()
  const navigate       = useNavigate()
  const location       = useLocation()
  const params         = useParams()

  // clientKey can be clientId (firebase uid) or email or name
  const clientKey  = location.state?.clientKey  || params.clientKey
  const clientId   = location.state?.clientId
  const clientName = location.state?.clientName

  const [appts,     setAppts]     = useState([])
  const [userData,  setUserData]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [showAll,   setShowAll]   = useState(false)
  const [showNote,  setShowNote]  = useState(false)
  const [note,      setNote]      = useState('')
  const [barberId,  setBarberId]  = useState(null)
  const [barberDocId, setBarberDocId] = useState(null)

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db, 'barbers'), where('userId', '==', user.uid))).then(snap => {
      if (!snap.empty) { setBarberId(snap.docs[0].id); setBarberDocId(snap.docs[0].id) }
    })
  }, [user])

  useEffect(() => {
    if (!barberId || !clientKey) return
    // Load all appts for this client
    const q = query(collection(db, 'appointments'), where('barberId', '==', barberId))
    getDocs(q).then(snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const clientAppts = all.filter(a =>
        (clientId && a.clientId === clientId) ||
        (!clientId && (a.clientEmail === clientKey || a.clientName === clientKey))
      ).sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
      setAppts(clientAppts)
      // Get note if stored
      const noteVal = clientAppts.find(a => a.clientNote)?.clientNote || ''
      setNote(noteVal)
      setLoading(false)
    })
    // Load user profile if we have clientId
    if (clientId) {
      getDoc(doc(db, 'users', clientId)).then(s => s.exists() && setUserData(s.data()))
    }
  }, [barberId, clientKey, clientId])

  const stats = useMemo(() => {
    const visits    = appts.filter(a => a.bookingStatus === 'completed').length
    const totalSpent = appts.filter(a => a.paymentStatus === 'paid').reduce((s, a) => s + (a.totalWithTip || a.totalPrice || 0), 0)
    const lastVisit = appts.find(a => a.bookingStatus === 'completed')
    const svcCount  = {}
    appts.forEach(a => a.services?.forEach(s => { svcCount[s.name] = (svcCount[s.name] || 0) + 1 }))
    const topSvc    = Object.entries(svcCount).sort((a, b) => b[1] - a[1])[0]
    return { visits, totalSpent, lastVisit, topSvc }
  }, [appts])

  async function saveNote(val) {
    setNote(val)
    // Save note to the most recent appointment
    const target = appts[0]
    if (target) {
      try { await updateDoc(doc(db, 'appointments', target.id), { clientNote: val }); toast.success('Note saved') }
      catch { toast.error('Failed to save') }
    }
  }

  if (loading) return <BarberLayout><PageLoader /></BarberLayout>

  const displayName = userData ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : (appts[0]?.clientName || clientName || 'Client')
  const email = userData?.email || appts[0]?.clientEmail
  const phone = userData?.phone || appts[0]?.clientPhone
  const photo = userData?.photoURL || appts[0]?.clientPhotoURL
  const visibleAppts = showAll ? appts : appts.slice(0, 5)

  function formatPhone(raw) {
    if (!raw) return null
    const d = raw.replace(/\D/g, '')
    if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
    if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
    return raw
  }

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{ background: BG, minHeight: '100vh', paddingBottom: 100, ...F }}>
        <div style={{ padding: '16px 18px', maxWidth: 640, margin: '0 auto' }}>

          {/* Back header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <button onClick={() => navigate(-1)}
              style={{ background: 'none', border: 'none', color: TXT2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, ...F }}>
              <ChevronLeft size={18} /> Back
            </button>
            <button onClick={() => navigate('/barber/calendar', { state: { prefillClient: { name: displayName, email, phone } } })}
              style={{ background: ORANGE, border: 'none', borderRadius: 10, padding: '8px 14px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 13, ...F }}>
              <Plus size={14} /> Book
            </button>
          </div>

          {/* Profile card */}
          <div className="fade-up" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '20px 18px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <Avatar name={displayName} photoURL={photo} />
              <div>
                <p style={{ color: TXT, fontWeight: 800, fontSize: 20, margin: '0 0 4px', letterSpacing: '-0.3px' }}>{displayName}</p>
                {appts[0]?.isGuest && (
                  <span style={{ background: CARD2, color: TXT2, fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700, border: `1px solid ${BORDER}` }}>Guest</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: CARD2, borderRadius: 12, padding: '10px 14px' }}>
                  <Mail size={14} color={TXT3} />
                  <span style={{ color: TXT2, fontSize: 13 }}>{email}</span>
                </div>
              )}
              {phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: CARD2, borderRadius: 12, padding: '10px 14px' }}>
                  <Phone size={14} color={TXT3} />
                  <a href={`tel:${phone}`} style={{ color: ORANGE, fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>{formatPhone(phone)}</a>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Total Visits', value: stats.visits, color: TXT },
              { label: 'Total Spent',  value: formatCurrency(stats.totalSpent), color: '#22C55E' },
              { label: 'Last Visit',   value: stats.lastVisit ? format(parseLocalDate(stats.lastVisit.date), 'MMM d') : '—', color: ORANGE, sm: true },
            ].map(s => (
              <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 8px', textAlign: 'center' }}>
                <p style={{ color: s.color, fontWeight: 900, fontSize: s.sm ? 13 : 20, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</p>
                <p style={{ color: TXT3, fontSize: 10, margin: 0, fontWeight: 600 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Appointment History */}
          <div className="fade-up" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '16px 18px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ color: TXT, fontWeight: 700, fontSize: 15, margin: 0 }}>Appointment History</p>
              {appts.length > 5 && (
                <button onClick={() => setShowAll(p => !p)} style={{ background: 'none', border: 'none', color: ORANGE, fontSize: 12, fontWeight: 700, cursor: 'pointer', ...F }}>
                  {showAll ? 'Show less' : 'View all'}
                </button>
              )}
            </div>
            {appts.length === 0 ? (
              <p style={{ color: TXT3, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No appointments yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visibleAppts.map(a => (
                  <div key={a.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', background: BG,
                    border: `1px solid ${BORDER}`,
                    borderLeft: `3px solid ${STATUS_MAP[a.bookingStatus]?.color || BORDER}`,
                    borderRadius: 12,
                  }}>
                    <div>
                      <p style={{ color: TXT2, fontWeight: 600, fontSize: 13, margin: '0 0 2px' }}>
                        {a.date ? format(parseLocalDate(a.date), 'MMM d, yyyy') : '—'}
                      </p>
                      <p style={{ color: TXT3, fontSize: 11, margin: 0 }}>
                        {formatTime ? formatTime(a.startTime) : a.startTime} · {a.services?.map(s => s.name).join(', ')}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: a.paymentStatus === 'paid' ? '#22C55E' : TXT2, fontWeight: 700, fontSize: 13, margin: '0 0 4px' }}>
                        {formatCurrency(a.totalWithTip || a.totalPrice)}
                      </p>
                      <StatusBadge status={a.bookingStatus} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="fade-up" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '16px 18px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ color: TXT, fontWeight: 700, fontSize: 15, margin: 0 }}>Notes</p>
              <button onClick={() => setShowNote(true)} style={{ background: 'none', border: 'none', color: TXT2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, ...F }}>
                <Edit2 size={13} /> Edit
              </button>
            </div>
            <p style={{ color: note ? TXT2 : TXT3, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              {note || 'No notes yet. Tap edit to add preferences, allergies, style notes…'}
            </p>
          </div>

          {/* New Appointment CTA */}
          <button onClick={() => navigate('/barber/calendar', { state: { prefillClient: { name: displayName, email, phone } } })}
            style={{
              width: '100%', background: ORANGE, color: '#fff', border: 'none', borderRadius: 22,
              padding: '16px', fontWeight: 700, fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              ...F, boxShadow: `0 4px 24px ${ORANGE}44`,
            }}>
            <Calendar size={18} /> New Appointment
          </button>
        </div>
      </div>

      {showNote && <NoteModal note={note} onSave={saveNote} onClose={() => setShowNote(false)} />}
    </BarberLayout>
  )
}
