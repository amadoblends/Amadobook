import { useEffect, useState, useRef } from 'react'
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { storage, db } from '../../lib/firebase'
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'
import { formatCurrency, formatDuration, parseLocalDate, generateTimeSlots } from '../../utils/helpers'
import { useTheme } from '../../context/ThemeContext'
import { format, isFuture, isPast, differenceInDays, subMonths, eachMonthOfInterval, addDays, startOfDay, isToday, isSameDay } from 'date-fns'
import toast from 'react-hot-toast'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import ImportantMessagePopup from '../../components/ui/ImportantMessagePopup'
import PhoneInput from '../../components/ui/PhoneInput'
import { Scissors, User, X, Navigation, RefreshCw, ChevronLeft, ChevronRight, Bell, ArrowLeft, Check, DollarSign, Calendar, Clock, Sparkles } from 'lucide-react'

const F = { fontFamily:"'DM Sans', system-ui, sans-serif" }

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800;900&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  .fade-up { animation: fadeUp 0.3s cubic-bezier(0.22,1,0.36,1) both; }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
`

const C = { bg: '#0D0D0D', card: '#171717', card2: '#1F1F1F', border: '#2A2A2A', orange: '#FF6B1A', txt: '#F5F5F5', txt2: '#888888' }

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return { text:'Good morning', emoji:'☀️' }
  if (h < 17) return { text:'Good afternoon', emoji:'👋' }
  return { text:'Good evening', emoji:'🌙' }
}

function NotifBell({ userId, onOpen }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!userId) return
    getDocs(query(collection(db,'notifications'), where('userId','==',userId), where('read','==',false)))
      .then(s => setCount(s.size))
    const iv = setInterval(() => {
      getDocs(query(collection(db,'notifications'), where('userId','==',userId), where('read','==',false)))
        .then(s => setCount(s.size))
    }, 20000)
    return () => clearInterval(iv)
  }, [userId])
  return (
    <button onClick={onOpen} style={{ position:'relative', background:C.card, border:`1px solid ${C.border}`, borderRadius:12, cursor:'pointer', padding:'8px', color:C.txt2, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <Bell size={18} strokeWidth={1.5}/>
      {count > 0 && <div style={{ position:'absolute', top:4, right:4, width:8, height:8, borderRadius:'50%', background:C.orange, border:`2px solid ${C.card}` }}/>}
    </button>
  )
}

function NotificationsPanel({ userId, onClose }) {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const typeIcon = { broadcast:'📢', reschedule:'📅', cancel:'❌', booking:'✅', system:'ℹ️' }

  useEffect(() => {
    if (!userId) return
    getDocs(query(collection(db,'notifications'), where('userId','==',userId)))
      .then(snap => {
        const all = snap.docs.map(d=>({id:d.id,...d.data()}))
          .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
        setNotifs(all)
        setLoading(false)
        snap.docs.filter(d=>!d.data().read).forEach(d => updateDoc(doc(db,'notifications',d.id),{read:true}))
      })
  }, [userId])

  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, background:'rgba(13,13,13,0.85)' }} onClick={onClose}>
      <div style={{ position:'absolute', top:0, right:0, bottom:0, width:Math.min(300, window.innerWidth), background:C.bg, borderLeft:`1px solid ${C.border}`, display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px', borderBottom:`1px solid ${C.border}` }}>
          <p style={{ color:C.txt, fontWeight:800, fontSize:16, margin:0, ...F }}>Notifications</p>
          <button onClick={onClose} style={{ background:C.card, border:'none', borderRadius:10, color:C.txt2, cursor:'pointer', padding:'6px' }}><X size={16}/></button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'12px' }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:40 }}><div style={{ width:22, height:22, border:`2.5px solid ${C.border}`, borderTopColor:C.orange, borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto' }}/></div>
          ) : notifs.length === 0 ? (
            <div style={{ textAlign:'center', padding:40 }}><Bell size={28} style={{ color:C.border, margin:'0 auto 10px', display:'block' }}/><p style={{ color:C.txt3, ...F, fontSize:13 }}>No notifications yet</p></div>
          ) : notifs.map(n => (
            <div key={n.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'12px', marginBottom:8 }}>
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ fontSize:16, flexShrink:0 }}>{typeIcon[n.type]||'ℹ️'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color:C.txt, fontWeight:700, fontSize:13, margin:'0 0 3px', ...F }}>{n.title}</p>
                  <p style={{ color:C.txt2, fontSize:12, margin:'0 0 4px', lineHeight:1.5 }}>{n.message}</p>
                  <p style={{ color:C.txt3, fontSize:9, margin:0, fontWeight:700 }}>{n.createdAt?.toDate?.()?.toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) || ''}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SpendDetail({ appointments, onBack }) {
  const months = eachMonthOfInterval({ start: subMonths(new Date(),5), end: new Date() })
  const monthlyData = months.map(m => {
    const key = format(m,'yyyy-MM')
    const spent = appointments.filter(a=>a.date?.startsWith(key)&&a.paymentStatus==='paid'&&a.bookingStatus==='completed').reduce((s,a)=>s+(a.totalPrice||0),0)
    const count = appointments.filter(a=>a.date?.startsWith(key)&&a.bookingStatus==='completed').length
    return { label:format(m,'MMMM yyyy'), key, spent, count }
  })
  const maxSpend = Math.max(...monthlyData.map(m=>m.spent),1)
  const totalSpent = appointments.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalPrice||0),0)

  return (
    <div style={{ padding:'16px', maxWidth:520, margin:'0 auto', ...F }} className="fade-up">
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, color:C.txt, fontWeight:700, fontSize:13, background:'none', border:'none', cursor:'pointer', marginBottom:20, ...F }}>
        <ArrowLeft size={14}/> Back
      </button>
      <h2 style={{ color:C.txt, fontWeight:900, fontSize:24, margin:'0 0 4px', letterSpacing:'-1px' }}>Spending</h2>
      <p style={{ color:C.txt2, fontSize:13, marginBottom:20 }}>Your barbershop history</p>

      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'16px', marginBottom:12 }}>
        <p style={{ color:C.txt2, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:6 }}>ALL-TIME SPENT</p>
        <p style={{ color:C.txt, fontWeight:900, fontSize:32, margin:0, letterSpacing:'-1px' }}>{formatCurrency(totalSpent)}</p>
      </div>

      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'16px', marginBottom:12 }}>
        <p style={{ color:C.txt2, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:16 }}>BY MONTH</p>
        <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:80, marginBottom:16 }}>
          {monthlyData.map((m,i) => (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <div style={{ width:'100%', borderRadius:'4px 4px 0 0', background:i===monthlyData.length-1?C.orange:C.card2, height:m.spent>0?`${Math.max((m.spent/maxSpend)*64,4)}px`:'4px', transition:'height 0.4s' }}/>
              <span style={{ color:C.txt2, fontSize:9, fontWeight:700 }}>{format(months[i],'MMM')}</span>
            </div>
          ))}
        </div>
        {monthlyData.filter(m=>m.spent>0).map(m => (
          <div key={m.key} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${C.border}` }}>
            <span style={{ color:C.txt, fontSize:13, fontWeight:500 }}>{m.label}</span>
            <div style={{ textAlign:'right' }}>
              <span style={{ color:C.txt, fontWeight:700, fontSize:13 }}>{formatCurrency(m.spent)}</span>
              <span style={{ color:C.txt2, fontSize:11, marginLeft:8 }}>{m.count} visit{m.count!==1?'s':''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function VisitHistory({ appointments, onBack }) {
  const done = appointments.filter(a => a.bookingStatus==='completed'||isPast(new Date(`${a.date}T${a.startTime}`))).sort((a,b)=>b.date?.localeCompare(a.date)||0)

  function ApptCardH({ a }) {
    const isCancelled = a.bookingStatus === 'cancelled'
    const isCompleted = a.bookingStatus === 'completed'

    let cardBg = C.card, cardBorder = `1px solid ${C.border}`, leftBorder = `3px solid ${C.border}`, opacity = 1
    if (isCancelled) { cardBg = 'rgba(239,68,68,0.06)'; cardBorder = '1px solid rgba(239,68,68,0.18)'; leftBorder = '3px solid rgba(239,68,68,0.5)'; opacity = 0.7 }
    else if (isCompleted) { cardBg = 'rgba(34,197,94,0.05)'; cardBorder = '1px solid rgba(34,197,94,0.15)'; leftBorder = '3px solid rgba(34,197,94,0.4)' }

    return (
      <div style={{ background:cardBg, border:cardBorder, borderLeft:leftBorder, borderRadius:14, padding:'14px', marginBottom:10, opacity }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          <div>
            <p style={{ color:C.txt, fontWeight:800, fontSize:14, margin:'0 0 2px', textDecoration:isCancelled?'line-through':'none' }}>{a.date?format(parseLocalDate(a.date),'EEE, MMM d, yy'):'—'}</p>
            <p style={{ color:C.txt2, fontSize:12, margin:0 }}>{a.startTime} · {formatDuration(a.totalDuration)}</p>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ color:C.txt, fontWeight:900, fontSize:15, margin:'0 0 4px', textDecoration:isCancelled?'line-through':'none' }}>{formatCurrency(a.totalPrice)}</p>
            <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', padding:'3px 8px', borderRadius:20, background: isCancelled?'rgba(239,68,68,0.12)':isCompleted?'rgba(34,197,94,0.12)':C.card2, color: isCancelled?'#ef4444':isCompleted?'#22C55E':C.txt2 }}>
              {a.bookingStatus}
            </span>
          </div>
        </div>
        {a.services?.length>0 && <p style={{ color:C.txt2, fontSize:12, margin:'6px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.services.map(s=>s.name).join(', ')}</p>}
        {a.tip>0 && <p style={{ color:'#22C55E', fontSize:11, marginTop:4, fontWeight:700 }}>+ {formatCurrency(a.tip)} tip</p>}
      </div>
    )
  }

  return (
    <div style={{ padding:'16px', maxWidth:520, margin:'0 auto', ...F }} className="fade-up">
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, color:C.txt, fontWeight:700, fontSize:13, background:'none', border:'none', cursor:'pointer', marginBottom:20, ...F }}>
        <ArrowLeft size={14}/> Back
      </button>
      <h2 style={{ color:C.txt, fontWeight:900, fontSize:24, margin:'0 0 4px', letterSpacing:'-1px' }}>All Visits</h2>
      <p style={{ color:C.txt2, fontSize:13, marginBottom:20 }}>{done.length} total appointment{done.length!==1?'s':''}</p>
      {done.length===0 ? (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:32, textAlign:'center' }}>
          <p style={{ color:C.txt2, margin:0, fontSize:13, fontWeight:500 }}>No visits yet</p>
        </div>
      ) : done.map(a => <ApptCardH key={a.id} a={a}/>)}
    </div>
  )
}

function ProfileView({ user, userData, onSave, onSignOut }) {
  const [form, setForm] = useState({ firstName: userData?.firstName||'', lastName: userData?.lastName||'', phone: userData?.phone||'', photoURL: userData?.photoURL||'' })
  const [saving, setSaving] = useState(false)
  const photoRef = useRef(null)

  async function save() {
    setSaving(true)
    try { await updateDoc(doc(db,'users',user.uid),form); await onSave(); toast.success('Saved!') }
    catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, bottom:70, background:C.bg, overflowY:'auto', zIndex:10 }} className="fade-up">
      <div style={{ maxWidth:520, margin:'0 auto', padding:'24px 16px 60px' }}>
        <h2 style={{ color:C.txt, fontWeight:900, fontSize:24, marginBottom:24, letterSpacing:'-1px', ...F }}>Profile</h2>

        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ position:'relative', display:'inline-block', cursor:'pointer' }} onClick={()=>photoRef.current?.click()}>
            <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', background:C.card, border:`2px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:28, color:C.txt }}>
              {form.photoURL ? <img src={form.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : `${form.firstName?.[0]||''}${form.lastName?.[0]||''}`}
            </div>
            <div style={{ position:'absolute', bottom:0, right:0, width:26, height:26, borderRadius:'50%', background:C.orange, border:`2px solid ${C.bg}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M20 5h-3.2L15 3H9L7.2 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/><circle cx="12" cy="13" r="3" fill="#fff"/></svg>
            </div>
          </div>
          <input ref={photoRef} type="file" accept="image/*" style={{display:'none'}}
            onChange={async e=>{
              const file=e.target.files?.[0]; if(!file)return
              const reader=new FileReader(); reader.onload=ev=>setForm(p=>({...p,photoURL:ev.target.result})); reader.readAsDataURL(file)
              try {
                const path=sRef(storage,`profiles/${user.uid}/photo_${Date.now()}`); const snap=await uploadBytes(path,file); const url=await getDownloadURL(snap.ref); setForm(p=>({...p,photoURL:url}))
              } catch(err){}
            }}/>
        </div>

        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 16px', marginBottom:14 }}>
          {[['FIRST NAME','firstName'],['LAST NAME','lastName']].map(([lbl,key]) => (
            <div key={key} style={{ marginBottom:16 }}>
              <p style={{ color:C.txt2, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:6 }}>{lbl}</p>
              <div style={{ borderBottom:`1.5px solid ${C.border}`, paddingBottom:8 }}>
                <input type="text" value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:C.txt, fontSize:15, fontWeight:500, ...F }}/>
              </div>
            </div>
          ))}
          <div>
            <p style={{ color:C.txt2, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:6 }}>PHONE</p>
            <div style={{ borderBottom:`1.5px solid ${C.border}`, paddingBottom:8 }}>
              <input type="tel" value={form.phone||''} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:C.txt, fontSize:15, fontWeight:500, ...F }}/>
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving} style={{ width:'100%', background:C.orange, border:'none', borderRadius:18, padding:'14px', color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:12, boxShadow:'0 4px 20px rgba(255,107,26,0.3)', ...F }}>
          {saving && <div style={{width:16,height:16,border:`2.5px solid rgba(255,255,255,0.4)`,borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>}
          {saving?'Saving…':'Save Changes'}
        </button>

        <button onClick={onSignOut} style={{ width:'100%', background:'transparent', border:`1.5px solid ${C.border}`, borderRadius:18, padding:'14px', color:'#EF4444', fontWeight:700, fontSize:14, cursor:'pointer', ...F }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}

function ApptCard({ a, formatTime, onReschedule, onCancel, barberInfo, onMaps, isNext }) {
  const isCancelled = a.bookingStatus === 'cancelled'
  const isCompleted = a.bookingStatus === 'completed'

  if (isCancelled) return (
    <div style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.18)', borderLeft:'3px solid #EF4444', borderRadius:14, padding:'12px 14px', marginBottom:10, opacity:0.6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <p style={{ color:C.txt, fontWeight:700, fontSize:13, margin:'0 0 2px', textDecoration:'line-through' }}>{a.date?format(parseLocalDate(a.date),'MMM d'):''} · {formatTime(a.startTime)}</p>
          <p style={{ color:C.txt2, fontSize:12, margin:0 }}>{a.services?.map(s=>s.name).join(', ')}</p>
        </div>
        <div style={{ textAlign:'right' }}>
          <p style={{ color:C.txt2, fontWeight:800, fontSize:14, margin:'0 0 4px', textDecoration:'line-through' }}>{formatCurrency(a.totalPrice)}</p>
          <span style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444', fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:20, letterSpacing:'0.08em' }}>CANCELLED</span>
        </div>
      </div>
    </div>
  )

  if (isCompleted) return (
    <div style={{ background:'rgba(34,197,94,0.05)', border:'1px solid rgba(34,197,94,0.15)', borderLeft:'3px solid #22C55E', borderRadius:14, padding:'12px 14px', marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <p style={{ color:C.txt, fontWeight:700, fontSize:13, margin:'0 0 2px' }}>{a.date?format(parseLocalDate(a.date),'MMM d, yy'):''} · {formatTime(a.startTime)}</p>
          <p style={{ color:C.txt2, fontSize:12, margin:0 }}>{a.services?.map(s=>s.name).join(', ')}</p>
        </div>
        <div style={{ textAlign:'right' }}>
          <p style={{ color:C.txt, fontWeight:900, fontSize:14, margin:'0 0 4px' }}>{formatCurrency(a.totalPrice)}</p>
          <span style={{ background:'rgba(34,197,94,0.15)', color:'#22C55E', fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:20, letterSpacing:'0.08em' }}>COMPLETED</span>
        </div>
      </div>
    </div>
  )

  if (isNext) return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.orange}`, borderRadius:16, padding:'14px 16px', marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            {barberInfo?.photoURL && <img src={barberInfo.photoURL} style={{width:22,height:22,borderRadius:6,objectFit:'cover'}} alt=""/>}
            <p style={{ color:C.txt, fontWeight:800, fontSize:14, margin:0 }}>{a.barberName}</p>
          </div>
          <p style={{ color:C.txt, fontWeight:700, fontSize:14, margin:'0 0 2px' }}>{a.date?format(parseLocalDate(a.date),'EEEE, MMM d'):''} · {formatTime(a.startTime)}</p>
          <p style={{ color:C.txt2, fontSize:12, margin:0, fontWeight:500 }}>{formatDuration(a.totalDuration)}</p>
        </div>
        <div style={{ textAlign:'right' }}>
          <p style={{ color:C.orange, fontWeight:900, fontSize:20, margin:'0 0 6px' }}>{formatCurrency(a.totalPrice)}</p>
          <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.08em', padding:'3px 8px', borderRadius:20, background: isToday(parseLocalDate(a.date)) ? C.orange : C.card2, color: isToday(parseLocalDate(a.date)) ? '#fff' : C.txt }}>
            {differenceInDays(new Date(`${a.date}T${a.startTime}`),new Date())===0?'TODAY':`IN ${differenceInDays(new Date(`${a.date}T${a.startTime}`),new Date())} DAYS`}
          </span>
        </div>
      </div>
      {a.services?.length>0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
          {a.services.map((s,i)=>(
            <span key={i} style={{ background:C.card2, color:C.txt2, fontSize:11, fontWeight:500, padding:'4px 10px', borderRadius:16, border:`1px solid ${C.border}` }}>{s.name}</span>
          ))}
        </div>
      )}
      {barberInfo?.address && (
        <button onClick={()=>onMaps(barberInfo.address)} style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', color:C.txt2, fontSize:12, fontWeight:500, cursor:'pointer', padding:0, marginBottom:12, ...F }}>
          <Navigation size={12}/> Get Directions
        </button>
      )}
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={()=>onReschedule(a)} style={{ flex:1, background:C.card2, border:`1px solid ${C.border}`, borderRadius:12, padding:'10px', color:C.txt, fontSize:12, fontWeight:700, cursor:'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
          <RefreshCw size={12}/> Reschedule
        </button>
        <button onClick={()=>onCancel(a.id)} style={{ flex:1, background:'transparent', border:`1px solid rgba(239,68,68,0.3)`, borderRadius:12, padding:'10px', color:'#ef4444', fontSize:12, fontWeight:700, cursor:'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
          <X size={12}/> Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderLeft:`2px solid ${C.border}`, borderRadius:14, padding:'12px 14px', marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
        <div>
          <p style={{ color:C.txt, fontWeight:700, fontSize:13, margin:'0 0 2px' }}>{a.date?format(parseLocalDate(a.date),'MMM d'):''} · {formatTime(a.startTime)}</p>
          <p style={{ color:C.txt2, fontSize:12, margin:0 }}>{a.services?.map(s=>s.name).join(', ')}</p>
        </div>
        <p style={{ color:C.txt, fontWeight:800, fontSize:14, flexShrink:0, margin:0 }}>{formatCurrency(a.totalPrice)}</p>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={()=>onReschedule(a)} style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:10, padding:'6px 10px', color:C.txt2, fontSize:11, fontWeight:700, cursor:'pointer', ...F, display:'flex', alignItems:'center', gap:4 }}>
          <RefreshCw size={10}/> Reschedule
        </button>
        <button onClick={()=>onCancel(a.id)} style={{ background:'transparent', border:`1px solid rgba(239,68,68,0.2)`, borderRadius:10, padding:'6px 10px', color:'#ef4444', fontSize:11, fontWeight:700, cursor:'pointer', ...F }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function ClientDashboard() {
  const { barberSlug } = useParams()
  const { user, userData, loading: authLoading, signOut, refreshUserData } = useAuth()
  const location = useLocation()
  const highlightDate = location.state?.highlightDate || null
  const { formatTime } = useTheme()
  const navigate = useNavigate()
  const [view, setView] = useState('home')
  const [appointments, setAppointments] = useState([])
  const [barberInfo, setBarberInfo] = useState(null)
  const [availability, setAvailability] = useState(null)
  const [barberAppts, setBarberAppts] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [reschedAppt, setReschedAppt] = useState(null)
  const [reschedDate, setReschedDate] = useState(null)
  const [reschedSlot, setReschedSlot] = useState(null)
  const [reschedSlots, setReschedSlots] = useState([])
  const [reschedNote, setReschedNote] = useState('')
  const [reschedPage, setReschedPage] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)

  useEffect(() => { if (authLoading) return; if (!user) navigate(`/b/${barberSlug}/auth`) }, [user, authLoading])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db,'appointments'), where('clientId','==',user.uid))
    const unsub = onSnapshot(q, async (snap) => {
      const all = snap.docs.map(d=>({id:d.id,...d.data()}))
      setAppointments(all)
      setLoading(false)
      if (all.length>0 && !barberInfo) {
        const bSnap = await getDocs(query(collection(db,'barbers'), where('slug','==',barberSlug)))
        if (!bSnap.empty) {
          const b = {id:bSnap.docs[0].id,...bSnap.docs[0].data()}
          setBarberInfo(b)
          const aSnap = await getDocs(query(collection(db,'availability'), where('barberId','==',b.id)))
          const apSnap = await getDocs(query(collection(db,'appointments'), where('barberId','==',b.id)))
          if (!aSnap.empty) setAvailability(aSnap.docs[0].data())
          setBarberAppts(apSnap.docs.map(d=>d.data()))
        }
      }
    })
    return () => unsub()
  }, [user])

  useEffect(() => {
    if (!reschedDate||!reschedAppt||!availability) { setReschedSlots([]); return }
    const dayIdx = reschedDate.getDay()
    const ds = availability.schedule?.[dayIdx]||{ enabled:(availability.workingDays||[1,2,3,4,5,6]).includes(dayIdx), startTime:availability.startTime||'09:00', endTime:availability.endTime||'18:00', breaks:availability.breaks||[] }
    if (!ds.enabled) { setReschedSlots([]); return }
    const dateStr = format(reschedDate,'yyyy-MM-dd')
    const existing = barberAppts.filter(a=>a.date===dateStr&&a.bookingStatus!=='cancelled'&&a.id!==reschedAppt.id).map(a=>({startTime:a.startTime,endTime:a.endTime}))
    let slots = generateTimeSlots(ds.startTime,ds.endTime,reschedAppt.totalDuration||30,ds.breaks||[],existing)
    if (isToday(reschedDate)) { const nm=new Date().getHours()*60+new Date().getMinutes()+15; slots=slots.filter(sl=>{const[h,m]=sl.startTime.split(':').map(Number);return h*60+m>nm}) }
    setReschedSlots(slots); setReschedSlot(null)
  }, [reschedDate,reschedAppt,availability,barberAppts])

  async function handleCancel() {
    if (!cancelTarget) return
    await updateDoc(doc(db,'appointments',cancelTarget),{bookingStatus:'cancelled',paymentStatus:'cancelled'})
    setAppointments(p=>p.map(a=>a.id===cancelTarget?{...a,bookingStatus:'cancelled',paymentStatus:'cancelled'}:a))
    toast.success('Cancelled'); setCancelTarget(null)
  }

  async function handleReschedule() {
    if (!reschedSlot||!reschedDate) return
    const newDate = format(reschedDate,'yyyy-MM-dd')
    await updateDoc(doc(db,'appointments',reschedAppt.id),{date:newDate,startTime:reschedSlot.startTime,endTime:reschedSlot.endTime,rescheduleNote:reschedNote.trim()||null})
    setAppointments(p=>p.map(a=>a.id===reschedAppt.id?{...a,date:newDate,startTime:reschedSlot.startTime,endTime:reschedSlot.endTime}:a))
    toast.success('Rescheduled!'); setReschedAppt(null); setReschedDate(null); setReschedSlot(null); setReschedNote('')
  }

  function openMaps(address) {
    if (!address) return
    const addr=encodeURIComponent(address)
    window.open(/iPad|iPhone|iPod/.test(navigator.userAgent)?`maps://?q=${addr}`:`https://maps.google.com/?q=${addr}`,'_blank')
  }

  const upcoming = appointments.filter(a=>{
    if (a.bookingStatus==='cancelled') return false
    const [y,m,d]=(a.date||'').split('-').map(Number)
    const [h,mn]=(a.startTime||'00:00').split(':').map(Number)
    return new Date(y,m-1,d,h,mn)>new Date()
  }).sort((a,b)=>a.date?.localeCompare(b.date)||a.startTime?.localeCompare(b.startTime))

  const history = appointments.filter(a=>{
    if (a.bookingStatus==='cancelled') return true
    const [y,m,d]=(a.date||'').split('-').map(Number)
    const [h,mn]=(a.startTime||'00:00').split(':').map(Number)
    return new Date(y,m-1,d,h,mn)<=new Date()
  })

  const next = upcoming[0]
  const totalSpent = userData?.totalSpent || appointments.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalPrice||0),0)
  const totalVisits = userData?.totalVisits || history.filter(a=>a.bookingStatus==='completed').length
  const { text:greetText, emoji:greetEmoji } = getGreeting()

  if (authLoading || loading) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:24, height:24, border:`2.5px solid ${C.border}`, borderTopColor:C.orange, borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{STYLES}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:C.bg, ...F, paddingBottom:80 }}>
      <style>{STYLES}</style>

      {view==='spend'   && <SpendDetail appointments={appointments} onBack={()=>setView('home')}/>}
      {view==='visits'  && <VisitHistory appointments={appointments} onBack={()=>setView('home')}/>}
      {view==='profile' && <ProfileView user={user} userData={userData} onSave={refreshUserData} onSignOut={async()=>{ await signOut(); navigate(`/b/${barberSlug}`) }} />}

      {view==='home' && (
        <div className="fade-up">
          {/* Header */}
          <div style={{ position:'relative', padding:'24px 16px 32px', overflow:'hidden', borderBottom:`1px solid ${C.border}` }}>
            {barberInfo?.photoURL && <img src={barberInfo.photoURL} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:0.15}} alt=""/>}
            <div style={{position:'absolute',inset:0,background:'linear-gradient(to top, #0D0D0D 0%, transparent 100%)'}}/>
            
            <div style={{ position:'relative', zIndex:2, display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
              <div>
                <p style={{ color:C.txt2, fontSize:12, fontWeight:700, margin:'0 0 4px', letterSpacing:'0.04em' }}>{greetText} {greetEmoji}</p>
                <h1 style={{ color:C.txt, fontWeight:900, fontSize:32, margin:0, lineHeight:1, letterSpacing:'-1px', textTransform:'lowercase' }}>
                  {userData?.firstName}<span style={{ color:C.orange }}>.</span>
                </h1>
              </div>
              <NotifBell userId={user?.uid} onOpen={()=>setShowNotifs(true)}/>
            </div>
          </div>

          <div style={{ padding:'16px' }}>
            {/* Confirmed banner */}
            {highlightDate && (() => {
              const highlighted = appointments.find(a=>a.date===highlightDate && a.bookingStatus!=='cancelled')
              if (!highlighted) return null
              return (
                <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:16, padding:'16px', marginBottom:20 }}>
                  <p style={{ color:C.orange, fontSize:9, fontWeight:800, letterSpacing:'0.12em', margin:'0 0 6px' }}>✓ CONFIRMED</p>
                  <p style={{ color:C.txt, fontWeight:800, fontSize:16, margin:'0 0 4px' }}>{highlighted.date?format(parseLocalDate(highlighted.date),'EEEE, MMMM d'):''}</p>
                  <p style={{ color:C.txt2, fontSize:13, margin:0, fontWeight:500 }}>{formatTime(highlighted.startTime)} – {formatTime(highlighted.endTime)} · {highlighted.services?.map(s=>s.name).join(', ')}</p>
                </div>
              )
            })()}

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:24 }}>
              <button onClick={()=>setView('visits')} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'12px 6px', textAlign:'center', cursor:'pointer', ...F }}>
                <p style={{ color:C.txt, fontWeight:900, fontSize:22, margin:'0 0 2px', letterSpacing:'-1px' }}>{totalVisits}</p>
                <p style={{ color:C.orange, fontSize:9, fontWeight:800, margin:0, letterSpacing:'0.08em' }}>VISITS</p>
              </button>
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'12px 6px', textAlign:'center' }}>
                <p style={{ color:C.txt, fontWeight:900, fontSize:22, margin:'0 0 2px', letterSpacing:'-1px' }}>{upcoming.length}</p>
                <p style={{ color:C.orange, fontSize:9, fontWeight:800, margin:0, letterSpacing:'0.08em' }}>UPCOMING</p>
              </div>
              <button onClick={()=>setView('spend')} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'12px 6px', textAlign:'center', cursor:'pointer', ...F }}>
                <p style={{ color:C.txt, fontWeight:900, fontSize:18, margin:'0 0 2px', letterSpacing:'-1px' }}>${(totalSpent||0).toFixed(0)}</p>
                <p style={{ color:C.orange, fontSize:9, fontWeight:800, margin:0, letterSpacing:'0.08em' }}>SPENT</p>
              </button>
            </div>

            {/* Next appointment */}
            {next && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ color:C.txt2, fontSize:10, fontWeight:800, letterSpacing:'0.12em', marginBottom:10 }}>NEXT APPOINTMENT</p>
                <ApptCard a={next} formatTime={formatTime} isNext onReschedule={a=>{setReschedAppt(a);setReschedDate(null);setReschedSlot(null);setReschedNote('')}} onCancel={id=>setCancelTarget(id)} barberInfo={barberInfo} onMaps={openMaps}/>
              </div>
            )}

            {/* More upcoming */}
            {upcoming.slice(1).length>0 && (
              <div style={{ marginBottom:24 }}>
                <p style={{ color:C.txt2, fontSize:10, fontWeight:800, letterSpacing:'0.12em', marginBottom:10 }}>UPCOMING</p>
                {upcoming.slice(1).map(a=><ApptCard key={a.id} a={a} formatTime={formatTime} onReschedule={a=>{setReschedAppt(a);setReschedDate(null);setReschedSlot(null);setReschedNote('')}} onCancel={id=>setCancelTarget(id)} barberInfo={barberInfo} onMaps={openMaps}/>)}
              </div>
            )}

            {/* Empty upcoming */}
            {upcoming.length===0 && (
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:20, padding:'24px 20px', marginBottom:24, textAlign:'center' }}>
                <Scissors size={24} style={{ color:C.border, marginBottom:12, display:'block', margin:'0 auto 12px' }} strokeWidth={1.5}/>
                <p style={{ color:C.txt, fontWeight:800, fontSize:15, margin:'0 0 4px' }}>No upcoming appointments</p>
                <p style={{ color:C.txt2, fontSize:13, margin:'0 0 20px' }}>Ready for a fresh cut?</p>
                <button onClick={()=>navigate(`/b/${barberSlug}/book`)} style={{ background:C.orange, color:'#fff', border:'none', borderRadius:18, padding:'12px 24px', fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:'0 4px 20px rgba(255,107,26,0.3)', ...F }}>
                  Book Now
                </button>
              </div>
            )}

            {/* Recent history */}
            {history.slice(0,3).length>0 && (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <p style={{ color:C.txt2, fontSize:10, fontWeight:800, letterSpacing:'0.12em', margin:0 }}>RECENT VISITS</p>
                  <button onClick={()=>setView('visits')} style={{ color:C.orange, fontSize:11, fontWeight:700, background:'none', border:'none', cursor:'pointer', ...F }}>See all</button>
                </div>
                {history.slice(0,3).map(a=><ApptCard key={a.id} a={a} formatTime={formatTime} onReschedule={()=>{}} onCancel={()=>{}} barberInfo={barberInfo} onMaps={openMaps}/>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom Nav ── */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:C.bg, borderTop:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-around', padding:'8px 16px max(12px,env(safe-area-inset-bottom))', zIndex:40 }}>
        <button onClick={()=>setView('home')} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'none', border:'none', cursor:'pointer', color:view==='home'?C.orange:C.txt3, flex:1, ...F, transition:'color 0.2s' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill={view==='home'?C.orange:'none'} stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
          <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.08em' }}>HOME</span>
        </button>

        <div style={{ flex:1, display:'flex', justifyContent:'center', position:'relative' }}>
          <button onClick={()=>navigate(`/b/${barberSlug}/book`)}
            style={{ position:'relative', marginTop:-28, width:48, height:48, borderRadius:'50%', background:'linear-gradient(135deg, #FF8C42 0%, #FF6B1A 100%)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 20px rgba(255,107,26,0.3)', zIndex:1 }}>
            <Scissors size={20} color="#fff" strokeWidth={2}/>
          </button>
        </div>

        <button onClick={()=>setView('profile')} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'none', border:'none', cursor:'pointer', color:view==='profile'?C.orange:C.txt3, flex:1, ...F, transition:'color 0.2s' }}>
          <User size={20} fill={view==='profile'?C.orange:'none'} stroke="currentColor" strokeWidth={1.8}/>
          <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.08em' }}>PROFILE</span>
        </button>
      </div>

      {/* Modals */}
      {cancelTarget && (
        <Overlay onClose={()=>setCancelTarget(null)}>
          <p style={{ color:C.txt, fontWeight:900, fontSize:20, marginBottom:6, ...F, letterSpacing:'-0.5px' }}>Cancel appointment?</p>
          <p style={{ color:C.txt2, fontSize:14, marginBottom:20, lineHeight:1.4 }}>This action cannot be undone. Would you prefer to reschedule instead?</p>
          <button onClick={()=>{setCancelTarget(null);const a=appointments.find(a=>a.id===cancelTarget);if(a){setReschedAppt(a);setReschedDate(null);setReschedSlot(null)}}}
            style={{ width:'100%', padding:'14px', borderRadius:14, background:C.card2, color:C.txt, fontWeight:700, border:`1px solid ${C.border}`, cursor:'pointer', ...F, marginBottom:10 }}>
            Reschedule Instead
          </button>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>setCancelTarget(null)} style={{ flex:1, padding:'14px', borderRadius:14, background:'transparent', color:C.txt2, fontWeight:700, border:`1px solid ${C.border}`, cursor:'pointer', ...F }}>Keep It</button>
            <button onClick={handleCancel} style={{ flex:1, padding:'14px', borderRadius:14, background:'rgba(239,68,68,0.08)', color:'#ef4444', fontWeight:700, border:'1px solid rgba(239,68,68,0.2)', cursor:'pointer', ...F }}>Cancel It</button>
          </div>
        </Overlay>
      )}

      {reschedAppt && (
        <Overlay onClose={()=>setReschedAppt(null)}>
          <p style={{ color:C.txt, fontWeight:900, fontSize:20, marginBottom:4, ...F, letterSpacing:'-0.5px' }}>Reschedule</p>
          <p style={{ color:C.txt2, fontSize:13, marginBottom:16 }}>{reschedAppt.services?.map(s=>s.name).join(', ')} · {formatDuration(reschedAppt.totalDuration||0)}</p>
          {(()=>{
            const today2=startOfDay(new Date()); const advance=availability?.advanceDays||30
            const days=Array.from({length:advance},(_,i)=>addDays(today2,i))
            const perPage=7; const visible=days.slice(reschedPage*perPage,(reschedPage+1)*perPage)
            return (
              <div style={{ marginBottom:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <button onClick={()=>setReschedPage(p=>Math.max(0,p-1))} disabled={reschedPage===0} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, color:reschedPage===0?C.border:C.txt, cursor:'pointer', padding:6 }}><ChevronLeft size={14}/></button>
                  <span style={{ color:C.txt2, fontSize:12, fontWeight:700 }}>{visible[0]&&format(visible[0],'MMM d')} – {visible[visible.length-1]&&format(visible[visible.length-1],'MMM d')}</span>
                  <button onClick={()=>setReschedPage(p=>(p+1)*perPage<advance?p+1:p)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, color:(reschedPage+1)*perPage>=advance?C.border:C.txt, cursor:'pointer', padding:6 }}><ChevronRight size={14}/></button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
                  {visible.map((date,i)=>{
                    const isSel=reschedDate&&isSameDay(date,reschedDate)
                    return (
                      <button key={i} onClick={()=>setReschedDate(date)}
                        style={{ background:isSel?C.orange:C.card, border:`1px solid ${isSel?C.orange:C.border}`, borderRadius:10, padding:'8px 2px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:2, ...F }}>
                        <span style={{ color:isSel?'#fff':C.txt2, fontSize:9, fontWeight:700 }}>{format(date,'EEE').toUpperCase()}</span>
                        <span style={{ color:isSel?'#fff':C.txt, fontSize:14, fontWeight:800 }}>{format(date,'d')}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}
          {reschedDate&&(<>
            <p style={{ color:C.txt2, fontSize:10, fontWeight:800, letterSpacing:'0.1em', marginBottom:10 }}>{format(reschedDate,'EEEE, MMM d').toUpperCase()}</p>
            {reschedSlots.length===0 ? (
              <p style={{ color:C.txt2, fontSize:13, marginBottom:16 }}>No slots available.</p>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:16 }}>
                {reschedSlots.map(slot=>(
                  <button key={slot.startTime} onClick={()=>setReschedSlot(slot)}
                    style={{ padding:'10px 4px', borderRadius:10, border:`1.5px solid ${reschedSlot?.startTime===slot.startTime?C.orange:C.border}`, background:reschedSlot?.startTime===slot.startTime?C.orange:C.card, color:reschedSlot?.startTime===slot.startTime?'#fff':C.txt, fontWeight:700, fontSize:12, cursor:'pointer', ...F }}>
                    {formatTime(slot.startTime)}
                  </button>
                ))}
              </div>
            )}
          </>)}
          <div style={{ marginBottom:16 }}>
            <p style={{ color:C.txt2, fontSize:10, fontWeight:800, letterSpacing:'0.1em', marginBottom:6 }}>NOTE (optional)</p>
            <textarea value={reschedNote} onChange={e=>setReschedNote(e.target.value)} rows={2} placeholder="Reason for rescheduling..."
              style={{ width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'12px', color:C.txt, fontSize:14, resize:'none', outline:'none', ...F, boxSizing:'border-box' }}/>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>setReschedAppt(null)} style={{ flex:1, padding:'14px', borderRadius:14, background:'transparent', color:C.txt2, fontWeight:700, border:`1px solid ${C.border}`, cursor:'pointer', ...F }}>Cancel</button>
            <button onClick={handleReschedule} disabled={!reschedSlot}
              style={{ flex:1, padding:'14px', borderRadius:14, background:reschedSlot?C.orange:C.border, color:reschedSlot?'#fff':C.txt3, fontWeight:800, border:'none', cursor:reschedSlot?'pointer':'not-allowed', ...F }}>
              Confirm
            </button>
          </div>
        </Overlay>
      )}

      <ImportantMessagePopup userId={user?.uid}/>
    </div>
  )
}

function Overlay({ children, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(13,13,13,0.9)', zIndex:50, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:0 }} className="fade-up">
      <div style={{ background:'#0D0D0D', borderTop:`1px solid #2A2A2A`, borderRadius:'24px 24px 0 0', padding:'24px 16px max(16px,env(safe-area-inset-bottom))', width:'100%', maxWidth:520, ...F, maxHeight:'90vh', overflowY:'auto' }}>
        {children}
      </div>
    </div>
  )
}