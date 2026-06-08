/**
 * BarberClientList — Migrated to Design System
 * ✓ Cards más compactas
 * ✓ Tema más oscuro y consistente (Light/Dark automático)
 * ✓ Stats más claras
 * ✓ Sin código innecesario
 */
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBarberData } from '../../hooks/useBarberData'
import { formatCurrency } from '../../utils/helpers'
import BarberLayout from '../../components/layout/BarberLayout'
import { Search, X, ChevronRight, Users } from 'lucide-react'

const F = { fontFamily: "'Plus Jakarta Sans','DM Sans',system-ui,sans-serif" }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
@keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp 0.18s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
`

function Avatar({ name, photoURL, size=40, fontSize=12 }) {
  const i = name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) || '?'
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      overflow:'hidden', background:'var(--card2)',
      border:'1.5px solid var(--border)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontWeight:800, fontSize, color:'var(--text-sec)', flexShrink:0,
    }}>
      {photoURL
        ? <img src={photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
        : i}
    </div>
  )
}

function buildClients(appts) {
  const map = {}
  appts.forEach(a => {
    const key = a.clientId || a.clientEmail || a.clientName
    if (!key) return
    if (!map[key]) map[key] = {
      id:key, clientId:a.clientId, name:a.clientName,
      email:a.clientEmail, phone:a.clientPhone, photoURL:a.clientPhotoURL,
      visits:0, totalSpent:0, services:{}, lastVisit:null,
    }
    const c = map[key]
    c.visits++
    if (a.paymentStatus==='paid') c.totalSpent += (a.totalWithTip||a.totalPrice||0)
    a.services?.forEach(s => { c.services[s.name] = (c.services[s.name]||0)+1 })
    if (!c.lastVisit || a.date > c.lastVisit) c.lastVisit = a.date
  })
  return Object.values(map).sort((a,b) => b.visits-a.visits)
}

export default function BarberClientList() {
  const { appointments, loading } = useBarberData()
  const navigate = useNavigate()
  const [search,  setSearch]  = useState('')
  const [sortBy,  setSortBy]  = useState('visits')

  const allClients = useMemo(() => buildClients(appointments), [appointments])

  const filtered = useMemo(() => {
    let list = allClients
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a,b) => {
      if (sortBy==='visits')  return b.visits-a.visits
      if (sortBy==='spent')   return b.totalSpent-a.totalSpent
      if (sortBy==='name')    return a.name?.localeCompare(b.name)||0
      if (sortBy==='recent')  return (b.lastVisit||'').localeCompare(a.lastVisit||'')
      return 0
    })
  }, [allClients, search, sortBy])

  if (loading) return (
    <BarberLayout>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
        <div style={{ width:20, height:20, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.65s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </BarberLayout>
  )

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{ background:'var(--bg)', minHeight:'100%', paddingBottom:20, ...F }}>
        <div style={{ padding:'12px 14px', maxWidth:540, margin:'0 auto' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div>
              <h1 style={{ color:'var(--text-pri)', fontWeight:800, fontSize:18, margin:'0 0 1px', letterSpacing:'-0.3px' }}>Clients</h1>
              <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{allClients.length} total clients</p>
            </div>
            <div style={{
              background:'var(--card)', border:'1px solid var(--border)',
              borderRadius:10, padding:'6px 12px', textAlign:'center',
              boxShadow:'var(--shadow-sm)'
            }}>
              <p style={{ color:'var(--accent)', fontWeight:800, fontSize:16, margin:'0 0 0px' }}>{allClients.length}</p>
              <p style={{ color:'var(--text-ter)', fontSize:9, fontWeight:700, margin:0 }}>CLIENTS</p>
            </div>
          </div>

          {/* Search */}
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            background:'var(--card)', border:'1px solid var(--border)',
            borderRadius:10, padding:'9px 12px', marginBottom:8,
            boxShadow:'var(--shadow-sm)'
          }}>
            <Search size={13} color="var(--text-ter)"/>
            <input
              value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search by name, phone, email…"
              style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text-pri)', fontSize:13, ...F }}/>
            {search && (
              <button onClick={() => setSearch('')}
                style={{ background:'none', border:'none', color:'var(--text-ter)', cursor:'pointer', padding:0, display:'flex' }}>
                <X size={12}/>
              </button>
            )}
          </div>

          {/* Sort pills */}
          <div style={{ display:'flex', gap:5, marginBottom:12, overflowX:'auto', paddingBottom:2 }}>
            {[['visits','Most Visits'],['spent','Most Spent'],['recent','Recent'],['name','A-Z']].map(([k,l]) => (
              <button key={k} onClick={() => setSortBy(k)}
                style={{
                  padding:'5px 11px', borderRadius:20,
                  border:`1px solid ${sortBy===k ? 'var(--accent)' : 'var(--border)'}`,
                  background: sortBy===k ? 'var(--accent-soft)' : 'transparent',
                  color: sortBy===k ? 'var(--accent)' : 'var(--text-sec)',
                  fontWeight:sortBy===k ? 700 : 500,
                  fontSize:11, whiteSpace:'nowrap', cursor:'pointer', ...F, flexShrink:0,
                }}>
                {l}
              </button>
            ))}
          </div>

          {/* Client list */}
          {filtered.length === 0 ? (
            <div style={{
              background:'var(--card)', border:'1px solid var(--border)',
              borderRadius:13, padding:'28px 16px', textAlign:'center',
              boxShadow:'var(--shadow-sm)'
            }}>
              <Users size={20} style={{ color:'var(--text-ter)', display:'block', margin:'0 auto 7px' }} strokeWidth={1.5}/>
              <p style={{ color:'var(--text-sec)', fontSize:13, fontWeight:600, margin:'0 0 3px' }}>
                {search ? 'No clients found' : 'No clients yet'}
              </p>
              <p style={{ color:'var(--text-ter)', fontSize:11, margin:0 }}>
                {search ? 'Try a different search' : 'Clients appear after their first appointment'}
              </p>
            </div>
          ) : (
            <div style={{
              background:'var(--card)', border:'1px solid var(--border)',
              borderRadius:13, overflow:'hidden', boxShadow:'var(--shadow-sm)'
            }}>
              {filtered.map((client, i) => {
                const topSvc = Object.entries(client.services||{}).sort((a,b)=>b[1]-a[1])[0]
                const isFrequent = client.visits >= 5
                return (
                  <button key={client.id} className="fu"
                    onClick={() => navigate(`/barber/clients/${encodeURIComponent(client.id)}`)}
                    style={{
                      display:'flex', alignItems:'center', gap:11,
                      padding:'11px 14px',
                      borderBottom: i < filtered.length-1 ? '1px solid var(--border)' : 'none',
                      background:'transparent', borderTop:'none', borderLeft:'none', borderRight:'none',
                      cursor:'pointer', textAlign:'left', ...F, width:'100%',
                    }}>
                    <div style={{ position:'relative' }}>
                      <Avatar name={client.name} photoURL={client.photoURL} size={38} fontSize={11}/>
                      {isFrequent && (
                        <div style={{
                          position:'absolute', bottom:-1, right:-1,
                          width:13, height:13, borderRadius:'50%',
                          background:'var(--accent)', border:'1.5px solid var(--bg)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                          <span style={{ fontSize:7 }}>⭐</span>
                        </div>
                      )}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:1 }}>
                        <span style={{
                          color:'var(--text-pri)', fontWeight:700, fontSize:13,
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                        }}>{client.name}</span>
                        {isFrequent && (
                          <span style={{
                            background:'var(--accent-soft)', color:'var(--accent)',
                            fontSize:8, fontWeight:800, padding:'1px 5px',
                            borderRadius:6, flexShrink:0,
                          }}>Regular</span>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <span style={{ color:'var(--text-sec)', fontSize:11 }}>{client.visits} visit{client.visits!==1?'s':''}</span>
                        {client.totalSpent > 0 && (
                          <><span style={{color:'var(--text-ter)',fontSize:10}}>·</span>
                          <span style={{color:'var(--text-sec)',fontSize:11}}>{formatCurrency(client.totalSpent)}</span></>
                        )}
                        {topSvc && (
                          <><span style={{color:'var(--text-ter)',fontSize:10}}>·</span>
                          <span style={{color:'var(--text-ter)',fontSize:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{topSvc[0]}</span></>
                        )}
                      </div>
                    </div>
                    {client.lastVisit && (
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <p style={{ color:'var(--text-ter)', fontSize:9, fontWeight:600, margin:0 }}>LAST</p>
                        <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, margin:'1px 0 0' }}>
                          {client.lastVisit.slice(5).replace('-','/')}
                        </p>
                      </div>
                    )}
                    <ChevronRight size={12} color="var(--text-ter)" style={{ flexShrink:0 }}/>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </BarberLayout>
  )
}