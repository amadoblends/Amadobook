/**
 * BarberDashboard — Clean B&W, auto-complete, tip prompt
 */
import { useEffect, useState, useRef } from 'react'
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency, formatDuration, parseLocalDate } from '../../utils/helpers'
import { format, isToday, isTomorrow, differenceInSeconds } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { useTheme } from '../../context/ThemeContext'
import { DollarSign, Users, Clock, X, Scissors, Phone, Mail, ChevronRight, TrendingUp } from 'lucide-react'

const F   = { fontFamily:'Monda,sans-serif' }
const SC  = { pending:'#F59E0B', confirmed:'#22C55E', completed:'#3B82F6', cancelled:'#EF4444' }

// ── Countdown ────────────────────────────────────────────────────────────
function Countdown({ endTime, date }) {
  const [rem, setRem] = useState('')
  useEffect(() => {
    function calc() {
      const [y,m,d] = date.split('-').map(Number)
      const [h,mn]  = endTime.split(':').map(Number)
      const end = new Date(y,m-1,d,h,mn,0)
      const secs = differenceInSeconds(end, new Date())
      if (secs <= 0) { setRem('Done'); return }
      const m2 = Math.floor(secs/60), s2 = secs%60
      setRem(`${m2}:${String(s2).padStart(2,'0')} left`)
    }
    calc()
    const iv = setInterval(calc, 1000)
    return () => clearInterval(iv)
  }, [endTime, date])
  return <span>{rem}</span>
}

// ── Tip prompt modal ─────────────────────────────────────────────────────
function TipModal({ appt, onClose }) {
  const [tip, setTip]     = useState('')
  const [pay, setPay]     = useState(appt?.paymentMethod || 'cash')
  const [saving, setSaving] = useState(false)

  const methods = ['Cash','Square','Cash App','Zelle','Other']

  async function save() {
    setSaving(true)
    const tipAmt = parseFloat(tip) || 0
    try {
      await updateDoc(doc(db,'appointments',appt.id), {
        tip: tipAmt,
        totalWithTip: (appt.totalPrice || 0) + tipAmt,
        paymentMethod: pay.toLowerCase(),
        paymentStatus: 'paid',
        bookingStatus: 'completed',
      })
      onClose()
    } catch {}
    setSaving(false)
  }

  async function skipTip() {
    try {
      await updateDoc(doc(db,'appointments',appt.id), {
        tip: 0,
        totalWithTip: appt.totalPrice || 0,
        paymentMethod: pay.toLowerCase(),
        paymentStatus: 'paid',
        bookingStatus: 'completed',
      })
    } catch {}
    onClose()
  }

  if (!appt) return null

  return (
    <div style={{ position:'fixed', inset:0, zIndex:80, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ width:'100%', maxWidth:480, background:'var(--surface)', borderRadius:'24px 24px 0 0', border:'1px solid var(--border)', padding:'24px 20px 40px', ...F }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', margin:'0 0 4px' }}>APPOINTMENT COMPLETE</p>
            <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:18, margin:0 }}>{appt.clientName}</p>
            <p style={{ color:'var(--text-sec)', fontSize:13, margin:'2px 0 0' }}>{appt.services?.map(s=>s.name).join(', ')} · {formatCurrency(appt.totalPrice)}</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer' }}><X size={20}/></button>
        </div>

        {/* Tip input */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px', marginBottom:16 }}>
          <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:12 }}>TIP RECEIVED?</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
            {['0','5','10','15','20'].map(amt=>(
              <button key={amt} onClick={()=>setTip(amt)}
                style={{ padding:'9px 16px', borderRadius:20, border:`1.5px solid ${tip===amt?'var(--accent)':' var(--border)'}`, background:tip===amt?'var(--accent)':'transparent', color:tip===amt?'var(--accent-inv)':'var(--text-sec)', fontWeight:700, fontSize:13, cursor:'pointer', ...F }}>
                {amt==='0'?'No tip':`$${amt}`}
              </button>
            ))}
          </div>
          <div style={{ borderBottom:'1.5px solid var(--border)', paddingBottom:8 }}>
            <input type="number" value={tip} onChange={e=>setTip(e.target.value)}
              placeholder="Custom amount"
              style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:'var(--text-pri)', fontSize:16, ...F }}/>
          </div>
        </div>

        {/* Payment method */}
        <div style={{ marginBottom:20 }}>
          <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:10 }}>PAYMENT METHOD</p>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {methods.map(m=>(
              <button key={m} onClick={()=>setPay(m)}
                style={{ padding:'8px 14px', borderRadius:20, border:`1.5px solid ${pay===m?'var(--accent)':'var(--border)'}`, background:pay===m?'var(--accent)':'transparent', color:pay===m?'var(--accent-inv)':'var(--text-sec)', fontWeight:700, fontSize:12, cursor:'pointer', ...F }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Total */}
        <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', borderTop:'1px solid var(--border)', marginBottom:16 }}>
          <span style={{ color:'var(--text-sec)', fontSize:14 }}>Total collected</span>
          <span style={{ color:'var(--accent)', fontWeight:900, fontSize:18 }}>
            {formatCurrency((appt.totalPrice||0) + (parseFloat(tip)||0))}
          </span>
        </div>

        <button onClick={save} disabled={saving}
          style={{ width:'100%', background:'var(--accent)', color:'var(--accent-inv)', border:'none', borderRadius:16, padding:'16px', fontWeight:700, fontSize:16, cursor:'pointer', ...F, marginBottom:10 }}>
          {saving?'Saving…':'Mark as Paid'}
        </button>
        <button onClick={skipTip}
          style={{ width:'100%', background:'none', border:'none', color:'var(--text-sec)', fontSize:14, cursor:'pointer', ...F }}>
          Skip — mark paid without recording tip
        </button>
      </div>
    </div>
  )
}

// ── Client detail modal ──────────────────────────────────────────────────
function ClientModal({ appt, allAppts, onClose, onReschedule, onCancel }) {
  const [clientData, setClientData] = useState(null)
  const { formatTime } = useTheme()

  useEffect(() => {
    if (!appt?.clientId) return
    getDoc(doc(db,'users',appt.clientId)).then(s=>s.exists()&&setClientData(s.data()))
  },[appt])

  if (!appt) return null

  const now = new Date()
  const [y,m,d]   = appt.date.split('-').map(Number)
  const [sh,sm]   = appt.startTime.split(':').map(Number)
  const [eh,em]   = appt.endTime.split(':').map(Number)
  const startDt   = new Date(y,m-1,d,sh,sm)
  const endDt     = new Date(y,m-1,d,eh,em)
  const isNow     = now>=startDt && now<=endDt

  const related = allAppts
    .filter(a=>(appt.clientId&&a.clientId===appt.clientId)||(!appt.clientId&&a.clientEmail===appt.clientEmail&&a.clientEmail))
    .sort((a,b)=>b.date?.localeCompare(a.date))

  const visits     = related.filter(a=>a.bookingStatus==='completed').length
  const totalSpent = related.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)
  const svcCount   = {}
  related.forEach(a=>a.services?.forEach(s=>{ svcCount[s.name]=(svcCount[s.name]||0)+1 }))
  const topSvc = Object.entries(svcCount).sort((a,b)=>b[1]-a[1])[0]

  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ width:'100%', maxWidth:560, background:'var(--surface)', borderRadius:'20px 20px 0 0', border:'1px solid var(--border)', maxHeight:'88vh', overflowY:'auto', ...F }}
        onClick={e=>e.stopPropagation()}>

        {isNow && (
          <div style={{ background:'var(--accent)', padding:'10px 20px', borderRadius:'20px 20px 0 0' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--accent-inv)', animation:'pulse 1.5s infinite' }}/>
                <span style={{ color:'var(--accent-inv)', fontWeight:800, fontSize:13 }}>NOW SERVING</span>
              </div>
              <span style={{ color:'var(--accent-inv)', fontWeight:700, fontSize:13 }}>
                <Countdown endTime={appt.endTime} date={appt.date}/>
              </span>
            </div>
          </div>
        )}

        <div style={{ padding:'20px' }}>
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:52, height:52, borderRadius:'50%', overflow:'hidden', background:'var(--card)', border:`2px solid ${isNow?'var(--accent)':'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:18, color:'var(--text-pri)', flexShrink:0 }}>
                {(clientData?.photoURL||appt.clientPhotoURL)
                  ? <img src={clientData?.photoURL||appt.clientPhotoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
                  : appt.clientName?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}
              </div>
              <div>
                <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:18, margin:'0 0 3px' }}>{appt.clientName}</p>
                {appt.isGuest && <span style={{ background:'var(--card)', color:'var(--text-sec)', fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:700, border:'1px solid var(--border)' }}>Guest</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer' }}><X size={20}/></button>
          </div>

          {/* Contact */}
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
            {appt.clientEmail && <div style={{ display:'flex', alignItems:'center', gap:8 }}><Mail size={13} color="var(--text-sec)"/><span style={{ color:'var(--text-sec)', fontSize:13 }}>{appt.clientEmail}</span></div>}
            {appt.clientPhone && appt.clientPhone!=='—' && <div style={{ display:'flex', alignItems:'center', gap:8 }}><Phone size={13} color="var(--text-sec)"/><a href={`tel:${appt.clientPhone}`} style={{ color:'var(--accent)', fontSize:13, textDecoration:'none', fontWeight:600 }}>{appt.clientPhone}</a></div>}
          </div>

          {/* Today's service */}
          <div style={{ background:'var(--card)', border:`1.5px solid ${isNow?'var(--accent)44':'var(--border)'}`, borderRadius:14, padding:14, marginBottom:14 }}>
            <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>APPOINTMENT</p>
            {appt.services?.map((s,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:i<appt.services.length-1?8:0 }}>
                <div style={{ width:30, height:30, borderRadius:8, background:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Scissors size={13} color="var(--text-sec)"/>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:'0 0 1px' }}>{s.name}</p>
                  <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{formatDuration(s.duration)}</p>
                </div>
                <p style={{ color:'var(--accent)', fontWeight:800, fontSize:14, flexShrink:0 }}>{formatCurrency(s.price)}</p>
              </div>
            ))}
            <div style={{ height:1, background:'var(--border)', margin:'10px 0' }}/>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:'var(--text-sec)', fontSize:13 }}>
                {formatTime(appt.startTime)} – {formatTime(appt.endTime)} · {formatDuration(appt.totalDuration)}
              </span>
              <span style={{ color:'var(--accent)', fontWeight:900, fontSize:16 }}>{formatCurrency(appt.totalWithTip||appt.totalPrice)}</span>
            </div>
            {appt.tip>0 && <p style={{ color:'#22C55E', fontSize:12, margin:'6px 0 0' }}>+{formatCurrency(appt.tip)} tip</p>}
          </div>

          {/* Client stats */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
            {[{label:'Visits',value:visits},{label:'Spent',value:formatCurrency(totalSpent)},{label:'Top service',value:topSvc?topSvc[0]:'—',small:true}].map(s=>(
              <div key={s.label} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 8px', textAlign:'center' }}>
                <p style={{ color:'var(--accent)', fontWeight:900, fontSize:s.small?11:17, margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.value}</p>
                <p style={{ color:'var(--text-sec)', fontSize:10, margin:0 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* History */}
          {related.length>1 && (
            <div>
              <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>HISTORY ({related.length})</p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {related.slice(0,6).map(a=>(
                  <div key={a.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 10px', background:'var(--card)', border:'1px solid var(--border)', borderLeft:`3px solid ${SC[a.bookingStatus]||'var(--border)'}`, borderRadius:10, opacity:a.id===appt.id?1:0.65 }}>
                    <div>
                      <p style={{ color:a.id===appt.id?'var(--text-pri)':'var(--text-sec)', fontWeight:a.id===appt.id?700:500, fontSize:12, margin:'0 0 1px' }}>
                        {a.date?format(parseLocalDate(a.date),'MMM d, yyyy'):'—'}{a.id===appt.id?' ← today':''}
                      </p>
                      <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{a.services?.map(s=>s.name).join(', ')}</p>
                    </div>
                    <p style={{ color:a.paymentStatus==='paid'?'#22C55E':'var(--text-sec)', fontWeight:700, fontSize:12 }}>{formatCurrency(a.totalWithTip||a.totalPrice)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {appt.bookingStatus!=='completed' && appt.bookingStatus!=='cancelled' && (
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={()=>onReschedule(appt)}
                style={{ flex:1, padding:'12px', borderRadius:14, background:'var(--card)', border:'1px solid var(--border)', color:'var(--text-pri)', fontWeight:600, fontSize:14, cursor:'pointer', ...F }}>
                Reschedule
              </button>
              <button onClick={()=>onCancel(appt)}
                style={{ flex:1, padding:'12px', borderRadius:14, background:'#EF444415', border:'1px solid #EF444430', color:'#EF4444', fontWeight:600, fontSize:14, cursor:'pointer', ...F }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}

// ── Cancel modal ─────────────────────────────────────────────────────────
function CancelModal({ appt, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  async function confirm() {
    setSaving(true)
    try { await updateDoc(doc(db,'appointments',appt.id),{bookingStatus:'cancelled',cancelReason:reason}); onDone() } catch {}
    setSaving(false); onClose()
  }
  return (
    <div style={{ position:'fixed',inset:0,zIndex:70,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}
      onClick={onClose}>
      <div style={{ width:'100%',maxWidth:380,background:'var(--surface)',borderRadius:20,border:'1px solid var(--border)',padding:24,...F }}
        onClick={e=>e.stopPropagation()}>
        <p style={{ color:'var(--text-pri)',fontWeight:800,fontSize:17,marginBottom:8 }}>Cancel appointment?</p>
        <p style={{ color:'var(--text-sec)',fontSize:14,marginBottom:16 }}>{appt.clientName} · {appt.startTime}</p>
        <div style={{ borderBottom:'1.5px solid var(--border)',paddingBottom:8,marginBottom:18 }}>
          <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason (optional)"
            style={{ width:'100%',background:'transparent',border:'none',outline:'none',color:'var(--text-pri)',fontSize:16,...F }}/>
        </div>
        <div style={{ display:'flex',gap:10 }}>
          <button onClick={onClose} style={{ flex:1,padding:'13px',borderRadius:13,background:'transparent',border:'1px solid var(--border)',color:'var(--text-sec)',fontWeight:600,cursor:'pointer',...F }}>Keep it</button>
          <button onClick={confirm} disabled={saving} style={{ flex:1,padding:'13px',borderRadius:13,background:'#EF444415',border:'1px solid #EF444430',color:'#EF4444',fontWeight:700,cursor:'pointer',...F }}>
            {saving?'Cancelling…':'Yes, Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────
export default function BarberDashboard() {
  const { user }       = useAuth()
  const { formatTime } = useTheme()

  const [barber, setBarber]       = useState(null)
  const [allAppts, setAllAppts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [selectedAppt, setSelectedAppt] = useState(null)
  const [tipAppt, setTipAppt]     = useState(null)
  const [cancelAppt, setCancelAppt] = useState(null)
  const [tick, setTick]           = useState(0)

  // Tick every 30s to refresh "now serving"
  useEffect(() => {
    const iv = setInterval(() => setTick(t=>t+1), 30000)
    return () => clearInterval(iv)
  }, [])

  // Auto-complete past appointments
  async function autoComplete(appts) {
    const now = new Date()
    const done = appts.filter(a => {
      if (a.bookingStatus!=='confirmed'&&a.bookingStatus!=='pending') return false
      const [y,m,d] = (a.date||'').split('-').map(Number)
      const [eh,em] = (a.endTime||'00:00').split(':').map(Number)
      return new Date(y,m-1,d,eh,em,0) < now
    })
    for (const a of done) {
      try { await updateDoc(doc(db,'appointments',a.id),{bookingStatus:'completed'}) } catch {}
    }
    // Prompt tip for the most recently completed (today only)
    const today = format(new Date(),'yyyy-MM-dd')
    const todayJustDone = done.filter(a=>a.date===today&&a.paymentStatus!=='paid')
    if (todayJustDone.length>0 && !tipAppt) setTipAppt(todayJustDone[0])
  }

  useEffect(() => {
    if (!user) return
    async function init() {
      const bSnap = await getDocs(query(collection(db,'barbers'),where('userId','==',user.uid)))
      if (bSnap.empty) { setLoading(false); return }
      setBarber({ id:bSnap.docs[0].id, ...bSnap.docs[0].data() })
    }
    init()
  },[user])

  useEffect(() => {
    if (!barber) return
    const q = query(collection(db,'appointments'),where('barberId','==',barber.id))
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d=>({id:d.id,...d.data()}))
      setAllAppts(all); setLoading(false)
      autoComplete(all)
    })
    return unsub
  },[barber])

  if (loading) return <BarberLayout><PageLoader/></BarberLayout>

  const today  = format(new Date(),'yyyy-MM-dd')
  const now    = new Date()
  const active = allAppts.filter(a=>a.bookingStatus!=='cancelled')

  const todayAppts = active
    .filter(a=>a.date===today)
    .sort((a,b)=>a.startTime.localeCompare(b.startTime))

  const todayEarned    = todayAppts.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)
  const todayProjected = todayAppts.filter(a=>a.paymentStatus!=='paid'&&a.bookingStatus!=='cancelled').reduce((s,a)=>s+(a.totalPrice||0),0)
  const todayTips      = todayAppts.reduce((s,a)=>s+(a.tip||0),0)

  const currentAppt = todayAppts.find(a=>{
    const [y,m,d]  = a.date.split('-').map(Number)
    const [sh,sm]  = a.startTime.split(':').map(Number)
    const [eh,em]  = a.endTime.split(':').map(Number)
    return now>=new Date(y,m-1,d,sh,sm) && now<=new Date(y,m-1,d,eh,em)
  })

  const nextAppt = todayAppts.find(a=>{
    const [y,m,d]  = a.date.split('-').map(Number)
    const [sh,sm]  = a.startTime.split(':').map(Number)
    return new Date(y,m-1,d,sh,sm)>now
  })

  const upcoming = active
    .filter(a=>a.date>today)
    .sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime))
    .slice(0,5)

  return (
    <BarberLayout>
      <div style={{ padding:'20px', maxWidth:640, margin:'0 auto', ...F }}>

        {/* Greeting */}
        <div style={{ marginBottom:20 }}>
          <p style={{ color:'var(--text-sec)', fontSize:13, margin:'0 0 2px' }}>
            {now.getHours()<12?'Good morning':now.getHours()<17?'Good afternoon':'Good evening'} 👋
          </p>
          <h1 style={{ color:'var(--text-pri)', fontSize:24, fontWeight:900, margin:0 }}>
            {barber?.name || 'Dashboard'}
          </h1>
        </div>

        {/* NOW SERVING */}
        {currentAppt && (
          <button onClick={()=>setSelectedAppt(currentAppt)}
            style={{ width:'100%', background:'var(--accent)', borderRadius:18, padding:'16px 18px', marginBottom:16, border:'none', cursor:'pointer', textAlign:'left', ...F }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--accent-inv)', animation:'pulse 1.5s infinite' }}/>
                  <span style={{ color:'var(--accent-inv)', fontSize:10, fontWeight:800, letterSpacing:'0.12em', opacity:0.7 }}>NOW SERVING</span>
                </div>
                <p style={{ color:'var(--accent-inv)', fontWeight:900, fontSize:20, margin:'0 0 2px' }}>{currentAppt.clientName}</p>
                <p style={{ color:'var(--accent-inv)', opacity:0.7, fontSize:13, margin:'0 0 8px' }}>{currentAppt.services?.map(s=>s.name).join(', ')}</p>
                <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:20, padding:'5px 14px', display:'inline-flex', alignItems:'center', gap:6 }}>
                  <Clock size={12} color="var(--accent-inv)"/>
                  <span style={{ color:'var(--accent-inv)', fontWeight:700, fontSize:13 }}>
                    <Countdown endTime={currentAppt.endTime} date={currentAppt.date}/>
                  </span>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ color:'var(--accent-inv)', fontWeight:900, fontSize:22, margin:'0 0 4px' }}>{formatCurrency(currentAppt.totalPrice)}</p>
                <p style={{ color:'var(--accent-inv)', opacity:0.65, fontSize:12 }}>{formatTime(currentAppt.startTime)} – {formatTime(currentAppt.endTime)}</p>
              </div>
            </div>
          </button>
        )}

        {/* Next up */}
        {!currentAppt && nextAppt && (
          <button onClick={()=>setSelectedAppt(nextAppt)}
            style={{ width:'100%', background:'var(--card)', border:`1.5px solid var(--border)`, borderLeft:'3px solid var(--accent)', borderRadius:14, padding:'13px 16px', marginBottom:16, cursor:'pointer', textAlign:'left', ...F }}>
            <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:5 }}>NEXT UP</p>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <div>
                <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:15, margin:'0 0 2px' }}>{nextAppt.clientName}</p>
                <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{formatTime(nextAppt.startTime)} · {nextAppt.services?.map(s=>s.name).join(', ')}</p>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ color:'var(--accent)', fontWeight:800, fontSize:15, margin:0 }}>{formatCurrency(nextAppt.totalPrice)}</p>
                <ChevronRight size={14} color="var(--text-sec)" style={{marginTop:4}}/>
              </div>
            </div>
          </button>
        )}

        {/* Today stats */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px', marginBottom:16 }}>
          <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:14 }}>
            TODAY — {format(new Date(),'MMMM d')}
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div style={{ textAlign:'center' }}>
              <p style={{ color:'#22C55E', fontWeight:900, fontSize:22, margin:'0 0 2px' }}>{formatCurrency(todayEarned)}</p>
              <p style={{ color:'var(--text-sec)', fontSize:10, margin:0 }}>Earned</p>
            </div>
            <div style={{ textAlign:'center', borderLeft:'1px solid var(--border)', borderRight:'1px solid var(--border)' }}>
              <p style={{ color:'var(--accent)', fontWeight:900, fontSize:22, margin:'0 0 2px' }}>{formatCurrency(todayProjected)}</p>
              <p style={{ color:'var(--text-sec)', fontSize:10, margin:0 }}>Projected</p>
            </div>
            <div style={{ textAlign:'center' }}>
              <p style={{ color:'#22C55E', fontWeight:900, fontSize:22, margin:'0 0 2px' }}>{formatCurrency(todayTips)}</p>
              <p style={{ color:'var(--text-sec)', fontSize:10, margin:0 }}>Tips</p>
            </div>
          </div>
          {(todayEarned+todayProjected)>0 && (
            <div style={{ marginTop:12 }}>
              <div style={{ height:5, borderRadius:3, background:'var(--border)', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:3, background:'var(--accent)', width:`${Math.round(todayEarned/(todayEarned+todayProjected)*100)}%`, transition:'width 0.5s' }}/>
              </div>
              <p style={{ color:'var(--text-sec)', fontSize:11, marginTop:5, textAlign:'center' }}>
                {Math.round(todayEarned/(todayEarned+todayProjected)*100)}% collected of {formatCurrency(todayEarned+todayProjected)}
              </p>
            </div>
          )}
        </div>

        {/* Schedule */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px', marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:16, margin:0 }}>Schedule</p>
            <span style={{ background:'var(--surface)', color:'var(--text-sec)', fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20, border:'1px solid var(--border)' }}>
              {todayAppts.length} today
            </span>
          </div>

          {todayAppts.length===0 ? (
            <p style={{ color:'var(--text-sec)', fontSize:13, textAlign:'center', padding:'16px 0' }}>No appointments today</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {todayAppts.map(a=>{
                const isCur  = currentAppt?.id===a.id
                const isDone = a.bookingStatus==='completed'
                return (
                  <button key={a.id} onClick={()=>setSelectedAppt(a)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, background:isCur?'var(--accent)12':'var(--bg)', border:`1px solid ${isCur?'var(--accent)44':'var(--border)'}`, cursor:'pointer', textAlign:'left', ...F, width:'100%', opacity:isDone?0.55:1 }}>
                    {/* Avatar */}
                    <div style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', background:'var(--card)', border:`1.5px solid ${isCur?'var(--accent)':'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, color:'var(--text-sec)', flexShrink:0 }}>
                      {a.clientPhotoURL
                        ? <img src={a.clientPhotoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
                        : a.clientName?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}
                    </div>
                    {/* Time */}
                    <div style={{ flexShrink:0, textAlign:'center', minWidth:40 }}>
                      <p style={{ color:isCur?'var(--accent)':'var(--text-sec)', fontWeight:700, fontSize:11, margin:0 }}>{formatTime(a.startTime)}</p>
                      <p style={{ color:'var(--text-sec)', fontSize:10, margin:0 }}>{formatTime(a.endTime)}</p>
                    </div>
                    <div style={{ width:1, height:28, background:'var(--border)', flexShrink:0 }}/>
                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:13, margin:'0 0 1px' }}>{a.clientName}</p>
                      <p style={{ color:'var(--text-sec)', fontSize:11, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {a.services?.map(s=>s.name).join(', ')}
                      </p>
                    </div>
                    {/* Price + status */}
                    <div style={{ flexShrink:0, textAlign:'right' }}>
                      <p style={{ color:'var(--accent)', fontWeight:800, fontSize:13, margin:'0 0 2px' }}>{formatCurrency(a.totalWithTip||a.totalPrice)}</p>
                      <div style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:SC[a.bookingStatus]||'var(--border)' }}/>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Upcoming */}
        {upcoming.length>0 && (
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px' }}>
            <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:16, marginBottom:12 }}>Upcoming</p>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {upcoming.map(a=>{
                const d = parseLocalDate(a.date)
                const label = isToday(d)?'Today':isTomorrow(d)?'Tomorrow':format(d,'MMM d')
                return (
                  <button key={a.id} onClick={()=>setSelectedAppt(a)}
                    style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderRadius:12, background:'var(--bg)', border:'1px solid var(--border)', cursor:'pointer', textAlign:'left', ...F, width:'100%' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:13, margin:'0 0 1px' }}>{a.clientName}</p>
                      <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{label} · {formatTime(a.startTime)}</p>
                    </div>
                    <p style={{ color:'var(--accent)', fontWeight:800, fontSize:13, margin:0, flexShrink:0 }}>{formatCurrency(a.totalPrice)}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedAppt && (
        <ClientModal
          appt={selectedAppt}
          allAppts={allAppts}
          onClose={()=>setSelectedAppt(null)}
          onReschedule={(a)=>{ setSelectedAppt(null); /* navigate to calendar */ }}
          onCancel={(a)=>{ setSelectedAppt(null); setCancelAppt(a) }}
        />
      )}
      {tipAppt && <TipModal appt={tipAppt} onClose={()=>setTipAppt(null)}/>}
      {cancelAppt && <CancelModal appt={cancelAppt} onClose={()=>setCancelAppt(null)} onDone={()=>setCancelAppt(null)}/>}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </BarberLayout>
  )
}