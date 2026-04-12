import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, parseLocalDate } from '../../utils/helpers'
import { format } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { createBroadcastNotifications } from '../../utils/notifications'
import { MessageSquare, Send, Users, ChevronDown, ChevronUp, ArrowLeft, Calendar, DollarSign, Star, Phone, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

const F = { fontFamily:'Monda,sans-serif' }

export default function BarberSuggestions() {
  const { user } = useAuth()
  const [barber, setBarber]           = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [clients, setClients]         = useState([])     // { id, name, email, phone, appts[] }
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState('suggestions')
  const [expanded, setExpanded]       = useState(null)

  // Broadcast
  const [subject, setSubject]   = useState('')
  const [message, setMessage]   = useState('')
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [broadcastResult, setBroadcastResult] = useState(null)

  // Client detail view
  const [selectedClient, setSelectedClient] = useState(null)

  useEffect(() => {
    if (!user) return
    async function load() {
      const bSnap = await getDocs(query(collection(db,'barbers'), where('userId','==',user.uid)))
      if (bSnap.empty) { setLoading(false); return }
      const b = { id:bSnap.docs[0].id, ...bSnap.docs[0].data() }
      setBarber(b)

      const [sSnap, aSnap] = await Promise.all([
        getDocs(query(collection(db,'feedback'),     where('barberId','==',b.id))),
        getDocs(query(collection(db,'appointments'), where('barberId','==',b.id))),
      ])
      setSuggestions(sSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))

      const allAppts = aSnap.docs.map(d=>({id:d.id,...d.data()}))

      // Build unique registered clients with their appointments
      const map = {}
      for (const a of allAppts) {
        if (!a.clientId) continue  // skip guests
        if (!map[a.clientId]) {
          map[a.clientId] = {
            id:    a.clientId,
            name:  a.clientName  || '—',
            email: a.clientEmail || '—',
            phone: a.clientPhone || '—',
            appts: [],
          }
        }
        map[a.clientId].appts.push(a)
      }

      // Sort each client's appointments by date desc
      const clientList = Object.values(map).map(c => ({
        ...c,
        appts: c.appts.sort((a,b) => b.date?.localeCompare(a.date)),
      }))

      // Sort clients by most recent appointment
      clientList.sort((a,b) => (b.appts[0]?.date||'').localeCompare(a.appts[0]?.date||''))
      setClients(clientList)
      setLoading(false)
    }
    load()
  }, [user])

  async function sendBroadcast() {
    if (!message.trim()) return toast.error('Write a message first')
    setSending(true)
    try {
      await addDoc(collection(db,'broadcasts'), {
        barberId:   barber.id,
        barberName: barber.name || '',
        subject:    subject.trim() || 'Message from your barber',
        message:    message.trim(),
        recipients: clients.length,
        clientIds:  clients.map(c=>c.id),
        createdAt:  serverTimestamp(),
        status:     'sent',
      })
      // Create in-app notifications for each registered client
      const clientsWithIds = clients.filter(cl => cl.id)
      const notifCount = await createBroadcastNotifications(
        clientsWithIds.map(cl => cl.id),
        { barberName: barber.name || 'Your barber', subject: subject.trim(), message: message.trim() }
      )
      setSent(true)
      setBroadcastResult({ sent: clients.length, notified: notifCount })
      toast.success(`Broadcast sent! ${notifCount} notifications delivered.`)
      setSubject(''); setMessage('')
      setTimeout(() => setSent(false), 3000)
    } catch(err) {
      console.error('Broadcast error:', err)
      toast.error('Failed: ' + (err.message || 'unknown error'))
    } finally { setSending(false) }
  }

  if (loading) return <BarberLayout><PageLoader/></BarberLayout>

  // ── Client Detail View ──────────────────────────────────────────────────
  if (selectedClient) {
    const c      = selectedClient
    const done   = c.appts.filter(a => a.bookingStatus === 'completed')
    const cancel = c.appts.filter(a => a.bookingStatus === 'cancelled')
    const upcoming = c.appts.filter(a => {
      if (a.bookingStatus === 'cancelled') return false
      const [y,m,d] = (a.date||'').split('-').map(Number)
      const [h,mn]  = (a.startTime||'00:00').split(':').map(Number)
      return new Date(y,m-1,d,h,mn) > new Date()
    })
    const totalSpent = c.appts.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalPrice||0),0)
    const totalTips  = c.appts.reduce((s,a)=>s+(a.tip||0),0)
    const lastVisit  = done[0]?.date

    // Services breakdown
    const svcMap = {}
    c.appts.forEach(a => a.services?.forEach(s => {
      svcMap[s.name] = (svcMap[s.name]||0) + 1
    }))
    const topSvcs = Object.entries(svcMap).sort((a,b)=>b[1]-a[1])

    return (
      <BarberLayout>
        <div style={{ padding:'20px', maxWidth:560, margin:'0 auto', ...F }}>
          <button onClick={() => setSelectedClient(null)}
            style={{ display:'flex', alignItems:'center', gap:6, color:'var(--accent)', fontWeight:700, fontSize:13, background:'none', border:'none', cursor:'pointer', marginBottom:20, ...F }}>
            <ArrowLeft size={15}/> Back to clients
          </button>

          {/* Client header */}
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'20px', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
              <div style={{ width:56, height:56, borderRadius:'50%', background:'var(--accent)22', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:20, flexShrink:0 }}>
                {c.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}
              </div>
              <div>
                <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:18, margin:'0 0 4px' }}>{c.name}</p>
                <p style={{ color:'var(--text-sec)', fontSize:13, margin:'0 0 2px', display:'flex', alignItems:'center', gap:5 }}><Mail size={11}/>{c.email}</p>
                {c.phone && c.phone !== '—' && <p style={{ color:'var(--text-sec)', fontSize:13, margin:0, display:'flex', alignItems:'center', gap:5 }}><Phone size={11}/>{c.phone}</p>}
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
              {[
                { label:'Total Visits',  value: done.length,             color:'#16A34A' },
                { label:'Total Spent',   value: formatCurrency(totalSpent), color:'var(--accent)' },
                { label:'Upcoming',      value: upcoming.length,         color:'#3b82f6' },
                { label:'Cancellations', value: cancel.length,           color:'#ef4444' },
              ].map(s => (
                <div key={s.label} style={{ background:'var(--bg)', borderRadius:12, padding:'12px' }}>
                  <p style={{ color:s.color, fontWeight:900, fontSize:20, margin:'0 0 2px' }}>{s.value}</p>
                  <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {totalTips > 0 && (
              <div style={{ marginTop:10, background:'#16A34A15', border:'1px solid #16A34A33', borderRadius:10, padding:'8px 12px', fontSize:13 }}>
                <span style={{ color:'#16A34A', fontWeight:700 }}>Tips received: {formatCurrency(totalTips)}</span>
              </div>
            )}
            {lastVisit && (
              <p style={{ color:'var(--text-sec)', fontSize:12, marginTop:10 }}>
                Last visit: <strong style={{ color:'var(--text-pri)' }}>{format(parseLocalDate(lastVisit), 'MMM d, yyyy')}</strong>
              </p>
            )}
          </div>

          {/* Top services */}
          {topSvcs.length > 0 && (
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px', marginBottom:14 }}>
              <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:12 }}>FAVORITE SERVICES</p>
              {topSvcs.slice(0,5).map(([name, count]) => (
                <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ color:'var(--text-pri)', fontSize:13 }}>{name}</span>
                  <span style={{ color:'var(--accent)', fontWeight:700, fontSize:13 }}>{count}x</span>
                </div>
              ))}
            </div>
          )}

          {/* Appointment history */}
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px' }}>
            <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:12 }}>APPOINTMENT HISTORY ({c.appts.length})</p>
            {c.appts.map(a => {
              const statusColors = { completed:'#16A34A', confirmed:'#3b82f6', cancelled:'#ef4444', pending:'#f59e0b' }
              return (
                <div key={a.id} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                  <div>
                    <p style={{ color:'var(--text-pri)', fontWeight:600, fontSize:13, margin:'0 0 2px' }}>
                      {a.date ? format(parseLocalDate(a.date),'MMM d, yyyy') : '—'} · {a.startTime}
                    </p>
                    <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>
                      {a.services?.map(s=>s.name).join(', ')}
                    </p>
                    {a.cancelReason && <p style={{ color:'#ef4444', fontSize:11, margin:'2px 0 0' }}>Reason: {a.cancelReason}</p>}
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0, marginLeft:10 }}>
                    <p style={{ color:'var(--accent)', fontWeight:700, fontSize:13, margin:'0 0 2px' }}>{formatCurrency(a.totalPrice)}</p>
                    <span style={{ fontSize:10, fontWeight:700, color: statusColors[a.bookingStatus]||'#888', textTransform:'uppercase' }}>{a.bookingStatus}</span>
                    {a.tip > 0 && <p style={{ color:'#16A34A', fontSize:10, margin:'2px 0 0' }}>+{formatCurrency(a.tip)} tip</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </BarberLayout>
    )
  }

  
// ── Client dropdown with search ─────────────────────────────────────────────
function ClientDropdown({ clients, onSelect }) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ position:'relative', marginTop:8 }}>
      {/* Trigger */}
      <button onClick={() => setOpen(o => !o)}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'var(--bg)', border:'none', borderTop:'1px solid var(--border)', cursor:'pointer', fontFamily:'Monda,sans-serif' }}>
        <span style={{ color:'var(--text-sec)', fontSize:13, fontWeight:600 }}>
          {open ? 'Hide client list ↑' : `View ${clients.length} clients ↓`}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'0 0 14px 14px', maxHeight:340, display:'flex', flexDirection:'column' }}>
          {/* Search bar */}
          <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email or phone…"
              autoComplete="off"
              style={{ width:'100%', background:'var(--card)', border:'1.5px solid var(--border)', borderRadius:10, padding:'9px 12px', color:'var(--text-pri)', fontSize:14, outline:'none', fontFamily:'Monda,sans-serif', boxSizing:'border-box' }}
            />
          </div>
          {/* List */}
          <div style={{ overflowY:'auto', flex:1 }}>
            {filtered.length === 0
              ? <p style={{ color:'var(--text-sec)', fontSize:13, textAlign:'center', padding:'20px' }}>No clients found</p>
              : filtered.map(c => {
                  const done   = c.appts.filter(a=>a.bookingStatus==='completed').length
                  const lastApt = c.appts[0]
                  return (
                    <button key={c.id}
                      onClick={() => { onSelect(c); setOpen(false); setSearch('') }}
                      style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'none', border:'none', borderBottom:'1px solid var(--border)', cursor:'pointer', textAlign:'left', fontFamily:'Monda,sans-serif' }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--accent)22', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, flexShrink:0 }}>
                        {c.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:13, margin:'0 0 1px' }}>{c.name}</p>
                        <p style={{ color:'var(--text-sec)', fontSize:11, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.email}</p>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <p style={{ color:'var(--accent)', fontWeight:700, fontSize:11, margin:'0 0 1px' }}>{done} visit{done!==1?'s':''}</p>
                        {lastApt?.date && <p style={{ color:'var(--text-sec)', fontSize:10, margin:0 }}>Last: {format(parseLocalDate(lastApt.date),'MMM d')}</p>}
                      </div>
                    </button>
                  )
                })
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main View ───────────────────────────────────────────────────────────
  return (
    <BarberLayout>
      <div style={{ padding:'20px', maxWidth:580, margin:'0 auto', ...F }}>
        <h1 style={{ color:'var(--text-pri)', fontSize:22, fontWeight:900, margin:'0 0 4px' }}>Messages</h1>
        <p style={{ color:'var(--text-sec)', fontSize:13, margin:'0 0 18px' }}>Suggestions & broadcast</p>

        {/* Tab toggle */}
        <div style={{ display:'flex', background:'var(--surface)', borderRadius:14, padding:4, marginBottom:20, border:'1px solid var(--border)' }}>
          {[['suggestions','Suggestions'],['broadcast','Broadcast']].map(([id,lbl]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex:1, padding:'11px', borderRadius:11, fontWeight:700, fontSize:14, background:tab===id?'var(--accent)':'transparent', color:tab===id?'white':'var(--text-sec)', border:'none', cursor:'pointer', ...F }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* SUGGESTIONS */}
        {tab === 'suggestions' && (
          suggestions.length === 0
            ? <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:40, textAlign:'center' }}>
                <MessageSquare size={28} style={{ color:'var(--text-sec)', opacity:0.4, margin:'0 auto 10px', display:'block' }}/>
                <p style={{ color:'var(--text-sec)', margin:0 }}>No suggestions yet</p>
              </div>
            : suggestions.map(s => (
                <div key={s.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', marginBottom:8 }}>
                  <button onClick={() => setExpanded(expanded===s.id?null:s.id)}
                    style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'none', border:'none', cursor:'pointer', ...F }}>
                    <p style={{ color:'var(--text-pri)', fontWeight:600, fontSize:14, margin:0, textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                      {s.message?.slice(0,60)}{s.message?.length>60?'…':''}
                    </p>
                    {expanded===s.id ? <ChevronUp size={15} style={{color:'var(--text-sec)',flexShrink:0}}/> : <ChevronDown size={15} style={{color:'var(--text-sec)',flexShrink:0}}/>}
                  </button>
                  {expanded===s.id && (
                    <div style={{ padding:'0 16px 14px', borderTop:'1px solid var(--border)' }}>
                      <p style={{ color:'var(--text-pri)', fontSize:14, lineHeight:1.6, margin:'12px 0 0' }}>{s.message}</p>
                    </div>
                  )}
                </div>
              ))
        )}

        {/* BROADCAST */}
        {tab === 'broadcast' && (
          <div>
            {/* Client count + list */}
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, marginBottom:16, overflow:'hidden' }}>
              <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom: clients.length>0?'1px solid var(--border)':'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:'var(--accent)20', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Users size={17} style={{ color:'var(--accent)' }}/>
                  </div>
                  <div>
                    <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:15, margin:0 }}>{clients.length} registered client{clients.length!==1?'s':''}</p>
                    <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>Tap a client to view their profile</p>
                  </div>
                </div>
              </div>

              {/* Dropdown client list with search */}
              <ClientDropdown clients={clients} onSelect={setSelectedClient} />
            </div>

            {clients.length === 0
              ? <p style={{ color:'var(--text-sec)', fontSize:13, textAlign:'center', marginBottom:16 }}>No registered clients yet.</p>
              : (
                <div>
                  <div style={{ marginBottom:14 }}>
                    <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:6 }}>SUBJECT (optional)</p>
                    <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Special offer this week!"
                      autoComplete="off"
                      style={{ width:'100%', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:12, padding:'13px 14px', color:'var(--text-pri)', fontSize:15, outline:'none', ...F, boxSizing:'border-box' }}/>
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:6 }}>MESSAGE *</p>
                    <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={5}
                      placeholder="Hey! Just wanted to let you know..."
                      style={{ width:'100%', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:12, padding:'13px 14px', color:'var(--text-pri)', fontSize:15, outline:'none', resize:'vertical', ...F, boxSizing:'border-box' }}/>
                    <p style={{ color:'var(--text-sec)', fontSize:11, marginTop:4 }}>{message.length} chars</p>
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>QUICK TEMPLATES</p>
                    {[
                      { label:'🎉 Special offer', text:'Hey! We have a special offer this week. Book before Sunday and get 10% off your next cut!' },
                      { label:'📅 Open slots',    text:"Hi! We have some last-minute openings this week. Book now before they're gone!" },
                      { label:'⭐ New service',   text:'Exciting news! We just added new services to the menu. Come check them out!' },
                    ].map(t => (
                      <button key={t.label} onClick={()=>setMessage(t.text)}
                        style={{ display:'block', width:'100%', padding:'10px 14px', borderRadius:12, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text-sec)', fontSize:13, cursor:'pointer', textAlign:'left', marginBottom:6, ...F }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={sendBroadcast} disabled={sending || !message.trim()}
                    style={{ width:'100%', background:sent?'#16A34A':'var(--accent)', border:'none', borderRadius:14, padding:'16px', color:'white', fontWeight:700, fontSize:15, cursor:message.trim()?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:message.trim()?1:0.5, ...F }}>
                    {sending ? <div style={{ width:18, height:18, border:'2.5px solid white', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> : <Send size={16}/>}
                    {sending?'Sending…':sent?'Sent! ✓':`Send to ${clients.length} client${clients.length!==1?'s':''}`}
                  </button>
                </div>
              )
            }
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </BarberLayout>
  )
}
