/**
 * BarberLayout — Fixed
 * ✓ NO header bar at all
 * ✓ Floating hamburger button (top-left)
 * ✓ Floating bell button (top-right)
 * ✓ Sidebar margin fixed (no overflow, proper safe area)
 * ✓ Bottom nav unchanged
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
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
input,textarea{font-size:16px!important}
`

const BOTTOM_NAV = [
  { to:'/barber/dashboard',    icon:LayoutDashboard, label:'Dashboard' },
  { to:'/barber/calendar',     icon:CalendarDays,    label:'Calendar'  },
  { to:'/barber/clients',      icon:Users,           label:'Clients'   },
  { to:'/barber/settings',     icon:MoreHorizontal,  label:'More'      },
]

const DRAWER_NAV = [
  { to:'/barber/services',     icon:Scissors,      label:'Services'      },
  { to:'/barber/availability', icon:Clock,         label:'Availability'  },
  { to:'/barber/appointments', icon:CalendarDays,  label:'Appointments'  },
  { to:'/barber/reports',      icon:BarChart2,     label:'Reports'       },
  { to:'/barber/broadcast',    icon:MessageSquare, label:'Broadcast'     },
  { to:'/barber/profile',      icon:User,          label:'Profile'       },
  { to:'/barber/settings',     icon:Settings,      label:'Settings'      },
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
    <div
      style={{ position:'fixed', inset:0, zIndex:80, animation:'fadeIn 0.15s ease' }}
      onClick={onClose}
    >
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.75)' }}/>
      <div
        style={{
          position:'absolute',
          left:0, top:0, bottom:0,
          width: Math.min(280, window.innerWidth * 0.80),
          background:'#141414',
          borderRight:'1px solid #252525',
          display:'flex', flexDirection:'column',
          animation:'slideIn 0.25s cubic-bezier(0.22,1,0.36,1)',
          ...F,
          // ✅ Fixed: proper padding from top (safe area)
          paddingTop: 0,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Profile section — properly spaced from top */}
        <div style={{
          paddingTop: 'max(56px, calc(env(safe-area-inset-top) + 32px))',
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: 20,
          borderBottom: '1px solid #252525',
        }}>
          {/* Avatar */}
          <div style={{
            width:54, height:54, borderRadius:14,
            overflow:'hidden', background:'#1C1C1E',
            border:'2px solid #252525',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:800, fontSize:20, color:'#888',
            marginBottom:14,
          }}>
            {userData?.photoURL
              ? <img src={userData.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
              : initials}
          </div>
          <p style={{ color:'#888', fontSize:12, fontWeight:500, margin:'0 0 2px' }}>
            {new Date().getHours()<12?'Good morning,':new Date().getHours()<17?'Good afternoon,':'Good evening,'}
          </p>
          <p style={{ color:'#F0F0F0', fontWeight:900, fontSize:22, margin:'0 0 2px', letterSpacing:'-0.4px' }}>
            {barberName || `${userData?.firstName||''} ${userData?.lastName||''}`}
          </p>
          <p style={{ color:'#3A3A3A', fontSize:10, fontWeight:700, letterSpacing:'0.08em', margin:0 }}>BARBER</p>
        </div>

        {/* Nav items */}
        <div style={{ flex:1, overflowY:'auto', padding:'8px 10px' }}>
          {DRAWER_NAV.map(item => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} onClick={onClose}
                style={({ isActive }) => ({
                  display:'flex', alignItems:'center', gap:12,
                  padding:'11px 10px', borderRadius:11,
                  textDecoration:'none', marginBottom:2,
                  background: isActive ? 'rgba(255,107,26,0.12)' : 'transparent',
                })}>
                {({ isActive }) => <>
                  <Icon size={16} color={isActive ? '#FF6B1A' : '#666'} strokeWidth={isActive ? 2.2 : 1.8}/>
                  <span style={{ color: isActive ? '#FF6B1A' : '#F0F0F0', fontWeight: isActive ? 700 : 500, fontSize:14 }}>
                    {item.label}
                  </span>
                </>}
              </NavLink>
            )
          })}
        </div>

        {/* Sign out */}
        <div style={{
          padding:'10px',
          borderTop:'1px solid #252525',
          paddingBottom: 'max(10px, calc(env(safe-area-inset-bottom) + 10px))',
        }}>
          <button onClick={handleSignOut}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'11px 10px', borderRadius:11, background:'transparent', border:'none', cursor:'pointer', textAlign:'left', ...F }}>
            <LogOut size={15} color="#EF4444"/>
            <span style={{ color:'#EF4444', fontWeight:600, fontSize:14 }}>Sign Out</span>
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

  const delBg = offset<-20
  const readBg = offset>20&&!n.read

  return(
    <div style={{position:'relative',marginBottom:5,borderRadius:10,overflow:'hidden'}}>
      {delBg&&<div style={{position:'absolute',inset:0,background:'rgba(239,68,68,0.15)',display:'flex',alignItems:'center',justifyContent:'flex-end',padding:'0 16px',borderRadius:10}}><Trash2 size={14} color="#EF4444"/></div>}
      {readBg&&<div style={{position:'absolute',inset:0,background:'rgba(34,197,94,0.12)',display:'flex',alignItems:'center',padding:'0 16px',borderRadius:10}}><CheckCheck size={14} color="#22C55E"/></div>}
      <div
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        onClick={selectMode?onSelect:onTap}
        style={{
          padding:'10px 12px', borderRadius:10,
          background:n.read?'#141414':'rgba(255,107,26,0.07)',
          border:`1px solid ${n.read?'#252525':'rgba(255,107,26,0.18)'}`,
          cursor:'pointer',
          transform:`translateX(${offset}px)`,
          transition:active?'none':'transform 0.25s ease',
          display:'flex', alignItems:'flex-start', gap:10,
          userSelect:'none', WebkitUserSelect:'none',
          position:'relative', zIndex:1,
        }}
      >
        {selectMode&&(
          <div style={{width:18,height:18,borderRadius:5,border:`1.5px solid ${selected?'#FF6B1A':'#444'}`,background:selected?'#FF6B1A':'transparent',flexShrink:0,marginTop:2,display:'flex',alignItems:'center',justifyContent:'center'}}>
            {selected&&<Check size={10} color="#fff"/>}
          </div>
        )}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:2}}>
            <p style={{color:n.read?'#888':'#F0F0F0',fontWeight:n.read?500:700,fontSize:12,margin:0,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {n.title||'Notification'}
            </p>
            <div style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
              {ago&&<span style={{color:'#3A3A3A',fontSize:9}}>{ago}</span>}
              {!n.read&&<div style={{width:6,height:6,borderRadius:'50%',background:'#FF6B1A'}}/>}
            </div>
          </div>
          <p style={{color:'#666',fontSize:11,margin:0,lineHeight:1.4,overflow:'hidden',textOverflow:'ellipsis',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
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
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.75)' }}/>
      <div
        style={{
          position:'absolute', right:0, top:0, bottom:0,
          width: Math.min(320, window.innerWidth * 0.92),
          background:'#141414', borderLeft:'1px solid #252525',
          display:'flex', flexDirection:'column',
          animation:'slideInRight 0.25s cubic-bezier(0.22,1,0.36,1)', ...F,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          paddingTop:'max(56px,calc(env(safe-area-inset-top)+16px))',
          padding:'max(56px,calc(env(safe-area-inset-top)+16px)) 14px 10px',
          borderBottom:'1px solid #252525',
        }}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <div>
              <p style={{ color:'#F0F0F0', fontWeight:800, fontSize:16, margin:0 }}>Notifications</p>
              {unread>0&&<p style={{ color:'#888', fontSize:10, margin:'1px 0 0' }}>{unread} unread</p>}
            </div>
            <button onClick={onClose} style={{ background:'#1C1C1E', border:'1px solid #252525', borderRadius:8, padding:'5px 6px', color:'#888', cursor:'pointer', display:'flex' }}>
              <X size={14}/>
            </button>
          </div>
          {/* Action row */}
          {notifs.length>0&&(
            <div style={{display:'flex',gap:6}}>
              {!selectMode&&unread>0&&(
                <button onClick={markAll} style={{flex:1,background:'transparent',border:'1px solid #252525',borderRadius:8,padding:'7px 6px',color:'#888',fontSize:11,fontWeight:600,cursor:'pointer',...F,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                  <CheckCheck size={11}/>Mark all read
                </button>
              )}
              {!selectMode&&(
                <button onClick={()=>setSelectMode(true)} style={{flex:1,background:'transparent',border:'1px solid #252525',borderRadius:8,padding:'7px 6px',color:'#888',fontSize:11,fontWeight:600,cursor:'pointer',...F}}>
                  Select
                </button>
              )}
              {selectMode&&(
                <>
                  <button onClick={deleteSelected} disabled={selected.size===0}
                    style={{flex:1,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:8,padding:'7px 6px',color:'#EF4444',fontSize:11,fontWeight:700,cursor:'pointer',...F}}>
                    Delete ({selected.size})
                  </button>
                  <button onClick={()=>{setSelectMode(false);setSelected(new Set())}}
                    style={{flex:1,background:'transparent',border:'1px solid #252525',borderRadius:8,padding:'7px 6px',color:'#888',fontSize:11,fontWeight:600,cursor:'pointer',...F}}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* List */}
        <div style={{ flex:1, overflowY:'auto', padding:'6px' }}>
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 0' }}>
              <div style={{ width:18, height:18, border:'2px solid #252525', borderTopColor:'#FF6B1A', borderRadius:'50%', animation:'spin 0.65s linear infinite' }}/>
            </div>
          ) : notifs.length===0 ? (
            <div style={{ padding:'32px 16px', textAlign:'center' }}>
              <Bell size={22} style={{ color:'#3A3A3A', display:'block', margin:'0 auto 8px' }} strokeWidth={1.5}/>
              <p style={{ color:'#666', fontSize:13, fontWeight:600, margin:0 }}>No notifications</p>
              <p style={{ color:'#444', fontSize:11, margin:'4px 0 0' }}>Swipe left to delete, right to read</p>
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

        {/* Footer — Clear All */}
        {notifs.length>0&&!selectMode&&(
          <div style={{padding:'10px 12px',borderTop:'1px solid #252525',paddingBottom:'max(10px,calc(env(safe-area-inset-bottom)+10px))'}}>
            <button onClick={clearAll}
              style={{width:'100%',background:'transparent',border:'1px solid rgba(239,68,68,0.2)',borderRadius:10,padding:'11px',color:'rgba(239,68,68,0.7)',fontSize:12,fontWeight:700,cursor:'pointer',...F}}>
              Clear All Notifications
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

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
    <div style={{ minHeight:'100dvh', background:'#0D0D0D', display:'flex', flexDirection:'column', ...F }}>
      <style>{CSS}</style>

      {/* ── NO HEADER — just two floating buttons ── */}

      {/* Hamburger — top left, floating */}
      <button
        onClick={() => setShowDrawer(true)}
        style={{
          position:'fixed',
          top: 'max(14px, calc(env(safe-area-inset-top) + 10px))',
          left: 14,
          zIndex: 50,
          width: 38, height: 38,
          background: 'rgba(20,20,20,0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid #252525',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#F0F0F0',
        }}
      >
        <Menu size={17}/>
      </button>

      {/* Bell — top right, floating */}
      <button
        onClick={() => setShowNotifs(true)}
        style={{
          position:'fixed',
          top: 'max(14px, calc(env(safe-area-inset-top) + 10px))',
          right: 14,
          zIndex: 50,
          width: 38, height: 38,
          background: 'rgba(20,20,20,0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid #252525',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#F0F0F0',
          position: 'fixed',
        }}
      >
        <Bell size={17}/>
        {unread > 0 && (
          <span style={{
            position:'absolute', top:-5, right:-5,
            minWidth:16, height:16, borderRadius:8,
            background:'#FF6B1A', border:'2px solid #0D0D0D',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:8, fontWeight:800, color:'#fff',
            padding:'0 3px', fontFamily:"'DM Sans',system-ui,sans-serif",
            lineHeight:1,
          }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {/* ── CONTENT — full screen, no top margin from header ── */}
      <main style={{
        flex: 1,
        paddingTop: 'max(62px, calc(env(safe-area-inset-top) + 52px))',
        paddingBottom: 'calc(52px + env(safe-area-inset-bottom))',
        overflowX: 'hidden',
      }}>
        {children}
      </main>

      {/* ── BOTTOM NAV ── */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:40,
        background:'rgba(14,14,14,0.97)',
        backdropFilter:'blur(16px)',
        borderTop:'0.5px solid #252525',
        height:'calc(52px + env(safe-area-inset-bottom))',
        paddingBottom:'env(safe-area-inset-bottom)',
        display:'flex', alignItems:'stretch',
      }}>
        {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            style={({ isActive }) => ({
              flex:1, display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center', gap:2, textDecoration:'none', paddingTop:6,
              color: isActive ? '#FF6B1A' : '#444', position:'relative',
            })}>
            {({ isActive }) => <>
              {isActive && (
                <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:18, height:2, borderRadius:1, background:'#FF6B1A' }}/>
              )}
              <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8}/>
              <span style={{ fontSize:9, fontWeight: isActive ? 800 : 600, letterSpacing:'0.03em', fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                {label.toUpperCase()}
              </span>
            </>}
          </NavLink>
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