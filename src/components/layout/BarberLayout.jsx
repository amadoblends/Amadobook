/**
 * BarberLayout — Migrado al nuevo design system
 * ✅ Usa var(--bg), var(--card), var(--border), etc. — light/dark automático
 * ✅ Navbar inferior con botón + naranja central (igual al mockup)
 * ✅ Drawer lateral con variables de tema
 * ✅ Panel de notificaciones con variables de tema
 * ✅ Sin colores hardcodeados en el layout base
 * ✅ Lógica de Firebase y notificaciones intacta
 */
import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import {
  LayoutDashboard, CalendarDays, Users, MoreHorizontal,
  Bell, X, LogOut, Settings, User, Menu, CheckCheck,
  Scissors, Clock, BarChart2, MessageSquare, Plus,
  Trash2, Check,
} from 'lucide-react'
import {
  collection, query, where, onSnapshot, updateDoc, doc,
  getDocs, orderBy, limit, deleteDoc,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

// ── Navigation config ─────────────────────────────────────────────────────
// 4 items + central FAB = 5 slots (like the mockup)
const BOTTOM_NAV = [
  { to:'/barber/dashboard',    icon:LayoutDashboard, label:'Inicio'   },
  { to:'/barber/appointments', icon:CalendarDays,    label:'Citas'    },
  // Center slot is the FAB — rendered separately
  { to:'/barber/clients',      icon:Users,           label:'Clientes' },
  { to:'/barber/settings',     icon:MoreHorizontal,  label:'Más'      },
]

const DRAWER_NAV = [
  { to:'/barber/services',     icon:Scissors,      label:'Servicios'     },
  { to:'/barber/availability', icon:Clock,         label:'Disponibilidad'},
  { to:'/barber/calendar',     icon:CalendarDays,  label:'Calendario'    },
  { to:'/barber/reports',      icon:BarChart2,     label:'Reportes'      },
  { to:'/barber/broadcast',    icon:MessageSquare, label:'Broadcast'     },
  { to:'/barber/profile',      icon:User,          label:'Perfil'        },
  { to:'/barber/settings',     icon:Settings,      label:'Ajustes'       },
]

// ── Helpers ───────────────────────────────────────────────────────────────
function getNotifUrl(n) {
  if (n.type==='new_booking' || n.appointmentId) return '/barber/appointments'
  if (n.type==='payment')                        return '/barber/reports'
  if (n.type==='client'    || n.clientId)        return '/barber/clients'
  return '/barber/appointments'
}

function timeAgo(ts) {
  if (!ts?.toDate) return ''
  const diff = Date.now() - ts.toDate().getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return ts.toDate().toLocaleDateString('es')
}

// ── Swipeable notification item ───────────────────────────────────────────
function SwipeableNotifItem({ n, selectMode, selected, onSelect, onDelete, onMarkRead, onTap, ago }) {
  const [offset, setOffset] = useState(0)
  const [active, setActive] = useState(false)
  const startX = useRef(null)

  function onTouchStart(e) { startX.current = e.touches[0].clientX; setActive(true) }
  function onTouchMove(e) {
    if (startX.current === null) return
    setOffset(Math.max(-100, Math.min(100, e.touches[0].clientX - startX.current)))
  }
  function onTouchEnd() {
    setActive(false)
    if (offset < -60)        { onDelete();   setOffset(0) }
    else if (offset > 60 && !n.read) { onMarkRead(); setOffset(0) }
    else setOffset(0)
    startX.current = null
  }

  return (
    <div style={{ position:'relative', marginBottom:4, borderRadius:10, overflow:'hidden' }}>
      {/* Swipe hints */}
      {offset < -20 && (
        <div style={{ position:'absolute', inset:0, background:'var(--red-soft)', display:'flex', alignItems:'center', justifyContent:'flex-end', padding:'0 14px', borderRadius:10 }}>
          <Trash2 size={13} color="var(--red)"/>
        </div>
      )}
      {offset > 20 && !n.read && (
        <div style={{ position:'absolute', inset:0, background:'var(--green-soft)', display:'flex', alignItems:'center', padding:'0 14px', borderRadius:10 }}>
          <CheckCheck size={13} color="var(--green)"/>
        </div>
      )}

      <div
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onClick={selectMode ? onSelect : onTap}
        style={{
          padding:'10px 12px', borderRadius:10, cursor:'pointer',
          background: n.read ? 'var(--card2)' : 'var(--accent-soft)',
          border: `1px solid ${n.read ? 'var(--border)' : 'var(--accent-mid)'}`,
          transform: `translateX(${offset}px)`,
          transition: active ? 'none' : 'transform 0.25s ease',
          display:'flex', alignItems:'flex-start', gap:10,
          userSelect:'none', WebkitUserSelect:'none', position:'relative', zIndex:1,
        }}
      >
        {selectMode && (
          <div style={{ width:17, height:17, borderRadius:5, flexShrink:0, marginTop:2,
            border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border2)'}`,
            background: selected ? 'var(--accent)' : 'transparent',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            {selected && <Check size={9} color="#fff"/>}
          </div>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:2 }}>
            <p style={{ color: n.read ? 'var(--text-sec)' : 'var(--text-pri)', fontWeight: n.read ? 500 : 700, fontSize:12, margin:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {n.title || 'Notificación'}
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
              {ago && <span style={{ color:'var(--text-ter)', fontSize:9 }}>{ago}</span>}
              {!n.read && <div style={{ width:5, height:5, borderRadius:'50%', background:'var(--accent)' }}/>}
            </div>
          </div>
          <p style={{ color:'var(--text-sec)', fontSize:11, margin:0, lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
            {n.message}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Notifications panel ───────────────────────────────────────────────────
function NotificationsPanel({ userId, onClose, navigate }) {
  const [notifs,     setNotifs]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [selectMode, setSelectMode] = useState(false)
  const [selected,   setSelected]   = useState(new Set())

  useEffect(() => {
    if (!userId) return
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    )
    const unsub = onSnapshot(q, snap => {
      setNotifs(snap.docs.map(d => ({ id:d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [userId])

  async function markAll() {
    await Promise.all(notifs.filter(n => !n.read).map(n => updateDoc(doc(db,'notifications',n.id), { read:true })))
  }
  async function clearAll() {
    await Promise.all(notifs.map(n => deleteDoc(doc(db,'notifications',n.id))))
  }
  async function deleteSelected() {
    await Promise.all([...selected].map(id => deleteDoc(doc(db,'notifications',id))))
    setSelected(new Set()); setSelectMode(false)
  }
  function toggleSelect(id) {
    setSelected(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const unread = notifs.filter(n => !n.read).length

  return (
    <div className="fade-in" style={{ position:'fixed', inset:0, zIndex:80 }} onClick={onClose}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)' }}/>
      <div
        className="slide-in-right"
        style={{
          position:'absolute', right:0, top:0, bottom:0,
          width: Math.min(320, window.innerWidth * 0.92),
          background:'var(--surface)',
          borderLeft:'1px solid var(--border)',
          display:'flex', flexDirection:'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          paddingTop: 'max(52px, calc(env(safe-area-inset-top) + 14px))',
          padding: 'max(52px, calc(env(safe-area-inset-top) + 14px)) 14px 10px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div>
              <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:15, margin:0 }}>Notificaciones</p>
              {unread > 0 && <p style={{ color:'var(--text-sec)', fontSize:10, margin:'2px 0 0' }}>{unread} sin leer</p>}
            </div>
            <button onClick={onClose}
              style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8, padding:'5px 6px', color:'var(--text-sec)', cursor:'pointer', display:'flex' }}>
              <X size={14}/>
            </button>
          </div>

          {notifs.length > 0 && (
            <div style={{ display:'flex', gap:5 }}>
              {!selectMode && unread > 0 && (
                <button onClick={markAll}
                  style={{ flex:1, background:'transparent', border:'1px solid var(--border)', borderRadius:8, padding:'7px 6px', color:'var(--text-sec)', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontFamily:'inherit' }}>
                  <CheckCheck size={11}/>Marcar leídas
                </button>
              )}
              {!selectMode && (
                <button onClick={() => setSelectMode(true)}
                  style={{ flex:1, background:'transparent', border:'1px solid var(--border)', borderRadius:8, padding:'7px 6px', color:'var(--text-sec)', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  Seleccionar
                </button>
              )}
              {selectMode && <>
                <button onClick={deleteSelected} disabled={selected.size === 0}
                  style={{ flex:1, background:'var(--red-soft)', border:'1px solid var(--red)', borderRadius:8, padding:'7px 6px', color:'var(--red)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: selected.size===0 ? 0.5:1 }}>
                  Eliminar ({selected.size})
                </button>
                <button onClick={() => { setSelectMode(false); setSelected(new Set()) }}
                  style={{ flex:1, background:'transparent', border:'1px solid var(--border)', borderRadius:8, padding:'7px 6px', color:'var(--text-sec)', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  Cancelar
                </button>
              </>}
            </div>
          )}
        </div>

        {/* List */}
        <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'48px 0' }}>
              <div style={{ width:18, height:18, border:'2px solid var(--border2)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.65s linear infinite' }}/>
            </div>
          ) : notifs.length === 0 ? (
            <div style={{ padding:'32px 16px', textAlign:'center' }}>
              <Bell size={22} style={{ color:'var(--text-ter)', display:'block', margin:'0 auto 8px' }} strokeWidth={1.5}/>
              <p style={{ color:'var(--text-sec)', fontSize:13, fontWeight:600, margin:0 }}>Sin notificaciones</p>
              <p style={{ color:'var(--text-ter)', fontSize:11, margin:'4px 0 0' }}>← desliza para eliminar · → para leer</p>
            </div>
          ) : notifs.map(n => (
            <SwipeableNotifItem
              key={n.id} n={n}
              selectMode={selectMode} selected={selected.has(n.id)}
              onSelect={() => toggleSelect(n.id)}
              onDelete={() => deleteDoc(doc(db,'notifications',n.id))}
              onMarkRead={() => updateDoc(doc(db,'notifications',n.id), { read:true })}
              onTap={() => { updateDoc(doc(db,'notifications',n.id),{read:true}); navigate(getNotifUrl(n)); onClose() }}
              ago={timeAgo(n.createdAt)}
            />
          ))}
        </div>

        {/* Footer */}
        {notifs.length > 0 && !selectMode && (
          <div style={{ padding:'10px 12px', borderTop:'1px solid var(--border)', paddingBottom:'max(10px, calc(env(safe-area-inset-bottom) + 10px))' }}>
            <button onClick={clearAll}
              style={{ width:'100%', background:'transparent', border:'1px solid var(--red)', borderRadius:10, padding:'11px', color:'var(--red)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity:0.75 }}>
              Limpiar todo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Side Drawer ───────────────────────────────────────────────────────────
function SideDrawer({ onClose, userData, barberName, navigate }) {
  const { signOut } = useAuth()
  const initials = `${userData?.firstName?.[0]||''}${userData?.lastName?.[0]||''}`.toUpperCase() || 'B'

  async function handleSignOut() {
    localStorage.removeItem('ab_last_active')
    await signOut()
    navigate('/barber/login')
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? '¡Buenos días,' : hour < 17 ? '¡Buenas tardes,' : '¡Buenas noches,'

  return (
    <div className="fade-in" style={{ position:'fixed', inset:0, zIndex:80 }} onClick={onClose}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)' }}/>
      <div
        className="slide-in-left"
        style={{
          position:'absolute', left:0, top:0, bottom:0,
          width: Math.min(280, window.innerWidth * 0.82),
          background:'var(--surface)',
          borderRight:'1px solid var(--border)',
          display:'flex', flexDirection:'column',
          boxShadow:'var(--shadow-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Profile header */}
        <div style={{
          paddingTop: 'max(56px, calc(env(safe-area-inset-top) + 32px))',
          padding: 'max(56px, calc(env(safe-area-inset-top) + 32px)) 18px 18px',
          borderBottom: '1px solid var(--border)',
        }}>
          {/* Avatar */}
          <div style={{
            width:52, height:52, borderRadius:14, overflow:'hidden',
            background:'var(--card2)', border:'1.5px solid var(--border2)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:800, fontSize:18, color:'var(--text-sec)',
            marginBottom:12,
          }}>
            {userData?.photoURL
              ? <img src={userData.photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
              : initials}
          </div>
          <p style={{ color:'var(--text-sec)', fontSize:12, fontWeight:500, margin:'0 0 2px' }}>{greeting}</p>
          <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:18, margin:'0 0 6px', letterSpacing:'-0.3px' }}>
            {barberName || `${userData?.firstName||''} ${userData?.lastName||''}`}
          </p>
          <span style={{ background:'var(--accent-soft)', color:'var(--accent)', fontSize:9, fontWeight:800, padding:'2px 9px', borderRadius:20, letterSpacing:'0.08em' }}>
            BARBERO
          </span>
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
                  background: isActive ? 'var(--accent-soft)' : 'transparent',
                })}>
                {({ isActive }) => <>
                  <div style={{
                    width:32, height:32, borderRadius:9,
                    background: isActive ? 'var(--accent-mid)' : 'var(--card2)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    flexShrink:0,
                  }}>
                    <Icon size={15} color={isActive ? 'var(--accent)' : 'var(--text-sec)'} strokeWidth={isActive ? 2.2 : 1.8}/>
                  </div>
                  <span style={{ color: isActive ? 'var(--accent)' : 'var(--text-pri)', fontWeight: isActive ? 700 : 500, fontSize:14 }}>
                    {item.label}
                  </span>
                  {isActive && <div style={{ marginLeft:'auto', width:5, height:5, borderRadius:'50%', background:'var(--accent)' }}/>}
                </>}
              </NavLink>
            )
          })}
        </div>

        {/* Sign out */}
        <div style={{ padding:'8px', borderTop:'1px solid var(--border)', paddingBottom:'max(10px, calc(env(safe-area-inset-bottom) + 10px))' }}>
          <button onClick={handleSignOut}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:11, padding:'10px', borderRadius:10, background:'transparent', border:'none', cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
            <div style={{ width:32, height:32, borderRadius:9, background:'var(--red-soft)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <LogOut size={14} color="var(--red)"/>
            </div>
            <span style={{ color:'var(--red)', fontWeight:600, fontSize:14 }}>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Bottom nav item ───────────────────────────────────────────────────────
function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink to={to}
      style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, textDecoration:'none', padding:'6px 4px 2px', position:'relative' }}>
      {({ isActive }) => <>
        {isActive && (
          <div style={{
            position:'absolute', top:4, left:'50%', transform:'translateX(-50%)',
            width:4, height:4, borderRadius:'50%', background:'var(--accent)',
          }}/>
        )}
        <Icon
          size={20}
          strokeWidth={isActive ? 2.4 : 1.6}
          color={isActive ? 'var(--accent)' : 'var(--text-ter)'}
          style={{ position:'relative', zIndex:1 }}
        />
        <span style={{
          fontSize:9, fontWeight: isActive ? 700 : 500,
          color: isActive ? 'var(--accent)' : 'var(--text-ter)',
          fontFamily:'inherit', position:'relative', zIndex:1,
          letterSpacing:'0.02em',
        }}>
          {label}
        </span>
      </>}
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
    <div style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', flexDirection:'column', fontFamily:"'Plus Jakarta Sans','DM Sans',system-ui,sans-serif" }}>

      {/* ── Hamburger — top left ── */}
      <button
        onClick={() => setShowDrawer(true)}
        style={{
          position:'fixed',
          top: 'max(14px, calc(env(safe-area-inset-top) + 10px))',
          left: 16, zIndex: 50,
          width: 36, height: 36,
          background: 'var(--card)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-pri)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <Menu size={17}/>
      </button>

      {/* ── Bell — top right ── */}
      <button
        onClick={() => setShowNotifs(true)}
        style={{
          position:'fixed',
          top: 'max(14px, calc(env(safe-area-inset-top) + 10px))',
          right: 16, zIndex: 50,
          width: 36, height: 36,
          background: 'var(--card)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-pri)',
          boxShadow: 'var(--shadow)',
          position: 'fixed', // repeated intentionally for clarity
        }}
      >
        <Bell size={17} strokeWidth={1.7}/>
        {unread > 0 && (
          <div style={{
            position:'absolute', top:-5, right:-5,
            minWidth:16, height:16, borderRadius:8,
            background:'var(--accent)', border:'2px solid var(--bg)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:8, fontWeight:800, color:'#fff',
            padding:'0 3px', fontFamily:'inherit', lineHeight:1,
            animation:'popIn 0.3s ease',
          }}>
            {unread > 99 ? '99+' : unread}
          </div>
        )}
      </button>

      {/* ── Main content ── */}
      <main style={{
        flex: 1,
        paddingTop: 'max(62px, calc(env(safe-area-inset-top) + 52px))',
        paddingBottom: 'calc(68px + env(safe-area-inset-bottom))',
        overflowX: 'hidden',
      }}>
        {children}
      </main>

      {/* ══════════════════════════════════════════════════════════════════
          BOTTOM NAV — matches mockup exactly:
          [Inicio] [Citas] [  +  ] [Clientes] [Más]
          ══════════════════════════════════════════════════════════════════ */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--nav-border)',
        height: 'calc(60px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        display: 'flex', alignItems: 'center',
        boxShadow: 'var(--shadow-md)',
      }}>
        {/* Left side: Inicio + Citas */}
        <NavItem to="/barber/dashboard"    icon={LayoutDashboard} label="Inicio"/>
        <NavItem to="/barber/appointments" icon={CalendarDays}    label="Citas"/>

        {/* Center: FAB naranja — acceso rápido a nueva cita */}
        <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center' }}>
          <button
            onClick={() => navigate('/barber/appointments')}
            style={{
              width: 48, height: 48,
              borderRadius: '50%',
              background: 'var(--accent)',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-accent)',
              // Slightly raised above nav
              marginTop: -14,
              flexShrink: 0,
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
            onTouchStart={e => e.currentTarget.style.transform = 'scale(0.94)'}
            onTouchEnd={e   => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Plus size={22} color="#fff" strokeWidth={2.5}/>
          </button>
        </div>

        {/* Right side: Clientes + Más */}
        <NavItem to="/barber/clients"  icon={Users}          label="Clientes"/>
        <NavItem to="/barber/settings" icon={MoreHorizontal} label="Más"/>
      </nav>

      {/* ── Overlays ── */}
      {showDrawer && (
        <SideDrawer
          onClose={() => setShowDrawer(false)}
          userData={userData}
          barberName={barberName}
          navigate={navigate}
        />
      )}
      {showNotifs && user && (
        <NotificationsPanel
          userId={user.uid}
          onClose={() => setShowNotifs(false)}
          navigate={navigate}
        />
      )}
    </div>
  )
}
