/**
 * BarberLayout — Updated
 * ✓ Header: hamburger | ✂️ Name | Bell (functional) | Avatar
 * ✓ Profile/greeting in side drawer (not header)
 * ✓ Notification bell shows unread count
 * ✓ Notifications panel in drawer
 */
import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { LayoutDashboard, CalendarDays, ClipboardList, Users, Bell, X, LogOut, User, Settings, Menu, CheckCheck } from 'lucide-react'
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs, orderBy, limit } from 'firebase/firestore'
import { db } from '../../lib/firebase'

const BG=('#0D0D0D'),CARD=('#141414'),CARD2=('#1C1C1E'),BORDER=('#252525'),ORANGE=('#FF6B1A'),TXT=('#F0F0F0'),TXT2=('#666666'),TXT3=('#3A3A3A')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slideIn{from{opacity:0;transform:translateX(-100%)}to{opacity:1;transform:translateX(0)}}
@keyframes slideInRight{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
`

const NAV=[
  {to:'/barber/dashboard',    icon:LayoutDashboard, label:'Home'},
  {to:'/barber/calendar',     icon:CalendarDays,    label:'Calendar'},
  {to:'/barber/appointments', icon:ClipboardList,   label:'Appts'},
  {to:'/barber/clients',      icon:Users,           label:'Clients'},
]

const MORE_NAV=[
  {to:'/barber/services',      label:'Services'},
  {to:'/barber/availability',  label:'Availability'},
  {to:'/barber/reports',       label:'Reports'},
  {to:'/barber/broadcast',     label:'Broadcast'},
]

// ── Notifications panel ──────────────────────────────────────────────────────
function NotificationsPanel({userId,onClose}){
  const[notifs,setNotifs]=useState([])
  const[loading,setLoading]=useState(true)

  useEffect(()=>{
    if(!userId)return
    const q=query(
      collection(db,'notifications'),
      where('userId','==',userId),
      orderBy('createdAt','desc'),
      limit(30)
    )
    const unsub=onSnapshot(q,snap=>{
      setNotifs(snap.docs.map(d=>({id:d.id,...d.data()})))
      setLoading(false)
    })
    return unsub
  },[userId])

  async function markAllRead(){
    const unread=notifs.filter(n=>!n.read)
    await Promise.all(unread.map(n=>updateDoc(doc(db,'notifications',n.id),{read:true})))
  }

  const unreadCount=notifs.filter(n=>!n.read).length

  return(
    <div style={{position:'fixed',inset:0,zIndex:75,animation:'fadeIn 0.15s ease'}} onClick={onClose}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.75)'}}/>
      <div style={{position:'absolute',right:0,top:0,bottom:0,width:Math.min(320,window.innerWidth*0.9),background:CARD,borderLeft:`1px solid ${BORDER}`,display:'flex',flexDirection:'column',animation:'slideInRight 0.25s cubic-bezier(0.22,1,0.36,1)',...F}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'max(48px,calc(env(safe-area-inset-top)+16px)) 16px 12px',borderBottom:`1px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <p style={{color:TXT,fontWeight:700,fontSize:16,margin:'0 0 2px'}}>Notifications</p>
            {unreadCount>0&&<p style={{color:TXT2,fontSize:11,margin:0}}>{unreadCount} unread</p>}
          </div>
          <div style={{display:'flex',gap:8}}>
            {unreadCount>0&&(
              <button onClick={markAllRead} style={{background:'none',border:'none',color:ORANGE,fontSize:11,fontWeight:700,cursor:'pointer',...F,display:'flex',alignItems:'center',gap:4}}>
                <CheckCheck size={12}/> Mark all read
              </button>
            )}
            <button onClick={onClose} style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:8,padding:'5px 6px',color:TXT2,cursor:'pointer',display:'flex'}}><X size={14}/></button>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
          {loading?(
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 0'}}>
              <div style={{width:18,height:18,border:`2px solid #333`,borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
            </div>
          ):notifs.length===0?(
            <div style={{padding:'32px 16px',textAlign:'center'}}>
              <Bell size={22} style={{color:TXT3,display:'block',margin:'0 auto 8px'}} strokeWidth={1.5}/>
              <p style={{color:TXT2,fontSize:13,fontWeight:600,margin:0}}>No notifications</p>
            </div>
          ):(
            notifs.map(n=>(
              <div key={n.id} onClick={()=>!n.read&&updateDoc(doc(db,'notifications',n.id),{read:true})}
                style={{padding:'10px 12px',borderRadius:10,background:n.read?'transparent':`${ORANGE}08`,border:`1px solid ${n.read?BORDER:`${ORANGE}20`}`,marginBottom:6,cursor:'pointer'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                  <p style={{color:n.read?TXT2:TXT,fontWeight:n.read?500:700,fontSize:12,margin:'0 0 3px',flex:1}}>{n.title||'New Message'}</p>
                  {!n.read&&<div style={{width:7,height:7,borderRadius:'50%',background:ORANGE,flexShrink:0,marginTop:3}}/>}
                </div>
                <p style={{color:TXT2,fontSize:11,margin:'0 0 5px',lineHeight:1.4}}>{n.message}</p>
                {n.createdAt?.toDate&&<p style={{color:TXT3,fontSize:9,margin:0}}>{n.createdAt.toDate().toLocaleDateString()}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Side drawer ──────────────────────────────────────────────────────────────
function SideDrawer({onClose,userData,barberName,navigate}){
  const{signOut}=useAuth()
  const initials=`${userData?.firstName?.[0]||''}${userData?.lastName?.[0]||''}`.toUpperCase()||'B'

  async function handleSignOut(){
    localStorage.removeItem('ab_last_active')
    await signOut()
    navigate('/barber/login')
  }

  return(
    <div style={{position:'fixed',inset:0,zIndex:70,animation:'fadeIn 0.15s ease'}} onClick={onClose}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.75)'}}/>
      <div style={{position:'absolute',left:0,top:0,bottom:0,width:Math.min(280,window.innerWidth*0.82),background:CARD,borderRight:`1px solid ${BORDER}`,display:'flex',flexDirection:'column',animation:'slideIn 0.25s cubic-bezier(0.22,1,0.36,1)',...F}} onClick={e=>e.stopPropagation()}>

        {/* Profile header */}
        <div style={{padding:'max(52px,calc(env(safe-area-inset-top)+28px)) 18px 18px',borderBottom:`1px solid ${BORDER}`}}>
          <div style={{width:52,height:52,borderRadius:16,overflow:'hidden',background:CARD2,border:`2px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:18,color:TXT2,marginBottom:12}}>
            {userData?.photoURL?<img src={userData.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:initials}
          </div>
          <p style={{color:TXT2,fontSize:12,fontWeight:500,margin:'0 0 2px'}}>
            {new Date().getHours()<12?'Good morning,':new Date().getHours()<17?'Good afternoon,':'Good evening,'}
          </p>
          <p style={{color:TXT,fontWeight:900,fontSize:22,margin:'0 0 2px',letterSpacing:'-0.4px'}}>{barberName||`${userData?.firstName||''} ${userData?.lastName||''}`}</p>
          <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.08em',margin:0}}>BARBER</p>
        </div>

        {/* Nav */}
        <div style={{flex:1,overflowY:'auto',padding:'8px 10px'}}>
          {NAV.map(item=>{
            const Icon=item.icon
            return(
              <NavLink key={item.to} to={item.to} onClick={onClose}
                style={({isActive})=>({display:'flex',alignItems:'center',gap:12,padding:'11px 10px',borderRadius:11,textDecoration:'none',marginBottom:2,background:isActive?`${ORANGE}14`:'transparent'})}>
                {({isActive})=>(
                  <>
                    <Icon size={16} color={isActive?ORANGE:TXT2} strokeWidth={isActive?2.2:1.8}/>
                    <span style={{color:isActive?ORANGE:TXT,fontWeight:isActive?700:500,fontSize:14}}>{item.label}</span>
                  </>
                )}
              </NavLink>
            )
          })}

          <div style={{height:1,background:BORDER,margin:'8px 10px'}}/>
          <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.1em',padding:'2px 10px 6px'}}>MORE</p>

          {MORE_NAV.map(item=>(
            <NavLink key={item.to} to={item.to} onClick={onClose}
              style={({isActive})=>({display:'flex',alignItems:'center',padding:'10px 10px',borderRadius:11,textDecoration:'none',marginBottom:2,background:isActive?`${ORANGE}14`:'transparent'})}>
              {({isActive})=>(
                <span style={{color:isActive?ORANGE:TXT2,fontWeight:isActive?700:500,fontSize:14}}>{item.label}</span>
              )}
            </NavLink>
          ))}

          <div style={{height:1,background:BORDER,margin:'8px 10px'}}/>

          {[{icon:User,label:'Edit Profile',fn:()=>{onClose();navigate('/barber/profile')}},{icon:Settings,label:'Settings',fn:()=>{onClose();navigate('/barber/settings')}}].map(item=>{
            const Icon=item.icon
            return(
              <button key={item.label} onClick={item.fn} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'11px 10px',borderRadius:11,background:'transparent',border:'none',cursor:'pointer',textAlign:'left',...F,marginBottom:2}}>
                <Icon size={15} color={TXT2}/>
                <span style={{color:TXT,fontWeight:500,fontSize:14}}>{item.label}</span>
              </button>
            )
          })}
        </div>

        {/* Sign out */}
        <div style={{padding:'10px',borderTop:`1px solid ${BORDER}`}}>
          <button onClick={handleSignOut} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'11px 10px',borderRadius:11,background:'transparent',border:'none',cursor:'pointer',textAlign:'left',...F}}>
            <LogOut size={15} color="#EF4444"/>
            <span style={{color:'#EF4444',fontWeight:600,fontSize:14}}>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BarberLayout({children}){
  const{userData,user}=useAuth()
  const navigate=useNavigate()
  const[showDrawer,setShowDrawer]=useState(false)
  const[showNotifs,setShowNotifs]=useState(false)
  const[barberName,setBarberName]=useState('')
  const[unreadCount,setUnreadCount]=useState(0)

  useEffect(()=>{
    if(!user)return
    // Load barber name
    getDocs(query(collection(db,'barbers'),where('userId','==',user.uid))).then(snap=>{
      if(!snap.empty)setBarberName(snap.docs[0].data().name||'')
    })
    // Listen for unread notifications (for bell badge)
    const q=query(collection(db,'notifications'),where('userId','==',user.uid),where('read','==',false))
    const unsub=onSnapshot(q,snap=>setUnreadCount(snap.size))
    return unsub
  },[user?.uid])

  return(
    <div style={{minHeight:'100dvh',background:BG,display:'flex',flexDirection:'column',...F}}>
      <style>{CSS}</style>

      {/* ── HEADER ── */}
      <header style={{
        position:'fixed',top:0,left:0,right:0,zIndex:40,
        background:`${BG}F2`,backdropFilter:'blur(16px)',
        borderBottom:`0.5px solid ${BORDER}`,
        height:'calc(48px + env(safe-area-inset-top))',
        paddingTop:'env(safe-area-inset-top)',
        display:'flex',alignItems:'center',
        padding:'env(safe-area-inset-top) 12px 0',
      }}>
        {/* Hamburger */}
        <button onClick={()=>setShowDrawer(true)}
          style={{background:'none',border:'none',color:TXT2,cursor:'pointer',padding:'6px',borderRadius:8,display:'flex',marginRight:8}}>
          <Menu size={18}/>
        </button>

        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',gap:7,flex:1}}>
          <div style={{width:26,height:26,borderRadius:7,background:ORANGE,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
              <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>
            </svg>
          </div>
          <span style={{color:TXT,fontWeight:800,fontSize:16,letterSpacing:'-0.3px'}}>{barberName||'AmadoBlends'}</span>
        </div>

        {/* Bell + Avatar */}
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          {/* Notification bell — functional */}
          <button onClick={()=>setShowNotifs(true)}
            style={{position:'relative',background:'none',border:'none',color:TXT2,cursor:'pointer',padding:'7px',borderRadius:8,display:'flex'}}>
            <Bell size={18}/>
            {unreadCount>0&&(
              <span style={{
                position:'absolute',top:4,right:4,
                minWidth:14,height:14,borderRadius:7,
                background:ORANGE,border:`1.5px solid ${BG}`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:8,fontWeight:800,color:'#fff',padding:'0 2px',
              }}>
                {unreadCount>9?'9+':unreadCount}
              </span>
            )}
          </button>
          {/* Avatar — opens drawer */}
          <button onClick={()=>setShowDrawer(true)}
            style={{background:'none',border:'none',cursor:'pointer',padding:'3px',display:'flex'}}>
            <div style={{width:28,height:28,borderRadius:'50%',overflow:'hidden',background:CARD2,border:`1.5px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:10,color:TXT2}}>
              {userData?.photoURL?<img src={userData.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:`${userData?.firstName?.[0]||''}${userData?.lastName?.[0]||''}`}
            </div>
          </button>
        </div>
      </header>

      {/* ── CONTENT ── */}
      <main style={{flex:1,marginTop:'calc(48px + env(safe-area-inset-top))',paddingBottom:'calc(52px + env(safe-area-inset-bottom))',overflowX:'hidden'}}>
        {children}
      </main>

      {/* ── BOTTOM NAV ── */}
      <nav style={{position:'fixed',bottom:0,left:0,right:0,zIndex:40,background:`${CARD}F5`,backdropFilter:'blur(16px)',borderTop:`0.5px solid ${BORDER}`,height:'calc(52px + env(safe-area-inset-bottom))',paddingBottom:'env(safe-area-inset-bottom)',display:'flex',alignItems:'stretch'}}>
        {NAV.map(({to,icon:Icon,label})=>(
          <NavLink key={to} to={to}
            style={({isActive})=>({flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,textDecoration:'none',paddingTop:6,color:isActive?ORANGE:TXT3,position:'relative'})}>
            {({isActive})=>(
              <>
                {isActive&&<div style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:18,height:2,borderRadius:1,background:ORANGE}}/>}
                <Icon size={19} strokeWidth={isActive?2.5:1.8}/>
                <span style={{fontSize:9,fontWeight:isActive?800:600,letterSpacing:'0.03em',fontFamily:"'DM Sans',system-ui,sans-serif"}}>{label.toUpperCase()}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {showDrawer&&<SideDrawer onClose={()=>setShowDrawer(false)} userData={userData} barberName={barberName} navigate={navigate}/>}
      {showNotifs&&user&&<NotificationsPanel userId={user.uid} onClose={()=>setShowNotifs(false)}/>}
    </div>
  )
}