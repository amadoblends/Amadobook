import { useEffect, useState, useRef } from 'react'
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore'
import { db, storage } from '../../lib/firebase'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration, parseLocalDate } from '../../utils/helpers'
import { format, isToday, isTomorrow, differenceInMinutes, differenceInSeconds } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { useTheme } from '../../context/ThemeContext'
import { DollarSign, Users, Clock, X, Scissors, Phone, Mail, Star, ChevronRight } from 'lucide-react'

const F = { fontFamily:'Monda,sans-serif' }
const SC = { pending:'#f59e0b', confirmed:'#16A34A', completed:'#3b82f6', cancelled:'#ef4444' }

// ── Countdown timer ────────────────────────────────────────────────────────
function Countdown({ endTime, date }) {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    function calc() {
      const [y,m,d2] = date.split('-').map(Number)
      const [h,mn]   = endTime.split(':').map(Number)
      const end = new Date(y,m-1,d2,h,mn,0)
      const secs = differenceInSeconds(end, new Date())
      if (secs <= 0) { setRemaining('Done'); return }
      const m2 = Math.floor(secs/60), s2 = secs%60
      setRemaining(`${m2}:${String(s2).padStart(2,'0')} left`)
    }
    calc()
    const iv = setInterval(calc, 1000)
    return () => clearInterval(iv)
  }, [endTime, date])
  return <span>{remaining}</span>
}

// ── Client detail modal ────────────────────────────────────────────────────
function ClientModal({ appt, allAppts, onClose }) {
  const [clientData, setClientData] = useState(null)
  const [clientAppts, setClientAppts] = useState([])

  useEffect(() => {
    if (!appt) return
    // Load client user doc if registered
    if (appt.clientId) {
      getDoc(doc(db,'users',appt.clientId)).then(snap => {
        if (snap.exists()) setClientData(snap.data())
      })
    }
    // All appointments for this client (by email or clientId)
    const related = allAppts.filter(a =>
      (appt.clientId && a.clientId === appt.clientId) ||
      (!appt.clientId && a.clientEmail === appt.clientEmail && a.clientEmail)
    ).sort((a,b) => b.date?.localeCompare(a.date))
    setClientAppts(related)
  }, [appt])

  if (!appt) return null

  const visits    = clientAppts.filter(a=>a.bookingStatus==='completed').length
  const totalSpent = clientAppts.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalPrice||0),0)
  const svcCount  = {}
  clientAppts.forEach(a=>a.services?.forEach(s=>{ svcCount[s.name]=(svcCount[s.name]||0)+1 }))
  const topSvc = Object.entries(svcCount).sort((a,b)=>b[1]-a[1])[0]

  // Is this appointment currently happening?
  const now = new Date()
  const [y,m,d] = appt.date.split('-').map(Number)
  const [sh,sm] = appt.startTime.split(':').map(Number)
  const [eh,em] = appt.endTime.split(':').map(Number)
  const startDt = new Date(y,m-1,d,sh,sm)
  const endDt   = new Date(y,m-1,d,eh,em)
  const isNow   = now >= startDt && now <= endDt

  const photo = clientData?.photoURL || appt.clientPhotoURL

  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ width:'100%', maxWidth:560, background:'var(--surface)', borderRadius:'20px 20px 0 0', border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto', ...F }}
        onClick={e=>e.stopPropagation()}>

        {/* Header — NOW SERVING callout if current */}
        {isNow && (
          <div style={{ background:'var(--accent)', padding:'10px 20px', borderRadius:'20px 20px 0 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'white', animation:'pulse 1.5s infinite' }}/>
              <span style={{ color:'white', fontWeight:800, fontSize:14 }}>NOW SERVING</span>
            </div>
            <div style={{ background:'rgba(255,255,255,0.25)', borderRadius:20, padding:'4px 12px' }}>
              <span style={{ color:'white', fontWeight:700, fontSize:13 }}>
                <Countdown endTime={appt.endTime} date={appt.date}/>
              </span>
            </div>
          </div>
        )}

        <div style={{ padding:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              {/* Client photo */}
              <div style={{ width:56, height:56, borderRadius:'50%', overflow:'hidden', background:'var(--accent)22', border:`2px solid ${isNow?'var(--accent)':'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:20, color:'var(--accent)', flexShrink:0 }}>
                {photo ? <img src={photo} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : (appt.clientName?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2))}
              </div>
              <div>
                <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:18, margin:'0 0 3px' }}>{appt.clientName}</p>
                {appt.isGuest && <span style={{ background:'#8b5cf622', color:'#7c3aed', fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:700 }}>Guest</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer', padding:4 }}><X size={20}/></button>
          </div>

          {/* Contact */}
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
            {appt.clientEmail && <div style={{ display:'flex', alignItems:'center', gap:8 }}><Mail size={13} style={{color:'var(--text-sec)',flexShrink:0}}/><span style={{ color:'var(--text-sec)', fontSize:13 }}>{appt.clientEmail}</span></div>}
            {appt.clientPhone && appt.clientPhone !== '—' && <div style={{ display:'flex', alignItems:'center', gap:8 }}><Phone size={13} style={{color:'var(--text-sec)',flexShrink:0}}/><a href={`tel:${appt.clientPhone}`} style={{ color:'var(--accent)', fontSize:13, textDecoration:'none', fontWeight:600 }}>{appt.clientPhone}</a></div>}
          </div>

          {/* Today's service — PROMINENT */}
          <div style={{ background: isNow?'var(--accent)15':'var(--card)', border:`1.5px solid ${isNow?'var(--accent)33':'var(--border)'}`, borderRadius:14, padding:'14px', marginBottom:14 }}>
            <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>TODAY'S SERVICE</p>
            {appt.services?.map((s,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:i<appt.services.length-1?8:0 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:'var(--accent)20', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Scissors size={14} style={{color:'var(--accent)'}}/>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:15, margin:'0 0 1px' }}>{s.name}</p>
                  <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{formatDuration(s.duration)}</p>
                </div>
                <p style={{ color:'var(--accent)', fontWeight:800, fontSize:15, flexShrink:0 }}>{formatCurrency(s.price)}</p>
              </div>
            ))}
            <div style={{ height:1, background:'var(--border)', margin:'10px 0' }}/>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:'var(--text-sec)', fontSize:13 }}>
                <Clock size={11} style={{marginRight:4, verticalAlign:'middle'}}/>{appt.startTime} – {appt.endTime} ({formatDuration(appt.totalDuration)})
              </span>
              <span style={{ color:'var(--accent)', fontWeight:900, fontSize:16 }}>{formatCurrency(appt.totalPrice)}</span>
            </div>
          </div>

          {/* Client stats */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
            {[
              { label:'Visits',   value: visits },
              { label:'Spent',    value: formatCurrency(totalSpent) },
              { label:'Favorite', value: topSvc?topSvc[0]:'—', small:true },
            ].map(s => (
              <div key={s.label} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 8px', textAlign:'center' }}>
                <p style={{ color:'var(--accent)', fontWeight:900, fontSize:s.small?12:18, margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.value}</p>
                <p style={{ color:'var(--text-sec)', fontSize:10, margin:0 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Appointment history */}
          {clientAppts.length > 1 && (
            <div>
              <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>HISTORY ({clientAppts.length})</p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {clientAppts.slice(0,5).map(a => (
                  <div key={a.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 10px', background:'var(--card)', border:'1px solid var(--border)', borderLeft:`3px solid ${SC[a.bookingStatus]||'#555'}`, borderRadius:10, opacity:a.id===appt.id?1:0.75 }}>
                    <div>
                      <p style={{ color:a.id===appt.id?'var(--accent)':'var(--text-pri)', fontWeight:a.id===appt.id?700:600, fontSize:12, margin:'0 0 1px' }}>
                        {a.date?format(parseLocalDate(a.date),'MMM d, yyyy'):'—'}
                        {a.id===appt.id?' ← today':''}
                      </p>
                      <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{a.services?.map(s=>s.name).join(', ')}</p>
                    </div>
                    <p style={{ color:a.paymentStatus==='paid'?'#16A34A':'var(--text-sec)', fontWeight:700, fontSize:12 }}>{formatCurrency(a.totalPrice)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function BarberDashboard() {
  const { user } = useAuth()
  const { formatTime } = useTheme()
  const [barber, setBarber]     = useState(null)
  const [allAppts, setAllAppts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [selectedAppt, setSelectedAppt] = useState(null)
  const refreshRef = useRef(null)
  const [tick, setTick] = useState(0)  // for live stats refresh

  // Tick every minute to update "now serving"
  useEffect(() => {
    const iv = setInterval(() => setTick(t=>t+1), 60000)
    return () => clearInterval(iv)
  }, [])

  async function autoCompletePast(appts) {
    const now = new Date()
    const toComplete = appts.filter(a => {
      if (a.bookingStatus!=='confirmed'&&a.bookingStatus!=='pending') return false
      const [y,m,d]=(a.date||'').split('-').map(Number)
      const [eh,em]=(a.endTime||'00:00').split(':').map(Number)
      return new Date(y,m-1,d,eh,em,0) < now
    })
    for (const a of toComplete) {
      try { await updateDoc(doc(db,'appointments',a.id),{bookingStatus:'completed'}) } catch {}
    }
    if (toComplete.length>0) setAllAppts(p=>p.map(a=>toComplete.find(t=>t.id===a.id)?{...a,bookingStatus:'completed'}:a))
  }

  async function loadData(barberId) {
    const snap = await getDocs(query(collection(db,'appointments'),where('barberId','==',barberId)))
    const all  = snap.docs.map(d=>({id:d.id,...d.data()}))
    setAllAppts(all); setLoading(false)
    autoCompletePast(all)
  }

  useEffect(() => {
    if (!user) return
    async function init() {
      const bSnap = await getDocs(query(collection(db,'barbers'),where('userId','==',user.uid)))
      if (bSnap.empty) { setLoading(false); return }
      const b = { id:bSnap.docs[0].id,...bSnap.docs[0].data() }
      setBarber(b); await loadData(b.id)
    }
    init()
  }, [user])

  useEffect(() => {
    if (barber) { clearInterval(refreshRef.current); refreshRef.current=setInterval(()=>loadData(barber.id),20000) }
    return ()=>clearInterval(refreshRef.current)
  }, [barber])

  if (loading) return <BarberLayout><PageLoader/></BarberLayout>

  const today = format(new Date(),'yyyy-MM-dd')
  const active = allAppts.filter(a=>a.bookingStatus!=='cancelled')

  const todayAppts = active
    .filter(a=>a.date===today)
    .sort((a,b)=>a.startTime.localeCompare(b.startTime))

  // Daily earnings: paid today + projected (confirmed/pending today not yet paid)
  const todayEarned    = todayAppts.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)
  const todayProjected = todayAppts.filter(a=>a.paymentStatus!=='paid').reduce((s,a)=>s+(a.totalPrice||0),0)
  const todayTotal     = todayEarned + todayProjected

  // Unique clients TODAY (different people, not total ever)
  const todayClientSet = new Set(todayAppts.map(a=>a.clientId||a.clientEmail||a.clientName))
  const todayUniqueClients = todayClientSet.size

  // Pending payment overall
  const pendingPay = active.filter(a=>a.paymentStatus!=='paid').reduce((s,a)=>s+(a.totalPrice||0),0)

  // Now serving
  const now = new Date()
  const currentAppt = todayAppts.find(a => {
    const [y,m,d]=(a.date).split('-').map(Number)
    const [sh,sm]=a.startTime.split(':').map(Number)
    const [eh,em]=a.endTime.split(':').map(Number)
    const start=new Date(y,m-1,d,sh,sm), end=new Date(y,m-1,d,eh,em)
    return now>=start&&now<=end
  })

  // Next up (first appointment after now today)
  const nextAppt = todayAppts.find(a => {
    const [y,m,d]=(a.date).split('-').map(Number)
    const [sh,sm]=a.startTime.split(':').map(Number)
    return new Date(y,m-1,d,sh,sm) > now
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

        {/* NOW SERVING — distinct card */}
        {currentAppt && (
          <button onClick={()=>setSelectedAppt(currentAppt)}
            style={{ width:'100%', background:`linear-gradient(135deg,var(--accent),var(--accent)cc)`, borderRadius:18, padding:'16px 18px', marginBottom:16, color:'white', border:'none', cursor:'pointer', textAlign:'left', ...F, boxShadow:'0 8px 28px var(--accent)44' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'white', animation:'pulse 1.5s infinite' }}/>
                  <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.12em', opacity:0.85 }}>NOW SERVING</span>
                </div>
                <p style={{ fontWeight:900, fontSize:20, margin:'0 0 2px' }}>{currentAppt.clientName}</p>
                <p style={{ opacity:0.8, fontSize:13, margin:'0 0 8px' }}>{currentAppt.services?.map(s=>s.name).join(', ')}</p>
                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:20, padding:'5px 14px', display:'inline-flex', alignItems:'center', gap:6 }}>
                  <Clock size={12}/>
                  <span style={{ fontWeight:700, fontSize:13 }}><Countdown endTime={currentAppt.endTime} date={currentAppt.date}/></span>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontWeight:900, fontSize:22, margin:'0 0 4px' }}>{formatCurrency(currentAppt.totalPrice)}</p>
                <p style={{ opacity:0.75, fontSize:12 }}>{formatTime(currentAppt.startTime)} – {formatTime(currentAppt.endTime)}</p>
                <p style={{ opacity:0.6, fontSize:11, marginTop:6 }}>Tap for client info →</p>
              </div>
            </div>
          </button>
        )}

        {/* Next up — if not currently serving */}
        {!currentAppt && nextAppt && (
          <button onClick={()=>setSelectedAppt(nextAppt)}
            style={{ width:'100%', background:'var(--card)', border:'1.5px solid var(--accent)44', borderLeft:'3px solid var(--accent)', borderRadius:14, padding:'13px 16px', marginBottom:16, cursor:'pointer', textAlign:'left', ...F }}>
            <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:5 }}>NEXT UP</p>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <div>
                <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:15, margin:'0 0 2px' }}>{nextAppt.clientName}</p>
                <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{formatTime(nextAppt.startTime)} · {nextAppt.services?.map(s=>s.name).join(', ')}</p>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ color:'var(--accent)', fontWeight:800, fontSize:15, margin:0 }}>{formatCurrency(nextAppt.totalPrice)}</p>
                <ChevronRight size={14} style={{color:'var(--text-sec)',marginTop:4}}/>
              </div>
            </div>
          </button>
        )}

        {/* TODAY STATS — daily focus */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px', marginBottom:16, boxShadow:'var(--shadow)' }}>
          <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:14 }}>TODAY — {format(new Date(),'MMMM d')}</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            {/* Earnings */}
            <div style={{ textAlign:'center' }}>
              <p style={{ color:'#16A34A', fontWeight:900, fontSize:22, margin:'0 0 2px' }}>{formatCurrency(todayEarned)}</p>
              <p style={{ color:'var(--text-sec)', fontSize:10, margin:0 }}>Earned</p>
            </div>
            {/* Projected */}
            <div style={{ textAlign:'center', borderLeft:'1px solid var(--border)', borderRight:'1px solid var(--border)' }}>
              <p style={{ color:'#f59e0b', fontWeight:900, fontSize:22, margin:'0 0 2px' }}>{formatCurrency(todayProjected)}</p>
              <p style={{ color:'var(--text-sec)', fontSize:10, margin:0 }}>Projected</p>
            </div>
            {/* Unique clients today */}
            <div style={{ textAlign:'center' }}>
              <p style={{ color:'var(--accent)', fontWeight:900, fontSize:22, margin:'0 0 2px' }}>{todayUniqueClients}</p>
              <p style={{ color:'var(--text-sec)', fontSize:10, margin:0 }}>Client{todayUniqueClients!==1?'s':''} today</p>
            </div>
          </div>
          {todayProjected > 0 && (
            <div style={{ marginTop:12, height:6, borderRadius:3, background:'var(--border)', overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:3, background:'linear-gradient(90deg,#16A34A,var(--accent))', width:`${todayTotal>0?(todayEarned/todayTotal*100):0}%`, transition:'width 0.5s' }}/>
            </div>
          )}
          {todayProjected > 0 && (
            <p style={{ color:'var(--text-sec)', fontSize:11, marginTop:6, textAlign:'center' }}>
              Total day: {formatCurrency(todayTotal)} ({Math.round(todayTotal>0?todayEarned/todayTotal*100:0)}% collected)
            </p>
          )}
        </div>

        {/* Appointments list — tappable for client detail */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px', marginBottom:16, boxShadow:'var(--shadow)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:16, margin:0 }}>Schedule</p>
            <span style={{ background:'var(--accent)20', color:'var(--accent)', fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20 }}>
              {todayAppts.length} today
            </span>
          </div>
          {todayAppts.length===0 ? (
            <p style={{ color:'var(--text-sec)', fontSize:13, textAlign:'center', padding:'16px 0' }}>No appointments today</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {todayAppts.map(a => {
                const isCurrent = currentAppt?.id===a.id
                const photo = a.clientPhotoURL
                return (
                  <button key={a.id} onClick={()=>setSelectedAppt(a)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:12, background:isCurrent?'var(--accent)12':'var(--bg)', border:`1px solid ${isCurrent?'var(--accent)44':'var(--border)'}`, cursor:'pointer', textAlign:'left', ...F, width:'100%' }}>
                    {/* Client avatar */}
                    <div style={{ width:38, height:38, borderRadius:'50%', overflow:'hidden', background:'var(--accent)22', border:`2px solid ${isCurrent?'var(--accent)':'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, color:'var(--accent)', flexShrink:0 }}>
                      {photo?<img src={photo} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:a.clientName?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}
                    </div>
                    <div style={{ flexShrink:0, textAlign:'center', minWidth:42 }}>
                      <p style={{ color:isCurrent?'var(--accent)':'var(--text-sec)', fontWeight:700, fontSize:12, margin:0 }}>{formatTime(a.startTime)}</p>
                      <p style={{ color:'var(--text-sec)', fontSize:10, margin:0 }}>{formatTime(a.endTime)}</p>
                    </div>
                    <div style={{ width:1, height:30, background:'var(--border)', flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:'0 0 1px' }}>{a.clientName}</p>
                      <p style={{ color:'var(--text-sec)', fontSize:12, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {a.services?.map(s=>s.name).join(', ')} · {formatDuration(a.totalDuration)}
                      </p>
                    </div>
                    <div style={{ flexShrink:0, textAlign:'right' }}>
                      <p style={{ color:'var(--accent)', fontWeight:800, fontSize:13, margin:'0 0 2px' }}>{formatCurrency(a.totalPrice)}</p>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:8, background:a.paymentStatus==='paid'?'#16A34A22':'var(--border)', color:a.paymentStatus==='paid'?'#16A34A':'var(--text-sec)' }}>
                        {a.paymentStatus==='paid'?'Paid':'Unpaid'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Upcoming */}
        {upcoming.length>0 && (
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px', boxShadow:'var(--shadow)' }}>
            <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:16, marginBottom:12 }}>Upcoming</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {upcoming.map(a => {
                const d = parseLocalDate(a.date)
                const label = isToday(d)?'Today':isTomorrow(d)?'Tomorrow':format(d,'MMM d')
                return (
                  <button key={a.id} onClick={()=>setSelectedAppt(a)}
                    style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderRadius:12, background:'var(--bg)', border:'1px solid var(--border)', cursor:'pointer', textAlign:'left', ...F, width:'100%' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:13, margin:'0 0 1px' }}>{a.clientName}</p>
                      <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{label} · {formatTime(a.startTime)}</p>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <p style={{ color:'var(--accent)', fontWeight:800, fontSize:13, margin:0 }}>{formatCurrency(a.totalPrice)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Client detail modal */}
      {selectedAppt && (
        <ClientModal
          appt={selectedAppt}
          allAppts={allAppts}
          onClose={()=>setSelectedAppt(null)}
        />
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </BarberLayout>
  )
}
