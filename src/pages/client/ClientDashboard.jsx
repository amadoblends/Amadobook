/**
 * ClientDashboard — Previous 3-button layout + Premium Black/Yellow/White aesthetic
 * Structure:  Home | [Scissors elevated] | Profile
 * No cancel button. Responsive: mobile/iPad/laptop.
 */
import { useEffect, useState, useRef } from 'react'
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, storage } from '../../lib/firebase'
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration, parseLocalDate, generateTimeSlots } from '../../utils/helpers'
import { useTheme } from '../../context/ThemeContext'
import {
  format, isToday, isTomorrow, differenceInDays,
  eachMonthOfInterval, subMonths, addDays, startOfDay, isSameDay
} from 'date-fns'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Home, User, Scissors, Bell, ArrowLeft, Star, Clock, ChevronRight, Check, Plus, X, MapPin, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import ImportantMessagePopup from '../../components/ui/ImportantMessagePopup'

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  bg:      '#080808',
  card:    '#0F0F0F',
  raised:  '#161616',
  hover:   '#1C1C1C',
  border:  '#1E1E1E',
  borderM: '#282828',
  textPri: '#F5F5F5',
  textSec: '#777777',
  textTert:'#3A3A3A',
  textInv: '#080808',
  yellow:  '#F5C518',
  yellowD: 'rgba(245,197,24,0.10)',
  yellowM: 'rgba(245,197,24,0.20)',
  yellowG: '0 0 24px rgba(245,197,24,0.30)',
  green:   '#22C55E',
  greenD:  'rgba(34,197,94,0.12)',
  red:     '#F43F5E',
  redD:    'rgba(244,63,94,0.12)',
  blue:    '#3B82F6',
  font:    "'Monda', system-ui, sans-serif",
}
const F = { fontFamily: T.font }

// ── Status color helper ────────────────────────────────────────────────────
const sc = s => ({ pending:T.yellow, confirmed:T.green, completed:T.blue, cancelled:T.red }[s] || T.textSec)

// ── Atom: Notification Bell ────────────────────────────────────────────────
function NotifBell({ userId, onOpen }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!userId) return
    const check = () => getDocs(query(collection(db,'notifications'), where('userId','==',userId), where('read','==',false))).then(s=>setCount(s.size))
    check()
    const iv = setInterval(check, 25000)
    return () => clearInterval(iv)
  },[userId])
  return (
    <button onClick={onOpen} style={{ position:'relative', background:T.raised, border:`1px solid ${T.border}`, borderRadius:12, width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:T.textSec }}>
      <Bell size={17}/>
      {count>0 && <div style={{ position:'absolute', top:7, right:7, width:8, height:8, borderRadius:'50%', background:T.yellow, boxShadow:T.yellowG }}/>}
    </button>
  )
}

// ── Atom: Avatar ───────────────────────────────────────────────────────────
function Avatar({ src, name='', size=44, radius='50%' }) {
  return (
    <div style={{ width:size, height:size, borderRadius:radius, overflow:'hidden', flexShrink:0, background:T.yellowD, border:`1.5px solid ${T.borderM}`, display:'flex', alignItems:'center', justifyContent:'center', color:T.yellow, fontWeight:800, fontSize:size*0.33, ...F }}>
      {src ? <img src={src} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?'}
    </div>
  )
}

// ── Pill label ─────────────────────────────────────────────────────────────
const Pill = ({label, color=T.yellow, bg}) => (
  <span style={{ display:'inline-flex', alignItems:'center', fontSize:10, fontWeight:700, letterSpacing:'0.04em', padding:'3px 9px', borderRadius:20, background:bg||(color+'18'), color, textTransform:'uppercase', ...F }}>
    {label}
  </span>
)

// ── Appointment card ───────────────────────────────────────────────────────
function ApptCard({ appt, formatTime, dimmed }) {
  const color = sc(appt.bookingStatus)
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderLeft:`3px solid ${color}`, borderRadius:16, padding:'14px 16px', opacity:dimmed&&appt.bookingStatus==='cancelled'?0.45:1, marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
        <div>
          <p style={{ color:T.textPri, fontWeight:700, fontSize:15, margin:'0 0 3px' }}>{appt.barberName}</p>
          <p style={{ color:T.textSec, fontSize:13, margin:0 }}>
            {appt.date?format(parseLocalDate(appt.date),'EEE, MMM d'):''} · {formatTime?.(appt.startTime)||appt.startTime}
          </p>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <p style={{ color:T.yellow, fontWeight:800, fontSize:15, margin:'0 0 4px' }}>{formatCurrency(appt.totalPrice)}</p>
          <Pill label={appt.bookingStatus} color={color}/>
        </div>
      </div>
      {appt.services?.length>0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
          {appt.services.map((s,i)=><Pill key={i} label={s.name} color={T.textSec} bg={T.raised}/>)}
        </div>
      )}
      {appt.cancelReason && <p style={{ color:T.red, fontSize:12, marginTop:6 }}>Cancelled: {appt.cancelReason}</p>}
    </div>
  )
}

// ── Notifications panel ────────────────────────────────────────────────────
function NotifsPanel({ userId, onClose }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const icon = { broadcast:'📢', reschedule:'📅', cancel:'❌', booking:'✅', system:'ℹ️' }

  useEffect(()=>{
    if (!userId) return
    getDocs(query(collection(db,'notifications'),where('userId','==',userId)))
      .then(snap=>{
        setItems(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
        setLoading(false)
        snap.docs.filter(d=>!d.data().read).forEach(d=>updateDoc(doc(db,'notifications',d.id),{read:true}))
      })
  },[userId])

  return (
    <div style={{ position:'fixed', inset:0, zIndex:80, background:'rgba(0,0,0,0.88)' }} onClick={onClose}>
      <div style={{ position:'absolute', right:0, top:0, bottom:0, width:Math.min(340,window.innerWidth), background:T.card, borderLeft:`1px solid ${T.border}`, display:'flex', flexDirection:'column', ...F }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <p style={{ color:T.textPri, fontWeight:800, fontSize:17, margin:0 }}>Notifications</p>
          <button onClick={onClose} style={{ background:T.raised, border:`1px solid ${T.border}`, borderRadius:8, width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:T.textSec }}><X size={15}/></button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'12px' }}>
          {loading ? <div style={{display:'flex',justifyContent:'center',padding:40}}><div style={{width:22,height:22,border:`3px solid ${T.yellow}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/></div>
          : items.length===0 ? <div style={{textAlign:'center',padding:40}}><Bell size={28} style={{color:T.textTert,margin:'0 auto 12px',display:'block'}}/><p style={{color:T.textSec,fontSize:14}}>No notifications</p></div>
          : items.map(n=>(
            <div key={n.id} style={{ background:n.read?T.raised:T.yellowD, border:`1px solid ${n.read?T.border:T.yellow+'33'}`, borderRadius:14, padding:'12px', marginBottom:8 }}>
              <div style={{ display:'flex', gap:10 }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{icon[n.type]||'ℹ️'}</span>
                <div style={{ flex:1 }}>
                  <p style={{ color:T.textPri, fontWeight:700, fontSize:13, margin:'0 0 3px' }}>{n.title}</p>
                  <p style={{ color:T.textSec, fontSize:12, margin:0, lineHeight:1.5 }}>{n.message}</p>
                  {n.data?.fullMessage && n.data.fullMessage!==n.message && <p style={{ color:T.textTert, fontSize:11, margin:'4px 0 0', lineHeight:1.4, fontStyle:'italic' }}>{n.data.fullMessage}</p>}
                  <p style={{ color:T.textTert, fontSize:10, margin:'5px 0 0' }}>{n.createdAt?.toDate?.()?.toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})||''}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Spend detail ───────────────────────────────────────────────────────────
function SpendDetail({ appointments, onBack }) {
  const months = eachMonthOfInterval({ start:subMonths(new Date(),5), end:new Date() })
  const data = months.map(m => {
    const key = format(m,'yyyy-MM')
    const spent = appointments.filter(a=>a.date?.startsWith(key)&&a.paymentStatus==='paid'&&a.bookingStatus==='completed').reduce((s,a)=>s+(a.totalPrice||0),0)
    const count = appointments.filter(a=>a.date?.startsWith(key)&&a.bookingStatus==='completed').length
    return { label:format(m,'MMM'), fullLabel:format(m,'MMMM yyyy'), spent, count }
  })
  const maxSpend = Math.max(...data.map(d=>d.spent),1)
  const totalSpent = appointments.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalPrice||0),0)

  return (
    <div style={{ padding:'20px', maxWidth:560, margin:'0 auto', ...F, paddingBottom:100 }}>
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, color:T.yellow, fontWeight:700, fontSize:13, background:'none', border:'none', cursor:'pointer', marginBottom:24, ...F }}>
        <ArrowLeft size={15}/> Back
      </button>
      <h2 style={{ color:T.textPri, fontWeight:900, fontSize:24, margin:'0 0 4px' }}>Spending</h2>
      <p style={{ color:T.textSec, fontSize:14, marginBottom:24 }}>Your barbershop history</p>

      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:18, padding:'18px', marginBottom:14 }}>
        <p style={{ color:T.textSec, fontSize:11, fontWeight:700, letterSpacing:'0.08em', margin:'0 0 8px' }}>ALL-TIME SPENT</p>
        <p style={{ color:T.yellow, fontWeight:900, fontSize:34, margin:0, lineHeight:1 }}>{formatCurrency(totalSpent)}</p>
      </div>

      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:18, padding:'18px' }}>
        <p style={{ color:T.textSec, fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:16 }}>LAST 6 MONTHS</p>
        <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:80, marginBottom:12 }}>
          {data.map((d,i)=>(
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
              <div style={{ width:'100%', borderRadius:'3px 3px 0 0', background:i===data.length-1?T.yellow:T.yellow+'44', height:d.spent>0?`${Math.max((d.spent/maxSpend)*64,4)}px`:'4px', transition:'height 0.3s' }}/>
              <span style={{ color:T.textSec, fontSize:9, fontWeight:700 }}>{d.label}</span>
            </div>
          ))}
        </div>
        {data.filter(d=>d.spent>0).map((d,i)=>(
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
            <span style={{ color:T.textPri, fontSize:13 }}>{d.fullLabel}</span>
            <div style={{ textAlign:'right' }}>
              <span style={{ color:T.yellow, fontWeight:700, fontSize:13 }}>{formatCurrency(d.spent)}</span>
              <span style={{ color:T.textSec, fontSize:11, marginLeft:8 }}>{d.count} visit{d.count!==1?'s':''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Visit history ──────────────────────────────────────────────────────────
function VisitHistory({ appointments, onBack, formatTime }) {
  const history = [...appointments].sort((a,b)=>b.date?.localeCompare(a.date)||0)
  return (
    <div style={{ padding:'20px', maxWidth:560, margin:'0 auto', ...F, paddingBottom:100 }}>
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, color:T.yellow, fontWeight:700, fontSize:13, background:'none', border:'none', cursor:'pointer', marginBottom:24, ...F }}>
        <ArrowLeft size={15}/> Back
      </button>
      <h2 style={{ color:T.textPri, fontWeight:900, fontSize:24, margin:'0 0 4px' }}>All Visits</h2>
      <p style={{ color:T.textSec, fontSize:14, marginBottom:20 }}>{history.filter(a=>a.bookingStatus==='completed').length} completed visits</p>
      {history.length===0
        ? <p style={{ color:T.textSec, textAlign:'center', padding:40 }}>No appointments yet</p>
        : history.map(a=><ApptCard key={a.id} appt={a} formatTime={formatTime} dimmed/>)
      }
    </div>
  )
}

// ── Profile tab content ────────────────────────────────────────────────────
function ProfileView({ user, userData, onSave, onSignOut }) {
  const { theme, toggleTheme, timeFormat, setTimeFormat } = useTheme()
  const [form, setForm] = useState({ firstName:userData?.firstName||'', lastName:userData?.lastName||'', phone:userData?.phone||'', photoURL:userData?.photoURL||'' })
  const [saving, setSaving] = useState(false)
  const photoRef = useRef(null)

  async function save() {
    setSaving(true)
    try { await updateDoc(doc(db,'users',user.uid),form); await onSave(); toast.success('Saved!') }
    catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ padding:'20px', maxWidth:560, margin:'0 auto', ...F, paddingBottom:100 }}>
      <h2 style={{ color:T.textPri, fontWeight:900, fontSize:24, margin:'0 0 24px' }}>Profile</h2>

      {/* Avatar */}
      <div style={{ textAlign:'center', marginBottom:24 }}>
        <div style={{ position:'relative', display:'inline-block', cursor:'pointer' }} onClick={()=>photoRef.current?.click()}>
          <Avatar src={form.photoURL} name={`${form.firstName} ${form.lastName}`} size={80} radius={22}/>
          <div style={{ position:'absolute', bottom:0, right:0, width:26, height:26, borderRadius:'50%', background:T.yellow, display:'flex', alignItems:'center', justifyContent:'center', border:`2px solid ${T.bg}` }}>
            <Plus size={14} color={T.textInv}/>
          </div>
        </div>
        <input ref={photoRef} type="file" accept="image/*" style={{display:'none'}} onChange={async e=>{
          const file=e.target.files?.[0]; if(!file)return
          const r=new FileReader(); r.onload=ev=>setForm(p=>({...p,photoURL:ev.target.result})); r.readAsDataURL(file)
          try { const path=sRef(storage,`profiles/${user.uid}/photo_${Date.now()}`); const snap=await uploadBytes(path,file); const url=await getDownloadURL(snap.ref); setForm(p=>({...p,photoURL:url})) } catch {}
        }}/>
        <p style={{ color:T.textPri, fontWeight:700, fontSize:18, margin:'10px 0 2px' }}>{form.firstName} {form.lastName}</p>
        <p style={{ color:T.textSec, fontSize:13, margin:0 }}>{user?.email}</p>
      </div>

      {/* Edit fields */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:20, padding:'18px', marginBottom:14 }}>
        <p style={{ color:T.textSec, fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:16 }}>PERSONAL INFO</p>
        {[['First Name','firstName','text'],['Last Name','lastName','text'],['Phone','phone','tel']].map(([lbl,key,type])=>(
          <div key={key} style={{ marginBottom:18 }}>
            <p style={{ color:T.textTert, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:7 }}>{lbl.toUpperCase()}</p>
            <div style={{ borderBottom:`1.5px solid ${T.border}`, paddingBottom:8 }}>
              <input type={type} value={form[key]||''} onChange={e=>{const v=e.target.value;setForm(p=>({...p,[key]:v}))}} autoComplete="off"
                style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:T.textPri, fontSize:16, ...F }}/>
            </div>
          </div>
        ))}
        <button onClick={save} disabled={saving}
          style={{ width:'100%', background:T.yellow, border:'none', borderRadius:14, padding:'15px', color:T.textInv, fontWeight:800, fontSize:15, cursor:'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:T.yellowG }}>
          {saving&&<div style={{width:16,height:16,border:'2px solid rgba(0,0,0,0.3)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>}
          {saving?'Saving…':'Save Changes'}
        </button>
      </div>

      {/* Appearance */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:20, padding:'18px', marginBottom:14 }}>
        <p style={{ color:T.textSec, fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:16 }}>APPEARANCE</p>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <p style={{ color:T.textPri, fontWeight:600, fontSize:14, margin:0 }}>{theme==='dark'?'Dark Mode':'Light Mode'}</p>
          <button onClick={toggleTheme} style={{ width:52, height:28, borderRadius:14, padding:3, border:'none', cursor:'pointer', background:theme==='dark'?T.yellow:T.borderM, display:'flex', alignItems:'center', justifyContent:theme==='dark'?'flex-end':'flex-start', transition:'background 0.2s' }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background:'white', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }}/>
          </button>
        </div>
        <p style={{ color:T.textSec, fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:10 }}>TIME FORMAT</p>
        <div style={{ display:'flex', background:T.raised, borderRadius:12, padding:3, border:`1px solid ${T.border}` }}>
          {[['12h','12h (AM/PM)'],['24h','24h']].map(([val,lbl])=>(
            <button key={val} onClick={()=>setTimeFormat(val)}
              style={{ flex:1, padding:'9px', borderRadius:10, fontWeight:700, fontSize:13, background:timeFormat===val?T.yellow:'transparent', color:timeFormat===val?T.textInv:T.textSec, border:'none', cursor:'pointer', ...F, transition:'all 0.15s' }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <button onClick={onSignOut}
        style={{ width:'100%', background:'none', border:`1px solid ${T.border}`, borderRadius:14, padding:'14px', color:T.red, fontWeight:700, fontSize:14, cursor:'pointer', ...F }}>
        Sign Out
      </button>
    </div>
  )
}

// ══ MAIN DASHBOARD ═══════════════════════════════════════════════════════════
export default function ClientDashboard() {
  const { barberSlug } = useParams()
  const { user, userData, signOut, refreshUserData } = useAuth()
  const { formatTime } = useTheme()
  const navigate = useNavigate()

  // view: 'home' | 'profile' | 'spend' | 'visits'
  const [view, setView] = useState('home')
  const [appts, setAppts] = useState([])
  const [barbers, setBarbers] = useState([])
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNotifs, setShowNotifs] = useState(false)
  const refreshRef = useRef(null)

  async function loadFavs(uid) {
    try { const s=await getDoc(doc(db,'userPrefs',uid)); if(s.exists()) setFavorites(s.data().favoriteBarbers||[]) } catch {}
  }

  async function toggleFav(barberId) {
    if (!user) return
    const next = favorites.includes(barberId) ? favorites.filter(id=>id!==barberId) : [...favorites, barberId]
    setFavorites(next)
    try { await setDoc(doc(db,'userPrefs',user.uid),{favoriteBarbers:next},{merge:true}) } catch {}
  }

  async function loadAll() {
    if (!user) return
    const [aSnap, bSnap] = await Promise.all([
      getDocs(query(collection(db,'appointments'),where('clientId','==',user.uid))),
      getDocs(collection(db,'barbers')),
    ])
    setAppts(aSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
    setBarbers(bSnap.docs.map(d=>({id:d.id,...d.data()})).filter(b=>b.isActive!==false))
    setLoading(false)
  }

  useEffect(()=>{
    if (!user) { navigate(`/b/${barberSlug}/auth`); return }
    loadAll(); loadFavs(user.uid)
    refreshRef.current=setInterval(loadAll,22000)
    return ()=>clearInterval(refreshRef.current)
  },[user])

  // Computed
  const upcoming = appts.filter(a=>{
    if (a.bookingStatus==='cancelled') return false
    const [y,m,d]=(a.date||'').split('-').map(Number); const [h,mn]=(a.startTime||'00:00').split(':').map(Number)
    return new Date(y,m-1,d,h,mn)>new Date()
  }).sort((a,b)=>a.date?.localeCompare(b.date)||a.startTime?.localeCompare(b.startTime))

  const history = appts.filter(a=>{
    if (a.bookingStatus==='cancelled') return true
    const [y,m,d]=(a.date||'').split('-').map(Number); const [h,mn]=(a.startTime||'00:00').split(':').map(Number)
    return new Date(y,m-1,d,h,mn)<=new Date()
  })

  const totalVisits = history.filter(a=>a.bookingStatus==='completed').length
  const totalSpent  = appts.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalPrice||0),0)
  const next = upcoming[0]

  // Greeting
  const h = new Date().getHours()
  const greeting = h<12?'Good morning':h<17?'Good afternoon':'Good evening'

  if (loading) return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:28, height:28, border:`3px solid ${T.yellow}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:T.bg, color:T.textPri, ...F, paddingBottom:80 }}>
      <ImportantMessagePopup userId={user?.uid}/>

      {/* ── Sub-views ─────────────────────────────────────────────────── */}
      {view==='spend'  && <SpendDetail  appointments={appts} onBack={()=>setView('home')}/>}
      {view==='visits' && <VisitHistory appointments={appts} onBack={()=>setView('home')} formatTime={formatTime}/>}
      {view==='profile' && (
        <ProfileView user={user} userData={userData}
          onSave={refreshUserData}
          onSignOut={async()=>{ await signOut(); navigate(`/b/${barberSlug}`) }}
        />
      )}

      {/* ── HOME ──────────────────────────────────────────────────────── */}
      {view==='home' && (
        <div style={{ maxWidth:560, margin:'0 auto', padding:'0 0 20px' }}>

          {/* Header */}
          <div style={{ padding:'52px 20px 20px', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div>
              <p style={{ color:T.textSec, fontSize:13, fontWeight:600, margin:'0 0 4px' }}>{greeting}</p>
              <h1 style={{ color:T.textPri, fontWeight:900, fontSize:30, margin:0, lineHeight:1.05, letterSpacing:'-0.5px' }}>
                {userData?.firstName||'Welcome'}
              </h1>
            </div>
            <NotifBell userId={user?.uid} onOpen={()=>setShowNotifs(true)}/>
          </div>

          {/* Stats — tappable, no emojis */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, padding:'0 20px', marginBottom:24 }}>
            <button onClick={()=>setView('visits')}
              style={{ background:T.yellow, border:'none', borderRadius:18, padding:'16px 10px', textAlign:'center', cursor:'pointer', ...F, boxShadow:T.yellowG }}>
              <p style={{ color:T.textInv, fontWeight:900, fontSize:26, margin:'0 0 4px', lineHeight:1 }}>{totalVisits}</p>
              <p style={{ color:T.textInv+'bb', fontSize:10, fontWeight:700, letterSpacing:'0.06em', margin:0 }}>VISITS</p>
              <ArrowUpRight size={12} color={T.textInv+'88'} style={{ marginTop:4 }}/>
            </button>
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:18, padding:'16px 10px', textAlign:'center' }}>
              <p style={{ color:T.textPri, fontWeight:900, fontSize:26, margin:'0 0 4px', lineHeight:1 }}>{upcoming.length}</p>
              <p style={{ color:T.textSec, fontSize:10, fontWeight:700, letterSpacing:'0.06em', margin:0 }}>UPCOMING</p>
            </div>
            <button onClick={()=>setView('spend')}
              style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:18, padding:'16px 10px', textAlign:'center', cursor:'pointer', ...F }}>
              <p style={{ color:T.textPri, fontWeight:900, fontSize:22, margin:'0 0 4px', lineHeight:1 }}>${(totalSpent||0).toFixed(0)}</p>
              <p style={{ color:T.textSec, fontSize:10, fontWeight:700, letterSpacing:'0.06em', margin:0 }}>SPENT</p>
              <ArrowUpRight size={12} color={T.textTert} style={{ marginTop:4 }}/>
            </button>
          </div>

          {/* Next appointment */}
          {next && (
            <div style={{ padding:'0 20px', marginBottom:24 }}>
              <p style={{ color:T.textSec, fontSize:11, fontWeight:700, letterSpacing:'0.1em', marginBottom:12 }}>NEXT APPOINTMENT</p>
              <div style={{ background:T.yellowD, border:`1.5px solid ${T.yellow}44`, borderRadius:22, padding:'18px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                  <div>
                    <p style={{ color:T.textPri, fontWeight:800, fontSize:17, margin:'0 0 3px' }}>{next.barberName}</p>
                    <p style={{ color:T.yellow, fontWeight:700, fontSize:14, margin:'0 0 3px', display:'flex', alignItems:'center', gap:5 }}>
                      <Clock size={13}/>{next.date?format(parseLocalDate(next.date),'EEE, MMM d'):''} · {formatTime?.(next.startTime)||next.startTime}
                    </p>
                    <p style={{ color:T.textSec, fontSize:12, margin:0 }}>{formatDuration(next.totalDuration)}</p>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ color:T.yellow, fontWeight:900, fontSize:22, margin:'0 0 5px' }}>{formatCurrency(next.totalPrice)}</p>
                    <Pill label={differenceInDays(new Date(`${next.date}T${next.startTime}`),new Date())===0?'Today':isTomorrow(parseLocalDate(next.date))?'Tomorrow':`${differenceInDays(new Date(`${next.date}T${next.startTime}`),new Date())}d`} color={T.green}/>
                  </div>
                </div>
                {next.services?.length>0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:2 }}>
                    {next.services.map((s,i)=><Pill key={i} label={s.name} color={T.textSec} bg={T.card}/>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Favorite Barbers */}
          {barbers.length>0 && (
            <div style={{ padding:'0 20px', marginBottom:24 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <Star size={15} color={T.yellow} fill={T.yellow}/>
                  <p style={{ color:T.textPri, fontWeight:800, fontSize:17, margin:0 }}>Barbers</p>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[...barbers].sort((a,b)=>{
                  const af=favorites.includes(a.id)?0:1, bf=favorites.includes(b.id)?0:1; return af-bf
                }).slice(0,4).map(barber=>(
                  <div key={barber.id} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:18, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
                    <Avatar src={barber.photoURL} name={barber.name} size={46} radius={13}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:2 }}>
                        <p style={{ color:T.textPri, fontWeight:700, fontSize:15, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{barber.name}</p>
                        {favorites.includes(barber.id) && <Star size={12} color={T.yellow} fill={T.yellow}/>}
                      </div>
                      {barber.address && <p style={{ color:T.textSec, fontSize:12, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4 }}><MapPin size={10}/>{barber.address}</p>}
                    </div>
                    <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                      <button onClick={()=>toggleFav(barber.id)} style={{ background:favorites.includes(barber.id)?T.yellowD:T.raised, border:`1px solid ${favorites.includes(barber.id)?T.yellow+'44':T.border}`, borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:favorites.includes(barber.id)?T.yellow:T.textTert, transition:'all 0.2s' }}>
                        <Star size={15} fill={favorites.includes(barber.id)?T.yellow:'none'}/>
                      </button>
                      <button onClick={()=>navigate(`/b/${barber.slug||barberSlug}/book`)} style={{ background:T.yellow, border:'none', borderRadius:10, padding:'0 14px', height:34, color:T.textInv, fontWeight:700, fontSize:13, cursor:'pointer', ...F }}>
                        Book
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming list */}
          {upcoming.slice(1).length>0 && (
            <div style={{ padding:'0 20px', marginBottom:24 }}>
              <p style={{ color:T.textSec, fontSize:11, fontWeight:700, letterSpacing:'0.1em', marginBottom:12 }}>MORE UPCOMING</p>
              {upcoming.slice(1,4).map(a=>(
                <div key={a.id} style={{ background:T.card, border:`1px solid ${T.border}`, borderLeft:`2px solid ${T.yellow}`, borderRadius:14, padding:'12px 14px', marginBottom:8, display:'flex', justifyContent:'space-between' }}>
                  <div>
                    <p style={{ color:T.textPri, fontWeight:600, fontSize:13, margin:'0 0 2px' }}>{a.date?format(parseLocalDate(a.date),'MMM d'):''} · {formatTime?.(a.startTime)||a.startTime}</p>
                    <p style={{ color:T.textSec, fontSize:11, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180 }}>{a.services?.map(s=>s.name).join(', ')}</p>
                  </div>
                  <p style={{ color:T.yellow, fontWeight:700, fontSize:13, flexShrink:0 }}>{formatCurrency(a.totalPrice)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recent history */}
          {history.length>0 && (
            <div style={{ padding:'0 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <p style={{ color:T.textSec, fontSize:11, fontWeight:700, letterSpacing:'0.1em', margin:0 }}>RECENT</p>
                <button onClick={()=>setView('visits')} style={{ color:T.yellow, fontSize:13, fontWeight:700, background:'none', border:'none', cursor:'pointer', ...F, display:'flex', alignItems:'center', gap:4 }}>
                  See all <ChevronRight size={14}/>
                </button>
              </div>
              {history.slice(0,3).map(a=>(
                <div key={a.id} style={{ background:T.card, border:`1px solid ${T.border}`, borderLeft:`2px solid ${sc(a.bookingStatus)}`, borderRadius:12, padding:'11px 13px', marginBottom:8, display:'flex', justifyContent:'space-between', opacity:a.bookingStatus==='cancelled'?0.5:1 }}>
                  <div>
                    <p style={{ color:T.textPri, fontWeight:600, fontSize:13, margin:'0 0 2px' }}>{a.date?format(parseLocalDate(a.date),'MMM d, yyyy'):''}</p>
                    <p style={{ color:T.textSec, fontSize:11, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:170 }}>{a.services?.map(s=>s.name).join(', ')}</p>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ color:T.yellow, fontWeight:700, fontSize:13, margin:'0 0 2px' }}>{formatCurrency(a.totalPrice)}</p>
                    <span style={{ fontSize:10, fontWeight:700, color:sc(a.bookingStatus), textTransform:'uppercase' }}>{a.bookingStatus}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 3-Button Bottom Nav ──────────────────────────────────────── */}
      <nav style={{ position:'fixed', bottom:0, left:0, right:0, background:T.card, borderTop:`1px solid ${T.border}`, display:'flex', alignItems:'center', paddingBottom:'max(10px,env(safe-area-inset-bottom))', backdropFilter:'blur(16px)', zIndex:50 }}>
        {/* Home */}
        <button onClick={()=>setView('home')}
          style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'12px 0', background:'none', border:'none', cursor:'pointer', color:view==='home'?T.yellow:T.textTert, ...F }}>
          <Home size={21} strokeWidth={view==='home'?2.5:1.5}/>
          <span style={{ fontSize:10, fontWeight:view==='home'?800:500, letterSpacing:'0.04em' }}>HOME</span>
          {view==='home' && <div style={{ position:'absolute', top:0, left:'8%', right:'75%', height:2, background:T.yellow, borderRadius:'0 0 2px 2px' }}/>}
        </button>

        {/* Book — elevated center */}
        <div style={{ flex:1, display:'flex', justifyContent:'center' }}>
          <button onClick={()=>navigate(`/b/${barberSlug}/book`)}
            style={{ width:62, height:62, borderRadius:'50%', background:T.yellow, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', marginTop:-22, boxShadow:T.yellowG }}>
            <Scissors size={26} color={T.textInv}/>
          </button>
        </div>

        {/* Profile */}
        <button onClick={()=>setView('profile')}
          style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'12px 0', background:'none', border:'none', cursor:'pointer', color:view==='profile'?T.yellow:T.textTert, ...F }}>
          <User size={21} strokeWidth={view==='profile'?2.5:1.5}/>
          <span style={{ fontSize:10, fontWeight:view==='profile'?800:500, letterSpacing:'0.04em' }}>PROFILE</span>
          {view==='profile' && <div style={{ position:'absolute', top:0, right:'8%', left:'75%', height:2, background:T.yellow, borderRadius:'0 0 2px 2px' }}/>}
        </button>
      </nav>

      {/* Notifications */}
      {showNotifs && <NotifsPanel userId={user?.uid} onClose={()=>setShowNotifs(false)}/>}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} body{background:${T.bg}!important} .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none} .no-scrollbar::-webkit-scrollbar{display:none}`}</style>
    </div>
  )
}