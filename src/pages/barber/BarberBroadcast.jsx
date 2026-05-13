import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency } from '../../utils/helpers'
import { format, subMonths } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { Send, Users, Star, Check, Search, X, Megaphone, ChevronRight } from 'lucide-react'
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
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  * { box-sizing: border-box; }
  input,textarea { font-size: 16px !important; }
  ::-webkit-scrollbar { display: none; }
`

const FREQUENT_THRESHOLD = 2

export default function BarberBroadcast() {
  const { user }  = useAuth()
  const [barber, setBarber]         = useState(null)
  const [clients, setClients]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [segment, setSegment]       = useState('all')
  const [selected, setSelected]     = useState(new Set())
  const [search, setSearch]         = useState('')
  const [subject, setSubject]       = useState('')
  const [message, setMessage]       = useState('')
  const [isImportant, setIsImportant] = useState(false)
  const [sending, setSending]       = useState(false)
  const [step, setStep]             = useState('list')

  useEffect(() => {
    if (!user) return
    async function load() {
      const bSnap = await getDocs(query(collection(db,'barbers'),where('userId','==',user.uid)))
      if (bSnap.empty) { setLoading(false); return }
      const b = { id:bSnap.docs[0].id,...bSnap.docs[0].data() }
      setBarber(b)
      const aSnap = await getDocs(query(collection(db,'appointments'),where('barberId','==',b.id)))
      const appts = aSnap.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.bookingStatus!=='cancelled')
      const clientMap = {}
      const threeMonthsAgo = format(subMonths(new Date(),3),'yyyy-MM-dd')
      appts.forEach(a=>{
        const key = a.clientId||a.clientEmail||a.clientName
        if (!key) return
        if (!clientMap[key]) clientMap[key]={ id:key, name:a.clientName, email:a.clientEmail, clientId:a.clientId, appts:[], recent:0, totalSpent:0 }
        clientMap[key].appts.push(a)
        if (a.date>=threeMonthsAgo) clientMap[key].recent++
        if (a.paymentStatus==='paid') clientMap[key].totalSpent+=(a.totalWithTip||a.totalPrice||0)
      })
      setClients(Object.values(clientMap).sort((a,b)=>b.appts.length-a.appts.length))
      setLoading(false)
    }
    load()
  },[user])

  const segmented = clients.filter(c=>{
    if (segment==='frequent')     return c.recent>=FREQUENT_THRESHOLD
    if (segment==='non-frequent') return c.recent<FREQUENT_THRESHOLD
    return true
  }).filter(c=>c.name?.toLowerCase().includes(search.toLowerCase())||c.email?.toLowerCase().includes(search.toLowerCase()))

  function toggleClient(id) { setSelected(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n }) }
  function selectAll()      { setSelected(selected.size===segmented.length?new Set():new Set(segmented.map(c=>c.id))) }

  async function send() {
    if (!subject.trim()||!message.trim()) { toast.error('Subject and message required'); return }
    if (selected.size===0) { toast.error('Select at least one client'); return }
    setSending(true)
    try {
      const targets = clients.filter(c=>selected.has(c.id))
      await Promise.all(targets.map(c=>addDoc(collection(db,'notifications'),{
        userId:c.clientId||null,
        type:isImportant?'important':'broadcast',
        title:subject, message,
        from:barber?.name||'Your barber',
        read:false, createdAt:serverTimestamp(),
      })))
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
      <style>{CSS}</style>
      <div style={{ background:BG, minHeight:'100vh', paddingBottom:100, ...F }}>
        <div style={{ padding:'16px 18px', maxWidth:600, margin:'0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom:22 }}>
            <h1 style={{ color:TXT, fontWeight:800, fontSize:22, margin:'0 0 2px', letterSpacing:'-0.3px' }}>Broadcast</h1>
            <p style={{ color:TXT2, fontSize:13, margin:0 }}>Send a message to your clients</p>
          </div>

          {step==='list' && (
            <>
              {/* Hero card */}
              <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, padding:'18px 20px', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:50, height:50, borderRadius:16, background:`${ORANGE}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Megaphone size={22} color={ORANGE}/>
                  </div>
                  <div>
                    <p style={{ color:TXT, fontWeight:700, fontSize:16, margin:'0 0 4px' }}>Send a message</p>
                    <p style={{ color:TXT2, fontSize:13, margin:0 }}>Reach all your clients or a specific group with important updates.</p>
                  </div>
                </div>
              </div>

              {/* Segment tabs */}
              <div style={{ display:'flex', background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:3, marginBottom:16 }}>
                {[
                  { id:'all',          label:'All Clients',   count:clients.length },
                  { id:'frequent',     label:'Active Clients',count:frequentCount },
                  { id:'non-frequent', label:'Custom',        count:nonFrequentCount },
                ].map(s=>(
                  <button key={s.id} onClick={()=>{ setSegment(s.id); setSelected(new Set()) }}
                    style={{ flex:1, padding:'10px 6px', borderRadius:11, border:'none', cursor:'pointer', fontWeight:700, fontSize:11, background:segment===s.id?ORANGE:'transparent', color:segment===s.id?'#fff':TXT2, ...F, transition:'all 0.15s' }}>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div style={{ display:'flex', alignItems:'center', gap:10, background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:'12px 14px', marginBottom:14 }}>
                <Search size={15} color={TXT3}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients…"
                  style={{ flex:1, background:'none', border:'none', outline:'none', color:TXT, fontSize:15, ...F }}/>
                {search && <button onClick={()=>setSearch('')} style={{ background:'none', border:'none', color:TXT3, cursor:'pointer', display:'flex' }}><X size={14}/></button>}
              </div>

              {/* Select all + count */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <button onClick={selectAll}
                  style={{ background:'none', border:'none', color:ORANGE, fontWeight:700, fontSize:13, cursor:'pointer', ...F }}>
                  {selected.size===segmented.length&&segmented.length>0?'Deselect all':'Select all'}
                </button>
                <span style={{ color:TXT2, fontSize:12 }}>{selected.size} selected</span>
              </div>

              {/* Client list */}
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {segmented.length===0 ? (
                  <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:28, textAlign:'center' }}>
                    <p style={{ color:TXT2, margin:0, fontSize:14 }}>No clients in this segment</p>
                  </div>
                ) : segmented.map(c=>{
                  const isSel  = selected.has(c.id)
                  const isFreq = c.recent>=FREQUENT_THRESHOLD
                  return (
                    <button key={c.id} onClick={()=>toggleClient(c.id)}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:16, background:isSel?`${ORANGE}10`:CARD2, border:`1.5px solid ${isSel?`${ORANGE}44`:BORDER}`, cursor:'pointer', textAlign:'left', ...F, width:'100%', transition:'all 0.15s' }}>
                      {/* Checkbox */}
                      <div style={{ width:22, height:22, borderRadius:7, border:`2px solid ${isSel?ORANGE:BORDER}`, background:isSel?ORANGE:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
                        {isSel && <Check size={12} color="#fff"/>}
                      </div>
                      {/* Avatar */}
                      <div style={{ width:38, height:38, borderRadius:'50%', background:CARD, border:`1.5px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, color:TXT2, flexShrink:0 }}>
                        {c.name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?'}
                      </div>
                      {/* Info */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <p style={{ color:TXT, fontWeight:700, fontSize:14, margin:0 }}>{c.name}</p>
                          {isFreq && <Star size={11} color={ORANGE} fill={ORANGE}/>}
                        </div>
                        <p style={{ color:TXT2, fontSize:12, margin:0 }}>{c.appts.length} visits · {formatCurrency(c.totalSpent)}</p>
                      </div>
                      {c.recent>0 && <span style={{ color:ORANGE, fontSize:11, fontWeight:700, flexShrink:0 }}>{c.recent} recent</span>}
                    </button>
                  )
                })}
              </div>

              {selected.size>0 && (
                <button onClick={()=>setStep('compose')}
                  style={{ width:'100%', background:ORANGE, color:'#fff', border:'none', borderRadius:22, padding:'17px', fontWeight:700, fontSize:16, cursor:'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:`0 4px 24px ${ORANGE}44` }}>
                  <Send size={16}/> Compose → {selected.size} client{selected.size!==1?'s':''}
                </button>
              )}
            </>
          )}

          {step==='compose' && (
            <div style={{ animation:'fadeUp 0.2s ease both' }}>
              <button onClick={()=>setStep('list')}
                style={{ background:'none', border:'none', color:TXT2, cursor:'pointer', fontSize:13, fontWeight:700, marginBottom:22, ...F, display:'flex', alignItems:'center', gap:6 }}>
                ← Back
              </button>

              {/* Recipients */}
              <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:'14px 16px', marginBottom:16 }}>
                <p style={{ color:TXT2, fontSize:11, margin:'0 0 3px' }}>Sending to</p>
                <p style={{ color:TXT, fontWeight:700, fontSize:16, margin:0 }}>{selected.size} client{selected.size!==1?'s':''}</p>
              </div>

              {/* Audience tabs (type) */}
              <div style={{ display:'flex', gap:8, marginBottom:20 }}>
                {[[false,'📢 General'],[true,'🔴 Important']].map(([imp,lbl])=>(
                  <button key={lbl} onClick={()=>setIsImportant(imp)}
                    style={{ flex:1, padding:'13px', borderRadius:14, border:`1.5px solid ${isImportant===imp?ORANGE:BORDER}`, background:isImportant===imp?`${ORANGE}18`:'transparent', color:isImportant===imp?ORANGE:TXT2, fontWeight:700, fontSize:13, cursor:'pointer', ...F, transition:'all 0.15s' }}>
                    {lbl}
                  </button>
                ))}
              </div>

              {/* Message label */}
              <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, padding:'18px', marginBottom:16 }}>
                <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:12 }}>MESSAGE</p>
                <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Type your message…" rows={5}
                  style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:TXT, fontSize:15, resize:'none', ...F, lineHeight:1.6 }}/>
                <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:10, borderTop:`1px solid ${BORDER}`, marginTop:8 }}>
                  <span style={{ color:TXT3, fontSize:11 }}>{message.length}/500</span>
                </div>
              </div>

              {/* Add image */}
              <div style={{ background:CARD, border:`2px dashed ${BORDER}`, borderRadius:16, padding:'20px', marginBottom:20, textAlign:'center', cursor:'pointer' }}>
                <p style={{ color:TXT3, fontSize:13, margin:'0 0 4px', fontWeight:600 }}>+ Add Image (Optional)</p>
                <p style={{ color:TXT3, fontSize:11, margin:0 }}>JPEG, PNG up to 5MB</p>
              </div>

              <button onClick={send} disabled={sending||!message.trim()}
                style={{ width:'100%', background:ORANGE, color:'#fff', border:'none', borderRadius:22, padding:'17px', fontWeight:700, fontSize:16, cursor:message.trim()?'pointer':'not-allowed', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:message.trim()?1:0.5, boxShadow:`0 4px 24px ${ORANGE}44` }}>
                {sending ? <div style={{ width:18, height:18, border:'2.5px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/> : <Send size={16}/>}
                {sending?'Sending…':'Send Broadcast'}
              </button>
            </div>
          )}
        </div>
      </div>
    </BarberLayout>
  )
}