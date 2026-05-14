/**
 * BarberLayout — Rediseño completo
 * ✓ Sin sidebar
 * ✓ Header minimalista (solo logo + notif + QR)
 * ✓ Bottom nav premium 4 tabs con indicador naranja
 * ✓ Safe area iPhone
 */
import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import {
  LayoutDashboard, CalendarDays, ClipboardList,
  Users, QrCode, Bell, X, Copy, Check, Share2,
  LogOut, User, Settings, ChevronRight,
} from 'lucide-react'
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import toast from 'react-hot-toast'

const BG     = '#0D0D0D'
const CARD   = '#171717'
const CARD2  = '#1C1C1E'
const BORDER = '#2A2A2A'
const ORANGE = '#FF6B1A'
const TXT    = '#F5F5F5'
const TXT2   = '#888888'
const TXT3   = '#444444'
const F      = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideUp { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  ::-webkit-scrollbar { display: none; }
  input, textarea { font-size: 16px !important; }
`

const BOTTOM_NAV = [
  { to: '/barber/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/barber/calendar',     icon: CalendarDays,    label: 'Calendar'  },
  { to: '/barber/appointments', icon: ClipboardList,   label: 'Appts'     },
  { to: '/barber/clients',      icon: Users,           label: 'Clients'   },
]

// ── QR Modal ───────────────────────────────────────────────────────────────
function QRModal({ link, onClose }) {
  const [revealed, setRevealed] = useState(false)
  const [copied,   setCopied]   = useState(false)
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 500); return () => clearTimeout(t) }, [])
  function copy() {
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    toast.success('Link copied!')
  }
  function share() {
    if (navigator.share) navigator.share({ title: 'Book your cut', url: link }); else copy()
  }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:80, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, animation:'fadeIn 0.2s ease' }} onClick={onClose}>
      <div style={{ width:'100%', maxWidth:320, background:CARD, borderRadius:24, border:`1px solid ${BORDER}`, padding:24, ...F }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <p style={{ color:TXT, fontWeight:800, fontSize:17, margin:0 }}>Booking Link</p>
          <button onClick={onClose} style={{ background:CARD2, border:'none', borderRadius:10, padding:'6px 7px', color:TXT2, cursor:'pointer', display:'flex' }}><X size={16}/></button>
        </div>
        <div style={{ position:'relative', borderRadius:16, overflow:'hidden', marginBottom:16, background:'#fff', padding:16, textAlign:'center' }}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}&color=000000&bgcolor=FFFFFF&margin=2`}
            style={{ width:180, height:180, display:'block', margin:'0 auto', filter:revealed?'none':'blur(10px)', opacity:revealed?1:0.3, transition:'all 0.6s ease' }}
            alt="QR"
          />
          {!revealed && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:28, height:28, border:`3px solid ${ORANGE}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>
            </div>
          )}
        </div>
        <p style={{ color:ORANGE, fontSize:12, fontWeight:600, margin:'0 0 16px', wordBreak:'break-all', lineHeight:1.5, textAlign:'center' }}>{link}</p>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={copy} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'13px', borderRadius:14, background:CARD2, border:`1px solid ${BORDER}`, color:TXT, fontWeight:700, fontSize:14, cursor:'pointer', ...F }}>
            {copied ? <Check size={14} color="#22C55E"/> : <Copy size={14}/>} {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={share} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'13px', borderRadius:14, background:ORANGE, border:'none', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', ...F }}>
            <Share2 size={14}/> Share
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Profile Sheet ──────────────────────────────────────────────────────────
function ProfileSheet({ onClose, userData, user, barberName, barberSlug, navigate }) {
  const { signOut } = useAuth()
  async function handleSignOut() {
    localStorage.removeItem('ab_last_active')
    await signOut()
    navigate('/barber/login')
  }
  const initials = `${userData?.firstName?.[0] || ''}${userData?.lastName?.[0] || ''}`.toUpperCase()
  return (
    <div style={{ position:'fixed', inset:0, zIndex:70, background:'rgba(0,0,0,0.88)' }} onClick={onClose}>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:CARD, borderRadius:'24px 24px 0 0', border:`1px solid ${BORDER}`, padding:'0 0 max(32px,env(safe-area-inset-bottom))', animation:'slideUp 0.28s cubic-bezier(0.22,1,0.36,1)', ...F }} onClick={e => e.stopPropagation()}>
        <div style={{ width:40, height:4, borderRadius:2, background:BORDER, margin:'12px auto 0' }}/>

        {/* Profile header */}
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'20px 20px 16px', borderBottom:`1px solid ${BORDER}` }}>
          <div style={{ width:52, height:52, borderRadius:'50%', overflow:'hidden', background:CARD2, border:`2px solid ${ORANGE}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:18, color:ORANGE, flexShrink:0 }}>
            {userData?.photoURL
              ? <img src={userData.photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
              : initials || 'B'}
          </div>
          <div>
            <p style={{ color:TXT, fontWeight:800, fontSize:17, margin:'0 0 2px' }}>{userData?.firstName} {userData?.lastName}</p>
            <p style={{ color:TXT2, fontSize:13, margin:0 }}>{barberName || 'Barber'}</p>
          </div>
        </div>

        {/* Menu items */}
        <div style={{ padding:'8px 12px' }}>
          {[
            { icon:User,     label:'Edit Profile', fn:() => { onClose(); navigate('/barber/profile') } },
            { icon:Settings, label:'Settings',     fn:() => { onClose(); navigate('/barber/settings') } },
          ].map(item => {
            const Icon = item.icon
            return (
              <button key={item.label} onClick={item.fn}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:14, padding:'14px 12px', borderRadius:14, background:'transparent', border:'none', cursor:'pointer', textAlign:'left', ...F, transition:'background 0.1s' }}>
                <div style={{ width:36, height:36, borderRadius:12, background:CARD2, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon size={16} color={TXT2}/>
                </div>
                <span style={{ flex:1, color:TXT, fontWeight:600, fontSize:15 }}>{item.label}</span>
                <ChevronRight size={15} color={TXT3}/>
              </button>
            )
          })}

          <div style={{ height:1, background:BORDER, margin:'8px 0' }}/>

          <button onClick={handleSignOut}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:14, padding:'14px 12px', borderRadius:14, background:'transparent', border:'none', cursor:'pointer', textAlign:'left', ...F }}>
            <div style={{ width:36, height:36, borderRadius:12, background:'rgba(239,68,68,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <LogOut size={16} color="#EF4444"/>
            </div>
            <span style={{ color:'#EF4444', fontWeight:700, fontSize:15 }}>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Unread badge ───────────────────────────────────────────────────────────
function useUnread(userId) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!userId) return
    const q = query(collection(db,'notifications'), where('userId','==',userId), where('read','==',false))
    const unsub = onSnapshot(q, snap => setCount(snap.size))
    return unsub
  }, [userId])
  return count
}

// ── Main Layout ────────────────────────────────────────────────────────────
export default function BarberLayout({ children }) {
  const { userData, user } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const [showQR,      setShowQR]      = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [barberSlug,  setBarberSlug]  = useState('')
  const [barberName,  setBarberName]  = useState('')

  const unread = useUnread(user?.uid)

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db,'barbers'), where('userId','==',user.uid))).then(snap => {
      if (!snap.empty) {
        const d = snap.docs[0].data()
        setBarberSlug(d.slug || '')
        setBarberName(d.name || '')
      }
    })
  }, [user])

  const bookingLink = barberSlug ? `${window.location.origin.replace('amadobarber','amadobook')}/b/${barberSlug}` : ''

  return (
    <div style={{ minHeight:'100dvh', background:BG, display:'flex', flexDirection:'column', ...F }}>
      <style>{CSS}</style>

      {/* ── HEADER ── */}
      <header style={{
        position:'fixed', top:0, left:0, right:0, zIndex:40,
        background:`${BG}F0`, backdropFilter:'blur(20px)',
        borderBottom:`1px solid ${BORDER}`,
        height:52, display:'flex', alignItems:'center',
        padding:'0 16px',
        paddingTop:'env(safe-area-inset-top)',
      }}>
        {/* Logo / name */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:ORANGE, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
              <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>
            </svg>
          </div>
          <span style={{ color:TXT, fontWeight:800, fontSize:16, letterSpacing:'-0.3px' }}>
            {barberName || 'AmadoBook'}
          </span>
        </div>

        {/* Right icons */}
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          {/* Notifications */}
          <button
            style={{ position:'relative', background:'none', border:'none', color:TXT2, cursor:'pointer', padding:'8px', borderRadius:10, display:'flex' }}>
            <Bell size={18}/>
            {unread > 0 && (
              <span style={{ position:'absolute', top:6, right:6, width:7, height:7, borderRadius:'50%', background:ORANGE, border:`1.5px solid ${BG}` }}/>
            )}
          </button>

          {/* QR */}
          <button onClick={() => setShowQR(true)}
            style={{ background:'none', border:'none', color:TXT2, cursor:'pointer', padding:'8px', borderRadius:10, display:'flex' }}>
            <QrCode size={18}/>
          </button>

          {/* Profile avatar */}
          <button onClick={() => setShowProfile(true)}
            style={{ background:'none', border:'none', cursor:'pointer', padding:'4px', borderRadius:10, display:'flex' }}>
            <div style={{ width:30, height:30, borderRadius:'50%', overflow:'hidden', background:CARD2, border:`1.5px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:11, color:TXT2 }}>
              {userData?.photoURL
                ? <img src={userData.photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
                : `${userData?.firstName?.[0]||''}${userData?.lastName?.[0]||''}`}
            </div>
          </button>
        </div>
      </header>

      {/* ── CONTENT ── */}
      <main style={{
        flex:1,
        paddingTop:52,
        paddingBottom:'calc(64px + env(safe-area-inset-bottom))',
        overflowX:'hidden',
      }}>
        {children}
      </main>

      {/* ── BOTTOM NAV ── */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:40,
        background:`${CARD}F8`, backdropFilter:'blur(20px)',
        borderTop:`1px solid ${BORDER}`,
        display:'flex', alignItems:'stretch',
        paddingBottom:'env(safe-area-inset-bottom)',
        height:'calc(56px + env(safe-area-inset-bottom))',
      }}>
        {BOTTOM_NAV.map(({ to, icon:Icon, label }) => (
          <NavLink key={to} to={to}
            style={({ isActive }) => ({
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              gap:3, textDecoration:'none', paddingTop:8,
              color: isActive ? ORANGE : TXT3,
              position:'relative',
            })}>
            {({ isActive }) => (
              <>
                {/* Active indicator dot */}
                {isActive && (
                  <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:20, height:2.5, borderRadius:2, background:ORANGE }}/>
                )}
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8}/>
                <span style={{ fontSize:9, fontWeight: isActive ? 800 : 600, letterSpacing:'0.04em', fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                  {label.toUpperCase()}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── MODALS ── */}
      {showQR && <QRModal link={bookingLink || window.location.origin} onClose={() => setShowQR(false)}/>}
      {showProfile && (
        <ProfileSheet
          onClose={() => setShowProfile(false)}
          userData={userData} user={user}
          barberName={barberName} barberSlug={barberSlug}
          navigate={navigate}
        />
      )}
    </div>
  )
}