/**
 * BarberLayout — iPhone-optimized
 * ✓ Compact header (44px)
 * ✓ Bottom nav 4 tabs, no QR
 * ✓ Profile bottom sheet
 * ✓ No sidebar
 */
import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { useBarberData } from '../../hooks/useBarberData'
import { LayoutDashboard, CalendarDays, ClipboardList, Users, Bell, X, LogOut, User, Settings, ChevronRight } from 'lucide-react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'

const BG=('#0D0D0D'),CARD=('#141414'),CARD2=('#1C1C1E'),BORDER=('#252525'),ORANGE=('#FF6B1A'),TXT=('#F0F0F0'),TXT2=('#666666'),TXT3=('#3A3A3A')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
input,textarea{font-size:16px!important}
`

const NAV = [
  { to:'/barber/dashboard',    icon:LayoutDashboard, label:'Home'     },
  { to:'/barber/calendar',     icon:CalendarDays,    label:'Calendar' },
  { to:'/barber/appointments', icon:ClipboardList,   label:'Appts'    },
  { to:'/barber/clients',      icon:Users,           label:'Clients'  },
]

function useUnread(userId) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!userId) return
    const q = query(collection(db,'notifications'), where('userId','==',userId), where('read','==',false))
    const unsub = onSnapshot(q, s => setN(s.size))
    return unsub
  }, [userId])
  return n
}

function ProfileSheet({ onClose }) {
  const { signOut, userData } = useAuth()
  const { barber } = useBarberData()
  const navigate = useNavigate()
  const initials = `${userData?.firstName?.[0]||''}${userData?.lastName?.[0]||''}`.toUpperCase()

  async function handleSignOut() {
    localStorage.removeItem('ab_last_active')
    await signOut()
    navigate('/barber/login')
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:70,background:'rgba(0,0,0,0.85)',animation:'fadeIn 0.15s ease'}} onClick={onClose}>
      <div style={{position:'absolute',bottom:0,left:0,right:0,background:CARD,borderRadius:'20px 20px 0 0',border:`1px solid ${BORDER}`,paddingBottom:'max(28px,env(safe-area-inset-bottom))',animation:'slideUp 0.25s cubic-bezier(0.22,1,0.36,1)',...F}} onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,borderRadius:2,background:BORDER,margin:'10px auto 0'}}/>

        {/* Profile row */}
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'16px 18px 14px',borderBottom:`1px solid ${BORDER}`}}>
          <div style={{width:44,height:44,borderRadius:'50%',overflow:'hidden',background:CARD2,border:`2px solid ${ORANGE}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:15,color:ORANGE,flexShrink:0}}>
            {userData?.photoURL?<img src={userData.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:initials||'B'}
          </div>
          <div>
            <p style={{color:TXT,fontWeight:700,fontSize:15,margin:'0 0 1px'}}>{userData?.firstName} {userData?.lastName}</p>
            <p style={{color:TXT2,fontSize:12,margin:0}}>{barber?.name||'Barber'}</p>
          </div>
        </div>

        {/* Menu */}
        <div style={{padding:'6px 10px'}}>
          {[
            {icon:User,    label:'Edit Profile', fn:()=>{onClose();navigate('/barber/profile')}},
            {icon:Settings,label:'Settings',     fn:()=>{onClose();navigate('/barber/settings')}},
          ].map(item=>{
            const Icon=item.icon
            return (
              <button key={item.label} onClick={item.fn}
                style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'13px 10px',borderRadius:12,background:'transparent',border:'none',cursor:'pointer',textAlign:'left',...F}}>
                <div style={{width:32,height:32,borderRadius:10,background:CARD2,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Icon size={15} color={TXT2}/>
                </div>
                <span style={{flex:1,color:TXT,fontWeight:600,fontSize:14}}>{item.label}</span>
                <ChevronRight size={14} color={TXT3}/>
              </button>
            )
          })}
          <div style={{height:1,background:BORDER,margin:'4px 10px'}}/>
          <button onClick={handleSignOut}
            style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'13px 10px',borderRadius:12,background:'transparent',border:'none',cursor:'pointer',textAlign:'left',...F}}>
            <div style={{width:32,height:32,borderRadius:10,background:'rgba(239,68,68,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <LogOut size={15} color="#EF4444"/>
            </div>
            <span style={{color:'#EF4444',fontWeight:700,fontSize:14}}>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BarberLayout({ children }) {
  const { userData, user } = useAuth()
  const { barber } = useBarberData()
  const [showProfile, setShowProfile] = useState(false)
  const unread = useUnread(user?.uid)

  return (
    <div style={{minHeight:'100dvh',background:BG,display:'flex',flexDirection:'column',...F}}>
      <style>{CSS}</style>

      {/* ── HEADER ── 44px compact */}
      <header style={{
        position:'fixed',top:0,left:0,right:0,zIndex:40,
        background:`${BG}EE`,backdropFilter:'blur(16px)',
        borderBottom:`0.5px solid ${BORDER}`,
        height:'calc(44px + env(safe-area-inset-top))',
        paddingTop:'env(safe-area-inset-top)',
        display:'flex',alignItems:'center',padding:'0 14px',
      }}>
        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',gap:7,flex:1}}>
          <div style={{width:24,height:24,borderRadius:7,background:ORANGE,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
              <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>
            </svg>
          </div>
          <span style={{color:TXT,fontWeight:800,fontSize:15,letterSpacing:'-0.3px'}}>{barber?.name||'AmadoBook'}</span>
        </div>

        {/* Right — Bell + Avatar */}
        <div style={{display:'flex',alignItems:'center',gap:2}}>
          <button style={{position:'relative',background:'none',border:'none',color:TXT2,cursor:'pointer',padding:'8px',borderRadius:8,display:'flex'}}>
            <Bell size={17}/>
            {unread>0&&<span style={{position:'absolute',top:6,right:6,width:6,height:6,borderRadius:'50%',background:ORANGE,border:`1.5px solid ${BG}`}}/>}
          </button>
          <button onClick={()=>setShowProfile(true)}
            style={{background:'none',border:'none',cursor:'pointer',padding:'4px',display:'flex'}}>
            <div style={{width:28,height:28,borderRadius:'50%',overflow:'hidden',background:CARD2,border:`1.5px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:10,color:TXT2}}>
              {userData?.photoURL
                ?<img src={userData.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
                :`${userData?.firstName?.[0]||''}${userData?.lastName?.[0]||''}`}
            </div>
          </button>
        </div>
      </header>

      {/* ── CONTENT ── */}
      <main style={{
        flex:1,
        marginTop:'calc(44px + env(safe-area-inset-top))',
        paddingBottom:'calc(52px + env(safe-area-inset-bottom))',
        overflowX:'hidden',
      }}>
        {children}
      </main>

      {/* ── BOTTOM NAV ── 52px compact */}
      <nav style={{
        position:'fixed',bottom:0,left:0,right:0,zIndex:40,
        background:`${CARD}F5`,backdropFilter:'blur(16px)',
        borderTop:`0.5px solid ${BORDER}`,
        height:'calc(52px + env(safe-area-inset-bottom))',
        paddingBottom:'env(safe-area-inset-bottom)',
        display:'flex',alignItems:'stretch',
      }}>
        {NAV.map(({to,icon:Icon,label})=>(
          <NavLink key={to} to={to}
            style={({isActive})=>({
              flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
              gap:2,textDecoration:'none',paddingTop:6,
              color:isActive?ORANGE:TXT3,position:'relative',
            })}>
            {({isActive})=>(
              <>
                {isActive&&<div style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:18,height:2,borderRadius:1,background:ORANGE}}/>}
                <Icon size={19} strokeWidth={isActive?2.5:1.8}/>
                <span style={{fontSize:9,fontWeight:isActive?800:600,letterSpacing:'0.03em',fontFamily:"'DM Sans',system-ui,sans-serif"}}>
                  {label.toUpperCase()}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {showProfile && <ProfileSheet onClose={()=>setShowProfile(false)}/>}
    </div>
  )
}