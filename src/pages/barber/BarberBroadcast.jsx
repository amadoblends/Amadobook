/**
 * BarberBroadcast — Send messages to segmented clients
 * Frequent vs Non-frequent, select specific clients, General vs Important
 */
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency, parseLocalDate } from '../../utils/helpers'
import { format, subMonths } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { Send, Users, Star, UserX, Check, Search } from 'lucide-react'
import toast from 'react-hot-toast'

const F = { fontFamily:'Monda,sans-serif' }
const FREQUENT_THRESHOLD = 2  // 2+ visits in last 3 months = frequent

export default function BarberBroadcast() {
  const { user } = useAuth()
  const [barber, setBarber]         = useState(null)
  const [clients, setClients]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [segment, setSegment]       = useState('all')   // all | frequent | non-frequent
  const [selected, setSelected]     = useState(new Set())
  const [search, setSearch]         = useState('')
  const [subject, setSubject]       = useState('')
  const [message, setMessage]       = useState('')
  const [isImportant, setIsImportant] = useState(false)
  const [sending, setSending]       = useState(false)
  const [step, setStep]             = useState('list')  // list | compose

  useEffect(() => {
    if (!user) return
    async function load() {
      const bSnap = await getDocs(query(collection(db,'barbers'),where('userId','==',user.uid)))
      if (bSnap.empty) { setLoading(false); return }
      const b = { id:bSnap.docs[0].id,...bSnap.docs[0].data() }
      setBarber(b)

      // Load all appointments and group by client
      const aSnap = await getDocs(query(collection(db,'appointments'),where('barberId','==',b.id)))
      const appts = aSnap.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.bookingStatus!=='cancelled')

      // Group by clientId or email
      const clientMap = {}
      const threeMonthsAgo = format(subMonths(new Date(),3),'yyyy-MM-dd')
      appts.forEach(a=>{
        const key = a.clientId || a.clientEmail || a.clientName
        if (!key) return
        if (!clientMap[key]) {
          clientMap[key] = {
            id:key, name:a.clientName, email:a.clientEmail, phone:a.clientPhone,
            clientId:a.clientId, appts:[], recent:0, totalSpent:0,
          }
        }
        clientMap[key].appts.push(a)
        if (a.date>=threeMonthsAgo) clientMap[key].recent++
        if (a.paymentStatus==='paid') clientMap[key].totalSpent+=(a.totalWithTip||a.totalPrice||0)
      })

      const sorted = Object.values(clientMap).sort((a,b)=>b.appts.length-a.appts.length)
      setClients(sorted)
      setLoading(false)
    }
    load()
  },[user])

  const segmented = clients.filter(c=>{
    if (segment==='frequent')     return c.recent>=FREQUENT_THRESHOLD
    if (segment==='non-frequent') return c.recent<FREQUENT_THRESHOLD
    return true
  }).filter(c=>c.name?.toLowerCase().includes(search.toLowerCase())||c.email?.toLowerCase().includes(search.toLowerCase()))

  function toggleClient(id) {
    setSelected(prev=>{
      const next = new Set(prev)
      next.has(id)?next.delete(id):next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selected.size===segmented.length) setSelected(new Set())
    else setSelected(new Set(segmented.map(c=>c.id)))
  }

  async function send() {
    if (!subject.trim()||!message.trim()) { toast.error('Subject and message required'); return }
    if (selected.size===0) { toast.error('Select at least one client'); return }
    setSending(true)
    try {
      const targets = clients.filter(c=>selected.has(c.id))
      const batch = targets.map(c=>({
        userId: c.clientId||null,
        type: isImportant?'important':'broadcast',
        title: subject,
        message,
        from: barber?.name||'Your barber',
        read: false,
        createdAt: serverTimestamp(),
      }))
      await Promise.all(batch.map(n=>addDoc(collection(db,'notifications'),n)))
      toast.success(`Sent to ${targets.length} client${targets.length!==1?'s':''}`)
      setSelected(new Set()); setSubject(''); setMessage(''); setStep('list')
    } catch { toast.error('Failed to send') }
    setSending(false)
  }

  if (loading) return <BarberLayout><PageLoader/></BarberLayout>

  const frequentCount    = clients.filter(c=>c.recent>=FREQUENT_THRESHOLD).length
  const nonFrequentCount = clients.filter(c=>c.recent<FREQUENT_THRESHOLD).length

  return (
    <BarberLayout>
      <div style={{ padding:'16px', maxWidth:600, margin:'0 auto', ...F }}>
        <h1 style={{ color:'var(--text-pri)', fontSize:20, fontWeight:900, marginBottom:4 }}>Broadcast</h1>
        <p style={{ color:'var(--text-sec)', fontSize:13, marginBottom:20 }}>Message your clients</p>

        {step==='list' && (
          <>
            {/* Segment tabs */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
              {[
                { id:'all',          label:'All',         count:clients.length,    icon:'👥' },
                { id:'frequent',     label:'Frequent',    count:frequentCount,     icon:'⭐' },
                { id:'non-frequent', label:'New / Lapsed',count:nonFrequentCount,  icon:'👤' },
              ].map(s=>(
                <button key={s.id} onClick={()=>{ setSegment(s.id); setSelected(new Set()) }}
                  style={{ padding:'10px 8px', borderRadius:14, border:`1.5px solid ${segment===s.id?'var(--accent)':'var(--border)'}`, background:segment===s.id?'var(--accent)15':'var(--card)', cursor:'pointer', textAlign:'center', ...F }}>
                  <p style={{ margin:'0 0 2px', fontSize:16 }}>{s.icon}</p>
                  <p style={{ color:segment===s.id?'var(--accent)':'var(--text-pri)', fontWeight:700, fontSize:12, margin:'0 0 1px' }}>{s.label}</p>
                  <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{s.count} clients</p>
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 12px', marginBottom:12 }}>
              <Search size={14} color="var(--text-sec)"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients…"
                style={{ flex:1, background:'none', border:'none', outline:'none', color:'var(--text-pri)', fontSize:14, ...F }}/>
            </div>

            {/* Select all + count */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, padding:'0 4px' }}>
              <button onClick={selectAll}
                style={{ background:'none', border:'none', color:'var(--accent)', fontWeight:700, fontSize:13, cursor:'pointer', ...F }}>
                {selected.size===segmented.length&&segmented.length>0?'Deselect all':'Select all'}
              </button>
              <span style={{ color:'var(--text-sec)', fontSize:12 }}>{selected.size} selected</span>
            </div>

            {/* Client list */}
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
              {segmented.length===0 ? (
                <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:24, textAlign:'center' }}>
                  <p style={{ color:'var(--text-sec)', margin:0 }}>No clients in this segment</p>
                </div>
              ) : segmented.map(c=>{
                const isSel = selected.has(c.id)
                const isFreq = c.recent>=FREQUENT_THRESHOLD
                return (
                  <button key={c.id} onClick={()=>toggleClient(c.id)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:12, background:isSel?'var(--accent)12':'var(--card)', border:`1.5px solid ${isSel?'var(--accent)44':'var(--border)'}`, cursor:'pointer', textAlign:'left', ...F, width:'100%' }}>
                    {/* Checkbox */}
                    <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${isSel?'var(--accent)':'var(--border)'}`, background:isSel?'var(--accent)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {isSel && <Check size={13} color="var(--accent-inv)"/>}
                    </div>
                    {/* Avatar */}
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, color:'var(--text-sec)', flexShrink:0 }}>
                      {c.name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?'}
                    </div>
                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:0 }}>{c.name}</p>
                        {isFreq && <Star size={11} color="var(--accent)" fill="var(--accent)"/>}
                      </div>
                      <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>
                        {c.appts.length} visit{c.appts.length!==1?'s':''} · {formatCurrency(c.totalSpent)} spent
                      </p>
                    </div>
                    {c.recent>0 && (
                      <span style={{ color:'var(--accent)', fontSize:11, fontWeight:700, flexShrink:0 }}>{c.recent} recent</span>
                    )}
                  </button>
                )
              })}
            </div>

            {selected.size>0 && (
              <button onClick={()=>setStep('compose')}
                style={{ width:'100%', background:'var(--accent)', color:'var(--accent-inv)', border:'none', borderRadius:16, padding:'16px', fontWeight:700, fontSize:16, cursor:'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <Send size={16}/> Compose Message → {selected.size} client{selected.size!==1?'s':''}
              </button>
            )}
          </>
        )}

        {step==='compose' && (
          <div>
            <button onClick={()=>setStep('list')}
              style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer', fontSize:13, fontWeight:700, marginBottom:20, ...F }}>
              ← Back
            </button>

            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'12px 16px', marginBottom:16 }}>
              <p style={{ color:'var(--text-sec)', fontSize:11, margin:'0 0 2px' }}>Sending to</p>
              <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:15, margin:0 }}>{selected.size} client{selected.size!==1?'s':''}</p>
            </div>

            {/* Message type */}
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              {[[false,'📢 General'],[true,'🔴 Important']].map(([imp,lbl])=>(
                <button key={lbl} onClick={()=>setIsImportant(imp)}
                  style={{ flex:1, padding:'12px', borderRadius:14, border:`1.5px solid ${isImportant===imp?'var(--accent)':'var(--border)'}`, background:isImportant===imp?'var(--accent)15':'transparent', color:isImportant===imp?'var(--accent)':'var(--text-sec)', fontWeight:700, fontSize:13, cursor:'pointer', ...F }}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* Subject */}
            <div style={{ marginBottom:16 }}>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:6 }}>SUBJECT</p>
              <div style={{ borderBottom:'1.5px solid var(--border)', paddingBottom:8 }}>
                <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Special offer this weekend"
                  style={{ width:'100%', background:'none', border:'none', outline:'none', color:'var(--text-pri)', fontSize:16, ...F }}/>
              </div>
            </div>

            {/* Message */}
            <div style={{ marginBottom:20 }}>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:6 }}>MESSAGE</p>
              <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write your message…" rows={5}
                style={{ width:'100%', background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'12px', color:'var(--text-pri)', fontSize:15, outline:'none', resize:'vertical', ...F }}/>
            </div>

            <button onClick={send} disabled={sending||!subject.trim()||!message.trim()}
              style={{ width:'100%', background:'var(--accent)', color:'var(--accent-inv)', border:'none', borderRadius:16, padding:'16px', fontWeight:700, fontSize:16, cursor:'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:sending?0.7:1 }}>
              {sending
                ? <div style={{width:18,height:18,border:'2px solid var(--accent-inv)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/>
                : <Send size={16}/>}
              {sending?'Sending…':'Send Message'}
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </BarberLayout>
  )
}
