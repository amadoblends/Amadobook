import { useNavigate } from 'react-router-dom'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import BarberLayout from '../../components/layout/BarberLayout'
import { useTheme } from '../../context/ThemeContext'
import {
  User, Clock, Scissors, Bell, Shield, HelpCircle,
  LogOut, ChevronRight, Moon, Sun, BarChart2, MessageSquare,
} from 'lucide-react'
import toast from 'react-hot-toast'

const BG=('#0D0D0D'),CARD=('#141414'),CARD2=('#1C1C1E'),BORDER=('#252525'),ORANGE=('#FF6B1A'),TXT=('#F0F0F0'),TXT2=('#666666'),TXT3=('#3A3A3A'),RED=('#EF4444')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp 0.22s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
`

const SECTIONS=[
  {title:'Business',items:[
    {icon:User,         label:'Profile',           sub:'Edit your public profile',  path:'/barber/profile'},
    {icon:Clock,        label:'Availability',      sub:'Working hours & blocked days',path:'/barber/availability'},
    {icon:Scissors,     label:'Services',          sub:'Manage your service menu',  path:'/barber/services'},
  ]},
  {title:'Tools',items:[
    {icon:BarChart2,    label:'Reports',           sub:'Earnings & analytics',      path:'/barber/reports'},
    {icon:MessageSquare,label:'Broadcast',         sub:'Message your clients',      path:'/barber/broadcast'},
  ]},
  {title:'Preferences',items:[
    {icon:Bell,         label:'Notifications',     sub:'Push & email alerts',       soon:true},
    {icon:Shield,       label:'Privacy & Security',sub:'Password, 2FA',             soon:true},
  ]},
  {title:'Support',items:[
    {icon:HelpCircle,   label:'Help & Support',    sub:'FAQs and contact us',       soon:true},
  ]},
]

function Toggle({value,onChange}){
  return(
    <button onClick={()=>onChange(!value)}
      style={{width:46,height:26,borderRadius:13,padding:3,background:value?ORANGE:CARD2,border:`1px solid ${value?ORANGE:BORDER}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:value?'flex-end':'flex-start',transition:'all 0.2s',flexShrink:0}}>
      <div style={{width:20,height:20,borderRadius:'50%',background:'#fff',transition:'all 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/>
    </button>
  )
}

export default function BarberSettings(){
  const{signOut,userData}=useAuth()
  const{theme,toggleTheme,timeFormat,setTimeFormat}=useTheme()
  const navigate=useNavigate()

  async function handleSignOut(){
    localStorage.removeItem('ab_last_active')
    await signOut()
    navigate('/barber/login')
  }

  // Current theme colors for dynamic rendering
  const isDark=theme==='dark'
  const cardBg=isDark?CARD:'#FFFFFF'
  const pageBg=isDark?BG:'#F2F2F7'
  const txtColor=isDark?TXT:'#111111'
  const txt2Color=isDark?TXT2:'#666666'
  const txt3Color=isDark?TXT3:'#999999'
  const borderColor=isDark?BORDER:'#E0E0E0'
  const card2Bg=isDark?CARD2:'#F0F0F0'

  return(
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:pageBg,minHeight:'100%',paddingBottom:40,...F,transition:'background 0.3s'}}>
        <div style={{padding:'14px 16px',maxWidth:560,margin:'0 auto'}}>

          {/* Header */}
          <div className="fu" style={{marginBottom:20}}>
            <h1 style={{color:txtColor,fontWeight:800,fontSize:20,margin:'0 0 2px',letterSpacing:'-0.3px'}}>Settings</h1>
            <p style={{color:txt2Color,fontSize:12,margin:0}}>App preferences & configuration</p>
          </div>

          {/* Profile card */}
          <div className="fu" style={{background:cardBg,border:`1px solid ${borderColor}`,borderRadius:16,padding:'13px 15px',marginBottom:16,display:'flex',alignItems:'center',gap:12,cursor:'pointer'}} onClick={()=>navigate('/barber/profile')}>
            <div style={{width:44,height:44,borderRadius:'50%',overflow:'hidden',background:card2Bg,border:`2px solid ${ORANGE}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:16,color:ORANGE,flexShrink:0}}>
              {userData?.photoURL?<img src={userData.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:`${userData?.firstName?.[0]||''}${userData?.lastName?.[0]||''}`}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{color:txtColor,fontWeight:700,fontSize:15,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{userData?.firstName} {userData?.lastName}</p>
              <p style={{color:txt2Color,fontSize:12,margin:0}}>Barber · View profile</p>
            </div>
            <ChevronRight size={15} color={txt3Color}/>
          </div>

          {/* ── APPEARANCE ── */}
          <div className="fu" style={{background:cardBg,border:`1px solid ${borderColor}`,borderRadius:16,overflow:'hidden',marginBottom:16}}>
            <div style={{padding:'10px 15px',borderBottom:`1px solid ${borderColor}`}}>
              <p style={{color:txt3Color,fontSize:9,fontWeight:700,letterSpacing:'0.1em',margin:0}}>APPEARANCE</p>
            </div>

            {/* Dark / Light theme toggle */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 15px',borderBottom:`1px solid ${borderColor}`}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:34,height:34,borderRadius:9,background:card2Bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {isDark?<Moon size={15} color={txt2Color}/>:<Sun size={15} color={ORANGE}/>}
                </div>
                <div>
                  <p style={{color:txtColor,fontWeight:600,fontSize:13,margin:'0 0 1px'}}>Theme</p>
                  <p style={{color:txt2Color,fontSize:11,margin:0}}>{isDark?'Dark mode active':'Light mode active'}</p>
                </div>
              </div>
              {/* Toggle switch */}
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{color:txt3Color,fontSize:10,fontWeight:600}}>{isDark?'DARK':'LIGHT'}</span>
                <Toggle value={!isDark} onChange={()=>toggleTheme()}/>
                <span style={{color:txt3Color,fontSize:10,fontWeight:600}}>{isDark?'LIGHT':'DARK'}</span>
              </div>
            </div>

            {/* Time format */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 15px'}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:34,height:34,borderRadius:9,background:card2Bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Clock size={15} color={txt2Color}/>
                </div>
                <div>
                  <p style={{color:txtColor,fontWeight:600,fontSize:13,margin:'0 0 1px'}}>Time Format</p>
                  <p style={{color:txt2Color,fontSize:11,margin:0}}>How times appear in the app</p>
                </div>
              </div>
              <div style={{display:'flex',background:card2Bg,borderRadius:9,padding:2,border:`1px solid ${borderColor}`}}>
                {['12h','24h'].map(v=>(
                  <button key={v} onClick={()=>setTimeFormat(v)}
                    style={{padding:'6px 12px',borderRadius:7,border:'none',cursor:'pointer',background:timeFormat===v?ORANGE:'transparent',color:timeFormat===v?'#fff':txt2Color,fontWeight:700,fontSize:11,...F,transition:'all 0.15s'}}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── SECTIONS ── */}
          {SECTIONS.map(section=>(
            <div key={section.title} className="fu" style={{marginBottom:16}}>
              <p style={{color:txt3Color,fontSize:9,fontWeight:700,letterSpacing:'0.1em',margin:'0 0 7px',paddingLeft:2}}>{section.title.toUpperCase()}</p>
              <div style={{background:cardBg,border:`1px solid ${borderColor}`,borderRadius:16,overflow:'hidden'}}>
                {section.items.map((item,i)=>{
                  const Icon=item.icon
                  return(
                    <button key={item.label}
                      onClick={()=>{if(item.path)navigate(item.path);else toast('Coming soon 🚧',{icon:'🔧'})}}
                      style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'13px 15px',borderBottom:i<section.items.length-1?`1px solid ${borderColor}`:'none',background:'transparent',border:'none',cursor:'pointer',textAlign:'left',...F,transition:'background 0.1s'}}>
                      <div style={{width:34,height:34,borderRadius:9,background:item.soon?pageBg:card2Bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <Icon size={15} color={item.soon?txt3Color:txt2Color}/>
                      </div>
                      <div style={{flex:1}}>
                        <p style={{color:item.soon?txt2Color:txtColor,fontWeight:600,fontSize:13,margin:'0 0 1px'}}>{item.label}</p>
                        <p style={{color:txt3Color,fontSize:11,margin:0}}>{item.sub}</p>
                      </div>
                      {item.soon
                        ?<span style={{background:card2Bg,color:txt3Color,fontSize:9,fontWeight:700,padding:'3px 8px',borderRadius:10}}>Soon</span>
                        :<ChevronRight size={13} color={txt3Color}/>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Sign out */}
          <div className="fu">
            <button onClick={handleSignOut}
              style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'14px 15px',background:cardBg,border:`1px solid rgba(239,68,68,0.2)`,borderRadius:16,cursor:'pointer',textAlign:'left',...F}}>
              <div style={{width:34,height:34,borderRadius:9,background:'rgba(239,68,68,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <LogOut size={15} color={RED}/>
              </div>
              <span style={{color:RED,fontWeight:700,fontSize:14}}>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </BarberLayout>
  )
}