/**
 * BarberLayout — Redesigned
 * ✅ Navbar flotante moderno con glassmorphism
 * ✅ Pill indicator activo (no solo línea)
 * ✅ Íconos más modernos y expresivos
 * ✅ Colores: naranja #FF6B1A mantenido, fondo más rico
 * ✅ Safe area correcta iOS
 * ✅ Sin código duplicado, limpio
 */
import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import {
  LayoutDashboard, CalendarDays, Users, MoreHorizontal,
  Bell, X, LogOut, Settings, User, Menu, CheckCheck,
  Scissors, Clock, BarChart2, MessageSquare, ChevronRight,
  Trash2, Check,
} from 'lucide-react'
import {
  collection, query, where, onSnapshot, updateDoc, doc,
  getDocs, orderBy, limit, deleteDoc,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

const F = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes slideIn      { from{opacity:0;transform:translateX(-100%)} to{opacity:1;transform:translateX(0)} }
@keyframes slideInRight { from{opacity:0;transform:translateX(100%)}  to{opacity:1;transform:translateX(0)} }
@keyframes fadeIn       { from{opacity:0} to{opacity:1} }
@keyframes spin         { to{transform:rotate(360deg)} }
@keyframes popIn        { 0%{transform:scale(0.85);opacity:0} 100%{transform:scale(1);opacity:1} }
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
input,textarea{font-size:16px!important}
`

const BOTTOM_NAV = [
  { to:'/barber/dashboard', icon:LayoutDashboard, label:'Dashboard' },
  { to:'/barber/calendar',  icon:CalendarDays,    label:'Calendar'  },
  { to:'/barber/clients',   icon:Users,           label:'Clients'   },
  { to:'/barber/settings',  icon:MoreHorizontal,  label:'More'      },
]

const DRAWER_NAV = [
  { to:'/barber/services',     icon:Scissors,      label:'Services'     },
  { to:'/barber/availability', icon:Clock,         label:'Availability' },
  { to:'/barber/appointments', icon:CalendarDays,  label:'Appointments' },
  { to:'/barber/reports',      icon:BarChart2,     label:'Reports'      },
  { to:'/barber/broadcast',    icon:MessageSquare, label:'Broadcast'    },
  { to:'/barber/profile',      icon:User,          label:'Profile'      },
  { to:'/barber/settings',     icon:Settings,      label:'Settings'     },
]

function SideDrawer({ onClose, userData, barberName, navigate }) {
  const { signOut } = useAuth()
  const initials = `${userData?.firstName?.[0]||''}${userData?.lastName?.[0]||''}`.toUpperCase() || 'B'

  async function handleSignOut() {
    localStorage.removeItem('ab_last_active')
    await signOut()
    navigate('/barber/login')
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:80, animation:'fadeIn 0.15s ease' }} onClick={onClose}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.78)' }}/>
      <div
        style={{
          position:'absolute', left:0, top:0, bottom:0,
          width: Math.min(272, window.innerWidth * 0.80),
          background:'#111114',
          borderRight:'1px solid #1E1E22',
          display:'flex', flexDirection:'column',
          animation:'slideIn 0.25s cubic-bezier(0.22,1,0.36,1)',
          ...F,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Profile section */}
        <div style={{
          paddingTop: 'max(56px, calc(env(safe-area-inset-top) + 32px))',
          padding: 'max(56px, calc(env(safe-area-inset-top) + 32px)) 18px 18px',
          borderBottom: '1px solid #1E1E22',
        }}>
          <div style={{
            width:50, height:50, borderRadius:14,
            overflow:'hidden', background:'#1A1A1F',
            border:'1.5px solid #252528',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:800, fontSize:18, color:'#666',
            marginBottom:12,
          }}>
            {userData?.photoURL
              ? <img src={userData.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
              : initials}
          </div>
          <p style={{ color:'#555', fontSize:11, fontWeight:500, margin:'0 0 2px' }}>
            {new Date().getHours()<12?'Good morning,':new Date().getHours()<17?'Good afternoon,':'Good evening,'}
          </p>
          <p style={{ color:'#EDEDF0', fontWeight:900, fontSize:19, margin:'0 0 2px', letterSpacing:'-0.4px' }}>
            {barberName || `${userData?.firstName||''} ${userData?.lastName||''}`}
          </p>
          <span style={{ background:'rgba(255,107,26,0.12)', color:'#FF6B1A', fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:20, letterSpacing:'0.08em' }}>BARBER</span>
        </div>

        {/* Nav items */}
        <div style={{ flex:1, overflowY:'auto', padding:'6px 8px' }}>
          {DRAWER_NAV.map(item => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} onClick={onClose}
                style={({ isActive }) => ({
                  display:'flex', alignItems:'center', gap:11,
                  padding:'10px 10px', borderRadius:10,
                  textDecoration:'none', marginBottom:1,
                  background: isActive ? 'rgba(255,107,26,0.10)' : 'transparent',
                })}>
                {({ isActive }) => <>
                  <div style={{
                    width:32, height:32, borderRadius:9,
                    background: isActive ? 'rgba(255,107,26,0.15)' : '#1A1A1F',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <Icon size={15} color={isActive ? '#FF6B1A' : '#555'} strokeWidth={isActive ? 2.2 : 1.8}/>
                  </div>
                  <span style={{ color: isActive ? '#FF6B1A' : '#CCC', fontWeight: isActive ? 700 : 500, fontSize:13 }}>
                    {item.label}
                  </span>
                  {isActive && <div style={{ marginLeft:'auto', width:5, height:5, borderRadius:'50%', background:'#FF6B1A' }}/>}
                </>}
              </NavLink>
            )
          })}
        </div>

        {/* Sign out */}
        <div style={{
          padding:'8px',
          borderTop:'1px solid #1E1E22',
          paddingBottom: 'max(10px, calc(env(safe-area-inset-bottom) + 10px))',
        }}>
          <button onClick={handleSignOut}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:11, padding:'10px 10px', borderRadius:10, background:'transparent', border:'none', cursor:'pointer', textAlign:'left', ...F }}>
            <div style={{ width:32, height:32, borderRadius:9, background:'rgba(239,68,68,0.08)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <LogOut size={14} color="#EF4444"/>
            </div>
            <span style={{ color:'#EF4444', fontWeight:600, fontSize:13 }}>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function getNotifUrl(n) {
  if(n.type==='new_booking'||n.appointmentId) return '/barber/appointments'
  if(n.type==='payment') return '/barber/reports'
  if(n.type==='client'||n.clientId) return '/barber/clients'
  return '/barber/appointments'
}

function timeAgo(ts) {
  if(!ts?.toDate) return ''
  const diff = Date.now()-ts.toDate().getTime()
  const m = Math.floor(diff/60000)
  if(m<1) return 'now'
  if(m<60) return `${m}m`
  const h = Math.floor(m/60)
  if(h<24) return `${h}h`
  return ts.toDate().toLocaleDateString()
}

function SwipeableNotifItem({ n, selectMode, selected, onSelect, onDelete, onMarkRead, onTap, ago }) {
  const [offset, setOffset] = useState(0)
  const [active, setActive] = useState(false)
  const startX = useRef(null)

  function handleTouchStart(e) { startX.current=e.touches[0].clientX; setActive(true) }
  function handleTouchMove(e) {
    if(startX.current===null) return
    setOffset(Math.max(-100,Math.min(100,e.touches[0].clientX-startX.current)))
  }
  function handleTouchEnd() {
    setActive(false)
    if(offset<-60){ onDelete(); setOffset(0) }
    else if(offset>60&&!n.read){ onMarkRead(); setOffset(0) }
    else setOffset(0)
    startX.current=null
  }

  return(
    <div style={{position:'relative',marginBottom:4,borderRadius:10,overflow:'hidden'}}>
      {offset<-20&&<div style={{position:'absolute',inset:0,background:'rgba(239,68,68,0.12)',display:'flex',alignItems:'center',justifyContent:'flex-end',padding:'0 14px',borderRadius:10}}><Trash2 size={13} color="#EF4444"/></div>}
      {offset>20&&!n.read&&<div style={{position:'absolute',inset:0,background:'rgba(34,197,94,0.10)',display:'flex',alignItems:'center',padding:'0 14px',borderRadius:10}}><CheckCheck size={13} color="#22C55E"/></div>}
      <div
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        onClick={selectMode?onSelect:onTap}
        style={{
          padding:'9px 11px', borderRadius:10,
          background:n.read?'#141416':'rgba(255,107,26,0.06)',
          border:`1px solid ${n.read?'#1E1E22':'rgba(255,107,26,0.16)'}`,
          cursor:'pointer',
          transform:`translateX(${offset}px)`,
          transition:active?'none':'transform 0.25s ease',
          display:'flex', alignItems:'flex-start', gap:9,
          userSelect:'none', WebkitUserSelect:'none',
          position:'relative', zIndex:1,
        }}
      >
        {selectMode&&(
          <div style={{width:17,height:17,borderRadius:5,border:`1.5px solid ${selected?'#FF6B1A':'#333'}`,background:selected?'#FF6B1A':'transparent',flexShrink:0,marginTop:2,display:'flex',alignItems:'center',justifyContent:'center'}}>
            {selected&&<Check size={9} color="#fff"/>}
          </div>
        )}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:2}}>
            <p style={{color:n.read?'#666':'#EDEDF0',fontWeight:n.read?500:700,fontSize:12,margin:0,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {n.title||'Notification'}
            </p>
            <div style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
              {ago&&<span style={{color:'#333',fontSize:9}}>{ago}</span>}
              {!n.read&&<div style={{width:5,height:5,borderRadius:'50%',background:'#FF6B1A'}}/>}
            </div>
          </div>
          <p style={{color:'#555',fontSize:11,margin:0,lineHeight:1.4,overflow:'hidden',textOverflow:'ellipsis',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
            {n.message}
          </p>
        </div>
      </div>
    </div>
  )
}

function NotificationsPanel({ userId, onClose, navigate }) {
  const [notifs, setNotifs]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]     = useState(new Set())

  useEffect(() => {
    if (!userId) return
    const q = query(
      collection(db,'notifications'),
      where('userId','==',userId),
      orderBy('createdAt','desc'),
      limit(50)
    )
    const unsub = onSnapshot(q, snap => {
      setNotifs(snap.docs.map(d=>({id:d.id,...d.data()})))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [userId])

  async function markAll() {
    await Promise.all(notifs.filter(n=>!n.read).map(n=>updateDoc(doc(db,'notifications',n.id),{read:true})))
  }
  async function clearAll() {
    await Promise.all(notifs.map(n=>deleteDoc(doc(db,'notifications',n.id))))
  }
  async function deleteSelected() {
    await Promise.all([...selected].map(id=>deleteDoc(doc(db,'notifications',id))))
    setSelected(new Set()); setSelectMode(false)
  }
  function toggleSelect(id) {
    setSelected(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n })
  }

  const unread = notifs.filter(n=>!n.read).length

  return (
    <div style={{ position:'fixed', inset:0, zIndex:80, animation:'fadeIn 0.15s ease' }} onClick={onClose}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.78)' }}/>
      <div
        style={{
          position:'absolute', right:0, top:0, bottom:0,
          width: Math.min(310, window.innerWidth * 0.92),
          background:'#111114', borderLeft:'1px solid #1E1E22',
          display:'flex', flexDirection:'column',
          animation:'slideInRight 0.25s cubic-bezier(0.22,1,0.36,1)', ...F,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          paddingTop:'max(52px,calc(env(safe-area-inset-top)+14px))',
          padding:'max(52px,calc(env(safe-area-inset-top)+14px)) 13px 10px',
          borderBottom:'1px solid #1E1E22',
        }}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <div>
              <p style={{ color:'#EDEDF0', fontWeight:800, fontSize:15, margin:0 }}>Notifications</p>
              {unread>0&&<p style={{ color:'#555', fontSize:10, margin:'1px 0 0' }}>{unread} unread</p>}
            </div>
            <button onClick={onClose} style={{ background:'#1A1A1F', border:'1px solid #1E1E22', borderRadius:8, padding:'5px 6px', color:'#666', cursor:'pointer', display:'flex' }}>
              <X size={13}/>
            </button>
          </div>
          {notifs.length>0&&(
            <div style={{display:'flex',gap:5}}>
              {!selectMode&&unread>0&&(
                <button onClick={markAll} style={{flex:1,background:'transparent',border:'1px solid #1E1E22',borderRadius:7,padding:'6px 5px',color:'#666',fontSize:10,fontWeight:600,cursor:'pointer',...F,display:'flex',alignItems:'center',justifyContent:'center',gap:3}}>
                  <CheckCheck size={10}/>Mark read
                </button>
              )}
              {!selectMode&&(
                <button onClick={()=>setSelectMode(true)} style={{flex:1,background:'transparent',border:'1px solid #1E1E22',borderRadius:7,padding:'6px 5px',color:'#666',fontSize:10,fontWeight:600,cursor:'pointer',...F}}>
                  Select
                </button>
              )}
              {selectMode&&(
                <>
                  <button onClick={deleteSelected} disabled={selected.size===0}
                    style={{flex:1,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:7,padding:'6px 5px',color:'#EF4444',fontSize:10,fontWeight:700,cursor:'pointer',...F}}>
                    Delete ({selected.size})
                  </button>
                  <button onClick={()=>{setSelectMode(false);setSelected(new Set())}}
                    style={{flex:1,background:'transparent',border:'1px solid #1E1E22',borderRadius:7,padding:'6px 5px',color:'#666',fontSize:10,fontWeight:600,cursor:'pointer',...F}}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* List */}
        <div style={{ flex:1, overflowY:'auto', padding:'5px' }}>
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 0' }}>
              <div style={{ width:16, height:16, border:'2px solid #1E1E22', borderTopColor:'#FF6B1A', borderRadius:'50%', animation:'spin 0.65s linear infinite' }}/>
            </div>
          ) : notifs.length===0 ? (
            <div style={{ padding:'28px 14px', textAlign:'center' }}>
              <Bell size={20} style={{ color:'#2A2A2E', display:'block', margin:'0 auto 7px' }} strokeWidth={1.5}/>
              <p style={{ color:'#555', fontSize:12, fontWeight:600, margin:0 }}>No notifications</p>
              <p style={{ color:'#333', fontSize:10, margin:'3px 0 0' }}>Swipe ← delete · → mark read</p>
            </div>
          ) : notifs.map(n => (
            <SwipeableNotifItem
              key={n.id} n={n}
              selectMode={selectMode} selected={selected.has(n.id)}
              onSelect={()=>toggleSelect(n.id)}
              onDelete={()=>deleteDoc(doc(db,'notifications',n.id))}
              onMarkRead={()=>updateDoc(doc(db,'notifications',n.id),{read:true})}
              onTap={()=>{ updateDoc(doc(db,'notifications',n.id),{read:true}); navigate(getNotifUrl(n)); onClose() }}
              ago={timeAgo(n.createdAt)}
            />
          ))}
        </div>

        {notifs.length>0&&!selectMode&&(
          <div style={{padding:'8px 10px',borderTop:'1px solid #1E1E22',paddingBottom:'max(8px,calc(env(safe-area-inset-bottom)+8px))'}}>
            <button onClick={clearAll}
              style={{width:'100%',background:'transparent',border:'1px solid rgba(239,68,68,0.18)',borderRadius:9,padding:'10px',color:'rgba(239,68,68,0.6)',fontSize:11,fontWeight:700,cursor:'pointer',...F}}>
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── NAV ICON WRAPPER ─────────────────────────────────────────────────────
function NavItem({ to, icon: Icon, label, isActive }) {
  return (
    <NavLink to={to}
      style={{
        flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', gap:3, textDecoration:'none',
        padding:'6px 4px 4px', position:'relative',
      }}>
      {({ isActive: active }) => (
        <>
          {/* Active pill background */}
          {active && (
            <div style={{
              position:'absolute', top:6, left:'50%', transform:'translateX(-50%)',
              width:36, height:28, borderRadius:10,
              background:'rgba(255,107,26,0.15)',
              border:'1px solid rgba(255,107,26,0.2)',
            }}/>
          )}
          <Icon
            size={18}
            strokeWidth={active ? 2.4 : 1.7}
            color={active ? '#FF6B1A' : '#3A3A3E'}
            style={{ position:'relative', zIndex:1 }}
          />
          <span style={{
            fontSize:8.5,
            fontWeight: active ? 800 : 600,
            letterSpacing:'0.03em',
            color: active ? '#FF6B1A' : '#3A3A3E',
            fontFamily:"'DM Sans',system-ui,sans-serif",
            position:'relative', zIndex:1,
          }}>
            {label.toUpperCase()}
          </span>
        </>
      )}
    </NavLink>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN LAYOUT
// ══════════════════════════════════════════════════════════════════════════
export default function BarberLayout({ children }) {
  const { userData, user } = useAuth()
  const navigate = useNavigate()
  const [showDrawer, setShowDrawer] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [barberName, setBarberName] = useState('')
  const [unread,     setUnread]     = useState(0)

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db,'barbers'), where('userId','==',user.uid)))
      .then(snap => { if (!snap.empty) setBarberName(snap.docs[0].data().name||'') })
    const q = query(collection(db,'notifications'), where('userId','==',user.uid), where('read','==',false))
    const unsub = onSnapshot(q, snap => setUnread(snap.size))
    return unsub
  }, [user?.uid])

  return (
    <div style={{ minHeight:'100dvh', background:'#0A0A0D', display:'flex', flexDirection:'column', ...F }}>
      <style>{CSS}</style>

      {/* ── Hamburger — floating top left ── */}
      <button
        onClick={() => setShowDrawer(true)}
        style={{
          position:'fixed',
          top: 'max(14px, calc(env(safe-area-inset-top) + 10px))',
          left: 14, zIndex: 50,
          width: 36, height: 36,
          background: 'rgba(17,17,20,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid #1E1E22',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#EDEDF0',
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}
      >
        <Menu size={16}/>
      </button>

      {/* ── Bell — floating top right ── */}
      <button
        onClick={() => setShowNotifs(true)}
        style={{
          position:'fixed',
          top: 'max(14px, calc(env(safe-area-inset-top) + 10px))',
          right: 14, zIndex: 50,
          width: 36, height: 36,
          background: 'rgba(17,17,20,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid #1E1E22',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#EDEDF0',
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}
      >
        <Bell size={16} strokeWidth={1.7}/>
        {unread > 0 && (
          <div style={{
            position:'absolute', top:-4, right:-4,
            minWidth:15, height:15, borderRadius:8,
            background:'#FF6B1A', border:'2px solid #0A0A0D',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:8, fontWeight:800, color:'#fff',
            padding:'0 3px', fontFamily:"'DM Sans',system-ui,sans-serif",
            lineHeight:1, animation:'popIn 0.3s ease',
          }}>{unread > 99 ? '99+' : unread}</div>
        )}
      </button>

      {/* ── Content ── */}
      <main style={{
        flex: 1,
        paddingTop: 'max(62px, calc(env(safe-area-inset-top) + 52px))',
        paddingBottom: 'calc(66px + env(safe-area-inset-bottom))',
        overflowX: 'hidden',
      }}>
        {children}
      </main>

      {/* ── BOTTOM NAV — Modern floating pill style ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(10,10,13,0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '0.5px solid #1E1E22',
        height: 'calc(58px + env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'stretch',
      }}>
        {BOTTOM_NAV.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label}/>
        ))}
      </nav>

      {showDrawer && (
        <SideDrawer
          onClose={() => setShowDrawer(false)}
          userData={userData}
          barberName={barberName}
          navigate={navigate}
        />
      )}
      {showNotifs && user && (
        <NotificationsPanel userId={user.uid} onClose={() => setShowNotifs(false)} navigate={navigate}/>
      )}
    </div>
  )
}
