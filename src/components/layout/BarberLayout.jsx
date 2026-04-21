/**
 * BarberLayout — Improved sidebar:
 * - Profile lives in sidebar (not in separate panel)
 * - Menu = full-screen overlay
 * - Logo in header (logo.png from public/)
 * - QR in floating animated modal
 * - Sign out + auto-logout after 1 week inactivity
 * - Only Bell + QR in header
 */
import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { useTheme } from '../../context/ThemeContext'
import {
  LayoutDashboard, Scissors, Clock, Calendar, BarChart2,
  MessageSquare, LogOut, X, QrCode, Share2, Copy, Check,
  Bell, Camera, Settings, ChevronRight, User
} from 'lucide-react'
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, storage } from '../../lib/firebase'
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import ThemeToggle from '../ui/ThemeToggle'
import toast from 'react-hot-toast'

const F = { fontFamily:'Monda,sans-serif' }

const NAV = [
  { to:'/barber/dashboard',    icon:LayoutDashboard, label:'Dashboard'    },
  { to:'/barber/services',     icon:Scissors,        label:'Services'     },
  { to:'/barber/availability', icon:Clock,           label:'Availability' },
  { to:'/barber/calendar',     icon:Calendar,        label:'Calendar'     },
  { to:'/barber/reports',      icon:BarChart2,       label:'Reports'      },
  { to:'/barber/broadcast',    icon:MessageSquare,   label:'Broadcast'    },
]

// ── Inactivity auto-logout (1 week) ───────────────────────────────────────
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
function useInactivityLogout(onLogout) {
  useEffect(() => {
    const KEY = 'ab_last_active'
    function touch() { localStorage.setItem(KEY, Date.now().toString()) }
    const last = parseInt(localStorage.getItem(KEY) || '0', 10)
    if (last && Date.now() - last > WEEK_MS) { onLogout(); return }
    touch()
    const events = ['click','keydown','touchstart','scroll']
    events.forEach(e => document.addEventListener(e, touch, { passive:true }))
    const check = setInterval(() => {
      const l = parseInt(localStorage.getItem(KEY)||'0',10)
      if (l && Date.now()-l > WEEK_MS) onLogout()
    }, 60000)
    return () => { events.forEach(e=>document.removeEventListener(e,touch)); clearInterval(check) }
  }, [])
}

// ── QR floating modal with reveal animation ───────────────────────────────
function QRModal({ bookingLink, onClose }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied]     = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 600)
    return () => clearTimeout(t)
  }, [])

  function copy() {
    navigator.clipboard.writeText(bookingLink).then(() => {
      setCopied(true); toast.success('Copied!')
      setTimeout(() => setCopied(false), 2000)
    })
  }
  function share() {
    if (navigator.share) navigator.share({ title:'Book your appointment', url:bookingLink })
    else copy()
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
      onClick={onClose}>
      <div style={{ width:'100%', maxWidth:340, background:'var(--surface)', borderRadius:24, border:'1px solid var(--border)', padding:24, ...F }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:16, margin:0 }}>Your Booking Link</p>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer' }}><X size={18}/></button>
        </div>

        {/* QR with blur-reveal animation */}
        <div style={{ position:'relative', borderRadius:16, overflow:'hidden', marginBottom:16, background:'#FFFFFF', padding:16, textAlign:'center' }}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(bookingLink)}&color=000000&bgcolor=FFFFFF&margin=2`}
            style={{ width:190, height:190, display:'block', margin:'0 auto', filter:revealed?'none':'blur(12px)', opacity:revealed?1:0.4, transition:'filter 0.6s ease, opacity 0.6s ease' }}
            alt="QR"
          />
          {!revealed && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:32, height:32, border:'3px solid var(--accent)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>
            </div>
          )}
        </div>

        {/* Link */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 14px', marginBottom:14 }}>
          <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.08em', margin:'0 0 3px' }}>BOOKING LINK</p>
          <p style={{ color:'var(--accent)', fontSize:12, fontWeight:600, margin:0, wordBreak:'break-all' }}>{bookingLink}</p>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={copy} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'13px', borderRadius:12, background:'var(--card)', border:'1px solid var(--border)', color:'var(--text-pri)', fontWeight:700, fontSize:14, cursor:'pointer', ...F }}>
            {copied?<Check size={14} color="#22C55E"/>:<Copy size={14}/>} {copied?'Copied!':'Copy'}
          </button>
          <button onClick={share} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'13px', borderRadius:12, background:'var(--accent)', border:'none', color:'var(--accent-inv)', fontWeight:700, fontSize:14, cursor:'pointer', ...F }}>
            <Share2 size={14}/> Share
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit profile panel ─────────────────────────────────────────────────────
function EditProfilePanel({ userData, user, onSaved }) {
  const [form, setForm] = useState({ firstName:userData?.firstName||'', lastName:userData?.lastName||'', phone:userData?.phone||'', photoURL:userData?.photoURL||'' })
  const [saving, setSaving] = useState(false)
  const photoRef = useRef(null)

  async function save() {
    setSaving(true)
    try { await updateDoc(doc(db,'users',user.uid), form); toast.success('Saved!'); onSaved() }
    catch { toast.error('Failed') }
    setSaving(false)
  }

  return (
    <div>
      {/* Photo */}
      <div style={{ textAlign:'center', marginBottom:20 }}>
        <div style={{ position:'relative', display:'inline-block', cursor:'pointer' }} onClick={()=>photoRef.current?.click()}>
          <div style={{ width:72, height:72, borderRadius:'50%', overflow:'hidden', background:'var(--card)', border:'2px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:22, color:'var(--text-pri)' }}>
            {form.photoURL?<img src={form.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:`${form.firstName?.[0]||''}${form.lastName?.[0]||''}`}
          </div>
          <div style={{ position:'absolute', bottom:0, right:0, width:24, height:24, borderRadius:'50%', background:'var(--accent)', border:'2px solid var(--surface)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Camera size={11} color="var(--accent-inv)"/>
          </div>
        </div>
        <input ref={photoRef} type="file" accept="image/*" style={{display:'none'}}
          onChange={async e=>{
            const file=e.target.files?.[0]; if(!file)return
            const reader=new FileReader(); reader.onload=ev=>setForm(p=>({...p,photoURL:ev.target.result})); reader.readAsDataURL(file)
            try { const path=sRef(storage,`profiles/${user.uid}/photo_${Date.now()}`); const snap=await uploadBytes(path,file); const url=await getDownloadURL(snap.ref); setForm(p=>({...p,photoURL:url})) } catch {}
          }}/>
      </div>
      {[['FIRST NAME','firstName'],['LAST NAME','lastName'],['PHONE','phone']].map(([lbl,key])=>(
        <div key={key} style={{ marginBottom:16 }}>
          <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:6 }}>{lbl}</p>
          <div style={{ borderBottom:'1.5px solid var(--border)', paddingBottom:8 }}>
            <input type={key==='phone'?'tel':'text'} value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} autoComplete="off"
              style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:'var(--text-pri)', fontSize:16, fontFamily:'Monda,sans-serif' }}/>
          </div>
        </div>
      ))}
      <button onClick={save} disabled={saving}
        style={{ width:'100%', background:'var(--accent)', color:'var(--accent-inv)', border:'none', borderRadius:13, padding:'14px', fontWeight:700, fontSize:14, cursor:'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
        {saving&&<div style={{width:16,height:16,border:`2px solid var(--accent-inv)`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>}
        {saving?'Saving…':'Save Changes'}
      </button>
    </div>
  )
}

// ── Notifications panel ────────────────────────────────────────────────────
function NotifPanel({ userId }) {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!userId) return
    getDocs(query(collection(db,'notifications'),where('userId','==',userId)))
      .then(snap=>{
        const all = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
        setNotifs(all); setLoading(false)
        snap.docs.filter(d=>!d.data().read).forEach(d=>updateDoc(doc(db,'notifications',d.id),{read:true}))
      })
  },[userId])
  if (loading) return <div style={{textAlign:'center',padding:30}}><div style={{width:22,height:22,border:'3px solid var(--accent)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto'}}/></div>
  if (!notifs.length) return <p style={{color:'var(--text-sec)',fontSize:13,...F}}>No notifications yet</p>
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {notifs.map(n=>(
        <div key={n.id} style={{background:n.read?'var(--card)':'var(--accent)10',border:`1px solid ${n.read?'var(--border)':'var(--accent)30'}`,borderRadius:12,padding:'10px 12px'}}>
          <p style={{color:'var(--text-pri)',fontWeight:700,fontSize:13,margin:'0 0 3px',...F}}>{n.title}</p>
          <p style={{color:'var(--text-sec)',fontSize:12,margin:0,lineHeight:1.4}}>{n.message}</p>
        </div>
      ))}
    </div>
  )
}

// ── Main Layout ────────────────────────────────────────────────────────────
export default function BarberLayout({ children }) {
  const { signOut, userData, user, refreshUserData } = useAuth()
  const { theme } = useTheme()
  const navigate  = useNavigate()

  const [menuOpen,  setMenuOpen]   = useState(false) // full-screen mobile nav
  const [sidePanelView, setSide]   = useState(null)  // null|'profile'|'settings'|'notifs'
  const [showQR, setShowQR]        = useState(false)
  const [barberName, setBarberName] = useState('')
  const [barberSlug, setBarberSlug] = useState('')

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db,'barbers'),where('userId','==',user.uid))).then(snap=>{
      if (!snap.empty) { const d=snap.docs[0].data(); setBarberName(d.name||''); setBarberSlug(d.slug||'') }
    })
  },[user])

  const displayName = barberName || userData?.firstName || 'Dashboard'
  const bookingLink = barberSlug ? `${window.location.origin}/b/${barberSlug}` : ''

  async function handleSignOut() {
    localStorage.removeItem('ab_last_active')
    await signOut(); navigate('/barber/login')
  }

  useInactivityLogout(handleSignOut)

  // Sidebar profile section (shared between desktop + mobile)
  const ProfileSection = () => (
    <div>
      {/* Avatar + name */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 16px 12px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ width:40, height:40, borderRadius:'50%', overflow:'hidden', background:'var(--card)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:15, color:'var(--text-sec)', flexShrink:0 }}>
          {userData?.photoURL?<img src={userData.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:`${userData?.firstName?.[0]||''}${userData?.lastName?.[0]||''}`}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{userData?.firstName} {userData?.lastName}</p>
          <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{displayName}</p>
        </div>
      </div>
      {/* Actions */}
      <div style={{ padding:'8px 8px' }}>
        {[
          { icon:User,     label:'Edit Profile', fn:()=>setSide('profile') },
          { icon:Settings, label:'Appearance',   fn:()=>setSide('settings') },
          { icon:QrCode,   label:'QR & Share',   fn:()=>setShowQR(true) },
        ].map(item=>{
          const Icon = item.icon
          return (
            <button key={item.label} onClick={item.fn}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 8px', borderRadius:10, background:'none', border:'none', cursor:'pointer', color:'var(--text-sec)', fontSize:13, fontWeight:600, ...F, textAlign:'left' }}>
              <Icon size={15}/> {item.label}
            </button>
          )
        })}
        <button onClick={handleSignOut}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 8px', borderRadius:10, background:'none', border:'none', cursor:'pointer', color:'#EF4444', fontSize:13, fontWeight:600, ...F }}>
          <LogOut size={15}/> Sign Out
        </button>
      </div>
    </div>
  )

  // Right side-panel (profile editor or settings or notifs)
  const SidePanel = () => {
    if (!sidePanelView) return null
    const titles = { profile:'Edit Profile', settings:'Appearance', notifs:'Notifications' }
    return (
      <div style={{ position:'fixed', inset:0, zIndex:55, background:'rgba(0,0,0,0.5)' }} onClick={()=>setSide(null)}>
        <div style={{ position:'absolute', right:0, top:0, bottom:0, width:Math.min(320,window.innerWidth), background:'var(--surface)', borderLeft:'1px solid var(--border)', overflowY:'auto', padding:20, ...F }}
          onClick={e=>e.stopPropagation()}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:16, margin:0 }}>{titles[sidePanelView]}</p>
            <button onClick={()=>setSide(null)} style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer' }}><X size={18}/></button>
          </div>
          {sidePanelView==='profile' && <EditProfilePanel userData={userData} user={user} onSaved={()=>{ refreshUserData(); setSide(null) }}/>}
          {sidePanelView==='settings' && <ThemeToggle showAccents={true}/>}
          {sidePanelView==='notifs'   && <NotifPanel userId={user?.uid}/>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'var(--bg)', ...F }}>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex flex-col w-56 fixed top-0 left-0 h-full z-30"
        style={{ background:'var(--surface)', borderRight:'1px solid var(--border)' }}>
        {/* Logo area */}
        <div style={{ padding:'16px', borderBottom:'1px solid var(--border)' }}>
          <img src="/logo.png" alt="AmadoBook"
            onError={e=>{ e.target.style.display='none'; e.target.nextSibling.style.display='block' }}
            style={{ height:32, objectFit:'contain' }}/>
          <p style={{ display:'none', color:'var(--text-pri)', fontWeight:900, fontSize:16, margin:0 }}>AmadoBook</p>
        </div>
        {/* Nav */}
        <nav style={{ display:'flex', flexDirection:'column', gap:2, flex:1, padding:'8px' }}>
          <NavLinks/>
        </nav>
        {/* Profile always visible in sidebar */}
        <ProfileSection/>
      </aside>

      {/* ── MOBILE HEADER ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40"
        style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', height:52, display:'flex', alignItems:'center', padding:'0 12px' }}>
        {/* Hamburger */}
        <button onClick={()=>setMenuOpen(true)}
          style={{ background:'none', border:'none', color:'var(--text-pri)', cursor:'pointer', padding:4, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        {/* Logo center */}
        <div style={{ position:'absolute', left:0, right:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <img src="/logo.png" alt="AmadoBook"
            onError={e=>{ e.target.style.display='none'; e.target.nextSibling.style.display='block' }}
            style={{ height:26, objectFit:'contain' }}/>
          <span style={{ display:'none', color:'var(--text-pri)', fontWeight:900, fontSize:15 }}>{displayName}</span>
        </div>
        {/* Right: Bell + QR */}
        <div style={{ display:'flex', gap:2, marginLeft:'auto', flexShrink:0 }}>
          <button onClick={()=>setSide('notifs')}
            style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer', padding:6, borderRadius:10, display:'flex', alignItems:'center' }}>
            <Bell size={18}/>
          </button>
          <button onClick={()=>setShowQR(true)}
            style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer', padding:6, borderRadius:10, display:'flex', alignItems:'center' }}>
            <QrCode size={18}/>
          </button>
          {/* Profile icon → opens side panel with full profile */}
          <button onClick={()=>setSide('profile')}
            style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer', padding:6, borderRadius:10, display:'flex', alignItems:'center' }}>
            <User size={20}/>
          </button>
        </div>
      </div>

      {/* ── MOBILE FULL-SCREEN MENU ── */}
      {menuOpen && (
        <div className="md:hidden" style={{ position:'fixed', inset:0, zIndex:50, background:'var(--bg)', display:'flex', flexDirection:'column', paddingTop: 56 }}>
          {/* Close */}
          <button onClick={()=>setMenuOpen(false)}
            style={{ position:'absolute', top:12, right:12, background:'none', border:'none', color:'var(--text-pri)', cursor:'pointer', padding:6 }}>
            <X size={22}/>
          </button>
          {/* Nav links */}
          <nav style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:4 }}>
            {NAV.map(({ to, icon:Icon, label }) => (
              <NavLink key={to} to={to} onClick={()=>setMenuOpen(false)}
                style={({ isActive }) => ({
                  display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:16,
                  textDecoration:'none', fontWeight:700, fontSize:16, ...F,
                  background: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive ? 'var(--accent-inv)' : 'var(--text-pri)',
                })}>
                <Icon size={20}/> {label}
              </NavLink>
            ))}
          </nav>
          {/* Profile section at bottom of full-screen menu */}
          <div style={{ marginTop:'auto', borderTop:'1px solid var(--border)' }}>
            <ProfileSection/>
          </div>
        </div>
      )}

      {/* ── SIDE PANELS (profile editor, settings, notifs) ── */}
      <SidePanel/>

      {/* ── QR MODAL ── */}
      {showQR && <QRModal bookingLink={bookingLink} onClose={()=>setShowQR(false)}/>}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 md:ml-56 pt-14 md:pt-0 min-h-screen overflow-x-hidden" style={{ background:'var(--bg)' }}>
        {children}
      </main>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// Stable NavLinks component
const NavLinks = ({ onClick }) => NAV.map(({ to, icon:Icon, label }) => (
  <NavLink key={to} to={to} onClick={onClick}
    style={({ isActive }) => ({
      display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12,
      fontWeight:600, fontSize:14, textDecoration:'none', fontFamily:'Monda,sans-serif',
      background: isActive ? 'var(--accent)' : 'transparent',
      color: isActive ? 'var(--accent-inv)' : 'var(--text-sec)',
      transition:'all 0.15s',
    })}>
    <Icon size={16}/><span>{label}</span>
  </NavLink>
))