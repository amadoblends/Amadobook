/**
 * HistoryPage — fixed
 * ✅ Removed: useParams() / barberSlug
 */
import { useEffect, useState, useMemo } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'
import { formatCurrency, formatDuration, parseLocalDate } from '../../utils/helpers'
import { useTheme } from '../../context/ThemeContext'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'

const BG     = '#0D0D0D'
const CARD   = '#171717'
const BORDER = '#2A2A2A'
const ORANGE = '#FF6B1A'
const TXT    = '#F5F5F5'
const TXT2   = '#888888'
const TXT3   = '#555555'
const RED    = '#EF4444'
const GREEN  = '#22C55E'
const F      = { fontFamily: "'DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .fade-up { animation: fadeUp 0.22s ease both; }
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 0; }
`

function isUpcoming(a) {
  if (a.bookingStatus === 'cancelled') return false
  const [y, m, d] = (a.date || '').split('-').map(Number)
  const [h, mn]   = (a.startTime || '0:0').split(':').map(Number)
  return new Date(y, m - 1, d, h, mn) > new Date()
}

export function HistoryPage() {
  const { user }       = useAuth()
  const { formatTime } = useTheme()
  const navigate       = useNavigate()

  const [appts,   setAppts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'appointments'), where('clientId', '==', user.uid))
    const unsub = onSnapshot(q, snap => {
      setAppts(snap.docs.map(d => ({ id:d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user])

  const history = useMemo(() => {
    let list = appts.filter(a => !isUpcoming(a))
    if (filter === 'completed') list = list.filter(a => a.bookingStatus === 'completed')
    if (filter === 'cancelled') list = list.filter(a => a.bookingStatus === 'cancelled')
    return list.sort((a, b) => b.date?.localeCompare(a.date) || 0)
  }, [appts, filter])

  const totalSpent  = appts.filter(a => a.paymentStatus === 'paid').reduce((s, a) => s + (a.totalWithTip || a.totalPrice || 0), 0)
  const totalVisits = appts.filter(a => a.bookingStatus === 'completed').length

  if (loading) return (
    <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:24, height:24, border:`2px solid ${BORDER}`, borderTopColor:ORANGE, borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ background:BG, minHeight:'100vh', paddingBottom:100, ...F }}>
      <style>{CSS}</style>
      <div style={{ padding:'16px 18px', maxWidth:500, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <button onClick={() => navigate(-1)}
            style={{ background:'none', border:'none', color:TXT2, cursor:'pointer', display:'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <h1 style={{ color:TXT, fontWeight:800, fontSize:22, margin:0 }}>History</h1>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
          <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:'14px 16px' }}>
            <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', margin:'0 0 4px' }}>ALL-TIME SPENT</p>
            <p style={{ color:GREEN, fontWeight:900, fontSize:22, margin:0, letterSpacing:'-0.5px' }}>{formatCurrency(totalSpent)}</p>
          </div>
          <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:'14px 16px' }}>
            <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', margin:'0 0 4px' }}>TOTAL VISITS</p>
            <p style={{ color:TXT, fontWeight:900, fontSize:22, margin:0 }}>{totalVisits}</p>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display:'flex', gap:6, marginBottom:18 }}>
          {[['all','All'],['completed','Completed'],['cancelled','Cancelled']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${filter===k?ORANGE:BORDER}`, background:filter===k?`${ORANGE}18`:'transparent', color:filter===k?ORANGE:TXT2, fontWeight:600, fontSize:12, cursor:'pointer', ...F }}>
              {l}
            </button>
          ))}
        </div>

        {/* List */}
        {history.length === 0 ? (
          <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:'40px 20px', textAlign:'center' }}>
            <p style={{ color:TXT2, fontSize:14 }}>No history yet</p>
          </div>
        ) : history.map(a => {
          const cancelled = a.bookingStatus === 'cancelled'
          const completed = a.bookingStatus === 'completed'
          return (
            <div key={a.id} className="fade-up"
              style={{ background:CARD, border:`1px solid ${BORDER}`, borderLeft:`3px solid ${cancelled?`${RED}40`:completed?`${GREEN}40`:BORDER}`, borderRadius:14, padding:'14px', marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <div>
                  <p style={{ color:TXT, fontWeight:700, fontSize:13, margin:'0 0 2px' }}>
                    {a.date ? format(parseLocalDate(a.date), 'MMM d, yyyy') : '—'}
                  </p>
                  <p style={{ color:TXT2, fontSize:12, margin:0 }}>
                    {formatTime ? formatTime(a.startTime) : a.startTime} · {formatDuration(a.totalDuration || 0)}
                  </p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ color:cancelled?TXT2:TXT, fontWeight:800, fontSize:14, margin:'0 0 4px', textDecoration:cancelled?'line-through':'none' }}>
                    {formatCurrency(a.totalWithTip || a.totalPrice)}
                  </p>
                  <span style={{ fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:20, background:cancelled?`${RED}14`:completed?`${GREEN}12`:BORDER, color:cancelled?RED:completed?GREEN:TXT2, letterSpacing:'0.05em' }}>
                    {(a.bookingStatus || '').toUpperCase()}
                  </span>
                </div>
              </div>
              {a.services?.length > 0 && (
                <p style={{ color:TXT2, fontSize:11, margin:'4px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {a.services.map(s => s.name).join(', ')}
                </p>
              )}
              {a.tip > 0 && (
                <p style={{ color:GREEN, fontSize:11, margin:'4px 0 0' }}>+{formatCurrency(a.tip)} tip</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default HistoryPage
