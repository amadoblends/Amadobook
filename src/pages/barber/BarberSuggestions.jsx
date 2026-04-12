import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { MessageSquare, Send, Users, ChevronDown, ChevronUp, Megaphone } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '../../utils/helpers'

const F = { fontFamily:'Monda,sans-serif' }

export default function BarberSuggestions() {
  const { user } = useAuth()
  const [barber, setBarber]           = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [clients, setClients]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState('suggestions') // suggestions | broadcast
  const [expanded, setExpanded]       = useState(null)
  
  // Broadcast state
  const [subject, setSubject]     = useState('')
  const [message, setMessage]     = useState('')
  const [sending, setSending]     = useState(false)
  const [sent, setSent]           = useState(false)

  useEffect(() => {
    if (!user) return
    async function load() {
      const bSnap = await getDocs(query(collection(db,'barbers'), where('userId','==',user.uid)))
      if (bSnap.empty) { setLoading(false); return }
      const b = { id:bSnap.docs[0].id, ...bSnap.docs[0].data() }
      setBarber(b)
      // Load suggestions
      const sSnap = await getDocs(query(collection(db,'feedback'), where('barberId','==',b.id)))
      setSuggestions(sSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
      // Load registered clients (unique by clientId from appointments)
      const aSnap = await getDocs(query(collection(db,'appointments'), where('barberId','==',b.id)))
      const appts = aSnap.docs.map(d=>d.data())
      const seen  = new Set()
      const uniqueClients = []
      for (const a of appts) {
        if (a.clientId && !seen.has(a.clientId)) {
          seen.add(a.clientId)
          uniqueClients.push({ id:a.clientId, name:a.clientName, email:a.clientEmail })
        }
      }
      setClients(uniqueClients)
      setLoading(false)
    }
    load()
  }, [user])

  async function sendBroadcast() {
    if (!message.trim()) return toast.error('Write a message first')
    setSending(true)
    try {
      // Save broadcast record to Firestore
      await addDoc(collection(db,'broadcasts'), {
        barberId:   barber.id,
        barberName: barber.name,
        subject:    subject.trim() || 'Message from your barber',
        message:    message.trim(),
        recipients: clients.length,
        clientIds:  clients.map(c=>c.id),
        createdAt:  serverTimestamp(),
        status:     'sent',
      })
      setSent(true)
      toast.success(`Message sent to ${clients.length} client${clients.length!==1?'s':''}!`)
      setSubject(''); setMessage('')
      setTimeout(() => setSent(false), 3000)
    } catch(err) { console.error('Broadcast error:', err); toast.error('Failed to send: ' + (err.message || err)) }
    finally { setSending(false) }
  }

  if (loading) return <BarberLayout><PageLoader /></BarberLayout>

  return (
    <BarberLayout>
      <div style={{ padding:'20px', maxWidth:580, margin:'0 auto', ...F }}>
        <h1 style={{ fontFamily:"'Space Grotesk','Monda',sans-serif", color:'var(--text-pri)', fontSize:22, fontWeight:900, margin:'0 0 4px' }}>Messages</h1>
        <p style={{ color:'var(--text-sec)', fontSize:13, margin:'0 0 20px' }}>Client suggestions & mass broadcast</p>

        {/* Tab toggle */}
        <div style={{ display:'flex', background:'var(--surface)', borderRadius:14, padding:4, marginBottom:20, border:'1px solid var(--border)' }}>
          {[['suggestions','Suggestions'],['broadcast','Broadcast']].map(([id,lbl]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex:1, padding:'11px', borderRadius:11, fontWeight:700, fontSize:14, background:tab===id?'var(--accent)':'transparent', color:tab===id?'white':'var(--text-sec)', border:'none', cursor:'pointer', ...F, transition:'all 0.15s' }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* SUGGESTIONS */}
        {tab === 'suggestions' && (
          <div>
            {suggestions.length === 0 ? (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:40, textAlign:'center' }}>
                <MessageSquare size={28} style={{ color:'var(--text-sec)', opacity:0.4, margin:'0 auto 10px', display:'block' }}/>
                <p style={{ color:'var(--text-sec)', margin:0 }}>No suggestions yet</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {suggestions.map(s => (
                  <div key={s.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
                    <button onClick={() => setExpanded(expanded===s.id?null:s.id)}
                      style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'none', border:'none', cursor:'pointer', ...F }}>
                      <div style={{ textAlign:'left', flex:1, minWidth:0 }}>
                        <p style={{ color:'var(--text-pri)', fontWeight:600, fontSize:14, margin:'0 0 3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {s.message?.slice(0,60)}{s.message?.length>60?'…':''}
                        </p>
                        <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>
                          {s.createdAt?.toDate?.()?.toLocaleDateString() || 'Anonymous'}
                        </p>
                      </div>
                      {expanded===s.id ? <ChevronUp size={16} style={{color:'var(--text-sec)',flexShrink:0}}/> : <ChevronDown size={16} style={{color:'var(--text-sec)',flexShrink:0}}/>}
                    </button>
                    {expanded===s.id && (
                      <div style={{ padding:'0 16px 14px', borderTop:'1px solid var(--border)' }}>
                        <p style={{ color:'var(--text-pri)', fontSize:14, lineHeight:1.6, margin:'12px 0 0' }}>{s.message}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BROADCAST */}
        {tab === 'broadcast' && (
          <div>
            {/* Client count */}
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'var(--accent)20', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Users size={18} style={{ color:'var(--accent)' }}/>
              </div>
              <div>
                <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:15, margin:'0 0 1px' }}>{clients.length} registered client{clients.length!==1?'s':''}</p>
                <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>Will receive this message</p>
              </div>
            </div>

            {clients.length === 0 ? (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:32, textAlign:'center', marginBottom:16 }}>
                <p style={{ color:'var(--text-sec)', margin:0, fontSize:13 }}>No registered clients yet. Clients who book with an account will appear here.</p>
              </div>
            ) : (
              <div>
                {/* Subject */}
                <div style={{ marginBottom:14 }}>
                  <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:6 }}>SUBJECT (optional)</p>
                  <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Special offer this week!"
                    style={{ width:'100%', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:12, padding:'13px 14px', color:'var(--text-pri)', fontSize:15, outline:'none', ...F, boxSizing:'border-box' }} autoComplete='off'/>
                </div>

                {/* Message */}
                <div style={{ marginBottom:14 }}>
                  <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:6 }}>MESSAGE *</p>
                  <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={5}
                    placeholder="Hey! Just wanted to let you know about our new services..."
                    style={{ width:'100%', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:12, padding:'13px 14px', color:'var(--text-pri)', fontSize:15, outline:'none', resize:'vertical', ...F, boxSizing:'border-box' }}/>
                  <p style={{ color:'var(--text-sec)', fontSize:11, marginTop:5 }}>{message.length} characters</p>
                </div>

                {/* Templates */}
                <div style={{ marginBottom:16 }}>
                  <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>QUICK TEMPLATES</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {[
                      { label:'🎉 Special offer', text:'Hey! We have a special offer this week. Book before this Sunday and get 10% off your next cut. See you soon!' },
                      { label:'📅 Open slots', text:"Hi! We have some last-minute openings this week. Book now before they're gone!" },
                      { label:'⭐ New service', text:'Exciting news! We just added new services. Check them out and book your appointment.' },
                    ].map(t => (
                      <button key={t.label} onClick={() => setMessage(t.text)}
                        style={{ padding:'10px 14px', borderRadius:12, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text-sec)', fontSize:13, cursor:'pointer', textAlign:'left', ...F }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={sendBroadcast} disabled={sending || !message.trim()}
                  style={{ width:'100%', background: sent?'#16A34A':'var(--accent)', border:'none', borderRadius:14, padding:'16px', color:'white', fontWeight:700, fontSize:15, cursor:message.trim()?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:message.trim()?1:0.5, ...F, boxShadow:'0 4px 16px rgba(255,92,0,0.3)' }}>
                  {sending
                    ? <div style={{ width:18, height:18, border:'2.5px solid white', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                    : <Send size={16}/>}
                  {sending?'Sending...' : sent?'Sent! ✓' : `Send to ${clients.length} client${clients.length!==1?'s':''}`}
                </button>

                <p style={{ color:'var(--text-sec)', fontSize:11, textAlign:'center', marginTop:10 }}>
                  Messages are saved in your dashboard. Email delivery coming soon.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </BarberLayout>
  )
}
