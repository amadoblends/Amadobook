import { useEffect, useState, useMemo } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency } from '../../utils/helpers'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { Search, Plus, ChevronRight, X, Users } from 'lucide-react'

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

function parseLocalDate(dateStr) {
  if (!dateStr) return new Date()
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function Avatar({ name, photoURL, size = 44, fontSize = 15 }) {
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

// Build client map from appointments
function buildClients(appts) {
  const map = {}
  appts.forEach(a => {
    const key = a.clientId || a.clientEmail || a.clientName
    if (!key) return
    if (!map[key]) {
      map[key] = {
        id: key,
        clientId: a.clientId,
        name: a.clientName,
        email: a.clientEmail,
        phone: a.clientPhone,
        photoURL: a.clientPhotoURL,
        visits: 0,
        totalSpent: 0,
        lastVisit: null,
        lastDate: '',
        services: {},
      }
    }
    const c = map[key]
    c.visits++
    if (a.paymentStatus === 'paid') c.totalSpent += (a.totalWithTip || a.totalPrice || 0)
    if (!c.lastDate || a.date > c.lastDate) { c.lastDate = a.date; c.lastVisit = a.date }
    a.services?.forEach(s => { c.services[s.name] = (c.services[s.name] || 0) + 1 })
  })
  return Object.values(map).sort((a, b) => b.visits - a.visits)
}

export default function BarberClientList() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [barberId, setBarberId] = useState(null)
  const [allAppts, setAllAppts] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [sort,     setSort]     = useState('visits') // visits | spent | recent

  useEffect(() => {
    if (!user) return
    import('firebase/firestore').then(({ collection, query, where, getDocs }) => {
      getDocs(query(collection(db, 'barbers'), where('userId', '==', user.uid))).then(snap => {
        if (!snap.empty) setBarberId(snap.docs[0].id)
        else setLoading(false)
      })
    })
  }, [user])

  useEffect(() => {
    if (!barberId) return
    const q = query(collection(db, 'appointments'), where('barberId', '==', barberId))
    const unsub = onSnapshot(q, snap => {
      setAllAppts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [barberId])

  const clients = useMemo(() => buildClients(allAppts), [allAppts])

  const filtered = useMemo(() => {
    let list = [...clients]
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(c =>
        c.name?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s)
      )
    }
    if (sort === 'visits') list.sort((a, b) => b.visits - a.visits)
    else if (sort === 'spent') list.sort((a, b) => b.totalSpent - a.totalSpent)
    else list.sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''))
    return list
  }, [clients, search, sort])

  if (loading) return <BarberLayout><PageLoader /></BarberLayout>

  const totalClients = clients.length
  const totalRevenue = clients.reduce((s, c) => s + c.totalSpent, 0)
  const returning    = clients.filter(c => c.visits > 1).length

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{ background: BG, minHeight: '100vh', paddingBottom: 100, ...F }}>
        <div style={{ padding: '16px 18px', maxWidth: 640, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h1 style={{ color: TXT, fontWeight: 800, fontSize: 22, margin: 0, letterSpacing: '-0.4px' }}>Clients</h1>
            <button onClick={() => navigate('/barber/calendar')}
              style={{ background: ORANGE, border: 'none', borderRadius: 10, padding: '8px 12px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 13, ...F }}>
              <Plus size={15} /> New
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Total Clients', value: totalClients, color: TXT },
              { label: 'Revenue', value: formatCurrency(totalRevenue), color: '#22C55E' },
              { label: 'Returning', value: returning, color: ORANGE },
            ].map(s => (
              <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
                <p style={{ color: s.color, fontWeight: 900, fontSize: 18, margin: '0 0 4px', letterSpacing: '-0.5px' }}>{s.value}</p>
                <p style={{ color: TXT3, fontSize: 10, margin: 0, fontWeight: 600 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
            <Search size={14} color={TXT3} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: TXT, fontSize: 14, ...F }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: TXT3, cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
            {[['visits','Most Visits'],['spent','Top Spent'],['recent','Recent']].map(([k, l]) => (
              <button key={k} onClick={() => setSort(k)}
                style={{
                  padding: '6px 12px', borderRadius: 20, border: `1px solid ${sort === k ? ORANGE : BORDER}`,
                  background: sort === k ? `${ORANGE}18` : 'transparent',
                  color: sort === k ? ORANGE : TXT2, fontWeight: 600, fontSize: 12, cursor: 'pointer', ...F,
                }}>
                {l}
              </button>
            ))}
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '40px 20px', textAlign: 'center' }}>
              <Users size={32} style={{ color: TXT3, display: 'block', margin: '0 auto 10px' }} strokeWidth={1.5} />
              <p style={{ color: TXT2, fontWeight: 600, fontSize: 15, margin: '0 0 6px' }}>
                {search ? 'No clients found' : 'No clients yet'}
              </p>
              <p style={{ color: TXT3, fontSize: 13, margin: 0 }}>
                {search ? 'Try a different name' : 'Clients appear after their first booking'}
              </p>
            </div>
          ) : (
            filtered.map((c, i) => {
              const topSvc = Object.entries(c.services).sort((a, b) => b[1] - a[1])[0]
              return (
                <button key={c.id} className="fade-up"
                  onClick={() => navigate('/barber/clients/' + encodeURIComponent(c.id), { state: { clientKey: c.id, clientId: c.clientId, clientName: c.name } })}
                  style={{
                    width: '100%', textAlign: 'left', cursor: 'pointer', ...F,
                    background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14,
                    padding: '14px 14px', marginBottom: 8,
                    display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'background 0.15s',
                    animationDelay: `${i * 0.03}s`,
                  }}>
                  <Avatar name={c.name} photoURL={c.photoURL} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: TXT, fontWeight: 700, fontSize: 14, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                    <p style={{ color: TXT2, fontSize: 12, margin: '0 0 4px' }}>
                      {c.visits} visit{c.visits !== 1 ? 's' : ''} · Last: {c.lastDate ? format(parseLocalDate(c.lastDate), 'MMM d') : '—'}
                    </p>
                    {topSvc && <p style={{ color: TXT3, fontSize: 11, margin: 0 }}>Fav: {topSvc[0]}</p>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ color: ORANGE, fontWeight: 800, fontSize: 14, margin: '0 0 3px' }}>{formatCurrency(c.totalSpent)}</p>
                    <p style={{ color: TXT3, fontSize: 11, margin: 0 }}>{c.visits} visits</p>
                  </div>
                  <ChevronRight size={14} color={TXT3} />
                </button>
              )
            })
          )}
        </div>
      </div>
    </BarberLayout>
  )
}
