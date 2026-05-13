import { useEffect, useState, useRef } from 'react'
import { 
  collection, query, where, getDocs, 
  doc, updateDoc, onSnapshot 
} from 'firebase/firestore'
import { storage, db } from '../../lib/firebase'
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'
import { 
  formatCurrency, formatDuration, 
  parseLocalDate, generateTimeSlots 
} from '../../utils/helpers'
import { useTheme } from '../../context/ThemeContext'
import { 
  format, isFuture, isPast, differenceInDays, 
  subMonths, eachMonthOfInterval, addDays, 
  startOfDay, isToday, isSameDay 
} from 'date-fns'
import toast from 'react-hot-toast'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import ImportantMessagePopup from '../../components/ui/ImportantMessagePopup'
import PhoneInput from '../../components/ui/PhoneInput'
import { 
  Scissors, User, X, Navigation, RefreshCw, 
  ChevronLeft, ChevronRight, Bell, ArrowLeft, 
  Check, DollarSign, Calendar, Clock, Sparkles
} from 'lucide-react'

const F  = { fontFamily:'Monda,sans-serif' }
const SC = { pending:'#f59e0b', confirmed:'#ffffff', completed:'#22C55E', cancelled:'#ef4444' }

const STYLES = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  .fade-up { animation: fadeUp 0.3s ease both; }
  .appt-hover:hover { filter: brightness(1.05); }
  .btn-hover:hover { opacity: 0.85; }
`

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
    <button onClick={onOpen} style={{ position:'relative', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, cursor:'pointer', padding:'8px 9px', color:'#888', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}>
      <Bell size={18} strokeWidth={1.5}/>
      {count > 0 && (
        <div style={{ position:'absolute', top:4, right:4, width:8, height:8, borderRadius:'50%', background:'#fff', border:'1.5px solid var(--bg)' }}/>
      )}
    </button>
  )
}

// ── Notifications panel ────────────────────────────────────────────────────
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
    <div style={{ position:'fixed', inset:0, zIndex:60, background:'rgba(0,0,0,0.85)' }} onClick={onClose}>
      <div style={{ position:'absolute', top:0, right:0, bottom:0, width:Math.min(320, window.innerWidth), background:'#111', borderLeft:'1px solid #222', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px', borderBottom:'1px solid #222', flexShrink:0 }}>
          <p style={{ color:'#fff', fontWeight:800, fontSize:16, margin:0, ...F }}>Notifications</p>
          <button onClick={onClose} style={{ background:'#222', border:'none', borderRadius:8, color:'#888', cursor:'pointer', padding:'6px 7px', display:'flex' }}><X size={16}/></button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'12px' }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:40 }}>
              <div style={{ width:22, height:22, border:'2px solid #333', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto' }}/>
            </div>
          ) : notifs.length === 0 ? (
            <div style={{ textAlign:'center', padding:40 }}>
              <Bell size={28} style={{ color:'#333', margin:'0 auto 10px', display:'block' }}/>
              <p style={{ color:'#555', ...F, fontSize:13 }}>No notifications yet</p>
            </div>
          ) : notifs.map(n => (
            <div key={n.id} style={{ background:'#161616', border:'1px solid #222', borderRadius:12, padding:'12px 14px', marginBottom:8 }}>
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ fontSize:16, flexShrink:0 }}>{typeIcon[n.type]||'ℹ️'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color:'#fff', fontWeight:700, fontSize:13, margin:'0 0 3px', ...F }}>{n.title}</p>
                  <p style={{ color:'#888', fontSize:12, margin:'0 0 4px', lineHeight:1.5 }}>{n.message}</p>
                  <p style={{ color:'#444', fontSize:10, margin:'4px 0 0', fontWeight:700 }}>
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
    <div style={{ padding:'24px 20px', maxWidth:520, margin:'0 auto', ...F }}>
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, color:'#fff', fontWeight:700, fontSize:13, background:'none', border:'none', cursor:'pointer', marginBottom:24, ...F, opacity:0.6 }}>
        <ArrowLeft size={15}/> Back
      </button>
      <h2 style={{ color:'var(--text-pri)', fontWeight:900, fontSize:24, marginBottom:4, letterSpacing:'-0.5px' }}>Spending</h2>
      <p style={{ color:'var(--text-sec)', fontSize:13, marginBottom:24 }}>Your barbershop history</p>

      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'20px', marginBottom:12 }}>
        <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:8 }}>ALL-TIME SPENT</p>
        <p style={{ color:'var(--text-pri)', fontWeight:900, fontSize:36, margin:0, letterSpacing:'-1px' }}>{formatCurrency(totalSpent)}</p>
      </div>

      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'20px', marginBottom:12 }}>
        <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:16 }}>BY MONTH</p>
        <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:80, marginBottom:14 }}>
          {monthlyData.map((m,i) => (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <div style={{ width:'100%', borderRadius:'4px 4px 0 0', background:i===monthlyData.length-1?'var(--text-pri)':'var(--border)', height:m.spent>0?`${Math.max((m.spent/maxSpend)*64,4)}px`:'4px', transition:'height 0.4s' }}/>
              <span style={{ color:'var(--text-sec)', fontSize:8, fontWeight:700 }}>{format(months[i],'MMM')}</span>
            </div>
          ))}
        </div>
        {monthlyData.filter(m=>m.spent>0).map(m => (
          <div key={m.key} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
            <span style={{ color:'var(--text-pri)', fontSize:13 }}>{m.label}</span>
            <div style={{ textAlign:'right' }}>
              <span style={{ color:'var(--text-pri)', fontWeight:700, fontSize:13 }}>{formatCurrency(m.spent)}</span>
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

  function ApptCard({ a }) {
    const isCancelled  = a.bookingStatus === 'cancelled'
    const isCompleted  = a.bookingStatus === 'completed'

    let cardBg     = 'var(--card)'
    let cardBorder = '1px solid var(--border)'
    let leftBorder = '3px solid #333'
    let cardOpacity = 1

    if (isCancelled) {
      cardBg     = 'rgba(239,68,68,0.06)'
      cardBorder = '1px solid rgba(239,68,68,0.18)'
      leftBorder = '3px solid rgba(239,68,68,0.5)'
      cardOpacity = 0.7
    } else if (isCompleted) {
      cardBg     = 'rgba(34,197,94,0.05)'
      cardBorder = '1px solid rgba(34,197,94,0.15)'
      leftBorder = '3px solid rgba(34,197,94,0.4)'
    }

    return (
      <div style={{ background:cardBg, border:cardBorder, borderLeft:leftBorder, borderRadius:14, padding:'14px 16px', marginBottom:8, opacity:cardOpacity, transition:'all 0.2s' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          <div>
            <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:'0 0 2px' }}>{a.date?format(parseLocalDate(a.date),'EEE, MMM d, yyyy'):'—'}</p>
            <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{a.startTime} · {formatDuration(a.totalDuration)}</p>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:14, margin:'0 0 3px' }}>{formatCurrency(a.totalPrice)}</p>
            <span style={{
              fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em',
              padding:'2px 7px', borderRadius:20,
              background: isCancelled ? 'rgba(239,68,68,0.12)' : isCompleted ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
              color: isCancelled ? '#ef4444' : isCompleted ? '#22C55E' : '#888',
            }}>
              {a.bookingStatus}
            </span>
          </div>
        </div>
        {a.services?.length>0 && <p style={{ color:'var(--text-sec)', fontSize:12, margin:'4px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.services.map(s=>s.name).join(', ')}</p>}
        {a.tip>0 && <p style={{ color:'#22C55E', fontSize:11, marginTop:4 }}>+ {formatCurrency(a.tip)} tip</p>}
      </div>
    )
  }

  return (
    <div style={{ padding:'24px 20px', maxWidth:520, margin:'0 auto', ...F }}>
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, color:'var(--text-pri)', fontWeight:700, fontSize:13, background:'none', border:'none', cursor:'pointer', marginBottom:24, ...F, opacity:0.6 }}>
        <ArrowLeft size={15}/> Back
      </button>
      <h2 style={{ color:'var(--text-pri)', fontWeight:900, fontSize:24, marginBottom:4, letterSpacing:'-0.5px' }}>All Visits</h2>
      <p style={{ color:'var(--text-sec)', fontSize:13, marginBottom:20 }}>{done.length} total appointment{done.length!==1?'s':''}</p>
      {done.length===0 ? (
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:40, textAlign:'center' }}>
          <p style={{ color:'var(--text-sec)', margin:0, fontSize:13 }}>No visits yet</p>
        </div>
      ) : done.map(a => <ApptCard key={a.id} a={a}/>)}
    </div>
  )
}

// ── Profile view ───────────────────────────────────────────────────────────
function ProfileView({ user, userData, onSave, onSignOut }) {
  const { theme, toggleTheme, timeFormat, setTimeFormat } = useTheme()
  const isDark = theme === 'dark'
  const BG   = isDark ? '#0A0A0A' : '#FFFFFF'
  const CARD = isDark ? '#161616' : '#F5F5F5'
  const BDR  = isDark ? '#2A2A2A' : '#E5E5E5'
  const TXT  = isDark ? '#F5F5F5' : '#0A0A0A'
  const TXT2 = '#777777'
  const BTN  = isDark ? '#FFFFFF' : '#0A0A0A'
  const BTNI = isDark ? '#0A0A0A' : '#FFFFFF'

  const [form, setForm] = useState({
    firstName: userData?.firstName||'',
    lastName:  userData?.lastName||'',
    phone:     userData?.phone||'',
    photoURL:  userData?.photoURL||'',
  })
  const [saving, setSaving] = useState(false)
  const photoRef = useRef(null)

  async function save() {
    setSaving(true)
    try { await updateDoc(doc(db,'users',user.uid),form); await onSave(); toast.success('Saved!') }
    catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, bottom:70, background:BG, overflowY:'auto', zIndex:10 }}>
      <div style={{ maxWidth:520, margin:'0 auto', padding:'28px 20px 60px' }}>
        <h2 style={{ color:TXT, fontWeight:900, fontSize:22, marginBottom:24, ...F }}>Profile</h2>

        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ position:'relative', display:'inline-block', cursor:'pointer' }} onClick={()=>photoRef.current?.click()}>
            <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', background:CARD, border:`2px solid ${BDR}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:26, color:TXT }}>
              {form.photoURL
                ? <img src={form.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
                : `${form.firstName?.[0]||''}${form.lastName?.[0]||''}`}
            </div>
            <div style={{ position:'absolute', bottom:0, right:0, width:26, height:26, borderRadius:'50%', background:BTN, border:`2px solid ${BG}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill={BTNI}><path d="M20 5h-3.2L15 3H9L7.2 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/><circle cx="12" cy="13" r="3" fill={BTNI}/></svg>
            </div>
          </div>
          <input ref={photoRef} type="file" accept="image/*" style={{display:'none'}}
            onChange={async e=>{
              const file=e.target.files?.[0]; if(!file)return
              const reader=new FileReader()
              reader.onload=ev=>setForm(p=>({...p,photoURL:ev.target.result}))
              reader.readAsDataURL(file)
              try {
                const path=sRef(storage,`profiles/${user.uid}/photo_${Date.now()}`)
                const snap=await uploadBytes(path,file)
                const url=await getDownloadURL(snap.ref)
                setForm(p=>({...p,photoURL:url}))
              } catch(err){ console.warn('photo upload:',err.code) }
            }}/>
          <p style={{ color:TXT2, fontSize:12, marginTop:8 }}>Tap to change photo</p>
        </div>

        <div style={{ background:CARD, border:`1px solid ${BDR}`, borderRadius:16, padding:'16px 18px', marginBottom:12 }}>
          {[['FIRST NAME','firstName'],['LAST NAME','lastName']].map(([lbl,key]) => (
            <div key={key} style={{ marginBottom:16 }}>
              <p style={{ color:TXT2, fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:6 }}>{lbl}</p>
              <div style={{ borderBottom:`1.5px solid ${BDR}`, paddingBottom:8 }}>
                <input type="text" value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
                  style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:TXT, fontSize:16, ...F }}/>
              </div>
            </div>
          ))}
          <div>
            <p style={{ color:TXT2, fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:6 }}>PHONE</p>
            <div style={{ borderBottom:`1.5px solid ${BDR}`, paddingBottom:8 }}>
              <input type="tel" value={form.phone||''} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}
                style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:TXT, fontSize:16, ...F }}/>
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving}
          style={{ width:'100%', background:BTN, border:'none', borderRadius:13, padding:'15px', color:BTNI, fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:12, ...F }}>
          {saving && <div style={{width:16,height:16,border:`2px solid ${BTNI}44`,borderTopColor:BTNI,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>}
          {saving?'Saving…':'Save Changes'}
        </button>

        <div style={{ background:CARD, border:`1px solid ${BDR}`, borderRadius:16, padding:'16px 18px', marginBottom:12 }}>
          <p style={{ color:TXT2, fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:16 }}>APPEARANCE</p>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
            <span style={{ color:TXT, fontWeight:600, fontSize:14 }}>{isDark?'Dark Mode':'Light Mode'}</span>
            <button onClick={toggleTheme}
              style={{ width:52, height:28, borderRadius:14, padding:3, border:'none', cursor:'pointer', background:BTN, display:'flex', alignItems:'center', justifyContent:isDark?'flex-end':'flex-start', transition:'all 0.25s' }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:BTNI, boxShadow:'0 1px 4px rgba(0,0,0,0.25)' }}/>
            </button>
          </div>
          <p style={{ color:TXT2, fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:10 }}>TIME FORMAT</p>
          <div style={{ display:'flex', background:BG, borderRadius:12, padding:3, border:`1px solid ${BDR}` }}>
            {[['12h','12h (AM/PM)'],['24h','24h']].map(([val,lbl]) => (
              <button key={val} onClick={()=>setTimeFormat(val)}
                style={{ flex:1, padding:'9px', borderRadius:10, fontWeight:700, fontSize:13, background:timeFormat===val?BTN:'transparent', color:timeFormat===val?BTNI:TXT2, border:'none', cursor:'pointer', ...F, transition:'all 0.15s' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <button onClick={onSignOut}
          style={{ width:'100%', background:'none', border:`1px solid ${BDR}`, borderRadius:13, padding:'14px', color:'#EF4444', fontWeight:600, fontSize:14, cursor:'pointer', ...F }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}

// ── Appointment card with premium status states ─────────────────────────────
function ApptCard({ a, formatTime, onReschedule, onCancel, barberInfo, onMaps, isNext }) {
  const isCancelled = a.bookingStatus === 'cancelled'
  const isCompleted = a.bookingStatus === 'completed'
  const isPending   = a.bookingStatus === 'pending'

  if (isCancelled) {
    return (
      <div style={{
        background:'rgba(239,68,68,0.05)',
        border:'1px solid rgba(239,68,68,0.14)',
        borderLeft:'3px solid rgba(239,68,68,0.35)',
        borderRadius:14, padding:'13px 15px', marginBottom:8,
        opacity:0.6, transition:'opacity 0.2s',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <p style={{ color:'var(--text-pri)', fontWeight:600, fontSize:13, margin:'0 0 2px', textDecoration:'line-through', opacity:0.6 }}>
              {a.date?format(parseLocalDate(a.date),'MMM d'):''} · {formatTime(a.startTime)}
            </p>
            <p style={{ color:'#888', fontSize:11, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180 }}>
              {a.services?.map(s=>s.name).join(', ')}
            </p>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ color:'#888', fontWeight:700, fontSize:13, margin:'0 0 3px', textDecoration:'line-through' }}>{formatCurrency(a.totalPrice)}</p>
            <span style={{ background:'rgba(239,68,68,0.12)', color:'#ef4444', fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:20, letterSpacing:'0.06em' }}>CANCELLED</span>
          </div>
        </div>
      </div>
    )
  }

  if (isCompleted) {
    return (
      <div style={{
        background:'rgba(34,197,94,0.04)',
        border:'1px solid rgba(34,197,94,0.12)',
        borderLeft:'3px solid rgba(34,197,94,0.3)',
        borderRadius:14, padding:'13px 15px', marginBottom:8,
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <p style={{ color:'var(--text-pri)', fontWeight:600, fontSize:13, margin:'0 0 2px' }}>
              {a.date?format(parseLocalDate(a.date),'MMM d, yyyy'):''} · {formatTime(a.startTime)}
            </p>
            <p style={{ color:'var(--text-sec)', fontSize:11, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200 }}>
              {a.services?.map(s=>s.name).join(', ')}
            </p>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:14, margin:'0 0 4px' }}>{formatCurrency(a.totalPrice)}</p>
            <span style={{ background:'rgba(34,197,94,0.1)', color:'#22C55E', fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:20, letterSpacing:'0.06em' }}>COMPLETED</span>
          </div>
        </div>
        {a.tip>0 && <p style={{ color:'#22C55E', fontSize:11, margin:'5px 0 0' }}>+ {formatCurrency(a.tip)} tip</p>}
      </div>
    )
  }

  // Active / upcoming
  if (isNext) {
    return (
      <div style={{
        background:'var(--card)',
        border:'1px solid var(--border)',
        borderLeft:'3px solid var(--text-pri)',
        borderRadius:16, padding:'18px', marginBottom:16,
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              {barberInfo?.photoURL && <img src={barberInfo.photoURL} style={{width:22,height:22,borderRadius:6,objectFit:'cover'}} alt=""/>}
              <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:15, margin:0 }}>{a.barberName}</p>
            </div>
            <p style={{ color:'var(--text-sec)', fontWeight:600, fontSize:13, margin:'0 0 2px' }}>
              {a.date?format(parseLocalDate(a.date),'EEE, MMM d'):''} · {formatTime(a.startTime)}
            </p>
            <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{formatDuration(a.totalDuration)}</p>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ color:'var(--text-pri)', fontWeight:900, fontSize:20, margin:'0 0 5px' }}>{formatCurrency(a.totalPrice)}</p>
            <span style={{
              fontSize:10, fontWeight:800, letterSpacing:'0.05em',
              padding:'3px 9px', borderRadius:20,
              background: isToday(parseLocalDate(a.date)) ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: isToday(parseLocalDate(a.date)) ? 'var(--text-pri)' : '#22C55E',
              border: isToday(parseLocalDate(a.date)) ? '1px solid rgba(255,255,255,0.12)' : 'none',
            }}>
              {differenceInDays(new Date(`${a.date}T${a.startTime}`),new Date())===0?'Today!':`In ${differenceInDays(new Date(`${a.date}T${a.startTime}`),new Date())} days`}
            </span>
          </div>
        </div>
        {a.services?.length>0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
            {a.services.map((s,i)=>(
              <span key={i} style={{ background:'rgba(255,255,255,0.05)', color:'var(--text-sec)', fontSize:11, padding:'4px 10px', borderRadius:20, border:'1px solid var(--border)' }}>{s.name}</span>
            ))}
          </div>
        )}
        {barberInfo?.address && (
          <button onClick={()=>onMaps(barberInfo.address)} style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', color:'var(--text-sec)', fontSize:12, cursor:'pointer', padding:'4px 0', marginBottom:10, ...F }}>
            <Navigation size={12}/> Directions
          </button>
        )}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>onReschedule(a)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'8px 14px', color:'var(--text-pri)', fontSize:12, fontWeight:700, cursor:'pointer', ...F, display:'flex', alignItems:'center', gap:5 }}>
            <RefreshCw size={11}/> Reschedule
          </button>
          <button onClick={()=>onCancel(a.id)} style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:10, padding:'8px 14px', color:'#ef4444', fontSize:12, fontWeight:700, cursor:'pointer', ...F, display:'flex', alignItems:'center', gap:5 }}>
            <X size={11}/> Cancel
          </button>
        </div>
      </div>
    )
  }

  // Secondary upcoming
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderLeft:'2px solid rgba(255,255,255,0.15)', borderRadius:12, padding:'13px 15px', marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
        <div>
          <p style={{ color:'var(--text-pri)', fontWeight:600, fontSize:13, margin:'0 0 2px' }}>
            {a.date?format(parseLocalDate(a.date),'MMM d'):''} · {formatTime(a.startTime)}
          </p>
          <p style={{ color:'var(--text-sec)', fontSize:11, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180 }}>
            {a.services?.map(s=>s.name).join(', ')}
          </p>
        </div>
        <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:13, flexShrink:0 }}>{formatCurrency(a.totalPrice)}</p>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={()=>onReschedule(a)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'6px 11px', color:'var(--text-sec)', fontSize:11, fontWeight:700, cursor:'pointer', ...F, display:'flex', alignItems:'center', gap:4 }}>
          <RefreshCw size={10}/> Reschedule
        </button>
        <button onClick={()=>onCancel(a.id)} style={{ background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.12)', borderRadius:8, padding:'6px 11px', color:'#ef4444', fontSize:11, fontWeight:700, cursor:'pointer', ...F }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const { barberSlug } = useParams()
  const { user, userData, loading: authLoading, signOut, refreshUserData } = useAuth()
  const location = useLocation()
  const highlightDate = location.state?.highlightDate || null
  const { formatTime } = useTheme()
  const navigate = useNavigate()
  const [view, setView]           = useState('home')
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

  useEffect(() => {
    if (authLoading) return
    if (!user) navigate(`/b/${barberSlug}/auth`)
  }, [user, authLoading])

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
          const aSnap  = await getDocs(query(collection(db,'availability'), where('barberId','==',b.id)))
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
  const totalSpent  = userData?.totalSpent  || appointments.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalPrice||0),0)
  const totalVisits = userData?.totalVisits || history.filter(a=>a.bookingStatus==='completed').length
  const { text:greetText, emoji:greetEmoji } = getGreeting()

  if (authLoading || loading) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:26, height:26, border:'2px solid #333', borderTopColor:'var(--text-pri)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', ...F, paddingBottom:90 }}>
      <style>{STYLES}</style>

      {view==='spend'   && <SpendDetail  appointments={appointments} onBack={()=>setView('home')}/>}
      {view==='visits'  && <VisitHistory appointments={appointments} onBack={()=>setView('home')}/>}
      {view==='profile' && (
        <ProfileView user={user} userData={userData}
          onSave={async()=>{ await refreshUserData() }}
          onSignOut={async()=>{ await signOut(); navigate(`/b/${barberSlug}`) }}
        />
      )}

      {/* HOME */}
      {view==='home' && (
        <div className="fade-up" style={{ padding:'24px 20px', maxWidth:520, margin:'0 auto' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28 }}>
            <div>
              <p style={{ color:'var(--text-sec)', fontSize:12, fontWeight:500, margin:'0 0 3px', letterSpacing:'0.02em' }}>{greetText} {greetEmoji}</p>
              <h1 style={{ color:'var(--text-pri)', fontWeight:900, fontSize:32, margin:0, lineHeight:1, letterSpacing:'-1px', textTransform:'lowercase' }}>
                {userData?.firstName}<span style={{ color:'var(--text-sec)', fontWeight:300 }}>.</span>
              </h1>
            </div>
            <NotifBell userId={user?.uid} onOpen={()=>setShowNotifs(true)}/>
          </div>

          {/* Confirmed banner */}
          {highlightDate && (() => {
            const highlighted = appointments.find(a=>a.date===highlightDate && a.bookingStatus!=='cancelled')
            if (!highlighted) return null
            return (
              <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'14px 16px', marginBottom:20 }}>
                <p style={{ color:'var(--text-pri)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', margin:'0 0 6px', opacity:0.5 }}>✓ CONFIRMED</p>
                <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:15, margin:'0 0 3px' }}>{highlighted.date?format(parseLocalDate(highlighted.date),'EEEE, MMMM d'):''}</p>
                <p style={{ color:'var(--text-sec)', fontSize:13, margin:0 }}>{formatTime(highlighted.startTime)} – {formatTime(highlighted.endTime)} · {highlighted.services?.map(s=>s.name).join(', ')}</p>
              </div>
            )
          })()}

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:24 }}>
            <button onClick={()=>setView('visits')}
              style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px 10px', textAlign:'center', cursor:'pointer', ...F }}>
              <p style={{ color:'var(--text-pri)', fontWeight:900, fontSize:24, margin:'0 0 4px', letterSpacing:'-0.5px' }}>{totalVisits}</p>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:600, margin:0, letterSpacing:'0.04em' }}>VISITS</p>
            </button>
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px 10px', textAlign:'center' }}>
              <p style={{ color:'var(--text-pri)', fontWeight:900, fontSize:24, margin:'0 0 4px', letterSpacing:'-0.5px' }}>{upcoming.length}</p>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:600, margin:0, letterSpacing:'0.04em' }}>UPCOMING</p>
            </div>
            <button onClick={()=>setView('spend')}
              style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px 10px', textAlign:'center', cursor:'pointer', ...F }}>
              <p style={{ color:'var(--text-pri)', fontWeight:900, fontSize:20, margin:'0 0 4px', letterSpacing:'-0.5px' }}>${(totalSpent||0).toFixed(0)}</p>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:600, margin:0, letterSpacing:'0.04em' }}>SPENT</p>
            </button>
          </div>

          {/* Next appointment */}
          {next && (
            <ApptCard
              a={next} formatTime={formatTime} isNext
              onReschedule={a=>{setReschedAppt(a);setReschedDate(null);setReschedSlot(null);setReschedNote('')}}
              onCancel={id=>setCancelTarget(id)}
              barberInfo={barberInfo}
              onMaps={openMaps}
            />
          )}

          {/* More upcoming */}
          {upcoming.slice(1).length>0 && (
            <div style={{ marginBottom:20 }}>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>UPCOMING</p>
              {upcoming.slice(1).map(a=>(
                <ApptCard key={a.id} a={a} formatTime={formatTime}
                  onReschedule={a=>{setReschedAppt(a);setReschedDate(null);setReschedSlot(null);setReschedNote('')}}
                  onCancel={id=>setCancelTarget(id)}
                  barberInfo={barberInfo} onMaps={openMaps}
                />
              ))}
            </div>
          )}

          {/* No upcoming — elegant empty */}
          {upcoming.length===0 && (
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'28px 20px', marginBottom:20, textAlign:'center' }}>
              <Scissors size={24} style={{ color:'var(--text-sec)', opacity:0.2, marginBottom:10, display:'block', margin:'0 auto 12px' }} strokeWidth={1.5}/>
              <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:15, margin:'0 0 4px' }}>No upcoming appointments</p>
              <p style={{ color:'var(--text-sec)', fontSize:13, margin:'0 0 18px' }}>Ready for a fresh cut?</p>
              <button onClick={()=>navigate(`/b/${barberSlug}/book`)}
                style={{ background:'var(--text-pri)', color:'var(--bg)', border:'none', borderRadius:22, padding:'12px 28px', fontWeight:700, fontSize:14, cursor:'pointer', ...F }}>
                Book Now
              </button>
            </div>
          )}

          {/* Recent history */}
          {history.slice(0,3).length>0 && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', margin:0 }}>RECENT</p>
                <button onClick={()=>setView('visits')} style={{ color:'var(--text-sec)', fontSize:12, fontWeight:600, background:'none', border:'none', cursor:'pointer', ...F }}>See all</button>
              </div>
              {history.slice(0,3).map(a=>(
                <ApptCard key={a.id} a={a} formatTime={formatTime}
                  onReschedule={()=>{}} onCancel={()=>{}} barberInfo={barberInfo} onMaps={openMaps}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom nav ── */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--surface)', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-around', padding:'10px 24px max(14px,env(safe-area-inset-bottom))' }}>
        <button onClick={()=>setView('home')}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color:view==='home'?'var(--text-pri)':'var(--text-sec)', flex:1, ...F, transition:'color 0.2s' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill={view==='home'?'var(--text-pri)':'none'} stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
          <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.05em' }}>HOME</span>
        </button>

        {/* Elegant center book button */}
        <div style={{ flex:1, display:'flex', justifyContent:'center', position:'relative' }}>
          <button
            onClick={()=>navigate(`/b/${barberSlug}/book`)}
            style={{
              position:'relative', marginTop:-28,
              width:54, height:54, borderRadius:'50%',
              background:'var(--text-pri)',
              border:'none', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px var(--border)',
              transition:'transform 0.2s, box-shadow 0.2s',
              zIndex:1,
            }}
            onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.06)'; e.currentTarget.style.boxShadow='0 6px 32px rgba(0,0,0,0.5), 0 0 0 1px var(--border)'}}
            onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px var(--border)'}}
          >
            <Scissors size={22} color="var(--bg)" strokeWidth={2}/>
          </button>
        </div>

        <button onClick={()=>setView('profile')}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color:view==='profile'?'var(--text-pri)':'var(--text-sec)', flex:1, ...F, transition:'color 0.2s' }}>
          <User size={20} fill={view==='profile'?'var(--text-pri)':'none'} stroke="currentColor" strokeWidth={1.8}/>
          <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.05em' }}>PROFILE</span>
        </button>
      </div>

      {/* Cancel modal */}
      {cancelTarget && (
        <Overlay onClose={()=>setCancelTarget(null)}>
          <p style={{ color:'var(--text-pri)', fontWeight:900, fontSize:18, marginBottom:6, ...F, letterSpacing:'-0.3px' }}>Cancel appointment?</p>
          <p style={{ color:'var(--text-sec)', fontSize:14, marginBottom:20, lineHeight:1.5 }}>This action cannot be undone. Would you prefer to reschedule instead?</p>
          <button onClick={()=>{setCancelTarget(null);const a=appointments.find(a=>a.id===cancelTarget);if(a){setReschedAppt(a);setReschedDate(null);setReschedSlot(null)}}}
            style={{ width:'100%', padding:'13px', borderRadius:12, background:'rgba(255,255,255,0.05)', color:'var(--text-pri)', fontWeight:700, border:'1px solid var(--border)', cursor:'pointer', ...F, marginBottom:10 }}>
            Reschedule Instead
          </button>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setCancelTarget(null)} style={{ flex:1, padding:'13px', borderRadius:12, background:'transparent', color:'var(--text-sec)', fontWeight:600, border:'1px solid var(--border)', cursor:'pointer', ...F }}>Keep It</button>
            <button onClick={handleCancel} style={{ flex:1, padding:'13px', borderRadius:12, background:'rgba(239,68,68,0.08)', color:'#ef4444', fontWeight:700, border:'1px solid rgba(239,68,68,0.2)', cursor:'pointer', ...F }}>Cancel It</button>
          </div>
        </Overlay>
      )}

      {/* Reschedule modal */}
      {reschedAppt && (
        <Overlay onClose={()=>setReschedAppt(null)}>
          <p style={{ color:'var(--text-pri)', fontWeight:900, fontSize:18, marginBottom:4, ...F, letterSpacing:'-0.3px' }}>Reschedule</p>
          <p style={{ color:'var(--text-sec)', fontSize:13, marginBottom:16 }}>{reschedAppt.services?.map(s=>s.name).join(', ')} · {formatDuration(reschedAppt.totalDuration||0)}</p>
          {(()=>{
            const today2=startOfDay(new Date()); const advance=availability?.advanceDays||30
            const days=Array.from({length:advance},(_,i)=>addDays(today2,i))
            const perPage=7; const visible=days.slice(reschedPage*perPage,(reschedPage+1)*perPage)
            return (
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <button onClick={()=>setReschedPage(p=>Math.max(0,p-1))} disabled={reschedPage===0} style={{ background:'none', border:'none', color:reschedPage===0?'var(--border)':'var(--text-pri)', cursor:'pointer', padding:4 }}><ChevronLeft size={15}/></button>
                  <span style={{ color:'var(--text-sec)', fontSize:12 }}>{visible[0]&&format(visible[0],'MMM d')} – {visible[visible.length-1]&&format(visible[visible.length-1],'MMM d')}</span>
                  <button onClick={()=>setReschedPage(p=>(p+1)*perPage<advance?p+1:p)} style={{ background:'none', border:'none', color:(reschedPage+1)*perPage>=advance?'var(--border)':'var(--text-pri)', cursor:'pointer', padding:4 }}><ChevronRight size={15}/></button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
                  {visible.map((date,i)=>{
                    const isSel=reschedDate&&isSameDay(date,reschedDate)
                    return (
                      <button key={i} onClick={()=>setReschedDate(date)}
                        style={{ background:isSel?'var(--text-pri)':'var(--card)', border:`1px solid ${isSel?'var(--text-pri)':'var(--border)'}`, borderRadius:10, padding:'7px 2px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:2, ...F }}>
                        <span style={{ color:isSel?'var(--bg)':'var(--text-sec)', fontSize:9, fontWeight:700 }}>{format(date,'EEE').toUpperCase()}</span>
                        <span style={{ color:isSel?'var(--bg)':'var(--text-pri)', fontSize:13, fontWeight:800 }}>{format(date,'d')}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}
          {reschedDate&&(<>
            <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>{format(reschedDate,'EEE, MMM d').toUpperCase()}</p>
            {reschedSlots.length===0 ? (
              <p style={{ color:'var(--text-sec)', fontSize:13, marginBottom:14 }}>No slots available.</p>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:14 }}>
                {reschedSlots.map(slot=>(
                  <button key={slot.startTime} onClick={()=>setReschedSlot(slot)}
                    style={{ padding:'10px 3px', borderRadius:10, border:`1.5px solid ${reschedSlot?.startTime===slot.startTime?'var(--text-pri)':'var(--border)'}`, background:reschedSlot?.startTime===slot.startTime?'var(--text-pri)':'var(--card)', color:reschedSlot?.startTime===slot.startTime?'var(--bg)':'var(--text-pri)', fontWeight:700, fontSize:12, cursor:'pointer', ...F }}>
                    {formatTime(slot.startTime)}
                  </button>
                ))}
              </div>
            )}
          </>)}
          <div style={{ marginBottom:14 }}>
            <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.08em', marginBottom:6 }}>NOTE (optional)</p>
            <textarea value={reschedNote} onChange={e=>setReschedNote(e.target.value)} rows={2} placeholder="Reason for rescheduling..."
              style={{ width:'100%', background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px', color:'var(--text-pri)', fontSize:14, resize:'none', outline:'none', ...F, boxSizing:'border-box' }}/>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>setReschedAppt(null)} style={{ flex:1, padding:'13px', borderRadius:12, background:'transparent', color:'var(--text-sec)', fontWeight:600, border:'1px solid var(--border)', cursor:'pointer', ...F }}>Cancel</button>
            <button onClick={handleReschedule} disabled={!reschedSlot}
              style={{ flex:1, padding:'13px', borderRadius:12, background:reschedSlot?'var(--text-pri)':'var(--border)', color:reschedSlot?'var(--bg)':'var(--text-sec)', fontWeight:700, border:'none', cursor:reschedSlot?'pointer':'not-allowed', ...F }}>
              Confirm
            </button>
          </div>
        </Overlay>
      )}

      <ImportantMessagePopup userId={user?.uid}/>
      {showNotifs && <NotificationsPanel userId={user?.uid} onClose={()=>setShowNotifs(false)}/>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function Overlay({ children, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:22, padding:22, width:'100%', maxWidth:380, ...F, maxHeight:'82vh', overflowY:'auto' }}>
        {children}
      </div>
    </div>
  )
}