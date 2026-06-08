/**
 * ClientDashboard — Completamente Migrado
 * ✓ Cero truncaciones - Listo para producción
 * ✓ Rutas corregidas sin slugs manuales
 * ✓ Adaptación automática a Light/Dark Mode mediante Variables CSS
 */
import { useEffect, useState, useRef, useMemo } from 'react'
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { storage, db } from '../../lib/firebase'
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'
import { formatCurrency, formatDuration, parseLocalDate, generateTimeSlots } from '../../utils/helpers'
import { useTheme } from '../../context/ThemeContext'
import { format, isFuture, isPast, differenceInDays, subMonths, eachMonthOfInterval, addDays, startOfDay, isToday, isSameDay } from 'date-fns'
import toast from 'react-hot-toast'
import { useNavigate, useLocation } from 'react-router-dom'
import { Scissors, User, X, Navigation, RefreshCw, ChevronLeft, ChevronRight, Bell, Check, DollarSign, Calendar, Clock } from 'lucide-react'

const BARBER_SLUG = 'amadoblends'
const F = { fontFamily: "'Plus Jakarta Sans','DM Sans',system-ui,sans-serif" }

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .fade-up { animation: fadeUp 0.3s ease both; }
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  ::-webkit-scrollbar{display:none}
  textarea{font-size:16px!important}
`

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
    const q = query(collection(db,'notifications'), where('userId','==',userId), where('read','==',false))
    const unsub = onSnapshot(q, s => setCount(s.size))
    return unsub
  }, [userId])
  return (
    <button onClick={onOpen} style={{ position:'relative', background:'var(--card2)', border:'1px solid var(--border)', borderRadius:12, cursor:'pointer', padding:'8px 9px', color:'var(--text-sec)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <Bell size={18} strokeWidth={1.5}/>
      {count > 0 && <div style={{ position:'absolute', top:4, right:4, width:8, height:8, borderRadius:'50%', background:'var(--accent)', border:'1.5px solid var(--bg)' }}/>}
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
        const all = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
        setNotifs(all); setLoading(false)
        snap.docs.filter(d=>!d.data().read).forEach(d=>updateDoc(doc(db,'notifications',d.id),{read:true}))
      })
  }, [userId])
  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, background:'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div style={{ position:'absolute', top:0, right:0, bottom:0, width:Math.min(320,window.innerWidth), background:'var(--surface)', borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-lg)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:16, margin:0, ...F }}>Notifications</p>
          <button onClick={onClose} style={{ background:'var(--card2)', border:'none', borderRadius:8, color:'var(--text-sec)', cursor:'pointer', padding:'6px 7px', display:'flex' }}><X size={16}/></button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'12px' }}>
          {loading ? <div style={{ textAlign:'center', padding:40 }}><div style={{ width:22, height:22, border:'2px solid var(--border)', borderTopColor:'var(--text-pri)', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto' }}/></div>
          : notifs.length === 0 ? <div style={{ textAlign:'center', padding:40 }}><p style={{ color:'var(--text-ter)', ...F, fontSize:13 }}>No notifications yet</p></div>
          : notifs.map(n => (
            <div key={n.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px', marginBottom:8 }}>
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ fontSize:16, flexShrink:0 }}>{typeIcon[n.type]||'ℹ️'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:13, margin:'0 0 3px', ...F }}>{n.title}</p>
                  <p style={{ color:'var(--text-sec)', fontSize:12, margin:'0 0 4px', lineHeight:1.5 }}>{n.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProfileView({ user, userData, onSave, onSignOut }) {
  const { theme, toggleTheme, timeFormat, setTimeFormat } = useTheme()
  const isDark = theme === 'dark'
  const [form, setForm] = useState({ firstName:userData?.firstName||'', lastName:userData?.lastName||'', phone:userData?.phone||'', photoURL:userData?.photoURL||'' })
  const [saving, setSaving] = useState(false)
  const photoRef = useRef(null)

  async function save() {
    setSaving(true)
    try { await updateDoc(doc(db,'users',user.uid),form); await onSave(); toast.success('Saved!') }
    catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, bottom:70, background:'var(--bg)', overflowY:'auto', zIndex:10 }}>
      <div style={{ maxWidth:520, margin:'0 auto', padding:'28px 20px 60px' }}>
        <h2 style={{ color:'var(--text-pri)', fontWeight:900, fontSize:22, marginBottom:24, ...F }}>Profile</h2>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ position:'relative', display:'inline-block', cursor:'pointer' }} onClick={()=>photoRef.current?.click()}>
            <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', background:'var(--card2)', border:`2px solid var(--border)`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:26, color:'var(--text-pri)' }}>
              {form.photoURL ? <img src={form.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : `${form.firstName?.[0]||''}${form.lastName?.[0]||''}`}
            </div>
          </div>
          <input ref={photoRef} type="file" accept="image/*" style={{display:'none'}} onChange={async e=>{
            const file=e.target.files?.[0]; if(!file)return
            const reader=new FileReader(); reader.onload=ev=>setForm(p=>({...p,photoURL:ev.target.result})); reader.readAsDataURL(file)
            try { const path=sRef(storage,`profiles/${user.uid}/photo_${Date.now()}`); const snap=await uploadBytes(path,file); const url=await getDownloadURL(snap.ref); setForm(p=>({...p,photoURL:url})) } catch(err){ console.warn(err) }
          }}/>
        </div>

        <div style={{ background:'var(--card)', border:`1px solid var(--border)`, borderRadius:16, padding:'16px 18px', marginBottom:12, boxShadow:'var(--shadow-sm)' }}>
          {[ McClBL => ['FIRST NAME','firstName'], ['LAST NAME','lastName'], ['PHONE','phone'] ].map(([lbl,key])=>(
            <div key={key} style={{ marginBottom:16 }}>
              <p style={{ color:'var(--text-ter)', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:6 }}>{lbl}</p>
              <div style={{ borderBottom:`1.5px solid var(--border)`, paddingBottom:8 }}>
                <input type="text" value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
                  style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:'var(--text-pri)', fontSize:16, ...F }}/>
              </div>
            </div>
          ))}
        </div>

        <button onClick={save} disabled={saving}
          style={{ width:'100%', background:'var(--text-pri)', border:'none', borderRadius:13, padding:'15px', color:'var(--bg)', fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:12, boxShadow:'var(--shadow-sm)', ...F }}>
          {saving?'Saving…':'Save Changes'}
        </button>

        <div style={{ background:'var(--card)', border:`1px solid var(--border)`, borderRadius:16, padding:'16px 18px', marginBottom:12, boxShadow:'var(--shadow-sm)' }}>
          <p style={{ color:'var(--text-ter)', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:16 }}>APPEARANCE</p>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
            <span style={{ color:'var(--text-pri)', fontWeight:600, fontSize:14 }}>{isDark?'Dark Mode':'Light Mode'}</span>
            <button onClick={toggleTheme} style={{ width:52, height:28, borderRadius:14, padding:3, border:'none', cursor:'pointer', background:'var(--text-pri)', display:'flex', alignItems:'center', justifyContent:isDark?'flex-end':'flex-start', transition:'all 0.25s' }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--bg)' }}/>
            </button>
          </div>
          <p style={{ color:'var(--text-ter)', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:10 }}>TIME FORMAT</p>
          <div style={{ display:'flex', background:'var(--bg)', borderRadius:12, padding:3, border:`1px solid var(--border)` }}>
            {[ ['12h','12h (AM/PM)'], ['24h','24h'] ].map(([val,lbl])=>(
              <button key={val} onClick={()=>setTimeFormat?.(val)}
                style={{ flex:1, padding:'9px', borderRadius:10, fontWeight:700, fontSize:13, background:timeFormat===val?'var(--text-pri)':'transparent', color:timeFormat===val?'var(--bg)':'var(--text-sec)', border:'none', cursor:'pointer', ...F }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <button onClick={onSignOut}
          style={{ width:'100%', background:'none', border:`1px solid var(--border)`, borderRadius:13, padding:'14px', color:'var(--red)', fontWeight:600, fontSize:14, cursor:'pointer', ...F }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}

function ApptCard({ a, formatTime, onReschedule, onCancel, isNext }) {
  const isCancelled = a.bookingStatus === 'cancelled'
  const isCompleted = a.bookingStatus === 'completed'

  if (isCancelled) return (
    <div style={{ background:'var(--red-soft)', border:'1px solid var(--red)', borderLeft:'3px solid var(--red)', borderRadius:14, padding:'13px 15px', marginBottom:8, opacity:0.6 }}>
      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <p style={{ color:'var(--text-pri)', fontWeight:600, fontSize:13, margin:0, textDecoration:'line-through', opacity:0.6 }}>{a.date?format(parseLocalDate(a.date),'MMM d'):''} · {formatTime(a.startTime)}</p>
        <span style={{ background:'var(--card2)', color:'var(--red)', fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:20 }}>CANCELLED</span>
      </div>
    </div>
  )

  if (isCompleted) return (
    <div style={{ background:'var(--green-soft)', border:'1px solid var(--green)', borderLeft:'3px solid var(--green)', borderRadius:14, padding:'13px 15px', marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <p style={{ color:'var(--text-pri)', fontWeight:600, fontSize:13, margin:'0 0 2px' }}>{a.date?format(parseLocalDate(a.date),'MMM d, yyyy'):''} · {formatTime(a.startTime)}</p>
          <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{a.services?.map(s=>s.name).join(', ')}</p>
        </div>
        <div style={{ textAlign:'right' }}>
          <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:14, margin:'0 0 4px' }}>{formatCurrency(a.totalPrice)}</p>
          <span style={{ background:'var(--card2)', color:'var(--green)', fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:20 }}>COMPLETED</span>
        </div>
      </div>
    </div>
  )

  if (isNext) return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderLeft:'3px solid var(--accent)', borderRadius:16, padding:'18px', marginBottom:16, boxShadow:'var(--shadow-sm)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <div>
          <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:15, margin:'0 0 4px' }}>{a.barberName}</p>
          <p style={{ color:'var(--text-sec)', fontWeight:600, fontSize:13, margin:'0 0 2px' }}>{a.date?format(parseLocalDate(a.date),'EEE, MMM d'):''} · {formatTime(a.startTime)}</p>
          <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{formatDuration(a.totalDuration)}</p>
        </div>
        <div style={{ textAlign:'right' }}>
          <p style={{ color:'var(--text-pri)', fontWeight:900, fontSize:20, margin:'0 0 5px' }}>{formatCurrency(a.totalPrice)}</p>
          <span style={{ color:'var(--green)', fontSize:12, fontWeight:700 }}>
            {differenceInDays(new Date(`${a.date}T${a.startTime}`),new Date())===0?'Today!': `In ${differenceInDays(new Date(`${a.date}T${a.startTime}`),new Date())} days`}
          </span>
        </div>
      </div>
      {a.services?.length>0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
          {a.services.map((s,i)=><span key={i} style={{ background:'var(--card2)', color:'var(--text-sec)', fontSize:11, padding:'4px 10px', borderRadius:20, border:'1px solid var(--border)' }}>{s.name}</span>)}
        </div>
      )}
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={()=>onReschedule(a)} style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 14px', color:'var(--text-pri)', fontSize:12, fontWeight:700, cursor:'pointer', ...F, display:'flex', alignItems:'center', gap:5 }}>
          <RefreshCw size={11}/> Reschedule
        </button>
        <button onClick={()=>onCancel(a.id)} style={{ background:'var(--red-soft)', border:'1px solid var(--red)', borderRadius:10, padding:'8px 14px', color:'var(--red)', fontSize:12, fontWeight:700, cursor:'pointer', ...F }}>
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'13px 15px', marginBottom:8, boxShadow:'var(--shadow-sm)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
        <div>
          <p style={{ color:'var(--text-pri)', fontWeight:600, fontSize:13, margin:'0 0 2px' }}>{a.date?format(parseLocalDate(a.date),'MMM d'):''} · {formatTime(a.startTime)}</p>
          <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{a.services?.map(s=>s.name).join(', ')}</p>
        </div>
        <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:13 }}>{formatCurrency(a.totalPrice)}</p>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={()=>onReschedule(a)} style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 11px', color:'var(--text-sec)', fontSize:11, fontWeight:700, cursor:'pointer', ...F, display:'flex', alignItems:'center', gap:4 }}>
          <RefreshCw size={10}/> Reschedule
        </button>
        <button onClick={()=>onCancel(a.id)} style={{ background:'var(--red-soft)', border:'1px solid var(--red)', borderRadius:8, padding:'6px 11px', color:'var(--red)', fontSize:11, fontWeight:700, cursor:'pointer', ...F }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function ClientDashboard() {
  const { user, userData, loading: authLoading, signOut, refreshUserData } = useAuth()
  const location = useLocation()
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

  useEffect(() => {
    if (authLoading) return
    if (!user) navigate('/login')
  }, [user, authLoading])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db,'appointments'), where('clientId','==',user.uid))
    const unsub = onSnapshot(q, async (snap) => {
      const all = snap.docs.map(d=>({id:d.id,...d.data()}))
      setAppointments(all)
      setLoading(false)
      if (!barberInfo) {
        const bSnap = await getDocs(query(collection(db,'barbers'), where('slug','==',BARBER_SLUG)))
        if (!bSnap.empty) {
          const b = {id:bSnap.docs[0].id,...bSnap.docs[0].data()}
          setBarberInfo(b)
          const [aSnap, apSnap] = await Promise.all([
            getDocs(query(collection(db,'availability'), where('barberId','==',b.id))),
            getDocs(query(collection(db,'appointments'), where('barberId','==',b.id))),
          ])
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
    toast.success('Cancelled'); setCancelTarget(null)
  }

  async function handleReschedule() {
    if (!reschedSlot||!reschedDate) return
    const newDate = format(reschedDate,'yyyy-MM-dd')
    await updateDoc(doc(db,'appointments',reschedAppt.id),{date:newDate,startTime:reschedSlot.startTime,endTime:reschedSlot.endTime,rescheduleNote:reschedNote.trim()||null})
    toast.success('Rescheduled!'); setReschedAppt(null); setReschedDate(null); setReschedSlot(null); setReschedNote('')
  }

  const upcoming = appointments.filter(a=>{
    if(a.bookingStatus==='cancelled')return false
    const d = new Date(`${a.date}T${a.startTime}`)
    return d > new Date()
  }).sort((a,b)=>a.date?.localeCompare(b.date)||a.startTime?.localeCompare(b.startTime))

  const historyList = appointments.filter(a=>{
    if(a.bookingStatus==='cancelled')return true
    const d = new Date(`${a.date}T${a.startTime}`)
    return d <= new Date()
  })

  const next = upcoming[0]
  const totalSpent = appointments.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalPrice||0),0)
  const totalVisits = historyList.filter(a=>a.bookingStatus==='completed').length
  const greeting = getGreeting()

  if (authLoading || loading) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:26, height:26, border:'2px solid var(--border)', borderTopColor:'var(--text-pri)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', ...F, paddingBottom:90 }}>
      <style>{STYLES}</style>

      {view==='profile' && (
        <ProfileView user={user} userData={userData}
          onSave={async()=>{ await refreshUserData() }}
          onSignOut={async()=>{ await signOut(); navigate('/') }}
        />
      )}

      {view==='home' && (
        <div className="fade-up" style={{ padding:'24px 20px', maxWidth:520, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28 }}>
            <div>
              <p style={{ color:'var(--text-sec)', fontSize:12, fontWeight:500, margin:'0 0 3px' }}>{greeting.text} {greeting.emoji}</p>
              <h1 style={{ color:'var(--text-pri)', fontWeight:900, fontSize:32, margin:0, letterSpacing:'-1px', textTransform:'lowercase' }}>
                {userData?.firstName}<span style={{ color:'var(--text-sec)', fontWeight:300 }}>.</span>
              </h1>
            </div>
            <NotifBell userId={user?.uid} onOpen={()=>setShowNotifs(true)}/>
          </div>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:24 }}>
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px 10px', textAlign:'center', boxShadow:'var(--shadow-sm)' }}>
              <p style={{ color:'var(--text-pri)', fontWeight:900, fontSize:24, margin:'0 0 4px' }}>{totalVisits}</p>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:600, margin:0 }}>VISITS</p>
            </div>
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px 10px', textAlign:'center', boxShadow:'var(--shadow-sm)' }}>
              <p style={{ color:'var(--text-pri)', fontWeight:900, fontSize:24, margin:'0 0 4px' }}>{upcoming.length}</p>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:600, margin:0 }}>UPCOMING</p>
            </div>
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px 10px', textAlign:'center', boxShadow:'var(--shadow-sm)' }}>
              <p style={{ color:'var(--text-pri)', fontWeight:900, fontSize:20, margin:'0 0 4px' }}>${(totalSpent||0).toFixed(0)}</p>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:600, margin:0 }}>SPENT</p>
            </div>
          </div>

          {next && (
            <ApptCard a={next} formatTime={formatTime} isNext
              onReschedule={a=>{setReschedAppt(a);setReschedDate(null);setReschedSlot(null);setReschedNote('')}}
              onCancel={id=>setCancelTarget(id)}
            />
          )}

          {upcoming.slice(1).length>0 && (
            <div style={{ marginBottom:20 }}>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>UPCOMING</p>
              {upcoming.slice(1).map(a => (
                <ApptCard key={a.id} a={a} formatTime={formatTime}
                  onReschedule={a=>{setReschedAppt(a);setReschedDate(null);setReschedSlot(null);setReschedNote('')}}
                  onCancel={id=>setCancelTarget(id)}
                />
              ))}
            </div>
          )}

          {upcoming.length===0 && (
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'28px 20px', marginBottom:20, textAlign:'center', boxShadow:'var(--shadow-sm)' }}>
              <Scissors size={24} style={{ color:'var(--text-sec)', opacity:0.2, marginBottom:12, display:'block', margin:'0 auto 12px' }} strokeWidth={1.5}/>
              <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:15, margin:'0 0 4px' }}>No upcoming appointments</p>
              <p style={{ color:'var(--text-sec)', fontSize:13, margin:'0 0 18px' }}>Ready for a fresh cut?</p>
              <button onClick={()=>navigate('/book')} style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:22, padding:'12px 28px', fontWeight:700, fontSize:14, cursor:'pointer', ...F }}>Book Now</button>
            </div>
          )}

          {historyList.slice(0,3).length>0 && (
            <div>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>RECENT</p>
              {historyList.slice(0,3).map(a => (
                <ApptCard key={a.id} a={a} formatTime={formatTime} onReschedule={()=>{}} onCancel={()=>{}} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--surface)', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-around', padding:'10px 24px max(14px,env(safe-area-inset-bottom))', zIndex:40 }}>
        <button onClick={()=>setView('home')} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color:view==='home'?'var(--text-pri)':'var(--text-sec)', flex:1, ...F }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill={view==='home'?'var(--text-pri)':'none'} stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
          <span style={{ fontSize:9, fontWeight:700 }}>HOME</span>
        </button>
        <div style={{ flex:1, display:'flex', justifyContent:'center' }}>
          <button onClick={()=>navigate('/book')} style={{ position:'relative', marginTop:-28, width:54, height:54, borderRadius:'50%', background:'var(--accent)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'var(--shadow-accent)' }}>
            <Scissors size={22} color="#fff" strokeWidth={2}/>
          </button>
        </div>
        <button onClick={()=>setView('profile')} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color:view==='profile'?'var(--text-pri)':'var(--text-sec)', flex:1, ...F }}>
          <User size={20} fill={view==='profile'?'var(--text-pri)':'none'} stroke="currentColor" strokeWidth={1.8}/>
          <span style={{ fontSize:9, fontWeight:700 }}>PROFILE</span>
        </button>
      </div>

      {/* Cancel Confirm Modal */}
      {cancelTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:22, padding:22, width:'100%', maxWidth:380, boxShadow:'var(--shadow-lg)', ...F }}>
            <p style={{ color:'var(--text-pri)', fontWeight:900, fontSize:18, marginBottom:6 }}>Cancel appointment?</p>
            <p style={{ color:'var(--text-sec)', fontSize:14, marginBottom:20 }}>This cannot be undone.</p>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setCancelTarget(null)} style={{ flex:1, padding:'13px', borderRadius:12, background:'transparent', color:'var(--text-sec)', fontWeight:600, border:'1px solid var(--border)', cursor:'pointer', ...F }}>Keep It</button>
              <button onClick={handleCancel} style={{ flex:1, padding:'13px', borderRadius:12, background:'var(--red-soft)', color:'var(--red)', fontWeight:700, border:'1px solid var(--border)', cursor:'pointer', ...F }}>Cancel It</button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {reschedAppt && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:22, padding:22, width:'100%', maxWidth:380, ...F, maxHeight:'82vh', overflowY:'auto', boxShadow:'var(--shadow-lg)' }}>
            <p style={{ color:'var(--text-pri)', fontWeight:900, fontSize:18, marginBottom:4 }}>Reschedule</p>
            <p style={{ color:'var(--text-sec)', fontSize:13, marginBottom:16 }}>{reschedAppt.services?.map(s=>s.name).join(', ')}</p>
            {(() => {
              const today2 = startOfDay(new Date()); const advance = availability?.advanceDays || 30
              const days = Array.from({ length: advance }, (_, i) => addDays(today2, i))
              const perPage = 7; const visible = days.slice(reschedPage * perPage, (reschedPage + 1) * perPage)
              return (
                <div style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <button onClick={()=>setReschedPage(p=>Math.max(0,p-1))} disabled={reschedPage===0} style={{ background:'none', border:'none', color:reschedPage===0?'var(--border)':'var(--text-pri)', cursor:'pointer', padding:4 }}><ChevronLeft size={15}/></button>
                    <span style={{ color:'var(--text-sec)', fontSize:12 }}>{visible[0] && format(visible[0],'MMM d')} – {visible[visible.length-1] && format(visible[visible.length-1],'MMM d')}</span>
                    <button onClick={()=>setReschedPage(p=>(p+1)*perPage<advance?p+1:p)} disabled={(reschedPage+1)*perPage>=advance} style={{ background:'none', border:'none', color:(reschedPage+1)*perPage>=advance?'var(--border)':'var(--text-pri)', cursor:'pointer', padding:4 }}><ChevronRight size={15}/></button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
                    {visible.map((date, i) => {
                      const isSel = reschedDate && isSameDay(date, reschedDate)
                      return (
                        <button key={i} onClick={()=>setReschedDate(date)} style={{ background:isSel?'var(--accent)':'var(--card)', border:`1px solid ${isSel?'var(--accent)':'var(--border)'}`, borderRadius:10, padding:'7px 2px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:2, ...F }}>
                          <span style={{ color:isSel?'#fff':'var(--text-sec)', fontSize:9, fontWeight:700 }}>{format(date,'EEE').toUpperCase()}</span>
                          <span style={{ color:isSel?'#fff':'var(--text-pri)', fontSize:13, fontWeight:800 }}>{format(date,'d')}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
            {reschedDate && (
              <>
                <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>{format(reschedDate,'EEE, MMM d').toUpperCase()}</p>
                {reschedSlots.length === 0 ? <p style={{ color:'var(--text-sec)', fontSize:13, marginBottom:14 }}>No slots available.</p>
                : <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:14 }}>
                    {reschedSlots.map(slot => (
                      <button key={slot.startTime} onClick={()=>setReschedSlot(slot)} style={{ padding:'10px 3px', borderRadius:10, border:`1.5px solid ${reschedSlot?.startTime===slot.startTime?'var(--accent)':'var(--border)'}`, background:reschedSlot?.startTime===slot.startTime?'var(--accent)':'var(--card)', color:reschedSlot?.startTime===slot.startTime?'#fff':'var(--text-pri)', fontWeight:700, fontSize:12, cursor:'pointer', ...F }}>
                        {formatTime(slot.startTime)}
                      </button>
                    ))}
                  </div>}
              </>
            )}
            <div style={{ display:'flex', gap:10, marginTop:12 }}>
              <button onClick={()=>setReschedAppt(null)} style={{ flex:1, padding:'13px', borderRadius:12, background:'transparent', color:'var(--text-sec)', fontWeight:600, border:'1px solid var(--border)', cursor:'pointer', ...F }}>Cancel</button>
              <button onClick={handleReschedule} disabled={!reschedSlot} style={{ flex:1, padding:'13px', borderRadius:12, background:reschedSlot?'var(--accent)':'var(--border)', color:reschedSlot?'#fff':'var(--text-ter)', fontWeight:700, border:'none', cursor:reschedSlot?'pointer':'not-allowed', boxShadow:reschedSlot?'var(--shadow-accent)':'none', ...F }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {showNotifs && <NotificationsPanel userId={user?.uid} onClose={()=>setShowNotifs(false)}/>}
    </div>
  )
}