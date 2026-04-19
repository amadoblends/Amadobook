import { useEffect, useState, useRef } from 'react'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { storage } from '../../lib/firebase'
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration, parseLocalDate, generateTimeSlots } from '../../utils/helpers'
import { useTheme } from '../../context/ThemeContext'
import { format, isFuture, isPast, differenceInDays, subMonths, eachMonthOfInterval, addDays, startOfDay, isToday, isSameDay } from 'date-fns'
import toast from 'react-hot-toast'
import { useNavigate, useParams } from 'react-router-dom'
import ImportantMessagePopup from '../../components/ui/ImportantMessagePopup'
import PhoneInput from '../../components/ui/PhoneInput'
import { Scissors, User, X, Navigation, RefreshCw, ChevronLeft, ChevronRight, Bell, ArrowLeft, Check, DollarSign, Calendar, Clock } from 'lucide-react'

const F  = { fontFamily:'Monda,sans-serif' }
const SC = { pending:'#f59e0b', confirmed:'#16A34A', completed:'#3b82f6', cancelled:'#ef4444' }

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return { text:'Good morning', emoji:'☀️' }
  if (h < 17) return { text:'Good afternoon', emoji:'👋' }
  return { text:'Good evening', emoji:'🌙' }
}

// ── Notification bell ──────────────────────────────────────────────────────
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
    <button onClick={onOpen} style={{ position:'relative', background:'none', border:'none', cursor:'pointer', padding:6, color:'var(--text-sec)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <Bell size={20}/>
      {count > 0 && (
        <div style={{ position:'absolute', top:2, right:2, width:16, height:16, borderRadius:'50%', background:'var(--accent)', color:'white', fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {count > 9 ? '9+' : count}
        </div>
      )}
    </button>
  )
}

// ── Notifications panel ────────────────────────────────────────────────────
function NotificationsPanel({ userId, onClose }) {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const typeIcon = { broadcast:'📢', reschedule:'📅', cancel:'❌', booking:'✅', system:'ℹ️' }
  const typeColor = { broadcast:'#3b82f6', reschedule:'#f59e0b', cancel:'#ef4444', booking:'#16A34A', system:'#8b5cf6' }

  useEffect(() => {
    if (!userId) return
    getDocs(query(collection(db,'notifications'), where('userId','==',userId)))
      .then(snap => {
        const all = snap.docs.map(d=>({id:d.id,...d.data()}))
          .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
        setNotifs(all)
        setLoading(false)
        // Mark all as read
        snap.docs.filter(d=>!d.data().read).forEach(d => updateDoc(doc(db,'notifications',d.id),{read:true}))
      })
  }, [userId])

  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, background:'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div style={{ position:'absolute', top:0, right:0, bottom:0, width:Math.min(320, window.innerWidth), background:'var(--surface)', borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:17, margin:0, ...F }}>Notifications</p>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'12px' }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:40 }}><div style={{ width:24, height:24, border:'3px solid var(--accent)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto' }}/></div>
          ) : notifs.length === 0 ? (
            <div style={{ textAlign:'center', padding:40 }}>
              <Bell size={32} style={{ color:'var(--border)', margin:'0 auto 10px', display:'block' }}/>
              <p style={{ color:'var(--text-sec)', ...F }}>No notifications yet</p>
            </div>
          ) : notifs.map(n => (
            <div key={n.id} style={{ background:n.read?'var(--card)':'var(--accent)08', border:`1px solid ${n.read?'var(--border)':'var(--accent)22'}`, borderRadius:14, padding:'12px 14px', marginBottom:8 }}>
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{typeIcon[n.type]||'ℹ️'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:'0 0 3px', ...F }}>{n.title}</p>
                  <p style={{ color:'var(--text-sec)', fontSize:13, margin:'0 0 4px', lineHeight:1.4 }}>{n.message}</p>
                  {n.data?.fullMessage && n.data.fullMessage !== n.message && (
                    <p style={{ color:'var(--text-sec)', fontSize:12, margin:0, lineHeight:1.4, fontStyle:'italic' }}>{n.data.fullMessage}</p>
                  )}
                  <p style={{ color:'var(--text-sec)', fontSize:10, margin:'4px 0 0', fontWeight:700 }}>
                    {n.createdAt?.toDate?.()?.toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) || ''}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Spend detail view ──────────────────────────────────────────────────────
function SpendDetail({ appointments, onBack }) {
  const months = eachMonthOfInterval({ start: subMonths(new Date(),5), end: new Date() })
  const monthlyData = months.map(m => {
    const key   = format(m,'yyyy-MM')
    const spent = appointments.filter(a=>a.date?.startsWith(key)&&a.paymentStatus==='paid'&&a.bookingStatus==='completed').reduce((s,a)=>s+(a.totalPrice||0),0)
    const count = appointments.filter(a=>a.date?.startsWith(key)&&a.bookingStatus==='completed').length
    return { label:format(m,'MMMM yyyy'), key, spent, count }
  })
  const maxSpend = Math.max(...monthlyData.map(m=>m.spent),1)
  const totalSpent = appointments.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalPrice||0),0)

  return (
    <div style={{ padding:'20px', maxWidth:520, margin:'0 auto', ...F }}>
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, color:'var(--accent)', fontWeight:700, fontSize:13, background:'none', border:'none', cursor:'pointer', marginBottom:20, ...F }}>
        <ArrowLeft size={15}/> Back
      </button>
      <h2 style={{ color:'var(--text-pri)', fontWeight:900, fontSize:22, marginBottom:4 }}>Spending</h2>
      <p style={{ color:'var(--text-sec)', fontSize:13, marginBottom:20 }}>Your barbershop history</p>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px', marginBottom:16 }}>
        <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:6 }}>ALL-TIME SPENT</p>
        <p style={{ color:'var(--accent)', fontWeight:900, fontSize:32, margin:0 }}>{formatCurrency(totalSpent)}</p>
      </div>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px', marginBottom:16 }}>
        <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:14 }}>BY MONTH</p>
        <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:80, marginBottom:10 }}>
          {monthlyData.map((m,i) => (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <div style={{ width:'100%', borderRadius:'4px 4px 0 0', background:i===monthlyData.length-1?'var(--accent)':'var(--accent)44', height:m.spent>0?`${Math.max((m.spent/maxSpend)*64,4)}px`:'4px', transition:'height 0.3s' }}/>
              <span style={{ color:'var(--text-sec)', fontSize:8, fontWeight:700 }}>{format(months[i],'MMM')}</span>
            </div>
          ))}
        </div>
        {monthlyData.filter(m=>m.spent>0).map(m => (
          <div key={m.key} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
            <span style={{ color:'var(--text-pri)', fontSize:13 }}>{m.label}</span>
            <div style={{ textAlign:'right' }}>
              <span style={{ color:'var(--accent)', fontWeight:700, fontSize:13 }}>{formatCurrency(m.spent)}</span>
              <span style={{ color:'var(--text-sec)', fontSize:11, marginLeft:8 }}>{m.count} visit{m.count!==1?'s':''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Visit history view ─────────────────────────────────────────────────────
function VisitHistory({ appointments, onBack }) {
  const done = appointments
    .filter(a => a.bookingStatus==='completed'||isPast(new Date(`${a.date}T${a.startTime}`)))
    .sort((a,b)=>b.date?.localeCompare(a.date)||0)
  return (
    <div style={{ padding:'20px', maxWidth:520, margin:'0 auto', ...F }}>
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, color:'var(--accent)', fontWeight:700, fontSize:13, background:'none', border:'none', cursor:'pointer', marginBottom:20, ...F }}>
        <ArrowLeft size={15}/> Back
      </button>
      <h2 style={{ color:'var(--text-pri)', fontWeight:900, fontSize:22, marginBottom:4 }}>All Visits</h2>
      <p style={{ color:'var(--text-sec)', fontSize:13, marginBottom:20 }}>{done.length} total appointment{done.length!==1?'s':''}</p>
      {done.length===0 ? (
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:40, textAlign:'center' }}>
          <p style={{ color:'var(--text-sec)', margin:0 }}>No visits yet</p>
        </div>
      ) : done.map(a => (
        <div key={a.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderLeft:`3px solid ${SC[a.bookingStatus]||'#555'}`, borderRadius:14, padding:'13px 16px', marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <div>
              <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:'0 0 2px' }}>{a.date?format(parseLocalDate(a.date),'EEE, MMM d, yyyy'):'—'}</p>
              <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{a.startTime} · {formatDuration(a.totalDuration)}</p>
            </div>
            <div style={{ textAlign:'right' }}>
              <p style={{ color:'var(--accent)', fontWeight:800, fontSize:14, margin:'0 0 2px' }}>{formatCurrency(a.totalPrice)}</p>
              <p style={{ color:SC[a.bookingStatus], fontSize:10, fontWeight:700, textTransform:'uppercase', margin:0 }}>{a.bookingStatus}</p>
            </div>
          </div>
          {a.services?.length>0 && <p style={{ color:'var(--text-sec)', fontSize:12, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.services.map(s=>s.name).join(', ')}</p>}
          {a.tip>0 && <p style={{ color:'#16A34A', fontSize:11, marginTop:3 }}>Tip: +{formatCurrency(a.tip)}</p>}
        </div>
      ))}
    </div>
  )
}

// ── Profile view ───────────────────────────────────────────────────────────
function ProfileView({ user, userData, onSave, onSignOut }) {
  const { theme, toggleTheme, timeFormat, setTimeFormat, accent, setAccent, accents } = useTheme()
  const [form, setForm]     = useState({ firstName:userData?.firstName||'', lastName:userData?.lastName||'', phone:userData?.phone||'', photoURL:userData?.photoURL||'' })
  const [saving, setSaving] = useState(false)
  const photoRef = useRef(null)

  async function save() {
    setSaving(true)
    try { await updateDoc(doc(db,'users',user.uid),form); await onSave(); toast.success('Saved!') }
    catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ background:'#080808', minHeight:'100%', color:'#F5F5F5', padding:'20px 16px', paddingBottom:100, maxWidth:520, margin:'0 auto', ...F }}>
      <h2 style={{ color:'#F5F5F5', fontWeight:900, fontSize:22, marginBottom:20 }}>Profile</h2>

      {/* Photo */}
      <div style={{ textAlign:'center', marginBottom:20 }}>
        <div style={{ position:'relative', display:'inline-block', cursor:'pointer' }} onClick={() => photoRef.current?.click()}>
          <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', background:'var(--accent)22', border:'3px solid var(--accent)44', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:26, color:'var(--accent)' }}>
            {form.photoURL?<img src={form.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:`${form.firstName?.[0]||''}${form.lastName?.[0]||''}`}
          </div>
          <div style={{ position:'absolute', bottom:0, right:0, width:26, height:26, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid var(--surface)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M20 5h-3.2L15 3H9L7.2 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/><circle cx="12" cy="13" r="3" fill="white"/></svg>
          </div>
        </div>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{display:'none'}}
      onChange={async e=>{
        const file=e.target.files?.[0]; if(!file)return
        const reader=new FileReader(); reader.onload=ev=>setForm(p=>({...p,photoURL:ev.target.result})); reader.readAsDataURL(file)
        try {
          const path=sRef(storage,`profiles/${user.uid}/photo_${Date.now()}`)
          const snap=await uploadBytes(path,file); const url=await getDownloadURL(snap.ref)
          setForm(p=>({...p,photoURL:url}))
        } catch(err){ console.warn('Storage fallback:',err.code) }
      }}/>
        <p style={{ color:'var(--text-sec)', fontSize:12, marginTop:8 }}>Tap to change photo</p>
      </div>

      {/* Fields */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px', marginBottom:14 }}>
        {[['FIRST NAME','firstName','text'],['LAST NAME','lastName','text']].map(([lbl,key,type]) => (
          <div key={key} style={{ marginBottom:16 }}>
            <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:7 }}>{lbl}</p>
            <div style={{ borderBottom:'1.5px solid var(--border)', paddingBottom:8 }}>
              <input type={type} value={form[key]||''} onChange={e=>{const v=e.target.value;setForm(p=>({...p,[key]:v}))}} autoComplete="off"
                style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:'var(--text-pri)', fontSize:16, fontFamily:'Monda,sans-serif' }}/>
            </div>
          </div>
        ))}
        <div style={{ marginBottom:16 }}>
          <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:7 }}>PHONE</p>
          <PhoneInput value={form.phone||''} onChange={v=>setForm(p=>({...p,phone:v}))}/>
        </div>
        <button onClick={save} disabled={saving}
          style={{ width:'100%', background:'var(--accent)', border:'none', borderRadius:12, padding:'15px', color:'white', fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, ...F }}>
          {saving&&<div style={{width:16,height:16,border:'2px solid white',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>}
          {saving?'Saving…':'Save Changes'}
        </button>
      </div>

      {/* Appearance settings */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px', marginBottom:14 }}>
        <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:14 }}>APPEARANCE</p>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <p style={{ color:'var(--text-pri)', fontWeight:600, fontSize:14, margin:0 }}>{theme==='light'?'Light Mode':'Dark Mode'}</p>
          <button onClick={toggleTheme}
            style={{ width:52, height:28, borderRadius:14, padding:3, border:'none', cursor:'pointer', background:theme==='light'?'var(--border)':'var(--accent)', display:'flex', alignItems:'center', justifyContent:theme==='light'?'flex-start':'flex-end', transition:'background 0.2s' }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background:'white', boxShadow:'0 1px 4px rgba(0,0,0,0.2)', transition:'all 0.2s' }}/>
          </button>
        </div>
        <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:10 }}>TIME FORMAT</p>
        <div style={{ display:'flex', background:'var(--bg)', borderRadius:12, padding:3, border:'1px solid var(--border)', marginBottom:16 }}>
          {[['12h','12h (AM/PM)'],['24h','24h']].map(([val,lbl]) => (
            <button key={val} onClick={()=>setTimeFormat(val)}
              style={{ flex:1, padding:'9px', borderRadius:10, fontWeight:700, fontSize:13, background:timeFormat===val?'var(--accent)':'transparent', color:timeFormat===val?'white':'var(--text-sec)', border:'none', cursor:'pointer', ...F }}>
              {lbl}
            </button>
          ))}
        </div>
        <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:10 }}>ACCENT COLOR</p>
        <div style={{ display:'flex', gap:10 }}>
          {accents.map(a => (
            <button key={a.id} onClick={()=>setAccent(a.color)}
              style={{ flex:1, padding:'10px 4px', borderRadius:12, border:`2px solid ${accent===a.color?a.color:'var(--border)'}`, background:accent===a.color?a.color+'22':'var(--card)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
              <div style={{ width:24, height:24, borderRadius:'50%', background:a.color, border:`3px solid ${accent===a.color?'white':'transparent'}`, boxShadow:accent===a.color?`0 0 0 2px ${a.color}`:'none' }}/>
              <span style={{ color:accent===a.color?a.color:'var(--text-sec)', fontSize:10, fontWeight:700, fontFamily:'Monda,sans-serif' }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <button onClick={onSignOut}
        style={{ width:'100%', background:'none', border:'1px solid var(--border)', borderRadius:12, padding:'14px', color:'#ef4444', fontWeight:600, fontSize:14, cursor:'pointer', ...F }}>
        Sign Out
      </button>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const { barberSlug } = useParams()
  const { user, userData, signOut, refreshUserData } = useAuth()
  const { formatTime } = useTheme()
  const navigate = useNavigate()
  const [view, setView]           = useState('home')  // home | profile | spend | visits
  const [appointments, setAppointments] = useState([])
  const [barberInfo, setBarberInfo]     = useState(null)
  const [availability, setAvailability] = useState(null)
  const [barberAppts, setBarberAppts]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [cancelTarget, setCancelTarget]   = useState(null)
  const [reschedAppt, setReschedAppt]     = useState(null)
  const [reschedDate, setReschedDate]     = useState(null)
  const [reschedSlot, setReschedSlot]     = useState(null)
  const [reschedSlots, setReschedSlots]   = useState([])
  const [reschedNote, setReschedNote]     = useState('')
  const [reschedPage, setReschedPage]     = useState(0)
  const [showNotifs, setShowNotifs]       = useState(false)
  const refreshRef = useRef(null)

  useEffect(() => {
    if (!user) { navigate(`/b/${barberSlug}/auth`); return }
  }, [user])

  async function loadAppts() {
    if (!user) return
    const snap = await getDocs(query(collection(db,'appointments'), where('clientId','==',user.uid)))
    const all  = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
    setAppointments(all)
    setLoading(false)
    if (all.length>0 && !barberInfo) {
      const bSnap = await getDocs(query(collection(db,'barbers'), where('slug','==',barberSlug)))
      if (!bSnap.empty) {
        const b = {id:bSnap.docs[0].id,...bSnap.docs[0].data()}
        setBarberInfo(b)
        const aSnap = await getDocs(query(collection(db,'availability'), where('barberId','==',b.id)))
        if (!aSnap.empty) setAvailability(aSnap.docs[0].data())
        const apptSnap = await getDocs(query(collection(db,'appointments'), where('barberId','==',b.id)))
        setBarberAppts(apptSnap.docs.map(d=>d.data()))
      }
    }
  }

  useEffect(() => { loadAppts(); refreshRef.current=setInterval(loadAppts,20000); return()=>clearInterval(refreshRef.current) }, [user])

  // Reschedule slots
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
  const totalSpent  = userData?.totalSpent  || appointments.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalPrice||0),0)
  const totalVisits = userData?.totalVisits || history.filter(a=>a.bookingStatus==='completed').length
  const { text:greetText, emoji:greetEmoji } = getGreeting()

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:28, height:28, border:'3px solid var(--accent)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', ...F, paddingBottom:90 }}>
      {/* Sub-views */}
      {view==='spend'  && <SpendDetail  appointments={appointments} onBack={()=>setView('home')}/>}
      {view==='visits' && <VisitHistory appointments={appointments} onBack={()=>setView('home')}/>}
      {view==='profile' && (
        <ProfileView user={user} userData={userData}
          onSave={async()=>{ await refreshUserData() }}
          onSignOut={async()=>{ await signOut(); navigate(`/b/${barberSlug}`) }}
        />
      )}

      {/* HOME view */}
      {view==='home' && (
        <div style={{ padding:'20px', maxWidth:520, margin:'0 auto' }}>
          {/* Header row */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
            <div>
              <p style={{ color:'var(--text-sec)', fontSize:13, fontWeight:600, margin:'0 0 2px' }}>{greetText} {greetEmoji}</p>
              <h1 style={{ color:'var(--text-pri)', fontWeight:900, fontSize:28, margin:0, lineHeight:1, textTransform:'lowercase' }}>{userData?.firstName}!</h1>
            </div>
            <NotifBell userId={user?.uid} onOpen={()=>setShowNotifs(true)}/>
          </div>

          {/* Stats — tappable */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
            <button onClick={()=>setView('visits')}
              style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 10px', textAlign:'center', cursor:'pointer', ...F }}>
              <p style={{ color:'var(--accent)', fontWeight:900, fontSize:22, margin:'0 0 3px' }}>{totalVisits}</p>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:600, margin:0 }}>Visits</p>
            </button>
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 10px', textAlign:'center' }}>
              <p style={{ color:'var(--accent)', fontWeight:900, fontSize:22, margin:'0 0 3px' }}>{upcoming.length}</p>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:600, margin:0 }}>Upcoming</p>
            </div>
            <button onClick={()=>setView('spend')}
              style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 10px', textAlign:'center', cursor:'pointer', ...F }}>
              <p style={{ color:'var(--accent)', fontWeight:900, fontSize:20, margin:'0 0 3px' }}>${(totalSpent||0).toFixed(0)}</p>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:600, margin:0 }}>Spent</p>
            </button>
          </div>

          {/* Next appointment */}
          {next && (
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderLeft:'3px solid var(--accent)', borderRadius:16, padding:'16px', marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
                    {barberInfo?.photoURL && <img src={barberInfo.photoURL} style={{width:24,height:24,borderRadius:6,objectFit:'cover'}} alt=""/>}
                    <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:15, margin:0 }}>{next.barberName}</p>
                  </div>
                  <p style={{ color:'var(--accent)', fontWeight:600, fontSize:13, margin:'0 0 2px' }}>{next.date?format(parseLocalDate(next.date),'EEE, MMM d'):''} · {formatTime(next.startTime)}</p>
                  <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{formatDuration(next.totalDuration)}</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ color:'var(--accent)', fontWeight:900, fontSize:18, margin:'0 0 4px' }}>{formatCurrency(next.totalPrice)}</p>
                  <p style={{ color:'#16A34A', fontSize:11, fontWeight:700 }}>
                    {differenceInDays(new Date(`${next.date}T${next.startTime}`),new Date())===0?'Today!':`In ${differenceInDays(new Date(`${next.date}T${next.startTime}`),new Date())} days`}
                  </p>
                </div>
              </div>
              {next.services?.length>0 && <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>{next.services.map((s,i)=><span key={i} style={{background:'var(--bg)',color:'var(--text-sec)',fontSize:11,padding:'3px 9px',borderRadius:20,border:'1px solid var(--border)'}}>{s.name}</span>)}</div>}
              {barberInfo?.address && <button onClick={()=>openMaps(barberInfo.address)} style={{display:'flex',alignItems:'center',gap:5,background:'none',border:'none',color:'var(--accent)',fontSize:12,cursor:'pointer',padding:'4px 0',marginBottom:8,...F}}><Navigation size={12}/> Directions</button>}
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>{setReschedAppt(next);setReschedDate(null);setReschedSlot(null);setReschedNote('')}}
                  style={{background:'var(--accent)15',border:'1px solid var(--accent)25',borderRadius:8,padding:'7px 12px',color:'var(--accent)',fontSize:12,fontWeight:700,cursor:'pointer',...F,display:'flex',alignItems:'center',gap:4}}>
                  <RefreshCw size={10}/> Reschedule
                </button>
                <button onClick={()=>setCancelTarget(next.id)}
                  style={{background:'#ef444410',border:'1px solid #ef444425',borderRadius:8,padding:'7px 12px',color:'#ef4444',fontSize:12,fontWeight:700,cursor:'pointer',...F,display:'flex',alignItems:'center',gap:4}}>
                  <X size={10}/> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Upcoming list */}
          {upcoming.slice(1).length>0 && (
            <div style={{ marginBottom:16 }}>
              <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>UPCOMING</p>
              {upcoming.slice(1).map(a=>(
                <div key={a.id} style={{background:'var(--card)',border:'1px solid var(--border)',borderLeft:'2px solid var(--accent)',borderRadius:12,padding:'12px 14px',marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                    <div>
                      <p style={{color:'var(--text-pri)',fontWeight:600,fontSize:13,margin:'0 0 2px'}}>{a.date?format(parseLocalDate(a.date),'MMM d'):''} · {formatTime(a.startTime)}</p>
                      <p style={{color:'var(--text-sec)',fontSize:11,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:160}}>{a.services?.map(s=>s.name).join(', ')}</p>
                    </div>
                    <p style={{color:'var(--accent)',fontWeight:700,fontSize:13,flexShrink:0}}>{formatCurrency(a.totalPrice)}</p>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>{setReschedAppt(a);setReschedDate(null);setReschedSlot(null);setReschedNote('')}}
                      style={{background:'var(--accent)15',border:'1px solid var(--accent)25',borderRadius:8,padding:'5px 10px',color:'var(--accent)',fontSize:11,fontWeight:700,cursor:'pointer',...F,display:'flex',alignItems:'center',gap:3}}>
                      <RefreshCw size={10}/> Reschedule
                    </button>
                    <button onClick={()=>setCancelTarget(a.id)}
                      style={{background:'#ef444410',border:'1px solid #ef444425',borderRadius:8,padding:'5px 10px',color:'#ef4444',fontSize:11,fontWeight:700,cursor:'pointer',...F}}>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent history */}
          {history.slice(0,3).length>0 && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', margin:0 }}>RECENT</p>
                <button onClick={()=>setView('visits')} style={{color:'var(--accent)',fontSize:12,fontWeight:700,background:'none',border:'none',cursor:'pointer',...F}}>See all</button>
              </div>
              {history.slice(0,3).map(a=>(
                <div key={a.id} style={{background:'var(--card)',border:'1px solid var(--border)',borderLeft:`2px solid ${SC[a.bookingStatus]||'#555'}`,borderRadius:12,padding:'11px 13px',marginBottom:8,display:'flex',justifyContent:'space-between',opacity:a.bookingStatus==='cancelled'?0.5:1}}>
                  <div>
                    <p style={{color:'var(--text-pri)',fontWeight:600,fontSize:13,margin:'0 0 2px'}}>{a.date?format(parseLocalDate(a.date),'MMM d, yyyy'):''}</p>
                    <p style={{color:'var(--text-sec)',fontSize:11,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:170}}>{a.services?.map(s=>s.name).join(', ')}</p>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <p style={{color:'var(--accent)',fontWeight:700,fontSize:13,margin:'0 0 2px'}}>{formatCurrency(a.totalPrice)}</p>
                    <p style={{color:SC[a.bookingStatus],fontSize:10,fontWeight:700,textTransform:'uppercase',margin:0}}>{a.bookingStatus}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom nav — 3 buttons, center elevated ── */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--surface)', borderTop:'1px solid var(--border)', paddingBottom:'max(8px,env(safe-area-inset-bottom))', display:'flex', alignItems:'center', justifyContent:'space-around', padding:'8px 24px max(8px,env(safe-area-inset-bottom))' }}>
        {/* Home */}
        <button onClick={()=>setView('home')}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'none', border:'none', cursor:'pointer', color:view==='home'?'var(--accent)':'var(--text-sec)', flex:1, ...F }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={view==='home'?'var(--accent)':'none'} stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
          <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.04em' }}>HOME</span>
        </button>

        {/* Book — center, elevated accent button */}
        <div style={{ flex:1, display:'flex', justifyContent:'center', position:'relative' }}>
          <button onClick={()=>navigate(`/b/${barberSlug}/book`)}
            style={{ width:60, height:60, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent),#FF9000)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 20px rgba(255,92,0,0.5)', marginTop:-20, position:'relative', zIndex:1 }}>
            <Scissors size={24} color="white"/>
          </button>
        </div>

        {/* Profile */}
        <button onClick={()=>setView('profile')}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'none', border:'none', cursor:'pointer', color:view==='profile'?'var(--accent)':'var(--text-sec)', flex:1, ...F }}>
          <User size={22} fill={view==='profile'?'var(--accent)':'none'} stroke="currentColor"/>
          <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.04em' }}>PROFILE</span>
        </button>
      </div>

      {/* Cancel modal */}
      {cancelTarget && (
        <Overlay onClose={()=>setCancelTarget(null)}>
          <p style={{color:'var(--text-pri)',fontWeight:900,fontSize:17,marginBottom:8,...F}}>Cancel appointment?</p>
          <p style={{color:'var(--text-sec)',fontSize:14,marginBottom:18}}>This cannot be undone. Would you prefer to reschedule?</p>
          <div style={{display:'flex',gap:10,marginBottom:8}}>
            <button onClick={()=>{setCancelTarget(null);const a=appointments.find(a=>a.id===cancelTarget);if(a){setReschedAppt(a);setReschedDate(null);setReschedSlot(null)}}}
              style={{flex:1,padding:'13px',borderRadius:12,background:'var(--accent)15',color:'var(--accent)',fontWeight:700,border:'1px solid var(--accent)25',cursor:'pointer',...F}}>
              Reschedule Instead
            </button>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>setCancelTarget(null)} style={{flex:1,padding:'13px',borderRadius:12,background:'var(--card)',color:'var(--text-sec)',fontWeight:600,border:'1px solid var(--border)',cursor:'pointer',...F}}>Keep It</button>
            <button onClick={handleCancel} style={{flex:1,padding:'13px',borderRadius:12,background:'#ef444415',color:'#ef4444',fontWeight:700,border:'1px solid #ef444433',cursor:'pointer',...F}}>Cancel</button>
          </div>
        </Overlay>
      )}

      {/* Reschedule modal */}
      {reschedAppt && (
        <Overlay onClose={()=>setReschedAppt(null)}>
          <p style={{color:'var(--text-pri)',fontWeight:900,fontSize:17,marginBottom:4,...F}}>Reschedule</p>
          <p style={{color:'var(--text-sec)',fontSize:13,marginBottom:14}}>{reschedAppt.services?.map(s=>s.name).join(', ')} · {formatDuration(reschedAppt.totalDuration||0)}</p>
          {/* Day selector */}
          {(()=>{
            const today2=startOfDay(new Date()); const advance=availability?.advanceDays||30
            const days=Array.from({length:advance},(_,i)=>addDays(today2,i))
            const perPage=7; const visible=days.slice(reschedPage*perPage,(reschedPage+1)*perPage)
            return (<div style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <button onClick={()=>setReschedPage(p=>Math.max(0,p-1))} disabled={reschedPage===0} style={{background:'none',border:'none',color:reschedPage===0?'var(--border)':'var(--text-pri)',cursor:'pointer',padding:4}}><ChevronLeft size={15}/></button>
                <span style={{color:'var(--text-sec)',fontSize:12}}>{visible[0]&&format(visible[0],'MMM d')} – {visible[visible.length-1]&&format(visible[visible.length-1],'MMM d')}</span>
                <button onClick={()=>setReschedPage(p=>(p+1)*perPage<advance?p+1:p)} style={{background:'none',border:'none',color:(reschedPage+1)*perPage>=advance?'var(--border)':'var(--text-pri)',cursor:'pointer',padding:4}}><ChevronRight size={15}/></button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
                {visible.map((date,i)=>{
                  const isSel=reschedDate&&isSameDay(date,reschedDate)
                  return(<button key={i} onClick={()=>setReschedDate(date)} style={{background:isSel?'var(--accent)':'var(--card)',border:`1px solid ${isSel?'var(--accent)':'var(--border)'}`,borderRadius:10,padding:'7px 2px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2,...F}}>
                    <span style={{color:isSel?'#fff':'var(--text-sec)',fontSize:9,fontWeight:700}}>{format(date,'EEE').toUpperCase()}</span>
                    <span style={{color:isSel?'#fff':'var(--text-pri)',fontSize:13,fontWeight:800}}>{format(date,'d')}</span>
                  </button>)
                })}
              </div>
            </div>)
          })()}
          {reschedDate&&(<>
            <p style={{color:'var(--text-sec)',fontSize:10,fontWeight:700,letterSpacing:'0.08em',marginBottom:8}}>{format(reschedDate,'EEE, MMM d').toUpperCase()}</p>
            {reschedSlots.length===0?<p style={{color:'var(--text-sec)',fontSize:13,marginBottom:14}}>No slots available.</p>:(
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:14}}>
                {reschedSlots.map(slot=>(
                  <button key={slot.startTime} onClick={()=>setReschedSlot(slot)}
                    style={{padding:'10px 3px',borderRadius:10,border:`1.5px solid ${reschedSlot?.startTime===slot.startTime?'var(--accent)':'var(--border)'}`,background:reschedSlot?.startTime===slot.startTime?'var(--accent)':'var(--card)',color:reschedSlot?.startTime===slot.startTime?'white':'var(--text-pri)',fontWeight:700,fontSize:12,cursor:'pointer',...F}}>
                    {formatTime(slot.startTime)}
                  </button>
                ))}
              </div>
            )}
          </>)}
          <div style={{marginBottom:14}}>
            <p style={{color:'var(--text-sec)',fontSize:10,fontWeight:700,letterSpacing:'0.08em',marginBottom:6}}>NOTE (optional)</p>
            <textarea value={reschedNote} onChange={e=>setReschedNote(e.target.value)} rows={2} placeholder="Reason for rescheduling..."
              style={{width:'100%',background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px',color:'var(--text-pri)',fontSize:14,resize:'none',outline:'none',...F,boxSizing:'border-box'}}/>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>setReschedAppt(null)} style={{flex:1,padding:'13px',borderRadius:12,background:'var(--card)',color:'var(--text-sec)',fontWeight:600,border:'1px solid var(--border)',cursor:'pointer',...F}}>Cancel</button>
            <button onClick={handleReschedule} disabled={!reschedSlot} style={{flex:1,padding:'13px',borderRadius:12,background:reschedSlot?'var(--accent)':'var(--border)',color:'white',fontWeight:700,border:'none',cursor:reschedSlot?'pointer':'not-allowed',...F}}>Confirm</button>
          </div>
        </Overlay>
      )}

      {/* Important message floating popup */}
      <ImportantMessagePopup userId={user?.uid}/>

      {/* Notifications panel */}
      {showNotifs && <NotificationsPanel userId={user?.uid} onClose={()=>setShowNotifs(false)}/>}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function Overlay({ children, onClose }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:20,padding:22,width:'100%',maxWidth:380,...F,maxHeight:'80vh',overflowY:'auto'}}>
        {children}
      </div>
    </div>
  )
}